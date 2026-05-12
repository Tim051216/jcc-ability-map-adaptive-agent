from typing import Any, List

from pydantic import BaseModel, Field


class LearningPageResponse(BaseModel):
    list: List[dict[str, Any]] = Field(default_factory=list)
    total: int = 0


class LearningQuestionCreateRequest(BaseModel):
    course_id: int = Field(alias="courseId")
    chapter_id: int = Field(alias="chapterId")
    section_id: int = Field(alias="sectionId")
    title: str
    description: str
    anonymity: bool = False


class LearningQuestionUpdateRequest(BaseModel):
    id: int | None = None
    course_id: int = Field(alias="courseId")
    chapter_id: int = Field(alias="chapterId")
    section_id: int = Field(alias="sectionId")
    title: str
    description: str
    anonymity: bool = False


class LearningReplyCreateRequest(BaseModel):
    question_id: int = Field(alias="questionId")
    answer_id: int | None = Field(default=None, alias="answerId")
    target_reply_id: int | None = Field(default=None, alias="targetReplyId")
    target_user_id: int | None = Field(default=None, alias="targetUserId")
    content: str
    anonymity: bool = False


class LearningLikeRequest(BaseModel):
    biz_id: int = Field(alias="bizId")
    biz_type: str = Field(alias="bizType")
    liked: bool


class LearningNoteCreateRequest(BaseModel):
    course_id: int = Field(alias="courseId")
    chapter_id: int = Field(alias="chapterId")
    section_id: int = Field(alias="sectionId")
    content: str
    note_moment: int = Field(default=0, alias="noteMoment")
    is_private: bool = Field(default=False, alias="isPrivate")


class LearningNoteUpdateRequest(BaseModel):
    id: int
    content: str
    is_private: bool = Field(default=False, alias="isPrivate")


class LearningExamGenerateRequest(BaseModel):
    course_id: int | None = Field(default=None, alias="courseId")
    chapter_id: int | None = Field(default=None, alias="chapterId")
    section_id: int | None = Field(default=None, alias="sectionId")
    question_count: int | None = Field(default=5, alias="questionCount")


class LearningExamAnswerItem(BaseModel):
    question_id: int = Field(alias="questionId")
    answer: str | bool | None = None
    question_type: int = Field(alias="questionType")


class LearningExamSubmitRequest(BaseModel):
    id: int
    exam_details: list[LearningExamAnswerItem] = Field(default_factory=list, alias="examDetails")
