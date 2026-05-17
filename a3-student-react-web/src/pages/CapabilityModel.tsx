import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Clock, GraduationCap, RefreshCw, Sparkles, Target, Users } from "lucide-react";
import { studentApi, type LearningPlanResponse, type PlanProgressResponse, type ResourceCard } from "../lib/studentApi";
import { cn } from "../lib/utils";

const DEFAULT_USER_ID = 1001;
const DEFAULT_COURSE_ID = 101;
const CapabilityRadarChart = lazy(() =>
  import("../components/CapabilityRadarChart").then((module) => ({ default: module.CapabilityRadarChart })),
);

function getCourseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get("courseId") || DEFAULT_COURSE_ID);
}

type DashboardState = {
  plan: LearningPlanResponse | null;
  progress: PlanProgressResponse | null;
  resources: ResourceCard[];
};

function translateStageText(value?: string | null) {
  if (!value) {
    return "当前还没有激活阶段";
  }

  const map: Record<string, string> = {
    "No active stage yet": "当前还没有激活阶段",
    "Master the A3 intelligent learning workflow": "掌握 A3 智能学习工作流",
    "Master the A3 intelligent learning workflow basics": "掌握 A3 智能学习工作流基础",
    "Master the A3 intelligent learning workflow foundation diagnosis": "A3 智能学习工作流基础诊断",
  };

  return map[value] || value;
}

function buildRadarData(plan: LearningPlanResponse | null, progress: PlanProgressResponse | null, resources: ResourceCard[]) {
  const completion = progress?.completion_rate ?? plan?.completion_rate ?? 0;
  const stages = plan?.stages ?? [];
  const resourceTypes = new Set(resources.map((item) => item.resource_type));
  const studyBreadth = Math.min(100, 35 + resourceTypes.size * 14);
  const consistency = Math.min(100, 30 + Math.round(completion * 0.7));
  const execution = Math.min(100, 20 + (progress?.completed_steps ?? 0) * 12);
  const planning = Math.min(100, 40 + stages.length * 15);
  const output = Math.min(100, 25 + resources.length * 6);

  return [
    { subject: "规划能力", score: planning, fullMark: 100 },
    { subject: "执行能力", score: execution, fullMark: 100 },
    { subject: "持续性", score: consistency, fullMark: 100 },
    { subject: "广度", score: studyBreadth, fullMark: 100 },
    { subject: "产出力", score: output, fullMark: 100 },
  ];
}

function buildBadges(plan: LearningPlanResponse | null, progress: PlanProgressResponse | null, resources: ResourceCard[]) {
  const badges = [];
  if ((progress?.completed_steps ?? 0) >= 1) {
    badges.push({ label: "行动执行者", tone: "primary" });
  }
  if ((plan?.stages.length ?? 0) >= 3) {
    badges.push({ label: "路径规划者", tone: "secondary" });
  }
  if (resources.length >= 4) {
    badges.push({ label: "资源探索者", tone: "primary" });
  }
  if (new Set(resources.map((item) => item.resource_type)).size >= 3) {
    badges.push({ label: "多模态学习者", tone: "secondary" });
  }
  return badges;
}

