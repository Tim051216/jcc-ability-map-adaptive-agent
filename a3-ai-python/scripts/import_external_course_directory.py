from __future__ import annotations

import argparse
import asyncio
import json
import mimetypes
import re
import zipfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

from sqlalchemy import delete, select

from app.db.base import Base
from app.db.models.generated_resource import GeneratedResource
from app.db.models.knowledge_document import KnowledgeChunk, KnowledgeDocument
from app.db.models.resource_source_file import ResourceSourceFile
from app.db.session import async_session_factory, engine
from app.rag.retrieve.vector_store import MilvusVectorStore
from app.services.embedding_service import EmbeddingService


SUPPORTED_EXTENSIONS = {
    ".c",
    ".cc",
    ".cpp",
    ".css",
    ".csv",
    ".doc",
    ".docx",
    ".h",
    ".hpp",
    ".htm",
    ".html",
    ".java",
    ".jpeg",
    ".jpg",
    ".js",
    ".json",
    ".kt",
    ".log",
    ".m3u8",
    ".md",
    ".mov",
    ".mp4",
    ".mpg",
    ".pdf",
    ".png",
    ".ppt",
    ".pptx",
    ".properties",
    ".py",
    ".sql",
    ".ts",
    ".tsx",
    ".txt",
    ".vue",
    ".webm",
    ".wps",
    ".xls",
    ".xlsx",
    ".xml",
    ".yaml",
    ".yml",
}

TEXT_EXTENSIONS = {
    ".c",
    ".cc",
    ".cpp",
    ".css",
    ".csv",
    ".h",
    ".hpp",
    ".htm",
    ".html",
    ".ini",
    ".java",
    ".js",
    ".json",
    ".kt",
    ".log",
    ".md",
    ".properties",
    ".py",
    ".sql",
    ".ts",
    ".tsx",
    ".txt",
    ".vue",
    ".xml",
    ".yaml",
    ".yml",
}

INLINE_EXTENSIONS = {
    ".c",
    ".cc",
    ".cpp",
    ".css",
    ".docx",
    ".h",
    ".hpp",
    ".htm",
    ".html",
    ".java",
    ".jpeg",
    ".jpg",
    ".js",
    ".json",
    ".kt",
    ".md",
    ".pdf",
    ".png",
    ".pptx",
    ".py",
    ".sql",
    ".ts",
    ".tsx",
    ".txt",
    ".vue",
    ".webm",
    ".xlsx",
    ".xml",
    ".yaml",
    ".yml",
}

EXCLUDED_DIR_PARTS = {
    "__macosx",
    "bjflash",
    "bin",
    "build",
    "downloads",
    "drawable",
    "gen",
    "libs",
    "res",
}

EXCLUDED_FILE_NAMES = {
    "thumbs.db",
}

DOCX_NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
XLSX_NAMESPACE = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
PPTX_NAMESPACE = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}


@dataclass
class ImportedFile:
    absolute_path: Path
    relative_path: str
    top_level_category: str
    display_name: str
    file_extension: str
    mime_type: str
    file_size: int
    preview_text: str | None
    extracted_text: str | None
    is_inline_previewable: bool
    sort_order: int


@dataclass
class ResourceGroup:
    key: str
    display_title: str
    resource_type: str
    files: list[ImportedFile]


