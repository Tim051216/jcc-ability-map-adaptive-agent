package com.cnsoftbei.a3.learning.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.cnsoftbei.a3.learning.domain.po.EvaluationTest;

import java.util.List;

/**
 * <p>
 * 测评服务接口
 * </p>
 *
 * @author A3 Team
 * @since 2026-05-09
 */
public interface IEvaluationTestService extends IService<EvaluationTest> {

    /**
     * 创建测评
     *
     * @param test 测评信息
     * @return 测评ID
     */
    Long createTest(EvaluationTest test);

    /**
     * 发布测评
     *
     * @param testId 测评ID
     * @return 是否成功
     */
    Boolean publishTest(Long testId);

    /**
     * 关闭测评
     *
     * @param testId 测评ID
     * @return 是否成功
     */
    Boolean closeTest(Long testId);

    /**
     * 根据课程ID查询测评列表
     *
     * @param courseId 课程ID
     * @return 测评列表
     */
    List<EvaluationTest> listByCourseId(Long courseId);

    /**
     * 根据章节ID查询测评列表
     *
     * @param chapterId 章节ID
     * @return 测评列表
     */
    List<EvaluationTest> listByChapterId(Long chapterId);

    /**
     * 根据测评类型查询测评列表
     *
     * @param courseId 课程ID
     * @param testType 测评类型
     * @return 测评列表
     */
    List<EvaluationTest> listByTestType(Long courseId, Integer testType);
}
