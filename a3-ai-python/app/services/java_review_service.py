from __future__ import annotations

import json
import re
from typing import Any

from app.integrations.llm.client import get_llm_client
from app.schemas.resource import JavaReviewRequest, JavaReviewResponse


class JavaReviewService:
    def __init__(self) -> None:
        self.llm_client = get_llm_client()

    async def review(self, payload: JavaReviewRequest) -> JavaReviewResponse:
        source_code = (payload.source_code or "").strip()
        if not source_code:
            return JavaReviewResponse(
                success=False,
                summary="当前没有可分析的代码。",
                key_issues=["请先提供 Java 代码后再发起 AI 纠错。"],
                suggested_code="",
                next_steps=["先生成或补全 Main.java，再点击 AI 纠错。"],
            )

        prompt = self._build_prompt(payload)
        try:
            response = await self.llm_client.chat_completion(
                [
                    {
                        "role": "system",
                        "content": (
                            "你是一名面向中国软件类课程与竞赛场景的 Java 代码助教。"
                            "请对学生提交的 Main.java 做简洁、可执行的纠错分析。"
                            "输出必须是 JSON，不要附带额外解释。"
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=1800,
            )
            content = getattr(response, "content", "") or response.choices[0].message.content
            return self._parse_response(content, payload)
        except Exception:
            return self._fallback_review(payload)

    def _build_prompt(self, payload: JavaReviewRequest) -> str:
        return (
            "请分析下面这段 Java 代码，并返回 JSON：\n"
            "{\n"
            '  "summary": "一句话总结当前代码状态",\n'
            '  "key_issues": ["问题1", "问题2"],\n'
            '  "suggested_code": "给出可直接替换的 Main.java",\n'
            '  "next_steps": ["下一步1", "下一步2"]\n'
            "}\n\n"
            f"资源标题：{payload.resource_title or '代码实操任务'}\n"
            f"题面：{payload.problem_statement or '未提供题面'}\n"
            f"编译输出：{payload.compile_output or '无'}\n"
            f"运行输出：{payload.runtime_output or '无'}\n"
            f"期望输出：{payload.expected_output or '未提供'}\n\n"
            "代码如下：\n"
            "```java\n"
            f"{payload.source_code}\n"
            "```"
        )

    def _parse_response(self, content: str, payload: JavaReviewRequest) -> JavaReviewResponse:
        try:
            if "```json" in content:
                start = content.find("```json") + len("```json")
                end = content.find("```", start)
                content = content[start:end].strip()
            elif not content.strip().startswith("{"):
                start = content.find("{")
                end = content.rfind("}")
                if start >= 0 and end > start:
                    content = content[start : end + 1]

            data = self._repair_mojibake_payload(json.loads(content))
            return JavaReviewResponse(
                success=True,
                summary=str(data.get("summary") or "已完成代码分析。"),
                key_issues=[str(item) for item in (data.get("key_issues") or [])][:6],
                suggested_code=str(data.get("suggested_code") or payload.source_code),
                next_steps=[str(item) for item in (data.get("next_steps") or [])][:4],
            )
        except Exception:
            return self._fallback_review(payload)

    @classmethod
    def _repair_mojibake_payload(cls, value: Any) -> Any:
        if isinstance(value, str):
            return cls._repair_mojibake_text(value)
        if isinstance(value, list):
            return [cls._repair_mojibake_payload(item) for item in value]
        if isinstance(value, dict):
            return {key: cls._repair_mojibake_payload(item) for key, item in value.items()}
        return value

    @staticmethod
    def _repair_mojibake_text(value: str) -> str:
        if not value:
            return value
        if not re.search(r"[脙脗芒忙莽猫茅茂锟]{2,}", value):
            return value

        candidates = [value]
        try:
            candidates.append(value.encode("latin1").decode("utf-8"))
        except Exception:
            pass
        try:
            candidates.append(value.encode("cp1252", errors="ignore").decode("utf-8"))
        except Exception:
            pass

        def score(candidate: str) -> tuple[int, int]:
            penalty = sum(candidate.count(token) for token in ("脙", "脗", "芒", "忙", "莽", "猫", "茅", "茂", "锟"))
            chinese_count = len(re.findall(r"[\u4e00-\u9fff]", candidate))
            return penalty, -chinese_count

        return min(candidates, key=score)

    def _fallback_review(self, payload: JavaReviewRequest) -> JavaReviewResponse:
        code = payload.source_code
        issues: list[str] = []
        next_steps: list[str] = []
        summary = "已给出基于规则的本地代码检查建议。"

        if "class Main" not in code:
            issues.append("缺少 `class Main` 主类，当前运行链路无法编译。")
        if "public static void main" not in code:
            issues.append("缺少标准入口 `public static void main(String[] args)`。")
        if "Scanner" not in code and "BufferedReader" not in code:
            issues.append("没有看到标准输入读取逻辑，可能无法处理测试用例输入。")
        if payload.expected_output and payload.runtime_output and payload.expected_output.strip() != payload.runtime_output.strip():
            issues.append("当前运行输出与期望输出不一致，需要回到核心逻辑重新核对。")
        if payload.compile_output:
            first_line = payload.compile_output.strip().splitlines()[0]
            issues.append(f"编译信息提示：{first_line}")

        if not issues:
            issues.append("代码整体结构基本可运行，建议重点检查边界条件和输出格式。")

        next_steps.extend(
            [
                "先确保 `Main.java` 能在当前样例输入下稳定运行。",
                "再对照期望输出检查多余空格、换行和提示文字。",
                "最后补一组边界样例做自测，再提交判题。",
            ]
        )

        suggested_code = code
        if "class Main" not in code or "public static void main" not in code:
            suggested_code = (
                "import java.util.*;\n\n"
                "public class Main {\n"
                "    public static void main(String[] args) {\n"
                "        Scanner scanner = new Scanner(System.in);\n"
                "        if (!scanner.hasNextLine()) {\n"
                '            System.out.println("请根据题目补全逻辑");\n'
                "            return;\n"
                "        }\n"
                "        String line = scanner.nextLine().trim();\n"
                "        // TODO: 在这里按题意补全处理逻辑\n"
                "        System.out.println(line);\n"
                "    }\n"
                "}\n"
            )

        return JavaReviewResponse(
            success=True,
            summary=summary,
            key_issues=issues[:6],
            suggested_code=suggested_code,
            next_steps=next_steps[:4],
        )
