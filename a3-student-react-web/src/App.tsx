/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link, useNavigate } from "react-router-dom";
import { Layers, Compass, Tv, FolderOpen, Heart, ClipboardCheck, BarChart2, User, Sparkles, ChevronLeft, Bot, MessageCircleMore } from "lucide-react";
import { OPEN_TUTOR_PANEL_EVENT, loadActiveTutorContext, type TutorPanelPayload } from "./lib/tutorPanel";
import { getDemoUserIdentity } from "./lib/demoUserIdentity";
import { buildResourcesRoute, readLastRouteCourseId } from "./lib/routeCourseContext";

const Header = lazy(() => import("./components/Header"));
const Login = lazy(() => import("./pages/Login"));
const Overview = lazy(() => import("./pages/Overview"));
const LearningPath = lazy(() => import("./pages/LearningPath"));
const CourseLearning = lazy(() => import("./pages/CourseLearning"));
const ResourceCenter = lazy(() => import("./pages/ResourceCenter"));
const ResourceSourcePreview = lazy(() => import("./pages/ResourceSourcePreview"));
const CapabilityModel = lazy(() => import("./pages/CapabilityModel"));
const Evaluation = lazy(() => import("./pages/Evaluation"));
const StudyReport = lazy(() => import("./pages/StudyReport"));
const Collection = lazy(() => import("./pages/Collection"));
const IMCenter = lazy(() => import("./pages/IMCenter"));
const AITutor = lazy(() => import("./pages/AITutor"));
const WelcomeScreen = lazy(() => import("./components/WelcomeScreen"));

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

function RouteFallback() {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-[#E3E8EC] bg-white text-sm font-semibold text-[#564145]">
      正在生成与你当前画像和课程进度匹配的学习路径，请稍候...
    </div>
  );
}

function RouteErrorBoundaryShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return <RouteErrorBoundary resetKey={`${location.pathname}${location.search}`}>{children}</RouteErrorBoundary>;
}

