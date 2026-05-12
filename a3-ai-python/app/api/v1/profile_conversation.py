"""
对话式画像构建API路由
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.schemas.profile_conversation import (
    BehaviorDataRequest,
    ConversationCompleteRequest,
    ConversationFlowResponse,
    ConversationMessageRequest,
    ConversationMessageResponse,
    ConversationSessionResponse,
    ConversationStartRequest,
    ExtractionResult,
    GuideQuestionResponse,
    ProfileAdjustRequest,
    ProfileHistoryResponse,
    ProfileSummary,
    ProfileUpdateResult,
    StudentProfileDetail,
)
from app.services.profile_conversation_service import ProfileConversationService

router = APIRouter(prefix="/profile/conversation", tags=["对话式画像构建"])


@router.post("/start", response_model=ConversationSessionResponse, summary="开始对话会话")
async def start_conversation(
    request: ConversationStartRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    开始一个新的对话会话
    
    - **user_id**: 用户ID
    - **session_type**: 会话类型（1-初始构建，2-补充，3-验证）
    """
    service = ProfileConversationService(db)
    session = await service.start_conversation(
        user_id=request.user_id, session_type=request.session_type
    )
    return session


@router.post("/message", response_model=ConversationFlowResponse, summary="发送对话消息")
async def send_message(
    request: ConversationMessageRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    发送对话消息并获取助手回复
    
    - **session_id**: 会话ID
    - **content**: 消息内容
    
    返回：
    - 助手回复消息
    - 引导问题（如果需要继续对话）
    - 信息提取结果
    - 画像摘要（如果完整度足够）
    """
    service = ProfileConversationService(db)
    
    try:
        response = await service.process_message(
            session_id=request.session_id, user_message=request.content
        )
        return response
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"处理消息失败: {str(e)}",
        )


@router.post("/complete", response_model=StudentProfileDetail, summary="完成对话会话")
async def complete_conversation(
    request: ConversationCompleteRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    完成对话会话并生成最终画像
    
    - **session_id**: 会话ID
    - **force_complete**: 是否强制完成（即使信息不完整）
    """
    service = ProfileConversationService(db)
    
    try:
        profile = await service.complete_conversation(
            session_id=request.session_id, force_complete=request.force_complete
        )
        return profile
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"完成会话失败: {str(e)}",
        )


@router.get("/session/{session_id}", response_model=ConversationSessionResponse, summary="获取会话详情")
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """
    获取对话会话详情
    
    - **session_id**: 会话ID
    """
    service = ProfileConversationService(db)
    
    try:
        session = await service.get_session(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在"
            )
        return session
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取会话失败: {str(e)}",
        )


@router.get("/profile/{user_id}", response_model=StudentProfileDetail, summary="获取学生画像")
async def get_profile(
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """
    获取学生的学习画像详情
    
    - **user_id**: 用户ID
    """
    service = ProfileConversationService(db)
    
    try:
        profile = await service.get_profile(user_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="画像不存在"
            )
        return profile
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取画像失败: {str(e)}",
        )


@router.get("/profile/{user_id}/summary", response_model=ProfileSummary, summary="获取画像摘要")
async def get_profile_summary(
    user_id: int,
    db: AsyncSession = Depends(get_db_session),
):
    """
    获取学生画像摘要
    
    - **user_id**: 用户ID
    """
    service = ProfileConversationService(db)
    
    try:
        summary = await service.get_profile_summary(user_id)
        if not summary:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="画像不存在"
            )
        return summary
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取画像摘要失败: {str(e)}",
        )


@router.put("/profile/{user_id}/adjust", response_model=StudentProfileDetail, summary="手动调整画像")
async def adjust_profile(
    user_id: int,
    request: ProfileAdjustRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    手动调整学生画像
    
    - **user_id**: 用户ID
    - **dimension_code**: 维度代码
    - **adjust_data**: 调整的数据
    - **reason**: 调整原因
    """
    if user_id != request.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="用户ID不匹配"
        )
    
    service = ProfileConversationService(db)
    
    try:
        profile = await service.adjust_profile(
            user_id=user_id,
            dimension_code=request.dimension_code,
            adjust_data=request.adjust_data,
            reason=request.reason,
        )
        return profile
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"调整画像失败: {str(e)}",
        )


@router.post("/behavior", response_model=ProfileUpdateResult, summary="上报学习行为")
async def report_behavior(
    request: BehaviorDataRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    上报学习行为数据，触发画像更新
    
    - **user_id**: 用户ID
    - **behavior_type**: 行为类型（1-答题，2-资源浏览，3-路径完成，4-互动问答）
    - **behavior_data**: 行为详细数据
    - **resource_type**: 资源类型
    - **resource_id**: 资源ID
    - **result**: 行为结果
    - **duration**: 行为时长（秒）
    """
    service = ProfileConversationService(db)
    
    try:
        update_result = await service.update_profile_by_behavior(
            user_id=request.user_id,
            behavior_type=request.behavior_type,
            behavior_data=request.behavior_data,
            resource_type=request.resource_type,
            resource_id=request.resource_id,
            result=request.result,
            duration=request.duration,
        )
        return update_result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"上报行为失败: {str(e)}",
        )


@router.get("/profile/{user_id}/history", response_model=ProfileHistoryResponse, summary="获取画像历史")
async def get_profile_history(
    user_id: int,
    limit: int = 10,
    db: AsyncSession = Depends(get_db_session),
):
    """
    获取学生画像的历史变更记录
    
    - **user_id**: 用户ID
    - **limit**: 返回记录数量限制
    """
    service = ProfileConversationService(db)
    
    try:
        history = await service.get_profile_history(user_id, limit=limit)
        return history
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取历史记录失败: {str(e)}",
        )
