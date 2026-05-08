import { DEMO_LOGIN, getDemoUserInfo } from "@/config/demo-user";
import { TOKEN_NAME } from "@/config/global";
import banner1 from "@/assets/banner1.jpg";
import banner2 from "@/assets/banner2.jpg";
import banner3 from "@/assets/banner3.jpg";

const now = "2026-05-07 11:30:00";

const recoverMojibake = (value) => {
  if (typeof value !== "string") {
    return value;
  }
  if (!/[^\u0000-\u00ff]/.test(value)) {
    return value;
  }
  try {
    return decodeURIComponent(
      Array.from(value)
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
  } catch (error) {
    return value;
  }
};

const normalizeDemoEntity = (value) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      value[index] = normalizeDemoEntity(item);
    });
    return value;
  }
  if (value instanceof Set) {
    return new Set(Array.from(value).map((item) => normalizeDemoEntity(item)));
  }
  if (value && typeof value === "object") {
    Object.keys(value).forEach((key) => {
      value[key] = normalizeDemoEntity(value[key]);
    });
    return value;
  }
  return recoverMojibake(value);
};

export const isPortalDemoMode = () =>
  sessionStorage.getItem(TOKEN_NAME) === DEMO_LOGIN.token;

const clone = (value) => normalizeDemoEntity(JSON.parse(JSON.stringify(value)));

const createCourse = ({
  id,
  name,
  coverUrl,
  price,
  sold,
  sections,
  teacher,
  teacherName = teacher,
  summary,
  categoryPath,
  level = "进阶",
  validDuration = 12,
  score = 49,
  intro = [],
  usePeople = "",
  detail = "",
  chapters = [],
  teachers = [],
}) => ({
  id,
  name,
  coverUrl,
  price,
  sold,
  sections,
  teacher,
  teacherName,
  summary,
  categoryPath,
  level,
  validDuration,
  score,
  intro,
  usePeople,
  detail,
  chapters,
  teachers,
});

const courseCatalog101 = [
  {
    id: 10101,
    name: "第一章 项目定位与赛题拆解",
    mediaDuration: 1800,
    sections: [
      {
        id: "1010101",
        index: 1,
        name: "A3 赛题目标与系统边界",
        type: 2,
        mediaDuration: 480,
        trailer: true,
        moment: 120,
        subjectNum: 0,
      },
      {
        id: "1010102",
        index: 2,
        name: "学习路径规划与个性化推荐",
        type: 2,
        mediaDuration: 600,
        trailer: false,
        moment: 180,
        subjectNum: 2,
      },
      {
        id: "1010103",
        index: 3,
        name: "章节练习：需求梳理",
        type: 3,
        mediaDuration: 0,
        trailer: false,
        moment: 0,
        subjectNum: 2,
      },
    ],
  },
  {
    id: 10102,
    name: "第二章 智能体编排与知识库",
    mediaDuration: 2100,
    sections: [
      {
        id: "1010201",
        index: 1,
        name: "多智能体协作流程设计",
        type: 2,
        mediaDuration: 720,
        trailer: false,
        moment: 0,
        subjectNum: 1,
      },
      {
        id: "1010202",
        index: 2,
        name: "向量检索与知识库接入",
        type: 2,
        mediaDuration: 780,
        trailer: false,
        moment: 0,
        subjectNum: 0,
      },
      {
        id: "1010203",
        index: 3,
        name: "阶段测试：学习陪练链路",
        type: 3,
        mediaDuration: 0,
        trailer: false,
        moment: 0,
        subjectNum: 3,
      },
    ],
  },
  {
    id: 10103,
    name: "第三章 演示环境与答辩准备",
    mediaDuration: 1800,
    sections: [
      {
        id: "1010301",
        index: 1,
        name: "前后端演示兜底方案",
        type: 2,
        mediaDuration: 540,
        trailer: false,
        moment: 0,
        subjectNum: 1,
      },
      {
        id: "1010302",
        index: 2,
        name: "项目验收讲解脚本",
        type: 2,
        mediaDuration: 660,
        trailer: false,
        moment: 0,
        subjectNum: 0,
      },
      {
        id: "1010303",
        index: 3,
        name: "综合练习：答辩演示",
        type: 3,
        mediaDuration: 0,
        trailer: false,
        moment: 0,
        subjectNum: 2,
      },
    ],
  },
];

const courseCatalog102 = [
  {
    id: 10201,
    name: "第一章 微服务基础",
    mediaDuration: 1500,
    sections: [
      {
        id: "1020101",
        index: 1,
        name: "服务拆分原则",
        type: 2,
        mediaDuration: 480,
        trailer: true,
        moment: 0,
        subjectNum: 0,
      },
      {
        id: "1020102",
        index: 2,
        name: "注册中心与配置中心",
        type: 2,
        mediaDuration: 620,
        trailer: false,
        moment: 0,
        subjectNum: 1,
      },
    ],
  },
  {
    id: 10202,
    name: "第二章 网关与安全",
    mediaDuration: 1680,
    sections: [
      {
        id: "1020201",
        index: 1,
        name: "统一网关接入",
        type: 2,
        mediaDuration: 540,
        trailer: false,
        moment: 0,
        subjectNum: 0,
      },
      {
        id: "1020202",
        index: 2,
        name: "认证授权实战",
        type: 3,
        mediaDuration: 0,
        trailer: false,
        moment: 0,
        subjectNum: 2,
      },
    ],
  },
];

const courseCatalog201 = [
  {
    id: 20101,
    name: "第一章 Vue 3 工程起步",
    mediaDuration: 1380,
    sections: [
      {
        id: "2010101",
        index: 1,
        name: "项目初始化与目录设计",
        type: 2,
        mediaDuration: 420,
        trailer: true,
        moment: 0,
        subjectNum: 1,
      },
      {
        id: "2010102",
        index: 2,
        name: "路由与状态管理",
        type: 2,
        mediaDuration: 600,
        trailer: false,
        moment: 0,
        subjectNum: 0,
      },
    ],
  },
  {
    id: 20102,
    name: "第二章 页面演示与接口解耦",
    mediaDuration: 1560,
    sections: [
      {
        id: "2010201",
        index: 1,
        name: "前端演示态设计",
        type: 2,
        mediaDuration: 540,
        trailer: false,
        moment: 0,
        subjectNum: 2,
      },
      {
        id: "2010202",
        index: 2,
        name: "综合练习：页面可验收化",
        type: 3,
        mediaDuration: 0,
        trailer: false,
        moment: 0,
        subjectNum: 2,
      },
    ],
  },
];

