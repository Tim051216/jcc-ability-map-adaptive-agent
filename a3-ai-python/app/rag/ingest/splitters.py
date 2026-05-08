from app.rag.ingest.loaders import KnowledgeCoursePayload


def split_course_payload(course: KnowledgeCoursePayload) -> list[dict]:
    chunks: list[dict] = []
    chunk_index = 1

    summary_parts = [part for part in [course.title, course.introduction] if part]
    if summary_parts:
        chunks.append(
            {
                "chunk_index": chunk_index,
                "title": f"{course.title}-课程概览",
                "content": "\n".join(summary_parts),
            }
        )
        chunk_index += 1

    for section in course.sections:
        section_parts = [part for part in [section.name, section.description] if part]
        if not section_parts:
            continue
        chunks.append(
            {
                "chunk_index": chunk_index,
                "title": section.name or f"章节-{chunk_index}",
                "content": "\n".join(section_parts),
            }
        )
        chunk_index += 1

    return chunks
