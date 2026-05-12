package com.cnsoftbei.a3.learning.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.cnsoftbei.a3.learning.domain.po.EvaluationAnswerRecord;

import java.util.List;
import java.util.Map;

/**
 * <p>
 * 答题记录服务接口
 * </p>
 *
 * @author A3 Team
 * @since 2026-05-09
 */
public interface IEvaluationAnswerRecordService extends IService<EvaluationAnswerRecord> {

    /**
     * 提交答案
     *
     * @param testId     测评ID
     * @param questionId 题目ID
     * @param userId     学生ID
     * @param userAnswer 学生答案
     * @param answerTime 答题用时(秒)
     * @return 答题记录ID
     */
    Long submitAnswer(Long testId, Long questionId, Long userId, String userAnswer, Integer answerTime);

    /**
     * 批量提交答案
     *
     * @param testId  测评ID
     * @param userId  学生ID
     * @param answers 答案Map (questionId -> userAnswer)
     * @return 是否成功
     */
    Boolean batchSubmitAnswers(Long testId, Long userId, Map<Long, String> answers);

    /**
     * 自动批改答案
     *
     * @param recordId 答题记录ID
     * @return 是否成功
     */
    Boolean autoGradeAnswer(Long recordId);

    /**
     * 批量自动批改
     *
     * @param testId 测评ID
     * @param userId 学生ID
     * @return 批改结果
     */
    Map<String, Object> batchAutoGrade(Long testId, Long userId);

    /**
     * 查询学生的答题记录
     *
     * @param testId 测评ID
     * @param userId 学生ID
     * @return 答题记录列表
     */
    List<EvaluationAnswerRecord> listByTestAndUser(Long testId, Long userId);

    /**
     * 查询错题记录
     *
     * @param userId 学生ID
     * @return 错题记录列表
     */
    List<EvaluationAnswerRecord> listWrongAnswers(Long userId);

    /**
     * 查询错题记录（可按测评筛选）
     *
     * @param userId 学生ID
     * @param testId 测评ID，null 表示全部
     */
    List<EvaluationAnswerRecord> listWrongAnswers(Long userId, Long testId);
}
