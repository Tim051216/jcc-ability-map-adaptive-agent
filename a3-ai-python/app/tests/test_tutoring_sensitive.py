"""辅导敏感词策略单测。"""

import pytest

from app.core.config import settings
from app.services.tutoring_sensitive import assert_tutoring_text_allowed


def test_empty_blocklist_allows_any(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "tutoring_sensitive_words", "", raising=False)
    assert_tutoring_text_allowed("任意内容 含敏感字样但词表为空")


def test_blocks_configured_substring(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "tutoring_sensitive_filter_enabled", True, raising=False)
    monkeypatch.setattr(settings, "tutoring_sensitive_words", "spam,违禁示例", raising=False)
    assert_tutoring_text_allowed("正常问题")
    with pytest.raises(ValueError, match="不当用语"):
        assert_tutoring_text_allowed("这里有spam内容")
    with pytest.raises(ValueError, match="不当用语"):
        assert_tutoring_text_allowed("违禁示例出现在句中")


def test_ascii_case_insensitive(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "tutoring_sensitive_filter_enabled", True, raising=False)
    monkeypatch.setattr(settings, "tutoring_sensitive_words", "BadWord", raising=False)
    with pytest.raises(ValueError):
        assert_tutoring_text_allowed("x BADWORD y")


def test_filter_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "tutoring_sensitive_filter_enabled", False, raising=False)
    monkeypatch.setattr(settings, "tutoring_sensitive_words", "forbidden", raising=False)
    assert_tutoring_text_allowed("forbidden")