BUSINESS_RESOURCE_MAP: dict[int, dict[str, object]] = {
    101: {
        "title": "软件工程课程画像与学习导引",
        "resource_type": "lecture_note",
        "summary": "基于教学大纲、教学进度与教案整理的课程导学资料，适合作为进入课程前的整体引导。",
        "study_suggestion": "先看课程定位、培养目标和周次安排，再进入章节学习。",
        "source_titles": ["课程画像", "教学进度与教案"],
        "categories": {"1.教学大纲-进度计划", "2.教案（多种教学模式）"},
    },
    102: {
        "title": "软件工程章节知识图谱",
        "resource_type": "mindmap",
        "summary": "覆盖教材主线章节的知识地图，适合复习前快速定位重点与章节关系。",
        "study_suggestion": "先按章节主线浏览，再返回 PPT 或教案补足细节。",
        "source_titles": ["章节知识图谱", "课程PPT"],
        "categories": {"★《软件工程与实践》4版PPT[新]"},
    },
    103: {
        "title": "软件工程混合式教学组织模板",
        "resource_type": "teaching_plan",
        "summary": "提炼课前、课中、课后与线上线下结合的课堂组织方式，可直接用于备课。",
        "study_suggestion": "备课时优先参考活动节奏和任务分配，再结合本校周次做裁剪。",
        "source_titles": ["教学方法与课堂组织"],
        "categories": {"2.教案（多种教学模式）"},
    },
    104: {
        "title": "软件工程实验与课设选题包",
        "resource_type": "practice_set",
        "summary": "整合案例、实验、课设和扩展视频资料，适合实践教学和项目训练。",
        "study_suggestion": "结合当前章节选择一组实验或案例，再补看对应工具与演示视频。",
        "source_titles": ["实验与课设", "企业案例", "扩展资源"],
        "categories": {
            "3.企业实用报告案例（指导）",
            "4.实验报告-样例",
            "7.实验-课设参考资料",
            "10.手机应用开发(含视频源码)",
            "11.视频拓展及资源",
        },
    },
    105: {
        "title": "软件工程考核与毕业要求说明",
        "resource_type": "assessment_guide",
        "summary": "归纳章节作业、复习资料与试卷参考，适合测评准备和课程验收。",
        "study_suggestion": "复习阶段优先关注题型分布、试卷风格和章节覆盖关系。",
        "source_titles": ["习题与答案", "复习题", "试卷参考"],
        "categories": {
            "4. 习题与答案（含自测）（加密）",
            "8.复习题及答案（加密）",
            "9.试卷库-测试[参考]（加密）",
        },
    },
    106: {
        "title": "软件工程课程资源总览",
        "resource_type": "course_overview",
        "summary": "汇总课程说明、教材配套资料结构、PPT、教案与实验课设入口，适合作为资源中心总览。",
        "study_suggestion": "先从总览确认资源入口，再进入课程画像、PPT、实验与考核资料。",
        "source_titles": ["课程资料库概览", "课程画像", "章节知识图谱"],
        "categories": {
            "(root)",
            "1.教学大纲-进度计划",
            "2.教案（多种教学模式）",
            "7.实验-课设参考资料",
            "★《软件工程与实践》4版PPT[新]",
        },
    },
}


def build_business_resource_groups(groups: list[ResourceGroup]) -> list[ResourceGroup]:
    grouped_by_key = {group.key: group for group in groups}
    business_groups: list[ResourceGroup] = []
    for resource_id, config in BUSINESS_RESOURCE_MAP.items():
        merged_files: list[ImportedFile] = []
        for category in config["categories"]:
            group = grouped_by_key.get(category)
            if group is None:
                continue
            merged_files.extend(group.files)

        if not merged_files:
            continue

        normalized_files: list[ImportedFile] = []
        for index, file in enumerate(sorted(merged_files, key=lambda item: item.relative_path), start=1):
            normalized_files.append(
                ImportedFile(
                    absolute_path=file.absolute_path,
                    relative_path=file.relative_path,
                    top_level_category=file.top_level_category,
                    display_name=file.display_name,
                    file_extension=file.file_extension,
                    mime_type=file.mime_type,
                    file_size=file.file_size,
                    preview_text=file.preview_text,
                    extracted_text=file.extracted_text,
                    is_inline_previewable=file.is_inline_previewable,
                    sort_order=index,
                )
            )

        business_groups.append(
            ResourceGroup(
                key=str(resource_id),
                display_title=str(config["title"]),
                resource_type=str(config["resource_type"]),
                files=normalized_files,
            )
        )
    return business_groups


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Import an external course materials directory.")
    parser.add_argument("--source-dir", required=True, help="Absolute path of the external course directory.")
    parser.add_argument("--course-code", default="software_engineering_4th")
    parser.add_argument("--user-id", type=int, default=1001)
    parser.add_argument("--dry-run", action="store_true")
    return parser


def clean_group_title(value: str) -> str:
    if value == "(root)":
        return "课程说明与下载入口"
    return re.sub(r"^\d+\.\s*", "", value).strip() or value


def infer_resource_type(group_name: str) -> str:
    normalized = group_name.lower()
    if group_name == "(root)":
        return "course_overview"
    if "ppt" in normalized:
        return "lecture_note"
    if "视频" in group_name or "源码" in group_name:
        return "video"
    if "教案" in group_name:
        return "teaching_plan"
    if "教学大纲" in group_name or "进度计划" in group_name:
        return "course_overview"
    if "试卷" in group_name or "复习" in group_name:
        return "assessment_guide"
    if "实验" in group_name or "课设" in group_name or "习题" in group_name:
        return "practice_set"
    return "lecture_note"


