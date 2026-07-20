/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { EChartsCoreOption } from "echarts/core";
import {
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  CheckCircle2,
  Compass,
  Heart,
  LoaderCircle,
  RefreshCw,
  Target,
  UserCircle2,
} from "lucide-react";
import {
  studentApi,
  type EvaluationHistoryItem,
  type EvaluationTrendResponse,
  type LearningPlanResponse,
  type PlanProgressResponse,
  type ProfileSummaryResponse,
  type ResourceCard,
  type ResourceFavoriteSummaryResponse,
  type TutoringHistoryItem,
} from "../lib/studentApi";
import { resolveBackendCourseId } from "../lib/courseRouting";
import { getCurrentLoggedInUserId } from "../lib/currentUser";
import { buildResourcesRoute } from "../lib/routeCourseContext";
const LineBarChartPanel = lazy(() => import("../components/LineBarChartPanel"));
const HeatmapChartPanel = lazy(() => import("../components/HeatmapChartPanel"));

const DEFAULT_ROUTE_COURSE_ID = "series-2";
const REPORT_SECTION_TIMEOUT_MS = 2200;
const REPORT_PROGRESS_TIMEOUT_MS = 900;
const REPORT_CACHE_STORAGE_KEY = "a3-study-report-cache";
const REPORT_CACHE_TTL_MS = 30 * 60 * 1000;

type StudyReportCacheSnapshot = {
  cachedAt: string;
  profileSummary: ProfileSummaryResponse | null;
  plan: LearningPlanResponse | null;
  planProgress: PlanProgressResponse | null;
  resources: ResourceCard[];
  favoriteSummary: ResourceFavoriteSummaryResponse | null;
  evaluationHistory: EvaluationHistoryItem[];
  evaluationTrend: EvaluationTrendResponse | null;
  tutoringHistory: TutoringHistoryItem[];
  sectionFallback: LoadSectionState;
};

function withReportTimeout<T>(promise: Promise<T>, timeoutMs = REPORT_SECTION_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("报告数据加载超时")), timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function buildReportCacheKey(userId: number, courseId: number) {
  return `${userId}::${courseId}`;
}

function readReportCache(userId: number, courseId: number) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REPORT_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, StudyReportCacheSnapshot>;
    const cached = parsed[buildReportCacheKey(userId, courseId)];
    if (!cached?.cachedAt) return null;
    const age = Date.now() - new Date(cached.cachedAt).getTime();
    if (!Number.isFinite(age) || age < 0 || age > REPORT_CACHE_TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeReportCache(userId: number, courseId: number, snapshot: StudyReportCacheSnapshot) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(REPORT_CACHE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, StudyReportCacheSnapshot>) : {};
    parsed[buildReportCacheKey(userId, courseId)] = snapshot;
    window.localStorage.setItem(REPORT_CACHE_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore cache write failures.
  }
}

const FALLBACK_REPORT = {
  profile: {
    completeness: 82,
    currentStage: "稳步提升阶段",
    style: "图文结合 + 任务驱动",
    tags: ["阶段节奏稳定", "偏好讲义强化", "适合短测回流"],
    summary: "学习画像暂未刷新到实时结果，当前先展示稳定摘要。",
  },
  plan: {
    completionRate: 68,
    completedSteps: 5,
    totalSteps: 8,
    nextAction: "继续完成本周剩余强化节点，并把阶段测评结果回写到路径。",
    summary: "学习路径可继续联动资源、测评与助教问答，保证页面浏览不断线。",
  },
  resource: {
    total: 6,
    favorites: 3,
    highlights: ["讲义精读", "错因练习", "阶段复盘"],
  },
  evaluation: {
    score: 88,
    average: 84,
    mastery: "持续提升",
    summary: "最近一次测评结果可用于支撑后续画像与路径调优。",
    weakPoints: ["综合迁移输出", "错因归档复盘"],
  },
  tutor: {
    total: 4,
    answered: 4,
    latestQuestion: "需求分析和概要设计有什么区别？",
    summary: "AI 助教历史可继续作为学习证据链的一部分。",
  },
};

type LoadSectionState = {
  profile: boolean;
  plan: boolean;
  resource: boolean;
  evaluation: boolean;
  tutor: boolean;
};

type SbtiPortrait = {
  code: string;
  title: string;
  subtitle: string;
};

const SBTI_PORTRAITS: Record<string, SbtiPortrait> = {
  SPTA: {
    code: "SPTA",
    title: "稳态实战型",
    subtitle: "结构推进，实践验证",
  },
  STCA: {
    code: "STCA",
    title: "体系建构型",
    subtitle: "原理优先，框架清晰",
  },
  ETFI: {
    code: "ETFI",
    title: "探索反馈型",
    subtitle: "快速试错，反馈驱动",
  },
  SPCI: {
    code: "SPCI",
    title: "节奏推进型",
    subtitle: "主线清晰，持续进阶",
  },
};

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0);
}

