from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal

from app.schemas.common import ResourceCard


class ResourceGenerationRequest(BaseModel):
    user_id: int
    course_code: str | None = None
    course_id: int | None = None
    knowledge_points: list[str] = Field(default_factory=list)
    resource_types: list[str] = Field(default_factory=list)


class ResourceGenerationResponse(BaseModel):
    task_id: int | None = None
    recommended_order: list[str] = Field(default_factory=list)
    resources: list[ResourceCard] = Field(default_factory=list)


class ResourceListResponse(BaseModel):
    items: list[ResourceCard] = Field(default_factory=list)
    total: int = 0


class ResourceFavoriteRequest(BaseModel):
    user_id: int


class ResourceFavoriteResponse(BaseModel):
    resource_id: int
    user_id: int
    favorite: bool


class ResourceArchiveRequest(BaseModel):
    user_id: int
    archived_by: str = "admin"
    reason: str | None = None


class ResourceArchiveResponse(BaseModel):
    resource_id: int
    archived: bool
    archived_by: str | None = None
    archive_reason: str | None = None
    archived_at: str | None = None


class ResourceDownloadAccessResponse(BaseModel):
    resource_id: int
    user_id: int
    can_download: bool
    download_scope: str
    reason: str


class ResourcePreviewResponse(BaseModel):
    resource_id: int
    title: str
    resource_type: str
    summary: str
    excerpt_markdown: str
    source_titles: list[str] = Field(default_factory=list)
    archived: bool = False


class ResourceDownloadResponse(BaseModel):
    resource_id: int
    user_id: int
    title: str
    download_scope: str
    download_count: int
    content_markdown: str


class ResourceFavoriteHistoryItem(BaseModel):
    resource_id: int
    user_id: int
    action: str
    created_at: str | None = None


class ResourceFavoriteHistoryListResponse(BaseModel):
    items: list[ResourceFavoriteHistoryItem] = Field(default_factory=list)
    total: int = 0


class ResourceFavoriteSummaryResponse(BaseModel):
    user_id: int
    total: int = 0
    by_type: dict[str, int] = Field(default_factory=dict)
    latest_favorite_at: str | None = None


class ResourceArchiveSummaryResponse(BaseModel):
    user_id: int
    total: int = 0
    by_type: dict[str, int] = Field(default_factory=dict)
    by_archived_by: dict[str, int] = Field(default_factory=dict)
    latest_archived_at: str | None = None


# ========================================
# 资源生成任务相关模型
# ========================================

class ResourceGenerationTaskCreate(BaseModel):
    """资源生成任务创建请求"""
    task_name: str
    student_id: int
    resource_types: list[int] = Field(description="资源类型列表：1-文档，2-导图，3-题库，4-视频，5-代码")
    knowledge_point_id: int
    course_id: int
    chapter_id: Optional[int] = None
    section_id: Optional[int] = None
    generation_params: Optional[dict] = Field(default_factory=dict, description="生成参数")


class ResourceGenerationTaskUpdate(BaseModel):
    """资源生成任务更新"""
    task_status: Optional[int] = None
    progress: Optional[int] = None
    completed_resources: Optional[int] = None
    failed_resources: Optional[int] = None
    error_message: Optional[str] = None


class ResourceGenerationTaskResponse(BaseModel):
    """资源生成任务响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_name: str
    student_id: int
    resource_types: str
    knowledge_point_id: int
    course_id: int
    task_status: int
    progress: int
    total_resources: int
    completed_resources: int
    failed_resources: int
    error_message: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    create_time: datetime
    update_time: datetime

# ========================================
# 学习资源相关模型
# ========================================

class LearningResourceBase(BaseModel):
    """学习资源基础模型"""
    resource_name: str
    resource_type: int = Field(description="1-文档，2-导图，3-题库，4-视频，5-代码")
    knowledge_point_id: int
    course_id: int
    chapter_id: Optional[int] = None
    section_id: Optional[int] = None
    student_id: int
    difficulty_level: int = Field(default=1, description="1-基础，2-进阶，3-拔高")


class LearningResourceCreate(LearningResourceBase):
    """学习资源创建请求"""
    generation_task_id: Optional[int] = None


class LearningResourceUpdate(BaseModel):
    """学习资源更新"""
    status: Optional[int] = None
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    file_format: Optional[str] = None
    quality_score: Optional[Decimal] = None


class LearningResourceResponse(LearningResourceBase):
    """学习资源响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: int
    version: int
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    file_format: Optional[str] = None
    generation_task_id: Optional[int] = None
    quality_score: Optional[Decimal] = None
    view_count: int
    download_count: int
    favorite_count: int
    create_time: datetime
    update_time: datetime

# ========================================
# 文档资源相关模型
# ========================================

class ResourceDocumentCreate(BaseModel):
    """文档资源创建"""
    resource_id: int
    title: str
    content_markdown: str
    content_html: Optional[str] = None
    word_count: int = 0
    has_formula: bool = False
    has_image: bool = False
    has_code: bool = False
    outline: Optional[dict] = None


class ResourceDocumentResponse(BaseModel):
    """文档资源响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    resource_id: int
    title: str
    content_markdown: str
    content_html: Optional[str] = None
    word_count: int
    has_formula: bool
    has_image: bool
    has_code: bool
    outline: Optional[dict] = None
    create_time: datetime
    update_time: datetime

# ========================================
# 思维导图资源相关模型
# ========================================

class ResourceMindmapCreate(BaseModel):
    """思维导图资源创建"""
    resource_id: int
    title: str
    mermaid_code: str
    node_count: int = 0
    max_depth: int = 0
    layout_type: str = "TB"
    style_config: Optional[dict] = None


class ResourceMindmapResponse(BaseModel):
    """思维导图资源响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    resource_id: int
    title: str
    mermaid_code: str
    node_count: int
    max_depth: int
    layout_type: str
    style_config: Optional[dict] = None
    create_time: datetime
    update_time: datetime

