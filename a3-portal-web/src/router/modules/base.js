import Layout from "@/pages/layouts/index.vue";

export default [
  {
    path: "/main",
    component: Layout,
    redirect: "/main/index",
    name: "main",
    meta: { title: "\u9996\u9875" },
    children: [
      {
        path: "index",
        name: "index",
        component: () => import("@/pages/main/index.vue"),
        meta: { title: "\u9996\u9875" },
      },
      {
        path: "coupon",
        name: "coupon",
        component: () => import("@/pages/main/coupon.vue"),
        meta: { title: "\u4F18\u60E0\u6D3B\u52A8" },
      },
      {
        path: "ai-demo",
        name: "aiDemo",
        component: () => import("@/pages/aiDemo/index.vue"),
        meta: { title: "AI 鍗忓悓婕旂ず" },
      },
      {
        path: "ai-path",
        name: "aiPath",
        component: () => import("@/pages/learningPath/index.vue"),
        meta: { title: "AI 学习路径页" },
      },
      {
        path: "ai-report",
        name: "aiReport",
        component: () => import("@/pages/learningReport/index.vue"),
        meta: { title: "AI 学习测评报告页" },
      },
    ],
  },
  {
    path: "/search",
    component: Layout,
    name: "search",
    redirect: "/search/index",
    meta: { title: "\u8BFE\u7A0B\u641C\u7D22" },
    children: [
      {
        path: "index",
        name: "search",
        component: () => import("@/pages/classSearch/index.vue"),
        meta: { title: "\u8BFE\u7A0B\u641C\u7D22" },
      },
    ],
  },
  {
    path: "/classList",
    component: Layout,
    name: "classList",
    redirect: "/classList/index",
    meta: { title: "\u8BFE\u7A0B\u5C55\u793A" },
    children: [
      {
        path: "index",
        name: "classListIndex",
        component: () => import("@/pages/classList/index.vue"),
        meta: { title: "\u8BFE\u7A0B\u5C55\u793A" },
      },
    ],
  },
  {
    path: "/askDetails",
    component: Layout,
    name: "askDetails",
    redirect: "/askDetails/index",
    meta: { title: "\u95EE\u7B54\u8BE6\u60C5" },
    children: [
      {
        path: "index",
        name: "askDetails",
        component: () => import("@/pages/ask/askDetails.vue"),
        meta: { title: "\u95EE\u7B54\u8BE6\u60C5" },
      },
    ],
  },
  {
    path: "/details",
    component: Layout,
    name: "details",
    redirect: "/details/index",
    meta: { title: "\u8BFE\u7A0B\u8BE6\u60C5" },
    children: [
      {
        path: "index",
        name: "details",
        component: () => import("@/pages/classDetails/index.vue"),
        meta: { title: "\u8BFE\u7A0B\u8BE6\u60C5" },
      },
    ],
  },
  {
    path: "/learning",
    name: "learning",
    redirect: "/learning/index",
    meta: { title: "\u5B66\u4E60\u9875" },
    children: [
      {
        path: "index",
        name: "learning",
        component: () => import("@/pages/learning/index.vue"),
        meta: { title: "\u5B66\u4E60\u9875" },
      },
    ],
  },
  {
    path: "/pay",
    name: "pay",
    component: Layout,
    redirect: "/pay/settlement",
    meta: { title: "\u8BFE\u7A0B\u91C7\u8D2D" },
    children: [
      {
        path: "settlement",
        name: "settlement",
        component: () => import("@/pages/pay/settlement.vue"),
        meta: { title: "\u786E\u8BA4\u7ED3\u7B97" },
      },
      {
        path: "carts",
        name: "carts",
        component: () => import("@/pages/pay/carts.vue"),
        meta: { title: "\u91C7\u8D2D\u6E05\u5355" },
      },
      {
        path: "payment",
        name: "payment",
        component: () => import("@/pages/pay/payment.vue"),
        meta: { title: "\u5B8C\u6210\u652F\u4ED8" },
      },
      {
        path: "success",
        name: "success",
        component: () => import("@/pages/pay/success.vue"),
        meta: { title: "\u652F\u4ED8\u6210\u529F" },
      },
    ],
  },
  {
    path: "/personal",
    component: Layout,
    name: "personal",
    redirect: "/personal/main",
    meta: { title: "\u4E2A\u4EBA\u4E2D\u5FC3" },
    children: [
      {
        path: "main",
        name: "personalMain",
        component: () => import("@/pages/personal/index.vue"),
        meta: { title: "\u4E2A\u4EBA\u4E2D\u5FC3\u9996\u9875" },
        children: [
          {
            path: "myClass",
            name: "myClass",
            component: () => import("@/pages/personal/myClass.vue"),
            meta: { title: "\u6211\u7684\u8BFE\u7A0B", active: "myClass", icon: "&#xe611;" },
          },
          {
            path: "myExam",
            name: "myExam",
            component: () => import("@/pages/personal/myExam.vue"),
            meta: { title: "\u6211\u7684\u8003\u8BD5", active: "myExam", icon: "&#xe615;" },
          },
          {
            path: "myExamDetails",
            name: "myExamDetails",
            component: () => import("@/pages/personal/myExamDetails.vue"),
            meta: {
              title: "\u6211\u7684\u8003\u8BD5",
              current: "\u8003\u8BD5\u8BE6\u60C5",
              active: "myExam",
              hidden: true,
              icon: "&#xe615;",
            },
          },
          {
            path: "myOrder",
            name: "myOrder",
            component: () => import("@/pages/personal/myOrder.vue"),
            meta: { title: "\u6211\u7684\u8BA2\u5355", active: "myOrder", icon: "&#xe60b;" },
          },
          {
            path: "myOrderDetails",
            name: "myOrderDetails",
            component: () => import("@/pages/personal/myOrderDetails.vue"),
            meta: {
              title: "\u6211\u7684\u8BA2\u5355",
              current: "\u8BA2\u5355\u8BE6\u60C5",
              active: "myOrder",
              hidden: true,
              icon: "&#xe60b;",
            },
          },
          {
            path: "myCoupon",
            name: "myCoupon",
            component: () => import("@/pages/personal/myCoupon.vue"),
            meta: { title: "\u6211\u7684\u4F18\u60E0\u5238", active: "myCoupon", icon: "&#xe616;" },
          },
          {
            path: "myCouponExplain",
            name: "myCouponExplain",
            component: () => import("@/pages/personal/myCouponExplain.vue"),
            meta: {
              title: "\u6211\u7684\u4F18\u60E0\u5238",
              current: "\u4F7F\u7528\u8BF4\u660E",
              active: "myCoupon",
              hidden: true,
              icon: "&#xe616;",
            },
          },
          {
            path: "myMessage",
            name: "myMessage",
            component: () => import("@/pages/personal/myMessage.vue"),
            meta: { title: "\u6211\u7684\u6D88\u606F", active: "myMessage", hidden: true, icon: "&#xe612;" },
          },
          {
            path: "myIntegral",
            name: "myIntegral",
            component: () => import("@/pages/personal/myIntegral.vue"),
            meta: { title: "\u6211\u7684\u79EF\u5206", active: "myIntegral", icon: "&#xe610;" },
          },
          {
            path: "myIntegralRanking",
            name: "myIntegralRanking",
            component: () => import("@/pages/personal/myIntegralRanking.vue"),
            meta: {
              title: "\u6211\u7684\u79EF\u5206",
              current: "\u5B66\u4E60\u79EF\u5206\u699C",
              active: "myIntegral",
              hidden: true,
              icon: "&#xe610;",
            },
          },
          {
            path: "myCollect",
            name: "myCollect",
            component: () => import("@/pages/personal/myCollect.vue"),
            meta: { title: "\u6211\u7684\u6536\u85CF", active: "myCollect", hidden: true, icon: "&#xe613;" },
          },
          {
            path: "mySet",
            name: "mySet",
            component: () => import("@/pages/personal/mySet.vue"),
            meta: { title: "\u4E2A\u4EBA\u8BBE\u7F6E", active: "mySet", icon: "&#xe617;" },
          },
        ],
      },
    ],
  },
];
