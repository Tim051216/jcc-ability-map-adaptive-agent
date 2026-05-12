from typing import List, Optional
from fastapi import APIRouter, Query, Body

from app.schemas.common import ResourceCard
from app.schemas.resource import (
    ResourceArchiveRequest,
    ResourceArchiveResponse,
    ResourceArchiveSummaryResponse,
    ResourceDownloadAccessResponse,
    ResourceDownloadResponse,
    ResourceFavoriteHistoryListResponse,
    ResourceFavoriteRequest,
    ResourceFavoriteResponse,
    ResourceFavoriteSummaryResponse,
    ResourceGenerationRequest,
    ResourceGenerationResponse,
    ResourceListResponse,
    ResourcePreviewResponse,
    # 新增的 Schema
    ResourceGenerationTaskCreate,
    ResourceGenerationTaskResponse,
    ResourceQueryParams,
    ResourceListResponseV2,
    ResourceFavoriteCreate,
    ResourceFavoriteRecordResponse,
    ResourceFavoriteListResponse,
    ResourceFavoriteUpdate,
)
from app.services.resource_delivery_service import ResourceDeliveryService
from app.services.resource_archive_summary_service import ResourceArchiveSummaryService
from app.services.resource_favorite_summary_service import ResourceFavoriteSummaryService
from app.services.resource_service import ResourceService
# 新增的服务
from app.services.resource_generation_service import ResourceGenerationService
from app.services.resource_management_service import ResourceManagementService

router = APIRouter()


@router.post("/generate", response_model=ResourceGenerationResponse)
async def generate_resource(
    request: ResourceGenerationRequest,
) -> ResourceGenerationResponse:
    service = ResourceService()
    return await service.generate_resources(request)


@router.get("", response_model=ResourceListResponse)
async def list_resources(
    user_id: int,
    course_code: str | None = None,
    resource_type: str | None = None,
) -> ResourceListResponse:
    service = ResourceService()
    return await service.list_resources(user_id=user_id, course_code=course_code, resource_type=resource_type)


@router.get("/history", response_model=ResourceListResponse)
async def list_archived_resources(
    user_id: int,
    course_code: str | None = None,
    resource_type: str | None = None,
) -> ResourceListResponse:
    service = ResourceService()
    return await service.list_archived_resources(user_id=user_id, course_code=course_code, resource_type=resource_type)


@router.get("/history/summary", response_model=ResourceArchiveSummaryResponse)
async def get_archived_resource_summary(user_id: int) -> ResourceArchiveSummaryResponse:
    service = ResourceArchiveSummaryService()
    return await service.get_summary(user_id=user_id)


@router.get("/favorites", response_model=ResourceListResponse)
async def list_favorites(user_id: int) -> ResourceListResponse:
    service = ResourceService()
    return await service.list_favorites(user_id=user_id)


@router.get("/favorites/summary", response_model=ResourceFavoriteSummaryResponse)
async def get_favorite_summary(user_id: int) -> ResourceFavoriteSummaryResponse:
    service = ResourceFavoriteSummaryService()
    return await service.get_summary(user_id=user_id)


@router.get("/favorites/history", response_model=ResourceFavoriteHistoryListResponse)
async def list_favorite_history(user_id: int) -> ResourceFavoriteHistoryListResponse:
    service = ResourceService()
    return await service.list_favorite_history(user_id=user_id)


@router.get("/{resource_id}", response_model=ResourceCard)
async def get_resource(resource_id: int) -> ResourceCard:
    service = ResourceService()
    return await service.get_resource(resource_id)


@router.get("/{resource_id}/download-access", response_model=ResourceDownloadAccessResponse)
async def get_download_access(resource_id: int, user_id: int) -> ResourceDownloadAccessResponse:
    service = ResourceService()
    return await service.get_download_access(user_id=user_id, resource_id=resource_id)


@router.get("/{resource_id}/preview", response_model=ResourcePreviewResponse)
async def get_resource_preview(resource_id: int) -> ResourcePreviewResponse:
    service = ResourceDeliveryService()
    return await service.get_preview(resource_id)


@router.post("/{resource_id}/download", response_model=ResourceDownloadResponse)
async def download_resource(resource_id: int, user_id: int) -> ResourceDownloadResponse:
    service = ResourceDeliveryService()
    return await service.download_resource(user_id=user_id, resource_id=resource_id)


@router.post("/{resource_id}/archive", response_model=ResourceArchiveResponse)
async def archive_resource(
    resource_id: int,
    request: ResourceArchiveRequest,
) -> ResourceArchiveResponse:
    service = ResourceService()
    return await service.archive_resource(resource_id, request)


@router.post("/{resource_id}/favorite", response_model=ResourceFavoriteResponse)
async def favorite_resource(
    resource_id: int,
    request: ResourceFavoriteRequest,
) -> ResourceFavoriteResponse:
    service = ResourceService()
    return await service.favorite_resource(user_id=request.user_id, resource_id=resource_id)


