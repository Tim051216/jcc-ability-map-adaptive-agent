from app.agents.nodes.answer_generator_agent import AnswerGeneratorAgent


def test_attachment_context_answer_uses_extracted_document_text() -> None:
    question = (
        "请先判断我上传的附件《挑战杯指导老师信息-韩盛豪.docx》分别是什么类型的资料，再用中文概括它主要在讲什么、有哪些关键要点。\n\n"
        "附件《挑战杯指导老师信息-韩盛豪.docx》提取内容：\n"
        "挑战杯指导老师信息\n"
        "韩盛豪，后端开发实习生方向。\n"
        "项目经历覆盖微服务架构、数据库优化与 AI 大模型集成。\n"
        "需要重点核对项目时间线和技术细节表述。"
    )

    answer = AnswerGeneratorAgent._build_attachment_context_answer_v2(question)

    assert answer is not None
    assert "Word 文档" in answer
    assert "挑战杯指导老师信息" in answer
    assert "韩盛豪" in answer
    assert "项目时间线" in answer
