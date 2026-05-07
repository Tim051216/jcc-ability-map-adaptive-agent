package com.cnsoftbei.a3.promotion.service;

import com.cnsoftbei.a3.promotion.domain.po.Coupon;
import com.cnsoftbei.a3.promotion.domain.po.ExchangeCode;
import com.baomidou.mybatisplus.extension.service.IService;

/**
 * <p>
 * 兑换码 服务类
 * </p>
 *
 * @author fenny
 * @since 2023-12-03
 */
public interface IExchangeCodeService extends IService<ExchangeCode> {

    void asyncGenerateCode(Coupon one);

    boolean updateExchangeCodeMark(long id, boolean b);
}
