import json
from typing import List, Optional

from fastapi import APIRouter, Body, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.api.deps import get_websocket_user_id
from app.schemas.common import ResourceCard
from app.schemas.resource import (
    JavaRunRequest,
    JavaRunResponse,
    JavaReviewRequest,
    JavaReviewResponse,
    ResourceArchiveRequest,
    ResourceArchiveResponse,
    ResourceArchiveSummaryResponse,
    ResourceDownloadAccessResponse,
    ResourceDownloadResponse,
    ResourceFavoriteCreate,
    ResourceFavoriteHistoryListResponse,
    ResourceFavoriteListResponse,
    ResourceFavoriteRecordResponse,
    ResourceFavoriteRequest,
    ResourceFavoriteResponse,
    ResourceFavoriteSummaryResponse,
    ResourceFavoriteUpdate,
    ResourceGenerationRequest,
    ResourceGenerationResponse,
    ResourceGenerationTaskCreate,
    ResourceGenerationTaskResponse,
    ResourceListResponse,
    ResourceListResponseV2,
    ResourcePreviewResponse,
    ResourceQueryParams,
    VideoInsightRequest,
    VideoInsightAskRequest,
    VideoInsightAskResponse,
    VideoInsightResponse,
)
from app.services.java_review_service import JavaReviewService
from app.services.java_runner_service import JavaRunnerService
from app.services.resource_archive_summary_service import ResourceArchiveSummaryService
from app.services.resource_delivery_service import ResourceDeliveryService
from app.services.resource_favorite_summary_service import ResourceFavoriteSummaryService
from app.services.resource_generation_event_service import ResourceGenerationEventService
from app.services.resource_generation_service import ResourceGenerationService
from app.services.resource_management_service import ResourceManagementService
from app.services.resource_service import ResourceService
from app.services.resource_source_file_service import ResourceSourceFileService
from app.services.video_insight_service import VideoInsightService

router = APIRouter()


@router.post("/java-run", response_model=JavaRunResponse)
async def run_java_code(request: JavaRunRequest) -> JavaRunResponse:
    return await JavaRunnerService().run(request)


@router.post("/java-review", response_model=JavaReviewResponse)
async def review_java_code(request: JavaReviewRequest) -> JavaReviewResponse:
    return await JavaReviewService().review(request)


@router.post("/generate", response_model=ResourceGenerationResponse)
async def generate_resource(request: ResourceGenerationRequest) -> ResourceGenerationResponse:
    return await ResourceService().generate_resources(request)


@router.get("", response_model=ResourceListResponse)
async def list_resources(
    user_id: int,
    course_id: int | None = None,
    course_code: str | None = None,
    resource_type: str | None = None,
) -> ResourceListResponse:
    return await ResourceService().list_resources(
        user_id=user_id,
        course_id=course_id,
        course_code=course_code,
        resource_type=resource_type,
    )


@router.get("/history", response_model=ResourceListResponse)
async def list_archived_resources(
    user_id: int,
    course_id: int | None = None,
    course_code: str | None = None,
    resource_type: str | None = None,
) -> ResourceListResponse:
    return await ResourceService().list_archived_resources(
        user_id=user_id,
        course_id=course_id,
        course_code=course_code,
        resource_type=resource_type,
    )


@router.get("/history/summary", response_model=ResourceArchiveSummaryResponse)
async def get_archived_resource_summary(user_id: int) -> ResourceArchiveSummaryResponse:
    return await ResourceArchiveSummaryService().get_summary(user_id=user_id)


@router.get("/favorites", response_model=ResourceListResponse)
async def list_favorites(user_id: int) -> ResourceListResponse:
    return await ResourceService().list_favorites(user_id=user_id)


@router.get("/favorites/summary", response_model=ResourceFavoriteSummaryResponse)
async def get_favorite_summary(user_id: int) -> ResourceFavoriteSummaryResponse:
    return await ResourceFavoriteSummaryService().get_summary(user_id=user_id)


@router.get("/favorites/history", response_model=ResourceFavoriteHistoryListResponse)
async def list_favorite_history(user_id: int) -> ResourceFavoriteHistoryListResponse:
    return await ResourceService().list_favorite_history(user_id=user_id)


@router.get("/{resource_id}", response_model=ResourceCard)
async def get_resource(resource_id: int) -> ResourceCard:
    return await ResourceService().get_resource(resource_id)


@router.get("/{resource_id}/video-insight", response_model=VideoInsightResponse)
async def get_video_insight(resource_id: int, file_id: int, file_name: str | None = None) -> VideoInsightResponse:
    resource = await ResourceService().get_resource(resource_id)
    resource_title = resource.title if hasattr(resource, "title") else resource.get("title")
    return await VideoInsightService().get_insight(
        resource_id=resource_id,
        file_id=file_id,
        resource_title=resource_title,
        file_name=file_name,
    )


