"""
智能辅导文本合规：可配置敏感词子串匹配（中英文不区分大小写对 ASCII 部分生效）。
通过环境变量 TUTORING_SENSITIVE_WORDS 传入逗号分隔词表；空表则不拦截。
"""
from __future__ import annotations

from app.core.config import settings


def _blocked_tokens() -> list[str]:
    raw = (getattr(settings, "tutoring_sensitive_words", None) or "").strip()
    if not raw:
        return []
    return [p.strip() for p in raw.split(",") if p.strip()]


def assert_tutoring_text_allowed(text: str | None, *, field_label: str = "内容") -> None:
    """
    命中任一配置词则抛出 ValueError，供 API 映射为 400。
    """
    if not getattr(settings, "tutoring_sensitive_filter_enabled", True):
        return
    if not text:
        return
    tokens = _blocked_tokens()
    if not tokens:
        return
    folded = text.lower()
    for tok in tokens:
        t = tok.lower()
        if t and (t in folded or tok in text):
            raise ValueError(f"{field_label}包含不当用语，请修改后重试")
