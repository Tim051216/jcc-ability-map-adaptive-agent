package com.cnsoftbei.a3.learning.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cnsoftbei.a3.common.exceptions.BizIllegalException;
import com.cnsoftbei.a3.common.utils.BeanUtils;
import com.cnsoftbei.a3.common.utils.UserContext;
import com.cnsoftbei.a3.learning.domain.dto.PathPlanningDTO;
import com.cnsoftbei.a3.learning.domain.po.LearningPath;
import com.cnsoftbei.a3.learning.domain.vo.LearningPathVO;
import com.cnsoftbei.a3.learning.domain.vo.PathNodeVO;
import com.cnsoftbei.a3.learning.domain.vo.PathProgressVO;
import com.cnsoftbei.a3.learning.mapper.LearningPathMapper;
import com.cnsoftbei.a3.learning.service.ILearningBehaviorCollectionService;
import com.cnsoftbei.a3.learning.service.ILearningPathService;
import com.cnsoftbei.a3.learning.service.IPathNodeService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class LearningPathServiceImpl extends ServiceImpl<LearningPathMapper, LearningPath>
        implements ILearningPathService {

    private final ObjectMapper objectMapper;
    private final IPathNodeService pathNodeService;
    private final ILearningBehaviorCollectionService learningBehaviorCollectionService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long createLearningPath(PathPlanningDTO planningDTO) {
        Long uid = UserContext.requireUser();
        LocalDateTime now = LocalDateTime.now();
        LearningPath path = new LearningPath()
                .setUserId(uid)
                .setProfileId(planningDTO.getProfileId())
                .setPathName(planningDTO.getPathName())
                .setPathDesc(planningDTO.getPathDesc())
                .setTargetCourseId(planningDTO.getTargetCourseId())
                .setTargetKnowledgePoints(writeKnowledgePoints(planningDTO.getTargetKnowledgePoints()))
                .setStatus(0)
                .setPathType(planningDTO.getPathType() == null ? 1 : planningDTO.getPathType())
                .setTotalNodes(0)
                .setCompletedNodes(0)
                .setProgressPercentage(0)
                .setEstimatedDuration(planningDTO.getEstimatedDuration())
                .setDifficultyLevel(planningDTO.getDifficultyLevel())
                .setAdaptiveEnabled(planningDTO.getAdaptiveEnabled() != null ? planningDTO.getAdaptiveEnabled() : Boolean.FALSE)
                .setCreateTime(now)
                .setUpdateTime(now);
        if (!save(path)) {
            throw new BizIllegalException("创建学习路径失败");
        }
        if (Boolean.TRUE.equals(planningDTO.getSeedDemoNodes())) {
            pathNodeService.seedLadderDemoNodes(path.getId(), uid, planningDTO);
        }
        return path.getId();
    }

    @Override
    public LearningPathVO getPathDetail(Long pathId) {
        LearningPath path = requireOwnedPath(pathId);
        return toVo(path);
    }

    @Override
    public void ensureCurrentUserOwnsPath(Long pathId) {
        requireOwnedPath(pathId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean activatePath(Long pathId) {
        LearningPath path = requireOwnedPath(pathId);
        LocalDateTime now = LocalDateTime.now();
        path.setStatus(1);
        path.setActivateTime(now);
        path.setUpdateTime(now);
        return updateById(path);
    }

    @Override
    public List<LearningPathVO> queryUserPaths(Long userId) {
        if (userId == null) {
            throw new BizIllegalException("请先登录");
        }
        LambdaQueryWrapper<LearningPath> w = new LambdaQueryWrapper<>();
        w.eq(LearningPath::getUserId, userId).orderByDesc(LearningPath::getUpdateTime);
        return BeanUtils.copyList(list(w), LearningPathVO.class, (src, vo) ->
                vo.setTargetKnowledgePoints(parseKnowledgePoints(src.getTargetKnowledgePoints())));
    }

    @Override
    public LearningPathVO queryCurrentPath(Long userId) {
        if (userId == null) {
            throw new BizIllegalException("请先登录");
        }
        LambdaQueryWrapper<LearningPath> w = new LambdaQueryWrapper<>();
        w.eq(LearningPath::getUserId, userId).eq(LearningPath::getStatus, 2)
                .orderByDesc(LearningPath::getUpdateTime).last("LIMIT 1");
        LearningPath path = getOne(w);
        if (path == null) {
            w = new LambdaQueryWrapper<>();
            w.eq(LearningPath::getUserId, userId).eq(LearningPath::getStatus, 1)
                    .orderByDesc(LearningPath::getUpdateTime).last("LIMIT 1");
            path = getOne(w);
        }
        return path == null ? null : toVo(path);
    }

    @Override
    public PathProgressVO queryPathProgress(Long pathId) {
        LearningPath path = requireOwnedPath(pathId);
        List<PathNodeVO> nodes = pathNodeService.queryPathNodes(pathId);
        PathProgressVO vo = new PathProgressVO();
        vo.setPathId(pathId);
        vo.setPathName(path.getPathName());
        vo.setProgressPercentage(path.getProgressPercentage());
        vo.setCompletedNodes(path.getCompletedNodes());
        vo.setTotalNodes(path.getTotalNodes());
        vo.setCurrentNodeId(path.getCurrentNodeId());
        vo.setNodes(nodes);
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean pausePath(Long pathId) {
        LearningPath path = requireOwnedPath(pathId);
        path.setStatus(4);
        path.setUpdateTime(LocalDateTime.now());
        return updateById(path);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean resumePath(Long pathId) {
        LearningPath path = requireOwnedPath(pathId);
        path.setStatus(2);
        path.setUpdateTime(LocalDateTime.now());
        return updateById(path);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean completePath(Long pathId) {
        return finalizePathIfNeeded(requireOwnedPath(pathId), pathId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean completePathWhenNodesFinished(Long pathId) {
        LearningPath path = getById(pathId);
        if (path == null) {
            return false;
        }
        return finalizePathIfNeeded(path, pathId);
    }

    /**
     * 幂等收口：将路径标记为已学完并发行为采集（若适用）。
     */
    private Boolean finalizePathIfNeeded(LearningPath path, Long pathId) {
        if (Integer.valueOf(3).equals(path.getStatus())) {
            return true;
        }
        LocalDateTime now = LocalDateTime.now();
        path.setStatus(3);
        path.setCompleteTime(now);
        path.setProgressPercentage(100);
        path.setUpdateTime(now);
        boolean ok = updateById(path);
        if (Boolean.TRUE.equals(ok) && path.getUserId() != null) {
            Map<String, Object> payload = new HashMap<>(8);
            payload.put("source", "learning_path");
            payload.put("path_id", pathId);
            payload.put("completion_rate", 100);
            payload.put("current_stage", "路径已完成");
            payload.put("target_course_id", path.getTargetCourseId());
            payload.put("path_name", path.getPathName());
            Integer durationSec = null;
            if (path.getActualDuration() != null) {
                durationSec = path.getActualDuration() * 60;
            }
            learningBehaviorCollectionService.collect(
                    path.getUserId(),
                    3,
                    payload,
                    "path",
                    pathId,
                    "completed",
                    durationSec
            );
        }
        return ok;
    }

    /**
     * 必须由当前登录用户拥有的路径；避免通过 pathId 遍历他人路径。
     */
    private LearningPath requireOwnedPath(Long pathId) {
        Long currentUserId = UserContext.requireUser();
        LearningPath path = getById(pathId);
        if (path == null || !currentUserId.equals(path.getUserId())) {
            throw new BizIllegalException("学习路径不存在或无权访问");
        }
        return path;
    }

    private LearningPathVO toVo(LearningPath path) {
        return BeanUtils.copyBean(path, LearningPathVO.class, (src, vo) ->
                vo.setTargetKnowledgePoints(parseKnowledgePoints(src.getTargetKnowledgePoints())));
    }

    private String writeKnowledgePoints(List<String> points) {
        if (points == null || points.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(points);
        } catch (Exception e) {
            log.warn("序列化知识点失败: {}", e.getMessage());
            return null;
        }
    }

    private List<String> parseKnowledgePoints(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {
            });
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