const courseCatalog301 = [
  {
    id: 30101,
    name: "第一章 大模型应用导论",
    mediaDuration: 1440,
    sections: [
      {
        id: "3010101",
        index: 1,
        name: "Prompt 工程基础",
        type: 2,
        mediaDuration: 480,
        trailer: true,
        moment: 0,
        subjectNum: 1,
      },
      {
        id: "3010102",
        index: 2,
        name: "工具调用与代理模式",
        type: 2,
        mediaDuration: 540,
        trailer: false,
        moment: 0,
        subjectNum: 1,
      },
    ],
  },
];

const courseCatalog302 = [
  {
    id: 30201,
    name: "第一章 赛题分析",
    mediaDuration: 1200,
    sections: [
      {
        id: "3020101",
        index: 1,
        name: "赛题约束与评分点",
        type: 2,
        mediaDuration: 420,
        trailer: true,
        moment: 0,
        subjectNum: 0,
      },
      {
        id: "3020102",
        index: 2,
        name: "演示方案设计",
        type: 3,
        mediaDuration: 0,
        trailer: false,
        moment: 0,
        subjectNum: 2,
      },
    ],
  },
];

const demoCourses = [
  createCourse({
    id: 101,
    name: "A3 智能学习助手实战",
    coverUrl: banner1,
    price: 0,
    sold: 1260,
    sections: 24,
    teacher: "A3 教学团队",
    summary: "围绕软挑赛题，完成学习推荐、课程学习与演示链路落地。",
    categoryPath: "人工智能/学习助手/实战训练",
    validDuration: 99,
    intro: [
      "从赛题目标出发，拆解产品、技术、演示三条主线。",
      "覆盖课程推荐、学习记录、前端演示态和答辩准备。",
    ],
    usePeople: "适合参加软挑、需要快速完成课程学习平台演示与答辩闭环的项目团队。",
    detail: "课程围绕 A3 智能学习助手赛题展开，覆盖课程推荐、学习路径、练习互动、前端演示兜底与最终答辩讲解，重点帮助团队在有限时间内完成可展示、可验收、可讲述的作品闭环。",
    teachers: [
      {
        id: 1,
        name: "刘老师",
        role: "项目导师",
        job: "项目导师",
        intro: "负责赛题分析与系统架构设计。",
        introduce: "负责赛题分析与系统架构设计。",
        icon: banner1,
        isShow: true,
      },
      {
        id: 2,
        name: "陈老师",
        role: "前端导师",
        job: "前端导师",
        intro: "负责演示链路设计与前端体验优化。",
        introduce: "负责演示链路设计与前端体验优化。",
        icon: banner2,
        isShow: true,
      },
    ],
    chapters: courseCatalog101,
  }),
  createCourse({
    id: 102,
    name: "Spring Cloud 微服务训练营",
    coverUrl: banner2,
    price: 19900,
    sold: 860,
    sections: 32,
    teacher: "平台研发组",
    summary: "夯实网关、注册中心、服务调用等后端基础能力。",
    categoryPath: "后端开发/Java 微服务/Spring Cloud",
    intro: ["偏后端实战，适合作为 A3 平台底座能力补齐课程。"],
    usePeople: "适合准备补齐网关、鉴权、课程学习链路后端能力的开发同学。",
    detail: "从服务拆分、配置中心到网关与认证授权，帮助项目在演示模式稳定后逐步回到真实后端联调。",
    teachers: [
      {
        id: 3,
        name: "吴老师",
        role: "架构师",
        job: "架构师",
        intro: "专注微服务治理与高并发系统设计。",
        introduce: "专注微服务治理与高并发系统设计。",
        icon: banner2,
        isShow: true,
      },
    ],
    chapters: courseCatalog102,
  }),
  createCourse({
    id: 201,
    name: "Vue 3 项目工程化落地",
    coverUrl: banner3,
    price: 9900,
    sold: 740,
    sections: 18,
    teacher: "前端架构组",
    summary: "聚焦工程化、演示态、组件拆分与前后端解耦。",
    categoryPath: "前端开发/Vue 3/工程化",
    intro: ["适合当前 A3 portal 和 admin 的接入、改造与演示验收。"],
    usePeople: "适合负责前端接入、赛题化改造、视觉清洗和页面验收的同学。",
    detail: "课程强调如何在真实后端尚未完全稳定时，先通过演示数据、状态兜底和路由链路补齐前端验收闭环。",
    teachers: [
      {
        id: 4,
        name: "周老师",
        role: "前端负责人",
        job: "前端负责人",
        intro: "专注 Vue 工程体系与交互体验设计。",
        introduce: "专注 Vue 工程体系与交互体验设计。",
        icon: banner3,
        isShow: true,
      },
    ],
    chapters: courseCatalog201,
  }),
  createCourse({
    id: 301,
    name: "大模型应用开发导论",
    coverUrl: banner2,
    price: 12900,
    sold: 680,
    sections: 20,
    teacher: "A3 AI 实验室",
    summary: "介绍提示工程、工具调用、智能体编排等基础能力。",
    categoryPath: "人工智能/大模型/应用开发",
    intro: ["作为智能体类课程的入门补充。"],
    usePeople: "适合第一次接触大模型应用开发、需要快速建立产品理解的团队成员。",
    detail: "从 Prompt 到工具调用，帮助项目成员理解智能体应用的基本构成与交互模式。",
    teachers: [
      {
        id: 5,
        name: "李老师",
        role: "AI 讲师",
        job: "AI 讲师",
        intro: "负责大模型应用开发与实践指导。",
        introduce: "负责大模型应用开发与实践指导。",
        icon: banner2,
        isShow: true,
      },
    ],
    chapters: courseCatalog301,
  }),
  createCourse({
    id: 302,
    name: "软挑赛题项目实训",
    coverUrl: banner3,
    price: 0,
    sold: 1500,
    sections: 28,
    teacher: "竞赛辅导组",
    summary: "聚焦软挑项目的讲解、组织与演示落地。",
    categoryPath: "竞赛实训/项目实战/软挑备赛",
    validDuration: 99,
    intro: ["适合赛题验收前的总复盘与展示彩排。"],
    usePeople: "适合临近交付、需要快速梳理答辩故事线和演示动作的团队。",
    detail: "通过赛题分析、演示脚本、答辩准备和验收关注点拆解，帮助团队把技术实现转成清晰可展示的作品表达。",
    teachers: [
      {
        id: 6,
        name: "何老师",
        role: "竞赛顾问",
        job: "竞赛顾问",
        intro: "负责赛事答辩与作品呈现指导。",
        introduce: "负责赛事答辩与作品呈现指导。",
        icon: banner3,
        isShow: true,
      },
    ],
    chapters: courseCatalog302,
  }),
];

