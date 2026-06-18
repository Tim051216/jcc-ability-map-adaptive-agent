from __future__ import annotations

import re
from dataclasses import dataclass

import httpx

from app.core.config import settings
from app.core.logging import logger
from app.schemas.guardrails import GuardrailIssue, GuardrailReview, HallucinationReview, SafetyReview
from app.services.rag_service import RagService
from app.schemas.rag import RagSearchRequest


@dataclass
class GuardrailContext:
    scene: str = "general"
    course_code: str | None = None
    course_id: int | None = None
    user_id: int | None = None
    citations: list[str] | None = None


class GuardrailViolationError(RuntimeError):
    def __init__(self, message: str, review: SafetyReview):
        super().__init__(message)
        self.review = review


class GuardrailService:
    DEFAULT_SENSITIVE_WORDS = [
        "暴力恐怖",
        "自残",
        "自杀",
        "仇恨",
        "色情",
        "毒品",
        "刷单",
        "作弊",
        "代考",
        "外挂",
    ]

    DEFAULT_RISK_PATTERNS: list[tuple[str, str]] = [
        ("exam_cheating", r"(代考|替考|考试作弊|刷题脚本|作弊器|外挂)"),
        ("harmful", r"(自杀|自残|炸弹|爆炸物|恐怖袭击)"),
        ("abuse", r"(仇恨|种族灭绝|极端主义)"),
    ]

    def __init__(self) -> None:
        self.rag_service = RagService()

    def _sensitive_words(self) -> list[str]:
        custom = [
            item.strip()
            for item in (settings.guardrails_sensitive_words or settings.tutoring_sensitive_words or "").split(",")
            if item.strip()
        ]
        return list(dict.fromkeys([*self.DEFAULT_SENSITIVE_WORDS, *custom]))

    async def review_input(self, text: str, *, context: GuardrailContext) -> SafetyReview:
        if not settings.guardrails_enabled:
            return SafetyReview(enabled=False, blocked=False, summary="guardrails disabled")
        return await self._review_safety(text=text, stage="input", context=context)

    async def review_output(
        self,
        text: str,
        *,
        context: GuardrailContext,
        citations: list[str] | None = None,
    ) -> GuardrailReview:
        if not settings.guardrails_enabled:
            return GuardrailReview(
                output_review=SafetyReview(enabled=False, blocked=False, summary="guardrails disabled"),
                hallucination_review=HallucinationReview(enabled=False, grounded=True, summary="guardrails disabled"),
            )

        output_review = await self._review_safety(text=text, stage="output", context=context)
        hallucination_review = await self._review_hallucination(
            text=text,
            context=context,
            citations=citations or context.citations or [],
        )
        return GuardrailReview(
            output_review=output_review,
            hallucination_review=hallucination_review,
        )

    async def assert_safe_input(self, text: str, *, context: GuardrailContext) -> SafetyReview:
        review = await self.review_input(text, context=context)
        if settings.guardrails_block_on_input and review.blocked:
            raise GuardrailViolationError(review.summary or "input blocked by guardrails", review)
        return review

    async def _review_safety(self, *, text: str, stage: str, context: GuardrailContext) -> SafetyReview:
        issues: list[GuardrailIssue] = []
        normalized = str(text or "").strip()
        if not normalized:
            return SafetyReview(enabled=True, blocked=False, stage=stage, summary="empty content")

        for word in self._sensitive_words():
            if word and word.lower() in normalized.lower():
                issues.append(
                    GuardrailIssue(
                        label="sensitive_word",
                        source="local-rules",
                        confidence=0.72,
                        detail=f"matched sensitive word: {word}",
                        excerpt=word,
                    )
                )

        for label, pattern in self.DEFAULT_RISK_PATTERNS:
            matched = re.search(pattern, normalized, flags=re.IGNORECASE)
            if matched:
                issues.append(
                    GuardrailIssue(
                        label=label,
                        source="local-rules",
                        confidence=0.84,
                        detail=f"matched risky pattern: {label}",
                        excerpt=matched.group(0),
                    )
                )

        xfyun_raw: dict = {}
        if settings.xfyun_content_safety_enabled and settings.xfyun_content_safety_base_url:
            xfyun_raw = await self._call_xfyun_content_safety(normalized, stage=stage, context=context)
            if xfyun_raw.get("blocked"):
                issues.append(
                    GuardrailIssue(
                        label=str(xfyun_raw.get("label") or "xfyun_block"),
                        source="xfyun",
                        confidence=float(xfyun_raw.get("confidence") or 0.9),
                        detail=str(xfyun_raw.get("message") or "blocked by xfyun content safety"),
                        excerpt=str(xfyun_raw.get("excerpt") or "") or None,
                    )
                )

        blocked = bool(issues)
        risk_level = "high" if blocked else "low"
        summary = "内容通过安全检查" if not blocked else f"检测到 {len(issues)} 项风险内容"
        rewritten_text = None
        if blocked and stage == "output":
            rewritten_text = "当前内容包含不适合直接展示的表达，已触发安全保护，请换个问题继续。"
        return SafetyReview(
            enabled=True,
            blocked=blocked,
            provider="xfyun+local-rules" if xfyun_raw else "local-rules",
            stage=stage,
            risk_level=risk_level,
            summary=summary,
            rewritten_text=rewritten_text,
            issues=issues,
            raw={"scene": context.scene, "xfyun": xfyun_raw} if xfyun_raw else {"scene": context.scene},
        )

    async def _review_hallucination(
        self,
        *,
        text: str,
        context: GuardrailContext,
        citations: list[str],
    ) -> HallucinationReview:
        if not settings.guardrails_hallucination_enabled:
            return HallucinationReview(enabled=False, grounded=True, summary="hallucination review disabled")

        normalized = " ".join(str(text or "").split())
        if not normalized:
            return HallucinationReview(enabled=True, grounded=True, score=1.0, summary="empty output")

        evidence_sources = list(dict.fromkeys([item for item in citations if item]))
        if not evidence_sources and context.course_code:
            try:
                rag = await self.rag_service.search(
                    RagSearchRequest(course_code=context.course_code, query=normalized[:180], top_k=3)
                )
                evidence_sources = [item.source for item in rag.citations]
            except Exception as exc:
                logger.warning("hallucination_rag_lookup_failed", error=str(exc), scene=context.scene)

        claims = self._extract_claims(normalized)
        unsupported_claims = [
            claim for claim in claims if evidence_sources and not self._claim_supported_by_sources(claim, evidence_sources)
        ]

        grounded = not unsupported_claims
        score = 1.0 if grounded else max(0.35, 1.0 - len(unsupported_claims) * 0.18)
        summary = "生成内容已通过基础事实复核" if grounded else "存在缺少证据支撑的表述"
        return HallucinationReview(
            enabled=True,
            grounded=grounded,
            score=round(score, 2),
            method="heuristic-rag",
            summary=summary,
            unsupported_claims=unsupported_claims[:6],
            evidence_sources=evidence_sources[:8],
            raw={"claim_count": len(claims)},
        )

    def _extract_claims(self, text: str) -> list[str]:
        parts = re.split(r"[。！？\n]", text)
        claims = []
        for part in parts:
            cleaned = part.strip()
            if len(cleaned) < 12:
                continue
            if any(token in cleaned for token in ["一定", "必须", "官方", "唯一", "已证明", "绝对"]):
                claims.append(cleaned)
                continue
            if re.search(r"\d{2,}", cleaned):
                claims.append(cleaned)
        return claims

    def _claim_supported_by_sources(self, claim: str, sources: list[str]) -> bool:
        normalized_claim = re.sub(r"\s+", "", claim.lower())
        for source in sources:
            source_text = re.sub(r"\s+", "", str(source).lower())
            if not source_text:
                continue
            overlap = sum(1 for token in self._simple_tokens(normalized_claim) if token in source_text)
            if overlap >= 2:
                return True
        return False

    def _simple_tokens(self, text: str) -> list[str]:
        tokens = re.split(r"[^a-zA-Z0-9\u4e00-\u9fff]+", text)
        return [token for token in tokens if len(token) >= 2]

    async def _call_xfyun_content_safety(self, text: str, *, stage: str, context: GuardrailContext) -> dict:
        url = settings.xfyun_content_safety_base_url.strip()
        if not url:
            return {}
        payload = {
            "app_id": settings.xfyun_content_safety_app_id,
            "scene": context.scene,
            "stage": stage,
            "text": text[:4000],
        }
        headers = {}
        if settings.xfyun_content_safety_api_key:
            headers["X-API-Key"] = settings.xfyun_content_safety_api_key
        if settings.xfyun_content_safety_api_secret:
            headers["X-API-Secret"] = settings.xfyun_content_safety_api_secret
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                return data if isinstance(data, dict) else {}
        except Exception as exc:
            logger.warning("xfyun_content_safety_failed", error=str(exc), scene=context.scene)
            return {}
