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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => navigate(buildLearnRoute(courseId))}
          className="text-xs font-semibold text-[#564145] hover:text-[#fb7299] flex items-center gap-1 cursor-pointer self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          返回课堂
        </button>
      </div>

      <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 lg:p-8 flex flex-col lg:flex-row justify-between gap-6 relative overflow-hidden shadow-sm">
        <div className="space-y-4 max-w-2xl">
          <div className="flex flex-wrap gap-2">
            <span className="bg-[#fb7299]/10 text-[#fb7299] text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              学习路径
            </span>
            <span className="bg-[#006689]/10 text-[#006689] text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              {plan.course_name}
            </span>
          </div>

          <h1 className="font-sans text-2xl lg:text-3xl font-extrabold text-[#171c22] leading-tight">
            学业成长路径图
          </h1>
          <p className="text-xs lg:text-sm text-[#564145] leading-relaxed font-sans opacity-95">
            当前页面已切到学习路径服务，不再使用前端常量学习路线。
          </p>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#171c22]">
              <span>学习路径推进进度</span>
              <span className="text-[#fb7299] text-sm">{Math.round(plan.completion_rate)}%</span>
            </div>
            <div className="w-full h-2 bg-[#eaeef6] rounded-full overflow-hidden">
              <div className="h-full bg-[#fb7299] rounded-full transition-all duration-500" style={{ width: `${plan.completion_rate}%` }} />
            </div>
            <p className="text-[10px] text-[#564145]/70">{plan.summary}</p>
          </div>
        </div>

        <div className="lg:w-80 shrink-0 flex flex-col gap-3 justify-center">
          <button
            onClick={() => navigate(buildLearnRoute(courseId))}
            className="w-full bg-[#fb7299] hover:bg-[#fb7299]/90 text-white font-bold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-md cursor-pointer"
          >
            <PlayCircle className="w-5 h-5 fill-white stroke-none" />
            继续当前章节
          </button>

          <div className="p-4 bg-[#f0f4fc] rounded-2xl border border-blue-50 text-xs text-[#00516e] flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-[#006689] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">当前阶段</p>
              <p className="opacity-95 text-[10.5px]">{plan.current_stage || plan.next_action}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="flex-grow bg-white rounded-3xl border border-[#E3E8EC] p-6 lg:p-8 shadow-sm space-y-8">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="font-sans text-lg font-extrabold text-[#171c22]">阶段路径</h2>
          </div>

          <div className="space-y-8 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-100">
            {plan.stages.map((stage) => (
              <div key={stage.stage_no} className="space-y-4">
                <div className="flex items-center justify-between pl-10 relative">
                  <div
                    className={`absolute left-2.5 w-[20px] h-[20px] rounded-full border-4 bg-white z-10 -translate-x-1/2 ${
                      stage.status === "completed"
                        ? "border-emerald-500"
                        : stage.status === "in_progress"
                          ? "border-[#fb7299]"
                          : "border-slate-300"
                    }`}
                  />
                  <div>
                    <h3 className="font-sans text-sm font-extrabold text-[#171c22]">{stage.stage_name}</h3>
                    <p className="text-[10px] text-[#564145]/75 mt-0.5 font-mono">{stage.focus}</p>
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
                          className={`p-4 rounded-2xl border transition-all relative ${
                            isLocked
                              ? "bg-gray-50/50 border-gray-100 opacity-60"
                              : isCurrent
                                ? "bg-gradient-to-r from-[#fb7299]/5 to-transparent border-[#fb7299]/50 shadow-sm shadow-[#fb7299]/5"
                                : "bg-white border-[#E3E8EC]"
                          }`}
                        >
                          <div className="flex items-start gap-4 justify-between">
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                                  status === "completed"
                                    ? "bg-emerald-500 border-emerald-500 text-white"
                                    : isLocked
                                      ? "border-gray-300 bg-gray-100"
                                      : "border-gray-400"
                                }`}
                              >
                                {status === "completed" ? <CheckCircle2 className="w-3.5 h-3.5 stroke-[3px]" /> : null}
                              </div>

                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className={`text-sm font-extrabold truncate ${status === "completed" ? "line-through text-[#564145]/60" : "text-[#171c22]"}`}>
                                    {step.title}
                                  </h4>
                                  {isCurrent ? (
                                    <span className="bg-[#fb7299] text-white text-[9px] font-bold px-2 py-0.2 rounded font-mono uppercase tracking-wider">
                                      当前步骤
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-xs text-[#564145] leading-relaxed font-sans">{step.objective || step.checkpoint}</p>
                                <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-[#564145]/70">
                                  <span className="bg-[#eaeef6] text-[#564145] px-1.5 py-0.2 rounded font-sans text-[9px] font-semibold tracking-wide">
                                    {step.node_type}
                                  </span>
                                  <span>预计 {step.duration_minutes} 分钟</span>
                                </div>
                              </div>
                            </div>

                            {!isLocked ? (
                              <button
                                onClick={() => navigate(buildLearnRoute(courseId))}
                                className="text-xs font-semibold text-[#006689] flex items-center hover:underline shrink-0 gap-0.5"
                              >
                                <PlayCircle className="w-4 h-4" />
                                <span className="hidden sm:inline">进入课堂</span>
                              </button>
                            ) : (
                              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
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

        <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
          <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm flex flex-col gap-4 text-center">
            <h3 className="font-sans text-xs font-extrabold tracking-wider uppercase text-[#564145] text-left border-b border-gray-50 pb-2">导师建议</h3>
            <p className="text-xs text-[#564145] leading-relaxed text-left">
              {plan.next_action}
            </p>
            <button
              onClick={() => navigate(buildTutorRoute(courseId))}
              className="w-full bg-[#f0f4fc] hover:bg-[#fb7299]/10 text-[#fb7299] font-bold text-xs py-2.5 rounded-xl border border-[#fb7299]/20 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Mail className="w-4 h-4 shrink-0" />
              问 AI 导师
            </button>
          </section>

          <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm flex flex-col gap-4">
            <h3 className="font-sans text-xs font-extrabold tracking-wider uppercase text-[#171c22] border-b border-gray-50 pb-2">快捷入口</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate(buildResourcesRoute(courseId))}
                className="bg-slate-50 hover:bg-slate-100 p-3 rounded-xl flex flex-col items-center justify-center text-center transition-colors border border-gray-100 cursor-pointer"
              >
                <FileText className="w-6 h-6 text-[#fb7299] mb-1.5" />
                <span className="text-[11px] font-bold text-[#171c22]">课程资料</span>
              </button>

              <button
                onClick={() => navigate(`/collection`)}
                className="bg-slate-50 hover:bg-slate-100 p-3 rounded-xl flex flex-col items-center justify-center text-center transition-colors border border-gray-100 cursor-pointer"
              >
                <FolderDown className="w-6 h-6 text-emerald-600 mb-1.5" />
                <span className="text-[11px] font-bold text-[#171c22]">收藏资源</span>
              </button>

              <button
                onClick={() => navigate(buildEvaluationRoute(courseId))}
                className="bg-slate-50 hover:bg-slate-100 p-3 rounded-xl flex flex-col items-center justify-center text-center transition-colors border border-gray-100 cursor-pointer"
              >
                <MessageSquare className="w-6 h-6 text-amber-600 mb-1.5" />
                <span className="text-[11px] font-bold text-[#171c22]">测评中心</span>
              </button>

              <button
                onClick={() => navigate(buildProfileRoute(courseId))}
                className="bg-slate-50 hover:bg-slate-100 p-3 rounded-xl flex flex-col items-center justify-center text-center transition-colors border border-gray-100 cursor-pointer"
              >
                <Sparkles className="w-6 h-6 text-[#006689] mb-1.5" />
                <span className="text-[11px] font-bold text-[#171c22]">画像联动</span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