def should_include_file(file_path: Path, source_root: Path) -> bool:
    if not file_path.is_file():
        return False
    if file_path.name.startswith("~$"):
        return False
    if file_path.name.lower() in EXCLUDED_FILE_NAMES:
        return False
    if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        return False
    rel_parts = [part.lower() for part in file_path.relative_to(source_root).parts[:-1]]
    if any(part in EXCLUDED_DIR_PARTS for part in rel_parts):
        return False
    return True


def detect_top_level(file_path: Path, source_root: Path) -> str:
    rel = file_path.relative_to(source_root)
    return rel.parts[0] if len(rel.parts) > 1 else "(root)"


def read_text_file(file_path: Path) -> str | None:
    for encoding in ("utf-8", "utf-8-sig", "gb18030", "gbk", "utf-16"):
        try:
            return file_path.read_text(encoding=encoding)
        except Exception:
            continue
    return None


def extract_docx_text(file_path: Path) -> str | None:
    try:
        with zipfile.ZipFile(file_path) as archive:
            xml_bytes = archive.read("word/document.xml")
    except Exception:
        return None

    root = ET.fromstring(xml_bytes)
    lines: list[str] = []
    for paragraph in root.findall(".//w:body/w:p", DOCX_NAMESPACE):
        texts = [node.text or "" for node in paragraph.findall(".//w:t", DOCX_NAMESPACE)]
        line = "".join(texts).strip()
        if line:
            lines.append(line)
    return "\n".join(lines).strip() or None


def load_xlsx_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    values: list[str] = []
    for item in root.findall("a:si", XLSX_NAMESPACE):
        texts = [node.text or "" for node in item.findall(".//a:t", XLSX_NAMESPACE)]
        values.append("".join(texts))
    return values


def load_xlsx_sheet_names(archive: zipfile.ZipFile) -> list[str]:
    if "xl/workbook.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/workbook.xml"))
    return [sheet.attrib.get("name", "") for sheet in root.findall(".//a:sheets/a:sheet", XLSX_NAMESPACE)]


def read_xlsx_cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    value_node = cell.find("a:v", XLSX_NAMESPACE)
    if cell_type == "inlineStr":
        texts = [node.text or "" for node in cell.findall(".//a:t", XLSX_NAMESPACE)]
        return "".join(texts).strip()
    if value_node is None or value_node.text is None:
        return ""
    raw_value = value_node.text.strip()
    if cell_type == "s":
        try:
            return shared_strings[int(raw_value)]
        except Exception:
            return raw_value
    return raw_value


def extract_xlsx_text(file_path: Path) -> str | None:
    try:
        with zipfile.ZipFile(file_path) as archive:
            shared_strings = load_xlsx_shared_strings(archive)
            sheet_names = load_xlsx_sheet_names(archive)
            sections: list[str] = []
            sheet_files = sorted(
                name for name in archive.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", name)
            )
            for index, sheet_file in enumerate(sheet_files, start=1):
                sheet_xml = ET.fromstring(archive.read(sheet_file))
                rows: list[str] = []
                for row in sheet_xml.findall(".//a:sheetData/a:row", XLSX_NAMESPACE):
                    cells = [read_xlsx_cell_value(cell, shared_strings) for cell in row.findall("a:c", XLSX_NAMESPACE)]
                    rendered = "\t".join(cell for cell in cells if cell).strip()
                    if rendered:
                        rows.append(rendered)
                if rows:
                    title = sheet_names[index - 1] if index - 1 < len(sheet_names) else f"Sheet {index}"
                    sections.append(f"{title}\n" + "\n".join(rows[:200]))
    except Exception:
        return None
    return "\n\n".join(sections).strip() or None


def extract_pptx_text(file_path: Path) -> str | None:
    try:
        with zipfile.ZipFile(file_path) as archive:
            slide_files = sorted(
                name for name in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)
            )
            slides: list[str] = []
            for index, slide_file in enumerate(slide_files, start=1):
                root = ET.fromstring(archive.read(slide_file))
                texts = [
                    node.text.strip()
                    for node in root.findall(".//a:t", PPTX_NAMESPACE)
                    if node.text and node.text.strip()
                ]
                if texts:
                    slides.append(f"Slide {index}\n" + "\n".join(texts))
    except Exception:
        return None
    return "\n\n".join(slides).strip() or None


