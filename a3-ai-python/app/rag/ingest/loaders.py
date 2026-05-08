from dataclasses import dataclass, field
from pathlib import Path

from app.integrations.java_clients.course_client import CourseClient
from app.schemas.java_models import JavaCourseDetail


@dataclass
class KnowledgeSection:
    name: str
    description: str


@dataclass
class KnowledgeCoursePayload:
    course_code: str
    title: str
    introduction: str = ""
    sections: list[KnowledgeSection] = field(default_factory=list)
    source_type: str = "local_markdown"
    source_uri: str | None = None


class CourseKnowledgeLoader:
    def __init__(self) -> None:
        self.client = CourseClient()
        self.knowledge_base_dir = Path(__file__).resolve().parents[3] / "knowledge_base"

    async def load_course(self, course_code: str) -> KnowledgeCoursePayload | None:
        java_payload = await self._load_from_java(course_code)
        if java_payload is not None:
            return java_payload
        return self._load_from_local_markdown(course_code)

    async def _load_from_java(self, course_code: str) -> KnowledgeCoursePayload | None:
        if not course_code.isdigit():
            return None

        course: JavaCourseDetail | None = await self.client.get_course_detail(course_id=int(course_code))
        if course is None:
            return None

        return KnowledgeCoursePayload(
            course_code=course_code,
            title=course.name or f"课程-{course_code}",
            introduction="\n".join(
                [part for part in [course.brief, course.introduction] if part]
            ),
            sections=[
                KnowledgeSection(
                    name=section.name or f"章节-{index + 1}",
                    description=section.description or "",
                )
                for index, section in enumerate(course.section_dt_os)
                if section.name or section.description
            ],
            source_type="java_course_service",
            source_uri=f"/cs/course/{course_code}",
        )

    def _load_from_local_markdown(self, course_code: str) -> KnowledgeCoursePayload | None:
        course_dir = self.knowledge_base_dir / course_code
        if not course_dir.exists() or not course_dir.is_dir():
            return None

        markdown_files = sorted(course_dir.glob("*.md"))
        if not markdown_files:
            return None

        title = course_code
        introduction_parts: list[str] = []
        sections: list[KnowledgeSection] = []

        for file_path in markdown_files:
            content = file_path.read_text(encoding="utf-8").strip()
            if not content:
                continue
            lines = [line.strip() for line in content.splitlines() if line.strip()]
            heading = file_path.stem
            if lines and lines[0].startswith("#"):
                heading = lines[0].lstrip("#").strip() or heading
                body = "\n".join(lines[1:]).strip()
            else:
                body = "\n".join(lines).strip()

            if file_path.stem.lower() in {"00_overview", "overview", "index"}:
                title = heading
                introduction_parts.append(body)
            else:
                sections.append(KnowledgeSection(name=heading, description=body))

        if not introduction_parts and sections:
            title = sections[0].name

        return KnowledgeCoursePayload(
            course_code=course_code,
            title=title,
            introduction="\n\n".join(part for part in introduction_parts if part),
            sections=sections,
            source_type="local_markdown",
            source_uri=str(course_dir),
        )
