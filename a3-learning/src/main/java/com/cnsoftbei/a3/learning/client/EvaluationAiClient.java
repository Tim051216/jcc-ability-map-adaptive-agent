package com.cnsoftbei.a3.learning.client;

import com.cnsoftbei.a3.common.exceptions.BizIllegalException;
import com.cnsoftbei.a3.learning.config.EvaluationAiProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * 调用 Python FastAPI 评估智能体接口
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EvaluationAiClient {

    private final RestTemplate evaluationRestTemplate;
    private final EvaluationAiProperties evaluationAiProperties;
    private final ObjectMapper objectMapper;

    public JsonNode generateQuestions(Map<String, Object> body) {
        return post("/api/v1/evaluation/questions/generate", body);
    }

    public JsonNode gradeAnswers(Map<String, Object> body) {
        return post("/api/v1/evaluation/answers/grade", body);
    }

    public JsonNode assess(Map<String, Object> body) {
        return post("/api/v1/evaluation/assessment", body);
    }

    public JsonNode generateReport(Map<String, Object> body) {
        return post("/api/v1/evaluation/reports/generate", body);
    }

    private JsonNode post(String path, Map<String, Object> body) {
        String url = evaluationAiProperties.getBaseUrl() + path;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        try {
            String raw = evaluationRestTemplate.postForObject(
                    url,
                    new HttpEntity<>(body, headers),
                    String.class
            );
            return objectMapper.readTree(raw);
        } catch (RestClientException e) {
            log.error("调用评估 AI 服务失败: url={}, err={}", url, e.getMessage());
            throw new BizIllegalException("评估 AI 服务暂时不可用,请稍后重试: " + e.getMessage());
        } catch (Exception e) {
            log.error("解析评估 AI 响应失败: url={}", url, e);
            throw new BizIllegalException("评估 AI 响应解析失败");
        }
    }

    public static Map<String, Object> mapOf(Object... kv) {
        if (kv.length % 2 != 0) {
            throw new IllegalArgumentException("键值必须成对");
        }
        Map<String, Object> m = new HashMap<>(kv.length / 2);
        for (int i = 0; i < kv.length; i += 2) {
            m.put(String.valueOf(kv[i]), kv[i + 1]);
        }
        return m;
    }
}
