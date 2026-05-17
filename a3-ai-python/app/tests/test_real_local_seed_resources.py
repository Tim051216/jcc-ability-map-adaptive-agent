from scripts.init_real_local_data import build_software_engineering_seed_resources


def test_build_software_engineering_seed_resources() -> None:
    resources = build_software_engineering_seed_resources()

    assert len(resources) == 6
    assert all(item.course_code == "software_engineering_4th" for item in resources)
    assert any(item.resource_type == "mindmap" for item in resources)
    assert any("章节知识图谱" in item.content_markdown for item in resources)
