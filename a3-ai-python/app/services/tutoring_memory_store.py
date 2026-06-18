from __future__ import annotations

import secrets
import time
from datetime import datetime
from decimal import Decimal
from typing import Any


class TutoringMemoryStore:
    def __init__(self) -> None:
        self.questions: dict[int, dict[str, Any]] = {}
        self.answers: dict[int, dict[str, Any]] = {}
        self.answer_by_question: dict[int, int] = {}
        self.errors_by_question: dict[int, str] = {}
        self.generating_questions: set[int] = set()

    @staticmethod
    def _generate_id() -> int:
        return (int(time.time() * 1000) << 20) | secrets.randbelow(1 << 20)

    def create_question(
        self,
        *,
        user_id: int,
        question_text: str,
        question_images: list[str] | None,
        course_id: int | None,
        section_id: int | None,
        session_id: int | None,
        persona: str | None,
    ) -> dict[str, Any]:
        now = datetime.now()
        resolved_session_id = session_id or self._generate_id()
        question_id = self._generate_id()
        record = {
            "id": question_id,
            "session_id": resolved_session_id,
            "user_id": user_id,
            "persona": persona,
            "question_text": question_text,
            "question_images": question_images,
            "course_id": course_id,
            "section_id": section_id,
            "question_type": None,
            "knowledge_points": [],
            "difficulty_level": None,
            "question_status": 0,
            "has_answer": False,
            "is_escalated": False,
            "create_time": now,
            "update_time": now,
        }
        self.questions[question_id] = record
        self.errors_by_question.pop(question_id, None)
        return {"question_id": question_id, "session_id": resolved_session_id}

    def get_question(self, question_id: int) -> dict[str, Any] | None:
        return self.questions.get(question_id)

    def get_answer_by_question(self, question_id: int) -> dict[str, Any] | None:
        answer_id = self.answer_by_question.get(question_id)
        if answer_id is None:
            return None
        return self.answers.get(answer_id)

    def get_error(self, question_id: int) -> str | None:
        return self.errors_by_question.get(question_id)

    def mark_generating(self, question_id: int) -> None:
        self.errors_by_question.pop(question_id, None)
        self.generating_questions.add(question_id)

    def unmark_generating(self, question_id: int) -> None:
        self.generating_questions.discard(question_id)

    def is_generating(self, question_id: int) -> bool:
        return question_id in self.generating_questions

    def save_answer(self, question_id: int, result: dict[str, Any]) -> dict[str, Any]:
        question = self.questions[question_id]
        now = datetime.now()
        question["question_type"] = result.get("question_type")
        question["knowledge_points"] = list(result.get("knowledge_points") or [])
        question["question_status"] = 1
        question["has_answer"] = True
        question["is_escalated"] = bool(result.get("should_escalate"))
        question["update_time"] = now

        answer_id = self._generate_id()
        answer = {
            "id": answer_id,
            "question_id": question_id,
            "session_id": question["session_id"],
            "answer_source": 0,
            "answerer_id": None,
            "answer_text": result.get("answer_text") or "",
            "answer_diagrams": result.get("diagrams") or [],
            "answer_videos": result.get("videos") or [],
            "reference_sources": result.get("reference_sources") or [],
            "confidence_score": Decimal(str(result.get("confidence_score") or 0)),
            "generation_time": result.get("generation_time"),
            "is_helpful": None,
            "user_rating": None,
            "user_feedback": None,
            "view_count": 0,
            "create_time": now,
            "update_time": now,
        }
        self.answers[answer_id] = answer
        self.answer_by_question[question_id] = answer_id
        self.errors_by_question.pop(question_id, None)
        self.generating_questions.discard(question_id)

        return {
            "question_id": question_id,
            "session_id": question["session_id"],
            "answer_id": answer_id,
            "answer_text": answer["answer_text"],
            "diagrams": answer["answer_diagrams"],
            "videos": answer["answer_videos"],
            "reference_sources": answer["reference_sources"],
            "confidence_score": float(answer["confidence_score"]),
            "generation_time": answer["generation_time"],
            "should_escalate": question["is_escalated"],
            "question_type": question["question_type"],
            "knowledge_points": question["knowledge_points"],
        }

    def save_error(self, question_id: int, message: str) -> None:
        question = self.questions.get(question_id)
        if question is None:
            return
        question["update_time"] = datetime.now()
        self.errors_by_question[question_id] = message
        self.generating_questions.discard(question_id)

    def list_history(
        self,
        *,
        user_id: int,
        course_id: int | None = None,
        keyword: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        items = [
            question
            for question in self.questions.values()
            if question["user_id"] == user_id and (course_id is None or question["course_id"] == course_id)
        ]
        if keyword:
            lowered = keyword.lower()
            items = [
                question
                for question in items
                if lowered in str(question["question_text"]).lower()
                or lowered in str((self.get_answer_by_question(question["id"]) or {}).get("answer_text", "")).lower()
            ]
        items.sort(key=lambda item: item["create_time"], reverse=True)
        total = len(items)
        start = max(0, (page - 1) * page_size)
        page_items = items[start : start + page_size]

        result_items: list[dict[str, Any]] = []
        for question in page_items:
            answer = self.get_answer_by_question(question["id"])
            result_items.append(
                {
                    "question": question,
                    "answer": answer,
                    "is_favorited": False,
                }
            )
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": result_items,
        }


memory_tutoring_store = TutoringMemoryStore()
