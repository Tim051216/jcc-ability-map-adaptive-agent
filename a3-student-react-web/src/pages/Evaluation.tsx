import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronRight, Clock, FileText, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import {
  studentApi,
  type EvaluationGeneratedQuestion,
  type EvaluationHistoryItem,
  type EvaluationPaperSummaryResponse,
  type EvaluationTrendResponse,
  type LearningPlanResponse,
  type PlanProgressResponse,
  type ResourceCard,
  type WrongQuestionItem,
} from "../lib/studentApi";

const DEFAULT_USER_ID = 1001;
const DEFAULT_COURSE_ID = 101;

function getCourseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get("courseId") || DEFAULT_COURSE_ID);
}

function buildKnowledgePoints(plan: LearningPlanResponse | null, resources: ResourceCard[], trend: EvaluationTrendResponse | null) {
  const planPoints = (plan?.steps ?? []).flatMap((step) => step.knowledge_points || []);
  const resourcePoints = resources.flatMap((resource) => resource.source_titles || []);
  const trendPoints = trend?.focus_knowledge_points || [];
  return Array.from(new Set([...planPoints, ...resourcePoints, ...trendPoints])).filter(Boolean).slice(0, 6);
}

function buildReadiness(
  plan: LearningPlanResponse | null,
  progress: PlanProgressResponse | null,
  resources: ResourceCard[],
  trend: EvaluationTrendResponse | null,
) {
  const completion = progress?.completion_rate ?? plan?.completion_rate ?? 0;
  const resourceBreadth = Math.min(100, resources.length * 12);
  const stageScore = Math.min(100, (plan?.stages.length ?? 0) * 24);
  const latestScore = trend?.latest_score ?? 0;
  return Math.round(completion * 0.35 + resourceBreadth * 0.2 + stageScore * 0.2 + latestScore * 0.25);
}

