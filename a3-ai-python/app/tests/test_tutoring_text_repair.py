from app.services.tutoring_service import TutoringService


def test_repair_mojibake_text_keeps_normal_chinese() -> None:
    text = "这门课更适合按主线递进复习，不建议从中间章节跳着看。"
    assert TutoringService._repair_mojibake_text(text) == text


def test_repair_mojibake_text_repairs_utf8_latin1_garble() -> None:
    garbled = "\u00e4\u00bd\u00a0\u00e5\u00a5\u00bd"
    repaired = TutoringService._repair_mojibake_text(garbled)
    assert repaired == "你好"
