from app.rag.ingest.loaders import KnowledgeCoursePayload, KnowledgeSection
from app.rag.ingest.splitters import BASE_WINDOW_TOKENS, estimate_tokens, split_course_payload


def test_splitter_uses_hierarchical_sliding_windows_without_crossing_h2() -> None:
    first = "需求分析用于明确系统边界、用户目标、业务流程和验收标准。" * 45
    second = "概要设计用于确定模块划分、接口关系、数据结构和部署形态。" * 45
    course = KnowledgeCoursePayload(
        course_code="demo",
        title="软件工程",
        sections=[
            KnowledgeSection(
                name="需求与设计",
                description=f"## 需求分析\n{first}\n\n## 概要设计\n{second}",
                priority=3,
                tags=["需求", "设计"],
            )
        ],
    )

    chunks = split_course_payload(course)
    windows = [item for item in chunks if item.get("chunk_kind") == "section_detail_window"]

    assert windows
    assert all(estimate_tokens(item["content"]) <= BASE_WINDOW_TOKENS + 80 for item in windows)
    assert not any(
        "需求分析用于" in item["content"] and "概要设计用于" in item["content"]
        for item in windows
    )


def test_splitter_keeps_markdown_tables_as_independent_chunks_with_headers() -> None:
    course = KnowledgeCoursePayload(
        course_code="demo",
        title="软件工程",
        sections=[
            KnowledgeSection(
                name="测试计划",
                description=(
                    "## 缺陷统计\n"
                    "| 模块 | 缺陷数 | 优先级 |\n"
                    "| --- | --- | --- |\n"
                    "| 登录 | 3 | 高 |\n"
                    "| 课堂 | 1 | 中 |\n"
                    "\n## 结论\n缺陷集中在登录模块。"
                ),
                priority=3,
                tags=["测试"],
            )
        ],
    )

    table_chunks = [
        item for item in split_course_payload(course) if item.get("chunk_kind") == "table"
    ]

    assert len(table_chunks) == 1
    assert table_chunks[0]["table_headers"] == ["模块", "缺陷数", "优先级"]
    assert "| 登录 | 3 | 高 |" in table_chunks[0]["content"]
    assert "缺陷集中在登录模块" not in table_chunks[0]["content"]


def test_splitter_merges_short_blocks_with_same_heading() -> None:
    course = KnowledgeCoursePayload(
        course_code="demo",
        title="软件工程",
        sections=[
            KnowledgeSection(
                name="课堂纪要",
                description="## 今日纪要\n先复习需求。\n\n再讨论设计。\n\n最后看测试。",
                priority=3,
                tags=["纪要"],
            )
        ],
    )

    chunks = [
        item
        for item in split_course_payload(course)
        if item.get("chunk_kind") == "section_detail" and item["title"] == "课堂纪要-今日纪要"
    ]

    assert len(chunks) == 1
    assert "先复习需求" in chunks[0]["content"]
    assert "最后看测试" in chunks[0]["content"]
