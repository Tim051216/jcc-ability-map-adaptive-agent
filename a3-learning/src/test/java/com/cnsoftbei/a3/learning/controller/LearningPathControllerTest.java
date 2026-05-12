package com.cnsoftbei.a3.learning.controller;

import com.cnsoftbei.a3.common.utils.UserContext;
import com.cnsoftbei.a3.learning.domain.dto.PathPlanningDTO;
import com.cnsoftbei.a3.learning.domain.vo.LearningPathVO;
import com.cnsoftbei.a3.learning.domain.vo.PathProgressVO;
import com.cnsoftbei.a3.learning.service.ILearningPathService;
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

import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 学习路径 HTTP 契约烟测（独立 MockMvc，不启动 Spring 容器 / MyBatis）。
 * 对应 spec：个性化学习路径 · 任务 13 自动化部分。
 */
@ExtendWith(MockitoExtension.class)
class LearningPathControllerTest {

    @Mock
    private ILearningPathService learningPathService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        ObjectMapper om = new ObjectMapper();
        om.registerModule(new JavaTimeModule());
        objectMapper = om;
        MappingJackson2HttpMessageConverter jackson = new MappingJackson2HttpMessageConverter();
        jackson.setObjectMapper(om);
        mockMvc = MockMvcBuilders.standaloneSetup(new LearningPathController(learningPathService))
                .setMessageConverters(jackson)
                .build();
    }

    @AfterEach
    void tearDown() {
        UserContext.removeUser();
    }

    @Test
    void createPath_returnsPathId() throws Exception {
        when(learningPathService.createLearningPath(any(PathPlanningDTO.class))).thenReturn(9001L);

        PathPlanningDTO dto = new PathPlanningDTO();
        dto.setPathName("单元测试路径");
        dto.setTargetCourseId(1L);
        dto.setSeedDemoNodes(Boolean.FALSE);

        mockMvc.perform(
                        post("/learning/path/create")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").value(9001));

        verify(learningPathService).createLearningPath(any(PathPlanningDTO.class));
    }

    @Test
    void queryMyPaths_usesUserContext() throws Exception {
        UserContext.setUser(42L);
        when(learningPathService.queryUserPaths(42L)).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/learning/path/my"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(0));

        verify(learningPathService).queryUserPaths(42L);
    }

    @Test
    void getPathDetail_returnsVo() throws Exception {
        LearningPathVO vo = new LearningPathVO();
        vo.setId(7L);
        vo.setPathName("演示路径");
        when(learningPathService.getPathDetail(7L)).thenReturn(vo);

        mockMvc.perform(get("/learning/path/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(7))
                .andExpect(jsonPath("$.data.pathName").value("演示路径"));
    }

    @Test
    void queryPathProgress_returnsProgress() throws Exception {
        PathProgressVO progress = new PathProgressVO();
        progress.setPathId(3L);
        progress.setPathName("p");
        progress.setProgressPercentage(50);
        progress.setCompletedNodes(2);
        progress.setTotalNodes(4);
        progress.setNodes(List.of());
        when(learningPathService.queryPathProgress(3L)).thenReturn(progress);

        mockMvc.perform(get("/learning/path/3/progress"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.pathId").value(3))
                .andExpect(jsonPath("$.data.progressPercentage").value(50));
    }

    @Test
    void activatePath_delegatesToService() throws Exception {
        when(learningPathService.activatePath(8L)).thenReturn(true);

        mockMvc.perform(post("/learning/path/8/activate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").value(true));

        verify(learningPathService).activatePath(eq(8L));
    }

    @Test
    void queryCurrentPath_usesUserContext() throws Exception {
        UserContext.setUser(99L);
        LearningPathVO vo = new LearningPathVO();
        vo.setId(100L);
        vo.setPathName("进行中");
        when(learningPathService.queryCurrentPath(99L)).thenReturn(vo);

        mockMvc.perform(get("/learning/path/current"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(100))
                .andExpect(jsonPath("$.data.pathName").value("进行中"));

        verify(learningPathService).queryCurrentPath(99L);
    }

    @Test
    void confirmPath_delegatesToActivate() throws Exception {
        when(learningPathService.activatePath(11L)).thenReturn(true);

        mockMvc.perform(post("/learning/path/11/confirm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").value(true));

        verify(learningPathService).activatePath(11L);
    }

    @Test
    void pausePath_delegatesToService() throws Exception {
        when(learningPathService.pausePath(12L)).thenReturn(true);

        mockMvc.perform(post("/learning/path/12/pause"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(true));

        verify(learningPathService).pausePath(12L);
    }

    @Test
    void resumePath_delegatesToService() throws Exception {
        when(learningPathService.resumePath(13L)).thenReturn(true);

        mockMvc.perform(post("/learning/path/13/resume"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(true));

        verify(learningPathService).resumePath(13L);
    }

    @Test
    void completePath_delegatesToService() throws Exception {
        when(learningPathService.completePath(14L)).thenReturn(true);

        mockMvc.perform(post("/learning/path/14/complete"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(true));

        verify(learningPathService).completePath(14L);
    }
}
