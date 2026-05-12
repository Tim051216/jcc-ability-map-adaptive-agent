package com.cnsoftbei.a3.learning.support;

import com.cnsoftbei.a3.learning.client.ProfileConversationAiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 异步线程中调用 Python，避免阻塞业务线程与事务。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProfileBehaviorForwarder {

    private final ProfileConversationAiClient profileConversationAiClient;

    @Async("learningBehaviorExecutor")
    public void forwardAsync(
            long userId,
            int behaviorType,
            Map<String, Object> behaviorData,
            String resourceType,
            Long resourceId,
            String result,
            Integer duration
    ) {
        try {
            profileConversationAiClient.reportBehavior(
                    userId,
                    behaviorType,
                    behaviorData,
                    resourceType,
                    resourceId,
                    result,
                    duration
            );
        } catch (Exception e) {
            log.warn("画像行为异步转发异常 userId={} type={}", userId, behaviorType, e);
        }
    }
}
