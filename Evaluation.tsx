/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { EChartsCoreOption } from "echarts/core";
import {
  AlertCircle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Bot,
  CheckCircle,
  FileText,
  LoaderCircle,
  Lock,
  Network,
  RefreshCw,
  Sparkles,
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
import { recordTrialFlowCompletion } from "../lib/trialFeedback";
import { normalizeAnswerList, normalizeOptionKey, parseQuizPaper, scoreQuiz, type QuizPaper, type QuizQuestion } from "../lib/quizEngine";
const USER_ID = getCurrentLoggedInUserId();
const ACTIVE_COURSE_KEY = "software-engineering";
const EVALUATION_STATE_CACHE_PREFIX = "a3:evaluation-state";
const EVALUATION_STATE_CACHE_TTL = 5 * 60 * 1000;
const EVALUATION_STATE_TIMEOUT = 3500;
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
    routeCourseId: "series-1",
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
const SEEDED_QUESTION_BANKS = [
  { label: "数据结构：栈与队列", count: 5 },
  { label: "Java 基础语法", count: 5 },
  { label: "算法复杂度分析", count: 5 },
  { label: "数据库索引与约束", count: 5 },
  { label: "操作系统进程线程", count: 5 },
];

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

function buildEvaluationStateCacheKey(userId: number, courseId: number) {
  return `${EVALUATION_STATE_CACHE_PREFIX}:${userId}:${courseId}`;
}

function readEvaluationStateCache(userId: number, courseId: number): EvaluationStateCache | null {
  try {
    const raw = window.localStorage.getItem(buildEvaluationStateCacheKey(userId, courseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EvaluationStateCache;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > EVALUATION_STATE_CACHE_TTL) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeEvaluationStateCache(userId: number, courseId: number, state: Omit<EvaluationStateCache, "savedAt">) {
  try {
    window.localStorage.setItem(
      buildEvaluationStateCacheKey(userId, courseId),
      JSON.stringify({
        ...state,
        savedAt: Date.now(),
      }),
    );
  } catch {
    // Cache is only an acceleration layer; ignore storage failures.
  }
}

function withEvaluationTimeout<T>(task: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), EVALUATION_STATE_TIMEOUT);
    task
      .then((value) => resolve(value))
      .catch(() => resolve(fallback))
      .finally(() => window.clearTimeout(timer));
  });
}

function buildFallbackEvaluationPaper(
  userId: number,
  courseCode: string,
  courseTitle: string,
  focusPoints: string[] = [],
): EvaluationPaperResponse {
  const points = focusPoints.length
    ? focusPoints
    : ["数据结构：栈与队列", "Java 基础语法", "算法复杂度分析", "数据库索引与约束", "操作系统进程线程"];

  return {
    paper_id: -Date.now(),
    user_id: userId,
    course_code: courseCode || "computer_science_core",
    paper_type: "diagnostic",
    status: "generated",
    source: "fallback",
    questions: [
      {
        question_id: "fallback-cs-q1",
        question_type: "single_choice",
        prompt: "在 Java 中使用数组实现栈时，`top` 表示栈顶元素下标。执行 `push` 操作前最应该先检查什么条件？",
        options: ["A. `top == capacity - 1`，判断栈是否已满", "B. `top == -1`，判断栈是否为空", "C. 数组中是否存在重复元素", "D. 栈中元素是否已经按升序排列"],
        correct_answer: "A",
        explanation: "数组实现栈时容量固定，入栈前必须先判断是否栈满，否则 `top++` 后写入数组会造成越界。判断栈空通常用于 `pop` 或 `peek`。",
        knowledge_point: points[0] || "数据结构：栈",
        difficulty: "easy",
        source: "fallback",
      },
      {
        question_id: "fallback-cs-q2",
        question_type: "single_choice",
        prompt: "对一个长度为 n 的无序数组进行线性查找，最坏情况下的时间复杂度是多少？",
        options: ["A. O(1)", "B. O(log n)", "C. O(n)", "D. O(n log n)"],
        correct_answer: "C",
        explanation: "线性查找在最坏情况下需要从头到尾检查每一个元素，因此时间复杂度是 O(n)。O(log n) 通常对应二分查找，但前提是数据有序。",
        knowledge_point: points[1] || "算法复杂度",
        difficulty: "easy",
        source: "fallback",
      },
      {
        question_id: "fallback-cs-q3",
        question_type: "single_choice",
        prompt: "下面哪种数据结构最适合实现“先到先服务”的任务调度，例如打印队列或消息消费队列？",
        options: ["A. 栈 Stack", "B. 队列 Queue", "C. 哈希表 HashMap", "D. 二叉搜索树 BST"],
        correct_answer: "B",
        explanation: "先到先服务对应 FIFO（First In First Out）语义，队列正是这种访问规则。栈是 LIFO，哈希表强调键值访问，二叉搜索树强调有序查找。",
        knowledge_point: points[2] || "数据结构：队列",
        difficulty: "easy",
        source: "fallback",
      },
      {
        question_id: "fallback-cs-q4",
        question_type: "single_choice",
        prompt: "在关系数据库中，给用户表的 `email` 字段建立唯一索引，主要目的是什么？",
        options: ["A. 保证邮箱不重复，并提升按邮箱查询的效率", "B. 自动加密邮箱内容", "C. 让所有查询都不需要扫描磁盘", "D. 自动删除无效邮箱"],
        correct_answer: "A",
        explanation: "唯一索引既能约束字段值不重复，也能提升基于该字段的检索效率。索引不会自动加密数据，也不能保证所有查询都完全不访问磁盘。",
        knowledge_point: points[3] || "数据库：索引与约束",
        difficulty: "medium",
        source: "fallback",
      },
      {
        question_id: "fallback-cs-q5",
        question_type: "single_choice",
        prompt: "在操作系统中，进程和线程的关系哪一项描述更准确？",
        options: ["A. 进程是资源分配的基本单位，线程是 CPU 调度的基本单位", "B. 线程拥有完全独立的地址空间，进程共享同一个栈", "C. 一个进程只能包含一个线程", "D. 线程之间不能共享进程内存"],
        correct_answer: "A",
        explanation: "进程通常拥有独立地址空间和资源，线程运行在进程内部，共享进程资源，是 CPU 调度执行的基本单位。多线程程序可以在同一进程内并发执行多个任务。",
        knowledge_point: points[4] || "操作系统：进程与线程",
        difficulty: "medium",
        source: "fallback",
      },
    ],
  };
}

function buildStableQuizPaper(courseTitle: string, focusPoints: string[] = []): QuizPaper {
  const paper = buildFallbackEvaluationPaper(USER_ID, courseTitle, courseTitle, focusPoints);
  return {
    title: `${courseTitle} 稳定题库`,
    questions: paper.questions.slice(0, 5).map((question, index) => ({
      id: `stable-q${index + 1}`,
      question: question.prompt,
      options: question.options,
      answer: [question.correct_answer],
      explanation: question.explanation,
      questionType: "single",
      knowledgeTag: question.knowledge_point,
      difficultyLevel: index < 1 ? 1 : 2,
      qualityScore: null,
    })),
  };
}

type MistakeCauseId = "concept" | "step" | "reading" | "transfer";

type MistakeDiagnosis = {
  wrongQuestion: WrongQuestionItem;
  causeId: MistakeCauseId;
  causeLabel: string;
  causeDetail: string;
  evidence: string;
  variantQuestions: Array<{
    title: string;
    prompt: string;
    options: string[];
    answer: string;
    explanation: string;
  }>;
};

const MISTAKE_CAUSE_META: Record<MistakeCauseId, { label: string; detail: string }> = {
  concept: {
    label: "概念不清",
    detail: "核心定义、适用条件或相近概念边界没有分清。",
  },
  step: {
    label: "步骤遗漏",
    detail: "知道大方向，但解题流程、先后顺序或关键检查点漏掉了。",
  },
  reading: {
    label: "审题错误",
    detail: "题干限定词、否定词、场景条件或最优选项没有抓准。",
  },
  transfer: {
    label: "知识迁移弱",
    detail: "概念能背出来，但放到项目、案例或新情境里判断不稳定。",
  },
};

function buildWrongQuestionsFromPaper(paper: EvaluationPaperResponse, answers: Record<string, string>): WrongQuestionItem[] {
  return paper.questions
    .filter((question) => normalizeAnswerToken(answers[question.question_id] || "") !== normalizeAnswerToken(question.correct_answer))
    .map((question) => ({
      question_id: question.question_id,
      prompt: question.prompt,
      knowledge_point: question.knowledge_point,
      user_answer: normalizeAnswerToken(answers[question.question_id] || ""),
      correct_answer: normalizeAnswerToken(question.correct_answer),
      explanation: question.explanation,
    }));
}

