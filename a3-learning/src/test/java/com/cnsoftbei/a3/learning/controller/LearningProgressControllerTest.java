package com.cnsoftbei.a3.learning.controller;

import com.cnsoftbei.a3.learning.domain.dto.ProgressRecordDTO;
import com.cnsoftbei.a3.learning.domain.po.LearningProgress;
import com.cnsoftbei.a3.learning.service.ILearningProgressService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
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
 * 学习进度流水 HTTP 契约烟测（独立 MockMvc）。
 */
@ExtendWith(MockitoExtension.class)
class LearningProgressControllerTest {

    @Mock
    private ILearningProgressService learningProgressService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        ObjectMapper om = new ObjectMapper();
        om.registerModule(new JavaTimeModule());
        objectMapper = om;
        MappingJackson2HttpMessageConverter jackson = new MappingJackson2HttpMessageConverter();
        jackson.setObjectMapper(om);
        mockMvc = MockMvcBuilders.standaloneSetup(new LearningProgressController(learningProgressService))
                .setMessageConverters(jackson)
                .build();
    }

    @Test
    void recordProgress_acceptsBody() throws Exception {
        when(learningProgressService.recordProgress(any(ProgressRecordDTO.class))).thenReturn(true);

        ProgressRecordDTO dto = new ProgressRecordDTO();
        dto.setPathId(10L);
        dto.setNodeId(20L);
        dto.setProgressType(2);

        mockMvc.perform(
                        post("/learning/progress/record")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").value(true));

        verify(learningProgressService).recordProgress(any(ProgressRecordDTO.class));
    }

    @Test
    void listByPath_returnsArray() throws Exception {
        LearningProgress p = new LearningProgress();
        p.setId(1L);
        p.setPathId(5L);
        p.setNodeId(8L);
        when(learningProgressService.queryPathProgress(5L)).thenReturn(List.of(p));

        mockMvc.perform(get("/learning/progress/path/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].pathId").value(5))
                .andExpect(jsonPath("$.data[0].nodeId").value(8));

        verify(learningProgressService).queryPathProgress(eq(5L));
    }

    @Test
    void listByNode_returnsEmpty() throws Exception {
        when(learningProgressService.queryNodeProgress(7L)).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/learning/progress/node/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(0));
    }
}