const courseMap = Object.fromEntries(demoCourses.map((item) => [item.id, item]));
const sectionToCourseMap = {};
const sectionChapterMap = {};
demoCourses.forEach((course) => {
  course.chapters.forEach((chapter) => {
    chapter.sections.forEach((section) => {
      sectionToCourseMap[section.id] = course.id;
      sectionChapterMap[section.id] = chapter.id;
    });
  });
});

const normalizeCourseCard = (course) => ({
  id: course.id,
  name: course.name,
  coverUrl: course.coverUrl,
  price: course.price,
  sold: course.sold,
  sections: course.sections,
  teacher: course.teacher,
  teacherName: course.teacherName,
  summary: course.summary,
});

export const demoCategories = [
  {
    id: 1,
    name: "人工智能",
    children: [
      { id: 11, name: "机器学习" },
      { id: 12, name: "大模型应用" },
    ],
  },
  {
    id: 2,
    name: "后端开发",
    children: [
      { id: 21, name: "Java 微服务" },
      { id: 22, name: "Spring Cloud" },
    ],
  },
  {
    id: 3,
    name: "前端开发",
    children: [
      { id: 31, name: "Vue 3" },
      { id: 32, name: "工程化" },
    ],
  },
];

export const demoInterests = new Set(["人工智能", "Java 微服务", "Vue 3"]);

export const demoRecommendCourses = {
  free: [normalizeCourseCard(courseMap[101]), normalizeCourseCard(courseMap[302])],
  best: [normalizeCourseCard(courseMap[201]), normalizeCourseCard(courseMap[102])],
  new: [normalizeCourseCard(courseMap[301]), normalizeCourseCard(courseMap[101])],
};

const createLesson = ({
  courseId,
  createTime,
  learnedSections,
  latestSectionId,
  latestSectionName,
  latestSectionIndex,
  status = 1,
  planStatus = 1,
  weekFreq = 4,
}) => {
  const course = courseMap[courseId];
  return {
    courseId,
    courseName: course.name,
    courseCoverUrl: course.coverUrl,
    createTime,
    expireTime: null,
    learnedSections,
    sections: course.sections,
    latestSectionId,
    latestSectionIndex,
    latestSectionName,
    status,
    planStatus,
    weekFreq,
    lessonId: 8000 + courseId,
  };
};

let demoLessonList = [
  createLesson({
    courseId: 101,
    createTime: "2026-04-01 09:00:00",
    learnedSections: 8,
    latestSectionId: "1010102",
    latestSectionIndex: 2,
    latestSectionName: "学习路径规划与个性化推荐",
    weekFreq: 4,
  }),
  createLesson({
    courseId: 102,
    createTime: "2026-03-15 09:00:00",
    learnedSections: 24,
    latestSectionId: "1020202",
    latestSectionIndex: 4,
    latestSectionName: "认证授权实战",
    status: 2,
    weekFreq: 3,
  }),
  createLesson({
    courseId: 201,
    createTime: "2026-05-01 09:00:00",
    learnedSections: 0,
    latestSectionId: "2010101",
    latestSectionIndex: 1,
    latestSectionName: "项目初始化与目录设计",
    status: 0,
    planStatus: 0,
    weekFreq: 2,
  }),
];

let demoPlanList = [
  {
    courseId: 101,
    courseName: courseMap[101].name,
    weekLearnedSections: 2,
    weekFreq: 4,
    learnedSections: 8,
    sections: courseMap[101].sections,
    latestLearnTime: now,
  },
  {
    courseId: 102,
    courseName: courseMap[102].name,
    weekLearnedSections: 3,
    weekFreq: 3,
    learnedSections: 24,
    sections: courseMap[102].sections,
    latestLearnTime: "2026-05-06 19:45:00",
  },
];

const demoExamList = [
  {
    id: 9001,
    courseId: 101,
    courseName: courseMap[101].name,
    sectionName: "学习路径规划与个性化推荐",
    commitTime: "2026-05-06 20:10:00",
    type: 1,
    score: 92,
  },
  {
    id: 9002,
    courseId: 201,
    courseName: courseMap[201].name,
    sectionName: "项目初始化与目录设计",
    commitTime: "2026-05-05 18:00:00",
    type: 0,
    score: 88,
  },
];

let demoCouponList = [
  {
    id: 7001,
    name: "A3 新用户体验券",
    discountType: 4,
    discountValue: 2000,
    thresholdAmount: 10000,
    maxDiscountAmount: 2000,
    specific: false,
    termDays: 30,
    status: 1,
  },
  {
    id: 7002,
    name: "智能专题课折扣券",
    discountType: 2,
    discountValue: 85,
    thresholdAmount: 0,
    maxDiscountAmount: 5000,
    specific: true,
    termEndTime: "2026-06-30 23:59:59",
    status: 2,
  },
  {
    id: 7003,
    name: "春季训练营抵扣券",
    discountType: 3,
    discountValue: 1500,
    thresholdAmount: 0,
    maxDiscountAmount: 1500,
    specific: false,
    termEndTime: "2026-04-30 23:59:59",
    status: 3,
  },
];

let demoOrderList = [
  {
    id: 5001001,
    createTime: "2026-05-06 10:00:00",
    totalAmount: 19900,
    realAmount: 17900,
    status: 2,
    details: [
      {
        courseId: 102,
        name: courseMap[102].name,
        coverUrl: courseMap[102].coverUrl,
        price: 19900,
        refundStatus: 0,
      },
    ],
  },
  {
    id: 5001002,
    createTime: "2026-05-02 14:30:00",
    totalAmount: 9900,
    realAmount: 9900,
    status: 1,
    details: [
      {
        courseId: 201,
        name: courseMap[201].name,
        coverUrl: courseMap[201].coverUrl,
        price: 9900,
        refundStatus: 0,
      },
    ],
  },
  {
    id: 5001003,
    createTime: "2026-04-20 09:15:00",
    totalAmount: 0,
    realAmount: 0,
    status: 5,
    details: [
      {
        courseId: 101,
        name: courseMap[101].name,
        coverUrl: courseMap[101].coverUrl,
        price: 0,
        refundStatus: 0,
      },
    ],
  },
];

let demoTodayPoints = [
  { type: "课程学习", points: 30 },
  { type: "每日签到", points: 2 },
  { type: "课程问答", points: 10 },
  { type: "课程笔记", points: 8 },
  { type: "课程评价", points: 0 },
];

let demoSignRecords = Array.from({ length: 31 }, (_, index) =>
  index < 7 ? 1 : 0,
);

const demoBoardData = {
  rank: 6,
  points: 128,
  boardList: [
    { name: "张同学", points: 188 },
    { name: "李同学", points: 176 },
    { name: "王同学", points: 160 },
    { name: "赵同学", points: 152 },
    { name: "陈同学", points: 140 },
  ],
};

