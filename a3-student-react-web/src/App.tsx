import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, Link } from "react-router-dom";
import { ArrowRight, BookOpen, Compass, Sparkles, Target } from "lucide-react";
import { Header } from "./components/Header";
import { navItems } from "./constants";

const Overview = lazy(() => import("./pages/Overview").then((module) => ({ default: module.Overview })));
const CapabilityModel = lazy(() => import("./pages/CapabilityModel").then((module) => ({ default: module.CapabilityModel })));
const LearningPath = lazy(() => import("./pages/LearningPath").then((module) => ({ default: module.LearningPath })));
const CourseLearning = lazy(() => import("./pages/CourseLearning").then((module) => ({ default: module.CourseLearning })));
const ResourceCenter = lazy(() => import("./pages/ResourceCenter").then((module) => ({ default: module.ResourceCenter })));
const ResourceSourcePreview = lazy(() => import("./pages/ResourceSourcePreview.tsx").then((module) => ({ default: module.ResourceSourcePreview })));
const Collection = lazy(() => import("./pages/Collection").then((module) => ({ default: module.Collection })));
const Evaluation = lazy(() => import("./pages/Evaluation").then((module) => ({ default: module.Evaluation })));
const AITutor = lazy(() => import("./pages/AITutor").then((module) => ({ default: module.AITutor })));
const StudyReport = lazy(() => import("./pages/StudyReport").then((module) => ({ default: module.StudyReport })));

function RouteLoadingFallback() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[1240px] items-center justify-center px-8">
      <div className="rounded-3xl border border-outline-variant/50 bg-white px-8 py-6 text-sm text-on-surface-variant shadow-sm">
        页面加载中...
      </div>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const currentNavItem =
    navItems.find((item) => item.path === location.pathname || (item.path !== "/" && location.pathname.startsWith(`${item.path}/`))) || navItems[0];
  const headerTitle = location.pathname === "/learn" ? "课程学习" : currentNavItem.path === "/" ? "A3 学习工作台" : currentNavItem.name;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f5f7f9]">
      <Header title={headerTitle} />
      <main className="min-h-screen pt-28">
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/profile" element={<CapabilityModel />} />
            <Route path="/path" element={<LearningPath />} />
            <Route path="/learn" element={<CourseLearning />} />
            <Route path="/resources" element={<ResourceCenter />} />
            <Route path="/resources/preview" element={<ResourceSourcePreview />} />
            <Route path="/collection" element={<Collection />} />
            <Route path="/report" element={<StudyReport />} />
            <Route path="/evaluation" element={<Evaluation />} />
            <Route path="/tutor" element={<AITutor />} />
          </Routes>
        </Suspense>
      </main>

      <footer className="relative overflow-hidden bg-[#102a43] pt-16 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(18,208,157,0.18),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(255,255,255,0.08),_transparent_22%)]" />

        <div className="relative mx-auto max-w-[1240px] px-6 pb-10 md:px-10">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.9fr_0.9fr_1.1fr]">
            <section className="rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-[0_18px_45px_rgba(0,0,0,0.16)] backdrop-blur-sm">
              <Link to="/" className="group inline-flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-sm font-black text-white shadow-lg transition-transform group-hover:rotate-6">
                  A3
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">A3 学习平台</h3>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-primary/90">学生工作台</p>
                </div>
              </Link>

              <p className="mt-6 max-w-md text-sm leading-8 text-white/72">
                面向学生端的统一学习工作台，串联能力画像、学习路径、资源生成、测评与 AI 辅导闭环。
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Compass className="h-4 w-4" />
                    <span className="text-[11px] font-black uppercase tracking-[0.18em]">路径</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">学习路径联动</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <div className="flex items-center gap-2 text-primary">
                    <BookOpen className="h-4 w-4" />
                    <span className="text-[11px] font-black uppercase tracking-[0.18em]">资源</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">资源中心同步</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Target className="h-4 w-4" />
                    <span className="text-[11px] font-black uppercase tracking-[0.18em]">测评</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">测评反馈闭环</p>
                </div>
              </div>
            </section>

            <section className="px-2 py-2">
              <div className="mb-5 text-xs font-black uppercase tracking-[0.28em] text-primary">学习入口</div>
              <div className="space-y-3">
                <Link to="/" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white/76 transition-colors hover:bg-white/6 hover:text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                  学习总览
                </Link>
                <Link to="/path" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white/76 transition-colors hover:bg-white/6 hover:text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                  学习路径
                </Link>
                <Link to="/resources" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white/76 transition-colors hover:bg-white/6 hover:text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                  资源中心
                </Link>
                <Link to="/report" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white/76 transition-colors hover:bg-white/6 hover:text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                  学习报告
                </Link>
              </div>
            </section>

            <section className="px-2 py-2">
              <div className="mb-5 text-xs font-black uppercase tracking-[0.28em] text-primary">支持服务</div>
              <div className="space-y-3">
                <Link to="/tutor" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white/76 transition-colors hover:bg-white/6 hover:text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                  AI 辅导
                </Link>
                <Link to="/collection" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white/76 transition-colors hover:bg-white/6 hover:text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                  我的收藏
                </Link>
                <Link to="/profile" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white/76 transition-colors hover:bg-white/6 hover:text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                  能力画像
                </Link>
                <Link to="/evaluation" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white/76 transition-colors hover:bg-white/6 hover:text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                  学习测评
                </Link>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-white/5 p-7 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-black uppercase tracking-[0.22em]">当前模式</span>
              </div>

              <h4 className="mt-5 text-xl font-bold text-white">本地 AI 学习工作台</h4>
              <p className="mt-4 text-sm leading-8 text-white/70">
                当前学生端已接入本地 AI 服务，可联动学习路径、资源、测评与辅导接口。
              </p>

              <div className="mt-7 space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-white/6 px-4 py-3 text-sm text-white/74">
                  <span>当前场景</span>
                  <span className="font-semibold text-white">学生端演示</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/6 px-4 py-3 text-sm text-white/74">
                  <span>已连接模块</span>
                  <span className="font-semibold text-white">路径 / 资源 / 测评</span>
                </div>
              </div>

              <Link
                to="/resources"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02]"
              >
                进入资源中心
                <ArrowRight className="h-4 w-4" />
              </Link>
            </section>
          </div>

          <div className="mt-12 flex flex-col gap-5 border-t border-white/8 pt-6 text-xs text-white/40 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-8">
              <p>版权所有 2026 A3 学习平台</p>
              <div className="flex flex-wrap gap-5">
                <span className="cursor-pointer transition-colors hover:text-white/70">隐私说明</span>
                <span className="cursor-pointer transition-colors hover:text-white/70">使用条款</span>
                <span className="cursor-pointer transition-colors hover:text-white/70">平台公告</span>
              </div>
            </div>
            <p>A3 本地学生端构建</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
