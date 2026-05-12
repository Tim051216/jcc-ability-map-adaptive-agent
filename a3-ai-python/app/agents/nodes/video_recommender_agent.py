"""
视频推荐智能体
负责推荐相关视频讲解
"""
import re
from typing import Any

from app.core.logging import logger
from app.integrations.java_clients.media_client import MediaClient


def _cjk_ngrams(phrase: str, sizes: tuple[int, ...] = (5, 4, 3, 2)) -> list[str]:
    """长中文短语拆成较短 n-gram，便于与字幕/标题中的子串匹配。"""
    if not re.fullmatch(r"[\u4e00-\u9fff]+", phrase) or len(phrase) < 5:
        return [phrase]
    out: list[str] = [phrase]
    for size in sizes:
        if len(phrase) < size:
            continue
        for i in range(0, len(phrase) - size + 1):
            out.append(phrase[i : i + size])
    return out


def _extract_question_keywords(question_text: str, question_analysis: dict[str, Any]) -> list[str]:
    """从题干与知识点抽取简短关键词，用于字幕/标题匹配。"""
    kps = question_analysis.get("knowledge_points") or []
    raw = f"{question_text} {' '.join(str(k) for k in kps if k)}"
    parts = re.findall(r"[\u4e00-\u9fff]{2,}|[a-zA-Z][a-zA-Z0-9]{2,}|\d{2,}", raw)
    seen: set[str] = set()
    out: list[str] = []
    for p in parts:
        for piece in _cjk_ngrams(p):
            key = piece.lower() if piece.isascii() else piece
            if key in seen:
                continue
            seen.add(key)
            out.append(piece)
            if len(out) >= 36:
                return out
    return out


def _segment_text_score(text: str, keywords: list[str]) -> int:
    if not text or not keywords:
        return 0
    lower = text.lower()
    return sum(1 for k in keywords if (k.lower() if k.isascii() else k) in lower or k in text)


def _coerce_seconds(val: Any) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _pick_time_range(caption: dict[str, Any]) -> tuple[float, float] | None:
    start = (
        _coerce_seconds(caption.get("start_sec"))
        or _coerce_seconds(caption.get("start"))
        or _coerce_seconds(caption.get("begin"))
    )
    end = (
        _coerce_seconds(caption.get("end_sec"))
        or _coerce_seconds(caption.get("end"))
        or _coerce_seconds(caption.get("finish"))
    )
    if start is None:
        return None
    if end is None or end <= start:
        end = start + 60.0
    return start, end


def _caption_text(caption: dict[str, Any]) -> str:
    return str(
        caption.get("text")
        or caption.get("content")
        or caption.get("title")
        or caption.get("label")
        or ""
    )


def _heuristic_segment_end(duration: Any) -> float:
    try:
        d = float(duration)
    except (TypeError, ValueError):
        d = 0.0
    if d <= 0:
        return 90.0
    return float(max(30, min(int(d * 0.25), 180)))


