import Layout from "@/pages/layouts/index.vue";

export default [
  {
    path: "/ask",
    name: "ask",
    component: Layout,
    redirect: "/ask/index",
    meta: { title: "\u53D1\u5E03\u4E0E\u7F16\u8F91\u95EE\u9898" },
    children: [
      {
        path: "index",
        name: "ask",
        component: () => import("@/pages/ask/index.vue"),
        meta: { title: "\u53D1\u5E03\u95EE\u9898" },
      },
    ],
  },
  {
    path: "/result",
    name: "result",
    component: Layout,
    redirect: "/result/success",
    meta: { title: "\u7ED3\u679C\u9875", icon: "check-circle" },
    children: [
      {
        path: "success",
        name: "ResultSuccess",
        component: () => import("@/pages/result/success/index.vue"),
        meta: { title: "\u6210\u529F\u9875" },
      },
      {
        path: "404",
        name: "Result404",
        component: () => import("@/pages/result/404/index.vue"),
        meta: { title: "\u8BBF\u95EE\u9875\u9762\u4E0D\u5B58\u5728" },
      },
    ],
  },
];
