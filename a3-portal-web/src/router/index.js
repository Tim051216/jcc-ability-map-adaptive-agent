import { useRoute, createRouter, createWebHashHistory } from "vue-router";

import baseRouters from "./modules/base";
import componentsRouters from "./modules/components";
import othersRouters from "./modules/others";

// 存放业务页面路由
export const asyncRouterList = [...baseRouters, ...componentsRouters, ...othersRouters];

// 存放基础固定路由
const defaultRouterList = [
  {
    path: "/login",
    name: "login",
    component: () => import("@/pages/login/index.vue"),
  },
  {
    path: "/",
    redirect: "/main/index",
    component: () => import("@/pages/layouts/index.vue"),
  },
  {
    path: "/:w+",
    name: "404Page",
    redirect: "/result/404",
  },
];

export const allRoutes = [...defaultRouterList, ...asyncRouterList];

export const getActive = (maxLevel = 2) => {
  const route = useRoute();
  if (!route.path) {
    return "";
  }
  return route.path
    .split("/")
    .filter((_item, index) => index <= maxLevel && index > 0)
    .map((item) => `/${item}`)
    .join("");
};

const router = createRouter({
  history: createWebHashHistory(),
  routes: allRoutes,
  scrollBehavior() {
    return {
      el: "#app",
      top: 0,
      behavior: "smooth",
    };
  },
});

export default router;
