from __future__ import annotations

import asyncio
import json
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger
from app.integrations.llm.client import get_llm_client
from app.schemas.resource import (
    VideoInsightArticlePack,
    VideoInsightAskRequest,
    VideoInsightAskResponse,
    VideoInsightCue,
    VideoInsightResponse,
    VideoInsightSummaryPack,
    VideoInsightTerm,
    VideoInsightTimelinePoint,
)

logger = get_logger(__name__)


class VideoInsightService:
    def __init__(self) -> None:
        self.llm_client = get_llm_client()

    async def get_insight(
        self,
        *,
        resource_id: int | None,
        file_id: int,
        resource_title: str | None = None,
        file_name: str | None = None,
    ) -> VideoInsightResponse:
        fallback = self._build_fallback_insight(
            resource_id=resource_id,
            file_id=file_id,
            resource_title=resource_title,
            file_name=file_name,
        )
        try:
            generated = await asyncio.wait_for(
                self._generate_with_llm(fallback),
                timeout=min(max(int(settings.llm_timeout_seconds or 30), 1), 20),
            )
            if generated is not None:
                logger.info("video_insight.generate.success", file_id=file_id, resource_id=resource_id)
                return generated
            logger.warning("video_insight.generate.empty", file_id=file_id, resource_id=resource_id)
        except Exception as exc:
            logger.warning(
                "video_insight.generate.fallback",
                file_id=file_id,
                resource_id=resource_id,
                error=repr(exc),
            )
            pass
        return fallback

    async def ask(self, payload: VideoInsightAskRequest) -> VideoInsightAskResponse:
        insight = await self.get_insight(
            resource_id=payload.resource_id,
            file_id=payload.file_id,
            resource_title=payload.resource_title,
            file_name=payload.file_name,
        )

        fallback_answer = self._answer_question(
            insight=insight,
            question=payload.question,
            current_time=payload.current_time,
        )

        try:
            llm_answer = await asyncio.wait_for(
                self._ask_with_llm(insight=insight, payload=payload),
                timeout=min(max(int(settings.llm_timeout_seconds or 30), 1), 15),
            )
            if llm_answer:
                logger.info("video_insight.ask.success", file_id=payload.file_id, resource_id=payload.resource_id)
                return VideoInsightAskResponse(answer=llm_answer, matched_time=int(payload.current_time or 0))
            logger.warning("video_insight.ask.empty", file_id=payload.file_id, resource_id=payload.resource_id)
        except Exception as exc:
            logger.warning(
                "video_insight.ask.fallback",
                file_id=payload.file_id,
                resource_id=payload.resource_id,
                error=repr(exc),
            )
            pass

        return VideoInsightAskResponse(answer=fallback_answer, matched_time=int(payload.current_time or 0))

    async def _generate_with_llm(self, fallback: VideoInsightResponse) -> VideoInsightResponse | None:
        prompt = f"""
你是视频学习理解助手。请基于下面的视频主题，输出严格 JSON，不要输出 markdown，不要解释。

视频标题: {fallback.title}
视频主题: {fallback.topic}

请输出字段：
- title: string
- topic: string
- summary: {{"minute": string, "three_minute": string, "deep_dive": string[]}}
- timeline: [{{"time": int, "label": string, "detail": string}}]，提供 5 到 6 个节点
- terms: [{{"term": string, "time": int, "alias": string, "explanation": string, "background": string}}]，提供 3 到 4 个术语
- subtitles: [{{"start": int, "end": int, "zh": string, "en": string, "corrected": string}}]，提供 4 到 5 条双语字幕
- article_pack: {{"article": string[], "notes": string[], "mindmap": string[]}}
- formula_hint: string

要求：
1. 内容必须是中文学习场景
2. 适合软件工程或通用课程视频理解
3. 时间点用秒数整数
4. mindmap 使用层级文本
5. 确保字段完整，JSON 可直接解析
"""
        response = await self.llm_client.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=1400,
        )
        content = self._extract_content(response)
        data = self._parse_json_object(content)
        if not data:
            return None

        summary_data = data.get("summary") if isinstance(data.get("summary"), dict) else {}

        return VideoInsightResponse(
            resource_id=fallback.resource_id,
            file_id=fallback.file_id,
            title=str(data.get("title") or fallback.title),
            topic=str(data.get("topic") or fallback.topic),
            summary=VideoInsightSummaryPack(
                minute=str(summary_data.get("minute") or fallback.summary.minute),
                three_minute=str(summary_data.get("three_minute") or fallback.summary.three_minute),
                deep_dive=self._as_string_list(summary_data.get("deep_dive"), fallback.summary.deep_dive),
            ),
            timeline=self._build_timeline(data.get("timeline"), fallback.timeline),
            terms=self._build_terms(data.get("terms"), fallback.terms),
            subtitles=self._build_subtitles(data.get("subtitles"), fallback.subtitles),
            article_pack=self._build_article_pack(data.get("article_pack"), fallback.article_pack),
            formula_hint=str(data.get("formula_hint") or fallback.formula_hint),
        )

    async def _ask_with_llm(self, *, insight: VideoInsightResponse, payload: VideoInsightAskRequest) -> str | None:
        prompt = f"""
你是视频分段问答助手。请基于给定的视频理解结果，回答用户问题。

视频标题: {insight.title}
视频主题: {insight.topic}
当前时间: {int(payload.current_time or 0)} 秒
用户问题: {payload.question}

可参考的时间轴:
{json.dumps([item.model_dump() for item in insight.timeline], ensure_ascii=False)}

可参考的术语:
{json.dumps([item.model_dump() for item in insight.terms], ensure_ascii=False)}

回答要求：
1. 用中文
2. 80 字以内优先，必要时可略长
3. 直接回答，不要前置寒暄
4. 如果问题是“这段在讲什么”，要结合当前时间点回答
"""
        response = await self.llm_client.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=220,
        )
        content = self._extract_content(response).strip()
        return content or None

    def _build_fallback_insight(
        self,
        *,
        resource_id: int | None,
        file_id: int,
        resource_title: str | None,
        file_name: str | None,
    ) -> VideoInsightResponse:
        topic = self._pick_topic(resource_title=resource_title, file_name=file_name)
        title = resource_title or file_name or f"视频资源 {file_id}"
        return VideoInsightResponse(
            resource_id=resource_id,
            file_id=file_id,
            title=title,
            topic=topic,
            summary=VideoInsightSummaryPack(
                minute=f"这段视频围绕“{topic}”快速建立问题背景、演示路径和最终复盘点，适合先抓主线再补细节。",
                three_minute=f"视频先交代“{topic}”要解决的场景与目标，再拆解关键步骤、判断依据和常见误区，最后回到可迁移的方法，帮助学习者把演示过程沉淀成复习材料。",
                deep_dive=[
                    "作者先用具体场景建立上下文，避免学习者只记住零散术语。",
                    "中段将流程拆成可验证步骤，每一步都对应一个知识点或判断规则。",
                    "视频强调的不只是怎么做，还解释了为什么这样做、容易错在哪里。",
                    "如果用于复习，最值得保留的是时间节点、核心术语和步骤顺序。",
                ],
            ),
            timeline=[
                VideoInsightTimelinePoint(time=8, label="问题背景", detail="交代本节想解决什么问题，以及学习目标。"),
                VideoInsightTimelinePoint(time=36, label="核心概念", detail="引入关键术语、对象关系与理解框架。"),
                VideoInsightTimelinePoint(time=78, label="方法演示", detail="开始进入具体流程，从输入推到结果。"),
                VideoInsightTimelinePoint(time=126, label="规则表达", detail="补充规则、公式或判断依据。"),
                VideoInsightTimelinePoint(time=174, label="案例复盘", detail="把方法映射回真实案例，说明迁移点。"),
                VideoInsightTimelinePoint(time=228, label="总结提升", detail="收束为复习建议与下一步动作。"),
            ],
            terms=[
                VideoInsightTerm(term="知识点时间轴", time=32, alias="Timeline", explanation="把视频按时间切成可检索的知识片段，方便回看与定位。", background="适合二刷、复盘和做笔记时快速定位重点。"),
                VideoInsightTerm(term="术语纠错", time=92, alias="Term Correction", explanation="自动识别字幕翻译中的专业词误译并给出推荐表达。", background="对人物名、公式名、软件名和课程术语尤其有用。"),
                VideoInsightTerm(term="结构化摘要", time=142, alias="Structured Summary", explanation="不仅压缩内容，还保留主题、步骤、因果和结论。", background="适合生成 1 分钟版、3 分钟版和深度复盘版摘要。"),
                VideoInsightTerm(term="脑图转写", time=210, alias="Mindmap Export", explanation="把视频理解结果转成层级结构，便于记忆和讲解。", background="适合考前梳理章节框架与答辩提纲。"),
            ],
            subtitles=[
                VideoInsightCue(start=0, end=22, zh="这一段先建立任务背景，说明为什么这一步是整个流程的入口。", en="This section sets up the task context and explains why this step is the entry point of the workflow.", corrected="workflow entry point"),
                VideoInsightCue(start=22, end=60, zh="作者开始拆解关键概念，并提醒要把定义和场景对应起来理解。", en="The speaker starts unpacking the key concepts and reminds us to map each definition back to the scenario.", corrected="key concepts"),
                VideoInsightCue(start=60, end=118, zh="这里进入核心演示，重点不是操作本身，而是每一步背后的判断依据。", en="This is the core demonstration, and the focus is not the action itself but the reasoning behind each step.", corrected="reasoning behind each step"),
                VideoInsightCue(start=118, end=180, zh="如果你在这里卡住，可以直接追问这段在讲什么或作者刚才提到的公式是什么。", en="If you get stuck here, you can directly ask what this segment means or what formula was just mentioned.", corrected="formula mentioned just now"),
                VideoInsightCue(start=180, end=260, zh="结尾部分在做复盘，帮助你把视频内容沉淀成笔记、文章和脑图。", en="The ending is a recap that helps you turn the video into notes, an article, and a mind map.", corrected="recap"),
            ],
            article_pack=VideoInsightArticlePack(
                article=[
                    f"本视频围绕“{topic}”展开，先通过真实任务建立学习目标，再逐步推进到概念、流程与复盘。",
                    "从讲解方式看，作者不是只给答案，而是在持续解释每一步为什么成立，这让内容更适合做迁移学习。",
                    "如果站在复习视角，最值得二刷的位置是概念首次出现、规则被明确表达，以及案例回到实践建议的几个节点。",
                ],
                notes=[
                    f"主题：{topic}",
                    "先看背景，再抓核心概念，再记操作路径。",
                    "出现专业术语时，优先记录定义、场景、误区三件事。",
                    "复盘时用“问题 - 方法 - 依据 - 结果”四列整理最快。",
                ],
                mindmap=[
                    topic,
                    "├─ 背景与目标",
                    "├─ 核心概念与术语",
                    "├─ 流程演示与关键步骤",
                    "├─ 规则/公式/判断依据",
                    "└─ 复盘建议与迁移应用",
                ],
            ),
            formula_hint="可重点关注“输入条件 -> 判断规则 -> 输出结果”的规则化表达方式，本段更像规则链而非纯数学推导。",
        )

    def _pick_topic(self, *, resource_title: str | None, file_name: str | None) -> str:
        raw = f"{resource_title or ''} {file_name or ''}".lower()
        if "react" in raw:
            return "React 状态管理与组件协作"
        if "visio" in raw or "flow" in raw:
            return "流程建模与系统分析"
        if "cloud" in raw:
            return "云端应用集成与交互链路"
        return "软件工程项目演示与知识梳理"

    def _answer_question(self, *, insight: VideoInsightResponse, question: str, current_time: float) -> str:
        normalized = (question or "").strip().lower()
        if not normalized:
            return "先输入一个问题，我会基于当前片段给你解释。"
        if "这段" in normalized or "讲什么" in normalized:
            point = min(insight.timeline, key=lambda item: abs(item.time - int(current_time)))
            return f"当前大约在 {self._format_time(current_time)}，这一段主要在讲“{point.label}”。{point.detail}"
        if "公式" in normalized:
            return f"作者刚提到的重点更接近规则表达：{insight.formula_hint}"
        if "术语" in normalized or "什么意思" in normalized:
            term = self._active_term(insight=insight, current_time=current_time)
            return f"当前最相关的术语是“{term.term}”。它的意思是：{term.explanation} 背景上，{term.background}"
        if "总结" in normalized or "摘要" in normalized:
            return insight.summary.minute
        return (
            f"我会把你的问题归到当前片段来解释：这段核心是“{insight.topic}”，"
            f"建议先看 {self._format_time(insight.timeline[2].time)} 到 {self._format_time(insight.timeline[4].time)} 这一段，再结合时间轴复盘。"
        )

    def _active_term(self, *, insight: VideoInsightResponse, current_time: float) -> VideoInsightTerm:
        active = insight.terms[0]
        for item in sorted(insight.terms, key=lambda row: row.time):
            if current_time >= item.time:
                active = item
        return active

    def _extract_content(self, response: Any) -> str:
        if hasattr(response, "content"):
            return str(response.content or "")
        if hasattr(response, "get"):
            return str(response.get("content", "") or "")
        return ""

    def _parse_json_object(self, text: str) -> dict[str, Any] | None:
        raw = (text or "").strip()
        if not raw:
            return None
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.lower().startswith("json"):
                raw = raw[4:].strip()
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            raw = raw[start:end + 1]
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None

    def _as_string_list(self, value: Any, fallback: list[str]) -> list[str]:
        if isinstance(value, list):
            items = [str(item).strip() for item in value if str(item).strip()]
            if items:
                return items
        return fallback

    def _build_timeline(self, value: Any, fallback: list[VideoInsightTimelinePoint]) -> list[VideoInsightTimelinePoint]:
        if not isinstance(value, list):
            return fallback
        items: list[VideoInsightTimelinePoint] = []
        for row in value:
            if not isinstance(row, dict):
                continue
            try:
                items.append(
                    VideoInsightTimelinePoint(
                        time=int(row.get("time", 0)),
                        label=str(row.get("label") or ""),
                        detail=str(row.get("detail") or ""),
                    )
                )
            except Exception:
                continue
        return items or fallback

    def _build_terms(self, value: Any, fallback: list[VideoInsightTerm]) -> list[VideoInsightTerm]:
        if not isinstance(value, list):
            return fallback
        items: list[VideoInsightTerm] = []
        for row in value:
            if not isinstance(row, dict):
                continue
            try:
                items.append(
                    VideoInsightTerm(
                        term=str(row.get("term") or ""),
                        time=int(row.get("time", 0)),
                        alias=str(row.get("alias")) if row.get("alias") else None,
                        explanation=str(row.get("explanation") or ""),
                        background=str(row.get("background") or ""),
                    )
                )
            except Exception:
                continue
        return items or fallback

    def _build_subtitles(self, value: Any, fallback: list[VideoInsightCue]) -> list[VideoInsightCue]:
        if not isinstance(value, list):
            return fallback
        items: list[VideoInsightCue] = []
        for row in value:
            if not isinstance(row, dict):
                continue
            try:
                items.append(
                    VideoInsightCue(
                        start=int(row.get("start", 0)),
                        end=int(row.get("end", 0)),
                        zh=str(row.get("zh") or ""),
                        en=str(row.get("en") or ""),
                        corrected=str(row.get("corrected")) if row.get("corrected") else None,
                    )
                )
            except Exception:
                continue
        return items or fallback

    def _build_article_pack(self, value: Any, fallback: VideoInsightArticlePack) -> VideoInsightArticlePack:
        if not isinstance(value, dict):
            return fallback
        return VideoInsightArticlePack(
            article=self._as_string_list(value.get("article"), fallback.article),
            notes=self._as_string_list(value.get("notes"), fallback.notes),
            mindmap=self._as_string_list(value.get("mindmap"), fallback.mindmap),
        )

    def _format_time(self, total_seconds: float | int) -> str:
        total = int(total_seconds or 0)
        minutes = total // 60
        seconds = total % 60
        return f"{minutes:02d}:{seconds:02d}"