function inferMistakeCause(item: WrongQuestionItem): MistakeCauseId {
  const prompt = item.prompt || "";
  const explanation = item.explanation || "";
  const joined = `${prompt} ${explanation}`;
  const userAnswer = (item.user_answer || "").trim();

  if (!userAnswer || /以下|下列|不属于|不是|不能|最|首先|主要|应该|除.*外/.test(prompt)) return "reading";
  if (/步骤|流程|顺序|过程|阶段|先|后|检查|执行|操作|遗漏/.test(joined)) return "step";
  if (/场景|案例|项目|应用|迁移|如果|实际|业务|工程|系统/.test(joined)) return "transfer";
  return "concept";
}

function buildVariantQuestions(item: WrongQuestionItem, causeId: MistakeCauseId): MistakeDiagnosis["variantQuestions"] {
  const point = normalizeKnowledgePointLabel(item.knowledge_point);
  const correctAnswer = item.correct_answer || "A";
  const conceptOption = causeId === "concept" ? "分清定义和适用边界" : "先定位题干限定条件";

  return [
    {
      title: "概念辨析",
      prompt: `围绕「${point}」，哪一项最符合这类题的判断原则？`,
      options: [
        `A. ${conceptOption}，再选择最贴合场景的结论`,
        "B. 只要选项里出现熟悉名词就可以直接选",
        "C. 忽略题干限制，只记住答案字母",
        "D. 遇到相近概念时不需要比较差异",
      ],
      answer: "A",
      explanation: `这类错题要先把「${point}」的定义、条件和场景对应起来，而不是只记住单个答案。`,
    },
    {
      title: "场景判断",
      prompt: `如果题目换成一个真实项目场景，涉及「${point}」时，最应该先做什么？`,
      options: [
        "A. 找出题干给出的约束、目标和异常条件",
        "B. 跳过条件，直接套用上一次做过的答案",
        "C. 只看选项长度，选择描述最长的一项",
        "D. 把所有概念混在一起，不区分适用范围",
      ],
      answer: "A",
      explanation: "迁移题先看场景约束，再用知识点匹配决策；这是从会背到会用的关键一步。",
    },
    {
      title: "易错排除",
      prompt: `本题正确答案是「${correctAnswer}」。复盘同类题时，下面哪种做法最能避免再次出错？`,
      options: [
        "A. 标出题干关键词，并写一句为什么其他选项不成立",
        "B. 只把正确答案抄一遍，不看解析",
        "C. 下次遇到同类题固定选同一个字母",
        "D. 只看自己选错的选项，不分析题干",
      ],
      answer: "A",
      explanation: "错题复盘要形成可迁移的判断规则，排除错误选项比单纯记答案更稳定。",
    },
  ];
}

function buildMistakeDiagnosis(item: WrongQuestionItem): MistakeDiagnosis {
  const causeId = inferMistakeCause(item);
  const meta = MISTAKE_CAUSE_META[causeId];
  const point = normalizeKnowledgePointLabel(item.knowledge_point);
  return {
    wrongQuestion: item,
    causeId,
    causeLabel: meta.label,
    causeDetail: meta.detail,
    evidence: `你在「${point}」题中选择了 ${item.user_answer || "未作答"}，正确答案是 ${item.correct_answer}。建议把题干关键词、判断步骤和选项排除理由补齐。`,
    variantQuestions: buildVariantQuestions(item, causeId),
  };
}

