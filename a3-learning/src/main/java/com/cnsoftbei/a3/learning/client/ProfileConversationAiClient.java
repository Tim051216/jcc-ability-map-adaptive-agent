package com.cnsoftbei.a3.learning.client;

import com.cnsoftbei.a3.learning.config.EvaluationAiProperties;
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
 * 异步调用 Python「对话式画像」行为上报接口，驱动画像更新。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProfileConversationAiClient {

    private final RestTemplate evaluationRestTemplate;
    private final EvaluationAiProperties evaluationAiProperties;

    /**
     * POST /api/v1/profile/conversation/behavior
     */
    public void reportBehavior(
            long userId,
            int behaviorType,
            Map<String, Object> behaviorData,
            String resourceType,
            Long resourceId,
            String result,
            Integer duration
    ) {
        if (!evaluationAiProperties.isProfileForwardEnabled()) {
            return;
        }
        String url = evaluationAiProperties.getBaseUrl() + "/api/v1/profile/conversation/behavior";
        Map<String, Object> body = new HashMap<>(8);
        body.put("user_id", userId);
        body.put("behavior_type", behaviorType);
        body.put("behavior_data", behaviorData == null ? Map.of() : behaviorData);
        body.put("resource_type", resourceType);
        body.put("resource_id", resourceId);
        body.put("result", result);
        body.put("duration", duration);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        try {
            evaluationRestTemplate.postForObject(url, new HttpEntity<>(body, headers), String.class);
        } catch (RestClientException e) {
            log.warn(
                    "画像行为转发失败（不影响主流程） userId={} type={} err={}",
                    userId,
                    behaviorType,
                    e.getMessage()
            );
        }
    }
}
