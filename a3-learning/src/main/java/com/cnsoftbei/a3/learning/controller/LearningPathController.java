package com.cnsoftbei.a3.learning.controller;

import com.cnsoftbei.a3.common.domain.R;
import com.cnsoftbei.a3.common.utils.UserContext;
import com.cnsoftbei.a3.learning.domain.dto.PathPlanningDTO;
import com.cnsoftbei.a3.learning.domain.vo.LearningPathVO;
import com.cnsoftbei.a3.learning.domain.vo.PathProgressVO;
import com.cnsoftbei.a3.learning.service.ILearningPathService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiParam;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

/**
 * <p>
 * 学习路径管理 前端控制器
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Api(tags = "学习路径管理")
@RestController
@RequestMapping("/learning/path")
@RequiredArgsConstructor
public class LearningPathController {

    private final ILearningPathService learningPathService;

    @ApiOperation("创建学习路径")
    @PostMapping("/create")
    public R<Long> createPath(@Valid @RequestBody PathPlanningDTO planningDTO) {
        Long pathId = learningPathService.createLearningPath(planningDTO);
        return R.ok(pathId);
    }

    @ApiOperation("获取路径详情")
    @GetMapping("/{pathId}")
    public R<LearningPathVO> getPathDetail(
            @ApiParam("路径ID") @PathVariable Long pathId) {
        LearningPathVO pathVO = learningPathService.getPathDetail(pathId);
        return R.ok(pathVO);
    }

    @ApiOperation("激活学习路径")
    @PostMapping("/{pathId}/activate")
    public R<Boolean> activatePath(
            @ApiParam("路径ID") @PathVariable Long pathId) {
        Boolean success = learningPathService.activatePath(pathId);
        return R.ok(success);
    }

    @ApiOperation("确认并激活学习路径（与激活接口等价，便于对接规划确认流程）")
    @PostMapping("/{pathId}/confirm")
    public R<Boolean> confirmPath(
            @ApiParam("路径ID") @PathVariable Long pathId) {
        Boolean success = learningPathService.activatePath(pathId);
        return R.ok(success);
    }

    @ApiOperation("查询我的学习路径")
    @GetMapping("/my")
    public R<List<LearningPathVO>> queryMyPaths() {
        Long userId = UserContext.requireUser();
        List<LearningPathVO> paths = learningPathService.queryUserPaths(userId);
        return R.ok(paths);
    }

    @ApiOperation("查询当前进行中的路径")
    @GetMapping("/current")
    public R<LearningPathVO> queryCurrentPath() {
        Long userId = UserContext.requireUser();
        LearningPathVO path = learningPathService.queryCurrentPath(userId);
        return R.ok(path);
    }

    @ApiOperation("查询路径进度")
    @GetMapping("/{pathId}/progress")
    public R<PathProgressVO> queryPathProgress(
            @ApiParam("路径ID") @PathVariable Long pathId) {
        PathProgressVO progress = learningPathService.queryPathProgress(pathId);
        return R.ok(progress);
    }

    @ApiOperation("暂停学习路径")
    @PostMapping("/{pathId}/pause")
    public R<Boolean> pausePath(
            @ApiParam("路径ID") @PathVariable Long pathId) {
        Boolean success = learningPathService.pausePath(pathId);
        return R.ok(success);
    }

    @ApiOperation("恢复学习路径")
    @PostMapping("/{pathId}/resume")
    public R<Boolean> resumePath(
            @ApiParam("路径ID") @PathVariable Long pathId) {
        Boolean success = learningPathService.resumePath(pathId);
        return R.ok(success);
    }

    @ApiOperation("完成学习路径")
    @PostMapping("/{pathId}/complete")
    public R<Boolean> completePath(
            @ApiParam("路径ID") @PathVariable Long pathId) {
        Boolean success = learningPathService.completePath(pathId);
        return R.ok(success);
    }
}
