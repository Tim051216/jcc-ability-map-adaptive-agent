import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.models.generated_resource import GeneratedResource, ResourceFavorite, ResourceFavoriteHistory
from app.db.models.knowledge_document import KnowledgeChunk, KnowledgeDocument
from app.db.models.resource_source_file import ResourceSourceFile
from app.rag.ingest.loaders import CourseKnowledgeLoader
from app.rag.ingest.splitters import split_course_payload


ROOT_DIR = Path(__file__).resolve().parents[1]
LOCAL_DATA_DIR = ROOT_DIR / "local_data"
SQLITE_PATH = LOCAL_DATA_DIR / "a3_ai_local.db"
SQLITE_DSN = f"sqlite+aiosqlite:///{SQLITE_PATH.as_posix()}"


def utc_iso(days_offset: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days_offset)).isoformat()


def read_course_markdown(file_name: str) -> str:
    knowledge_dir = ROOT_DIR / "knowledge_base" / "software_engineering_4th"
    return (knowledge_dir / file_name).read_text(encoding="utf-8").strip()


def build_seed_resources() -> list[GeneratedResource]:
    specs = [
        {
            "id": 101,
            "resource_type": "lecture_note",
            "title": "软件工程课程导学讲义",
            "summary": "基于课程画像、教学安排和章节主线整理的导学资料，适合作为开课前预习与课程总览。",
            "source_titles": ["课程画像", "教学周次安排"],
            "study_suggestion": "先看课程定位、能力目标和阶段安排，再进入每一章的重点内容。",
            "source_files": ["section_13_course_profile.md", "section_14_teaching_schedule.md"],
        },
        {
            "id": 102,
            "resource_type": "mindmap",
            "title": "软件工程章节知识图谱",
            "summary": "覆盖软件工程主线章节与核心知识点，适合复习、提纲回顾和答疑前快速定位。",
            "source_titles": ["章节知识图谱"],
            "study_suggestion": "先顺着图谱扫一遍，再回到对应讲义或案例里补细节。",
            "source_files": ["section_15_chapter_map.md"],
        },
        {
            "id": 103,
            "resource_type": "teaching_plan",
            "title": "软件工程混合式教学组织模版",
            "summary": "把课前、课中、课后以及线上线下协同节奏整理成一套可复用的教学组织方案。",
            "source_titles": ["教学方法与课堂组织"],
            "study_suggestion": "适合讲师备课，也适合学生理解课堂任务为何这样安排。",
            "source_files": ["section_16_teaching_method.md"],
        },
        {
            "id": 104,
            "resource_type": "practice_set",
            "title": "软件工程实验与课程设计选题包",
            "summary": "整合实验、课程设计与工具资源，便于课堂中快速生成实操任务或课后项目。",
            "source_titles": ["实验、课程设计与工具资源"],
            "study_suggestion": "结合当前章节选一个实验方向，再补看案例和配套工具说明。",
            "source_files": ["section_17_labs_projects_and_tools.md"],
        },
        {
            "id": 105,
            "resource_type": "assessment_guide",
            "title": "软件工程考核与毕业要求说明",
            "summary": "汇总实验评价标准、课程考核重点和毕业要求映射，适合期中期末复习。",
            "source_titles": ["考核、实验评价与毕业要求"],
            "study_suggestion": "复习时先看评分维度，再回查实验报告和课程目标的对应关系。",
            "source_files": ["section_18_assessment_and_outcomes.md"],
        },
        {
            "id": 106,
            "resource_type": "course_overview",
            "title": "软件工程课程资料总览",
            "summary": "汇总本地知识库、讲义、导图和高价值资料入口，适合作为资源中心首屏总览。",
            "source_titles": ["课程资料库总览", "课程画像", "章节知识图谱"],
            "study_suggestion": "先看总览确认入口，再深入课程画像和章节图谱。",
            "source_files": ["00_overview.md", "section_13_course_profile.md", "section_15_chapter_map.md"],
        },
    ]

    resources: list[GeneratedResource] = []
    for index, spec in enumerate(specs):
        content_markdown = "\n\n".join(read_course_markdown(name) for name in spec["source_files"])
        resources.append(
            GeneratedResource(
                id=spec["id"],
                user_id=1001,
                course_code="software_engineering_4th",
                resource_type=spec["resource_type"],
                title=spec["title"],
                summary=spec["summary"],
                content_markdown=content_markdown,
                source_titles=spec["source_titles"],
                study_suggestion=spec["study_suggestion"],
                generation_context={
                    "seed": True,
                    "scenario": "software_engineering_local_bootstrap",
                    "source_files": spec["source_files"],
                    "teacher_team": ["贾铁军", "何青岚", "周知行"],
                    "target_learners": ["软件工程学生", "课程助教", "竞赛项目成员"],
                },
                is_archived=False,
                download_scope="public",
                download_count=6 + index * 3,
                created_at=utc_iso(-(6 - index)),
                updated_at=utc_iso(-(2 - min(index, 2))),
            )
        )
    return resources


