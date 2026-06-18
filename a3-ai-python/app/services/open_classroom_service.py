from __future__ import annotations

from app.schemas.open_classroom import (
    OpenClassroomAgentCard,
    OpenClassroomBuildRequest,
    OpenClassroomBuildResponse,
    OpenClassroomInteractionTurn,
    OpenClassroomPptSlide,
    OpenClassroomQuizQuestion,
)


class OpenClassroomService:
    async def build_session(
        self,
        *,
        user_id: int,
        request: OpenClassroomBuildRequest,
    ) -> OpenClassroomBuildResponse:
        lesson_title = request.lesson_title.strip()
        course_name = request.course_name or request.course_code or "当前课程"
        focus_points = [item.strip() for item in request.focus_points if item.strip()] or [
            lesson_title,
            "核心概念理解",
            "知识迁移应用",
        ]
        generated_resources = request.target_resource_types or [
            "课堂讲义",
            "互动测验",
            "PPT 草案",
            "导学提纲",
        ]

        scene_summary = (
            f"围绕《{lesson_title}》构建一节 {request.duration_minutes} 分钟的 AI 互动课堂，"
            f"由 AI 教师负责主讲、AI 助教负责追问与补充、AI 测评器负责随堂检测，"
            f"面向 {self._audience_label(request.audience_level)} 学习者输出可直接演示的课堂脚本。"
        )

        return OpenClassroomBuildResponse(
            courseCode=request.course_code,
            courseName=request.course_name,
            lessonTitle=lesson_title,
            sceneSummary=scene_summary,
            completionStatus="completed",
            frameworkNote=(
                "已在现有多智能体系统中落地 OpenMAIC 风格的教育互动课堂层，"
                "用于课堂互动、助教追问、随堂测验与课件草案联动。"
            ),
            agentCards=self._build_agent_cards(course_name, lesson_title, focus_points),
            interactionScript=self._build_interaction_script(
                lesson_title=lesson_title,
                focus_points=focus_points,
                student_question=request.student_question,
            ),
            quizQuestions=self._build_quiz_questions(lesson_title, focus_points),
            pptOutline=self._build_ppt_outline(lesson_title, focus_points),
            generatedResources=generated_resources,
        )

    def _audience_label(self, audience_level: str) -> str:
        return {
            "beginner": "基础层",
            "intermediate": "进阶层",
            "advanced": "拔高层",
        }.get(audience_level, "进阶层")

    def _build_agent_cards(
        self,
        course_name: str,
        lesson_title: str,
        focus_points: list[str],
    ) -> list[OpenClassroomAgentCard]:
        primary_focus = focus_points[0]
        secondary_focus = focus_points[1] if len(focus_points) > 1 else lesson_title
        return [
            OpenClassroomAgentCard(
                role="teacher",
                name="AI 教师",
                responsibility=f"主讲 {lesson_title}，搭建 {course_name} 的核心知识框架。",
                style="结构化讲解、先总后分、强调关键术语与因果关系。",
                output=f"输出 3 段主讲内容，重点覆盖 {primary_focus}。",
            ),
            OpenClassroomAgentCard(
                role="assistant",
                name="AI 助教",
                responsibility=f"围绕 {secondary_focus} 发起追问，并把学生困惑翻译成更易理解的表达。",
                style="鼓励式追问、拆小问题、提供类比和反例。",
                output="输出课堂追问、即时澄清、板书提示和巩固建议。",
            ),
            OpenClassroomAgentCard(
                role="quiz_master",
                name="AI 测评器",
                responsibility="生成随堂小测并即时给出答案解析，标记薄弱点。",
                style="先检验理解，再检验迁移，题量精简但覆盖关键知识点。",
                output="输出 2 道客观题 + 1 道简答题，并附解析。",
            ),
        ]

    def _build_interaction_script(
        self,
        *,
        lesson_title: str,
        focus_points: list[str],
        student_question: str | None,
    ) -> list[OpenClassroomInteractionTurn]:
        opening_question = student_question or f"{lesson_title} 里最容易混淆的点是什么？"
        return [
            OpenClassroomInteractionTurn(
                speaker="AI 教师",
                goal="开场建模",
                script=f"今天我们只抓住《{lesson_title}》的主线，先回答一个问题：为什么 {focus_points[0]} 会成为本节的关键支点？",
            ),
            OpenClassroomInteractionTurn(
                speaker="AI 助教",
                goal="暴露误区",
                script=f"很多同学第一次学这里会把“{focus_points[0]}”和“{focus_points[-1]}”混在一起。你可以先用一句自己的话解释它，再看哪里卡住。",
            ),
            OpenClassroomInteractionTurn(
                speaker="学生追问",
                goal="触发针对性解释",
                script=opening_question,
            ),
            OpenClassroomInteractionTurn(
                speaker="AI 教师",
                goal="概念澄清",
                script=f"如果把 {lesson_title} 看成一条完整链路，那么 {focus_points[0]} 负责定义核心规则，{focus_points[1] if len(focus_points) > 1 else lesson_title} 决定它如何真正落地。",
            ),
            OpenClassroomInteractionTurn(
                speaker="AI 助教",
                goal="迁移练习",
                script="现在请你把这个规则迁移到一个你熟悉的场景里，我来帮你判断是不是只记住了结论，还是已经真正会用了。",
            ),
        ]

    def _build_quiz_questions(
        self,
        lesson_title: str,
        focus_points: list[str],
    ) -> list[OpenClassroomQuizQuestion]:
        primary_focus = focus_points[0]
        secondary_focus = focus_points[1] if len(focus_points) > 1 else lesson_title
        return [
            OpenClassroomQuizQuestion(
                questionType="single_choice",
                question=f"在《{lesson_title}》中，{primary_focus} 的首要作用是什么？",
                options=[
                    "只负责记忆定义",
                    "建立核心规则或主线框架",
                    "仅用于考试背诵",
                    "完全替代后续实践",
                ],
                answer="建立核心规则或主线框架",
                explanation="主线知识点的作用是帮助学生先建模，再展开细节与迁移应用。",
                knowledgeTag=primary_focus,
            ),
            OpenClassroomQuizQuestion(
                questionType="multiple_choice",
                question=f"下面哪些做法体现了 {secondary_focus} 的实际应用？",
                options=[
                    "把课堂概念迁移到真实案例",
                    "只重复标题不解释关系",
                    "结合反例说明边界",
                    "通过练习验证理解",
                ],
                answer="把课堂概念迁移到真实案例；结合反例说明边界；通过练习验证理解",
                explanation="应用型知识点必须落到案例、边界和验证，而不是停在表面复述。",
                knowledgeTag=secondary_focus,
            ),
            OpenClassroomQuizQuestion(
                questionType="short_answer",
                question=f"请用 2 到 3 句话说明 {primary_focus} 与 {secondary_focus} 的关系。",
                answer=f"{primary_focus} 负责搭建概念主线，{secondary_focus} 负责把主线落实到具体判断或实践情境中。",
                explanation="简答题重点看是否能说出主线与落地之间的逻辑联系。",
                knowledgeTag=lesson_title,
            ),
        ]

    def _build_ppt_outline(
        self,
        lesson_title: str,
        focus_points: list[str],
    ) -> list[OpenClassroomPptSlide]:
        slides: list[OpenClassroomPptSlide] = [
            OpenClassroomPptSlide(
                pageNo=1,
                title=lesson_title,
                bullets=[
                    "本节目标：建立知识框架",
                    "本节输出：能解释、能迁移、能做题",
                ],
                speakerNote="开场时先告诉学生为什么学、学完能做什么。",
            )
        ]
        for index, point in enumerate(focus_points[:3], start=2):
            slides.append(
                OpenClassroomPptSlide(
                    pageNo=index,
                    title=point,
                    bullets=[
                        f"{point} 的定义与定位",
                        f"{point} 的易错点与边界",
                        f"{point} 的真实应用场景",
                    ],
                    speakerNote=f"这一页要用一个具体例子把 {point} 讲透。",
                )
            )
        slides.append(
            OpenClassroomPptSlide(
                pageNo=len(slides) + 1,
                title="随堂检测与回顾",
                bullets=[
                    "1 道核心概念题",
                    "1 道迁移应用题",
                    "1 个课后复盘问题",
                ],
                speakerNote="收束时要明确告诉学生哪些点已经掌握，哪些点需要回看。",
            )
        )
        return slides