function buildTutorEvidenceSummary(questionText?: string | null) {
  const normalized = String(questionText || "")
    .replace(/\s+/g, " ")
    .replace(/[：:]\s*/g, "：")
    .trim();

  if (!normalized) return FALLBACK_REPORT.tutor.summary;

  const shortened = normalized.length > 42 ? `${normalized.slice(0, 42)}...` : normalized;
  return `最近一次提问聚焦“${shortened}”`;
}

function getSbtiPortrait(profileSummary: ProfileSummaryResponse | null): SbtiPortrait {
  const backendCode = String(profileSummary?.sbti_code || "").toUpperCase();
  if (backendCode && SBTI_PORTRAITS[backendCode]) {
    return SBTI_PORTRAITS[backendCode];
  }

  const tags = profileSummary?.tags || [];
  const style = profileSummary?.recommended_learning_style || "";
  const stage = profileSummary?.current_stage || "";
  const keyFeatures = profileSummary?.key_features || "";
  const stableSignals = `${tags.join(" ")} ${style} ${stage} ${keyFeatures}`.toLowerCase();

  const scores = {
    SPTA: countMatches(stableSignals, [/结构|拆解|规划|步骤|体系/, /实践|实操|项目|动手|验证/, /稳定|持续|节奏|推进|steady/]),
    STCA: countMatches(stableSignals, [/原理|理论|概念|推导/, /框架|体系|结构|图谱/, /讲义|笔记|分层|梳理/]),
    ETFI: countMatches(stableSignals, [/反馈|复盘|纠错|测评/, /试错|调整|迭代|修正/, /提问|答疑|互动|探索/]),
    SPCI: countMatches(stableSignals, [/主线|节奏|持续|推进|稳定/, /投入|跟进|积累|阶段/, /渐进|巩固|提升/]),
  };

  const rankedCodes = (Object.keys(scores) as Array<keyof typeof scores>).sort((left, right) => {
    if (scores[right] !== scores[left]) {
      return scores[right] - scores[left];
    }
    return ["SPTA", "STCA", "ETFI", "SPCI"].indexOf(left) - ["SPTA", "STCA", "ETFI", "SPCI"].indexOf(right);
  });

  return SBTI_PORTRAITS[rankedCodes[0] || "SPCI"];
}

function formatDateTime(value?: string | null) {
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

function formatPercent(value?: number | null, fallback = "--") {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return `${Math.round(value)}%`;
}

function normalizeCourseLabel(value?: string | null) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return "软件工程";
  if (normalized.includes("software_engineering") || normalized.includes("software-engineering")) {
    return "软件工程";
  }
  return value || "软件工程";
}

function normalizeMastery(value?: string | null) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return FALLBACK_REPORT.evaluation.mastery;
  if (normalized === "proficient") return "掌握良好";
  if (normalized === "stable") return "掌握稳定";
  if (normalized === "developing") return "仍需强化";
  return value || FALLBACK_REPORT.evaluation.mastery;
}

function normalizeStage(value?: string | null) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return FALLBACK_REPORT.profile.currentStage;
  if (normalized.includes("deep") || normalized.includes("advanced")) return "深化提升阶段";
  if (normalized.includes("stable")) return "巩固提升阶段";
  if (normalized.includes("start") || normalized.includes("begin")) return "起步适应阶段";
  return value || FALLBACK_REPORT.profile.currentStage;
}

function normalizeReportSummary(value?: string | null) {
  if (!value) return FALLBACK_REPORT.evaluation.summary;
  return value.replaceAll("software_engineering_4th", "软件工程");
}

function summarizeTopResourceTypes(items: ResourceCard[]) {
  const order = new Map<string, number>();
  items.forEach((item) => {
    const key = item.resource_type || "resource";
    order.set(key, (order.get(key) || 0) + 1);
  });
  return [...order.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([key]) => key);
}

function summarizePlanProgress(
  plan: LearningPlanResponse | null,
  progress: PlanProgressResponse | null,
) {
  const completionRate = Math.round(
    progress?.completion_rate ?? plan?.completion_rate ?? FALLBACK_REPORT.plan.completionRate,
  );
  const completedSteps =
    progress?.completed_steps ??
    plan?.steps.filter((step) => step.status === "completed").length ??
    FALLBACK_REPORT.plan.completedSteps;
  const totalSteps = progress?.total_steps ?? plan?.steps.length ?? FALLBACK_REPORT.plan.totalSteps;
  return { completionRate, completedSteps, totalSteps };
}

