package com.cnsoftbei.a3.message.service.impl;

import com.cnsoftbei.a3.message.domain.dto.ReviewNotificationSendDTO;
import com.cnsoftbei.a3.message.domain.dto.UserInboxFormDTO;
import com.cnsoftbei.a3.message.enums.NoticeType;
import com.cnsoftbei.a3.message.service.IReviewNotificationService;
import com.cnsoftbei.a3.message.service.IUserInboxService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReviewNotificationServiceImpl implements IReviewNotificationService {

    private final IUserInboxService userInboxService;

    @Override
    public void sendReviewReminder(ReviewNotificationSendDTO dto) {
        UserInboxFormDTO inboxFormDTO = new UserInboxFormDTO();
        inboxFormDTO.setUserId(dto.getUserId());
        inboxFormDTO.setTitle(dto.getTitle());
        inboxFormDTO.setContent(dto.getContent());
        inboxFormDTO.setType(NoticeType.SYSTEM.getValue());
        userInboxService.sentMessageToUser(inboxFormDTO);

        if (dto.getChannelStrategy() != null && !dto.getChannelStrategy().isBlank()) {
            log.info("Review reminder task {} requested channels: {}. Current implementation dispatches inbox first and reserves external channels for later integration.",
                    dto.getTaskId(), dto.getChannelStrategy());
        }
    }
}
