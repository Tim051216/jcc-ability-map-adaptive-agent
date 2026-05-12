package com.cnsoftbei.a3.learning.controller;

import com.cnsoftbei.a3.common.domain.R;
import com.cnsoftbei.a3.common.utils.BeanUtils;
import com.cnsoftbei.a3.common.utils.UserContext;
import com.cnsoftbei.a3.learning.domain.dto.AnswerSubmitDTO;
import com.cnsoftbei.a3.learning.domain.dto.EvaluationTestDTO;
import com.cnsoftbei.a3.learning.domain.dto.QuestionGenerateDTO;
import com.cnsoftbei.a3.learning.domain.po.EvaluationAnswerRecord;
import com.cnsoftbei.a3.learning.domain.po.EvaluationQuestion;
import com.cnsoftbei.a3.learning.domain.po.EvaluationReport;
import com.cnsoftbei.a3.learning.domain.po.EvaluationTest;
import com.cnsoftbei.a3.learning.domain.vo.EvaluationReportVO;
import com.cnsoftbei.a3.learning.service.IEvaluationAnswerRecordService;
import com.cnsoftbei.a3.learning.service.IEvaluationQuestionService;
import com.cnsoftbei.a3.learning.service.IEvaluationReportService;
import com.cnsoftbei.a3.learning.service.IEvaluationTestService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiParam;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/evaluation")
@Api(tags = "Learning evaluation APIs")
@RequiredArgsConstructor
public class EvaluationController {

    private final IEvaluationTestService testService;
    private final IEvaluationQuestionService questionService;
    private final IEvaluationAnswerRecordService answerRecordService;
    private final IEvaluationReportService reportService;

    @PostMapping("/test")
    @ApiOperation("Create evaluation test")
    public R<Long> createTest(@Validated @RequestBody EvaluationTestDTO dto) {
        EvaluationTest test = BeanUtils.copyBean(dto, EvaluationTest.class);
        return R.ok(testService.createTest(test));
    }

    @PutMapping("/test/{testId}/publish")
    @ApiOperation("Publish evaluation test")
    public R<Void> publishTest(@ApiParam("Test ID") @PathVariable Long testId) {
        testService.publishTest(testId);
        return R.ok();
    }

    @GetMapping("/test/course/{courseId}")
    @ApiOperation("List tests by course")
    public R<List<EvaluationTest>> listTestsByCourse(
            @ApiParam("Course ID") @PathVariable Long courseId
    ) {
        return R.ok(testService.listByCourseId(courseId));
    }

    @GetMapping("/test/{testId}")
    @ApiOperation("Get test detail")
    public R<EvaluationTest> getTestDetail(@ApiParam("Test ID") @PathVariable Long testId) {
        return R.ok(testService.getById(testId));
    }

    @PostMapping("/question/generate")
    @ApiOperation("Generate questions")
    public R<List<EvaluationQuestion>> generateQuestions(
            @Validated @RequestBody QuestionGenerateDTO dto
    ) {
        return R.ok(questionService.generateQuestions(dto));
    }

    @GetMapping("/question/test/{testId}")
    @ApiOperation("List questions by test")
    public R<List<EvaluationQuestion>> listQuestionsByTest(
            @ApiParam("Test ID") @PathVariable Long testId
    ) {
        return R.ok(questionService.listByTestId(testId));
    }

    @PostMapping("/answer/submit")
    @ApiOperation("Submit answers")
    public R<Map<String, Object>> submitAnswers(@Validated @RequestBody AnswerSubmitDTO dto) {
        Long userId = UserContext.requireUser();
        answerRecordService.batchSubmitAnswers(dto.getTestId(), userId, dto.getAnswers());
        return R.ok(answerRecordService.batchAutoGrade(dto.getTestId(), userId));
    }

    @GetMapping("/answer/wrong")
    @ApiOperation("List wrong answers")
    public R<List<Map<String, Object>>> listWrongAnswers(
            @ApiParam("Test ID") @RequestParam(required = false) Long testId
    ) {
        Long userId = UserContext.requireUser();
        List<EvaluationAnswerRecord> wrong = answerRecordService.listWrongAnswers(userId, testId);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (EvaluationAnswerRecord record : wrong) {
            EvaluationQuestion question = questionService.getById(record.getQuestionId());
            Map<String, Object> row = new HashMap<>();
            row.put("answerRecordId", record.getId());
            row.put("testId", record.getTestId());
            row.put("questionId", record.getQuestionId());
            row.put("question_id", record.getQuestionId() != null ? String.valueOf(record.getQuestionId()) : null);
            row.put("userAnswer", record.getUserAnswer());
            row.put("user_answer", record.getUserAnswer());
            row.put("gradingFeedback", record.getGradingFeedback());
            row.put("score", record.getScore());
            String content = question == null ? null : question.getQuestionContent();
            String knowledgePoint = question == null ? null : question.getKnowledgePoint();
            String correctAnswer = question == null ? null : question.getCorrectAnswer();
            String analysis = question == null ? null : question.getAnswerAnalysis();
            row.put("questionContent", content);
            row.put("prompt", content);
            row.put("knowledgePoint", knowledgePoint);
            row.put("knowledge_point", knowledgePoint);
            row.put("correctAnswer", correctAnswer);
            row.put("correct_answer", correctAnswer);
            row.put("answerAnalysis", analysis);
            row.put("explanation", buildExplanation(record.getGradingFeedback(), analysis));
            rows.add(row);
        }
        return R.ok(rows);
    }

