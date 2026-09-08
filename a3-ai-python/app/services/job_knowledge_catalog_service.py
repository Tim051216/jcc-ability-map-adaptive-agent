from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

from app.schemas.student_portal import JobKnowledgeCatalogItem, JobKnowledgeCatalogResponse


class JobKnowledgeCatalogService:
    CATALOG_PATH = (
        Path(__file__).resolve().parents[2]
        / "xfyun_agent"
        / "knowledge"
        / "software-job-ability-knowledge-catalog.md"
    )
    FIELD_NAMES = (
        "能力维度",
        "能力单元",
        "知识点",
        "适用场景",
        "常见错误",
        "学习建议",
        "安全提示",
        "来源",
    )

    @classmethod
    def list_items(cls, ability_dimension: str | None = None) -> JobKnowledgeCatalogResponse:
        items = list(cls._load_items())
        if ability_dimension:
            items = [item for item in items if item.ability_dimension == ability_dimension]
        return JobKnowledgeCatalogResponse(
            total=len(items),
            ability_dimensions=sorted({item.ability_dimension for item in cls._load_items()}),
            items=items,
        )

    @classmethod
    @lru_cache(maxsize=1)
    def _load_items(cls) -> tuple[JobKnowledgeCatalogItem, ...]:
        text = cls.CATALOG_PATH.read_text(encoding="utf-8")
        blocks = re.split(r"(?=^## K\d+ )", text, flags=re.MULTILINE)[1:]
        items: list[JobKnowledgeCatalogItem] = []
        for block in blocks:
            heading = re.match(r"## (K\d+) (.+)", block)
            if not heading:
                continue
            fields = {
                name: cls._read_field(block, name)
                for name in cls.FIELD_NAMES
            }
            source, _, locator = fields["来源"].partition("｜")
            items.append(
                JobKnowledgeCatalogItem(
                    id=heading.group(1),
                    title=heading.group(2).strip(),
                    ability_dimension=fields["能力维度"],
                    ability_unit=fields["能力单元"],
                    knowledge_point=fields["知识点"],
                    skill_point=f"能够将“{heading.group(2).strip()}”应用到{fields['适用场景']}，并提交可审查的岗位产出。",
                    applicable_scenario=fields["适用场景"],
                    common_error=fields["常见错误"],
                    learning_advice=fields["学习建议"],
                    safety_notice=fields["安全提示"],
                    source_path=source.strip(),
                    source_locator=locator.strip() or None,
                    task_prompt=f"围绕“{heading.group(2).strip()}”完成一次岗位实训练习：{fields['学习建议']}",
                    deliverable=f"提交一份与“{fields['适用场景']}”对应的可审查产出，并说明采用的步骤。",
                    acceptance_criteria=f"产出应覆盖知识点要求，能够说明至少一个边界或风险，并引用来源：{source.strip()}",
                    estimated_minutes=45,
                )
            )
        return tuple(items)

    @staticmethod
    def _read_field(block: str, name: str) -> str:
        match = re.search(rf"^- {re.escape(name)}：(.+)$", block, flags=re.MULTILINE)
        return match.group(1).strip() if match else ""
