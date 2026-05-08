import request from "@/utils/request.js";
import {
  addDemoCart,
  applyDemoRefund,
  cancelDemoOrder,
  deleteDemoCarts,
  deleteDemoOrder,
  enrollDemoCourse,
  getDemoCartList,
  getDemoConfirmOrderInfo,
  getDemoOrderDetails,
  getDemoOrderPage,
  getDemoPayMethods,
  getDemoPayState,
  getDemoPayUrl,
  getDemoRefundDetails,
  isPortalDemoMode,
  placeDemoOrder,
} from "@/config/demo-learning";

const TRADE_API_PREFIX = "/ts";

export const getOrderListes = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoOrderPage(params),
      })
    : request({
        url: `${TRADE_API_PREFIX}/orders/page`,
        method: "get",
        params,
      });

export const getOrderDetails = (id) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoOrderDetails(id),
      })
    : request({
        url: `${TRADE_API_PREFIX}/orders/${id}`,
        method: "get",
      });

export const getOrderPages = (params) =>
  request({
    url: `${TRADE_API_PREFIX}/orders/page`,
    method: "get",
    params,
  });

export const confirmOrderInfo = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoConfirmOrderInfo(params),
      })
    : request({
        url: `${TRADE_API_PREFIX}/orders/prePlaceOrder`,
        method: "get",
        params,
      });

export const setOrder = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: placeDemoOrder(params),
      })
    : request({
        url: `${TRADE_API_PREFIX}/orders/placeOrder`,
        method: "post",
        data: params,
      });

export const enrolledFreeCourse = (id) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: enrollDemoCourse(id) ? 200 : 500,
        data: true,
      })
    : request({
        url: `${TRADE_API_PREFIX}/orders/freeCourse/${id}`,
        method: "post",
      });

export const cancelOrder = (id) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: cancelDemoOrder(id) ? 200 : 500,
        data: true,
      })
    : request({
        url: `${TRADE_API_PREFIX}/orders/${id}/cancel`,
        method: "put",
      });

export const delOrder = (id) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: deleteDemoOrder(id) ? 200 : 500,
        data: true,
      })
    : request({
        url: `${TRADE_API_PREFIX}/orders/${id}`,
        method: "delete",
      });

export const putCarts = (data) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: addDemoCart(data.courseId) ? 200 : 500,
        data: true,
      })
    : request({
        url: `${TRADE_API_PREFIX}/carts`,
        method: "post",
        data,
      });

export const getCarts = (data) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoCartList(),
      })
    : request({
        url: `${TRADE_API_PREFIX}/carts`,
        method: "get",
        data,
      });

export const delCarts = (data) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: deleteDemoCarts(data) ? 200 : 500,
        data: true,
      })
    : request({
        url: `${TRADE_API_PREFIX}/carts?ids=${data.join(",")}`,
        method: "delete",
      });

export const getPayMethod = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoPayMethods(),
      })
    : request({
        url: `${TRADE_API_PREFIX}/pay/channels`,
        method: "get",
        params,
      });

export const getPayUrl = (data) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoPayUrl(data),
      })
    : request({
        url: `${TRADE_API_PREFIX}/pay/order`,
        method: "post",
        data,
      });

export const getPayState = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoPayState(params.orderId),
      })
    : request({
        url: `${TRADE_API_PREFIX}/orders/${params.orderId}/status`,
        method: "get",
        params,
      });

export const refundsApply = (data) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: applyDemoRefund(data) ? 200 : 500,
        data: true,
      })
    : request({
        url: `${TRADE_API_PREFIX}/refund-apply`,
        method: "post",
        data,
      });

export const refundsDetails = (id) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoRefundDetails(id),
      })
    : request({
        url: `${TRADE_API_PREFIX}/refund-apply/detail/${id}`,
        method: "get",
      });
