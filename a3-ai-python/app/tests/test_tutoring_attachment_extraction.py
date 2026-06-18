from __future__ import annotations

from io import BytesIO
import zipfile

from openpyxl import Workbook
from docx import Document

from app.services.tutoring_image_storage import extract_tutoring_attachment_text


def _build_docx_bytes(paragraphs: list[str]) -> bytes:
    document = Document()
    for paragraph in paragraphs:
        document.add_paragraph(paragraph)
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def _build_xlsx_bytes(rows: list[list[str]]) -> bytes:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Study Plan"
    for row in rows:
        worksheet.append(row)
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _build_pptx_bytes(slides: list[list[str]]) -> bytes:
    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>"""
    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>"""
    presentation = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
</p:presentation>"""
    presentation_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>"""

    slide_text = "".join(f"<a:t>{text}</a:t>" for text in slides[0])
    slide_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>{slide_text}</a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>"""

    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("ppt/presentation.xml", presentation)
        archive.writestr("ppt/_rels/presentation.xml.rels", presentation_rels)
        archive.writestr("ppt/slides/slide1.xml", slide_xml)
    return buffer.getvalue()


def _build_pdf_bytes(lines: list[str]) -> bytes:
    content_lines = ["BT", "/F1 12 Tf", "72 720 Td"]
    for index, line in enumerate(lines):
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        if index == 0:
            content_lines.append(f"({escaped}) Tj")
        else:
            content_lines.append("0 -18 Td")
            content_lines.append(f"({escaped}) Tj")
    content_lines.append("ET")
    stream = "\n".join(content_lines).encode("latin-1", errors="ignore")

    objects = [
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
        b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
        b"5 0 obj << /Length " + str(len(stream)).encode("ascii") + b" >> stream\n" + stream + b"\nendstream endobj",
    ]

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)
        pdf.extend(b"\n")
    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        (
            f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF"
        ).encode("ascii")
    )
    return bytes(pdf)


def test_extracts_text_from_plain_text_attachment() -> None:
    result = extract_tutoring_attachment_text("Hooks help organize state".encode("utf-8"), "text/plain")
    assert result == "Hooks help organize state"


def test_extracts_text_from_docx_attachment() -> None:
    payload = _build_docx_bytes(["React 状态管理要点", "Context 配合 reducer 管理共享状态"])
    result = extract_tutoring_attachment_text(
        payload,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    assert result is not None
    assert "React 状态管理要点" in result
    assert "Context 配合 reducer 管理共享状态" in result


def test_extracts_text_from_xlsx_attachment() -> None:
    payload = _build_xlsx_bytes(
        [
            ["任务", "说明"],
            ["拆分状态", "优先区分局部和全局状态"],
            ["复习", "12 小时后回顾"],
        ]
    )
    result = extract_tutoring_attachment_text(
        payload,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    assert result is not None
    assert "[Study Plan]" in result
    assert "拆分状态 | 优先区分局部和全局状态" in result


def test_extracts_text_from_pptx_attachment() -> None:
    payload = _build_pptx_bytes([["第1页标题", "状态管理拆分原则"]])
    result = extract_tutoring_attachment_text(
        payload,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )
    assert result is not None
    assert "[幻灯片 1]" in result
    assert "状态管理拆分原则" in result


def test_extracts_text_from_pdf_attachment() -> None:
    payload = _build_pdf_bytes(["React state management", "Prefer one-way data flow"])
    result = extract_tutoring_attachment_text(payload, "application/pdf")
    assert result is not None
    assert "React state management" in result
