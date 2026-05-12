from app.agents.nodes.answer_generator_agent import AnswerGeneratorAgent


class _FailingLLMClient:
    async def chat_completion(self, *args, **kwargs):
        raise RuntimeError("simulated llm failure")


def test_answer_generator_returns_structured_fallback_when_llm_fails() -> None:
    agent = AnswerGeneratorAgent()
    agent.llm_client = _FailingLLMClient()

    result = agent._build_fallback_answer(
        "什么是过拟合？请给出两个缓解方法",
        {
            "question_type": "概念理解",
            "knowledge_points": ["过拟合", "正则化", "交叉验证"],
            "difficulty_level": 2,
        },
        {
            "retrieved_chunks": [
                {
                    "content": "过拟合指模型在训练集上表现很好，但在新样本上泛化能力较差。",
                    "source": "模型评估与过拟合",
                    "score": 0.91,
                }
            ]
        },
        user_profile={"profile_tags": ["基础待巩固", "偏好分步讲解"]},
    )

    assert "## 直接结论" in result
    assert "过拟合" in result
    assert "模型评估与过拟合" in result
    assert "抱歉，解答生成过程中出现错误" not in result
