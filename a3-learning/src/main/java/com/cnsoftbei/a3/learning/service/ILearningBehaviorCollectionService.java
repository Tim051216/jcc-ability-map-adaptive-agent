package com.cnsoftbei.a3.learning.service;

import java.util.Map;

/**
 * 学习行为采集：写入 MySQL {@code learning_behavior}，并可选异步转发 Python 更新画像。
 */
public interface ILearningBehaviorCollectionService {

    /**
     * @param behaviorType 1-答题，2-资源浏览，3-路径完成，4-互动问答
     */
    void collect(
            Long userId,
            Integer behaviorType,
            Map<String, Object> behaviorData,
            String resourceType,
            Long resourceId,
            String result,
            Integer duration
    );
}
