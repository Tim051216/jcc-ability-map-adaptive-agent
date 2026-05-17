import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock, RefreshCw, Sparkles, Target } from "lucide-react";
import { motion } from "motion/react";
import { studentApi, type LearningPlanResponse, type PlanProgressResponse } from "../lib/studentApi";
import { cn } from "../lib/utils";

const DEFAULT_USER_ID = 1001;
const DEFAULT_COURSE_ID = 101;

function getCourseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get("courseId") || DEFAULT_COURSE_ID);
}

function toPercent(value: number) {
  return `${Math.round(value)}%`;
}

function resolveStepStatus(stepStatus: string, progressStatus?: string) {
  return progressStatus || stepStatus || "pending";
}

function formatStatusLabel(status: string) {
  switch (status) {
    case "completed":
      return "已完成";
    case "in_progress":
      return "进行中";
    default:
      return "待开始";
  }
}

export function LearningPath() {
  const courseId = useMemo(() => getCourseIdFromUrl(), []);
  const [plan, setPlan] = useState<LearningPlanResponse | null>(null);
  const [progress, setProgress] = useState<PlanProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [completingStepId, setCompletingStepId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPlan() {
    try {
      setLoading(true);
      setError(null);
      const latestPlan = await studentApi.getLatestLearningPlan(DEFAULT_USER_ID, courseId);
      setPlan(latestPlan);
      if (latestPlan.plan_id) {
        const latestProgress = await studentApi.getPlanProgress(latestPlan.plan_id, DEFAULT_USER_ID);
        setProgress(latestProgress);
      } else {
        setProgress(null);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "学习安排加载失败";
      setPlan(null);
      setProgress(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlan();
  }, [courseId]);

  async function handleGeneratePlan() {
    try {
      setGenerating(true);
      setError(null);
      const generated = await studentApi.generateLearningPlan({
        user_id: DEFAULT_USER_ID,
        course_id: courseId,
        target: "掌握 A3 智能学习工作流",
        available_days: 7,
        daily_study_minutes: 45,
      });
      setPlan(generated);
      if (generated.plan_id) {
        const latestProgress = await studentApi.getPlanProgress(generated.plan_id, DEFAULT_USER_ID);
        setProgress(latestProgress);
      }
    } catch (generateError) {
      const message = generateError instanceof Error ? generateError.message : "学习安排生成失败";
      setError(message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCompleteStep(stepId: string) {
    if (!plan?.plan_id) {
      return;
    }
    try {
      setCompletingStepId(stepId);
      const nextProgress = await studentApi.completePlanStep(plan.plan_id, stepId, DEFAULT_USER_ID);
      setProgress(nextProgress);
    } catch (stepError) {
      const message = stepError instanceof Error ? stepError.message : "步骤进度更新失败";
      setError(message);
    } finally {
      setCompletingStepId(null);
    }
  }

  const progressMap = useMemo(
    () => new Map((progress?.items || []).map((item) => [item.step_id, item.status])),
    [progress],
  );

  const completionRate = progress?.completion_rate ?? plan?.completion_rate ?? 0;
  const hasPlan = Boolean(plan?.steps?.length);

  return (
    <div className="mx-auto max-w-[1080px] pb-20">
      <section className="mb-10 rounded-[28px] border border-outline-variant/50 bg-white p-8 shadow-sm md:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-primary">
              <Sparkles className="h-4 w-4" />
              本周学习安排
            </div>
            <h1 className="text-3xl font-bold text-on-surface md:text-4xl">
              {plan?.course_name ? `${plan.course_name} 学习安排` : "一眼看懂接下来该学什么"}
            </h1>
            <p className="mt-4 text-sm leading-8 text-on-surface-variant">
              {plan?.summary || "这里把当前课程拆成每天能执行的小任务。你不需要自己规划顺序，按步骤做就可以。"}
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-surface-variant/25 p-4">
                <div className="text-[11px] font-bold text-primary">先做什么</div>
                <div className="mt-2 text-sm text-on-surface">{plan?.steps?.[0]?.title || "先生成学习安排"}</div>
              </div>
              <div className="rounded-2xl bg-surface-variant/25 p-4">
                <div className="text-[11px] font-bold text-primary">今天花多久</div>
                <div className="mt-2 text-sm text-on-surface">
                  {plan?.steps?.[0]?.duration_minutes ? `${plan.steps[0].duration_minutes} 分钟` : "约 45 分钟"}
                </div>
              </div>
              <div className="rounded-2xl bg-surface-variant/25 p-4">
                <div className="text-[11px] font-bold text-primary">做完有什么用</div>
                <div className="mt-2 text-sm text-on-surface">后面生成资料和测评时会更准确</div>
              </div>
            </div>
          </div>

          <div className="min-w-[260px] rounded-3xl bg-surface-variant/30 p-6">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant">当前完成度</div>
            <div className="mt-3 text-5xl font-black text-primary">{toPercent(completionRate)}</div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(6, Math.round(completionRate))}%` }}
                transition={{ duration: 0.8 }}
                className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-300"
              />
            </div>
            <div className="mt-3 text-xs leading-6 text-on-surface-variant">
              进度越清晰，后面的资源推荐、测评和 AI 辅导就越贴合你当前状态。
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => void loadPlan()}
                className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-white px-4 py-2 text-sm font-bold text-on-surface"
              >
                <RefreshCw className="h-4 w-4" />
                重新同步
              </button>
              <button
                onClick={() => void handleGeneratePlan()}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                {generating ? "正在生成..." : hasPlan ? "重排本周安排" : "生成学习安排"}
              </button>
            </div>
          </div>
        </div>

        {error ? <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">{error}</div> : null}
      </section>

      {loading ? (
        <section className="rounded-[28px] border border-outline-variant/50 bg-white p-10 text-sm text-on-surface-variant shadow-sm">
          正在同步学习安排...
        </section>
      ) : null}

      {!loading && !hasPlan ? (
        <section className="rounded-[28px] border border-dashed border-outline-variant bg-white p-10 text-center shadow-sm">
          <div className="text-2xl font-bold text-on-surface">你还没有专属学习安排</div>
          <p className="mt-3 text-sm leading-8 text-on-surface-variant">
            点一下“生成学习安排”，系统会自动把课程拆成阶段、每日任务和资料建议，你只需要照着走。
          </p>
        </section>
      ) : null}

      {!loading && hasPlan ? (
        <div className="space-y-8">
          <section>
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-on-surface">先知道这周分几段学</h2>
              <p className="mt-1 text-sm text-on-surface-variant">如果你不想看细节，先看这 3 个阶段就能知道整体节奏。</p>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {plan?.stages.map((stage) => (
                <article key={stage.stage_no} className="rounded-3xl border border-outline-variant/50 bg-white p-6 shadow-sm">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-primary">第 {stage.stage_no} 阶段</div>
                  <h3 className="mt-3 text-xl font-bold text-on-surface">{stage.stage_name}</h3>
                  <p className="mt-3 text-sm leading-7 text-on-surface-variant">{stage.focus}</p>
                  <div className="mt-5 flex items-center justify-between text-xs font-semibold text-on-surface-variant">
                    <span>预计 {stage.estimated_days} 天</span>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1",
                        stage.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : stage.status === "in_progress"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {formatStatusLabel(stage.status)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-on-surface">照着做就行的每日任务</h2>
              <p className="mt-1 text-sm text-on-surface-variant">每一条都写清了今天要做什么、要花多久、做完后怎么记录。</p>
            </div>

            <div className="relative space-y-5">
              <div className="absolute bottom-0 left-5 top-0 hidden w-0.5 bg-outline-variant/40 md:block" />
              {plan?.steps.map((step, index) => {
                const stepId = step.step_id || `day-${step.day}`;
                const status = resolveStepStatus(step.status, progressMap.get(stepId));
                const canComplete = status !== "completed";

                return (
                  <motion.article
                    key={stepId}
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative rounded-[28px] border border-outline-variant/60 bg-white p-7 shadow-sm md:pl-20"
                  >
                    <div
                      className={cn(
                        "absolute left-0 top-8 hidden h-10 w-10 items-center justify-center rounded-full border-4 border-[#f5f7f9] md:flex",
                        status === "completed"
                          ? "bg-primary text-white"
                          : status === "in_progress"
                            ? "border-primary bg-white text-primary"
                            : "border-outline-variant bg-white text-on-surface-variant",
                      )}
                    >
                      {status === "completed" ? <CheckCircle2 className="h-5 w-5" /> : <Target className="h-5 w-5" />}
                    </div>

                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-on-surface-variant">
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">第 {step.day} 天</span>
                          <span>{step.stage_name}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            预计 {step.duration_minutes} 分钟
                          </span>
                        </div>
                        <h3 className="mt-3 text-2xl font-bold text-on-surface">{step.title}</h3>
                        <p className="mt-3 text-sm leading-8 text-on-surface-variant">{step.objective}</p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-4 py-2 text-sm font-bold",
                            status === "completed"
                              ? "bg-emerald-50 text-emerald-700"
                              : status === "in_progress"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {formatStatusLabel(status)}
                        </span>
                        <button
                          onClick={() => void handleCompleteStep(stepId)}
                          disabled={!canComplete || completingStepId === stepId}
                          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                        >
                          {completingStepId === stepId ? "正在保存..." : canComplete ? "我做完了，记录一下" : "已记录完成"}
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                      {step.tasks.map((task) => (
                        <div key={task} className="rounded-2xl bg-surface-variant/25 px-4 py-3 text-sm text-on-surface">
                          {task}
                        </div>
                      ))}
                    </div>

                    {step.resource_pushes.length ? (
                      <div className="mt-6 rounded-3xl bg-surface-variant/20 p-5">
                        <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary">做这一步时可以顺手看的资料</div>
                        <div className="grid gap-3 md:grid-cols-3">
                          {step.resource_pushes.map((item) => (
                            <div key={`${stepId}-${item.title}`} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                              <div className="text-sm font-bold text-on-surface">{item.title}</div>
                              <div className="mt-2 text-xs leading-6 text-on-surface-variant">{item.reason}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </motion.article>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
