from app.services.job_knowledge_catalog_service import JobKnowledgeCatalogService


def test_catalog_exposes_all_entries_as_actionable_tasks() -> None:
    response = JobKnowledgeCatalogService.list_items()

    assert response.total == 50
    assert [item.id for item in response.items] == [f"K{index:03d}" for index in range(1, 51)]
    assert all(item.task_prompt for item in response.items)
    assert all(item.skill_point for item in response.items)
    assert all("可审查" in item.skill_point for item in response.items)
    assert len({item.id for item in response.items}) == response.total
    assert all(item.deliverable for item in response.items)
    assert all(item.acceptance_criteria for item in response.items)
    assert all(item.estimated_minutes > 0 for item in response.items)


def test_catalog_filter_keeps_dimension_metadata() -> None:
    response = JobKnowledgeCatalogService.list_items("system_design")

    assert response.total > 0
    assert all(item.ability_dimension == "system_design" for item in response.items)
    assert set(response.ability_dimensions) == {
        "requirement_analysis",
        "system_design",
        "coding_implementation",
        "software_testing",
        "project_collaboration",
    }
