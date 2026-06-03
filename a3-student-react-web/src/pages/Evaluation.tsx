/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  CheckCircle,
  ChevronRight,
  LoaderCircle,
  Lock,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  studentApi,
  type ChatResponse,
  type EvaluationHistoryItem,
  type EvaluationPaperQuestion,
  type EvaluationPaperResponse,
  type EvaluationResultResponse,
  type EvaluationTrendResponse,
  type LearningPlanResponse,
  type ProfileBehaviorUpdateResponse,
  type ProfileSummaryResponse,
  type ResourceCard,
  type WrongQuestionItem,
} from "../lib/studentApi";

const USER_ID = 1001;
const ACTIVE_COURSE_KEY = "software-engineering";

type CourseOption = {
  key: string;
  title: string;
  subtitle: string;
  description: string;
  status: "available" | "updating";
  courseId: number;
  routeCourseId: string;
};

const COURSE_OPTIONS: CourseOption[] = [
  {
    key: ACTIVE_COURSE_KEY,
    title: "软件工程",
    subtitle: "软件工程与实践（第 4 版）",
    description: "当前已接入真实课程资料、真实测评题目与完整学习闭环。",
    status: "available",
    courseId: 401,
    routeCourseId: "series-2",
  },
  {
    key: "data-structure",
    title: "数据结构",
    subtitle: "课程资料接入中",
    description: "后续将接入真实教材、阶段测评与错题复盘能力。",
    status: "updating",
    courseId: 0,
    routeCourseId: "updating-data-structure",
  },
  {
    key: "operating-system",
    title: "操作系统",
    subtitle: "课程资料接入中",
    description: "后续将支持真实章节诊断、路径调整与资源推荐。",
    status: "updating",
    courseId: 0,
    routeCourseId: "updating-operating-system",
  },
  {
    key: "database",
    title: "数据库系统",
    subtitle: "课程资料接入中",
    description: "后续将开放真实测评、画像回写与专项强化建议。",
    status: "updating",
    courseId: 0,
    routeCourseId: "updating-database",
  },
  {
    key: "network",
    title: "计算机网络",
    subtitle: "课程资料接入中",
    description: "后续将接入网络课程资料、阶段自测与答疑联动。",
    status: "updating",
    courseId: 0,
    routeCourseId: "updating-network",
  },
];

function formatDate(value?: string | null) {
  if (!value) return "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined) return "暂无";
  return `${Math.round(value)}%`;
}

function getOptionKey(option: string) {
  const matched = option.match(/^\s*([A-Z])[\.\u3001:：\s-]/i);
  return matched ? matched[1].toUpperCase() : option.trim().toUpperCase();
}

function normalizeAnswerToken(value: string) {
  return value
    .split(",")
    .map((item) => getOptionKey(item))
    .filter(Boolean)
    .join(",");
}

function toStudentFriendlyCourseName(value: string, fallback = "软件工程") {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized.includes("software_engineering") || normalized.includes("software-engineering")) {
    return "软件工程";
  }
  if (normalized.includes("course-401")) {
    return "软件工程";
  }
  return value;
}

function toStudentFriendlyStage(value?: string | null) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return "待测评确认";
  if (normalized.includes("deep") || normalized.includes("advanced")) return "深化提升阶段";
  if (normalized.includes("stable")) return "巩固提升阶段";
  if (normalized.includes("start") || normalized.includes("begin")) return "起步适应阶段";
  return value || "待测评确认";
}

function toStudentFriendlyMastery(value?: string | null) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return "待评估";
  if (normalized === "proficient") return "掌握良好";
  if (normalized === "stable") return "掌握稳定";
  if (normalized === "developing") return "仍需加强";
  return value || "待评估";
}

function toStudentFriendlyKnowledgePoint(value: string, fallbackCourseName: string) {
  const normalized = value.trim();
  if (!normalized) return "当前核心知识点";
  if (normalized.includes("software_engineering_4th")) {
    return `${fallbackCourseName}核心知识点`;
  }
  if (normalized.includes("相关错误模式")) {
    return `${fallbackCourseName}核心薄弱点`;
  }
  if (normalized.includes("综合应用与迁移输出能力")) {
    return "综合应用与迁移输出";
  }
  return normalized;
}

function toStudentFriendlySummary(value: string, fallbackCourseName: string) {
  if (!value) return `${fallbackCourseName}阶段测评已完成，可用于后续路径优化。`;
  return value
    .replaceAll("software_engineering_4th", fallbackCourseName)
    .replaceAll("software-engineering", fallbackCourseName);
}

