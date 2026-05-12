package com.cnsoftbei.a3.learning.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cnsoftbei.a3.common.exceptions.BizIllegalException;
import com.cnsoftbei.a3.learning.client.EvaluationAiClient;
import com.cnsoftbei.a3.learning.domain.po.EvaluationAnswerRecord;
import com.cnsoftbei.a3.learning.domain.po.EvaluationQuestion;
import com.cnsoftbei.a3.learning.domain.po.EvaluationTestRecord;
import com.cnsoftbei.a3.learning.domain.po.EvaluationWrongQuestion;
import com.cnsoftbei.a3.learning.mapper.EvaluationAnswerRecordMapper;
import com.cnsoftbei.a3.learning.mapper.EvaluationTestRecordMapper;
import com.cnsoftbei.a3.learning.mapper.EvaluationWrongQuestionMapper;
import com.cnsoftbei.a3.learning.service.IEvaluationAnswerRecordService;
import com.cnsoftbei.a3.learning.service.IEvaluationQuestionService;
import com.cnsoftbei.a3.learning.service.ILearningBehaviorCollectionService;
import com.cnsoftbei.a3.learning.util.EvaluationPayloads;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 答题与批改
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EvaluationAnswerRecordServiceImpl
        extends ServiceImpl<EvaluationAnswerRecordMapper, EvaluationAnswerRecord>
        implements IEvaluationAnswerRecordService {

    private final EvaluationAiClient evaluationAiClient;
    private final IEvaluationQuestionService questionService;
    private final EvaluationTestRecordMapper evaluationTestRecordMapper;
    private final EvaluationWrongQuestionMapper evaluationWrongQuestionMapper;
    private final ILearningBehaviorCollectionService learningBehaviorCollectionService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long submitAnswer(Long testId, Long questionId, Long userId, String userAnswer, Integer answerTime) {
        LocalDateTime now = LocalDateTime.now();
        EvaluationAnswerRecord rec = findRecord(testId, questionId, userId);
        if (rec == null) {
            rec = new EvaluationAnswerRecord()
                    .setTestId(testId)
                    .setQuestionId(questionId)
                    .setUserId(userId)
                    .setUserAnswer(userAnswer)
                    .setAnswerTime(answerTime)
                    .setSubmitTime(now)
                    .setCreateTime(now)
                    .setUpdateTime(now);
            save(rec);
        } else {
            rec.setUserAnswer(userAnswer);
            rec.setAnswerTime(answerTime);
            rec.setSubmitTime(now);
            rec.setUpdateTime(now);
            updateById(rec);
        }
        return rec.getId();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean batchSubmitAnswers(Long testId, Long userId, Map<Long, String> answers) {
        LocalDateTime now = LocalDateTime.now();
        Set<Long> validQuestionIds = questionService.listByTestId(testId).stream()
                .map(EvaluationQuestion::getId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());

        for (Map.Entry<Long, String> e : answers.entrySet()) {
            if (!validQuestionIds.contains(e.getKey())) {
                log.warn("Ignore invalid question answer submission: testId={}, userId={}, questionId={}",
                        testId, userId, e.getKey());
                continue;
            }
            EvaluationAnswerRecord rec = findRecord(testId, e.getKey(), userId);
            if (rec == null) {
                rec = new EvaluationAnswerRecord()
                        .setTestId(testId)
                        .setQuestionId(e.getKey())
                        .setUserId(userId)
                        .setUserAnswer(e.getValue())
                        .setSubmitTime(now)
                        .setCreateTime(now)
                        .setUpdateTime(now);
                save(rec);
            } else {
                rec.setUserAnswer(e.getValue());
                rec.setSubmitTime(now);
                rec.setUpdateTime(now);
                updateById(rec);
            }
        }
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean autoGradeAnswer(Long recordId) {
        EvaluationAnswerRecord rec = getById(recordId);
        if (rec == null) {
            throw new BizIllegalException("答题记录不存在");
        }
        batchAutoGrade(rec.getTestId(), rec.getUserId());
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchAutoGrade(Long testId, Long userId) {
        List<EvaluationQuestion> questions = questionService.listByTestId(testId);
        if (questions.isEmpty()) {
            throw new BizIllegalException("测评暂无题目");
        }

        List<EvaluationAnswerRecord> records = listByTestAndUser(testId, userId);
        if (records.isEmpty()) {
            throw new BizIllegalException("尚未提交答案");
        }

        Map<String, String> answers = new HashMap<>();
        for (EvaluationAnswerRecord r : records) {
            answers.put(String.valueOf(r.getQuestionId()), r.getUserAnswer() == null ? "" : r.getUserAnswer());
        }

        Map<String, Object> req = EvaluationAiClient.mapOf(
                "test_id", testId.intValue(),
                "user_id", userId.intValue(),
                "answers", answers,
                "questions", EvaluationPayloads.questionsToPayload(questions),
                "persist_results", false
        );

        JsonNode root = evaluationAiClient.gradeAnswers(req);
        JsonNode results = root.path("grading_results");
        if (!results.isArray()) {
            throw new BizIllegalException("批改结果格式异常");
        }

        LocalDateTime now = LocalDateTime.now();
        BigDecimal sumScore = BigDecimal.ZERO;

        for (JsonNode gr : results) {
            long qid = gr.path("question_id").asLong();
            EvaluationAnswerRecord rec = findRecord(testId, qid, userId);
            if (rec == null) {
                continue;
            }
            rec.setIsCorrect(gr.path("is_correct").isNull() ? null : gr.path("is_correct").asInt());
            if (gr.has("score") && !gr.get("score").isNull()) {
                rec.setScore(BigDecimal.valueOf(gr.get("score").asDouble()).setScale(2, RoundingMode.HALF_UP));
                sumScore = sumScore.add(rec.getScore());
            } else {
                rec.setScore(BigDecimal.ZERO);
            }
            rec.setGradingType(gr.path("grading_type").asInt(1));
            rec.setGradingFeedback(text(gr, "grading_feedback"));
            rec.setGradingTime(now);
            rec.setUpdateTime(now);
            updateById(rec);

            Map<String, Object> behaviorPayload = new HashMap<>(8);
            behaviorPayload.put("source", "evaluation_test");
            behaviorPayload.put("test_id", testId);
            behaviorPayload.put("question_id", qid);
            behaviorPayload.put("knowledge_point", findKnowledgePoint(questions, qid));
            behaviorPayload.put("score", rec.getScore());
            String behaviorResult =
                    rec.getIsCorrect() == null ? null : (rec.getIsCorrect() == 1 ? "correct" : "wrong");
            learningBehaviorCollectionService.collect(
                    userId,
                    1,
                    behaviorPayload,
                    "question",
                    qid,
                    behaviorResult,
                    rec.getAnswerTime()
            );

            if (rec.getIsCorrect() != null && rec.getIsCorrect() == 0) {
                upsertWrongQuestion(userId, testId, qid, rec.getId(), findKnowledgePoint(questions, qid), now);
            }
        }

        JsonNode summary = root.path("summary");
        int total = summary.path("total").asInt(questions.size());
        int correct = summary.path("correct").asInt(0);
        int wrong = summary.path("wrong").asInt(0);

        upsertTestRecord(testId, userId, sumScore, total, correct, wrong, now);

        Map<String, Object> sum = new HashMap<>();
        sum.put("total", summary.path("total").asInt(total));
        sum.put("correct", summary.path("correct").asInt(correct));
        sum.put("wrong", summary.path("wrong").asInt(wrong));
        sum.put("pending", summary.path("pending").asInt(0));
        sum.put("accuracy_rate", summary.path("accuracy_rate").asDouble(0));

        Map<String, Object> out = new HashMap<>();
        out.put("summary", sum);
        out.put("totalScore", sumScore);
        return out;
    }

    private void upsertTestRecord(
            Long testId,
            Long userId,
            BigDecimal totalScore,
            int totalQuestions,
            int correctCount,
            int wrongCount,
            LocalDateTime now
    ) {
        QueryWrapper<EvaluationTestRecord> w = new QueryWrapper<>();
        w.eq("test_id", testId).eq("user_id", userId);
        EvaluationTestRecord tr = evaluationTestRecordMapper.selectOne(w);
        int unanswered = Math.max(0, totalQuestions - correctCount - wrongCount);
        BigDecimal completion = totalQuestions > 0
                ? BigDecimal.valueOf((totalQuestions - unanswered) * 100.0 / totalQuestions).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal accuracy = totalQuestions > 0
                ? BigDecimal.valueOf(correctCount * 100.0 / totalQuestions).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        if (tr == null) {
            tr = new EvaluationTestRecord()
                    .setTestId(testId)
                    .setUserId(userId)
                    .setTotalScore(totalScore)
                    .setTotalQuestions(totalQuestions)
                    .setCorrectCount(correctCount)
                    .setWrongCount(wrongCount)
                    .setUnansweredCount(unanswered)
                    .setCompletionRate(completion)
                    .setAccuracyRate(accuracy)
                    .setStatus(2)
                    .setSubmitTime(now)
                    .setGradingCompleteTime(now)
                    .setCreateTime(now)
                    .setUpdateTime(now);
            evaluationTestRecordMapper.insert(tr);
        } else {
            tr.setTotalScore(totalScore);
            tr.setTotalQuestions(totalQuestions);
            tr.setCorrectCount(correctCount);
            tr.setWrongCount(wrongCount);
            tr.setUnansweredCount(unanswered);
            tr.setCompletionRate(completion);
            tr.setAccuracyRate(accuracy);
            tr.setStatus(2);
            tr.setGradingCompleteTime(now);
            tr.setUpdateTime(now);
            evaluationTestRecordMapper.updateById(tr);
        }
    }

    private void upsertWrongQuestion(
            Long userId,
            Long testId,
            Long questionId,
            Long answerRecordId,
            String knowledgePoint,
            LocalDateTime now
    ) {
        QueryWrapper<EvaluationWrongQuestion> w = new QueryWrapper<>();
        w.eq("user_id", userId)
                .eq("question_id", questionId)
                .eq("test_id", testId);
        EvaluationWrongQuestion wq = evaluationWrongQuestionMapper.selectOne(w);
        if (wq == null) {
            wq = new EvaluationWrongQuestion()
                    .setUserId(userId)
                    .setQuestionId(questionId)
                    .setTestId(testId)
                    .setAnswerRecordId(answerRecordId)
                    .setKnowledgePoint(knowledgePoint == null ? "" : knowledgePoint)
                    .setWrongCount(1)
                    .setIsMastered(0)
                    .setLastWrongTime(now)
                    .setCreateTime(now)
                    .setUpdateTime(now);
            evaluationWrongQuestionMapper.insert(wq);
        } else {
            wq.setWrongCount(wq.getWrongCount() == null ? 1 : wq.getWrongCount() + 1);
            wq.setAnswerRecordId(answerRecordId);
            wq.setLastWrongTime(now);
            wq.setUpdateTime(now);
            evaluationWrongQuestionMapper.updateById(wq);
        }
    }

    private static String findKnowledgePoint(List<EvaluationQuestion> questions, long qid) {
        for (EvaluationQuestion q : questions) {
            if (q.getId() != null && q.getId() == qid) {
                return q.getKnowledgePoint();
            }
        }
        return "";
    }

    private EvaluationAnswerRecord findRecord(Long testId, Long questionId, Long userId) {
        QueryWrapper<EvaluationAnswerRecord> w = new QueryWrapper<>();
        w.eq("test_id", testId)
                .eq("question_id", questionId)
                .eq("user_id", userId);
        return getOne(w);
    }

    @Override
    public List<EvaluationAnswerRecord> listByTestAndUser(Long testId, Long userId) {
        QueryWrapper<EvaluationAnswerRecord> w = new QueryWrapper<>();
        w.eq("test_id", testId)
                .eq("user_id", userId)
                .orderByDesc("update_time")
                .orderByDesc("id");

        List<EvaluationAnswerRecord> deduped = dedupeLatestByQuestion(list(w));
        deduped.sort(Comparator.comparing(EvaluationAnswerRecord::getQuestionId, Comparator.nullsLast(Long::compareTo)));
        return deduped;
    }

    @Override
    public List<EvaluationAnswerRecord> listWrongAnswers(Long userId) {
        return listWrongAnswers(userId, null);
    }

    @Override
    public List<EvaluationAnswerRecord> listWrongAnswers(Long userId, Long testId) {
        QueryWrapper<EvaluationAnswerRecord> w = new QueryWrapper<>();
        w.eq("user_id", userId);
        if (testId != null) {
            w.eq("test_id", testId);
        }
        w.orderByDesc("update_time").orderByDesc("id");

        List<EvaluationAnswerRecord> records = dedupeLatestByQuestion(list(w));
        if (testId != null) {
            Set<Long> validQuestionIds = questionService.listByTestId(testId).stream()
                    .map(EvaluationQuestion::getId)
                    .filter(id -> id != null)
                    .collect(Collectors.toSet());
            records = records.stream()
                    .filter(record -> validQuestionIds.contains(record.getQuestionId()))
                    .collect(Collectors.toList());
        }
        return records.stream()
                .filter(record -> Integer.valueOf(0).equals(record.getIsCorrect()))
                .sorted(Comparator.comparing(EvaluationAnswerRecord::getUpdateTime,
                        Comparator.nullsLast(LocalDateTime::compareTo)).reversed())
                .collect(Collectors.toList());
    }

    private List<EvaluationAnswerRecord> dedupeLatestByQuestion(List<EvaluationAnswerRecord> rows) {
        if (rows.isEmpty()) {
            return rows;
        }

        Map<Long, EvaluationAnswerRecord> latestByQuestion = new LinkedHashMap<>();
        for (EvaluationAnswerRecord row : rows) {
            if (row.getQuestionId() == null) {
                continue;
            }
            EvaluationAnswerRecord existing = latestByQuestion.get(row.getQuestionId());
            if (existing == null) {
                latestByQuestion.put(row.getQuestionId(), row);
                continue;
            }
            if (existing.getIsCorrect() == null && row.getIsCorrect() != null) {
                latestByQuestion.put(row.getQuestionId(), row);
            }
        }
        return new ArrayList<>(latestByQuestion.values());
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.path(field);
        return v.isMissingNode() || v.isNull() ? "" : v.asText("");
    }
}
