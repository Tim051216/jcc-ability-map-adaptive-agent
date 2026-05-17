"""rename project-specific table names to generic names"""

from alembic import op


revision = "20260512_0012"
down_revision = "20260511_0011"
branch_labels = None
depends_on = None


TABLE_RENAMES = [
    ("ai_user_profile_snapshot", "user_profile_snapshot"),
    ("ai_chat_session", "chat_session"),
    ("ai_chat_message", "chat_message"),
    ("ai_learning_plan", "learning_plan"),
    ("ai_generation_task", "generation_task"),
    ("ai_knowledge_document", "knowledge_document"),
    ("ai_knowledge_chunk", "knowledge_chunk"),
    ("ai_evaluation_record", "evaluation_record"),
    ("ai_audit_log", "audit_log"),
    ("ai_generated_resource", "generated_resource"),
    ("ai_resource_favorite", "resource_favorite"),
    ("ai_plan_step_progress", "plan_step_progress"),
    ("ai_evaluation_paper", "evaluation_paper"),
    ("ai_evaluation_answer", "evaluation_answer"),
    ("ai_chat_ticket", "chat_ticket"),
    ("ai_chat_ticket_reply", "chat_ticket_reply"),
    ("ai_content_review_task", "content_review_task"),
    ("ai_system_config", "system_config"),
    ("ai_agent_runtime_log", "agent_runtime_log"),
    ("ai_admin_user_control", "admin_user_control"),
    ("ai_resource_favorite_history", "resource_favorite_history"),
    ("ai_conversation_session", "conversation_session"),
    ("ai_conversation_message", "conversation_message"),
    ("ai_extracted_info", "extracted_info"),
    ("ai_student_profile", "student_profile"),
    ("ai_profile_history", "profile_history"),
]


def upgrade() -> None:
    for old_name, new_name in TABLE_RENAMES:
        op.rename_table(old_name, new_name)


def downgrade() -> None:
    for old_name, new_name in reversed(TABLE_RENAMES):
        op.rename_table(new_name, old_name)
