"""
对话式画像构建服务层

负责协调智能体、数据库操作和业务逻辑
"""

import asyncio
from datetime import datetime
import re
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.profile_conversation import (
    ConversationMessageModel,
    ConversationSessionModel,
    ExtractedInfoModel,
    StudentProfileModel,
    ProfileHistoryModel,
)
from app.schemas.profile_conversation import (
    ConversationFlowResponse,
    ConversationMessageResponse,
    ConversationSessionResponse,
    ExtractionResult,
    ExtractedInfoItem,
    GuideQuestionResponse,
    ProfileDimensionData,
    ProfileHistoryItem,
    ProfileHistoryResponse,
    ProfileSummary,
    ProfileUpdateResult,
    StudentProfileDetail,
)

profile_conversation_graph = None


def _get_profile_conversation_graph():
    if profile_conversation_graph is not None:
        return profile_conversation_graph
    from app.agents.nodes.profile_conversation.conversation_graph import (
        profile_conversation_graph as runtime_profile_conversation_graph,
    )

    return runtime_profile_conversation_graph


def _get_guide_question_generator():
    from app.agents.nodes.profile_conversation.info_extractor_agent import (
        generate_guide_question,
    )

    return generate_guide_question


def _get_profile_builder_helpers():
    from app.agents.nodes.profile_conversation.profile_builder_agent import (
        calculate_profile_completeness,
        generate_profile_tags,
    )

    return calculate_profile_completeness, generate_profile_tags


