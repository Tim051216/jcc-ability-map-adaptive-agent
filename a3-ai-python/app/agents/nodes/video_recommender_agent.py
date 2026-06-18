"""
Video recommender agent for AI tutoring.

This agent is intentionally separated from the internal resource library:
- Internal course/resource pages should use self-hosted videos only.
- AI tutor may recommend external learning entries when the user explicitly asks.
"""

from __future__ import annotations

import re
from typing import Any

from app.core.logging import logger
from app.schemas.web_tools import WebSearchRequest
from app.services.web_tool_service import WebToolService


def _normalize(text: str) -> str:
    return re.sub(r"\s+", "", (text or "").lower())


def _collect_keywords(question_text: str, question_analysis: dict[str, Any]) -> list[str]:
    keywords: list[str] = []

    def add_keyword(value: str) -> None:
        cleaned = str(value or "").strip(" ,.!?;:()[]{}，。！？；：（）【】")
        if cleaned and cleaned not in keywords:
            keywords.append(cleaned)

    for item in question_analysis.get("knowledge_points") or []:
        add_keyword(item)

    for token in re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z][A-Za-z0-9_+#.-]{1,}", question_text or ""):
        add_keyword(token)
        if re.fullmatch(r"[\u4e00-\u9fff]+", token):
            compact = re.sub(r"^(什么是|什么叫|请问|帮我|推荐|讲讲|如何|怎么|有没有|给我)", "", token)
            add_keyword(compact)
            compact = re.sub(r"(怎么写|怎么学|怎么做|怎么用|是什么|有哪些|推荐下|推荐一下)$", "", compact)
            add_keyword(compact)
            for size in range(min(6, len(compact)), 2, -1):
                for start in range(0, len(compact) - size + 1):
                    add_keyword(compact[start : start + size])
                if len(keywords) >= 12:
                    break

    return keywords[:12]


def _extract_question_keywords(question_text: str, question_analysis: dict[str, Any]) -> list[str]:
    return _collect_keywords(question_text, question_analysis)


def _is_light_chat(question_analysis: dict[str, Any]) -> bool:
    question_type = str(question_analysis.get("question_type") or "")
    return question_type in {"日常交流", "身份问答", "能力问答", "元对话", "通用问答"}


def _wants_video_recommendation(question_text: str) -> bool:
    normalized = _normalize(question_text)
    request_patterns = (
        "\u63a8\u8350\u89c6\u9891",
        "\u89c6\u9891\u63a8\u8350",
        "\u76f8\u5173\u89c6\u9891",
        "\u770b\u4ec0\u4e48\u89c6\u9891",
        "\u7ed9\u6211\u89c6\u9891",
        "\u8bb2\u89e3\u89c6\u9891",
        "\u8d44\u6599\u63a8\u8350",
        "\u8bfe\u7a0b\u63a8\u8350",
        "\u5b66\u4e60\u8d44\u6e90",
        "\u63a8\u8350\u8d44\u6e90",
        "b\u7ad9",
        "\u54d4\u54e9\u54d4\u54e9",
        "bilibili",
        "video",
        "videos",
        "tutorial",
        "course",
    )
    if any(pattern in normalized for pattern in request_patterns):
        return True

    has_recommend_intent = any(token in (question_text or "") for token in ("推荐", "给我", "来点", "有没有", "想看"))
    has_video_object = any(
        token in (question_text or "").lower() for token in ("视频", "教程", "课程", "b站", "bilibili", "lecture", "video")
    )
    return has_recommend_intent and has_video_object


TOPIC_BUCKETS: list[dict[str, Any]] = [
    {
        "topic_id": "java",
        "triggers": ["java", "jvm", "spring", "springboot", "面向对象", "集合", "多线程"],
        "label": "Java 开发",
        "videos": [
            {
                "video_id": 810101,
                "title": "Java 零基础入门教程",
                "url": "https://search.bilibili.com/all?keyword=Java%20%E9%9B%B6%E5%9F%BA%E7%A1%80%20%E6%95%99%E7%A8%8B",
                "thumbnail": None,
                "duration": 5400,
                "source_platform": "bilibili-search",
                "uploader": "BiliLearn",
                "quality_score": 0.94,
                "tags": ["Java", "入门", "基础语法"],
            },
            {
                "video_id": 810102,
                "title": "Java Web / Spring Boot 实战",
                "url": "https://search.bilibili.com/all?keyword=Spring%20Boot%20%E5%AE%9E%E6%88%98",
                "thumbnail": None,
                "duration": 4800,
                "source_platform": "bilibili-search",
                "uploader": "BiliLearn",
                "quality_score": 0.92,
                "tags": ["Java", "Spring Boot", "项目实战"],
            },
            {
                "video_id": 810103,
                "title": "Java 集合、多线程与 JVM 进阶",
                "url": "https://search.bilibili.com/all?keyword=Java%20JVM%20%E9%9B%86%E5%90%88%20%E5%A4%9A%E7%BA%BF%E7%A8%8B",
                "thumbnail": None,
                "duration": 4200,
                "source_platform": "bilibili-search",
                "uploader": "BiliLearn",
                "quality_score": 0.9,
                "tags": ["Java", "JVM", "多线程"],
            },
        ],
    },
    {
        "topic_id": "react",
        "triggers": ["react", "hooks", "context", "redux", "前端", "组件", "状态管理"],
        "label": "React 前端",
        "videos": [
            {
                "video_id": 820101,
                "title": "React 入门到组件开发",
                "url": "https://search.bilibili.com/all?keyword=React%20%E5%85%A5%E9%97%A8%20%E7%BB%84%E4%BB%B6",
                "thumbnail": None,
                "duration": 4200,
                "source_platform": "bilibili-search",
                "uploader": "BiliLearn",
                "quality_score": 0.94,
                "tags": ["React", "组件", "入门"],
            },
            {
                "video_id": 820102,
                "title": "React 状态管理与性能优化",
                "url": "https://search.bilibili.com/all?keyword=React%20%E7%8A%B6%E6%80%81%E7%AE%A1%E7%90%86%20%E6%80%A7%E8%83%BD%E4%BC%98%E5%8C%96",
                "thumbnail": None,
                "duration": 3600,
                "source_platform": "bilibili-search",
                "uploader": "BiliLearn",
                "quality_score": 0.93,
                "tags": ["React", "状态管理", "性能优化"],
            },
            {
                "video_id": 820103,
                "title": "React 实战项目拆解",
                "url": "https://search.bilibili.com/all?keyword=React%20%E5%AE%9E%E6%88%98%20%E9%A1%B9%E7%9B%AE",
                "thumbnail": None,
                "duration": 3900,
                "source_platform": "bilibili-search",
                "uploader": "BiliLearn",
                "quality_score": 0.91,
                "tags": ["React", "项目实战", "页面拆分"],
            },
        ],
    },
    {
        "topic_id": "data-structure",
        "triggers": ["数据结构", "算法", "链表", "栈", "队列", "树", "图", "排序", "查找"],
        "label": "数据结构与算法",
        "videos": [
            {
                "video_id": 830101,
                "title": "数据结构基础总览",
                "url": "https://search.bilibili.com/all?keyword=%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%20%E5%9F%BA%E7%A1%80",
                "thumbnail": None,
                "duration": 4800,
                "source_platform": "bilibili-search",
                "uploader": "BiliLearn",
                "quality_score": 0.94,
                "tags": ["数据结构", "基础", "概念梳理"],
            },
            {
                "video_id": 830102,
                "title": "常见算法题讲解",
                "url": "https://search.bilibili.com/all?keyword=%E7%AE%97%E6%B3%95%E9%A2%98%20%E8%AE%B2%E8%A7%A3",
                "thumbnail": None,
                "duration": 3600,
                "source_platform": "bilibili-search",
                "uploader": "BiliLearn",
                "quality_score": 0.91,
                "tags": ["算法", "题解", "刷题"],
            },
            {
                "video_id": 830103,
                "title": "树、图与高级结构进阶",
                "url": "https://search.bilibili.com/all?keyword=%E6%A0%91%20%E5%9B%BE%20%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84",
                "thumbnail": None,
                "duration": 4200,
                "source_platform": "bilibili-search",
                "uploader": "BiliLearn",
                "quality_score": 0.9,
                "tags": ["树", "图", "进阶"],
            },
        ],
    },
    {
        "topic_id": "software-engineering",
        "triggers": ["软件工程", "需求分析", "概要设计", "详细设计", "测试", "项目管理", "课设"],
        "label": "软件工程",
        "videos": [
            {
                "video_id": 840101,
                "title": "软件工程课程总复习",
                "url": "https://search.bilibili.com/all?keyword=%E8%BD%AF%E4%BB%B6%E5%B7%A5%E7%A8%8B%20%E6%80%BB%E5%A4%8D%E4%B9%A0",
                "thumbnail": None,
                "duration": 3600,
                "source_platform": "bilibili-search",
                "uploader": "BiliLearn",
                "quality_score": 0.93,
                "tags": ["软件工程", "复习", "课程主线"],
            },
            {
                "video_id": 840102,
                "title": "需求分析与系统设计案例",
                "url": "https://search.bilibili.com/all?keyword=%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90%20%E7%B3%BB%E7%BB%9F%E8%AE%BE%E8%AE%A1",
                "thumbnail": None,
                "duration": 3000,
                "source_platform": "bilibili-search",
                "uploader": "BiliLearn",
                "quality_score": 0.92,
                "tags": ["需求分析", "系统设计", "案例"],
            },
            {
                "video_id": 840103,
                "title": "软件测试与项目实践",
                "url": "https://search.bilibili.com/all?keyword=%E8%BD%AF%E4%BB%B6%E6%B5%8B%E8%AF%95%20%E9%A1%B9%E7%9B%AE%E5%AE%9E%E8%B7%B5",
                "thumbnail": None,
                "duration": 2400,
                "source_platform": "bilibili-search",
                "uploader": "BiliLearn",
                "quality_score": 0.89,
                "tags": ["软件测试", "项目实践", "课程设计"],
            },
        ],
    },
]


def _resolve_topic_bucket(question_text: str, question_analysis: dict[str, Any]) -> dict[str, Any] | None:
    haystack = " ".join(_collect_keywords(question_text, question_analysis) + [question_text]).lower()
    best_bucket: dict[str, Any] | None = None
    best_score = 0

    for bucket in TOPIC_BUCKETS:
        score = 0
        for trigger in bucket["triggers"]:
            trigger_text = str(trigger).lower()
            if trigger_text in haystack:
                score += 2 if len(trigger_text) > 2 else 1
        if score > best_score:
            best_score = score
            best_bucket = bucket

    return best_bucket


class VideoRecommenderAgent:
    """Return topic-matched external video recommendation cards for AI tutor answers."""

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
        web_videos = await self._search_web_videos(question_text, keywords)
        if web_videos:
            logger.info("video_recommender.web_completed", video_count=len(web_videos))
            return {"videos": web_videos[:3]}
        topic_bucket = _resolve_topic_bucket(question_text, question_analysis)
        candidate_videos = (topic_bucket or TOPIC_BUCKETS[-1])["videos"]
        videos = [self._decorate_video(video, keywords, topic_bucket["label"] if topic_bucket else "通用学习") for video in candidate_videos]
        videos.sort(key=lambda item: float(item.get("relevance_score") or 0), reverse=True)
        result = {"videos": videos[:3]}
        logger.info(
            "video_recommender.completed",
            video_count=len(result["videos"]),
            topic=(topic_bucket or {}).get("topic_id"),
        )
        return result

    def _decorate_video(self, video: dict[str, Any], keywords: list[str], topic_label: str) -> dict[str, Any]:
        score = float(video.get("quality_score") or 0.8)
        text = f"{video.get('title', '')} {' '.join(video.get('tags') or [])}".lower()
        matched_keywords = [keyword for keyword in keywords if keyword and keyword.lower() in text]
        score += min(len(matched_keywords) * 0.06, 0.16)

        reasons = [f"主题匹配：{topic_label}"]
        if matched_keywords:
            reasons.append(f"命中关键词：{', '.join(matched_keywords[:3])}")
        if video.get("tags"):
            reasons.append(f"适合方向：{', '.join((video.get('tags') or [])[:2])}")

        return {
            **video,
            "relevance_score": round(min(score, 0.99), 2),
            "segments": [
                {
                    "start_sec": 0.0,
                    "end_sec": min(float(video.get("duration") or 600), 180.0),
                    "reason": "建议先看开头 3 分钟确认讲解风格和目录结构。",
                }
            ],
            "recommendation_reason": "；".join(reasons),
            "external_link": True,
        }

    async def _search_web_videos(self, question_text: str, keywords: list[str]) -> list[dict[str, Any]]:
        query_terms = [term for term in keywords[:4] if term]
        if not query_terms and question_text.strip():
            query_terms = [question_text.strip()]
        if not query_terms:
            return []

        search_query = f"Bilibili {' '.join(query_terms)} 教程 视频"
        result = await WebToolService().websearch(
            WebSearchRequest(
                query=search_query,
                top_k=3,
                domain_whitelist=["bilibili.com"],
            )
        )
        if not result.items:
            return []

        videos: list[dict[str, Any]] = []
        for index, item in enumerate(result.items, start=1):
            snippet = str(item.snippet or "").strip()
            reason_parts = [f"实时检索：{' / '.join(query_terms[:3])}"]
            if snippet:
                reason_parts.append(f"摘要：{snippet[:72]}")
            videos.append(
                {
                    "video_id": 900000 + index,
                    "title": str(item.title or "").strip() or f"Bilibili 视频推荐 {index}",
                    "url": item.url,
                    "thumbnail": None,
                    "duration": None,
                    "source_platform": item.source or "bilibili",
                    "uploader": "Firecrawl Search",
                    "relevance_score": round(max(0.82, 0.96 - index * 0.04), 2),
                    "tags": query_terms[:3],
                    "segments": [],
                    "recommendation_reason": "；".join(reason_parts),
                    "external_link": True,
                }
            )
        return videos

    async def _locate_relevant_segments(
        self,
        videos: list[dict[str, Any]],
        question_text: str,
        question_analysis: dict[str, Any],
    ) -> list[dict[str, Any]]:
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
                knowledge_point = str(video.get("knowledge_point") or "")
                title_hit = any(
                    keyword and (keyword in title or keyword in knowledge_point)
                    for keyword in keywords
                )
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
