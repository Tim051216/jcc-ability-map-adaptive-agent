package com.cnsoftbei.a3.pay.third;

import com.cnsoftbei.a3.pay.sdk.constants.PayConstants;
import com.cnsoftbei.a3.pay.third.model.PayStatus;
import com.cnsoftbei.a3.pay.third.model.PayStatusResponse;
import com.cnsoftbei.a3.pay.third.model.PrepayResponse;
import com.cnsoftbei.a3.pay.third.model.RefundResponse;
import com.cnsoftbei.a3.pay.third.model.RefundStatus;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(prefix = "a3.pay.stub", name = "enabled", havingValue = "true")
public class LocalPayStubConfiguration {

    @Bean(PayConstants.ALI_CHANNEL_CODE)
    public IPayService aliPayStubService() {
        return new LocalStubPayService(PayConstants.ALI_CHANNEL_CODE);
    }

    @Bean(PayConstants.WX_CHANNEL_CODE)
    public IPayService wxPayStubService() {
        return new LocalStubPayService(PayConstants.WX_CHANNEL_CODE);
    }

    private static class LocalStubPayService implements IPayService {
        private final String channel;

        private LocalStubPayService(String channel) {
            this.channel = channel;
        }

        @Override
        public PrepayResponse createPrepayOrder(String title, String orderNo, Integer amount) {
            return PrepayResponse.builder()
                    .success(true)
                    .payUrl("local-pay://" + channel + "/" + orderNo)
                    .msg("local stub pay url")
                    .build();
        }

        @Override
        public PayStatusResponse queryPayOrderStatus(String payOrderNo) {
            return PayStatusResponse.builder()
                    .success(true)
                    .payOrderNo(payOrderNo)
                    .payStatus(PayStatus.WAIT_BUYER_PAY.getValue())
                    .msg("local stub pending")
                    .build();
        }

        @Override
        public RefundResponse refundOrder(String payOrderNo, String refundOrderNo, Integer refundAmount, Integer totalAmount) {
            return RefundResponse.builder()
                    .success(true)
                    .channel(channel)
                    .amount(refundAmount)
                    .status(RefundStatus.SUCCESS.getValue())
                    .msg("local stub refund success")
                    .build();
        }

        @Override
        public RefundResponse queryRefundStatus(String orderNo, String refundOrderNo) {
            return RefundResponse.builder()
                    .success(true)
                    .channel(channel)
                    .status(RefundStatus.SUCCESS.getValue())
                    .msg("local stub refund success")
                    .build();
        }
    }
}