function buildReportTrendOption(
  evaluationHistory: EvaluationHistoryItem[],
  evaluationTrend: EvaluationTrendResponse | null,
): EChartsCoreOption {
  const rows = evaluationHistory.length
    ? [...evaluationHistory]
        .slice(0, 6)
        .reverse()
        .map((item, index) => ({
          label: item.created_at ? formatDateTime(item.created_at) : `第 ${index + 1} 次`,
          score: Math.round(item.overall_score || 0),
        }))
    : [
        { label: "阶段一", score: 76 },
        { label: "阶段二", score: 82 },
        { label: "阶段三", score: Math.round(evaluationTrend?.latest_score || FALLBACK_REPORT.evaluation.score) },
      ];

  return {
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(17,24,39,0.96)",
      borderWidth: 0,
      textStyle: { color: "#fff" },
    },
    grid: { left: 26, right: 18, top: 24, bottom: 28 },
    xAxis: {
      type: "category",
      data: rows.map((row) => row.label),
      axisLine: { lineStyle: { color: "#d9e2ea" } },
      axisTick: { show: false },
      axisLabel: { color: "#667085", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: "#edf2f6" } },
      axisLabel: { color: "#98a2b3", fontSize: 11 },
    },
    series: [
      {
        type: "bar",
        barWidth: 24,
        data: rows.map((row) => row.score),
        itemStyle: {
          borderRadius: [12, 12, 4, 4],
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "#0f6c7b" },
              { offset: 1, color: "#70d6df" },
            ],
          },
        },
      },
    ],
  };
}