const demoSeasons = [
  { id: 1, name: "2026 春季赛季" },
  { id: 2, name: "2026 冬季赛季" },
  { id: 3, name: "2025 秋季赛季" },
];

let demoQuestions = [
  {
    id: 11001,
    courseId: 101,
    sectionId: "1010102",
    title: "个性化推荐里的标签体系怎么拆分更合理？",
    description: "如果既要做兴趣推荐又要做学习阶段推荐，标签分层建议怎么设计？",
    userId: DEMO_LOGIN.userInfo.id,
    userName: "A3验收用户",
    userIcon: DEMO_LOGIN.userInfo.icon,
    answerTimes: 2,
    createTime: "2026-05-07 10:20:00",
    latestAnswer: {
      content: "先拆静态标签，再加行为标签。",
      replier: { name: "刘老师" },
    },
  },
  {
    id: 11002,
    courseId: 101,
    sectionId: "1010201",
    title: "多智能体编排一定要引入工作流引擎吗？",
    description: "如果先做比赛演示，是不是可以先用简单状态机代替？",
    userId: 2,
    userName: "陈同学",
    userIcon: banner2,
    answerTimes: 1,
    createTime: "2026-05-06 18:40:00",
    latestAnswer: {
      content: "可以，先保证链路闭环更重要。",
      replier: { name: "陈老师" },
    },
  },
];

let demoNotes = [
  {
    id: 21001,
    courseId: 101,
    chapterId: 10101,
    sectionId: "1010102",
    authorId: DEMO_LOGIN.userInfo.id,
    authorName: "A3验收用户",
    authorIcon: DEMO_LOGIN.userInfo.icon,
    content: "推荐链路先做演示兜底，再逐步替换为真实接口，可以明显降低联调阻塞。",
    noteMoment: 185,
    createTime: "2026-05-07 10:55:00",
    isPrivate: false,
    isGathered: false,
    liked: false,
    likedTimes: 3,
  },
  {
    id: 21002,
    courseId: 101,
    chapterId: 10102,
    sectionId: "1010201",
    authorId: 2,
    authorName: "陈同学",
    authorIcon: banner2,
    content: "章节目录、练习、问答、笔记最好都支持本地演示态，不然答辩时容易空白。",
    noteMoment: 96,
    createTime: "2026-05-06 20:10:00",
    isPrivate: false,
    isGathered: true,
    liked: true,
    likedTimes: 5,
  },
];

const demoSubjects = {
  "1010103": {
    id: 31001,
    questions: [
      {
        id: 1,
        type: 1,
        name: "赛题演示阶段，当前最优先保证的目标是什么？",
        options: ["把所有后端服务都完全联通", "让页面和交互先可稳定验收", "先做数据库性能压测", "先做多租户改造"],
        answer: ["2"],
      },
      {
        id: 2,
        type: 2,
        name: "前端演示兜底通常应覆盖哪些部分？",
        options: ["搜索结果", "课程详情", "学习目录", "仅保留登录页"],
        answer: ["1", "2", "3"],
      },
    ],
  },
  "1010203": {
    id: 31002,
    questions: [
      {
        id: 3,
        type: 1,
        name: "多智能体编排的首要验收重点更偏向哪一项？",
        options: ["能否展示清晰链路", "使用了最多模型", "界面颜色是否炫酷", "日志是否完全无输出"],
        answer: ["1"],
      },
      {
        id: 4,
        type: 4,
        name: "演示模式下可以先不强依赖真实视频签名播放。",
        answer: true,
      },
      {
        id: 5,
        type: 5,
        name: "请简述你会如何拆分“前端问题”和“后端联调问题”。",
        answer: [],
      },
    ],
  },
  "2010202": {
    id: 31003,
    questions: [
      {
        id: 6,
        type: 1,
        name: "如果页面因为接口失败频繁空白，优先应做什么？",
        options: ["继续增加超时时间", "增加前端降级与演示数据", "删除整个页面", "只保留控制台日志"],
        answer: ["2"],
      },
      {
        id: 7,
        type: 2,
        name: "前端赛题化通常包括哪些方向？",
        options: ["名称与品牌替换", "演示链路补齐", "去原项目化素材", "随机改端口"],
        answer: ["1", "2", "3"],
      },
    ],
  },
  default: {
    id: 39999,
    questions: [
      {
        id: 99,
        type: 1,
        name: "当前页面使用的是哪种模式？",
        options: ["真实联调模式", "本地演示模式", "离线打包模式", "压测模式"],
        answer: ["2"],
      },
    ],
  },
};

[
  demoCourses,
  demoCategories,
  demoRecommendCourses,
  demoLessonList,
  demoPlanList,
  demoExamList,
  demoCouponList,
  demoOrderList,
  demoTodayPoints,
  demoSignRecords,
  demoBoardData,
  demoSeasons,
  demoQuestions,
  demoNotes,
  demoSubjects,
].forEach((item) => normalizeDemoEntity(item));

const findLesson = (courseId) =>
  demoLessonList.find((item) => Number(item.courseId) === Number(courseId));

const ensureLesson = (courseId) => {
  let lesson = findLesson(courseId);
  if (lesson) {
    return lesson;
  }
  const course = courseMap[courseId];
  const firstSection = course.chapters[0]?.sections[0];
  lesson = createLesson({
    courseId,
    createTime: now,
    learnedSections: 0,
    latestSectionId: firstSection?.id || "",
    latestSectionIndex: 1,
    latestSectionName: firstSection?.name || "课程开始",
    status: 0,
    planStatus: 0,
    weekFreq: 2,
  });
  demoLessonList = [lesson, ...demoLessonList];
  return lesson;
};

const updateLessonFromSection = (courseId, sectionId, moment = 0) => {
  const lesson = ensureLesson(courseId);
  const course = courseMap[courseId];
  const section = course.chapters
    .flatMap((chapter) => chapter.sections)
    .find((item) => item.id === sectionId);
  if (!section) {
    return lesson;
  }
  lesson.latestSectionId = section.id;
  lesson.latestSectionName = section.name;
  lesson.latestSectionIndex = section.index;
  lesson.status = 1;
  lesson.lastMoment = moment;
  const targetPlan = demoPlanList.find(
    (item) => Number(item.courseId) === Number(courseId),
  );
  if (targetPlan) {
    targetPlan.latestLearnTime = now;
  }
  return lesson;
};

const courseMatchesKeyword = (course, keyword) => {
  if (!keyword) {
    return true;
  }
  return [course.name, course.summary, course.teacher]
    .filter(Boolean)
    .some((text) => text.toLowerCase().includes(String(keyword).toLowerCase()));
};

