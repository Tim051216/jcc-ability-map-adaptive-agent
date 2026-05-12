import Layout from "@/pages/layouts/index.vue";

export default [
  {
    path: "/result",
    component: Layout,
    name: "result",
    redirect: "/result/404",
    meta: { title: "结果页" },
    children: [
      {
        path: "404",
        name: "result404",
        component: () => import("@/pages/result/404/index.vue"),
        meta: { title: "页面不存在" },
      },
      {
        path: "success",
        name: "resultSuccess",
        component: () => import("@/pages/result/success/index.vue"),
        meta: { title: "操作成功" },
      },
    ],
  },
];
