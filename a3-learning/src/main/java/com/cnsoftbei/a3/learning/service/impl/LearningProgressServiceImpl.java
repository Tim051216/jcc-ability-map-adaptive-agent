package com.cnsoftbei.a3.learning.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cnsoftbei.a3.common.exceptions.BizIllegalException;
import com.cnsoftbei.a3.common.utils.UserContext;
import com.cnsoftbei.a3.learning.domain.dto.ProgressRecordDTO;
import com.cnsoftbei.a3.learning.domain.po.LearningPath;
import com.cnsoftbei.a3.learning.domain.po.LearningProgress;
import com.cnsoftbei.a3.learning.domain.po.PathNode;
import com.cnsoftbei.a3.learning.mapper.LearningProgressMapper;
import com.cnsoftbei.a3.learning.mapper.LearningPathMapper;
import com.cnsoftbei.a3.learning.mapper.PathNodeMapper;
import com.cnsoftbei.a3.learning.service.ILearningPathService;
import com.cnsoftbei.a3.learning.service.ILearningProgressService;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class LearningProgressServiceImpl extends ServiceImpl<LearningProgressMapper, LearningProgress>
        implements ILearningProgressService {

    private final PathNodeMapper pathNodeMapper;
    private final LearningPathMapper learningPathMapper;
    private final ILearningPathService learningPathService;

    public LearningProgressServiceImpl(
            LearningProgressMapper baseMapper,
            PathNodeMapper pathNodeMapper,
            LearningPathMapper learningPathMapper,
            @Lazy ILearningPathService learningPathService
    ) {
        this.baseMapper = baseMapper;
        this.pathNodeMapper = pathNodeMapper;
        this.learningPathMapper = learningPathMapper;
        this.learningPathService = learningPathService;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean recordProgress(ProgressRecordDTO recordDTO) {
        Long uid = UserContext.requireUser();
        learningPathService.ensureCurrentUserOwnsPath(recordDTO.getPathId());
        PathNode bound = pathNodeMapper.selectById(recordDTO.getNodeId());
        if (bound == null
                || !recordDTO.getPathId().equals(bound.getPathId())
                || !uid.equals(bound.getUserId())) {
            throw new BizIllegalException("节点与路径不匹配或无权操作");
        }
        LocalDateTime now = LocalDateTime.now();
        LearningProgress row = new LearningProgress()
                .setPathId(recordDTO.getPathId())
                .setNodeId(recordDTO.getNodeId())
                .setUserId(uid)
                .setProgressType(recordDTO.getProgressType())
                .setProgressData(recordDTO.getProgressData())
                .setProgressPercentage(recordDTO.getProgressPercentage())
                .setDuration(recordDTO.getDuration())
                .setResultData(recordDTO.getResultData())
                .setCreateTime(now);
        boolean ok = save(row);
        if (recordDTO.getProgressPercentage() != null) {
            PathNode node = pathNodeMapper.selectById(recordDTO.getNodeId());
            if (node != null) {
                node.setProgressPercentage(recordDTO.getProgressPercentage());
                node.setUpdateTime(now);
                pathNodeMapper.updateById(node);
            }
        }
        return ok;
    }

    @Override
    public List<LearningProgress> queryNodeProgress(Long nodeId) {
        Long uid = UserContext.requireUser();
        PathNode node = pathNodeMapper.selectById(nodeId);
        if (node == null || !uid.equals(node.getUserId())) {
            throw new BizIllegalException("节点不存在或无权访问");
        }
        LambdaQueryWrapper<LearningProgress> w = new LambdaQueryWrapper<>();
        w.eq(LearningProgress::getNodeId, nodeId)
                .eq(LearningProgress::getUserId, uid)
                .orderByDesc(LearningProgress::getCreateTime);
        return list(w);
    }

    @Override
    public List<LearningProgress> queryPathProgress(Long pathId) {
        Long uid = UserContext.requireUser();
        learningPathService.ensureCurrentUserOwnsPath(pathId);
        LambdaQueryWrapper<LearningProgress> w = new LambdaQueryWrapper<>();
        w.eq(LearningProgress::getPathId, pathId)
                .eq(LearningProgress::getUserId, uid)
                .orderByDesc(LearningProgress::getCreateTime);
        return list(w);
    }

    @Override
    public Integer calculateNodeCompletion(Long nodeId) {
        Long uid = UserContext.requireUser();
        PathNode node = pathNodeMapper.selectById(nodeId);
        if (node == null || !uid.equals(node.getUserId())) {
            throw new BizIllegalException("节点不存在或无权访问");
        }
        return node.getProgressPercentage() != null ? node.getProgressPercentage() : 0;
    }

    @Override
    public Integer calculatePathCompletion(Long pathId) {
        learningPathService.ensureCurrentUserOwnsPath(pathId);
        LearningPath path = learningPathMapper.selectById(pathId);
        if (path == null) {
            throw new BizIllegalException("学习路径不存在");
        }
        return path.getProgressPercentage() != null ? path.getProgressPercentage() : 0;
    }
}
