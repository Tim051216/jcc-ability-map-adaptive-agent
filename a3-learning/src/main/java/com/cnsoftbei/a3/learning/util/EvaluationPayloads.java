package com.cnsoftbei.a3.learning.util;

import com.cnsoftbei.a3.learning.domain.po.EvaluationAnswerRecord;
import com.cnsoftbei.a3.learning.domain.po.EvaluationQuestion;
import com.cnsoftbei.a3.learning.domain.po.EvaluationTestRecord;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 构造 Python 评估智能体所需的题目 / 批改快照结构
 */
public final class EvaluationPayloads {

    private EvaluationPayloads() {
    }

    public static Map<String, Object> questionToPayload(EvaluationQuestion q) {
        Map<String, Object> m = new LinkedHashMap<>();
        String questionId = q.getId() == null ? null : String.valueOf(q.getId());
        m.put("id", questionId);
        m.put("question_id", questionId);
        m.put("question_type", q.getQuestionType());
        m.put("difficulty_level", q.getDifficultyLevel());
        m.put("knowledge_point", q.getKnowledgePoint());
        m.put("question_content", q.getQuestionContent());
        m.put("question_options", q.getQuestionOptions());
        m.put("correct_answer", q.getCorrectAnswer());
        m.put("answer_analysis", q.getAnswerAnalysis());
        m.put("score", q.getScore() != null ? q.getScore().doubleValue() : 10.0);
        return m;
    }

    public static List<Map<String, Object>> questionsToPayload(List<EvaluationQuestion> questions) {
        List<Map<String, Object>> list = new ArrayList<>(questions.size());
        for (EvaluationQuestion q : questions) {
            list.add(questionToPayload(q));
        }
        return list;
    }

    public static Map<String, Object> gradingResultFromRecord(EvaluationAnswerRecord r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("question_id", r.getQuestionId() == null ? null : String.valueOf(r.getQuestionId()));
        m.put("user_answer", r.getUserAnswer());
        m.put("is_correct", r.getIsCorrect());
        m.put("score", r.getScore() != null ? r.getScore().doubleValue() : null);
        m.put("grading_type", r.getGradingType());
        m.put("grading_feedback", r.getGradingFeedback());
        return m;
    }

    public static Map<String, Object> testRecordToPayload(EvaluationTestRecord tr) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (tr == null) {
            m.put("time_spent", 0);
            m.put("total_questions", 0);
            m.put("accuracy_rate", 0);
            return m;
        }
        m.put("time_spent", tr.getTimeSpent() != null ? tr.getTimeSpent() : 0);
        m.put("total_questions", tr.getTotalQuestions() != null ? tr.getTotalQuestions() : 0);
        m.put("accuracy_rate", tr.getAccuracyRate() != null ? tr.getAccuracyRate().doubleValue() : 0);
        return m;
    }
}
