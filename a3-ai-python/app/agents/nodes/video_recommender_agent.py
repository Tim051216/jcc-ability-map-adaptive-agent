"""
Video recommender agent for AI tutoring.

This agent is intentionally separated from the internal resource library:
- Internal course/resource pages should use self-hosted videos only.
- AI tutor may recommend high-quality external links, currently Bilibili pages.
"""

from __future__ import annotations

import re
from typing import Any

from app.core.logging import logger


def _normalize(text: str) -> str:
    return re.sub(r"\s+", "", (text or "").lower())


def _collect_keywords(question_text: str, question_analysis: dict[str, Any]) -> list[str]:
    keywords: list[str] = []

    def add_keyword(value: str) -> None:
        cleaned = value.strip("，。！？?：:；;、（）()[]【】")
        if cleaned and cleaned not in keywords:
            keywords.append(cleaned)

    for item in question_analysis.get("knowledge_points") or []:
        add_keyword(str(item))

    for token in re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z][A-Za-z0-9_+-]{2,}", question_text or ""):
        add_keyword(token)
        if re.fullmatch(r"[\u4e00-\u9fff]+", token):
            compact = re.sub(r"^(什么是|什么叫|请问|帮我|推荐|讲讲)|怎么写$|是什么$|吗$", "", token)
            add_keyword(compact)
            for size in range(min(6, len(compact)), 1, -1):
                for start in range(0, len(compact) - size + 1):
                    add_keyword(compact[start : start + size])
                if len(keywords) >= 12:
                    break

    return keywords[:12]


def _extract_question_keywords(question_text: str, question_analysis: dict[str, Any]) -> list[str]:
    """Backward-compatible alias used by older segment tests."""

    return _collect_keywords(question_text, question_analysis)


def _is_light_chat(question_analysis: dict[str, Any]) -> bool:
    question_type = str(question_analysis.get("question_type") or "")
    return question_type in {"日常交流", "身份问答", "能力问答", "元对话", "通用问答"}


def _wants_video_recommendation(question_text: str) -> bool:
    normalized = _normalize(question_text)
    request_patterns = (
        "推荐视频",
        "视频推荐",
        "相关视频",
        "看什么视频",
        "给我视频",
        "讲解视频",
        "推荐资料",
        "资料推荐",
        "课程推荐",
        "学习资源",
        "推荐资源",
        "有什么课程",
        "有什么资料",
        "b站",
        "哔哩哔哩",
        "bilibili",
    )
    return any(pattern in normalized for pattern in request_patterns)


