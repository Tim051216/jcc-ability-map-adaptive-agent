/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import {
  Sparkles,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Star,
  Tv,
  MessageSquare,
  Compass,
  ArrowRight,
  Radar,
  Award,
  BookOpen,
  Bell,
  Target,
  ListRestart,
  UserCircle,
  Bot,
  GraduationCap
} from "lucide-react";
import { COURSES, RECENT_ACTIVITIES, METRIC_SCORE } from "../constants";
import assetAnimeDual from "../assets/images/anime_perfect_dual_1779718037085.webp";
import assetUsagiStudy from "../assets/images/usagi_perfect_1779717893221.webp";
import {
  studentApi,
  type CourseDetail,
  type CourseTeacher,
  type GrowthMapResponse,
  type LevelRecommendationResponse,
  type ProfileSummaryResponse,
  type ReviewPlanResponse,
} from "../lib/studentApi";
import {
  formatGoalDeadline,
  getDefaultGoalDeadline,
  loadLearningGoal,
  saveLearningGoal,
  type StoredLearningGoal,
} from "../lib/learningGoal";
import { getCurrentLoggedInUserId } from "../lib/currentUser";
import { openTutorPanel } from "../lib/tutorPanel";
import { getDemoUserExperienceConfig } from "../lib/userProfiles";
import { buildResourcesRoute, readLastRouteCourseId } from "../lib/routeCourseContext";

interface OverviewProps {
  user?: {
    id: string;
    name: string;
    avatar: string;
    loggedIn: boolean;
  };
}

type DanmakuTemplate = {
  id: string;
  text: string;
  color: string;
  sizeClassName: string;
  fontWeightClassName?: string;
  time: number;
};

type ActiveDanmaku = DanmakuTemplate & {
  lane: number;
  top: string;
  duration: number;
  width: number;
};

type SbtiPortrait = {
  code: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  accent: string;
  tags: string[];
};

const SBTI_PORTRAITS: Record<string, SbtiPortrait> = {
  SPTA: {
    code: "SPTA",
    title: "稳态实战型",
    subtitle: "任务拆解能力较强，适合结构化推进与实践验证",
    description: "当前岗位学情诊断显示，你在任务拆解、步骤组织和实践执行上表现稳定。更适合以明确主线驱动学习，通过案例验证和阶段推进完成知识内化。",
    image: "/sbti/spta.svg?v=2",
    accent: "from-[#fff4f8] via-white to-[#f4f9ff]",
    tags: ["结构化推进", "实践验证", "稳步进阶"],
  },
  STCA: {
    code: "STCA",
    title: "体系建构型",
    subtitle: "概念整合能力突出，适合先建框架再进入应用",
    description: "当前岗位学情诊断显示，你更擅长先厘清原理、结构与概念关系，再进入应用训练。更适合高密度讲义、分层讲解和知识图谱式学习材料。",
    image: "/sbti/stca.svg?v=2",
    accent: "from-[#f5f7ff] via-white to-[#fff8fb]",
    tags: ["原理优先", "框架搭建", "体系理解"],
  },
  ETFI: {
    code: "ETFI",
    title: "探索反馈型",
    subtitle: "试错与反馈驱动明显，适合快速迭代式学习",
    description: "当前岗位学情诊断显示，你对即时反馈和动态修正更敏感。更适合先尝试、再提问、再根据测评与答疑快速调整策略，以保持理解效率和学习投入。",
    image: "/sbti/etfi.svg?v=2",
    accent: "from-[#fff8f2] via-white to-[#f4fbff]",
    tags: ["快速试错", "反馈驱动", "动态修正"],
  },
  SPCI: {
    code: "SPCI",
    title: "节奏推进型",
    subtitle: "节奏控制较稳定，适合主线清晰的渐进式提升",
    description: "当前岗位学情诊断显示，你在持续投入和阶段跟进上较为稳定。更适合围绕清晰主线逐步提升难度，通过连续完成小目标积累整体掌握度。",
    image: "/sbti/spci.svg?v=2",
    accent: "from-[#fff6fa] via-white to-[#f7fbff]",
    tags: ["主线清晰", "持续投入", "渐进提升"],
  },
};

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0);
}

