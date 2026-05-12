"""视频推荐片段时间戳（字幕/标题启发式）单测。"""

import pytest

from app.agents.nodes.video_recommender_agent import (
    VideoRecommenderAgent,
    _extract_question_keywords,
)


def test_extract_keywords_mixed_zh_en() -> None:
    kws = _extract_question_keywords(
        "Explain 梯度下降 in 深度学习",
        {"knowledge_points": ["反向传播", "loss"]},
    )
    assert "梯度下降" in kws
    assert "深度学习" in kws
    assert "反向传播" in kws


@pytest.mark.asyncio
async def test_segments_from_captions_picks_best_match() -> None:
    agent = VideoRecommenderAgent()
    videos = [
        {
            "video_id": 1,
            "title": "机器学习入门",
            "duration": 600,
            "captions": [
                {"start_sec": 0, "end_sec": 30, "text": "课程介绍"},
                {"start": 120, "end_sec": 240, "text": "本节讲解梯度下降算法步骤"},
            ],
        }
    ]
    out = await agent._locate_relevant_segments(
        videos,
        "什么是梯度下降？",
        {"knowledge_points": []},
    )
    segs = out[0]["segments"]
    assert len(segs) == 1
    assert segs[0]["start_sec"] == 120.0
    assert segs[0]["end_sec"] == 240.0
    assert "梯度下降" in segs[0]["reason"]


@pytest.mark.asyncio
async def test_segments_title_keyword_heuristic() -> None:
    agent = VideoRecommenderAgent()
    videos = [
        {
            "video_id": 2,
            "title": "Python 列表推导式精讲",
            "duration": 400,
            "knowledge_point": "基础语法",
        }
    ]
    out = await agent._locate_relevant_segments(
        videos,
        "列表推导式怎么写？",
        {"knowledge_points": []},
    )
    segs = out[0]["segments"]
    assert len(segs) == 1
    assert segs[0]["start_sec"] == 0.0
    assert segs[0]["end_sec"] == 100.0
    assert "标题" in segs[0]["reason"] or "关键词" in segs[0]["reason"]


@pytest.mark.asyncio
async def test_segments_fallback_without_captions() -> None:
    agent = VideoRecommenderAgent()
    videos = [{"video_id": 3, "title": "无关标题", "duration": 200}]
    out = await agent._locate_relevant_segments(
        videos,
        "任意问题",
        {"knowledge_points": []},
    )
    segs = out[0]["segments"]
    assert len(segs) == 1
    assert segs[0]["start_sec"] == 0.0
    assert segs[0]["end_sec"] == 50.0
