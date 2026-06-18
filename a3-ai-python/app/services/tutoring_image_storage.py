"""
辅导附件上传：上传到 S3-compatible 对象存储，并尽量提取可用于 AI 分析的正文。
"""
from __future__ import annotations

import io
import re
import uuid
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass

from pypdf import PdfReader

from app.services.s3_compatible_storage_service import S3CompatibleStorageService

MAX_IMAGE_BYTES = 2 * 1024 * 1024
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_EXTRACTED_TEXT_LENGTH = 6000

_ALLOWED_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
        "application/json",
        "application/zip",
        "application/x-rar-compressed",
        "application/x-7z-compressed",
    }
)

_TEXT_LIKE_TYPES = frozenset({"text/plain", "text/markdown", "text/csv", "application/json"})

_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/markdown": ".md",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "text/csv": ".csv",
    "application/json": ".json",
    "application/zip": ".zip",
    "application/x-rar-compressed": ".rar",
    "application/x-7z-compressed": ".7z",
}


@dataclass(slots=True)
class TutoringAttachmentUploadResult:
    url: str
    extracted_text: str | None = None


def _normalize_text(text: str) -> str:
    normalized = (text or "").replace("\r\n", "\n").strip()
    if not normalized:
        return ""
    if len(normalized) <= MAX_EXTRACTED_TEXT_LENGTH:
        return normalized
    return f"{normalized[:MAX_EXTRACTED_TEXT_LENGTH]}\n...(内容已截断)"


def _extract_docx_text(data: bytes) -> str:
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        xml_bytes = archive.read("word/document.xml")
    root = ET.fromstring(xml_bytes)
    lines: list[str] = []
    for paragraph in root.findall(".//w:body/w:p", namespace):
        texts = [node.text or "" for node in paragraph.findall(".//w:t", namespace)]
        line = "".join(texts).strip()
        if line:
            lines.append(line)
    return _normalize_text("\n".join(lines))


def _extract_pdf_text(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    chunks: list[str] = []
    for page in reader.pages[:10]:
        text = page.extract_text() or ""
        if text.strip():
            chunks.append(text.strip())
        if sum(len(item) for item in chunks) >= MAX_EXTRACTED_TEXT_LENGTH:
            break
    return _normalize_text("\n\n".join(chunks))


def _load_xlsx_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    ns_main = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    values: list[str] = []
    for item in root.findall("a:si", ns_main):
        texts = [node.text or "" for node in item.findall(".//a:t", ns_main)]
        values.append("".join(texts))
    return values


def _load_xlsx_sheet_names(archive: zipfile.ZipFile) -> list[str]:
    ns_main = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    if "xl/workbook.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/workbook.xml"))
    return [sheet.attrib.get("name", "") for sheet in root.findall(".//a:sheets/a:sheet", ns_main)]


def _read_xlsx_cell_value(cell: ET.Element, namespace: dict[str, str], shared_strings: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    value_node = cell.find("a:v", namespace)
    if cell_type == "inlineStr":
        texts = [node.text or "" for node in cell.findall(".//a:t", namespace)]
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


def _extract_xlsx_text(data: bytes) -> str:
    ns_main = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        shared_strings = _load_xlsx_shared_strings(archive)
        sheet_names = _load_xlsx_sheet_names(archive)
        sections: list[str] = []
        sheet_files = sorted(name for name in archive.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", name))
        for index, sheet_file in enumerate(sheet_files[:5], start=1):
            sheet_xml = ET.fromstring(archive.read(sheet_file))
            rows: list[str] = []
            for row in sheet_xml.findall(".//a:sheetData/a:row", ns_main)[:20]:
                values: list[str] = []
                for cell in row.findall("a:c", ns_main):
                    value = _read_xlsx_cell_value(cell, ns_main, shared_strings).strip()
                    if value:
                        values.append(value)
                if values:
                    rows.append(" | ".join(values))
            if rows:
                title = sheet_names[index - 1] if index - 1 < len(sheet_names) else f"Sheet {index}"
                sections.append(f"[{title}]\n" + "\n".join(rows))
    return _normalize_text("\n\n".join(sections))


def _extract_pptx_text(data: bytes) -> str:
    ns_drawing = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        slide_files = sorted(name for name in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name))
        slides: list[str] = []
        for index, slide_file in enumerate(slide_files[:10], start=1):
            root = ET.fromstring(archive.read(slide_file))
            texts = [node.text.strip() for node in root.findall(".//a:t", ns_drawing) if node.text and node.text.strip()]
            if texts:
                slides.append(f"[幻灯片 {index}]\n" + "\n".join(texts))
    return _normalize_text("\n\n".join(slides))


def extract_tutoring_attachment_text(data: bytes, content_type: str) -> str | None:
    ct = (content_type or "").split(";")[0].strip().lower()
    try:
        if ct in _TEXT_LIKE_TYPES:
            return _normalize_text(data.decode("utf-8", errors="ignore"))
        if ct == "application/pdf":
            return _extract_pdf_text(data)
        if ct == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            return _extract_docx_text(data)
        if ct == "application/vnd.openxmlformats-officedocument.presentationml.presentation":
            return _extract_pptx_text(data)
        if ct == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            return _extract_xlsx_text(data)
    except Exception:
        return None
    return None


def upload_tutoring_question_image(user_id: int, data: bytes, content_type: str) -> str:
    return upload_tutoring_attachment(user_id, data, content_type).url


def upload_tutoring_attachment(user_id: int, data: bytes, content_type: str) -> TutoringAttachmentUploadResult:
    if not data:
        raise ValueError("文件为空")
    ct = (content_type or "").split(";")[0].strip().lower()
    if ct not in _ALLOWED_TYPES:
        raise ValueError("仅支持图片、PDF、Office、文本、压缩包等常见文件格式")
    max_bytes = MAX_IMAGE_BYTES if ct.startswith("image/") else MAX_FILE_BYTES
    if len(data) > max_bytes:
        raise ValueError("图片请小于 2MB，其他文件请小于 10MB")

    storage = S3CompatibleStorageService()
    ext = _EXT.get(ct, ".bin")
    key = f"tutoring/questions/{user_id}/{uuid.uuid4().hex}{ext}"
    url = storage.upload_bytes(object_key=key, data=data, content_type=ct)
    extracted_text = extract_tutoring_attachment_text(data, ct) or None
    return TutoringAttachmentUploadResult(url=url, extracted_text=extracted_text)
