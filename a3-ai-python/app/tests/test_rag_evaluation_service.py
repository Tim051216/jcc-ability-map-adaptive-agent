from __future__ import annotations

import pytest
from app.schemas.common import Citation, KnowledgeHit
from app.schemas.rag import RagSearchResponse
from app.schemas.rag_evaluation import (
    RagEvalCompareRequest,
    RagEvalCorrectionRequest,
    RagEvalDatasetItem,
    RagEvalRunRequest,
)
from app.services import local_runtime_store as local_runtime_store_module
from app.services import rag_service as rag_service_module
from app.services.rag_evaluation_service import RagEvaluationService


@pytest.fixture()
def rag_eval_store(monkeypatch):
    store = {"next_run_id": 1, "next_correction_id": 1, "runs": [], "corrections": []}

    monkeypatch.setattr(local_runtime_store_module.LocalRuntimeStore, "load_rag_eval_store", classmethod(lambda cls: store))
    monkeypatch.setattr(local_runtime_store_module.LocalRuntimeStore, "save_rag_eval_store", classmethod(lambda cls, payload: store.update(payload)))
    return store


@pytest.fixture()
def fake_rag_search(monkeypatch):
    async def _fake_search(self, request):
        if "可行性分析" in request.query:
            hits = [
                KnowledgeHit(
                    chunk_id=1,
                    document_id=1,
                    title="section_05",
                    content="可行性分析应评估技术、经济、操作和法律四个方面，判断项目是否值得实施。",
                    score=0.95,
                ),
                KnowledgeHit(
                    chunk_id=2,
                    document_id=2,
                    title="section_01",
                    content="需求分析阶段会明确目标和业务边界。",
                    score=0.55,
                ),
            ]
        else:
            hits = [
                KnowledgeHit(
                    chunk_id=3,
                    document_id=3,
                    title="section_02",
                    content="概要设计阶段完成系统总体结构设计、模块划分与接口关系设计。",
                    score=0.93,
                ),
                KnowledgeHit(
                    chunk_id=4,
                    document_id=4,
                    title="section_03",
                    content="详细设计阶段输出模块内部算法、数据结构和处理流程说明。",
                    score=0.82,
                ),
            ]
        return RagSearchResponse(
            query=request.query,
            course_code=request.course_code,
            hits=hits,
            citations=[Citation(source=hit.title, chunk_id=hit.chunk_id, score=hit.score) for hit in hits],
        )

    monkeypatch.setattr(rag_service_module.RagService, "search", _fake_search)


@pytest.mark.asyncio
async def test_rag_eval_run_compare_and_correction(rag_eval_store, fake_rag_search) -> None:
    service = RagEvaluationService()
    dataset = [
        RagEvalDatasetItem(
            item_id="se-01",
            query="软件工程的可行性分析需要关注哪些方面？",
            reference_answer="可行性分析通常从技术、经济、操作和法律四个方面评估项目是否值得实施。",
            expected_keywords=["可行性分析", "技术可行性", "经济可行性", "操作可行性", "法律可行性"],
            candidate_answer="可行性分析是在项目开始前判断能不能做。",
        ),
        RagEvalDatasetItem(
            item_id="se-02",
            query="概要设计阶段主要完成什么工作？",
            reference_answer="概要设计阶段需要完成系统总体结构设计、模块划分与接口关系设计。",
            expected_keywords=["概要设计", "总体结构", "模块划分", "接口关系"],
            candidate_answer="概要设计是在需求之后规划系统整体方案。",
        ),
    ]
    improved_dataset = [
        item.model_copy(
            update={
                "candidate_answer": {
                    "se-01": "可行性分析需要从技术可行性、经济可行性、操作可行性和法律可行性四个方面评估项目是否值得实施。",
                    "se-02": "概要设计阶段主要完成系统总体结构设计、模块划分以及模块之间的接口关系设计。",
                }[item.item_id]
            }
        )
        for item in dataset
    ]

    baseline = await service.run(
        RagEvalRunRequest(
            course_code="software_engineering_4th",
            dataset_name="ragas_sample",
            variant_name="baseline",
            strategy="baseline",
            dataset=dataset,
        )
    )
    improved = await service.run(
        RagEvalRunRequest(
            course_code="software_engineering_4th",
            dataset_name="ragas_sample",
            variant_name="context_summary",
            strategy="context_summary",
            dataset=improved_dataset,
        )
    )

    assert baseline.summary.metric_count >= 20
    assert improved.summary.metric_count == baseline.summary.metric_count
    assert improved.summary.metric_averages["faithfulness"] >= baseline.summary.metric_averages["faithfulness"]
    assert improved.summary.metric_averages["answer_relevancy"] >= baseline.summary.metric_averages["answer_relevancy"]

    compare = await service.compare(
        RagEvalCompareRequest(left_run_id=baseline.run_id, right_run_id=improved.run_id)
    )
    assert compare.summary["faithfulness_delta"] >= 0
    assert "faithfulness" in compare.improved_metrics or "answer_relevancy" in compare.improved_metrics

    correction = await service.apply_correction(
        RagEvalCorrectionRequest(
            run_id=improved.run_id,
            item_id="se-01",
            corrected_answer="可行性分析应重点覆盖技术、经济、操作和法律四个方面。",
            reviewer="qa",
            comment="补充评审修正",
        )
    )
    assert correction.run_id == improved.run_id
    assert correction.updated_summary.metric_count >= 20
