package com.cnsoftbei.a3.learning.constants;

/**
 * 学习画像相关常量
 *
 * @author A3 Team
 * @since 2024-01-01
 */
public interface ProfileConstants {

    // 画像维度代码
    String DIMENSION_KNOWLEDGE_BASE = "knowledge_base";
    String DIMENSION_COGNITIVE_STYLE = "cognitive_style";
    String DIMENSION_LEARNING_PROGRESS = "learning_progress";
    String DIMENSION_ERROR_PREFERENCE = "error_preference";
    String DIMENSION_INTEREST_DIRECTION = "interest_direction";
    String DIMENSION_LEARNING_HABIT = "learning_habit";

    // 对话角色
    String ROLE_USER = "user";
    String ROLE_ASSISTANT = "assistant";
    String ROLE_SYSTEM = "system";

    // 行为结果
    String RESULT_CORRECT = "correct";
    String RESULT_WRONG = "wrong";
    String RESULT_COMPLETED = "completed";
    String RESULT_ABANDONED = "abandoned";

    // 资源类型
    String RESOURCE_TYPE_COURSE = "course";
    String RESOURCE_TYPE_SECTION = "section";
    String RESOURCE_TYPE_QUESTION = "question";

    // 提取方法
    String EXTRACTION_METHOD_LLM = "llm";
    String EXTRACTION_METHOD_RULE = "rule";

    // 画像完整度阈值
    int COMPLETENESS_THRESHOLD_LOW = 30;
    int COMPLETENESS_THRESHOLD_MEDIUM = 60;
    int COMPLETENESS_THRESHOLD_HIGH = 90;

    // 对话轮次限制
    int MAX_CONVERSATION_ROUNDS = 50;
    int MIN_CONVERSATION_ROUNDS_FOR_PROFILE = 5;

    // 缓存键前缀
    String CACHE_PROFILE_PREFIX = "profile:";
    String CACHE_SESSION_PREFIX = "conversation:session:";
    String CACHE_DIMENSION_CONFIG_PREFIX = "profile:dimension:config:";
}
