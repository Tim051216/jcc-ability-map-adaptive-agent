"""
视频推荐智能体

功能:
1. 从资源库检索相关视频
2. 基于知识点匹配和学生画像推荐
3. 视频质量评分和排序
4. 多样性控制
"""

from typing import Dict, Any, Optional, List
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.agents.state import LearningAgentState


class VideoRecommendationAgent:
    """视频推荐智能体"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model=settings.llm_model,
            temperature=0.3,
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
        )
    
    async def recommend_videos(
        self,
        knowledge_point: str,
        student_profile: Optional[Dict[str, Any]] = None,
        max_results: int = 5
    ) -> Dict[str, Any]:
        """
        推荐视频
        
        Args:
            knowledge_point: 知识点名称
            student_profile: 学生画像
            max_results: 最大推荐数量
            
        Returns:
            推荐视频列表
        """
        # 模拟视频库检索(实际应该从数据库或外部API获取)
        video_candidates = await self._search_video_library(knowledge_point)
        
        # 根据学生画像进行个性化排序
        ranked_videos = self._rank_videos(video_candidates, student_profile, knowledge_point)
        
        # 多样性控制
        diverse_videos = self._ensure_diversity(ranked_videos, max_results)
        
        return {
            "videos": diverse_videos[:max_results],
            "total_candidates": len(video_candidates),
            "recommended_count": len(diverse_videos[:max_results])
        }
    
    async def _search_video_library(self, knowledge_point: str) -> List[Dict[str, Any]]:
        """
        从视频库检索相关视频
        
        实际实现应该:
        1. 查询数据库中的视频资源
        2. 调用外部视频平台API (如B站、YouTube)
        3. 使用向量检索匹配相关视频
        
        这里返回模拟数据
        """
        # 模拟视频数据
        mock_videos = [
            {
                "title": f"{knowledge_point} - 基础入门教程",
                "source_platform": "bilibili",
                "source_url": "https://www.bilibili.com/video/BV1xx411c7mD",
                "duration": 1200,  # 20分钟
                "tags": [knowledge_point, "入门", "基础"],
                "description": f"详细讲解{knowledge_point}的基本概念和原理",
                "quality_score": 0.85,
                "difficulty_level": 1
            },
            {
                "title": f"{knowledge_point} - 进阶实战",
                "source_platform": "bilibili",
                "source_url": "https://www.bilibili.com/video/BV1yy4y1q7zz",
                "duration": 1800,  # 30分钟
                "tags": [knowledge_point, "进阶", "实战"],
                "description": f"通过实际案例深入理解{knowledge_point}",
                "quality_score": 0.90,
                "difficulty_level": 2
            },
            {
                "title": f"{knowledge_point} - 动画演示",
                "source_platform": "youtube",
                "source_url": "https://www.youtube.com/watch?v=xxxxx",
                "duration": 600,  # 10分钟
                "tags": [knowledge_point, "动画", "可视化"],
                "description": f"用动画形式展示{knowledge_point}的工作原理",
                "quality_score": 0.88,
                "difficulty_level": 1
            }
        ]
        
        return mock_videos
    
    def _rank_videos(
        self,
        videos: List[Dict[str, Any]],
        student_profile: Optional[Dict[str, Any]],
        knowledge_point: str
    ) -> List[Dict[str, Any]]:
        """
        根据学生画像对视频进行排序
        
        排序因素:
        1. 难度匹配度
        2. 学习风格匹配度
        3. 视频质量分数
        4. 时长适配度
        """
        if not student_profile:
            # 没有画像,按质量分数排序
            return sorted(videos, key=lambda x: x.get("quality_score", 0), reverse=True)
        
        # 获取学生偏好
        difficulty_level = student_profile.get("difficulty_level", 1)
        learning_style = student_profile.get("cognitive_style", "")
        preferred_duration = student_profile.get("preferred_video_duration", 1200)  # 默认20分钟
        
        # 计算每个视频的综合得分
        for video in videos:
            score = 0.0
            
            # 1. 难度匹配度 (40%)
            video_difficulty = video.get("difficulty_level", 1)
            difficulty_match = 1.0 - abs(video_difficulty - difficulty_level) / 3.0
            score += difficulty_match * 0.4
            
            # 2. 学习风格匹配度 (30%)
            style_match = 0.5  # 默认中等匹配
            if "视觉" in learning_style or "图形" in learning_style:
                if "动画" in video.get("tags", []) or "可视化" in video.get("tags", []):
                    style_match = 1.0
            score += style_match * 0.3
            
            # 3. 视频质量分数 (20%)
            quality = video.get("quality_score", 0.5)
            score += quality * 0.2
            
            # 4. 时长适配度 (10%)
            duration = video.get("duration", 0)
            duration_diff = abs(duration - preferred_duration)
            duration_match = max(0, 1.0 - duration_diff / preferred_duration)
            score += duration_match * 0.1
            
            video["recommendation_score"] = score
        
        # 按综合得分排序
        return sorted(videos, key=lambda x: x.get("recommendation_score", 0), reverse=True)
    
    def _ensure_diversity(self, videos: List[Dict[str, Any]], max_results: int) -> List[Dict[str, Any]]:
        """
        确保推荐结果的多样性
        
        避免:
        1. 同一平台的视频过多
        2. 同一难度级别的视频过多
        3. 时长过于相似
        """
        if len(videos) <= max_results:
            return videos
        
        selected = []
        platform_count = {}
        difficulty_count = {}
        
        for video in videos:
            if len(selected) >= max_results:
                break
            
            platform = video.get("source_platform", "unknown")
            difficulty = video.get("difficulty_level", 1)
            
            # 检查多样性约束
            if platform_count.get(platform, 0) >= max_results // 2:
                continue  # 同一平台不超过一半
            
            if difficulty_count.get(difficulty, 0) >= max_results // 2:
                continue  # 同一难度不超过一半
            
            selected.append(video)
            platform_count[platform] = platform_count.get(platform, 0) + 1
            difficulty_count[difficulty] = difficulty_count.get(difficulty, 0) + 1
        
        # 如果还没选够,放宽约束
        if len(selected) < max_results:
            for video in videos:
                if video not in selected:
                    selected.append(video)
                    if len(selected) >= max_results:
                        break
        
        return selected


async def video_recommendation_node(state: LearningAgentState) -> LearningAgentState:
    """
    视频推荐节点
    
    从状态中获取知识点信息,推荐相关视频
    """
    # 获取必要参数
    knowledge_point = state.get("knowledge_point", "")
    student_profile = state.get("student_profile", {})
    max_results = state.get("max_video_results", 5)
    
    if not knowledge_point:
        state["video_result"] = {
            "success": False,
            "error": "缺少知识点信息"
        }
        return state
    
    # 创建智能体并推荐视频
    agent = VideoRecommendationAgent()
    
    try:
        result = await agent.recommend_videos(
            knowledge_point=knowledge_point,
            student_profile=student_profile,
            max_results=max_results
        )
        
        state["video_result"] = {
            "success": True,
            "data": result
        }
        
        # 记录执行轨迹
        trace = state.get("execution_trace", [])
        trace.append(f"video_recommendation:success:count={result['recommended_count']}")
        state["execution_trace"] = trace
        
    except Exception as e:
        state["video_result"] = {
            "success": False,
            "error": str(e)
        }
        
        # 记录错误
        trace = state.get("execution_trace", [])
        trace.append(f"video_recommendation:failed:{str(e)}")
        state["execution_trace"] = trace
    
    return state
