package com.cnsoftbei.a3.message.controller;

import com.cnsoftbei.a3.message.domain.dto.ReviewNotificationSendDTO;
import com.cnsoftbei.a3.message.service.IReviewNotificationService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Api(tags = "A3复习提醒消息接口")
@RestController
@RequestMapping("/review-notifications")
@RequiredArgsConstructor
public class ReviewNotificationController {

    private final IReviewNotificationService reviewNotificationService;

    @ApiOperation("发送复习提醒")
    @PostMapping("/send")
    public void send(@RequestBody ReviewNotificationSendDTO dto) {
        reviewNotificationService.sendReviewReminder(dto);
    }
}
