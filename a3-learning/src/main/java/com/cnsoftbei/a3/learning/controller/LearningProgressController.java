package com.cnsoftbei.a3.learning.controller;

import com.cnsoftbei.a3.common.domain.R;
import com.cnsoftbei.a3.learning.domain.dto.ProgressRecordDTO;
import com.cnsoftbei.a3.learning.domain.po.LearningProgress;
import com.cnsoftbei.a3.learning.service.ILearningProgressService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiParam;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

/**
 * 学习路径进度记录接口
 */
@Api(tags = "学习路径进度")
@RestController
@RequestMapping("/learning/progress")
@RequiredArgsConstructor
public class LearningProgressController {

    private final ILearningProgressService learningProgressService;

    @ApiOperation("上报学习进度")
    @PostMapping("/record")
    public R<Boolean> record(@Valid @RequestBody ProgressRecordDTO recordDTO) {
        return R.ok(learningProgressService.recordProgress(recordDTO));
    }

    @ApiOperation("查询路径下进度流水")
    @GetMapping("/path/{pathId}")
    public R<List<LearningProgress>> listByPath(
            @ApiParam("路径ID") @PathVariable Long pathId) {
        return R.ok(learningProgressService.queryPathProgress(pathId));
    }

    @ApiOperation("查询节点进度流水")
    @GetMapping("/node/{nodeId}")
    public R<List<LearningProgress>> listByNode(
            @ApiParam("节点ID") @PathVariable Long nodeId) {
        return R.ok(learningProgressService.queryNodeProgress(nodeId));
    }
}
