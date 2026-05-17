from __future__ import annotations

from fastapi import HTTPException

from app.integrations.java_clients.learning_client import LearningClient
from app.integrations.java_clients.media_client import MediaClient
from fastapi import HTTPException

from app.schemas.course import (
    CourseSectionPlayResponse,
    CourseCardResponse,
    CourseCategoryItem,
    CourseChapterResponse,
    CourseDetailResponse,
    LearningProgressUpdateResponse,
    LearningProgressUpdateRequest,
    CourseSearchResponse,
    CourseSectionResponse,
    CourseTeacherResponse,
    LearningCourseDetailResponse,
)


class CourseService:
    DEFAULT_USER_ID = 1001

    # 先用后端静态课程目录托起学生端主链路，后续再逐步切到真实课程中心。
    COURSE_CATEGORIES = [
        {"id": 1, "name": "人工智能", "children": [{"id": 11, "name": "机器学习"}, {"id": 12, "name": "大模型应用"}]},
        {"id": 2, "name": "后端开发", "children": [{"id": 21, "name": "Java 微服务"}, {"id": 22, "name": "Spring Cloud"}]},
        {"id": 3, "name": "前端开发", "children": [{"id": 31, "name": "Vue 3"}, {"id": 32, "name": "工程化"}]},
    ]
    COURSE_FIXTURES = [
        {
            "id": 101,
            "course_code": "ml_intro",
            "name": "A3 智能学习助手实战",
            "cover_url": "/src/assets/course-covers/course-cover-ai-study.jpg",
            "price": 0,
            "sold": 1260,
            "sections": 24,
            "teacher": "A3 教学团队",
            "teacher_name": "A3 教学团队",
            "summary": "围绕画像、学习路径、资源生成与学习报告串联 A3 智能学习主链路。",
            "category_lv1": 1,
            "category_lv2": 12,
            "category_path": "人工智能/大模型应用",
            "valid_duration": 12,
            "score": 49,
            "introduce": "聚焦 A3 智能学习助手演示场景，适合从课程浏览一路演示到 AI 学习闭环。",
            "use_people": "适合需要演示多智能体学习系统、课程资源编排和学习验收闭环的团队成员。",
            "detail": "课程包含学习画像、资源推荐、学习日历、错题复盘、智能助教和学习报告等重点模块。",
            "teachers": [
                {
                    "id": 1,
                    "name": "A3 教学团队",
                    "role": "课程主讲",
                    "intro": "负责课程主线设计、演示叙事梳理与学习资源组织。",
                    "icon": "/img-tx/default-user-icon.jpg",
                    "is_show": True,
                }
            ],
            "chapters": [
                {
                    "id": 1011,
                    "index": "第一章",
                    "name": "学习画像与目标设定",
                    "sections": [
                        {"id": 10111, "index": 1, "name": "项目导览与业务目标", "type": 2, "media_duration": 540, "trailer": True},
                        {"id": 10112, "index": 2, "name": "学习画像生成流程", "type": 2, "media_duration": 720, "subject_num": 3},
                    ],
                },
                {
                    "id": 1012,
                    "index": "第二章",
                    "name": "资源生成与学习编排",
                    "sections": [
                        {"id": 10121, "index": 3, "name": "资源包生成策略", "type": 2, "media_duration": 860, "subject_num": 2},
                        {"id": 10122, "index": 4, "name": "学习日历与任务推进", "type": 2, "media_duration": 660},
                    ],
                },
                {
                    "id": 1013,
                    "index": "第三章",
                    "name": "测评复盘与报告展示",
                    "sections": [
                        {"id": 10131, "index": 5, "name": "阶段测评与错题复盘", "type": 2, "media_duration": 780, "subject_num": 4},
                        {"id": 10132, "index": 6, "name": "学习报告验收讲解", "type": 3, "media_duration": 0},
                    ],
                },
            ],
            "publish_order": 5,
        },
        {
            "id": 102,
            "course_code": "spring_cloud_bootcamp",
            "name": "Spring Cloud 微服务训练营",
            "cover_url": "/src/assets/course-covers/course-cover-microservice.jpg",
            "price": 9900,
            "sold": 880,
            "sections": 18,
            "teacher": "平台研发组",
            "teacher_name": "平台研发组",
            "summary": "聚焦服务治理、网关、注册发现和配置中心的项目化实践。",
            "category_lv1": 2,
            "category_lv2": 22,
            "category_path": "后端开发/Spring Cloud",
            "valid_duration": 12,
            "score": 47,
            "introduce": "从工程骨架到服务治理，适合演示平台型项目的后端技术底座。",
            "use_people": "适合需要补足后端系统设计与工程落地能力的同学。",
            "detail": "内容包含服务拆分、配置治理、链路追踪与部署演练。",
            "teachers": [
                {
                    "id": 2,
                    "name": "平台研发组",
                    "role": "实战导师",
                    "intro": "负责微服务拆分、链路治理与部署实践。",
                    "icon": "/img-tx/default-user-icon.jpg",
                    "is_show": True,
                }
            ],
            "chapters": [
                {
                    "id": 1021,
                    "index": "第一章",
                    "name": "微服务基础",
                    "sections": [
                        {"id": 10211, "index": 1, "name": "架构概览", "type": 2, "media_duration": 600, "trailer": True},
                        {"id": 10212, "index": 2, "name": "注册发现实践", "type": 2, "media_duration": 900},
                    ],
                },
                {
                    "id": 1022,
                    "index": "第二章",
                    "name": "网关与配置中心",
                    "sections": [
                        {"id": 10221, "index": 3, "name": "API 网关治理", "type": 2, "media_duration": 840},
                        {"id": 10222, "index": 4, "name": "配置中心联调", "type": 2, "media_duration": 720, "subject_num": 2},
                    ],
                },
            ],
            "publish_order": 4,
        },
        {
            "id": 201,
            "course_code": "vue3_engineering",
            "name": "Vue 3 项目工程化落地",
            "cover_url": "/src/assets/course-covers/course-cover-frontend.jpg",
            "price": 9900,
            "sold": 740,
            "sections": 18,
            "teacher": "前端架构组",
            "teacher_name": "前端架构组",
            "summary": "涵盖 Vue 3 工程化规范、组件复用、性能与联调实践。",
            "category_lv1": 3,
            "category_lv2": 31,
            "category_path": "前端开发/Vue 3",
            "valid_duration": 9,
            "score": 48,
            "introduce": "适合演示前台页面建设、组件抽象和前后端联调过程。",
            "use_people": "适合前端实现、交互优化与页面交付负责人。",
            "detail": "从脚手架、路由状态管理到展示页封装，覆盖比赛项目常见前端工作流。",
            "teachers": [
                {
                    "id": 3,
                    "name": "前端架构组",
                    "role": "前端导师",
                    "intro": "负责页面架构、组件抽象和展示体验优化。",
                    "icon": "/img-tx/default-user-icon.jpg",
                    "is_show": True,
                }
            ],
            "chapters": [
                {
                    "id": 2011,
                    "index": "第一章",
                    "name": "工程脚手架与规范",
                    "sections": [
                        {"id": 20111, "index": 1, "name": "项目初始化", "type": 2, "media_duration": 520, "trailer": True},
                        {"id": 20112, "index": 2, "name": "状态管理组织", "type": 2, "media_duration": 700},
                    ],
                },
                {
                    "id": 2012,
                    "index": "第二章",
                    "name": "页面设计与联调",
                    "sections": [
                        {"id": 20121, "index": 3, "name": "组件复用策略", "type": 2, "media_duration": 780},
                        {"id": 20122, "index": 4, "name": "接口联调与容错", "type": 2, "media_duration": 760, "subject_num": 2},
                    ],
                },
            ],
            "publish_order": 3,
        },
        {
            "id": 301,
            "course_code": "llm_app_intro",
            "name": "大模型应用开发导论",
            "cover_url": "/src/assets/course-covers/course-cover-llm.jpg",
            "price": 12900,
            "sold": 680,
            "sections": 20,
            "teacher": "A3 AI 实验室",
            "teacher_name": "A3 AI 实验室",
            "summary": "介绍提示词、检索增强、多智能体协作与评测闭环的基础方法。",
            "category_lv1": 1,
            "category_lv2": 12,
            "category_path": "人工智能/大模型应用",
            "valid_duration": 12,
            "score": 46,
            "introduce": "从模型能力到工程接入，帮助团队形成统一的大模型应用认知。",
            "use_people": "适合希望了解 LLM 产品实现路径与能力边界的同学。",
            "detail": "课程重点覆盖 prompt、RAG、agent 编排和结果评估。",
            "teachers": [
                {
                    "id": 4,
                    "name": "A3 AI 实验室",
                    "role": "AI 导师",
                    "intro": "负责大模型应用架构、评测与知识增强方案设计。",
                    "icon": "/img-tx/default-user-icon.jpg",
                    "is_show": True,
                }
            ],
            "chapters": [
                {
                    "id": 3011,
                    "index": "第一章",
                    "name": "大模型基础",
                    "sections": [
                        {"id": 30111, "index": 1, "name": "能力边界与典型用法", "type": 2, "media_duration": 560, "trailer": True},
                        {"id": 30112, "index": 2, "name": "提示词设计", "type": 2, "media_duration": 820},
                    ],
                },
                {
                    "id": 3012,
                    "index": "第二章",
                    "name": "RAG 与 Agent",
                    "sections": [
                        {"id": 30121, "index": 3, "name": "检索增强流程", "type": 2, "media_duration": 920},
                        {"id": 30122, "index": 4, "name": "多智能体协同", "type": 2, "media_duration": 880, "subject_num": 3},
                    ],
                },
            ],
            "publish_order": 2,
        },
        {
            "id": 302,
            "course_code": "contest_project_lab",
            "name": "软挑赛题项目实训",
            "cover_url": "/src/assets/course-covers/course-cover-bootcamp.jpg",
            "price": 0,
            "sold": 1500,
            "sections": 28,
            "teacher": "竞赛辅导组",
            "teacher_name": "竞赛辅导组",
            "summary": "围绕赛题拆解、项目分工、验收叙事和答辩材料组织展开训练。",
            "category_lv1": 2,
            "category_lv2": 21,
            "category_path": "后端开发/Java 微服务",
            "valid_duration": 6,
            "score": 50,
            "introduce": "帮助团队快速进入赛题状态，形成从需求到演示的完整推进路径。",
            "use_people": "适合比赛冲刺、答辩准备和项目统筹成员。",
            "detail": "包括业务拆解、任务排布、汇报组织与风险清单管理。",
            "teachers": [
                {
                    "id": 5,
                    "name": "竞赛辅导组",
                    "role": "赛题教练",
                    "intro": "负责赛题拆解、项目推进与答辩演示设计。",
                    "icon": "/img-tx/default-user-icon.jpg",
                    "is_show": True,
                }
            ],
            "chapters": [
                {
                    "id": 3021,
                    "index": "第一章",
                    "name": "赛题拆解",
                    "sections": [
                        {"id": 30211, "index": 1, "name": "需求理解与范围划分", "type": 2, "media_duration": 530, "trailer": True},
                        {"id": 30212, "index": 2, "name": "任务清单与分工", "type": 2, "media_duration": 790},
                    ],
                },
                {
                    "id": 3022,
                    "index": "第二章",
                    "name": "验收与答辩",
                    "sections": [
                        {"id": 30221, "index": 3, "name": "核心链路演示设计", "type": 2, "media_duration": 860},
                        {"id": 30222, "index": 4, "name": "答辩材料组织", "type": 3, "media_duration": 0, "subject_num": 1},
                    ],
                },
            ],
            "publish_order": 1,
        },
    ]

    def __init__(self) -> None:
        self.learning_client = LearningClient()
        self.media_client = MediaClient()
    RECOMMEND_BUCKETS = {
        "free": [101, 302],
        "best": [101, 102, 201, 301],
        "new": [302, 301, 201],
    }

    async def list_categories(self) -> list[CourseCategoryItem]:
        return [CourseCategoryItem.model_validate(item) for item in self.COURSE_CATEGORIES]

    async def list_recommend_courses(self, bucket: str) -> list[CourseCardResponse]:
        course_ids = self.RECOMMEND_BUCKETS.get(bucket, [])
        return [self._to_course_card(self._get_course_or_404(course_id)) for course_id in course_ids]

    async def list_interest_courses(self, interest_id: int) -> list[CourseCardResponse]:
        items = [
            self._to_course_card(course)
            for course in self.COURSE_FIXTURES
            if course["category_lv1"] == interest_id or course["category_lv2"] == interest_id
        ]
        return items[:4]

    async def search_courses(
        self,
        *,
        keyword: str | None = None,
        category_id_lv1: int | None = None,
        free: bool | None = None,
        sort_by: str | None = None,
        page_no: int = 1,
        page_size: int = 12,
    ) -> CourseSearchResponse:
        items = list(self.COURSE_FIXTURES)
        if keyword:
            lowered = keyword.strip().lower()
            items = [
                item
                for item in items
                if lowered in item["name"].lower()
                or lowered in item["summary"].lower()
                or lowered in item["teacher_name"].lower()
            ]
        if category_id_lv1:
            items = [item for item in items if item["category_lv1"] == category_id_lv1]
        if free is not None:
            items = [item for item in items if (item["price"] == 0) is free]

        if sort_by == "sold":
            items.sort(key=lambda item: item["sold"], reverse=True)
        elif sort_by == "publishTime":
            items.sort(key=lambda item: item["publish_order"], reverse=True)
        else:
            items.sort(key=lambda item: (item["score"], item["sold"]), reverse=True)

        total = len(items)
        start = max(page_no - 1, 0) * page_size
        paged_items = items[start : start + page_size]
        return CourseSearchResponse(list=[self._to_course_card(item) for item in paged_items], total=total)

    async def get_course_detail(self, course_id: int) -> CourseDetailResponse:
        course = self._get_course_or_404(course_id)
        return CourseDetailResponse(
            id=course["id"],
            course_code=course["course_code"],
            name=course["name"],
            cover_url=course["cover_url"],
            price=course["price"],
            sold=course["sold"],
            teacher=course["teacher"],
            teacher_name=course["teacher_name"],
            cata_total_num=course["sections"],
            valid_duration=course["valid_duration"],
            score=course["score"],
            cate_names=course["category_path"],
            introduce=course["introduce"],
            use_people=course["use_people"],
            detail=course["detail"],
        )

    async def list_course_teachers(self, course_id: int) -> list[CourseTeacherResponse]:
        course = self._get_course_or_404(course_id)
        return [CourseTeacherResponse.model_validate(item) for item in course["teachers"]]

    async def list_course_catalog(self, course_id: int) -> list[CourseChapterResponse]:
        course = self._get_course_or_404(course_id)
        return [self._to_course_chapter(item) for item in course["chapters"]]

    async def list_course_chapters(self, course_id: int) -> list[dict]:
        course = self._get_course_or_404(course_id)
        return [{"id": chapter["id"], "index": chapter["index"], "name": chapter["name"]} for chapter in course["chapters"]]

    async def get_learning_course_detail(self, course_id: int, user_id: int | None = None) -> LearningCourseDetailResponse:
        course = self._get_course_or_404(course_id)
        first_section = next(
            (section for chapter in course["chapters"] for section in chapter["sections"] if section["type"] in (2, 3)),
            None,
        )
        effective_user_id = user_id or self.DEFAULT_USER_ID
        learning_record = await self._get_learning_record(course_id, effective_user_id)
        latest_section_id = learning_record.latest_section_id if learning_record and learning_record.latest_section_id else first_section["id"] if first_section else None
        lesson_id = learning_record.lesson_id if learning_record and learning_record.lesson_id else course["id"] * 100
        return LearningCourseDetailResponse(
            id=course["id"],
            course_code=course["course_code"],
            name=course["name"],
            cover_url=course["cover_url"],
            teacher_name=course["teacher_name"],
            lesson_id=lesson_id,
            latest_section_id=latest_section_id,
            moment=120,
            chapters=[self._to_course_chapter(item) for item in course["chapters"]],
        )

    async def get_section_play_info(self, course_id: int, section_id: int, user_id: int | None = None) -> CourseSectionPlayResponse:
        course = self._get_course_or_404(course_id)
        self._get_section_or_404(course, section_id)
        effective_user_id = user_id or self.DEFAULT_USER_ID
        try:
            payload = await self.media_client.get_play_signature(section_id=section_id, user_id=effective_user_id)
        except Exception as exc:
            return CourseSectionPlayResponse(
                section_id=section_id,
                play_enabled=False,
                message=f"播放签名暂时不可用: {exc}",
            )
        return CourseSectionPlayResponse(
            section_id=section_id,
            play_enabled=bool(payload and payload.get("signature") and payload.get("fileId")),
            file_id=payload.get("fileId") if payload else None,
            signature=payload.get("signature") if payload else None,
            message=None if payload else "未获取到播放签名",
        )

    async def update_learning_progress(
        self,
        course_id: int,
        payload: LearningProgressUpdateRequest,
        *,
        user_id: int | None = None,
    ) -> LearningProgressUpdateResponse:
        course = self._get_course_or_404(course_id)
        self._get_section_or_404(course, payload.section_id)
        effective_user_id = user_id or self.DEFAULT_USER_ID
        learning_record = await self._get_learning_record(course_id, effective_user_id)
        lesson_id = payload.lesson_id or (learning_record.lesson_id if learning_record and learning_record.lesson_id else None)
        if lesson_id is None:
            raise HTTPException(status_code=404, detail="learning lesson not found")
        await self.learning_client.update_learning_position(
            lesson_id=lesson_id,
            section_id=payload.section_id,
            user_id=effective_user_id,
        )
        return LearningProgressUpdateResponse(
            lessonId=lesson_id,
            latestSectionId=payload.section_id,
            recorded=True,
        )

    def _get_course_or_404(self, course_id: int) -> dict:
        for item in self.COURSE_FIXTURES:
            if item["id"] == course_id:
                return item
        raise HTTPException(status_code=404, detail="course not found")

    async def _get_learning_record(self, course_id: int, user_id: int):
        try:
            return await self.learning_client.get_learning_record_by_course(course_id, user_id=user_id)
        except Exception:
            return None

    @staticmethod
    def _get_section_or_404(course: dict, section_id: int) -> dict:
        for chapter in course["chapters"]:
            for section in chapter["sections"]:
                if section["id"] == section_id:
                    return section
        raise HTTPException(status_code=404, detail="section not found")

    @staticmethod
    def _to_course_card(course: dict) -> CourseCardResponse:
        return CourseCardResponse(
            id=course["id"],
            course_code=course["course_code"],
            name=course["name"],
            cover_url=course["cover_url"],
            price=course["price"],
            sold=course["sold"],
            sections=course["sections"],
            teacher=course["teacher"],
            teacher_name=course["teacher_name"],
            summary=course["summary"],
            category_path=course["category_path"],
            valid_duration=course["valid_duration"],
            score=course["score"],
        )

    @staticmethod
    def _to_course_chapter(chapter: dict) -> CourseChapterResponse:
        sections = [CourseSectionResponse.model_validate(item) for item in chapter["sections"]]
        total_duration = sum(item.media_duration for item in sections)
        return CourseChapterResponse(
            id=chapter["id"],
            index=chapter["index"],
            name=chapter["name"],
            media_duration=total_duration,
            sections=sections,
        )


