from pydantic import BaseModel, Field


class VideoDanmakuCreate(BaseModel):
    video_key: str = Field(..., min_length=1, max_length=128, description="视频唯一键")
    content: str = Field(..., min_length=1, max_length=120, description="弹幕内容")
    color: str = Field(default="#ffffff", max_length=16, description="弹幕颜色")
    mode: str = Field(default="scroll", description="弹幕模式：scroll/top/bottom")
    start_time: float = Field(..., ge=0, le=86400, description="视频时间点（秒）")
    course_id: int | None = Field(default=None, description="课程ID")
    section_id: int | None = Field(default=None, description="章节ID")


class VideoDanmakuItem(BaseModel):
    id: int
    video_key: str
    user_id: int
    user_name: str
    course_id: int | None = None
    section_id: int | None = None
    content: str
    color: str
    mode: str
    start_time: float
    created_at: str | None = None


class VideoDanmakuListResponse(BaseModel):
    total: int
    items: list[VideoDanmakuItem]