function buildFallbackEvaluationResult(
  paper: EvaluationPaperResponse,
  answers: Record<string, string>,
): { result: EvaluationResultResponse; wrongQuestions: WrongQuestionItem[] } {
  const wrongQuestions = buildWrongQuestionsFromPaper(paper, answers);
  const score = Math.round(((paper.questions.length - wrongQuestions.length) / Math.max(1, paper.questions.length)) * 100);
  const weakPoints = wrongQuestions.length
    ? Array.from(new Set(wrongQuestions.map((question) => question.knowledge_point)))
    : ["综合迁移输出"];

  return {
    wrongQuestions,
    result: {
      record_id: null,
      paper_id: paper.paper_id,
      overall_score: score,
      evaluation_type: "diagnostic",
      mastery_level: score >= 85 ? "掌握稳定" : score >= 60 ? "持续提升" : "需要强化",
      report_summary:
        score >= 85
          ? "本轮短测表现稳定，可以进入下一阶段综合应用训练。"
          : "本轮短测已完成，建议优先回看薄弱知识点，并用错因复盘巩固。",
      strengths: score >= 85 ? ["基础概念理解清晰", "答题节奏稳定"] : ["已完成阶段诊断"],
      weak_points: weakPoints,
    suggestions: ["回看错题对应讲义", "补一组同类练习", "把薄弱点带到岗位实训导师继续追问"],
      layered_results: [
        { level: "概念理解", score, status: score >= 70 ? "done" : "active", comment: "根据本轮选择题表现估算。" },
        { level: "案例应用", score: Math.max(0, score - 8), status: score >= 80 ? "done" : "active", comment: "建议结合课程案例继续验证。" },
      ],
      metrics: [
        { metric_name: "准确率", score, comment: "按 5 题短测即时计算。" },
        { metric_name: "薄弱点覆盖", score: Math.max(60, 100 - wrongQuestions.length * 12), comment: "用于驱动后续资源推荐。" },
      ],
      knowledge_points: Array.from(new Set(paper.questions.map((question) => question.knowledge_point))).slice(0, 5),
    recommended_actions: ["查看错题复盘", "生成薄弱点练习", "带着测评结果追问岗位实训导师"],
      path_feedback: {},
      profile_feedback: {},
    },
  };
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
  return trend?.course_code || history[0]?.course_code || "软件工程";
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

type EvaluationFlowStep = {
  title: string;
  description: string;
  status: "done" | "active" | "pending";
};

type EvaluationStateCache = {
  savedAt: number;
  historyItems: EvaluationHistoryItem[];
  trend: EvaluationTrendResponse | null;
  profileSummary: ProfileSummaryResponse | null;
  latestPlan: LearningPlanResponse | null;
};

function EvaluationFlowCard({ steps }: { steps: EvaluationFlowStep[] }) {
  return (
    <div className="relative grid gap-2 md:grid-cols-4">
      <div className="eval-status-rail absolute left-4 right-4 top-[27px] hidden h-1 rounded-full bg-[#ffe1eb] md:block">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,#fb7299,#0ea5e9,#10b981)]" style={{ width: `${Math.max(16, (steps.filter((step) => step.status === "done").length / Math.max(steps.length, 1)) * 100)}%` }} />
      </div>
      {steps.map((step, index) => (
        <div
          key={step.title}
          className={`eval-card-hover relative rounded-[20px] border px-3 py-3 ${
            step.status === "done"
              ? "border-emerald-200 bg-emerald-50"
              : step.status === "active"
                ? "border-[#f3cddd] bg-[#fff4f8] shadow-[0_16px_34px_rgba(251,114,153,0.12)]"
                : "border-[#e8edf2] bg-white/86"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                step.status === "done"
                  ? "bg-emerald-600 text-white"
                  : step.status === "active"
                    ? "bg-[#fb7299] text-white"
                    : "bg-[#f2f4f7] text-[#667085]"
              }`}
            >
              {index + 1}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                step.status === "done"
                  ? "bg-white text-emerald-700"
                  : step.status === "active"
                    ? "bg-white text-[#d64d7b]"
                    : "bg-[#f7fafb] text-[#667085]"
              }`}
            >
              {step.status === "done" ? "已完成" : step.status === "active" ? "进行中" : "待完成"}
            </span>
          </div>
          <div className="mt-3 text-sm font-black text-[#171c22]">{step.title}</div>
          <p className="mt-1 text-xs leading-5 text-[#5b6770]">{step.description}</p>
        </div>
      ))}
    </div>
  );
}

function EvaluationSyncItem({
  icon: Icon,
  title,
  detail,
  ready,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  ready: boolean;
}) {
  return (
    <div className="eval-card-hover rounded-[20px] border border-[#e8edf2] bg-white/88 px-4 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.03)]">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${ready ? "bg-[#ecfdf3] text-emerald-700" : "bg-[#f7fafb] text-[#667085]"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-black text-[#171c22]">{title}</div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ready ? "bg-[#ecfdf3] text-emerald-700" : "bg-[#f7fafb] text-[#667085]"}`}>
              {ready ? "已接入" : "待接入"}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#5b6770]">{detail}</p>
        </div>
      </div>
    </div>
  );
}

export default function Evaluation() {
  const activeUserId = getCurrentLoggedInUserId();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const rawCourseKey = searchParams.get("courseId") || ACTIVE_COURSE_KEY;
  const selectedCourse =
    COURSE_OPTIONS.find(
      (item) =>
        item.key === rawCourseKey ||
        item.routeCourseId === rawCourseKey ||
        (item.key === ACTIVE_COURSE_KEY && rawCourseKey === "series-2"),
    ) ?? null;
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
  const [questionGenerationElapsed, setQuestionGenerationElapsed] = useState(0);
  const [customQuestionBankText, setCustomQuestionBankText] = useState("");
  const [showManualImportPanel, setShowManualImportPanel] = useState(false);
  const [customQuizPaper, setCustomQuizPaper] = useState<QuizPaper | null>(null);
  const [customQuizAnswers, setCustomQuizAnswers] = useState<Record<string, string | string[]>>({});
  const [customQuizSummary, setCustomQuizSummary] = useState<ReturnType<typeof scoreQuiz> | null>(null);
  const [customQuizSafetyReview, setCustomQuizSafetyReview] = useState<Record<string, unknown> | null>(null);
  const [customQuizHallucinationReview, setCustomQuizHallucinationReview] = useState<Record<string, unknown> | null>(null);
  const [customQuizSource, setCustomQuizSource] = useState<"ai" | "fallback" | "cache" | "import">("import");
  const [currentPaperQuestionIndex, setCurrentPaperQuestionIndex] = useState(0);
  const [currentCustomQuestionIndex, setCurrentCustomQuestionIndex] = useState(0);
  const questionGenerationRunRef = useRef(0);
  const evaluationLoadRunRef = useRef(0);
  const paperWorkspaceRef = useRef<HTMLElement | null>(null);

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
  const mistakeDiagnoses = useMemo(() => wrongQuestions.map((item) => buildMistakeDiagnosis(item)), [wrongQuestions]);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 2600);
  };

  const scrollToPaperWorkspace = () => {
    window.requestAnimationFrame(() => {
      paperWorkspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    if (!questionGenerationLoading) {
      setQuestionGenerationElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setQuestionGenerationElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [questionGenerationLoading]);

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

  const applyStableQuestionBank = (reason = "已切换到稳定题库", invalidatePending = true) => {
    if (invalidatePending) {
      questionGenerationRunRef.current += 1;
    }
    const focusPoints = questionSourceText.trim()
      ? [questionSourceText.trim().slice(0, 60)]
      : trend?.focus_knowledge_points?.filter(Boolean)?.slice(0, 3) || [];
    const stablePaper = buildStableQuizPaper(activeCourse?.title || "当前课程", focusPoints);
    setCustomQuestionBankText(buildGeneratedQuestionBankText(stablePaper));
    setCustomQuizPaper(stablePaper);
    setCustomQuizAnswers({});
    setCustomQuizSummary(null);
    setCustomQuizSafetyReview(null);
    setCustomQuizHallucinationReview(null);
    setCustomQuizSource("fallback");
    setCurrentCustomQuestionIndex(0);
    setShowManualImportPanel(false);
    setQuestionGenerationLoading(false);
    showToast(reason);
  };

  const openSeededQuestionBank = async (knowledgePoint = SEEDED_QUESTION_BANKS[0].label) => {
    if (!numericCourseId) {
      showToast("请先选择课程，再打开题库。");
      return;
    }

    setQuestionGenerationLoading(true);
    setError("");
    setQuestionSourceText(`题库分类：${knowledgePoint}`);
    const professionalCourseContext = [
      `请生成计算机专业短测题，知识点限定为「${knowledgePoint}」。`,
      "题目必须落到具体技术场景，例如 Java/Python/C 语言代码片段、数组/链表/栈/队列/哈希表、时间复杂度、数据库索引、进程线程或内存模型。",
      "避免产品经理、项目管理、页面配色、需求沟通等泛软件工程题；每题要有明确正确答案和专业解析。",
    ].join("\n");
    const runId = questionGenerationRunRef.current + 1;
    questionGenerationRunRef.current = runId;
    try {
      const generated = await Promise.race([
        studentApi.generateEvaluationQuestions({
          test_id: numericCourseId,
          knowledge_points: [knowledgePoint],
          difficulty_level: 2,
          question_type: 1,
          count: 5,
          generate_layered: false,
          course_context: professionalCourseContext,
          persist_to_db: true,
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("question-bank-timeout")), 5200);
        }),
      ]);

      if (runId !== questionGenerationRunRef.current) {
        return;
      }

      const parsed = parseQuizPaper(
        JSON.stringify({
          title: `${activeCourse?.title || "当前课程"} · ${knowledgePoint}题库`,
          questions: generated.questions,
        }),
      );

      if (!parsed?.questions.length) {
        throw new Error("题库读取成功，但前端解析失败");
      }

      setCustomQuestionBankText(buildGeneratedQuestionBankText(parsed));
      setCustomQuizPaper(parsed);
      setCustomQuizAnswers({});
      setCustomQuizSummary(null);
      setCustomQuizSafetyReview(generated.safety_review || null);
      setCustomQuizHallucinationReview(generated.hallucination_review || null);
      setCustomQuizSource(generated.source === "fallback" ? "fallback" : generated.source === "cache" ? "cache" : "ai");
      setCurrentCustomQuestionIndex(0);
      setShowManualImportPanel(false);
      showToast(`已打开「${knowledgePoint}」题库，共 ${parsed.questions.length} 题。`);
    } catch (questionBankError) {
      if (runId !== questionGenerationRunRef.current) {
        return;
      }
      if (questionBankError instanceof Error && questionBankError.message === "question-bank-timeout") {
        applyStableQuestionBank(`题库读取超过 5 秒，已先打开「${knowledgePoint}」稳定练习。`, false);
        setError("");
        return;
      }
      const message = questionBankError instanceof Error ? questionBankError.message : "题库读取失败";
      setError(message);
      showToast(message);
    } finally {
      if (runId === questionGenerationRunRef.current) {
        setQuestionGenerationLoading(false);
      }
    }
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
    const professionalCourseContext = [
      "请基于下面内容生成计算机专业短测题。",
      "题目要具体到数据结构、算法复杂度、编程语言语法、数据库索引/事务、操作系统进程线程等可考知识点。",
      "优先出现代码片段、输入输出、数据结构操作或复杂度判断；不要生成泛化项目管理、产品设计、页面体验类题目。",
      questionSourceText.trim(),
    ].join("\n\n");
    const runId = questionGenerationRunRef.current + 1;
    questionGenerationRunRef.current = runId;
    try {
      const generated = await Promise.race([
        studentApi.generateEvaluationQuestions({
          test_id: numericCourseId,
          knowledge_points: [questionSourceText.trim().slice(0, 60)],
          difficulty_level: 2,
          question_type: 1,
          count: 5,
          generate_layered: false,
          course_context: professionalCourseContext.slice(0, 1800),
          persist_to_db: true,
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("question-generation-timeout")), 5200);
        }),
      ]);

      if (runId !== questionGenerationRunRef.current) {
        return;
      }

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
      if (runId !== questionGenerationRunRef.current) {
        return;
      }
      if (generationError instanceof Error && generationError.message === "question-generation-timeout") {
        applyStableQuestionBank("AI 出题超过 5 秒，已先切换到稳定练习题。", false);
        setError("");
        return;
      }
      const message = generationError instanceof Error ? generationError.message : "AI 出题失败，请稍后重试";
      setError(message);
      showToast(message);
    } finally {
      if (runId === questionGenerationRunRef.current) {
        setQuestionGenerationLoading(false);
      }
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

    const runId = ++evaluationLoadRunRef.current;
    const cachedState = readEvaluationStateCache(activeUserId, numericCourseId);
    if (cachedState) {
      setHistoryItems(cachedState.historyItems || []);
      setTrend(cachedState.trend || null);
      setProfileSummary(cachedState.profileSummary || null);
      setLatestPlan(cachedState.latestPlan || null);
    }

    setLoading(!cachedState);
    setError("");
    try {
      const [historyResult, trendResult, profileResult, planResult] = await Promise.all([
        withEvaluationTimeout(
          studentApi.getEvaluationHistory(activeUserId, numericCourseId),
          { items: cachedState?.historyItems || [], total: cachedState?.historyItems?.length || 0 },
        ),
        withEvaluationTimeout(studentApi.getEvaluationTrend(activeUserId, numericCourseId), cachedState?.trend || null),
        withEvaluationTimeout(studentApi.getProfileSummary(activeUserId), cachedState?.profileSummary || null),
        withEvaluationTimeout(studentApi.getLatestLearningPlan(activeUserId, numericCourseId), cachedState?.latestPlan || null),
      ]);

      if (runId !== evaluationLoadRunRef.current) return;

      const nextHistoryItems = historyResult?.items || [];
      const nextTrend = trendResult || null;
      const nextProfileSummary = profileResult || null;
      const nextLatestPlan = planResult || null;

      setHistoryItems(nextHistoryItems);
      setTrend(nextTrend);
      setProfileSummary(nextProfileSummary);
      setLatestPlan(nextLatestPlan);
      writeEvaluationStateCache(activeUserId, numericCourseId, {
        historyItems: nextHistoryItems,
        trend: nextTrend,
        profileSummary: nextProfileSummary,
        latestPlan: nextLatestPlan,
      });
    } catch (loadError) {
      if (runId !== evaluationLoadRunRef.current) return;
      setError(loadError instanceof Error ? loadError.message : "测评数据加载失败");
    } finally {
      if (runId === evaluationLoadRunRef.current) {
        setLoading(false);
      }
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

    setPaperLoading(false);
    setError("");
    const paper = buildFallbackEvaluationPaper(
      activeUserId,
      courseCode,
      activeCourse.title,
      trend?.focus_knowledge_points?.filter(Boolean)?.slice(0, 5) || [],
    );
    setActivePaper(paper);
    setAnswers({});
    setCurrentPaperQuestionIndex(0);
    setLatestResult(null);
    setWrongQuestions([]);
    setFeedbackApplied(null);
    setRefreshedPlan(null);
    setGeneratedResources([]);
    setTutorFollowup(null);
    showToast("短测已打开，可直接作答。");
    scrollToPaperWorkspace();
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

  const formatQuizAnswer = (question: QuizQuestion, rawAnswer: string | string[] | undefined) => {
    const answerList = Array.isArray(rawAnswer) ? rawAnswer : normalizeAnswerList(rawAnswer || "");
    if (!answerList.length) return "未作答";
    return answerList
      .map((answer) => {
        const normalizedAnswer = normalizeOptionKey(answer);
        const matchedOption = question.options.find((option) => normalizeOptionKey(option) === normalizedAnswer);
        return matchedOption || answer;
      })
      .join(" / ");
  };

  const buildCustomQuizTutorQuestion = (question: QuizQuestion, index: number) => {
    const userAnswer = formatQuizAnswer(question, customQuizAnswers[question.id]);
    const correctAnswer = formatQuizAnswer(question, question.answer);
    return [
      `请完整讲解这道计算机短测题，帮我理解为什么正确答案是这样。`,
      `题目 ${index + 1}：${question.question}`,
      question.options.length ? `选项：${question.options.join("；")}` : "",
      `我的答案：${userAnswer}`,
      `正确答案：${correctAnswer}`,
      question.explanation ? `页面解析：${question.explanation}` : "",
      `请按“考点 -> 解题思路 -> 选项排除 -> 易错点 -> 类似题练习建议”的结构回答。`,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const buildPaperTutorQuestion = (question: EvaluationPaperQuestion, index: number) => {
    const userAnswer = normalizeAnswerToken(answers[question.question_id] || "") || "未作答";
    const correctAnswer = normalizeAnswerToken(question.correct_answer) || question.correct_answer;
    return [
      `请完整讲解这道阶段短测题，帮我把知识点真正弄懂。`,
      `题目 ${index + 1}：${question.prompt}`,
      question.options.length ? `选项：${question.options.join("；")}` : "",
      `我的答案：${userAnswer}`,
      `正确答案：${correctAnswer}`,
      question.explanation ? `页面解析：${question.explanation}` : "",
      `请按“考点 -> 解题思路 -> 为什么其他选项不对 -> 易错点 -> 下一步练习”的结构回答。`,
    ]
      .filter(Boolean)
      .join("\n");
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
      if ((activePaper.source || activePaper.questions[0]?.source) === "fallback") {
        const fallback = buildFallbackEvaluationResult(activePaper, answers);
        setLatestResult(fallback.result);
        recordTrialFlowCompletion({
          courseId: String(rawCourseKey),
          jobRole: searchParams.get("role") || "前端开发工程师",
          stageId: Number(searchParams.get("stageId") || "1"),
          evaluationRecordId: fallback.result.record_id ? String(fallback.result.record_id) : undefined,
        });
        setWrongQuestions(fallback.wrongQuestions);
        setFeedbackApplied(null);
        setRefreshedPlan(null);
        setGeneratedResources([]);
        setTutorFollowup(null);
        showToast("测评结果已生成。");
        return;
      }

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
      recordTrialFlowCompletion({
        courseId: String(rawCourseKey),
        jobRole: searchParams.get("role") || "前端开发工程师",
        stageId: Number(searchParams.get("stageId") || "1"),
        evaluationRecordId: result.record_id ? String(result.record_id) : undefined,
      });

      const localWrongQuestions = buildWrongQuestionsFromPaper(activePaper, answers);
      if (result.record_id) {
        const wrongQuestionResult = await studentApi
          .getWrongQuestions(result.record_id)
          .catch(() => ({ items: [], total: 0 }));
        setWrongQuestions(wrongQuestionResult.items.length ? wrongQuestionResult.items : localWrongQuestions);
      } else {
        setWrongQuestions(localWrongQuestions);
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
      <div key={question.question_id} className="eval-question-card rounded-[26px] border border-[#f2d9e3] bg-white/92 p-5 shadow-[0_18px_42px_rgba(251,114,153,0.08)]">
        <div className="eval-status-rail mb-4 h-1.5 overflow-hidden rounded-full bg-[#ffe3ec]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#fb7299,#ff9db8,#0ea5e9)] transition-all"
            style={{ width: `${((index + 1) / Math.max(activePaper?.questions.length || 1, 1)) * 100}%` }}
          />
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#fb7299] px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_8px_18px_rgba(251,114,153,0.24)]">第 {index + 1} 题</span>
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
                        ? "eval-option-selected border-[#fb7299] bg-[linear-gradient(135deg,#fb7299,#d64d7b)] text-white"
                        : "border-[#f0d6df] bg-[#fffafb] text-[#344054] hover:-translate-y-0.5 hover:border-[#fb7299] hover:bg-white hover:shadow-[0_12px_26px_rgba(251,114,153,0.10)]"
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
                ? "border-[#fb7299] bg-[#fb7299] text-white shadow-[0_10px_20px_rgba(251,114,153,0.24)]"
                : answered
                  ? "border-[#fbcfe8] bg-[#fff1f6] text-[#d6336c]"
                  : "border-[#e5e7eb] bg-white text-[#667085] hover:border-[#fb7299] hover:text-[#d64d7b]"
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
                            ? "eval-option-selected border-[#fb7299] bg-[linear-gradient(135deg,#fb7299,#d64d7b)] text-white"
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
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="font-black">{isCorrect ? "本题答对了" : "本题需要复盘"}</p>
                <p className="mt-1">你的答案：{formatQuizAnswer(question, selected)}</p>
                {question.questionType !== "short" ? <p>正确答案：{formatQuizAnswer(question, question.answer) || "暂无"}</p> : null}
                {question.explanation ? <p className="mt-1">完整解析：{question.explanation}</p> : null}
              </div>
              <button
                type="button"
                onClick={() =>
                  openTutorPanel({
                    courseId: activeCourse?.routeCourseId,
                    query: buildCustomQuizTutorQuestion(question, index),
                  })
                }
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white/85 px-4 py-2.5 text-xs font-black text-[#344054] ring-1 ring-black/8 transition hover:bg-white"
              >
                <Bot className="h-4 w-4" />
                追问 AI 讲解本题
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const evaluationCount = trend?.total || historyItems.length || 0;
  const hasEvaluationSnapshot = Boolean(evaluationCount || trend || profileSummary || latestPlan);
  const latestScoreLabel = trend?.latest_score ? `${Math.round(trend.latest_score)}%` : "暂无";
  const focusPointLabel = trend?.focus_knowledge_points?.[0] || latestResult?.weak_points?.[0] || "完成短测后自动识别";
  const evaluationStageLabel = activePaper
    ? latestResult
      ? "结果已生成，可回写报告与画像"
      : "正在作答本轮短测"
    : activeCourse
      ? "可开始本轮阶段诊断"
      : "请选择课程";
  const nextEvaluationAction = latestResult
    ? "查看报告或追问岗位实训导师"
    : activePaper
      ? "完成剩余题目并提交"
      : "开始 5 题短测";
  const weakPointList = latestResult?.weak_points?.length
    ? latestResult.weak_points
    : trend?.focus_knowledge_points?.length
      ? trend.focus_knowledge_points
      : wrongQuestions.map((item) => item.knowledge_point).filter(Boolean);
  const diagnosisSteps: EvaluationFlowStep[] = [
    {
      title: "读取画像",
      description: profileSummary ? `${profileSummary.current_stage || "当前阶段"}，画像完整度 ${Math.round(profileSummary.completeness || 0)}%` : "加载学生画像和学习偏好",
      status: profileSummary ? "done" : activeCourse ? "active" : "pending",
    },
    {
      title: "完成短测",
      description: activePaper ? `已生成 ${activePaper.questions.length} 道题，已作答 ${selectedAnswerCount} 道` : "生成 5 题阶段诊断",
      status: latestResult ? "done" : activePaper ? "active" : "pending",
    },
    {
      title: "生成诊断",
      description: latestResult ? `${Math.round(latestResult.overall_score)}%，${latestResult.mastery_level || "已完成诊断"}` : "提交后识别得分、掌握度和薄弱点",
      status: latestResult ? "done" : submitting ? "active" : "pending",
    },
    {
      title: "回写闭环",
      description: feedbackApplied || refreshedPlan || generatedResources.length ? "画像、路径、资源和导师建议已联动" : "把结果同步给后续学习动作",
      status: feedbackApplied || refreshedPlan || generatedResources.length || tutorFollowup ? "done" : latestResult ? "active" : "pending",
    },
  ];
  const profileSyncDetail = feedbackApplied?.summary || profileSummary?.recommended_learning_style || profileSummary?.current_stage || "测评结果会作为画像更新证据";
  const planSyncDetail = refreshedPlan?.next_action || latestPlan?.next_action || "提交后会按薄弱点刷新下一阶段学习路径";
  const resourceSyncDetail = generatedResources.length
    ? `已补充 ${generatedResources.length} 份讲义、练习或导图`
    : "提交后会按薄弱点补齐讲义、练习和导图";
  const tutorSyncDetail = tutorFollowup?.answer || "提交后可直接带着测评结果继续追问岗位实训导师";
  const completedJobStage = searchParams.get("completed") === "true" && searchParams.get("source") === "job-stage-task";
  const completedRole = searchParams.get("role") || "当前岗位";
  const completedStageId = searchParams.get("stageId") || "1";

  return (
    <div className="eval-product mx-auto max-w-[1320px] select-none space-y-6 px-1" id="evaluation-workspace">
      {completedJobStage ? (
        <section aria-label="岗位任务完成回执" className="flex flex-col gap-3 rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-black">岗位阶段任务已完成并回到测评</div>
            <p className="mt-1 text-sm">{completedRole} · 阶段 {completedStageId} 的产出记录已保存，可以开始本轮阶段短测。</p>
          </div>
          <button type="button" onClick={() => document.getElementById("evaluation-workspace")?.scrollIntoView({ behavior: "smooth" })} className="shrink-0 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white">开始阶段测评</button>
        </section>
      ) : null}
      <section className="eval-hero rounded-[24px] border border-[#e8edf2] bg-white/94 p-4 shadow-[0_16px_44px_rgba(15,23,42,0.06)] md:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#e8edf2] bg-[#f7fafb] px-3 py-1 text-xs font-bold text-[#475467]">
                <CheckCircle className="h-3.5 w-3.5 text-[#e4002b]" />
                学习评估
              </span>
              <span className="rounded-full border border-[#ffd6de] bg-[#fff7fa] px-3 py-1 text-xs font-bold text-[#e4002b]">
                软件工程诊断
              </span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px]">
              <div className="min-w-0">
                <h1 className="text-2xl font-black tracking-[-0.03em] text-[#171c22] md:text-3xl">
                  阶段短测与学习闭环
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5b6770]">
                  完成 5 题短测后，系统会同步更新画像、路径、资源和岗位实训导师上下文。
                </p>
              </div>
              <div className="grid grid-cols-3 overflow-hidden rounded-[18px] border border-[#e8edf2] bg-[#fbfcfd]">
                {[
                  { label: "最近得分", value: latestScoreLabel },
                  { label: "测评次数", value: evaluationCount },
                  { label: "当前重点", value: focusPointLabel },
                ].map((item) => (
                  <div key={item.label} className="min-w-0 border-r border-[#e8edf2] px-3 py-3 last:border-r-0">
                    <div className="text-[11px] font-bold text-[#8a96a3]">{item.label}</div>
                    <div className="mt-1 truncate text-sm font-black text-[#171c22]">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              {diagnosisSteps.map((step, index) => (
                <div
                  key={step.title}
                  className={`rounded-[16px] border px-3 py-2.5 ${
                    step.status === "done"
                      ? "border-[#bbf7d0] bg-[#f0fdf4]"
                      : step.status === "active"
                        ? "border-[#ffd6de] bg-[#fff7fa]"
                        : "border-[#e8edf2] bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black text-[#98a2b3]">{String(index + 1).padStart(2, "0")}</span>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        step.status === "done" ? "bg-emerald-500" : step.status === "active" ? "bg-[#e4002b]" : "bg-[#cbd5e1]"
                      }`}
                    />
                  </div>
                  <div className="mt-2 text-sm font-black text-[#171c22]">{step.title}</div>
                  <div className="mt-1 line-clamp-1 text-xs leading-5 text-[#667085] md:line-clamp-2">{step.description}</div>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[22px] border border-[#e8edf2] bg-[#fbfcfd] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[#8a96a3]">本轮任务</div>
                <div className="mt-1 text-xl font-black text-[#171c22]">5 题短测</div>
              </div>
              <span className="rounded-full bg-[#ecfdf3] px-2.5 py-1 text-[11px] font-bold text-emerald-700">可开始</span>
            </div>
            <button
              type="button"
              onClick={() => void handleStartPaper()}
              disabled={paperLoading || !activeCourse}
              className="eval-primary-button mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#e4002b] px-4 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(228,0,43,0.18)] transition hover:bg-[#c90025] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {paperLoading ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  正在生成试卷
                </>
              ) : (
                <>
                  开始短测
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[16px] border border-[#e8edf2] bg-white px-3 py-2">
                <div className="text-[11px] font-bold text-[#8a96a3]">预计用时</div>
                <div className="mt-1 text-sm font-black text-[#171c22]">约 2 分钟</div>
              </div>
              <div className="rounded-[16px] border border-[#e8edf2] bg-white px-3 py-2">
                <div className="text-[11px] font-bold text-[#8a96a3]">最近记录</div>
                <div className="mt-1 truncate text-sm font-black text-[#171c22]">
                  {latestHistory?.created_at ? formatDate(latestHistory.created_at) : "暂无"}
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-[16px] border border-[#ffd6de] bg-white px-3 py-3 text-xs leading-5 text-[#5b6770]">
              下一步：{nextEvaluationAction}
            </div>
          </aside>
        </div>
      </section>

      {activeCourse ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <div className="rounded-[30px] border border-[#e8edf2] bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.05)] md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#f7fafb] px-3 py-1 text-[10px] font-black text-[#667085]">
                  <BarChart3 className="h-3.5 w-3.5" />
                  评估趋势
                </div>
                <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-[#171c22]">最近测评表现</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b6770]">
                  趋势用于判断当前阶段是继续推进，还是先回到薄弱点复习。
                </p>
              </div>
              <span className="rounded-full bg-[#fff4f8] px-3 py-1.5 text-xs font-bold text-[#d64d7b]">
                {courseCode}
              </span>
            </div>
            <Suspense fallback={<div className="mt-4 h-[260px] rounded-[24px] bg-[#f7fafb]" />}>
              <LineBarChartPanel option={trendChartOption} height={280} className="mt-4" />
            </Suspense>
          </div>

          <div className="rounded-[30px] border border-[#e8edf2] bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.05)] md:p-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff4f8] px-3 py-1 text-[10px] font-black text-[#d64d7b]">
              <Network className="h-3.5 w-3.5" />
              薄弱点诊断
            </div>
            <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-[#171c22]">理解、应用、迁移三个维度一起看</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(weakPointList.length ? weakPointList.slice(0, 5) : ["完成短测后更新"]).map((point) => (
                <span key={point} className="rounded-full bg-[#f7fafb] px-3 py-1 text-xs font-bold text-[#5b6770]">
                  {normalizeKnowledgePointLabel(point)}
                </span>
              ))}
            </div>
            <Suspense fallback={<div className="mt-4 h-[260px] rounded-[24px] bg-[#f7fafb]" />}>
              <HeatmapChartPanel option={weaknessHeatmapOption} height={280} className="mt-4" />
            </Suspense>
          </div>
        </section>
      ) : null}

      {activeCourse ? (
        <section className="rounded-[30px] border border-[#e8edf2] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_16px_42px_rgba(15,23,42,0.05)] md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-black text-[#006689] ring-1 ring-[#dce7f4]">
                <Sparkles className="h-3.5 w-3.5" />
                测评闭环
              </div>
              <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-[#171c22]">测评结果会回写到后续学习动作</h2>
              <p className="mt-1 text-sm leading-6 text-[#5b6770]">提交本轮短测后，页面会同步生成画像更新、路径调整、补充资源和岗位实训导师建议。</p>
            </div>
            {latestResult ? (
              <span className="rounded-full bg-[#ecfdf3] px-3 py-1.5 text-xs font-bold text-emerald-700">
                本轮闭环已触发
              </span>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <EvaluationSyncItem icon={CheckCircle} title="画像更新" detail={profileSyncDetail} ready={Boolean(feedbackApplied || profileSummary)} />
            <EvaluationSyncItem icon={Network} title="路径调整" detail={planSyncDetail} ready={Boolean(refreshedPlan || latestPlan)} />
            <EvaluationSyncItem icon={FileText} title="资源补给" detail={resourceSyncDetail} ready={generatedResources.length > 0} />
            <EvaluationSyncItem icon={Bot} title="导师接续" detail={tutorSyncDetail} ready={Boolean(tutorFollowup)} />
          </div>
        </section>
      ) : null}

      <section className="rounded-[30px] border border-[#e8edf2] bg-white p-6 shadow-[0_16px_42px_rgba(15,23,42,0.05)] md:p-7">
        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-[24px] border border-[#e8edf2] bg-[#fbfcfd] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a96a3]">题库分类</p>
            <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-[#171c22]">按知识点直接刷题</h2>
            <p className="mt-2 text-sm leading-6 text-[#5b6770]">
              主流程用上方 5 题短测快速诊断；这里直接进入计算机核心题库，适合反复练习薄弱点。
            </p>
            <div className="mt-4 space-y-2">
              {SEEDED_QUESTION_BANKS.map((bank) => (
                <button
                  key={bank.label}
                  type="button"
                  onClick={() => void openSeededQuestionBank(bank.label)}
                  disabled={questionGenerationLoading}
                  className="flex w-full items-center justify-between rounded-[14px] border border-[#e8edf2] bg-white px-3 py-2 text-left text-xs font-bold text-[#344054] transition hover:border-[#e4002b] hover:text-[#e4002b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>{bank.label}</span>
                  <span className="text-[#8a96a3]">{bank.count}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="rounded-[24px] border border-[#e8edf2] bg-white p-5 md:p-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a96a3]">计算机专业题库</p>
                <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#171c22]">已预置 25 道核心知识短测</h3>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-[#5b6770]">
                  题库覆盖数据结构、Java 基础、算法复杂度、数据库索引和操作系统。点击分类即可从数据库题库取题作答。
                </p>
              </div>
              <div className="grid grid-cols-2 overflow-hidden rounded-[16px] border border-[#e8edf2] bg-[#f7f7f8] lg:grid-cols-1">
                <div className="border-r border-[#e8edf2] px-4 py-3 lg:border-b lg:border-r-0">
                  <div className="text-[11px] font-bold text-[#8a96a3]">题库总量</div>
                  <div className="mt-1 text-2xl font-black text-[#171c22]">25</div>
                </div>
                <div className="px-4 py-3">
                  <div className="text-[11px] font-bold text-[#8a96a3]">分类数量</div>
                  <div className="mt-1 text-2xl font-black text-[#171c22]">{SEEDED_QUESTION_BANKS.length}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-5">
              {SEEDED_QUESTION_BANKS.map((bank) => (
                <button
                  key={bank.label}
                  type="button"
                  onClick={() => void openSeededQuestionBank(bank.label)}
                  disabled={questionGenerationLoading}
                  className="group rounded-[14px] border border-[#d6dee8] bg-white px-3 py-3 text-left transition hover:border-[#e4002b] hover:bg-[#f7f7f8] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-[#171c22] group-hover:text-[#e4002b]">{bank.label}</span>
                    <span className="rounded-full bg-[#f7f7f8] px-2 py-0.5 text-[10px] font-bold text-[#667085]">{bank.count} 题</span>
                  </div>
                  <div className="mt-2 text-[11px] font-bold text-[#8a96a3]">刷这组题</div>
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-[18px] border border-[#e8edf2] bg-[#f7f7f8] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-black text-[#171c22]">快速开始</div>
                <p className="mt-1 text-xs leading-5 text-[#667085]">默认打开“数据结构：栈与队列”题库；需要新题时再使用下方 AI 补题。</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void openSeededQuestionBank()}
                  disabled={questionGenerationLoading}
                  className="eval-primary-button inline-flex items-center justify-center rounded-[14px] bg-[#e4002b] px-5 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(228,0,43,0.18)] transition hover:bg-[#c90025] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {questionGenerationLoading ? `读取中 ${questionGenerationElapsed}s` : "开始刷题库"}
                </button>
                <button
                  type="button"
                  onClick={() => applyStableQuestionBank("已打开稳定练习。")}
                  className="rounded-[14px] border border-[#d6dee8] bg-white px-4 py-3 text-sm font-bold text-[#344054] transition hover:border-[#171c22]"
                >
                  本地稳定题
                </button>
              </div>
            </div>

            <details className="mt-3 rounded-[18px] border border-[#e8edf2] bg-white px-4 py-3">
              <summary className="cursor-pointer text-sm font-black text-[#171c22]">AI 补题</summary>
              <div className="mt-3 rounded-[14px] border border-[#e8edf2] bg-[#fbfcfd] p-3">
                <textarea
                  value={questionSourceText}
                  onChange={(event) => setQuestionSourceText(event.target.value)}
                  placeholder="例如：请围绕 Java 数组、栈和队列、时间复杂度、HashMap 或数据库索引生成 5 道计算机专业短测题，题目要有明确代码/数据结构场景。"
                  className="min-h-[108px] w-full resize-none rounded-[12px] border border-[#d6dee8] bg-white px-4 py-3 text-sm leading-7 text-[#344054] outline-none transition placeholder:text-[#98a2b3] focus:border-[#e4002b]"
                />
                <div className="mt-3 flex flex-col gap-2 text-xs leading-6 text-[#667085] sm:flex-row sm:items-center sm:justify-between">
                  <p>AI 补题会优先生成代码、数据结构和复杂度类题目；超过 5 秒自动切到稳定练习。</p>
                  <p className="font-semibold text-[#e4002b]">{questionSourceText.trim().length} 字</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGenerateQuestionBank()}
                  disabled={questionGenerationLoading}
                  className="mt-3 inline-flex items-center justify-center rounded-[12px] bg-[#171c22] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#2b323b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {questionGenerationLoading ? `补题中 ${questionGenerationElapsed}s` : "生成新题"}
                </button>
              </div>
            </details>

            <div className="mt-3 flex flex-col gap-2 rounded-[18px] border border-[#e8edf2] bg-[#f7f7f8] px-4 py-3 text-xs leading-6 text-[#5b6770] sm:flex-row sm:items-center sm:justify-between">
              <div>
                {questionGenerationLoading ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 font-bold text-[#e4002b]">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  <span>正在读取专业题库或生成新题，已等待 {questionGenerationElapsed}s；超过 5 秒会先给稳定练习</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {[
                        { label: "查题库缓存", active: true },
                        { label: "AI 生成专业题", active: questionGenerationElapsed >= 2 },
                        { label: "稳定练习兜底", active: questionGenerationElapsed >= 5 },
                      ].map((step) => (
                        <div key={step.label} className={`rounded-xl border px-3 py-2 ${step.active ? "border-[#e4002b] bg-white text-[#171c22]" : "border-[#edf1f5] bg-white/70"}`}>
                          {step.label}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <span>题库会优先复用数据库缓存；AI 响应慢时自动切到本地计算机专业稳定题，保证可以马上开始做题。</span>
                )}
              </div>
            </div>
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
                <p className="text-[11px] font-bold text-[#8a96a3]">章节题库测验</p>
                <h3 className="mt-2 text-lg font-extrabold text-[#171c22]">{customQuizPaper.title || "章节题库测验"}</h3>
                <p className="mt-1 text-sm text-[#5b6770]">
                  {customQuizSource === "ai"
                    ? "这套题库由真实 AI 根据课程内容生成，可直接按单题模式开始作答。"
                    : customQuizSource === "fallback"
                      ? "当前为稳定专项练习，题目围绕真实项目场景组织，可直接作答。"
                      : customQuizSource === "cache"
                        ? `已从题库复用 ${customQuizPaper.questions.length} 道题，没有再次消耗 AI。`
                        : `已导入 ${customQuizPaper.questions.length} 道题，可直接按单题模式在线作答。`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#5b6770] ring-1 ring-[#e8edf2]">
                  已作答 {customSelectedAnswerCount}/{customQuizPaper.questions.length}
                </div>
                <div className="rounded-full bg-[#fff2f7] px-3 py-1.5 text-xs font-bold text-[#d64d7b]">
                  {customQuizSource === "ai" ? "真实 AI 生成" : customQuizSource === "fallback" ? "稳定题库" : customQuizSource === "cache" ? "题库复用" : "手动导入"}
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
                       className="eval-primary-button rounded-2xl bg-[#fb7299] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(251,114,153,0.22)] transition hover:bg-[#f95c89] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      提交判分
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {customQuizSummary ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-[24px] border border-[#f3d1dc] bg-[linear-gradient(135deg,#fff7fa,#ffffff)] px-5 py-4 text-sm font-semibold text-[#5b6770]">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-[11px] font-black text-[#d64d7b]">判题完成</div>
                      <div className="mt-1 text-2xl font-black text-[#171c22]">
                        {customQuizSummary.correct}/{customQuizSummary.total}，正确率 {customQuizSummary.percent}%
                      </div>
                      {customQuizSummary.weakKnowledgeTags.length ? (
                        <p className="mt-1 text-xs leading-5 text-[#667085]">重点回看：{customQuizSummary.weakKnowledgeTags.join(" / ")}</p>
                      ) : (
                        <p className="mt-1 text-xs leading-5 text-[#667085]">本轮表现稳定，可以继续挑战更高难度题。</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openTutorPanel({
                          courseId: activeCourse?.routeCourseId,
                          query: `我刚完成「${customQuizPaper.title || "章节题库测验"}」，得分 ${customQuizSummary.correct}/${customQuizSummary.total}。请根据错题和知识点给我一份下一步刷题建议。`,
                        })
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#171c22] px-4 py-3 text-sm font-black text-white transition hover:bg-[#2b323b]"
                    >
                      <Bot className="h-4 w-4" />
                      问 AI 制定巩固计划
                    </button>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#e8edf2] bg-[#fcfcfd] p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[11px] font-black text-[#8a96a3]">完整解答</p>
                      <h4 className="mt-1 text-lg font-black text-[#171c22]">逐题答案、解析与 AI 追问</h4>
                    </div>
                    <p className="text-xs font-semibold text-[#667085]">点击任意题可继续让 AI 拆解考点</p>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {customQuizPaper.questions.map((question, index) => {
                      const scoreItem = customQuizSummary.wrongQuestions.find((item) => item.questionId === question.id);
                      const solved = !scoreItem;
                      return (
                        <article key={`solution-${question.id}`} className="rounded-[20px] border border-[#e8edf2] bg-white p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${solved ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                                  {solved ? "正确" : "需复盘"}
                                </span>
                                <span className="rounded-full bg-[#f8fafc] px-2.5 py-1 text-[11px] font-bold text-[#667085]">
                                  第 {index + 1} 题
                                </span>
                                {question.knowledgeTag ? (
                                  <span className="rounded-full bg-[#fff2f7] px-2.5 py-1 text-[11px] font-bold text-[#d64d7b]">
                                    {normalizeKnowledgePointLabel(question.knowledgeTag)}
                                  </span>
                                ) : null}
                              </div>
                              <h5 className="mt-3 text-sm font-black leading-7 text-[#171c22]">{question.question}</h5>
                              <div className="mt-3 grid gap-2 text-xs leading-6 text-[#5b6770] md:grid-cols-2">
                                <div className="rounded-2xl bg-[#f8fafc] px-3 py-2">
                                  <span className="font-black text-[#344054]">你的答案：</span>
                                  {formatQuizAnswer(question, customQuizAnswers[question.id])}
                                </div>
                                <div className="rounded-2xl bg-[#ecfdf3] px-3 py-2 text-emerald-800">
                                  <span className="font-black">正确答案：</span>
                                  {formatQuizAnswer(question, question.answer)}
                                </div>
                              </div>
                              {question.explanation ? (
                                <p className="mt-3 rounded-2xl bg-[#fff7fa] px-3 py-2 text-xs font-semibold leading-6 text-[#8a405d]">
                                  解析：{question.explanation}
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                openTutorPanel({
                                  courseId: activeCourse?.routeCourseId,
                                  query: buildCustomQuizTutorQuestion(question, index),
                                })
                              }
                              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-[#e8edf2] bg-white px-4 py-3 text-sm font-black text-[#344054] transition hover:border-[#fb7299] hover:text-[#d64d7b]"
                            >
                              <Bot className="h-4 w-4" />
                              追问 AI
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {activeCourse && loading && !hasEvaluationSnapshot ? (
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

      {activeCourse && activePaper ? (
        <section ref={paperWorkspaceRef} className="rounded-[30px] border border-[#e8edf2] bg-white p-6 shadow-[0_16px_42px_rgba(15,23,42,0.05)] md:p-7">
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
                              {(activePaper.source || activePaper.questions[0]?.source) === "fallback" ? "稳定短测" : "真实 AI 生成"}
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
                          className="eval-primary-button rounded-2xl bg-[#fb7299] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(251,114,153,0.22)] transition hover:bg-[#f95c89] disabled:cursor-not-allowed disabled:opacity-70"
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
                  <div className="rounded-[28px] border border-emerald-200 bg-[linear-gradient(135deg,#f3fff8,#ffffff)] px-5 py-5 shadow-[0_14px_34px_rgba(16,185,129,0.08)]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-emerald-700">本轮诊断结果</p>
                        <h3 className="mt-2 text-4xl font-black tracking-[-0.04em] text-[#171c22]">{formatPercent(latestResult.overall_score)}</h3>
                        <p className="mt-2 text-sm font-semibold text-[#5b6770]">当前状态：{latestResult.mastery_level || "已完成本轮测评"}</p>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5b6770]">
                          {latestResult.report_summary || "本轮结果已生成，可以继续看报告或追问岗位实训导师。"}
                        </p>
                      </div>
                      <div className="grid min-w-[260px] grid-cols-3 gap-2">
                        <div className="rounded-2xl bg-white px-3 py-3 text-center ring-1 ring-emerald-100">
                          <div className="text-[10px] font-bold text-[#667085]">错题</div>
                          <div className="mt-1 text-xl font-black text-[#171c22]">{wrongQuestions.length}</div>
                        </div>
                        <div className="rounded-2xl bg-white px-3 py-3 text-center ring-1 ring-emerald-100">
                          <div className="text-[10px] font-bold text-[#667085]">补资源</div>
                          <div className="mt-1 text-xl font-black text-[#171c22]">{generatedResources.length}</div>
                        </div>
                        <div className="rounded-2xl bg-white px-3 py-3 text-center ring-1 ring-emerald-100">
                          <div className="text-[10px] font-bold text-[#667085]">薄弱点</div>
                          <div className="mt-1 text-xl font-black text-[#171c22]">{latestResult.weak_points?.length || 0}</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-col gap-3 border-t border-emerald-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-black text-[#171c22]">愿意帮助我们改进这套产品吗？</div>
                        <p className="mt-1 text-xs leading-5 text-[#667085]">填写约 3 分钟，仅收集本人真实体验；反馈提交后会生成匿名回执。</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/trial-feedback?${new URLSearchParams({
                          courseId: String(rawCourseKey),
                          role: searchParams.get("role") || "前端开发工程师",
                          stageId: searchParams.get("stageId") || "1",
                          source: "evaluation-complete",
                        }).toString()}`)}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800"
                      >
                        提交试用反馈
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="rounded-[24px] border border-[#e8edf2] bg-white p-4">
                      <div className="text-[11px] font-black text-[#8a96a3]">建议优先补</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(latestResult.weak_points?.length ? latestResult.weak_points : ["继续保持当前节奏"]).slice(0, 4).map((point) => (
                          <span key={point} className="rounded-full bg-[#fff4f8] px-3 py-1 text-xs font-bold text-[#d64d7b]">
                            {normalizeKnowledgePointLabel(point)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-[#e8edf2] bg-white p-4">
                      <div className="text-[11px] font-black text-[#8a96a3]">路径下一步</div>
                      <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-[#344054]">
                        {refreshedPlan?.next_action || latestPlan?.next_action || latestResult.recommended_actions?.[0] || "查看报告后继续推进下一阶段任务。"}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-[#e8edf2] bg-white p-4">
                            <div className="text-[11px] font-black text-[#8a96a3]">岗位实训导师摘要</div>
                      <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-[#344054]">
                              {tutorFollowup?.answer || "点击“问岗位实训导师”后，会带着本轮得分和薄弱点继续追问。"}
                      </p>
                    </div>
                  </div>

                  {mistakeDiagnoses.length ? (
                    <section className="rounded-[28px] border border-[#ffd5e3] bg-[linear-gradient(135deg,#fff7fa,#ffffff_48%,#f5fbff)] p-5 shadow-[0_16px_36px_rgba(251,114,153,0.09)]">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-[11px] font-black text-[#d64d7b]">错题智能诊断</p>
                          <h4 className="mt-1 text-xl font-black text-[#171c22]">不只判对错，直接定位错因并补 3 道同类变式题</h4>
                        </div>
                        <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-[#d64d7b] ring-1 ring-[#ffd5e3]">
                          {mistakeDiagnoses.length} 个错因待修复
                        </span>
                      </div>

                      <div className="mt-4 grid gap-4">
                        {mistakeDiagnoses.map((diagnosis, diagnosisIndex) => (
                          <article
                            key={`mistake-diagnosis-${diagnosis.wrongQuestion.question_id}-${diagnosisIndex}`}
                            className="rounded-[24px] border border-[#eef2f6] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-full px-3 py-1 text-[11px] font-black ${
                                      diagnosis.causeId === "concept"
                                        ? "bg-[#eff6ff] text-[#1d4ed8]"
                                        : diagnosis.causeId === "step"
                                          ? "bg-[#fff7ed] text-[#c2410c]"
                                          : diagnosis.causeId === "reading"
                                            ? "bg-[#fff1f2] text-[#be123c]"
                                            : "bg-[#ecfdf3] text-[#047857]"
                                    }`}
                                  >
                                    {diagnosis.causeLabel}
                                  </span>
                                  <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[11px] font-bold text-[#667085]">
                                    {normalizeKnowledgePointLabel(diagnosis.wrongQuestion.knowledge_point)}
                                  </span>
                                  <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[11px] font-bold text-[#667085]">
                                    第 {diagnosisIndex + 1} 个错题
                                  </span>
                                </div>
                                <h5 className="mt-3 text-sm font-black leading-7 text-[#171c22]">{diagnosis.wrongQuestion.prompt}</h5>
                                <div className="mt-3 grid gap-2 text-xs leading-6 text-[#5b6770] md:grid-cols-2">
                                  <div className="rounded-2xl bg-[#fff7fa] px-3 py-2">
                                    <span className="font-black text-[#8a405d]">错因判断：</span>
                                    {diagnosis.causeDetail}
                                  </div>
                                  <div className="rounded-2xl bg-[#f8fafc] px-3 py-2">
                                    <span className="font-black text-[#344054]">诊断依据：</span>
                                    {diagnosis.evidence}
                                  </div>
                                </div>
                                <p className="mt-2 rounded-2xl bg-[#ecfdf3] px-3 py-2 text-xs font-semibold leading-6 text-emerald-800">
                                  原题解析：{diagnosis.wrongQuestion.explanation || "建议重新梳理题干条件和选项排除过程。"}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 rounded-[20px] border border-[#e8edf2] bg-[#fbfdff] p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-black text-[#171c22]">同类变式题</div>
                                <div className="text-[11px] font-bold text-[#667085]">做完这 3 题，验证是否真正修复错因</div>
                              </div>
                              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                                {diagnosis.variantQuestions.map((variant) => (
                                  <div key={`${diagnosis.wrongQuestion.question_id}-${variant.title}`} className="rounded-[18px] border border-[#e8edf2] bg-white p-3">
                                    <div className="text-[11px] font-black text-[#d64d7b]">{variant.title}</div>
                                    <p className="mt-2 text-xs font-black leading-6 text-[#171c22]">{variant.prompt}</p>
                                    <div className="mt-2 space-y-1">
                                      {variant.options.map((option) => (
                                        <div key={option} className="rounded-xl bg-[#f8fafc] px-2.5 py-1.5 text-[11px] font-semibold leading-5 text-[#5b6770]">
                                          {option}
                                        </div>
                                      ))}
                                    </div>
                                    <div className="mt-2 rounded-xl bg-[#ecfdf3] px-2.5 py-1.5 text-[11px] font-bold leading-5 text-emerald-800">
                                      答案：{variant.answer}。{variant.explanation}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <section className="rounded-[28px] border border-[#e8edf2] bg-[#fcfcfd] p-5">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[11px] font-black text-[#8a96a3]">完整解答</p>
                        <h4 className="mt-1 text-lg font-black text-[#171c22]">本轮 5 题逐题复盘</h4>
                      </div>
                              <p className="text-xs font-semibold text-[#667085]">每题都可以继续追问岗位实训导师</p>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {activePaper.questions.map((question, index) => {
                        const userAnswer = normalizeAnswerToken(answers[question.question_id] || "");
                        const correctAnswer = normalizeAnswerToken(question.correct_answer);
                        const solved = userAnswer === correctAnswer;
                        const matchedWrong = wrongQuestions.find((item) => item.question_id === question.question_id);
                        return (
                          <article key={`paper-solution-${question.question_id}`} className="rounded-[20px] border border-[#e8edf2] bg-white p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${solved ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                                    {solved ? "正确" : "需复盘"}
                                  </span>
                                  <span className="rounded-full bg-[#f8fafc] px-2.5 py-1 text-[11px] font-bold text-[#667085]">
                                    第 {index + 1} 题
                                  </span>
                                  <span className="rounded-full bg-[#fff2f7] px-2.5 py-1 text-[11px] font-bold text-[#d64d7b]">
                                    {normalizeKnowledgePointLabel(question.knowledge_point)}
                                  </span>
                                </div>
                                <h5 className="mt-3 text-sm font-black leading-7 text-[#171c22]">{question.prompt}</h5>
                                <div className="mt-3 grid gap-2 text-xs leading-6 text-[#5b6770] md:grid-cols-2">
                                  <div className="rounded-2xl bg-[#f8fafc] px-3 py-2">
                                    <span className="font-black text-[#344054]">你的答案：</span>
                                    {userAnswer || "未作答"}
                                  </div>
                                  <div className="rounded-2xl bg-[#ecfdf3] px-3 py-2 text-emerald-800">
                                    <span className="font-black">正确答案：</span>
                                    {correctAnswer || question.correct_answer}
                                  </div>
                                </div>
                                <p className="mt-3 rounded-2xl bg-[#fff7fa] px-3 py-2 text-xs font-semibold leading-6 text-[#8a405d]">
                                  解析：{matchedWrong?.explanation || question.explanation || "这道题建议结合课程知识点重新梳理解题过程。"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  openTutorPanel({
                                    courseId: activeCourse.routeCourseId,
                                    query: buildPaperTutorQuestion(question, index),
                                  })
                                }
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-[#e8edf2] bg-white px-4 py-3 text-sm font-black text-[#344054] transition hover:border-[#fb7299] hover:text-[#d64d7b]"
                              >
                                <Bot className="h-4 w-4" />
                                追问 AI
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => navigate(`/report?courseId=${activeCourse.routeCourseId}`)}
                      className="eval-primary-button flex items-center justify-center gap-2 rounded-2xl bg-[#fb7299] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(251,114,153,0.22)] transition hover:bg-[#f95c89]"
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
                            问岗位实训导师
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
