from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import rag
from app.schemas.common import Citation, KnowledgeHit
from app.schemas.rag import RagSearchResponse
from app.services import local_runtime_store as local_runtime_store_module
from app.services import rag_service as rag_service_module


app = FastAPI()
app.include_router(rag.router, prefix="/api/v1/rag")
client = TestClient(app)


def test_rag_eval_run_api(monkeypatch) -> None:
    store = {"next_run_id": 1, "next_correction_id": 1, "runs": [], "corrections": []}

    monkeypatch.setattr(
        local_runtime_store_module.LocalRuntimeStore,
        "load_rag_eval_store",
        classmethod(lambda cls: store),
    )
    monkeypatch.setattr(
        local_runtime_store_module.LocalRuntimeStore,
        "save_rag_eval_store",
        classmethod(lambda cls, payload: store.update(payload)),
    )

    async def _fake_search(self, request):
        hits = [
            KnowledgeHit(
                chunk_id=1,
                document_id=1,
                title="section_02",
                content="概要设计阶段完成系统总体结构设计、模块划分与接口关系设计。",
                score=0.95,
            ),
            KnowledgeHit(
                chunk_id=2,
                document_id=2,
                title="section_03",
                content="详细设计阶段输出模块内部算法、数据结构和处理流程说明。",
                score=0.83,
            ),
        ]
        return RagSearchResponse(
            query=request.query,
            course_code=request.course_code,
            hits=hits,
            citations=[Citation(source=hit.title, chunk_id=hit.chunk_id, score=hit.score) for hit in hits],
        )

    monkeypatch.setattr(rag_service_module.RagService, "search", _fake_search)

    response = client.post(
        "/api/v1/rag/eval/run",
        json={
            "course_code": "software_engineering_4th",
            "dataset_name": "api_sample",
            "variant_name": "context_summary",
            "strategy": "context_summary",
            "dataset": [
                {
                    "item_id": "se-02",
                    "query": "概要设计阶段主要完成什么工作？",
                    "reference_answer": "概要设计阶段需要完成系统总体结构设计、模块划分与接口关系设计。",
                    "expected_keywords": ["概要设计", "总体结构", "模块划分", "接口关系"],
                }
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["metric_count"] >= 20
    assert body["items"][0]["candidate_answer"]
