import csv
import json
import zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = (
    ROOT
    / "docs"
    / "course-materials"
    / "software-engineering-4th"
    / "9787302610724【资源】软件工程4版(含大纲-教案)贾铁军"
)
OUTPUT_DIR = ROOT / "docs" / "course-materials" / "software-engineering-4th"
KB_DIR = ROOT / "a3-ai-python" / "knowledge_base" / "software_engineering_4th"

WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
DRAWING_NS = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
PREVIEWABLE_EXTENSIONS = {".docx", ".pptx"}
IMPORTANT_EXTENSIONS = {".docx", ".doc", ".pptx", ".ppt", ".pdf", ".mp4", ".avi", ".java"}


def read_docx_preview(path: Path, limit: int = 600) -> str:
    try:
        with zipfile.ZipFile(path) as archive:
            xml_bytes = archive.read("word/document.xml")
        root = ElementTree.fromstring(xml_bytes)
    except Exception:
        return ""

    paragraphs: list[str] = []
    for paragraph in root.findall(".//w:p", WORD_NS):
        texts = [node.text for node in paragraph.findall(".//w:t", WORD_NS) if node.text]
        line = "".join(texts).strip()
        if line:
            paragraphs.append(line)
        if len("\n".join(paragraphs)) >= limit:
            break

    return "\n".join(paragraphs)[:limit].strip()


def read_pptx_preview(path: Path, limit: int = 600) -> str:
    snippets: list[str] = []
    try:
        with zipfile.ZipFile(path) as archive:
            slide_names = sorted(
                name
                for name in archive.namelist()
                if name.startswith("ppt/slides/slide") and name.endswith(".xml")
            )
            for slide_name in slide_names[:5]:
                root = ElementTree.fromstring(archive.read(slide_name))
                texts = [node.text for node in root.findall(".//a:t", DRAWING_NS) if node.text]
                merged = " ".join(text.strip() for text in texts if text and text.strip())
                if merged:
                    snippets.append(merged)
                if len("\n".join(snippets)) >= limit:
                    break
    except Exception:
        return ""

    return "\n".join(snippets)[:limit].strip()


def read_preview(path: Path) -> str:
    ext = path.suffix.lower()
    if ext == ".docx":
        return read_docx_preview(path)
    if ext == ".pptx":
        return read_pptx_preview(path)
    return ""


def build_inventory() -> list[dict]:
    rows: list[dict] = []
    for path in sorted(SOURCE_DIR.rglob("*")):
        if not path.is_file():
            continue
        if path.name.startswith("~$"):
            continue

        relative_path = path.relative_to(SOURCE_DIR).as_posix()
        parts = relative_path.split("/")
        top_level_category = parts[0] if len(parts) > 1 else "根目录文件"
        extension = path.suffix.lower()

        rows.append(
            {
                "relative_path": relative_path,
                "top_level_category": top_level_category,
                "extension": extension,
                "size_bytes": path.stat().st_size,
                "preview": read_preview(path) if extension in PREVIEWABLE_EXTENSIONS else "",
            }
        )
    return rows


def write_inventory(rows: list[dict]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    json_path = OUTPUT_DIR / "material_index.json"
    csv_path = OUTPUT_DIR / "material_index.csv"

    json_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["relative_path", "top_level_category", "extension", "size_bytes", "preview"],
        )
        writer.writeheader()
        writer.writerows(rows)


def write_knowledge_base(rows: list[dict]) -> None:
    KB_DIR.mkdir(parents=True, exist_ok=True)
    for existing_file in KB_DIR.glob("*.md"):
        existing_file.unlink()

    category_counter = Counter(row["top_level_category"] for row in rows)
    extension_counter = Counter(row["extension"] for row in rows)
    total_size = sum(row["size_bytes"] for row in rows)
    categories = sorted(category_counter.keys())

    overview_lines = [
        "# 软件工程与实践（第4版）课程资料库",
        "",
        "本知识库由项目内真实课程资料自动整理生成，来源于教材配套教学资源压缩包。",
        "",
        "## 资料统计",
        "",
        f"- 文件总数：{len(rows)}",
        f"- 总体积：{round(total_size / (1024 * 1024 * 1024), 2)} GB",
        f"- 一级目录数：{len(categories)}",
        "",
        "## 一级目录",
        "",
    ]
    for index, category in enumerate(categories, start=1):
        overview_lines.append(f"- {category}：{category_counter[category]} 个文件，对应 `section_{index:02d}.md`")

    overview_lines.extend(
        [
            "",
            "## 高频文件类型",
            "",
        ]
    )
    for ext, count in extension_counter.most_common(12):
        label = ext or "[no extension]"
        overview_lines.append(f"- `{label}`：{count}")

    overview_lines.extend(
        [
            "",
            "## 资料位置",
            "",
            f"- 原始资料目录：`{SOURCE_DIR.as_posix()}`",
            f"- 清单文件：`{(OUTPUT_DIR / 'material_index.json').as_posix()}`",
            "",
            "## 使用建议",
            "",
            "- 优先从教学大纲、教案、PPT中抽取课程章节与教学目标。",
            "- 习题、试卷、实验报告可用于题库与资源推荐。",
            "- 视频、源码类资源建议按主题二次拆分后再入库。",
        ]
    )
    (KB_DIR / "00_overview.md").write_text("\n".join(overview_lines) + "\n", encoding="utf-8")

    for index, category in enumerate(categories, start=1):
        category_rows = [row for row in rows if row["top_level_category"] == category]
        ext_counter = Counter(row["extension"] for row in category_rows)
        important_files = [row for row in category_rows if row["extension"] in IMPORTANT_EXTENSIONS][:20]
        preview_rows = [row for row in category_rows if row["preview"]][:3]

        top_extensions = ", ".join(
            f"{(ext or '[no extension]')} {count}" for ext, count in ext_counter.most_common(8)
        )
        lines = [
            f"# {category}",
            "",
            f"- 文件数：{len(category_rows)}",
            f"- 主要类型：{top_extensions}",
            "",
            "## 代表文件",
            "",
        ]

        for row in important_files:
            lines.append(f"- `{row['relative_path']}`")

        if preview_rows:
            lines.extend(["", "## 可提取文本预览", ""])
            for row in preview_rows:
                lines.append(f"### {Path(row['relative_path']).name}")
                lines.append("")
                lines.append(row["preview"] or "暂无文本预览")
                lines.append("")

        lines.extend(["## 入库备注", "", "建议后续按章节、题型、实验主题做更细粒度拆分。", ""])
        (KB_DIR / f"section_{index:02d}.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    if not SOURCE_DIR.exists():
        raise SystemExit(f"source directory not found: {SOURCE_DIR}")

    rows = build_inventory()
    write_inventory(rows)
    write_knowledge_base(rows)
    print(f"indexed {len(rows)} files from {SOURCE_DIR}")


if __name__ == "__main__":
    main()