class VideoRecommenderAgent:
    """Return external Bilibili recommendation cards for AI tutor answers."""

    _default_videos: list[dict[str, Any]] = [
        {
            "video_id": 800001,
            "title": "软件工程项目实战与课程设计讲解",
            "url": "https://www.bilibili.com/video/BV1xx411c7mD",
            "thumbnail": "https://i0.hdslb.com/bfs/archive/software-engineering-demo.jpg",
            "duration": 1560,
            "source_platform": "bilibili",
            "uploader": "软件工程学习站",
            "bv_id": "BV1xx411c7mD",
            "quality_score": 0.95,
            "tags": ["软件工程", "课程设计", "项目实战"],
        },
        {
            "video_id": 800002,
            "title": "软件工程需求分析与系统设计全流程案例",
            "url": "https://www.bilibili.com/video/BV1yy4y1q7zz",
            "thumbnail": "https://i0.hdslb.com/bfs/archive/system-design-demo.jpg",
            "duration": 1320,
            "source_platform": "bilibili",
            "uploader": "系统分析课堂",
            "bv_id": "BV1yy4y1q7zz",
            "quality_score": 0.93,
            "tags": ["需求分析", "系统设计", "案例讲解"],
        },
        {
            "video_id": 800003,
            "title": "软件测试与回归测试重点梳理",
            "url": "https://www.bilibili.com/video/BV1ab411Q7k9",
            "thumbnail": "https://i0.hdslb.com/bfs/archive/testing-review-demo.jpg",
            "duration": 1080,
            "source_platform": "bilibili",
            "uploader": "测试工程知识库",
            "bv_id": "BV1ab411Q7k9",
            "quality_score": 0.91,
            "tags": ["软件测试", "回归测试", "知识梳理"],
        },
    ]

    async def recommend_videos(
        self,
        question_text: str,
        question_analysis: dict[str, Any],
        user_profile: dict[str, Any] | None = None,
        course_id: int | None = None,
    ) -> dict[str, Any]:
        logger.info("video_recommender.start", course_id=course_id)

        if _is_light_chat(question_analysis):
            logger.info("video_recommender.skip_light_chat", question_preview=question_text[:40])
            return {"videos": []}

        if not _wants_video_recommendation(question_text):
            logger.info("video_recommender.skip_no_request", question_preview=question_text[:60])
            return {"videos": []}

        keywords = _collect_keywords(question_text, question_analysis)
        videos = [self._decorate_video(video, keywords) for video in self._default_videos]
        videos.sort(key=lambda item: float(item.get("relevance_score") or 0), reverse=True)
        result = {"videos": videos[:3]}
        logger.info("video_recommender.completed", video_count=len(result["videos"]))
        return result

    def _decorate_video(self, video: dict[str, Any], keywords: list[str]) -> dict[str, Any]:
        score = float(video.get("quality_score") or 0.8)
        text = f"{video.get('title', '')} {' '.join(video.get('tags') or [])}"
        for keyword in keywords:
            if keyword and keyword in text:
                score += 0.08

        reasons: list[str] = []
        if keywords:
            reasons.append(f"覆盖关键词：{', '.join(keywords[:2])}")
        if video.get("tags"):
            reasons.append(f"主题相关：{', '.join((video.get('tags') or [])[:2])}")

        return {
            **video,
            "relevance_score": round(min(score, 0.99), 2),
            "segments": [
                {
                    "start_sec": 0.0,
                    "end_sec": min(float(video.get("duration") or 600), 180.0),
                    "reason": "建议先看前 3 分钟建立背景，再按主题继续深入。",
                }
            ],
            "recommendation_reason": "；".join(reasons) if reasons else "适合作为当前问题的外部补充讲解视频。",
            "external_link": True,
        }

    async def _locate_relevant_segments(
        self,
        videos: list[dict[str, Any]],
        question_text: str,
        question_analysis: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Attach a best-effort relevant segment to each video.

        Kept for older tests and for future richer Bilibili metadata. The current
        tutor path only uses `_decorate_video`, but this method is still useful
        when a video has captions.
        """

        keywords = _collect_keywords(question_text, question_analysis)
        result: list[dict[str, Any]] = []
        for video in videos:
            duration = float(video.get("duration") or 600)
            best_caption: dict[str, Any] | None = None
            best_score = 0
            for caption in video.get("captions") or []:
                caption_text = str(caption.get("text") or "")
                score = sum(1 for keyword in keywords if keyword and keyword in caption_text)
                if score > best_score:
                    best_score = score
                    best_caption = caption

            if best_caption is not None:
                start = float(best_caption.get("start_sec", best_caption.get("start", 0)) or 0)
                end = float(best_caption.get("end_sec", best_caption.get("end", min(start + 120, duration))) or 0)
                reason = f"字幕命中关键词：{', '.join(keywords[:2])}" if keywords else "字幕片段与问题相关。"
            else:
                title = str(video.get("title") or "")
                title_hit = any(keyword and keyword in title for keyword in keywords)
                start = 0.0
                end = min(duration, 100.0 if title_hit else 50.0)
                reason = "标题或关键词相关，建议从开头看。" if title_hit else "暂无字幕，建议先看开头建立背景。"

            result.append(
                {
                    **video,
                    "segments": [
                        {
                            "start_sec": start,
                            "end_sec": end,
                            "reason": reason,
                        }
                    ],
                }
            )
        return result


async def video_recommender_node(state: dict[str, Any]) -> dict[str, Any]:
    agent = VideoRecommenderAgent()
    question_text = state.get("question_text", "")
    question_analysis = state.get("question_analysis", {})
    user_profile = state.get("user_profile")
    course_id = state.get("course_id")

    video_result = await agent.recommend_videos(
        question_text=question_text,
        question_analysis=question_analysis,
        user_profile=user_profile,
        course_id=course_id,
    )

    state["video_result"] = video_result
    trace = state.get("execution_trace", [])
    trace.append(f"video_recommender:count={len(video_result.get('videos', []))}")
    state["execution_trace"] = trace
    return state
