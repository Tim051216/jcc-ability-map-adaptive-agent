package com.cnsoftbei.a3.learning.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.cnsoftbei.a3.learning.domain.dto.QuestionGenerateDTO;
import com.cnsoftbei.a3.learning.domain.po.EvaluationQuestion;

import java.util.List;

/**
 * <p>
 * 测评题目服务接口
 * </p>
 *
 * @author A3 Team
 * @since 2026-05-09
 */
public interface IEvaluationQuestionService extends IService<EvaluationQuestion> {

    /**
     * 批量添加题目到测评
     *
     * @param testId    测评ID
     * @param questions 题目列表
     * @return 是否成功
     */
    Boolean batchAddQuestions(Long testId, List<EvaluationQuestion> questions);

    /**
     * 根据测评ID查询题目列表
     *
     * @param testId 测评ID
     * @return 题目列表
     */
    List<EvaluationQuestion> listByTestId(Long testId);

    /**
     * 根据知识点查询题目
     *
     * @param knowledgePoint 知识点
     * @return 题目列表
     */
    List<EvaluationQuestion> listByKnowledgePoint(String knowledgePoint);

    /**
     * 根据难度层级查询题目
     *
     * @param testId         测评ID
     * @param difficultyLevel 难度层级
     * @return 题目列表
     */
    List<EvaluationQuestion> listByDifficulty(Long testId, Integer difficultyLevel);

    /**
     * 调用 AI 生成题目并写入 MySQL
     */
    List<EvaluationQuestion> generateQuestions(QuestionGenerateDTO dto);
}
