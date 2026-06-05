from typing import List

from pydantic import BaseModel, Field


class CourseCategoryItem(BaseModel):
    id: int
    name: str
    children: list["CourseCategoryItem"] = Field(default_factory=list)


class CourseCardResponse(BaseModel):
    id: int
    course_code: str
    name: str
    cover_url: str
    price: int
    sold: int
    sections: int
    teacher: str
    teacher_name: str
    summary: str
    category_path: str
    valid_duration: int
    score: int


class CourseTeacherResponse(BaseModel):
    id: int
    name: str
    role: str
    intro: str
    icon: str | None = None
    is_show: bool = True


class CourseSectionResponse(BaseModel):
    id: int
    index: int
    name: str
    type: int
    media_duration: int = 0
    trailer: bool = False
    subject_num: int = 0
    moment: int = 0


class CourseChapterResponse(BaseModel):
    id: int
    index: str
    name: str
    media_duration: int = 0
    sections: list[CourseSectionResponse] = Field(default_factory=list)


class CourseDetailResponse(BaseModel):
    id: int
    course_code: str
    name: str
    cover_url: str
    price: int
    sold: int
    teacher: str
    teacher_name: str
    cata_total_num: int
    valid_duration: int
    score: int
    cate_names: str
    introduce: str
    use_people: str
    detail: str


class CourseSearchResponse(BaseModel):
    list: List[CourseCardResponse] = Field(default_factory=list)
    total: int


class LearningCourseDetailResponse(BaseModel):
    id: int
    course_code: str
    name: str
    cover_url: str
    teacher_name: str
    lesson_id: int
    latest_section_id: int | None = None
    moment: int = 0
    chapters: list[CourseChapterResponse] = Field(default_factory=list)


class CourseSectionPlayResponse(BaseModel):
    section_id: int
    play_enabled: bool = False
    file_id: str | None = None
    signature: str | None = None
    message: str | None = None
    playback_url: str | None = None


class LearningProgressUpdateRequest(BaseModel):
    section_id: int = Field(alias="sectionId")
    lesson_id: int | None = Field(default=None, alias="lessonId")
    moment: int = 0
    duration: int = 0


class LearningProgressUpdateResponse(BaseModel):
    lesson_id: int = Field(alias="lessonId")
    latest_section_id: int = Field(alias="latestSectionId")
    recorded: bool = True


CourseCategoryItem.model_rebuild()
