from app.agents.nodes.answer_generator_agent import AnswerGeneratorAgent


def test_build_learning_messages_prefers_ocr_text_over_images_when_text_is_sufficient() -> None:
    messages = AnswerGeneratorAgent._build_learning_messages(
        "请分析这张截图",
        ["https://example.com/test.png"],
        {
            "image_context": {
                "combined_text": "图片1: 这里已经识别出了足够长的正文内容，可以直接基于 OCR 文本回答，而不必继续把原图发送给视觉模型。",
            }
        },
    )

    assert len(messages) == 1
    assert messages[0]["role"] == "user"
    assert isinstance(messages[0]["content"], str)
    assert "OCR" in messages[0]["content"]
    assert "image_url" not in messages[0]["content"]
