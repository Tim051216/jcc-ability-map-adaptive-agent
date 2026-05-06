package com.tianji.learning.controller;

import com.tianji.learning.domain.dto.a3.A3LearningRequestDTO;
import com.tianji.learning.domain.vo.a3.A3AgentPreviewVO;
import com.tianji.learning.domain.vo.a3.A3LearningPlanVO;
import com.tianji.learning.domain.vo.a3.A3ResourcePlanVO;
import com.tianji.learning.domain.vo.a3.A3StudentProfileVO;
import com.tianji.learning.service.IA3AgentDemoService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;

/**
 * A3 赛题演示接口。
 */
@Api(tags = "A3赛题多智能体演示接口")
@RestController
@RequestMapping("/a3/agent-demo")
@RequiredArgsConstructor
@Validated
public class A3AgentDemoController {

    private final IA3AgentDemoService a3AgentDemoService;

    @ApiOperation("生成学生画像")
    @PostMapping("/profile")
    public A3StudentProfileVO buildProfile(@Valid @RequestBody A3LearningRequestDTO requestDTO) {
        return a3AgentDemoService.buildProfile(requestDTO);
    }

    @ApiOperation("生成个性化学习资源方案")
    @PostMapping("/resources")
    public A3ResourcePlanVO generateResources(@Valid @RequestBody A3LearningRequestDTO requestDTO) {
        return a3AgentDemoService.generateResources(requestDTO);
    }

    @ApiOperation("生成个性化学习路径")
    @PostMapping("/path")
    public A3LearningPlanVO buildLearningPath(@Valid @RequestBody A3LearningRequestDTO requestDTO) {
        return a3AgentDemoService.buildLearningPath(requestDTO);
    }

    @ApiOperation("预览多智能体协同结果")
    @PostMapping("/preview")
    public A3AgentPreviewVO preview(@Valid @RequestBody A3LearningRequestDTO requestDTO) {
        return a3AgentDemoService.preview(requestDTO);
    }
}