class VideoRecommenderAgent:
    """视频推荐智能体"""

    def __init__(self):
        self.media_client = MediaClient()

    async def recommend_videos(
        self,
        question_text: str,
        question_analysis: dict[str, Any],
        user_profile: dict[str, Any] | None = None,
        course_id: int | None = None,
    ) -> dict[str, Any]:
        """
        推荐视频
        
        Args:
            question_text: 问题文字
            question_analysis: 问题分析结果
            user_profile: 学生画像
            course_id: 课程ID
            
        Returns:
            推荐结果字典，包含：
            - videos: 推荐视频列表
        """
        logger.info("开始推荐视频")

        # 1. 基于知识点检索视频
        knowledge_based_videos = await self._search_by_knowledge_points(
            question_analysis.get("knowledge_points", []), course_id
        )

        # 2. 基于问题类型检索视频
        type_based_videos = await self._search_by_question_type(
            question_analysis.get("question_type", ""), course_id
        )

        # 3. 合并和排序
        all_videos = self._merge_and_rank_videos(
            knowledge_based_videos, type_based_videos, user_profile
        )

        # 4. 定位相关片段
        videos_with_segments = await self._locate_relevant_segments(
            all_videos, question_text, question_analysis
        )

        result = {
            "videos": videos_with_segments[:3],  # 最多推荐3个视频
        }

        logger.info(f"视频推荐完成，推荐数量: {len(result['videos'])}")
        return result

    async def _search_by_knowledge_points(
        self, knowledge_points: list[str], course_id: int | None = None
    ) -> list[dict[str, Any]]:
        """
        基于知识点检索视频
        """
        if not knowledge_points or not course_id:
            return []

        try:
            # 调用媒体服务检索视频
            videos = []
            for kp in knowledge_points[:3]:  # 最多查询3个知识点
                result = await self.media_client.search_videos(
                    course_id=course_id,
                    keyword=kp,
                    page=1,
                    page_size=5,
                )

                if result and "items" in result:
                    for video in result["items"]:
                        videos.append({
                            "video_id": video.get("id"),
                            "title": video.get("title", ""),
                            "url": video.get("url", ""),
                            "duration": video.get("duration", 0),
                            "thumbnail": video.get("thumbnail", ""),
                            "knowledge_point": kp,
                            "relevance_score": 0.8,  # 基于知识点匹配的基础分数
                            "source": "knowledge_point",
                        })

            logger.info(f"基于知识点检索到 {len(videos)} 个视频")
            return videos

        except Exception as e:
            logger.error(f"知识点视频检索失败: {e}")
            return []

    async def _search_by_question_type(
        self, question_type: str, course_id: int | None = None
    ) -> list[dict[str, Any]]:
        """
        基于问题类型检索视频
        """
        if not question_type or not course_id:
            return []

        try:
            # 根据问题类型构建搜索关键词
            type_keywords = {
                "概念理解": "概念讲解",
                "解题方法": "解题技巧",
                "代码调试": "代码示例",
                "知识应用": "实战应用",
                "综合分析": "综合讲解",
            }

            keyword = type_keywords.get(question_type, question_type)

            result = await self.media_client.search_videos(
                course_id=course_id,
                keyword=keyword,
                page=1,
                page_size=5,
            )

            videos = []
            if result and "items" in result:
                for video in result["items"]:
                    videos.append({
                        "video_id": video.get("id"),
                        "title": video.get("title", ""),
                        "url": video.get("url", ""),
                        "duration": video.get("duration", 0),
                        "thumbnail": video.get("thumbnail", ""),
                        "question_type": question_type,
                        "relevance_score": 0.7,  # 基于类型匹配的基础分数
                        "source": "question_type",
                    })

            logger.info(f"基于问题类型检索到 {len(videos)} 个视频")
            return videos

        except Exception as e:
            logger.error(f"问题类型视频检索失败: {e}")
            return []

    def _merge_and_rank_videos(
        self,
        knowledge_based_videos: list[dict[str, Any]],
        type_based_videos: list[dict[str, Any]],
        user_profile: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """
        合并和排序视频
        
        考虑因素：
        - 相关性分数
        - 学生画像（学习偏好）
        - 多样性控制
        """
        # 合并视频（去重）
        video_dict = {}

        for video in knowledge_based_videos:
            video_id = video.get("video_id")
            if video_id and video_id not in video_dict:
                video_dict[video_id] = video

        for video in type_based_videos:
            video_id = video.get("video_id")
            if video_id:
                if video_id in video_dict:
                    # 已存在，提高相关性分数
                    video_dict[video_id]["relevance_score"] += 0.2
                else:
                    video_dict[video_id] = video

        videos = list(video_dict.values())

        # 根据学生画像调整分数
        if user_profile:
            learning_style = user_profile.get("learning_style", "")
            if learning_style == "视觉型":
                # 视觉型学习者，提高所有视频的分数
                for video in videos:
                    video["relevance_score"] += 0.1

        # 按相关性分数排序
        videos.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)

        return videos

    async def _locate_relevant_segments(
        self,
        videos: list[dict[str, Any]],
        question_text: str,
        question_analysis: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """
        定位相关片段
        
        为每个视频添加：
        - segments: [{start_sec, end_sec, reason}]（若媒体服务返回 captions/chapters 则按文本命中选段）
        - recommendation_reason: 推荐理由
        """
        keywords = _extract_question_keywords(question_text, question_analysis)
        for video in videos:
            segments = self._segments_for_video(video, keywords)
            video["segments"] = segments
            video["recommendation_reason"] = self._generate_recommendation_reason(
                video, question_analysis
            )

        return videos

    def _segments_for_video(
        self, video: dict[str, Any], keywords: list[str]
    ) -> list[dict[str, Any]]:
        """单条视频的片段列表（至少一段，便于前端跳转）。"""
        duration = video.get("duration", 0)
        title = str(video.get("title", ""))
        kp = str(video.get("knowledge_point", "") or video.get("question_type", "") or "")

        timed_items: list[dict[str, Any]] = []
        for key in ("captions", "chapters", "segments_detail"):
            raw = video.get(key)
            if isinstance(raw, list):
                timed_items.extend([x for x in raw if isinstance(x, dict)])

        best: tuple[int, float, float, str] | None = None
        for item in timed_items:
            text = _caption_text(item)
            score = _segment_text_score(text, keywords)
            bounds = _pick_time_range(item)
            if bounds and score > 0:
                start, end = bounds
                if best is None or score > best[0]:
                    best = (score, start, end, text[:120] or "相关片段")

        if best is not None:
            _, start, end, snippet = best
            return [
                {
                    "start_sec": round(start, 2),
                    "end_sec": round(end, 2),
                    "reason": f"字幕/章节与问题关键词匹配：{snippet}",
                }
            ]

        transcript = video.get("transcript")
        if isinstance(transcript, str) and transcript.strip():
            score = _segment_text_score(transcript, keywords)
            end = _heuristic_segment_end(duration)
            reason = (
                "转录文本与问题部分相关，建议从开头观看"
                if score > 0
                else "根据转录内容给出概览区间（未精确定位）"
            )
            return [{"start_sec": 0.0, "end_sec": end, "reason": reason}]

        haystack = f"{title} {kp}"
        if keywords and _segment_text_score(haystack, keywords) > 0:
            end = _heuristic_segment_end(duration)
            return [
                {
                    "start_sec": 0.0,
                    "end_sec": end,
                    "reason": "标题或知识点标签与问题关键词相关，建议优先观看前段",
                }
            ]

        end = _heuristic_segment_end(duration)
        return [
            {
                "start_sec": 0.0,
                "end_sec": end,
                "reason": "未提供字幕/章节时，建议从前段建立上下文",
            }
        ]

    def _generate_recommendation_reason(
        self, video: dict[str, Any], question_analysis: dict[str, Any]
    ) -> str:
        """
        生成推荐理由
        """
        reasons = []

        if video.get("source") == "knowledge_point":
            kp = video.get("knowledge_point", "")
            reasons.append(f"涵盖知识点：{kp}")

        if video.get("source") == "question_type":
            qt = video.get("question_type", "")
            reasons.append(f"适合{qt}类问题")

        if video.get("relevance_score", 0) > 0.9:
            reasons.append("高度相关")

        return "；".join(reasons) if reasons else "相关视频推荐"


# 导出函数供 LangGraph 使用
async def video_recommender_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    视频推荐节点（LangGraph 节点函数）
    
    输入状态：
    - question_text: 问题文字
    - question_analysis: 问题分析结果
    - user_profile: 学生画像
    - course_id: 课程ID
    
    输出状态：
    - video_result: 视频推荐结果
    """
    agent = VideoRecommenderAgent()

    question_text = state.get("question_text", "")
    question_analysis = state.get("question_analysis", {})
    user_profile = state.get("user_profile")
    course_id = state.get("course_id")

    video_result = await agent.recommend_videos(
        question_text, question_analysis, user_profile, course_id
    )

    state["video_result"] = video_result

    # 记录执行轨迹
    trace = state.get("execution_trace", [])
    video_count = len(video_result.get("videos", []))
    trace.append(f"video_recommender:count={video_count}")
    state["execution_trace"] = trace

    return state
