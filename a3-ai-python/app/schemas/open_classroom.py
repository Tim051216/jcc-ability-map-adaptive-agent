from typing import Literal

from pydantic import BaseModel, Field


class OpenClassroomBuildRequest(BaseModel):
    course_code: str | None = Field(default=None, alias="courseCode")
    course_name: str | None = Field(default=None, alias="courseName")
    lesson_title: str = Field(alias="lessonTitle")
    student_question: str | None = Field(default=None, alias="studentQuestion")
    focus_points: list[str] = Field(default_factory=list, alias="focusPoints")
    target_resource_types: list[str] = Field(default_factory=list, alias="targetResourceTypes")
    audience_level: Literal["beginner", "intermediate", "advanced"] = Field(
        default="intermediate",
        alias="audienceLevel",
    )
    duration_minutes: int = Field(default=20, ge=5, le=120, alias="durationMinutes")


class OpenClassroomAgentCard(BaseModel):
    role: str
    name: str
    responsibility: str
    style: str
    output: str


class OpenClassroomQuizQuestion(BaseModel):
    question_type: Literal["single_choice", "multiple_choice", "short_answer"] = Field(
        alias="questionType"
    )
    question: str
    options: list[str] = Field(default_factory=list)
    answer: str
    explanation: str
    knowledge_tag: str = Field(alias="knowledgeTag")


class OpenClassroomPptSlide(BaseModel):
    page_no: int = Field(alias="pageNo")
    title: str
    bullets: list[str] = Field(default_factory=list)
    speaker_note: str = Field(alias="speakerNote")


class OpenClassroomInteractionTurn(BaseModel):
    speaker: str
    goal: str
    script: str


class OpenClassroomBuildResponse(BaseModel):
    course_code: str | None = Field(default=None, alias="courseCode")
    course_name: str | None = Field(default=None, alias="courseName")
    lesson_title: str = Field(alias="lessonTitle")
    scene_summary: str = Field(alias="sceneSummary")
    completion_status: str = Field(alias="completionStatus")
    framework_note: str = Field(alias="frameworkNote")
    agent_cards: list[OpenClassroomAgentCard] = Field(default_factory=list, alias="agentCards")
    interaction_script: list[OpenClassroomInteractionTurn] = Field(
        default_factory=list,
        alias="interactionScript",
    )
    quiz_questions: list[OpenClassroomQuizQuestion] = Field(
        default_factory=list,
        alias="quizQuestions",
    )
    ppt_outline: list[OpenClassroomPptSlide] = Field(default_factory=list, alias="pptOutline")
    generated_resources: list[str] = Field(default_factory=list, alias="generatedResources")
