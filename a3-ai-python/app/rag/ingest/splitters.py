from app.rag.ingest.loaders import KnowledgeCoursePayload, KnowledgeSection


def split_course_payload(course: KnowledgeCoursePayload) -> list[dict]:
    chunks: list[dict] = []
    chunk_index = 1

    summary_parts = [part for part in [course.title, course.introduction] if part]
    if summary_parts:
        chunks.append(
            {
                "chunk_index": chunk_index,
                "title": f"{course.title}-course-overview",
                "content": "\n".join(summary_parts),
                "priority": 1,
                "chunk_kind": "overview",
                "tags": [course.title, course.course_code, "course overview"],
            }
        )
        chunk_index += 1

    for section in course.sections:
        for item in _split_section(section):
            item["chunk_index"] = chunk_index
            chunks.append(item)
            chunk_index += 1

    return chunks


def _split_section(section: KnowledgeSection) -> list[dict]:
    section_name = section.name or "section"
    body = (section.description or "").strip()
    if not body:
        return []

    base_chunk = {
        "title": section_name,
        "content": _build_chunk_content(section_name, body, section.tags),
        "priority": int(section.priority or 0),
        "chunk_kind": "section",
        "source_name": section.source_name,
        "source_path": section.source_path,
        "tags": list(section.tags or []),
    }

    if int(section.priority or 0) < 3:
        return [base_chunk]

    sub_chunks = _build_sub_chunks(section_name, body, list(section.tags or []), base_chunk)
    return [base_chunk, *sub_chunks] if sub_chunks else [base_chunk]


def _build_sub_chunks(section_name: str, body: str, tags: list[str], base_chunk: dict) -> list[dict]:
    groups: list[tuple[str, list[str]]] = []
    current_heading = section_name
    current_lines: list[str] = []

    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("## "):
            if current_lines:
                groups.append((current_heading, current_lines))
            current_heading = line[3:].strip() or section_name
            current_lines = []
            continue
        current_lines.append(line)

    if current_lines:
        groups.append((current_heading, current_lines))

    sub_chunks: list[dict] = []
    for heading, lines in groups[:8]:
        sub_chunks.append(
            {
                **base_chunk,
                "title": f"{section_name}-{heading}" if heading != section_name else section_name,
                "content": _build_chunk_content(section_name, "\n".join(lines), [heading, *tags]),
                "chunk_kind": "section_detail",
                "tags": [heading, *tags][:12],
            }
        )
    return sub_chunks


def _build_chunk_content(section_name: str, body: str, tags: list[str]) -> str:
    tag_lines = "\n".join(f"- {tag}" for tag in tags[:8] if tag)
    prefix = f"{section_name}\nTopic: {section_name}\n"
    if tag_lines:
        prefix += f"Keywords\n{tag_lines}\n"
    return f"{prefix}{body}".strip()
