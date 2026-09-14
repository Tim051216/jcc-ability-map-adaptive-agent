/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link, useNavigate } from "react-router-dom";
import { Layers, Compass, Tv, FolderOpen, Heart, ClipboardCheck, BarChart2, User, Sparkles, ChevronLeft, ChevronDown, Bot, MessageCircleMore, ArrowRight, BookOpen } from "lucide-react";
import Header from "./components/Header";
import { ACTIVE_TUTOR_CONTEXT_EVENT, OPEN_TUTOR_PANEL_EVENT, loadActiveTutorContext, type TutorPanelPayload } from "./lib/tutorPanel";
import { getDemoUserIdentity } from "./lib/demoUserIdentity";
import { buildResourcesRoute, readLastRouteCourseId } from "./lib/routeCourseContext";

const routeImporters = {
  login: () => import("./pages/Login"),
  overview: () => import("./pages/Overview"),
  path: () => import("./pages/LearningPath"),
  learn: () => import("./pages/CourseLearning"),
  search: () => import("./pages/SearchResults"),
  resources: () => import("./pages/ResourceCenter"),
  resourcePreview: () => import("./pages/ResourceSourcePreview"),
  judgeResult: () => import("./pages/CodingJudgeResult"),
  evaluation: () => import("./pages/Evaluation"),
  report: () => import("./pages/StudyReport"),
  collection: () => import("./pages/Collection"),
  im: () => import("./pages/IMCenter"),
  tutor: () => import("./pages/AITutor"),
  welcome: () => import("./components/WelcomeScreen"),
  jobLearning: () => import("./pages/JobLearning"),
  jobLearningOutcomes: () => import("./pages/JobLearningOutcomes"),
  legacyOverview: () => import("./pages/Overview"),
  trialFeedback: () => import("./pages/TrialFeedback"),
  jobKnowledgeCatalog: () => import("./pages/JobKnowledgeCatalog"),
  industryDashboard: () => import("./pages/IndustryDashboard"),
  learningTaskFactory: () => import("./pages/LearningTaskFactory"),
  jobAbilityGraph: () => import("./pages/JobAbilityGraph"),
  robotOps: () => import("./pages/RobotOpsAgent"),
  aiAnnotation: () => import("./pages/AIAnnotationAgent"),
};

const Login = lazy(routeImporters.login);
const Overview = lazy(routeImporters.overview);
const LearningPath = lazy(routeImporters.path);
const CourseLearning = lazy(routeImporters.learn);
const SearchResults = lazy(routeImporters.search);
const ResourceCenter = lazy(routeImporters.resources);
const ResourceSourcePreview = lazy(routeImporters.resourcePreview);
const CodingJudgeResult = lazy(routeImporters.judgeResult);
const Evaluation = lazy(routeImporters.evaluation);
const StudyReport = lazy(routeImporters.report);
const Collection = lazy(routeImporters.collection);
const IMCenter = lazy(routeImporters.im);
const AITutor = lazy(routeImporters.tutor);
const JobLearning = lazy(routeImporters.jobLearning);
const JobLearningOutcomes = lazy(routeImporters.jobLearningOutcomes);
const TrialFeedback = lazy(routeImporters.trialFeedback);
const JobKnowledgeCatalog = lazy(routeImporters.jobKnowledgeCatalog);
const IndustryDashboard = lazy(routeImporters.industryDashboard);
const LearningTaskFactory = lazy(routeImporters.learningTaskFactory);
const JobAbilityGraph = lazy(routeImporters.jobAbilityGraph);
const RobotOpsAgent = lazy(routeImporters.robotOps);
const AIAnnotationAgent = lazy(routeImporters.aiAnnotation);

const WelcomeScreen = lazy(routeImporters.welcome);
const StudyAssistant3D = lazy(() => import("./components/StudyAssistant3D"));
const preloadedRouteKeys = new Set<string>();

const routeImporterByPath: Record<string, () => Promise<unknown>> = {
  "/": routeImporters.jobLearning,
  "/overview": routeImporters.overview,
  "/search": routeImporters.search,
  "/path": routeImporters.path,
  "/learn": routeImporters.learn,
  "/resources": routeImporters.resources,
  "/resources/preview": routeImporters.resourcePreview,
  "/resources/code-list": routeImporters.resourcePreview,
  "/resources/judge-result": routeImporters.judgeResult,
  "/collection": routeImporters.collection,
  "/evaluation": routeImporters.evaluation,
  "/report": routeImporters.report,
  "/profile": routeImporters.jobAbilityGraph,
  "/profile/conversation": routeImporters.jobAbilityGraph,
  "/im": routeImporters.im,
  "/login": routeImporters.login,
  "/job-learning": routeImporters.jobLearning,
  "/job-learning/outcomes": routeImporters.jobLearningOutcomes,
  "/job-learning/knowledge-catalog": routeImporters.jobKnowledgeCatalog,
  "/trial-feedback": routeImporters.trialFeedback,
  "/industry-dashboard": routeImporters.industryDashboard,
  "/learning-task-factory": routeImporters.learningTaskFactory,
  "/job-ability-graph": routeImporters.jobAbilityGraph,
  "/robot-ops-agent": routeImporters.robotOps,
  "/ai-annotation-agent": routeImporters.aiAnnotation,
  "/annotation-agent": routeImporters.aiAnnotation,
};

function preloadRoute(path: string) {
  const normalizedPath = path.split("?")[0] || path;
  if (preloadedRouteKeys.has(normalizedPath)) return;
  const importer = routeImporterByPath[normalizedPath];

  if (importer) {
    preloadedRouteKeys.add(normalizedPath);
    void importer().catch(() => preloadedRouteKeys.delete(normalizedPath));
  }
}

interface UserSession {
  id: string;
  name: string;
  avatar: string;
  loggedIn: boolean;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  resetKey: string;
}

