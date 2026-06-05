from pydantic import BaseModel, Field


class JavaUserProfile(BaseModel):
    id: int
    name: str | None = None
    icon: str | None = None
    type: int | None = None
    college: str | None = None
    major: str | None = None
    grade: str | None = None


class JavaCourseSection(BaseModel):
    id: int | None = None
    name: str | None = None
    index: int | None = None
    type: int | None = None
    description: str | None = None
    media_duration: int | None = Field(default=None, alias="mediaDuration")
    trailer: bool | None = None
    media_id: int | None = Field(default=None, alias="mediaId")
    subject_num: int | None = Field(default=None, alias="subjectNum")
    moment: int | None = 0
    sections: list["JavaCourseSection"] = Field(default_factory=list)


class JavaCourseDetail(BaseModel):
    id: int
    name: str | None = None
    cover_url: str | None = Field(default=None, alias="coverUrl")
    price: int | None = None
    valid_duration: int | None = Field(default=None, alias="validDuration")
    section_num: int | None = Field(default=None, alias="sectionNum")
    teacher_ids: list[int] = Field(default_factory=list, alias="teacherIds")
    introduction: str | None = None
    brief: str | None = None
    level: int | None = None
    chapters: list[JavaCourseSection] = Field(default_factory=list)
    section_dt_os: list[JavaCourseSection] = Field(default_factory=list, alias="sectionDTOS")


class JavaCourseAndSection(BaseModel):
    id: int
    name: str | None = None
    cover_url: str | None = Field(default=None, alias="coverUrl")
    sections: int | None = None
    teacher_icon: str | None = Field(default=None, alias="teacherIcon")
    teacher_name: str | None = Field(default=None, alias="teacherName")
    lesson_id: int | None = Field(default=None, alias="lessonId")
    latest_section_id: int | None = Field(default=None, alias="latestSectionId")
    chapters: list[JavaCourseSection] = Field(default_factory=list)


class JavaLearningRecord(BaseModel):
    lesson_id: int | None = Field(default=None, alias="lessonId")
    latest_section_id: int | None = Field(default=None, alias="latestSectionId")
    week_freq: int | None = Field(default=None, alias="weekFreq")
    learned_sections: int | None = Field(default=None, alias="learnedSections")
    process_percent: int | None = Field(default=None, alias="processPercent")


JavaCourseSection.model_rebuild()