def extract_text(file_path: Path) -> str | None:
    suffix = file_path.suffix.lower()
    if suffix in TEXT_EXTENSIONS:
        return read_text_file(file_path)
    if suffix == ".docx":
        return extract_docx_text(file_path)
    if suffix == ".pptx":
        return extract_pptx_text(file_path)
    if suffix == ".xlsx":
        return extract_xlsx_text(file_path)
    return None


def normalize_preview_text(value: str | None) -> str | None:
    if not value:
        return None
    compact = re.sub(r"\s+", " ", value).strip()
    return compact[:1000] if compact else None


def build_markdown(resource_title: str, files: list[ImportedFile]) -> str:
    ext_counter = Counter(item.file_extension for item in files)
    sample_lines = [f"- `{item.relative_path}`" for item in files[:20]]
    ext_lines = [f"- `{ext}`: {count}" for ext, count in ext_counter.most_common(12)]
    return "\n".join(
        [
            f"# {resource_title}",
            "",
            f"- Total files: {len(files)}",
            f"- Extractable text files: {sum(1 for item in files if item.extracted_text)}",
            "",
            "## Main formats",
            *ext_lines,
            "",
            "## Sample files",
            *sample_lines,
        ]
    ).strip()


def build_summary(files: list[ImportedFile]) -> str:
    ext_counter = Counter(item.file_extension for item in files)
    top_formats = ", ".join(f"{ext} x{count}" for ext, count in ext_counter.most_common(4))
    return f"Imported {len(files)} files. Main formats: {top_formats}."


def build_study_suggestion(resource_type: str) -> str:
    suggestions = {
        "course_overview": "Start with this package to understand the overall course structure and materials.",
        "lecture_note": "Review these teaching materials first, then move to exercises and practice work.",
        "teaching_plan": "Use this package when preparing lessons, classroom activities, or teaching plans.",
        "practice_set": "Use this package for assignments, lab practice, and project-oriented training.",
        "assessment_guide": "Use this package when preparing for tests, review sessions, or assessment design.",
        "video": "Use this package for extended viewing, demonstrations, and multimedia reference.",
    }
    return suggestions.get(resource_type, "Use this package as a structured reference for the course.")


def split_text_chunks(title: str, text: str, *, chunk_size: int = 1400, overlap: int = 180) -> list[str]:
    cleaned = re.sub(r"\r\n?", "\n", text or "").strip()
    if not cleaned:
        return []

    paragraphs = [part.strip() for part in re.split(r"\n{2,}", cleaned) if part.strip()]
    chunks: list[str] = []
    current = ""

    def push_chunk(chunk_text: str) -> None:
        normalized = chunk_text.strip()
        if normalized:
            chunks.append(normalized)

    for paragraph in paragraphs:
        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= chunk_size:
            current = candidate
            continue

        if current:
            push_chunk(current)
        if len(paragraph) <= chunk_size:
            current = paragraph
            continue

        start = 0
        while start < len(paragraph):
            end = min(start + chunk_size, len(paragraph))
            part = paragraph[start:end].strip()
            if part:
                push_chunk(part)
            if end >= len(paragraph):
                break
            start = max(end - overlap, start + 1)
        current = ""

    if current:
        push_chunk(current)

    return [f"{title}\n{chunk}" for chunk in chunks]


def build_groups(source_root: Path) -> list[ResourceGroup]:
    grouped: dict[str, list[ImportedFile]] = {}
    for file_path in sorted(source_root.rglob("*")):
        if not should_include_file(file_path, source_root):
            continue
        top_level = detect_top_level(file_path, source_root)
        relative_path = file_path.relative_to(source_root).as_posix()
        mime_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        extracted_text = extract_text(file_path)
        imported = ImportedFile(
            absolute_path=file_path.resolve(),
            relative_path=relative_path,
            top_level_category=top_level,
            display_name=file_path.name,
            file_extension=file_path.suffix.lower(),
            mime_type=mime_type,
            file_size=file_path.stat().st_size,
            preview_text=normalize_preview_text(extracted_text),
            extracted_text=extracted_text,
            is_inline_previewable=file_path.suffix.lower() in INLINE_EXTENSIONS or mime_type.startswith("text/"),
            sort_order=len(grouped.get(top_level, [])) + 1,
        )
        grouped.setdefault(top_level, []).append(imported)

    groups: list[ResourceGroup] = []
    for key, files in grouped.items():
        display_title = clean_group_title(key)
        groups.append(
            ResourceGroup(
                key=key,
                display_title=display_title,
                resource_type=infer_resource_type(key),
                files=files,
            )
        )
    groups.sort(key=lambda item: item.key)
    return groups