const courseMatchesFilters = (course, params = {}) => {
  if (!courseMatchesKeyword(course, params.keyword)) {
    return false;
  }
  if (params.free !== undefined) {
    const isFree = Number(course.price) === 0;
    if (Boolean(params.free) !== isFree) {
      return false;
    }
  }
  if (params.categoryIdLv1 && Number(params.categoryIdLv1) !== 1 && Number(params.categoryIdLv1) !== 2 && Number(params.categoryIdLv1) !== 3) {
    return false;
  }
  return true;
};

export const getDemoCurrentLesson = () => ({ ...demoLessonList[0] });

export const getDemoLessonsPage = () => ({
  list: demoLessonList.map((item) => ({ ...item })),
  total: demoLessonList.length,
});

export const getDemoPlans = () => ({
  list: demoPlanList.map((item) => ({ ...item })),
  total: demoPlanList.length,
  weekFinished: demoPlanList.reduce(
    (sum, item) => sum + item.weekLearnedSections,
    0,
  ),
  weekPoints: demoPlanList.reduce(
    (sum, item) => sum + item.weekLearnedSections * 10,
    0,
  ),
  weekTotalPlan: demoPlanList.reduce((sum, item) => sum + item.weekFreq, 0),
});

export const getDemoSearchPage = ({
  keyword = "",
  sortBy,
  pageNo = 1,
  pageSize = 12,
  ...rest
} = {}) => {
  let list = demoCourses
    .filter((course) => courseMatchesFilters(course, { keyword, ...rest }))
    .map(normalizeCourseCard);
  if (sortBy === "publishTime") {
    list = list.sort((a, b) => b.id - a.id);
  } else if (sortBy === "sold") {
    list = list.sort((a, b) => b.sold - a.sold);
  }
  const start = (pageNo - 1) * pageSize;
  return {
    list: list.slice(start, start + pageSize),
    total: list.length,
  };
};

export const getDemoClassDetails = (id) => {
  const course = courseMap[id];
  if (!course) {
    return null;
  }
  return {
    id: course.id,
    name: course.name,
    coverUrl: course.coverUrl,
    price: course.price,
    cataTotalNum: course.sections,
    validDuration: course.validDuration,
    score: course.score,
    cateNames: course.categoryPath,
    teacherName: course.teacherName,
    summary: course.summary,
    intro: clone(course.intro),
    introduce: Array.isArray(course.intro) ? course.intro.join(" ") : course.intro,
    usePeople: course.usePeople,
    detail: course.detail,
  };
};

export const getDemoClassTeachers = (id) => clone(courseMap[id]?.teachers || []);

export const getDemoClassCatalog = (id) => clone(courseMap[id]?.chapters || []);

export const getDemoCourseLearning = (courseId) => {
  const lesson = findLesson(courseId);
  return lesson ? { ...lesson } : null;
};

export const enrollDemoCourse = (courseId) => {
  const course = courseMap[courseId];
  if (!course) {
    return false;
  }
  const lesson = ensureLesson(courseId);
  lesson.status = 1;
  lesson.planStatus = 1;
  if (!demoPlanList.find((item) => Number(item.courseId) === Number(courseId))) {
    demoPlanList = [
      ...demoPlanList,
      {
        courseId: lesson.courseId,
        courseName: lesson.courseName,
        weekLearnedSections: 0,
        weekFreq: lesson.weekFreq,
        learnedSections: lesson.learnedSections,
        sections: lesson.sections,
        latestLearnTime: now,
      },
    ];
  }
  return true;
};

export const addDemoCart = (courseId) => Boolean(courseMap[courseId]);

export const getDemoLearningDetails = (courseId) => {
  const course = courseMap[courseId];
  if (!course) {
    return null;
  }
  const lesson = ensureLesson(courseId);
  const sectionId = lesson.latestSectionId || course.chapters[0]?.sections[0]?.id;
  const targetSection = course.chapters
    .flatMap((chapter) => chapter.sections)
    .find((section) => section.id === sectionId);
  return {
    id: course.id,
    lessonId: lesson.lessonId,
    name: course.name,
    coverUrl: course.coverUrl,
    teacherName: course.teacherName,
    latestSectionId: targetSection?.id || "",
    latestSectionName: targetSection?.name || "",
    moment: lesson.lastMoment || targetSection?.moment || 0,
    chapters: clone(course.chapters).map((chapter) => ({
      ...chapter,
      sections: chapter.sections.map((section) => ({
        ...section,
        finished: lesson.learnedSections > 0 && section.id !== targetSection?.id,
      })),
    })),
  };
};

export const getDemoMediaSignature = (sectionId) => ({
  fileId: `demo-${sectionId}`,
  signature: "demo-signature",
  demo: true,
});

export const recordDemoPlayLog = ({
  lessonId,
  sectionId,
  moment = 0,
  duration = 0,
}) => {
  const courseId = sectionToCourseMap[sectionId];
  if (!courseId) {
    return false;
  }
  const lesson = updateLessonFromSection(courseId, sectionId, moment);
  if (duration && moment >= duration) {
    lesson.learnedSections = Math.max(lesson.learnedSections, lesson.latestSectionIndex);
  }
  lesson.lessonId = lessonId || lesson.lessonId;
  return true;
};

export const getDemoExamPage = ({ pageNo = 1, pageSize = 10 } = {}) => {
  const start = (pageNo - 1) * pageSize;
  const list = demoExamList.slice(start, start + pageSize);
  return {
    list,
    total: demoExamList.length,
  };
};

export const getDemoCouponPage = ({ status } = {}) => ({
  list: demoCouponList.filter((item) => !status || item.status === status),
  total: demoCouponList.filter((item) => !status || item.status === status)
    .length,
});

export const exchangeDemoCoupon = (code) => {
  demoCouponList = [
    {
      id: Date.now(),
      name: `兑换券 ${code}`,
      discountType: 4,
      discountValue: 1000,
      thresholdAmount: 5000,
      maxDiscountAmount: 1000,
      specific: false,
      termDays: 15,
      status: 1,
    },
    ...demoCouponList,
  ];
  return true;
};

export const getDemoOrderPage = ({ status, pageNo = 1, pageSize = 10 } = {}) => {
  const filtered = demoOrderList.filter((item) => !status || item.status === status);
  const start = (pageNo - 1) * pageSize;
  return {
    list: filtered.slice(start, start + pageSize),
    total: filtered.length,
  };
};

export const cancelDemoOrder = (id) => {
  const target = demoOrderList.find((item) => item.id === id);
  if (!target) {
    return false;
  }
  target.status = 3;
  return true;
};

export const deleteDemoOrder = (id) => {
  demoOrderList = demoOrderList.filter((item) => item.id !== id);
  return true;
};

