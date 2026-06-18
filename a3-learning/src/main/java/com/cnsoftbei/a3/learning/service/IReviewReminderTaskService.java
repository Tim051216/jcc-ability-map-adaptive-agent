package com.cnsoftbei.a3.learning.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.cnsoftbei.a3.learning.domain.dto.ReviewReminderGenerateDTO;
import com.cnsoftbei.a3.learning.domain.po.ReviewReminderTask;

import java.time.LocalDateTime;
import java.util.List;

public interface IReviewReminderTaskService extends IService<ReviewReminderTask> {

    Long generateReminderTask(ReviewReminderGenerateDTO dto);

    List<ReviewReminderTask> queryPendingTasks(LocalDateTime before, Integer limit);

    List<ReviewReminderTask> queryCurrentUserTasks();

    void markSent(Long id);

    void markFailed(Long id, String failReason);
}
