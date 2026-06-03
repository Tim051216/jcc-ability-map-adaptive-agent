from pydantic import BaseModel, Field


class CourseCommentCreate(BaseModel):
    course_key: str = Field(..., min_length=1, max_length=64, description="课程键")
    section_index: int | None = Field(default=None, ge=0, le=9999, description="章节索引")
    content: str = Field(..., min_length=1, max_length=240, description="评论内容")
    parent_comment_id: int | None = Field(default=None, ge=1, description="父评论ID")


class CourseCommentReplyInfo(BaseModel):
    id: int
    author: str


class CourseCommentItem(BaseModel):
    id: int
    course_key: str
    section_index: int | None = None
    user_id: int
    author: str
    content: str
    created_at: str | None = None
    likes: int = 0
    liked: bool = False
    badge: str | None = None
    parent_comment_id: int | None = None
    reply_to: CourseCommentReplyInfo | None = None


class CourseCommentListResponse(BaseModel):
    total: int
    items: list[CourseCommentItem]


class CourseCommentLikeResponse(BaseModel):
    comment_id: int
    liked: bool
    likes: int
