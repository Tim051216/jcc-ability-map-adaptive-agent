package com.cnsoftbei.a3.learning.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.cnsoftbei.a3.common.exceptions.DbException;
import com.cnsoftbei.a3.learning.domain.po.LearningBehavior;
import com.cnsoftbei.a3.learning.domain.po.StudentProfile;
import com.cnsoftbei.a3.learning.mapper.LearningBehaviorMapper;
import com.cnsoftbei.a3.learning.mapper.StudentProfileMapper;
import com.cnsoftbei.a3.learning.service.ILearningBehaviorCollectionService;
import com.cnsoftbei.a3.learning.support.ProfileBehaviorForwarder;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class LearningBehaviorCollectionServiceImpl implements ILearningBehaviorCollectionService {

    private final LearningBehaviorMapper learningBehaviorMapper;
    private final StudentProfileMapper studentProfileMapper;
    private final ObjectMapper objectMapper;
    private final ProfileBehaviorForwarder profileBehaviorForwarder;

    @Override
    public void collect(
            Long userId,
            Integer behaviorType,
            Map<String, Object> behaviorData,
            String resourceType,
            Long resourceId,
            String result,
            Integer duration
    ) {
        if (userId == null || behaviorType == null) {
            log.debug("跳过行为采集：userId 或 behaviorType 为空");
            return;
        }

        Long profileId = resolveProfileId(userId);
        String json;
        try {
            json = objectMapper.writeValueAsString(behaviorData == null ? Map.of() : behaviorData);
        } catch (JsonProcessingException e) {
            throw new DbException("行为数据序列化失败: " + e.getMessage());
        }

        LearningBehavior row = new LearningBehavior()
                .setUserId(userId)
                .setProfileId(profileId)
                .setBehaviorType(behaviorType)
                .setBehaviorData(json)
                .setResourceType(resourceType)
                .setResourceId(resourceId)
                .setResult(result)
                .setDuration(duration)
                .setCreateTime(LocalDateTime.now());

        try {
            learningBehaviorMapper.insert(row);
        } catch (Exception e) {
            log.warn("写入 learning_behavior 失败，跳过本次行为落库。userId={}, resourceType={}, resourceId={}, cause={}",
                    userId, resourceType, resourceId, e.getMessage());
            return;
        }

        try {
            profileBehaviorForwarder.forwardAsync(
                    userId,
                    behaviorType,
                    behaviorData == null ? Map.of() : behaviorData,
                    resourceType,
                    resourceId,
                    result,
                    duration
            );
        } catch (Exception e) {
            log.warn("转发画像行为失败，忽略本次异常。userId={}, resourceType={}, resourceId={}, cause={}",
                    userId, resourceType, resourceId, e.getMessage());
        }
    }

    private Long resolveProfileId(Long userId) {
        try {
            StudentProfile sp = studentProfileMapper.selectOne(
                    new QueryWrapper<StudentProfile>()
                            .eq("user_id", userId)
                            .last("LIMIT 1")
            );
            return sp == null ? null : sp.getId();
        } catch (Exception e) {
            log.warn("读取 student_profile 失败，跳过 profileId 关联。userId={}, cause={}", userId, e.getMessage());
            return null;
        }
    }
}
