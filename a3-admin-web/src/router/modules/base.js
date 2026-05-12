import Layout from "@/pages/layouts/index.vue";
import HomeIcon from "@/assets/icon_home.svg";

export default [
  {
    path: "/main",
    component: Layout,
    redirect: "/main/index",
    name: "main",
    meta: { title: "管理概览", icon:'&#xe60c;', hidden: true},
    children: [
      {
        path: "index",
        name: "index",
        component: () => import("@/pages/main/index.vue"),
        meta: { title: "概览首页", hidden: false },
      },
    ],
  },
];
