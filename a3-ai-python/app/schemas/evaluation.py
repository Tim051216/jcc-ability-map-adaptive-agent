from typing import Any

from pydantic import BaseModel, Field


class EvaluationRequest(BaseModel):
    user_id: int
    course_code: str | None = None
    course_id: int | None = None
    answers: list[dict] = Field(default_factory=list)
    scene: str | None = None
    profile: dict | None = None
    plan: dict | None = None
    resources: list[dict] = Field(default_factory=list)
    learning_duration_minutes: int | None = None
    resource_usage_count: int | None = None


class EvaluationQuestion(BaseModel):
    question_id: str
    question_type: str = "single_choice"
    prompt: str
    options: list[str] = Field(default_factory=list)
    correct_answer: str
    explanation: str = ""
    knowledge_point: str
    difficulty: str = "basic"


class EvaluationPaperGenerateRequest(BaseModel):
    user_id: int
    course_code: str | None = None
    course_id: int | None = None
    target: str | None = None
    knowledge_points: list[str] = Field(default_factory=list)
    paper_type: str = "diagnostic"
    question_count: int = 5


class EvaluationPaperResponse(BaseModel):
    paper_id: int
    user_id: int
    course_code: str
    paper_type: str
    status: str
    questions: list[EvaluationQuestion] = Field(default_factory=list)


class EvaluationAnswerItem(BaseModel):
    question_id: str
    answer: str


class EvaluationPaperSubmitRequest(BaseModel):
    user_id: int
    answers: list[EvaluationAnswerItem] = Field(default_factory=list)
    scene: str | None = None
    profile: dict | None = None
    plan: dict | None = None
    resources: list[dict] = Field(default_factory=list)
    learning_duration_minutes: int | None = None
    resource_usage_count: int | None = None


class EvaluationMetric(BaseModel):
    metric_name: str
    score: float
    comment: str


class EvaluationLayerResult(BaseModel):
    level: str
    score: float
    status: str
    comment: str


class EvaluationResponse(BaseModel):
    record_id: int | None = None
    paper_id: int | None = None
    overall_score: float
    evaluation_type: str = "diagnostic"
    mastery_level: str = "developing"
    report_summary: str = ""
    strengths: list[str] = Field(default_factory=list)
    weak_points: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    layered_results: list[EvaluationLayerResult] = Field(default_factory=list)
    metrics: list[EvaluationMetric] = Field(default_factory=list)
    knowledge_points: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    path_feedback: dict = Field(default_factory=dict)
    profile_feedback: dict = Field(default_factory=dict)


class EvaluationExportResponse(BaseModel):
    record_id: int
    course_code: str
    export_format: str
    file_name: str
    content_type: str
    content: str


class EvaluationHistoryItem(BaseModel):
    record_id: int
    paper_id: int | None = None
    course_code: str
    evaluation_type: str = "diagnostic"
    overall_score: float
    mastery_level: str = "developing"
    report_summary: str = ""
    weak_points: list[str] = Field(default_factory=list)
    knowledge_points: list[str] = Field(default_factory=list)
    created_at: str | None = None


class EvaluationHistoryResponse(BaseModel):
    items: list[EvaluationHistoryItem] = Field(default_factory=list)
    total: int = 0


class EvaluationTrendResponse(BaseModel):
    user_id: int
    course_code: str
    total: int = 0
    latest_score: float | None = None
    average_score: float | None = None
    best_score: float | None = None
    improvement: float | None = None
    latest_mastery_level: str | None = None
    focus_knowledge_points: list[str] = Field(default_factory=list)


class EvaluationPaperSummaryResponse(BaseModel):
    user_id: int
    course_code: str | None = None
    total: int = 0
    total_questions: int = 0
    by_paper_type: dict[str, int] = Field(default_factory=dict)
    by_question_type: dict[str, int] = Field(default_factory=dict)
    by_knowledge_point: dict[str, int] = Field(default_factory=dict)
    latest_paper_at: str | None = None


class WrongQuestionItem(BaseModel):
    question_id: str
    prompt: str
    knowledge_point: str
    user_answer: str
    correct_answer: str
    explanation: str


class WrongQuestionListResponse(BaseModel):
    items: list[WrongQuestionItem] = Field(default_factory=list)
    total: int = 0


class WrongQuestionSummaryResponse(BaseModel):
    record_id: int
    paper_id: int | None = None
    total: int = 0
    by_knowledge_point: dict[str, int] = Field(default_factory=dict)
    by_question_type: dict[str, int] = Field(default_factory=dict)


