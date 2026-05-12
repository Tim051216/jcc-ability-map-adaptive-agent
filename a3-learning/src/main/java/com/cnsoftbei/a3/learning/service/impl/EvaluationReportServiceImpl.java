package com.cnsoftbei.a3.learning.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cnsoftbei.a3.common.exceptions.BizIllegalException;
import com.cnsoftbei.a3.common.utils.UserContext;
import com.cnsoftbei.a3.learning.client.EvaluationAiClient;
import com.cnsoftbei.a3.learning.domain.po.EvaluationAnswerRecord;
import com.cnsoftbei.a3.learning.domain.po.EvaluationFeedbackLoop;
import com.cnsoftbei.a3.learning.domain.po.EvaluationKnowledgeMastery;
import com.cnsoftbei.a3.learning.domain.po.EvaluationQuestion;
import com.cnsoftbei.a3.learning.domain.po.EvaluationReport;
import com.cnsoftbei.a3.learning.domain.po.EvaluationTest;
import com.cnsoftbei.a3.learning.domain.po.EvaluationTestRecord;
import com.cnsoftbei.a3.learning.mapper.EvaluationFeedbackLoopMapper;
import com.cnsoftbei.a3.learning.mapper.EvaluationKnowledgeMasteryMapper;
import com.cnsoftbei.a3.learning.mapper.EvaluationReportMapper;
import com.cnsoftbei.a3.learning.mapper.EvaluationTestRecordMapper;
import com.cnsoftbei.a3.learning.service.IEvaluationAnswerRecordService;
import com.cnsoftbei.a3.learning.service.IEvaluationQuestionService;
import com.cnsoftbei.a3.learning.service.IEvaluationReportService;
import com.cnsoftbei.a3.learning.service.IEvaluationTestService;
import com.cnsoftbei.a3.learning.util.EvaluationPayloads;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 评估报告与统计
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EvaluationReportServiceImpl extends ServiceImpl<EvaluationReportMapper, EvaluationReport>
        implements IEvaluationReportService {

    private final EvaluationAiClient evaluationAiClient;
    private final IEvaluationTestService evaluationTestService;
    private final IEvaluationQuestionService questionService;
    private final IEvaluationAnswerRecordService answerRecordService;
    private final EvaluationTestRecordMapper evaluationTestRecordMapper;
    private final EvaluationKnowledgeMasteryMapper evaluationKnowledgeMasteryMapper;
    private final EvaluationFeedbackLoopMapper evaluationFeedbackLoopMapper;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long generateSingleTestReport(Long testId, Long userId) {
        EvaluationTest test = evaluationTestService.getById(testId);
        if (test == null) {
            throw new BizIllegalException("测评不存在");
        }
        if (test.getCourseId() == null) {
            throw new BizIllegalException("测评未关联课程");
        }
        List<EvaluationQuestion> questions = questionService.listByTestId(testId);
        Set<Long> questionIds = questions.stream()
                .map(EvaluationQuestion::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        List<EvaluationAnswerRecord> records = answerRecordService.listByTestAndUser(testId, userId).stream()
                .filter(record -> questionIds.contains(record.getQuestionId()))
                .collect(Collectors.toList());
        if (records.isEmpty()) {
            throw new BizIllegalException("暂无答题记录");
        }
        for (EvaluationAnswerRecord r : records) {
            if (r.getIsCorrect() == null) {
                throw new BizIllegalException("请先完成批改后再生成报告");
            }
        }

        List<Map<String, Object>> qPayload = EvaluationPayloads.questionsToPayload(questions);
        List<Map<String, Object>> gPayload = new ArrayList<>();
        for (EvaluationAnswerRecord r : records) {
            gPayload.add(EvaluationPayloads.gradingResultFromRecord(r));
        }

        QueryWrapper<EvaluationTestRecord> tw = new QueryWrapper<>();
        tw.eq("test_id", testId).eq("user_id", userId);
        EvaluationTestRecord tr = evaluationTestRecordMapper.selectOne(tw);
        Map<String, Object> testRecordPayload = EvaluationPayloads.testRecordToPayload(tr);

        Map<String, Object> assessReq = EvaluationAiClient.mapOf(
                "test_id", testId.intValue(),
                "user_id", userId.intValue(),
                "questions", qPayload,
                "grading_results", gPayload,
                "test_record", testRecordPayload
        );
        JsonNode assessRes = evaluationAiClient.assess(assessReq);
        Map<String, Object> assessmentResult = parseAssessmentResult(assessRes);

        Map<String, Object> reportReq = EvaluationAiClient.mapOf(
                "test_id", testId.intValue(),
                "user_id", userId.intValue(),
                "course_id", test.getCourseId().intValue(),
                "report_type", 1,
                "questions", qPayload,
                "grading_results", gPayload,
                "assessment_result", assessmentResult,
                "persist_report", false
        );
        JsonNode reportRes = evaluationAiClient.generateReport(reportReq);

        LocalDateTime now = LocalDateTime.now();
        EvaluationReport report = new EvaluationReport();
        report.setUserId(userId);
        report.setCourseId(test.getCourseId());
        report.setReportType(1);
        report.setTimeRangeStart(now);
        report.setTimeRangeEnd(now);
        report.setTestIds(Collections.singletonList(testId));
        report.setOverallScore(resolveOverallScore(test, tr, records, reportRes, assessRes));
        report.setKnowledgeMastery(readMap(reportRes, "knowledge_mastery", assessRes));
        report.setAbilityAnalysis(readMap(reportRes, "ability_analysis", assessRes));
        report.setLearningEfficiency(readMap(reportRes, "learning_efficiency", assessRes));
        report.setStrengths(joinList(reportRes.path("strengths")));
        report.setWeaknesses(joinList(reportRes.path("weaknesses")));
        report.setImprovementSuggestions(joinList(reportRes.path("improvement_suggestions")));
        report.setRecommendedResources(readResourceList(reportRes.path("recommended_resources")));
        report.setStatus(1);
        report.setCreateTime(now);
        report.setUpdateTime(now);
        if (!save(report)) {
            throw new BizIllegalException("保存报告失败");
        }

        syncKnowledgeMastery(userId, test.getCourseId(), assessRes.path("knowledge_mastery"), now);
        insertFeedbackLoop(userId, report.getId(), reportRes, now);

        log.info("生成测评报告: reportId={}, testId={}, userId={}", report.getId(), testId, userId);
        return report.getId();
    }

    private Map<String, Object> readMap(JsonNode primary, String field, JsonNode fallbackRoot) {
        try {
            if (primary.has(field) && !primary.get(field).isNull()) {
                return objectMapper.convertValue(primary.get(field), new TypeReference<Map<String, Object>>() {
                });
            }
        } catch (Exception ignored) {
        }
        try {
            if (fallbackRoot.has(field) && !fallbackRoot.get(field).isNull()) {
                return objectMapper.convertValue(fallbackRoot.get(field), new TypeReference<Map<String, Object>>() {
                });
            }
        } catch (Exception ignored) {
        }
        return new HashMap<>();
    }

    private static String joinList(JsonNode arr) {
        if (!arr.isArray()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (JsonNode n : arr) {
            if (sb.length() > 0) {
                sb.append('\n');
            }
            sb.append(n.asText(""));
        }
        return sb.toString();
    }

    private List<Map<String, Object>> readResourceList(JsonNode arr) {
        if (!arr.isArray()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.convertValue(arr, new TypeReference<List<Map<String, Object>>>() {
            });
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private Map<String, Object> parseAssessmentResult(JsonNode assessRes) {
        try {
            return objectMapper.convertValue(assessRes, new TypeReference<Map<String, Object>>() {
            });
        } catch (IllegalArgumentException e) {
            Map<String, Object> m = new HashMap<>();
            m.put("overall_score", assessRes.path("overall_score").asDouble(0));
            m.put("mastery_level", assessRes.path("mastery_level").asText("未掌握"));
            m.put("knowledge_mastery", readMap(assessRes, "knowledge_mastery", assessRes));
            m.put("ability_analysis", readMap(assessRes, "ability_analysis", assessRes));
            m.put("learning_efficiency", readMap(assessRes, "learning_efficiency", assessRes));
            return m;
        }
    }

    private BigDecimal resolveOverallScore(EvaluationTest test,
                                           EvaluationTestRecord testRecord,
                                           List<EvaluationAnswerRecord> records,
                                           JsonNode reportRes,
                                           JsonNode assessRes) {
        if (testRecord != null && testRecord.getTotalScore() != null) {
            return testRecord.getTotalScore().setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal recordScore = records.stream()
                .map(EvaluationAnswerRecord::getScore)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (recordScore.compareTo(BigDecimal.ZERO) > 0) {
            return recordScore.setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal aiScore = BigDecimal.valueOf(reportRes.path("overall_score").asDouble(
                assessRes.path("overall_score").asDouble(0))).setScale(2, RoundingMode.HALF_UP);
        if (test != null && test.getTotalScore() != null) {
            BigDecimal maxScore = BigDecimal.valueOf(test.getTotalScore());
            if (aiScore.compareTo(maxScore) > 0) {
                return maxScore.setScale(2, RoundingMode.HALF_UP);
            }
        }
        return aiScore;
    }

    private void syncKnowledgeMastery(Long userId, Long courseId, JsonNode knowledgeMastery, LocalDateTime now) {
        JsonNode points = knowledgeMastery.path("knowledge_points");
        if (!points.isArray()) {
            return;
        }
        for (JsonNode kp : points) {
            String name = kp.path("knowledge_point").asText("");
            if (name.isEmpty()) {
                continue;
            }
            int level = kp.path("mastery_level").asInt(0);
            double acc = kp.path("accuracy_rate").asDouble(0);
            int total = kp.path("total_questions").asInt(0);
            int correct = kp.path("correct_count").asInt(0);

            QueryWrapper<EvaluationKnowledgeMastery> w = new QueryWrapper<>();
            w.eq("user_id", userId)
                    .eq("course_id", courseId)
                    .eq("knowledge_point", name);
            EvaluationKnowledgeMastery row = evaluationKnowledgeMasteryMapper.selectOne(w);
            if (row == null) {
                row = new EvaluationKnowledgeMastery()
                        .setUserId(userId)
                        .setCourseId(courseId)
                        .setKnowledgePoint(name)
                        .setMasteryLevel(level)
                        .setMasteryScore(BigDecimal.valueOf(acc).setScale(2, RoundingMode.HALF_UP))
                        .setPracticeCount(total)
                        .setCorrectCount(correct)
                        .setAccuracyRate(BigDecimal.valueOf(acc).setScale(2, RoundingMode.HALF_UP))
                        .setLastPracticeTime(now)
                        .setCreateTime(now)
                        .setUpdateTime(now);
                evaluationKnowledgeMasteryMapper.insert(row);
            } else {
                row.setMasteryLevel(level);
                row.setMasteryScore(BigDecimal.valueOf(acc).setScale(2, RoundingMode.HALF_UP));
                row.setPracticeCount((row.getPracticeCount() == null ? 0 : row.getPracticeCount()) + total);
                row.setCorrectCount((row.getCorrectCount() == null ? 0 : row.getCorrectCount()) + correct);
                row.setAccuracyRate(BigDecimal.valueOf(acc).setScale(2, RoundingMode.HALF_UP));
                row.setLastPracticeTime(now);
                row.setUpdateTime(now);
                evaluationKnowledgeMasteryMapper.updateById(row);
            }
        }
    }

    private void insertFeedbackLoop(Long userId, Long reportId, JsonNode reportRes, LocalDateTime now) {
        Map<String, Object> content = new HashMap<>();
        content.put("report_summary", reportRes.path("report_summary").asText(""));
        content.put("recommended_resources", readResourceList(reportRes.path("recommended_resources")));
        content.put("improvement_suggestions", jsonToStringList(reportRes.path("improvement_suggestions")));

        EvaluationFeedbackLoop loop = new EvaluationFeedbackLoop()
                .setUserId(userId)
                .setReportId(reportId)
                .setFeedbackType(2)
                .setFeedbackContent(content)
                .setActionTaken(0)
                .setCreateTime(now)
                .setUpdateTime(now);
        evaluationFeedbackLoopMapper.insert(loop);
    }

    private static List<String> jsonToStringList(JsonNode arr) {
        if (!arr.isArray()) {
            return Collections.emptyList();
        }
        List<String> list = new ArrayList<>();
        for (JsonNode n : arr) {
            list.add(n.asText(""));
        }
        return list;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long generateStageReport(Long userId, Long courseId, LocalDateTime startTime, LocalDateTime endTime) {
        QueryWrapper<EvaluationTestRecord> w = new QueryWrapper<>();
        w.eq("user_id", userId)
                .between("submit_time", startTime, endTime)
                .eq("status", 2);
        List<EvaluationTestRecord> records = evaluationTestRecordMapper.selectList(w);
        Set<Long> testIds = records.stream()
                .map(EvaluationTestRecord::getTestId)
                .filter(Objects::nonNull)
                .filter(tid -> {
                    EvaluationTest t = evaluationTestService.getById(tid);
                    return t != null && courseId.equals(t.getCourseId());
                })
                .collect(Collectors.toSet());
        if (testIds.isEmpty()) {
            throw new BizIllegalException("该时间段内没有已批改的测评记录");
        }
        EvaluationTestRecord latestRecord = records.stream()
                .filter(rec -> testIds.contains(rec.getTestId()))
                .filter(rec -> rec.getSubmitTime() != null)
                .max((a, b) -> a.getSubmitTime().compareTo(b.getSubmitTime()))
                .orElse(null);
        Long latestTestId = latestRecord != null ? latestRecord.getTestId() : testIds.iterator().next();
        return generateSingleTestReport(latestTestId, userId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long generateComprehensiveReport(Long userId, Long courseId) {
        List<EvaluationTest> tests = evaluationTestService.listByCourseId(courseId);
        if (tests.isEmpty()) {
            throw new BizIllegalException("课程下没有测评");
        }
        Long pick = null;
        for (EvaluationTest t : tests) {
            List<EvaluationAnswerRecord> rec = answerRecordService.listByTestAndUser(t.getId(), userId);
            if (!rec.isEmpty() && rec.stream().allMatch(r -> r.getIsCorrect() != null)) {
                pick = t.getId();
                break;
            }
        }
        if (pick == null) {
            pick = tests.get(0).getId();
        }
        return generateSingleTestReport(pick, userId);
    }

    @Override
    public List<EvaluationReport> listByUser(Long userId, Long courseId) {
        QueryWrapper<EvaluationReport> w = new QueryWrapper<>();
        w.eq("user_id", userId);
        if (courseId != null) {
            w.eq("course_id", courseId);
        }
        w.orderByDesc("create_time");
        return list(w);
    }

    @Override
    public EvaluationReport getReportDetail(Long reportId) {
        EvaluationReport r = getById(reportId);
        if (r == null) {
            throw new BizIllegalException("报告不存在");
        }
        Long uid = UserContext.requireUser();
        if (r.getUserId() == null || !uid.equals(r.getUserId())) {
            throw new BizIllegalException("报告不存在或无权访问");
        }
        return r;
    }

    @Override
    public Map<String, Object> getKnowledgeMasteryStats(Long userId, Long courseId) {
        QueryWrapper<EvaluationKnowledgeMastery> w = new QueryWrapper<>();
        w.eq("user_id", userId).eq("course_id", courseId);
        List<EvaluationKnowledgeMastery> rows = evaluationKnowledgeMasteryMapper.selectList(w);
        Map<String, Object> out = new HashMap<>();
        out.put("items", rows);
        out.put("total", rows.size());
        return out;
    }

    @Override
    public Map<String, Object> getLearningEfficiencyStats(Long userId, Long courseId) {
        List<EvaluationTest> tests = evaluationTestService.listByCourseId(courseId);
        Set<Long> ids = tests.stream().map(EvaluationTest::getId).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Collections.singletonMap("message", "暂无测评数据");
        }
        QueryWrapper<EvaluationTestRecord> w = new QueryWrapper<>();
        w.eq("user_id", userId).in("test_id", ids);
        List<EvaluationTestRecord> recs = evaluationTestRecordMapper.selectList(w);
        double avgAcc = recs.stream()
                .map(EvaluationTestRecord::getAccuracyRate)
                .filter(Objects::nonNull)
                .mapToDouble(BigDecimal::doubleValue)
                .average()
                .orElse(0);
        Map<String, Object> out = new HashMap<>();
        out.put("recordCount", recs.size());
        out.put("averageAccuracyRate", BigDecimal.valueOf(avgAcc).setScale(2, RoundingMode.HALF_UP));
        return out;
    }

    @Override
    public String exportReport(Long reportId, String format) {
        EvaluationReport r = getReportDetail(reportId);
        String md = buildMarkdown(r);
        if (!"markdown".equalsIgnoreCase(format) && !"md".equalsIgnoreCase(format)) {
            throw new BizIllegalException("当前仅支持 markdown 导出");
        }
        try {
            Path f = Files.createTempFile("evaluation-report-" + reportId + "-", ".md");
            Files.writeString(f, md, StandardCharsets.UTF_8);
            return f.toAbsolutePath().toString();
        } catch (IOException e) {
            throw new BizIllegalException("导出文件失败: " + e.getMessage());
        }
    }

    private static String buildMarkdown(EvaluationReport r) {
        StringBuilder sb = new StringBuilder();
        sb.append("# 学习评估报告\n\n");
        sb.append("- 综合得分: ").append(r.getOverallScore()).append("\n");
        sb.append("- 优势\n\n").append(r.getStrengths() == null ? "" : r.getStrengths()).append("\n\n");
        sb.append("- 薄弱点\n\n").append(r.getWeaknesses() == null ? "" : r.getWeaknesses()).append("\n\n");
        sb.append("- 改进建议\n\n").append(r.getImprovementSuggestions() == null ? "" : r.getImprovementSuggestions()).append("\n");
        return sb.toString();
    }
}