function resolveCourseCode(
  courseId: number,
  trend: EvaluationTrendResponse | null,
  history: EvaluationHistoryItem[],
) {
  return trend?.course_code || history[0]?.course_code || `COURSE-${courseId}`;
}

export default function Evaluation() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const rawCourseKey = searchParams.get("courseId") || "";
  const selectedCourse =
    COURSE_OPTIONS.find((item) => item.key === rawCourseKey || item.routeCourseId === rawCourseKey) ?? null;
  const activeCourse = selectedCourse?.status === "available" ? selectedCourse : null;
  const numericCourseId = activeCourse?.courseId ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyItems, setHistoryItems] = useState<EvaluationHistoryItem[]>([]);
  const [trend, setTrend] = useState<EvaluationTrendResponse | null>(null);
  const [profileSummary, setProfileSummary] = useState<ProfileSummaryResponse | null>(null);
  const [latestPlan, setLatestPlan] = useState<LearningPlanResponse | null>(null);

  const [activePaper, setActivePaper] = useState<EvaluationPaperResponse | null>(null);
  const [paperLoading, setPaperLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [latestResult, setLatestResult] = useState<EvaluationResultResponse | null>(null);
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestionItem[]>([]);
  const [feedbackApplied, setFeedbackApplied] = useState<ProfileBehaviorUpdateResponse | null>(null);
  const [refreshedPlan, setRefreshedPlan] = useState<LearningPlanResponse | null>(null);
  const [generatedResources, setGeneratedResources] = useState<ResourceCard[]>([]);
  const [tutorFollowup, setTutorFollowup] = useState<ChatResponse | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const courseCode = useMemo(
    () => (numericCourseId ? resolveCourseCode(numericCourseId, trend, historyItems) : "未选择课程"),
    [historyItems, numericCourseId, trend],
  );

  const displayCourseName = activeCourse?.title || "软件工程";
  const displayCourseCode = activeCourse?.subtitle || toStudentFriendlyCourseName(courseCode, displayCourseName);

  const suggestedKnowledgePoints = useMemo(() => {
    const fromTrend = trend?.focus_knowledge_points?.filter(Boolean) ?? [];
    if (fromTrend.length) {
      return fromTrend.slice(0, 5).map((item) => toStudentFriendlyKnowledgePoint(item, displayCourseName));
    }

    const fromPlan =
      latestPlan?.steps
        .flatMap((step) => step.knowledge_points)
        .filter((value, index, array) => Boolean(value) && array.indexOf(value) === index)
        .map((item) => toStudentFriendlyKnowledgePoint(item, displayCourseName)) ?? [];

    if (fromPlan.length) {
      return fromPlan.slice(0, 5);
    }

    return ["需求分析", "软件测试", "过程模型"];
  }, [displayCourseName, latestPlan, trend]);

  const selectedAnswerCount = Object.keys(answers).length;
  const overallScoreLabel = latestResult
    ? formatPercent(latestResult.overall_score)
    : formatPercent(trend?.latest_score);
  const currentStep = !activeCourse ? 1 : !activePaper ? 2 : latestResult ? 4 : 3;

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 2600);
  };

  const resetEvaluationFlow = () => {
    setError("");
    setHistoryItems([]);
    setTrend(null);
    setProfileSummary(null);
    setLatestPlan(null);
    setActivePaper(null);
    setAnswers({});
    setLatestResult(null);
    setWrongQuestions([]);
    setFeedbackApplied(null);
    setRefreshedPlan(null);
    setGeneratedResources([]);
    setTutorFollowup(null);
  };

  const handleChooseCourse = (course: CourseOption) => {
    if (course.status !== "available") {
      showToast(`${course.title}资料更新中，当前仅开放软件工程真实测评。`);
      return;
    }

    resetEvaluationFlow();
    setSearchParams({ courseId: course.key });
  };

  const loadEvaluationState = async () => {
    if (!numericCourseId) {
      resetEvaluationFlow();
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [historyResult, trendResult, profileResult, planResult] = await Promise.allSettled([
        studentApi.getEvaluationHistory(USER_ID, numericCourseId),
        studentApi.getEvaluationTrend(USER_ID, numericCourseId),
        studentApi.getProfileSummary(USER_ID),
        studentApi.getLatestLearningPlan(USER_ID, numericCourseId),
      ]);

      setHistoryItems(historyResult.status === "fulfilled" ? historyResult.value.items : []);
      setTrend(trendResult.status === "fulfilled" ? trendResult.value : null);
      setProfileSummary(profileResult.status === "fulfilled" ? profileResult.value : null);
      setLatestPlan(planResult.status === "fulfilled" ? planResult.value : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "测评数据加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvaluationState();
  }, [numericCourseId]);

  const handleStartPaper = async () => {
    if (!activeCourse || !numericCourseId) {
      showToast("请先选择课程，再开始真实测评。");
      return;
    }

    setPaperLoading(true);
    setError("");
    try {
      const paper = await studentApi.generateEvaluationPaper({
        user_id: USER_ID,
        course_id: numericCourseId,
        target: `${activeCourse.title}阶段诊断`,
        knowledge_points: suggestedKnowledgePoints,
        paper_type: "diagnostic",
        question_count: 5,
      });
      setActivePaper(paper);
      setAnswers({});
      setLatestResult(null);
      setWrongQuestions([]);
      setFeedbackApplied(null);
      setRefreshedPlan(null);
      setGeneratedResources([]);
      setTutorFollowup(null);
      showToast("已生成真实测评试卷。");
    } catch (paperError) {
      setError(paperError instanceof Error ? paperError.message : "试卷生成失败");
    } finally {
      setPaperLoading(false);
    }
  };

  const handleSelectAnswer = (questionId: string, answer: string) => {
    if (latestResult) return;
    setAnswers((current) => ({
      ...current,
      [questionId]: answer,
    }));
  };

  const handleRestart = () => {
    setActivePaper(null);
    setAnswers({});
    setLatestResult(null);
    setWrongQuestions([]);
    setFeedbackApplied(null);
    setRefreshedPlan(null);
    setGeneratedResources([]);
    setTutorFollowup(null);
  };

  const buildFollowupQuestion = (result: EvaluationResultResponse) => {
    const focus =
      result.knowledge_points[0] ||
      result.weak_points[0] ||
      suggestedKnowledgePoints[0] ||
      activeCourse?.title ||
      "当前课程";

    return `我刚完成${activeCourse?.title || "当前课程"}的阶段测评，请结合本次得分${Math.round(
      result.overall_score,
    )}分和当前薄弱点${toStudentFriendlyKnowledgePoint(focus, displayCourseName)}，给我一份答疑讲解和下一步突破建议。`;
  };

  const handleSubmit = async () => {
    if (!activePaper || !numericCourseId || !activeCourse) {
      showToast("请先生成测评试卷。");
      return;
    }

    if (selectedAnswerCount < activePaper.questions.length) {
      showToast("请先完成本次试卷的全部题目。");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const profilePayload = profileSummary
        ? {
            completeness: profileSummary.completeness,
            tags: profileSummary.tags,
            recommended_learning_style: profileSummary.recommended_learning_style,
            current_stage: profileSummary.current_stage,
          }
        : null;

      const planPayload = latestPlan
        ? {
            plan_id: latestPlan.plan_id,
            summary: latestPlan.summary,
            next_action: latestPlan.next_action,
            steps: latestPlan.steps.slice(0, 6),
          }
        : null;

      const result = await studentApi.submitEvaluationPaper(activePaper.paper_id, {
        user_id: USER_ID,
        scene: "student_evaluation_page",
        profile: profilePayload,
        plan: planPayload,
        resources: generatedResources.map((item) => ({
          title: item.title,
          resource_type: item.resource_type,
          summary: item.summary,
        })),
        learning_duration_minutes: 20,
        resource_usage_count: generatedResources.length,
        answers: activePaper.questions.map((question) => ({
          question_id: question.question_id,
          answer: normalizeAnswerToken(answers[question.question_id] || ""),
        })),
      });

      setLatestResult(result);

      if (result.record_id) {
        const wrongQuestionResult = await studentApi
          .getWrongQuestions(result.record_id)
          .catch(() => ({ items: [], total: 0 }));
        setWrongQuestions(wrongQuestionResult.items);
      } else {
        setWrongQuestions([]);
      }

      const nextKnowledgePoints = result.knowledge_points.length
        ? result.knowledge_points
        : suggestedKnowledgePoints;

      const followupPrompt = buildFollowupQuestion(result);

      const [profileUpdateResult, planRefreshResult, resourceGenerationResult, tutorResult] =
        await Promise.allSettled([
          studentApi.reportProfileBehavior({
            user_id: USER_ID,
            behavior_type: 1,
            behavior_data: {
              scene: "evaluation_submit",
              course_id: numericCourseId,
              course_code: courseCode,
              record_id: result.record_id,
              overall_score: result.overall_score,
              mastery_level: result.mastery_level,
              weak_points: result.weak_points,
              knowledge_points: result.knowledge_points,
            },
            result: result.mastery_level,
            duration: 20 * 60,
          }),
          studentApi.generateLearningPlan({
            user_id: USER_ID,
            course_id: numericCourseId,
            target: `围绕${nextKnowledgePoints[0] || activeCourse.title}进行下一阶段强化`,
            available_days: 7,
            daily_study_minutes: 35,
          }),
          studentApi.generateResources({
            user_id: USER_ID,
            course_id: numericCourseId,
            knowledge_points: nextKnowledgePoints,
            resource_types: ["lecture_note", "practice_set", "mindmap"],
          }),
          studentApi.chat({
            user_id: USER_ID,
            course_id: numericCourseId,
            course_code: courseCode,
            scene: "evaluation_followup",
            message: followupPrompt,
          }),
        ]);

      setFeedbackApplied(profileUpdateResult.status === "fulfilled" ? profileUpdateResult.value : null);
      setRefreshedPlan(planRefreshResult.status === "fulfilled" ? planRefreshResult.value : null);
      setGeneratedResources(
        resourceGenerationResult.status === "fulfilled" ? resourceGenerationResult.value.resources : [],
      );
      setTutorFollowup(tutorResult.status === "fulfilled" ? tutorResult.value : null);

      await loadEvaluationState();
      showToast("测评结果已回写到画像、规划、资源与答疑链路。");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "测评提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: EvaluationPaperQuestion, index: number) => {
    const selectedAnswer = answers[question.question_id];
    const isSubmitted = Boolean(latestResult);
    const correctAnswerKey = normalizeAnswerToken(question.correct_answer);

    return (
      <div key={question.question_id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
        <p className="flex items-start gap-2 text-sm font-extrabold text-[#171c22]">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#fb7299]/15 text-xs font-mono text-[#fb7299]">
            {index + 1}
          </span>
          {question.prompt}
        </p>
        <div className="mt-4 grid gap-2 pl-7">
          {question.options.map((option) => {
            const isSelected = selectedAnswer === option;
            const optionKey = normalizeAnswerToken(option);
            const isCorrect = isSubmitted && optionKey === correctAnswerKey;
            const isWrong = isSubmitted && isSelected && optionKey !== correctAnswerKey;
            return (
              <button
                key={option}
                type="button"
                disabled={isSubmitted}
                onClick={() => handleSelectAnswer(question.question_id, option)}
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-xs font-semibold transition-all ${
                  isCorrect
                    ? "border-emerald-500 bg-emerald-50 text-emerald-950"
                    : isWrong
                      ? "border-red-400 bg-red-50 text-red-950"
                      : isSelected
                        ? "border-[#fb7299] bg-[#fb7299]/5 text-[#fb7299]"
                        : "border-[#eaeef6] bg-white text-[#564145] hover:border-gray-300"
                }`}
              >
                <span>{option}</span>
                {isCorrect ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : null}
                {isWrong ? <XCircle className="h-4 w-4 text-red-500" /> : null}
              </button>
            );
          })}
        </div>
        {isSubmitted ? (
          <div className="mt-4 pl-7 text-[11px] leading-6 text-[#564145]">
            <p className="font-bold text-[#171c22]">测评反馈智能体解析</p>
            <p>{question.explanation || "本题解析已同步写入本次测评结果。"}</p>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6 select-none" id="evaluation-workspace">
      <section className="overflow-hidden rounded-[32px] border border-black/[0.06] bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfd_100%)] shadow-[0_24px_80px_rgba(17,24,39,0.08)]">
        <div className="grid gap-0 xl:grid-cols-[1.5fr_0.85fr]">
          <div className="relative p-6 lg:p-8">
            <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(15,23,42,0.08),transparent)]" />
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/90 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.05)] backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                测评中心
              </span>
              <span className="rounded-full border border-black/[0.06] bg-[#f6f7fb] px-3 py-1 text-[11px] font-bold text-[#6b7280]">
                当前第 {currentStep} 步 / 共 4 步
              </span>
            </div>

            <div className="mt-5 max-w-3xl">
              <h1 className="text-[2.1rem] font-extrabold tracking-[-0.04em] text-[#111827] lg:text-[3.1rem]">
                学习测评中心
              </h1>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <TaskStep
                index={1}
                title="选择课程"
                desc="先确定要测哪门课"
                active={currentStep === 1}
                done={Boolean(activeCourse)}
              />
              <TaskStep
                index={2}
                title="生成试卷"
                desc="系统按知识点出题"
                active={currentStep === 2}
                done={Boolean(activePaper)}
              />
              <TaskStep
                index={3}
                title="完成作答"
                desc="答完并提交本次测评"
                active={currentStep === 3}
                done={Boolean(latestResult)}
              />
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              {!activeCourse ? (
                <span className="inline-flex items-center gap-2 rounded-2xl bg-[#111827] px-4 py-3 text-sm font-bold text-white shadow-[0_18px_32px_rgba(17,24,39,0.18)]">
                  当前
                  <ChevronRight className="h-4 w-4" />
                  选择课程
                </span>
              ) : !activePaper ? (
                <span className="inline-flex items-center gap-2 rounded-2xl bg-[#111827] px-4 py-3 text-sm font-bold text-white shadow-[0_18px_32px_rgba(17,24,39,0.18)]">
                  当前
                  <ChevronRight className="h-4 w-4" />
                  生成试卷
                </span>
              ) : latestResult ? (
                <span className="inline-flex items-center gap-2 rounded-2xl bg-[#111827] px-4 py-3 text-sm font-bold text-white shadow-[0_18px_32px_rgba(17,24,39,0.18)]">
                  当前
                  <CheckCircle className="h-4 w-4" />
                  查看结果
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-2xl bg-[#111827] px-4 py-3 text-sm font-bold text-white shadow-[0_18px_32px_rgba(17,24,39,0.18)]">
                  当前
                  <ChevronRight className="h-4 w-4" />
                  提交测评
                </span>
              )}
            </div>
          </div>

          <div className="border-t border-black/[0.05] bg-[linear-gradient(180deg,#f9fafb_0%,#f3f4f6_100%)] p-6 xl:border-l xl:border-t-0 lg:p-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">控制面板</p>
            <div className="mt-4 grid gap-2.5">
              <CommandMetric title="最近分数" value={overallScoreLabel} />
              <CommandMetric title="错题复盘" value={wrongQuestions.length ? `${wrongQuestions.length} 题` : "待生成"} />
              <CommandMetric title="资源更新" value={generatedResources.length ? `${generatedResources.length} 项` : "待同步"} />
            </div>

            <div className="mt-5 rounded-[24px] border border-black/[0.06] bg-white/90 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">当前测评课程</p>
                <p className="mt-1 text-lg font-extrabold text-[#171c22]">{displayCourseName}</p>
                <p className="mt-1 text-sm text-[#5a6970]">{displayCourseCode}</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SimpleInfo label="重点知识点" value={suggestedKnowledgePoints[0] || "暂无"} />
                <SimpleInfo
                  label="学习阶段"
                  value={toStudentFriendlyStage(profileSummary?.current_stage || latestPlan?.current_stage || "待测评确认")}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-black/[0.06] bg-white/95 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#73838a]">Step 1</p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#171c22]">选择课程</h2>
          </div>
          <div className={`rounded-full px-4 py-2 text-xs font-bold ${activeCourse ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {activeCourse ? `已选择：${activeCourse.title}` : "尚未选择课程"}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {COURSE_OPTIONS.map((course) => {
            const isActive = activeCourse?.key === course.key;
            const isAvailable = course.status === "available";

            return (
              <button
                key={course.key}
                type="button"
                onClick={() => handleChooseCourse(course)}
                className={`group rounded-[24px] border p-5 text-left transition-all ${
                  isActive
                    ? "border-[#111827]/18 bg-[linear-gradient(180deg,rgba(17,24,39,0.05),rgba(17,24,39,0.015))] shadow-[0_20px_36px_rgba(17,24,39,0.08)]"
                    : isAvailable
                      ? "border-black/[0.06] bg-white hover:-translate-y-1 hover:border-[#111827]/16 hover:shadow-[0_18px_32px_rgba(17,24,39,0.06)]"
                      : "border-black/[0.05] bg-[#f7f7f8] opacity-90"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-extrabold text-[#171c22]">{course.title}</p>
                    <p className="mt-1 text-xs font-semibold text-[#564145]">{course.subtitle}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      isAvailable
                        ? "bg-[#eff6ff] text-[#1d4ed8]"
                        : "flex items-center gap-1 bg-[#f3f4f6] text-[#6b7280]"
                    }`}
                  >
                    {isAvailable ? "可测评" : <Lock className="h-3.5 w-3.5" />}
                    {isAvailable ? null : "更新中"}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-[#564145]">{course.description}</p>
                <div className="mt-5 flex items-center justify-between border-t border-[#edf2f4] pt-4">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#95a2a8]">
                    {isAvailable ? "READY" : "LOCKED"}
                  </span>
                  <ArrowRight className={`h-4 w-4 ${isAvailable ? "text-[#171c22] transition-transform group-hover:translate-x-1" : "text-slate-300"}`} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {!activeCourse ? (
        <section className="rounded-[32px] border border-dashed border-black/[0.08] bg-[linear-gradient(180deg,#ffffff_0%,#fafafc_100%)] p-8 text-center shadow-[0_18px_36px_rgba(15,23,42,0.04)]">
          <p className="text-xl font-extrabold text-[#171c22]">选择课程后开始测评</p>
        </section>
      ) : null}

      {activeCourse && loading ? (
        <div className="rounded-[32px] border border-[#E3E8EC] bg-white p-8 text-sm text-[#564145] shadow-[0_16px_40px_rgba(23,28,34,0.05)]">
          <div className="flex items-center gap-3">
            <LoaderCircle className="h-5 w-5 animate-spin text-[#fb7299]" />
            <span>正在读取真实测评数据与学习上下文...</span>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{error}</div>
          </div>
        </div>
      ) : null}

      {activeCourse ? (
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="min-w-0 flex-grow rounded-[32px] border border-black/[0.06] bg-white/95 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur">
            {!activePaper ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#73838a]">Step 2</p>
                    <h3 className="mt-2 text-xl font-extrabold text-[#171c22]">开始测评</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadEvaluationState()}
                    className="flex items-center gap-1 text-xs font-semibold text-[#564145] hover:text-[#fb7299]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    刷新
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <StatCard
                    label="历史测评次数"
                    value={String(historyItems.length)}
                    hint="来自真实测评记录"
                    icon={<BookOpen className="h-5 w-5" />}
                  />
                  <StatCard
                    label="平均得分"
                    value={formatPercent(trend?.average_score)}
                    hint="历史趋势统计"
                    icon={<Target className="h-5 w-5" />}
                  />
                  <StatCard
                    label="画像完整度"
                    value={`${profileSummary?.completeness ?? 0}%`}
                    hint="测评提交后会继续更新"
                    icon={<Sparkles className="h-5 w-5" />}
                  />
                </div>

                <div className="rounded-[24px] border border-black/[0.06] bg-[linear-gradient(135deg,#fcfcfd_0%,#f6f7fb_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Step 3</p>
                  <p className="mt-2 text-lg font-extrabold text-[#171c22]">生成试卷</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {suggestedKnowledgePoints.map((point) => (
                      <span key={point} className="rounded-full border border-black/[0.05] bg-white px-3 py-1.5 text-xs font-bold text-[#4b5563] shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
                        {point}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleStartPaper()}
                    disabled={paperLoading}
                    className="mt-5 rounded-2xl bg-[#111827] px-5 py-3 text-xs font-bold text-white shadow-[0_18px_32px_rgba(17,24,39,0.16)] transition hover:scale-[1.01] hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {paperLoading ? "正在生成真实试卷..." : "开始一次真实测评"}
                  </button>
                </div>

                <div className="space-y-3">
                  {historyItems.length ? (
                    historyItems.map((item) => (
                      <div key={item.record_id} className="rounded-[22px] border border-black/[0.06] p-4 transition-colors hover:bg-slate-50/70">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-extrabold text-[#171c22]">
                              {displayCourseName} · {toStudentFriendlyMastery(item.mastery_level)}
                            </p>
                            <p className="mt-1 text-[11px] leading-6 text-[#564145]">
                              {toStudentFriendlySummary(item.report_summary, displayCourseName)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold uppercase text-slate-400">得分</p>
                            <p className="text-sm font-extrabold text-[#fb7299]">{formatPercent(item.overall_score)}</p>
                          </div>
                        </div>
                        <p className="mt-2 text-[10px] text-slate-400">记录时间：{formatDate(item.created_at)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[22px] border border-black/[0.06] bg-slate-50 px-4 py-6 text-sm text-[#564145]">
                      当前还没有真实测评记录，点击上方按钮即可生成并完成第一份试卷。
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 border-b border-gray-100 pb-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <span className="rounded-full border border-black/[0.06] bg-[#f6f7fb] px-2.5 py-1 font-mono text-[9px] font-extrabold uppercase text-[#111827]">
                      真实试卷
                    </span>
                    <h3 className="mt-2 font-sans text-xl font-extrabold text-[#171c22]">
                      {activeCourse.title}
                    </h3>
                    <p className="mt-2 text-sm text-[#564145]">试卷编号 {activePaper.paper_id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="flex items-center gap-1 text-xs font-semibold text-[#564145] hover:text-[#fb7299]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    返回列表
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <StatCard
                    label="试卷题数"
                    value={`${activePaper.questions.length} 题`}
                    hint="实时生成的阶段诊断卷"
                    icon={<BookOpen className="h-5 w-5" />}
                  />
                  <StatCard
                    label="已完成作答"
                    value={`${selectedAnswerCount}/${activePaper.questions.length}`}
                    hint="提交前需完成全部题目"
                    icon={<Target className="h-5 w-5" />}
                  />
                  <StatCard
                    label="提交状态"
                    value={latestResult ? "已完成" : "进行中"}
                    hint={latestResult ? "结果已同步进入闭环链路" : "可随时切换选项后提交"}
                    icon={<TrendingUp className="h-5 w-5" />}
                  />
                </div>

                <div className="space-y-6">{activePaper.questions.map((question, index) => renderQuestion(question, index))}</div>

                {!latestResult ? (
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={submitting}
                    className="w-full rounded-2xl bg-[#111827] py-3 text-xs font-bold text-white shadow-[0_18px_32px_rgba(17,24,39,0.16)] transition hover:scale-[1.01] hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting
                      ? "正在提交真实测评并触发学习闭环..."
                      : `提交本次测评（已完成 ${selectedAnswerCount}/${activePaper.questions.length} 题）`}
                  </button>
                ) : (
                  <div className="space-y-5">
                    <div className="rounded-[24px] border border-emerald-100 bg-[linear-gradient(135deg,#f0fdf4_0%,#ecfeff_100%)] p-5 shadow-[0_12px_30px_rgba(16,185,129,0.08)]">
                      <p className="font-mono text-xs font-extrabold uppercase tracking-wider text-emerald-700">已完成</p>
                      <h4 className="mt-1 text-base font-extrabold text-[#171c22]">
                        得分 <span className="text-emerald-600">{formatPercent(latestResult.overall_score)}</span>
                      </h4>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <FeedbackBlock title="画像回写" body={feedbackApplied?.summary || "画像行为更新已提交。"} />
                      <FeedbackBlock
                        title="路径调整"
                        body={
                          refreshedPlan?.next_action ||
                          toStudentFriendlyKnowledgePoint(
                            String(latestResult.path_feedback?.next_focus || "已生成下一步强化建议。"),
                            displayCourseName,
                          )
                        }
                      />
                      <FeedbackBlock
                        title="资源生成"
                        body={
                          generatedResources.length
                            ? `已生成 ${generatedResources.length} 份针对性资源，优先围绕 ${
                                toStudentFriendlyKnowledgePoint(
                                  latestResult.knowledge_points[0] || "当前薄弱点",
                                  displayCourseName,
                                )
                              } 展开。`
                            : "资源生成请求已发出。"
                        }
                      />
                      <FeedbackBlock title="答疑联动" body={tutorFollowup?.answer || "答疑智能体已收到本次测评结果。"} />
                    </div>

                    {wrongQuestions.length ? (
                      <section className="rounded-[24px] border border-black/[0.06] bg-white p-5">
                        <h4 className="text-lg font-extrabold text-[#171c22]">错题复盘</h4>
                        <div className="mt-3 space-y-3">
                          {wrongQuestions.map((item) => (
                            <div
                              key={`${item.question_id}-${item.knowledge_point}`}
                              className="rounded-[20px] border border-black/[0.05] bg-slate-50 p-4"
                            >
                              <p className="text-xs font-bold text-[#171c22]">{item.prompt}</p>
                              <p className="mt-2 text-[11px] leading-6 text-[#564145]">知识点：{item.knowledge_point}</p>
                              <p className="text-[11px] leading-6 text-[#564145]">你的答案：{item.user_answer || "未作答"}</p>
                              <p className="text-[11px] leading-6 text-[#564145]">正确答案：{item.correct_answer}</p>
                              <p className="mt-1 text-[11px] leading-6 text-[#564145]">{item.explanation}</p>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/tutor?courseId=${activeCourse.routeCourseId}&query=${encodeURIComponent(buildFollowupQuestion(latestResult))}`,
                          )
                        }
                        className="flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-bold text-white shadow-[0_14px_28px_rgba(17,24,39,0.16)] transition hover:bg-[#1f2937]"
                      >
                        <Bot className="h-4 w-4" />
                        进入 AI 导师深挖
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/path?courseId=${activeCourse.routeCourseId}`)}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-[#171c22] transition hover:bg-slate-50"
                      >
                        查看更新后的学习路径
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/resources?courseId=${activeCourse.routeCourseId}`)}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-[#171c22] transition hover:bg-slate-50"
                      >
                        查看生成资源
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="w-full shrink-0 space-y-6 lg:w-80">
            <section className="rounded-[32px] border border-black/[0.06] bg-white/95 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur">
              <div className="flex items-center gap-2 text-[#171c22]">
                <Sparkles className="h-5 w-5" />
                <h3 className="font-sans text-xs font-extrabold uppercase tracking-wider">状态</h3>
              </div>
              <div className="mt-4 grid gap-3">
                <SimpleInfo label="试卷" value={activePaper ? "已生成" : "未生成"} />
                <SimpleInfo label="提交" value={latestResult ? "已完成" : "未提交"} />
                <SimpleInfo label="闭环" value={latestResult ? "已同步" : "等待中"} />
              </div>
            </section>

            <section className="rounded-[32px] border border-black/[0.06] bg-white/95 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur">
              <h3 className="font-sans text-xs font-extrabold uppercase tracking-wider text-[#171c22]">当前上下文</h3>
              <div className="mt-4 space-y-3 text-xs text-[#564145]">
                <ContextLine label="课程" value={displayCourseName} />
                <ContextLine label="课程版本" value={displayCourseCode} />
                <ContextLine label="重点知识点" value={suggestedKnowledgePoints.join("、")} />
                <ContextLine label="学习风格" value={profileSummary?.recommended_learning_style || "待画像反馈"} />
                <ContextLine
                  label="当前阶段"
                  value={toStudentFriendlyStage(profileSummary?.current_stage || latestPlan?.current_stage || "待测评确认")}
                />
              </div>
            </section>
          </aside>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#171c22]/95 px-5 py-3 text-xs font-bold text-white shadow-2xl">
          <span className="h-2 w-2 animate-ping rounded-full bg-[#fb7299]" />
          <span>{toastMessage}</span>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[24px] border border-[#E3E8EC] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbfb_100%)] p-4 shadow-[0_10px_24px_rgba(23,28,34,0.03)]">
      <div className="inline-flex rounded-2xl bg-[#fb7299]/10 p-3 text-[#fb7299]">{icon}</div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-[#171c22]">{value}</p>
      <p className="mt-1 text-[11px] leading-6 text-[#564145]">{hint}</p>
    </div>
  );
}

function FeedbackBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-[#E3E8EC] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfb_100%)] p-4">
      <p className="text-xs font-extrabold text-[#171c22]">{title}</p>
      <p className="mt-2 text-[11px] leading-6 text-[#564145]">{body}</p>
    </div>
  );
}

function ContextLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-xs leading-6 text-[#171c22]">{value}</p>
    </div>
  );
}

function HeroMetric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/78 p-4 backdrop-blur">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#73838a]">{label}</p>
      <p className="mt-3 text-2xl font-extrabold text-[#171c22]">{value}</p>
      <p className="mt-1 text-xs text-[#5a6970]">{hint}</p>
    </div>
  );
}

function DarkContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/6 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">{label}</p>
      <p className="mt-1 text-sm leading-6 text-white/88">{value}</p>
    </div>
  );
}

function TaskStep({
  index,
  title,
  desc,
  active,
  done,
}: {
  index: number;
  title: string;
  desc: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={`rounded-[20px] border p-4 backdrop-blur ${
        active
          ? "border-[#111827]/10 bg-[#111827] text-white shadow-[0_18px_32px_rgba(17,24,39,0.14)]"
          : done
            ? "border-emerald-200 bg-[linear-gradient(180deg,#f0fdf4_0%,#ecfdf5_100%)]"
            : "border-black/[0.05] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fb_100%)]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold ${
            active ? "bg-white text-[#111827]" : done ? "bg-emerald-600 text-white" : "bg-white text-[#7c8a90] shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
          }`}
        >
          {done && !active ? <CheckCircle className="h-4 w-4" /> : index}
        </span>
        <div>
          <p className={`text-sm font-extrabold ${active ? "text-white" : "text-[#171c22]"}`}>{title}</p>
          <p className={`text-xs ${active ? "text-white/72" : "text-[#5a6970]"}`}>{desc}</p>
        </div>
      </div>
    </div>
  );
}

function CommandMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-black/[0.06] bg-white/90 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)] backdrop-blur">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <p className="mt-1 text-lg font-extrabold text-[#171c22]">{value}</p>
    </div>
  );
}

function SimpleInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-black/[0.05] bg-[linear-gradient(180deg,#fbfbfc_0%,#f4f5f7_100%)] px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-[#171c22]">{value}</p>
    </div>
  );
}
