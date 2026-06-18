package com.cnsoftbei.a3.learning.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cnsoftbei.a3.common.utils.UserContext;
import com.cnsoftbei.a3.learning.domain.dto.ReviewReminderGenerateDTO;
import com.cnsoftbei.a3.learning.domain.po.ReviewReminderTask;
import com.cnsoftbei.a3.learning.mapper.ReviewReminderTaskMapper;
import com.cnsoftbei.a3.learning.service.IReviewReminderTaskService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ReviewReminderTaskServiceImpl extends ServiceImpl<ReviewReminderTaskMapper, ReviewReminderTask>
        implements IReviewReminderTaskService {

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long generateReminderTask(ReviewReminderGenerateDTO dto) {
        Long userId = dto.getUserId() != null ? dto.getUserId() : UserContext.getUser();
        LocalDateTime now = LocalDateTime.now();
        ReviewReminderTask task = new ReviewReminderTask()
                .setUserId(userId)
                .setCourseId(dto.getCourseId())
                .setLessonId(dto.getLessonId())
                .setResourceId(dto.getResourceId())
                .setTriggerType(dto.getTriggerType() == null ? "REVIEW_DUE" : dto.getTriggerType())
                .setTitle(dto.getTitle() == null ? "该回顾这节内容了" : dto.getTitle())
                .setContent(dto.getContent() == null ? "系统已为你安排本轮复习，请尽快完成回顾。" : dto.getContent())
                .setSourceVideo(dto.getSourceVideo())
                .setRemindAt(dto.getRemindAt() == null ? now.plusHours(12) : dto.getRemindAt())
                .setStatus("PENDING")
                .setChannelStrategy(dto.getChannelStrategy() == null ? "IN_APP" : dto.getChannelStrategy())
                .setExtraJson(dto.getExtraJson())
                .setCreateTime(now)
                .setUpdateTime(now);
        save(task);
        return task.getId();
    }

    @Override
    public List<ReviewReminderTask> queryPendingTasks(LocalDateTime before, Integer limit) {
        LambdaQueryWrapper<ReviewReminderTask> wrapper = new LambdaQueryWrapper<ReviewReminderTask>()
                .eq(ReviewReminderTask::getStatus, "PENDING")
                .le(ReviewReminderTask::getRemindAt, before == null ? LocalDateTime.now() : before)
                .orderByAsc(ReviewReminderTask::getRemindAt)
                .last(limit == null ? "limit 100" : "limit " + Math.max(1, limit));
        return list(wrapper);
    }

    @Override
    public List<ReviewReminderTask> queryCurrentUserTasks() {
        Long userId = UserContext.requireUser();
        return lambdaQuery()
                .eq(ReviewReminderTask::getUserId, userId)
                .orderByDesc(ReviewReminderTask::getCreateTime)
                .list();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void markSent(Long id) {
        lambdaUpdate()
                .eq(ReviewReminderTask::getId, id)
                .set(ReviewReminderTask::getStatus, "SENT")
                .set(ReviewReminderTask::getUpdateTime, LocalDateTime.now())
                .update();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void markFailed(Long id, String failReason) {
        lambdaUpdate()
                .eq(ReviewReminderTask::getId, id)
                .set(ReviewReminderTask::getStatus, "FAILED")
                .set(ReviewReminderTask::getFailReason, failReason)
                .set(ReviewReminderTask::getUpdateTime, LocalDateTime.now())
                .update();
    }
}
