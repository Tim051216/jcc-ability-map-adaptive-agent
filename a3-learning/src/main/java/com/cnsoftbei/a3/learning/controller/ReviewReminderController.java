package com.cnsoftbei.a3.learning.controller;

import com.cnsoftbei.a3.common.domain.R;
import com.cnsoftbei.a3.learning.domain.dto.ReviewReminderFailDTO;
import com.cnsoftbei.a3.learning.domain.dto.ReviewReminderGenerateDTO;
import com.cnsoftbei.a3.learning.domain.po.ReviewReminderTask;
import com.cnsoftbei.a3.learning.service.IReviewReminderTaskService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@Api(tags = "智能复习提醒")
@RestController
@RequestMapping("/learning/review-reminders")
@RequiredArgsConstructor
public class ReviewReminderController {

    private final IReviewReminderTaskService reviewReminderTaskService;

    @ApiOperation("生成复习提醒任务")
    @PostMapping("/generate")
    public R<Long> generate(@RequestBody ReviewReminderGenerateDTO dto) {
        return R.ok(reviewReminderTaskService.generateReminderTask(dto));
    }

    @ApiOperation("查询到期待发送提醒")
    @GetMapping("/pending")
    public R<List<ReviewReminderTask>> queryPending(
            @RequestParam(value = "before", required = false)
            @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") LocalDateTime before,
            @RequestParam(value = "limit", required = false) Integer limit) {
        return R.ok(reviewReminderTaskService.queryPendingTasks(before, limit));
    }

    @ApiOperation("查询当前用户提醒任务")
    @GetMapping("/mine")
    public R<List<ReviewReminderTask>> queryMine() {
        return R.ok(reviewReminderTaskService.queryCurrentUserTasks());
    }

    @ApiOperation("回写发送成功")
    @PostMapping("/{id}/mark-sent")
    public R<Void> markSent(@PathVariable("id") Long id) {
        reviewReminderTaskService.markSent(id);
        return R.ok(null);
    }

    @ApiOperation("回写发送失败")
    @PostMapping("/{id}/mark-failed")
    public R<Void> markFailed(@PathVariable("id") Long id, @RequestBody ReviewReminderFailDTO dto) {
        reviewReminderTaskService.markFailed(id, dto.getFailReason());
        return R.ok(null);
    }
}