export const getDemoTodayPoints = () => demoTodayPoints.map((item) => ({ ...item }));

export const signDemoPoints = () => {
  demoTodayPoints = demoTodayPoints.map((item) =>
    item.type === "每日签到" ? { ...item, points: 2 } : item,
  );
  demoSignRecords[6] = 1;
  return 2;
};

export const getDemoSignRecords = () => [...demoSignRecords];

export const getDemoBoard = () => ({ ...demoBoardData, boardList: demoBoardData.boardList.map((i) => ({ ...i })) });

export const getDemoSeasonOptions = () => demoSeasons.map((item) => ({ ...item }));

export const saveDemoPlan = ({ courseId, freq }) => {
  const lesson = ensureLesson(courseId);
  lesson.planStatus = 1;
  lesson.weekFreq = freq;
  const target = demoPlanList.find((item) => item.courseId === courseId);
  if (target) {
    target.weekFreq = freq;
    return true;
  }
  demoPlanList = [
    ...demoPlanList,
    {
      courseId: lesson.courseId,
      courseName: lesson.courseName,
      weekLearnedSections: 0,
      weekFreq: freq,
      learnedSections: lesson.learnedSections,
      sections: lesson.sections,
      latestLearnTime: now,
    },
  ];
  return true;
};

export const removeDemoLesson = (courseId) => {
  const lesson = demoLessonList.find((item) => item.courseId === courseId);
  if (!lesson) {
    return false;
  }
  lesson.status = 3;
  return true;
};

export const getDemoQuestionChapters = (courseId) =>
  clone(courseMap[courseId]?.chapters || []).flatMap((chapter) =>
    chapter.sections.map((section) => ({
      id: section.id,
      index: `${chapter.name} / ${section.name}`,
    })),
  );

export const getDemoAskPage = ({
  courseId,
  sectionId,
  onlyMine = false,
  pageNo = 1,
  pageSize = 10,
}) => {
  const currentUser = getDemoUserInfo();
  const filtered = demoQuestions.filter((item) => {
    if (courseId && Number(item.courseId) !== Number(courseId)) {
      return false;
    }
    if (sectionId && item.sectionId !== sectionId) {
      return false;
    }
    if (onlyMine && Number(item.userId) !== Number(currentUser.id)) {
      return false;
    }
    return true;
  });
  const start = (pageNo - 1) * pageSize;
  return {
    list: clone(filtered.slice(start, start + pageSize)),
    total: filtered.length,
  };
};

export const addDemoQuestion = (payload) => {
  const currentUser = getDemoUserInfo();
  demoQuestions = [
    {
      id: Date.now(),
      courseId: Number(payload.courseId),
      sectionId: payload.sectionId,
      title: payload.title,
      description: payload.description,
      userId: currentUser.id,
      userName: currentUser.name,
      userIcon: currentUser.icon,
      answerTimes: 0,
      createTime: now,
      latestAnswer: null,
    },
    ...demoQuestions,
  ];
  return true;
};

export const getDemoNotesPage = ({
  sectionId,
  courseId,
  onlyMine = false,
  pageNo = 1,
  pageSize = 10,
}) => {
  const currentUser = getDemoUserInfo();
  const filtered = demoNotes.filter((item) => {
    if (courseId && Number(item.courseId) !== Number(courseId)) {
      return false;
    }
    if (sectionId && sectionId !== "all" && item.sectionId !== sectionId) {
      return false;
    }
    if (onlyMine && Number(item.authorId) !== Number(currentUser.id)) {
      return false;
    }
    if (item.isPrivate && Number(item.authorId) !== Number(currentUser.id)) {
      return false;
    }
    return true;
  });
  const start = (pageNo - 1) * pageSize;
  return {
    list: clone(filtered.slice(start, start + pageSize)),
    total: filtered.length,
  };
};

export const addDemoNote = (payload) => {
  const currentUser = getDemoUserInfo();
  demoNotes = [
    {
      id: Date.now(),
      courseId: Number(payload.courseId),
      chapterId: payload.chapterId || sectionChapterMap[payload.sectionId],
      sectionId: payload.sectionId,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorIcon: currentUser.icon,
      content: payload.content,
      noteMoment: payload.noteMoment || 0,
      createTime: now,
      isPrivate: Boolean(payload.isPrivate),
      isGathered: false,
      liked: false,
      likedTimes: 0,
    },
    ...demoNotes,
  ];
  return true;
};

export const updateDemoNote = (payload) => {
  const target = demoNotes.find((item) => Number(item.id) === Number(payload.id));
  if (!target) {
    return false;
  }
  target.content = payload.content;
  target.isPrivate = Boolean(payload.isPrivate);
  return true;
};

export const deleteDemoNote = (id) => {
  demoNotes = demoNotes.filter((item) => Number(item.id) !== Number(id));
  return true;
};

export const gatherDemoNote = (id, gathered) => {
  const target = demoNotes.find((item) => Number(item.id) === Number(id));
  if (!target) {
    return false;
  }
  target.isGathered = gathered;
  return true;
};

export const getDemoSubject = ({ sectionId }) => {
  const subject = demoSubjects[sectionId] || demoSubjects.default;
  return {
    id: subject.id,
    questions: clone(subject.questions).map((item) => ({
      ...item,
      answers: item.type === 1 || item.type === 4 ? "" : [],
    })),
  };
};

export const submitDemoSubject = ({ id, examDetails = [] }) => ({
  id,
  result: "submitted",
  examDetails: clone(examDetails),
});

let demoCartCourseIds = [102, 201];

