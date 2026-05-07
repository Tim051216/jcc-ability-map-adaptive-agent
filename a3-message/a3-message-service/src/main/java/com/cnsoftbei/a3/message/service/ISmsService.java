package com.cnsoftbei.a3.message.service;

import com.cnsoftbei.a3.api.dto.sms.SmsInfoDTO;
import com.cnsoftbei.a3.api.dto.user.UserDTO;
import com.cnsoftbei.a3.message.domain.po.NoticeTemplate;

import java.util.List;

public interface ISmsService {
    void sendMessageByTemplate(NoticeTemplate noticeTemplate, List<UserDTO> users);

    void sendMessage(SmsInfoDTO smsInfoDTO);

    void sendMessageAsync(SmsInfoDTO smsInfoDTO);
}
