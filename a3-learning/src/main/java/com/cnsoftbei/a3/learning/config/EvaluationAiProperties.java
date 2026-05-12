package com.cnsoftbei.a3.learning.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Python AI 评估服务地址配置
 */
@Data
@ConfigurationProperties(prefix = "a3.evaluation-ai")
public class EvaluationAiProperties {

    /**
     * 例如 http://127.0.0.1:8000
     */
    private String baseUrl = "http://127.0.0.1:8000";

    /**
     * 是否在写入 {@code learning_behavior} 后异步调用 Python
     * {@code POST /api/v1/profile/conversation/behavior} 更新画像。
     */
    private boolean profileForwardEnabled = true;
}