# ==================== 新增评估系统 Schema ====================


class QuestionGenerateRequest(BaseModel):
    """题目生成请求"""

    test_id: int
    knowledge_points: list[str] = Field(default_factory=list)
    difficulty_level: int = 1  # 1-基础, 2-进阶, 3-拔高
    question_type: int = 1  # 1-单选, 2-多选, 3-判断, 4-填空, 5-简答, 6-编程
    count: int = 5
    generate_layered: bool = False
    course_context: str = ""
    # Java 等业务端自行写入 MySQL 时可关闭,避免与 Python 侧 PostgreSQL 双写不一致
    persist_to_db: bool = True


class GeneratedQuestion(BaseModel):
    """生成的题目"""

    question_content: str
    question_options: list[dict] = Field(default_factory=list)
    correct_answer: str
    answer_analysis: str
    knowledge_point: str
    difficulty_level: int
    question_type: int
    quality_score: float | None = None


class QuestionGenerateResponse(BaseModel):
    """题目生成响应"""

    test_id: int
    questions: list[GeneratedQuestion] = Field(default_factory=list)
    layered_questions: dict[str, list[GeneratedQuestion]] | None = None
    total_count: int = 0


class AnswerGradingRequest(BaseModel):
    """答案批改请求"""

    test_id: int
    user_id: int
    answers: dict[str, str] = Field(default_factory=dict)  # question_id -> user_answer
    # 若传入题目快照,则不从 Python 库加载(供 Java MySQL 主库场景)
    questions: list[dict[str, Any]] | None = None
    persist_results: bool = True


class GradingResult(BaseModel):
    """批改结果"""

    question_id: str
    user_answer: str
    is_correct: int | None = None  # 0-错误, 1-正确, None-待批改
    score: float | None = None
    grading_type: int  # 1-自动批改, 2-AI批改, 3-人工批改
    grading_feedback: str = ""


class AnswerGradingResponse(BaseModel):
    """答案批改响应"""

    test_id: int
    user_id: int
    grading_results: list[GradingResult] = Field(default_factory=list)
    summary: dict = Field(default_factory=dict)


class AssessmentRequest(BaseModel):
    """效果评估请求"""

    test_id: int
    user_id: int
    questions: list[dict[str, Any]] | None = None
    grading_results: list[dict[str, Any]] | None = None
    test_record: dict[str, Any] | None = None


class KnowledgeMasteryItem(BaseModel):
    """知识点掌握度项"""

    knowledge_point: str
    total_questions: int
    correct_count: int
    accuracy_rate: float
    mastery_level: int  # 0-未掌握, 1-初步了解, 2-基本掌握, 3-熟练掌握, 4-精通


class AbilityDimension(BaseModel):
    """能力维度"""

    level: int
    level_name: str
    total_questions: int
    correct_count: int
    accuracy_rate: float
    status: str


class LearningEfficiency(BaseModel):
    """学习效率"""

    time_spent_seconds: int
    time_spent_minutes: float
    avg_time_per_question: float
    time_efficiency: float
    accuracy_rate: float
    overall_efficiency: float
    efficiency_level: str


class AssessmentResponse(BaseModel):
    """效果评估响应"""

    test_id: int
    user_id: int
    overall_score: float
    mastery_level: str
    knowledge_mastery: dict = Field(default_factory=dict)
    ability_analysis: dict = Field(default_factory=dict)
    learning_efficiency: dict = Field(default_factory=dict)


class ReportGenerateRequest(BaseModel):
    """报告生成请求"""

    test_id: int | None = None
    user_id: int
    course_id: int
    report_type: int = 1  # 1-单次测评报告, 2-阶段性报告, 3-综合报告
    time_range_start: str | None = None
    time_range_end: str | None = None
    questions: list[dict[str, Any]] | None = None
    grading_results: list[dict[str, Any]] | None = None
    assessment_result: dict[str, Any] | None = None
    persist_report: bool = True


class ReportGenerateResponse(BaseModel):
    """报告生成响应"""

    report_id: int | None = None
    user_id: int
    course_id: int
    report_type: int
    overall_score: float
    mastery_level: str
    report_summary: str
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    improvement_suggestions: list[str] = Field(default_factory=list)
    recommended_resources: list[dict] = Field(default_factory=list)
    knowledge_mastery: dict = Field(default_factory=dict)
    ability_analysis: dict = Field(default_factory=dict)
    learning_efficiency: dict = Field(default_factory=dict)
