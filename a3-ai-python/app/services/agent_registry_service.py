from pathlib import Path


class AgentRegistryService:
    AGENT_FILE_SUFFIXES = ("_agent.py", "_coordinator.py")

    @classmethod
    def discover(cls) -> list[dict[str, str]]:
        app_dir = Path(__file__).resolve().parents[1]
        agents_dir = app_dir / "agents"
        if not agents_dir.exists():
            return []

        items: list[dict[str, str]] = []
        for file_path in sorted(agents_dir.rglob("*.py")):
            if file_path.name == "__init__.py":
                continue
            if not file_path.name.endswith(cls.AGENT_FILE_SUFFIXES):
                continue

            relative_path = file_path.relative_to(app_dir).as_posix()
            relative_parent_parts = list(file_path.relative_to(agents_dir).parts[:-1])
            category_parts = [part for part in relative_parent_parts if part not in {"nodes"}]
            if not category_parts and file_path.stem.endswith("_coordinator"):
                category_parts = ["tutoring"]

            agent_name = file_path.stem
            items.append(
                {
                    "agent_name": agent_name,
                    "display_name": cls.humanize(agent_name),
                    "category": "/".join(category_parts) if category_parts else "general",
                    "source_path": relative_path,
                }
            )

        unique: dict[str, dict[str, str]] = {}
        for item in items:
            unique.setdefault(item["agent_name"], item)
        return list(unique.values())

    @staticmethod
    def humanize(agent_name: str) -> str:
        parts = [part for part in agent_name.replace("-", "_").split("_") if part]
        return " ".join(part.capitalize() for part in parts) if parts else agent_name