@router.post("/video-insight", response_model=VideoInsightResponse)
async def create_video_insight(request: VideoInsightRequest) -> VideoInsightResponse:
    return await VideoInsightService().get_insight(
        resource_id=request.resource_id,
        file_id=request.file_id,
        resource_title=request.resource_title,
        file_name=request.file_name,
    )


@router.post("/video-insight/ask", response_model=VideoInsightAskResponse)
async def ask_video_insight(request: VideoInsightAskRequest) -> VideoInsightAskResponse:
    return await VideoInsightService().ask(request)


@router.get("/source-files/{file_id}/open")
async def open_resource_source_file(file_id: int):
    return await ResourceSourceFileService().open_source_file(file_id)


@router.get("/source-files/{file_id}/preview")
async def preview_resource_source_file(file_id: int):
    return await ResourceSourceFileService().preview_source_file(file_id)


@router.get("/source-files/{file_id}/preview-assets/{asset_path:path}")
async def preview_resource_source_file_asset(file_id: int, asset_path: str):
    return await ResourceSourceFileService().preview_source_file_asset(file_id, asset_path)


@router.get("/{resource_id}/download-access", response_model=ResourceDownloadAccessResponse)
async def get_download_access(resource_id: int, user_id: int) -> ResourceDownloadAccessResponse:
    return await ResourceService().get_download_access(user_id=user_id, resource_id=resource_id)


@router.get("/{resource_id}/preview", response_model=ResourcePreviewResponse)
async def get_resource_preview(resource_id: int) -> ResourcePreviewResponse:
    return await ResourceDeliveryService().get_preview(resource_id)


@router.post("/{resource_id}/download", response_model=ResourceDownloadResponse)
async def download_resource(resource_id: int, user_id: int) -> ResourceDownloadResponse:
    return await ResourceDeliveryService().download_resource(user_id=user_id, resource_id=resource_id)


@router.post("/{resource_id}/archive", response_model=ResourceArchiveResponse)
async def archive_resource(resource_id: int, request: ResourceArchiveRequest) -> ResourceArchiveResponse:
    return await ResourceService().archive_resource(resource_id, request)


@router.post("/{resource_id}/favorite", response_model=ResourceFavoriteResponse)
async def favorite_resource(resource_id: int, request: ResourceFavoriteRequest) -> ResourceFavoriteResponse:
    return await ResourceService().favorite_resource(user_id=request.user_id, resource_id=resource_id)


@router.delete("/{resource_id}/favorite", response_model=ResourceFavoriteResponse)
async def unfavorite_resource(resource_id: int, request: ResourceFavoriteRequest) -> ResourceFavoriteResponse:
    return await ResourceService().unfavorite_resource(user_id=request.user_id, resource_id=resource_id)


@router.post("/generation/tasks", response_model=ResourceGenerationTaskResponse, tags=["resource-generation"])
async def create_generation_task(task_data: ResourceGenerationTaskCreate = Body(...)) -> ResourceGenerationTaskResponse:
    return await ResourceGenerationService().create_generation_task(task_data)


@router.get("/generation/tasks/{task_id}", response_model=ResourceGenerationTaskResponse, tags=["resource-generation"])
async def get_task_status(task_id: int) -> ResourceGenerationTaskResponse:
    return await ResourceGenerationService().get_task_status(task_id)


