"""
瀵硅瘽寮忕敾鍍忔瀯寤烘湇鍔″眰

璐熻矗鍗忚皟鏅鸿兘浣撱€佹暟鎹簱鎿嶄綔鍜屼笟鍔￠€昏緫
"""

import asyncio
from datetime import datetime
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.nodes.profile_conversation.conversation_graph import (
    profile_conversation_graph,
)
from app.agents.nodes.profile_conversation.conversation_state import (
    ProfileConversationState,
)
from app.agents.nodes.profile_conversation.info_extractor_agent import (
    generate_guide_question,
    generate_guide_question_llm,
)
from app.agents.nodes.profile_conversation.profile_builder_agent import (
    calculate_profile_completeness,
    generate_profile_tags,
)
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


class ProfileConversationService:
    PROFILE_BEHAVIOR_TIMEOUT_SECONDS = 8

    """Profile conversation service"""

    PROFILE_DIMENSIONS = [
        "knowledge_base",
        "cognitive_style",
        "learning_progress",
        "error_preference",
        "interest_direction",
        "learning_habit",
    ]

    DEFAULT_PROFILE_SKELETON = {
        "knowledge_base": {
            "level": "鍏ラ棬",
            "background": "锟窖斤拷锟斤拷纬锟窖帮拷锟斤拷锟斤拷锟斤拷锟斤拷锟斤拷锟斤拷锟斤拷",
            "mastered_topics": [],
            "weak_areas": [],
            "source_flags": ["system_init"],
        },
        "cognitive_style": {
            "preferred_format": ["鏂囧瓧", "缁冧範"],
            "learning_preference": ["鍏堢湅缁撴瀯鍖栬瑙ｏ紝鍐嶉€氳繃缁冧範宸╁浐"],
            "thinking_style": "鍏堢悊瑙ｆ鏋讹紝鍐嶉€氳繃缁冧範宸╁浐",
            "comprehension_speed": "涓瓑",
            "source_flags": ["system_init"],
        },
        "learning_progress": {
            "current_stage": "鍏ラ棬闃舵",
            "completion_rate": 0,
            "learning_pace": "涓瓑",
            "weekly_hours": 2,
            "source_flags": ["system_init"],
        },
        "error_preference": {
            "common_errors": [],
            "confused_concepts": [],
            "attention_points": [],
            "tracked_points": [],
            "source_flags": ["system_init"],
        },
        "interest_direction": {
            "interested_areas": [],
            "learning_motivation": "鍏堝缓绔嬪熀纭€鐢诲儚锛屽啀閫愭琛ュ厖瀛︿範鍋忓ソ涓庤杽寮辩偣",
            "target_level": "瀹屾垚褰撳墠璇剧▼鍩虹闃舵",
            "source_flags": ["system_init"],
        },
        "learning_habit": {
            "best_time": "鏃堕棿鐏垫椿",
            "focus_duration": 30,
            "study_frequency": "姣忓懆2 灏忔椂",
            "study_pattern": "鍒嗘暎瀛︿範",
            "source_flags": ["system_init"],
        },
        "tags": ["待完善画像"],
        "summary": "已创建初始画像骨架，等待通过对话、测评和学习行为逐步完善。",
    }

    def __init__(self, db: AsyncSession):
        self.db = db

    async def start_conversation(
        self, user_id: int, session_type: int = 1
    ) -> ConversationSessionResponse:
        """
        寮€濮嬫柊鐨勫璇濅細
        
        Args:
            user_id: 鐢ㄦ埛ID
            session_type: 浼氳瘽绫诲瀷
            
        Returns:
            浼氳瘽鍝嶅簲
        """
        # 鍒涘缓鏂颁細
        session = ConversationSessionModel(
            user_id=user_id,
            session_type=session_type,
            status=0,  # 杩涜
            total_rounds=0,
            completeness=0,
            start_time=datetime.now(),
        )
        
        self.db.add(session)
        await self.db.commit()

        await self.db.refresh(session)

        # 锟斤拷锟斤拷系统锟斤拷迎锟斤拷息

        # 鍒涘缓绯荤粺娆㈣繋娑堟伅
        welcome_message = ConversationMessageModel(
            session_id=session.id,
            user_id=user_id,
            role="assistant",
            content="锟斤拷茫锟斤拷锟斤拷锟斤拷锟斤拷学习锟斤拷锟街★拷为锟剿革拷锟斤拷锟结供锟斤拷锟斤拷锟皆伙拷锟斤拷学习锟斤拷锟介，锟斤拷锟斤拷锟剿斤拷一锟斤拷锟斤拷锟窖帮拷锟斤拷锟斤拷锟斤拷锟斤拷锟角匡拷始锟缴ｏ拷",
            round_number=0,
            message_type=2,  # 寮曞闂
        )
        
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
        澶勭悊鐢ㄦ埛娑堟伅
        
        Args:
            session_id: 浼氳瘽ID
            user_message: 鐢ㄦ埛娑堟伅鍐呭
            
        Returns:
            瀵硅瘽娴佺▼鍝嶅簲
        """
        # 鑾峰彇浼氳瘽
        result = await self.db.execute(
            select(ConversationSessionModel).where(ConversationSessionModel.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise ValueError("锟结话锟斤拷锟斤拷锟斤拷")
        
        if session.status != 0:
            raise ValueError("锟结话锟窖斤拷锟斤拷")

        # 淇濆瓨鐢ㄦ埛娑堟伅
        user_msg = ConversationMessageModel(
            session_id=session_id,
            user_id=session.user_id,
            role="user",
            content=user_message,
            round_number=session.total_rounds + 1,
            message_type=1,  # 鏅€氬
        )
        
        self.db.add(user_msg)
        
        # 鏇存柊浼氳瘽杞
        session.total_rounds += 1
        await self.db.commit()

        # 鑾峰彇瀵硅瘽鍘嗗彶
        messages_result = await self.db.execute(
            select(ConversationMessageModel)
            .where(ConversationMessageModel.session_id == session_id)
            .order_by(ConversationMessageModel.round_number)
        )
        messages = messages_result.scalars().all()
        # 鐢诲儚鎻愬彇浠呬娇鐢ㄧ敤鎴风湡瀹炶〃杩帮紝閬垮厤娆㈣繋璇拰杩介棶姹℃煋缁村害鍒ゆ柇
        message_contents = [msg.content for msg in messages if msg.role == "user"]

        # 璋冪敤鏅鸿兘浣撹繘琛屼俊鎭彁
        state: ProfileConversationState = {
            "user_id": session.user_id,
            "session_id": session_id,
            "messages": message_contents,
            "current_round": session.total_rounds,
            "session_status": "in_progress",
            "session_type": session.session_type,
            "execution_trace": [],
        }

        # 鎵ц鏅鸿兘浣撳浘
        result_state = await profile_conversation_graph.ainvoke(state)

        # 鎻愬彇缁撴灉
        extracted_info = result_state.get("extracted_info", {})
        completeness_raw = extracted_info.get("completeness", 0)
        try:
            completeness_value = float(completeness_raw or 0)
        except (TypeError, ValueError):
            completeness_value = 0.0
        completeness = int(round(completeness_value * 100)) if 0 < completeness_value <= 1 else int(round(completeness_value))
        completeness = max(0, min(100, completeness))
        extracted_info["completeness"] = completeness
        missing_dimensions = extracted_info.get("missing_dimensions", [])

        # 鏇存柊浼氳瘽瀹屾暣
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

        # 鐢熸垚寮曞闂
        guide_question_text = await generate_guide_question_llm(
            message_contents,
            missing_dimensions,
            extracted_info,
        )
        
        # 鍒涘缓鍔╂墜鍥炲娑堟伅
        assistant_msg = ConversationMessageModel(
            session_id=session_id,
            user_id=session.user_id,
            role="assistant",
            content=guide_question_text,
            round_number=session.total_rounds,
            message_type=2 if missing_dimensions else 3,  # 寮曞闂鎴栫‘璁や俊
            related_dimension=missing_dimensions[0] if missing_dimensions else None,
        )
        
        self.db.add(assistant_msg)
        await self.db.commit()
        await self.db.refresh(assistant_msg)

        # 鏋勫缓鍝嶅簲
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
            profile_summary=None,  # 灏嗗湪瀹屾垚鏃剁敓
            should_continue=should_continue,
            completeness=completeness,
        )

        return response

    async def complete_conversation(
        self, session_id: int, force_complete: bool = False
    ) -> StudentProfileDetail:
        """
        瀹屾垚瀵硅瘽浼氳瘽骞剁敓鎴愮敾
        
        Args:
            session_id: 浼氳瘽ID
            force_complete: 鏄惁寮哄埗瀹屾垚
            
        Returns:
            瀛︾敓鐢诲儚璇︽儏
        """
        # 鑾峰彇浼氳瘽
        result = await self.db.execute(
            select(ConversationSessionModel).where(ConversationSessionModel.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise ValueError("锟结话锟斤拷锟斤拷锟斤拷")

        if not force_complete and session.completeness < 60:
            raise ValueError("锟斤拷锟斤拷锟斤拷息锟斤拷锟姐，锟睫凤拷锟斤拷桑锟斤拷锟斤拷锟斤拷锟斤拷锟斤到60%锟斤拷锟较ｏ拷")

        # 鑾峰彇瀵硅瘽鍘嗗彶
        messages_result = await self.db.execute(
            select(ConversationMessageModel)
            .where(ConversationMessageModel.session_id == session_id)
            .order_by(ConversationMessageModel.round_number)
        )
        messages = messages_result.scalars().all()
        # 瀹屾垚鐢诲儚鏃跺悓鏍峰彧鍩轰簬鐢ㄦ埛娑堟伅鏋勫缓鏈€缁堢敾锟?        message_contents = [msg.content for msg in messages if msg.role == "user"]

        # 璋冪敤 LangGraph 缂栨帓鐨勭敾鍍忔瀯寤洪摼
        state: ProfileConversationState = {
            "user_id": session.user_id,
            "session_id": session_id,
            "messages": message_contents,
            "current_round": session.total_rounds,
            "session_status": "completed",
            "session_type": session.session_type,
            "execution_trace": [],
        }

        result_state = await profile_conversation_graph.ainvoke(state)

        built_profile = result_state.get("built_profile", {})
        for dim_code in self.PROFILE_DIMENSIONS:
            dim_data = built_profile.get(dim_code)
            if isinstance(dim_data, dict):
                source_flags = dim_data.get("source_flags")
                if not isinstance(source_flags, list):
                    source_flags = []
                if "conversation_profile" not in source_flags:
                    source_flags.append("conversation_profile")
                dim_data["source_flags"] = source_flags
                built_profile[dim_code] = dim_data

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
            self.db.add(profile_snapshot)

        session.status = 1
        session.end_time = datetime.now()

        await self.db.flush()
        if not existing_profile and profile_snapshot.id:
            self.db.add(
                ProfileHistoryModel(
                    profile_id=profile_snapshot.id,
                    user_id=session.user_id,
                    version=profile_snapshot.version,
                    snapshot_data=self._build_profile_snapshot_data(profile_snapshot),
                    change_type=1,
                    change_description="棣栨鐢熸垚鐢诲儚",
                    changed_dimensions=",".join(self.PROFILE_DIMENSIONS),
                )
            )
        session.profile_id = profile_snapshot.id
        await self.db.commit()
        await self.db.refresh(profile_snapshot)

        # 鏋勫缓鍝嶅簲
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

    def _extract_topic_labels(self, values: list[str]) -> list[str]:
        topic_map = {
            "python": "Python??",
            "????": "????",
            "??": "?????",
            "???": "?????",
            "??": "????",
            "??": "????",
            "??": "????",
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
            "??": "??",
            "???": "?????",
            "??": "????",
            "??": "????",
            "??": "????",
        }
        labels: list[str] = []
        for raw_value in values:
            for token, label in keyword_map.items():
                if token == "??" and "???" in raw_value:
                    continue
                if token in raw_value and label not in labels:
                    labels.append(label)
        return labels

    def _normalize_short_text(self, value: Any, limit: int = 28) -> str:
        text = str(value or "").strip()
        if not text:
            return ""
        text = re.sub(r"[锟斤拷锟斤拷锟斤拷锟斤拷.!?锟斤拷锟斤拷]+$", "", text)
        return text if len(text) <= limit else text[:limit].rstrip()

    def _detect_stage(self, text: str) -> str:
        if "鍏ラ棬" in text:
            return "鍏ラ棬闃舵"
        if "鍩虹" in text:
            return "鍩虹闃舵"
        if "杩涢樁" in text:
            return "杩涢樁闃舵"
        if "椤圭洰" in text:
            return "椤圭洰瀹炶返闃舵"
        return "鍩虹闃舵"

    def _detect_best_time(self, text: str) -> str:
        if "鏅氫笂" in text:
            return "鏅氫笂"
        if "鏃╀笂" in text:
            return "鏃╀笂"
        if "鍛ㄦ湯" in text:
            return "鍛ㄦ湯"
        return "鏃堕棿鐏垫椿"

    def _detect_motivation(self, text: str) -> str:
        if "鎵撶墷鍩虹" in text or "鍩虹鎵撶墷" in text or "鍩虹" in text:
            return "鍏堟墦鐗㈠熀纭€锛屽啀閫愭鎻愬崌"
        if "椤圭洰" in text:
            return "甯屾湜灏藉揩杩涘叆椤圭洰瀹炴垬"
        if "绛旇京" in text or "灞曠ず" in text:
            return "希锟斤拷锟斤拷锟斤拷锟斤拷锟斤拷锟斤拷展示效锟斤拷"

    def _detect_target_level(self, text: str) -> str:
        if "椤圭洰" in text:
            return "鑳界嫭绔嬪畬鎴愬熀纭€椤圭洰"
        if "鍩虹" in text:
            return "鍏堝畬鎴愬熀纭€闃舵宸╁浐"
        if "杩涢樁" in text:
            return "閫愭杩涘叆杩涢樁闃舵"
        return "甯屾湜鎸佺画鎻愬崌"

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
                joined_topics = "、".join(topics[:3])
                normalized["background"] = f"有一定基础，接触过{joined_topics}"
            if weak_areas:
                normalized["weak_areas"] = weak_areas[:3]

        elif dimension_code == "cognitive_style":
            preference_text = " ".join(
                str(item) for item in dim_data.get("learning_preference", []) if item
            ) if isinstance(dim_data.get("learning_preference"), list) else str(dim_data.get("learning_preference") or "")
            if len(preference_text) > 28:
                normalized["learning_preference"] = ["鍏堢湅缁撴瀯鍖栬瑙ｏ紝鍐嶉€氳繃缁冧範宸╁浐"]
            if isinstance(dim_data.get("thinking_style"), str) and len(dim_data.get("thinking_style", "")) > 28:
                normalized["thinking_style"] = "鍏堢悊瑙ｆ鏋讹紝鍐嶉€氳繃缁冧範宸╁浐"
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
            hour_match = re.search(r"(\d+)\s*(?:到|-|~)?\s*(\d+)?\s*小时", joined)
            if weekly_hours is None and hour_match:
                if hour_match.group(2):
                    weekly_hours = int((int(hour_match.group(1)) + int(hour_match.group(2))) / 2)
                else:
                    weekly_hours = int(hour_match.group(1))
            if len(study_frequency) > 20 and weekly_hours:
                normalized["study_frequency"] = f"姣忓懆{weekly_hours} 灏忔椂"
            if dim_data.get("study_pattern") == "鍒嗘暎":
                normalized["study_pattern"] = "鍒嗘暎瀛︿範"

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
            change_description="棣栨鐢熸垚鐢诲儚",
            changed_dimensions=",".join(self.PROFILE_DIMENSIONS),
        )
        self.db.add(history)
        await self.db.commit()
        await self.db.refresh(history)
        return history

    def _get_dimension_name(self, dimension_code: str) -> str:
        """鑾峰彇缁村害鍚嶇О"""
        dimension_names = {
            "knowledge_base": "鐭ヨ瘑鍩虹",
            "cognitive_style": "璁ょ煡椋庢牸",
            "learning_progress": "瀛︿範杩涘害",
            "error_preference": "易错点偏好",
            "interest_direction": "兴趣方向",
            "learning_habit": "学习习惯",
        }
        return dimension_names.get(dimension_code, dimension_code)

    def _clone_default_profile(self) -> dict[str, Any]:
        return {
            "knowledge_base": dict(self.DEFAULT_PROFILE_SKELETON["knowledge_base"]),
            "cognitive_style": dict(self.DEFAULT_PROFILE_SKELETON["cognitive_style"]),
            "learning_progress": dict(self.DEFAULT_PROFILE_SKELETON["learning_progress"]),
            "error_preference": dict(self.DEFAULT_PROFILE_SKELETON["error_preference"]),
            "interest_direction": dict(self.DEFAULT_PROFILE_SKELETON["interest_direction"]),
            "learning_habit": dict(self.DEFAULT_PROFILE_SKELETON["learning_habit"]),
            "tags": list(self.DEFAULT_PROFILE_SKELETON["tags"]),
            "summary": self.DEFAULT_PROFILE_SKELETON["summary"],
        }

    def _build_default_profile_model(self, user_id: int) -> StudentProfileModel:
        skeleton = self._clone_default_profile()
        return StudentProfileModel(
            user_id=user_id,
            version=1,
            knowledge_base=skeleton["knowledge_base"],
            cognitive_style=skeleton["cognitive_style"],
            learning_progress=skeleton["learning_progress"],
            error_preference=skeleton["error_preference"],
            interest_direction=skeleton["interest_direction"],
            learning_habit=skeleton["learning_habit"],
            tags=skeleton["tags"],
            summary=skeleton["summary"],
            completeness=calculate_profile_completeness(skeleton),
        )

    def _extract_dimension_sources(self, dim_data: dict[str, Any] | None) -> list[str]:
        if not isinstance(dim_data, dict):
            return []
        source_flags = dim_data.get("source_flags")
        if not isinstance(source_flags, list):
            return []
        deduped: list[str] = []
        for item in source_flags:
            value = str(item or "").strip()
            if value and value not in deduped:
                deduped.append(value)
        return deduped

    def _build_dimension_sources_map(self, profile: StudentProfileModel) -> dict[str, list[str]]:
        return {
            dim_code: self._extract_dimension_sources(getattr(profile, dim_code, None))
            for dim_code in self.PROFILE_DIMENSIONS
        }

    def _build_score_breakdown(self, profile: StudentProfileModel) -> dict[str, int]:
        knowledge = self._calculate_dimension_completeness(profile.knowledge_base)
        cognitive = self._calculate_dimension_completeness(profile.cognitive_style)
        progress = self._calculate_dimension_completeness(profile.learning_progress)
        errors = self._calculate_dimension_completeness(profile.error_preference)
        interest = self._calculate_dimension_completeness(profile.interest_direction)
        habit = self._calculate_dimension_completeness(profile.learning_habit)
        learning_completion = int((profile.learning_progress or {}).get("completion_rate", 0) or 0)

        return {
            "规划能力": min(95, max(30, round((progress * 0.55) + (habit * 0.25) + (interest * 0.20)))), 
            "执行效率": min(95, max(30, round((learning_completion * 0.6) + (habit * 0.4)))), 
            "学习持续力": min(98, max(35, round((habit * 0.55) + (progress * 0.45)))), 
            "认知广度": min(96, max(30, round((knowledge * 0.55) + (cognitive * 0.45)))), 
            "成果输出": min(95, max(30, round((errors * 0.35) + (progress * 0.35) + (knowledge * 0.30)))), 
        }

    def _build_latest_evaluation_diff(self, profile: StudentProfileModel) -> dict[str, dict[str, Any]]:
        learning_progress = profile.learning_progress or {}
        error_preference = profile.error_preference or {}
        last_score = learning_progress.get("last_evaluation_score")
        previous_score = learning_progress.get("previous_evaluation_score")
        current_focus = learning_progress.get("current_focus")
        tracked_points = error_preference.get("tracked_points") or []

        diff: dict[str, dict[str, Any]] = {}
        if last_score is not None:
            score_delta = None
            if previous_score is not None:
                try:
                    score_delta = round(float(last_score) - float(previous_score), 1)
                except Exception:
                    score_delta = None
            diff["evaluation_score"] = {
                "before": previous_score,
                "after": last_score,
                "delta": score_delta,
                "label": "??????",
            }
        if current_focus:
            diff["focus_shift"] = {
                "before": None,
                "after": current_focus,
                "delta": None,
                "label": "??????",
            }
        if tracked_points:
            diff["tracked_points"] = {
                "before": [],
                "after": tracked_points[:4],
                "delta": len(tracked_points[:4]),
                "label": "??????",
            }
        return diff

    def _build_profile_summary_dict(self, profile: StudentProfileModel | None) -> dict[str, Any]:
        if profile is None:
            return {}
        return {
            "completeness": profile.completeness,
            "tags": list(profile.tags or []),
            "current_stage": self._determine_current_stage(profile),
            "recommended_learning_style": self._recommend_learning_style(profile),
            "score_breakdown": self._build_score_breakdown(profile),
        }

    def _append_behavior_sources(self, profile: StudentProfileModel, behavior_type: int) -> None:
        source_name = {
            1: "evaluation_feedback",
            2: "resource_behavior",
            3: "path_progress",
            4: "interactive_qa",
        }.get(behavior_type, "behavior_feedback")
        for dim_code in self.PROFILE_DIMENSIONS:
            dim_data = getattr(profile, dim_code, None)
            if not isinstance(dim_data, dict):
                continue
            source_flags = dim_data.get("source_flags")
            if not isinstance(source_flags, list):
                source_flags = []
            if source_name not in source_flags:
                source_flags.append(source_name)
            dim_data["source_flags"] = source_flags
            setattr(profile, dim_code, dim_data)

    async def get_session(self, session_id: int) -> ConversationSessionResponse | None:
        """鑾峰彇浼氳瘽璇︽儏"""
        result = await self.db.execute(
            select(ConversationSessionModel).where(ConversationSessionModel.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            return None

        # 鑾峰彇浼氳瘽鐨勬墍鏈夋秷
        messages_result = await self.db.execute(
            select(ConversationMessageModel)
            .where(ConversationMessageModel.session_id == session_id)
            .order_by(ConversationMessageModel.round_number)
        )
        messages = messages_result.scalars().all()

        # 瑙ｆ瀽宸查噰闆嗙殑缁村害
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
        """鑾峰彇瀛︾敓鐢诲儚"""
        result = await self.db.execute(
            select(StudentProfileModel)
            .where(StudentProfileModel.user_id == user_id)
            .order_by(StudentProfileModel.version.desc())
        )
        profile = result.scalar_one_or_none()

        if not profile:
            profile = self._build_default_profile_model(user_id)
            self.db.add(profile)
            await self.db.commit()
            await self.db.refresh(profile)

        # 鏋勫缓缁村害鏁版嵁
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
                        sources=self._extract_dimension_sources(getattr(profile, dim_code, None)),
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
            score_breakdown=self._build_score_breakdown(profile),
            latest_evaluation_diff=self._build_latest_evaluation_diff(profile),
        )

    def _calculate_dimension_completeness(self, dim_data: dict | None) -> int:
        """璁＄畻鍗曚釜缁村害鐨勫畬鏁村害"""
        if not dim_data or not isinstance(dim_data, dict):
            return 0
        
        # 检查字典中有多少非空值
        filled_fields = sum(
            1 for v in dim_data.values() if v is not None and v != "" and v != []
        )
        
        if total_fields == 0:
            return 0
        
        return int((filled_fields / total_fields) * 100)

    async def get_profile_summary(self, user_id: int) -> ProfileSummary | None:
        """鑾峰彇鐢诲儚鎽樿"""
        result = await self.db.execute(
            select(StudentProfileModel)
            .where(StudentProfileModel.user_id == user_id)
            .order_by(StudentProfileModel.version.desc())
        )
        profile = result.scalar_one_or_none()

        if not profile:
            profile = self._build_default_profile_model(user_id)
            self.db.add(profile)
            await self.db.commit()
            await self.db.refresh(profile)

        # 璁＄畻鍚勭淮搴﹀畬鏁村害
        dimension_completeness = {}
        dimension_sources = {}
        dimension_sources = {}
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
            dimension_sources[dim_code] = self._extract_dimension_sources(dim_data)

        # 鐢熸垚鍏抽敭鐗瑰緛鎻忚堪
        key_features = self._generate_key_features(profile)

        # 鎺ㄨ崘瀛︿範鏂瑰紡
        recommended_style = self._recommend_learning_style(profile)

        # 褰撳墠瀛︿範闃舵
        current_stage = self._determine_current_stage(profile)

        return ProfileSummary(
            profile_id=profile.id,
            user_id=profile.user_id,
            completeness=profile.completeness,
            tags=profile.tags or [],
            key_features=key_features,
            dimension_completeness=dimension_completeness,
            dimension_sources=dimension_sources,
            recommended_learning_style=recommended_style,
            current_stage=current_stage,
            score_breakdown=self._build_score_breakdown(profile),
            latest_evaluation_diff=self._build_latest_evaluation_diff(profile),
        )

    def _generate_key_features(self, profile: StudentProfileModel) -> str:
        """????????"""
        features = []

        if profile.knowledge_base:
            level = profile.knowledge_base.get("level")
            if level:
                features.append(f"{level}???")

        if profile.cognitive_style:
            preferred_format = profile.cognitive_style.get("preferred_format", [])
            if preferred_format:
                features.append(f"??{'/'.join(preferred_format[:2])}??")

        if profile.learning_progress:
            pace = profile.learning_progress.get("learning_pace")
            if pace:
                features.append(f"{pace}????")

        return "?".join(features) if features else "??????"

    def _recommend_learning_style(self, profile: StudentProfileModel) -> str:
        """??????"""
        if not profile.cognitive_style:
            return "??????"

        preferred_format = profile.cognitive_style.get("preferred_format", [])
        if not preferred_format:
            return "????"

        if "??" in preferred_format:
            return "?????????"
        if "??" in preferred_format:
            return "?????????"
        if "??" in preferred_format:
            return "???????????"

        return "????"

    def _determine_current_stage(self, profile: StudentProfileModel) -> str:
        """????????"""
        if not profile.learning_progress:
            return "???"

        completion_rate = profile.learning_progress.get("completion_rate", 0)
        if completion_rate < 20:
            return "????"
        if completion_rate < 50:
            return "??????"
        if completion_rate < 80:
            return "??????"
        return "??????"

    async def adjust_profile(
        self, user_id: int, dimension_code: str, adjust_data: dict, reason: str | None
    ) -> StudentProfileDetail:
        """鎵嬪姩璋冩暣鐢诲儚"""
        # 鑾峰彇褰撳墠鐢诲儚
        result = await self.db.execute(
            select(StudentProfileModel)
            .where(StudentProfileModel.user_id == user_id)
            .order_by(StudentProfileModel.version.desc())
        )
        profile = result.scalar_one_or_none()
        
        if not profile:
            raise ValueError("画像不存在")

        valid_dimensions = [
            "knowledge_base",
            "cognitive_style",
            "learning_progress",
            "error_preference",
            "interest_direction",
            "learning_habit",
        ]
        if dimension_code not in valid_dimensions:
            raise ValueError(f"鏃犳晥鐨勭淮搴︿唬 {dimension_code}")

        # 淇濆瓨鍘嗗彶鐗堟湰
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
            change_type=4,  # 鎵嬪姩璋冩暣
            change_description=reason or "鎵嬪姩璋冩暣鐢诲儚",
            changed_dimensions=dimension_code,
        )
        self.db.add(history)

        # 鏇存柊鐢诲儚
        current_dim_data = getattr(profile, dimension_code) or {}
        if isinstance(current_dim_data, dict):
            current_dim_data.update(adjust_data)
            setattr(profile, dimension_code, current_dim_data)
        else:
            setattr(profile, dimension_code, adjust_data)

        # 鏇存柊鐗堟湰
        profile.version += 1

        # 閲嶆柊璁＄畻瀹屾暣
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

        # 閲嶆柊鐢熸垚鏍囩
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

        # 杩斿洖鏇存柊鍚庣殑鐢诲儚
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
        """鍩轰簬瀛︿範琛屼负鏇存柊鐢诲儚"""
        # 鑾峰彇褰撳墠鐢诲儚
        profile_result = await self.db.execute(
            select(StudentProfileModel)
            .where(StudentProfileModel.user_id == user_id)
            .order_by(StudentProfileModel.version.desc())
        )
        profile = profile_result.scalar_one_or_none()
        if not profile:
            profile = self._build_default_profile_model(user_id)
            self.db.add(profile)
            await self.db.commit()
            await self.db.refresh(profile)
        before_summary = self._build_profile_summary_dict(profile)
        
        if not profile:
            raise ValueError("鐢诲儚涓嶅瓨鍦紝璇峰厛鍒涘缓鐢诲儚")

        # 璋冪敤鐢诲儚鏇存柊鏅鸿兘
        from app.agents.nodes.profile_conversation.profile_updater_agent import (
            analyze_behavior_impact,
            profile_updater_node,
        )
        from app.agents.nodes.profile_conversation.conversation_state import (
            ProfileConversationState,
        )

        # 鍒嗘瀽琛屼负褰卞搷
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
            state: ProfileConversationState = {
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

            # 鎵ц鏇存柊鏅鸿兘
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

            # 鑾峰彇鏇存柊缁撴灉
            profile_updates = result_state.get("profile_updates", {})
            updated_profile = result_state.get("profile", {})

        # 淇濆瓨鍘嗗彶鐗堟湰
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
            change_type=3,  # 琛屼负鏇存柊
            change_description=f"鍩轰簬{self._get_behavior_type_name(behavior_type)}琛屼负鏇存柊",
            changed_dimensions=",".join(impact.get("affected_dimensions", [])),
        )
        self.db.add(history)

        # 鏇存柊鐢诲儚
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

        self._append_behavior_sources(profile, behavior_type)

        # 鏇存柊鏍囩
        profile.tags = updated_profile.get("tags", profile.tags)

        # 鏇存柊鐗堟湰
        profile.version += 1

        # 鏇存柊鏈€鍚庤涓烘椂
        profile.last_behavior_time = datetime.now()

        # 閲嶆柊璁＄畻瀹屾暣
        profile.completeness = calculate_profile_completeness(updated_profile)

        await self.db.commit()

        after_summary = self._build_profile_summary_dict(profile)
        latest_evaluation_diff = self._build_latest_evaluation_diff(profile)
        return ProfileUpdateResult(
            updated_dimensions=profile_updates.get("updated_dimensions", {}),
            new_tags=profile_updates.get("new_tags", []),
            removed_tags=profile_updates.get("removed_tags", []),
            before_summary=before_summary,
            after_summary=after_summary,
            latest_evaluation_diff=latest_evaluation_diff,
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
        focus_text = str(focus_points[0]) if focus_points else "??????"
        return {
            "updated_dimensions": {
                dimension: {"status": "updated"}
                for dimension in impact.get("affected_dimensions", ["learning_progress", "error_preference"])
            },
            "new_tags": ["?????", "?????"],
            "removed_tags": [],
            "summary": f"?????{self._get_behavior_type_name(behavior_type)}????????????? {focus_text}?",
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
        if "overall_score" in behavior_data:
            learning_progress["previous_evaluation_score"] = learning_progress.get("last_evaluation_score")
            learning_progress["last_evaluation_score"] = behavior_data.get("overall_score")
        if focus_points:
            learning_progress["current_focus"] = focus_points[0]
        learning_progress["source_flags"] = list({
            *(learning_progress.get("source_flags") or []),
            "evaluation_feedback" if behavior_type == 1 else "behavior_feedback",
        })

        if focus_points:
            tracked = error_preference.get("tracked_points") or []
            merged = []
            for item in [*tracked, *focus_points]:
                if item and item not in merged:
                    merged.append(item)
            error_preference["tracked_points"] = merged[:6]
        error_preference["source_flags"] = list({
            *(error_preference.get("source_flags") or []),
            "evaluation_feedback" if behavior_type == 1 else "behavior_feedback",
        })

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
        """鑾峰彇鐢诲儚鍘嗗彶"""
        # 鑾峰彇鐢诲儚ID
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

        # 鑾峰彇鍘嗗彶璁板綍
        history_result = await self.db.execute(
            select(ProfileHistoryModel)
            .where(ProfileHistoryModel.user_id == user_id)
            .order_by(ProfileHistoryModel.created_at.desc())
            .limit(limit)
        )
        history_records = history_result.scalars().all()
        if not history_records:
            history_records = [await self._ensure_initial_history(profile)]

        # 鏋勫缓鍝嶅簲
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

