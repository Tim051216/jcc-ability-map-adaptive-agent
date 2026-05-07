package com.cnsoftbei.a3.trade.controller;

import com.cnsoftbei.a3.trade.domain.dto.PayApplyFormDTO;
import com.cnsoftbei.a3.trade.domain.vo.PayChannelVO;
import com.cnsoftbei.a3.trade.service.IPayService;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "A3资源订阅支付接口")
@RestController
@RequestMapping("pay")
@RequiredArgsConstructor
public class PayController {

    private final IPayService payService;

    @PostMapping("/order")
    @ApiOperation(value = "支付申请,返回支付二维码url")
    public String applyPayOrder(@RequestBody PayApplyFormDTO payApply) {
        return payService.applyPayOrder(payApply);
    }

    @GetMapping("/channels")
    @ApiOperation("获取支付渠道列表接口")
    public List<PayChannelVO> queryPayChannels() {
        return payService.queryPayChannels();
    }

}