@router.delete("/{resource_id}/favorite", response_model=ResourceFavoriteResponse)
async def unfavorite_resource(
    resource_id: int,
    request: ResourceFavoriteRequest,
) -> ResourceFavoriteResponse:
    service = ResourceService()
    return await service.unfavorite_resource(user_id=request.user_id, resource_id=resource_id)



# ========================================
# 新增: 资源生成 API (任务11)
# ========================================

@router.post("/generation/tasks", response_model=ResourceGenerationTaskResponse, tags=["资源生成"])
async def create_generation_task(
    task_data: ResourceGenerationTaskCreate = Body(..., description="任务创建数据")
) -> ResourceGenerationTaskResponse:
    """
    创建资源生成任务
    
    支持的资源类型:
    - 1: 课程讲解文档
    - 2: 知识点思维导图
    - 3: 分层练习题库
    - 4: 教学视频/动画
    - 5: 代码实操案例
    
    示例:
    ```json
    {
        "task_name": "Python基础知识资源生成",
        "student_id": 1001,
        "resource_types": [1, 2, 3],
        "knowledge_point_id": 101,
        "course_id": 1,
        "generation_params": {
            "difficulty_level": 1,
            "programming_language": "Python"
        }
    }
    ```
    """
    service = ResourceGenerationService()
    return await service.create_generation_task(task_data)


@router.get("/generation/tasks/{task_id}", response_model=ResourceGenerationTaskResponse, tags=["资源生成"])
async def get_task_status(
    task_id: int
) -> ResourceGenerationTaskResponse:
    """
    查询任务状态和进度
    
    返回信息包括:
    - 任务状态 (1-待处理, 2-处理中, 3-已完成, 4-部分失败, 5-全部失败)
    - 进度百分比 (0-100)
    - 已完成/失败的资源数量
    - 错误信息(如果有)
    """
    service = ResourceGenerationService()
    return await service.get_task_status(task_id)


