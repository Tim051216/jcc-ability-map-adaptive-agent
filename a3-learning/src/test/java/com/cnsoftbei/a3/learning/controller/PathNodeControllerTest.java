package com.cnsoftbei.a3.learning.controller;

import com.cnsoftbei.a3.learning.domain.vo.PathNodeVO;
import com.cnsoftbei.a3.learning.service.IPathNodeService;
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

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 路径节点 HTTP 契约烟测（独立 MockMvc）。
 */
@ExtendWith(MockitoExtension.class)
class PathNodeControllerTest {

    @Mock
    private IPathNodeService pathNodeService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        ObjectMapper om = new ObjectMapper();
        om.registerModule(new JavaTimeModule());
        MappingJackson2HttpMessageConverter jackson = new MappingJackson2HttpMessageConverter();
        jackson.setObjectMapper(om);
        mockMvc = MockMvcBuilders.standaloneSetup(new PathNodeController(pathNodeService))
                .setMessageConverters(jackson)
                .build();
    }

    @Test
    void queryPathNodes_returnsList() throws Exception {
        PathNodeVO n = new PathNodeVO();
        n.setId(101L);
        n.setPathId(9L);
        n.setNodeName("第一节");
        when(pathNodeService.queryPathNodes(9L)).thenReturn(List.of(n));

        mockMvc.perform(get("/learning/node/path/9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].id").value(101))
                .andExpect(jsonPath("$.data[0].nodeName").value("第一节"));

        verify(pathNodeService).queryPathNodes(eq(9L));
    }

    @Test
    void getNodeDetail_returnsVo() throws Exception {
        PathNodeVO n = new PathNodeVO();
        n.setId(55L);
        n.setNodeName("详情节点");
        when(pathNodeService.getNodeDetail(55L)).thenReturn(n);

        mockMvc.perform(get("/learning/node/55"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(55))
                .andExpect(jsonPath("$.data.nodeName").value("详情节点"));
    }

    @Test
    void startCompletePauseSkipRedo_delegateToService() throws Exception {
        when(pathNodeService.startNode(1L)).thenReturn(true);
        when(pathNodeService.completeNode(1L)).thenReturn(true);
        when(pathNodeService.pauseNode(eq(1L), eq("busy"))).thenReturn(true);
        when(pathNodeService.skipNode(eq(1L), eq("optional"))).thenReturn(true);
        when(pathNodeService.redoNode(1L)).thenReturn(true);

        mockMvc.perform(post("/learning/node/1/start"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(true));
        mockMvc.perform(post("/learning/node/1/complete"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(true));
        mockMvc.perform(post("/learning/node/1/pause").param("reason", "busy"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(true));
        mockMvc.perform(post("/learning/node/1/skip").param("reason", "optional"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(true));
        mockMvc.perform(post("/learning/node/1/redo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(true));

        verify(pathNodeService).startNode(1L);
        verify(pathNodeService).completeNode(1L);
        verify(pathNodeService).pauseNode(1L, "busy");
        verify(pathNodeService).skipNode(1L, "optional");
        verify(pathNodeService).redoNode(1L);
    }

    @Test
    void getNextNode_returnsVoOrHandled() throws Exception {
        PathNodeVO next = new PathNodeVO();
        next.setId(3L);
        when(pathNodeService.getNextNode(2L)).thenReturn(next);

        mockMvc.perform(get("/learning/node/2/next"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(3));

        when(pathNodeService.getNextNode(99L)).thenReturn(null);
        mockMvc.perform(get("/learning/node/99/next"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    void queryPathNodes_emptyArray() throws Exception {
        when(pathNodeService.queryPathNodes(0L)).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/learning/node/path/0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(0));
    }
}
