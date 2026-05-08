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
    type: int | None = None
    description: str | None = None


class JavaCourseDetail(BaseModel):
    id: int
    name: str | None = None
    introduction: str | None = None
    brief: str | None = None
    level: int | None = None
    section_dt_os: list[JavaCourseSection] = Field(default_factory=list, alias="sectionDTOS")


class JavaLearningRecord(BaseModel):
    lesson_id: int | None = Field(default=None, alias="lessonId")
    latest_section_id: int | None = Field(default=None, alias="latestSectionId")
    week_freq: int | None = Field(default=None, alias="weekFreq")
    learned_sections: int | None = Field(default=None, alias="learnedSections")
    process_percent: int | None = Field(default=None, alias="processPercent")