async def ensure_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[
                    GeneratedResource.__table__,
                    ResourceSourceFile.__table__,
                    KnowledgeDocument.__table__,
                    KnowledgeChunk.__table__,
                ],
            )
        )


async def delete_previous_imports(course_code: str, source_root: Path) -> None:
    source_root_str = str(source_root.resolve())
    async with async_session_factory() as session:
        resources = (
            await session.execute(select(GeneratedResource).where(GeneratedResource.course_code == course_code))
        ).scalars().all()
        resource_ids_to_delete = [
            int(resource.id)
            for resource in resources
            if isinstance(resource.generation_context, dict)
            and resource.generation_context.get("import_source_root") == source_root_str
        ]
        if resource_ids_to_delete:
            await session.execute(
                delete(ResourceSourceFile).where(ResourceSourceFile.resource_id.in_(resource_ids_to_delete))
            )
            await session.execute(
                delete(GeneratedResource).where(GeneratedResource.id.in_(resource_ids_to_delete))
            )

        documents = (
            await session.execute(
                select(KnowledgeDocument).where(
                    KnowledgeDocument.course_code == course_code,
                    KnowledgeDocument.source_type == "external_course_directory",
                )
            )
        ).scalars().all()
        document_ids_to_delete = [
            int(document.id)
            for document in documents
            if isinstance(document.metadata_json, dict)
            and document.metadata_json.get("import_source_root") == source_root_str
        ]
        if document_ids_to_delete:
            await session.execute(delete(KnowledgeChunk).where(KnowledgeChunk.document_id.in_(document_ids_to_delete)))
            await session.execute(delete(KnowledgeDocument).where(KnowledgeDocument.id.in_(document_ids_to_delete)))

        await session.commit()

    async with async_session_factory() as session:
        for resource_id in BUSINESS_RESOURCE_MAP:
            await session.execute(delete(ResourceSourceFile).where(ResourceSourceFile.resource_id == resource_id))
        await session.commit()


async def insert_resources_and_files(
    groups: list[ResourceGroup],
    *,
    source_root: Path,
    course_code: str,
    user_id: int,
) -> dict[str, int]:
    imported_resource_ids: dict[str, int] = {}
    async with async_session_factory() as session:
        for group in groups:
            resource_id = int(group.key)
            config = BUSINESS_RESOURCE_MAP[resource_id]
            resource = await session.get(GeneratedResource, resource_id)
            if resource is None:
                raise RuntimeError(f"Business resource {resource_id} is missing. Seed data must exist before import.")

            resource.user_id = user_id
            resource.course_code = course_code
            resource.resource_type = str(config["resource_type"])
            resource.title = str(config["title"])
            resource.summary = str(config["summary"])
            resource.content_markdown = build_markdown(str(config["title"]), group.files)
            resource.source_titles = list(config["source_titles"])
            resource.study_suggestion = str(config["study_suggestion"])
            resource.generation_context = {
                "import_source_root": str(source_root.resolve()),
                "import_group": group.key,
                "import_mode": "business_course_materials",
                "file_count": len(group.files),
            }
            resource.is_archived = False
            resource.download_scope = "owner"
            await session.flush()
            imported_resource_ids[group.key] = resource_id

            session.add_all(
                [
                    ResourceSourceFile(
                        resource_id=resource_id,
                        course_code=course_code,
                        display_name=file.display_name,
                        relative_path=file.relative_path,
                        absolute_path=str(file.absolute_path),
                        top_level_category=file.top_level_category,
                        file_extension=file.file_extension,
                        mime_type=file.mime_type,
                        file_size=file.file_size,
                        preview_text=file.preview_text,
                        is_inline_previewable=file.is_inline_previewable,
                        sort_order=file.sort_order,
                    )
                    for file in group.files
                ]
            )
        await session.commit()
    return imported_resource_ids


