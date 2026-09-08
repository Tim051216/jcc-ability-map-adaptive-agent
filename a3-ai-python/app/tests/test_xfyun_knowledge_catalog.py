import re
from pathlib import Path

CATALOG = (
    Path(__file__).resolve().parents[2]
    / "xfyun_agent"
    / "knowledge"
    / "software-job-ability-knowledge-catalog.md"
)
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
REQUIRED_FIELDS = (
    "能力维度",
    "能力单元",
    "知识点",
    "适用场景",
    "常见错误",
    "学习建议",
    "来源",
)
DIMENSIONS = {
    "requirement_analysis",
    "system_design",
    "coding_implementation",
    "software_testing",
    "project_collaboration",
}


def _entries() -> list[str]:
    text = CATALOG.read_text(encoding="utf-8")
    return re.split(r"(?=^## K\d+ )", text, flags=re.MULTILINE)[1:]


def test_catalog_has_at_least_fifty_structured_entries() -> None:
    entries = _entries()

    assert len(entries) >= 50
    assert {re.search(r"能力维度：([^\n]+)", item).group(1) for item in entries} == DIMENSIONS
    for entry in entries:
        assert all(f"{field}：" in entry for field in REQUIRED_FIELDS)


def test_catalog_sources_are_real_repository_files() -> None:
    for entry in _entries():
        source = re.search(r"来源：([^｜]+)｜", entry)
        assert source, entry[:80]
        source_path = REPOSITORY_ROOT / source.group(1).strip().replace("/", "\\")
        assert source_path.is_file(), source_path