function buildWeakHeatmapOption(weakPoints: string[]): EChartsCoreOption {
  const points = weakPoints.length ? weakPoints : FALLBACK_REPORT.evaluation.weakPoints;
  const dimensions = ["概念理解", "案例应用", "综合输出"];
  const values = points.flatMap((point, yIndex) =>
    dimensions.map((dimension, xIndex) => [xIndex, yIndex, Math.max(20, 80 - yIndex * 7 - xIndex * 6)]),
  );

  return {
    tooltip: {
      position: "top",
      formatter: (params) => {
        const [x, y, value] = Array.isArray(params.data) ? params.data : [0, 0, 0];
        return `${points[y]}<br/>${dimensions[x]}风险值：${value}`;
      },
      backgroundColor: "rgba(17,24,39,0.96)",
      borderWidth: 0,
      textStyle: { color: "#fff" },
    },
    grid: { left: 90, right: 18, top: 28, bottom: 30 },
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
      data: points,
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
      text: ["高风险", "低风险"],
      inRange: {
        color: ["#edf8f5", "#c7f0dd", "#ffd166", "#fb7299"],
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

export default function StudyReport() {
  const [searchParams] = useSearchParams();
  const routeCourseId = searchParams.get("courseId") || DEFAULT_ROUTE_COURSE_ID;
  const numericCourseId = resolveBackendCourseId(routeCourseId);
  const activeUserId = getCurrentLoggedInUserId();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [profileSummary, setProfileSummary] = useState<ProfileSummaryResponse | null>(null);
  const [plan, setPlan] = useState<LearningPlanResponse | null>(null);
  const [planProgress, setPlanProgress] = useState<PlanProgressResponse | null>(null);
  const [resources, setResources] = useState<ResourceCard[]>([]);
  const [favoriteSummary, setFavoriteSummary] = useState<ResourceFavoriteSummaryResponse | null>(null);
  const [evaluationHistory, setEvaluationHistory] = useState<EvaluationHistoryItem[]>([]);
  const [evaluationTrend, setEvaluationTrend] = useState<EvaluationTrendResponse | null>(null);
  const [tutoringHistory, setTutoringHistory] = useState<TutoringHistoryItem[]>([]);
  const [sectionFallback, setSectionFallback] = useState<LoadSectionState>({
    profile: false,
    plan: false,
    resource: false,
    evaluation: false,
    tutor: false,
  });

  const applyReportSnapshot = (snapshot: StudyReportCacheSnapshot) => {
    setProfileSummary(snapshot.profileSummary);
    setPlan(snapshot.plan);
    setPlanProgress(snapshot.planProgress);
    setResources(snapshot.resources);
    setFavoriteSummary(snapshot.favoriteSummary);
    setEvaluationHistory(snapshot.evaluationHistory);
    setEvaluationTrend(snapshot.evaluationTrend);
    setTutoringHistory(snapshot.tutoringHistory);
    setSectionFallback(snapshot.sectionFallback);
    setLastLoadedAt(snapshot.cachedAt);
  };

  const loadReport = async ({ silent = false, force = false }: { silent?: boolean; force?: boolean } = {}) => {
    if (!force) {
      const cached = readReportCache(activeUserId, numericCourseId);
      if (cached) {
        applyReportSnapshot(cached);
        setLoading(false);
        setRefreshing(false);
        return;
      }
    }

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const profileTask = withReportTimeout(studentApi.getProfileSummary(activeUserId));
      const planTask = withReportTimeout(studentApi.getLatestLearningPlan(activeUserId, numericCourseId));
      const resourceListTask = withReportTimeout(studentApi.listResources(activeUserId, numericCourseId));
      const favoriteTask = withReportTimeout(studentApi.getFavoriteSummary(activeUserId));
      const historyTask = withReportTimeout(studentApi.getEvaluationHistory(activeUserId, numericCourseId));
      const trendTask = withReportTimeout(studentApi.getEvaluationTrend(activeUserId, numericCourseId));
      const tutorTask = withReportTimeout(studentApi.listTutoringHistory({ course_id: numericCourseId, page: 1, page_size: 6 }));

      const [
        profileResult,
        planResult,
        resourceResult,
        favoriteResult,
        historyResult,
        trendResult,
        tutorResult,
      ] = await Promise.allSettled([
        profileTask,
        planTask,
        resourceListTask,
        favoriteTask,
        historyTask,
        trendTask,
        tutorTask,
      ]);

      setProfileSummary(profileResult.status === "fulfilled" ? profileResult.value : null);
      setPlan(planResult.status === "fulfilled" ? planResult.value : null);
      setResources(resourceResult.status === "fulfilled" ? resourceResult.value.items : []);
      setFavoriteSummary(favoriteResult.status === "fulfilled" ? favoriteResult.value : null);
      setEvaluationHistory(historyResult.status === "fulfilled" ? historyResult.value.items : []);
      setEvaluationTrend(trendResult.status === "fulfilled" ? trendResult.value : null);
      setTutoringHistory(tutorResult.status === "fulfilled" ? tutorResult.value.items : []);

      if (planResult.status === "fulfilled" && planResult.value.plan_id) {
        setPlanProgress(null);
        void withReportTimeout(
            studentApi.getPlanProgress(planResult.value.plan_id, activeUserId),
            REPORT_PROGRESS_TIMEOUT_MS,
          )
          .then((progressResult) => {
            setPlanProgress(progressResult);
            const cached = readReportCache(activeUserId, numericCourseId);
            if (cached) {
              writeReportCache(activeUserId, numericCourseId, {
                ...cached,
                planProgress: progressResult,
              });
            }
          })
          .catch(() => setPlanProgress(null));
      } else {
        setPlanProgress(null);
      }

      const fallbackState = {
        profile: profileResult.status !== "fulfilled",
        plan: planResult.status !== "fulfilled",
        resource: resourceResult.status !== "fulfilled" || favoriteResult.status !== "fulfilled",
        evaluation: historyResult.status !== "fulfilled" || trendResult.status !== "fulfilled",
        tutor: tutorResult.status !== "fulfilled",
      };
      setSectionFallback(fallbackState);
      const cachedAt = new Date().toISOString();
      setLastLoadedAt(cachedAt);
      writeReportCache(activeUserId, numericCourseId, {
        cachedAt,
        profileSummary: profileResult.status === "fulfilled" ? profileResult.value : null,
        plan: planResult.status === "fulfilled" ? planResult.value : null,
        planProgress: null,
        resources: resourceResult.status === "fulfilled" ? resourceResult.value.items : [],
        favoriteSummary: favoriteResult.status === "fulfilled" ? favoriteResult.value : null,
        evaluationHistory: historyResult.status === "fulfilled" ? historyResult.value.items : [],
        evaluationTrend: trendResult.status === "fulfilled" ? trendResult.value : null,
        tutoringHistory: tutorResult.status === "fulfilled" ? tutorResult.value.items : [],
        sectionFallback: fallbackState,
      });
    } catch {
      setSectionFallback({
        profile: true,
        plan: true,
        resource: true,
        evaluation: true,
        tutor: true,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, [activeUserId, numericCourseId]);

  const courseLabel = useMemo(
    () => normalizeCourseLabel(plan?.course_name || evaluationTrend?.course_code || evaluationHistory[0]?.course_code),
    [evaluationHistory, evaluationTrend, plan],
  );

  const planSummary = useMemo(() => summarizePlanProgress(plan, planProgress), [plan, planProgress]);
  const latestEvaluation = evaluationHistory[0] || null;
  const favoriteCount = favoriteSummary?.total ?? FALLBACK_REPORT.resource.favorites;
  const resourceHighlights = summarizeTopResourceTypes(resources);
  const tutorAnsweredCount = tutoringHistory.filter((item) => item.answer?.answer_text).length;

  const profileCompleteness = sectionFallback.profile
    ? formatPercent(FALLBACK_REPORT.profile.completeness)
    : formatPercent(profileSummary?.completeness, formatPercent(FALLBACK_REPORT.profile.completeness));
  const profileStage = normalizeStage(profileSummary?.current_stage);
  const latestScore = sectionFallback.evaluation
    ? formatPercent(FALLBACK_REPORT.evaluation.score)
    : formatPercent(latestEvaluation?.overall_score ?? evaluationTrend?.latest_score, formatPercent(FALLBACK_REPORT.evaluation.score));
  const latestMastery = normalizeMastery(latestEvaluation?.mastery_level || evaluationTrend?.latest_mastery_level);
  const profileTags = sectionFallback.profile
    ? FALLBACK_REPORT.profile.tags
    : profileSummary?.tags?.slice(0, 4) || FALLBACK_REPORT.profile.tags;
  const weakPoints = latestEvaluation?.weak_points?.slice(0, 2) || FALLBACK_REPORT.evaluation.weakPoints;
  const evaluationTrendOption = useMemo(
    () => buildReportTrendOption(evaluationHistory, evaluationTrend),
    [evaluationHistory, evaluationTrend],
  );
  const weakHeatmapOption = useMemo(() => buildWeakHeatmapOption(weakPoints), [weakPoints]);
  const profileSummaryText = profileSummary?.key_features || FALLBACK_REPORT.profile.summary;
  const learningStyle = profileSummary?.recommended_learning_style || FALLBACK_REPORT.profile.style;
  const sbtiPortrait = useMemo(() => getSbtiPortrait(profileSummary), [profileSummary]);
  const fallbackCount = Object.values(sectionFallback).filter(Boolean).length;
  const liveCount = Object.keys(sectionFallback).length - fallbackCount;
  const reportDataLabel = fallbackCount === 0 ? "实时数据" : liveCount > 0 ? "部分实时" : "稳定摘要";
  const summaryCards = [
    {
      title: "画像完整度",
      value: profileCompleteness,
      note: profileStage,
      hint: "当前画像是否已经具备足够证据支撑后续推荐。",
      icon: UserCircle2,
      accent: "from-[#ff8a65] to-[#fb7299]",
      route: "/profile",
      mode: sectionFallback.profile ? "稳定摘要" : "实时数据",
    },
    {
      title: "最近测评",
      value: latestScore,
      note: latestMastery,
      hint: "最近一次测评是画像里最强的一条能力证据。",
      icon: Award,
      accent: "from-[#70d6df] to-[#1697a6]",
      route: `/evaluation?courseId=${routeCourseId}`,
      mode: sectionFallback.evaluation ? "稳定摘要" : "实时数据",
    },
    {
      title: "资源偏好",
      value: `${favoriteCount} 项`,
      note: resourceHighlights.length > 0 ? resourceHighlights.join("、") : FALLBACK_REPORT.resource.highlights.join("、"),
      hint: "收藏和浏览过的资料类型，会影响后续推荐素材的排序。",
      icon: Heart,
      accent: "from-[#ffb74d] to-[#ff8f00]",
      route: buildResourcesRoute(routeCourseId),
      mode: sectionFallback.resource ? "稳定摘要" : "实时数据",
    },
    {
      title: "答疑证据",
      value: `${sectionFallback.tutor ? FALLBACK_REPORT.tutor.answered : tutorAnsweredCount} 条`,
      note: "最近问答已纳入画像",
      hint: buildTutorEvidenceSummary(tutoringHistory[0]?.question.question_text),
      icon: Bot,
      accent: "from-[#7c3aed] to-[#5b7cff]",
      route: `/tutor?courseId=${routeCourseId}`,
      mode: sectionFallback.tutor ? "稳定摘要" : "实时数据",
    },
  ];

  const profileComposition = [
    {
      title: "学习基础",
      value: latestScore,
      detail: `主要来自最近一次测评结果、掌握度判断和薄弱点识别，当前更偏向 ${latestMastery}。`,
      icon: Award,
    },
    {
      title: "学习行为",
      value: `${planSummary.completedSteps}/${planSummary.totalSteps}`,
      detail: `路径推进节奏、完成率和当前阶段状态会一起决定你现在属于 ${profileStage}。`,
      icon: Compass,
    },
    {
      title: "资源偏好",
      value: `${favoriteCount} 项`,
      detail: `你更常使用 ${resourceHighlights.length > 0 ? resourceHighlights.join("、") : FALLBACK_REPORT.resource.highlights.join("、")}，这会影响资源推荐顺序。`,
      icon: BookOpen,
    },
    {
      title: "提问反馈",
      value: `${tutoringHistory.length || FALLBACK_REPORT.tutor.total} 次`,
      detail: "你在 AI 导师中的追问内容，会补充系统对卡点、表达方式和讲解偏好的理解。",
      icon: Bot,
    },
  ];

  const interpretationCards = [
    {
      title: "这份画像结论是什么",
      desc: profileSummaryText,
    },
    {
      title: "你现在最明显的优势",
      desc: profileTags.join("、"),
    },
    {
      title: "当前最值得优先补的部分",
      desc: weakPoints.join("、"),
    },
    {
      title: "系统更适合怎样帮助你",
      desc: `当前更适合使用 ${learningStyle} 的方式来解释知识点，并优先承接 ${plan?.next_action || FALLBACK_REPORT.plan.nextAction}。`,
    },
  ];

  const recommendations = latestEvaluation?.recommended_actions?.length
    ? latestEvaluation.recommended_actions.slice(0, 3)
    : latestEvaluation?.suggestions?.slice(0, 3) || [
        FALLBACK_REPORT.plan.nextAction,
        "继续把错题按知识点和错因分类收藏，方便在资源中心快速回看。",
        "如 AI 助教连续两轮仍未解决卡点，可在助教页使用转人工老师入口继续升级处理。",
      ];

  const nextActions = [
    {
      title: "查看完整画像",
      detail: "查看标签、阶段和画像证据。",
      to: "/profile",
    },
    {
      title: "重排学习路径",
      detail: "按当前状态调整后续任务。",
      to: `/path?courseId=${routeCourseId}`,
    },
  ];

  const summaryCardGroups = [
    {
      title: "阶段判断",
      desc: "先看当前状态，再决定后续动作。",
      items: summaryCards.slice(0, 2),
    },
    {
      title: "学习偏好",
      desc: "资源倾向和追问反馈会影响系统承接方式。",
      items: summaryCards.slice(2, 4),
    },
  ];

  if (loading) {
    return (
      <div className="report-loading-shell flex min-h-[360px] items-center justify-center rounded-[32px] border border-[#dde7ea] bg-white">
        <div className="report-loading-panel">
          <div className="report-loading-orbit" aria-hidden="true">
            <div className="report-loading-core">
              <Bot className="h-8 w-8 text-[#fb7299]" />
            </div>
            <span className="report-loading-node report-loading-node--profile" />
            <span className="report-loading-node report-loading-node--plan" />
            <span className="report-loading-node report-loading-node--resource" />
          </div>
          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center gap-3 text-lg font-extrabold text-[#2f4650] md:text-xl">
              <LoaderCircle className="h-6 w-6 animate-spin text-[#fb7299]" />
              <span>正在汇总学生端 AI 闭环报告...</span>
            </div>
            <p className="text-sm font-semibold text-[#73828a]">画像、路径、资源和测评数据正在并行整理</p>
          </div>
          <div className="report-loading-bar" aria-hidden="true">
            <span />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="path-product space-y-6 select-none" id="study-report-workspace">
      <section className="path-hero rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
        <div className="relative grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="path-label">
                  学习报告
                </span>
                <span className={`path-status-pill ${fallbackCount === 0 ? "path-status-pill--ok" : "path-status-pill--neutral"}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {reportDataLabel}
                </span>
                <span className="path-status-pill path-status-pill--neutral">
                  最近刷新 {formatDateTime(lastLoadedAt)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void loadReport({ silent: true, force: true })}
                disabled={refreshing}
                className="path-secondary-action inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E3E8EC] bg-white px-4 py-2 text-sm font-bold text-[#171c22] transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 text-[#E4002B] ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "刷新中" : "重新汇总"}
              </button>
            </div>

            <div className="space-y-1.5">
              <h1 className="path-title max-w-3xl text-2xl font-extrabold text-[#171c22] lg:text-3xl">
                {courseLabel} 阶段学习报告
              </h1>
              <p className="path-summary max-w-3xl text-sm leading-7 text-[#4b5563]">
                汇总画像、路径、资源、测评和答疑证据，给出当前判断与下一步行动。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                to="/profile"
                className="path-dark-action inline-flex items-center gap-2 rounded-2xl bg-[#171c22] px-4 py-2.5 text-sm font-bold text-white transition"
              >
                查看完整画像
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={`/path?courseId=${routeCourseId}`}
                className="path-secondary-action inline-flex items-center gap-2 rounded-2xl border border-[#E3E8EC] bg-white px-4 py-2.5 text-sm font-bold text-[#171c22] transition"
              >
                调整学习路径
                <Compass className="h-4 w-4 text-[#E4002B]" />
              </Link>
            </div>

            <div className="path-metrics grid gap-3 sm:grid-cols-3">
              <div>
                <p className="path-metric-label">画像完整度</p>
                <p className="path-metric-value">{profileCompleteness}</p>
              </div>
              <div>
                <p className="path-metric-label">当前阶段</p>
                <p className="path-metric-value path-metric-value--small">{profileStage}</p>
              </div>
              <div>
                <p className="path-metric-label">最近测评</p>
                <p className="path-metric-value">{latestScore}</p>
              </div>
            </div>

            <div className="path-plan-panel rounded-[28px] border border-[#E3E8EC] bg-white p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center rounded-full bg-white/82 px-3 py-1 text-xs font-extrabold text-[#0f6c7b]">
                    画像解读
                  </div>
                  <h2 className="mt-3 text-2xl font-extrabold ui-tracking-tight text-[#171c22] lg:text-[32px]">
                    你现在更适合这样学
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#5a6970]">
                    当前判断为 <span className="font-bold text-[#171c22]">{latestMastery}</span>，更适合用
                    <span className="font-bold text-[#171c22]"> {learningStyle} </span>
                    的方式承接下一步。
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#171c22]">
                  <span className="rounded-full bg-white/78 px-3 py-2">{latestMastery}</span>
                  <span className="rounded-full bg-white/72 px-3 py-2">{learningStyle}</span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-[1.1fr_1fr]">
                {nextActions.map((action, index) => (
                  <Link
                    key={action.title}
                    to={action.to}
                    className={`group rounded-[24px] px-4 py-4 transition-transform hover:-translate-y-0.5 ${
                      index === 0
                        ? "bg-[#171c22] text-white shadow-[0_18px_40px_rgba(23,28,34,0.14)]"
                        : "bg-white/76 text-[#171c22] shadow-[0_10px_28px_rgba(23,28,34,0.04)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-[20px] font-black ui-tracking-tight">{action.title}</h3>
                        <p className={`mt-2 text-sm leading-6 ${index === 0 ? "text-white/78" : "text-[#5a6970]"}`}>
                          {action.detail}
                        </p>
                      </div>
                      <ArrowRight className={`mt-1 h-4.5 w-4.5 shrink-0 transition-transform group-hover:translate-x-1 ${index === 0 ? "text-white/70" : "text-[#9aa6b2]"}`} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="path-side-panel rounded-3xl border border-[#E3E8EC] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="path-label">画像摘要</p>
                <p className="mt-3 text-3xl font-extrabold leading-tight text-[#171c22]">{profileStage}</p>
                <p className="mt-2 text-sm font-semibold text-[#4b5563]">当前画像主类型：{sbtiPortrait.title}</p>
              </div>
              <div className="relative flex h-[92px] w-[92px] shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-[#D9DEE5] bg-[#F7F7F8]">
                <div className="absolute inset-3 rounded-full border border-[#E4002B]/35" />
                <div className="absolute inset-6 rounded-full border border-[#D9DEE5]" />
                <span className="relative text-xl font-black text-[#171c22]">{sbtiPortrait.code}</span>
              </div>
            </div>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-[#F3F5F8]">
              <div
                className="h-full rounded-full bg-[#E4002B]"
                style={{ width: profileCompleteness }}
              />
            </div>

            <div className="mt-6 text-sm font-semibold leading-6 text-[#4b5563]">
              {profileSummaryText}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="path-status-pill path-status-pill--neutral">
                {sbtiPortrait.code} · {sbtiPortrait.subtitle}
              </span>
              {profileTags.slice(0, 2).map((tag) => (
                <span key={tag} className="path-status-pill path-status-pill--neutral">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="path-day-card rounded-2xl border border-[#E3E8EC] bg-white p-4">
                <p className="path-metric-label">优势信号</p>
                <p className="mt-3 text-[15px] font-bold leading-6 text-[#171c22]">
                  {profileTags.slice(0, 3).join("、")}
                </p>
              </div>
              <div className="path-day-card rounded-2xl border border-[#E3E8EC] bg-white p-4">
                <p className="path-metric-label">待补重点</p>
                <p className="mt-3 text-[15px] font-bold leading-6 text-[#171c22]">
                  {weakPoints.join("、")}
                </p>
              </div>
            </div>

            <div className="path-level-card mt-3 rounded-2xl border border-[#E3E8EC] bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="path-status-pill path-status-pill--neutral">
                  掌握判断
                </span>
                <span className="path-status-pill path-status-pill--neutral">
                  学习方式
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#4b5563]">
                当前掌握度偏向 <span className="font-bold text-[#171c22]">{latestMastery}</span>，更适合以
                <span className="font-bold text-[#171c22]"> {learningStyle} </span>
                的方式继续推进。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {summaryCardGroups.map((group) => (
          <div
            key={group.title}
            className="path-main-panel rounded-3xl border border-[#E3E8EC] bg-white p-5 shadow-sm"
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-[#73838a]">{group.title}</p>
                <p className="mt-2 text-sm text-[#5a6970]">{group.desc}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {group.items.map((card) => {
                const Icon = card.icon;
                return (
                  <Link
                    key={card.title}
                    to={card.route}
                    className="path-day-card group rounded-2xl border border-[#E3E8EC] bg-white p-4 transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-bold text-[#73838a]">{card.title}</p>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${
                              card.mode === "实时数据" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {card.mode}
                          </span>
                        </div>
                        <p className="mt-3 text-[26px] font-extrabold text-[#171c22]">{card.value}</p>
                        <p className="mt-1 text-[13px] font-bold text-[#0f6c7b]">{card.note}</p>
                      </div>
                      <div className="rounded-2xl bg-[#171c22] p-3 text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 pt-2">
                      <p className="line-clamp-3 text-[12px] leading-5 text-[#5a6970]">{card.hint}</p>
                      <ArrowRight className="h-4.5 w-4.5 shrink-0 text-[#b7c4c8] transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="path-main-panel rounded-3xl border border-[#E3E8EC] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#73838a]">学习效果</p>
              <h3 className="mt-2 text-xl font-extrabold text-[#171c22]">阶段测评趋势</h3>
            </div>
            <span className="rounded-full bg-[#eef7ff] px-3 py-1 text-xs font-extrabold text-[#0f6c7b]">趋势</span>
          </div>
          <p className="mt-2 text-sm leading-7 text-[#5a6970]">
            将最近阶段测评结果转为趋势图，帮助学生和教师快速理解学习效果变化。
          </p>
          <Suspense fallback={<div className="mt-4 h-[300px] animate-pulse rounded-[20px] bg-[#f5f7fa]" />}>
            <LineBarChartPanel option={evaluationTrendOption} height={300} className="mt-4" />
          </Suspense>
        </article>

        <article className="path-main-panel rounded-3xl border border-[#E3E8EC] bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-bold text-[#73838a]">薄弱点识别</p>
            <h3 className="mt-2 text-xl font-extrabold text-[#171c22]">能力风险分布</h3>
          </div>
          <p className="mt-2 text-sm leading-7 text-[#5a6970]">
            从概念理解、案例应用、综合输出三个维度可视化薄弱知识点，强化评估模块的表达力与可读性。
          </p>
          <Suspense fallback={<div className="mt-4 h-[300px] animate-pulse rounded-[20px] bg-[#f5f7fa]" />}>
            <HeatmapChartPanel option={weakHeatmapOption} height={300} className="mt-4" />
          </Suspense>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <article className="path-main-panel overflow-hidden rounded-3xl border border-[#E3E8EC] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#edf2f4] px-6 py-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#73838a]">画像构成</p>
              <h2 className="mt-2 flex items-center gap-2 text-xl font-extrabold text-[#171c22]">
                <Target className="h-5 w-5 text-[#fb7299]" />
                画像依据
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#5a6970]">
                这份判断主要来自学习基础、学习行为、资源偏好和提问反馈。
              </p>
            </div>
            <div className="rounded-2xl bg-[#f4f8f8] px-4 py-3 text-sm font-semibold text-[#0f6c7b]">
              最近刷新 {formatDateTime(lastLoadedAt)}
            </div>
          </div>

          <div className="grid gap-3 px-6 py-5 md:grid-cols-2">
            {profileComposition.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="path-day-card rounded-2xl border border-[#E3E8EC] bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white p-2 text-[#0f6c7b] shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-[#171c22]">{item.title}</p>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-[#0f6c7b] shadow-sm">
                          {item.value}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] leading-5 text-[#5a6970]">{item.detail}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <aside>
          <article className="path-side-panel overflow-hidden rounded-3xl border border-[#E3E8EC] bg-white shadow-sm">
            <div className="border-b border-[#E3E8EC] px-6 py-5">
              <p className="path-label">行动建议</p>
              <h2 className="mt-2 text-xl font-extrabold text-[#171c22]">先看结论，再决定动作</h2>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="space-y-3">
                {interpretationCards.slice(0, 3).map((item) => (
                  <div key={item.title} className="path-day-card rounded-2xl border border-[#E3E8EC] bg-white p-4">
                    <div className="text-sm font-bold text-[#171c22]">{item.title}</div>
                    <p className="mt-2 text-[13px] leading-5 text-[#4b5563]">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="path-level-card rounded-2xl border border-[#E3E8EC] bg-white p-4">
                <p className="path-label">下一步建议</p>
                <div className="mt-3 space-y-3">
                  {recommendations.map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-[#E4002B] text-[10px] font-extrabold text-white">
                        +
                      </span>
                      <p className="text-sm leading-6 text-[#4b5563]">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </aside>
      </section>

    </div>
  );
}