function getDaysUntil(deadline?: string | null) {
  if (!deadline) return null;
  const target = new Date(`${deadline}T23:59:59`);
  if (Number.isNaN(target.getTime())) return null;
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatLevelLabel(level?: string | null) {
  const normalized = String(level || "").toLowerCase();
  if (normalized.includes("beginner") || normalized.includes("basic") || normalized.includes("novice") || normalized === "starter") {
    return "小白版";
  }
  if (normalized.includes("advanced") || normalized.includes("expert") || normalized.includes("pro")) {
    return "专家版";
  }
  if (normalized.includes("intermediate") || normalized.includes("medium")) {
    return "进阶版";
  }
  return level || "进阶版";
}

function getSbtiPortrait(profileSummary: ProfileSummaryResponse | null, growthMap: GrowthMapResponse | null): SbtiPortrait {
  const backendCode = String(profileSummary?.sbti_code || "").toUpperCase();
  if (backendCode && SBTI_PORTRAITS[backendCode]) {
    return SBTI_PORTRAITS[backendCode];
  }

  const tags = profileSummary?.tags || [];
  const style = profileSummary?.recommended_learning_style || "";
  const stage = profileSummary?.current_stage || "";
  const keyFeatures = profileSummary?.key_features || "";
  const dimensionLabels = (growthMap?.dimensions || []).map((item) => item.label).join(" ");
  const stableSignals = `${tags.join(" ")} ${style} ${stage} ${keyFeatures} ${dimensionLabels}`.toLowerCase();

  const scores = {
    SPTA:
      countMatches(stableSignals, [/结构|拆解|规划|步骤|体系/, /实践|实操|项目|动手|验证/, /稳定|持续|节奏|推进|steady/]) +
      ((profileSummary?.dimension_completeness?.execution_rate || 0) >= 0.75 ? 1 : 0),
    STCA:
      countMatches(stableSignals, [/原理|理论|概念|推导/, /框架|体系|结构|图谱/, /讲义|笔记|分层|梳理/]) +
      ((profileSummary?.dimension_completeness?.cognition_breadth || 0) >= 0.7 ? 1 : 0),
    ETFI:
      countMatches(stableSignals, [/反馈|复盘|纠错|测评/, /试错|调整|迭代|修正/, /提问|答疑|互动|探索/]) +
      ((growthMap?.dimensions || []).some((item) => /反馈|纠错|复盘/.test(item.label + item.evidence)) ? 1 : 0),
    SPCI:
      countMatches(stableSignals, [/主线|节奏|持续|推进|稳定/, /投入|跟进|积累|阶段/, /渐进|巩固|提升/]) +
      ((profileSummary?.dimension_completeness?.persistence || 0) >= 0.75 ? 1 : 0),
  };

  const rankedCodes = (Object.keys(scores) as Array<keyof typeof scores>).sort((left, right) => {
    if (scores[right] !== scores[left]) {
      return scores[right] - scores[left];
    }
    return ["SPTA", "STCA", "ETFI", "SPCI"].indexOf(left) - ["SPTA", "STCA", "ETFI", "SPCI"].indexOf(right);
  });

  return SBTI_PORTRAITS[rankedCodes[0] || "SPCI"];
}

const HOME_AGENT_OVERVIEW = [
  {
    title: "岗位学情诊断智能体",
    detail: "读取岗位能力诊断、学习进度和阶段状态",
    icon: UserCircle,
    route: "/job-ability-graph",
  },
  {
    title: "学习规划智能体",
    detail: "生成下一步学习路径和阶段任务",
    icon: Compass,
    route: "/path?courseId=series-2",
  },
  {
    title: "知识答疑智能体",
    detail: "结合课程资料和上下文给出实时答疑",
    icon: MessageSquare,
    route: "/tutor?courseId=series-2",
  },
  {
    title: "测评反馈智能体",
    detail: "根据测评、资源和学习过程输出报告",
    icon: Award,
    route: "/report",
  },
  {
    title: "互动课堂智能体",
    detail: "编排 AI 教师、AI 助教、随堂测验与课件脚本",
    icon: GraduationCap,
    route: "/learn?courseId=series-2",
  },
];

const HOME_AGENT_SEQUENCE = [
  {
    title: "\u5b66\u4e60\u753b\u50cf\u667a\u80fd\u4f53",
    detail: "\u7ed3\u5408\u5b66\u4e60\u76ee\u6807\u4e0e\u5f53\u524d\u8868\u73b0\uff0c\u5b8c\u6210\u5b66\u60c5\u8bca\u65ad\u4e0e\u753b\u50cf\u521d\u59cb\u5316",
    icon: UserCircle,
    route: "/job-ability-graph",
    tag: "岗位能力追踪",
  },
  {
    title: "\u77e5\u8bc6\u68c0\u7d22\u4e0e\u7b54\u7591\u667a\u80fd\u4f53",
    detail: "\u5728\u5b66\u4e60\u8fc7\u7a0b\u4e2d\u7ed3\u5408\u8bfe\u7a0b\u8d44\u6599\u4e0e\u4e0a\u4e0b\u6587\uff0c\u63d0\u4f9b\u5373\u65f6\u7b54\u7591\u652f\u6301",
    icon: MessageSquare,
    route: "/tutor?courseId=series-2",
    tag: "\u5373\u65f6\u7b54\u7591",
  },
  {
    title: "\u5b66\u4e60\u89c4\u5212\u667a\u80fd\u4f53",
    detail: "\u56f4\u7ed5\u5df2\u786e\u8ba4\u7684\u5b66\u4e60\u76ee\u6807\uff0c\u751f\u6210\u4e2a\u6027\u5316\u5b66\u4e60\u8def\u5f84\u4e0e\u9636\u6bb5\u4efb\u52a1",
    icon: Compass,
    route: "/path?courseId=series-2",
    tag: "\u4eca\u65e5\u8def\u7ebf",
  },
  {
    title: "\u8d44\u6e90\u751f\u6210\u667a\u80fd\u4f53",
    detail: "\u6309\u89c4\u5212\u4efb\u52a1\u751f\u6210\u548c\u63a8\u8350\u8bb2\u4e49\u3001\u89c6\u9891\u3001\u7ec3\u4e60\u4e0e\u8865\u5145\u8d44\u6599",
    icon: BookOpen,
    route: "/resources?courseId=series-2",
    tag: "\u8d44\u6e90\u6295\u9001",
  },
  {
    title: "\u4e92\u52a8\u8bfe\u5802\u667a\u80fd\u4f53",
    detail: "\u7ec4\u7ec7 AI \u6559\u5e08\u3001AI \u52a9\u6559\u3001\u968f\u5802\u6d4b\u9a8c\u4e0e PPT \u8349\u6848\uff0c\u76f4\u63a5\u7528\u4e8e\u8bfe\u5802\u6f14\u793a",
    icon: GraduationCap,
    route: "/learn?courseId=series-2",
    tag: "\u8bfe\u5802\u6f14\u793a",
  },
  {
    title: "\u6d4b\u8bc4\u53cd\u9988\u667a\u80fd\u4f53",
    detail: "\u7efc\u5408\u6d4b\u8bc4\u7ed3\u679c\u4e0e\u5b66\u4e60\u8fc7\u7a0b\uff0c\u8f93\u51fa\u53cd\u9988\u5206\u6790\u4e0e\u753b\u50cf\u8fed\u4ee3\u5efa\u8bae",
    icon: Award,
    route: "/report",
    tag: "\u9636\u6bb5\u53cd\u9988",
  },
];

const HOME_AGENT_ACTIONS = [
  {
    label: "继续上次学习",
    detail: "已定位到你最近一次中断的课程与资料位置",
    action: "恢复课堂",
    route: "/learn",
  },
  {
    label: "生成今日计划",
    detail: "结合当前进度、岗位能力诊断与最近测评结果编排任务",
    action: "查看路径",
    route: "/path",
  },
  {
    label: "快速复盘资料",
    detail: "优先整理讲义、笔记与视频里的高频重点",
    action: "进入资源",
    route: buildResourcesRoute(readLastRouteCourseId()),
  },
];

const HERO_DANMAKU_TIMELINE: DanmakuTemplate[] = [
  { id: "dan-1", text: "前排前排 🍿", color: "#ffffff", sizeClassName: "text-sm", fontWeightClassName: "font-semibold", time: 0.8 },
  { id: "dan-2", text: "这节课的案例拆得好细", color: "#fb7299", sizeClassName: "text-base", fontWeightClassName: "font-bold", time: 2.2 },
  { id: "dan-3", text: "请教下 Context 怎么优化性能啊？", color: "#00a1d6", sizeClassName: "text-lg", fontWeightClassName: "font-bold", time: 4.6 },
  { id: "dan-4", text: "打卡第15天！", color: "#ff8fab", sizeClassName: "text-base", fontWeightClassName: "font-bold", time: 6.4 },
  { id: "dan-5", text: "原来 useRef 是这么一回事", color: "#ffffff", sizeClassName: "text-sm", time: 8.6 },
  { id: "dan-6", text: "这个交互重构思路很像真实项目", color: "#ffd166", sizeClassName: "text-sm", fontWeightClassName: "font-semibold", time: 10.5 },
  { id: "dan-7", text: "AI 导师的答疑真的很有帮助", color: "#00FFC2", sizeClassName: "text-sm", fontWeightClassName: "font-semibold", time: 12.9 },
  { id: "dan-8", text: "100% completed!", color: "#ffffff", sizeClassName: "text-base", fontWeightClassName: "font-bold", time: 15.4 },
  { id: "dan-9", text: "老师讲到渲染链路这里突然听懂了", color: "#ffffff", sizeClassName: "text-sm", time: 18.2 },
  { id: "dan-10", text: "这个例子太像我前几天改的需求了", color: "#fb7299", sizeClassName: "text-sm", fontWeightClassName: "font-semibold", time: 21.1 },
  { id: "dan-11", text: "React 19 compiler is so fast", color: "#00FFC2", sizeClassName: "text-sm", fontWeightClassName: "font-semibold", time: 24.4 },
  { id: "dan-12", text: "后面的等等我", color: "#ffffff", sizeClassName: "text-xs", time: 27.6 },
];

const DANMAKU_LANES = ["8%", "16%", "24%", "32%", "40%"];
const DANMAKU_BASE_DURATION = 8.8;
const DANMAKU_SPEED_PX_PER_SECOND = 136;
const DANMAKU_GAP_PX = 124;
const DANMAKU_SEEK_LOOKAHEAD_SECONDS = 0.45;
const GOAL_PROMPT_DEFERRED_PREFIX = "a3-goal-prompt-deferred:";

function loadDeferredGoalPrompt(userId: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(`${GOAL_PROMPT_DEFERRED_PREFIX}${userId}`) === "1";
}

function saveDeferredGoalPrompt(userId: string, deferred: boolean) {
  if (typeof window === "undefined") return;
  const key = `${GOAL_PROMPT_DEFERRED_PREFIX}${userId}`;
  if (deferred) {
    window.localStorage.setItem(key, "1");
    return;
  }
  window.localStorage.removeItem(key);
}

export default function Overview({ user }: OverviewProps = {}) {
  const navigate = useNavigate();
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const continueWatchingVideoRef = useRef<HTMLVideoElement | null>(null);
  const heroStageRef = useRef<HTMLElement | null>(null);
  const dashboardSectionsRef = useRef<Record<string, HTMLElement | null>>({});
  const overviewRootRef = useRef<HTMLDivElement | null>(null);
  const [showOpeningSplash, setShowOpeningSplash] = useState(false);
  const [heroContentReady, setHeroContentReady] = useState(false);
  const [cockpitVisible, setCockpitVisible] = useState(true);
  const [revealedSections, setRevealedSections] = useState<Record<string, boolean>>({});
  const [videoMuted, setVideoMuted] = useState(true);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [danmakuEnabled, setDanmakuEnabled] = useState(true);
  const [radarExpanded, setRadarExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeDanmakus, setActiveDanmakus] = useState<ActiveDanmaku[]>([]);
  const [heroParallax, setHeroParallax] = useState({ x: 0, y: 0 });
  const [activeFlowIndex, setActiveFlowIndex] = useState(2);
  const [reviewPlan, setReviewPlan] = useState<ReviewPlanResponse | null>(null);
  const [growthMap, setGrowthMap] = useState<GrowthMapResponse | null>(null);
  const [levelRecommendation, setLevelRecommendation] = useState<LevelRecommendationResponse | null>(null);
  const [profileSummary, setProfileSummary] = useState<ProfileSummaryResponse | null>(null);
  const [homeCourseDetail, setHomeCourseDetail] = useState<CourseDetail | null>(null);
  const [learningGoal, setLearningGoal] = useState<StoredLearningGoal | null>(null);
  const [goalPromptDeferred, setGoalPromptDeferred] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [goalDeadlineDraft, setGoalDeadlineDraft] = useState(getDefaultGoalDeadline());
  const [goalDailyMinutesDraft, setGoalDailyMinutesDraft] = useState("45");

  useEffect(() => {
    const warmRoutes = () => {
      void import("./CourseLearning");
      void import("./AITutor");
    };

    if (typeof window === "undefined") return;
    if ("requestIdleCallback" in window) {
      const idleId = (window as Window & {
        requestIdleCallback: (callback: () => void, options?: { timeout: number }) => number;
        cancelIdleCallback: (id: number) => void;
      }).requestIdleCallback(warmRoutes, { timeout: 5000 });
      return () => (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
    }

    const timer = globalThis.setTimeout(warmRoutes, 5000);
    return () => globalThis.clearTimeout(timer);
  }, []);

  const capabilityMetrics = useMemo(
    () => [
      { label: "代码逻辑力", value: 88, tone: "from-[#7c3aed] to-[#5b7cff]", note: "结构拆解" },
      { label: "理论储备", value: 82, tone: "from-[#06b6d4] to-[#3b82f6]", note: "概念沉淀" },
      { label: "交互美感", value: 76, tone: "from-[#fb7185] to-[#f97316]", note: "界面表达" },
      { label: "沙箱调试", value: 91, tone: "from-[#14b8a6] to-[#10b981]", note: "定位修正" },
      { label: "专注抗压", value: 79, tone: "from-[#f59e0b] to-[#eab308]", note: "稳定推进" },
    ],
    [],
  );
  const nextDanmakuIndexRef = useRef(0);
  const laneAvailableAtRef = useRef<number[]>(new Array(DANMAKU_LANES.length).fill(0));
  const activeDanmakusRef = useRef<ActiveDanmaku[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    // Auto clear previous schedules if any
    const id = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const overviewUserId = user?.id && /^\d+$/.test(user.id) ? Number(user.id) : getCurrentLoggedInUserId();
  const homeConfig = getDemoUserExperienceConfig(overviewUserId);
  const primaryCourse = useMemo(
    () => COURSES.find((course) => course.id === homeConfig.primaryCourseId) || COURSES[0],
    [homeConfig.primaryCourseId],
  );
  const recommendedCourses = useMemo(
    () =>
      homeConfig.recommendedCourseIds
        .map((courseId) => COURSES.find((course) => course.id === courseId))
        .filter(Boolean) as typeof COURSES,
    [homeConfig.recommendedCourseIds],
  );
  const goalUserId = user?.id || String(overviewUserId);
  const currentCourseId = primaryCourse?.id ?? COURSES[0].id;
  const goalDaysLeft = useMemo(() => getDaysUntil(learningGoal?.deadline), [learningGoal?.deadline]);
  const activeLevelLabel = useMemo(() => formatLevelLabel(levelRecommendation?.active_level), [levelRecommendation?.active_level]);
  const activeLevelFitScore = useMemo(() => {
    const matched = levelRecommendation?.items?.find((item) => item.level === levelRecommendation?.active_level);
    return matched?.fit_score ?? null;
  }, [levelRecommendation]);
  const nextReviewHours = reviewPlan?.cards?.[0]?.next_review_in_hours ?? null;
  const homeCourseTeachers = useMemo(
    () => (homeCourseDetail?.teachers || []).filter((item) => item.is_show !== false).slice(0, 3),
    [homeCourseDetail],
  );
  const homeCourseCapabilityChips = useMemo(() => {
    const mapping: Record<string, string[]> = {
      software_engineering_4th: ["讲义", "教案", "实验", "视频"],
      vue3_engineering: ["工程化讲义", "状态导图", "页面练习", "联调案例"],
      llm_app_intro: ["多智能体讲义", "RAG 资料", "联网案例", "扩展阅读"],
      contest_project_lab: ["答辩讲义", "追问题", "项目总览", "汇报材料"],
      ml_intro: ["闭环讲义", "智能体导图", "联调清单", "阶段任务"],
      spring_cloud_bootcamp: ["治理讲义", "调用关系图", "排障案例", "网关资料"],
    };
    return mapping[homeCourseDetail?.course_code || ""] || ["讲义", "导图", "练习", "资料"];
  }, [homeCourseDetail?.course_code]);
  const quickPulseMetrics = useMemo(
    () => [
      {
        label: "\u4eca\u65e5\u4efb\u52a1",
        value: "03",
        detail: "\u4e3b\u7ebf 1 \u9879 + \u8865\u5145 2 \u9879",
      },
      {
        label: "\u5b8c\u6210\u8fdb\u5ea6",
        value: `${primaryCourse?.progress ?? 0}%`,
        detail: "\u5df2\u540c\u6b65\u8bfe\u7a0b\u3001\u8d44\u6e90\u4e0e\u6d4b\u8bc4",
      },
      {
        label: "\u5f53\u524d\u72b6\u6001",
        value: "\u7a33\u6b65\u8fdb\u9636",
        detail: "\u8282\u594f\u7a33\u5b9a\uff0c\u53ef\u4ee5\u7ee7\u7eed\u63d0\u96be\u5ea6",
      },
    ],
    [primaryCourse],
  );
  const goalTaskPanels = useMemo(
    () => {
      if (learningGoal) {
        return [
          {
            label: "目标拆解",
            title: "先完成基础概念梳理",
            detail: "围绕当前目标，先把本周最关键的概念、术语和结构关系过一遍。",
            accent: "bg-[#fff6fa] ui-ui-text-brand",
          },
          {
            label: "今日推进",
            title: `投入 ${learningGoal.dailyMinutes} 分钟完成主线任务`,
            detail: `今天优先进入学习路径，按 ${formatGoalDeadline(learningGoal.deadline)} 前完成的节奏推进。`,
            accent: "bg-[#f4f9ff] text-[#0b5f85]",
          },
          {
            label: "完成条件",
            title: "学完并能复述关键方法",
            detail: "至少完成一轮学习、一次回看，并能说清楚本轮目标对应的做法与判断依据。",
            accent: "bg-[#fffaf2] text-[#c97a00]",
          },
        ];
      }

      return [
        {
          label: "还缺什么",
          title: "先补一个明确学习目标",
          detail: "写清楚你这轮到底要学成什么，系统才知道该怎么拆任务和排优先级。",
          accent: "bg-[#fff6fa] ui-ui-text-brand",
        },
        {
          label: "随后生成",
          title: "自动给出今日任务和时间安排",
          detail: "目标一旦确定，首页会立刻补全路径、完成时间和本周推进节奏。",
          accent: "bg-[#f4f9ff] text-[#0b5f85]",
        },
        {
          label: "你将看到",
          title: "目标任务、资源补给与测评回写",
          detail: "后续空白区域会变成可执行任务区，而不是静态说明卡片。",
          accent: "bg-[#fffaf2] text-[#c97a00]",
        },
      ];
    },
    [learningGoal, goalPromptDeferred],
  );
  const actionCockpitCards = useMemo(
    () => [
      {
        title: "\u7ee7\u7eed\u4e3b\u7ebf\u5b66\u4e60",
        detail: "\u4ece\u4e0a\u6b21\u4e2d\u65ad\u7684\u8fdb\u5ea6\u76f4\u63a5\u6062\u590d\uff0c\u4f18\u5148\u5b8c\u6210\u4eca\u5929\u6700\u91cd\u8981\u7684\u4e00\u6b65\u3002",
        cta: "\u8fdb\u5165\u8bfe\u5802",
        icon: Play,
        route: `/learn?courseId=${primaryCourse?.id ?? COURSES[0].id}`,
        tone: "from-[#fff1f6] via-white to-[#fff8fb]",
        accent: "text-[#e85d8e]",
      },
      {
        title: "\u67e5\u770b\u4eca\u65e5\u8def\u5f84",
        detail: "\u628a\u5f53\u524d\u76ee\u6807\u3001\u8282\u70b9\u4efb\u52a1\u548c\u4f18\u5148\u7ea7\u6392\u6210\u4e00\u6761\u6e05\u6670\u8def\u7ebf\u3002",
        cta: "\u6253\u5f00\u8def\u5f84",
        icon: Compass,
        route: `/path?courseId=${primaryCourse?.id ?? COURSES[0].id}`,
        tone: "from-[#eff8ff] via-white to-[#f7fbff]",
        accent: "text-[#0b5f85]",
      },
      {
        title: "AI \u4e92\u52a8\u8bfe\u5802",
        detail: "\u628a\u5f53\u524d\u7ae0\u8282\u76f4\u63a5\u7ec4\u88c5\u6210 AI \u6559\u5e08\u4e3b\u8bb2\u3001\u52a9\u6559\u8ffd\u95ee\u3001\u968f\u5802\u6d4b\u8bc4\u4e0e PPT \u8349\u6848\u3002",
        cta: "\u542f\u52a8\u8bfe\u5802",
        icon: GraduationCap,
        route: `/learn?courseId=${primaryCourse?.id ?? COURSES[0].id}`,
        tone: "from-[#f2f4ff] via-white to-[#fafbff]",
        accent: "text-[#4f46e5]",
      },
      {
        title: "AI \u5373\u65f6\u7b54\u7591",
        detail: "\u9047\u5230\u5361\u70b9\u65f6\u76f4\u63a5\u63d0\u95ee\uff0c\u7cfb\u7edf\u4f1a\u5e26\u4e0a\u8bfe\u7a0b\u4e0a\u4e0b\u6587\u4e00\u8d77\u56de\u7b54\u3002",
        cta: "\u95ee AI \u52a9\u6559",
        icon: MessageSquare,
        route: `/tutor?courseId=${primaryCourse?.id ?? COURSES[0].id}`,
        tone: "from-[#fff7ed] via-white to-[#fffbf5]",
        accent: "text-[#c96a18]",
      },
    ],
    [primaryCourse],
  );
  const sbtiPortrait = useMemo(() => getSbtiPortrait(profileSummary, growthMap), [growthMap, profileSummary]);
  const sbtiPortraitNarrative = useMemo(() => {
    const backendHeadline =
      growthMap?.title ||
      sbtiPortrait.subtitle;

    const backendDescription =
      growthMap?.summary ||
      profileSummary?.key_features ||
      sbtiPortrait.description;

    return {
      headline: backendHeadline,
      description: backendDescription,
    };
  }, [growthMap?.summary, growthMap?.title, profileSummary?.key_features, sbtiPortrait.description, sbtiPortrait.subtitle]);
  const sbtiPortraitTags = useMemo(() => {
    if (profileSummary?.tags?.length) {
      return profileSummary.tags.slice(0, 3);
    }

    if (growthMap?.dimensions?.length) {
      return growthMap.dimensions
        .slice()
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((item) => item.label);
    }

    return sbtiPortrait.tags;
  }, [growthMap?.dimensions, profileSummary?.tags, sbtiPortrait.tags]);
  const learningFlow = useMemo(
    () => [
      {
        label: "目标确认",
        title: "确认今天的学习目标",
        status: learningGoal ? ("completed" as const) : ("active" as const),
        detail: learningGoal
          ? "你已经设定好本轮学习目标，首页会优先按这条主线推进。"
          : "先设一个明确目标，系统才会生成带完成时间的学习路径。",
        output: learningGoal
          ? `${learningGoal.goal} · ${formatGoalDeadline(learningGoal.deadline)} 前完成`
          : "等待你先设定目标与预计完成时间",
        action: "进入课程",
        route: `/learn?courseId=${primaryCourse?.id ?? COURSES[0].id}`,
        accent: "from-emerald-500 to-teal-500",
      },
      {
        label: "学情诊断",
        title: "完成岗位学情诊断与状态识别",
        status: "completed" as const,
        detail: "系统已结合你的当前进度、常见卡点和最近表现，形成这一轮学习上下文。",
        output: "已同步当前阶段、岗位能力缺口与学习侧重点",
        action: "查看岗位能力图谱",
        route: "/job-ability-graph",
        accent: "from-sky-500 to-cyan-500",
      },
      {
        label: "学习规划",
        title: "生成今天该走的学习路径",
        status: "active" as const,
        detail: "围绕已确认目标，系统已经排好下一步优先任务，你现在最应该先进入这里。",
        output: "主线 1 项 + 补充 2 项，已按优先级排好",
        action: "打开路径",
        route: `/path?courseId=${primaryCourse?.id ?? COURSES[0].id}`,
        accent: "from-[#fb7299] to-[#ff8fab]",
      },
      {
        label: "资源生成",
        title: "准备对应任务的学习资源",
        status: "queued" as const,
        detail: "讲义、视频、练习与补充材料会围绕当前路径任务同步给出。",
        output: "待根据路径节点生成资源包",
        action: "查看资源",
        route: `/resources?courseId=${primaryCourse?.id ?? COURSES[0].id}`,
        accent: "from-amber-500 to-orange-500",
      },
      {
        label: "过程答疑",
        title: "在学习中提供即时支持",
        status: "queued" as const,
        detail: "遇到卡点时可以直接提问，系统会带着课程上下文和当前目标一起回答。",
        output: "等待你在学习过程中发起问题",
        action: "问 AI 助教",
        route: `/tutor?courseId=${primaryCourse?.id ?? COURSES[0].id}`,
        accent: "from-violet-500 to-fuchsia-500",
      },
      {
        label: "测评反馈",
        title: "汇总结果并更新岗位能力诊断",
        status: "queued" as const,
        detail: "完成一轮学习后，系统会结合测评结果给出反馈，并更新岗位能力诊断。",
        output: "本轮结束后生成反馈分析与更新建议",
        action: "查看报告",
        route: "/report",
        accent: "from-slate-500 to-slate-700",
      },
    ],
    [primaryCourse],
  );
  const flowAgents = useMemo(
    () => [
      {
        name: "岗位学情诊断智能体",
        role: "负责岗位能力诊断与学习状态识别",
        tag: "诊断中枢",
        route: "/job-ability-graph",
        icon: UserCircle,
        steps: ["目标确认", "学情诊断"],
        tone: "from-[#fff4f8] to-[#fffafb]",
      },
      {
        name: "学习规划智能体",
        role: "围绕目标生成阶段路径与任务优先级",
        tag: "路径编排",
        route: `/path?courseId=${primaryCourse?.id ?? COURSES[0].id}`,
        icon: Compass,
        steps: ["学习规划"],
        tone: "from-[#eef7ff] to-[#f8fbff]",
      },
      {
        name: "资源生成智能体",
        role: "按当前任务推荐讲义、视频和练习",
        tag: "资源投送",
        route: `/resources?courseId=${primaryCourse?.id ?? COURSES[0].id}`,
        icon: BookOpen,
        steps: ["资源生成"],
        tone: "from-[#fff8ef] to-[#fffdf7]",
      },
      {
        name: "全域问答智能体",
        role: "不仅处理课程知识检索，还支持联网补充信息、多模态分析与连续追问",
        tag: "全域问答",
        route: `/tutor?courseId=${primaryCourse?.id ?? COURSES[0].id}`,
        icon: MessageSquare,
        steps: ["过程答疑"],
        tone: "from-[#f7f3ff] to-[#fcfaff]",
      },
      {
        name: "测评反馈智能体",
        role: "汇总结果、生成反馈并更新岗位能力诊断",
        tag: "结果闭环",
        route: "/report",
        icon: Award,
        steps: ["测评反馈"],
        tone: "from-[#f4f7fb] to-[#fbfcfe]",
      },
      {
        name: "智能复习提醒智能体",
        role: "按学习节奏自动安排复习时机，并通过站内通知持续提醒你回到关键任务",
        tag: "复习提醒",
        route: "/im",
        icon: Bell,
        steps: ["复习提醒"],
        tone: "from-[#fff6f0] to-[#fffdfa]",
      },
    ],
    [primaryCourse],
  );
  const activeFlowStep = learningFlow[Math.min(activeFlowIndex, learningFlow.length - 1)];
  const activeAgentNames = useMemo(
    () =>
      flowAgents
        .filter((agent) => agent.steps.includes(activeFlowStep.label))
        .map((agent) => agent.name),
    [activeFlowStep.label, flowAgents],
  );
  const recentOutputs = useMemo(
    () => [
      {
        title: "最新学习路径",
        summary:
          homeConfig.primaryCourseId === "course-4"
            ? "项目主线已拆成范围划分、验收表达和资料组织 3 个节点，先把讲法收清楚。"
            : homeConfig.primaryCourseId === "series-3"
              ? "智能体主线已拆成协作角色、工具调用和页面落地 3 个节点，先打通主链路。"
              : homeConfig.primaryCourseId === "series-1"
                ? "设计系统主线已拆成结构层、表达层和动效层 3 个节点，先收版面秩序。"
                : "React 架构主线已拆成 3 个节点，先做状态管理，再做上下文分层。",
        route: `/path?courseId=${primaryCourse?.id ?? COURSES[0].id}`,
        label: "查看路径",
        tone: "bg-[#fff4f8] text-[#e85d8e]",
      },
      {
        title: "最新资源包",
        summary: `已按“${homeConfig.tutorFocus}”整理讲义、案例和练习，适合直接进入当前节点复习。`,
        route: `/resources?courseId=${primaryCourse?.id ?? COURSES[0].id}`,
        label: "查看资源",
        tone: "bg-[#eef7ff] text-[#0b5f85]",
      },
      {
        title: "最新测评反馈",
        summary:
          overviewUserId === 1009
            ? "最近一次反馈已经能看出错因归纳方向，下一步更适合把结论压缩成行动项。"
            : "最近一次表现显示理解稳定，但复杂状态拆解仍值得继续强化。",
        route: "/report",
        label: "查看反馈",
        tone: "bg-[#f4f7fb] text-[#475569]",
      },
    ],
    [homeConfig.primaryCourseId, homeConfig.tutorFocus, overviewUserId, primaryCourse],
  );
  const personalizedLearningHubCards = useMemo(
    () => [
      {
        eyebrow: "目标式推荐",
        title: learningGoal ? learningGoal.goal : "7 天内完成一条明确主线",
        detail: learningGoal
          ? `已按 ${formatGoalDeadline(learningGoal.deadline)} 前完成、每日 ${learningGoal.dailyMinutes} 分钟的节奏生成任务。`
          : "先定目标，再由系统生成带完成时间的学习路径和每日任务。",
        action: learningGoal ? "继续目标路径" : "设定目标",
        route: learningGoal ? `/path?courseId=${currentCourseId}` : "/path",
        icon: Target,
        tone: "from-[#fff4f8] via-white to-[#fff9fb]",
        accent: "text-[#e85d8e]",
      },
      {
        eyebrow: "下一步学什么",
        title: "AI 学习路径",
        detail: "不是泛推荐，而是根据当前进度、卡点和目标安排下一步最该学的内容。",
        action: "打开学习路径",
        route: `/path?courseId=${currentCourseId}`,
        icon: Compass,
        tone: "from-[#eef7ff] via-white to-[#f8fbff]",
        accent: "text-[#0b5f85]",
      },
      {
        eyebrow: "智能复习提醒",
        title: (reviewPlan?.cards || []).length ? `${reviewPlan?.cards.length} 张记忆卡片已准备` : "回顾计划已就绪",
        detail: (reviewPlan?.cards || []).length
          ? `优先回顾「${reviewPlan?.cards?.[0]?.source_video || "当前重点视频"}」，系统会按间隔自动提醒。`
          : "系统会把看过的知识视频整理成记忆卡片，并安排回顾节奏。",
        action: "查看复习计划",
        route: `/path?courseId=${currentCourseId}`,
        icon: ListRestart,
        tone: "from-[#fff8ef] via-white to-[#fffcf7]",
        accent: "text-[#c97a00]",
      },
      {
        eyebrow: "成长型主页",
        title: profileSummary?.current_stage || "能力地图持续更新中",
        detail: "结合岗位能力要求持续展示阶段、强项、短板和成长轨迹。",
        action: "查看岗位能力图谱",
        route: "/job-ability-graph",
        icon: Radar,
        tone: "from-[#f5f3ff] via-white to-[#fcfbff]",
        accent: "text-[#7c3aed]",
      },
    ],
    [currentCourseId, learningGoal, profileSummary?.current_stage, reviewPlan?.cards],
  );

  useEffect(() => {
    let cancelled = false;
    const courseId = Number(primaryCourse?.id?.replace("series-", "")) || 2;

    const loadOverviewIntelligence = async () => {
      const [reviewResult, growthResult, levelResult, profileResult] = await Promise.allSettled([
        studentApi.getReviewPlan(courseId, 0),
        studentApi.getGrowthMap(courseId, overviewUserId),
        studentApi.getLevelRecommendation(courseId),
        studentApi.getProfileSummary(overviewUserId),
      ]);

      if (cancelled) return;

      setReviewPlan(reviewResult.status === "fulfilled" ? reviewResult.value : null);
      setGrowthMap(growthResult.status === "fulfilled" ? growthResult.value : null);
      setLevelRecommendation(levelResult.status === "fulfilled" ? levelResult.value : null);
      setProfileSummary(profileResult.status === "fulfilled" ? profileResult.value : null);
    };

    void loadOverviewIntelligence();
    return () => {
      cancelled = true;
    };
  }, [primaryCourse]);

  useEffect(() => {
    let cancelled = false;
    const backendCourseIdMap: Record<string, number> = {
      "series-1": 201,
      "series-2": 401,
      "series-3": 301,
      "course-4": 302,
    };

    const loadHomeCourseDetail = async () => {
      try {
        const detail = await studentApi.getCourseDetail(backendCourseIdMap[primaryCourse?.id ?? "series-2"] || 201);
        if (!cancelled) {
          setHomeCourseDetail(detail);
        }
      } catch {
        if (!cancelled) {
          setHomeCourseDetail(null);
        }
      }
    };

    void loadHomeCourseDetail();
    return () => {
      cancelled = true;
    };
  }, [primaryCourse]);

  useEffect(() => {
    const savedGoal = loadLearningGoal(goalUserId);
    if (savedGoal) {
      setLearningGoal(savedGoal);
      setGoalPromptDeferred(false);
      setGoalDraft(savedGoal.goal);
      setGoalDeadlineDraft(savedGoal.deadline);
      setGoalDailyMinutesDraft(String(savedGoal.dailyMinutes));
      setGoalModalOpen(false);
      saveDeferredGoalPrompt(goalUserId, false);
      return;
    }
    const deferred = loadDeferredGoalPrompt(goalUserId);
    setGoalPromptDeferred(deferred);
    setGoalModalOpen(!deferred);
  }, [goalUserId]);

  useEffect(() => {
    activeDanmakusRef.current = activeDanmakus;
  }, [activeDanmakus]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRadarExpanded(true);
    }, 180);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const heroTimer = window.setTimeout(() => {
      setHeroContentReady(true);
    }, 120);

    return () => {
      window.clearTimeout(heroTimer);
    };
  }, []);

  useEffect(() => {
    const entries = Object.entries(dashboardSectionsRef.current).filter(([, element]) => Boolean(element));
    if (!entries.length) return;

    const observer = new IntersectionObserver(
      (observerEntries) => {
        observerEntries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const sectionKey = (entry.target as HTMLElement).dataset.revealSection;
          if (!sectionKey) return;
          setRevealedSections((prev) => (prev[sectionKey] ? prev : { ...prev, [sectionKey]: true }));
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );

    entries.forEach(([, element]) => {
      if (element instanceof HTMLElement) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, []);

  const registerRevealSection = (key: string) => (element: HTMLElement | null) => {
    dashboardSectionsRef.current[key] = element;
  };

  const openOverviewTutor = (options?: { title?: string; subtitle?: string; query?: string; quickPrompts?: string[] }) => {
    openTutorPanel({
      courseId: primaryCourse?.id ?? COURSES[0].id,
      mode: "default",
      title: options?.title || `${primaryCourse?.title ?? COURSES[0].title} · 学习总控`,
      subtitle:
        options?.subtitle ||
        "AI 导师会结合首页里的学习目标、岗位学情阶段、推荐课程和资源状态，直接给出下一步建议。",
      query:
        options?.query ||
        `请结合我当前首页里的学习目标、岗位学情阶段、推荐课程和资料状态，围绕“${homeConfig.tutorFocus}”告诉我现在最该先做什么，并给一个最短执行顺序。`,
      quickPrompts: options?.quickPrompts || ["我现在先做什么", "按目标重排今天任务", "先学视频还是先看资料"],
    });
  };

  const handleSaveGoal = () => {
    const trimmedGoal = goalDraft.trim();
    if (!trimmedGoal) {
      showToast("先写下这次要完成的学习目标。");
      return;
    }
    if (!goalDeadlineDraft) {
      showToast("还需要一个预计完成时间。");
      return;
    }

    const nextGoal: StoredLearningGoal = {
      userId: goalUserId,
      courseId: currentCourseId,
      goal: trimmedGoal,
      deadline: goalDeadlineDraft,
      dailyMinutes: Math.max(15, Number(goalDailyMinutesDraft) || 45),
      createdAt: learningGoal?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveLearningGoal(nextGoal);
    saveDeferredGoalPrompt(goalUserId, false);
    setLearningGoal(nextGoal);
    setGoalPromptDeferred(false);
    setGoalModalOpen(false);
    setActiveFlowIndex(2);
    showToast("目标已确认，已按目标刷新今天的学习主线。");
  };

  const handleDeferGoalSelection = () => {
    saveDeferredGoalPrompt(goalUserId, true);
    setGoalPromptDeferred(true);
    setGoalModalOpen(false);
    showToast("可以稍后再定目标，首页会持续提醒你补上。");
  };

  const getRevealStyle = (key: string, delayMs = 0) => ({
    opacity: revealedSections[key] ? 1 : 0,
    transform: revealedSections[key] ? "translateY(0)" : "translateY(34px)",
    transition: `opacity 720ms cubic-bezier(0.22,1,0.36,1) ${delayMs}ms, transform 720ms cubic-bezier(0.22,1,0.36,1) ${delayMs}ms`,
  });

  const resolvedHeroLanes = DANMAKU_LANES;

  const resetDanmakuTimeline = () => {
    nextDanmakuIndexRef.current = 0;
    laneAvailableAtRef.current = new Array(resolvedHeroLanes.length).fill(0);
    setActiveDanmakus([]);
  };

  const pickDanmakuLane = (currentTime: number) => {
    const laneIndex = laneAvailableAtRef.current.findIndex((availableAt) => availableAt <= currentTime);
    return laneIndex === -1 ? 0 : laneIndex;
  };

  const spawnDanmaku = (item: DanmakuTemplate) => {
    const lane = pickDanmakuLane(item.time);
    const width = Math.max(88, item.text.length * 16 + 24);
    const duration = Math.max(DANMAKU_BASE_DURATION, width / DANMAKU_SPEED_PX_PER_SECOND + 7.2);
    laneAvailableAtRef.current[lane] = item.time + Math.min(duration * 0.42, 4.6) + DANMAKU_GAP_PX / DANMAKU_SPEED_PX_PER_SECOND;

    const activeItem: ActiveDanmaku = {
      ...item,
      lane,
      top: resolvedHeroLanes[lane],
      duration,
      width,
    };

    setActiveDanmakus((prev) => [...prev, activeItem]);
  };

  const handleVideoTimeUpdate = () => {
    const video = heroVideoRef.current;
    if (!video || !danmakuEnabled) return;

    const currentTime = video.currentTime;

    while (
      nextDanmakuIndexRef.current < HERO_DANMAKU_TIMELINE.length &&
      HERO_DANMAKU_TIMELINE[nextDanmakuIndexRef.current].time <= currentTime + 0.15
    ) {
      spawnDanmaku(HERO_DANMAKU_TIMELINE[nextDanmakuIndexRef.current]);
      nextDanmakuIndexRef.current += 1;
    }
  };

  const handleDanmakuComplete = (id: string) => {
    setActiveDanmakus((prev) => prev.filter((item) => item.id !== id));
  };

  const emitDanmakuAroundCurrentTime = (currentTime: number) => {
    const startIndex = HERO_DANMAKU_TIMELINE.findIndex((item) => item.time >= Math.max(0, currentTime - 0.12));
    if (startIndex === -1) {
      return;
    }

    let pointer = startIndex;
    while (
      pointer < HERO_DANMAKU_TIMELINE.length &&
      HERO_DANMAKU_TIMELINE[pointer].time <= currentTime + DANMAKU_SEEK_LOOKAHEAD_SECONDS
    ) {
      spawnDanmaku(HERO_DANMAKU_TIMELINE[pointer]);
      pointer += 1;
    }
  };

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;

    const handleSeeking = () => {
      const currentTime = video.currentTime;
      nextDanmakuIndexRef.current = HERO_DANMAKU_TIMELINE.findIndex((item) => item.time >= currentTime);
      if (nextDanmakuIndexRef.current === -1) {
        nextDanmakuIndexRef.current = HERO_DANMAKU_TIMELINE.length;
      }

      laneAvailableAtRef.current = new Array(resolvedHeroLanes.length).fill(currentTime);
      setActiveDanmakus([]);
      window.setTimeout(() => {
        emitDanmakuAroundCurrentTime(currentTime);
      }, 0);
    };

    const handleEnded = () => {
      resetDanmakuTimeline();
    };

    const handlePlay = () => setVideoPlaying(true);
    const handlePause = () => setVideoPlaying(false);

    video.addEventListener("seeking", handleSeeking);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [danmakuEnabled, resolvedHeroLanes]);

  useEffect(() => {
    if (!danmakuEnabled) {
      setActiveDanmakus([]);
      return;
    }

    if (videoPlaying) {
      handleVideoTimeUpdate();
    }
  }, [danmakuEnabled, videoPlaying]);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;

    const handleLoop = () => {
      if (video.currentTime < 0.35) {
        resetDanmakuTimeline();
      }
    };

    video.addEventListener("timeupdate", handleLoop);
    return () => video.removeEventListener("timeupdate", handleLoop);
  }, []);

  useEffect(() => {
    if (!overviewRootRef.current || !heroContentReady) return;
    const heroCards = overviewRootRef.current.querySelectorAll<HTMLElement>("[data-overview-hero-card]");
    const agentPills = overviewRootRef.current.querySelectorAll<HTMLElement>("[data-agent-pill]");

    if (heroCards.length) {
      gsap.fromTo(
        heroCards,
        { opacity: 0, y: 30, scale: 0.982 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.84,
          stagger: 0.08,
          ease: "power3.out",
        },
      );
    }

    if (agentPills.length) {
      gsap.fromTo(
        agentPills,
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: 0.58,
          stagger: 0.04,
          delay: 0.15,
          ease: "power2.out",
        },
      );
    }
  }, [heroContentReady, activeFlowIndex, learningGoal]);

  useEffect(() => {
    const previewVideo = continueWatchingVideoRef.current;
    if (!previewVideo) return;

    previewVideo.currentTime = 0;
    const playPromise = previewVideo.play();
    if (playPromise) {
      playPromise.catch(() => {
        // Keep the poster visible if the runtime still blocks autoplay.
      });
    }
  }, [primaryCourse?.playbackUrl]);

  useEffect(() => {
    laneAvailableAtRef.current = new Array(resolvedHeroLanes.length).fill(heroVideoRef.current?.currentTime || 0);
    setActiveDanmakus([]);
    if (danmakuEnabled && videoPlaying) {
      window.setTimeout(() => {
        handleVideoTimeUpdate();
      }, 0);
    }
  }, [danmakuEnabled, resolvedHeroLanes, videoPlaying]);

  const danmakuPlaybackState = useMemo(() => (videoPlaying ? "running" : "paused"), [videoPlaying]);
  const radarPoints = useMemo(() => {
    const centerX = 150;
    const centerY = 150;
    const baseRadius = 96;
    return capabilityMetrics.map((metric, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / capabilityMetrics.length;
      const ratio = (radarExpanded ? metric.value : 0) / 100;
      const radius = baseRadius * ratio;
      const labelRadius = 126;
      return {
        ...metric,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        labelX: centerX + Math.cos(angle) * labelRadius,
        labelY: centerY + Math.sin(angle) * labelRadius,
      };
    });
  }, [capabilityMetrics, radarExpanded]);
  const radarPolygonPoints = useMemo(
    () => radarPoints.map((point) => `${point.x},${point.y}`).join(" "),
    [radarPoints],
  );

  useEffect(() => {
    resetDanmakuTimeline();
  }, []);

  const handleRefreshRecommended = () => {
    // Shuffle recommendation cards just to feel fully responsive
    showToast("正在根据最近学习记录为您重新校准推荐课程...");
  };

  const startCourseLearning = () => {
    const resumeAt = Math.max(0, Math.floor(heroVideoRef.current?.currentTime || 0));
    navigate(`/learn?courseId=${COURSES[0].id}&startAt=${resumeAt}&autoplay=1&muted=1`);
  };

  const handleHeroParallaxMove = (event: React.MouseEvent<HTMLElement>) => {
    const rect = heroStageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const offsetX = (event.clientX - rect.left) / rect.width - 0.5;
    const offsetY = (event.clientY - rect.top) / rect.height - 0.5;
    setHeroParallax({
      x: Number((offsetX * 16).toFixed(2)),
      y: Number((offsetY * 12).toFixed(2)),
    });
  };

  const resetHeroParallax = () => {
    setHeroParallax({ x: 0, y: 0 });
  };

  return (
    <div
      ref={overviewRootRef}
      className="relative space-y-3 overflow-hidden rounded-[32px] border border-white/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.58),rgba(255,255,255,0.38))] p-2 shadow-[0_20px_50px_rgba(148,163,184,0.08)] backdrop-blur-sm select-none md:p-3"
      id="overview-workspace"
    >
      <style>{`
        @keyframes overviewFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes overviewDrift {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-14px) rotate(-2deg); }
        }
        @keyframes overviewShine {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes overviewHeroReveal {
          0% { opacity: 0; transform: translateY(18px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes overviewSoftPop {
          0% { opacity: 0; transform: translateY(22px) scale(0.9) rotate(-4deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
        }
        @keyframes overviewBadgeSlide {
          0% { opacity: 0; transform: translateX(-12px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes overviewSplashFade {
          0% { opacity: 0; transform: scale(1.04); }
          14% { opacity: 1; transform: scale(1); }
          70% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.985); }
        }
        @keyframes overviewSplashTitle {
          0% { opacity: 0; transform: translateY(20px) scale(0.96); letter-spacing: 0.18em; }
          100% { opacity: 1; transform: translateY(0) scale(1); letter-spacing: 0.02em; }
        }
        @keyframes overviewSweep {
          0% { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
          28% { opacity: 0.85; }
          100% { transform: translateX(220%) skewX(-18deg); opacity: 0; }
        }
        @keyframes overviewSectionRise {
          0% { opacity: 0; transform: translateY(32px) scale(0.985); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes overviewCardReveal {
          0% { opacity: 0; transform: translateY(22px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {showOpeningSplash && (
        <div className="pointer-events-none absolute inset-0 z-[80] overflow-hidden rounded-[36px]">
          <div
            className="absolute inset-0 bg-[linear-gradient(135deg,#08111f_0%,#10243d_38%,#1b0f1d_100%)]"
            style={{ animation: "overviewSplashFade 1.5s cubic-bezier(0.22,1,0.36,1) forwards" }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(125,211,252,0.28),transparent_22%),radial-gradient(circle_at_82%_26%,rgba(251,114,153,0.26),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(192,132,252,0.18),transparent_30%)]" />
          <div
            className="absolute inset-y-0 left-[-20%] w-[38%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.30),transparent)]"
            style={{ animation: "overviewSweep 1.2s ease-out 0.25s forwards" }}
          />
          <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
            <div
              className="rounded-full border border-white/15 bg-white/8 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.34em] text-white/78 backdrop-blur"
              style={{ animation: "overviewSplashTitle 0.62s ease-out 0.08s both" }}
            >
              BILILEARN OS
            </div>
            <h1
              className="mt-5 text-[30px] font-black leading-none tracking-[-0.05em] text-white md:text-[46px]"
              style={{ animation: "overviewSplashTitle 0.72s cubic-bezier(0.22,1,0.36,1) 0.18s both" }}
            >
              {"\u4eca\u65e5\u5b66\u4e60\u73b0\u573a\u6b63\u5728\u6253\u5f00"}
            </h1>
            <p
              className="mt-4 max-w-[520px] text-sm font-semibold leading-6 text-white/72 md:text-[15px]"
              style={{ animation: "overviewSplashTitle 0.78s cubic-bezier(0.22,1,0.36,1) 0.3s both" }}
            >
              {"\u8def\u5f84\u3001\u8d44\u6e90\u3001\u8bfe\u5802\u548c AI \u52a9\u6559\u6b63\u5728\u540c\u6b65\u8fdb\u5165\u72b6\u6001"}
            </p>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_12%,rgba(251,114,153,0.12),transparent_22%),radial-gradient(circle_at_100%_18%,rgba(125,211,252,0.14),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(255,214,231,0.16),transparent_26%)]" />
      <div className="pointer-events-none absolute left-6 top-8 grid grid-cols-8 gap-2 opacity-[0.16]">
        {Array.from({ length: 24 }).map((_, index) => (
          <span key={`overview-shell-dot-${index}`} className="h-1.5 w-1.5 rounded-full ui-ui-bg-brand" />
        ))}
      </div>
      <div className="pointer-events-none absolute right-8 top-24 h-28 w-28 rounded-full border border-white/70 bg-white/20 blur-[1px]" />
      <div className="pointer-events-none absolute bottom-10 right-10 h-20 w-20 ui-ui-radius-24 border border-white/70 bg-white/18 rotate-12" />

      <section
        ref={heroStageRef}
        onMouseMove={handleHeroParallaxMove}
        onMouseLeave={resetHeroParallax}
        className="relative overflow-hidden rounded-[30px] border border-[#f2d8e4] bg-[linear-gradient(118deg,#fff7fb_0%,#fffaf7_34%,#f4f9ff_100%)] p-4 shadow-[0_18px_44px_rgba(244,114,182,0.10)]"
        style={{
          opacity: heroContentReady ? 1 : 0,
          transform: heroContentReady ? "translateY(0)" : "translateY(22px)",
          transition: "opacity 620ms cubic-bezier(0.22,1,0.36,1), transform 620ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_18%,rgba(251,114,153,0.28),transparent_22%),radial-gradient(circle_at_92%_20%,rgba(125,211,252,0.28),transparent_22%),radial-gradient(circle_at_72%_78%,rgba(255,204,222,0.34),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.52))]" />
        <div
          className="absolute -left-12 top-8 h-44 w-44 rounded-full ui-ui-bg-brand/22 blur-3xl transition-transform duration-300 ease-out"
          style={{ transform: `translate3d(${heroParallax.x * -0.45}px, ${heroParallax.y * -0.35}px, 0)` }}
        />
        <div
          className="absolute right-[-10px] top-0 h-48 w-48 rounded-full bg-[#7dd3fc]/24 blur-3xl transition-transform duration-300 ease-out"
          style={{ transform: `translate3d(${heroParallax.x * 0.55}px, ${heroParallax.y * -0.45}px, 0)` }}
        />
        <div
          className="absolute bottom-[-24px] left-[44%] h-36 w-36 rounded-full bg-[#ffd6e7]/34 blur-3xl transition-transform duration-300 ease-out"
          style={{ transform: `translate3d(${heroParallax.x * 0.35}px, ${heroParallax.y * 0.45}px, 0)` }}
        />
        <div
          className="pointer-events-none absolute left-[-16px] top-20 hidden rounded-r-[24px] border border-white/80 bg-white/76 px-4 py-2 text-[11px] font-black tracking-[0.24em] ui-ui-text-brand shadow-[0_16px_32px_rgba(251,114,153,0.14)] lg:block"
          style={{ animation: "overviewBadgeSlide 0.7s ease-out both 0.12s", transform: `translate3d(${heroParallax.x * -0.3}px, ${heroParallax.y * -0.18}px, 0)` }}
        >
          FOR YOU
        </div>
        <div
          className="pointer-events-none absolute left-[33%] top-6 hidden rounded-full border border-white/75 bg-white/70 px-3 py-1 text-[10px] font-black ui-ui-tracking-brand text-[#0b5f85] shadow-sm lg:block"
          style={{ animation: "overviewBadgeSlide 0.7s ease-out both 0.2s", transform: `translate3d(${heroParallax.x * 0.2}px, ${heroParallax.y * -0.12}px, 0)` }}
        >
          BILI PICKS
        </div>
        <div className="pointer-events-none absolute -right-12 bottom-0 hidden h-[320px] w-[320px] md:block">
          <div
            className="absolute inset-y-10 left-0 w-[118px] overflow-hidden ui-ui-radius-28 border border-white/80 bg-white/18 shadow-[0_18px_40px_rgba(251,114,153,0.18)] backdrop-blur-md"
            style={{
              animation: "overviewSoftPop 0.8s ease-out both 0.18s, overviewFloat 7s ease-in-out infinite 0.9s",
              transform: `translate3d(${heroParallax.x * -0.55}px, ${heroParallax.y * -0.4}px, 0)`,
            }}
          >
            <img
              src={assetAnimeDual}
              alt=""
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              className="h-full w-[240px] max-w-none object-cover object-[78%_center]"
            />
          </div>
          <div
            className="absolute right-12 top-0 w-[132px] overflow-hidden rounded-[32px] border border-white/85 bg-white/20 shadow-[0_18px_40px_rgba(125,211,252,0.18)] backdrop-blur-md"
            style={{
              animation: "overviewSoftPop 0.85s ease-out both 0.28s, overviewDrift 9s ease-in-out infinite 1s",
              transform: `translate3d(${heroParallax.x * 0.75}px, ${heroParallax.y * -0.5}px, 0)`,
            }}
          >
            <img
              src={assetAnimeDual}
              alt=""
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              className="h-[248px] w-[260px] max-w-none object-cover object-[18%_center]"
            />
          </div>
          <div
            className="absolute bottom-2 right-0 w-[118px] overflow-hidden ui-ui-radius-28 border border-white/85 bg-white/22 shadow-[0_18px_40px_rgba(251,114,153,0.14)] backdrop-blur-md"
            style={{
              animation: "overviewSoftPop 0.85s ease-out both 0.4s, overviewFloat 8s ease-in-out infinite 1.1s",
              transform: `translate3d(${heroParallax.x * 0.65}px, ${heroParallax.y * 0.6}px, 0)`,
            }}
          >
            <img
              src={assetUsagiStudy}
              alt=""
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              className="h-[180px] w-full object-cover object-top"
            />
          </div>
        </div>
        <div
          className="absolute right-8 top-8 h-24 w-24 ui-ui-radius-28 border border-white/70 bg-white/28 rotate-12 shadow-[0_12px_30px_rgba(251,114,153,0.12)] backdrop-blur-md"
          style={{ animation: "overviewSoftPop 0.8s ease-out both 0.18s", transform: `translate3d(${heroParallax.x * 0.5}px, ${heroParallax.y * -0.35}px, 0) rotate(12deg)` }}
        />
        <div
          className="absolute right-24 bottom-8 h-14 w-14 rounded-full border border-white/70 bg-white/34 shadow-[0_8px_24px_rgba(125,211,252,0.16)] backdrop-blur-md"
          style={{ animation: "overviewSoftPop 0.9s ease-out both 0.3s", transform: `translate3d(${heroParallax.x * 0.35}px, ${heroParallax.y * 0.55}px, 0)` }}
        />
        <div className="pointer-events-none absolute left-8 top-10 grid grid-cols-6 gap-2 opacity-[0.34]">
          {Array.from({ length: 18 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full ui-ui-bg-brand" />
          ))}
        </div>
        <div className="pointer-events-none absolute right-12 bottom-10 grid grid-cols-6 gap-2 opacity-[0.24]">
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-[#7dd3fc]" />
          ))}
        </div>

        <div className="relative -mt-8">
          <div
            className="relative overflow-hidden rounded-[26px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,250,252,0.92))] px-5 py-3 shadow-[0_16px_36px_rgba(15,23,42,0.06)] backdrop-blur-md"
            style={{ animation: "overviewHeroReveal 0.82s cubic-bezier(0.2,0.8,0.2,1) both" }}
          >
            <section className="ui-ui-radius-24 border border-[#d8e7f3]/80 bg-[radial-gradient(circle_at_8%_0%,rgba(125,211,252,0.24),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,249,255,0.94))] p-3 shadow-[0_20px_44px_rgba(15,23,42,0.08)] backdrop-blur-sm">
              <div className="relative flex gap-3 overflow-x-auto pb-1 xl:grid xl:grid-cols-6 xl:overflow-visible xl:pb-0">
                {flowAgents.map((agent, index) => {
                  const Icon = agent.icon;
                  const isLinked = activeAgentNames.includes(agent.name);
                  return (
                    <button
                      key={agent.name}
                      type="button"
                      onClick={() => navigate(agent.route)}
                      data-agent-pill
                      className={
                        isLinked
                          ? "group gsap-hover-lift relative min-w-[186px] overflow-hidden rounded-[22px] border border-[#fb7299]/45 bg-[linear-gradient(145deg,rgba(255,244,248,0.98),rgba(255,255,255,0.94))] px-3 py-2.5 text-left shadow-[0_18px_34px_rgba(251,114,153,0.15)] ring-1 ring-white/80 transition-all hover:-translate-y-1 xl:min-w-0"
                          : "group gsap-hover-lift relative min-w-[186px] overflow-hidden rounded-[22px] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(248,251,255,0.9))] px-3 py-2.5 text-left shadow-[0_12px_24px_rgba(15,23,42,0.055)] ring-1 ring-white/70 transition-all hover:-translate-y-1 hover:border-[#bfd2e1] xl:min-w-0"
                      }
                    >
                      <div className="absolute inset-x-4 top-0 h-[2px] rounded-full bg-[linear-gradient(90deg,rgba(251,114,153,0),rgba(251,114,153,0.88),rgba(125,211,252,0.86),rgba(251,114,153,0))]" />
                      {index < flowAgents.length - 1 ? (
                        <span className="pointer-events-none absolute top-1/2 -right-3 hidden h-px w-3 bg-[linear-gradient(90deg,rgba(125,211,252,0.7),rgba(251,114,153,0.45))] xl:block" />
                      ) : null}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className={"grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-gradient-to-br " + agent.tone + " ui-ui-text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_8px_18px_rgba(15,23,42,0.08)]"}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-black tracking-[0.22em] text-[#8aa0b3]">NODE 0{index + 1}</p>
                            <h4 className="mt-0.5 truncate text-[13px] font-black text-[#111827]">{agent.name}</h4>
                          </div>
                        </div>
                        <div className={isLinked ? "flex shrink-0 items-center gap-1.5 rounded-full bg-[#111827] px-2 py-1 text-[9px] font-black text-white shadow-[0_8px_16px_rgba(17,24,39,0.18)]" : "flex shrink-0 items-center gap-1.5 rounded-full bg-white/85 px-2 py-1 text-[9px] font-black text-[#64748b] shadow-sm"}>
                          <span className={isLinked ? "h-1.5 w-1.5 rounded-full bg-[#5eead4] shadow-[0_0_10px_rgba(94,234,212,0.9)]" : "h-1.5 w-1.5 rounded-full bg-[#cbd5e1]"} />
                          <span>
                            {isLinked ? "SYNCED" : "READY"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className={isLinked ? "rounded-full bg-[#fff0f5] px-2 py-0.5 text-[10px] font-black text-[#fb7299]" : "rounded-full bg-[#f2f7fb] px-2 py-0.5 text-[10px] font-black text-[#49748f]"}>
                          {isLinked ? "已联动" : agent.tag}
                        </span>
                        <span className="text-[9px] font-black tracking-[0.18em] text-[#a3b1bf]">AGENT</span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[11px] leading-5 text-[#64748b]">{agent.role}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
              <div className="space-y-4">
                <section className={`relative overflow-hidden ui-ui-radius-24 border border-white/80 bg-[radial-gradient(circle_at_12%_0%,rgba(125,211,252,0.34),transparent_32%),radial-gradient(circle_at_88%_16%,rgba(251,114,153,0.22),transparent_34%),linear-gradient(135deg,var(--tw-gradient-stops))] p-4 shadow-[0_24px_54px_rgba(15,23,42,0.1)] ring-1 ring-white/70 ${sbtiPortrait.accent}`}>
                  <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full border border-white/70 bg-white/20 blur-sm" />
                  <div className="pointer-events-none absolute inset-x-5 top-0 h-[2px] rounded-full bg-[linear-gradient(90deg,rgba(251,114,153,0),rgba(251,114,153,0.88),rgba(125,211,252,0.8),rgba(251,114,153,0))]" />

                  <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-stretch">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/72 px-3 py-1 text-[10px] font-black tracking-[0.2em] text-[#0b5f85] shadow-sm backdrop-blur">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#5eead4] shadow-[0_0_10px_rgba(94,234,212,0.9)]" />
                            岗位能力诊断引擎
                          </p>
                          <h2 className="mt-3 text-[26px] font-black tracking-[-0.06em] ui-ui-text-ink md:text-[30px]">
                            {sbtiPortrait.title}
                          </h2>
                        </div>
                        <div className="rounded-[20px] border border-white/80 bg-white/80 px-3 py-2 text-center shadow-[0_12px_24px_rgba(15,23,42,0.06)] backdrop-blur">
                          <div className="text-[10px] font-black tracking-[0.2em] text-[#8a94a3]">SBTI</div>
                          <div className="mt-1 text-[16px] font-black ui-ui-text-brand">{sbtiPortrait.code}</div>
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/78 bg-white/72 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)] backdrop-blur">
                        <p className="text-[10px] font-black tracking-[0.22em] ui-ui-text-brand">岗位能力诊断解读</p>
                        <h3 className="mt-2 text-[20px] font-black leading-7 ui-ui-text-ink">{sbtiPortraitNarrative.headline}</h3>
                        <p className="mt-2 max-w-[620px] text-[13px] leading-6 ui-text-body">{sbtiPortraitNarrative.description}</p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-[18px] border border-white/80 bg-white/64 px-3 py-2.5 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
                          <div className="text-[9px] font-black tracking-[0.18em] text-[#8a94a3]">阶段判定</div>
                          <div className="mt-1.5 truncate text-[13px] font-black text-[#101828]">{profileSummary?.current_stage || "阶段待识别"}</div>
                        </div>
                        <div className="rounded-[18px] border border-white/80 bg-white/64 px-3 py-2.5 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
                          <div className="text-[9px] font-black tracking-[0.18em] text-[#8a94a3]">学习节奏</div>
                          <div className="mt-1.5 truncate text-[13px] font-black text-[#101828]">{profileSummary?.recommended_learning_style || "节奏待生成"}</div>
                        </div>
                        <div className="rounded-[18px] border border-white/80 bg-white/64 px-3 py-2.5 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
                          <div className="text-[9px] font-black tracking-[0.18em] text-[#8a94a3]">下一动作</div>
                          <div className="mt-1.5 truncate text-[13px] font-black text-[#101828]">{growthMap?.next_milestone || "里程碑待生成"}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {sbtiPortraitTags.slice(0, 4).map((tag) => (
                          <span key={tag} className="rounded-full border border-white/72 bg-white/76 px-3 py-1 text-[11px] font-black ui-ui-text-muted-rose shadow-sm backdrop-blur">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="relative mx-auto flex w-full max-w-[220px] flex-col justify-between overflow-hidden rounded-[30px] border border-white/82 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,246,250,0.7))] p-3 shadow-[0_20px_42px_rgba(15,23,42,0.09)] backdrop-blur">
                      <div className="absolute inset-x-5 top-4 h-px bg-[linear-gradient(90deg,transparent,rgba(251,114,153,0.72),rgba(125,211,252,0.72),transparent)]" />
                      <div className="flex items-center justify-between px-1">
                        <div>
                          <p className="text-[9px] font-black tracking-[0.2em] text-[#8a94a3]">JOB ABILITY RADAR</p>
                          <p className="mt-1 text-[13px] font-black text-[#101828]">{sbtiPortrait.code}</p>
                        </div>
                        <span className="rounded-full bg-[#fff1f5] px-2.5 py-1 text-[9px] font-black text-[#fb7299]">
                          已校准
                        </span>
                      </div>

                      <div className="mt-3 overflow-hidden rounded-[24px] border border-white/80 bg-[radial-gradient(circle_at_50%_32%,rgba(251,114,153,0.14),transparent_28%),linear-gradient(180deg,#ffffff_0%,#fff8fb_100%)] px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                        <div className="relative mx-auto h-[178px] w-[178px]">
                          <div className="absolute inset-0 rounded-full border border-[#f3d7e2]" />
                          <div className="absolute inset-[18px] rounded-full border border-[#dcecf8]" />
                          <div className="absolute inset-[38px] rounded-full border border-[#f3d7e2]" />
                          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#f3d7e2]" />
                          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#dcecf8]" />
                          <div className="absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[#eef2f7]" />
                          <div className="absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-[#f3d7e2]" />
                          <svg viewBox="0 0 178 178" className="absolute inset-0 h-full w-full overflow-visible">
                            <polygon
                              points="89,42 124,66 114,116 76,128 49,92 61,57"
                              fill="rgba(251,114,153,0.24)"
                              stroke="#fb7299"
                              strokeWidth="3"
                              strokeLinejoin="round"
                            />
                            {[
                              [89, 42, "#fb7299"],
                              [124, 66, "#8adcf7"],
                              [114, 116, "#fb7299"],
                              [76, 128, "#c7b5ff"],
                              [49, 92, "#8adcf7"],
                              [61, 57, "#fb7299"],
                            ].map(([cx, cy, color], index) => (
                              <circle key={index} cx={cx} cy={cy} r="6" fill={color as string} stroke="white" strokeWidth="3" />
                            ))}
                          </svg>
                          <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-[22px] border border-white/90 bg-white/82 text-center shadow-[0_14px_28px_rgba(251,114,153,0.14)] backdrop-blur">
                            <span className="text-[10px] font-black tracking-[0.18em] text-[#fb7299]">SBTI</span>
                            <strong className="mt-1 text-lg font-black text-[#101828]">{sbtiPortrait.code}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2">
                        <div className="rounded-[18px] bg-[#111827] px-3 py-2.5 text-white shadow-[0_12px_22px_rgba(17,24,39,0.18)]">
                          <div className="flex items-center justify-between text-[9px] font-black tracking-[0.18em] text-white/62">
                            <span>MATCH</span>
                            <span>LIVE</span>
                          </div>
                          <div className="mt-1 flex items-end justify-between">
                            <span className="text-[24px] font-black">92%</span>
                            <span className="rounded-full bg-[#5eead4]/16 px-2 py-0.5 text-[9px] font-black text-[#99f6e4]">已更新</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-[16px] border border-white/80 bg-white/76 px-3 py-2 shadow-sm">
                            <div className="text-[9px] font-black tracking-[0.18em] text-[#8a94a3]">重点策略</div>
                            <div className="mt-1 text-[11px] font-black text-[#101828]">{sbtiPortraitTags[0] || "诊断更新中"}</div>
                          </div>
                          <div className="rounded-[16px] border border-white/80 bg-white/76 px-3 py-2 shadow-sm">
                            <div className="text-[9px] font-black tracking-[0.18em] text-[#8a94a3]">驱动方式</div>
                            <div className="mt-1 text-[11px] font-black text-[#101828]">{sbtiPortraitTags[1] || "学习中生成"}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-4 flex flex-col gap-3 rounded-[22px] border border-white/72 bg-white/66 px-4 py-3 shadow-[0_10px_20px_rgba(15,23,42,0.045)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[12px] font-bold text-[#5f6b7a]">
                      已联动学习路径、资源推荐和 AI 导师问答，后续学习行为会继续刷新岗位能力诊断。
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("/job-ability-graph")}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d9e8fb] bg-white px-4 py-2.5 text-xs font-black text-[#0b5f85] shadow-sm transition-transform hover:-translate-y-0.5"
                    >
                      查看岗位能力图谱
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </section>

                <section className="ui-ui-radius-24 border border-white/76 bg-[linear-gradient(135deg,rgba(248,251,255,0.96),rgba(255,255,255,0.99))] p-5 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-[10px] font-black tracking-[0.2em] text-[#0b5f85]">AI 个性化学习</p>
                      <h2 className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#111827] md:text-[28px]">
                        AI 学习中枢
                      </h2>
                      <p className="mt-2 max-w-[720px] text-[13px] leading-6 ui-text-body">
                        把目标、路径、复习提醒和能力地图收在一起，直接告诉你下一步学什么。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/path?courseId=${currentCourseId}`)}
                      className="inline-flex items-center gap-2 rounded-full bg-[#0b5f85] px-5 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(11,95,133,0.22)] transition-transform hover:-translate-y-0.5"
                    >
                      进入 AI 学习中枢
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {personalizedLearningHubCards.map((card, index) => {
                      const Icon = card.icon;
                      const statusText =
                        index === 0
                          ? learningGoal
                            ? goalDaysLeft === 0
                              ? "今天到期"
                              : `还剩 ${goalDaysLeft ?? "--"} 天`
                            : "目标未设定"
                          : index === 1
                            ? activeLevelFitScore !== null
                              ? `${activeLevelLabel} · 匹配度 ${Math.round(activeLevelFitScore * 100)}%`
                              : `${activeLevelLabel} · 路径已接入`
                            : index === 2
                              ? nextReviewHours !== null
                                ? `${nextReviewHours} 小时后复习`
                                : "等待首轮回顾"
                              : growthMap?.next_milestone || profileSummary?.recommended_learning_style || "能力阶段持续跟踪";
                      return (
                        <button
                          key={card.eyebrow}
                          type="button"
                          onClick={() =>
                            card.action === "问 AI 助教"
                              ? openOverviewTutor({
                                  title: `${card.title} · 首页联动答疑`,
                                  subtitle: "导师会读取首页当前推荐进度、目标状态和课程上下文，再继续回答。",
                                  query: `请结合首页当前推荐卡“${card.title}”和我的学习状态，告诉我为什么现在该做这一步，以及做完后下一步是什么。`,
                                  quickPrompts: ["解释这步为什么优先", "给我最短执行路线", "做完后下一步是什么"],
                                })
                              : navigate(card.route)
                          }
                          className={`group ui-ui-radius-20 border border-white/70 bg-[linear-gradient(135deg,var(--tw-gradient-stops))] ${card.tone} p-4 text-left shadow-[0_10px_22px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,23,42,0.08)]`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase ui-ui-tracking-brand ui-text-subtle">{card.eyebrow}</p>
                              <h3 className="mt-2 text-[16px] font-black leading-6 ui-ui-text-ink">{card.title}</h3>
                            </div>
                            <div className={`rounded-2xl bg-white/88 p-2.5 shadow-sm ${card.accent}`}>
                              <Icon className="h-4.5 w-4.5" />
                            </div>
                          </div>
                          <div className="mt-3 inline-flex rounded-full bg-white/82 px-2.5 py-1 text-[10px] font-black text-[#4b5563] shadow-sm">
                            {statusText}
                          </div>
                          <p className="mt-3 line-clamp-2 text-[12px] leading-6 ui-text-secondary">{card.detail}</p>
                          <div className={`mt-4 inline-flex items-center gap-2 text-[12px] font-black ${card.accent}`}>
                            {card.action}
                            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="ui-ui-radius-24 border border-white/72 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,243,248,0.90))] p-5 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#111827] shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                      {learningGoal ? "继续上次学习" : goalPromptDeferred ? "仍需制定目标" : "先设学习目标"}
                    </span>
                    <span className="rounded-full ui-ui-bg-brand/10 px-3 py-1 text-[11px] font-black text-[var(--project-primary)]">
                      {learningGoal ? "今日主任务" : goalPromptDeferred ? "待完成" : "目标优先"}
                    </span>
                  </div>
                  <h2 className="mt-3 text-[24px] font-black leading-tight tracking-[-0.05em] text-[#111827] md:text-[30px]">
                    {learningGoal ? learningGoal.goal : goalPromptDeferred ? "你还没有制定这轮学习目标" : "先定目标，再开始今天的学习路径"}
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-[#4b5563] md:text-[15px]">
                    {learningGoal
                      ? `预计在 ${formatGoalDeadline(learningGoal.deadline)} 前完成，每天投入 ${learningGoal.dailyMinutes} 分钟。`
                      : goalPromptDeferred
                        ? "你可以先浏览页面，但学习路径、完成时间和后续推荐仍需要先补一个明确目标。"
                        : "进入概览后第一步先制定目标，我们会按目标和完成时间生成路径。"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold ui-ui-text-muted-rose shadow-sm">
                      {learningGoal ? `完成时间 ${formatGoalDeadline(learningGoal.deadline)}` : "尚未设定完成时间"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold ui-ui-text-muted-rose shadow-sm">
                      {learningGoal ? `每日 ${learningGoal.dailyMinutes} 分钟` : goalPromptDeferred ? "目标未完成，路径暂未生成" : "建议每日 30-60 分钟"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        learningGoal ? navigate(`/path?courseId=${currentCourseId}`) : setGoalModalOpen(true)
                      }
                      className="rounded-full ui-ui-bg-brand px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(251,114,153,0.24)] transition-transform hover:-translate-y-0.5"
                    >
                      {learningGoal ? "进入学习路径" : goalPromptDeferred ? "立即制定目标" : "设定学习目标"}
                    </button>
                    {learningGoal ? (
                      <button
                        type="button"
                        onClick={() => setGoalModalOpen(true)}
                        className="rounded-full border ui-border-rose bg-white px-5 py-2.5 text-sm font-black text-[#8a5666] shadow-[0_8px_20px_rgba(251,114,153,0.08)] transition-transform hover:-translate-y-0.5"
                      >
                        重新制定目标
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-5 ui-ui-radius-20 bg-white/72 px-4 py-4">
                    <p className="text-[10px] font-black uppercase ui-ui-tracking-brand text-[#8a96a3]">今日推进重点</p>
                    <p className="mt-2 text-[15px] font-black leading-6 ui-ui-text-ink">
                      {goalTaskPanels[0]?.title}，然后 {goalTaskPanels[1]?.title}。
                    </p>
                    <p className="mt-2 text-[12px] leading-6 ui-text-secondary">
                      {goalTaskPanels[2]?.detail}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {goalTaskPanels.map((panel) => (
                        <span key={panel.label} className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${panel.accent}`}>
                          {panel.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 ui-ui-radius-20 border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(248,251,255,0.92))] px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black ui-ui-tracking-brand text-[#8a96a3]">课程上下文</p>
                        <p className="mt-1 text-[15px] font-black ui-ui-text-ink">
                          {homeCourseDetail?.name || primaryCourse?.title || "当前主线课程"}
                        </p>
                      </div>
                      {homeCourseDetail?.teacher_name ? (
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#4b5563] shadow-sm">
                          {homeCourseDetail.teacher_name}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {homeCourseCapabilityChips.map((chip) => (
                        <span key={chip} className="rounded-full bg-[#fff7fa] px-2.5 py-1 text-[10px] font-black text-[#b54769]">
                          {chip}
                        </span>
                      ))}
                    </div>
                    {homeCourseTeachers.length ? (
                      <div className="mt-3 flex flex-wrap gap-2.5">
                        {homeCourseTeachers.map((teacher: CourseTeacher) => (
                          <div key={teacher.id} className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1.5 text-[11px] shadow-sm">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full ui-ui-bg-brand/12 font-black text-[#d94b7c]">
                              {teacher.name.slice(0, 1)}
                            </span>
                            <span className="font-semibold ui-ui-text-ink">{teacher.name}</span>
                            <span className="ui-text-secondary">{teacher.role}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>

              <aside className="space-y-4">
                <button
                  type="button"
                  onClick={startCourseLearning}
                  className="block w-full overflow-hidden ui-ui-radius-24 border border-white/78 bg-[linear-gradient(135deg,#fff9f7_0%,#fffefb_36%,#f6fbff_100%)] p-4 text-left shadow-[0_18px_36px_rgba(15,23,42,0.09)] transition-transform hover:-translate-y-0.5"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black ui-ui-tracking-brand text-[#0b5f85]">继续学习</p>
                      <h2 className="mt-1 text-[20px] font-black tracking-[-0.04em] text-[#111827]">继续当前主线课程</h2>
                      <p className="mt-2 text-[12px] leading-5 text-[#667085]">保留你上一次的课程上下文、视频进度和课堂氛围，直接回到当前这一轮最重要的学习内容。</p>
                    </div>
                    <span className="rounded-full bg-white/92 px-3 py-1 text-[10px] font-black text-[#0b5f85] shadow-sm">一键续学</span>
                  </div>

                  <div className="relative overflow-hidden ui-ui-radius-20 border border-white/80 bg-black shadow-[0_14px_30px_rgba(15,23,42,0.12)]">
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3 text-white">
                      <span className="rounded-full bg-black/38 px-2.5 py-1 text-[10px] font-black tracking-[0.16em] backdrop-blur">课堂上下文</span>
                      <span className="rounded-full bg-black/38 px-2.5 py-1 text-[10px] font-black backdrop-blur">进度 {primaryCourse?.progress ?? 0}%</span>
                    </div>
                    <video
                      ref={continueWatchingVideoRef}
                      autoPlay
                      loop
                      preload="metadata"
                      playsInline
                      muted
                      disablePictureInPicture
                      aria-hidden="true"
                      tabIndex={-1}
                      className="aspect-video w-full object-cover"
                      poster={primaryCourse?.image}
                      onLoadedMetadata={(event) => {
                        void event.currentTarget.play().catch(() => {
                          // Keep the poster visible if the runtime still blocks autoplay.
                        });
                      }}
                    >
                      <source src={primaryCourse?.playbackUrl || "/videos/software-engineering-4th/project-demo.mp4"} type="video/mp4" />
                    </video>
                    {danmakuEnabled ? (
                      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden bg-gradient-to-t from-black/16 via-transparent to-black/12">
                        {HERO_DANMAKU_TIMELINE.slice(0, 7).map((dan, index) => {
                          const width = Math.max(88, dan.text.length * 14 + 24);
                          const duration = Math.max(9.2, width / DANMAKU_SPEED_PX_PER_SECOND + 7.4);
                          return (
                            <span
                              key={"continue-" + dan.id}
                              className={`danmaku-item absolute whitespace-nowrap ${dan.sizeClassName} ${dan.fontWeightClassName || "font-semibold"}`}
                              style={{
                                top: DANMAKU_LANES[index % DANMAKU_LANES.length],
                                left: "100%",
                                width: `${width}px`,
                                color: dan.color,
                                animationDuration: `${duration}s`,
                                animationDelay: `-${index * 1.35}s`,
                                animationIterationCount: "infinite",
                              }}
                            >
                              {dan.text}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-white/80 bg-white/84 px-4 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
                      <div className="text-[10px] font-black tracking-[0.16em] text-[#8a94a3]">当前课程</div>
                      <div className="mt-2 text-[14px] font-black text-[#101828]">{primaryCourse?.title || "暂无课程"}</div>
                    </div>
                    <div className="rounded-[20px] border border-white/80 bg-white/84 px-4 py-3 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
                      <div className="text-[10px] font-black tracking-[0.16em] text-[#8a94a3]">学习进度</div>
                      <div className="mt-2 text-[14px] font-black text-[#101828]">已完成 {primaryCourse?.progress ?? 0}%</div>
                    </div>
                  </div>
                </button>

                <section className="ui-ui-radius-24 border border-[#e8edf2] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black ui-ui-tracking-brand text-[#8a96a3]">复习中心</p>
                      <p className="mt-1 text-base font-black ui-ui-text-ink">
                        {(reviewPlan?.cards || []).length
                          ? `${reviewPlan.cards[0].next_review_in_hours} 小时后该回顾了`
                          : "下一轮回顾已准备好"}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#0b5f85] shadow-sm">记忆计划运行中</span>
                  </div>
                  <p className="mt-2 text-xs leading-6 ui-text-body">
                    {(reviewPlan?.cards || []).length
                      ? `已为你整理 ${reviewPlan.cards.length} 张记忆卡片，建议优先回顾「${reviewPlan.cards[0].source_video}」。`
                      : "系统会把看过的视频提炼成记忆卡片，并在合适时间提醒你回顾。"}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-white/80 bg-white/84 px-4 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                      <div className="text-[10px] font-black tracking-[0.16em] text-[#8a94a3]">待复习卡片</div>
                      <div className="mt-2 text-[14px] font-black text-[#101828]">
                        {(reviewPlan?.cards || []).length ? `${reviewPlan.cards.length} 张待处理` : "已进入下一轮队列"}
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-white/80 bg-white/84 px-4 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                      <div className="text-[10px] font-black tracking-[0.16em] text-[#8a94a3]">推荐动作</div>
                      <div className="mt-2 text-[14px] font-black text-[#101828]">
                        {(reviewPlan?.cards || []).length ? "先回顾最早到期卡片" : "等待系统生成首轮复习"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-[#8a96a3]">
                      {(reviewPlan?.cards || []).length ? "系统已按时间窗口排好回顾顺序" : "后续会根据观看记录自动补全复习计划"}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/path?courseId=${primaryCourse?.id ?? COURSES[0].id}`)}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-[#0f6c7b] shadow-sm transition hover:-translate-y-0.5 hover:ui-ui-text-ink"
                    >
                      查看完整计划
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </section>
              </aside>
            </div>
          </div>
          <div className="grid gap-3">
            {false && HOME_AGENT_SEQUENCE.map((agent, index) => {
              const Icon = agent.icon;
              const tones = [
                "bg-[linear-gradient(135deg,#fff6fb_0%,#ffffff_100%)]",
                "bg-[linear-gradient(135deg,#f3faff_0%,#ffffff_100%)]",
                "bg-[linear-gradient(135deg,#fff8f3_0%,#ffffff_100%)]",
                "bg-[linear-gradient(135deg,#f9f6ff_0%,#ffffff_100%)]",
                "bg-[linear-gradient(135deg,#f4fbf7_0%,#ffffff_100%)]",
              ];
              const tags = ["岗位能力追踪", "今日路线", "即时答疑", "阶段反馈"];

              return (
                <button
                  key={agent.title}
                  type="button"
                  onClick={() => navigate(agent.route)}
                  className={`group relative min-h-[126px] overflow-hidden ui-ui-radius-24 border border-white/80 ${tones[index % tones.length]} p-4 text-left shadow-[0_12px_26px_rgba(15,23,42,0.05)] backdrop-blur transition-all hover:-translate-y-1 hover:border-[#fb7299]/30 hover:shadow-[0_18px_34px_rgba(15,23,42,0.08)]`}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.72),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0))]" />
                  <div className="absolute bottom-[-20px] right-[-10px] h-24 w-24 rounded-full ui-ui-bg-brand/8 blur-2xl transition-transform duration-500 group-hover:scale-125" />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3">
                      <div className="rounded-2xl bg-white p-2.5 ui-ui-text-brand shadow-sm">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="rounded-full bg-white/82 px-2.5 py-1 text-[10px] font-black tracking-[0.14em] ui-ui-text-brand shadow-sm">
                        {agent.tag}
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-black ui-tracking-tight text-[#111827]">{agent.title}</h3>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#4b5563]">{agent.detail}</p>
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/82 px-2.5 py-1 text-[10px] font-black text-[#0b5f85] shadow-sm">
                      立即进入
                      <span className="ui-ui-text-brand">LIVE</span>
                    </div>
                    <ArrowRight className="absolute right-0 top-1 h-4 w-4 text-[#9aa6b2] transition-transform group-hover:translate-x-1 group-hover:text-[#111827]" />
                  </div>
                </button>
              );
            })}

          </div>
        </div>
      </section>
      
      {false ? (
      <section className="relative w-full rounded-3xl overflow-hidden shadow-md group min-h-[380px] md:min-h-[460px] flex items-center bg-black">
        {/* Actual Video Element */}
        <div className="absolute inset-0">
          <video
            id="hero-video-player"
            ref={heroVideoRef}
            autoPlay
            loop
            muted={videoMuted}
            playsInline
            className={`h-full w-full object-cover transition-opacity duration-300 ${videoPlaying ? "opacity-100" : "opacity-75"} animate-referrer`}
            onTimeUpdate={handleVideoTimeUpdate}
            onLoadedData={resetDanmakuTimeline}
            onEnded={resetDanmakuTimeline}
          >
            <source
              src="/videos/software-engineering-4th/project-demo.mp4"
              type="video/mp4"
            />
          </video>
          {/* Gradient subtle shadow block shielding text metrics */}
          <div
            className={`absolute inset-0 transition-all duration-300 ${
              videoPlaying
                ? "opacity-0"
                : "bg-gradient-to-r from-[#171c22]/90 via-[#171c22]/60 to-transparent opacity-100"
            }`}
          ></div>
        </div>

        {/* Floating Danmaku Bullet comments layer */}
        {danmakuEnabled && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
            {activeDanmakus.map((dan) => (
              <div
                key={dan.id}
                className={`danmaku-item absolute whitespace-nowrap text-white ${dan.sizeClassName} ${dan.fontWeightClassName || ""}`}
                style={{
                  top: dan.top,
                  color: dan.color,
                  left: "100%",
                  width: `${dan.width}px`,
                  animationDuration: `${dan.duration}s`,
                  animationPlayState: danmakuPlaybackState,
                }}
                onAnimationEnd={() => handleDanmakuComplete(dan.id)}
              >
                {dan.text}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          aria-label="进入当前课程播放页"
          onClick={startCourseLearning}
          className="absolute inset-x-0 top-0 bottom-20 z-[15] cursor-pointer bg-transparent"
        />

        {/* Content Details Overlaid */}
        <div
          className={`relative z-20 p-8 md:p-12 lg:p-16 flex flex-col items-start w-full md:w-3/4 lg:w-2/3 transition-all duration-300 ${
            videoPlaying ? "pointer-events-none opacity-0 translate-y-3" : "pointer-events-auto opacity-100 translate-y-0"
          }`}
        >
          <div className="ui-ui-bg-brand text-white text-[11px] font-bold px-3.5 py-1 rounded-full uppercase mb-4 tracking-wider shadow-md animate-pulse">
            本周推荐 • 随堂课程导览
          </div>
          
           <h1 className="text-3xl md:text-4xl lg:text-5xl leading-[1.1] font-extrabold text-white mb-5 ui-tracking-tight drop-shadow">
             UI/UX 高原重构：高转化交互系统底蕴与设计微课
           </h1>

            <p className="text-white/90 text-sm md:text-base mb-8 font-medium max-w-[555px] drop-shadow-sm leading-relaxed">
              与 5,420 名学者共同剖析行为心理学在前端界面重构中的应用。揭示极致渲染流背后的精细逻辑，攻破设计阻塞。
            </p>

          <button
            id="hero-enter-live-room-btn"
            onClick={(e) => {
              e.stopPropagation();
              startCourseLearning();
            }}
            className="ui-ui-bg-brand hover:ui-ui-bg-brand/90 text-white font-bold text-base px-8 py-3.5 rounded-2xl flex items-center gap-2.5 transition-all hover:scale-[1.03] shadow-lg shadow-[#fb7299]/35 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-white" />
            进入互动课堂
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[linear-gradient(180deg,rgba(10,15,23,0)_0%,rgba(10,15,23,0.78)_22%,rgba(10,15,23,0.92)_100%)] px-6 pb-5 pt-14 md:px-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-sm font-black tracking-[0.08em] text-white backdrop-blur">
                UP
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-white">
                  灰原哀 · 交互系统重构研究室
                </div>
                <div className="mt-1 truncate text-xs text-white/70">
                  发布于 BiliLearn 精选课程专题 · 讲解人：课程内容组
                </div>
              </div>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-semibold text-white/78 backdrop-blur md:flex">
              <span className="h-1.5 w-1.5 rounded-full ui-ui-bg-brand" />
              <span>作者标题：UI/UX 高原重构：高转化交互系统底蕴与设计微课</span>
            </div>
          </div>
        </div>

        {/* Player controls */}
        <div className="absolute bottom-6 right-6 flex flex-wrap items-center justify-end gap-3 z-30 pointer-events-auto">
          {/* Mute toggle button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setVideoMuted(!videoMuted);
            }}
            className="w-10 h-10 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center text-white hover:ui-ui-bg-brand transition-colors cursor-pointer"
            title={videoMuted ? "开启声音" : "静音"}
          >
            {videoMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
          </button>

          {/* Pause / Play controls */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const video = document.getElementById("hero-video-player") as HTMLVideoElement;
              if (video) {
                if (videoPlaying) {
                  video.pause();
                } else {
                  video.play();
                }
                setVideoPlaying(!videoPlaying);
              }
            }}
            className="w-10 h-10 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center text-white hover:ui-ui-bg-brand transition-colors cursor-pointer"
            title={videoPlaying ? "暂停" : "放映"}
          >
            {videoPlaying ? (
              <Pause className="w-4.5 h-4.5" />
            ) : (
              <Play className="w-4.5 h-4.5 fill-white stroke-none" />
            )}
          </button>

          {/* Toggle Bullet Comment Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDanmakuEnabled(!danmakuEnabled);
            }}
            className={`h-10 rounded-full backdrop-blur-md flex items-center justify-center text-xs font-bold transition-all px-4 cursor-pointer ${
              danmakuEnabled ? "ui-ui-bg-brand text-white" : "bg-black/45 text-white/80"
            }`}
          >
            {danmakuEnabled ? "弹幕: 开启" : "弹幕: 关闭"}
          </button>

        </div>
      </section>
      ) : null}

      {/* 2. Split Dashboard Structure layout */}
      <div className="grid w-full gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        
        {/* Main Content Area Left Column */}
        <div className="flex min-w-0 flex-col gap-5">
          
          {/* A. My Ongoing Series (我的在追计划) */}
          <section
            id="ongoing-series-section"
            ref={registerRevealSection("ongoing-series")}
            data-reveal-section="ongoing-series"
            style={getRevealStyle("ongoing-series")}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-sans text-xl md:text-2xl font-bold ui-ui-text-ink flex items-center gap-2">
                <span className="w-2.5 h-5 ui-ui-bg-brand rounded-full shrink-0"></span>
                推荐学习视频
              </h2>
              <div className="flex gap-1.5">
                <button
                  onClick={() => showToast("正在切换上一组推荐视频...")}
                  className="w-8 h-8 rounded-full bg-white border ui-ui-border-app flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 ui-ui-text-muted-rose" />
                </button>
                <button
                  onClick={() => showToast("正在切换下一组推荐视频...")}
                  className="w-8 h-8 rounded-full bg-white border ui-ui-border-app flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 ui-ui-text-muted-rose" />
                </button>
              </div>
            </div>

            {/* Scrolling Card List Flex container */}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recommendedCourses.map((series, index) => {
                const seriesTitle = series.title ?? "";
                const lastWatchedEpisode = series.lastWatchedEpisode ?? "";
                let seriesTitleZh = seriesTitle;
                if (seriesTitle.includes("Advanced Machine Learning")) seriesTitleZh = "前沿机器学习实战：极深反向传播与梯度策略";
                if (seriesTitle.includes("Modern React Architecture")) seriesTitleZh = "React 高阶模式与性能优化";
                if (seriesTitle.includes("Creative Front-End CSS Physics")) seriesTitleZh = "创意前端动效与沉浸式交互";

                let lastWatchedEpisodeZh = lastWatchedEpisode;
                if (lastWatchedEpisode.includes("Ep.12 Gradient Ascent")) lastWatchedEpisodeZh = "第12讲 梯度攀升与拟合微积分公式";
                if (lastWatchedEpisode.includes("Ep.5 Context Overuse")) lastWatchedEpisodeZh = "第5讲 规避 Context 滥用造成的级联重新渲染";
                if (lastWatchedEpisode.includes("Ep.9")) lastWatchedEpisodeZh = "第9讲 粒子运动与视差层设计";

                const recommendationReasons = homeConfig.recommendationReasons;
                const recommendationBadges = homeConfig.recommendationBadges;
                const episodeLabels = homeConfig.episodeLabels;

                return (
                  <div
                    id={`ongoing-series-card-${series.id}`}
                    key={series.id}
                    data-overview-hero-card
                    onClick={() => navigate(`/learn?courseId=${series.id}`)}
                    className="group relative flex gap-4 items-stretch overflow-hidden ui-ui-radius-24 border ui-ui-border-app bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_58%,#fff8fb_100%)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all hover:border-[#fb7299]/30 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] cursor-pointer"
                  >
                    <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#fb7299_0%,#7dd3fc_100%)] opacity-80" />
                    {/* Thumbnail Image */}
                    <div className="relative h-[112px] w-[112px] rounded-2xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100 shadow-[0_10px_22px_rgba(15,23,42,0.08)] md:h-[128px] md:w-[128px]">
                      <img
                        src={series.image}
                        alt={seriesTitleZh}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-14 bg-[linear-gradient(180deg,rgba(12,16,24,0)_0%,rgba(12,16,24,0.82)_100%)]" />
                      <div className="absolute left-2 top-2 rounded-full bg-white/88 px-2 py-1 text-[9px] font-black ui-ui-text-brand shadow-sm backdrop-blur">
                        {recommendationBadges[index] || "推荐视频"}
                      </div>
                      <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white font-mono">
                        {series.progress}%
                      </div>
                    </div>

                    {/* Series Progress Details */}
                    <div className="flex min-w-0 flex-grow flex-col justify-between py-1">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-full bg-[#f7faff] px-2.5 py-1 text-[10px] font-black ui-ui-tracking-tight ui-text-navy">
                          学习进度
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#edf2f7]">
                          <div
                            className="h-full rounded-full ui-ui-bg-brand"
                            style={{ width: `${Math.max(series.progress, 48)}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-sans text-[17px] font-extrabold ui-ui-text-ink line-clamp-2 leading-snug group-hover:ui-ui-text-brand transition-colors">
                          {seriesTitleZh}
                        </h3>
                        <p className="mt-2 text-[12px] ui-ui-text-brand font-bold tracking-wide">
                          {`推荐看到 Ep.${episodeLabels[index] || "12/12"}`}
                        </p>
                      </div>

                      <div className="mt-3">
                        <div className="w-full h-1.5 bg-[#eaeef6] rounded-full overflow-hidden">
                          <div
                            className="h-full ui-ui-bg-brand rounded-full"
                            style={{ width: `${Math.max(series.progress, 48)}%` }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] ui-ui-text-muted-rose/80 line-clamp-2">
                          {recommendationReasons[index] || "系统按当前学习阶段推荐给你。"}
                        </p>
                        <p className="mt-1.5 text-[10px] font-mono ui-ui-text-muted-rose/70 truncate">
                          推荐切入点: {lastWatchedEpisodeZh}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* B. Recent learning activity moved into the main column to avoid an overlong sidebar. */}
          <section
            ref={registerRevealSection("activity-feed")}
            data-reveal-section="activity-feed"
            style={getRevealStyle("activity-feed", 60)}
            className="rounded-3xl border ui-ui-border-app bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase ui-ui-tracking-brand ui-ui-text-brand">Live Progress</p>
                <h2 className="font-sans text-lg font-extrabold ui-ui-text-ink">最新学习动态</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                实时同步
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {RECENT_ACTIVITIES.slice(0, 3).map((activity) => {
                const activityTime = activity.time ?? "";
                const activityTitle = activity.title ?? "";
                let timeZh = activityTime;
                if (activityTime.includes("2 hours ago")) timeZh = "2 小时前";
                if (activityTime.includes("Yesterday")) timeZh = "昨天";
                if (activityTime.includes("3 days ago")) timeZh = "3 天前";

                let titleZh = activityTitle;
                if (activityTitle.includes("Completed Module: Advanced React Patterns")) titleZh = "完成微课: 深度 React 性能模式";
                if (activityTitle.includes("Submitted Project: E-commerce Dashboard")) titleZh = "通关沙盒: 现代化电商仪表盘";
                if (activityTitle.includes("Started Course: UI/UX Principles")) titleZh = "开始学习: 体验设计核心原则";

                let badgeZh = activity.badge;
                if (activity.badge?.includes("Execution +5")) badgeZh = "实践力 +5";
                if (activity.badge?.includes("Output +10")) badgeZh = "创造力 +10";
                if (activity.badge?.includes("Breadth +2")) badgeZh = "知识面 +2";

                return (
                  <button
                    key={activity.id}
                    onClick={() => navigate("/job-ability-graph")}
                    className="group flex min-w-0 items-start gap-3 rounded-2xl border border-[#edf1f5] bg-[#fbfcff] p-3 text-left transition-all hover:border-[#fb7299]/30 hover:bg-white hover:shadow-sm"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full ui-ui-bg-brand/10 ui-ui-text-brand transition-colors group-hover:ui-ui-bg-brand group-hover:text-white">
                      <Award className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-xs font-bold leading-snug ui-ui-text-ink">{titleZh}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[10px] ui-ui-text-muted-rose/70">
                        <span>{timeZh}</span>
                        <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-sans text-[9px] font-bold text-emerald-800">
                          {badgeZh}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* B. Recommended for You (为您推荐) */}
          {false && (
          <section
            id="recommendations-courses-section"
            ref={registerRevealSection("recommendations")}
            data-reveal-section="recommendations"
            style={getRevealStyle("recommendations", 70)}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-sans text-xl md:text-2xl font-bold ui-ui-text-ink flex items-center gap-2">
                <span className="w-2.5 h-5 bg-[#006689] rounded-full shrink-0"></span>
                智能学术推荐
              </h2>
              <button
                onClick={handleRefreshRecommended}
                className="text-xs font-semibold ui-text-navy flex items-center gap-1.5 hover:bg-[#006689]/10 px-3.5 py-1.5 rounded-full transition-all border border-[#006689]/20 shadow-sm cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                换一换大纲
              </button>
            </div>

            {/* Bento Grid: 3 big dynamic video elements + 1 functional shortcut badge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-5">
              
              {/* Loop recommendations */}
              {COURSES.slice(0, 3).map((course) => {
                const courseTitle = course.title ?? "";
                const courseSubtitle = course.subtitle ?? "";
                const courseUploader = course.uploader ?? "";
                let courseTitleZh = courseTitle;
                if (courseTitle.includes("Advanced Machine Learning")) courseTitleZh = "前沿机器学习实战：极深反向传播与梯度策略";
                if (courseTitle.includes("Modern React Architecture")) courseTitleZh = "现代化 React 架构：极致组件虚拟化与 Context 多维切片";
                if (courseTitle.includes("Creative Front-End CSS Physics")) courseTitleZh = "创意前端物理动效：三维流体粒子系统与贝塞尔重力刚体";

                let courseSubtitleZh = courseSubtitle;
                if (courseSubtitle.includes("Dive deep into deep neural networks")) courseSubtitleZh = "深入讲解BP公式的反向求导细节与正则化";
                if (courseSubtitle.includes("Master virtual rendering")) courseSubtitleZh = "精细剖析 Fiber 递归树级联优化的防御机制";
                if (courseSubtitle.includes("Animate elements dynamically")) courseSubtitleZh = "高频画布重绘时的 GPU 缓存分层与硬件解析";

                let categoryZh = course.category === "Data" ? "数据智能" : "数字艺术";

                let uploaderZh = courseUploader;
                if (courseUploader.includes("Dr. Alexander")) uploaderZh = "刘博士 (学海带头人)";
                if (courseUploader.includes("Prof. Sarah")) uploaderZh = "萨教授 (首席主讲)";
                if (courseUploader.includes("Justin")) uploaderZh = "架构师 Justin";
                if (courseUploader.includes("TechElite Academy")) uploaderZh = "孙以澄老师";
                if (courseUploader.includes("Design Mastery Lab")) uploaderZh = "李闻川老师";
                if (courseUploader.includes("Sarah Jenkins Studio")) uploaderZh = "何青岚老师";
                if (courseUploader.includes("DataInsights Research")) uploaderZh = "乔知远老师";

                return (
                  <div
                    id={`recommended-card-${course.id}`}
                    key={course.id}
                    onClick={() => navigate(`/learn?courseId=${course.id}`)}
                    className="bg-white rounded-2xl border ui-ui-border-app overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group"
                  >
                    {/* Thumbnail Banner */}
                    <div className="relative aspect-video bg-gray-100 overflow-hidden border-b border-[#eaeef6]">
                      <img
                        src={course.image}
                        alt={courseTitleZh}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-sm text-white font-mono text-[10px] px-2 py-0.5 rounded">
                        {course.duration}
                      </div>
                      {course.progress > 0 && (
                        <div className="absolute top-2 left-2 ui-ui-bg-brand text-white font-sans font-extrabold text-[9px] px-2 py-0.5 rounded uppercase tracking-wider">
                          已研习 {course.progress}%
                        </div>
                      )}
                    </div>

                    {/* Metadata fields */}
                    <div className="p-4 flex flex-col flex-grow justify-between gap-3">
                      <div>
                        <h3 className="font-sans text-sm font-bold ui-ui-text-ink line-clamp-1 group-hover:ui-ui-text-brand transition-colors leading-snug">
                          {courseTitleZh}
                        </h3>
                        <p className="text-xs ui-ui-text-muted-rose line-clamp-1 mt-1 opacity-90">{courseSubtitleZh}</p>
                      </div>

                      <div className="mt-auto pt-3 border-t border-gray-100 flex flex-col gap-2">
                        <div className="flex items-center gap-2 ui-ui-text-muted-rose text-xs">
                          {course.uploaderAvatar ? (
                            <img
                              src={course.uploaderAvatar}
                              alt={uploaderZh}
                              className="w-4 h-4 rounded-full object-cover border border-[#ddbfc4]"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <UserCircle className="w-4 h-4 ui-ui-text-brand" />
                          )}
                          <span className="truncate font-medium">{uploaderZh}</span>
                          <span className="text-amber-500 font-bold flex items-center gap-0.5 ml-auto text-xs shrink-0">
                            <Star className="w-3.5 h-3.5 fill-amber-500 stroke-none" />
                            {course.rating} 分
                          </span>
                        </div>

                        <div className="flex items-center justify-between ui-ui-text-muted-rose/70 text-[11px] font-mono font-medium">
                          <div className="flex items-center gap-2.5">
                            <span className="flex items-center gap-1"><Play className="w-3 h-3 fill-current" /> {course.views} 次放映</span>
                            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {course.comments} 互动</span>
                          </div>
                          <span className="bg-[#f0f4fc] ui-text-navy px-2 py-0.5 rounded-md font-bold font-sans text-[10px]">
                            {categoryZh}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 4th Slot: Shortcut Features (快捷功能) inside recommendations grid */}
              <div className="ui-border-app flex flex-col justify-between gap-4 rounded-2xl border bg-white p-5 shadow-sm">
                <div>
                  <h3 className="ui-text-ink mb-1.5 flex items-center gap-1.5 font-sans text-sm font-extrabold uppercase tracking-wide">
                    <span className="ui-bg-brand h-2.5 w-2.5 rounded-full" />
                    随堂高效快捷航标
                  </h3>
                  <p className="ui-text-muted-rose select-none text-xs">为当前学习阶段准备的高频入口，便于快速进入路径、测评、资源和答疑。</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate(`/path?courseId=${COURSES[0].id}`)}
                    className="ui-text-brand flex cursor-pointer flex-col items-center justify-center rounded-xl border border-[#fb7299]/10 ui-ui-bg-brand/5 p-3 text-center transition-all hover:ui-ui-bg-brand/10"
                  >
                    <Target className="w-6 h-6 mb-1" />
                    <span className="text-xs font-bold font-sans">我的路线图</span>
                    <span className="text-[9px] opacity-75 mt-0.5 truncate max-w-full">学习里程碑进度</span>
                  </button>

                  <button
                    onClick={() => navigate(`/evaluation?courseId=${COURSES[0].id}`)}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-[#006689]/10 bg-[#006689]/5 p-3 text-center ui-text-navy transition-all hover:bg-[#006689]/10"
                  >
                    <Award className="w-6 h-6 mb-1" />
                    <span className="text-xs font-bold font-sans">随堂金牌测评</span>
                    <span className="text-[9px] opacity-75 mt-0.5 truncate max-w-full">真题小测诊断</span>
                  </button>

                  <button
                    onClick={() => navigate(`/resources?courseId=${COURSES[0].id}`)}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center text-emerald-700 transition-all hover:bg-emerald-100"
                  >
                    <BookOpen className="w-6 h-6 mb-1" />
                    <span className="text-xs font-bold font-sans">随堂金课文献</span>
                    <span className="text-[9px] opacity-75 mt-0.5 truncate max-w-full">精品幻灯课件包</span>
                  </button>

                  <button
                    onClick={() =>
                      openOverviewTutor({
                        title: "首页快捷入口 · AI 导师答疑",
                        subtitle: "导师会基于当前概览页状态，优先帮你扫清今天最影响推进的卡点。",
                        query: "请根据我当前首页状态，先判断我最可能卡住的点，再给我一个非常短的推进建议。",
                        quickPrompts: ["我最可能卡在哪", "先解决哪个问题", "今天最短推进建议"],
                      })
                    }
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-amber-100 bg-amber-50 p-3 text-center text-amber-700 transition-all hover:bg-amber-100"
                  >
                    <Bot className="w-6 h-6 mb-1 font-bold" />
                    <span className="text-xs font-bold font-sans">AI 导师答疑</span>
                    <span className="text-[9px] opacity-75 mt-0.5 truncate max-w-full">扫清思维死角</span>
                  </button>
                </div>
              </div>

            </div>
          </section>
          )}

        </div>

        {/* Right sidebar column section */}
        <aside className="flex w-full flex-col gap-4 xl:sticky xl:top-24">

          {/* B1. Capability Radar (岗位能力 Widget) */}
          <div
            ref={registerRevealSection("capability-radar")}
            data-reveal-section="capability-radar"
            style={getRevealStyle("capability-radar")}
            className="ui-border-app flex flex-col gap-3 rounded-3xl border bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h3 className="ui-text-ink flex items-center gap-1.5 font-sans text-sm font-extrabold">
                <Radar className="ui-text-brand h-4 w-4" />
                我的岗位能力五维雷达
              </h3>
              <span className="ui-text-brand rounded-full ui-ui-bg-brand/15 px-2 py-0.5 font-mono text-[9px] font-bold">
                学学金阶 LV.4
              </span>
            </div>

            <div className="ui-radius-28 relative overflow-hidden border border-[#e8edf6] bg-[linear-gradient(180deg,#f9fbff_0%,#ffffff_52%,#fff8fb_100%)] p-3">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,114,153,0.10),transparent_26%),radial-gradient(circle_at_left_bottom,rgba(59,130,246,0.10),transparent_34%)]" />
              <div className="relative mb-3 flex items-center justify-between rounded-2xl border border-white/80 bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
                <div>
                  <p className="ui-tracking-brand text-[10px] font-black uppercase text-slate-400">Radar Canvas</p>
                  <p className="ui-text-ink text-sm font-extrabold">五维能力动态展开图</p>
                </div>
                <div className="text-white rounded-full bg-[#171c22] px-2.5 py-1 text-[10px] font-black">
                  总评 {METRIC_SCORE.overallScore}
                </div>
              </div>

              <div className="ui-radius-24 relative border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(248,250,255,0.92))] px-3 py-3 shadow-[0_18px_40px_rgba(148,163,184,0.15)]">
                <div className="mx-auto w-full max-w-[220px]">
                  <svg viewBox="0 0 300 300" className="h-[190px] w-full overflow-visible">
                    {[0.2, 0.4, 0.6, 0.8, 1].map((ratio) => {
                      const ringPoints = capabilityMetrics
                        .map((_, index) => {
                          const angle = -Math.PI / 2 + (Math.PI * 2 * index) / capabilityMetrics.length;
                          const radius = 96 * ratio;
                          const x = 150 + Math.cos(angle) * radius;
                          const y = 150 + Math.sin(angle) * radius;
                          return `${x},${y}`;
                        })
                        .join(" ");
                      return (
                        <polygon
                          key={ratio}
                          points={ringPoints}
                          fill={ratio === 1 ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.16)"}
                          stroke="rgba(148,163,184,0.28)"
                          strokeWidth="1"
                        />
                      );
                    })}

                    {capabilityMetrics.map((_, index) => {
                      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / capabilityMetrics.length;
                      const x = 150 + Math.cos(angle) * 96;
                      const y = 150 + Math.sin(angle) * 96;
                      return (
                        <line
                          key={`axis-${index}`}
                          x1="150"
                          y1="150"
                          x2={x}
                          y2={y}
                          stroke="rgba(148,163,184,0.26)"
                          strokeWidth="1"
                        />
                      );
                    })}

                    <polygon
                      points={radarPolygonPoints}
                      fill="rgba(59,130,246,0.22)"
                      stroke="rgba(37,99,235,0.95)"
                      strokeWidth="3"
                      style={{
                        filter: "drop-shadow(0 12px 24px rgba(37,99,235,0.22))",
                        transition: "all 900ms cubic-bezier(0.22, 1, 0.36, 1)",
                      }}
                    />

                    {radarPoints.map((point, index) => (
                      <g key={point.label}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="8"
                          fill="white"
                          style={{ transition: "all 900ms cubic-bezier(0.22, 1, 0.36, 1)", transitionDelay: `${index * 80}ms` }}
                        />
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="5"
                          fill={point.tone.includes("#06b6d4") ? "#0ea5e9" : point.tone.includes("#14b8a6") ? "#10b981" : point.tone.includes("#f59e0b") ? "#f59e0b" : point.tone.includes("#fb7185") ? "#f97316" : "#6366f1"}
                          style={{ transition: "all 900ms cubic-bezier(0.22, 1, 0.36, 1)", transitionDelay: `${index * 80}ms` }}
                        />
                        <text
                          x={point.labelX}
                          y={point.labelY}
                          textAnchor="middle"
                          className="fill-[#334155]"
                          style={{ fontSize: "10px", fontWeight: 800 }}
                        >
                          {point.label}
                        </text>
                        <text
                          x={point.labelX}
                          y={point.labelY + 16}
                          textAnchor="middle"
                          className="fill-[#94a3b8]"
                          style={{ fontSize: "8px", fontWeight: 700 }}
                        >
                          {point.note}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {capabilityMetrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/80 px-3 py-1.5 shadow-sm"
                    >
                      <span className="text-[11px] font-black ui-ui-text-ink">{metric.label}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">
                        {metric.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-xs">
              <span className="ui-ui-text-muted-rose">学习状态: <strong className="ui-ui-text-brand font-bold">稳步进阶中</strong></span>
              <Link to="/job-ability-graph" className="ui-text-navy font-semibold hover:underline flex items-center gap-0.5">
                查看岗位能力图谱
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* B3. Secondary decorative learning banner values */}
          {false && (
          <div
            ref={registerRevealSection("event-banner")}
            data-reveal-section="event-banner"
            style={getRevealStyle("event-banner", 110)}
            className="rounded-3xl p-5 bg-gradient-to-br from-[#006689] to-[#006689]/85 text-white flex flex-col justify-between h-40 shadow-sm relative overflow-hidden"
          >
            <div className="absolute right-0 bottom-0 opacity-10 shrink-0 select-none">
              <Compass className="w-32 h-32" />
            </div>
            <div className="z-10">
              <p className="text-[10px] uppercase font-bold tracking-wider opacity-75">里程碑重大活动</p>
              <h4 className="text-sm font-extrabold mt-1 leading-snug">
                携手参与 2026 智能前端创研大赛！
              </h4>
              <p className="text-xs opacity-90 mt-1 lines-clamp-2">完成指定微自测，即可零门槛在线兑换入会资格与免费入场券。</p>
            </div>
            <button
              onClick={() => navigate("/evaluation")}
              className="bg-white ui-text-navy text-xs font-bold px-4 py-2 rounded-xl self-start hover:bg-[#f7f9ff] transition-colors shadow mt-3 cursor-pointer"
            >
              检验我的入场资格
            </button>
          </div>
          )}

        </aside>
      </div>

      {/* Beautiful In-App Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#171c22]/95 px-5 py-3 text-xs font-bold text-white shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-200">
          <span className="ui-bg-brand h-2 w-2 rounded-full animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {goalModalOpen ? (
        <div className="fixed inset-0 z-[130] flex items-start justify-center bg-[#111827]/45 px-4 pt-20 backdrop-blur-[2px] sm:pt-24">
          <div className="ui-radius-28 w-full max-w-md border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,246,249,0.96))] p-5 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--project-primary)]">学习目标</p>
                <h3 className="ui-text-ink mt-2 text-xl font-black">先告诉我这次想学成什么</h3>
                <p className="mt-2 text-sm leading-6 ui-text-body">
                  概览会先按目标生成路径、安排完成时间，再继续展示后续学习内容。
                </p>
              </div>
              {learningGoal ? (
                <button
                  type="button"
                  onClick={() => setGoalModalOpen(false)}
                  className="rounded-full border ui-border-rose bg-white px-3 py-1 text-[11px] font-black text-[#8a5666]"
                >
                  稍后修改
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDeferGoalSelection}
                  className="rounded-full border ui-border-rose bg-white px-3 py-1 text-[11px] font-black text-[#8a5666]"
                >
                  稍后选择
                </button>
              )}
            </div>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs font-black ui-ui-text-muted-rose">学习目标</span>
                <textarea
                  value={goalDraft}
                  onChange={(event) => setGoalDraft(event.target.value)}
                  rows={3}
                  placeholder="比如：本周完成 React 状态管理专题，并能独立拆分组件状态"
                  className="mt-2 w-full rounded-2xl border ui-border-rose bg-white px-4 py-3 text-sm ui-ui-text-ink outline-none transition focus:border-[#fb7299] focus:ring-2 focus:ring-[#fb7299]/15"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-black ui-ui-text-muted-rose">预计完成时间</span>
                  <input
                    type="datetime-local"
                    value={goalDeadlineDraft}
                    onChange={(event) => setGoalDeadlineDraft(event.target.value)}
                    className="mt-2 w-full rounded-2xl border ui-border-rose bg-white px-4 py-3 text-sm ui-ui-text-ink outline-none transition focus:border-[#fb7299] focus:ring-2 focus:ring-[#fb7299]/15"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black ui-ui-text-muted-rose">每日学习时长</span>
                  <input
                    type="number"
                    min="15"
                    step="5"
                    value={goalDailyMinutesDraft}
                    onChange={(event) => setGoalDailyMinutesDraft(event.target.value)}
                    className="mt-2 w-full rounded-2xl border ui-border-rose bg-white px-4 py-3 text-sm ui-ui-text-ink outline-none transition focus:border-[#fb7299] focus:ring-2 focus:ring-[#fb7299]/15"
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={handleSaveGoal}
                  className="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#fb7299_0%,#ff8f6b_100%)] px-6 py-3.5 text-base font-black text-white shadow-[0_18px_34px_rgba(251,114,153,0.30)] transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(251,114,153,0.34)]"
                >
                  <span>生成学习路径</span>
                  <ArrowRight className="h-4.5 w-4.5" />
                </button>
                <p className="pl-1 text-xs font-semibold text-[#b35b77]">会立即按目标生成阶段安排和今日任务</p>
              </div>
              {!learningGoal ? (
                <button
                  type="button"
                  onClick={handleDeferGoalSelection}
                  className="inline-flex items-center justify-center rounded-full border ui-border-rose bg-white px-5 py-2.5 text-sm font-black text-[#8a5666]"
                >
                  稍后再说
                </button>
              ) : null}
              {learningGoal ? (
                <button
                  type="button"
                  onClick={() => {
                    setGoalDraft(learningGoal.goal);
                    setGoalDeadlineDraft(learningGoal.deadline);
                    setGoalDailyMinutesDraft(String(learningGoal.dailyMinutes));
                  }}
                  className="inline-flex items-center justify-center rounded-full border ui-border-rose bg-[#fff7fa] px-5 py-2.5 text-sm font-black text-[#8a5666]"
                >
                  恢复当前目标
                </button>
              ) : null}
              {learningGoal ? (
                <button
                  type="button"
                  onClick={() => setGoalModalOpen(false)}
                  className="inline-flex items-center justify-center rounded-full border ui-border-rose bg-white px-5 py-2.5 text-sm font-black text-[#8a5666]"
                >
                  继续查看概览
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
