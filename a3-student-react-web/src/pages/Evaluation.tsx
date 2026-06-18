/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { EChartsCoreOption } from "echarts/core";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Bot,
  CheckCircle,
  LoaderCircle,
  Lock,
  RefreshCw,
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
import { getCurrentLoggedInUserId } from "../lib/currentUser";
import { openTutorPanel } from "../lib/tutorPanel";
import { parseQuizPaper, scoreQuiz, type QuizPaper, type QuizQuestion } from "../lib/quizEngine";
const USER_ID = getCurrentLoggedInUserId();
const ACTIVE_COURSE_KEY = "software-engineering";
const LineBarChartPanel = lazy(() => import("../components/LineBarChartPanel"));
const HeatmapChartPanel = lazy(() => import("../components/HeatmapChartPanel"));

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
    description: "已接入真实测评数据，可以直接开始。",
    status: "available",
    courseId: 401,
    routeCourseId: "series-2",
  },
  {
    key: "data-structure",
    title: "数据结构",
    subtitle: "资料接入中",
    description: "暂未开放。",
    status: "updating",
    courseId: 0,
    routeCourseId: "updating-data-structure",
  },
  {
    key: "operating-system",
    title: "操作系统",
    subtitle: "资料接入中",
    description: "暂未开放。",
    status: "updating",
    courseId: 0,
    routeCourseId: "updating-operating-system",
  },
  {
    key: "database",
    title: "数据库系统",
    subtitle: "资料接入中",
    description: "暂未开放。",
    status: "updating",
    courseId: 0,
    routeCourseId: "updating-database",
  },
];

const AVAILABLE_COURSES = COURSE_OPTIONS.filter((course) => course.status === "available");
const UPCOMING_COURSES = COURSE_OPTIONS.filter((course) => course.status !== "available");

function formatPercent(value?: number | null) {
  if (value === null || value === undefined) return "暂无";
  return `${Math.round(value)}%`;
}

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

function getOptionKey(option: string) {
  const matched = option.match(/^\s*([A-Z])[\.\u3001:\s-]/i);
  return matched ? matched[1].toUpperCase() : option.trim().toUpperCase();
}

function normalizeAnswerToken(value: string) {
  return value
    .split(",")
    .map((item) => getOptionKey(item))
    .filter(Boolean)
    .join(",");
}

function resolveQuestionTypeLabel(type?: string | null) {
  if (type === "multiple_choice" || type === "multiple") return "多选题";
  if (type === "short_answer" || type === "short") return "简答题";
  if (type === "true_false") return "判断题";
  return "单选题";
}

function resolveCourseCode(courseId: number, trend: EvaluationTrendResponse | null, history: EvaluationHistoryItem[]) {
  return trend?.course_code || history[0]?.course_code || `COURSE-${courseId}`;
}

function extractSafetyBlocked(review?: Record<string, unknown> | null) {
  if (!review || typeof review !== "object") return false;
  const inputReview = review.input_review;
  const outputReview = review.output_review;
  const inputBlocked = Boolean(inputReview && typeof inputReview === "object" && "blocked" in inputReview && inputReview.blocked);
  const outputBlocked = Boolean(
    outputReview && typeof outputReview === "object" && "blocked" in outputReview && outputReview.blocked,
  );
  return inputBlocked || outputBlocked;
}

function extractSafetySummary(review?: Record<string, unknown> | null) {
  if (!review || typeof review !== "object") return "";
  const outputReview = review.output_review;
  const inputReview = review.input_review;
  if (outputReview && typeof outputReview === "object" && "summary" in outputReview && typeof outputReview.summary === "string") {
    return outputReview.summary;
  }
  if (inputReview && typeof inputReview === "object" && "summary" in inputReview && typeof inputReview.summary === "string") {
    return inputReview.summary;
  }
  return "";
}

function extractHallucinationUngrounded(review?: Record<string, unknown> | null) {
  if (!review || typeof review !== "object") return false;
  if (!("grounded" in review)) return false;
  return review.grounded === false;
}

function extractHallucinationSummary(review?: Record<string, unknown> | null) {
  if (!review || typeof review !== "object") return "";
  return typeof review.summary === "string" ? review.summary : "";
}

function normalizeKnowledgePointLabel(value?: string | null) {
  const text = (value || "").trim();
  if (!text) return "当前知识点";
  if (text.length > 28) {
    if (text.includes("需求分析")) return "需求分析";
    if (text.includes("概要设计")) return "概要设计";
    if (text.includes("详细设计")) return "详细设计";
    if (text.includes("软件测试")) return "软件测试";
    if (text.includes("可行性分析")) return "可行性分析";
    if (text.includes("软件维护")) return "软件维护";
    if (text.includes("软件工程")) return "软件工程核心知识";
    return "当前知识点";
  }
  return text;
}

function buildTrendChartOption(
  historyItems: EvaluationHistoryItem[],
  trend: EvaluationTrendResponse | null,
): EChartsCoreOption {
  const source = historyItems.length
    ? [...historyItems]
        .slice(0, 6)
        .reverse()
        .map((item, index) => ({
          label: item.created_at ? formatDate(item.created_at) : `第 ${index + 1} 次`,
          score: Math.round(item.overall_score || 0),
        }))
    : [
        { label: "第 1 次", score: 72 },
        { label: "第 2 次", score: 78 },
        { label: "第 3 次", score: 83 },
        { label: "第 4 次", score: Math.round(trend?.latest_score || 86) },
      ];

  return {
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(17,24,39,0.96)",
      borderWidth: 0,
      textStyle: { color: "#fff" },
    },
    grid: { left: 28, right: 18, top: 24, bottom: 30 },
    xAxis: {
      type: "category",
      data: source.map((item) => item.label),
      axisLine: { lineStyle: { color: "#dbe4ec" } },
      axisTick: { show: false },
      axisLabel: { color: "#667085", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: "#eef2f6" } },
      axisLabel: { color: "#98a2b3", fontSize: 11 },
    },
    series: [
      {
        type: "line",
        smooth: true,
        data: source.map((item) => item.score),
        symbol: "circle",
        symbolSize: 10,
        lineStyle: { width: 4, color: "#fb7299" },
        itemStyle: {
          color: "#fb7299",
          borderColor: "#fff",
          borderWidth: 2,
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(251,114,153,0.26)" },
              { offset: 1, color: "rgba(251,114,153,0.03)" },
            ],
          },
        },
      },
    ],
  };
}

