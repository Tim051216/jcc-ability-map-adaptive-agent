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


class PersonalizedNextStepResponse(BaseModel):
    course_id: int
    section_index: int
    current_video: str
    next_topic: str
    next_action: str
    target_goal: str
    estimated_minutes: int
    difficulty_level: str
    reason: str
    recommended_resources: list[str] = Field(default_factory=list)


class GoalPathItem(BaseModel):
    day: int
    title: str
    focus: str
    task: str
    deliverable: str


class GoalPathResponse(BaseModel):
    course_id: int
    goal_title: str
    goal_subtitle: str
    suitable_for: str
    items: list[GoalPathItem] = Field(default_factory=list)


class ReviewCardItem(BaseModel):
    id: str
    prompt: str
    answer: str
    review_stage: str
    next_review_in_hours: int
    source_video: str


class ReviewPlanResponse(BaseModel):
    course_id: int
    summary: str
    cards: list[ReviewCardItem] = Field(default_factory=list)


class LevelRecommendationItem(BaseModel):
    level: str
    label: str
    fit_score: int
    description: str
    recommended_topics: list[str] = Field(default_factory=list)


class LevelRecommendationResponse(BaseModel):
    course_id: int
    active_level: str
    items: list[LevelRecommendationItem] = Field(default_factory=list)


class GrowthDimensionItem(BaseModel):
    key: str
    label: str
    score: int
    trend: str
    evidence: str


class GrowthMapResponse(BaseModel):
    course_id: int
    user_id: int
    title: str
    summary: str
    next_milestone: str
    dimensions: list[GrowthDimensionItem] = Field(default_factory=list)


class LearningSessionEventRequest(BaseModel):
    user_id: int
    course_id: int
    section_index: int = 0
    event_type: str
    watched_seconds: int = 0
    completed: bool = False


class LearningSessionEventResponse(BaseModel):
    user_id: int
    course_id: int
    section_index: int
    total_watched_seconds: int
    completed_sections: list[int] = Field(default_factory=list)
    recommended_level: str