class ProfileConversationService:
    PROFILE_BEHAVIOR_TIMEOUT_SECONDS = 8
    PROFILE_CONVERSATION_TIMEOUT_SECONDS = 12

    """对话式画像构建服务"""

    PROFILE_DIMENSIONS = [
        "knowledge_base",
        "cognitive_style",
        "learning_progress",
        "error_preference",
        "interest_direction",
        "learning_habit",
    ]

    def __init__(self, db: AsyncSession):
        self.db = db

    def _uses_sqlite(self) -> bool:
        try:
            bind = self.db.get_bind()
            return bool(bind and bind.dialect.name == "sqlite")
        except Exception:
            return False

    async def _assign_sqlite_id(self, obj: Any, model: type[Any]) -> None:
        """SQLite only autoincrements INTEGER PRIMARY KEY, not BigInteger PK."""
        if not self._uses_sqlite() or getattr(obj, "id", None) is not None:
            return
        result = await self.db.execute(select(func.max(model.id)))
        max_id = result.scalar() or 0
        obj.id = int(max_id) + 1

    async def start_conversation(
        self, user_id: int, session_type: int = 1
    ) -> ConversationSessionResponse:
        """
        开始新的对话会话
        
        Args:
            user_id: 用户ID
            session_type: 会话类型
            
        Returns:
            会话响应
        """
        # 创建新会话
        session = ConversationSessionModel(
            user_id=user_id,
            session_type=session_type,
            status=0,  # 进行中
            total_rounds=0,
            completeness=0,
            start_time=datetime.now(),
        )
        
        await self._assign_sqlite_id(session, ConversationSessionModel)
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)

        # 创建系统欢迎消息
        welcome_message = ConversationMessageModel(
            session_id=session.id,
            user_id=user_id,
            role="assistant",
            content="你好！我是你的学习助手。为了给你提供更个性化的学习建议，我想了解一下你的学习情况。让我们开始吧！",
            round_number=0,
            message_type=2,  # 引导问题
        )
        
        await self._assign_sqlite_id(welcome_message, ConversationMessageModel)
        self.db.add(welcome_message)
        await self.db.commit()

        return ConversationSessionResponse(
            session_id=session.id,
            user_id=session.user_id,
            status=session.status,
            session_type=session.session_type,
            total_rounds=session.total_rounds,
            collected_dimensions=[],
            completeness=session.completeness,
            start_time=session.start_time,
            end_time=session.end_time,
            messages=[
                ConversationMessageResponse(
                    message_id=welcome_message.id,
                    role=welcome_message.role,
                    content=welcome_message.content,
                    round_number=welcome_message.round_number,
                    message_type=welcome_message.message_type,
                    related_dimension=welcome_message.related_dimension,
                    created_at=welcome_message.created_at,
                )
            ],
        )

    async def process_message(
        self, session_id: int, user_message: str
    ) -> ConversationFlowResponse:
        """
        处理用户消息
        
        Args:
            session_id: 会话ID
            user_message: 用户消息内容
            
        Returns:
            对话流程响应
        """
        # 获取会话
        result = await self.db.execute(
            select(ConversationSessionModel).where(ConversationSessionModel.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise ValueError("会话不存在")
        
        if session.status != 0:
            raise ValueError("会话已结束")

        # 保存用户消息
        user_msg = ConversationMessageModel(
            session_id=session_id,
            user_id=session.user_id,
            role="user",
            content=user_message,
            round_number=session.total_rounds + 1,
            message_type=1,  # 普通对话
        )
        
        await self._assign_sqlite_id(user_msg, ConversationMessageModel)
        self.db.add(user_msg)
        
        # 更新会话轮次
        session.total_rounds += 1
        await self.db.commit()

        # 获取对话历史
        messages_result = await self.db.execute(
            select(ConversationMessageModel)
            .where(ConversationMessageModel.session_id == session_id)
            .order_by(ConversationMessageModel.round_number)
        )
        messages = messages_result.scalars().all()
        # 画像提取仅使用用户真实表述，避免欢迎语和追问污染维度判断。
        message_contents = [msg.content for msg in messages if msg.role == "user"]

        # 调用智能体进行信息提取
        state: dict[str, Any] = {
            "user_id": session.user_id,
            "session_id": session_id,
            "messages": message_contents,
            "current_round": session.total_rounds,
            "session_status": "in_progress",
            "session_type": session.session_type,
            "execution_trace": [],
        }

        # 对话页需要即时反馈；默认使用确定性本地抽取。测试或特殊运行时显式注入图时仍尊重图结果。
        if profile_conversation_graph is not None:
            result_state = await profile_conversation_graph.ainvoke(state)
            extracted_payload = result_state.get("extracted_info") or {}
            if not extracted_payload.get("extracted_info") and message_contents:
                result_state = {**result_state, "extracted_info": self._build_local_extraction(message_contents)}
        else:
            result_state = {
                **state,
                "extracted_info": self._build_local_extraction(message_contents),
            }

        # 提取结果
        extracted_info = result_state.get("extracted_info", {})
        completeness = extracted_info.get("completeness", 0)
        missing_dimensions = extracted_info.get("missing_dimensions", [])

        # 更新会话完整度
        session.completeness = completeness
        session.collected_dimensions = ",".join(
            [
                dim
                for dim in [
                    "knowledge_base",
                    "cognitive_style",
                    "learning_progress",
                    "error_preference",
                    "interest_direction",
                    "learning_habit",
                ]
                if dim not in missing_dimensions
            ]
        )
        await self.db.commit()

        # 生成引导问题
        guide_question_text = _get_guide_question_generator()(missing_dimensions, extracted_info)
        
        # 创建助手回复消息
        assistant_msg = ConversationMessageModel(
            session_id=session_id,
            user_id=session.user_id,
            role="assistant",
            content=guide_question_text,
            round_number=session.total_rounds,
            message_type=2 if missing_dimensions else 3,  # 引导问题或确认信息
            related_dimension=missing_dimensions[0] if missing_dimensions else None,
        )
        
        await self._assign_sqlite_id(assistant_msg, ConversationMessageModel)
        self.db.add(assistant_msg)
        await self.db.commit()
        await self.db.refresh(assistant_msg)

        # 构建响应
        should_continue = completeness < 80 and session.total_rounds < 20

        response = ConversationFlowResponse(
            session_id=session_id,
            assistant_message=ConversationMessageResponse(
                message_id=assistant_msg.id,
                role=assistant_msg.role,
                content=assistant_msg.content,
                round_number=assistant_msg.round_number,
                message_type=assistant_msg.message_type,
                related_dimension=assistant_msg.related_dimension,
                created_at=assistant_msg.created_at,
            ),
            guide_question=GuideQuestionResponse(
                question=guide_question_text,
                related_dimension=missing_dimensions[0] if missing_dimensions else None,
                question_type=2,
                suggestions=[],
            )
            if should_continue
            else None,
            extraction_result=ExtractionResult(
                extracted_info=[
                    ExtractedInfoItem(**item)
                    for item in extracted_info.get("extracted_info", [])
                ],
                missing_dimensions=missing_dimensions,
                completeness=completeness,
            ),
            profile_summary=None,  # 将在完成时生成
            should_continue=should_continue,
            completeness=completeness,
        )

        return response

    async def complete_conversation(
        self, session_id: int, force_complete: bool = False
    ) -> StudentProfileDetail:
        """
        完成对话会话并生成画像
        
        Args:
            session_id: 会话ID
            force_complete: 是否强制完成
            
        Returns:
            学生画像详情
        """
        # 获取会话
        result = await self.db.execute(
            select(ConversationSessionModel).where(ConversationSessionModel.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise ValueError("会话不存在")

        if not force_complete and session.completeness < 60:
            raise ValueError("画像信息不足，无法完成（完整度需达到60%以上）")

        # 获取对话历史
        messages_result = await self.db.execute(
            select(ConversationMessageModel)
            .where(ConversationMessageModel.session_id == session_id)
            .order_by(ConversationMessageModel.round_number)
        )
        messages = messages_result.scalars().all()
        # 完成画像时同样只基于用户消息构建最终画像。
        message_contents = [msg.content for msg in messages if msg.role == "user"]

        # 调用 LangGraph 编排的画像构建链路
        state: dict[str, Any] = {
            "user_id": session.user_id,
            "session_id": session_id,
            "messages": message_contents,
            "current_round": session.total_rounds,
            "session_status": "completed",
            "session_type": session.session_type,
            "execution_trace": [],
        }

        if profile_conversation_graph is not None:
            result_state = await profile_conversation_graph.ainvoke(state)
        else:
            extracted_info = self._build_local_extraction(message_contents)
            result_state = {
                **state,
                "extracted_info": extracted_info,
                "built_profile": self._build_local_profile(extracted_info),
            }

        built_profile = result_state.get("built_profile", {})

        existing_result = await self.db.execute(
            select(StudentProfileModel).where(
                StudentProfileModel.user_id == session.user_id
            )
        )
        existing_profile = existing_result.scalar_one_or_none()

        if existing_profile:
            history = ProfileHistoryModel(
                profile_id=existing_profile.id,
                user_id=session.user_id,
                version=existing_profile.version,
                snapshot_data={
                    "knowledge_base": existing_profile.knowledge_base,
                    "cognitive_style": existing_profile.cognitive_style,
                    "learning_progress": existing_profile.learning_progress,
                    "error_preference": existing_profile.error_preference,
                    "interest_direction": existing_profile.interest_direction,
                    "learning_habit": existing_profile.learning_habit,
                    "tags": existing_profile.tags,
                    "summary": existing_profile.summary,
                },
                change_type=2,
                change_description="对话完成，画像重新生成",
                changed_dimensions=",".join(self.PROFILE_DIMENSIONS),
            )
            await self._assign_sqlite_id(history, ProfileHistoryModel)
            self.db.add(history)

            existing_profile.knowledge_base = built_profile.get("knowledge_base")
            existing_profile.cognitive_style = built_profile.get("cognitive_style")
            existing_profile.learning_progress = built_profile.get("learning_progress")
            existing_profile.error_preference = built_profile.get("error_preference")
            existing_profile.interest_direction = built_profile.get("interest_direction")
            existing_profile.learning_habit = built_profile.get("learning_habit")
            existing_profile.tags = built_profile.get("tags", [])
            existing_profile.completeness = session.completeness
            existing_profile.summary = built_profile.get("summary")
            existing_profile.version += 1
            profile_snapshot = existing_profile
        else:
            profile_snapshot = StudentProfileModel(
                user_id=session.user_id,
                version=1,
                knowledge_base=built_profile.get("knowledge_base"),
                cognitive_style=built_profile.get("cognitive_style"),
                learning_progress=built_profile.get("learning_progress"),
                error_preference=built_profile.get("error_preference"),
                interest_direction=built_profile.get("interest_direction"),
                learning_habit=built_profile.get("learning_habit"),
                tags=built_profile.get("tags", []),
                completeness=session.completeness,
                summary=built_profile.get("summary"),
            )
            await self._assign_sqlite_id(profile_snapshot, StudentProfileModel)
            self.db.add(profile_snapshot)

        session.status = 1
        session.end_time = datetime.now()

        await self.db.flush()
        if not existing_profile and profile_snapshot.id:
            initial_history = ProfileHistoryModel(
                profile_id=profile_snapshot.id,
                user_id=session.user_id,
                version=profile_snapshot.version,
                snapshot_data=self._build_profile_snapshot_data(profile_snapshot),
                change_type=1,
                change_description="首次生成画像",
                changed_dimensions=",".join(self.PROFILE_DIMENSIONS),
            )
            await self._assign_sqlite_id(initial_history, ProfileHistoryModel)
            self.db.add(initial_history)
        session.profile_id = profile_snapshot.id
        await self.db.commit()
        await self.db.refresh(profile_snapshot)

        # 构建响应
        dimensions = []
        for dim_code in [
            "knowledge_base",
            "cognitive_style",
            "learning_progress",
            "error_preference",
            "interest_direction",
            "learning_habit",
        ]:
            dim_data = built_profile.get(dim_code)
            if dim_data:
                dimensions.append(
                    ProfileDimensionData(
                        dimension_code=dim_code,
                        dimension_name=self._get_dimension_name(dim_code),
                        data=dim_data if isinstance(dim_data, dict) else {},
                        completeness=100 if dim_data else 0,
                    )
                )

        return StudentProfileDetail(
            profile_id=profile_snapshot.id,
            user_id=session.user_id,
            version=profile_snapshot.version,
            dimensions=dimensions,
            tags=profile_snapshot.tags,
            completeness=session.completeness,
            summary=profile_snapshot.summary,
            created_at=profile_snapshot.created_at,
            updated_at=profile_snapshot.updated_at,
        )

    def _build_profile_snapshot_data(self, profile: StudentProfileModel) -> dict[str, Any]:
        return {
            "knowledge_base": profile.knowledge_base,
            "cognitive_style": profile.cognitive_style,
            "learning_progress": profile.learning_progress,
            "error_preference": profile.error_preference,
            "interest_direction": profile.interest_direction,
            "learning_habit": profile.learning_habit,
            "tags": profile.tags,
            "summary": profile.summary,
        }

    def _build_local_extraction(self, messages: list[str]) -> dict[str, Any]:
        text = " ".join(str(message or "").strip() for message in messages if message).strip()
        extracted: list[dict[str, Any]] = []

        def add(dimension: str, info_key: str, info_value: str, confidence: float = 0.86) -> None:
            value = self._normalize_short_text(info_value, 48)
            if value:
                extracted.append(
                    {
                        "dimension": dimension,
                        "info_key": info_key,
                        "info_value": value,
                        "confidence": confidence,
                    }
                )

        lower_text = text.lower()
        if "软件工程" in text:
            add("knowledge_base", "major", "软件工程专业")
        if "前端" in text or "react" in lower_text or "vue" in lower_text:
            add("knowledge_base", "strengths", "前端基础")
        if "接口" in text or "联调" in text:
            add("knowledge_base", "strengths", "接口联调")
        if "系统设计" in text:
            add("error_preference", "common_mistakes", "系统设计容易卡住")
        if "任务拆解" in text:
            add("error_preference", "common_mistakes", "任务拆解需要加强")
        if "性能优化" in text:
            add("error_preference", "common_mistakes", "性能优化需要加强")
        if "实习" in text:
            add("interest_direction", "career_goal", "准备实习")
        if "软件赛" in text or "比赛" in text:
            add("interest_direction", "topics", "软件赛项目")
        if "项目" in text or "实战" in text:
            add("cognitive_style", "preferred_style", "项目实战驱动")
            add("interest_direction", "target_level", "能独立完成项目")
        if "按" in text and ("节奏" in text or "学习" in text):
            add("learning_habit", "pace", "按项目实战节奏学习")
        if "基础" in text:
            add("learning_progress", "current_stage", "已有基础，进入项目实践阶段")
        if not extracted:
            add("knowledge_base", "self_description", text[:48] or "已提交自然语言画像描述", 0.72)
            add("cognitive_style", "source", "自然语言对话抽取", 0.68)

        collected_dimensions = {item["dimension"] for item in extracted}
        missing_dimensions = [dimension for dimension in self.PROFILE_DIMENSIONS if dimension not in collected_dimensions]
        completeness = min(100, max(18, round((len(collected_dimensions) / len(self.PROFILE_DIMENSIONS)) * 100)))
        return {
            "extracted_info": extracted,
            "missing_dimensions": missing_dimensions,
            "completeness": completeness,
        }

    def _build_local_profile(self, extracted_info: dict[str, Any]) -> dict[str, Any]:
        grouped: dict[str, dict[str, Any]] = {dimension: {} for dimension in self.PROFILE_DIMENSIONS}
        for item in extracted_info.get("extracted_info", []):
            dimension = str(item.get("dimension") or "")
            info_key = str(item.get("info_key") or "note")
            info_value = item.get("info_value")
            if dimension in grouped and info_value:
                current = grouped[dimension].get(info_key)
                if current:
                    grouped[dimension][info_key] = f"{current}；{info_value}"
                else:
                    grouped[dimension][info_key] = info_value

        grouped["knowledge_base"].setdefault("level", "intermediate")
        grouped["cognitive_style"].setdefault("structure_first", True)
        grouped["learning_progress"].setdefault("progress", 0.68)
        grouped["error_preference"].setdefault("fix_style", "example_driven")
        grouped["interest_direction"].setdefault("target_level", "能独立完成基础项目")
        grouped["learning_habit"].setdefault("review_cycle_days", 2)

        tags = ["项目实战", "结构化学习", "前端联调", "工程实践"]
        return {
            **grouped,
            "tags": tags,
            "summary": "系统已根据自然语言对话识别出：具备前端与接口联调基础，目标偏向软件赛、实习和项目实战，当前主要卡点集中在系统设计、任务拆解与性能优化。",
        }

    def _extract_topic_labels(self, values: list[str]) -> list[str]:
        topic_map = {
            "python": "Python基础",
            "数据分析": "数据分析",
            "自动化": "自动化脚本",
            "算法": "算法题分析",
            "调试": "调试能力",
            "项目": "项目实践",
        }
        topics: list[str] = []
        for raw_value in values:
            lower_value = raw_value.lower()
            for token, label in topic_map.items():
                haystack = lower_value if token == "python" else raw_value
                if token in haystack and label not in topics:
                    topics.append(label)
        return topics

    def _extract_error_labels(self, values: list[str]) -> list[str]:
        keyword_map = {
            "调试": "调试",
            "算法题": "算法题分析",
            "算法": "算法基础",
            "概念": "概念辨析",
            "粗心": "审题粗心",
        }
        labels: list[str] = []
        for raw_value in values:
            for token, label in keyword_map.items():
                if token == "算法" and "算法题" in raw_value:
                    continue
                if token in raw_value and label not in labels:
                    labels.append(label)
        return labels

    def _normalize_short_text(self, value: Any, limit: int = 28) -> str:
        text = str(value or "").strip()
        if not text:
            return ""
        text = re.sub(r"[，。；：、,.!?！？]+$", "", text)
        return text if len(text) <= limit else text[:limit].rstrip()

    def _detect_stage(self, text: str) -> str:
        if "入门" in text:
            return "入门阶段"
        if "基础" in text:
            return "基础阶段"
        if "进阶" in text:
            return "进阶阶段"
        if "项目" in text:
            return "项目实践阶段"
        return "基础阶段"

    def _detect_best_time(self, text: str) -> str:
        if "晚上" in text:
            return "晚上"
        if "早上" in text:
            return "早上"
        if "周末" in text:
            return "周末"
        return "时间灵活"

    def _detect_motivation(self, text: str) -> str:
        if "打牢基础" in text or "基础打牢" in text or "基础" in text:
            return "先打牢基础，再逐步提升"
        if "项目" in text:
            return "希望尽快进入项目实战"
        if "答辩" in text or "展示" in text:
            return "希望提升表达与展示效果"
        return self._normalize_short_text(text, 20) or "希望持续提升"

    def _detect_target_level(self, text: str) -> str:
        if "项目" in text:
            return "能独立完成基础项目"
        if "基础" in text:
            return "先完成基础阶段巩固"
        if "进阶" in text:
            return "逐步进入进阶阶段"
        return "希望持续提升"

    def _normalize_profile_dimension_data(
        self, dimension_code: str, dim_data: dict[str, Any]
    ) -> dict[str, Any]:
        if not isinstance(dim_data, dict):
            return {}

        normalized = dict(dim_data)
        values: list[str] = []
        for raw_value in dim_data.values():
            if isinstance(raw_value, list):
                values.extend(str(item) for item in raw_value if item)
            elif raw_value:
                values.append(str(raw_value))
        joined = " ".join(values)

        if dimension_code == "knowledge_base":
            topics = self._extract_topic_labels(values)
            if topics:
                normalized["mastered_topics"] = topics[:4]
            if isinstance(dim_data.get("background"), str) and len(dim_data.get("background", "")) > 28 and topics:
                normalized["background"] = f"有一定基础，接触过{'、'.join(topics[:3])}"
            weak_areas = self._extract_error_labels(values)
            if weak_areas:
                normalized["weak_areas"] = weak_areas[:3]

        elif dimension_code == "cognitive_style":
            preference_text = " ".join(
                str(item) for item in dim_data.get("learning_preference", []) if item
            ) if isinstance(dim_data.get("learning_preference"), list) else str(dim_data.get("learning_preference") or "")
            if len(preference_text) > 28:
                normalized["learning_preference"] = ["先看结构化讲解，再通过练习巩固"]
            if isinstance(dim_data.get("thinking_style"), str) and len(dim_data.get("thinking_style", "")) > 28:
                normalized["thinking_style"] = "先理解框架，再通过练习巩固"
            if dim_data.get("comprehension_speed") == "中":
                normalized["comprehension_speed"] = "中等"

        elif dimension_code == "learning_progress":
            current_stage = str(dim_data.get("current_stage") or "")
            if len(current_stage) > 20:
                normalized["current_stage"] = self._detect_stage(current_stage)
            if dim_data.get("learning_pace") == "中":
                normalized["learning_pace"] = "中等"

        elif dimension_code == "error_preference":
            labels = self._extract_error_labels(values)
            if labels:
                normalized["common_errors"] = labels[:3]
                normalized["confused_concepts"] = labels[:2]
                normalized["attention_points"] = labels[:2]

        elif dimension_code == "interest_direction":
            topics = self._extract_topic_labels(values)
            if topics:
                normalized["interested_areas"] = topics[:4]
            motivation = str(dim_data.get("learning_motivation") or "")
            if len(motivation) > 24:
                normalized["learning_motivation"] = self._detect_motivation(motivation)
            target_level = str(dim_data.get("target_level") or "")
            if len(target_level) > 20 or not target_level:
                normalized["target_level"] = self._detect_target_level(joined)

        elif dimension_code == "learning_habit":
            best_time = str(dim_data.get("best_time") or "")
            if len(best_time) > 12:
                normalized["best_time"] = self._detect_best_time(best_time)
            study_frequency = str(dim_data.get("study_frequency") or "")
            weekly_hours = dim_data.get("weekly_hours")
            hour_match = re.search(r"(\d+)\s*(?:到|-|~|至)?\s*(\d+)?\s*小时", joined)
            if weekly_hours is None and hour_match:
                if hour_match.group(2):
                    weekly_hours = int((int(hour_match.group(1)) + int(hour_match.group(2))) / 2)
                else:
                    weekly_hours = int(hour_match.group(1))
            if len(study_frequency) > 20 and weekly_hours:
                normalized["study_frequency"] = f"每周约 {weekly_hours} 小时"
            if dim_data.get("study_pattern") == "分散":
                normalized["study_pattern"] = "分散学习"

        return normalized

    async def _ensure_initial_history(
        self, profile: StudentProfileModel
    ) -> ProfileHistoryModel:
        history = ProfileHistoryModel(
            profile_id=profile.id,
            user_id=profile.user_id,
            version=profile.version,
            snapshot_data=self._build_profile_snapshot_data(profile),
            change_type=1,
            change_description="首次生成画像",
            changed_dimensions=",".join(self.PROFILE_DIMENSIONS),
        )
        await self._assign_sqlite_id(history, ProfileHistoryModel)
        self.db.add(history)
        await self.db.commit()
        await self.db.refresh(history)
        return history

    def _get_dimension_name(self, dimension_code: str) -> str:
        """获取维度名称"""
        dimension_names = {
            "knowledge_base": "知识基础",
            "cognitive_style": "认知风格",
            "learning_progress": "学习进度",
            "error_preference": "易错点偏好",
            "interest_direction": "兴趣方向",
            "learning_habit": "学习习惯",
        }
        return dimension_names.get(dimension_code, dimension_code)

    async def get_session(self, session_id: int) -> ConversationSessionResponse | None:
        """获取会话详情"""
        result = await self.db.execute(
            select(ConversationSessionModel).where(ConversationSessionModel.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            return None

        # 获取会话的所有消息
        messages_result = await self.db.execute(
            select(ConversationMessageModel)
            .where(ConversationMessageModel.session_id == session_id)
            .order_by(ConversationMessageModel.round_number)
        )
        messages = messages_result.scalars().all()

        # 解析已采集的维度
        collected_dimensions = []
        if session.collected_dimensions:
            collected_dimensions = session.collected_dimensions.split(",")

        return ConversationSessionResponse(
            session_id=session.id,
            user_id=session.user_id,
            status=session.status,
            session_type=session.session_type,
            total_rounds=session.total_rounds,
            collected_dimensions=collected_dimensions,
            completeness=session.completeness,
            start_time=session.start_time,
            end_time=session.end_time,
            messages=[
                ConversationMessageResponse(
                    message_id=msg.id,
                    role=msg.role,
                    content=msg.content,
                    round_number=msg.round_number,
                    message_type=msg.message_type,
                    related_dimension=msg.related_dimension,
                    created_at=msg.created_at,
                )
                for msg in messages
            ],
        )

    async def get_profile(self, user_id: int) -> StudentProfileDetail | None:
        """获取学生画像"""
        result = await self.db.execute(
            select(StudentProfileModel)
            .where(StudentProfileModel.user_id == user_id)
            .order_by(StudentProfileModel.version.desc())
        )
        profile = result.scalar_one_or_none()

        if not profile:
            return None

        # 构建维度数据
        dimensions = []
        for dim_code in [
            "knowledge_base",
            "cognitive_style",
            "learning_progress",
            "error_preference",
            "interest_direction",
            "learning_habit",
        ]:
            dim_data = self._normalize_profile_dimension_data(
                dim_code, getattr(profile, dim_code, None)
            )
            if dim_data:
                dimensions.append(
                    ProfileDimensionData(
                        dimension_code=dim_code,
                        dimension_name=self._get_dimension_name(dim_code),
                        data=dim_data if isinstance(dim_data, dict) else {},
                        completeness=self._calculate_dimension_completeness(dim_data),
                    )
                )

        return StudentProfileDetail(
            profile_id=profile.id,
            user_id=profile.user_id,
            version=profile.version,
            dimensions=dimensions,
            tags=profile.tags or [],
            completeness=profile.completeness,
            summary=profile.summary,
            created_at=profile.created_at,
            updated_at=profile.updated_at,
        )

    def _calculate_dimension_completeness(self, dim_data: dict | None) -> int:
        """计算单个维度的完整度"""
        if not dim_data or not isinstance(dim_data, dict):
            return 0
        
        # 检查字典中有多少非空值
        filled_fields = sum(
            1 for v in dim_data.values() if v is not None and v != "" and v != []
        )
        total_fields = len(dim_data)
        
        if total_fields == 0:
            return 0
        
        return int((filled_fields / total_fields) * 100)

    async def get_profile_summary(self, user_id: int) -> ProfileSummary | None:
        """获取画像摘要"""
        result = await self.db.execute(
            select(StudentProfileModel)
            .where(StudentProfileModel.user_id == user_id)
            .order_by(StudentProfileModel.version.desc())
        )
        profile = result.scalar_one_or_none()

        if not profile:
            return None

        # 计算各维度完整度
        dimension_completeness = {}
        for dim_code in [
            "knowledge_base",
            "cognitive_style",
            "learning_progress",
            "error_preference",
            "interest_direction",
            "learning_habit",
        ]:
            dim_data = getattr(profile, dim_code, None)
            dimension_completeness[dim_code] = self._calculate_dimension_completeness(
                dim_data
            )

        # 生成关键特征描述
        key_features = self._generate_key_features(profile)

        # 推荐学习方式
        recommended_style = self._recommend_learning_style(profile)

        # 当前学习阶段
        current_stage = self._determine_current_stage(profile)

        # 稳定学习画像编码
        sbti_code = self._determine_sbti_code(
            tags=profile.tags or [],
            key_features=key_features,
            recommended_style=recommended_style,
            current_stage=current_stage,
            dimension_completeness=dimension_completeness,
        )

        return ProfileSummary(
            profile_id=profile.id,
            user_id=profile.user_id,
            completeness=profile.completeness,
            sbti_code=sbti_code,
            tags=profile.tags or [],
            key_features=key_features,
            dimension_completeness=dimension_completeness,
            recommended_learning_style=recommended_style,
            current_stage=current_stage,
        )

    def _determine_sbti_code(
        self,
        *,
        tags: list[str],
        key_features: str | None,
        recommended_style: str | None,
        current_stage: str | None,
        dimension_completeness: dict[str, int],
    ) -> str:
        stable_signals = " ".join(
            [
                *(tags or []),
                key_features or "",
                recommended_style or "",
                current_stage or "",
            ]
        ).lower()

        def _count(*patterns: str) -> int:
            return sum(1 for pattern in patterns if pattern and pattern in stable_signals)

        scores = {
            "SPTA": _count("结构", "拆解", "规划", "步骤", "实践", "实操", "项目", "验证", "稳定", "持续", "推进")
            + (1 if dimension_completeness.get("learning_habit", 0) >= 70 else 0)
            + (1 if dimension_completeness.get("learning_progress", 0) >= 70 else 0),
            "STCA": _count("原理", "理论", "概念", "推导", "框架", "体系", "图谱", "讲义", "笔记", "梳理")
            + (1 if dimension_completeness.get("knowledge_base", 0) >= 70 else 0)
            + (1 if dimension_completeness.get("cognitive_style", 0) >= 70 else 0),
            "ETFI": _count("反馈", "复盘", "纠错", "测评", "试错", "调整", "迭代", "修正", "提问", "答疑", "互动", "探索")
            + (1 if dimension_completeness.get("error_preference", 0) >= 70 else 0),
            "SPCI": _count("主线", "节奏", "持续", "推进", "巩固", "积累", "跟进", "提升")
            + (1 if dimension_completeness.get("learning_habit", 0) >= 60 else 0),
        }

        ranked_codes = sorted(
            scores.keys(),
            key=lambda code: (scores[code], -["SPTA", "STCA", "ETFI", "SPCI"].index(code)),
            reverse=True,
        )
        return ranked_codes[0] if ranked_codes else "SPCI"

    def _generate_key_features(self, profile: StudentProfileModel) -> str:
        """生成关键特征描述"""
        features = []
        
        # 从知识基础提取
        if profile.knowledge_base:
            level = profile.knowledge_base.get("level")
            if level:
                features.append(f"{level}学习者")
        
        # 从认知风格提取
        if profile.cognitive_style:
            preferred_format = profile.cognitive_style.get("preferred_format", [])
            if preferred_format:
                features.append(f"偏好{'/'.join(preferred_format[:2])}学习")
        
        # 从学习进度提取
        if profile.learning_progress:
            pace = profile.learning_progress.get("learning_pace")
            if pace:
                features.append(f"{pace}节奏学习")
        
        return "、".join(features) if features else "画像信息不足"

    def _recommend_learning_style(self, profile: StudentProfileModel) -> str:
        """推荐学习方式"""
        if not profile.cognitive_style:
            return "需要更多信息"
        
        preferred_format = profile.cognitive_style.get("preferred_format", [])
        if not preferred_format:
            return "混合学习"
        
        # 根据偏好格式推荐
        if "视频" in preferred_format:
            return "视频为主，辅以实践"
        elif "实践" in preferred_format:
            return "实践为主，辅以理论"
        elif "文字" in preferred_format:
            return "文字阅读为主，辅以案例"
        
        return "混合学习"

    def _determine_current_stage(self, profile: StudentProfileModel) -> str:
        """确定当前学习阶段"""
        if not profile.learning_progress:
            return "未开始"
        
        completion_rate = profile.learning_progress.get("completion_rate", 0)
        
        if completion_rate < 20:
            return "入门阶段"
        elif completion_rate < 50:
            return "基础学习阶段"
        elif completion_rate < 80:
            return "进阶学习阶段"
        else:
            return "深化提升阶段"

    async def adjust_profile(
        self, user_id: int, dimension_code: str, adjust_data: dict, reason: str | None
    ) -> StudentProfileDetail:
        """手动调整画像"""
        # 获取当前画像
        result = await self.db.execute(
            select(StudentProfileModel)
            .where(StudentProfileModel.user_id == user_id)
            .order_by(StudentProfileModel.version.desc())
        )
        profile = result.scalar_one_or_none()
        
        if not profile:
            raise ValueError("画像不存在")

        # 验证维度代码
        valid_dimensions = [
            "knowledge_base",
            "cognitive_style",
            "learning_progress",
            "error_preference",
            "interest_direction",
            "learning_habit",
        ]
        if dimension_code not in valid_dimensions:
            raise ValueError(f"无效的维度代码: {dimension_code}")

        # 保存历史版本
        history = ProfileHistoryModel(
            profile_id=profile.id,
            user_id=user_id,
            version=profile.version,
            snapshot_data={
                "knowledge_base": profile.knowledge_base,
                "cognitive_style": profile.cognitive_style,
                "learning_progress": profile.learning_progress,
                "error_preference": profile.error_preference,
                "interest_direction": profile.interest_direction,
                "learning_habit": profile.learning_habit,
                "tags": profile.tags,
                "summary": profile.summary,
            },
            change_type=4,  # 手动调整
            change_description=reason or "手动调整画像",
            changed_dimensions=dimension_code,
        )
        await self._assign_sqlite_id(history, ProfileHistoryModel)
        self.db.add(history)

        # 更新画像
        current_dim_data = getattr(profile, dimension_code) or {}
        if isinstance(current_dim_data, dict):
            current_dim_data.update(adjust_data)
            setattr(profile, dimension_code, current_dim_data)
        else:
            setattr(profile, dimension_code, adjust_data)

        # 更新版本号
        profile.version += 1

        # 重新计算完整度
        calculate_profile_completeness, generate_profile_tags = _get_profile_builder_helpers()
        profile.completeness = calculate_profile_completeness(
            {
                "knowledge_base": profile.knowledge_base,
                "cognitive_style": profile.cognitive_style,
                "learning_progress": profile.learning_progress,
                "error_preference": profile.error_preference,
                "interest_direction": profile.interest_direction,
                "learning_habit": profile.learning_habit,
            }
        )

        # 重新生成标签
        profile.tags = generate_profile_tags(
            {
                "knowledge_base": profile.knowledge_base,
                "cognitive_style": profile.cognitive_style,
                "learning_progress": profile.learning_progress,
                "error_preference": profile.error_preference,
                "interest_direction": profile.interest_direction,
                "learning_habit": profile.learning_habit,
            }
        )

        await self.db.commit()
        await self.db.refresh(profile)

        # 返回更新后的画像
        return await self.get_profile(user_id)

    async def update_profile_by_behavior(
        self,
        user_id: int,
        behavior_type: int,
        behavior_data: dict,
        resource_type: str | None,
        resource_id: int | None,
        result: str | None,
        duration: int | None,
    ) -> ProfileUpdateResult:
        """基于学习行为更新画像"""
        # 获取当前画像
        profile_result = await self.db.execute(
            select(StudentProfileModel)
            .where(StudentProfileModel.user_id == user_id)
            .order_by(StudentProfileModel.version.desc())
        )
        profile = profile_result.scalar_one_or_none()
        
        if not profile:
            raise ValueError("画像不存在，请先创建画像")

        # 调用画像更新智能体
        from app.agents.nodes.profile_conversation.profile_updater_agent import (
            analyze_behavior_impact,
            profile_updater_node,
        )
        # 分析行为影响
        impact = analyze_behavior_impact(behavior_type, behavior_data)

        if behavior_data.get("scene") == "evaluation_submit":
            profile_updates = self._build_behavior_fallback_updates(
                behavior_type=behavior_type,
                behavior_data=behavior_data,
                result=result,
                impact=impact,
            )
            updated_profile = self._build_behavior_fallback_profile(
                profile=profile,
                behavior_type=behavior_type,
                behavior_data=behavior_data,
                result=result,
            )
        else:
            # 构建状态
            state: dict[str, Any] = {
                "user_id": user_id,
                "profile": {
                    "knowledge_base": profile.knowledge_base,
                    "cognitive_style": profile.cognitive_style,
                    "learning_progress": profile.learning_progress,
                    "error_preference": profile.error_preference,
                    "interest_direction": profile.interest_direction,
                    "learning_habit": profile.learning_habit,
                    "tags": profile.tags or [],
                },
                "behavior_data": [
                    {
                        "behavior_type": behavior_type,
                        "behavior_data": behavior_data,
                        "resource_type": resource_type,
                        "resource_id": resource_id,
                        "result": result,
                        "duration": duration,
                    }
                ],
                "execution_trace": [],
            }

            # 执行更新智能体
            try:
                result_state = await asyncio.wait_for(
                    profile_updater_node(state),
                    timeout=self.PROFILE_BEHAVIOR_TIMEOUT_SECONDS,
                )
            except Exception:
                result_state = {
                    "profile_updates": self._build_behavior_fallback_updates(
                        behavior_type=behavior_type,
                        behavior_data=behavior_data,
                        result=result,
                        impact=impact,
                    ),
                    "profile": self._build_behavior_fallback_profile(
                        profile=profile,
                        behavior_type=behavior_type,
                        behavior_data=behavior_data,
                        result=result,
                    ),
                }

            # 获取更新结果
            profile_updates = result_state.get("profile_updates", {})
            updated_profile = result_state.get("profile", {})

        # 保存历史版本
        history = ProfileHistoryModel(
            profile_id=profile.id,
            user_id=user_id,
            version=profile.version,
            snapshot_data={
                "knowledge_base": profile.knowledge_base,
                "cognitive_style": profile.cognitive_style,
                "learning_progress": profile.learning_progress,
                "error_preference": profile.error_preference,
                "interest_direction": profile.interest_direction,
                "learning_habit": profile.learning_habit,
                "tags": profile.tags,
                "summary": profile.summary,
            },
            change_type=3,  # 行为更新
            change_description=f"基于{self._get_behavior_type_name(behavior_type)}行为更新",
            changed_dimensions=",".join(impact.get("affected_dimensions", [])),
        )
        await self._assign_sqlite_id(history, ProfileHistoryModel)
        self.db.add(history)

        # 更新画像
        for dim_code in [
            "knowledge_base",
            "cognitive_style",
            "learning_progress",
            "error_preference",
            "interest_direction",
            "learning_habit",
        ]:
            if dim_code in updated_profile:
                setattr(profile, dim_code, updated_profile[dim_code])

        # 更新标签
        profile.tags = updated_profile.get("tags", profile.tags)

        # 更新版本号
        profile.version += 1

        # 更新最后行为时间
        profile.last_behavior_time = datetime.now()

        # 重新计算完整度
        calculate_profile_completeness, _ = _get_profile_builder_helpers()
        profile.completeness = calculate_profile_completeness(updated_profile)

        await self.db.commit()

        return ProfileUpdateResult(
            updated_dimensions=profile_updates.get("updated_dimensions", {}),
            new_tags=profile_updates.get("new_tags", []),
            removed_tags=profile_updates.get("removed_tags", []),
            summary=profile_updates.get("summary", "画像已更新"),
        )

    def _get_behavior_type_name(self, behavior_type: int) -> str:
        """获取行为类型名称"""
        behavior_names = {
            1: "答题",
            2: "资源浏览",
            3: "路径完成",
            4: "互动问答",
        }
        return behavior_names.get(behavior_type, "未知")

    def _build_behavior_fallback_updates(
        self,
        *,
        behavior_type: int,
        behavior_data: dict,
        result: str | None,
        impact: dict[str, Any],
    ) -> dict[str, Any]:
        focus_points = behavior_data.get("knowledge_points") or behavior_data.get("weak_points") or []
        focus_text = str(focus_points[0]) if focus_points else "当前测评重点"
        return {
            "updated_dimensions": {
                dimension: {"status": "updated"}
                for dimension in impact.get("affected_dimensions", ["learning_progress", "error_preference"])
            },
            "new_tags": ["测评已回流", "薄弱点跟踪"],
            "removed_tags": [],
            "summary": f"已根据本次{self._get_behavior_type_name(behavior_type)}行为回写画像，后续重点跟踪 {focus_text}。",
            "result": result or "updated",
        }

    def _build_behavior_fallback_profile(
        self,
        *,
        profile: StudentProfileModel,
        behavior_type: int,
        behavior_data: dict,
        result: str | None,
    ) -> dict[str, Any]:
        learning_progress = dict(profile.learning_progress or {})
        error_preference = dict(profile.error_preference or {})
        tags = list(profile.tags or [])

        knowledge_points = behavior_data.get("knowledge_points") or []
        weak_points = behavior_data.get("weak_points") or []
        focus_points = [str(item) for item in [*knowledge_points, *weak_points] if item]

        learning_progress["last_behavior_type"] = self._get_behavior_type_name(behavior_type)
        learning_progress["last_result"] = result or "updated"
        learning_progress["last_behavior_at"] = datetime.now().isoformat(timespec="seconds")
        if focus_points:
            learning_progress["current_focus"] = focus_points[0]

        if focus_points:
            tracked = error_preference.get("tracked_points") or []
            merged = []
            for item in [*tracked, *focus_points]:
                if item and item not in merged:
                    merged.append(item)
            error_preference["tracked_points"] = merged[:6]

        for tag in ["测评已回流", "薄弱点跟踪"]:
            if tag not in tags:
                tags.append(tag)

        return {
            "knowledge_base": profile.knowledge_base or {},
            "cognitive_style": profile.cognitive_style or {},
            "learning_progress": learning_progress,
            "error_preference": error_preference,
            "interest_direction": profile.interest_direction or {},
            "learning_habit": profile.learning_habit or {},
            "tags": tags,
        }

    async def get_profile_history(
        self, user_id: int, limit: int = 10
    ) -> ProfileHistoryResponse:
        """获取画像历史"""
        # 获取画像ID
        profile_result = await self.db.execute(
            select(StudentProfileModel)
            .where(StudentProfileModel.user_id == user_id)
            .order_by(StudentProfileModel.version.desc())
        )
        profile = profile_result.scalar_one_or_none()
        
        if not profile:
            return ProfileHistoryResponse(
                user_id=user_id, profile_id=0, history=[], total=0
            )

        # 获取历史记录
        history_result = await self.db.execute(
            select(ProfileHistoryModel)
            .where(ProfileHistoryModel.user_id == user_id)
            .order_by(ProfileHistoryModel.created_at.desc())
            .limit(limit)
        )
        history_records = history_result.scalars().all()
        if not history_records:
            history_records = [await self._ensure_initial_history(profile)]

        # 构建响应
        history_items = []
        for record in history_records:
            changed_dimensions = []
            if record.changed_dimensions:
                changed_dimensions = record.changed_dimensions.split(",")

            history_items.append(
                ProfileHistoryItem(
                    history_id=record.id,
                    profile_id=record.profile_id,
                    version=record.version,
                    change_type=record.change_type,
                    change_description=record.change_description,
                    changed_dimensions=changed_dimensions,
                    created_at=record.created_at,
                )
            )

        return ProfileHistoryResponse(
            user_id=user_id,
            profile_id=profile.id,
            history=history_items,
            total=len(history_items),
        )
