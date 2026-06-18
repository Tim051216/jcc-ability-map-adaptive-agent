package com.cnsoftbei.a3.message.service;

import com.cnsoftbei.a3.message.domain.dto.ReviewNotificationSendDTO;

public interface IReviewNotificationService {

    void sendReviewReminder(ReviewNotificationSendDTO dto);
}