SOFTWARE_ENGINEERING_4TH_COURSE = {
    "id": 401,
    "course_code": "software_engineering_4th",
    "name": "软件工程与实践（第4版）",
    "cover_url": "/src/assets/course-covers/course-cover-bootcamp.jpg",
    "price": 0,
    "sold": 2022,
    "sections": 18,
    "teacher": "贾铁军教学团队",
    "teacher_name": "贾铁军教学团队",
    "summary": "基于真实教材配套资料整理的课程，覆盖软件工程基础、需求、设计、实现、测试、项目管理与 WebApp 综合应用。",
    "category_lv1": 2,
    "category_lv2": 21,
    "category_path": "后端开发/Java 微服务",
    "valid_duration": 12,
    "score": 50,
    "introduce": "围绕《软件工程与实践（第4版）》真实教学资源构建，适合演示课程知识库、学习计划、资源生成与智能问答。",
    "use_people": "适合软件工程课程学习者、课程资源整理者，以及需要做课程知识库接入与教学演示的团队成员。",
    "detail": "内容覆盖教学大纲、进度计划、教案、PPT、实验课设参考资料与考核要求，已接入本地知识库目录 software_engineering_4th。",
    "teachers": [
        {
            "id": 6,
            "name": "贾铁军教学团队",
            "role": "课程主讲",
            "intro": "负责软件工程课程教学设计、教材组织、实验实践与课程资源建设。",
            "icon": "/img-tx/default-user-icon.jpg",
            "is_show": True,
        }
    ],
    "chapters": [
        {
            "id": 4011,
            "index": "第一章",
            "name": "软件工程基础",
            "sections": [
                {"id": 40111, "index": 1, "name": "软件危机与软件工程概念", "type": 2, "media_duration": 900, "trailer": True},
                {"id": 40112, "index": 2, "name": "过程模型与基本原则", "type": 2, "media_duration": 960},
            ],
        },
        {
            "id": 4012,
            "index": "第二章",
            "name": "计划、需求与设计",
            "sections": [
                {"id": 40121, "index": 3, "name": "可行性分析与研发策划", "type": 2, "media_duration": 1080},
                {"id": 40122, "index": 4, "name": "软件需求分析与总体设计", "type": 2, "media_duration": 1140},
            ],
        },
        {
            "id": 4013,
            "index": "第三章",
            "name": "实现、测试与管理",
            "sections": [
                {"id": 40131, "index": 5, "name": "面向对象开发与软件实现", "type": 2, "media_duration": 1200},
                {"id": 40132, "index": 6, "name": "测试维护、项目管理与综合应用", "type": 2, "media_duration": 1260},
            ],
        },
    ],
    "publish_order": 6,
}

if not any(item.get("course_code") == SOFTWARE_ENGINEERING_4TH_COURSE["course_code"] for item in CourseService.COURSE_FIXTURES):
    CourseService.COURSE_FIXTURES.insert(0, SOFTWARE_ENGINEERING_4TH_COURSE)

if not any(item.get("id") == 4 for item in CourseService.COURSE_CATEGORIES):
    CourseService.COURSE_CATEGORIES.append(
        {"id": 4, "name": "软件工程", "children": [{"id": 41, "name": "课程实践"}]}
    )

for bucket_name in ("free", "best", "new"):
    bucket = CourseService.RECOMMEND_BUCKETS.setdefault(bucket_name, [])
    if SOFTWARE_ENGINEERING_4TH_COURSE["id"] not in bucket:
        bucket.insert(0, SOFTWARE_ENGINEERING_4TH_COURSE["id"])