@router.get("/generation/tasks", tags=["资源生成"])
async def list_generation_tasks(
    student_id: Optional[int] = Query(None, description="学生ID"),
    status: Optional[int] = Query(None, description="任务状态"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量")
):
    """
    查询任务列表
    
    支持按学生ID和状态筛选
    """
    service = ResourceGenerationService()
    return await service.list_tasks(
        student_id=student_id,
        status=status,
        page=page,
        page_size=page_size
    )


@router.delete("/generation/tasks/{task_id}", tags=["资源生成"])
async def cancel_generation_task(
    task_id: int
) -> dict:
    """
    取消生成任务
    
    只能取消待处理或处理中的任务
    """
    service = ResourceGenerationService()
    success = await service.cancel_task(task_id)
    return {"success": success, "message": "任务已取消"}


# ========================================
# 新增: 资源管理 API (任务12)
# ========================================

@router.get("/v2/list", response_model=ResourceListResponseV2, tags=["资源管理"])
async def query_resources_v2(
    student_id: Optional[int] = Query(None, description="学生ID"),
    course_id: Optional[int] = Query(None, description="课程ID"),
    resource_type: Optional[int] = Query(None, description="资源类型"),
    knowledge_point_id: Optional[int] = Query(None, description="知识点ID"),
    status: Optional[int] = Query(None, description="资源状态"),
    difficulty_level: Optional[int] = Query(None, description="难度等级"),
    keyword: Optional[str] = Query(None, description="关键词"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量")
) -> ResourceListResponseV2:
    """
    查询资源列表 (V2版本 - 支持更多筛选条件)
    
    支持多维度筛选:
    - 按学生ID筛选
    - 按课程ID筛选
    - 按资源类型筛选
    - 按知识点ID筛选
    - 按状态筛选
    - 按难度等级筛选
    
    返回分页结果
    """
    params = ResourceQueryParams(
        student_id=student_id,
        course_id=course_id,
        resource_type=resource_type,
        knowledge_point_id=knowledge_point_id,
        status=status,
        difficulty_level=difficulty_level,
        keyword=keyword,
        page=page,
        page_size=page_size
    )
    service = ResourceManagementService()
    return await service.query_resources(params)


@router.get("/v2/{resource_id}/detail", tags=["资源管理"])
async def get_resource_detail_v2(
    resource_id: int
):
    """
    获取资源详情 (V2版本)
    
    返回完整的资源信息,包括:
    - 基本信息
    - 内容数据
    - 统计信息(查看/下载/收藏次数)
    """
    service = ResourceManagementService()
    return await service.get_resource_detail(resource_id)


@router.get("/v2/search", response_model=ResourceListResponseV2, tags=["资源管理"])
async def search_resources(
    keyword: str = Query(..., min_length=1, description="搜索关键词"),
    student_id: Optional[int] = Query(None, description="学生ID"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量")
) -> ResourceListResponseV2:
    """
    全文检索资源
    
    在资源名称和内容中搜索关键词
    """
    service = ResourceManagementService()
    return await service.search_resources(
        keyword=keyword,
        student_id=student_id,
        page=page,
        page_size=page_size
    )


@router.post("/v2/favorites", response_model=ResourceFavoriteRecordResponse, tags=["资源管理"])
async def add_favorite_v2(
    favorite_data: ResourceFavoriteCreate = Body(..., description="收藏数据")
) -> ResourceFavoriteRecordResponse:
    """
    添加收藏
    
    支持:
    - 收藏分类
    - 收藏备注
    
    示例:
    ```json
    {
        "user_id": 1001,
        "resource_id": 101,
        "category": "重点复习",
        "notes": "考试重点"
    }
    ```
    """
    service = ResourceManagementService()
    return await service.add_favorite(favorite_data)


@router.delete("/v2/favorites", tags=["资源管理"])
async def remove_favorite_v2(
    user_id: int = Query(..., description="用户ID"),
    resource_id: int = Query(..., description="资源ID")
) -> dict:
    """
    取消收藏
    """
    service = ResourceManagementService()
    success = await service.remove_favorite(user_id, resource_id)
    return {"success": success, "message": "已取消收藏"}


@router.get("/v2/favorites/list", response_model=ResourceFavoriteListResponse, tags=["资源管理"])
async def list_favorites_v2(
    user_id: int = Query(..., description="用户ID"),
    category: Optional[str] = Query(None, description="收藏分类"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量")
 ) -> ResourceFavoriteListResponse:
    """
    查询收藏列表
    
    支持按分类筛选
    """
    service = ResourceManagementService()
    return await service.list_favorites(
        user_id=user_id,
        category=category,
        page=page,
        page_size=page_size
    )


@router.put("/v2/favorites/{resource_id}", response_model=ResourceFavoriteRecordResponse, tags=["资源管理"])
async def update_favorite_v2(
    resource_id: int,
    favorite_data: ResourceFavoriteUpdate = Body(..., description="收藏更新数据")
) -> ResourceFavoriteRecordResponse:
    """
    更新收藏分类和备注
    """
    service = ResourceManagementService()
    return await service.update_favorite(resource_id, favorite_data)


@router.get("/v2/favorites/categories", tags=["资源管理"])
async def get_favorite_categories(
    user_id: int = Query(..., description="用户ID")
) -> List[dict]:
    """
    获取收藏分类列表
    
    返回每个分类及其资源数量
    """
    service = ResourceManagementService()
    return await service.get_favorite_categories(user_id)


@router.get("/v2/{resource_id}/download", tags=["资源管理"])
async def generate_download_url(
    resource_id: int,
    user_id: int = Query(..., description="用户ID"),
    format: str = Query("markdown", description="下载格式: markdown, pdf, html")
) -> dict:
    """
    生成资源下载链接
    
    支持的格式:
    - markdown: Markdown 原始文件
    - pdf: PDF 文档
    - html: HTML 网页
    
    返回临时下载链接(1小时有效)
    """
    service = ResourceManagementService()
    return await service.generate_download_url(
        resource_id=resource_id,
        user_id=user_id,
        format=format
    )


@router.post("/v2/batch-download", tags=["资源管理"])
async def batch_download_resources(
    resource_ids: List[int] = Body(..., description="资源ID列表"),
    user_id: int = Body(..., description="用户ID"),
    format: str = Body("zip", description="打包格式")
) -> dict:
    """
    批量下载资源
    
    将多个资源打包为 zip 文件下载
    """
    service = ResourceManagementService()
    return await service.batch_download(
        resource_ids=resource_ids,
        user_id=user_id,
        format=format
    )


@router.delete("/v2/{resource_id}", tags=["资源管理"])
async def delete_resource_v2(
    resource_id: int,
    user_id: int = Query(..., description="用户ID"),
    hard_delete: bool = Query(False, description="是否硬删除")
) -> dict:
    """
    删除资源
    
    - hard_delete=false: 软删除(标记为已删除,可恢复)
    - hard_delete=true: 硬删除(物理删除,不可恢复)
    """
    service = ResourceManagementService()
    success = await service.delete_resource(
        resource_id=resource_id,
        user_id=user_id,
        hard_delete=hard_delete
    )
    return {"success": success, "message": "删除成功"}


@router.get("/v2/statistics", tags=["资源管理"])
async def get_resource_statistics(
    student_id: int = Query(..., description="学生ID")
) -> dict:
    """
    获取资源统计信息
    
    返回:
    - 总资源数
    - 按类型统计
    - 按状态统计
    - 收藏数
    - 总查看次数
    - 总下载次数
    """
    service = ResourceManagementService()
    return await service.get_resource_statistics(student_id)