let demoQuestionAnswers = [
  {
    id: 210001,
    questionId: 11001,
    answerId: 210001,
    targetReplyId: "",
    targetUserId: 1,
    userId: 10,
    userName: "刘老师",
    userIcon: banner1,
    content: "建议拆成静态画像、学习行为、赛题阶段三个层次，先保证推荐解释性，再逐步增加实时特征。",
    createTime: "2026-05-07 10:35:00",
    liked: true,
    likedTimes: 6,
    replyTimes: 2,
  },
  {
    id: 210002,
    questionId: 11001,
    answerId: 210002,
    targetReplyId: "",
    targetUserId: 1,
    userId: 11,
    userName: "陈老师",
    userIcon: banner2,
    content: "如果当前重点是验收演示，可以先把标签维度控制在少量可说明的字段，避免推荐链路过重。",
    createTime: "2026-05-07 10:48:00",
    liked: false,
    likedTimes: 3,
    replyTimes: 1,
  },
  {
    id: 220001,
    questionId: 11001,
    answerId: 210001,
    targetReplyId: 210001,
    targetUserId: 10,
    targetUserName: "刘老师",
    userId: 1,
    userName: "A3演示用户",
    userIcon: DEMO_LOGIN.userInfo.icon,
    content: "明白了，我会先把用户画像和学习阶段拆开，先保证讲解时能说清楚。",
    createTime: "2026-05-07 10:42:00",
    liked: false,
    likedTimes: 1,
    replyTimes: 0,
  },
  {
    id: 220002,
    questionId: 11001,
    answerId: 210001,
    targetReplyId: 220001,
    targetUserId: 1,
    targetUserName: "A3演示用户",
    userId: 10,
    userName: "刘老师",
    userIcon: banner1,
    content: "对，先做到可解释、可演示，再决定是否补更细的实时权重。",
    createTime: "2026-05-07 10:46:00",
    liked: false,
    likedTimes: 2,
    replyTimes: 0,
  },
  {
    id: 220003,
    questionId: 11001,
    answerId: 210002,
    targetReplyId: 210002,
    targetUserId: 11,
    targetUserName: "陈老师",
    userId: 2,
    userName: "项目同学",
    userIcon: banner3,
    content: "这个思路适合我们当前阶段，先把展示链路跑顺。",
    createTime: "2026-05-07 10:55:00",
    liked: true,
    likedTimes: 2,
    replyTimes: 0,
  },
  {
    id: 210003,
    questionId: 11002,
    answerId: 210003,
    targetReplyId: "",
    targetUserId: 2,
    userId: 11,
    userName: "陈老师",
    userIcon: banner2,
    content: "可以，答辩前先用简单状态机保证多角色链路能顺畅演示，再逐步演进成工作流引擎。",
    createTime: "2026-05-06 19:05:00",
    liked: true,
    likedTimes: 5,
    replyTimes: 0,
  },
];

let demoPendingOrders = [];

const paginateDemoList = (list, pageNo = 1, pageSize = 10) => {
  const start = (Number(pageNo) - 1) * Number(pageSize);
  return {
    list: clone(list.slice(start, start + Number(pageSize))),
    total: list.length,
  };
};

const syncDemoQuestionMeta = (questionId) => {
  const target = demoQuestions.find((item) => Number(item.id) === Number(questionId));
  if (!target) {
    return;
  }
  const answers = demoQuestionAnswers.filter(
    (item) => Number(item.questionId) === Number(questionId) && Number(item.id) === Number(item.answerId),
  );
  target.answerTimes = answers.length;
  const latest = [...demoQuestionAnswers]
    .filter((item) => Number(item.questionId) === Number(questionId))
    .sort((a, b) => String(a.createTime).localeCompare(String(b.createTime)));
  const latestItem = latest.at(-1);
  target.latestAnswer = latestItem
    ? {
        content: latestItem.content,
        replier: { name: latestItem.userName },
      }
    : null;
};

export const getDemoQuestionDetails = (id) => {
  const question = demoQuestions.find((item) => Number(item.id) === Number(id));
  if (!question) {
    return null;
  }
  syncDemoQuestionMeta(id);
  return clone(question);
};

export const getDemoReplyPage = ({ questionId, answerId, pageNo = 1, pageSize = 10 } = {}) => {
  if (answerId) {
    const replyList = demoQuestionAnswers.filter(
      (item) => Number(item.answerId) === Number(answerId) && Number(item.id) !== Number(item.answerId),
    );
    return paginateDemoList(replyList, pageNo, pageSize);
  }

  const answerList = demoQuestionAnswers.filter(
    (item) => Number(item.questionId) === Number(questionId) && Number(item.id) === Number(item.answerId),
  );
  return paginateDemoList(answerList, pageNo, pageSize);
};

export const postDemoAnswer = (payload) => {
  const question = demoQuestions.find((item) => Number(item.id) === Number(payload.questionId));
  if (!question) {
    return false;
  }
  const currentUser = getDemoUserInfo();
  const content = String(payload.content || "").trim();
  if (!content) {
    return false;
  }

  if (payload.answerId) {
    const parentAnswer = demoQuestionAnswers.find((item) => Number(item.id) === Number(payload.answerId));
    if (!parentAnswer) {
      return false;
    }
    const targetReply = demoQuestionAnswers.find((item) => Number(item.id) === Number(payload.targetReplyId));
    demoQuestionAnswers.push({
      id: Date.now(),
      questionId: Number(payload.questionId),
      answerId: Number(payload.answerId),
      targetReplyId: payload.targetReplyId || payload.answerId,
      targetUserId: payload.targetUserId || parentAnswer.userId,
      targetUserName: targetReply?.userName || parentAnswer.userName,
      userId: currentUser.id,
      userName: payload.anonymity ? "匿名用户" : currentUser.name,
      userIcon: payload.anonymity ? "" : currentUser.icon,
      content,
      createTime: now,
      liked: false,
      likedTimes: 0,
      replyTimes: 0,
    });
    parentAnswer.replyTimes = (parentAnswer.replyTimes || 0) + 1;
  } else {
    const answerId = Date.now();
    demoQuestionAnswers.push({
      id: answerId,
      questionId: Number(payload.questionId),
      answerId,
      targetReplyId: "",
      targetUserId: question.userId,
      userId: currentUser.id,
      userName: payload.anonymity ? "匿名用户" : currentUser.name,
      userIcon: payload.anonymity ? "" : currentUser.icon,
      content,
      createTime: now,
      liked: false,
      likedTimes: 0,
      replyTimes: 0,
    });
  }

  syncDemoQuestionMeta(payload.questionId);
  return true;
};

export const toggleDemoQaLike = ({ bizId, liked }) => {
  const target = demoQuestionAnswers.find((item) => Number(item.id) === Number(bizId));
  if (!target) {
    return false;
  }
  target.liked = Boolean(liked);
  target.likedTimes = Math.max(0, (target.likedTimes || 0) + (target.liked ? 1 : -1));
  return true;
};

export const getDemoCartList = () =>
  demoCartCourseIds
    .map((courseId, index) => {
      const course = courseMap[courseId];
      if (!course) {
        return null;
      }
      return {
        id: 8000 + index + 1,
        courseId: course.id,
        courseName: course.name,
        coverUrl: course.coverUrl,
        price: course.price,
        nowPrice: course.price,
        expired: false,
      };
    })
    .filter(Boolean);

export const deleteDemoCarts = (ids = []) => {
  const courseIdsToDelete = getDemoCartList()
    .filter((item) => ids.includes(item.id))
    .map((item) => item.courseId);
  demoCartCourseIds = demoCartCourseIds.filter((id) => !courseIdsToDelete.includes(id));
  return true;
};

