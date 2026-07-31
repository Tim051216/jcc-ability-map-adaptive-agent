from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.rag.ingest.loaders import KnowledgeCoursePayload, KnowledgeSection

BASE_WINDOW_TOKENS = 512
OVERLAP_TOKENS = 128
SHORT_TEXT_TOKENS = 150
MAX_SECTION_DETAIL_CHUNKS = 16


@dataclass
class _SemanticBlock:
    heading: str
    lines: list[str]
    block_kind: str = "text"
    tags: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


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


def estimate_tokens(text: str) -> int:
    """Conservative tokenizer-free estimate for mixed Chinese and Latin text."""

    normalized = str(text or "")
    cjk_count = len(re.findall(r"[\u4e00-\u9fff]", normalized))
    latin_words = len(re.findall(r"[A-Za-z0-9_+-]+", normalized))
    punctuation = len(re.findall(r"[^\sA-Za-z0-9_+-\u4e00-\u9fff]", normalized))
    return cjk_count + latin_words + max(1, punctuation // 3)


def _split_section(section: KnowledgeSection) -> list[dict]:
    section_name = section.name or "section"
    body = _normalize_newlines(section.description or "")
    if not body:
        return []

    base = {
        "priority": int(section.priority or 0),
        "source_name": section.source_name,
        "source_path": section.source_path,
    }
    section_tags = list(section.tags or [])
    chunks: list[dict] = []

    section_overview = _build_section_overview(section_name, body, section_tags, base)
    if section_overview:
        chunks.append(section_overview)

    blocks = _merge_short_text_blocks(_parse_semantic_blocks(section_name, body, section_tags))
    detail_count = 0
    for block in blocks:
        if block.block_kind == "table":
            chunks.append(_build_table_chunk(section_name, block, section_tags, base))
            continue

        block_text = "\n".join(block.lines).strip()
        if not block_text:
            continue

        chunk_kind = "section" if block.heading == section_name else "section_detail"
        title = section_name if block.heading == section_name else f"{section_name}-{block.heading}"

        if estimate_tokens(block_text) <= BASE_WINDOW_TOKENS:
            chunks.append(
                {
                    **base,
                    "title": title,
                    "content": _build_chunk_content(section_name, block_text, block.tags),
                    "chunk_kind": chunk_kind,
                    "tags": _dedupe([block.heading, *block.tags])[:12],
                }
            )
            continue

        windows = _sliding_token_windows(block.lines)
        for index, window_text in enumerate(windows, start=1):
            detail_count += 1
            if detail_count > MAX_SECTION_DETAIL_CHUNKS:
                break
            chunks.append(
                {
                    **base,
                    "title": f"{title}-part-{index}",
                    "content": _build_chunk_content(section_name, window_text, block.tags),
                    "chunk_kind": f"{chunk_kind}_window",
                    "tags": _dedupe([block.heading, *block.tags])[:12],
                }
            )
        if detail_count > MAX_SECTION_DETAIL_CHUNKS:
            break

    return _dedupe_chunks(chunks)


def _build_section_overview(
    section_name: str,
    body: str,
    tags: list[str],
    base: dict[str, Any],
) -> dict | None:
    lines = [
        line.strip()
        for line in body.splitlines()
        if line.strip() and not line.strip().startswith("|")
    ]
    if not lines:
        return None

    preview_lines: list[str] = []
    token_count = 0
    for line in lines:
        if line.startswith("## ") and preview_lines:
            break
        next_count = token_count + estimate_tokens(line)
        if next_count > BASE_WINDOW_TOKENS:
            break
        preview_lines.append(line)
        token_count = next_count

    if not preview_lines:
        preview_lines = lines[:1]

    return {
        **base,
        "title": section_name,
        "content": _build_chunk_content(section_name, "\n".join(preview_lines), tags),
        "chunk_kind": "section",
        "tags": list(tags or [])[:12],
    }


def _parse_semantic_blocks(
    section_name: str,
    body: str,
    section_tags: list[str],
) -> list[_SemanticBlock]:
    blocks: list[_SemanticBlock] = []
    current_heading = section_name
    current_lines: list[str] = []
    pending_table: list[str] = []

    def flush_text() -> None:
        nonlocal current_lines
        if current_lines:
            blocks.append(
                _SemanticBlock(
                    heading=current_heading,
                    lines=current_lines,
                    tags=_dedupe([current_heading, *section_tags]),
                )
            )
            current_lines = []

    def flush_table() -> None:
        nonlocal pending_table
        if pending_table:
            blocks.append(
                _SemanticBlock(
                    heading=current_heading,
                    lines=pending_table,
                    block_kind="table",
                    tags=_dedupe([current_heading, *section_tags, "table"]),
                    metadata={"table_headers": _extract_table_headers(pending_table)},
                )
            )
            pending_table = []

    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line:
            flush_table()
            flush_text()
            continue
        if line.startswith("## "):
            flush_table()
            flush_text()
            current_heading = line[3:].strip() or section_name
            continue
        if _is_markdown_table_line(line):
            flush_text()
            pending_table.append(line)
            continue
        flush_table()
        current_lines.append(line)

    flush_table()
    flush_text()
    return blocks


def _merge_short_text_blocks(blocks: list[_SemanticBlock]) -> list[_SemanticBlock]:
    merged: list[_SemanticBlock] = []
    for block in blocks:
        if block.block_kind == "table":
            merged.append(block)
            continue

        block_text = "\n".join(block.lines)
        if (
            merged
            and merged[-1].block_kind == "text"
            and merged[-1].heading == block.heading
            and estimate_tokens(block_text) < SHORT_TEXT_TOKENS
        ):
            merged[-1].lines.extend(block.lines)
            merged[-1].tags = _dedupe([*merged[-1].tags, *block.tags])
            continue
        merged.append(block)

    if len(merged) >= 2:
        last = merged[-1]
        prev = merged[-2]
        if (
            last.block_kind == "text"
            and prev.block_kind == "text"
            and last.heading == prev.heading
            and estimate_tokens("\n".join(last.lines)) < SHORT_TEXT_TOKENS
        ):
            prev.lines.extend(last.lines)
            prev.tags = _dedupe([*prev.tags, *last.tags])
            merged.pop()
    return merged


def _sliding_token_windows(lines: list[str]) -> list[str]:
    units = _split_lines_to_units(lines)
    windows: list[str] = []
    current: list[str] = []
    current_tokens = 0

    for unit in units:
        unit_tokens = estimate_tokens(unit)
        if current and current_tokens + unit_tokens > BASE_WINDOW_TOKENS:
            windows.append("\n".join(current).strip())
            current = _overlap_tail(current)
            current_tokens = estimate_tokens("\n".join(current))
        if unit_tokens > BASE_WINDOW_TOKENS:
            for part in _split_long_unit(unit):
                part_tokens = estimate_tokens(part)
                if current and current_tokens + part_tokens > BASE_WINDOW_TOKENS:
                    windows.append("\n".join(current).strip())
                    current = _overlap_tail(current)
                    current_tokens = estimate_tokens("\n".join(current))
                current.append(part)
                current_tokens += part_tokens
            continue
        current.append(unit)
        current_tokens += unit_tokens

    if current:
        windows.append("\n".join(current).strip())
    return [window for window in windows if window]


def _split_lines_to_units(lines: list[str]) -> list[str]:
    units: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if estimate_tokens(stripped) <= BASE_WINDOW_TOKENS:
            units.append(stripped)
            continue
        parts = re.split(r"(?<=[。！？.!?；;])", stripped)
        units.extend(part.strip() for part in parts if part.strip())
    return units


def _split_long_unit(text: str) -> list[str]:
    pieces: list[str] = []
    buffer = ""
    for char in text:
        candidate = f"{buffer}{char}"
        if buffer and estimate_tokens(candidate) > BASE_WINDOW_TOKENS:
            pieces.append(buffer)
            buffer = char
        else:
            buffer = candidate
    if buffer:
        pieces.append(buffer)
    return pieces


def _overlap_tail(units: list[str]) -> list[str]:
    tail: list[str] = []
    total = 0
    for unit in reversed(units):
        token_count = estimate_tokens(unit)
        if tail and total + token_count > OVERLAP_TOKENS:
            break
        tail.insert(0, unit)
        total += token_count
    return tail


def _build_table_chunk(
    section_name: str,
    block: _SemanticBlock,
    section_tags: list[str],
    base: dict[str, Any],
) -> dict:
    headers = list(block.metadata.get("table_headers") or [])
    heading = block.heading or section_name
    table_title = (
        f"{section_name}-{heading}-table"
        if heading != section_name
        else f"{section_name}-table"
    )
    table_tags = _dedupe([heading, *headers, *section_tags, "table"])
    content = _build_chunk_content(
        section_name,
        "\n".join(block.lines),
        table_tags,
    )
    return {
        **base,
        "title": table_title,
        "content": content,
        "chunk_kind": "table",
        "tags": table_tags[:12],
        "table_headers": headers,
    }


def _build_chunk_content(section_name: str, body: str, tags: list[str]) -> str:
    tag_lines = "\n".join(f"- {tag}" for tag in tags[:8] if tag)
    prefix = f"{section_name}\nTopic: {section_name}\n"
    if tag_lines:
        prefix += f"Keywords\n{tag_lines}\n"
    return f"{prefix}{body}".strip()


def _normalize_newlines(text: str) -> str:
    normalized = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def _is_markdown_table_line(line: str) -> bool:
    stripped = line.strip()
    return stripped.startswith("|") and stripped.endswith("|") and stripped.count("|") >= 2


def _extract_table_headers(lines: list[str]) -> list[str]:
    for line in lines:
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        headers = [
            cell
            for cell in cells
            if cell and not re.fullmatch(r":?-{2,}:?", cell)
        ]
        if headers:
            return headers[:12]
    return []


def _dedupe(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = str(value or "").strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
    return result


def _dedupe_chunks(chunks: list[dict]) -> list[dict]:
    deduped: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for chunk in chunks:
        key = (str(chunk.get("title") or ""), str(chunk.get("content") or ""))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(chunk)
    return deduped