class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: unknown) {
    console.error("Student route render failed:", error);
  }

  handleReset = () => {
    if (typeof window !== "undefined") {
      try {
        const currentUserId =
          window.sessionStorage.getItem(SESSION_STORAGE_KEY) ||
          window.localStorage.getItem(PERSISTENT_SESSION_STORAGE_KEY) ||
          window.localStorage.getItem(RECOVERY_SESSION_STORAGE_KEY) ||
          "";

        const userId = currentUserId ? JSON.parse(currentUserId as string)?.id || "" : "";
        if (userId) {
          window.sessionStorage.removeItem(`a3-im-cache:${userId}`);
          for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
            const key = window.sessionStorage.key(index);
            if (key?.startsWith(`a3-im-message-cache:${userId}:`)) {
              window.sessionStorage.removeItem(key);
            }
          }
        }
      } catch {
        // Ignore cache cleanup failures and still reload.
      }
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <section className="ui-radius-28 mx-auto max-w-[880px] border border-[#F3D6E3] bg-white/95 px-6 py-8 shadow-[0_20px_60px_rgba(23,28,34,0.08)]">
          <div className="inline-flex items-center rounded-full bg-[#FFF2F7] px-3 py-1 text-[11px] font-bold text-[#E85D8E]">
            页面加载失败
          </div>
          <h2 className="ui-text-ink mt-4 text-2xl font-black">当前页面没有成功渲染</h2>
          <p className="ui-text-soft mt-3 text-sm leading-6">
            我们已经拦截了这次异常，避免页面直接白屏。你可以先返回首页继续主链路，或刷新后重试当前页面。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center rounded-full bg-[#FB7299] px-5 py-2.5 text-sm font-bold text-white shadow-[0_16px_36px_rgba(251,114,153,0.28)] transition hover:translate-y-[-1px]"
            >
              返回首页
            </Link>
            <button
              type="button"
              onClick={this.handleReset}
              className="ui-border-app text-[#344054] inline-flex items-center rounded-full border bg-white px-5 py-2.5 text-sm font-bold transition hover:border-[#FB7299] hover:text-[#FB7299]"
            >
              清缓存并重试
            </button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

function normalizeUserSession(session?: Partial<UserSession> | null): UserSession {
  const id = String(session?.id || "");
  const profile = getDemoUserIdentity(id);
  const rawName = session?.name?.trim() || "";
  const useProfileName = !rawName || rawName === "BiliLearn 用户";
  return {
    id,
    name: useProfileName ? profile?.name || rawName : rawName,
    avatar: session?.avatar || profile?.avatar || "",
    loggedIn: Boolean(session?.loggedIn && id),
  };
}

type TutorDrawerState = {
  open: boolean;
  courseId?: string;
  sectionId?: number;
  query?: string;
  mode?: "default" | "learning" | "handout" | "mindmap" | "practice" | "ppt";
  title?: string;
  subtitle?: string;
  videoSrc?: string;
  videoResourceId?: number;
  videoFileId?: number;
  videoFileName?: string;
  resourceId?: number;
  resourceTitle?: string;
  resourceType?: string;
  resourceSummary?: string;
  quickPrompts?: string[];
  startAt?: number;
  autoplay?: boolean;
  muted?: boolean;
  nonce: number;
};

export const SESSION_STORAGE_KEY = "a3-student-user-session";
export const LAST_ACCOUNT_STORAGE_KEY = "a3-last-account-id";
export const PERSISTENT_SESSION_STORAGE_KEY = "a3-student-user-session-persistent";
export const RECOVERY_SESSION_STORAGE_KEY = "a3-student-user-session-recovery";
export const WELCOME_SEEN_STORAGE_KEY = "a3-student-welcome-seen";
export const APP_BROWSER_STATE_STORAGE_KEY = "a3-student-app-browser-state";
export const APP_BROWSER_SCROLL_STATE_STORAGE_KEY = "a3-student-app-browser-scroll-state";
export const ASSISTANT_BUBBLE_POSITION_STORAGE_KEY = "a3-student-assistant-bubble-position";

type AssistantBubblePosition = {
  x: number;
  y: number;
};

function getAssistantBubbleSize() {
  if (typeof window === "undefined") {
    return { width: 134, height: 174, offsetY: 94 };
  }
  const isCompact = window.innerWidth < 768;
  return {
    width: isCompact ? 116 : 134,
    height: isCompact ? 144 : 174,
    offsetY: isCompact ? 82 : 94,
  };
}

function clampAssistantBubblePosition(next: AssistantBubblePosition) {
  if (typeof window === "undefined") {
    return next;
  }
  const { width, height, offsetY } = getAssistantBubbleSize();
  const maxX = Math.max(12, window.innerWidth - width - 12);
  const maxY = Math.max(12, window.innerHeight - height - offsetY);
  return {
    x: Math.min(Math.max(next.x, 12), maxX),
    y: Math.min(Math.max(next.y, 12), maxY),
  };
}

function readAssistantBubblePosition(): AssistantBubblePosition | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(ASSISTANT_BUBBLE_POSITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AssistantBubblePosition>;
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null;
    return clampAssistantBubblePosition({ x: Number(parsed.x), y: Number(parsed.y) });
  } catch {
    return null;
  }
}

function RouteFallback() {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-[#E3E8EC] bg-white text-sm font-semibold text-[#564145]">
      正在加载当前页面，请稍候...
    </div>
  );
}

function RouteErrorBoundaryShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return <RouteErrorBoundary resetKey={`${location.pathname}${location.search}`}>{children}</RouteErrorBoundary>;
}