export const getDemoConfirmOrderInfo = ({ courseIds = "" } = {}) => {
  const ids = String(courseIds)
    .split(",")
    .map((item) => Number(item))
    .filter(Boolean);
  const courses = ids
    .map((id) => courseMap[id])
    .filter(Boolean)
    .map((course) => ({
      id: course.id,
      courseId: course.id,
      name: course.name,
      courseName: course.name,
      coverUrl: course.coverUrl,
      price: course.price,
      nowPrice: course.price,
    }));
  const totalAmount = courses.reduce((sum, item) => sum + Number(item.nowPrice || item.price || 0), 0);

  return {
    orderId: `A3P${Date.now()}`,
    totalAmount,
    courses,
    discounts:
      totalAmount > 0
        ? [
            {
              ids: [7001],
              rules: ["满 100 元减 10 元"],
              discountAmount: totalAmount >= 10000 ? 1000 : 0,
              disabled: totalAmount < 10000,
            },
            {
              ids: [7002],
              rules: ["智能专题课 85 折"],
              discountAmount: Math.min(Math.round(totalAmount * 0.15), 5000),
              disabled: false,
            },
          ]
        : [],
  };
};

export const placeDemoOrder = ({ courseIds = [], couponIds = [], orderId } = {}) => {
  const ids = Array.isArray(courseIds) ? courseIds.map(Number) : String(courseIds).split(",").map(Number);
  const courses = ids
    .map((id) => courseMap[id])
    .filter(Boolean)
    .map((course) => ({
      courseId: course.id,
      name: course.name,
      coverUrl: course.coverUrl,
      price: course.price,
      nowPrice: course.price,
      refundStatus: 0,
    }));
  const totalAmount = courses.reduce((sum, item) => sum + Number(item.nowPrice || item.price || 0), 0);
  const discountAmount = couponIds.length ? Math.min(Math.round(totalAmount * 0.15), 5000) : 0;
  const finalOrderId = orderId || `A3P${Date.now()}`;

  demoPendingOrders = demoPendingOrders.filter((item) => String(item.id) !== String(finalOrderId));
  demoPendingOrders.unshift({
    id: finalOrderId,
    status: 1,
    createTime: now,
    totalAmount,
    payAmount: Math.max(0, totalAmount - discountAmount),
    realAmount: Math.max(0, totalAmount - discountAmount),
    payOutTime: "2026-05-07 23:59:59",
    details: courses,
  });

  return { orderId: finalOrderId };
};

export const getDemoPayMethods = () => [
  {
    id: 1,
    name: "微信支付",
    channelCode: "wx_native",
    channelIcon: "/src/assets/icon_weixin.png",
  },
  {
    id: 2,
    name: "支付宝",
    channelCode: "ali_native",
    channelIcon: "/src/assets/icon_zhifubao.png",
  },
];

export const getDemoPayUrl = ({ orderId, payChannelCode }) =>
  `https://a3-demo-pay.local/${payChannelCode || "demo"}?orderId=${orderId}`;

export const getDemoPayState = (orderId) => {
  const pending = demoPendingOrders.find((item) => String(item.id) === String(orderId));
  if (pending) {
    return clone(pending);
  }
  const finished = demoOrderList.find((item) => String(item.id) === String(orderId));
  if (finished) {
    return {
      id: finished.id,
      orderId: finished.id,
      status: finished.status,
      payAmount: finished.realAmount,
      totalAmount: finished.totalAmount,
      payOutTime: "2026-05-07 23:59:59",
    };
  }
  return {
    id: orderId,
    orderId,
    status: 1,
    payAmount: 0,
    totalAmount: 0,
    payOutTime: "2026-05-07 23:59:59",
  };
};

export const getDemoOrderDetails = (id) => {
  const pending = demoPendingOrders.find((item) => String(item.id) === String(id));
  const target = pending || demoOrderList.find((item) => String(item.id) === String(id));
  if (!target) {
    return null;
  }

  const paidAmount = target.realAmount ?? target.payAmount ?? target.totalAmount ?? 0;
  const discountAmount = Math.max(0, Number(target.totalAmount || 0) - Number(paidAmount || 0));

  return {
    id: target.id,
    status: target.status,
    message:
      {
        1: "订单已创建，等待完成支付",
        2: "支付成功，课程已进入学习列表",
        3: "订单已取消，可重新选择课程后再下单",
        4: "订单已完成，课程学习记录可继续查看",
        5: "课程已报名成功，可直接进入学习",
        6: "退款处理中，请等待审核结果",
      }[target.status] || "订单处理中",
    progressNodes: [
      { id: 1, name: "提交订单", time: target.createTime || now },
      { id: 2, name: "支付确认", time: Number(target.status) >= 2 ? "2026-05-06 10:15:00" : "-- --" },
      { id: 3, name: "完成交付", time: Number(target.status) >= 4 || Number(target.status) === 5 ? "2026-05-06 10:20:00" : "-- --" },
    ],
    totalAmount: target.totalAmount || 0,
    discountAmount,
    realAmount: paidAmount,
    couponDesc: discountAmount > 0 ? "演示优惠券/赛题专享折扣" : "",
    details: (target.details || []).map((item, index) => ({
      id: item.id || `${target.id}-${index + 1}`,
      courseId: item.courseId,
      name: item.name,
      coverUrl: item.coverUrl,
      price: item.price || item.nowPrice || 0,
      realPayAmount: Math.max(
        0,
        Math.round((item.price || item.nowPrice || 0) - discountAmount / Math.max((target.details || []).length, 1)),
      ),
      canRefund: Number(target.status) === 2 || Number(target.status) === 5,
      refundStatus: item.refundStatus || 0,
    })),
  };
};

export const applyDemoRefund = ({ orderDetailId, questionDesc, refundReason }) => {
  const allOrders = [...demoPendingOrders, ...demoOrderList];
  for (const order of allOrders) {
    const detail = (order.details || []).find(
      (item, index) => String(item.id || `${order.id}-${index + 1}`) === String(orderDetailId),
    );
    if (detail) {
      detail.refundStatus = 1;
      return {
        id: `RF${Date.now()}`,
        orderId: order.id,
        orderDetailId,
        questionDesc,
        refundReason,
      };
    }
  }
  return null;
};

export const getDemoRefundDetails = (orderDetailId) => ({
  id: `RF${orderDetailId}`,
  payChannel: "微信支付",
  refundOrderNo: `A3-REFUND-${orderDetailId}`,
  refundChannel: "原路退回",
  orderId: String(orderDetailId).split("-")[0] || "5001001",
  refundReason: "演示阶段申请退款",
  orderTime: "2026-05-06 10:00:00",
  paySuccessTime: "2026-05-06 10:15:00",
  createTime: "2026-05-07 12:10:00",
  approveTime: "2026-05-07 12:30:00",
  remark: true,
  approvalOpinion: "演示环境下已通过退款申请，可继续保留页面展示。",
});