function buildWeaknessHeatmapOption(
  latestResult: EvaluationResultResponse | null,
  wrongQuestions: WrongQuestionItem[],
  trend: EvaluationTrendResponse | null,
): EChartsCoreOption {
  const rawPoints =
    latestResult?.weak_points?.length
      ? latestResult.weak_points.map((item) => normalizeKnowledgePointLabel(item))
      : wrongQuestions.map((item) => item.knowledge_point).filter(Boolean).length
        ? wrongQuestions.map((item) => normalizeKnowledgePointLabel(item.knowledge_point))
        : trend?.focus_knowledge_points?.length
          ? trend.focus_knowledge_points.map((item) => normalizeKnowledgePointLabel(item))
          : ["需求分析", "系统设计", "架构拆解", "测试验证", "项目管理", "复盘总结"];

  const uniquePoints = Array.from(new Set(rawPoints)).slice(0, 6);
  const dimensions = ["理解", "应用", "迁移"];
  const values = uniquePoints.flatMap((point, yIndex) =>
    dimensions.map((dimension, xIndex) => [xIndex, yIndex, Math.max(18, 78 - yIndex * 7 - xIndex * 6)]),
  );

  return {
    tooltip: {
      position: "top",
      formatter: (params) => {
        const [x, y, score] = Array.isArray(params.data) ? params.data : [0, 0, 0];
        return `${uniquePoints[y]}<br/>${dimensions[x]}薄弱度：${score}`;
      },
      backgroundColor: "rgba(17,24,39,0.96)",
      borderWidth: 0,
      textStyle: { color: "#fff" },
    },
    grid: { left: 88, right: 18, top: 28, bottom: 30 },
    xAxis: {
      type: "category",
      data: dimensions,
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#475467", fontSize: 11 },
    },
    yAxis: {
      type: "category",
      data: uniquePoints,
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#475467", fontSize: 11 },
    },
    visualMap: {
      min: 0,
      max: 100,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      text: ["高薄弱", "低薄弱"],
      inRange: {
        color: ["#e8f7f1", "#f8d16f", "#f97316", "#fb7185"],
      },
      textStyle: { color: "#667085", fontSize: 11 },
    },
    series: [
      {
        type: "heatmap",
        data: values,
        label: {
          show: true,
          color: "#1f2937",
          fontSize: 11,
          formatter: ({ data }) => `${Array.isArray(data) ? data[2] : ""}`,
        },
      },
    ],
  };
}