function GlobalAIAssistantBar() {
  const location = useLocation();

  const pageMeta: Record<string, { title: string; agent: string; status: string; nextAction: string }> = {
    "/": {
      title: "概览",
      agent: "总览调度智能体",
      status: "系统正在汇总你的进度、资源与测评结果。",
      nextAction: "先继续最近的任务，再补充关键资料。",
    },
    "/resources": {
      title: "课程与竞赛资源",
      agent: "资源生成智能体",
      status: "资源已按课程和当前检索意图整理。",
      nextAction: "优先打开最贴近当前卡点的讲义或视频。",
    },
    "/evaluation": {
      title: "岗位能力诊断",
      agent: "评估反馈智能体",
      status: "保留关键步骤，先完成本轮作答。",
      nextAction: "完成短测后，再看结果并继续追问。",
    },
    "/report": {
      title: "能力与实训报告",
      agent: "岗课赛评价智能体",
      status: "岗位能力诊断、课程训练、实训产出和复测结果已汇总。",
      nextAction: "先查看能力缺口和任务证据，再决定补资源、调路径还是继续训练。",
    },
    "/collection": {
      title: "我的任务资料",
      agent: "复习收藏智能体",
      status: "这里适合快速回看高频复习内容。",
      nextAction: "优先整理本周一定会复习的内容。",
    },
    "/learn": {
      title: "课程实训",
      agent: "课堂学习智能体",
      status: "当前页面更适合边学边问，不需要跳走。",
      nextAction: "需要调整专业方向时，打开右侧人才培养方案智能优化智能体。",
    },
    "/path": {
      title: "岗课赛训练路径",
      agent: "路径规划智能体",
      status: "这条路径会结合岗位能力诊断、当前课程进度和薄弱点，拆出接下来每一阶段具体该学什么、练什么、产出什么。",
      nextAction: "先完成当前阶段的首个关键任务，再由系统继续生成下一步学习动作。",
    },
    "/profile": {
      title: "岗位能力图谱",
      agent: "岗位能力图谱智能体",
      status: "围绕产业链、岗位群、能力单元和知识技能点组织岗位要求。",
      nextAction: "先选择目标岗位，再查看能力缺口与学习任务。",
    },
    "/im": {
      title: "IM 通讯",
      agent: "消息协同智能体",
      status: "这里集中处理课程群、助教私聊和系统通知。",
      nextAction: "优先处理未读消息，再决定是否回到路径或课堂。",
    },
    "/job-learning": {
      title: "岗课赛学习",
      agent: "岗位训练智能体",
      status: "岗位要求、课程知识和实训任务已集中到当前工作台。",
      nextAction: "先完成岗位能力诊断，再查看课程训练路径和任务产出。",
    },
    "/job-learning/knowledge-catalog": {
      title: "岗课赛知识目录",
      agent: "知识映射智能体",
      status: "每个知识条目都连接岗位能力、课程知识和可验收任务。",
      nextAction: "选择一个薄弱能力，查看对应知识点和实训验收标准。",
    },
    "/job-learning/outcomes": {
      title: "岗位训练效果",
      agent: "训练效果智能体",
      status: "汇总岗位能力测评、课程训练和实训任务完成情况。",
      nextAction: "查看当前证据是否足够，再决定下一轮训练。",
    },
    "/industry-dashboard": {
      title: "产业岗位分析",
      agent: "岗位需求分析智能体",
      status: "采集岗位技能需求，为课程和竞赛实训优化提供依据。",
      nextAction: "先确认目标专业群与岗位，再查看技能匹配和优化建议。",
    },
    "/learning-task-factory": {
      title: "岗位任务转学习卡",
      agent: "实训任务设计智能体",
      status: "把岗位典型任务转化为课程实训和技能竞赛任务卡。",
      nextAction: "输入一个软件开发岗位任务，生成步骤、知识点和验收产出。",
    },
    "/job-ability-graph": {
      title: "岗位能力图谱",
      agent: "岗位能力建模智能体",
      status: "沿产业链、岗位群、能力单元和知识技能点拆解岗位要求。",
      nextAction: "先选择软件开发工程师岗位，再查看能力缺口与课程映射。",
    },
    "/trial-feedback": {
      title: "岗课赛试用反馈",
      agent: "试用反馈智能体",
      status: "记录岗位学习、课程映射和实训任务流程中的真实体验。",
      nextAction: "完成体验后提交真实反馈；演示数据不能替代比赛用户证据。",
    },
  };

  const currentMeta = pageMeta[location.pathname] || pageMeta["/"];

  return (
    <section className="mb-3 rounded-xl border border-[#E3E8EC] bg-white/92 px-4 py-2.5 shadow-[0_10px_28px_rgba(15,23,42,0.04)] backdrop-blur">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#F3D6E3] bg-[#FFF7FA] text-[#E4002B]">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-[16px] font-extrabold text-[#171c22]">{currentMeta.title}</h2>
              <span className="rounded-full border border-[#E3E8EC] bg-[#F7F7F8] px-2.5 py-1 text-[11px] font-bold text-[#4b5563]">
                {currentMeta.agent}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[12px] text-[#5b6770]">{currentMeta.status}</p>
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-[#edf2f6] bg-[#F7F7F8] px-3 py-2 text-[12px] text-[#334155] lg:max-w-[380px]">
          <span className="font-bold text-[#E4002B]">下一步：</span>
          {currentMeta.nextAction}
        </div>
      </div>
    </section>
  );
}

function TutorRouteBridge() {
  const navigate = useNavigate();
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent<TutorPanelPayload>(OPEN_TUTOR_PANEL_EVENT, {
        detail: {
          courseId: searchParams.get("courseId") || undefined,
          sectionId: searchParams.get("sectionId") ? Number(searchParams.get("sectionId")) : undefined,
          query: searchParams.get("query") || undefined,
        },
      }),
    );
    navigate(-1);
  }, [navigate, searchParams]);

  return null;
}

function SearchRouteBridge({ onEnter }: { onEnter: () => void }) {
  useEffect(() => {
    onEnter();
  }, [onEnter]);

  return <SearchResults />;
}