@router.get("/generation/tasks", tags=["resource-generation"])
async def list_generation_tasks(
    student_id: Optional[int] = Query(None),
    status: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    return await ResourceGenerationService().list_tasks(
        student_id=student_id,
        status=status,
        page=page,
        page_size=page_size,
    )


@router.delete("/generation/tasks/{task_id}", tags=["resource-generation"])
async def cancel_generation_task(task_id: int) -> dict:
    success = await ResourceGenerationService().cancel_task(task_id)
    return {"success": success, "message": "任务已取消"}


@router.websocket("/generation/tasks/{task_id}/stream")
async def stream_generation_task(websocket: WebSocket, task_id: int) -> None:
    await websocket.accept()
    queue = None
    try:
        try:
            user_id = get_websocket_user_id(websocket)
        except HTTPException:
            await websocket.send_text(json.dumps({"chunk_type": "error", "content": "missing authentication"}, ensure_ascii=False))
            await websocket.close(code=4401)
            return

        service = ResourceGenerationService()
        try:
            task = await service.get_task_status(task_id)
        except HTTPException as exc:
            await websocket.send_text(json.dumps({"chunk_type": "error", "content": exc.detail}, ensure_ascii=False))
            await websocket.close(code=4404)
            return

        if int(task.student_id) != int(user_id):
            await websocket.send_text(json.dumps({"chunk_type": "error", "content": "无权访问该任务"}, ensure_ascii=False))
            await websocket.close(code=4403)
            return

        await websocket.send_text(json.dumps({"chunk_type": "task_status", "content": task.model_dump(mode="json")}, ensure_ascii=False))
        if task.task_status in (3, 4, 5):
            await websocket.close()
            return

        queue = ResourceGenerationEventService.subscribe(task_id)
        while True:
            event = await queue.get()
            await websocket.send_text(json.dumps(event, ensure_ascii=False))
            content = event.get("content") or {}
            if int(content.get("task_status") or 0) in (3, 4, 5):
                await websocket.close()
                return
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_text(json.dumps({"chunk_type": "error", "content": str(exc)}, ensure_ascii=False))
        except Exception:
            pass
        await websocket.close(code=1011)
    finally:
        if queue is not None:
            ResourceGenerationEventService.unsubscribe(task_id, queue)


@router.get("/v2/list", response_model=ResourceListResponseV2, tags=["resource-management"])
async def query_resources_v2(
    student_id: Optional[int] = Query(None),
    course_id: Optional[int] = Query(None),
    resource_type: Optional[int] = Query(None),
    knowledge_point_id: Optional[int] = Query(None),
    status: Optional[int] = Query(None),
    difficulty_level: Optional[int] = Query(None),
    keyword: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> ResourceListResponseV2:
    params = ResourceQueryParams(
        student_id=student_id,
        course_id=course_id,
        resource_type=resource_type,
        knowledge_point_id=knowledge_point_id,
        status=status,
        difficulty_level=difficulty_level,
        keyword=keyword,
        page=page,
        page_size=page_size,
    )
    return await ResourceManagementService().query_resources(params)


@router.get("/v2/{resource_id}/detail", tags=["resource-management"])
async def get_resource_detail_v2(resource_id: int):
    return await ResourceManagementService().get_resource_detail(resource_id)


@router.get("/v2/search", response_model=ResourceListResponseV2, tags=["resource-management"])
async def search_resources(
    keyword: str = Query(..., min_length=1),
    student_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> ResourceListResponseV2:
    return await ResourceManagementService().search_resources(
        keyword=keyword,
        student_id=student_id,
        page=page,
        page_size=page_size,
    )


@router.post("/v2/favorites", response_model=ResourceFavoriteRecordResponse, tags=["resource-management"])
async def add_favorite_v2(favorite_data: ResourceFavoriteCreate = Body(...)) -> ResourceFavoriteRecordResponse:
    return await ResourceManagementService().add_favorite(favorite_data)


@router.delete("/v2/favorites", tags=["resource-management"])
async def remove_favorite_v2(
    user_id: int = Query(...),
    resource_id: int = Query(...),
) -> dict:
    success = await ResourceManagementService().remove_favorite(user_id, resource_id)
    return {"success": success, "message": "已取消收藏"}


@router.get("/v2/favorites/list", response_model=ResourceFavoriteListResponse, tags=["resource-management"])
async def list_favorites_v2(
    user_id: int = Query(...),
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> ResourceFavoriteListResponse:
    return await ResourceManagementService().list_favorites(
        user_id=user_id,
        category=category,
        page=page,
        page_size=page_size,
    )


@router.put("/v2/favorites/{resource_id}", response_model=ResourceFavoriteRecordResponse, tags=["resource-management"])
async def update_favorite_v2(
    resource_id: int,
    favorite_data: ResourceFavoriteUpdate = Body(...),
) -> ResourceFavoriteRecordResponse:
    return await ResourceManagementService().update_favorite(resource_id, favorite_data)


@router.get("/v2/favorites/categories", tags=["resource-management"])
async def get_favorite_categories(user_id: int = Query(...)) -> List[dict]:
    return await ResourceManagementService().get_favorite_categories(user_id)


@router.get("/v2/{resource_id}/download", tags=["resource-management"])
async def generate_download_url(
    resource_id: int,
    user_id: int = Query(...),
    format: str = Query("markdown"),
) -> dict:
    return await ResourceManagementService().generate_download_url(
        resource_id=resource_id,
        user_id=user_id,
        format=format,
    )


@router.post("/v2/batch-download", tags=["resource-management"])
async def batch_download_resources(
    resource_ids: List[int] = Body(...),
    user_id: int = Body(...),
    format: str = Body("zip"),
) -> dict:
    return await ResourceManagementService().batch_download(
        resource_ids=resource_ids,
        user_id=user_id,
        format=format,
    )


@router.delete("/v2/{resource_id}", tags=["resource-management"])
async def delete_resource_v2(
    resource_id: int,
    user_id: int = Query(...),
    hard_delete: bool = Query(False),
) -> dict:
    success = await ResourceManagementService().delete_resource(
        resource_id=resource_id,
        user_id=user_id,
        hard_delete=hard_delete,
    )
    return {"success": success, "message": "删除成功"}


@router.get("/v2/statistics", tags=["resource-management"])
async def get_resource_statistics(student_id: int = Query(...)) -> dict:
    return await ResourceManagementService().get_resource_statistics(student_id)
