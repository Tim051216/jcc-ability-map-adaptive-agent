package com.cnsoftbei.a3.learning.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cnsoftbei.a3.common.exceptions.BizIllegalException;
import com.cnsoftbei.a3.learning.client.EvaluationAiClient;
import com.cnsoftbei.a3.learning.domain.dto.QuestionGenerateDTO;
import com.cnsoftbei.a3.learning.domain.po.EvaluationQuestion;
import com.cnsoftbei.a3.learning.domain.po.EvaluationTest;
import com.cnsoftbei.a3.learning.mapper.EvaluationQuestionMapper;
import com.cnsoftbei.a3.learning.mapper.EvaluationTestMapper;
import com.cnsoftbei.a3.learning.service.IEvaluationQuestionService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 测评题目服务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EvaluationQuestionServiceImpl extends ServiceImpl<EvaluationQuestionMapper, EvaluationQuestion>
        implements IEvaluationQuestionService {

    private final EvaluationAiClient evaluationAiClient;
    private final EvaluationTestMapper evaluationTestMapper;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean batchAddQuestions(Long testId, List<EvaluationQuestion> questions) {
        LocalDateTime now = LocalDateTime.now();
        for (EvaluationQuestion q : questions) {
            q.setTestId(testId);
            if (q.getCreateTime() == null) {
                q.setCreateTime(now);
            }
            q.setUpdateTime(now);
            if (q.getStatus() == null) {
                q.setStatus(1);
            }
        }
        return saveBatch(questions);
    }

    @Override
    public List<EvaluationQuestion> listByTestId(Long testId) {
        QueryWrapper<EvaluationQuestion> w = new QueryWrapper<>();
        w.eq("test_id", testId).orderByAsc("order_num");
        return list(w);
    }

    @Override
    public List<EvaluationQuestion> listByKnowledgePoint(String knowledgePoint) {
        QueryWrapper<EvaluationQuestion> w = new QueryWrapper<>();
        w.eq("knowledge_point", knowledgePoint);
        return list(w);
    }

    @Override
    public List<EvaluationQuestion> listByDifficulty(Long testId, Integer difficultyLevel) {
        QueryWrapper<EvaluationQuestion> w = new QueryWrapper<>();
        w.eq("test_id", testId).eq("difficulty_level", difficultyLevel);
        return list(w);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<EvaluationQuestion> generateQuestions(QuestionGenerateDTO dto) {
        EvaluationTest test = evaluationTestMapper.selectById(dto.getTestId());
        if (test == null) {
            throw new BizIllegalException("测评不存在");
        }

        int orderBase = nextOrderNum(dto.getTestId());

        Map<String, Object> req = EvaluationAiClient.mapOf(
                "test_id", dto.getTestId().intValue(),
                "knowledge_points", dto.getKnowledgePoints(),
                "difficulty_level", dto.getDifficultyLevel() == null ? 1 : dto.getDifficultyLevel(),
                "question_type", dto.getQuestionType() == null ? 1 : dto.getQuestionType(),
                "count", dto.getCount() == null ? 5 : dto.getCount(),
                "generate_layered", Boolean.TRUE.equals(dto.getGenerateLayered()),
                "course_context", dto.getCourseContext() == null ? "" : dto.getCourseContext(),
                "persist_to_db", false
        );

        JsonNode root = evaluationAiClient.generateQuestions(req);
        JsonNode arr = root.path("questions");
        if (!arr.isArray() || arr.size() == 0) {
            throw new BizIllegalException("AI 未返回题目,请检查 Python 服务与模型配置");
        }

        List<EvaluationQuestion> saved = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        int idx = 0;
        for (JsonNode n : arr) {
            EvaluationQuestion q = mapNodeToQuestion(dto.getTestId(), n, orderBase + (++idx), now);
            if (!save(q)) {
                throw new BizIllegalException("保存题目失败");
            }
            saved.add(q);
        }

        int prev = test.getQuestionCount() == null ? 0 : test.getQuestionCount();
        test.setQuestionCount(prev + saved.size());
        test.setUpdateTime(now);
        evaluationTestMapper.updateById(test);

        log.info("AI 生成题目已入库: testId={}, count={}", dto.getTestId(), saved.size());
        return saved;
    }

    private int nextOrderNum(Long testId) {
        QueryWrapper<EvaluationQuestion> w = new QueryWrapper<>();
        w.eq("test_id", testId).orderByDesc("order_num").last("LIMIT 1");
        EvaluationQuestion last = getOne(w);
        return last == null || last.getOrderNum() == null ? 0 : last.getOrderNum();
    }

    private EvaluationQuestion mapNodeToQuestion(Long testId, JsonNode n, int orderNum, LocalDateTime now) {
        EvaluationQuestion q = new EvaluationQuestion();
        q.setTestId(testId);
        q.setQuestionContent(text(n, "question_content"));
        q.setCorrectAnswer(text(n, "correct_answer"));
        q.setAnswerAnalysis(text(n, "answer_analysis"));
        q.setKnowledgePoint(text(n, "knowledge_point"));
        q.setDifficultyLevel(n.path("difficulty_level").asInt(1));
        q.setQuestionType(n.path("question_type").asInt(1));
        q.setOrderNum(orderNum);
        q.setScore(BigDecimal.valueOf(10));
        q.setStatus(1);
        q.setCreateTime(now);
        q.setUpdateTime(now);
        if (n.has("quality_score") && !n.get("quality_score").isNull()) {
            q.setQualityScore(BigDecimal.valueOf(n.get("quality_score").asDouble()));
        }
        if (n.has("question_options") && n.get("question_options").isArray()) {
            try {
                List<Map<String, Object>> opts = objectMapper.convertValue(
                        n.get("question_options"),
                        new TypeReference<List<Map<String, Object>>>() {
                        }
                );
                q.setQuestionOptions(opts);
            } catch (Exception e) {
                log.warn("解析题目选项失败: {}", e.getMessage());
            }
        }
        return q;
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.path(field);
        return v.isMissingNode() || v.isNull() ? "" : v.asText("");
    }
}