async def bootstrap() -> dict:
    LOCAL_DATA_DIR.mkdir(parents=True, exist_ok=True)
    engine = create_async_engine(SQLITE_DSN, future=True, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        await session.execute(delete(ResourceFavoriteHistory))
        await session.execute(delete(ResourceFavorite))
        await session.execute(delete(ResourceSourceFile))
        await session.execute(delete(GeneratedResource))
        await session.execute(delete(KnowledgeChunk))
        await session.execute(delete(KnowledgeDocument))
        await session.commit()

    loader = CourseKnowledgeLoader()
    course = loader._load_from_local_markdown("software_engineering_4th")
    if course is None:
        raise RuntimeError("software_engineering_4th local knowledge base not found")

    chunks = split_course_payload(course)
    resources = build_seed_resources()

    async with session_factory() as session:
        session.add_all(resources)
        await session.flush()

        session.add_all(
            [
                ResourceFavorite(
                    id=1,
                    user_id=1001,
                    resource_id=101,
                    category="导学资料",
                    notes="适合首页与课堂页作为推荐讲义展示。",
                    created_at=utc_iso(-1),
                    updated_at=utc_iso(-1),
                ),
                ResourceFavorite(
                    id=2,
                    user_id=1001,
                    resource_id=104,
                    category="实操任务",
                    notes="适合课堂页一键生成练习或项目实作。",
                    created_at=utc_iso(-1),
                    updated_at=utc_iso(-1),
                ),
                ResourceFavoriteHistory(
                    id=1,
                    user_id=1001,
                    resource_id=101,
                    action="favorite",
                    created_at=utc_iso(-1),
                    updated_at=utc_iso(-1),
                ),
                ResourceFavoriteHistory(
                    id=2,
                    user_id=1001,
                    resource_id=104,
                    action="favorite",
                    created_at=utc_iso(-1),
                    updated_at=utc_iso(-1),
                ),
            ]
        )

        knowledge_document = KnowledgeDocument(
            course_code=course.course_code,
            title=course.title,
            source_type=course.source_type,
            source_uri=course.source_uri,
            metadata_json={"sectionCount": len(course.sections)},
            created_at=utc_iso(-1),
            updated_at=utc_iso(-1),
        )
        session.add(knowledge_document)
        await session.flush()

        session.add_all(
            [
                KnowledgeChunk(
                    document_id=knowledge_document.id,
                    chunk_index=item["chunk_index"],
                    content=item["content"][:20000],
                    keywords=item["title"][:500],
                    metadata_json={
                        "title": item["title"],
                        "priority": item.get("priority", 0),
                        "chunk_kind": item.get("chunk_kind"),
                        "source_name": item.get("source_name"),
                        "source_path": item.get("source_path"),
                        "tags": item.get("tags", []),
                    },
                    created_at=utc_iso(-1),
                    updated_at=utc_iso(-1),
                )
                for item in chunks
            ]
        )

        for resource in resources:
            source_files = (resource.generation_context or {}).get("source_files", [])
            for sort_order, relative_path in enumerate(source_files, start=1):
                absolute_path = (ROOT_DIR / "knowledge_base" / "software_engineering_4th" / relative_path).resolve()
                suffix = absolute_path.suffix.lower()
                preview_text = absolute_path.read_text(encoding="utf-8").strip()[:1200]
                session.add(
                    ResourceSourceFile(
                        resource_id=resource.id,
                        course_code="software_engineering_4th",
                        display_name=absolute_path.stem,
                        relative_path=relative_path,
                        absolute_path=str(absolute_path),
                        top_level_category="软件工程课程知识库",
                        file_extension=suffix,
                        mime_type="text/markdown",
                        file_size=absolute_path.stat().st_size,
                        preview_text=preview_text,
                        is_inline_previewable=True,
                        sort_order=sort_order,
                        created_at=utc_iso(-1),
                        updated_at=utc_iso(-1),
                    )
                )

        await session.commit()

    await engine.dispose()
    return {
        "sqlite_path": str(SQLITE_PATH),
        "resource_count": len(resources),
        "knowledge_chunk_count": len(chunks),
        "course_code": course.course_code,
    }


async def main() -> None:
    result = await bootstrap()
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