async def insert_knowledge_documents(
    groups: list[ResourceGroup],
    *,
    source_root: Path,
    course_code: str,
    resource_ids: dict[str, int],
) -> tuple[int, int]:
    document_count = 0
    chunk_count = 0
    async with async_session_factory() as session:
        for group in groups:
            resource_id = resource_ids[group.key]
            for file in group.files:
                if not file.extracted_text:
                    continue
                chunks = split_text_chunks(file.display_name, file.extracted_text)
                if not chunks:
                    continue
                document = KnowledgeDocument(
                    course_code=course_code,
                    title=file.display_name,
                    source_type="external_course_directory",
                    source_uri=str(file.absolute_path),
                    metadata_json={
                        "import_source_root": str(source_root.resolve()),
                        "relative_path": file.relative_path,
                        "top_level_category": file.top_level_category,
                        "resource_id": resource_id,
                        "group_title": group.display_title,
                        "file_extension": file.file_extension,
                    },
                )
                session.add(document)
                await session.flush()
                session.add_all(
                    [
                        KnowledgeChunk(
                            document_id=int(document.id),
                            chunk_index=index,
                            content=chunk,
                            keywords=file.display_name,
                            metadata_json={
                                "title": file.display_name,
                                "priority": 2,
                                "chunk_kind": "external_material",
                                "source_name": file.display_name,
                                "source_path": file.relative_path,
                                "tags": [group.display_title, file.file_extension.lstrip(".")],
                                "resource_id": resource_id,
                            },
                        )
                        for index, chunk in enumerate(chunks, start=1)
                    ]
                )
                document_count += 1
                chunk_count += len(chunks)
        await session.commit()
    return document_count, chunk_count


async def rebuild_milvus(course_code: str) -> int:
    embedding_service = EmbeddingService()
    vector_store = MilvusVectorStore()
    async with async_session_factory() as session:
        rows = (
            await session.execute(
                select(KnowledgeChunk, KnowledgeDocument)
                .join(KnowledgeDocument, KnowledgeChunk.document_id == KnowledgeDocument.id)
                .where(KnowledgeDocument.course_code == course_code)
                .order_by(KnowledgeDocument.id.asc(), KnowledgeChunk.chunk_index.asc())
            )
        ).all()

    milvus_rows: list[dict] = []
    for chunk, document in rows:
        metadata = chunk.metadata_json or {}
        title = str(metadata.get("title") or document.title or "")
        milvus_rows.append(
            {
                "id": int(chunk.id),
                "vector": await embedding_service.embed_text(f"{title}\n{chunk.content}"),
                "document_id": int(document.id),
                "chunk_id": int(chunk.id),
                "content": str(chunk.content)[:8192],
                "title": title[:255],
                "priority": int(metadata.get("priority", 0) or 0),
                "chunk_kind": str(metadata.get("chunk_kind") or "")[:64],
                "source_name": str(metadata.get("source_name") or "")[:255],
                "source_path": str(metadata.get("source_path") or "")[:500],
                "tags": list(metadata.get("tags", []) or [])[:12],
            }
        )

    if not milvus_rows:
        vector_store.reset_collection(course_code)
        return 0
    return vector_store.upsert_chunks(course_code=course_code, rows=milvus_rows)


def print_plan(groups: list[ResourceGroup]) -> None:
    print("Import plan")
    for group in groups:
        ext_counter = Counter(file.file_extension for file in group.files)
        top_formats = ", ".join(f"{ext}:{count}" for ext, count in ext_counter.most_common(5))
        print(
            f"- {group.display_title} | type={group.resource_type} | files={len(group.files)} | "
            f"text_docs={sum(1 for file in group.files if file.extracted_text)} | {top_formats}"
        )


async def run_import(args: argparse.Namespace) -> None:
    source_root = Path(args.source_dir).expanduser().resolve()
    if not source_root.exists() or not source_root.is_dir():
        raise SystemExit(f"Source directory not found: {source_root}")

    groups = build_groups(source_root)
    if not groups:
        raise SystemExit("No supported files were found under the source directory.")

    business_groups = build_business_resource_groups(groups)
    print_plan(business_groups)
    if args.dry_run:
        return

    await ensure_tables()
    await delete_previous_imports(args.course_code, source_root)
    resource_ids = await insert_resources_and_files(
        business_groups,
        source_root=source_root,
        course_code=args.course_code,
        user_id=args.user_id,
    )
    document_count, chunk_count = await insert_knowledge_documents(
        business_groups,
        source_root=source_root,
        course_code=args.course_code,
        resource_ids=resource_ids,
    )
    milvus_rows = await rebuild_milvus(args.course_code)

    print("")
    print("Import completed")
    print(f"- resources: {len(resource_ids)}")
    print(f"- source files: {sum(len(group.files) for group in business_groups)}")
    print(f"- knowledge documents: {document_count}")
    print(f"- knowledge chunks: {chunk_count}")
    print(f"- milvus rows: {milvus_rows}")


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    asyncio.run(run_import(args))


if __name__ == "__main__":
    main()