export function CapabilityModel() {
  const courseId = useMemo(() => getCourseIdFromUrl(), []);
  const [state, setState] = useState<DashboardState>({ plan: null, progress: null, resources: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const [plan, resources] = await Promise.all([
        studentApi.getLatestLearningPlan(DEFAULT_USER_ID, courseId).catch(() => null),
        studentApi.listResources(DEFAULT_USER_ID, courseId).then((response) => response.items).catch(() => []),
      ]);

      const progress =
        plan?.plan_id ? await studentApi.getPlanProgress(plan.plan_id, DEFAULT_USER_ID).catch(() => null) : null;

      setState({ plan, progress, resources });
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "能力画像加载失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [courseId]);

  const radarData = useMemo(
    () => buildRadarData(state.plan, state.progress, state.resources),
    [state.plan, state.progress, state.resources],
  );
  const badges = useMemo(
    () => buildBadges(state.plan, state.progress, state.resources),
    [state.plan, state.progress, state.resources],
  );

  const completionRate = state.progress?.completion_rate ?? state.plan?.completion_rate ?? 0;
  const completedSteps = state.progress?.completed_steps ?? 0;
  const totalSteps = state.progress?.total_steps ?? state.plan?.steps.length ?? 0;
  const currentStage = translateStageText(state.plan?.current_stage);
  const recommendedCheckpoints = state.plan?.recommended_checkpoints ?? [];

  return (
    <div className="mx-auto max-w-[1240px] space-y-8 pb-20">
      <section className="rounded-[28px] border border-outline-variant/60 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-primary">
              <Sparkles className="h-4 w-4" />
              学习能力画像
            </div>
            <h1 className="text-3xl font-bold text-on-surface md:text-4xl">
              {state.plan?.course_name ? `${state.plan.course_name} 当前学习状态` : "现在最该知道的不是学了多少，而是你卡在哪里"}
            </h1>
            <p className="mt-4 text-sm leading-8 text-on-surface-variant">
              这页会把你的学习进度、资源使用情况和阶段状态汇总成一张能力图，帮你判断“该继续冲，还是该回头补”。
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-surface-variant/25 p-4">
                <div className="text-[11px] font-bold text-primary">先看哪里</div>
                <div className="mt-2 text-sm text-on-surface">先看雷达图最短的那一项</div>
              </div>
              <div className="rounded-2xl bg-surface-variant/25 p-4">
                <div className="text-[11px] font-bold text-primary">再看哪里</div>
                <div className="mt-2 text-sm text-on-surface">看推荐检查点知道先补什么</div>
              </div>
              <div className="rounded-2xl bg-surface-variant/25 p-4">
                <div className="text-[11px] font-bold text-primary">最后去哪里</div>
                <div className="mt-2 text-sm text-on-surface">回到学习路径或资源中心行动</div>
              </div>
            </div>
            <p className="mt-4 text-sm text-on-surface-variant/80">当前关注点：{currentStage}</p>
          </div>

          <div className="rounded-3xl bg-surface-variant/30 p-6 lg:min-w-[260px]">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant">整体完成度</div>
            <div className="mt-3 text-5xl font-black text-primary">{Math.round(completionRate)}%</div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-300" style={{ width: `${Math.max(6, Math.round(completionRate))}%` }} />
            </div>
            <div className="mt-3 text-xs leading-6 text-on-surface-variant">
              进度不只是“学了多少”，也决定后面的资料推荐、测评难度和 AI 辅导建议会不会更贴合你。
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => void loadData()}
                className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-white px-4 py-2 text-sm font-bold text-on-surface"
              >
                <RefreshCw className="h-4 w-4" />
                重新同步
              </button>
              <a
                href={`/path?courseId=${courseId}`}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white"
              >
                回到学习路径
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">{error}</div>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="lg:col-span-8 rounded-[28px] border border-outline-variant/60 bg-white p-8 shadow-sm">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-on-surface">五项核心学习能力</h3>
              <p className="text-[13px] text-on-surface-variant">长度越短的维度，越值得优先补一补。</p>
            </div>
          </div>

          <Suspense
            fallback={
              <div className="flex h-[400px] w-full items-center justify-center rounded-xl bg-surface-variant/20 p-4 text-sm text-on-surface-variant">
                正在加载能力雷达...
              </div>
            }
          >
            <CapabilityRadarChart data={radarData} />
          </Suspense>
        </section>

        <section className="lg:col-span-4 rounded-[28px] border border-outline-variant/60 bg-white p-8 shadow-sm">
          <h3 className="mb-8 text-lg font-bold text-on-surface">支撑这些判断的实时信号</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-surface-variant/30 p-4">
              <BookOpen className="h-5 w-5 text-primary" />
              <div className="mt-4 text-2xl font-black text-on-surface">{totalSteps}</div>
              <div className="mt-1 text-xs text-on-surface-variant">计划步骤</div>
            </div>
            <div className="rounded-2xl bg-surface-variant/30 p-4">
              <Target className="h-5 w-5 text-secondary" />
              <div className="mt-4 text-2xl font-black text-on-surface">{completedSteps}</div>
              <div className="mt-1 text-xs text-on-surface-variant">已完成</div>
            </div>
            <div className="rounded-2xl bg-surface-variant/30 p-4">
              <GraduationCap className="h-5 w-5 text-primary" />
              <div className="mt-4 text-2xl font-black text-on-surface">{state.plan?.stages.length ?? 0}</div>
              <div className="mt-1 text-xs text-on-surface-variant">阶段数</div>
            </div>
            <div className="rounded-2xl bg-surface-variant/30 p-4">
              <Clock className="h-5 w-5 text-secondary" />
              <div className="mt-4 text-2xl font-black text-on-surface">{state.resources.length}</div>
              <div className="mt-1 text-xs text-on-surface-variant">资料数</div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-surface-variant p-6 text-center">
            <h4 className="text-[13px] font-bold text-on-surface">离下一阶段还有多少空间</h4>
            <p className="mt-2 text-2xl font-black text-primary">{Math.max(0, 100 - Math.round(completionRate))} 分</p>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white">
              <div className="h-full bg-primary" style={{ width: `${Math.max(8, Math.round(completionRate))}%` }} />
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="lg:col-span-7 rounded-[28px] border border-outline-variant/60 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold text-on-surface">如果你不知道先补哪里，就先看这里</h3>
            <a href={`/resources?courseId=${courseId}`} className="text-sm font-bold text-primary">
              去找对应资料
            </a>
          </div>
          <div className="space-y-4">
            {(recommendedCheckpoints.length ? recommendedCheckpoints : ["先生成学习路径，系统才会给出更具体的补强建议。"]).map((item) => (
              <div key={item} className="rounded-2xl bg-surface-variant/25 px-4 py-4 text-sm text-on-surface">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-5 rounded-[28px] border border-outline-variant/60 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold text-on-surface">你已经形成的学习标签</h3>
            <Users className="h-5 w-5 text-on-surface-variant/60" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {(badges.length ? badges : [{ label: "学习起步者", tone: "primary" }]).map((badge) => (
              <div key={badge.label} className="rounded-2xl border border-outline-variant/40 p-4 text-center">
                <div
                  className={cn(
                    "mx-auto flex h-14 w-14 items-center justify-center rounded-2xl",
                    badge.tone === "secondary" ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary",
                  )}
                >
                  <Sparkles className="h-7 w-7" />
                </div>
                <div className="mt-3 text-[12px] font-bold text-on-surface-variant">{badge.label}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {loading ? <div className="text-sm text-on-surface-variant">正在同步能力画像...</div> : null}
    </div>
  );
}