    private static String buildExplanation(String feedback, String analysis) {
        if (feedback != null && !feedback.isBlank()) {
            if (analysis != null && !analysis.isBlank() && !analysis.equals(feedback)) {
                return feedback + "\n\n解析：" + analysis;
            }
            return feedback;
        }
        return analysis != null ? analysis : "";
    }

    @PostMapping("/report/generate/{testId}")
    @ApiOperation("Generate single test report")
    public R<Long> generateSingleTestReport(@ApiParam("Test ID") @PathVariable Long testId) {
        Long userId = UserContext.requireUser();
        return R.ok(reportService.generateSingleTestReport(testId, userId));
    }

    @PostMapping("/report/generate/stage")
    @ApiOperation("Generate stage report")
    public R<Long> generateStageReport(
            @ApiParam("Course ID") @RequestParam Long courseId,
            @ApiParam("Start time") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @ApiParam("End time") @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime
    ) {
        Long userId = UserContext.requireUser();
        return R.ok(reportService.generateStageReport(userId, courseId, startTime, endTime));
    }

    @PostMapping("/report/generate/comprehensive")
    @ApiOperation("Generate comprehensive report")
    public R<Long> generateComprehensiveReport(@ApiParam("Course ID") @RequestParam Long courseId) {
        Long userId = UserContext.requireUser();
        return R.ok(reportService.generateComprehensiveReport(userId, courseId));
    }

    @GetMapping("/report/{reportId}/export")
    @ApiOperation("Export report")
    public R<String> exportReport(
            @ApiParam("Report ID") @PathVariable Long reportId,
            @ApiParam("Format") @RequestParam(defaultValue = "markdown") String format
    ) {
        return R.ok(reportService.exportReport(reportId, format));
    }

    @GetMapping("/report/{reportId}")
    @ApiOperation("Get report detail")
    public R<EvaluationReportVO> getReportDetail(@ApiParam("Report ID") @PathVariable Long reportId) {
        EvaluationReport report = reportService.getReportDetail(reportId);
        EvaluationReportVO vo = BeanUtils.copyBean(report, EvaluationReportVO.class);
        vo.setReportSummary(summarizeReport(report));
        vo.setMasteryLevel(inferMasteryLevel(report));
        vo.setReportTypeDesc(describeReportType(report.getReportType()));
        return R.ok(vo);
    }

    private static String summarizeReport(EvaluationReport report) {
        if (report.getWeaknesses() != null && !report.getWeaknesses().isBlank()) {
            String head = report.getWeaknesses().lines().filter(s -> !s.isBlank()).findFirst().orElse("");
            if (!head.isEmpty()) {
                return "薄弱点摘要：" + head;
            }
        }
        if (report.getStrengths() != null && !report.getStrengths().isBlank()) {
            return report.getStrengths().lines().filter(s -> !s.isBlank()).findFirst().orElse("");
        }
        return "";
    }

    private static String inferMasteryLevel(EvaluationReport report) {
        if (report.getKnowledgeMastery() == null || report.getKnowledgeMastery().isEmpty()) {
            return "";
        }
        Object points = report.getKnowledgeMastery().get("knowledge_points");
        if (!(points instanceof List)) {
            return "";
        }
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> list = (List<Map<String, Object>>) points;
        if (list.isEmpty()) {
            return "";
        }
        double sum = 0;
        int count = 0;
        for (Map<String, Object> item : list) {
            Object accuracyRate = item.get("accuracy_rate");
            if (accuracyRate instanceof Number) {
                sum += ((Number) accuracyRate).doubleValue();
                count++;
            }
        }
        if (count == 0) {
            return "";
        }
        double average = sum / count;
        if (average >= 90) {
            return "精通";
        }
        if (average >= 75) {
            return "熟练掌握";
        }
        if (average >= 60) {
            return "基本掌握";
        }
        if (average >= 40) {
            return "初步了解";
        }
        return "未掌握";
    }

    private static String describeReportType(Integer type) {
        if (type == null) {
            return "";
        }
        switch (type) {
            case 1:
                return "单次测评报告";
            case 2:
                return "阶段性报告";
            case 3:
                return "综合报告";
            default:
                return String.valueOf(type);
        }
    }

    @GetMapping("/report/list")
    @ApiOperation("List reports")
    public R<List<EvaluationReport>> listReports(
            @ApiParam("Course ID") @RequestParam(required = false) Long courseId
    ) {
        Long userId = UserContext.requireUser();
        return R.ok(reportService.listByUser(userId, courseId));
    }

    @GetMapping("/report/knowledge-mastery")
    @ApiOperation("Knowledge mastery stats")
    public R<Map<String, Object>> getKnowledgeMasteryStats(
            @ApiParam("Course ID") @RequestParam Long courseId
    ) {
        Long userId = UserContext.requireUser();
        return R.ok(reportService.getKnowledgeMasteryStats(userId, courseId));
    }

    @GetMapping("/report/learning-efficiency")
    @ApiOperation("Learning efficiency stats")
    public R<Map<String, Object>> getLearningEfficiencyStats(
            @ApiParam("Course ID") @RequestParam Long courseId
    ) {
        Long userId = UserContext.requireUser();
        return R.ok(reportService.getLearningEfficiencyStats(userId, courseId));
    }
}
