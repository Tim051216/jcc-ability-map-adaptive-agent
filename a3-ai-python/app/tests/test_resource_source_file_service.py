import zipfile
from pathlib import Path
from types import SimpleNamespace

from app.services.resource_source_file_service import ResourceSourceFileService


def test_collects_software_engineering_source_files() -> None:
    rows = ResourceSourceFileService()._collect_selected_files(resource_id=106)

    assert rows
    assert any(str(item["display_name"]).endswith(".docx") for item in rows)
    assert all(str(item["top_level_category"]).strip() for item in rows)


def test_to_ref_exposes_preview_url_for_docx() -> None:
    service = ResourceSourceFileService()
    ref = service._to_ref(
        SimpleNamespace(
            id=7,
            display_name="sample.docx",
            relative_path="unit/sample.docx",
            top_level_category="unit",
            file_extension=".docx",
            mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            file_size=1024,
            preview_text=None,
            is_inline_previewable=False,
        )
    )

    expected_mode = "office-pdf" if service._soffice_path else "html"
    assert ref.preview_mode == expected_mode
    assert ref.preview_url == "/api/v1/resource/source-files/7/preview"


def test_to_ref_marks_video_files_for_player_mode() -> None:
    ref = ResourceSourceFileService()._to_ref(
        SimpleNamespace(
            id=9,
            display_name="demo.mp4",
            relative_path="unit/demo.mp4",
            top_level_category="unit",
            file_extension=".mp4",
            mime_type="video/mp4",
            file_size=2048,
            preview_text=None,
            is_inline_previewable=False,
        )
    )

    assert ref.preview_mode == "video"
    assert ref.preview_url == "/api/v1/resource/source-files/9/preview"


def test_to_ref_uses_storage_url_for_inline_preview_when_enabled() -> None:
    service = ResourceSourceFileService()
    service._storage = SimpleNamespace(
        is_enabled=lambda: True,
        upload_file=lambda **_: "https://oss.example/course-source-files/software/unit/sample.pdf",
    )
    service._require_source_path = lambda _: Path(__file__)

    ref = service._to_ref(
        SimpleNamespace(
            id=12,
            resource_id=106,
            course_code="software_engineering_4th",
            display_name="sample.pdf",
            relative_path="unit/sample.pdf",
            top_level_category="unit",
            file_extension=".pdf",
            mime_type="application/pdf",
            file_size=512,
            preview_text=None,
            is_inline_previewable=True,
        )
    )

    assert ref.preview_mode == "pdf"
    assert ref.preview_url == "https://oss.example/course-source-files/software/unit/sample.pdf"
    assert ref.open_url == "https://oss.example/course-source-files/software/unit/sample.pdf"


def test_generates_docx_preview_html(tmp_path: Path) -> None:
    service = ResourceSourceFileService()
    service._soffice_path = None
    service._preview_root = tmp_path / "previews"
    docx_path = tmp_path / "demo.docx"
    _write_zip(
        docx_path,
        {
            "[Content_Types].xml": "<Types/>",
            "word/document.xml": (
                "<?xml version='1.0' encoding='UTF-8'?>"
                "<w:document xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'>"
                "<w:body>"
                "<w:p><w:r><w:t>第一段</w:t></w:r></w:p>"
                "<w:p><w:r><w:t>第二段</w:t></w:r></w:p>"
                "</w:body>"
                "</w:document>"
            ),
        },
    )

    preview_path = service._ensure_office_preview_artifact(
        SimpleNamespace(id=11, display_name="demo.docx", file_extension=".docx"),
        docx_path,
    )

    content = preview_path.read_text(encoding="utf-8")
    assert "第一段" in content
    assert "第二段" in content


def _write_zip(path: Path, files: dict[str, str]) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
