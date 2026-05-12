package com.cnsoftbei.a3.learning.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cnsoftbei.a3.common.exceptions.BizIllegalException;
import com.cnsoftbei.a3.common.utils.BeanUtils;
import com.cnsoftbei.a3.common.utils.UserContext;
import com.cnsoftbei.a3.learning.domain.dto.PathPlanningDTO;
import com.cnsoftbei.a3.learning.domain.po.LearningPath;
import com.cnsoftbei.a3.learning.domain.po.NodeResource;
import com.cnsoftbei.a3.learning.domain.po.PathNode;
import com.cnsoftbei.a3.learning.domain.vo.NodeResourceVO;
import com.cnsoftbei.a3.learning.domain.vo.PathNodeVO;
import com.cnsoftbei.a3.learning.mapper.LearningPathMapper;
import com.cnsoftbei.a3.learning.mapper.NodeResourceMapper;
import com.cnsoftbei.a3.learning.mapper.PathNodeMapper;
import com.cnsoftbei.a3.learning.service.ILearningPathService;
import com.cnsoftbei.a3.learning.service.IPathNodeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class PathNodeServiceImpl extends ServiceImpl<PathNodeMapper, PathNode> implements IPathNodeService {

    private final LearningPathMapper learningPathMapper;
    private final NodeResourceMapper nodeResourceMapper;
    private final ILearningPathService learningPathService;
    private final ObjectMapper objectMapper;

    public PathNodeServiceImpl(PathNodeMapper pathNodeMapper,
            LearningPathMapper learningPathMapper,
            NodeResourceMapper nodeResourceMapper,
            ObjectMapper objectMapper,
            @Lazy ILearningPathService learningPathService) {
        this.baseMapper = pathNodeMapper;
        this.learningPathMapper = learningPathMapper;
        this.nodeResourceMapper = nodeResourceMapper;
        this.objectMapper = objectMapper;
        this.learningPathService = learningPathService;
    }

    @Override
    public List<PathNodeVO> queryPathNodes(Long pathId) {
        learningPathService.ensureCurrentUserOwnsPath(pathId);
        LambdaQueryWrapper<PathNode> w = new LambdaQueryWrapper<>();
        w.eq(PathNode::getPathId, pathId).orderByAsc(PathNode::getNodeOrder);
        return BeanUtils.copyList(list(w), PathNodeVO.class);
    }

    @Override
    public PathNodeVO getNodeDetail(Long nodeId) {
        PathNode node = requireNodeOwned(nodeId);
        PathNodeVO vo = BeanUtils.copyBean(node, PathNodeVO.class);
        LambdaQueryWrapper<NodeResource> rw = new LambdaQueryWrapper<>();
        rw.eq(NodeResource::getNodeId, nodeId).orderByAsc(NodeResource::getResourceOrder);
        List<NodeResource> res = nodeResourceMapper.selectList(rw);
        vo.setResources(BeanUtils.copyList(res, NodeResourceVO.class));
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean startNode(Long nodeId) {
        PathNode node = requireNodeOwned(nodeId);
        LocalDateTime now = LocalDateTime.now();
        node.setStatus(1);
        node.setStartTime(now);
        node.setUpdateTime(now);
        boolean ok = updateById(node);
        touchPathCurrentNode(node.getPathId(), nodeId);
        promotePathToInProgress(node.getPathId(), now);
        return ok;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean completeNode(Long nodeId) {
        PathNode node = requireNodeOwned(nodeId);
        LocalDateTime now = LocalDateTime.now();
        node.setStatus(2);
        node.setProgressPercentage(100);
        node.setCompleteTime(now);
        node.setUpdateTime(now);
        boolean ok = updateById(node);
        Long pathId = node.getPathId();
        refreshPathAggregation(pathId);
        refreshCurrentNodePointer(pathId);
        return ok;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean pauseNode(Long nodeId, String reason) {
        PathNode node = requireNodeOwned(nodeId);
        node.setStatus(4);
        node.setUpdateTime(LocalDateTime.now());
        log.debug("pause node {} reason {}", nodeId, reason);
        return updateById(node);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean skipNode(Long nodeId, String reason) {
        PathNode node = requireNodeOwned(nodeId);
        node.setStatus(3);
        node.setUpdateTime(LocalDateTime.now());
        log.debug("skip node {} reason {}", nodeId, reason);
        boolean ok = updateById(node);
        Long pathId = node.getPathId();
        refreshPathAggregation(pathId);
        refreshCurrentNodePointer(pathId);
        return ok;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean redoNode(Long nodeId) {
        PathNode node = requireNodeOwned(nodeId);
        node.setStatus(0);
        node.setProgressPercentage(0);
        node.setStartTime(null);
        node.setCompleteTime(null);
        node.setUpdateTime(LocalDateTime.now());
        boolean ok = updateById(node);
        refreshPathAggregation(node.getPathId());
        refreshCurrentNodePointer(node.getPathId());
        return ok;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean unlockNode(Long nodeId) {
        PathNode node = requireNodeOwned(nodeId);
        node.setIsLocked(false);
        node.setUnlockTime(LocalDateTime.now());
        node.setUpdateTime(LocalDateTime.now());
        return updateById(node);
    }

    @Override
    public PathNodeVO getNextNode(Long currentNodeId) {
        PathNode current = requireNodeOwned(currentNodeId);
        LambdaQueryWrapper<PathNode> w = new LambdaQueryWrapper<>();
        w.eq(PathNode::getPathId, current.getPathId())
                .gt(PathNode::getNodeOrder, current.getNodeOrder())
                .orderByAsc(PathNode::getNodeOrder)
                .last("LIMIT 1");
        PathNode next = getOne(w);
        return next == null ? null : BeanUtils.copyBean(next, PathNodeVO.class);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void seedLadderDemoNodes(Long pathId, Long userId, PathPlanningDTO planningDTO) {
        if (learningPathMapper.selectById(pathId) == null) {
            return;
        }
        LambdaQueryWrapper<PathNode> exists = new LambdaQueryWrapper<>();
        exists.eq(PathNode::getPathId, pathId);
        if (count(exists) > 0) {
            return;
        }
        int difficulty = planningDTO.getDifficultyLevel() != null ? planningDTO.getDifficultyLevel() : 2;
        List<String> kps = planningDTO.getTargetKnowledgePoints() != null
                ? planningDTO.getTargetKnowledgePoints()
                : Collections.emptyList();
        String[] titles = {
                "基础知识学习",
                "阶梯练习巩固",
                "阶段测评检验",
                "综合能力进阶",
                "复习复盘总结"
        };
        String[] descs = {
                "理解本阶段核心概念，建立与课程目标的对应关系。",
                "通过分层练习巩固典型题型与易错点。",
                "小测检验掌握情况，为后续阶段提供依据。",
                "在稍复杂情境中综合应用所学内容。",
                "回顾薄弱点并巩固关键结论。"
        };
        int[][] meta = {
                {1, 1, 45},
                {2, 1, 30},
                {3, 2, 35},
                {1, 3, 40},
                {4, 4, 25}
        };
        LocalDateTime now = LocalDateTime.now();
        int sumMinutes = 0;
        List<PathNode> batch = new ArrayList<>();
        for (int i = 0; i < titles.length; i++) {
            sumMinutes += meta[i][2];
            PathNode n = new PathNode()
                    .setPathId(pathId)
                    .setUserId(userId)
                    .setNodeName(titles[i])
                    .setNodeDesc(descs[i])
                    .setNodeOrder(i + 1)
                    .setNodeType(meta[i][0])
                    .setStageType(meta[i][1])
                    .setKnowledgePoints(writeJsonKp(kps, i))
                    .setPrerequisiteNodes("[]")
                    .setDifficultyLevel(difficulty)
                    .setCompletionCriteria(writeCompletionHint())
                    .setEstimatedDuration(meta[i][2])
                    .setStatus(0)
                    .setIsLocked(Boolean.FALSE)
                    .setProgressPercentage(0)
                    .setCreateTime(now)
                    .setUpdateTime(now);
            batch.add(n);
        }
        saveBatch(batch);
        refreshPathAggregation(pathId);
        if (planningDTO.getEstimatedDuration() == null) {
            LearningPath path = learningPathMapper.selectById(pathId);
            if (path != null) {
                path.setEstimatedDuration(sumMinutes);
                path.setUpdateTime(LocalDateTime.now());
                learningPathMapper.updateById(path);
            }
        }
    }

    private String writeJsonKp(List<String> kps, int index) {
        try {
            if (kps != null && !kps.isEmpty()) {
                String pick = kps.get(Math.min(index, kps.size() - 1));
                return objectMapper.writeValueAsString(Collections.singletonList(pick));
            }
            return objectMapper.writeValueAsString(
                    Collections.singletonList("阶段目标 " + (index + 1)));
        } catch (Exception e) {
            return "[]";
        }
    }

    private String writeCompletionHint() {
        try {
            return objectMapper.writeValueAsString(Map.of("mode", "manual_or_resource"));
        } catch (Exception e) {
            return "{}";
        }
    }

    private PathNode requireNodeOwned(Long nodeId) {
        Long uid = UserContext.requireUser();
        PathNode node = getById(nodeId);
        if (node == null || !uid.equals(node.getUserId())) {
            throw new BizIllegalException("路径节点不存在或无权访问");
        }
        return node;
    }

    private void promotePathToInProgress(Long pathId, LocalDateTime now) {
        LearningPath path = learningPathMapper.selectById(pathId);
        if (path == null) {
            return;
        }
        Integer st = path.getStatus();
        if (st != null && (st == 0 || st == 1)) {
            path.setStatus(2);
            if (path.getStartTime() == null) {
                path.setStartTime(now);
            }
            path.setUpdateTime(now);
            learningPathMapper.updateById(path);
        }
    }

    private void touchPathCurrentNode(Long pathId, Long nodeId) {
        LearningPath path = learningPathMapper.selectById(pathId);
        if (path != null) {
            path.setCurrentNodeId(nodeId);
            path.setUpdateTime(LocalDateTime.now());
            learningPathMapper.updateById(path);
        }
    }

    private void refreshCurrentNodePointer(Long pathId) {
        LambdaQueryWrapper<PathNode> w = new LambdaQueryWrapper<>();
        w.eq(PathNode::getPathId, pathId).orderByAsc(PathNode::getNodeOrder);
        List<PathNode> nodes = list(w);
        PathNode inProgress = nodes.stream()
                .filter(n -> Integer.valueOf(1).equals(n.getStatus()))
                .findFirst()
                .orElse(null);
        Long nextId = null;
        if (inProgress != null) {
            nextId = inProgress.getId();
        } else {
            PathNode pending = nodes.stream()
                    .filter(n -> {
                        Integer s = n.getStatus();
                        return s == null || s == 0 || s == 4;
                    })
                    .findFirst()
                    .orElse(null);
            if (pending != null) {
                nextId = pending.getId();
            }
        }
        LearningPath path = learningPathMapper.selectById(pathId);
        if (path == null) {
            return;
        }
        path.setCurrentNodeId(nextId);
        path.setUpdateTime(LocalDateTime.now());
        learningPathMapper.updateById(path);
    }

    private void refreshPathAggregation(Long pathId) {
        LambdaQueryWrapper<PathNode> w = new LambdaQueryWrapper<>();
        w.eq(PathNode::getPathId, pathId);
        List<PathNode> nodes = list(w);
        int total = nodes.size();
        long cleared = nodes.stream()
                .filter(n -> Integer.valueOf(2).equals(n.getStatus())
                        || Integer.valueOf(3).equals(n.getStatus()))
                .count();
        LearningPath path = learningPathMapper.selectById(pathId);
        if (path == null) {
            return;
        }
        path.setTotalNodes(total);
        path.setCompletedNodes((int) cleared);
        path.setProgressPercentage(total == 0 ? 0 : (int) (cleared * 100 / total));
        path.setUpdateTime(LocalDateTime.now());
        learningPathMapper.updateById(path);

        Integer st = path.getStatus();
        if (total > 0 && cleared >= total && st != null && st != 3 && st != 4 && st != 5) {
            learningPathService.completePathWhenNodesFinished(pathId);
        }
    }
}