export default function Evaluation() {
  const activeUserId = getCurrentLoggedInUserId();
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
  const [questionSourceText, setQuestionSourceText] = useState("");
  const [questionGenerationLoading, setQuestionGenerationLoading] = useState(false);
  const [customQuizPaper, setCustomQuizPaper] = useState<QuizPaper | null>(null);
  const [customQuizAnswers, setCustomQuizAnswers] = useState<Record<string, string | string[]>>({});
  const [customQuizSummary, setCustomQuizSummary] = useState<ReturnType<typeof scoreQuiz> | null>(null);
  const [customQuizSafetyReview, setCustomQuizSafetyReview] = useState<Record<string, unknown> | null>(null);
  const [customQuizHallucinationReview, setCustomQuizHallucinationReview] = useState<Record<string, unknown> | null>(null);
  const [customQuizSource, setCustomQuizSource] = useState<"ai" | "fallback" | "cache" | "import">("import");
  const [currentPaperQuestionIndex, setCurrentPaperQuestionIndex] = useState(0);
  const [currentCustomQuestionIndex, setCurrentCustomQuestionIndex] = useState(0);

  const courseCode = useMemo(
    () => (numericCourseId ? resolveCourseCode(numericCourseId, trend, historyItems) : "未选择课程"),
    [historyItems, numericCourseId, trend],
  );

  const selectedAnswerCount = Object.keys(answers).length;
  const customSelectedAnswerCount = Object.keys(customQuizAnswers).length;
  const latestHistory = historyItems[0] || null;
  const trendChartOption = useMemo(() => buildTrendChartOption(historyItems, trend), [historyItems, trend]);
  const weaknessHeatmapOption = useMemo(
    () => buildWeaknessHeatmapOption(latestResult, wrongQuestions, trend),
    [latestResult, wrongQuestions, trend],
  );

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
    setQuestionGenerationLoading(false);
    setCustomQuizPaper(null);
    setCustomQuizAnswers({});
    setCustomQuizSummary(null);
    setCustomQuizSafetyReview(null);
    setCustomQuizHallucinationReview(null);
    setCustomQuizSource("import");
    setCurrentPaperQuestionIndex(0);
    setCurrentCustomQuestionIndex(0);
  };

  const buildGeneratedQuestionBankText = (paper: QuizPaper) =>
    JSON.stringify(
      {
        title: paper.title || "AI 生成题库",
        questions: paper.questions.map((question) => {
          const questionType =
            question.questionType === "multiple"
              ? 2
              : question.questionType === "short"
                ? 3
                : 1;

          return {
            id: question.id,
            question_content: question.question,
            question_options: question.options.map((option) => {
              const matched = option.match(/^\s*([A-Z])[\.\u3001:\s-]+(.*)$/i);
              return matched
                ? { key: matched[1].toUpperCase(), value: matched[2].trim() }
                : { key: "", value: option };
            }),
            correct_answer: question.answer.join(","),
            answer_analysis: question.explanation,
            knowledge_point: normalizeKnowledgePointLabel(question.knowledgeTag),
            difficulty_level: question.difficultyLevel ?? 2,
            quality_score: question.qualityScore ?? undefined,
            question_type: questionType,
          };
        }),
      },
      null,
      2,
    );

  const handleCustomQuizAnswer = (question: QuizQuestion, option: string) => {
    if (customQuizSummary) return;
    setCustomQuizAnswers((current) => {
      if (question.questionType === "multiple") {
        const existing = Array.isArray(current[question.id]) ? ([...(current[question.id] as string[])] as string[]) : [];
        const next = existing.includes(option) ? existing.filter((item) => item !== option) : [...existing, option];
        return { ...current, [question.id]: next };
      }
      return { ...current, [question.id]: option };
    });
  };

  const handleCustomShortAnswer = (questionId: string, value: string) => {
    if (customQuizSummary) return;
    setCustomQuizAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const handleSubmitCustomQuiz = () => {
    if (!customQuizPaper?.questions.length) {
      showToast("请先导入题库");
      return;
    }
    const summary = scoreQuiz(customQuizPaper.questions, customQuizAnswers);
    setCustomQuizSummary(summary);
    showToast(`已完成判分：${summary.correct}/${summary.total}`);
  };

  const handleGenerateQuestionBank = async () => {
    if (!numericCourseId) {
      showToast("请先选择课程，再生成题库。");
      return;
    }
    if (!questionSourceText.trim()) {
      showToast("先输入章节内容、讲义摘要或课程重点。");
      return;
    }

    setQuestionGenerationLoading(true);
    try {
      const generated = await studentApi.generateEvaluationQuestions({
        test_id: numericCourseId,
        knowledge_points: [questionSourceText.trim().slice(0, 60)],
        difficulty_level: 2,
        question_type: 1,
        count: 3,
        generate_layered: false,
        course_context: questionSourceText.trim().slice(0, 1800),
        persist_to_db: true,
      });

      const parsed = parseQuizPaper(
        JSON.stringify({
          title: `${activeCourse?.title || "当前课程"} AI 生成题库`,
          questions: generated.questions,
        }),
      );

      if (!parsed?.questions.length) {
        throw new Error("题库生成成功，但前端解析失败");
      }

      const serialized = buildGeneratedQuestionBankText(parsed);
      setCustomQuestionBankText(serialized);
      setCustomQuizPaper(parsed);
      setCustomQuizAnswers({});
      setCustomQuizSummary(null);
      setCustomQuizSafetyReview(generated.safety_review || null);
      setCustomQuizHallucinationReview(generated.hallucination_review || null);
      setCustomQuizSource(generated.source === "fallback" ? "fallback" : generated.source === "cache" ? "cache" : "ai");
      setCurrentCustomQuestionIndex(0);
      setShowManualImportPanel(false);
      if (extractSafetyBlocked(generated.safety_review || null)) {
        showToast(extractSafetySummary(generated.safety_review || null) || "题库内容已被安全策略拦截");
        return;
      }
      if (extractHallucinationUngrounded(generated.hallucination_review || null)) {
        showToast(extractHallucinationSummary(generated.hallucination_review || null) || "题库已生成，但有部分内容待核验");
        return;
      }
      showToast(`已生成 ${parsed.questions.length} 道 AI 题，可直接作答`);
    } catch (generationError) {
      showToast(generationError instanceof Error ? generationError.message : "题库生成失败");
    } finally {
      setQuestionGenerationLoading(false);
    }
  };

  const handleChooseCourse = (course: CourseOption) => {
    if (course.status !== "available") {
      showToast(`${course.title} 暂未开放。`);
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
        studentApi.getEvaluationHistory(activeUserId, numericCourseId),
        studentApi.getEvaluationTrend(activeUserId, numericCourseId),
        studentApi.getProfileSummary(activeUserId),
        studentApi.getLatestLearningPlan(activeUserId, numericCourseId),
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
  }, [activeUserId, numericCourseId]);

  const handleStartPaper = async () => {
    if (!activeCourse || !numericCourseId) {
      showToast("请先选择课程。");
      return;
    }

    setPaperLoading(true);
    setError("");
    try {
      const paper = await studentApi.generateEvaluationPaper({
        user_id: activeUserId,
        course_id: numericCourseId,
        target: `${activeCourse.title}阶段诊断`,
        knowledge_points: trend?.focus_knowledge_points?.filter(Boolean)?.slice(0, 5) || [],
        paper_type: "diagnostic",
        question_count: 5,
      });
      setActivePaper(paper);
      setAnswers({});
      setCurrentPaperQuestionIndex(0);
      setLatestResult(null);
      setWrongQuestions([]);
      setFeedbackApplied(null);
      setRefreshedPlan(null);
      setGeneratedResources([]);
      setTutorFollowup(null);
      showToast("试卷已生成。");
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
    setCurrentPaperQuestionIndex(0);
    setLatestResult(null);
    setWrongQuestions([]);
    setFeedbackApplied(null);
    setRefreshedPlan(null);
    setGeneratedResources([]);
    setTutorFollowup(null);
  };

  const buildFollowupQuestion = (result: EvaluationResultResponse) => {
    const focus = result.knowledge_points[0] || result.weak_points[0] || activeCourse?.title || "当前课程";
    return `我刚完成${activeCourse?.title || "当前课程"}的阶段测评，请结合得分 ${Math.round(
      result.overall_score,
    )} 分和薄弱点 ${focus}，给我下一步学习建议。`;
  };

  const handleSubmit = async () => {
    if (!activePaper || !numericCourseId || !activeCourse) {
      showToast("请先生成试卷。");
      return;
    }

    if (selectedAnswerCount < activePaper.questions.length) {
      showToast("请先完成全部题目。");
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

      const nextKnowledgePoints = result.knowledge_points.length ? result.knowledge_points : [];
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
      showToast("测评已完成。");
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
    const reviewItem = wrongQuestions.find((item) => item.question_id === question.question_id);
    const selectedAnswerKey = normalizeAnswerToken(selectedAnswer || "");
    const isCorrect = isSubmitted && selectedAnswerKey === correctAnswerKey;

    return (
      <div key={question.question_id} className="rounded-[24px] border border-[#e8edf2] bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#f2f4f7]">
          <div
            className="h-full rounded-full bg-[#111827] transition-all"
            style={{ width: `${((index + 1) / Math.max(activePaper?.questions.length || 1, 1)) * 100}%` }}
          />
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#111827] px-2.5 py-1 text-[11px] font-bold text-white">第 {index + 1} 题</span>
              <span className="rounded-full bg-[#f7f7f5] px-2 py-0.5 text-[10px] font-bold text-[#667085]">
                {resolveQuestionTypeLabel(question.question_type)}
              </span>
              <span className="rounded-full bg-[#f8fafc] px-2 py-0.5 text-[10px] font-bold text-[#667085]">
                {selectedAnswer ? "已作答" : "待作答"}
              </span>
              {isSubmitted ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isCorrect ? "bg-[#ecfdf3] text-[#027a48]" : "bg-[#fff1f3] text-[#c01048]"
                  }`}
                >
                  {isCorrect ? "回答正确" : "需要复盘"}
                </span>
              ) : null}
            </div>
            <h4 className="mt-3 text-lg font-extrabold leading-8 text-[#171c22]">{question.prompt}</h4>
          </div>
          <div className="rounded-full bg-[#f8fafc] px-3 py-1 text-[11px] font-bold text-[#667085]">
            {currentPaperQuestionIndex + 1}/{activePaper?.questions.length || 0}
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {question.options.map((option) => {
            const isSelected = selectedAnswer === option;
            const optionKey = normalizeAnswerToken(option);
            const optionCorrect = isSubmitted && optionKey === correctAnswerKey;
            const optionWrong = isSubmitted && isSelected && optionKey !== correctAnswerKey;
            const optionLabel = getOptionKey(option);
            const optionContent = option.replace(/^\s*[A-Z][\.\u3001:\s-]*/i, "").trim();

            return (
              <button
                key={option}
                type="button"
                disabled={isSubmitted}
                onClick={() => handleSelectAnswer(question.question_id, option)}
                className={`flex w-full items-start gap-4 rounded-2xl border px-4 py-4 text-left transition ${
                  optionCorrect
                    ? "border-emerald-500 bg-emerald-50 text-emerald-950"
                    : optionWrong
                      ? "border-red-400 bg-red-50 text-red-950"
                      : isSelected
                        ? "border-[#111827] bg-[#111827] text-white shadow-[0_10px_24px_rgba(17,24,39,0.14)]"
                        : "border-[#e2e8f0] bg-[#fcfcfd] text-[#344054] hover:border-[#cfd8df] hover:bg-white"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-extrabold ${
                    optionCorrect
                      ? "border-emerald-200 bg-white/80 text-emerald-700"
                      : optionWrong
                        ? "border-red-200 bg-white/80 text-red-600"
                        : isSelected
                          ? "border-white/20 bg-white/14 text-white"
                          : "border-[#e5e7eb] bg-[#f8fafc] text-[#667085]"
                  }`}
                >
                  {optionLabel}
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold leading-7">{optionContent || option}</span>
                {optionCorrect ? <CheckCircle className="mt-1 h-5 w-5 shrink-0 text-emerald-600" /> : null}
                {optionWrong ? <XCircle className="mt-1 h-5 w-5 shrink-0 text-red-500" /> : null}
              </button>
            );
          })}
        </div>

        {isSubmitted ? (
          <div className={`mt-5 rounded-2xl px-4 py-4 text-sm leading-7 ${isCorrect ? "bg-[#ecfdf3] text-[#065f46]" : "bg-[#fff4f4] text-[#9f1239]"}`}>
            <p>你的答案：{selectedAnswer || "未作答"}</p>
            <p className="mt-1">正确答案：{question.correct_answer}</p>
            {reviewItem?.explanation ? <p className="mt-1">解析：{reviewItem.explanation}</p> : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderQuestionPalette = (
    total: number,
    currentIndex: number,
    answeredMap: Record<string, unknown>,
    questionIds: string[],
    onSelect: (index: number) => void,
    disabled = false,
  ) => (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5 xl:grid-cols-6">
      {questionIds.map((questionId, index) => {
        const answered = Boolean(answeredMap[questionId]) && (!Array.isArray(answeredMap[questionId]) || (answeredMap[questionId] as unknown[]).length > 0);
        const active = currentIndex === index;
        return (
          <button
            key={questionId}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(index)}
            className={`flex h-10 items-center justify-center rounded-2xl border text-sm font-bold transition ${
              active
                ? "border-[#111827] bg-[#111827] text-white"
                : answered
                  ? "border-[#fbcfe8] bg-[#fff1f6] text-[#d6336c]"
                  : "border-[#e5e7eb] bg-white text-[#667085] hover:border-[#cfd8df] hover:text-[#111827]"
            }`}
          >
            {index + 1}
          </button>
        );
      })}
    </div>
  );

  const renderCustomQuizQuestionCard = (question: QuizQuestion, index: number) => {
    const selected = customQuizAnswers[question.id];
    const selectedList = Array.isArray(selected) ? selected : typeof selected === "string" ? [selected] : [];
    const scoreItem = customQuizSummary?.wrongQuestions.find((item) => item.questionId === question.id);
    const isWrong = Boolean(scoreItem);
    const isCorrect = Boolean(customQuizSummary) && !isWrong;

    return (
      <div className="rounded-[24px] border border-[#e8edf2] bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#f2f4f7]">
          <div
            className="h-full rounded-full bg-[#fb7299] transition-all"
            style={{ width: `${((index + 1) / Math.max(customQuizPaper?.questions.length || 1, 1)) * 100}%` }}
          />
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#111827] px-2.5 py-1 text-[11px] font-bold text-white">第 {index + 1} 题</span>
              <span className="rounded-full bg-[#f7f7f5] px-2 py-0.5 text-[10px] font-bold text-[#667085]">
                {resolveQuestionTypeLabel(question.questionType)}
              </span>
              <span className="rounded-full bg-[#f8fafc] px-2 py-0.5 text-[10px] font-bold text-[#667085]">
                {selectedList.length || (typeof selected === "string" && selected.trim()) ? "已作答" : "待作答"}
              </span>
              {question.knowledgeTag ? (
                <span className="rounded-full bg-[#fff1f5] px-2 py-0.5 text-[10px] font-bold text-[#fb7299]">
                  {normalizeKnowledgePointLabel(question.knowledgeTag)}
                </span>
              ) : null}
            </div>
            <h4 className="mt-3 text-lg font-extrabold leading-8 text-[#171c22]">{question.question}</h4>
          </div>
          <div className="rounded-full bg-[#f8fafc] px-3 py-1 text-[11px] font-bold text-[#667085]">
            {currentCustomQuestionIndex + 1}/{customQuizPaper?.questions.length || 0}
          </div>
        </div>

        {question.questionType === "short" ? (
          <textarea
            value={typeof selected === "string" ? selected : ""}
            onChange={(event) => handleCustomShortAnswer(question.id, event.target.value)}
            disabled={Boolean(customQuizSummary)}
            placeholder="写下你的答案"
            className="mt-5 min-h-[180px] w-full rounded-2xl border border-[#e8edf2] bg-[#fcfcfd] px-4 py-4 text-sm leading-7 text-[#344054] outline-none transition focus:border-[#cfd8df] focus:bg-white"
          />
        ) : (
          <div className="mt-5 grid gap-3">
            {question.options.map((option) => {
              const active = selectedList.includes(option);
              const optionLabel = getOptionKey(option);
              const optionContent = option.replace(/^\s*[A-Z][\.\u3001:\s-]*/i, "").trim();
              const optionCorrect = Boolean(customQuizSummary) && question.answer.some((answer) => normalizeAnswerToken(answer) === normalizeAnswerToken(option));
              const optionWrong = Boolean(customQuizSummary) && active && !optionCorrect;
              return (
                <button
                  key={`${question.id}-${option}`}
                  type="button"
                  disabled={Boolean(customQuizSummary)}
                  onClick={() => handleCustomQuizAnswer(question, option)}
                  className={`flex items-start gap-4 rounded-2xl border px-4 py-4 text-left transition ${
                    optionCorrect
                      ? "border-emerald-500 bg-emerald-50 text-emerald-950"
                      : optionWrong
                        ? "border-red-400 bg-red-50 text-red-950"
                        : active
                          ? "border-[#111827] bg-[#111827] text-white shadow-[0_10px_24px_rgba(17,24,39,0.14)]"
                          : "border-[#e8edf2] bg-[#fcfcfd] text-[#344054] hover:border-[#cfd8df] hover:bg-white"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-extrabold ${
                      optionCorrect
                        ? "border-emerald-200 bg-white/80 text-emerald-700"
                        : optionWrong
                          ? "border-red-200 bg-white/80 text-red-600"
                          : active
                            ? "border-white/20 bg-white/14 text-white"
                            : "border-[#e5e7eb] bg-[#f8fafc] text-[#667085]"
                    }`}
                  >
                    {optionLabel}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold leading-7">{optionContent || option}</span>
                  {optionCorrect ? <CheckCircle className="mt-1 h-5 w-5 shrink-0 text-emerald-600" /> : null}
                  {optionWrong ? <XCircle className="mt-1 h-5 w-5 shrink-0 text-red-500" /> : null}
                </button>
              );
            })}
          </div>
        )}

        {customQuizSummary ? (
          <div
            className={`mt-5 rounded-2xl px-4 py-4 text-sm leading-7 ${
              isCorrect ? "bg-[#ecfdf3] text-[#065f46]" : "bg-[#fff4f4] text-[#9f1239]"
            }`}
          >
            <p>
              你的答案：
              {selectedList.length ? selectedList.join(" / ") : typeof selected === "string" && selected.trim() ? selected : "未作答"}
            </p>
            {question.questionType !== "short" ? <p>正确答案：{question.answer.join(" / ") || "暂无"}</p> : null}
            {question.explanation ? <p className="mt-1">解析：{question.explanation}</p> : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1320px] select-none space-y-6 px-1" id="evaluation-workspace">
      <section className="rounded-[30px] border border-[#e8edf2] bg-[linear-gradient(135deg,#ffffff_0%,#faf9f5_100%)] p-6 shadow-[0_16px_42px_rgba(15,23,42,0.05)] md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a96a3]">Evaluation</p>
            <h1 className="mt-3 text-3xl font-extrabold ui-tracking-tight text-[#171c22]">开始一次测评</h1>
            <p className="mt-2 text-sm leading-7 text-[#5b6770]">先选课程，再直接进入出题或短测，不做多余停留。</p>
          </div>
          <div className="rounded-full bg-[#f7fafb] px-4 py-2 text-sm font-semibold text-[#5b6770]">
            {activeCourse ? `当前：${activeCourse.title}` : "请选择课程"}
          </div>
        </div>

        <div className="mt-6 grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          {AVAILABLE_COURSES.map((course) => {
            const isActive = activeCourse?.key === course.key;

            return (
              <button
                key={course.key}
                type="button"
                onClick={() => handleChooseCourse(course)}
                className={`flex min-h-[148px] flex-col justify-between rounded-[24px] border px-4 py-4 text-left transition ${
                  isActive
                    ? "border-[#171c22] bg-[#171c22] text-white shadow-[0_16px_32px_rgba(23,28,34,0.12)]"
                    : "border-[#e8edf2] bg-white hover:border-[#cfd8df] hover:bg-[#fcfcfb]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-extrabold">{course.title}</p>
                    <p className={`mt-1 text-xs ${isActive ? "text-white/72" : "text-[#5b6770]"}`}>{course.subtitle}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      isActive ? "bg-white/14 text-white" : "bg-[#f7fafb] text-[#667085]"
                    }`}
                  >
                    可开始
                  </span>
                </div>
                <p className={`mt-3 text-xs leading-6 ${isActive ? "text-white/72" : "text-[#5b6770]"}`}>{course.description}</p>
              </button>
            );
          })}
        </div>

        {UPCOMING_COURSES.length ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#8a96a3]">
            <span className="font-bold uppercase tracking-[0.18em]">即将接入</span>
            {UPCOMING_COURSES.map((course) => (
              <span key={course.key} className="rounded-full border border-[#e8edf2] bg-white px-3 py-1.5">
                {course.title}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-6 grid items-stretch gap-4 md:grid-cols-3">
          <div className="min-h-[112px] rounded-[22px] border border-[#e8edf2] bg-white px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a96a3]">最近得分</p>
            <p className="mt-2 text-2xl font-extrabold text-[#171c22]">
              {trend?.latest_score ? `${Math.round(trend.latest_score)}%` : "暂无"}
            </p>
          </div>
          <div className="min-h-[112px] rounded-[22px] border border-[#e8edf2] bg-white px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a96a3]">测评次数</p>
            <p className="mt-2 text-2xl font-extrabold text-[#171c22]">{trend?.total || historyItems.length || 0}</p>
          </div>
          <div className="min-h-[112px] rounded-[22px] border border-[#e8edf2] bg-white px-4 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a96a3]">当前重点</p>
            <p className="mt-2 text-sm font-bold leading-6 text-[#171c22]">
              {trend?.focus_knowledge_points?.[0] || latestResult?.weak_points?.[0] || "完成后自动更新"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-[#f0dfe6] bg-white p-6 shadow-[0_16px_42px_rgba(15,23,42,0.05)] md:p-7">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a96a3]">AI Question Set</p>
            <h2 className="mt-2 text-2xl font-extrabold text-[#171c22]">默认先做短测，需要时再按章节单独出题</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[#5b6770]">
              快速评估就直接开始短测；只有你想围绕某个具体章节反复练习时，再用下面这张卡片生成专题题库。
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="rounded-[26px] border border-[#f3d6e2] bg-[linear-gradient(180deg,#fff9fb_0%,#ffffff_100%)] p-5 shadow-[0_12px_24px_rgba(251,114,153,0.08)] md:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center rounded-full bg-[#fff1f6] px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-[#d64d7b]">
                  章节专题题库
                </div>
                <h3 className="mt-3 text-xl font-extrabold text-[#171c22]">输入一段真实章节内容，直接生成可作答题目</h3>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-[#5b6770]">
                  粘贴讲义、课堂摘要、老师要求或知识点清单即可，不需要额外补第二个输入框，系统会自动抽取考点并组织成题。
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleGenerateQuestionBank()}
                disabled={questionGenerationLoading}
                className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-[#fb7299] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(251,114,153,0.24)] transition hover:bg-[#f95c89] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {questionGenerationLoading ? "正在生成 3 道题..." : "生成章节题库"}
              </button>
            </div>

            <div className="mt-4 rounded-[22px] border border-[#f6d9e4] bg-white p-3">
              <textarea
                value={questionSourceText}
                onChange={(event) => setQuestionSourceText(event.target.value)}
                placeholder="贴入本节讲义、课堂摘要、知识点列表或老师要求，例如：软件生命周期包括需求分析、概要设计、详细设计、编码、测试和维护，请围绕系统设计阶段的核心产出生成 3 道单选题。"
                className="min-h-[160px] w-full resize-none rounded-[18px] border border-[#f3d5e1] bg-[#fffdfd] px-4 py-4 text-sm leading-7 text-[#344054] outline-none transition placeholder:text-[#98a2b3] focus:border-[#fb7299] focus:bg-white"
              />
              <div className="mt-3 flex flex-col gap-2 text-xs leading-6 text-[#7b6670] sm:flex-row sm:items-center sm:justify-between">
                <p>建议直接贴 1 段完整章节内容或 3 到 5 条知识点，生成结果会更稳定。</p>
                <p className="font-semibold text-[#d64d7b]">{questionSourceText.trim().length} 字</p>
              </div>
            </div>

            {questionGenerationLoading ? (
              <div className="mt-3 rounded-2xl bg-[#fff1f6] px-4 py-3 text-xs leading-6 text-[#d64d7b]">
                正在生成章节题库，系统会优先查数据库缓存，只有命中不到时才会继续调用 AI。
              </div>
            ) : null}
          </div>
        </div>

        {customQuizSafetyReview || customQuizHallucinationReview ? (
          <div className="mt-4 grid gap-3">
            {extractSafetyBlocked(customQuizSafetyReview) ? (
              <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>安全拦截：{extractSafetySummary(customQuizSafetyReview) || "当前生成内容包含高风险表达，已停止继续出题。"}</div>
                </div>
              </div>
            ) : null}
            {extractHallucinationUngrounded(customQuizHallucinationReview) ? (
              <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    事实待核验：{extractHallucinationSummary(customQuizHallucinationReview) || "当前生成结果缺少足够证据支撑，建议先人工复核再使用。"}
                  </div>
                </div>
              </div>
            ) : null}
            {!extractSafetyBlocked(customQuizSafetyReview) && !extractHallucinationUngrounded(customQuizHallucinationReview) ? (
              <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                <div className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>本轮题库已通过基础安全检查与事实复核，可以直接用于在线测验。</div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {customQuizPaper?.questions.length ? (
          <div className="mt-6 rounded-[28px] border border-[#e8edf2] bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)] md:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a96a3]">Step 2</p>
                <h3 className="mt-2 text-lg font-extrabold text-[#171c22]">{customQuizPaper.title || "导入题库测验"}</h3>
                <p className="mt-1 text-sm text-[#5b6770]">
                  {customQuizSource === "ai"
                    ? "这套题库由真实 AI 根据课程内容生成，可直接按单题模式开始作答。"
                    : customQuizSource === "fallback"
                      ? "当前题库已生成，但其中部分题目来自本地兜底模板，建议作答后再结合课程内容核验。"
                      : `已导入 ${customQuizPaper.questions.length} 道题，可直接按单题模式在线作答。`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#5b6770] ring-1 ring-[#e8edf2]">
                  已作答 {customSelectedAnswerCount}/{customQuizPaper.questions.length}
                </div>
                <div className="rounded-full bg-[#fff2f7] px-3 py-1.5 text-xs font-bold text-[#d64d7b]">
                  {customQuizSource === "ai" ? "真实 AI 生成" : customQuizSource === "fallback" ? "AI + 兜底题库" : "手动导入"}
                </div>
              </div>
            </div>
            {customQuizSource === "cache" ? (
              <div className="mb-4 rounded-2xl border border-[#f3d1dc] bg-[#fff7fa] px-4 py-3 text-sm font-semibold text-[#b4235d]">
                当前为数据库题库，本次直接复用了已生成题目，没有再次消耗 AI。
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[188px_minmax(0,1fr)]">
              <aside className="rounded-[24px] border border-[#eef2f6] bg-[#fcfcfd] p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a96a3]">题目导航</div>
                <div className="mt-4">
                  {renderQuestionPalette(
                    customQuizPaper.questions.length,
                    currentCustomQuestionIndex,
                    customQuizAnswers,
                    customQuizPaper.questions.map((question) => question.id),
                    setCurrentCustomQuestionIndex,
                    Boolean(customQuizSummary),
                  )}
                </div>
              </aside>

              <div className="space-y-4">
                {renderCustomQuizQuestionCard(customQuizPaper.questions[currentCustomQuestionIndex], currentCustomQuestionIndex)}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentCustomQuestionIndex === 0}
                      onClick={() => setCurrentCustomQuestionIndex((value) => Math.max(0, value - 1))}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm font-semibold text-[#344054] transition hover:border-[#cfd8df] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一题
                    </button>
                    <button
                      type="button"
                      disabled={currentCustomQuestionIndex >= customQuizPaper.questions.length - 1}
                      onClick={() => setCurrentCustomQuestionIndex((value) => Math.min(customQuizPaper.questions.length - 1, value + 1))}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm font-semibold text-[#344054] transition hover:border-[#cfd8df] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      下一题
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-[#f7fafb] px-3 py-2 text-xs font-bold text-[#5b6770]">
                      {customQuizSummary ? "已完成判分" : "完成后查看结果"}
                    </div>
                    <button
                      type="button"
                      onClick={handleSubmitCustomQuiz}
                      disabled={Boolean(customQuizSummary)}
                      className="rounded-2xl bg-[#111827] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      提交判分
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {customQuizSummary ? (
              <div className="mt-5 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#5b6770] ring-1 ring-[#e8edf2]">
                得分 {customQuizSummary.correct}/{customQuizSummary.total}，正确率 {customQuizSummary.percent}%
                {customQuizSummary.weakKnowledgeTags.length ? `，重点回看 ${customQuizSummary.weakKnowledgeTags.join(" / ")}` : ""}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {activeCourse && loading ? (
        <div className="rounded-[24px] bg-white px-5 py-5 text-sm text-[#564145] shadow-[0_10px_24px_rgba(23,28,34,0.04)]">
          <div className="flex items-center gap-3">
            <LoaderCircle className="h-5 w-5 animate-spin text-[#111827]" />
            <span>正在读取测评数据...</span>
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
        <section className="rounded-[30px] border border-[#e8edf2] bg-white p-6 shadow-[0_16px_42px_rgba(15,23,42,0.05)] md:p-7">
          {!activePaper ? (
            <div className="rounded-[28px] border border-[#e8edf2] bg-[#fcfcfd] p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)] md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a96a3]">Quick Start</p>
                    <span className="rounded-full bg-[#111827] px-2.5 py-1 text-[10px] font-bold text-white">下一步</span>
                  </div>
                  <h2 className="mt-2 text-2xl font-extrabold text-[#171c22]">{activeCourse.title}</h2>
                  {latestHistory?.created_at ? (
                    <p className="mt-2 text-sm text-[#5b6770]">最近一次记录：{formatDate(latestHistory.created_at)}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void loadEvaluationState()}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#5b6770] hover:text-[#111827]"
                >
                  <RefreshCw className="h-4 w-4" />
                  刷新
                </button>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => void handleStartPaper()}
                  disabled={paperLoading}
                  className="rounded-2xl bg-[#111827] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(17,24,39,0.18)] transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {paperLoading ? "正在生成试卷..." : "开始一次新测评"}
                </button>
                <div className="rounded-2xl bg-[#f7fafb] px-4 py-3 text-sm font-semibold text-[#5b6770]">5 题短测，预计 2 分钟。</div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 border-b border-black/8 pb-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a96a3]">当前试卷</p>
                  <h2 className="mt-2 text-2xl font-extrabold text-[#171c22]">{activeCourse.title}</h2>
                  <p className="mt-2 text-sm text-[#5b6770]">试卷编号 {activePaper.paper_id}</p>
                </div>
                <button
                  type="button"
                  onClick={handleRestart}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#5b6770] hover:text-[#111827]"
                >
                  <RefreshCw className="h-4 w-4" />
                  重新开始
                </button>
              </div>

              {!latestResult ? (
                <>
                  <div className="grid gap-4 xl:grid-cols-[188px_minmax(0,1fr)]">
                    <aside className="rounded-[24px] border border-[#eef2f6] bg-[#fcfcfd] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a96a3]">题目导航</div>
                      <div className="mt-4">
                        {renderQuestionPalette(
                          activePaper.questions.length,
                          currentPaperQuestionIndex,
                          answers,
                          activePaper.questions.map((question) => question.question_id),
                          setCurrentPaperQuestionIndex,
                        )}
                      </div>
                    </aside>

                    <div className="space-y-4">
                      <div className="rounded-[28px] border border-[#e8edf2] bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                        <div className="mb-5 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a96a3]">答题中</p>
                            <h3 className="mt-2 text-xl font-extrabold text-[#171c22]">完成本轮短测</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="rounded-full bg-[#f7fafb] px-3 py-1.5 text-xs font-bold text-[#5b6770]">
                              已作答 {selectedAnswerCount}/{activePaper.questions.length}
                            </div>
                            <div
                              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                                (activePaper.source || activePaper.questions[0]?.source) === "fallback"
                                  ? "bg-[#fff4e5] text-[#b54708]"
                                  : "bg-[#ecfdf3] text-[#027a48]"
                              }`}
                            >
                              {(activePaper.source || activePaper.questions[0]?.source) === "fallback" ? "兜底题库" : "真实 AI 生成"}
                            </div>
                          </div>
                        </div>
                        {renderQuestion(activePaper.questions[currentPaperQuestionIndex], currentPaperQuestionIndex)}
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={currentPaperQuestionIndex === 0}
                            onClick={() => setCurrentPaperQuestionIndex((value) => Math.max(0, value - 1))}
                            className="inline-flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm font-semibold text-[#344054] transition hover:border-[#cfd8df] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            上一题
                          </button>
                          <button
                            type="button"
                            disabled={currentPaperQuestionIndex >= activePaper.questions.length - 1}
                            onClick={() => setCurrentPaperQuestionIndex((value) => Math.min(activePaper.questions.length - 1, value + 1))}
                            className="inline-flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm font-semibold text-[#344054] transition hover:border-[#cfd8df] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            下一题
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleSubmit()}
                          disabled={submitting || selectedAnswerCount < activePaper.questions.length}
                          className="rounded-2xl bg-[#111827] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {submitting
                            ? "正在提交测评..."
                            : selectedAnswerCount < activePaper.questions.length
                              ? `继续作答（${selectedAnswerCount}/${activePaper.questions.length}）`
                              : "提交本轮结果"}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-[28px] border border-emerald-200 bg-[linear-gradient(135deg,#f3fff8,#ffffff)] px-5 py-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Result</p>
                    <h3 className="mt-2 text-3xl font-extrabold text-[#171c22]">{formatPercent(latestResult.overall_score)}</h3>
                    <p className="mt-2 text-sm font-semibold text-[#5b6770]">当前状态：{latestResult.mastery_level || "已完成本轮测评"}</p>
                    <p className="mt-3 text-sm leading-6 text-[#5b6770]">
                      {latestResult.report_summary || "本轮结果已生成，可以继续看报告或追问 AI 导师。"}
                    </p>
                  </div>

                  {wrongQuestions.length ? (
                    <section className="border-t border-black/8 pt-5">
                      <h4 className="text-lg font-extrabold text-[#171c22]">错题复盘</h4>
                      <div className="mt-4 space-y-4">
                        {wrongQuestions.map((item) => (
                          <div key={`${item.question_id}-${item.knowledge_point}`} className="border-b border-black/6 pb-4 last:border-b-0">
                            <p className="text-sm font-bold text-[#171c22]">{item.prompt}</p>
                            <p className="mt-2 text-xs leading-6 text-[#564145]">你的答案：{item.user_answer || "未作答"}</p>
                            <p className="text-xs leading-6 text-[#564145]">正确答案：{item.correct_answer}</p>
                            <p className="mt-1 text-xs leading-6 text-[#564145]">{item.explanation}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => navigate(`/report?courseId=${activeCourse.routeCourseId}`)}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-[#111827] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#1f2937]"
                    >
                      查看报告
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openTutorPanel({
                          courseId: activeCourse.routeCourseId,
                          query: buildFollowupQuestion(latestResult),
                        })
                      }
                      className="flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm font-bold text-[#344054] transition hover:border-[#cfd8df]"
                    >
                      <Bot className="h-4 w-4" />
                      问 AI 导师
                    </button>
                    <button
                      type="button"
                      onClick={handleRestart}
                      className="text-left text-sm font-bold text-[#5b6770] transition hover:text-[#171c22]"
                    >
                      重新测评
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
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