function GlobalAIAssistantBar() {
  const location = useLocation();

  const pageMeta: Record<string, { title: string; status: string; nextAction: string }> = {
    "/": {
      title: "概览",
      status: "系统正在汇总你的进度、资源与测评结果。",
      nextAction: "先继续最近的任务，再补充关键资料。",
    },
    "/resources": {
      title: "资源中心",
      status: "资源已按课程和当前检索意图整理。",
      nextAction: "优先打开最贴近当前卡点的讲义或视频。",
    },
    "/evaluation": {
      title: "测评",
      status: "保留关键步骤，先完成本轮作答。",
      nextAction: "完成短测后，再看结果并继续追问。",
    },
    "/report": {
      title: "报告",
      status: "这一阶段的关键结论、薄弱点和下一步方向都已经帮你收好。",
      nextAction: "先看最该补的点，再决定是补资源、调路径还是继续练题。",
    },
    "/collection": {
      title: "收藏",
      status: "这里适合快速回看高频复习内容。",
      nextAction: "优先整理本周一定会复习的内容。",
    },
    "/learn": {
      title: "课堂",
      status: "当前页面更适合边学边问，不需要跳走。",
      nextAction: "有卡点时直接打开右侧 AI 导师。",
    },
    "/path": {
      title: "个性化学习路径",
      status: "这条路径会结合你的学习画像、当前课程进度和薄弱点，拆出接下来每一阶段具体该学什么、练什么、产出什么。",
      nextAction: "先完成当前阶段的首个关键任务，再由系统继续生成下一步学习动作。",
    },
    "/profile": {
      title: "画像",
      status: "画像只保留对后续学习决策有帮助的信息。",
      nextAction: "对照薄弱项调整资源和练习顺序。",
    },
    "/im": {
      title: "IM 通讯",
      status: "这里集中处理课程群、助教私聊和系统通知。",
      nextAction: "优先处理未读消息，再决定是否回到路径或课堂。",
    },
  };

  const currentMeta = pageMeta[location.pathname] || pageMeta["/"];

  return (
<section className="mb-3 rounded-[22px] bg-white px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.04)] ring-1 ring-[#E9EEF2]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF2F7] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#e85d8e]">
            <Bot className="h-3.5 w-3.5" />
            Assistant
          </div>
          <div className="mt-2 flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
            <h2 className="text-[17px] font-extrabold text-[#171c22]">{currentMeta.title}</h2>
            <p className="text-[13px] text-[#5b6770]">{currentMeta.status}</p>
          </div>
        </div>

        <div className="rounded-[18px] border border-[#edf2f6] bg-[#F7FAFC] px-3.5 py-2 text-[13px] text-[#334155] lg:max-w-[360px]">
          <span className="font-bold text-[#e85d8e]">下一步：</span>
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

function MainLayout({
  user,
  onLogout,
  tutorDrawer,
  onOpenTutor,
  onCloseTutor,
  children,
}: {
  user: UserSession;
  onLogout: () => void;
  tutorDrawer: TutorDrawerState;
  onOpenTutor: (payload?: TutorPanelPayload) => void;
  onCloseTutor: () => void;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";
  const isPreviewPage = location.pathname === "/resources/preview";
  const isShellHiddenPage = isLoginPage || isPreviewPage;
  const currentPath = location.pathname;
  const isNavItemActive = (itemPath: string) => {
    const normalizedPath = itemPath.split("?")[0] || itemPath;
    return currentPath === normalizedPath;
  };
  const desktopTutorWidthClass = tutorDrawer.open ? "lg:pr-[420px] xl:pr-[460px]" : "";
  const isOverviewPage = currentPath === "/";
  const shellContainerClass = isShellHiddenPage
    ? ""
    : isOverviewPage
      ? `mx-auto w-full max-w-[1600px] px-2 py-4 pb-24 transition-[padding] duration-300 md:px-4 md:py-5 md:pb-8 lg:px-5 xl:px-6 ${desktopTutorWidthClass}`
      : `mx-auto w-full max-w-[1480px] px-4 py-6 pb-24 transition-[padding] duration-300 md:px-8 md:py-8 md:pb-8 lg:px-10 xl:px-12 ${desktopTutorWidthClass}`;

  const navItems = [
    { label: "概览", id: "overview", path: "/", icon: Layers },
    { label: "路径", id: "path", path: "/path", icon: Compass },
    { label: "课堂", id: "learn", path: "/learn", icon: Tv },
    { label: "资源", id: "resources", path: buildResourcesRoute(readLastRouteCourseId()), icon: FolderOpen },
    { label: "收藏", id: "collection", path: "/collection", icon: Heart },
    { label: "评估", id: "evaluation", path: "/evaluation", icon: ClipboardCheck },
    { label: "报告", id: "report", path: "/report", icon: BarChart2 },
    { label: "画像", id: "profile", path: "/profile", icon: User },
    { label: "消息", id: "im", path: "/im", icon: MessageCircleMore },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[linear-gradient(180deg,#fff9fb_0%,#f8fbff_34%,#f4f7f9_100%)] text-[#171c22]">
      {!isShellHiddenPage ? (
        <Suspense fallback={null}>
          <Header
            user={user}
            onLogout={onLogout}
            onOpenTutor={() => onOpenTutor()}
            contentShiftClass={desktopTutorWidthClass}
          />
        </Suspense>
      ) : null}

      <div
        className={`relative flex flex-grow flex-col ${shellContainerClass}`}
      >
        {!isShellHiddenPage ? (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-8 h-[260px] rounded-full bg-[#fb7299]/10 blur-3xl" />
            <div className="pointer-events-none absolute right-0 top-[180px] h-[320px] w-[320px] rounded-full bg-[#7dd3fc]/12 blur-3xl" />
          </>
        ) : null}

        <main
          className={`relative min-w-0 flex-grow transition-[max-width,transform] duration-300 ${
            tutorDrawer.open ? "lg:origin-right" : ""
          }`}
        >
          {!isShellHiddenPage && !["/", "/collection"].includes(currentPath) ? <GlobalAIAssistantBar /> : null}
          {children}
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

      {!isShellHiddenPage ? (
        <>
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
              aria-label="收起 AI 导师侧栏"
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
  const hiddenRoutes = ["/login", "/resources/preview"];
  const shouldHideWelcome =
    tutorOpen || hiddenRoutes.includes(location.pathname) || location.pathname.startsWith("/resources/preview");

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
          AI Tutor
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

      if ((location.pathname === "/" || location.pathname === "/login") && stored.path && currentUrl !== targetUrl) {
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

    const persistScroll = () => {
      try {
        const raw = localStorage.getItem(APP_BROWSER_SCROLL_STATE_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
        parsed[routeKey] = window.scrollY;
        localStorage.setItem(APP_BROWSER_SCROLL_STATE_STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // Ignore scroll persistence errors.
      }
    };

    persistScroll();
    window.addEventListener("scroll", persistScroll, { passive: true });
    window.addEventListener("beforeunload", persistScroll);

    return () => {
      persistScroll();
      window.removeEventListener("scroll", persistScroll);
      window.removeEventListener("beforeunload", persistScroll);
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
      const welcomeSeen =
        sessionStorage.getItem("hasSeenWelcome") === "true" ||
        localStorage.getItem(WELCOME_SEEN_STORAGE_KEY) === "true";
      setShowWelcome(!welcomeSeen);

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
    setUser({
      id: "",
      name: "",
      avatar: "",
      loggedIn: false,
    });
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
    if (location.pathname === "/resources/preview") {
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
      >
        <RouteErrorBoundaryShell>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route
                path="/login"
                element={user.loggedIn ? <Navigate to="/" replace /> : <Login onLoginSuccess={handleLoginSuccess} />}
              />

              <Route
                path="/"
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
                    <CapabilityModel user={user} />
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

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundaryShell>
      </MainLayout>
    </BrowserRouter>
  );
}
