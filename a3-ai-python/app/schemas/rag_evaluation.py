from __future__ import annotations

from pydantic import BaseModel, Field


class RagEvalDatasetItem(BaseModel):
    item_id: str
    query: str
    reference_answer: str
    expected_keywords: list[str] = Field(default_factory=list)
    expected_contexts: list[str] = Field(default_factory=list)
    course_code: str = "software_engineering_4th"
    top_k: int = 5
    candidate_answer: str | None = None
    human_score: float | None = None
    human_comment: str | None = None


class RagEvalRunRequest(BaseModel):
    course_code: str = "software_engineering_4th"
    variant_name: str = "baseline"
    strategy: str = "context_summary"
    top_k: int = 5
    dataset_name: str = "software_engineering_4th_sample"
    dataset: list[RagEvalDatasetItem] = Field(default_factory=list)


class RagEvalItemMetric(BaseModel):
    metric_name: str
    score: float
    comment: str = ""


class RagEvalItemResult(BaseModel):
    item_id: str
    query: str
    reference_answer: str
    candidate_answer: str
    retrieved_contexts: list[str] = Field(default_factory=list)
    metrics: list[RagEvalItemMetric] = Field(default_factory=list)
    retrieval_latency_ms: float = 0.0
    answer_latency_ms: float = 0.0
    total_latency_ms: float = 0.0


class RagEvalRunSummary(BaseModel):
    metric_averages: dict[str, float] = Field(default_factory=dict)
    metric_count: int = 0
    item_count: int = 0
    average_retrieval_latency_ms: float = 0.0
    average_answer_latency_ms: float = 0.0
    average_total_latency_ms: float = 0.0


class RagEvalRunResponse(BaseModel):
    run_id: int
    course_code: str
    dataset_name: str
    variant_name: str
    strategy: str
    summary: RagEvalRunSummary
    items: list[RagEvalItemResult] = Field(default_factory=list)
    created_at: str
    updated_at: str


class RagEvalRunListItem(BaseModel):
    run_id: int
    course_code: str
    dataset_name: str
    variant_name: str
    strategy: str
    created_at: str
    updated_at: str
    item_count: int
    metric_averages: dict[str, float] = Field(default_factory=dict)


class RagEvalRunListResponse(BaseModel):
    items: list[RagEvalRunListItem] = Field(default_factory=list)
    total: int = 0


class RagEvalCompareRequest(BaseModel):
    left_run_id: int
    right_run_id: int
    left_label: str = "A"
    right_label: str = "B"


class RagEvalCompareMetric(BaseModel):
    metric_name: str
    left_score: float
    right_score: float
    delta: float


class RagEvalCompareResponse(BaseModel):
    left_run_id: int
    right_run_id: int
    left_label: str
    right_label: str
    metrics: list[RagEvalCompareMetric] = Field(default_factory=list)
    improved_metrics: list[str] = Field(default_factory=list)
    summary: dict[str, float] = Field(default_factory=dict)


class RagEvalCorrectionRequest(BaseModel):
    run_id: int
    item_id: str
    corrected_answer: str | None = None
    corrected_reference_answer: str | None = None
    corrected_expected_keywords: list[str] = Field(default_factory=list)
    corrected_expected_contexts: list[str] = Field(default_factory=list)
    reviewer: str | None = None
    comment: str | None = None


class RagEvalCorrectionResponse(BaseModel):
    correction_id: int
    run_id: int
    item_id: str
    reviewer: str | None = None
    comment: str | None = None
    updated_summary: RagEvalRunSummary
