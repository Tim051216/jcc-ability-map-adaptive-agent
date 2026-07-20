import pytest

from app.agents.nodes.answer_generator_agent import AnswerGeneratorAgent
from app.agents.nodes.question_analyzer_agent import QuestionAnalyzerAgent
from app.agents.nodes.video_recommender_agent import VideoRecommenderAgent


def test_system_usage_question_routes_to_local_knowledge_branch() -> None:
    assert AnswerGeneratorAgent._is_system_usage_question("如何使用该系统")
    assert AnswerGeneratorAgent._is_system_usage_question("这个页面是做什么的")
    assert AnswerGeneratorAgent._is_system_usage_question("项目怎么启动和联调")


class _ShortLLMClient:
    async def chat_completion(self, *args, **kwargs):
        class _Message:
            content = "我是灰原哀风格的 AI 导师。直接问吧，别把问题藏起来。"

        class _Choice:
            message = _Message()

        class _Response:
            choices = [_Choice()]

        return _Response()


@pytest.mark.asyncio
async def test_light_question_routes_to_identity_without_videos() -> None:
    analyzer = QuestionAnalyzerAgent()
    analyzer.llm_client = _ShortLLMClient()
    analysis = await analyzer.analyze_question("你是谁", None, None)

    answerer = AnswerGeneratorAgent()
    answerer.llm_client = _ShortLLMClient()
    answer = await answerer.generate_answer("你是谁", analysis, None, None)

    recommender = VideoRecommenderAgent()
    videos = await recommender.recommend_videos("你是谁", analysis, None, None)

    assert analysis["question_type"] == "身份问答"
    assert "AI 导师" in answer["answer_text"]
    assert videos["videos"] == []


@pytest.mark.asyncio
async def test_normal_learning_question_does_not_recommend_videos_by_default() -> None:
    analyzer = QuestionAnalyzerAgent()
    analyzer.llm_client = _ShortLLMClient()
    analysis = await analyzer.analyze_question("需求分析和概要设计有什么区别？", None, None)

    recommender = VideoRecommenderAgent()
    videos = await recommender.recommend_videos("需求分析和概要设计有什么区别？", analysis, None, None)

    assert analysis["question_type"] == "概念理解"
    assert videos["videos"] == []


@pytest.mark.asyncio
async def test_explicit_video_request_returns_videos() -> None:
    analyzer = QuestionAnalyzerAgent()
    analyzer.llm_client = _ShortLLMClient()
    analysis = await analyzer.analyze_question("帮我推荐两个讲需求分析的B站视频", None, None)

    recommender = VideoRecommenderAgent()
    videos = await recommender.recommend_videos("帮我推荐两个讲需求分析的B站视频", analysis, None, None)

    assert len(videos["videos"]) > 0
