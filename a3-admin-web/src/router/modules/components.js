import Layout from "@/pages/layouts/index.vue"
import ClassIcon from "@/assets/icon_class.svg"
import HDIcon from "@/assets/icon_hd.svg"
import orderIcon from "@/assets/icon_order.svg"
import UserIcon from "@/assets/icon_user.svg"
import YXIcon from "@/assets/icon_yx.svg"
import OurseIcon from "@/assets/icon_course.svg"
export default [

  {
    path: "/curriculum",
    component: Layout,
    redirect: "/curriculum/index",
    name: "curriculum",
    meta: { title: "课程内容", icon: '&#xe60f;' },
    children: [
      {
        path: "index",
        name: "curriculum",
        component: () => import("@/pages/curriculum/course/index.vue"),
        meta: { title: "课程列表" },
      },
      {
        path: "add/:id",
        name: "curriculumAdd",
        component: () => import("@/pages/curriculum/course/add.vue"),
        meta: { title: "创建与编辑", hidden: true, fmeta: {path: '/curriculum/index', title: '课程列表'} },
      },
      {
        path: "details/:id",
        name: "curriculumDetail",
        component: () => import("@/pages/curriculum/course/details.vue"),
        meta: { title: "课程详情", hidden: true, fmeta: {path: '/curriculum/index', title: '课程列表'} },
      },
      {
        path: "type",
        name: "type",
        component: () => import("@/pages/curriculum/type/index.vue"),
        meta: { title: "内容分类" },
      },
      {
        path: "media",
        name: "media",
        component: () => import("@/pages/curriculum/media/index.vue"),
        meta: { title: "资源素材" },
      }
    ],
  },
  {
    path: "/title",
    component: Layout,
    redirect: "/title/index",
    name: "title",
    meta: { title: "测评题库", icon: '&#xe60b;' },
    children: [
      {
        path: "index",
        name: "title",
        component: () => import("@/pages/title/index.vue"),
        meta: { title: "题库管理" },
      },
      {
        path: "add/:id",
        name: "titleAdd",
        component: () => import("@/pages/title/add.vue"),
        meta: { title: "创建与编辑", hidden: true ,fmeta: {path: '/title/index', title: '题库管理'}},
      },
      {
        path: "details/:id",
        name: "titleDetails",
        component: () => import("@/pages/title/details.vue"),
        meta: { title: "题目编辑", hidden: true ,fmeta: {path: '/title/index', title: '题库管理'} },
      },
      {
        path: "detail/:id",
        name: "titleDetail",
        component: () => import("@/pages/title/detail.vue"),
        meta: { title: "题目详情", hidden: true ,fmeta: {path: '/title/index', title: '题库管理'} },
      }
    ],
  },
  {
    path: "/marketing",
    component: Layout,
    redirect: "/marketing/index",
    name: "marketing",
    meta: { title: "运营活动", icon: '&#xe60d;' },
    children: [
      {
        path: "index",
        name: "marketing",
        component: () => import("@/pages/marketing/index.vue"),
        meta: { title: "活动列表" },
      },
      {
        path: "add/:id",
        name: "add",
        component: () => import("@/pages/marketing/add.vue"),
        meta: { title: "创建与编辑", hidden: true ,fmeta: {path: '/marketing/index', title: '活动列表'} },
      },
      {
        path: "details/:id",
        name: "details",
        component: () => import("@/pages/marketing/details.vue"),
        meta: { title: "活动详情", hidden: true ,fmeta: {path: '/marketing/index', title: '活动列表'} },
      },
    ],
  },
  {
    path: "/interactive",
    component: Layout,
    redirect: "/interactive/index",
    name: "interactive",
    meta: { title: "学习互动", icon: '&#xe60e;' },
    children: [
      {
        path: "index",
        name: "interactive",
        component: () => import("@/pages/interactive/index.vue"),
        meta: { title: "学习问答" },
      },
      {
        path: "details/:id",
        name: "answersDetails",
        component: () => import("@/pages/interactive/details.vue"),
        meta: { title: "问题详情", hidden: true ,fmeta: {path: '/interactive/index', title: '学习问答'} },
      },
      {
        path: "replies",
        name: "repliesDetails",
        component: () => import("@/pages/interactive/commentDetails.vue"),
        meta: { title: "回答详情", hidden: true ,fmeta: {path: '/interactive/index', title: '学习问答'} },
      },
      {
        path: "note",
        name: "note",
        component: () => import("@/pages/note/index.vue"),
        meta: { title: "笔记管理" },
      },
      {
        path: "noteDetails/:id",
        name: "noteDetails",
        component: () => import("@/pages/note/details.vue"),
        meta: { title: "笔记详情", hidden: true ,fmeta: {path: '/note/index', title: '笔记管理'} },
      },
    ],
  },
  {
    path: "/user",
    component: Layout,
    redirect: "/user/index",
    name: "user",
    meta: { title: "用户管理", icon: '&#xe610;' },
    children: [
      {
        path: "index",
        name: "student",
        component: () => import("@/pages/userlist/student/index.vue"),
        meta: { title: "学员管理" },
      },
      {
        path: "teacher",
        name: "teacher",
        component: () => import("@/pages/userlist/teacher/index.vue"),
        meta: { title: "教师管理" },
      },
      {
        path: "users",
        name: "users",
        component: () => import("@/pages/userlist/user/index.vue"),
        meta: { title: "管理账号" },
      },
    ],
  },
  {
    path: "/order",
    component: Layout,
    redirect: "/order/index",
    name: "order",
    meta: { title: "订单管理", icon: '&#xe611;' },
    children: [
      {
        path: "index",
        name: "order",
        component: () => import("@/pages/order/index.vue"),
        meta: { title: "订单管理" },
      },
      {
        path: "refund",
        name: "refund",
        component: () => import("@/pages/refund/index.vue"),
        meta: { title: "退款管理" },
      },
      {
        path: "details/:id",
        name: "orderDetails",
        component: () => import("@/pages/order/details.vue"),
        meta: { title: "订单详情", hidden: true ,fmeta: {path: '/order/index', title: '订单管理'} },
      },
      {
        path: "refundDetails/:id",
        name: "refundDetails",
        component: () => import("@/pages/refund/details.vue"),
        meta: { title: "退款详情", hidden: true ,fmeta: {path: '/order/refund', title: '退款管理'} },
      },
    ],
  },
  {
    path: "/resource",
    component: Layout,
    redirect: "/resource/generation",
    name: "resource",
    meta: { title: "AI资源中心", icon: '&#xe612;' },
    children: [
      {
        path: "generation",
        name: "resourceGeneration",
        component: () => import("@/pages/resource/generation/index.vue"),
        meta: { title: "资源生成工坊" },
      },
      {
        path: "management",
        name: "resourceManagement",
        component: () => import("@/pages/resource/management/index.vue"),
        meta: { title: "资源管理" },
      },
      {
        path: "favorites",
        name: "resourceFavorites",
        component: () => import("@/pages/resource/favorites/index.vue"),
        meta: { title: "收藏夹" },
      },
      {
        path: "detail/:id",
        name: "resourceDetail",
        component: () => import("@/pages/resource/detail/index.vue"),
        meta: { title: "资源详情", hidden: true, fmeta: {path: '/resource/management', title: '资源管理'} },
      },
    ],
  },
  {
    path: "/learning-profile",
    component: Layout,
    redirect: "/learning-profile/index",
    name: "learningProfile",
    meta: { title: "学习画像", icon: '&#xe60f;' },
    children: [
      {
        path: "index",
        name: "learningProfileIndex",
        component: () => import("@/pages/learning-profile/index.vue"),
        meta: { title: "对话式画像" },
      },
    ],
  },
  {
    path: "/my",
    component: Layout,
    redirect: "/my/index",
    name: "my",
    meta: { title: "个人中心", icon: '&#xe611;', hidden: true  },
    children: [
      {
        path: "index",
        name: "my",
        component: () => import("@/pages/my/index.vue"),
        meta: { title: "个人中心", hidden: true  },
      }
    ],
  },
  {
    path: "/result",
    name: "result",
    component: Layout,
    redirect: "/result/success",
    meta: { title: "结果页", icon: orderIcon, hidden: true },
    children: [
      // {
      //   path: 'success',
      //   name: 'ResultSuccess',
      //   component: () => import('@/pages/result/success/index.vue'),
      //   meta: { title: '成功页' },
      // },
      // {
      //   path: 'fail',
      //   name: 'ResultFail',
      //   component: () => import('@/pages/result/fail/index.vue'),
      //   meta: { title: '失败页' },
      // },
      // {
      //   path: 'network-error',
      //   name: 'ResultNetworkError',
      //   component: () => import('@/pages/result/network-error/index.vue'),
      //   meta: { title: '网络异常' },
      // },
      // {
      //   path: '403',
      //   name: 'Result403',
      //   component: () => import('@/pages/result/403/index.vue'),
      //   meta: { title: '无权限' },
      // },
      {
        path: "404",
        name: "Result404",
        component: () => import("@/pages/result/404/index.vue"),
        meta: { title: "页面不存在" },
      },
      // {
      //   path: '500',
      //   name: 'Result500',
      //   component: () => import('@/pages/result/500/index.vue'),
      //   meta: { title: '服务器出错页' },
      // },
      // {
      //   path: 'browser-incompatible',
      //   name: 'ResultBrowserIncompatible',
      //   component: () => import('@/pages/result/browser-incompatible/index.vue'),
      //   meta: { title: '浏览器不兼容页' },
      // },
      // {
      //   path: 'maintenance',
      //   name: 'ResultMaintenance',
      //   component: () => import('@/pages/result/maintenance/index.vue'),
      //   meta: { title: '系统维护页' },
      // },
    ],
  },
]
