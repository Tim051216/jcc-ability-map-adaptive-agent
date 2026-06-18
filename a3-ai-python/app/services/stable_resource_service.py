from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException

from app.db.repositories.resource_repository import ResourceRepository
from app.db.session import ai_data_session_factory
from app.schemas.common import ResourceCard
from app.schemas.resource import (
    ResourceArchiveRequest,
    ResourceArchiveResponse,
    ResourceDownloadAccessResponse,
    ResourceFavoriteHistoryItem,
    ResourceFavoriteHistoryListResponse,
    ResourceFavoriteResponse,
    ResourceGenerationRequest,
    ResourceGenerationResponse,
    ResourceListResponse,
)
from app.services.course_context_service import CourseContextService


class ResourceService:
    async def generate_resources(self, request: ResourceGenerationRequest) -> ResourceGenerationResponse:
        course_code = await self._resolve_course_code(course_id=request.course_id, course_code=request.course_code)
        source_titles = self._normalize_source_titles(request.knowledge_points, course_code)
        resource_types = request.resource_types or ["lecture_note", "mind_map", "teaching_plan", "quiz_set"]
        created_cards: list[ResourceCard] = []
        now = self._now_iso()

        async with ai_data_session_factory() as session:
            repo = ResourceRepository()
            for resource_type in resource_types:
                card = self._build_card(course_code=course_code, resource_type=resource_type, source_titles=source_titles)
                record = await repo.create_resource(
                    session,
                    user_id=request.user_id,
                    course_code=course_code,
                    resource_type=card.resource_type,
                    title=card.title,
                    summary=card.summary,
                    content_markdown=card.content_markdown,
                    source_titles=card.source_titles,
                    study_suggestion=card.study_suggestion,
                    generation_context={"source_titles": source_titles, "generated_by": "stable_resource_service"},
                    created_at=now,
                    updated_at=now,
                )
                created_cards.append(card.model_copy(update={"resource_id": record.id}))
            await session.commit()

        return ResourceGenerationResponse(
            task_id=None,
            recommended_order=[card.resource_type for card in created_cards],
            resources=created_cards,
        )

    async def list_resources(
        self,
        *,
        user_id: int,
        course_id: int | None = None,
        course_code: str | None = None,
        resource_type: str | None = None,
    ) -> ResourceListResponse:
        resolved_course_code = await self._resolve_course_code(course_id=course_id, course_code=course_code)
        async with ai_data_session_factory() as session:
            repo = ResourceRepository()
            items, total = await repo.list_resources(
                session,
                user_id=user_id,
                course_code=resolved_course_code,
                resource_type=resource_type,
                archived_only=False,
            )
            if not items:
                await self._seed_default_resources(
                    session=session,
                    repo=repo,
                    user_id=user_id,
                    course_code=resolved_course_code,
                )
                await session.commit()
                items, total = await repo.list_resources(
                    session,
                    user_id=user_id,
                    course_code=resolved_course_code,
                    resource_type=resource_type,
                    archived_only=False,
                )
        return ResourceListResponse(items=[self._to_card(item) for item in items], total=total)

    async def list_archived_resources(
        self,
        *,
        user_id: int,
        course_id: int | None = None,
        course_code: str | None = None,
        resource_type: str | None = None,
    ) -> ResourceListResponse:
        resolved_course_code = await self._resolve_course_code(course_id=course_id, course_code=course_code)
        async with ai_data_session_factory() as session:
            repo = ResourceRepository()
            items, total = await repo.list_resources(
                session,
                user_id=user_id,
                course_code=resolved_course_code,
                resource_type=resource_type,
                archived_only=True,
            )
        return ResourceListResponse(items=[self._to_card(item) for item in items], total=total)

    async def list_favorites(self, *, user_id: int) -> ResourceListResponse:
        async with ai_data_session_factory() as session:
            items = await ResourceRepository().list_favorites(session, user_id=user_id)
        return ResourceListResponse(items=[self._to_card(item) for item in items], total=len(items))

    async def list_favorite_history(self, *, user_id: int) -> ResourceFavoriteHistoryListResponse:
        async with ai_data_session_factory() as session:
            rows = await ResourceRepository().list_favorite_history(session, user_id=user_id)
        return ResourceFavoriteHistoryListResponse(
            items=[
                ResourceFavoriteHistoryItem(
                    resource_id=row.resource_id,
                    user_id=row.user_id,
                    action=row.action,
                    created_at=row.created_at,
                )
                for row in rows
            ],
            total=len(rows),
        )

    async def get_resource(self, resource_id: int) -> ResourceCard:
        async with ai_data_session_factory() as session:
            item = await ResourceRepository().get_resource(session, resource_id)
            if item is None:
                raise HTTPException(status_code=404, detail="resource not found")
        return self._to_card(item)

    async def get_download_access(self, *, user_id: int, resource_id: int) -> ResourceDownloadAccessResponse:
        async with ai_data_session_factory() as session:
            item = await ResourceRepository().get_resource(session, resource_id)
            if item is None:
                raise HTTPException(status_code=404, detail="resource not found")
        is_owner = int(item.user_id) == int(user_id)
        scope = "owner" if is_owner else "public"
        return ResourceDownloadAccessResponse(
            resource_id=resource_id,
            user_id=user_id,
            can_download=True,
            download_scope=scope,
            reason="资源已生成，可直接下载" if is_owner else "资源允许公开查看与下载",
        )

    async def archive_resource(self, resource_id: int, request: ResourceArchiveRequest) -> ResourceArchiveResponse:
        async with ai_data_session_factory() as session:
            item = await ResourceRepository().get_resource(session, resource_id)
            if item is None:
                raise HTTPException(status_code=404, detail="resource not found")
            item.is_archived = True
            item.archived_at = self._now_iso()
            item.archived_by = request.archived_by
            item.archive_reason = request.reason
            await session.commit()
        return ResourceArchiveResponse(
            resource_id=resource_id,
            archived=True,
            archived_by=request.archived_by,
            archive_reason=request.reason,
            archived_at=item.archived_at,
        )

    async def favorite_resource(self, *, user_id: int, resource_id: int) -> ResourceFavoriteResponse:
        now = self._now_iso()
        async with ai_data_session_factory() as session:
            repo = ResourceRepository()
            item = await repo.get_resource(session, resource_id)
            if item is None:
                raise HTTPException(status_code=404, detail="resource not found")
            favorite = await repo.get_favorite(session, user_id=user_id, resource_id=resource_id)
            if favorite is None:
                await repo.create_favorite(
                    session,
                    user_id=user_id,
                    resource_id=resource_id,
                    category="默认分类",
                    notes=None,
                    created_at=now,
                    updated_at=now,
                )
                await repo.create_favorite_history(
                    session,
                    user_id=user_id,
                    resource_id=resource_id,
                    action="favorite",
                    created_at=now,
                    updated_at=now,
                )
                await session.commit()
        return ResourceFavoriteResponse(resource_id=resource_id, user_id=user_id, favorite=True)

    async def unfavorite_resource(self, *, user_id: int, resource_id: int) -> ResourceFavoriteResponse:
        now = self._now_iso()
        async with ai_data_session_factory() as session:
            repo = ResourceRepository()
            favorite = await repo.get_favorite(session, user_id=user_id, resource_id=resource_id)
            if favorite is not None:
                await repo.delete_favorite(session, favorite)
                await repo.create_favorite_history(
                    session,
                    user_id=user_id,
                    resource_id=resource_id,
                    action="unfavorite",
                    created_at=now,
                    updated_at=now,
                )
                await session.commit()
        return ResourceFavoriteResponse(resource_id=resource_id, user_id=user_id, favorite=False)

    async def _seed_default_resources(self, *, session, repo: ResourceRepository, user_id: int, course_code: str) -> None:
        source_titles = self._normalize_source_titles([], course_code)
        for resource_type in ["lecture_note", "mind_map", "teaching_plan", "quiz_set"]:
            card = self._build_card(course_code=course_code, resource_type=resource_type, source_titles=source_titles)
            await repo.create_resource(
                session,
                user_id=user_id,
                course_code=course_code,
                resource_type=card.resource_type,
                title=card.title,
                summary=card.summary,
                content_markdown=card.content_markdown,
                source_titles=card.source_titles,
                study_suggestion=card.study_suggestion,
                generation_context={"seeded": True},
                created_at=self._now_iso(),
                updated_at=self._now_iso(),
            )

    def _build_card(self, *, course_code: str, resource_type: str, source_titles: list[str]) -> ResourceCard:
        title_focus = self._primary_focus_title(source_titles, course_code)
        course_label = self._course_label(course_code)
        if resource_type in {"lecture_note", "lecture_notes"}:
            content = self._build_handout(course_code, title_focus, source_titles)
            return ResourceCard(
                resource_type="lecture_note",
                title=f"{course_label} · {title_focus} 课堂讲义",
                summary="围绕当前章节整理出的完整讲义，可直接用于预习、复习和答辩表达。",
                content_markdown=content,
                source_titles=source_titles,
                study_suggestion="先看本节定位，再顺着结构和案例快速完成一轮复习。",
            )
        if resource_type in {"mind_map", "mindmap"}:
            content = self._build_mindmap(title_focus, source_titles)
            return ResourceCard(
                resource_type="mind_map",
                title=f"{course_label} · {title_focus} 知识导图",
                summary="按章节主线整理出的导图，适合快速建立结构感。",
                content_markdown=content,
                source_titles=source_titles,
                study_suggestion="先看一级分支，再回到课堂内容逐个补全细节。",
            )
        if resource_type in {"teaching_plan", "slides"}:
            content = self._build_teaching_plan(course_code, title_focus, source_titles)
            return ResourceCard(
                resource_type="teaching_plan",
                title=f"{course_label} · {title_focus} PPT 草案",
                summary="按课堂讲解顺序组织的课件草案，适合导出演示稿。",
                content_markdown=content,
                source_titles=source_titles,
                study_suggestion="可直接按逐页脚本扩展成展示版 PPT。",
            )
        if resource_type in {"quiz_set", "practice_set"}:
            content = self._build_quiz_json(title_focus, source_titles)
            return ResourceCard(
                resource_type="quiz_set",
                title=f"{course_label} · {title_focus} 随堂练习",
                summary="覆盖概念理解、结构辨析和场景迁移的练习题。",
                content_markdown=content,
                source_titles=source_titles,
                study_suggestion="先完成选择题，再用开放题检查迁移能力。",
            )
        if resource_type == "extended_reading":
            return ResourceCard(
                resource_type="extended_reading",
                title=f"{course_label} · {title_focus} 拓展阅读",
                summary="补充概念背景、工程案例和延伸材料，适合继续加深理解。",
                content_markdown=self._build_extended_reading(course_label, title_focus, source_titles),
                source_titles=source_titles,
                study_suggestion="先看讲义主线，再用这份阅读材料补背景、案例和术语细节。",
            )
        if resource_type in {"coding_lab", "case_study"}:
            return ResourceCard(
                resource_type="coding_lab",
                title=f"{course_label} · {title_focus} 实操任务",
                summary="围绕当前知识点拆成可直接动手的练习步骤，适合边做边学。",
                content_markdown=self._build_coding_lab(course_label, title_focus, source_titles),
                source_titles=source_titles,
                study_suggestion="建议先完成最小可运行版本，再逐步补充优化和复盘记录。",
            )
        if resource_type == "visual_illustration":
            return ResourceCard(
                resource_type="visual_illustration",
                title=f"{course_label} · {title_focus} 教学插图说明",
                summary="为讲义、课件和答疑准备的图示说明，可辅助解释结构和流程。",
                content_markdown=self._build_visual_illustration(title_focus, source_titles),
                source_titles=source_titles,
                study_suggestion="适合和讲义一起看，先用图理解结构，再回到文字细节。",
            )
        if resource_type == "micro_video":
            return ResourceCard(
                resource_type="micro_video",
                title=f"{course_label} · {title_focus} 讲解动画脚本",
                summary="给知识点动画或短视频准备的分镜和讲解脚本。",
                content_markdown=self._build_micro_video_script(title_focus, source_titles),
                source_titles=source_titles,
                study_suggestion="可直接交给视频页或课件页做口播和动画演示。",
            )
        if resource_type == "subtitle_transcript":
            return ResourceCard(
                resource_type="subtitle_transcript",
                title=f"{course_label} · {title_focus} 字幕整理",
                summary="把当前主题整理成可直接阅读和检索的字幕/转写文本。",
                content_markdown=self._build_subtitle_transcript(title_focus, source_titles),
                source_titles=source_titles,
                study_suggestion="适合配合视频回看、关键词检索和问答引用使用。",
            )
        if resource_type == "ocr_notes":
            return ResourceCard(
                resource_type="ocr_notes",
                title=f"{course_label} · {title_focus} 板书提要",
                summary="将板书、截图或课件中的关键文字整理成便于复习的提要。",
                content_markdown=self._build_ocr_notes(title_focus, source_titles),
                source_titles=source_titles,
                study_suggestion="建议先快速浏览提要，再回到课堂定位对应知识点。",
            )
        return ResourceCard(
            resource_type=resource_type,
            title=f"{title_focus} 学习资料",
            summary="围绕当前章节整理的学习资料。",
            content_markdown=f"# {title_focus}\n\n当前资源类型为 `{resource_type}`，可继续扩展为更完整的学习材料。",
            source_titles=source_titles,
            study_suggestion="结合课堂视频和讲义一起使用。",
        )

    def _build_handout(self, course_code: str, title_focus: str, source_titles: list[str]) -> str:
        course_label = self._course_label(course_code)
        if course_code == "software_engineering_4th":
            profile = self._software_engineering_profile(source_titles)
            return (
                f"# {course_label} · {profile['chapter']}\n\n"
                f"## 本节定位\n{profile['position']}\n\n"
                "## 学习目标\n"
                + "\n".join(f"- {item}" for item in profile["goals"])
                + "\n\n## 核心结构\n"
                + "\n".join(f"- {item}" for item in profile["structure"])
                + "\n\n## 典型场景\n"
                + "\n".join(f"- {item}" for item in profile["scenes"])
                + "\n\n## 易错点\n"
                + "\n".join(f"- {item}" for item in profile["pitfalls"])
                + "\n\n## 复习提纲\n"
                + "\n".join(f"{idx + 1}. {item}" for idx, item in enumerate(profile["review"]))
            )
        points = source_titles or [title_focus, "核心概念", "关键结构", "应用场景"]
        return (
            f"# {course_label} - {title_focus} 课堂讲义\n\n"
            "## 本节定位\n"
            f"{title_focus} 是当前学习任务里的关键章节。你需要知道它解决什么问题、和前后知识点如何衔接、以及它在真实项目中如何落地。\n\n"
            "## 学习目标\n"
            f"- 能解释 {title_focus} 的核心目标与边界。\n"
            "- 能把关键结构、流程和角色关系讲清楚。\n"
            "- 能把知识点迁移到项目任务、实验或答辩表达中。\n\n"
            "## 关键结构\n"
            + "\n".join(f"- {item}" for item in points[:4])
            + "\n\n## 场景落点\n"
            + f"建议结合 {course_label} 的课程案例、课堂任务和项目交付场景来理解，不只停留在术语记忆上。\n\n"
            + "## 复习提纲\n"
            + f"1. {title_focus} 的核心作用是什么？\n"
            + "2. 它与上下游知识点分别如何衔接？\n"
            + "3. 如果缺少这一环，项目会出现什么问题？\n\n"
            + "## 课后自测\n"
            + "- 请用自己的话复述本节主线。\n"
            + "- 请举一个真实项目中的应用场景。\n"
            + "- 请说明一个容易混淆的相邻概念及区别。"
        )

    def _build_mindmap(self, title_focus: str, source_titles: list[str]) -> str:
        if source_titles and self._course_label("software_engineering_4th") in source_titles[0]:
            profile = self._software_engineering_profile(source_titles)
            branches = "".join(
                f"    {branch}\n" + "".join(f"      {child}\n" for child in children)
                for branch, children in profile["mindmap"].items()
            )
            return (
                f"# {profile['chapter']} 知识导图\n\n"
                "```mermaid\n"
                "mindmap\n"
                f"  root(({profile['theme']}))\n"
                f"{branches}"
                "```\n"
            )
        points = source_titles or [title_focus, "核心概念", "关键结构", "应用场景"]
        branch_lines = "".join(f"      {item}\n" for item in points[:4])
        return (
            f"# {title_focus} 知识导图\n\n"
            "```mermaid\n"
            "mindmap\n"
            f"  root(({title_focus}))\n"
            "    概念定位\n"
            "      解决什么问题\n"
            "      边界是什么\n"
            "    结构组成\n"
            f"{branch_lines}"
            "    场景应用\n"
            "      课堂任务\n"
            "      项目落地\n"
            "    复习输出\n"
            "      能复述主线\n"
            "      能迁移应用\n"
            "```\n"
        )

    def _build_teaching_plan(self, course_code: str, title_focus: str, source_titles: list[str]) -> str:
        course_label = self._course_label(course_code)
        if course_code == "software_engineering_4th":
            profile = self._software_engineering_profile(source_titles)
            slide_lines = "\n".join(profile["slides"])
            return (
                f"# {course_label} · {profile['chapter']} PPT 草案\n\n"
                "## 页面规划\n"
                f"{slide_lines}\n\n"
                "## 讲解主线\n"
                f"- 开场：{profile['ppt_opening']}\n"
                f"- 中段：{profile['ppt_middle']}\n"
                f"- 结尾：{profile['ppt_closing']}"
            )
        return (
            f"# {course_label} - {title_focus} PPT 草案\n\n"
            "## 页面规划\n"
            "- 封面页：课程与章节定位\n"
            "- 目标页：本节要解决什么问题\n"
            "- 概念页：核心定义与边界\n"
            "- 结构页：关键流程与模块关系\n"
            "- 案例页：课堂任务或项目场景\n"
            "- 复盘页：易错点与课后行动\n\n"
            "## 逐页讲解脚本\n"
            f"- 开场：说明 {title_focus} 在 {course_label} 中的价值。\n"
            "- 中段：围绕结构、流程和上下游关系展开。\n"
            "- 结尾：回到真实项目，强调如何迁移使用。"
        )

    def _build_quiz_json(self, title_focus: str, source_titles: list[str]) -> str:
        if source_titles and self._course_label("software_engineering_4th") in source_titles[0]:
            profile = self._software_engineering_profile(source_titles)
            questions = {"questions": profile["questions"]}
            import json

            return json.dumps(questions, ensure_ascii=False, indent=2)
        questions = {
            "questions": [
                {
                    "id": "q1",
                    "question": f"{title_focus} 的核心价值是什么？",
                    "options": ["只提升视觉效果", "帮助建立结构化理解与落地能力", "完全替代编码实现", "只用于背诵定义"],
                    "answer": ["B"],
                    "explanation": "本节重点在于结构化理解和项目落地，而不是表层记忆。",
                    "question_type": "single",
                },
                {
                    "id": "q2",
                    "question": f"围绕 {title_focus} 复习时，应优先关注哪些内容？",
                    "options": source_titles[:3] + ["无关娱乐信息"],
                    "answer": ["A", "B", "C"],
                    "explanation": "应优先梳理知识主线、关键结构和场景应用。",
                    "question_type": "multiple",
                },
                {
                    "id": "q3",
                    "question": f"请说明 {title_focus} 与相邻知识点的一个区别，并举例说明应用场景。",
                    "options": [],
                    "answer": [],
                    "explanation": "这道开放题用于检查迁移与表达能力。",
                    "question_type": "short",
                },
            ]
        }
        import json

        return json.dumps(questions, ensure_ascii=False, indent=2)

    def _build_extended_reading(self, course_label: str, title_focus: str, source_titles: list[str]) -> str:
        topics = source_titles or [title_focus, "核心概念", "工程背景", "应用场景"]
        return (
            f"# {course_label} · {title_focus} 拓展阅读\n\n"
            "## 阅读目的\n"
            "这份材料用于补足概念背景、工程案例和术语解释，帮助你把课堂内容迁移到项目与答辩表达中。\n\n"
            "## 建议先看\n"
            + "\n".join(f"- {item}" for item in topics[:4])
            + "\n\n## 延伸理解\n"
            f"- {title_focus} 主要解决什么问题？\n"
            "- 它常和哪些上下游知识点一起出现？\n"
            "- 如果这一环节设计不好，真实项目里最常见的问题是什么？\n"
        )

    def _build_coding_lab(self, course_label: str, title_focus: str, source_titles: list[str]) -> str:
        steps = source_titles or [title_focus, "最小实现", "联调验证", "结果复盘"]
        return (
            f"# {course_label} · {title_focus} 实操任务\n\n"
            "## 目标\n"
            f"围绕 {title_focus} 完成一轮最小可运行实现，并解释关键设计选择。\n\n"
            "## 操作步骤\n"
            + "\n".join(f"{idx + 1}. {step}" for idx, step in enumerate(steps[:4]))
            + "\n\n## 验收标准\n"
            "- 能运行出可观察结果\n"
            "- 能说明关键结构和数据流\n"
            "- 能记录至少一个问题与修复过程\n"
        )

    def _build_visual_illustration(self, title_focus: str, source_titles: list[str]) -> str:
        labels = source_titles or [title_focus, "输入", "处理", "输出"]
        return (
            f"# {title_focus} 教学插图说明\n\n"
            "## 图示要点\n"
            + "\n".join(f"- {item}" for item in labels[:4])
            + "\n\n## 使用方式\n"
            "- 可作为讲义配图\n"
            "- 可放入 PPT 页面辅助讲解\n"
            "- 可在 AI 导师答疑时作为流程示意\n"
        )

    def _build_micro_video_script(self, title_focus: str, source_titles: list[str]) -> str:
        beats = source_titles or [title_focus, "问题引入", "关键结构", "落地场景"]
        return (
            f"# {title_focus} 讲解动画脚本\n\n"
            "## 30 秒版本分镜\n"
            "1. 开场：点出本节要解决的问题\n"
            f"2. 中段：用 {beats[0]} 串起关键结构\n"
            "3. 结尾：回到项目/考试/复习场景\n\n"
            "## 口播提要\n"
            + "\n".join(f"- {item}" for item in beats[:4])
        )

    def _build_subtitle_transcript(self, title_focus: str, source_titles: list[str]) -> str:
        beats = list(source_titles or [title_focus, "概念解释", "结构说明", "案例补充"])
        while len(beats) < 3:
            beats.append(["概念解释", "结构说明", "案例补充"][len(beats) - 1] if len(beats) > 0 else title_focus)
        return (
            f"# {title_focus} 字幕整理\n\n"
            "00:00 本节主题与目标\n"
            f"00:18 {beats[0]}\n"
            f"00:42 {beats[1]}\n"
            f"01:10 {beats[2]}\n"
            "01:36 课堂总结与复习提醒\n"
        )

    def _build_ocr_notes(self, title_focus: str, source_titles: list[str]) -> str:
        notes = source_titles or [title_focus, "核心概念", "关键步骤", "易错点"]
        return (
            f"# {title_focus} 板书提要\n\n"
            + "\n".join(f"- {item}" for item in notes[:4])
            + "\n\n## 提醒\n"
            "- 先按主线看，再回到原视频或讲义定位细节。\n"
            "- 如果某条提要看不懂，优先追问 AI 导师而不是硬记。\n"
        )

    def _build_extended_reading(self, course_label: str, title_focus: str, source_titles: list[str]) -> str:
        topics = source_titles or [title_focus, "核心概念", "工程背景", "应用场景"]
        return (
            f"# {course_label} · {title_focus} 拓展阅读\n\n"
            "## 阅读目标\n"
            "这份材料用于补足课堂之外的背景知识、工程语境和典型案例，帮助你把当前知识点讲得更完整，而不是只停留在定义层面。\n\n"
            "## 建议先看\n"
            + "\n".join(f"- {item}" for item in topics[:4])
            + "\n\n## 背景补充\n"
            f"- {title_focus} 在这门课里主要解决什么问题？\n"
            f"- 如果只理解 {title_focus} 的定义而不理解它的使用边界，最容易出现什么误判？\n"
            "- 它通常会和哪些上游输入、下游输出一起出现？\n\n"
            "## 工程案例视角\n"
            f"- 在 {course_label} 对应的项目实训里，{title_focus} 最常体现在哪个阶段？\n"
            "- 如果这一环节设计不清，项目里常见的返工、联调或答辩表达问题是什么？\n"
            "- 真实团队在推进这类任务时，通常会先统一哪些术语、接口或交付边界？\n\n"
            "## 延伸追问\n"
            f"1. {title_focus} 和相邻知识点最容易混淆的地方是什么？\n"
            "2. 如果把它放进比赛项目或课程大作业，最小落地版本应该长什么样？\n"
            "3. 如果要向老师或评委解释这一部分，哪三句话最值得提前准备？\n\n"
            "## 阅读后输出\n"
            "- 用 3 句话复述这部分为什么重要。\n"
            "- 说出一个真实项目中的对应场景。\n"
            "- 记录一个你还想继续追问 AI 导师的问题。\n"
        )

    def _build_coding_lab(self, course_label: str, title_focus: str, source_titles: list[str]) -> str:
        steps = source_titles or [title_focus, "输入解析", "核心处理", "结果输出"]
        return (
            f"# {course_label} · {title_focus} 代码实操案例\n\n"
            "## 题目描述\n"
            f"请围绕 **{title_focus}** 完成一个可直接运行的 Java 小题。你需要补全 `Main.java`，"
            "读取标准输入并输出符合题意的结果，让它能够在课堂演示和答辩现场直接运行。\n\n"
            "## 输入说明\n"
            "- 第 1 行输入一个整数 `n`，表示后续数字个数。\n"
            "- 第 2 行输入 `n` 个整数，以空格分隔。\n\n"
            "## 输出说明\n"
            "- 输出这组整数的总和。\n"
            "- 只输出结果本身，不要输出额外提示文字。\n\n"
            "## 解题提示\n"
            + "\n".join(f"{idx + 1}. {step}" for idx, step in enumerate(steps[:4]))
            + "\n\n## 示例输入 1\n"
            "```text\n3\n1 2 3\n```\n\n"
            "## 示例输出 1\n"
            "```text\n6\n```\n\n"
            "## 示例输入 2\n"
            "```text\n4\n2 2 2 2\n```\n\n"
            "## 示例输出 2\n"
            "```text\n8\n```\n\n"
            "## 起始代码\n"
            "```java\n"
            "import java.util.*;\n\n"
            "public class Main {\n"
            "    public static void main(String[] args) {\n"
            "        Scanner scanner = new Scanner(System.in);\n"
            "        int n = scanner.nextInt();\n"
            "        int sum = 0;\n"
            "        for (int i = 0; i < n; i++) {\n"
            "            // TODO: 读取每个数字并累加\n"
            "        }\n"
            "        System.out.println(sum);\n"
            "    }\n"
            "}\n"
            "```\n\n"
            "## 验收标准\n"
            "- 能通过示例输入输出自测。\n"
            "- 能讲清楚输入解析、循环处理和结果输出三步。\n"
            "- 能记录至少一个调试过程或易错点。\n"
        )

    def _build_visual_illustration(self, title_focus: str, source_titles: list[str]) -> str:
        labels = source_titles or [title_focus, "输入", "处理", "输出"]
        return (
            f"# {title_focus} 教学插图说明\n\n"
            "## 插图目标\n"
            "这张图不是装饰图，而是为了把抽象概念、结构关系和流程节点讲清楚，适合放进讲义、PPT、答疑页或作品答辩中。\n\n"
            "## 图示要点\n"
            + "\n".join(f"- {item}" for item in labels[:4])
            + "\n\n## 推荐画面结构\n"
            "- 左侧放输入条件或问题背景。\n"
            "- 中间放核心结构、流程节点或模块关系。\n"
            "- 右侧放结果输出、评价指标或后续动作。\n\n"
            "## 配文建议\n"
            f"- 标题直接点明 {title_focus} 的作用。\n"
            "- 副标题写“这个结构解决什么问题”。\n"
            "- 每个节点只保留短语，不堆整段文字。\n\n"
            "## 使用方式\n"
            "- 可作为讲义配图。\n"
            "- 可放入 PPT 页面辅助讲解。\n"
            "- 可在 AI 导师答疑时作为流程示意。\n"
        )

    def _build_micro_video_script(self, title_focus: str, source_titles: list[str]) -> str:
        beats = source_titles or [title_focus, "问题引入", "关键结构", "落地场景"]
        return (
            f"# {title_focus} 讲解动画脚本\n\n"
            "## 视频定位\n"
            "适合制作 30 到 60 秒的课堂讲解动画、项目短视频或答辩辅助片段，目标是让用户在很短时间内抓住主线。\n\n"
            "## 分镜脚本\n"
            "### 镜头 1：问题引入\n"
            "- 画面：抛出本节最核心的问题或痛点。\n"
            "- 口播：为什么现在要讲这一部分，它和整门课有什么关系？\n\n"
            "### 镜头 2：结构展开\n"
            f"- 画面：用 {beats[0]} 串起关键结构、阶段或模块。\n"
            "- 口播：把复杂流程拆成 2 到 4 个关键节点，避免一上来堆术语。\n\n"
            "### 镜头 3：场景落地\n"
            "- 画面：回到实训项目、比赛任务或课堂作业场景。\n"
            "- 口播：说明这部分知识在真实任务里什么时候会用到。\n\n"
            "## 口播提要\n"
            + "\n".join(f"- {item}" for item in beats[:4])
            + "\n\n## 输出建议\n"
            "- 结尾补一句“下一步最值得继续看的资料是什么”。\n"
            "- 如果做成动画，节点切换速度要慢于字幕切换速度。\n"
            "- 如果做成短视频，首屏 3 秒内必须出现核心问题。\n"
        )

    def _build_subtitle_transcript(self, title_focus: str, source_titles: list[str]) -> str:
        beats = list(source_titles or [title_focus, "概念解释", "结构说明", "案例补充"])
        while len(beats) < 3:
            beats.append(["概念解释", "结构说明", "案例补充"][len(beats) - 1] if len(beats) > 0 else title_focus)
        return (
            f"# {title_focus} 字幕整理\n\n"
            "## 分段字幕\n"
            "00:00 本节主题与目标\n"
            f"00:18 {beats[0]}\n"
            f"00:42 {beats[1]}\n"
            f"01:10 {beats[2]}\n"
            "01:36 课堂总结与复习提醒\n\n"
            "## 检索关键词\n"
            f"- {title_focus}\n"
            + "\n".join(f"- {item}" for item in beats[:3])
            + "\n\n## 使用建议\n"
            "- 适合配合视频回看，按时间点快速定位重点。\n"
            "- 适合后续给 AI 导师做引用、追问和片段讲解。\n"
        )

    def _build_ocr_notes(self, title_focus: str, source_titles: list[str]) -> str:
        notes = source_titles or [title_focus, "核心概念", "关键步骤", "易错点"]
        return (
            f"# {title_focus} 真实板书生成稿\n\n"
            "## OCR 识别文本\n"
            + "\n".join(f"- {item}" for item in notes[:8])
            + "\n\n## 黑板布局还原\n"
            f"### 左区：本节问题\n- {title_focus} 解决什么问题？\n- 它在当前课程里的位置是什么？\n\n"
            "### 中区：主线结构\n"
            + "\n".join(f"- {item}" for item in notes[:4])
            + "\n\n### 右区：输出与检查\n"
            "- 能用自己的话复述主线。\n"
            "- 能说明每个箭头代表的因果或依赖关系。\n"
            "- 能把板书内容对应回讲义、视频和练习。\n\n"
            "## 结构化板书笔记\n"
            f"1. 核心概念：先解释 {title_focus} 的定义和边界。\n"
            "2. 关键结构：按目标、组成、关系、结果四步复原黑板逻辑。\n"
            "3. 易错提醒：不要只抄关键词，要补出“为什么”和“怎么用”。\n\n"
            "## 可直接抄写的板书版式\n"
            "```text\n"
            f"【{title_focus}】\n"
            "问题 -> 结构 -> 应用 -> 易错\n"
            "关键词：\n"
            + "\n".join(f"- {item}" for item in notes[:4])
            + "\n```\n\n"
            "## 课后复盘动作\n"
            "- 用 3 分钟重画黑板布局。\n"
            "- 把每个关键词补成一句完整解释。\n"
            "- 向 AI 导师追问最不确定的一条箭头关系。\n"
        )

    def _to_card(self, item) -> ResourceCard:
        return ResourceCard(
            resource_id=item.id,
            resource_type=item.resource_type,
            title=item.title,
            summary=item.summary,
            content_markdown=item.content_markdown,
            source_titles=list(item.source_titles or []),
            study_suggestion=item.study_suggestion,
        )

    async def _resolve_course_code(self, *, course_id: int | None, course_code: str | None) -> str:
        if course_code:
            return course_code
        if course_id is not None:
            context = await CourseContextService().resolve(course_id=course_id, course_code=None)
            return context.course_code
        return "software_engineering_4th"

    def _is_placeholder_text(self, value: str) -> bool:
        normalized = str(value or "").strip()
        if not normalized:
            return True
        return "???" in normalized or "�" in normalized

    def _normalize_source_titles(self, knowledge_points: list[str], course_code: str) -> list[str]:
        cleaned = [str(item).strip() for item in knowledge_points if str(item).strip() and not self._is_placeholder_text(str(item))]
        if cleaned:
            return cleaned
        if course_code == "software_engineering_4th":
            return [self._course_label(course_code), "第一章：软件工程基础与软件危机"]
        return [self._course_label(course_code), "核心概念", "结构关系", "应用场景"]

    def _primary_focus_title(self, source_titles: list[str], course_code: str) -> str:
        course_label = self._course_label(course_code)
        for item in source_titles:
            normalized = str(item).strip()
            if normalized and normalized != course_label and not self._is_placeholder_text(normalized):
                return normalized
        return course_label

    def _software_engineering_profile(self, source_titles: list[str]) -> dict:
        focus_title = self._primary_focus_title(source_titles, "software_engineering_4th")
        if "第二章" in focus_title:
            return {
                "chapter": "第二章：可行性分析与研发策划",
                "theme": "可行性分析与研发策划",
                "position": "这一章先回答项目值不值得做、能不能做，再回答准备如何组织实施，是软件项目从想法走向计划的起点。",
                "goals": ["会区分技术、经济、运行、法律等可行性维度", "会说明研发策划中的范围、里程碑、资源和风险安排", "能把立项判断和实施计划连成一条主线"],
                "structure": ["可行性分析目标", "技术/经济/运行/法律可行性", "项目范围与里程碑", "资源投入与风险预案"],
                "scenes": ["立项答辩时说明项目可行性", "课程设计中拆解阶段计划", "竞赛项目中预判关键风险"],
                "pitfalls": ["只谈技术方案，不谈投入产出", "计划只有时间表，没有风险策略", "直接开工，没有先完成立项判断"],
                "review": ["可行性分析解决什么问题？", "研发策划和可行性分析的关系是什么？", "如果关键技术不成熟，你会如何调整计划？"],
                "mindmap": {
                    "可行性分析": ["技术可行性", "经济可行性", "运行可行性", "法律可行性"],
                    "研发策划": ["范围界定", "里程碑设计", "资源配置", "风险预案"],
                    "项目落地": ["立项判断", "实施路径", "动态调整"],
                },
                "slides": ["- 封面页：章节定位与问题背景", "- 判断页：为什么先做可行性分析", "- 维度页：技术/经济/运行/法律可行性", "- 策划页：范围、里程碑、资源配置", "- 风险页：高风险节点与预案", "- 复盘页：立项与实施如何闭环"],
                "ppt_opening": "说明为什么软件项目不能一上来就编码，而要先完成立项判断。",
                "ppt_middle": "围绕可行性维度、项目计划和风险控制展开，体现工程治理意识。",
                "ppt_closing": "回到真实项目，强调“先判断、再策划、后实施”的软件工程逻辑。",
                "questions": [
                    {"id": "q1", "question": "可行性分析最先要回答什么？", "options": ["项目值不值得做、能不能做", "页面颜色够不够好看", "标题长不长", "动画炫不炫"], "answer": ["A"], "explanation": "可行性分析首先解决立项判断问题。", "question_type": "single"},
                    {"id": "q2", "question": "以下哪些属于常见的可行性分析维度？", "options": ["技术可行性", "经济可行性", "运行可行性", "法律可行性"], "answer": ["A", "B", "C", "D"], "explanation": "可行性分析通常至少覆盖这四类维度。", "question_type": "multiple"},
                    {"id": "q3", "question": "请简述研发策划中为什么必须提前识别风险。", "options": [], "answer": [], "explanation": "可从进度、成本、资源和关键技术几个角度回答。", "question_type": "short"},
                ],
            }
        if "第三章" in focus_title:
            return {
                "chapter": "第三章：软件需求分析与文档建模",
                "theme": "软件需求分析与文档建模",
                "position": "这一章要把模糊的业务诉求转成可沟通、可实现、可验证的需求与模型，是后续设计和开发的基础。",
                "goals": ["会区分需求获取、需求分析与需求建模", "会说明数据流图、用例图和需求规格说明的作用", "能把用户语言转成结构化需求条目"],
                "structure": ["需求获取来源", "需求分析方法", "数据流图/用例图", "需求规格说明书"],
                "scenes": ["课程设计中梳理业务角色与流程", "答辩时展示需求边界", "项目开发前统一团队理解"],
                "pitfalls": ["只有表面诉求，没有真实业务目标", "文档有条目，但没有边界和验收标准", "模型和文字描述不一致"],
                "review": ["需求获取和需求分析有什么区别？", "为什么建模能减少返工？", "如何判断一个需求描述是否足够清晰？"],
                "mindmap": {
                    "需求工程": ["需求获取", "需求分析", "需求确认", "需求管理"],
                    "文档建模": ["数据流图", "用例图", "需求规格说明"],
                    "质量要求": ["边界清晰", "可验证", "可沟通"],
                },
                "slides": ["- 封面页：章节定位与价值", "- 获取页：需求从哪里来", "- 分析页：如何提炼真实诉求", "- 建模页：数据流图与用例图", "- 文档页：需求规格说明书", "- 复盘页：边界、验收与易错点"],
                "ppt_opening": "说明需求分析为什么是软件开发成败的前置条件。",
                "ppt_middle": "围绕需求获取、结构化分析和文档建模展开，突出沟通与验证价值。",
                "ppt_closing": "强调清晰需求如何支撑后续设计、开发和测试。",
                "questions": [
                    {"id": "q1", "question": "需求分析的核心作用是什么？", "options": ["把模糊诉求转成可实现需求", "只做界面配色", "只记录会议纪要", "先跳过用户场景"], "answer": ["A"], "explanation": "需求分析要把业务诉求结构化、边界化。", "question_type": "single"},
                    {"id": "q2", "question": "以下哪些更适合用于需求建模？", "options": ["数据流图", "用例图", "需求规格说明书", "实体关系分析"], "answer": ["A", "B", "C", "D"], "explanation": "这些都是需求阶段常见表达工具。", "question_type": "multiple"},
                    {"id": "q3", "question": "请举例说明为什么“系统要好用”不能直接写进需求文档。", "options": [], "answer": [], "explanation": "需要继续拆解为角色、场景和验收标准。", "question_type": "short"},
                ],
            }
        if "第四章" in focus_title:
            return {
                "chapter": "第四章：软件设计、测试与项目管理",
                "theme": "软件设计、测试与项目管理",
                "position": "这一章把需求真正推进到工程交付：既要设计系统结构，也要用测试和项目管理保证质量、进度与协作。",
                "goals": ["会区分概要设计与详细设计", "会说明单元、集成、系统和验收测试的作用", "会描述项目管理如何平衡进度、成本和质量"],
                "structure": ["概要设计与详细设计", "测试层次", "质量保证", "项目管理与风险控制"],
                "scenes": ["课程项目中设计模块结构", "缺陷复盘时分析测试覆盖", "答辩中说明交付与管理能力"],
                "pitfalls": ["只谈实现，不谈设计依据", "测试被当成最后补救", "为了赶进度牺牲质量控制"],
                "review": ["概要设计和详细设计的区别是什么？", "不同测试层次分别解决什么问题？", "为什么项目管理不是只盯进度？"],
                "mindmap": {
                    "软件设计": ["概要设计", "详细设计", "接口与模块"],
                    "软件测试": ["单元测试", "集成测试", "系统测试", "验收测试"],
                    "项目管理": ["进度", "成本", "质量", "风险控制"],
                },
                "slides": ["- 封面页：章节定位与交付目标", "- 设计页：概要设计与详细设计", "- 测试页：测试层次与质量保证", "- 管理页：进度/成本/质量平衡", "- 风险页：典型项目管理风险", "- 复盘页：工程交付闭环"],
                "ppt_opening": "说明为什么只有实现代码还不够，必须同时考虑设计、测试和管理。",
                "ppt_middle": "围绕系统结构、质量保证和项目协同展开，体现完整工程视角。",
                "ppt_closing": "强调设计、测试和管理共同支撑软件交付质量。",
                "questions": [
                    {"id": "q1", "question": "软件设计阶段最核心的目标是什么？", "options": ["把需求转成可实现结构", "只决定页面颜色", "只压缩工期", "只做汇报材料"], "answer": ["A"], "explanation": "设计阶段要把需求落成结构、模块和接口方案。", "question_type": "single"},
                    {"id": "q2", "question": "以下哪些属于常见的软件测试层次？", "options": ["单元测试", "集成测试", "系统测试", "验收测试"], "answer": ["A", "B", "C", "D"], "explanation": "这四类是经典测试层次。", "question_type": "multiple"},
                    {"id": "q3", "question": "请说明项目进度紧张时为什么更不能忽略质量控制。", "options": [], "answer": [], "explanation": "可以从返工成本、缺陷风险和交付可信度三个角度作答。", "question_type": "short"},
                ],
            }
        return {
            "chapter": "第一章：软件工程基础与软件危机",
            "theme": "软件工程基础与软件危机",
            "position": "这一章在回答软件工程为什么会诞生。核心不是背定义，而是理解软件危机为何出现，以及工程化方法如何控制复杂度。",
            "goals": ["会说明软件危机的典型表现与成因", "会解释软件工程的目标与价值", "会区分生命周期和常见过程模型的作用"],
            "structure": ["软件危机表现", "软件工程目标", "软件生命周期", "典型过程模型"],
            "scenes": ["课程答辩中解释软件工程的产生背景", "项目复盘时分析延期、返工和缺陷问题", "对比不同过程模型的适用场景"],
            "pitfalls": ["只记概念，不理解问题背景", "把生命周期等同于编码阶段", "不会把过程模型和项目场景对应起来"],
            "review": ["软件危机为什么会出现？", "软件工程想解决哪些核心问题？", "瀑布、原型、迭代等过程模型各适合什么场景？"],
            "mindmap": {
                "软件危机": ["需求变化快", "规模增大", "质量失控", "维护困难"],
                "软件工程": ["过程", "方法", "工具", "管理"],
                "开发组织": ["生命周期", "瀑布模型", "原型模型", "迭代增量"],
            },
            "slides": ["- 封面页：软件工程为何出现", "- 问题页：软件危机表现", "- 目标页：软件工程解决什么", "- 生命周期页：软件开发全阶段", "- 模型页：典型过程模型", "- 复盘页：第一章答辩表达"],
            "ppt_opening": "从软件项目为什么总会延期、返工和难维护切入，引出软件危机。",
            "ppt_middle": "围绕软件工程目标、生命周期和过程模型展开，体现工程化思维。",
            "ppt_closing": "回到真实项目，说明为什么工程化方法是控制复杂度的必要条件。",
            "questions": [
                {"id": "q1", "question": "“软件危机”主要反映了什么问题？", "options": ["软件项目复杂度提升后质量、进度和成本难以控制", "界面颜色不统一", "按钮太少", "标题不够长"], "answer": ["A"], "explanation": "软件危机强调的是复杂项目中普遍出现的质量、进度、成本与维护失控。", "question_type": "single"},
                {"id": "q2", "question": "软件工程通常通过哪些方式缓解软件危机？", "options": ["规范过程", "方法支持", "工具辅助", "质量控制"], "answer": ["A", "B", "C", "D"], "explanation": "软件工程本质上是用过程、方法、工具和管理让开发可控。", "question_type": "multiple"},
                {"id": "q3", "question": "请用自己的话说明为什么生命周期不能只理解为编码阶段。", "options": [], "answer": [], "explanation": "可以从立项、分析、设计、测试、维护的完整链路来回答。", "question_type": "short"},
            ],
        }

    def _course_label(self, course_code: str) -> str:
        labels = {
            "software_engineering_4th": "软件工程与实践（第4版）",
            "vue3_engineering": "Vue 3 工程化实战",
            "ml_intro": "机器学习导论",
            "llm_app_intro": "大模型应用开发导论",
        }
        return labels.get(course_code, course_code.replace("_", " ").title())

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()
