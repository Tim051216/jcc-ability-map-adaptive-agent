from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from app.core.logging import logger


INTENT_KNOWLEDGE_BASE_QA = "knowledge_base_qa"
INTENT_TOOL_CALL_MCP = "tool_call_mcp"
INTENT_SYSTEM_INSTRUCTION = "system_instruction"
INTENT_CASUAL_CHAT = "casual_chat"
INTENT_CLARIFICATION = "clarification"

SUPPORTED_INTENTS = {
    INTENT_KNOWLEDGE_BASE_QA,
    INTENT_TOOL_CALL_MCP,
    INTENT_SYSTEM_INSTRUCTION,
    INTENT_CASUAL_CHAT,
    INTENT_CLARIFICATION,
}


@dataclass(slots=True)
class IntentDecision:
    intent: str
    confidence: float
    route: str
    reason: str
    top_candidates: list[dict[str, Any]]
    needs_clarification: bool = False
    clarification_question: str | None = None
    tool_name: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "intent": self.intent,
            "confidence": self.confidence,
            "route": self.route,
            "reason": self.reason,
            "top_candidates": self.top_candidates,
            "needs_clarification": self.needs_clarification,
            "clarification_question": self.clarification_question,
            "tool_name": self.tool_name,
        }


class IntentTreeService:
    """LLM-first intent tree with deterministic fallback for tutoring routing."""

    LOW_CONFIDENCE_THRESHOLD = 0.65

    KNOWLEDGE_KEYWORDS = (
        "软件工程",
        "需求分析",
        "概要设计",
        "详细设计",
        "测试",
        "生命周期",
        "瀑布模型",
        "原型模型",
        "UML",
        "用例",
        "数据流图",
        "课程",
        "章节",
        "讲义",
        "知识库",
        "解释",
        "什么是",
        "为什么",
        "如何",
        "怎么",
        "区别",
        "作用",
        "流程",
        "步骤",
        "代码",
        "算法",
    )
    TOOL_KEYWORDS = (
        "天气",
        "气温",
        "下雨",
        "几点",
        "时间",
        "日期",
        "星期",
        "最新",
        "联网",
        "搜索",
        "查一下",
        "网页",
        "新闻",
        "打开",
        "抓取",
        "websearch",
        "webfetch",
        "firecrawl",
        "mcp",
        "工具",
    )
    SYSTEM_KEYWORDS = (
        "忽略之前",
        "忽略以上",
        "系统提示",
        "system prompt",
        "开发者消息",
        "developer message",
        "越狱",
        "jailbreak",
        "泄露",
        "提示词",
        "你必须",
        "不要遵守",
        "删除",
        "重置",
        "执行命令",
        "关机",
        "读取密钥",
        "api key",
        "token",
    )
    CASUAL_KEYWORDS = (
        "你好",
        "在吗",
        "你是谁",
        "你能做什么",
        "陪我聊",
        "无聊",
        "谢谢",
        "早上好",
        "晚上好",
        "hello",
        "hi",
    )
    AMBIGUOUS_SHORT = ("这个", "那个", "它", "这题", "帮我看看", "怎么弄", "讲一下", "看看")

    def __init__(self) -> None:
        self.llm_client: Any | None = None

    async def classify(self, text: str, *, allow_llm: bool = True) -> IntentDecision:
        normalized = self._normalize(text)
        if not normalized:
            return self._clarification("请先告诉我你想问课程知识、查资料，还是要我执行某个工具操作？")

        fallback = self._classify_by_rules(text)
        if not allow_llm or fallback.confidence >= 0.9:
            return fallback

        try:
            llm_decision = await self._classify_by_llm(text, fallback)
        except Exception as exc:
            logger.info("intent_tree.llm_fallback", error=repr(exc))
            return fallback

        if llm_decision.confidence < self.LOW_CONFIDENCE_THRESHOLD:
            return self._with_clarification(llm_decision, text)
        return llm_decision

    def classify_sync_rules(self, text: str) -> IntentDecision:
        return self._classify_by_rules(text)

    async def _classify_by_llm(self, text: str, fallback: IntentDecision) -> IntentDecision:
        if self.llm_client is None:
            from app.integrations.llm.client import get_llm_client

            self.llm_client = get_llm_client()
        prompt = (
            "你是教育 AI Tutor 的意图识别器。只输出 JSON，不要输出解释。\n"
            "候选意图：knowledge_base_qa, tool_call_mcp, system_instruction, casual_chat, clarification。\n"
            "含义：knowledge_base_qa=课程知识库问答；tool_call_mcp=需要工具/API/MCP/联网/天气/时间；"
            "system_instruction=系统指令、越狱、敏感操作或提示词攻击；casual_chat=寒暄闲聊；"
            "clarification=用户问题过短或指代不清，需要反问。\n"
            "JSON 字段：intent, confidence(0-1), route, reason, tool_name。\n"
            f"用户输入：{text}\n"
            f"规则初判：{fallback.intent}, confidence={fallback.confidence}\n"
        )
        response = await self.llm_client.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=220,
            timeout=3.0,
        )
        content = str(response.choices[0].message.content or "").strip()
        payload = self._parse_json_object(content)
        intent = str(payload.get("intent") or fallback.intent).strip()
        if intent not in SUPPORTED_INTENTS:
            intent = fallback.intent
        confidence = self._clamp_float(payload.get("confidence"), fallback.confidence)
        route = str(payload.get("route") or self._route_for(intent)).strip()
        reason = str(payload.get("reason") or fallback.reason).strip()
        tool_name = payload.get("tool_name")
        tool_name = str(tool_name).strip() if tool_name else fallback.tool_name
        top_candidates = self._rank_candidates(intent, confidence, text)
        decision = IntentDecision(
            intent=intent,
            confidence=confidence,
            route=route,
            reason=reason,
            top_candidates=top_candidates,
            tool_name=tool_name,
        )
        if confidence < self.LOW_CONFIDENCE_THRESHOLD or intent == INTENT_CLARIFICATION:
            return self._with_clarification(decision, text)
        return decision

    def _classify_by_rules(self, text: str) -> IntentDecision:
        normalized = self._normalize(text)
        scores = self._score_intents(text)

        ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        top_intent, top_score = ranked[0]
        second_score = ranked[1][1] if len(ranked) > 1 else 0.0
        confidence = self._score_to_confidence(top_score, second_score, normalized)
        if top_intent == INTENT_CASUAL_CHAT:
            confidence = max(confidence, 0.82)
        if top_intent == INTENT_SYSTEM_INSTRUCTION:
            confidence = max(confidence, 0.86)
        if top_intent == INTENT_TOOL_CALL_MCP and top_score >= 1.0:
            confidence = max(confidence, 0.78)
        if top_score <= 0:
            return self._clarification("你想让我讲课程知识、查实时资料，还是执行某个工具操作？")

        decision = IntentDecision(
            intent=top_intent,
            confidence=confidence,
            route=self._route_for(top_intent),
            reason=self._reason_for(top_intent),
            top_candidates=[
                {"intent": intent, "score": round(score, 3)}
                for intent, score in ranked
                if score > 0
            ][:3],
            tool_name=self._infer_tool_name(text) if top_intent == INTENT_TOOL_CALL_MCP else None,
        )
        if top_intent == INTENT_CLARIFICATION or confidence < self.LOW_CONFIDENCE_THRESHOLD:
            return self._with_clarification(decision, text)
        return decision

    def _with_clarification(self, decision: IntentDecision, text: str) -> IntentDecision:
        question = self._build_clarification_question(text, decision)
        decision.needs_clarification = True
        decision.clarification_question = question
        if decision.intent == INTENT_CLARIFICATION:
            decision.route = "clarify"
        return decision

    def _clarification(self, question: str) -> IntentDecision:
        return IntentDecision(
            intent=INTENT_CLARIFICATION,
            confidence=0.4,
            route="clarify",
            reason="用户输入缺少明确任务目标或上下文。",
            top_candidates=[{"intent": INTENT_CLARIFICATION, "score": 1.0}],
            needs_clarification=True,
            clarification_question=question,
        )

    @classmethod
    def _build_clarification_question(cls, text: str, decision: IntentDecision) -> str:
        if decision.intent == INTENT_TOOL_CALL_MCP:
            return "你是想让我联网搜索资料、查询天气/时间，还是调用某个具体工具？可以补充一下目标。"
        if decision.intent == INTENT_KNOWLEDGE_BASE_QA:
            return "你想问哪个课程章节或知识点？可以把主题、教材章节或具体问题补充一下。"
        if decision.intent == INTENT_SYSTEM_INSTRUCTION:
            return "这个请求涉及系统操作或权限边界。你是想了解系统能力，还是要执行某个具体操作？"
        return "这个问题有点短，我不确定你的目标。你是想问课程知识、查实时资料，还是让我执行工具操作？"

    @staticmethod
    def _parse_json_object(text: str) -> dict[str, Any]:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except Exception:
            return {}

    @staticmethod
    def _normalize(text: str) -> str:
        return re.sub(r"\s+", "", str(text or "").strip().lower())

    @staticmethod
    def _keyword_score(text: str, keywords: tuple[str, ...]) -> float:
        lowered = text.lower()
        score = 0.0
        for keyword in keywords:
            if keyword.lower() in lowered:
                score += 1.0 if len(keyword) <= 3 else 1.25
        return score

    @classmethod
    def _score_intents(cls, text: str) -> dict[str, float]:
        normalized = cls._normalize(text)
        scores = {
            INTENT_KNOWLEDGE_BASE_QA: cls._keyword_score(text, cls.KNOWLEDGE_KEYWORDS),
            INTENT_TOOL_CALL_MCP: cls._keyword_score(text, cls.TOOL_KEYWORDS),
            INTENT_SYSTEM_INSTRUCTION: cls._keyword_score(text, cls.SYSTEM_KEYWORDS),
            INTENT_CASUAL_CHAT: cls._keyword_score(text, cls.CASUAL_KEYWORDS),
            INTENT_CLARIFICATION: 0.0,
        }

        if len(normalized) <= 8 and any(token in text for token in cls.AMBIGUOUS_SHORT):
            scores[INTENT_CLARIFICATION] = 2.6
        if len(normalized) <= 4 and not scores[INTENT_CASUAL_CHAT]:
            scores[INTENT_CLARIFICATION] = max(scores[INTENT_CLARIFICATION], 2.2)
        if re.search(r"https?://|www\.", text, re.I):
            scores[INTENT_TOOL_CALL_MCP] += 1.3
        if any(token in text for token in ("天气", "气温", "下雨", "降雨")):
            scores[INTENT_TOOL_CALL_MCP] += 0.8
        if any(token in text for token in ("系统提示", "开发者消息", "提示词")):
            scores[INTENT_SYSTEM_INSTRUCTION] += 0.8
        if re.search(r"(第[一二三四五六七八九十0-9]+章|chapter|section)", text, re.I):
            scores[INTENT_KNOWLEDGE_BASE_QA] += 1.2
        if re.search(r"(rm\s+-rf|powershell|cmd\s*/c|drop\s+table|读取.*密钥)", text, re.I):
            scores[INTENT_SYSTEM_INSTRUCTION] += 1.6
        if "mcp" in text.lower():
            scores[INTENT_TOOL_CALL_MCP] += 1.0
        return scores

    @staticmethod
    def _score_to_confidence(top_score: float, second_score: float, normalized: str) -> float:
        margin = max(top_score - second_score, 0.0)
        base = 0.45 + min(top_score, 4.0) * 0.1 + min(margin, 3.0) * 0.08
        if len(normalized) >= 18:
            base += 0.06
        return round(max(0.35, min(base, 0.98)), 3)

    @staticmethod
    def _clamp_float(value: Any, fallback: float) -> float:
        try:
            number = float(value)
        except Exception:
            number = fallback
        return round(max(0.0, min(number, 1.0)), 3)

    @staticmethod
    def _route_for(intent: str) -> str:
        return {
            INTENT_KNOWLEDGE_BASE_QA: "rag_answer",
            INTENT_TOOL_CALL_MCP: "tool_call",
            INTENT_SYSTEM_INSTRUCTION: "guardrail",
            INTENT_CASUAL_CHAT: "chat",
            INTENT_CLARIFICATION: "clarify",
        }.get(intent, "clarify")

    @staticmethod
    def _reason_for(intent: str) -> str:
        return {
            INTENT_KNOWLEDGE_BASE_QA: "命中课程、章节、概念解释或知识库问答特征。",
            INTENT_TOOL_CALL_MCP: "命中实时信息、联网搜索、网页抓取或工具调用特征。",
            INTENT_SYSTEM_INSTRUCTION: "命中系统指令、敏感操作或提示词攻击特征。",
            INTENT_CASUAL_CHAT: "命中寒暄、身份、能力或陪伴式闲聊特征。",
            INTENT_CLARIFICATION: "输入目标不明确，需要澄清。",
        }.get(intent, "需要进一步确认意图。")

    @classmethod
    def _rank_candidates(cls, top_intent: str, confidence: float, text: str) -> list[dict[str, Any]]:
        ranked = sorted(cls._score_intents(text).items(), key=lambda item: item[1], reverse=True)
        candidates = [
            {"intent": intent, "score": round(score, 3)}
            for intent, score in ranked
            if score > 0
        ]
        if not candidates or candidates[0].get("intent") != top_intent:
            candidates.insert(0, {"intent": top_intent, "score": confidence})
        return candidates[:3]

    @staticmethod
    def _infer_tool_name(text: str) -> str | None:
        lowered = text.lower()
        if any(token in text for token in ("天气", "气温", "下雨", "降雨")):
            return "weather"
        if any(token in text for token in ("几点", "时间", "日期", "星期")):
            return "local_time"
        if any(token in lowered for token in ("webfetch", "抓取", "网页", "url", "http")):
            return "webfetch"
        if any(token in lowered for token in ("websearch", "firecrawl", "搜索", "联网", "最新")):
            return "websearch"
        if "mcp" in lowered:
            return "mcp_tool"
        return "tool"
