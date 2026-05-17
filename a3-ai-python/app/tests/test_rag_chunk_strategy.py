from app.rag.ingest.loaders import CourseKnowledgeLoader, KnowledgeCoursePayload
from app.rag.ingest.splitters import split_course_payload
from app.services.rag_service import RagService


def test_local_markdown_loader_marks_high_value_sections() -> None:
    course = CourseKnowledgeLoader()._load_from_local_markdown("software_engineering_4th")

    assert course is not None
    section = next(item for item in course.sections if item.source_name == "section_15_chapter_map")
    assert section.priority == 3
    assert "章节知识图谱" in section.tags


def test_splitter_expands_priority_sections_into_detail_chunks() -> None:
    course = CourseKnowledgeLoader()._load_from_local_markdown("software_engineering_4th")
    assert course is not None

    chunks = split_course_payload(course)
    detail_titles = [item["title"] for item in chunks if item.get("chunk_kind") == "section_detail"]

    assert any(title.startswith("章节知识图谱-") for title in detail_titles)
    assert any(item["title"] == "教学进度与章节安排" and item["priority"] == 3 for item in chunks)


def test_rerank_prefers_exact_title_match_and_priority() -> None:
    hits = [
        {
            "chunk_id": 1,
            "document_id": 7,
            "title": "11.视频拓展及资源",
            "content": "misc content",
            "score": 0.46,
            "priority": 1,
            "chunk_kind": "section",
            "tags": ["视频拓展"],
        },
        {
            "chunk_id": 2,
            "document_id": 7,
            "title": "章节知识图谱",
            "content": "chapter map content",
            "score": 0.44,
            "priority": 3,
            "chunk_kind": "section",
            "tags": ["章节知识图谱", "第1章 软件工程基础"],
        },
    ]

    reranked = RagService._rerank_hits("章节知识图谱", hits)

    assert reranked[0]["title"] == "章节知识图谱"
