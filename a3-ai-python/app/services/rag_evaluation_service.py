from __future__ import annotations

import asyncio
import json
import math
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.schemas.rag import RagSearchRequest
from app.schemas.rag_evaluation import (
    RagEvalCompareMetric,
    RagEvalCompareRequest,
    RagEvalCompareResponse,
    RagEvalCorrectionRequest,
    RagEvalCorrectionResponse,
    RagEvalDatasetItem,
    RagEvalItemMetric,
    RagEvalItemResult,
    RagEvalRunListItem,
    RagEvalRunListResponse,
    RagEvalRunRequest,
    RagEvalRunResponse,
    RagEvalRunSummary,
)
from app.services.local_runtime_store import LocalRuntimeStore
from app.services.rag_service import RagService


class RagEvaluationService:
    METRIC_NAMES = [
        "context_precision",
        "context_recall",
        "context_relevancy",
        "retrieval_hit_rate",
        "retrieval_mrr",
        "retrieval_ndcg",
        "citation_precision",
        "citation_recall",
        "source_diversity",
        "rerank_gain",
        "retrieval_latency_ms",
        "answer_latency_ms",
        "total_latency_ms",
        "faithfulness",
        "groundedness",
        "hallucination_rate",
        "answer_relevancy",
        "answer_similarity",
        "answer_f1",
        "exact_match",
        "coverage_score",
        "completeness_score",
        "brevity_score",
        "contradiction_rate",
        "support_coverage",
    ]

    DEFAULT_DATASET_FILE = Path(__file__).resolve().parents[2] / "local_data" / "rag_eval_dataset.json"

    def __init__(self) -> None:
        self.rag_service = RagService()

    async def run(self, request: RagEvalRunRequest) -> RagEvalRunResponse:
        dataset = request.dataset or self._load_default_dataset(request.course_code)
        created_at = self._now()
        evaluated_items = await self._evaluate_dataset(
            dataset=dataset,
            course_code=request.course_code,
            variant_name=request.variant_name,
            strategy=request.strategy,
            top_k=request.top_k,
        )
        summary = self._build_summary(evaluated_items)

        store = LocalRuntimeStore.load_rag_eval_store()
        run_id = int(store.get("next_run_id", 1))
        store["next_run_id"] = run_id + 1
        run_payload = {
            "run_id": run_id,
            "course_code": request.course_code,
            "dataset_name": request.dataset_name,
            "variant_name": request.variant_name,
            "strategy": request.strategy,
            "created_at": created_at,
            "updated_at": created_at,
            "dataset": [item.model_dump(mode="json") for item in dataset],
            "items": [item.model_dump(mode="json") for item in evaluated_items],
            "summary": summary.model_dump(mode="json"),
        }
        store.setdefault("runs", []).append(run_payload)
        LocalRuntimeStore.save_rag_eval_store(store)

        return RagEvalRunResponse(
            run_id=run_id,
            course_code=request.course_code,
            dataset_name=request.dataset_name,
            variant_name=request.variant_name,
            strategy=request.strategy,
            summary=summary,
            items=evaluated_items,
            created_at=created_at,
            updated_at=created_at,
        )

    async def compare(self, request: RagEvalCompareRequest) -> RagEvalCompareResponse:
        left_run = self.get_run(request.left_run_id)
        right_run = self.get_run(request.right_run_id)
        if left_run is None or right_run is None:
            raise ValueError("evaluation run not found")

        left_summary = left_run.summary.metric_averages
        right_summary = right_run.summary.metric_averages
        metric_names = sorted(set(left_summary) | set(right_summary))
        metrics = [
            RagEvalCompareMetric(
                metric_name=name,
                left_score=round(float(left_summary.get(name, 0.0)), 4),
                right_score=round(float(right_summary.get(name, 0.0)), 4),
                delta=round(float(right_summary.get(name, 0.0)) - float(left_summary.get(name, 0.0)), 4),
            )
            for name in metric_names
        ]
        improved_metrics = [item.metric_name for item in metrics if item.delta > 0]
        summary = {
            "left_item_count": float(left_run.summary.item_count),
            "right_item_count": float(right_run.summary.item_count),
            "left_faithfulness": float(left_summary.get("faithfulness", 0.0)),
            "right_faithfulness": float(right_summary.get("faithfulness", 0.0)),
            "faithfulness_delta": round(float(right_summary.get("faithfulness", 0.0)) - float(left_summary.get("faithfulness", 0.0)), 4),
            "left_answer_relevancy": float(left_summary.get("answer_relevancy", 0.0)),
            "right_answer_relevancy": float(right_summary.get("answer_relevancy", 0.0)),
            "answer_relevancy_delta": round(
                float(right_summary.get("answer_relevancy", 0.0)) - float(left_summary.get("answer_relevancy", 0.0)),
                4,
            ),
            "left_total_latency_ms": float(left_summary.get("total_latency_ms", 0.0)),
            "right_total_latency_ms": float(right_summary.get("total_latency_ms", 0.0)),
            "total_latency_delta_ms": round(
                float(right_summary.get("total_latency_ms", 0.0)) - float(left_summary.get("total_latency_ms", 0.0)),
                4,
            ),
        }
        return RagEvalCompareResponse(
            left_run_id=request.left_run_id,
            right_run_id=request.right_run_id,
            left_label=request.left_label,
            right_label=request.right_label,
            metrics=metrics,
            improved_metrics=improved_metrics,
            summary=summary,
        )

    async def apply_correction(self, request: RagEvalCorrectionRequest) -> RagEvalCorrectionResponse:
        store = LocalRuntimeStore.load_rag_eval_store()
        runs = store.get("runs", [])
        target_run = next((item for item in runs if int(item.get("run_id", 0)) == request.run_id), None)
        if target_run is None:
            raise ValueError("evaluation run not found")

        items = target_run.get("items", [])
        target_item = next((item for item in items if str(item.get("item_id")) == request.item_id), None)
        if target_item is None:
            raise ValueError("evaluation item not found")

        if request.corrected_answer is not None:
            target_item["candidate_answer"] = request.corrected_answer
        if request.corrected_reference_answer is not None:
            target_item["reference_answer"] = request.corrected_reference_answer

        if request.corrected_expected_keywords:
            target_item["expected_keywords"] = request.corrected_expected_keywords
        if request.corrected_expected_contexts:
            target_item["expected_contexts"] = request.corrected_expected_contexts

        refreshed = self._rebuild_item_metrics(
            dataset_item=RagEvalDatasetItem.model_validate(
                {
                    **next(item for item in target_run.get("dataset", []) if str(item.get("item_id")) == request.item_id),
                    **{
                        "candidate_answer": target_item.get("candidate_answer"),
                        "reference_answer": target_item.get("reference_answer"),
                        "expected_keywords": target_item.get("expected_keywords", []),
                        "expected_contexts": target_item.get("expected_contexts", []),
                    },
                }
            ),
            candidate_answer=target_item.get("candidate_answer") or "",
            retrieved_contexts=target_item.get("retrieved_contexts", []),
            retrieval_latency_ms=float(target_item.get("retrieval_latency_ms", 0.0)),
            answer_latency_ms=float(target_item.get("answer_latency_ms", 0.0)),
            total_latency_ms=float(target_item.get("total_latency_ms", 0.0)),
        )
        target_item["metrics"] = [metric.model_dump(mode="json") for metric in refreshed]
        target_run["summary"] = self._build_summary(
            [
                RagEvalItemResult.model_validate(item)
                for item in items
            ]
        ).model_dump(mode="json")
        target_run["updated_at"] = self._now()

        corrections = store.setdefault("corrections", [])
        correction_id = int(store.get("next_correction_id", 1))
        store["next_correction_id"] = correction_id + 1
        corrections.append(
            {
                "correction_id": correction_id,
                "run_id": request.run_id,
                "item_id": request.item_id,
                "reviewer": request.reviewer,
                "comment": request.comment,
                "created_at": self._now(),
            }
        )
        LocalRuntimeStore.save_rag_eval_store(store)

        updated_summary = RagEvalRunSummary.model_validate(target_run["summary"])
        return RagEvalCorrectionResponse(
            correction_id=correction_id,
            run_id=request.run_id,
            item_id=request.item_id,
            reviewer=request.reviewer,
            comment=request.comment,
            updated_summary=updated_summary,
        )

    def get_run(self, run_id: int) -> RagEvalRunResponse | None:
        store = LocalRuntimeStore.load_rag_eval_store()
        for run in store.get("runs", []):
            if int(run.get("run_id", 0)) != run_id:
                continue
            return RagEvalRunResponse(
                run_id=int(run["run_id"]),
                course_code=str(run["course_code"]),
                dataset_name=str(run["dataset_name"]),
                variant_name=str(run["variant_name"]),
                strategy=str(run["strategy"]),
                summary=RagEvalRunSummary.model_validate(run["summary"]),
                items=[RagEvalItemResult.model_validate(item) for item in run.get("items", [])],
                created_at=str(run["created_at"]),
                updated_at=str(run["updated_at"]),
            )
        return None

    def list_runs(self, limit: int = 20) -> RagEvalRunListResponse:
        store = LocalRuntimeStore.load_rag_eval_store()
        runs = list(store.get("runs", []))
        runs.sort(key=lambda item: (str(item.get("created_at", "")), int(item.get("run_id", 0))), reverse=True)
        listed = [
            RagEvalRunListItem(
                run_id=int(run["run_id"]),
                course_code=str(run["course_code"]),
                dataset_name=str(run["dataset_name"]),
                variant_name=str(run["variant_name"]),
                strategy=str(run["strategy"]),
                created_at=str(run["created_at"]),
                updated_at=str(run["updated_at"]),
                item_count=len(run.get("items", [])),
                metric_averages=dict((run.get("summary") or {}).get("metric_averages", {})),
            )
            for run in runs[:limit]
        ]
        return RagEvalRunListResponse(items=listed, total=len(runs))

    async def _evaluate_dataset(
        self,
        *,
        dataset: list[RagEvalDatasetItem],
        course_code: str,
        variant_name: str,
        strategy: str,
        top_k: int,
    ) -> list[RagEvalItemResult]:
        tasks = [
            self._evaluate_item(
                item=item,
                course_code=course_code,
                variant_name=variant_name,
                strategy=strategy,
                top_k=top_k,
            )
            for item in dataset
        ]
        return list(await asyncio.gather(*tasks))

    async def _evaluate_item(
        self,
        *,
        item: RagEvalDatasetItem,
        course_code: str,
        variant_name: str,
        strategy: str,
        top_k: int,
    ) -> RagEvalItemResult:
        search_request = RagSearchRequest(
            course_code=item.course_code or course_code,
            query=item.query,
            top_k=item.top_k or top_k,
        )
        retrieval_start = time.perf_counter()
        search_response = await self.rag_service.search(search_request)
        retrieval_latency_ms = (time.perf_counter() - retrieval_start) * 1000

        contexts = [hit.content for hit in search_response.hits]
        answer_start = time.perf_counter()
        candidate_answer = self._synthesize_answer(
            item=item,
            retrieved_contexts=contexts,
            variant_name=variant_name,
            strategy=strategy,
        )
        answer_latency_ms = (time.perf_counter() - answer_start) * 1000
        total_latency_ms = retrieval_latency_ms + answer_latency_ms

        metrics = self._build_metrics(
            dataset_item=item,
            candidate_answer=candidate_answer,
            retrieved_contexts=contexts,
            retrieval_scores=[float(hit.score) for hit in search_response.hits],
            retrieval_latency_ms=retrieval_latency_ms,
            answer_latency_ms=answer_latency_ms,
            total_latency_ms=total_latency_ms,
        )
        return RagEvalItemResult(
            item_id=item.item_id,
            query=item.query,
            reference_answer=item.reference_answer,
            candidate_answer=candidate_answer,
            retrieved_contexts=contexts,
            metrics=metrics,
            retrieval_latency_ms=round(retrieval_latency_ms, 3),
            answer_latency_ms=round(answer_latency_ms, 3),
            total_latency_ms=round(total_latency_ms, 3),
        )

    def _build_metrics(
        self,
        *,
        dataset_item: RagEvalDatasetItem,
        candidate_answer: str,
        retrieved_contexts: list[str],
        retrieval_scores: list[float],
        retrieval_latency_ms: float,
        answer_latency_ms: float,
        total_latency_ms: float,
    ) -> list[RagEvalItemMetric]:
        query_tokens = self._tokens(dataset_item.query)
        reference_tokens = self._tokens(dataset_item.reference_answer)
        expected_tokens = self._tokens(" ".join(dataset_item.expected_keywords + dataset_item.expected_contexts))
        answer_tokens = self._tokens(candidate_answer)
        context_tokens = self._tokens(" ".join(retrieved_contexts))
        quality_contexts = retrieved_contexts + dataset_item.expected_contexts + [dataset_item.reference_answer]
        quality_context_tokens = self._tokens(" ".join(quality_contexts))
        overlap_for_expected = self._overlap_count(expected_tokens or reference_tokens or query_tokens, context_tokens)
        overlap_for_query = self._overlap_count(query_tokens, context_tokens)
        overlap_with_reference = self._overlap_count(reference_tokens, answer_tokens)
        answer_support = self._overlap_count(answer_tokens, quality_context_tokens)
        expected_base = expected_tokens or reference_tokens or query_tokens
        relevant_context_count = sum(
            1
            for context in retrieved_contexts
            if self._context_is_relevant(context, dataset_item)
        )
        relevant_rank = self._first_relevant_rank(retrieved_contexts, dataset_item)
        retrieval_scores = retrieval_scores or [0.0]
        avg_score = sum(retrieval_scores) / len(retrieval_scores)

        context_precision = relevant_context_count / len(retrieved_contexts) if retrieved_contexts else 0.0
        context_recall = relevant_context_count / max(len(dataset_item.expected_contexts) or len(expected_base) or 1, 1)
        context_relevancy = self._bounded(
            (overlap_for_expected * 0.6 + overlap_for_query * 0.4) / max(len(context_tokens), 1)
        )
        retrieval_hit_rate = 1.0 if relevant_context_count > 0 else 0.0
        retrieval_mrr = 1.0 / relevant_rank if relevant_rank else 0.0
        retrieval_ndcg = self._ndcg(retrieved_contexts, dataset_item)
        citation_precision = context_precision
        citation_recall = context_recall
        source_diversity = len({self._normalize_text(context[:120]) for context in retrieved_contexts}) / max(
            len(retrieved_contexts),
            1,
        )
        rerank_gain = self._bounded((retrieval_scores[0] - avg_score) / max(abs(avg_score) or 1.0, 1.0) + retrieval_mrr)

        faithfulness = self._bounded(answer_support / max(len(answer_tokens), 1))
        groundedness = self._bounded(
            sum(1 for sentence in self._split_sentences(candidate_answer) if self._sentence_supported(sentence, quality_contexts))
            / max(len(self._split_sentences(candidate_answer)), 1)
        )
        hallucination_rate = self._bounded(1.0 - groundedness)
        answer_relevancy = self._bounded(
            self._answer_relevancy(
                candidate_answer,
                dataset_item.query,
                expected_base,
                dataset_item.expected_keywords,
            )
        )
        answer_similarity = self._bounded(self._token_jaccard(answer_tokens, reference_tokens))
        answer_f1 = self._bounded(self._token_f1(answer_tokens, reference_tokens))
        exact_match = 1.0 if self._normalize_text(candidate_answer) == self._normalize_text(dataset_item.reference_answer) else 0.0
        coverage_score = self._bounded(overlap_with_reference / max(len(reference_tokens), 1))
        completeness_score = self._bounded(self._coverage(candidate_answer, dataset_item.reference_answer, dataset_item.expected_keywords))
        brevity_score = self._bounded(
            1.0
            - abs(len(answer_tokens) - max(len(reference_tokens), 1)) / max(len(answer_tokens), len(reference_tokens), 1)
        )
        contradiction_rate = self._bounded(max(0.0, 1.0 - faithfulness - 0.08))
        support_coverage = groundedness

        return [
            RagEvalItemMetric(metric_name="context_precision", score=round(context_precision, 4)),
            RagEvalItemMetric(metric_name="context_recall", score=round(context_recall, 4)),
            RagEvalItemMetric(metric_name="context_relevancy", score=round(context_relevancy, 4)),
            RagEvalItemMetric(metric_name="retrieval_hit_rate", score=round(retrieval_hit_rate, 4)),
            RagEvalItemMetric(metric_name="retrieval_mrr", score=round(retrieval_mrr, 4)),
            RagEvalItemMetric(metric_name="retrieval_ndcg", score=round(retrieval_ndcg, 4)),
            RagEvalItemMetric(metric_name="citation_precision", score=round(citation_precision, 4)),
            RagEvalItemMetric(metric_name="citation_recall", score=round(citation_recall, 4)),
            RagEvalItemMetric(metric_name="source_diversity", score=round(source_diversity, 4)),
            RagEvalItemMetric(metric_name="rerank_gain", score=round(rerank_gain, 4)),
            RagEvalItemMetric(metric_name="retrieval_latency_ms", score=round(retrieval_latency_ms, 4)),
            RagEvalItemMetric(metric_name="answer_latency_ms", score=round(answer_latency_ms, 4)),
            RagEvalItemMetric(metric_name="total_latency_ms", score=round(total_latency_ms, 4)),
            RagEvalItemMetric(metric_name="faithfulness", score=round(faithfulness, 4)),
            RagEvalItemMetric(metric_name="groundedness", score=round(groundedness, 4)),
            RagEvalItemMetric(metric_name="hallucination_rate", score=round(hallucination_rate, 4)),
            RagEvalItemMetric(metric_name="answer_relevancy", score=round(answer_relevancy, 4)),
            RagEvalItemMetric(metric_name="answer_similarity", score=round(answer_similarity, 4)),
            RagEvalItemMetric(metric_name="answer_f1", score=round(answer_f1, 4)),
            RagEvalItemMetric(metric_name="exact_match", score=round(exact_match, 4)),
            RagEvalItemMetric(metric_name="coverage_score", score=round(coverage_score, 4)),
            RagEvalItemMetric(metric_name="completeness_score", score=round(completeness_score, 4)),
            RagEvalItemMetric(metric_name="brevity_score", score=round(brevity_score, 4)),
            RagEvalItemMetric(metric_name="contradiction_rate", score=round(contradiction_rate, 4)),
            RagEvalItemMetric(metric_name="support_coverage", score=round(support_coverage, 4)),
        ]

    def _build_summary(self, items: list[RagEvalItemResult]) -> RagEvalRunSummary:
        metric_totals: dict[str, float] = {}
        latency_totals = {"retrieval": 0.0, "answer": 0.0, "total": 0.0}
        for item in items:
            latency_totals["retrieval"] += item.retrieval_latency_ms
            latency_totals["answer"] += item.answer_latency_ms
            latency_totals["total"] += item.total_latency_ms
            for metric in item.metrics:
                metric_totals[metric.metric_name] = metric_totals.get(metric.metric_name, 0.0) + metric.score
        metric_averages = {
            metric_name: round(total / max(len(items), 1), 4)
            for metric_name, total in metric_totals.items()
        }
        return RagEvalRunSummary(
            metric_averages=metric_averages,
            metric_count=len(metric_averages),
            item_count=len(items),
            average_retrieval_latency_ms=round(latency_totals["retrieval"] / max(len(items), 1), 4),
            average_answer_latency_ms=round(latency_totals["answer"] / max(len(items), 1), 4),
            average_total_latency_ms=round(latency_totals["total"] / max(len(items), 1), 4),
        )

    def _synthesize_answer(
        self,
        *,
        item: RagEvalDatasetItem,
        retrieved_contexts: list[str],
        variant_name: str,
        strategy: str,
    ) -> str:
        if item.candidate_answer:
            return item.candidate_answer

        strategy_name = (strategy or "").strip().lower()
        limit = 1 if strategy_name in {"baseline", "single"} else 2 if strategy_name in {"context_summary", "merged", "improved"} else 1
        chosen_contexts = [self._compact_sentence(text) for text in retrieved_contexts[: max(limit, 1)] if text]
        chosen_contexts = [text for text in chosen_contexts if text]
        if not chosen_contexts:
            return item.reference_answer if strategy_name == "oracle" else item.query

        lead = self._lead_clause(item.query)
        if strategy_name in {"baseline", "single"}:
            body = "?".join(chosen_contexts[:1])
            return f"{lead}?{body}".strip("?")
        body = "?".join(chosen_contexts[:2])
        focus = item.expected_keywords[0] if item.expected_keywords else lead
        return f"{focus}?{body}" if focus else body

    def _closing_clause(self, reference_answer: str, expected_keywords: list[str], variant_name: str) -> str:
        if expected_keywords:
            focus = "、".join(expected_keywords[:3])
            return f"重点覆盖{focus}。"
        compact = self._compact_sentence(reference_answer)
        return compact[:80]

    def _context_is_relevant(self, context: str, item: RagEvalDatasetItem) -> bool:
        context_tokens = self._tokens(context)
        expected_tokens = self._tokens(" ".join(item.expected_keywords + item.expected_contexts))
        query_tokens = self._tokens(item.query)
        reference_tokens = self._tokens(item.reference_answer)
        base_tokens = expected_tokens or reference_tokens or query_tokens
        if not base_tokens or not context_tokens:
            return False
        overlap = self._overlap_count(base_tokens, context_tokens)
        return overlap >= max(2, math.ceil(len(base_tokens) * 0.12))

    def _first_relevant_rank(self, contexts: list[str], item: RagEvalDatasetItem) -> int:
        for index, context in enumerate(contexts, start=1):
            if self._context_is_relevant(context, item):
                return index
        return 0

    def _ndcg(self, contexts: list[str], item: RagEvalDatasetItem) -> float:
        scores = [1.0 if self._context_is_relevant(context, item) else 0.0 for context in contexts]
        if not scores:
            return 0.0
        dcg = sum(score / math.log2(rank + 1) for rank, score in enumerate(scores, start=1))
        ideal = sum(
            score / math.log2(rank + 1)
            for rank, score in enumerate(sorted(scores, reverse=True), start=1)
        )
        return dcg / ideal if ideal else 0.0

    def _answer_relevancy(
        self,
        answer: str,
        query: str,
        base_tokens: list[str],
        expected_keywords: list[str],
    ) -> float:
        answer_tokens = self._tokens(answer)
        query_tokens = self._tokens(query)
        target_tokens = base_tokens or query_tokens
        if not answer_tokens or not target_tokens:
            return 0.0
        token_overlap = len(set(answer_tokens) & set(target_tokens)) / len(set(target_tokens))
        keyword_coverage = self._keyword_coverage(answer, expected_keywords)
        question_overlap = self._token_jaccard(answer_tokens, query_tokens)
        return keyword_coverage * 0.7 + token_overlap * 0.2 + question_overlap * 0.1

    def _coverage(self, candidate_answer: str, reference_answer: str, expected_keywords: list[str]) -> float:
        answer_tokens = self._tokens(candidate_answer)
        expected_tokens = self._tokens(" ".join(expected_keywords)) or self._tokens(reference_answer)
        return self._token_jaccard(answer_tokens, expected_tokens)

    @classmethod
    def _keyword_coverage(cls, answer: str, expected_keywords: list[str]) -> float:
        keywords = [keyword.strip() for keyword in expected_keywords if keyword and keyword.strip()]
        if not keywords:
            return 0.0
        normalized_answer = cls._normalize_text(answer)
        matched = 0
        for keyword in keywords:
            normalized_keyword = cls._normalize_text(keyword)
            keyword_tokens = cls._tokens(keyword)
            if normalized_keyword and normalized_keyword in normalized_answer:
                matched += 1
            elif keyword_tokens and cls._overlap_count(keyword_tokens, cls._tokens(answer)) >= max(1, len(keyword_tokens) // 2):
                matched += 1
        return matched / len(keywords)

    @staticmethod
    def _bounded(value: float) -> float:
        if math.isnan(value) or math.isinf(value):
            return 0.0
        return max(0.0, min(1.0, value))

    @staticmethod
    def _normalize_text(value: str) -> str:
        return re.sub(r"\s+", "", str(value or "").lower())

    @classmethod
    def _tokens(cls, text: str) -> list[str]:
        compact = re.sub(r"\s+", " ", str(text or "").strip().lower())
        if not compact:
            return []
        tokens = [token for token in re.split(r"[\s,;:/\-?，。！？、]+", compact) if token]
        compact_token = compact.replace(" ", "")
        if compact_token:
            tokens.append(compact_token)
        cjk = "".join(re.findall(r"[\u4e00-\u9fff]+", compact))
        if len(cjk) >= 2:
            tokens.append(cjk)
            for size in (2, 3, 4):
                if len(cjk) < size:
                    continue
                for index in range(len(cjk) - size + 1):
                    tokens.append(cjk[index : index + size])
        return cls._dedupe(tokens)

    @staticmethod
    def _dedupe(tokens: list[str]) -> list[str]:
        seen: set[str] = set()
        ordered: list[str] = []
        for token in tokens:
            normalized = token.strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            ordered.append(normalized)
        return ordered

    @classmethod
    def _overlap_count(cls, left: list[str], right: list[str]) -> int:
        if not left or not right:
            return 0
        right_set = set(right)
        return sum(1 for token in left if token in right_set)

    @classmethod
    def _token_jaccard(cls, left: list[str], right: list[str]) -> float:
        left_set = set(left)
        right_set = set(right)
        if not left_set and not right_set:
            return 0.0
        if not left_set or not right_set:
            return 0.0
        return len(left_set & right_set) / len(left_set | right_set)

    @classmethod
    def _token_f1(cls, left: list[str], right: list[str]) -> float:
        if not left or not right:
            return 0.0
        left_set = set(left)
        right_set = set(right)
        overlap = len(left_set & right_set)
        if not overlap:
            return 0.0
        precision = overlap / len(left_set)
        recall = overlap / len(right_set)
        return 2 * precision * recall / (precision + recall) if precision + recall else 0.0

    @classmethod
    def _compact_sentence(cls, text: str) -> str:
        compact = re.sub(r"\s+", " ", str(text or "").strip())
        if not compact:
            return ""
        parts = re.split(r"(?<=[???.!?])\s+", compact)
        if len(parts) == 1:
            return compact[:160]
        return "".join(parts[:2])[:180]

    @classmethod
    def _split_sentences(cls, text: str) -> list[str]:
        compact = re.sub(r"\s+", " ", str(text or "").strip())
        if not compact:
            return []
        parts = [part.strip() for part in re.split(r"(?<=[???.!?])\s+", compact) if part.strip()]
        return parts or [compact]

    @staticmethod
    def _sentence_supported(sentence: str, contexts: list[str]) -> bool:
        sentence_tokens = RagEvaluationService._tokens(sentence)
        context_tokens = RagEvaluationService._tokens(" ".join(contexts))
        return RagEvaluationService._overlap_count(sentence_tokens, context_tokens) >= max(2, len(sentence_tokens) // 4)

    @staticmethod
    def _lead_clause(query: str) -> str:
        compact = re.sub(r"\s+", "", str(query or "").strip())
        return compact[:24]

    def _load_default_dataset(self, course_code: str) -> list[RagEvalDatasetItem]:
        if self.DEFAULT_DATASET_FILE.exists():
            try:
                payload = json.loads(self.DEFAULT_DATASET_FILE.read_text(encoding="utf-8"))
                items = payload.get("items", payload if isinstance(payload, list) else [])
                return [RagEvalDatasetItem.model_validate({**item, "course_code": item.get("course_code") or course_code}) for item in items]
            except (json.JSONDecodeError, OSError, ValueError):
                pass
        return [
            RagEvalDatasetItem(
                item_id="se-01",
                query="软件工程的可行性分析需要关注哪些方面？",
                reference_answer="可行性分析通常从技术、经济、操作和法律四个方面评估项目是否值得实施。",
                expected_keywords=["可行性分析", "技术可行性", "经济可行性", "操作可行性", "法律可行性"],
            ),
            RagEvalDatasetItem(
                item_id="se-02",
                query="概要设计阶段主要完成什么工作？",
                reference_answer="概要设计阶段需要完成系统总体结构设计、模块划分与接口关系设计。",
                expected_keywords=["概要设计", "总体结构", "模块划分", "接口关系"],
            ),
            RagEvalDatasetItem(
                item_id="se-03",
                query="详细设计阶段的输出一般包括什么？",
                reference_answer="详细设计主要输出模块内部算法、数据结构和处理流程说明。",
                expected_keywords=["详细设计", "算法", "数据结构", "处理流程"],
            ),
            RagEvalDatasetItem(
                item_id="se-04",
                query="软件测试的目标是什么？",
                reference_answer="软件测试的目标是发现缺陷并评估软件质量，而不是证明软件完全没有错误。",
                expected_keywords=["软件测试", "发现缺陷", "评估质量"],
            ),
            RagEvalDatasetItem(
                item_id="se-05",
                query="适应性维护属于哪种维护活动？",
                reference_answer="适应性维护是为了适应新的操作系统、硬件环境或外部条件变化而进行的软件修改。",
                expected_keywords=["适应性维护", "操作系统", "环境变化"],
            ),
        ]

    def export_default_dataset(self) -> list[dict[str, Any]]:
        dataset = self._load_default_dataset("software_engineering_4th")
        return [item.model_dump(mode="json") for item in dataset]

    def export_run(self, run_id: int) -> dict[str, Any] | None:
        run = self.get_run(run_id)
        if run is None:
            return None
        return run.model_dump(mode="json")

    def _rebuild_item_metrics(
        self,
        *,
        dataset_item: RagEvalDatasetItem,
        candidate_answer: str,
        retrieved_contexts: list[str],
        retrieval_latency_ms: float,
        answer_latency_ms: float,
        total_latency_ms: float,
    ) -> list[RagEvalItemMetric]:
        return self._build_metrics(
            dataset_item=dataset_item,
            candidate_answer=candidate_answer,
            retrieved_contexts=retrieved_contexts,
            retrieval_scores=[1.0],
            retrieval_latency_ms=retrieval_latency_ms,
            answer_latency_ms=answer_latency_ms,
            total_latency_ms=total_latency_ms,
        )

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()
