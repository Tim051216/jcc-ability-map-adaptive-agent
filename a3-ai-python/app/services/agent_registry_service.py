from pathlib import Path


class AgentRegistryService:
    AGENT_FILE_SUFFIXES = ("_agent.py", "_coordinator.py")
    CORE_AGENT_DEFINITIONS = {
        "profile_agent": {
            "display_name": "岗位学情诊断智能体",
            "category": "core",
            "source_path": "agents/nodes/profile_agent.py",
        },
        "knowledge_tutoring_agent": {
            "display_name": "知识检索与答疑智能体",
            "category": "core",
            "source_path": "agents/nodes/knowledge_tutoring_agent.py",
        },
        "learning_planning_agent": {
            "display_name": "学习规划智能体",
            "category": "core",
            "source_path": "agents/nodes/learning_planning_agent.py",
        },
        "resource_generation_agent": {
            "display_name": "资源生成智能体",
            "category": "core",
            "source_path": "agents/nodes/resource_generation_agent.py",
        },
        "evaluation_feedback_agent": {
            "display_name": "测评反馈智能体",
            "category": "core",
            "source_path": "agents/nodes/evaluation_feedback_agent.py",
        },
    }
    CORE_AGENT_ALIASES = {
        "profile_agent": "profile_agent",
        "router_agent": "knowledge_tutoring_agent",
        "retriever_agent": "knowledge_tutoring_agent",
        "question_analyzer_agent": "knowledge_tutoring_agent",
        "answer_generator_agent": "knowledge_tutoring_agent",
        "diagram_generator_agent": "knowledge_tutoring_agent",
        "video_recommender_agent": "knowledge_tutoring_agent",
        "tutoring_coordinator": "knowledge_tutoring_agent",
        "knowledge_tutoring_agent": "knowledge_tutoring_agent",
        "info_extractor_agent": "profile_agent",
        "profile_builder_agent": "profile_agent",
        "profile_updater_agent": "profile_agent",
        "planner_agent": "learning_planning_agent",
        "path_planner_agent": "learning_planning_agent",
        "path_optimizer_agent": "learning_planning_agent",
        "learning_planning_agent": "learning_planning_agent",
        "resource_agent": "resource_generation_agent",
        "document_agent": "resource_generation_agent",
        "mindmap_agent": "resource_generation_agent",
        "question_bank_agent": "resource_generation_agent",
        "video_agent": "resource_generation_agent",
        "code_example_agent": "resource_generation_agent",
        "coordinator_agent": "resource_generation_agent",
        "resource_generation_agent": "resource_generation_agent",
        "assessment_agent": "evaluation_feedback_agent",
        "question_generator_agent": "evaluation_feedback_agent",
        "grading_agent": "evaluation_feedback_agent",
        "report_generator_agent": "evaluation_feedback_agent",
        "evaluator_agent": "evaluation_feedback_agent",
        "safety_agent": "evaluation_feedback_agent",
        "evaluation_feedback_agent": "evaluation_feedback_agent",
    }

    @classmethod
    def discover(cls) -> list[dict[str, str]]:
        return [
            {
                "agent_name": agent_name,
                "display_name": definition["display_name"],
                "category": definition["category"],
                "source_path": definition["source_path"],
            }
            for agent_name, definition in cls.CORE_AGENT_DEFINITIONS.items()
        ]

    @classmethod
    def canonical_name(cls, agent_name: str | None) -> str:
        if not agent_name:
            return ""
        return cls.CORE_AGENT_ALIASES.get(agent_name, agent_name)

    @classmethod
    def display_name_for(cls, agent_name: str | None) -> str:
        canonical = cls.canonical_name(agent_name)
        definition = cls.CORE_AGENT_DEFINITIONS.get(canonical)
        if definition:
            return definition["display_name"]
        return cls.humanize(canonical or "")

    @classmethod
    def category_for(cls, agent_name: str | None) -> str:
        canonical = cls.canonical_name(agent_name)
        definition = cls.CORE_AGENT_DEFINITIONS.get(canonical)
        if definition:
            return definition["category"]
        return "runtime"

    @classmethod
    def source_path_for(cls, agent_name: str | None) -> str | None:
        canonical = cls.canonical_name(agent_name)
        definition = cls.CORE_AGENT_DEFINITIONS.get(canonical)
        if definition:
            return definition["source_path"]
        return None

    @classmethod
    def expand_filter_names(cls, agent_name: str | None) -> list[str] | None:
        if not agent_name:
            return None
        canonical = cls.canonical_name(agent_name)
        return sorted({name for name, mapped in cls.CORE_AGENT_ALIASES.items() if mapped == canonical} or {agent_name})

    @classmethod
    def is_core_agent(cls, agent_name: str | None) -> bool:
        canonical = cls.canonical_name(agent_name)
        return canonical in cls.CORE_AGENT_DEFINITIONS

    @staticmethod
    def humanize(agent_name: str) -> str:
        parts = [part for part in agent_name.replace("-", "_").split("_") if part]
        return " ".join(part.capitalize() for part in parts) if parts else agent_name