function MainLayout({
  user,
  onLogout,
  tutorDrawer,
  onOpenTutor,
  onCloseTutor,
  onPreloadRoute,
  children,
}: {
  user: UserSession;
  onLogout: () => void;
  tutorDrawer: TutorDrawerState;
  onOpenTutor: (payload?: TutorPanelPayload) => void;
  onCloseTutor: () => void;
  onPreloadRoute: (path: string) => void;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";
  const isPreviewPage = location.pathname === "/resources/preview";
  const isJudgeResultPage = location.pathname === "/resources/judge-result";
  const isAnnotationAgentPage = location.pathname === "/annotation-agent" || location.pathname === "/ai-annotation-agent";
  const isShellHiddenPage = isLoginPage || isPreviewPage || isJudgeResultPage || isAnnotationAgentPage;
  const currentPath = location.pathname;
  const isNavItemActive = (itemPath: string) => {
    const normalizedPath = itemPath.split("?")[0] || itemPath;
    if (normalizedPath === "/job-learning") return currentPath === normalizedPath;
    return currentPath === normalizedPath || (normalizedPath !== "/" && currentPath.startsWith(`${normalizedPath}/`));
  };
  const desktopTutorWidthClass = tutorDrawer.open ? "lg:pr-[420px] xl:pr-[460px]" : "";
  const isOverviewPage = currentPath === "/";
  const isProductizedPage = !isShellHiddenPage;
  const isPathPage = currentPath === "/path";
  const hideCompactAgentBar = currentPath === "/path" || currentPath === "/evaluation" || currentPath === "/search";
  const [shouldRenderAssistantModel, setShouldRenderAssistantModel] = useState(false);
  const [assistantContext, setAssistantContext] = useState<TutorPanelPayload | undefined>(() => loadActiveTutorContext());
  const [assistantBubbleId, setAssistantBubbleId] = useState<string | null>(null);
  const [assistantPanelCollapsed, setAssistantPanelCollapsed] = useState(true);
  const [assistantBubblePosition, setAssistantBubblePosition] = useState<AssistantBubblePosition>(() => {
    const persisted = readAssistantBubblePosition();
    if (persisted) return persisted;
    if (typeof window === "undefined") return { x: 0, y: 0 };
    const size = getAssistantBubbleSize();
    return clampAssistantBubblePosition({
      x: Math.max(12, window.innerWidth - size.width - 12),
      y: Math.max(12, window.innerHeight - size.height - size.offsetY),
    });
  });
  const [assistantBubbleDragging, setAssistantBubbleDragging] = useState(false);
  const assistantBubbleDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const assistantBubbleSuppressClickRef = useRef(false);
  const shellContainerClass = isShellHiddenPage
    ? ""
    : isOverviewPage
      ? `mx-auto w-full max-w-[1600px] px-2 py-4 pb-24 transition-[padding] duration-300 md:px-4 md:py-5 md:pb-8 lg:px-5 xl:px-6 ${desktopTutorWidthClass}`
      : hideCompactAgentBar
        ? `mx-auto w-full max-w-[1480px] px-4 py-3 pb-24 transition-[padding] duration-300 md:px-8 md:py-4 md:pb-8 lg:px-10 xl:px-12 ${desktopTutorWidthClass}`
        : `mx-auto w-full max-w-[1480px] px-4 py-6 pb-24 transition-[padding] duration-300 md:px-8 md:py-8 md:pb-8 lg:px-10 xl:px-12 ${desktopTutorWidthClass}`;

  const navItems = [
    { label: "岗课赛工作台", id: "overview", path: "/overview", icon: Layers },
    { label: "人才培养方案智能优化", id: "industry-dashboard", path: "/industry-dashboard", icon: BarChart2 },
    { label: "岗位能力图谱", id: "job-ability-graph", path: "/job-ability-graph", icon: User },
    { label: "岗位任务转学习卡", id: "learning-task-factory", path: "/learning-task-factory", icon: ClipboardCheck },
    { label: "岗课赛自适应学习", id: "job-learning", path: "/job-learning", icon: Compass },
    { label: "岗位能力诊断", id: "evaluation", path: "/evaluation", icon: ClipboardCheck },
    { label: "课程与竞赛资源", id: "resources", path: buildResourcesRoute(readLastRouteCourseId()), icon: FolderOpen },
    { label: "能力与实训报告", id: "report", path: "/report", icon: BarChart2 },
    { label: "扩展岗位：AI 数据标注", id: "ai-annotation-agent", path: "/annotation-agent", icon: Bot },
  ];

  useEffect(() => {
    if (isShellHiddenPage || shouldRenderAssistantModel) return undefined;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || /2g/.test(connection?.effectiveType || "")) return undefined;

    let idleId: number | undefined;
    const timer = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        idleId = (window as Window & {
          requestIdleCallback: (callback: () => void, options?: { timeout: number }) => number;
        }).requestIdleCallback(() => setShouldRenderAssistantModel(true), { timeout: 5000 });
      } else {
        setShouldRenderAssistantModel(true);
      }
    }, 4000);

    return () => {
      window.clearTimeout(timer);
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
      }
    };
  }, [isShellHiddenPage, shouldRenderAssistantModel]);

  useEffect(() => {
    const refreshAssistantContext = () => setAssistantContext(loadActiveTutorContext());
    refreshAssistantContext();
    window.addEventListener(ACTIVE_TUTOR_CONTEXT_EVENT, refreshAssistantContext as EventListener);
    return () => window.removeEventListener(ACTIVE_TUTOR_CONTEXT_EVENT, refreshAssistantContext as EventListener);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (tutorDrawer.open) {
      setAssistantBubbleId(null);
      setAssistantPanelCollapsed(true);
    }
  }, [tutorDrawer.open, location.pathname]);

  useEffect(() => {
    setAssistantBubbleId(null);
    setAssistantPanelCollapsed(true);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => {
      setAssistantBubblePosition((current) => clampAssistantBubblePosition(current));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(ASSISTANT_BUBBLE_POSITION_STORAGE_KEY, JSON.stringify(assistantBubblePosition));
    } catch {
      // Ignore persistence failures.
    }
  }, [assistantBubblePosition]);

  const handleAssistantBubblePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    assistantBubbleDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: assistantBubblePosition.x,
      originY: assistantBubblePosition.y,
      moved: false,
    };
    setAssistantBubbleDragging(true);
    assistantBubbleSuppressClickRef.current = false;
  };

  const handleAssistantBubblePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = assistantBubbleDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      drag.moved = true;
    }
    setAssistantBubblePosition(
      clampAssistantBubblePosition({
        x: drag.originX + deltaX,
        y: drag.originY + deltaY,
      }),
    );
  };

  const finishAssistantBubbleDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = assistantBubbleDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    assistantBubbleDragRef.current = null;
    setAssistantBubbleDragging(false);
    assistantBubbleSuppressClickRef.current = drag.moved;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setAssistantBubblePosition((current) => clampAssistantBubblePosition(current));
  };

  const handleAssistantBubbleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (assistantBubbleSuppressClickRef.current) {
      assistantBubbleSuppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    setAssistantBubbleId(null);
    onOpenTutor();
  };

  const assistantCourseId = useMemo(() => {
    const searchCourseId = new URLSearchParams(location.search).get("courseId")?.trim();
    return searchCourseId || assistantContext?.courseId || readLastRouteCourseId() || "";
  }, [assistantContext?.courseId, location.search]);

  const assistantBubbles = useMemo(
    () => {
      return [
        {
          id: "job-trend",
          title: "岗位趋势",
          summary: "采集公开岗位并识别技能变化",
          routeLabel: "看岗位数据",
          route: "/industry-dashboard",
          prompt: "请基于可核验的公开岗位数据，分析当前专业群对应岗位的技能需求趋势；没有实时数据时请明确说明。",
        },
        {
          id: "professional-alert",
          title: "专业预警",
          summary: "检查专业匹配度与课程缺口",
          routeLabel: "看专业预警",
          route: "/industry-dashboard",
          prompt: "请对照岗位技能需求与当前专业方向，识别低匹配技能、课程缺口和需要预警的教学计划环节。",
        },
        {
          id: "optimization-plan",
          title: "优化方案",
          summary: "生成课程、实训与教学计划调整动作",
          routeLabel: "生成优化清单",
          route: "/industry-dashboard",
          prompt: "请按岗位证据、影响判断、调整对象、实施动作和复核方式，生成一份人才培养方案优化建议。",
        },
      ];
    },
    [],
  );

  const openAssistantBubbleTutor = (bubble: (typeof assistantBubbles)[number]) => {
    onOpenTutor({
      courseId: assistantCourseId || assistantContext?.courseId || undefined,
      sectionId: assistantContext?.sectionId,
      mode: assistantContext?.mode || "learning",
      title: "人才培养方案智能优化",
      subtitle: "岗位动态、专业预警与方案生成",
      videoSrc: assistantContext?.videoSrc,
      videoResourceId: assistantContext?.videoResourceId,
      videoFileId: assistantContext?.videoFileId,
      videoFileName: assistantContext?.videoFileName,
      resourceId: assistantContext?.resourceId,
      resourceTitle: assistantContext?.resourceTitle,
      resourceType: assistantContext?.resourceType,
      resourceSummary: assistantContext?.resourceSummary,
      quickPrompts:
        ["分析岗位技能趋势", "检查专业匹配度", "生成培养方案优化建议"],
      startAt: assistantContext?.startAt,
      autoplay: true,
      muted: true,
      query: bubble.prompt,
    });
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[linear-gradient(180deg,#fff9fb_0%,#f8fbff_34%,#f4f7f9_100%)] text-[#171c22]">
      {!isShellHiddenPage ? (
        <Header
          user={user}
          onLogout={onLogout}
          onOpenTutor={() => onOpenTutor()}
          contentShiftClass={desktopTutorWidthClass}
          onPreloadRoute={onPreloadRoute}
        />
      ) : null}

      <div
        className={`relative flex flex-grow flex-col ${shellContainerClass}`}
      >
        {!isShellHiddenPage ? (
          <div className="global-frame-background" aria-hidden="true">
            <img
              className="global-frame-image global-frame-image--portrait"
              src="/backgrounds/path-haibara-dog-clear-frame.webp"
              alt=""
              decoding="async"
              fetchPriority="low"
            />
            <img
              className="global-frame-image global-frame-image--water"
              src="/backgrounds/path-water-frame.webp"
              alt=""
              decoding="async"
              fetchPriority="low"
            />
          </div>
        ) : null}

        <main
          className={`relative z-[1] min-w-0 flex-grow transition-[max-width,transform] duration-300 ${
            isProductizedPage && !isPathPage ? "product-page" : ""
          } ${
            tutorDrawer.open ? "lg:origin-right" : ""
          }`}
        >
          {!isShellHiddenPage && !["/", "/collection"].includes(currentPath) && !hideCompactAgentBar ? <GlobalAIAssistantBar /> : null}
          <div key={`${location.pathname}${location.search}`}>
            {children}
          </div>
        </main>
      </div>

      {!isShellHiddenPage ? (
        <nav className="ui-border-app fixed bottom-0 left-0 right-0 z-40 flex items-center gap-1.5 overflow-x-auto border-t bg-white/95 px-3 py-2 shadow-[0_-4px_16px_rgba(23,28,34,0.06)] backdrop-blur-md md:hidden [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => {
            const isActive = isNavItemActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onMouseEnter={() => onPreloadRoute(item.path)}
                onFocus={() => onPreloadRoute(item.path)}
                onPointerDown={() => onPreloadRoute(item.path)}
                className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 pb-1.5 pt-0.5 text-[10px] font-extrabold transition-all ${
                  isActive ? "scale-105 bg-[#fb7299]/5 ui-text-brand" : "ui-text-muted-rose/80 hover:text-[#fb7299]"
                }`}
              >
                <item.icon className={`h-4.5 w-4.5 ${isActive ? "ui-text-brand" : "ui-text-muted-rose/60"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      {!isLoginPage && !isAnnotationAgentPage ? (
        <>
          <div
            className={`fixed z-[149] w-[min(292px,calc(100vw-1.5rem))] transition-all duration-300 ${
              tutorDrawer.open ? "pointer-events-none translate-y-3 opacity-0" : "pointer-events-auto translate-y-0 opacity-100"
            }`}
            style={{
              left: `${Math.max(8, Math.min(assistantBubblePosition.x - 158, window.innerWidth - 300))}px`,
              top: `${Math.max(8, assistantBubblePosition.y - (assistantPanelCollapsed ? 76 : 360))}px`,
            }}
          >
            <div className="overflow-hidden rounded-[20px] border border-white/80 bg-white/92 shadow-[0_12px_26px_rgba(15,23,42,0.08)] backdrop-blur-md">
              <button
                type="button"
                onClick={() => setAssistantPanelCollapsed((value) => !value)}
                className="flex w-full items-center justify-between gap-3 border-b border-[#eef2f6] px-3 py-2.5 text-left"
                    aria-label={assistantPanelCollapsed ? "展开培养方案优化建议" : "收起培养方案优化建议"}
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff1f6] text-[#fb7299]">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <span>
                      <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#8a94a3]">培养方案优化建议</span>
                    <span className="block text-[12px] font-semibold text-[#171c22]">
                      {assistantPanelCollapsed ? "已收起，点击展开" : "点击题目继续问"}
                    </span>
                  </span>
                </span>
                <ChevronDown className={`h-4 w-4 text-[#8a94a3] transition-transform ${assistantPanelCollapsed ? "-rotate-90" : "rotate-0"}`} />
              </button>
              {!assistantPanelCollapsed ? (
                <div className="space-y-2 p-2.5">
                  {assistantBubbles.map((bubble) => {
                    const expanded = assistantBubbleId === bubble.id;
                    return (
                      <div
                        key={bubble.id}
                        className={`rounded-[18px] border bg-white/96 transition-all ${
                          expanded ? "border-[#fb7299]/30" : "border-[#e7edf3]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setAssistantBubbleId(expanded ? null : bubble.id)}
                          className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
                        >
                          <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${bubble.id === "next" ? "bg-[#171c22] text-white" : "bg-[#fff1f6] text-[#fb7299]"}`}>
                            <Sparkles className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#8a94a3]">{bubble.title}</span>
                            <span className="mt-1 block text-[12px] leading-5 text-[#171c22]">{bubble.summary}</span>
                          </span>
                        </button>
                        {expanded ? (
                          <div className="border-t border-[#eef2f6] px-3 pb-3 pt-2">
                            <div className="flex flex-wrap gap-2">
                              <Link
                                to={bubble.route}
                                onClick={() => setAssistantBubbleId(null)}
                                className="inline-flex items-center gap-1 rounded-full bg-[#fb7299] px-3 py-1.5 text-[11px] font-black text-white shadow-[0_10px_20px_rgba(251,114,153,0.16)] transition hover:-translate-y-0.5"
                              >
                                {bubble.routeLabel}
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  setAssistantBubbleId(null);
                                  openAssistantBubbleTutor(bubble);
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-[#e7edf3] bg-white px-3 py-1.5 text-[11px] font-black text-[#171c22] transition hover:-translate-y-0.5 hover:border-[#fb7299]/30"
                              >
                                打开优化智能体
                                <Bot className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs font-semibold text-[#5b6574]">已收起，点击右侧小箭头展开</span>
                  <button
                    type="button"
                    onClick={() => setAssistantPanelCollapsed(false)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#e7edf3] bg-white px-3 py-1.5 text-[11px] font-black text-[#171c22]"
                  >
                    展开
                    <ChevronDown className="h-3.5 w-3.5 -rotate-180" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAssistantBubbleClick}
            onPointerDown={handleAssistantBubblePointerDown}
            onPointerMove={handleAssistantBubblePointerMove}
            onPointerUp={finishAssistantBubbleDrag}
            onPointerCancel={finishAssistantBubbleDrag}
            onMouseEnter={() => setShouldRenderAssistantModel(true)}
            onFocus={() => setShouldRenderAssistantModel(true)}
            className={`group fixed z-[150] flex h-[144px] w-[116px] items-end justify-center overflow-visible rounded-[30px] bg-transparent pb-2 transition-[opacity,transform,left,top] duration-300 hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-[#fb7299]/20 md:h-[174px] md:w-[134px] ${
              tutorDrawer.open ? "pointer-events-none translate-x-8 opacity-0" : "translate-x-0 opacity-100"
            } ${assistantBubbleDragging ? "cursor-grabbing transition-none" : "cursor-grab"}`}
            style={{
              left: `${assistantBubblePosition.x}px`,
              top: `${assistantBubblePosition.y}px`,
              right: "auto",
              bottom: "auto",
              touchAction: "none",
            }}
            aria-label="打开人才培养方案智能优化智能体"
            title="打开人才培养方案智能优化智能体"
          >
            <span className="absolute bottom-0 left-1/2 h-12 w-[102px] -translate-x-1/2 rounded-[999px] bg-[#fb7299]/18 blur-md transition group-hover:bg-[#fb7299]/24 md:w-[118px]" />
            <span className="absolute bottom-1 left-1/2 h-9 w-[92px] -translate-x-1/2 rounded-[999px] border border-white/80 bg-white/78 shadow-[0_16px_34px_rgba(15,23,42,0.14)] backdrop-blur-md md:w-[106px]" />
            <span className="absolute right-0 top-1 rounded-full border border-[#F6B6CA] bg-white/94 px-2.5 py-1 text-[10px] font-black text-[#fb7299] shadow-[0_10px_24px_rgba(251,114,153,0.16)] transition group-hover:-translate-y-0.5">
              方案优化
            </span>
            <span className="pointer-events-none absolute inset-x-[-22px] bottom-[7px] top-[-10px] block">
              <Suspense
                fallback={
                  <span className="absolute bottom-9 left-1/2 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full border border-[#F6B6CA] bg-white text-[#fb7299] shadow-[0_14px_30px_rgba(251,114,153,0.18)]">
                    <Bot className="h-6 w-6" />
                  </span>
                }
              >
                {shouldRenderAssistantModel ? (
                  <StudyAssistant3D
                    className="h-full w-full"
                    minHeightClassName="min-h-0"
                    minRenderWidth={150}
                    minRenderHeight={190}
                  />
                ) : (
                  <span className="absolute bottom-9 left-1/2 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full border border-[#F6B6CA] bg-white text-[#fb7299] shadow-[0_14px_30px_rgba(251,114,153,0.18)]">
                    <Bot className="h-6 w-6" />
                  </span>
                )}
              </Suspense>
            </span>
          </button>
          <div
            className={`fixed inset-0 z-[160] bg-[#0f172a]/18 transition-opacity duration-300 md:hidden ${
              tutorDrawer.open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            }`}
            onClick={onCloseTutor}
          />
          <aside
            className="ui-border-app fixed inset-y-0 right-0 left-auto z-[180] w-[min(100vw,460px)] overflow-hidden overscroll-contain border-l bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] shadow-[-18px_0_48px_rgba(15,23,42,0.08)] md:w-[420px] xl:w-[460px]"
            style={{
              left: tutorDrawer.open ? "max(0px, calc(100vw - 460px))" : "100vw",
              right: "auto",
              transform: "none",
              translate: "none",
              transition: "left 300ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <button
              type="button"
              onClick={onCloseTutor}
              className={`ui-border-app ui-text-soft absolute -left-10 top-1/2 hidden h-20 w-10 -translate-y-1/2 items-center justify-center rounded-l-2xl border border-r-0 bg-white shadow-[-8px_10px_30px_rgba(15,23,42,0.08)] transition md:flex ${
                tutorDrawer.open ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              aria-label="收起人才培养方案智能优化智能体"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {tutorDrawer.open ? (
              <Suspense fallback={<TutorDrawerFallback />}>
                <AITutor
                  user={user}
                  embedded
                  initialCourseId={tutorDrawer.courseId}
                  initialSectionId={tutorDrawer.sectionId === undefined ? undefined : String(tutorDrawer.sectionId)}
                  initialQuery={tutorDrawer.query}
                  initialMode={tutorDrawer.mode}
                  initialTitle={tutorDrawer.title}
                  initialSubtitle={tutorDrawer.subtitle}
                  initialVideoSrc={tutorDrawer.videoSrc}
                  initialVideoResourceId={tutorDrawer.videoResourceId}
                  initialVideoFileId={tutorDrawer.videoFileId}
                  initialVideoFileName={tutorDrawer.videoFileName}
                  initialResourceId={tutorDrawer.resourceId}
                  initialResourceTitle={tutorDrawer.resourceTitle}
                  initialResourceType={tutorDrawer.resourceType}
                  initialResourceSummary={tutorDrawer.resourceSummary}
                  initialQuickPrompts={tutorDrawer.quickPrompts}
                  initialStartAt={tutorDrawer.startAt}
                  initialAutoplay={tutorDrawer.autoplay}
                  initialMuted={tutorDrawer.muted}
                  onClose={onCloseTutor}
                  resetToken={tutorDrawer.nonce}
                />
              </Suspense>
            ) : null}
          </aside>
        </>
      ) : null}
    </div>
  );
}

function WelcomeScreenGate({
  showWelcome,
  tutorOpen,
  onDismiss,
}: {
  showWelcome: boolean;
  tutorOpen: boolean;
  onDismiss: () => void;
}) {
  const location = useLocation();
  const hiddenRoutes = ["/login", "/resources/preview", "/resources/judge-result", "/robot-ops-agent", "/ai-annotation-agent", "/annotation-agent"];
  const shouldHideWelcome =
    tutorOpen || hiddenRoutes.includes(location.pathname) || location.pathname.startsWith("/resources/preview") || location.pathname.startsWith("/resources/judge-result");

  if (!showWelcome || shouldHideWelcome) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <WelcomeScreen onDismiss={onDismiss} />
    </Suspense>
  );
}

function TutorDrawerFallback() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)]">
      <div className="border-b border-[#EEF2F6] px-4 py-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF2F7] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#e85d8e]">
          <Sparkles className="h-3.5 w-3.5" />
          培养方案优化智能体
        </div>
        <div className="mt-3 flex gap-2 overflow-hidden">
          <div className="h-8 w-24 rounded-full bg-[#F5F7FA]" />
          <div className="h-8 w-28 rounded-full bg-[#F5F7FA]" />
          <div className="h-8 w-20 rounded-full bg-[#F5F7FA]" />
        </div>
      </div>
      <div className="flex-1 space-y-3 px-4 py-3">
        <div className="h-20 rounded-[20px] border border-[#EEF2F6] bg-white" />
        <div className="ml-auto h-16 w-[72%] rounded-[20px] bg-[#171c22]" />
        <div className="h-24 rounded-[20px] border border-[#EEF2F6] bg-white" />
      </div>
      <div className="border-t border-[#EEF2F6] bg-white px-4 py-3">
        <div className="h-24 rounded-[22px] border border-[#E7ECF0] bg-white" />
      </div>
    </div>
  );
}

function LoginRoute({
  user,
  onLoginSuccess,
}: {
  user: UserSession;
  onLoginSuccess: (profile: Pick<UserSession, "id" | "name" | "avatar">, options?: { persist?: boolean }) => void;
}) {
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";
  return user.loggedIn ? <Navigate to={from} replace /> : <Login onLoginSuccess={onLoginSuccess} />;
}

function RouterStateSync({
  user,
  tutorDrawer,
  onRestoreTutorDrawer,
}: {
  user: UserSession;
  tutorDrawer: TutorDrawerState;
  onRestoreTutorDrawer: (state: TutorDrawerState) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [didRestore, setDidRestore] = useState(false);
  const routeKey = `${location.pathname}${location.search}`;

  useEffect(() => {
    if (!user.loggedIn || didRestore) {
      return;
    }

    try {
      const raw = localStorage.getItem(APP_BROWSER_STATE_STORAGE_KEY);
      if (!raw) {
        setDidRestore(true);
        return;
      }

      const stored = JSON.parse(raw) as {
        path?: string;
        search?: string;
        scrollY?: number;
        tutorDrawer?: Omit<TutorDrawerState, "nonce"> | null;
      };

      const currentUrl = `${location.pathname}${location.search}`;
      const targetUrl = `${stored.path || "/"}${stored.search || ""}`;
      const canRestoreStoredRoute =
        Boolean(stored.path) &&
        !stored.path.startsWith("/resources/preview") &&
        !stored.path.startsWith("/resources/judge-result");

      if ((location.pathname === "/" || location.pathname === "/login") && canRestoreStoredRoute && currentUrl !== targetUrl) {
        navigate(targetUrl, { replace: true });
      }

      if (stored.tutorDrawer?.open) {
        onRestoreTutorDrawer({
          ...stored.tutorDrawer,
          nonce: Date.now(),
        });
      }

      if (typeof stored.scrollY === "number" && currentUrl === targetUrl) {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            window.scrollTo({ top: stored.scrollY, behavior: "auto" });
          });
        });
      }
    } catch {
      // Ignore malformed browser recovery state.
    } finally {
      setDidRestore(true);
    }
  }, [didRestore, location.pathname, location.search, navigate, onRestoreTutorDrawer, user.loggedIn]);

  useEffect(() => {
    if (!user.loggedIn) {
      return;
    }

    const serializableTutorDrawer: Omit<TutorDrawerState, "nonce"> = {
      open: tutorDrawer.open,
      courseId: tutorDrawer.courseId,
      sectionId: tutorDrawer.sectionId,
      query: tutorDrawer.query,
      mode: tutorDrawer.mode,
      title: tutorDrawer.title,
      subtitle: tutorDrawer.subtitle,
      videoSrc: tutorDrawer.videoSrc,
      videoResourceId: tutorDrawer.videoResourceId,
      videoFileId: tutorDrawer.videoFileId,
      videoFileName: tutorDrawer.videoFileName,
      resourceId: tutorDrawer.resourceId,
      resourceTitle: tutorDrawer.resourceTitle,
      resourceType: tutorDrawer.resourceType,
      resourceSummary: tutorDrawer.resourceSummary,
      quickPrompts: tutorDrawer.quickPrompts,
      startAt: tutorDrawer.startAt,
      autoplay: tutorDrawer.autoplay,
      muted: tutorDrawer.muted,
    };

    localStorage.setItem(
      APP_BROWSER_STATE_STORAGE_KEY,
      JSON.stringify({
        path: location.pathname,
        search: location.search,
        scrollY: window.scrollY,
        tutorDrawer: serializableTutorDrawer,
      }),
    );
  }, [location.pathname, location.search, tutorDrawer, user.loggedIn]);

  useEffect(() => {
    if (!user.loggedIn) {
      return;
    }

    try {
      const raw = localStorage.getItem(APP_BROWSER_SCROLL_STATE_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, number>;
      const savedY = parsed?.[routeKey];
      if (typeof savedY !== "number") {
        return;
      }

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: savedY, behavior: "auto" });
        });
      });
    } catch {
      // Ignore malformed scroll recovery state.
    }
  }, [routeKey, user.loggedIn]);

  useEffect(() => {
    if (!user.loggedIn) {
      return;
    }

    let persistTimer: number | null = null;
    const persistScroll = () => {
      if (persistTimer !== null) {
        return;
      }
      persistTimer = window.setTimeout(() => {
        persistTimer = null;
        try {
          const raw = localStorage.getItem(APP_BROWSER_SCROLL_STATE_STORAGE_KEY);
          const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
          parsed[routeKey] = window.scrollY;
          localStorage.setItem(APP_BROWSER_SCROLL_STATE_STORAGE_KEY, JSON.stringify(parsed));
        } catch {
          // Ignore scroll persistence errors.
        }
      }, 180);
    };

    const persistScrollNow = () => {
      if (persistTimer !== null) {
        window.clearTimeout(persistTimer);
        persistTimer = null;
      }
      try {
        const raw = localStorage.getItem(APP_BROWSER_SCROLL_STATE_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
        parsed[routeKey] = window.scrollY;
        localStorage.setItem(APP_BROWSER_SCROLL_STATE_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // Ignore scroll persistence errors.
      }
    };

    window.addEventListener("scroll", persistScroll, { passive: true });
    window.addEventListener("beforeunload", persistScrollNow);

    return () => {
      persistScrollNow();
      window.removeEventListener("scroll", persistScroll);
      window.removeEventListener("beforeunload", persistScrollNow);
    };
  }, [routeKey, user.loggedIn]);

  return null;
}

export default function App() {
  const [showWelcome, setShowWelcome] = useState(false);
  const [persistLogin, setPersistLogin] = useState(false);
  const [tutorDrawer, setTutorDrawer] = useState<TutorDrawerState>({ open: false, nonce: 0 });

  useEffect(() => {
    (window as { retriggerWelcome?: () => void }).retriggerWelcome = () => {
      sessionStorage.setItem("hasSeenWelcome", "true");
      localStorage.setItem(WELCOME_SEEN_STORAGE_KEY, "true");
      setShowWelcome(true);
    };
    return () => {
      delete (window as { retriggerWelcome?: () => void }).retriggerWelcome;
    };
  }, []);

  useEffect(() => {
    const handleOpenTutor = (event: Event) => {
      const detail = (event as CustomEvent<TutorPanelPayload>).detail || {};
      setTutorDrawer({
        open: true,
        courseId: detail.courseId,
        sectionId: detail.sectionId,
        query: detail.query,
        mode: detail.mode,
        title: detail.title,
        subtitle: detail.subtitle,
        videoSrc: detail.videoSrc,
        videoResourceId: detail.videoResourceId,
        videoFileId: detail.videoFileId,
        videoFileName: detail.videoFileName,
        resourceId: detail.resourceId,
        resourceTitle: detail.resourceTitle,
        resourceType: detail.resourceType,
        resourceSummary: detail.resourceSummary,
        quickPrompts: detail.quickPrompts,
        startAt: detail.startAt,
        autoplay: detail.autoplay,
        muted: detail.muted,
        nonce: Date.now(),
      });
    };

    window.addEventListener(OPEN_TUTOR_PANEL_EVENT, handleOpenTutor as EventListener);
    return () => window.removeEventListener(OPEN_TUTOR_PANEL_EVENT, handleOpenTutor as EventListener);
  }, []);

  const [user, setUser] = useState<UserSession>(() => {
    try {
      const raw =
        sessionStorage.getItem(SESSION_STORAGE_KEY) ||
        localStorage.getItem(PERSISTENT_SESSION_STORAGE_KEY) ||
        localStorage.getItem(RECOVERY_SESSION_STORAGE_KEY);
      if (!raw) {
        return { id: "", name: "", avatar: "", loggedIn: false };
      }
      const parsed = JSON.parse(raw) as UserSession;
      return parsed?.loggedIn ? normalizeUserSession(parsed) : { id: "", name: "", avatar: "", loggedIn: false };
    } catch {
      return { id: "", name: "", avatar: "", loggedIn: false };
    }
  });

  useEffect(() => {
    try {
      // Do not auto-open the welcome page on startup.
      const welcomeSeen =
        sessionStorage.getItem("hasSeenWelcome") === "true" ||
        localStorage.getItem(WELCOME_SEEN_STORAGE_KEY) === "true";
      if (welcomeSeen) {
        setShowWelcome(false);
      }

      const persistentRaw = localStorage.getItem(PERSISTENT_SESSION_STORAGE_KEY);
      if (!persistentRaw) {
        setPersistLogin(false);
        return;
      }
      const parsed = JSON.parse(persistentRaw) as UserSession;
      setPersistLogin(Boolean(parsed?.loggedIn));
    } catch {
      setPersistLogin(false);
    }
  }, []);

  useEffect(() => {
    if (user.loggedIn) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem(LAST_ACCOUNT_STORAGE_KEY, user.id);
      localStorage.setItem(RECOVERY_SESSION_STORAGE_KEY, JSON.stringify(user));
      if (persistLogin) {
        localStorage.setItem(PERSISTENT_SESSION_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(PERSISTENT_SESSION_STORAGE_KEY);
      }
      return;
    }

    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(PERSISTENT_SESSION_STORAGE_KEY);
    localStorage.removeItem(RECOVERY_SESSION_STORAGE_KEY);
    localStorage.removeItem(APP_BROWSER_STATE_STORAGE_KEY);
    localStorage.removeItem(APP_BROWSER_SCROLL_STATE_STORAGE_KEY);
  }, [persistLogin, user]);

  const handleLoginSuccess = (
    userData: { id: string; name: string; avatar: string },
    options?: { persist?: boolean },
  ) => {
    setPersistLogin(Boolean(options?.persist));
    setUser(normalizeUserSession({
      ...userData,
      loggedIn: true,
    }));
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(PERSISTENT_SESSION_STORAGE_KEY);
    localStorage.removeItem(RECOVERY_SESSION_STORAGE_KEY);
    localStorage.removeItem(APP_BROWSER_STATE_STORAGE_KEY);
    localStorage.removeItem(APP_BROWSER_SCROLL_STATE_STORAGE_KEY);
    setUser({
      id: "",
      name: "",
      avatar: "",
      loggedIn: false,
    });
    setPersistLogin(false);
    setShowWelcome(false);
    setTutorDrawer({ open: false, nonce: Date.now() });
  };

  const handleOpenTutor = (payload?: TutorPanelPayload) => {
    const activeContext = loadActiveTutorContext();
    const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
    const allowStoredLearningContext = currentPath === "/learn";
    const resolvedPayload =
      payload && (payload.courseId || payload.title || payload.subtitle || payload.query || payload.sectionId !== undefined)
        ? payload
        : allowStoredLearningContext
          ? activeContext
          : undefined;
    setTutorDrawer({
      open: true,
      courseId: resolvedPayload?.courseId,
      sectionId: resolvedPayload?.sectionId,
      query: resolvedPayload?.query,
      mode: resolvedPayload?.mode,
      title: resolvedPayload?.title,
      subtitle: resolvedPayload?.subtitle,
      videoSrc: resolvedPayload?.videoSrc,
      videoResourceId: resolvedPayload?.videoResourceId,
      videoFileId: resolvedPayload?.videoFileId,
      videoFileName: resolvedPayload?.videoFileName,
      resourceId: resolvedPayload?.resourceId,
      resourceTitle: resolvedPayload?.resourceTitle,
      resourceType: resolvedPayload?.resourceType,
      resourceSummary: resolvedPayload?.resourceSummary,
      quickPrompts: resolvedPayload?.quickPrompts,
      startAt: resolvedPayload?.startAt,
      autoplay: resolvedPayload?.autoplay,
      muted: resolvedPayload?.muted,
      nonce: Date.now(),
    });
  };

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const location = useLocation();
    if (location.pathname === "/resources/preview" || location.pathname === "/resources/judge-result" || location.pathname === "/robot-ops-agent") {
      return <>{children}</>;
    }
    if (!user.loggedIn) {
      return <Navigate to="/login" replace state={{ from: location }} />;
    }
    return <>{children}</>;
  };

  return (
    <BrowserRouter>
      <WelcomeScreenGate
        showWelcome={showWelcome}
        tutorOpen={tutorDrawer.open}
        onDismiss={() => {
          sessionStorage.setItem("hasSeenWelcome", "true");
          localStorage.setItem(WELCOME_SEEN_STORAGE_KEY, "true");
          setShowWelcome(false);
        }}
      />

      <RouterStateSync
        user={user}
        tutorDrawer={tutorDrawer}
        onRestoreTutorDrawer={(state) => setTutorDrawer(state)}
      />

      <MainLayout
        user={user}
        onLogout={handleLogout}
        tutorDrawer={tutorDrawer}
        onOpenTutor={handleOpenTutor}
        onCloseTutor={() => setTutorDrawer((prev) => ({ ...prev, open: false }))}
        onPreloadRoute={preloadRoute}
      >
        <RouteErrorBoundaryShell>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route
                path="/login"
                element={<LoginRoute user={user} onLoginSuccess={handleLoginSuccess} />}
              />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <JobLearning />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/overview"
                element={
                  <ProtectedRoute>
                    <Overview user={user} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Navigate to="/job-ability-graph" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile/conversation"
                element={
                  <ProtectedRoute>
                    <Navigate to="/job-ability-graph" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/im"
                element={
                  <ProtectedRoute>
                    <IMCenter user={user} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/path"
                element={
                  <ProtectedRoute>
                    <LearningPath />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/learn"
                element={
                  <ProtectedRoute>
                    <CourseLearning />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/search"
                element={
                  <ProtectedRoute>
                    <SearchRouteBridge onEnter={() => setTutorDrawer((prev) => (prev.open ? { ...prev, open: false } : prev))} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/resources"
                element={
                  <ProtectedRoute>
                    <ResourceCenter />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/resources/preview"
                element={
                  <ProtectedRoute>
                    <ResourceSourcePreview />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/resources/code-list"
                element={
                  <ProtectedRoute>
                    <ResourceSourcePreview />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/resources/judge-result"
                element={
                  <ProtectedRoute>
                    <CodingJudgeResult />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/collection"
                element={
                  <ProtectedRoute>
                    <Collection />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/report"
                element={
                  <ProtectedRoute>
                    <StudyReport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/evaluation"
                element={
                  <ProtectedRoute>
                    <Evaluation />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tutor"
                element={
                  <ProtectedRoute>
                    <TutorRouteBridge />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/job-learning"
                element={
                  <ProtectedRoute>
                    <JobLearning />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/job-learning/outcomes"
                element={
                  <ProtectedRoute>
                    <JobLearningOutcomes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/job-learning/knowledge-catalog"
                element={
                  <ProtectedRoute>
                    <JobKnowledgeCatalog />
                  </ProtectedRoute>
                }
              />
              <Route path="/industry-dashboard" element={<ProtectedRoute><IndustryDashboard /></ProtectedRoute>} />
              <Route path="/learning-task-factory" element={<ProtectedRoute><LearningTaskFactory /></ProtectedRoute>} />
              <Route path="/job-ability-graph" element={<ProtectedRoute><JobAbilityGraph /></ProtectedRoute>} />
              <Route path="/robot-ops-agent" element={<ProtectedRoute><RobotOpsAgent /></ProtectedRoute>} />
              <Route path="/ai-annotation-agent" element={<ProtectedRoute><AIAnnotationAgent /></ProtectedRoute>} />
              <Route path="/annotation-agent" element={<ProtectedRoute><AIAnnotationAgent /></ProtectedRoute>} />
              <Route
                path="/trial-feedback"
                element={
                  <ProtectedRoute>
                    <TrialFeedback />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundaryShell>
      </MainLayout>
    </BrowserRouter>
  );
}
