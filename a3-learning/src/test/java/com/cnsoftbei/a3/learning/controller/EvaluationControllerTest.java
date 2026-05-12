package com.cnsoftbei.a3.learning.controller;

import com.cnsoftbei.a3.common.utils.UserContext;
import com.cnsoftbei.a3.learning.domain.dto.EvaluationTestDTO;
import com.cnsoftbei.a3.learning.domain.po.EvaluationAnswerRecord;
import com.cnsoftbei.a3.learning.domain.po.EvaluationQuestion;
import com.cnsoftbei.a3.learning.domain.po.EvaluationReport;
import com.cnsoftbei.a3.learning.domain.po.EvaluationTest;
import com.cnsoftbei.a3.learning.service.IEvaluationAnswerRecordService;
import com.cnsoftbei.a3.learning.service.IEvaluationQuestionService;
import com.cnsoftbei.a3.learning.service.IEvaluationReportService;
import com.cnsoftbei.a3.learning.service.IEvaluationTestService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 学习效果评估 HTTP 契约烟测（独立 MockMvc，不启动 Spring 容器 / MyBatis）。
 */
@ExtendWith(MockitoExtension.class)
class EvaluationControllerTest {

    @Mock
    private IEvaluationTestService testService;
    @Mock
    private IEvaluationQuestionService questionService;
    @Mock
    private IEvaluationAnswerRecordService answerRecordService;
    @Mock
    private IEvaluationReportService reportService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        ObjectMapper om = new ObjectMapper();
        om.registerModule(new JavaTimeModule());
        objectMapper = om;
        MappingJackson2HttpMessageConverter jackson = new MappingJackson2HttpMessageConverter();
        jackson.setObjectMapper(om);

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        EvaluationController controller = new EvaluationController(
                testService, questionService, answerRecordService, reportService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setValidator(validator)
                .setMessageConverters(jackson)
                .build();
    }

    @AfterEach
    void tearDown() {
        UserContext.removeUser();
    }

    @Test
    void createTest_returnsTestId() throws Exception {
        when(testService.createTest(any(EvaluationTest.class))).thenReturn(88001L);

        EvaluationTestDTO dto = new EvaluationTestDTO();
        dto.setTitle("单元测评");
        dto.setTestType(1);
        dto.setDifficultyLevel(1);
        dto.setCourseId(100L);

        mockMvc.perform(
                        post("/evaluation/test")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").value(88001));

        verify(testService).createTest(any(EvaluationTest.class));
    }

    @Test
    void publishTest_delegatesToService() throws Exception {
        mockMvc.perform(put("/evaluation/test/7/publish"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(testService).publishTest(7L);
    }

    @Test
    void listTestsByCourse_returnsList() throws Exception {
        EvaluationTest one = new EvaluationTest();
        one.setId(1L);
        one.setTitle("课前测");
        when(testService.listByCourseId(55L)).thenReturn(List.of(one));

        mockMvc.perform(get("/evaluation/test/course/55"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].id").value(1))
                .andExpect(jsonPath("$.data[0].title").value("课前测"));
    }

    @Test
    void getTestDetail_returnsEntity() throws Exception {
        EvaluationTest t = new EvaluationTest();
        t.setId(3L);
        t.setTitle("详情");
        when(testService.getById(3L)).thenReturn(t);

        mockMvc.perform(get("/evaluation/test/3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.title").value("详情"));
    }

    @Test
    void submitAnswers_invokesSubmitAndGrade() throws Exception {
        UserContext.setUser(900L);
        Map<String, Object> grade = new HashMap<>();
        grade.put("totalScore", new BigDecimal("88"));
        when(answerRecordService.batchAutoGrade(eq(12L), eq(900L))).thenReturn(grade);

        Map<Long, String> answers = new HashMap<>();
        answers.put(101L, "A");
        Map<String, Object> body = new HashMap<>();
        body.put("testId", 12L);
        body.put("answers", answers);

        mockMvc.perform(
                        post("/evaluation/answer/submit")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.totalScore").value(88));

        verify(answerRecordService).batchSubmitAnswers(eq(12L), eq(900L), any());
        verify(answerRecordService).batchAutoGrade(eq(12L), eq(900L));
    }

    @Test
    void listWrongAnswers_mapsPromptFields() throws Exception {
        UserContext.setUser(77L);
        EvaluationAnswerRecord rec = new EvaluationAnswerRecord();
        rec.setId(500L);
        rec.setTestId(12L);
        rec.setQuestionId(33L);
        rec.setUserAnswer("B");
        rec.setGradingFeedback("错因说明");
        rec.setScore(BigDecimal.ZERO);
        when(answerRecordService.listWrongAnswers(77L, 12L)).thenReturn(List.of(rec));

        EvaluationQuestion q = new EvaluationQuestion();
        q.setId(33L);
        q.setQuestionContent("题干?");
        q.setKnowledgePoint("加法");
        q.setCorrectAnswer("A");
        q.setAnswerAnalysis("解析内容");
        when(questionService.getById(33L)).thenReturn(q);

        mockMvc.perform(get("/evaluation/answer/wrong").param("testId", "12"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].prompt").value("题干?"))
                .andExpect(jsonPath("$.data[0].correct_answer").value("A"))
                .andExpect(jsonPath("$.data[0].explanation").value("错因说明\n\n解析：解析内容"));
    }

    @Test
    void generateSingleTestReport_returnsReportId() throws Exception {
        UserContext.setUser(5L);
        when(reportService.generateSingleTestReport(20L, 5L)).thenReturn(999L);

        mockMvc.perform(post("/evaluation/report/generate/20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").value(999));
    }

    @Test
    void getReportDetail_enrichesVo() throws Exception {
        EvaluationReport report = new EvaluationReport();
        report.setId(8L);
        report.setReportType(1);
        report.setWeaknesses("运算粗心\n第二行");
        report.setKnowledgeMastery(Map.of(
                "knowledge_points",
                List.of(Map.of("accuracy_rate", 95))));
        when(reportService.getReportDetail(8L)).thenReturn(report);

        mockMvc.perform(get("/evaluation/report/8"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(8))
                .andExpect(jsonPath("$.data.reportTypeDesc").value("单次测评报告"))
                .andExpect(jsonPath("$.data.masteryLevel").value("精通"))
                .andExpect(jsonPath("$.data.reportSummary").value("薄弱点摘要：运算粗心"));
    }
}