function formatDateLabel(value?: string | null) {
  if (!value) {
    return "暂无记录";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
}

function translateStageText(value?: string | null) {
  if (!value) {
    return "当前还没有激活阶段";
  }

  const map: Record<string, string> = {
    "No active stage yet": "当前还没有激活阶段",
    "Master the A3 intelligent learning workflow": "掌握 A3 智能学习工作流",
    "Master the A3 intelligent learning workflow basics": "掌握 A3 智能学习工作流基础",
  };

  return map[value] || value;
}

export function Evaluation() {
  const courseId = useMemo(() => getCourseIdFromUrl(), []);
  const [plan, setPlan] = useState<LearningPlanResponse | null>(null);
  const [progress, setProgress] = useState<PlanProgressResponse | null>(null);
  const [resources, setResources] = useState<ResourceCard[]>([]);
  const [history, setHistory] = useState<EvaluationHistoryItem[]>([]);
  const [trend, setTrend] = useState<EvaluationTrendResponse | null>(null);
  const [paperSummary, setPaperSummary] = useState<EvaluationPaperSummaryResponse | null>(null);
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestionItem[]>([]);
  const [questions, setQuestions] = useState<EvaluationGeneratedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSignals() {
    try {
      setLoading(true);
      setError(null);

      const [latestPlan, resourceResponse] = await Promise.all([
        studentApi.getLatestLearningPlan(DEFAULT_USER_ID, courseId).catch(() => null),
        studentApi.listResources(DEFAULT_USER_ID, courseId).catch(() => ({ items: [], total: 0 })),
      ]);

      const latestProgress =
        latestPlan?.plan_id ? await studentApi.getPlanProgress(latestPlan.plan_id, DEFAULT_USER_ID).catch(() => null) : null;

      const resolvedCourseCode = latestPlan?.course_code || "ml_intro";
      const [historyResponse, trendResponse, paperSummaryResponse] = await Promise.all([
        studentApi.getEvaluationHistory(DEFAULT_USER_ID, courseId).catch(() => ({ items: [], total: 0 })),
        studentApi.getEvaluationTrend(DEFAULT_USER_ID, courseId).catch(() => null),
        studentApi.getEvaluationPaperSummary(DEFAULT_USER_ID, resolvedCourseCode).catch(() => null),
      ]);

      const latestRecordId = historyResponse.items[0]?.record_id;
      const wrongQuestionResponse = latestRecordId
        ? await studentApi.getWrongQuestions(latestRecordId).catch(() => ({ items: [], total: 0 }))
        : { items: [], total: 0 };

      setPlan(latestPlan);
      setProgress(latestProgress);
      setResources(resourceResponse.items);
      setHistory(historyResponse.items);
      setTrend(trendResponse);
      setPaperSummary(paperSummaryResponse);
      setWrongQuestions(wrongQuestionResponse.items);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "测评准备信息加载失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSignals();
  }, [courseId]);

  const knowledgePoints = useMemo(() => buildKnowledgePoints(plan, resources, trend), [plan, resources, trend]);
  const readiness = useMemo(() => buildReadiness(plan, progress, resources, trend), [plan, progress, resources, trend]);
  const completedSteps = progress?.completed_steps ?? 0;
  const totalSteps = progress?.total_steps ?? plan?.steps.length ?? 0;
  const latestHistory = history[0] || null;

  async function handleGenerateEvaluation() {
    try {
      setGenerating(true);
      setError(null);
      const response = await studentApi.generateEvaluationQuestions({
        test_id: Number(`${courseId}${Date.now()}`.slice(-8)),
        knowledge_points: knowledgePoints.length ? knowledgePoints : ["学习流程", "资源协同"],
        difficulty_level: readiness >= 75 ? 3 : readiness >= 45 ? 2 : 1,
        question_type: 1,
        count: 3,
        generate_layered: false,
        course_context: plan?.summary || latestHistory?.report_summary || "A3 学生端学习闭环实践",
        persist_to_db: false,
      });
      setQuestions(response.questions);
    } catch (generateError) {
      const message = generateError instanceof Error ? generateError.message : "测评题目生成失败";
      setError(message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-8 pb-20">
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-12 rounded-2xl border border-outline-variant bg-white p-12 shadow-sm md:flex-row md:items-center lg:col-span-2">
          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <h2 className="text-4xl font-black tracking-tight text-on-surface">先判断你现在适不适合做测评</h2>
              <p className="text-lg leading-relaxed text-on-surface-variant">
                这里会根据你最近的学习进度、资料使用情况和历史成绩，帮你判断“现在做题太早、刚刚好，还是已经可以加难度了”。
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-surface-variant/25 p-4">
                <div className="text-[11px] font-bold text-primary">先看这个值</div>
                <div className="mt-2 text-sm text-on-surface">准备度越高，越适合开始测评</div>
              </div>
              <div className="rounded-2xl bg-surface-variant/25 p-4">
                <div className="text-[11px] font-bold text-primary">再看这些信号</div>
                <div className="mt-2 text-sm text-on-surface">最近得分、已学知识点、资料覆盖</div>
              </div>
              <div className="rounded-2xl bg-surface-variant/25 p-4">
                <div className="text-[11px] font-bold text-primary">最后做什么</div>
                <div className="mt-2 text-sm text-on-surface">一键生成一组测评题先试试水</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-12">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10">
                  <TrendingUp className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">最近得分</span>
                  <span className="text-3xl font-black text-secondary">{trend?.latest_score ?? "--"}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-tertiary/10">
                  <AlertCircle className="h-6 w-6 text-tertiary" />
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">已覆盖主题</span>
                  <span className="text-3xl font-black text-tertiary">{knowledgePoints.length}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex shrink-0 items-center justify-center">
            <div className="relative h-64 w-64">
              <svg className="h-full w-full -rotate-90 transform">
                <circle className="text-surface-container-high" cx="128" cy="128" fill="transparent" r="110" stroke="currentColor" strokeWidth="12" />
                <motion.circle
                  initial={{ strokeDashoffset: 691.15 }}
                  animate={{ strokeDashoffset: 691.15 - (691.15 * Math.max(0, Math.min(readiness, 100))) / 100 }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="text-primary"
                  cx="128"
                  cy="128"
                  fill="transparent"
                  r="110"
                  stroke="currentColor"
                  strokeDasharray="691.15"
                  strokeLinecap="round"
                  strokeWidth="16"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-6xl font-black leading-none text-primary">{readiness}%</span>
                <span className="mt-2 text-[10px] font-bold tracking-[0.2em] text-on-surface-variant">准备度</span>
              </div>
            </div>
          </div>
        </div>

        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-primary p-8 text-white shadow-xl">
          <div className="relative z-10">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
              <RefreshCw className="h-8 w-8 text-white" />
            </div>
            <h3 className="mb-4 text-2xl font-black">不知道先做什么题？</h3>
            <p className="text-sm leading-relaxed opacity-80">系统可以按你当前状态，先生成一组难度更合适的测评题。</p>
          </div>

          <div className="relative z-10 space-y-4">
            <button
              onClick={() => void handleGenerateEvaluation()}
              disabled={generating}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-white py-4 font-bold text-primary shadow-lg transition-all hover:bg-surface-container-low disabled:opacity-70"
            >
              <RefreshCw className={`h-5 w-5 ${generating ? "animate-spin" : ""}`} />
              {generating ? "正在生成..." : "先给我一组测评题"}
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">{error}</div> : null}

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <h3 className="flex items-center gap-3 px-1 text-xl font-bold text-on-surface">
            <FileText className="h-5 w-5 text-primary" />
            你现在的测评依据
          </h3>
          <div className="space-y-4">
            {[
              {
                title: translateStageText(plan?.current_stage || trend?.latest_mastery_level),
                status: "当前学习阶段",
                duration: `${totalSteps} 个任务步骤`,
                progress: progress?.completion_rate ?? plan?.completion_rate ?? 0,
              },
              {
                title: `已跟踪 ${paperSummary?.total_questions ?? 0} 道题目`,
                status: "试卷情况",
                duration: `${paperSummary?.total ?? 0} 份试卷`,
                progress: Math.min(100, (paperSummary?.total_questions ?? 0) * 10),
              },
              {
                title: `已关联 ${resources.length} 条资料`,
                status: "资料基础",
                duration: `${knowledgePoints.length} 个知识点`,
                progress: Math.min(100, resources.length * 12),
              },
            ].map((item) => (
              <div key={item.status} className="group cursor-default rounded-2xl border border-outline-variant bg-white p-6 transition-all hover:border-primary">
                <div className="mb-4 flex items-start justify-between">
                  <span className="rounded-lg bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">{item.status}</span>
                  <span className="text-[10px] font-bold text-on-surface-variant">{item.duration}</span>
                </div>
                <h4 className="mb-4 font-bold text-on-surface">{item.title}</h4>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                  <div className="h-full bg-primary" style={{ width: `${Math.max(6, Math.round(item.progress))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-8">
          <h3 className="flex items-center gap-3 px-1 text-xl font-bold text-on-surface">
            <Sparkles className="h-5 w-5 text-primary" />
            以前做过哪些测评
          </h3>
          {history.length ? (
            <div className="grid grid-cols-1 gap-6">
              {history.map((item) => (
                <div key={item.record_id} className="rounded-2xl border border-outline-variant bg-white p-6 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
                      {item.mastery_level}
                    </span>
                    <span className="text-xs font-bold text-on-surface-variant">{formatDateLabel(item.created_at)}</span>
                  </div>
                  <div className="mb-3 flex items-end justify-between gap-4">
                    <p className="text-base font-bold leading-8 text-on-surface">{item.report_summary}</p>
                    <div className="text-right">
                      <div className="text-3xl font-black text-primary">{item.overall_score}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">得分</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.knowledge_points.map((point) => (
                      <span key={point} className="rounded-full bg-surface-variant/35 px-3 py-1 text-xs text-on-surface-variant">
                        {point}
                      </span>
                    ))}
                  </div>
                  {item.weak_points.length ? (
                    <div className="mt-5 rounded-xl bg-surface-variant/25 p-4">
                      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
                        <ChevronRight className="h-4 w-4" />
                        这次暴露出的薄弱点
                      </div>
                      <p className="text-sm leading-7 text-on-surface-variant">{item.weak_points.join(" / ")}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-outline-variant bg-white px-6 py-10 text-center text-sm text-on-surface-variant">
              当前课程还没有测评历史，先生成一组题试试，后面这里会沉淀你的成绩变化。
            </div>
          )}
        </div>
      </section>

      {questions.length ? (
        <section className="space-y-6">
          <h3 className="flex items-center gap-3 px-1 text-xl font-bold text-on-surface">
            <Sparkles className="h-5 w-5 text-primary" />
            系统刚帮你出的题
          </h3>
          <div className="grid grid-cols-1 gap-6">
            {questions.map((item, index) => (
              <div key={`${item.knowledge_point}-${index}`} className="rounded-2xl border border-outline-variant bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
                    {item.knowledge_point}
                  </span>
                  <span className="text-xs font-bold text-on-surface-variant">难度 {item.difficulty_level}</span>
                </div>
                <p className="mb-5 text-base font-bold leading-8 text-on-surface">{item.question_content}</p>
                <div className="space-y-3">
                  {item.question_options.map((option) => (
                    <div key={option.key} className="rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm text-on-surface">
                      <span className="mr-2 font-black text-primary">{option.key}.</span>
                      {option.value}
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl bg-surface-variant/25 p-4">
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
                    <ChevronRight className="h-4 w-4" />
                    出这道题的原因
                  </div>
                  <p className="text-sm leading-7 text-on-surface-variant">{item.answer_analysis}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-outline-variant bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-bold text-on-surface">这次测评主要围绕哪些内容</h3>
            <p className="mt-2 text-sm leading-7 text-on-surface-variant">
              当前知识点来自学习路径、资料上下文和趋势分析中的重点主题，所以比随机出题更贴近你最近的学习情况。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {knowledgePoints.length ? (
              knowledgePoints.map((point) => (
                <span key={point} className="rounded-full bg-surface-variant/60 px-3 py-1 text-[11px] text-on-surface-variant">
                  {point}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-surface-variant/60 px-3 py-1 text-[11px] text-on-surface-variant">等待路径或资料信号</span>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-surface-variant/25 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-primary">学习进度</div>
            <div className="mt-2 text-2xl font-black text-on-surface">
              {completedSteps}/{totalSteps || "--"}
            </div>
          </div>
          <div className="rounded-2xl bg-surface-variant/25 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-primary">已关联试卷</div>
            <div className="mt-2 text-2xl font-black text-on-surface">{paperSummary?.total ?? 0}</div>
          </div>
          <div className="rounded-2xl bg-surface-variant/25 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-primary">最近错题</div>
            <div className="mt-2 text-2xl font-black text-on-surface">{wrongQuestions.length}</div>
          </div>
        </div>

        {wrongQuestions.length ? (
          <div className="mt-6 rounded-2xl border border-outline-variant/40 p-5">
            <div className="mb-3 text-sm font-bold text-on-surface">做题前建议先回看这些薄弱点</div>
            <div className="flex flex-wrap gap-2">
              {wrongQuestions.map((item) => (
                <span key={item.question_id} className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                  {item.knowledge_point}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-on-surface-variant">
            <Clock className="h-4 w-4" />
            正在加载测评准备信息...
          </div>
        ) : null}
      </section>
    </div>
  );
}
