import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  FolderDown,
  LoaderCircle,
  Lock,
  Mail,
  MessageSquare,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import {
  ACTIVE_COURSE_ID,
  ACTIVE_USER_ID,
  buildEvaluationRoute,
  buildLearnRoute,
  buildProfileRoute,
  buildResourcesRoute,
  buildTutorRoute,
  resolveCourseIdFromSearchParams,
} from "../lib/courseContext";
import { studentApi, type LearningPlanResponse, type PlanProgressResponse } from "../lib/studentApi";

export default function LearningPath() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = resolveCourseIdFromSearchParams(searchParams, ACTIVE_COURSE_ID);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<LearningPlanResponse | null>(null);
  const [progress, setProgress] = useState<PlanProgressResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPlan() {
      setLoading(true);
      setError(null);
      try {
        const latestPlan = await studentApi.getLatestLearningPlan(ACTIVE_USER_ID, courseId);
        const latestProgress = latestPlan.plan_id
          ? await studentApi.getPlanProgress(latestPlan.plan_id, ACTIVE_USER_ID).catch(() => null)
          : null;
        if (!cancelled) {
          setPlan(latestPlan);
          setProgress(latestProgress);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "学习路径加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPlan();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const progressMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of progress?.items || []) {
      map.set(item.step_id, item.status);
    }
    return map;
  }, [progress]);

  const currentStep = useMemo(() => {
    if (!plan) return null;
    const mergedSteps = plan.steps.map((step) => {
      const stepId = step.step_id || `day-${step.day}`;
      return {
        ...step,
        resolvedStatus: progressMap.get(stepId) || step.status,
      };
    });
    return (
      mergedSteps.find((step) => step.resolvedStatus === "in_progress") ||
      mergedSteps.find((step) => step.resolvedStatus === "pending") ||
      mergedSteps[0] ||
      null
    );
  }, [plan, progressMap]);

  const goToClassroom = (sectionId?: number | null) => {
    navigate(buildLearnRoute(courseId, sectionId || currentStep?.section_id || undefined));
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-[#E3E8EC] bg-white text-sm font-semibold text-[#564145]">
        <span className="flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          正在加载学习路径...
        </span>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="rounded-3xl border border-[#E3E8EC] bg-white p-8 text-sm text-[#564145] shadow-sm">
        <p className="font-bold text-[#171c22]">学习路径暂不可用</p>
        <p className="mt-2">{error || "暂无学习路径数据。"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none" id="learning-path-workspace">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <button
          onClick={() => goToClassroom()}
          className="flex cursor-pointer items-center gap-1 self-start text-xs font-semibold text-[#564145] hover:text-[#fb7299]"
        >
          <ArrowLeft className="h-4 w-4" />
          返回课堂
        </button>
      </div>

      <section className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm lg:flex-row lg:p-8">
        <div className="max-w-2xl space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[#fb7299]/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#fb7299]">
              学习路径
            </span>
            <span className="rounded-full bg-[#006689]/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#006689]">
              {plan.course_name}
            </span>
          </div>

          <h1 className="text-2xl font-extrabold leading-tight text-[#171c22] lg:text-3xl">
            画像驱动的课堂学习路径
          </h1>
          <p className="text-xs leading-relaxed text-[#564145] opacity-95 lg:text-sm">
            {plan.profile_summary || "当前路径会基于学习画像、现有资源和课堂章节进行组合推荐。"}
          </p>

          {plan.recommended_learning_style ? (
            <div className="rounded-2xl border border-[#f7d7e1] bg-[#fff7fa] px-4 py-3 text-xs text-[#7b4153]">
              推荐学习方式：{plan.recommended_learning_style}
            </div>
          ) : null}

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#171c22]">
              <span>路径推进进度</span>
              <span className="text-sm text-[#fb7299]">{Math.round(plan.completion_rate)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#eaeef6]">
              <div className="h-full rounded-full bg-[#fb7299] transition-all duration-500" style={{ width: `${plan.completion_rate}%` }} />
            </div>
            <p className="text-[10px] text-[#564145]/70">{plan.summary}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col justify-center gap-3 lg:w-80">
          <button
            onClick={() => goToClassroom()}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#fb7299] px-6 py-3 font-bold text-white shadow-md hover:bg-[#fb7299]/90"
          >
            <PlayCircle className="h-5 w-5 fill-white stroke-none" />
            {currentStep?.title ? `进入 ${currentStep.title}` : "继续当前章节"}
          </button>

          <div className="flex items-start gap-2.5 rounded-2xl border border-blue-50 bg-[#f0f4fc] p-4 text-xs text-[#00516e]">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#006689]" />
            <div>
              <p className="font-bold">当前阶段</p>
              <p className="text-[10.5px] opacity-95">{currentStep?.stage_name || plan.current_stage || plan.next_action}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex w-full flex-col gap-6 lg:flex-row">
        <div className="flex-grow space-y-8 rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm lg:p-8">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-lg font-extrabold text-[#171c22]">阶段路径</h2>
          </div>

          <div className="relative space-y-8 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-0.5 before:bg-slate-100">
            {plan.stages.map((stage) => (
              <div key={stage.stage_no} className="space-y-4">
                <div className="relative flex items-center justify-between pl-10">
                  <div
                    className={`absolute left-2.5 z-10 h-[20px] w-[20px] -translate-x-1/2 rounded-full border-4 bg-white ${
                      stage.status === "completed"
                        ? "border-emerald-500"
                        : stage.status === "in_progress"
                          ? "border-[#fb7299]"
                          : "border-slate-300"
                    }`}
                  />
                  <div>
                    <h3 className="text-sm font-extrabold text-[#171c22]">{stage.stage_name}</h3>
                    <p className="mt-0.5 text-[10px] text-[#564145]/75">{stage.focus}</p>
                  </div>
                </div>

                <div className="space-y-3 pl-10">
                  {plan.steps
                    .filter((step) => step.stage_no === stage.stage_no)
                    .map((step) => {
                      const stepId = step.step_id || `day-${step.day}`;
                      const status = progressMap.get(stepId) || step.status;
                      const isLocked = status === "locked";
                      const isCurrent = status === "in_progress";

                      return (
                        <div
                          key={stepId}
                          className={`relative rounded-2xl border p-4 transition-all ${
                            isLocked
                              ? "border-gray-100 bg-gray-50/50 opacity-60"
                              : isCurrent
                                ? "border-[#fb7299]/50 bg-gradient-to-r from-[#fb7299]/5 to-transparent shadow-sm shadow-[#fb7299]/5"
                                : "border-[#E3E8EC] bg-white"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div
                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                  status === "completed"
                                    ? "border-emerald-500 bg-emerald-500 text-white"
                                    : isLocked
                                      ? "border-gray-300 bg-gray-100"
                                      : "border-gray-400"
                                }`}
                              >
                                {status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5 stroke-[3px]" /> : null}
                              </div>

                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className={`truncate text-sm font-extrabold ${status === "completed" ? "text-[#564145]/60 line-through" : "text-[#171c22]"}`}>
                                    {step.title}
                                  </h4>
                                  {isCurrent ? (
                                    <span className="rounded bg-[#fb7299] px-2 py-0.2 text-[9px] font-bold uppercase tracking-wider text-white">
                                      当前步骤
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-xs leading-relaxed text-[#564145]">{step.objective || step.checkpoint}</p>
                                {step.chapter_name || step.path_reason ? (
                                  <p className="text-[11px] leading-relaxed text-[#7a5560]">
                                    {step.chapter_name ? `课堂节点：${step.chapter_name}` : ""}
                                    {step.chapter_name && step.path_reason ? " · " : ""}
                                    {step.path_reason || ""}
                                  </p>
                                ) : null}
                                {step.resource_titles?.length ? (
                                  <p className="text-[11px] leading-relaxed text-[#006689]">
                                    推荐资源：{step.resource_titles.join("、")}
                                  </p>
                                ) : null}
                                <div className="flex items-center gap-2 pt-1 text-[10px] text-[#564145]/70">
                                  <span className="rounded bg-[#eaeef6] px-1.5 py-0.2 text-[9px] font-semibold tracking-wide text-[#564145]">
                                    {step.node_type}
                                  </span>
                                  <span>预计 {step.duration_minutes} 分钟</span>
                                </div>
                              </div>
                            </div>

                            {!isLocked ? (
                              <button
                                onClick={() => goToClassroom(step.section_id)}
                                className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-[#006689] hover:underline"
                              >
                                <PlayCircle className="h-4 w-4" />
                                <span className="hidden sm:inline">进入课堂</span>
                              </button>
                            ) : (
                              <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-80">
          <section className="flex flex-col gap-4 rounded-3xl border border-[#E3E8EC] bg-white p-6 text-center shadow-sm">
            <h3 className="border-b border-gray-50 pb-2 text-left text-xs font-extrabold uppercase tracking-wider text-[#564145]">
              导师建议
            </h3>
            <p className="text-left text-xs leading-relaxed text-[#564145]">{plan.next_action}</p>
            <button
              onClick={() => navigate(buildTutorRoute(courseId))}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#fb7299]/20 bg-[#f0f4fc] py-2.5 text-xs font-bold text-[#fb7299] transition-colors hover:bg-[#fb7299]/10"
            >
              <Mail className="h-4 w-4 shrink-0" />
              问 AI 导师
            </button>
          </section>

          <section className="flex flex-col gap-4 rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
            <h3 className="border-b border-gray-50 pb-2 text-xs font-extrabold uppercase tracking-wider text-[#171c22]">
              快捷入口
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate(buildResourcesRoute(courseId))}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-gray-100 bg-slate-50 p-3 text-center transition-colors hover:bg-slate-100"
              >
                <FileText className="mb-1.5 h-6 w-6 text-[#fb7299]" />
                <span className="text-[11px] font-bold text-[#171c22]">课程资料</span>
              </button>

              <button
                onClick={() => navigate("/collection")}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-gray-100 bg-slate-50 p-3 text-center transition-colors hover:bg-slate-100"
              >
                <FolderDown className="mb-1.5 h-6 w-6 text-emerald-600" />
                <span className="text-[11px] font-bold text-[#171c22]">收藏资源</span>
              </button>

              <button
                onClick={() => navigate(buildEvaluationRoute(courseId))}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-gray-100 bg-slate-50 p-3 text-center transition-colors hover:bg-slate-100"
              >
                <MessageSquare className="mb-1.5 h-6 w-6 text-amber-600" />
                <span className="text-[11px] font-bold text-[#171c22]">测评中心</span>
              </button>

              <button
                onClick={() => navigate(buildProfileRoute(courseId))}
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-gray-100 bg-slate-50 p-3 text-center transition-colors hover:bg-slate-100"
              >
                <Sparkles className="mb-1.5 h-6 w-6 text-[#006689]" />
                <span className="text-[11px] font-bold text-[#171c22]">画像联动</span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
