package com.cnsoftbei.a3.trade.service;

import com.cnsoftbei.a3.trade.domain.dto.OrderDelayQueryDTO;
import com.cnsoftbei.a3.trade.domain.dto.PayApplyFormDTO;
import com.cnsoftbei.a3.trade.domain.vo.PayChannelVO;

import java.util.List;

public interface IPayService {
    List<PayChannelVO> queryPayChannels();

    String applyPayOrder(PayApplyFormDTO payApply);

    void queryPayResult(OrderDelayQueryDTO message);
}
