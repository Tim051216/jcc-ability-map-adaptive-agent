package com.cnsoftbei.a3.message.thirdparty;

import com.cnsoftbei.a3.api.dto.sms.SmsInfoDTO;
import com.cnsoftbei.a3.message.domain.po.MessageTemplate;

/**
 * 第三方接口对接平台
 */
public interface ISmsHandler {

    /**
     * 发送短信
     */
    void send(SmsInfoDTO platformSmsInfoDTO, MessageTemplate template);


}
