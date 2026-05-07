package com.cnsoftbei.a3.trade.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.cnsoftbei.a3.api.dto.course.CoursePurchaseInfoDTO;
import com.cnsoftbei.a3.common.domain.dto.PageDTO;
import com.cnsoftbei.a3.trade.domain.po.Order;
import com.cnsoftbei.a3.trade.domain.po.OrderDetail;
import com.cnsoftbei.a3.trade.domain.po.RefundApply;
import com.cnsoftbei.a3.trade.domain.query.OrderDetailPageQuery;
import com.cnsoftbei.a3.trade.domain.vo.OrderDetailAdminVO;
import com.cnsoftbei.a3.trade.domain.vo.OrderDetailPageVO;
import com.cnsoftbei.a3.trade.domain.vo.OrderProgressNodeVO;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * <p>
 * 订单明细 服务类
 * </p>
 *
 * @author 虎哥
 * @since 2022-08-29
 */
public interface IOrderDetailService extends IService<OrderDetail> {

    void updateStatusByOrderId(Long orderId, Integer status);

    List<OrderDetail> queryByOrderIds(List<Long> orderIds);

    List<OrderDetail> queryByOrderId(Long orderId);

    PageDTO<OrderDetailPageVO> queryDetailForPage(OrderDetailPageQuery pageQuery);

    OrderDetailAdminVO queryOrdersDetailProgress(Long id);

    List<OrderProgressNodeVO> packageProgressNodes(Order order, RefundApply refundApply);

    void markDetailSuccessByOrderId(Long id, String payChannel, LocalDateTime successTime);

    void updateRefundStatusById(Long orderDetailId, int status);

    List<Long> queryCourseIdsByOrderId(Long orderId);

    Boolean checkCourseOrderInfo(Long courseId);

    Map<Long, Integer> countEnrollNumOfCourse(List<Long> courseIdList);

    Map<Long, Integer> countEnrollCourseOfStudent(List<Long> studentIds);

    CoursePurchaseInfoDTO getPurchaseInfoOfCourse(Long courseId);
}
