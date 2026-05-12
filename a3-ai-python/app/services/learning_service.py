from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from itertools import count

from fastapi import HTTPException

from app.schemas.learning import (
    LearningExamGenerateRequest,
    LearningExamSubmitRequest,
    LearningLikeRequest,
    LearningNoteCreateRequest,
    LearningNoteUpdateRequest,
    LearningPageResponse,
    LearningQuestionCreateRequest,
    LearningQuestionUpdateRequest,
    LearningReplyCreateRequest,
)


class LearningService:
    DEMO_USER = {
        "id": 1,
        "name": "A3 演示学员",
        "icon": "/src/assets/icon.jpeg",
    }
    _question_id_seq = count(3001)
    _reply_id_seq = count(8001)
    _note_id_seq = count(5001)
    _exam_id_seq = count(9001)
    _initialized = False
    _questions: list[dict] = []
    _replies: list[dict] = []
    _notes: list[dict] = []
    _exams: dict[int, dict] = {}

    def __init__(self) -> None:
        self._bootstrap()

    @classmethod
    def _bootstrap(cls) -> None:
        if cls._initialized:
            return
        now = cls._now()
        cls._questions = [
            {
                "id": 3001,
                "course_id": 101,
                "chapter_id": 1011,
                "section_id": 10111,
                "title": "项目导览这一节怎么串起整条演示链路？",
                "description": "我想把课程浏览、学习画像、学习报告连成一段讲解，想知道这一节更推荐先讲哪个页面。",
                "anonymity": False,
                "user_id": 1,
                "user_name": "A3 演示学员",
                "user_icon": "/src/assets/icon.jpeg",
                "create_time": now,
            },
            {
                "id": 3002,
                "course_id": 101,
                "chapter_id": 1012,
                "section_id": 10121,
                "title": "资源包生成策略需要重点展示哪些输入？",
                "description": "现在验收时会问资源推荐是怎么个性化出来的，想准备一套简明说法。",
                "anonymity": True,
                "user_id": 2,
                "user_name": "匿名用户",
                "user_icon": "/src/assets/anonymity.png",
                "create_time": now,
            },
        ]
        cls._replies = [
            {
                "id": 8001,
                "question_id": 3001,
                "answer_id": None,
                "target_reply_id": None,
                "target_user_id": None,
                "content": "建议先从首页入口和课程目标切入，再过渡到学习页里的目录、问答和报告，这样叙事最顺。",
                "anonymity": False,
                "user_id": 11,
                "user_name": "A3 助教",
                "user_icon": "/src/assets/icon.jpeg",
                "create_time": now,
                "liked": False,
                "liked_times": 2,
            },
            {
                "id": 8002,
                "question_id": 3001,
                "answer_id": 8001,
                "target_reply_id": 8001,
                "target_user_id": 11,
                "content": "如果是答辩场景，可以把“真实接口已打通”作为第二层强调点。",
                "anonymity": False,
                "user_id": 1,
                "user_name": "A3 演示学员",
                "user_icon": "/src/assets/icon.jpeg",
                "create_time": now,
                "liked": False,
                "liked_times": 0,
            },
        ]
        cls._notes = [
            {
                "id": 5001,
                "course_id": 101,
                "chapter_id": 1011,
                "section_id": 10111,
                "author_id": 1,
                "author_name": "A3 演示学员",
                "author_icon": "/src/assets/icon.jpeg",
                "content": "先讲业务目标，再落到多智能体协同，答辩时更容易让评委跟上。",
                "note_moment": 96,
                "is_private": False,
                "is_gathered": False,
                "create_time": now,
            },
            {
                "id": 5002,
                "course_id": 101,
                "chapter_id": 1012,
                "section_id": 10121,
                "author_id": 12,
                "author_name": "课程教研组",
                "author_icon": "/src/assets/icon.jpeg",
                "content": "个性化资源展示时，记得把“输入画像”和“输出资源包”放在同一屏上说明。",
                "note_moment": 182,
                "is_private": False,
                "is_gathered": True,
                "create_time": now,
            },
        ]
        cls._initialized = True

    async def list_questions(
        self,
        *,
        course_id: int | None = None,
        section_id: int | None = None,
        only_mine: bool = False,
        page_no: int = 1,
        page_size: int = 10,
    ) -> LearningPageResponse:
        items = list(self._questions)
        if course_id is not None:
            items = [item for item in items if item["course_id"] == course_id]
        if section_id:
            items = [item for item in items if item["section_id"] == section_id]
        if only_mine:
            items = [item for item in items if item["user_id"] == self.DEMO_USER["id"]]
        items.sort(key=lambda item: item["id"], reverse=True)
        enriched = [self._build_question_view(item) for item in items]
        return self._page(enriched, page_no=page_no, page_size=page_size)

    async def create_question(self, request: LearningQuestionCreateRequest) -> dict:
        question = {
            "id": next(self._question_id_seq),
            "course_id": request.course_id,
            "chapter_id": request.chapter_id,
            "section_id": request.section_id,
            "title": request.title.strip(),
            "description": request.description.strip(),
            "anonymity": request.anonymity,
            "user_id": self.DEMO_USER["id"],
            "user_name": "匿名用户" if request.anonymity else self.DEMO_USER["name"],
            "user_icon": "/src/assets/anonymity.png" if request.anonymity else self.DEMO_USER["icon"],
            "create_time": self._now(),
        }
        self._questions.append(question)
        return self._build_question_view(question)

    async def get_question(self, question_id: int) -> dict:
        return self._build_question_view(self._get_question_or_404(question_id))

    async def update_question(self, question_id: int, request: LearningQuestionUpdateRequest) -> dict:
        question = self._get_question_or_404(question_id)
        question["course_id"] = request.course_id
        question["chapter_id"] = request.chapter_id
        question["section_id"] = request.section_id
        question["title"] = request.title.strip()
        question["description"] = request.description.strip()
        question["anonymity"] = request.anonymity
        question["user_name"] = "匿名用户" if request.anonymity else self.DEMO_USER["name"]
        question["user_icon"] = "/src/assets/anonymity.png" if request.anonymity else self.DEMO_USER["icon"]
        return self._build_question_view(question)

    async def delete_question(self, question_id: int) -> dict:
        question = self._get_question_or_404(question_id)
        self._questions = [item for item in self._questions if item["id"] != question_id]
        self._replies = [item for item in self._replies if item["question_id"] != question_id]
        return {"deleted": True, "id": question["id"]}

    async def list_replies(
        self,
        *,
        question_id: int | None = None,
        answer_id: int | None = None,
        page_no: int = 1,
        page_size: int = 10,
    ) -> LearningPageResponse:
        if answer_id is not None:
            items = [item for item in self._replies if item["answer_id"] == answer_id]
        else:
            items = [item for item in self._replies if item["question_id"] == question_id and item["answer_id"] is None]
        items.sort(key=lambda item: item["id"])
        enriched = [self._build_reply_view(item) for item in items]
        return self._page(enriched, page_no=page_no, page_size=page_size)

    async def create_reply(self, request: LearningReplyCreateRequest) -> dict:
        self._get_question_or_404(request.question_id)
        reply_id = next(self._reply_id_seq)
        is_nested = request.answer_id is not None
        reply = {
            "id": reply_id,
            "question_id": request.question_id,
            "answer_id": request.answer_id if is_nested else None,
            "target_reply_id": request.target_reply_id,
            "target_user_id": request.target_user_id,
            "content": request.content.strip(),
            "anonymity": request.anonymity,
            "user_id": self.DEMO_USER["id"],
            "user_name": "匿名用户" if request.anonymity else self.DEMO_USER["name"],
            "user_icon": "/src/assets/anonymity.png" if request.anonymity else self.DEMO_USER["icon"],
            "create_time": self._now(),
            "liked": False,
            "liked_times": 0,
        }
        self._replies.append(reply)
        return self._build_reply_view(reply)

    async def toggle_like(self, request: LearningLikeRequest) -> dict:
        if request.biz_type != "QA":
            raise HTTPException(status_code=400, detail="unsupported biz type")
        reply = self._get_reply_or_404(request.biz_id)
        reply["liked"] = request.liked
        base = max(0, int(reply.get("liked_times", 0)))
        reply["liked_times"] = base + 1 if request.liked and not reply.get("_counted") else base
        if not request.liked:
            reply["liked_times"] = max(0, reply["liked_times"] - 1)
        reply["_counted"] = request.liked
        return {"liked": reply["liked"], "liked_times": reply["liked_times"]}

    async def list_notes(
        self,
        *,
        course_id: int | None = None,
        section_id: int | None = None,
        only_mine: bool = True,
        page_no: int = 1,
        page_size: int = 1000,
    ) -> LearningPageResponse:
        items = list(self._notes)
        if course_id is not None:
            items = [item for item in items if item["course_id"] == course_id]
        if section_id:
            items = [item for item in items if item["section_id"] == section_id]
        if only_mine:
            items = [item for item in items if item["author_id"] == self.DEMO_USER["id"]]
        items.sort(key=lambda item: item["id"], reverse=True)
        return self._page([self._build_note_view(item) for item in items], page_no=page_no, page_size=page_size)

    async def create_note(self, request: LearningNoteCreateRequest) -> dict:
        note = {
            "id": next(self._note_id_seq),
            "course_id": request.course_id,
            "chapter_id": request.chapter_id,
            "section_id": request.section_id,
            "author_id": self.DEMO_USER["id"],
            "author_name": self.DEMO_USER["name"],
            "author_icon": self.DEMO_USER["icon"],
            "content": request.content.strip(),
            "note_moment": request.note_moment,
            "is_private": request.is_private,
            "is_gathered": False,
            "create_time": self._now(),
        }
        self._notes.append(note)
        return self._build_note_view(note)

    async def update_note(self, note_id: int, request: LearningNoteUpdateRequest) -> dict:
        note = self._get_note_or_404(note_id)
        note["content"] = request.content.strip()
        note["is_private"] = request.is_private
        return self._build_note_view(note)

    async def delete_note(self, note_id: int) -> dict:
        self._get_note_or_404(note_id)
        self._notes = [item for item in self._notes if item["id"] != note_id]
        return {"deleted": True, "id": note_id}

    async def gather_note(self, note_id: int, gathered: bool) -> dict:
        note = self._get_note_or_404(note_id)
        note["is_gathered"] = gathered
        return self._build_note_view(note)

    async def generate_exam(self, request: LearningExamGenerateRequest) -> dict:
        exam_id = next(self._exam_id_seq)
        questions = [
            {
                "id": exam_id * 10 + 1,
                "type": 1,
                "name": "下面哪一项最适合作为学习页演示的主线？",
                "options": ["先讲技术栈，再讲业务目标", "先讲业务目标，再串起目录、问答和报告", "直接展示数据库表结构"],
                "answers": "",
            },
            {
                "id": exam_id * 10 + 2,
                "type": 5,
                "name": "请用一句话说明个性化资源推荐为什么可信。",
                "options": [],
                "answers": "",
            },
        ]
        self._exams[exam_id] = {"id": exam_id, "request": request.model_dump(), "questions": deepcopy(questions)}
        return {"id": exam_id, "questions": questions}

    async def submit_exam(self, request: LearningExamSubmitRequest) -> list[dict]:
        exam = self._exams.get(request.id)
        if exam is None:
            raise HTTPException(status_code=404, detail="exam not found")
        answer_map = {item.question_id: item.answer for item in request.exam_details}
        result = []
        for item in deepcopy(exam["questions"]):
            item["answers"] = answer_map.get(item["id"], "")
            result.append(item)
        return result

    def _build_question_view(self, item: dict) -> dict:
        replies = [reply for reply in self._replies if reply["question_id"] == item["id"]]
        latest = max(replies, key=lambda reply: reply["id"], default=None)
        answer_count = len([reply for reply in replies if reply["answer_id"] is None])
        return {
            "id": item["id"],
            "courseId": item["course_id"],
            "chapterId": item["chapter_id"],
            "sectionId": item["section_id"],
            "title": item["title"],
            "description": item["description"],
            "anonymity": item["anonymity"],
            "userId": item["user_id"],
            "userName": item["user_name"],
            "userIcon": item["user_icon"],
            "createTime": item["create_time"],
            "answerTimes": answer_count,
            "latestAnswer": self._build_latest_answer(latest),
            "latestReplyContent": latest["content"] if latest else "",
            "latestReplyUser": latest["user_name"] if latest else "",
        }

    def _build_reply_view(self, item: dict) -> dict:
        target_user_name = ""
        if item["target_user_id"]:
            target = next((reply for reply in self._replies if reply["id"] == item["target_reply_id"]), None)
            target_user_name = target["user_name"] if target else ""
        nested_count = len([reply for reply in self._replies if reply["answer_id"] == item["id"]])
        return {
            "id": item["id"],
            "questionId": item["question_id"],
            "answerId": item["answer_id"],
            "targetReplyId": item["target_reply_id"],
            "targetUserId": item["target_user_id"],
            "targetUserName": target_user_name,
            "userId": item["user_id"],
            "userName": item["user_name"],
            "userIcon": item["user_icon"],
            "content": item["content"],
            "createTime": item["create_time"],
            "liked": item.get("liked", False),
            "likedTimes": item.get("liked_times", 0),
            "replyTimes": nested_count,
        }

    @staticmethod
    def _build_note_view(item: dict) -> dict:
        return {
            "id": item["id"],
            "courseId": item["course_id"],
            "chapterId": item["chapter_id"],
            "sectionId": item["section_id"],
            "authorId": item["author_id"],
            "authorName": item["author_name"],
            "authorIcon": item["author_icon"],
            "content": item["content"],
            "noteMoment": item["note_moment"],
            "isPrivate": item["is_private"],
            "isGathered": item["is_gathered"],
            "createTime": item["create_time"],
        }

    @staticmethod
    def _build_latest_answer(item: dict | None) -> dict | None:
        if item is None:
            return None
        return {
            "content": item["content"],
            "replier": {
                "id": item["user_id"],
                "name": item["user_name"],
            },
        }

    @staticmethod
    def _page(items: list[dict], *, page_no: int, page_size: int) -> LearningPageResponse:
        size = max(page_size, 1)
        start = max(page_no - 1, 0) * size
        return LearningPageResponse(list=items[start : start + size], total=len(items))

    def _get_question_or_404(self, question_id: int) -> dict:
        question = next((item for item in self._questions if item["id"] == question_id), None)
        if question is None:
            raise HTTPException(status_code=404, detail="question not found")
        return question

    def _get_reply_or_404(self, reply_id: int) -> dict:
        reply = next((item for item in self._replies if item["id"] == reply_id), None)
        if reply is None:
            raise HTTPException(status_code=404, detail="reply not found")
        return reply

    def _get_note_or_404(self, note_id: int) -> dict:
        note = next((item for item in self._notes if item["id"] == note_id), None)
        if note is None:
            raise HTTPException(status_code=404, detail="note not found")
        return note

    @staticmethod
    def _now() -> str:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
