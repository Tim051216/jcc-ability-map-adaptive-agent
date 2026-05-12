package com.cnsoftbei.a3.learning.controller;

import com.cnsoftbei.a3.common.domain.R;
import com.cnsoftbei.a3.learning.domain.vo.PathNodeVO;
import com.cnsoftbei.a3.learning.service.IPathNodeService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiParam;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * <p>
 * 路径节点管理 前端控制器
 * </p>
 *
 * @author A3 Team
 * @since 2024-01-01
 */
@Api(tags = "路径节点管理")
@RestController
@RequestMapping("/learning/node")
@RequiredArgsConstructor
public class PathNodeController {

    private final IPathNodeService pathNodeService;

    @ApiOperation("查询路径的所有节点")
    @GetMapping("/path/{pathId}")
    public R<List<PathNodeVO>> queryPathNodes(
            @ApiParam("路径ID") @PathVariable Long pathId) {
        List<PathNodeVO> nodes = pathNodeService.queryPathNodes(pathId);
        return R.ok(nodes);
    }

    @ApiOperation("获取节点详情")
    @GetMapping("/{nodeId}")
    public R<PathNodeVO> getNodeDetail(
            @ApiParam("节点ID") @PathVariable Long nodeId) {
        PathNodeVO node = pathNodeService.getNodeDetail(nodeId);
        return R.ok(node);
    }

    @ApiOperation("开始学习节点")
    @PostMapping("/{nodeId}/start")
    public R<Boolean> startNode(
            @ApiParam("节点ID") @PathVariable Long nodeId) {
        Boolean success = pathNodeService.startNode(nodeId);
        return R.ok(success);
    }

    @ApiOperation("完成节点")
    @PostMapping("/{nodeId}/complete")
    public R<Boolean> completeNode(
            @ApiParam("节点ID") @PathVariable Long nodeId) {
        Boolean success = pathNodeService.completeNode(nodeId);
        return R.ok(success);
    }

    @ApiOperation("暂缓节点")
    @PostMapping("/{nodeId}/pause")
    public R<Boolean> pauseNode(
            @ApiParam("节点ID") @PathVariable Long nodeId,
            @ApiParam("暂缓原因") @RequestParam(required = false) String reason) {
        Boolean success = pathNodeService.pauseNode(nodeId, reason);
        return R.ok(success);
    }

    @ApiOperation("跳过节点")
    @PostMapping("/{nodeId}/skip")
    public R<Boolean> skipNode(
            @ApiParam("节点ID") @PathVariable Long nodeId,
            @ApiParam("跳过原因") @RequestParam(required = false) String reason) {
        Boolean success = pathNodeService.skipNode(nodeId, reason);
        return R.ok(success);
    }

    @ApiOperation("重做节点")
    @PostMapping("/{nodeId}/redo")
    public R<Boolean> redoNode(
            @ApiParam("节点ID") @PathVariable Long nodeId) {
        Boolean success = pathNodeService.redoNode(nodeId);
        return R.ok(success);
    }

    @ApiOperation("查询下一个节点")
    @GetMapping("/{nodeId}/next")
    public R<PathNodeVO> getNextNode(
            @ApiParam("当前节点ID") @PathVariable Long nodeId) {
        PathNodeVO nextNode = pathNodeService.getNextNode(nodeId);
        return R.ok(nextNode);
    }
}
