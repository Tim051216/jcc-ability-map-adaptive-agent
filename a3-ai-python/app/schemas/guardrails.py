from pydantic import BaseModel, Field


class GuardrailIssue(BaseModel):
    label: str
    source: str
    confidence: float = 0.0
    detail: str = ""
    excerpt: str | None = None


class SafetyReview(BaseModel):
    enabled: bool = True
    blocked: bool = False
    provider: str = "local-rules"
    stage: str = "output"
    risk_level: str = "low"
    summary: str = ""
    rewritten_text: str | None = None
    issues: list[GuardrailIssue] = Field(default_factory=list)
    raw: dict = Field(default_factory=dict)


class HallucinationReview(BaseModel):
    enabled: bool = True
    grounded: bool = True
    score: float = 1.0
    method: str = "heuristic-rag"
    summary: str = ""
    unsupported_claims: list[str] = Field(default_factory=list)
    evidence_sources: list[str] = Field(default_factory=list)
    raw: dict = Field(default_factory=dict)


class GuardrailReview(BaseModel):
    input_review: SafetyReview | None = None
    output_review: SafetyReview | None = None
    hallucination_review: HallucinationReview | None = None
