from io import BytesIO
import zipfile

from docx import Document

from app.services.resource_management_service import ResourceManagementService


def test_render_download_content_supports_mermaid_export() -> None:
    service = ResourceManagementService()
    resource = {
        "id": 1,
        "title": "排序算法导图",
        "resource_name": "排序算法导图",
        "description": "用于梳理排序算法结构",
        "summary": "用于梳理排序算法结构",
        "resource_type": 2,
        "student_id": 1001,
        "course_id": 1,
        "knowledge_point_id": 1,
        "status": 2,
        "version": 1,
        "file_format": "mermaid",
        "create_time": ResourceManagementService._now_iso(),
        "update_time": ResourceManagementService._now_iso(),
        "mindmap": {
            "mermaid_code": "mindmap\n  root((排序算法))\n    冒泡排序\n    快速排序"
        },
    }

    content = service._render_download_content(resource, format="mermaid").decode("utf-8")

    assert content.startswith("mindmap")
    assert "快速排序" in content


def test_render_download_content_supports_xmind_export() -> None:
    service = ResourceManagementService()
    resource = {
        "id": 2,
        "title": "数据结构导图",
        "resource_name": "数据结构导图",
        "description": "用于梳理数据结构主线",
        "summary": "用于梳理数据结构主线",
        "resource_type": 2,
        "student_id": 1001,
        "course_id": 1,
        "knowledge_point_id": 1,
        "status": 2,
        "version": 1,
        "file_format": "mermaid",
        "create_time": ResourceManagementService._now_iso(),
        "update_time": ResourceManagementService._now_iso(),
        "mindmap": {
            "mermaid_code": "mindmap\n  root((数据结构))\n    线性表\n    树\n      二叉树"
        },
    }

    binary = service._render_download_content(resource, format="xmind")
    archive = zipfile.ZipFile(BytesIO(binary))

    assert "content.xml" in archive.namelist()
    content_xml = archive.read("content.xml").decode("utf-8")
    assert "数据结构导图" in content_xml
    assert "二叉树" in content_xml


def test_render_docx_content_formats_question_bank() -> None:
    service = ResourceManagementService()
    detail = {
        "title": "Python 随堂练习",
        "summary": "共 2 题，覆盖条件分支与循环",
        "description": "共 2 题，覆盖条件分支与循环",
        "questions": [
            {
                "question": "for 循环最适合哪类场景？",
                "options": {"A": "固定次数遍历", "B": "图像渲染", "C": "数据库迁移"},
                "answer": "A",
                "explanation": "当可迭代对象或次数明确时优先使用 for。",
                "knowledge_points": "循环结构",
            },
            {
                "question": "说出 break 与 continue 的区别。",
                "answer": "break 终止循环，continue 跳过本轮。",
                "explanation": "一个结束整体循环，一个仅跳过当前轮次。",
                "knowledge_points": "循环控制",
            },
        ],
        "question_bank": {"questions": []},
        "content": "",
    }

    binary = service._render_docx_content(detail)
    document = Document(BytesIO(binary))
    paragraphs = [paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()]

    assert "题目列表" in paragraphs
    assert any("1. for 循环最适合哪类场景？" in paragraph for paragraph in paragraphs)
    assert any("A. 固定次数遍历" in paragraph for paragraph in paragraphs)
    assert any("答案：A" in paragraph for paragraph in paragraphs)
    assert any("知识点：循环控制" in paragraph for paragraph in paragraphs)