# ========================================
# 题库资源相关模型
# ========================================

class ResourceQuestionBankCreate(BaseModel):
    """题库资源创建"""
    resource_id: int
    title: str
    total_questions: int = 0
    basic_questions: int = 0
    advanced_questions: int = 0
    expert_questions: int = 0
    question_types: Optional[dict] = None
    knowledge_coverage: Optional[dict] = None


class ResourceQuestionCreate(BaseModel):
    """题目创建"""
    question_bank_id: int
    question_type: int = Field(description="1-单选，2-多选，3-判断，4-填空，5-简答，6-编程")
    difficulty_level: int = Field(description="1-基础，2-进阶，3-拔高")
    question_content: str
    options: Optional[dict] = None
    correct_answer: str
    answer_analysis: Optional[str] = None
    knowledge_points: Optional[str] = None
    score: Decimal = Decimal("0")
    order_num: int = 0


class ResourceQuestionResponse(BaseModel):
    """题目响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    question_bank_id: int
    question_type: int
    difficulty_level: int
    question_content: str
    options: Optional[dict] = None
    correct_answer: str
    answer_analysis: Optional[str] = None
    knowledge_points: Optional[str] = None
    score: Decimal
    order_num: int
    create_time: datetime
    update_time: datetime

class ResourceQuestionBankResponse(BaseModel):
    """题库资源响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    resource_id: int
    title: str
    total_questions: int
    basic_questions: int
    advanced_questions: int
    expert_questions: int
    question_types: Optional[dict] = None
    knowledge_coverage: Optional[dict] = None
    questions: list[ResourceQuestionResponse] = Field(default_factory=list)
    create_time: datetime
    update_time: datetime

# ========================================
# 视频资源相关模型
# ========================================

class ResourceVideoCreate(BaseModel):
    """视频资源创建"""
    resource_id: int
    title: str
    video_url: str
    cover_url: Optional[str] = None
    duration: int = 0
    video_format: Optional[str] = None
    resolution: Optional[str] = None
    file_size: int = 0
    source_type: int = Field(description="1-平台自有，2-外部推荐")
    source_platform: Optional[str] = None
    source_url: Optional[str] = None
    tags: Optional[str] = None
    description: Optional[str] = None


class ResourceVideoResponse(BaseModel):
    """视频资源响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    resource_id: int
    title: str
    video_url: str
    cover_url: Optional[str] = None
    duration: int
    video_format: Optional[str] = None
    resolution: Optional[str] = None
    file_size: int
    source_type: int
    source_platform: Optional[str] = None
    source_url: Optional[str] = None
    tags: Optional[str] = None
    description: Optional[str] = None
    create_time: datetime
    update_time: datetime

# ========================================
# 代码案例资源相关模型
# ========================================

class ResourceCodeExampleCreate(BaseModel):
    """代码案例资源创建"""
    resource_id: int
    title: str
    description: Optional[str] = None
    programming_language: str
    code_content: str
    code_structure: Optional[dict] = None
    run_instructions: Optional[str] = None
    expected_output: Optional[str] = None
    dependencies: Optional[dict] = None
    difficulty_level: int = 1
    has_test_cases: bool = False
    is_runnable: bool = True


class ResourceCodeExampleResponse(BaseModel):
    """代码案例资源响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    resource_id: int
    title: str
    description: Optional[str] = None
    programming_language: str
    code_content: str
    code_structure: Optional[dict] = None
    run_instructions: Optional[str] = None
    expected_output: Optional[str] = None
    dependencies: Optional[dict] = None
    difficulty_level: int
    has_test_cases: bool
    is_runnable: bool
    create_time: datetime
    update_time: datetime

# ========================================
# 资源收藏相关模型
# ========================================

class ResourceFavoriteCreate(BaseModel):
    """资源收藏创建"""
    user_id: int
    resource_id: int
    category: str = "默认分类"
    notes: Optional[str] = None


class ResourceFavoriteUpdate(BaseModel):
    """资源收藏更新"""
    user_id: int
    category: Optional[str] = None
    notes: Optional[str] = None


class ResourceFavoriteRecordResponse(BaseModel):
    """资源收藏记录响应（V2）"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    resource_id: int
    category: str
    notes: Optional[str] = None
    create_time: datetime


class ResourceFavoriteListItem(BaseModel):
    """资源收藏列表项（V2）"""
    id: int
    resource_id: int
    resource_name: str
    resource_type: int
    knowledge_point_id: int
    course_id: int
    chapter_id: Optional[int] = None
    section_id: Optional[int] = None
    student_id: int
    difficulty_level: int
    status: int
    version: int
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    file_format: Optional[str] = None
    generation_task_id: Optional[int] = None
    quality_score: Optional[Decimal] = None
    view_count: int
    download_count: int
    favorite_count: int
    create_time: datetime
    update_time: datetime
    category: str
    notes: Optional[str] = None
    favorited_at: datetime


class ResourceFavoriteListResponse(BaseModel):
    """资源收藏列表响应（V2）"""
    items: list[ResourceFavoriteListItem] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 0

# ========================================
# 资源查询相关模型
# ========================================

class ResourceQueryParams(BaseModel):
    """资源查询参数"""
    student_id: Optional[int] = None
    course_id: Optional[int] = None
    resource_type: Optional[int] = None
    knowledge_point_id: Optional[int] = None
    status: Optional[int] = None
    difficulty_level: Optional[int] = None
    keyword: Optional[str] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class ResourceListResponseV2(BaseModel):
    """资源列表响应"""
    items: list[LearningResourceResponse] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 0
