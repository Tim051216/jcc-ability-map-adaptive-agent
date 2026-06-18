/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  PlayCircle,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { COURSES, LEARNING_PATHS } from "../constants";
import {
  studentApi,
  type GoalPathItem,
  type GoalPathResponse,
  type LearningPlanResponse,
  type LearningPlanStage,
  type LearningPlanStep,
  type LevelRecommendationResponse,
  type PlanProgressResponse,
  type ReviewPlanResponse,
} from "../lib/studentApi";
import {
  formatGoalDeadline,
  getDefaultGoalDeadline,
  getGoalAvailableDays,
  loadLearningGoal,
  saveLearningGoal,
  type StoredLearningGoal,
} from "../lib/learningGoal";
import { resolveBackendCourseId } from "../lib/courseRouting";
import { getCurrentLoggedInUserId } from "../lib/currentUser";
import { SESSION_STORAGE_KEY, PERSISTENT_SESSION_STORAGE_KEY } from "../App";

type UiStep = {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  type: "video" | "code" | "reading" | "quiz";
  completed: boolean;
  status: "locked" | "unlocked" | "current";
  note?: string | null;
  updatedAt?: string | null;
};

type UiPhase = {
  id: string;
  title: string;
  summary: string;
  progress: number;
  steps: UiStep[];
};

type PlanAgentCard = {
  key: string;
  title: string;
  detail: string;
  status: "completed" | "running" | "standby";
  icon: typeof Bot;
};

type StageCardCopy = {
  summary: string;
  focusTitle: string;
  nextTitle: string;
  nextDetail: string;
};

const PATH_PAGE_LABELS: Record<string, { title: string; subtitle: string }> = {
  "series-1": {
    title: "设计系统个性化学习方案",
    subtitle: "围绕设计规范、组件落地与页面协同，生成更适合你当前阶段的学习安排",
  },
  "series-2": {
    title: "软件工程个性化学习方案",
    subtitle: "围绕需求分析、系统设计、实现测试与项目推进，生成阶段化学习路径",
  },
  "series-3": {
    title: "界面动效个性化学习方案",
    subtitle: "围绕微交互、转场节奏与体验细节，生成更适合你的学习推进顺序",
  },
  "course-4": {
    title: "数据可视化个性化学习方案",
    subtitle: "围绕数据叙事、图表表达与项目输出，生成更具体的学习安排",
  },
};

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

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "0%";
  return `${Math.round(value)}%`;
}

function isMostlyEnglish(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return false;
  const asciiLetters = (text.match(/[A-Za-z]/g) || []).length;
  return asciiLetters >= Math.max(8, text.length * 0.25);
}

const PLAN_TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bClarify Goal\b/g, "目标对齐"],
  [/\bCore Practice\b/g, "专题强化"],
  [/\bReview And Next Step\b/g, "复盘与下一步"],
  [/\bDiagnostic\b/g, "诊断定位"],
  [/\bFocused Practice\b/g, "专题强化"],
  [/\bConsolidation\b/g, "巩固迁移"],
  [/\bConfirm the immediate learning target\b/g, "确认当前最优先的学习目标"],
  [/\bConfirm one immediate target\b/g, "先确认一个当前目标"],
  [/\bSet a concrete short-term target\b/g, "先设定一个明确的短期目标"],
  [/\bComplete one focused practice block\b/g, "完成一段聚焦练习"],
  [/\bWork through the main concept and one exercise\b/g, "围绕核心知识点完成一轮学习与练习"],
  [/\bSummarize what changed and decide what to do next\b/g, "做一次简短复盘，并决定接下来学什么"],
  [/\bWrite a quick review and decide the next move\b/g, "写一条复盘，并确定下一步"],
  [/\bContinue completing this stage task\b./g, "继续完成这一阶段任务。"],
  [/\bContinue completing this stage task\b/g, "继续完成这一阶段任务"],
];

function localizePlanCopy(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return "";
  return PLAN_TEXT_REPLACEMENTS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

function isGenericPlanText(value?: string | null) {
  const text = localizePlanCopy(value).trim();
  if (!text) return true;
  return [
    /^步骤\s*\d+$/u,
    /^第\s*\d+\s*天任务$/u,
    /^阶段\s*\d+$/u,
    /^学习任务\s*\d+$/u,
    /^继续完成这一阶段任务。?$/u,
    /^围绕当前阶段重点推进。?$/u,
    /^完成后形成一条可以复盘的学习结果。?$/u,
  ].some((pattern) => pattern.test(text));
}

function summarizeKnowledgePoints(points?: string[] | null, fallback = "当前课程重点") {
  const cleaned = (points || []).map((item) => localizePlanCopy(item).trim()).filter(Boolean);
  if (!cleaned.length) return fallback;
  return cleaned.slice(0, 2).join(" / ");
}

function buildSpecificTaskTitle(step: LearningPlanStep, index: number) {
  const focusText = summarizeKnowledgePoints(step.knowledge_points, "");
  if (focusText) return `学习任务 ${index + 1}：${focusText}`;

  const objectiveText = localizePlanCopy(step.objective || step.expected_outcome || step.step_description).trim();
  if (objectiveText) return `学习任务 ${index + 1}：${objectiveText.slice(0, 22)}`;

  const taskText = step.tasks?.map((item) => localizePlanCopy(item).trim()).find(Boolean);
  if (taskText) return `学习任务 ${index + 1}：${taskText.slice(0, 22)}`;

  return `学习任务 ${index + 1}`;
}

function buildSpecificTaskSubtitle(step: LearningPlanStep) {
  const objectiveText = localizePlanCopy(step.objective || step.expected_outcome || step.step_description).trim();
  if (objectiveText) return objectiveText;

  const pointsText = summarizeKnowledgePoints(step.knowledge_points, "");
  if (pointsText) return `这一步重点处理 ${pointsText}，完成后再进入下一项内容。`;

  if (step.tasks?.length) {
    return step.tasks.map((item) => localizePlanCopy(item).trim()).filter(Boolean).slice(0, 2).join("；");
  }

  return "这一步会围绕当前课程的关键知识点继续推进。";
}

function toStepType(value?: string | null): UiStep["type"] {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("video")) return "video";
  if (normalized.includes("quiz") || normalized.includes("assessment")) return "quiz";
  if (normalized.includes("practice") || normalized.includes("code")) return "code";
  return "reading";
}

function localFallbackPhases(routeCourseId: string): UiPhase[] {
  const fallbackMap: Record<string, UiPhase[]> = {
    "series-1": [
      {
        id: "design-system-phase-1",
        title: "阶段 1：设计规范与页面骨架",
        summary: "先把页面结构、栅格和组件命名规则统一起来，避免后面返工。",
        progress: 100,
        steps: [
          {
            id: "design-system-step-1",
            title: "梳理页面层级与组件清单",
            subtitle: "明确导航、卡片、表单、反馈组件的层级与职责边界。",
            duration: "35 分钟",
            type: "reading",
            completed: true,
            status: "unlocked",
          },
          {
            id: "design-system-step-2",
            title: "建立颜色、间距与字体规范",
            subtitle: "把页面主色、字号、圆角、投影整理成可复用设计变量。",
            duration: "30 分钟",
            type: "code",
            completed: true,
            status: "unlocked",
          },
        ],
      },
      {
        id: "design-system-phase-2",
        title: "阶段 2：高频业务组件落地",
        summary: "把按钮、卡片、导航、筛选区做成可复用的真实页面组件。",
        progress: 50,
        steps: [
          {
            id: "design-system-step-3",
            title: "完成业务卡片与列表模板",
            subtitle: "优先统一课程卡片、状态卡片和信息列表，形成一套页面模板。",
            duration: "45 分钟",
            type: "code",
            completed: false,
            status: "current",
          },
          {
            id: "design-system-step-4",
            title: "补齐筛选与空态反馈",
            subtitle: "补全筛选区、空态、加载态和错误态，让页面更完整。",
            duration: "28 分钟",
            type: "reading",
            completed: false,
            status: "locked",
          },
        ],
      },
      {
        id: "design-system-phase-3",
        title: "阶段 3：多页面协同与验收",
        summary: "回看多个页面之间的组件复用与视觉一致性，做最后收口。",
        progress: 0,
        steps: [
          {
            id: "design-system-step-5",
            title: "检查跨页面一致性",
            subtitle: "重点检查导航、标题层级、按钮语义与交互反馈是否统一。",
            duration: "40 分钟",
            type: "quiz",
            completed: false,
            status: "locked",
          },
        ],
      },
    ],
    "series-2": [
      {
        id: "se-phase-1",
        title: "阶段 1：课程主线与问题定位",
        summary: "先把软件工程全流程主线理顺，明确当前这轮最该优先补的知识环节。",
        progress: 100,
        steps: [
          {
            id: "se-step-1",
            title: "梳理软件生命周期主线",
            subtitle: "把需求、设计、实现、测试、维护这些阶段串成一条完整流程，知道当前学到哪一环。",
            duration: "35 分钟",
            type: "reading",
            completed: true,
            status: "unlocked",
          },
        ],
      },
      {
        id: "se-phase-2",
        title: "阶段 2：需求与系统设计强化",
        summary: "围绕需求分析、总体设计和模块划分做一轮针对性强化，补齐当前最关键的理解短板。",
        progress: 45,
        steps: [
          {
            id: "se-step-2",
            title: "拆解需求规格与用例",
            subtitle: "围绕一个案例补清功能需求、非功能需求和核心用例之间的关系。",
            duration: "40 分钟",
            type: "reading",
            completed: false,
            status: "current",
          },
          {
            id: "se-step-3",
            title: "画出系统模块结构图",
            subtitle: "根据课程内容梳理模块职责、接口关系和系统边界，形成更稳定的设计理解。",
            duration: "45 分钟",
            type: "code",
            completed: false,
            status: "locked",
          },
        ],
      },
      {
        id: "se-phase-3",
        title: "阶段 3：实现测试与迁移应用",
        summary: "把设计思路继续推进到实现与测试，再回到项目场景做一次迁移和复盘。",
        progress: 0,
        steps: [
          {
            id: "se-step-4",
            title: "补出测试计划与质量检查点",
            subtitle: "围绕当前案例整理测试目标、测试方法、风险点和验收标准。",
            duration: "38 分钟",
            type: "quiz",
            completed: false,
            status: "locked",
          },
        ],
      },
    ],
    "series-3": [
      {
        id: "motion-phase-1",
        title: "阶段 1：动效节奏与反馈基础",
        summary: "先建立微交互的节奏感，知道什么时候该动、动多少。",
        progress: 100,
        steps: [
          {
            id: "motion-step-1",
            title: "识别按钮与卡片反馈层级",
            subtitle: "先区分点击反馈、悬停反馈和页面转场这三类动效职责。",
            duration: "25 分钟",
            type: "reading",
            completed: true,
            status: "unlocked",
          },
        ],
      },
      {
        id: "motion-phase-2",
        title: "阶段 2：页面转场与元素进出",
        summary: "把进入、退出、位移动效做到自然，不抢信息主体。",
        progress: 40,
        steps: [
          {
            id: "motion-step-2",
            title: "完成列表与弹窗进出动画",
            subtitle: "重点练习透明度、位移、缩放的组合节奏控制。",
            duration: "38 分钟",
            type: "video",
            completed: false,
            status: "current",
          },
          {
            id: "motion-step-3",
            title: "统一页面转场速度",
            subtitle: "把多个页面切换速度和缓动曲线统一成同一体验语言。",
            duration: "22 分钟",
            type: "code",
            completed: false,
            status: "locked",
          },
        ],
      },
      {
        id: "motion-phase-3",
        title: "阶段 3：可访问性与性能收口",
        summary: "确保动效不仅好看，还能兼顾可访问性和设备性能。",
        progress: 0,
        steps: [
          {
            id: "motion-step-4",
            title: "补齐减少动态模式与降级方案",
            subtitle: "为动效较重的模块准备可访问性和低性能设备降级策略。",
            duration: "35 分钟",
            type: "quiz",
            completed: false,
            status: "locked",
          },
        ],
      },
    ],
    "course-4": [
      {
        id: "d3-phase-1",
        title: "阶段 1：数据映射与图表框架",
        summary: "先完成数据到视觉编码的映射，不急着堆复杂动效。",
        progress: 100,
        steps: [
          {
            id: "d3-step-1",
            title: "建立比例尺与坐标轴",
            subtitle: "先把数据字段与视觉位置对应好，保证图表读得清楚。",
            duration: "32 分钟",
            type: "reading",
            completed: true,
            status: "unlocked",
          },
        ],
      },
      {
        id: "d3-phase-2",
        title: "阶段 2：叙事层级与重点突出",
        summary: "把重点数据、说明文案和图表层级组织成一条清晰的阅读路径。",
        progress: 45,
        steps: [
          {
            id: "d3-step-2",
            title: "完成重点数据高亮与注释",
            subtitle: "通过颜色、标签和注释引导用户先看到最关键的结论。",
            duration: "40 分钟",
            type: "code",
            completed: false,
            status: "current",
          },
          {
            id: "d3-step-3",
            title: "补充图表切换过渡",
            subtitle: "让不同数据视图之间的切换更顺滑，避免跳变打断理解。",
            duration: "30 分钟",
            type: "video",
            completed: false,
            status: "locked",
          },
        ],
      },
      {
        id: "d3-phase-3",
        title: "阶段 3：故事化页面收口",
        summary: "把图表、标题和说明区整理成完整的数据叙事页面。",
        progress: 0,
        steps: [
          {
            id: "d3-step-4",
            title: "检查故事线与图表一致性",
            subtitle: "确认标题、注释、色彩重点和最终结论是否在讲同一件事。",
            duration: "36 分钟",
            type: "quiz",
            completed: false,
            status: "locked",
          },
        ],
      },
    ],
  };

  return fallbackMap[routeCourseId] || fallbackMap["series-2"];
}

function buildPhaseTitle(stage: LearningPlanStage, index: number) {
  return localizePlanCopy(stage.stage_name) || `阶段 ${index + 1}`;
}

function resolveStageId(stage: LearningPlanStage, index: number) {
  return stage.stage_id || stage.stage_name || `stage-${stage.stage_no || index + 1}`;
}

function resolveStepStageId(step: LearningPlanStep, index: number) {
  return step.stage_id || step.stage_name || `stage-${step.stage_no || index + 1}`;
}

function resolveStepTitle(step: LearningPlanStep, index: number) {
  const resolved = localizePlanCopy(step.step_title || step.title);
  return isGenericPlanText(resolved) ? buildSpecificTaskTitle(step, index) : resolved;
}

function resolveStepSubtitle(step: LearningPlanStep) {
  const resolved = step.step_description
    ? localizePlanCopy(step.step_description)
    : step.expected_outcome
      ? localizePlanCopy(step.expected_outcome)
      : step.objective
        ? localizePlanCopy(step.objective)
        : step.tasks?.length
          ? localizePlanCopy(step.tasks.join("；"))
          : "";
  return isGenericPlanText(resolved) ? buildSpecificTaskSubtitle(step) : resolved;
}

function resolveStepDuration(step: LearningPlanStep) {
  return step.estimated_minutes || step.duration_minutes || 20;
}

function resolveStepTypeValue(step: LearningPlanStep) {
  return step.step_type || step.node_type;
}

function resolveStageSummary(stage: LearningPlanStage) {
  return (
    localizePlanCopy(stage.goal || stage.focus || stage.strategy || stage.objective) || "围绕当前薄弱点持续推进。"
  );
}

function getStepStatusLabel(step: UiStep) {
  if (step.completed) return "已完成";
  if (step.status === "current") return "现在就做";
  return "后续安排";
}

function getStepOutcomeCopy(step: UiStep) {
  if (step.type === "code") return "完成后要能交出一份可运行或可对比的结果。";
  if (step.type === "quiz") return "完成后要能形成一条结论或一组检查结果。";
  if (step.type === "video") return "完成后要能讲清这一段内容解决了什么问题。";
  return "完成后要能用自己的话复述重点，并留下可回看的记录。";
}

function getPlanStepHeadline(step: LearningPlanStep) {
  const resolved = localizePlanCopy(step.step_title || step.title);
  if (!isGenericPlanText(resolved)) return resolved;
  return `第 ${step.day} 天：${summarizeKnowledgePoints(step.knowledge_points, "完成一项关键学习任务")}`;
}

function getPlanStepFocus(step: LearningPlanStep) {
  const resolved =
    localizePlanCopy(step.objective || step.expected_outcome || step.step_description) ||
    (step.knowledge_points?.length ? localizePlanCopy(step.knowledge_points.join(" / ")) : "");
  return isGenericPlanText(resolved)
    ? `重点吃透 ${summarizeKnowledgePoints(step.knowledge_points, "当前阶段关键知识点")}。`
    : resolved;
}

function getPlanStepDeliverable(step: LearningPlanStep) {
  const resolved =
    localizePlanCopy(step.checkpoint) ||
    (step.tasks?.length ? localizePlanCopy(step.tasks[step.tasks.length - 1]) : "");
  return isGenericPlanText(resolved)
    ? `产出一份与 ${summarizeKnowledgePoints(step.knowledge_points, "本节重点")} 相关的可复盘结果。`
    : resolved;
}

function getPlanStepStatus(status?: string | null) {
  if (status === "completed") return "已完成";
  if (status === "in_progress") return "今天先做";
  return "接下来做";
}

function containsBrokenPlanText(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return false;
  return text.includes("???") || text.includes("�");
}

function shouldRegeneratePlan(plan: LearningPlanResponse | null, routeCourseId: string) {
  if (!plan) return false;
  const summary = String(plan.summary || "");
  const currentStage = String(plan.current_stage || "");
  const firstStepTitle = String(plan.steps?.[0]?.title || "");
  const joined = [summary, currentStage, firstStepTitle].join(" ");

  if (containsBrokenPlanText(joined)) return true;
  if (routeCourseId === "series-2" && /React|Hooks|Context|Profiler/i.test(joined)) return true;
  if (routeCourseId === "series-2" && /个性化学习路径|学习路径|生成路径/.test(firstStepTitle) && firstStepTitle.length > 22) return true;
  return false;
}

function isFallbackLikePlan(plan: LearningPlanResponse | null, routeCourseId: string) {
  if (!plan) return true;
  const summary = String(plan.summary || "");
  const currentStage = String(plan.current_stage || "");
  const title = String(plan.steps?.[0]?.title || "");
  const joined = `${summary} ${currentStage} ${title}`;

  if (containsBrokenPlanText(joined)) return true;
  if (routeCourseId === "series-2" && /React|Hooks|Context|Profiler|前端高阶/i.test(joined)) return true;
  if ((plan.steps?.length || 0) === 0 || (plan.stages?.length || 0) === 0) return true;
  return false;
}

function getFallbackSummary(routeCourseId: string) {
  if (routeCourseId === "series-2") {
    return "当前先展示与你的软件工程课程主线一致的保底学习方案，真实个性化阶段任务恢复后会自动顶替这份内容。";
  }
  if (routeCourseId === "series-1") {
    return "当前先展示设计系统主线的保底学习方案，真实个性化阶段任务恢复后会自动顶替这份内容。";
  }
  if (routeCourseId === "series-3") {
    return "当前先展示界面动效主线的保底学习方案，真实个性化阶段任务恢复后会自动顶替这份内容。";
  }
  return "当前先展示与你当前课程方向一致的保底学习方案，真实个性化阶段任务恢复后会自动顶替这份内容。";
}

function buildPlanFromPersonalizedData(params: {
  userId: number;
  courseId: number;
  courseName: string;
  goalPath: GoalPathResponse;
  levelRecommendation: LevelRecommendationResponse | null;
}): LearningPlanResponse {
  const { userId, courseId, courseName, goalPath, levelRecommendation } = params;
  const stageNames = ["目标对齐", "专题强化", "巩固迁移"];
  const stageFocuses = [
    goalPath.items[0]?.focus || "明确当前课程主线",
    goalPath.items[1]?.focus || goalPath.items[2]?.focus || "围绕关键知识点完成强化",
    goalPath.items[goalPath.items.length - 1]?.focus || "完成阶段复盘与迁移应用",
  ];

  const stages: LearningPlanStage[] = stageNames.map((stageName, index) => ({
    stage_no: index + 1,
    stage_name: stageName,
    focus: stageFocuses[index],
    objective:
      index === 0
        ? "先对齐这一轮最值得优先推进的学习目标。"
        : index === 1
          ? "围绕当前最关键的知识点完成一轮集中强化。"
          : "完成复盘总结，并明确接下来继续补什么。",
    estimated_days: index === 1 ? Math.max(1, goalPath.items.length - 2) : 1,
    status: index === 0 ? "in_progress" : "pending",
    recommended_resource_types: ["lecture_notes", "practice_set", "mind_map"],
    completion_criteria:
      index === 0
        ? ["明确本轮主攻主题", "确定当前阶段要先补哪一块"]
        : index === 1
          ? ["完成至少一轮针对性练习", "留下结构化学习产出"]
          : ["完成阶段总结", "确定下一步学习动作"],
  }));

  const steps: LearningPlanStep[] = goalPath.items.map((item, index) => {
    const stage_no = index === 0 ? 1 : index === goalPath.items.length - 1 ? 3 : 2;
    return {
      step_id: `goal-path-day-${item.day}`,
      day: item.day,
      title: `第 ${item.day} 天：${item.title}`,
      objective: item.focus,
      tasks: [item.task],
      checkpoint: item.deliverable,
      stage_no,
      stage_name: stageNames[stage_no - 1],
      node_type: "path_node",
      status: index === 0 ? "in_progress" : "pending",
      duration_minutes: 35,
      weak_point_focus: item.focus ? [item.focus] : [],
      knowledge_points: [item.focus, item.title].filter(Boolean),
      recommended_resource_types: ["lecture_notes", "practice_set", "mind_map"],
      resource_pushes: [],
    };
  });

  const activeLevel = levelRecommendation?.items?.find((item) => item.level === levelRecommendation?.active_level);
  return {
    plan_id: null,
    user_id: userId,
    course_code: String(courseId),
    course_id: courseId,
    course_name: courseName,
    summary: goalPath.goal_subtitle,
    progress_hint: activeLevel?.description || "系统会结合你的画像、课程进度和薄弱点继续微调路径。",
    next_action: steps[0]?.title || "先完成当前阶段的首个关键任务。",
    risk_alerts: [],
    path_mode: "laddered",
    current_stage: stages[0]?.focus,
    completion_rate: 0,
    dynamic_adjustments: [
      "这份方案已经结合当前画像与课程阶段生成，后续会随你的完成情况继续调整。",
    ],
    recommended_checkpoints: [
      "先完成今天最优先的一项任务。",
      "做完后回看当天产出，再决定是否进入下一步。",
    ],
    stages,
    steps,
  };
}

function resolveBestPlan(params: {
  routeCourseId: string;
  latestPlan: LearningPlanResponse | null;
  goalPath: GoalPathResponse | null;
  levelRecommendation: LevelRecommendationResponse | null;
  activeUserId: number;
  numericCourseId: number;
  courseName: string;
}) {
  const { routeCourseId, latestPlan, goalPath, levelRecommendation, activeUserId, numericCourseId, courseName } = params;
  const firstStepTitle = String(latestPlan?.steps?.[0]?.title || latestPlan?.steps?.[0]?.step_title || "");
  const planLooksTooGeneric =
    !latestPlan ||
    /等待系统生成|确认当前最优先的学习目标|生成学习路径|个性化学习路径/i.test(firstStepTitle) ||
    (goalPath?.items?.length ? (latestPlan?.steps?.length || 0) < goalPath.items.length : false);
  const latestPlanLooksBroken =
    planLooksTooGeneric || shouldRegeneratePlan(latestPlan, routeCourseId) || isFallbackLikePlan(latestPlan, routeCourseId);

  if (!latestPlanLooksBroken && latestPlan) {
    return latestPlan;
  }

  if (goalPath) {
    return buildPlanFromPersonalizedData({
      userId: activeUserId,
      courseId: numericCourseId,
      courseName,
      goalPath,
      levelRecommendation,
    });
  }

  return latestPlan;
}

function getStageCardCopy(routeCourseId: string, phase: UiPhase, currentStep?: UiStep | null): StageCardCopy {
  if (routeCourseId === "series-2") {
    if (phase.title.includes("目标对齐")) {
      return {
        summary: "先把软件工程这门课的主线、章节关系和本轮目标对齐，明确这一轮到底先补哪一块。",
        focusTitle: "第1天：梳理课程主线",
        nextTitle: "第1天：梳理课程主线",
        nextDetail: "把软件生命周期、过程模型和章节关系串起来，先知道这门课在解决什么问题。",
      };
    }
    if (phase.title.includes("专题强化")) {
      return {
        summary: "围绕需求分析与用例建模做一轮专题强化，不只记概念，还要能落到具体案例。",
        focusTitle: "第2天：强化需求分析",
        nextTitle: "第2天：强化需求分析",
        nextDetail: "围绕一个案例拆出功能需求、非功能需求和核心用例，形成可复述的需求清单。",
      };
    }
    if (phase.title.includes("巩固迁移")) {
      return {
        summary: "回到设计理解与模块协作，检查自己能不能把需求继续推进到结构设计与接口配合。",
        focusTitle: "第3天：推进设计理解",
        nextTitle: "第3天：推进设计理解",
        nextDetail: "把模块划分、接口协作和结构图串起来，形成一版可以讲清楚的设计方案。",
      };
    }
  }

  return {
    summary: phase.summary,
    focusTitle: currentStep?.title || "先完成当前阶段的第一项任务",
    nextTitle: currentStep?.title || "先完成当前阶段的第一项任务",
    nextDetail: currentStep?.subtitle || "系统会根据当前阶段继续补充可执行任务。",
  };
}

function getGoalForCurrentCourse(goal: StoredLearningGoal | null, routeCourseId: string) {
  if (!goal) return null;
  return goal.courseId === routeCourseId ? goal : null;
}

function buildDailyPlanItemsFromPhases(phases: UiPhase[]): GoalPathItem[] {
  return phases
    .flatMap((phase, phaseIndex) =>
      phase.steps.map((step, stepIndex) => ({
        day: phaseIndex + stepIndex + 1,
        title: step.title.replace(/^第\s*\d+\s*天[:：]\s*/u, ""),
        focus: step.subtitle || phase.summary || "围绕当前阶段重点继续推进。",
        task: step.subtitle || `先完成 ${phase.title} 的当前关键任务，并留下可复盘结果。`,
        deliverable: getStepOutcomeCopy(step),
      })),
    )
    .slice(0, 7);
}

function buildPlanAgentCards(params: {
  loading: boolean;
  generating: boolean;
  refreshing: boolean;
  usingFallback: boolean;
  plan: LearningPlanResponse | null;
  phases: UiPhase[];
}) {
  const { loading, generating, refreshing, usingFallback, plan, phases } = params;
  const phaseCount = phases.length;
  const stepCount = phases.reduce((sum, phase) => sum + phase.steps.length, 0);
  const activeStatus: PlanAgentCard["status"] =
    loading || generating || refreshing ? "running" : "completed";

  return [
    {
      key: "profile_agent",
      title: "学习画像智能体",
      detail: usingFallback
        ? "当前使用本地画像输入兜底，保证路径页可持续浏览"
        : `已读取当前学习状态与用户画像${plan?.current_stage ? `，识别当前处于${plan.current_stage}` : ""}`,
      status: activeStatus,
      icon: Bot,
    },
    {
      key: "knowledge_tutoring_agent",
      title: "知识检索智能体",
      detail: usingFallback
        ? "真实资料检索暂不可用，当前使用本地路径模板说明"
        : `已结合画像偏好、课程重点和薄弱点，为当前路径补充 ${phaseCount} 个阶段的任务依据`,
      status: activeStatus,
      icon: BookOpen,
    },
    {
      key: "learning_planning_agent",
      title: "路径规划智能体",
      detail: plan
        ? `已基于用户画像、目标和进度生成 ${stepCount} 个个性化学习步骤`
        : "根据用户画像、目标、天数和每日时长生成阶段化任务清单",
      status: activeStatus,
      icon: Target,
    },
    {
      key: "evaluation_feedback_agent",
      title: "评估反馈智能体",
      detail: usingFallback
        ? "当前只保留进度展示，真实评估回写恢复后会自动补齐"
        : "会根据测评结果与进度完成率持续调整后续任务优先级",
      status: loading ? "standby" : usingFallback ? "standby" : "completed",
      icon: CheckCircle2,
    },
  ];
}

function mapPlanToPhases(plan: LearningPlanResponse, progress: PlanProgressResponse | null): UiPhase[] {
  const progressMap = new Map(progress?.items.map((item) => [item.step_id, item]) || []);
  const stageMap = new Map<string, LearningPlanStep[]>();

  plan.steps.forEach((step, index) => {
    const stageKey = resolveStepStageId(step, index);
    if (!stageMap.has(stageKey)) {
      stageMap.set(stageKey, []);
    }
    stageMap.get(stageKey)?.push(step);
  });

  const phasesFromStages = plan.stages.length
    ? plan.stages.map((stage, stageIndex) => {
        const resolvedStageId = resolveStageId(stage, stageIndex);
        const steps = (stageMap.get(resolvedStageId) || []).map((step, stepIndex) => {
          const resolvedStepId = step.step_id || `${resolvedStageId}-step-${stepIndex + 1}`;
          const item = progressMap.get(resolvedStepId) || (step.step_id ? progressMap.get(step.step_id) : undefined);
          const done = item?.status === "completed";
          return {
            id: resolvedStepId,
            title: resolveStepTitle(step, stepIndex),
            subtitle: resolveStepSubtitle(step),
            duration: `${resolveStepDuration(step)} 分钟`,
            type: toStepType(resolveStepTypeValue(step)),
            completed: done,
            status: done ? "unlocked" : "current",
            note: item?.progress_note || null,
            updatedAt: item?.updated_at || null,
          } satisfies UiStep;
        });
        const completedCount = steps.filter((item) => item.completed).length;
        const total = steps.length || 1;
        return {
          id: resolvedStageId,
          title: buildPhaseTitle(stage, stageIndex),
          summary: resolveStageSummary(stage),
          progress: Math.round((completedCount / total) * 100),
          steps,
        } satisfies UiPhase;
      })
    : [];

  if (phasesFromStages.length > 0) {
    return phasesFromStages.map((phase) => {
      let currentAssigned = false;
      return {
        ...phase,
        steps: phase.steps.map((step) => {
          if (step.completed) return { ...step, status: "unlocked" };
          if (!currentAssigned) {
            currentAssigned = true;
            return { ...step, status: "current" };
          }
          return { ...step, status: "locked" };
        }),
      };
    });
  }

  const flatSteps = plan.steps.map((step, index) => {
    const resolvedStepId = step.step_id || `plan-step-${index + 1}`;
    const item = progressMap.get(resolvedStepId) || (step.step_id ? progressMap.get(step.step_id) : undefined);
    return {
      id: resolvedStepId,
      title: resolveStepTitle(step, index),
      subtitle: resolveStepSubtitle(step),
      duration: `${resolveStepDuration(step)} 分钟`,
      type: toStepType(resolveStepTypeValue(step)),
      completed: item?.status === "completed",
      status: "unlocked" as const,
      note: item?.progress_note || null,
      updatedAt: item?.updated_at || null,
    };
  });

  let currentAssigned = false;
  const normalizedSteps = flatSteps.map((step) => {
    if (step.completed) return { ...step, status: "unlocked" as const };
    if (!currentAssigned) {
      currentAssigned = true;
      return { ...step, status: "current" as const };
    }
    return { ...step, status: "locked" as const };
  });

  return [
    {
      id: "single-stage",
      title: plan.current_stage || "当前学习阶段",
      summary: plan.summary || plan.next_action || "根据画像和测评结果生成的个性化学习路径。",
      progress: Math.round(progress?.completion_rate ?? plan.completion_rate ?? 0),
      steps: normalizedSteps,
    },
  ];
}

export default function LearningPath() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const routeCourseId = searchParams.get("courseId") || "series-2";
  const numericCourseId = resolveBackendCourseId(routeCourseId);
  const activeUserId = getCurrentLoggedInUserId();
  const course = COURSES.find((item) => item.id === routeCourseId) || COURSES[1] || COURSES[0];
  const defaultCourseGoal = `${course.title}：先完成当前课程的核心知识梳理，并输出一份可复用的学习总结`;
  const currentPageLabel = PATH_PAGE_LABELS[routeCourseId]?.title || `${course.title} 个性化学习方案`;

  const [plan, setPlan] = useState<LearningPlanResponse | null>(null);
  const [progress, setProgress] = useState<PlanProgressResponse | null>(null);
  const [phases, setPhases] = useState<UiPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submittingStepId, setSubmittingStepId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [goalPath, setGoalPath] = useState<GoalPathResponse | null>(null);
  const [reviewPlan, setReviewPlan] = useState<ReviewPlanResponse | null>(null);
  const [levelRecommendation, setLevelRecommendation] = useState<LevelRecommendationResponse | null>(null);
  const [personalizedReady, setPersonalizedReady] = useState(false);
  const [learningGoal, setLearningGoal] = useState<StoredLearningGoal | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [dailyPlanExpanded, setDailyPlanExpanded] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [goalDeadlineDraft, setGoalDeadlineDraft] = useState(getDefaultGoalDeadline());
  const [goalDailyMinutesDraft, setGoalDailyMinutesDraft] = useState("45");
  const localizedPlanSummary =
    typeof plan?.summary === "string" && plan.summary.trim() && !isMostlyEnglish(plan.summary)
      ? plan.summary
      : usingFallback
        ? getFallbackSummary(routeCourseId)
        : "这里展示的是系统结合你的用户画像、当前目标、课程阶段与学习进度实时生成的个性化学习方案。";
  const sessionGoalUserId = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw =
        window.sessionStorage.getItem(SESSION_STORAGE_KEY) ||
        window.localStorage.getItem(PERSISTENT_SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { id?: string; loggedIn?: boolean };
      return parsed?.loggedIn && parsed?.id ? String(parsed.id) : null;
    } catch {
      return null;
    }
  }, []);
  const goalUserId = sessionGoalUserId || "401";

  const overallProgress = useMemo(() => {
    if (progress) return Math.round(progress.completion_rate);
    if (plan) return Math.round(plan.completion_rate);
    const total = phases.reduce((sum, phase) => sum + phase.steps.length, 0) || 1;
    const done = phases.reduce((sum, phase) => sum + phase.steps.filter((step) => step.completed).length, 0);
    return Math.round((done / total) * 100);
  }, [phases, plan, progress]);

  const nextStep = useMemo(
    () => phases.flatMap((phase) => phase.steps).find((step) => !step.completed) || null,
    [phases],
  );
  const completedStepCount = useMemo(
    () => phases.reduce((sum, phase) => sum + phase.steps.filter((step) => step.completed).length, 0),
    [phases],
  );
  const totalStepCount = useMemo(
    () => phases.reduce((sum, phase) => sum + phase.steps.length, 0),
    [phases],
  );
  const currentPhaseIndex = useMemo(() => {
    const currentIndex = phases.findIndex((phase) => phase.steps.some((step) => step.status === "current"));
    if (currentIndex >= 0) return currentIndex;
    const unlockedIndex = phases.findIndex((phase) => phase.steps.some((step) => step.status === "unlocked" && !step.completed));
    return unlockedIndex >= 0 ? unlockedIndex : 0;
  }, [phases]);
  const resolvedDailyPlanItems = useMemo(
    () => (goalPath?.items?.length ? goalPath.items : buildDailyPlanItemsFromPhases(phases)),
    [goalPath, phases],
  );
  const planAgentCards = useMemo(
    () =>
      buildPlanAgentCards({
        loading,
        generating,
        refreshing,
        usingFallback,
        plan,
        phases,
      }),
    [generating, loading, phases, plan, refreshing, usingFallback],
  );

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const savedGoal =
      loadLearningGoal(goalUserId) ||
      (goalUserId !== "401" ? loadLearningGoal("401") : null) ||
      null;
    const matchedGoal = getGoalForCurrentCourse(savedGoal, routeCourseId);

    if (matchedGoal) {
      setLearningGoal(matchedGoal);
      setGoalDraft(matchedGoal.goal);
      setGoalDeadlineDraft(matchedGoal.deadline);
      setGoalDailyMinutesDraft(String(matchedGoal.dailyMinutes));
      setGoalModalOpen(false);
      return;
    }
    setLearningGoal(null);
    setGoalDraft("");
    setGoalDeadlineDraft(getDefaultGoalDeadline());
    setGoalDailyMinutesDraft("45");
    setGoalModalOpen(true);
  }, [goalUserId, routeCourseId]);

  useEffect(() => {
    setPlan(null);
    setProgress(null);
    setPhases([]);
    setUsingFallback(false);
    setError(null);
    setLoading(true);
  }, [routeCourseId]);

  const loadPersonalizedSidebar = async () => {
    setPersonalizedReady(false);
    const [latestGoalPath, latestReviewPlan, latestLevelRecommendation] = await Promise.all([
      studentApi.getGoalPath(numericCourseId).catch(() => null),
      studentApi.getReviewPlan(numericCourseId, 0).catch(() => null),
      studentApi.getLevelRecommendation(numericCourseId).catch(() => null),
    ]);
    setGoalPath(latestGoalPath);
    setReviewPlan(latestReviewPlan);
    setLevelRecommendation(latestLevelRecommendation);
    setPersonalizedReady(true);
  };

  const loadPlanState = async ({ silent = false }: { silent?: boolean } = {}) => {
    const hasUsableContent = phases.length > 0;
    let resolvedGoalPath = goalPath;
    let resolvedLevelRecommendation = levelRecommendation;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(!hasUsableContent);
    }
    setError(null);

    try {
      let latestPlan: LearningPlanResponse | null = null;
      if (!resolvedGoalPath) {
        resolvedGoalPath = await studentApi.getGoalPath(numericCourseId).catch(() => null);
        if (resolvedGoalPath) {
          setGoalPath(resolvedGoalPath);
        }
      }

      if (!resolvedLevelRecommendation) {
        resolvedLevelRecommendation = await studentApi.getLevelRecommendation(numericCourseId).catch(() => null);
        if (resolvedLevelRecommendation) {
          setLevelRecommendation(resolvedLevelRecommendation);
        }
      }

      try {
        latestPlan = await studentApi.getLatestLearningPlan(activeUserId, numericCourseId);
      } catch {
        await regeneratePlanForCurrentGoal();
        try {
          latestPlan = await studentApi.getLatestLearningPlan(activeUserId, numericCourseId);
        } catch {
          latestPlan = null;
        }
      }

      if (latestPlan && (shouldRegeneratePlan(latestPlan, routeCourseId) || isFallbackLikePlan(latestPlan, routeCourseId))) {
        await regeneratePlanForCurrentGoal();
        try {
          latestPlan = await studentApi.getLatestLearningPlan(activeUserId, numericCourseId);
        } catch {
          latestPlan = null;
        }
      }

      const resolvedPlan = resolveBestPlan({
        routeCourseId,
        latestPlan,
        goalPath: resolvedGoalPath,
        levelRecommendation: resolvedLevelRecommendation,
        activeUserId,
        numericCourseId,
        courseName: course.title,
      });

      const latestProgress =
        resolvedPlan?.plan_id !== null && resolvedPlan?.plan_id !== undefined
          ? await studentApi.getPlanProgress(resolvedPlan.plan_id, activeUserId).catch(() => null)
          : null;

      if (!resolvedPlan) {
        throw new Error("学习路径暂未生成");
      }

      setPlan(resolvedPlan);
      setProgress(latestProgress);
      setPhases(mapPlanToPhases(resolvedPlan, latestProgress));
      setUsingFallback(false);
    } catch (loadError) {
      if (resolvedGoalPath) {
        const personalizedPlan = buildPlanFromPersonalizedData({
          userId: activeUserId,
          courseId: numericCourseId,
          courseName: course.title,
          goalPath: resolvedGoalPath,
          levelRecommendation: resolvedLevelRecommendation,
        });
        setPlan(personalizedPlan);
        setProgress(null);
        setPhases(mapPlanToPhases(personalizedPlan, null));
        setUsingFallback(false);
        setError(null);
      } else if (!hasUsableContent) {
        setPlan(null);
        setProgress(null);
        setPhases(localFallbackPhases(routeCourseId));
        setUsingFallback(true);
        setError(loadError instanceof Error ? loadError.message : "学习路径加载失败");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadPlanState();
    void loadPersonalizedSidebar();
  }, [activeUserId, numericCourseId]);

  useEffect(() => {
    if (!personalizedReady) return;
    if (plan || loading || refreshing || generating) return;
    if (!goalPath) return;
    void loadPlanState({ silent: true });
  }, [generating, goalPath, loading, personalizedReady, plan, refreshing]);

  const handleSaveGoal = () => {
    const trimmedGoal = goalDraft.trim();
    if (!trimmedGoal) {
      setToastMessage("先写下学习目标，再生成路径。");
      return;
    }
    if (!goalDeadlineDraft) {
      setToastMessage("还需要一个完成时间。");
      return;
    }
    const nextGoal: StoredLearningGoal = {
      userId: goalUserId,
      courseId: routeCourseId,
      goal: trimmedGoal,
      deadline: goalDeadlineDraft,
      dailyMinutes: Math.max(15, Number(goalDailyMinutesDraft) || 45),
      createdAt: learningGoal?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveLearningGoal(nextGoal);
    setLearningGoal(nextGoal);
    setGoalModalOpen(false);
    setToastMessage("目标已保存，接下来按你的完成时间生成路径。");
  };

  const handleGeneratePlan = async () => {
    setGenerating(true);
    setError(null);
    try {
      const activeGoal =
        learningGoal ||
        (goalDraft.trim()
          ? {
              userId: goalUserId,
              courseId: routeCourseId,
              goal: goalDraft.trim(),
              deadline: goalDeadlineDraft,
              dailyMinutes: Math.max(15, Number(goalDailyMinutesDraft) || 45),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : null);

      await studentApi.generateLearningPlan({
        user_id: activeUserId,
        course_id: numericCourseId,
        target: activeGoal?.goal || `${course.title} 7 天强化收口`,
        available_days: getGoalAvailableDays(activeGoal?.deadline),
        daily_study_minutes: activeGoal?.dailyMinutes || 35,
      });
      await loadPlanState({ silent: true });
      setToastMessage("已重新生成学习路径，并同步刷新当前进度。");
    } catch (generateError) {
      if (goalPath) {
        const personalizedPlan = buildPlanFromPersonalizedData({
          userId: activeUserId,
          courseId: numericCourseId,
          courseName: course.title,
          goalPath,
          levelRecommendation,
        });
        setPlan(personalizedPlan);
        setProgress(null);
        setPhases(mapPlanToPhases(personalizedPlan, null));
        setUsingFallback(false);
        setError(null);
        setToastMessage("实时生成暂时未完成，已先按你的画像与课程目标生成可执行路径。");
      } else {
        setUsingFallback(true);
        setError(generateError instanceof Error ? generateError.message : "学习路径生成失败");
        setToastMessage("学习路径生成未完成，已切换到备用学习路径，你可以继续浏览。");
      }
    } finally {
      setGenerating(false);
    }
  };

  const regeneratePlanForCurrentGoal = async () => {
    const activeGoal =
      learningGoal ||
      (goalDraft.trim()
        ? {
            userId: goalUserId,
            courseId: routeCourseId,
            goal: goalDraft.trim(),
            deadline: goalDeadlineDraft,
            dailyMinutes: Math.max(15, Number(goalDailyMinutesDraft) || 45),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : null);

    await studentApi.generateLearningPlan({
      user_id: activeUserId,
      course_id: numericCourseId,
      target: activeGoal?.goal || `${course.title} 7 天强化收口`,
      available_days: getGoalAvailableDays(activeGoal?.deadline),
      daily_study_minutes: activeGoal?.dailyMinutes || 35,
    });
  };

  const handleToggleStep = async (phaseId: string, stepId: string) => {
    if (!plan?.plan_id) {
      setPhases((current) =>
        current.map((phase) =>
          phase.id !== phaseId
            ? phase
            : {
                ...phase,
                steps: phase.steps.map((step) => (step.id === stepId ? { ...step, completed: true } : step)),
              },
        ),
      );
      setUsingFallback(true);
      setToastMessage("当前为备用学习路径，进度已暂存，系统恢复后会继续同步。");
      return;
    }

    setSubmittingStepId(stepId);
    setError(null);
    try {
      const nextProgress = await studentApi.completePlanStep(plan.plan_id, stepId, activeUserId);
      setProgress(nextProgress);
      setPhases(mapPlanToPhases(plan, nextProgress));
      setToastMessage("步骤已完成，学习路径进度已回写。");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "进度回写失败");
      setToastMessage("真实回写失败，页面状态保持不变。");
    } finally {
      setSubmittingStepId(null);
    }
  };

  return (
    <div className="space-y-6 select-none" id="learning-path-workspace">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#564145] transition-colors hover:text-[#fb7299]"
        >
          <ArrowLeft className="h-4 w-4" />
          返回上一页
        </button>

        <div className="rounded-2xl border border-[#E3E8EC] bg-white/80 px-4 py-3 text-xs font-semibold text-[#564145] shadow-sm">
          当前方案主题：<span className="font-black text-[#171c22]">{course.title}</span>
        </div>
      </div>

      <section className="rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#fb7299]/10 px-3 py-1 text-[10px] font-extrabold tracking-[0.2em] text-[#fb7299]">
                学习路径
              </span>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-extrabold tracking-[0.2em] ${
                  usingFallback
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {usingFallback ? "备用方案" : "实时方案"}
              </span>
            </div>

            <h1 className="text-2xl font-extrabold text-[#171c22] lg:text-3xl">{currentPageLabel}</h1>
            <p className="text-sm leading-7 text-[#564145]">
              {localizedPlanSummary}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#f7f9fc] px-4 py-3">
                <div className="text-[11px] font-semibold tracking-[0.2em] text-[#8a94a3]">总体进度</div>
                <div className="mt-2 text-lg font-extrabold text-[#171c22]">{formatPercent(overallProgress)}</div>
              </div>
              <div className="rounded-2xl bg-[#f7f9fc] px-4 py-3">
                <div className="text-[11px] font-semibold tracking-[0.2em] text-[#8a94a3]">当前阶段</div>
                <div className="mt-2 text-sm font-extrabold text-[#171c22]">{plan?.current_stage || "路径模板准备中"}</div>
              </div>
              <div className="rounded-2xl bg-[#f7f9fc] px-4 py-3">
                <div className="text-[11px] font-semibold tracking-[0.2em] text-[#8a94a3]">下一步安排</div>
                <div className="mt-2 text-sm font-extrabold text-[#171c22]">{plan?.next_action || nextStep?.title || "等待生成建议"}</div>
              </div>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 lg:w-80">
            <button
              onClick={() => navigate(`/learn?courseId=${course.id}`)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#fb7299] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#eb5f90]"
            >
              <PlayCircle className="h-5 w-5" />
              继续学习
            </button>
            <button
              onClick={() => void loadPlanState({ silent: true })}
              disabled={refreshing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#E3E8EC] bg-white px-5 py-3 text-sm font-bold text-[#171c22] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              刷新路径
            </button>
            <button
              onClick={handleGeneratePlan}
              disabled={generating}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#fb7299]/25 bg-[#fff4f8] px-5 py-3 text-sm font-bold text-[#fb7299] transition-colors hover:bg-[#ffe8f0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className={`h-4 w-4 ${generating ? "animate-pulse" : ""}`} />
              重新生成
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_340px]">
        <div className="rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
          <div className="mt-5 rounded-[28px] border border-[#f0d7e0] bg-[linear-gradient(180deg,#fffafc_0%,#ffffff_100%)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex rounded-full bg-[#fff4f8] px-3 py-1 text-[10px] font-extrabold tracking-[0.18em] text-[#fb7299]">
                AI 已生成本轮个性化学习方案
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-[#171c22]">
                当前总进度 {formatPercent(overallProgress)}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl">
                <div className="text-[10px] font-black tracking-[0.16em] text-[#8a94a3]">本轮目标</div>
                <h2 className="mt-2 text-xl font-extrabold text-[#171c22]">
                  {learningGoal?.goal || goalPath?.goal_title || "7天完成一个明确目标"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#564145]">
                  {learningGoal
                    ? `系统会结合你的学习画像、当前进度和这个目标，在 ${formatGoalDeadline(learningGoal.deadline)} 前拆出可执行的阶段任务。`
                    : goalPath?.goal_subtitle || "不是泛泛推荐，而是结合你的画像与当前进度拆成接下来要完成的学习动作。"}
                </p>
                <p className="mt-1 text-xs text-[#8a94a3]">
                  {learningGoal
                    ? `当前记录：每日 ${learningGoal.dailyMinutes} 分钟 · ${getGoalAvailableDays(learningGoal.deadline)} 天内完成 · 路径会随画像与进度动态调整`
                    : goalPath?.suitable_for || "系统会按你的学习基础、薄弱点和当前课程阶段持续微调路径。"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:max-w-[360px] md:justify-end">
                <span className="rounded-full border border-[#edf1f5] bg-white px-3 py-2 text-[11px] font-bold text-[#171c22]">
                  当前目标：{learningGoal?.goal || "按当前课程推进"}
                </span>
                <span className="rounded-full border border-[#edf1f5] bg-white px-3 py-2 text-[11px] font-bold text-[#171c22]">
                  完成时间：{learningGoal ? formatGoalDeadline(learningGoal.deadline) : "待设定"}
                </span>
                <span className="rounded-full border border-[#edf1f5] bg-white px-3 py-2 text-[11px] font-bold text-[#171c22]">
                  日投入：{learningGoal ? `${learningGoal.dailyMinutes} 分钟 / 天` : "按系统建议"}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setGoalModalOpen(true)}
                className="inline-flex items-center justify-center rounded-2xl border border-[#f3d5de] bg-white px-4 py-2 text-xs font-bold text-[#8a5666]"
              >
                修改目标
              </button>
              <button
                onClick={() => navigate(`/learn?courseId=${course.id}`)}
                className="inline-flex items-center justify-center rounded-2xl bg-[#171c22] px-4 py-2 text-xs font-bold text-white"
              >
                继续课堂
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 rounded-2xl border border-[#f6d8e3] bg-[#fff8fb] px-4 py-3">
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#171c22]">
                当前阶段：{phases[currentPhaseIndex]?.title || "学习起步"}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#171c22]">
                学习目标：{learningGoal?.goal ? "已设定明确目标" : "按当前课程推进"}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#171c22]">
                学习节奏：{learningGoal ? `${learningGoal.dailyMinutes} 分钟 / 天` : "按系统建议节奏"}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#171c22]">
                推荐方式：结合画像、进度与薄弱点动态生成
              </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-full bg-[#f3f5f8]">
              <div
                className="h-2 rounded-full bg-[linear-gradient(90deg,#fb7299_0%,#ff9ab6_100%)] transition-all"
                style={{ width: `${overallProgress}%` }}
              />
            </div>

            <div className="mt-5 rounded-[28px] border border-[#f6d8e3] bg-[linear-gradient(135deg,#fff1f6_0%,#ffffff_55%,#fff9fc_100%)] p-5 shadow-[0_14px_34px_rgba(251,114,153,0.10)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black tracking-[0.18em] text-[#8a94a3]">逐日学习安排</div>
                  <div className="mt-2 text-lg font-extrabold text-[#171c22]">接下来 3 天具体学什么、做什么、产出什么</div>
                  <p className="mt-2 text-xs leading-6 text-[#64748b]">
                    先把最该优先推进的 3 个学习日程直接展示在首屏，不再只给你抽象概括。
                  </p>
                </div>
                <div className="rounded-2xl border border-[#f3d5de] bg-white px-4 py-3 text-right">
                  <div className="text-[10px] font-black tracking-[0.16em] text-[#8a94a3]">当前最优先</div>
                  <div className="mt-2 text-sm font-extrabold text-[#171c22]">{resolvedDailyPlanItems[0]?.title || nextStep?.title || "等待系统生成"}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-3">
                {resolvedDailyPlanItems.slice(0, 3).map((item, index) => (
                  <div key={`hero-${item.day}-${item.title}`} className="rounded-2xl border border-[#edf1f5] bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-black tracking-[0.18em] text-[#8a94a3]">第 {item.day} 天</div>
                      <div className="rounded-full bg-[#fff1f6] px-2.5 py-1 text-[10px] font-black text-[#d84f82]">
                        {index === 0 ? "优先执行" : index === 1 ? "紧接着做" : "随后推进"}
                      </div>
                    </div>
                    <div className="mt-3 text-sm font-extrabold text-[#171c22]">{item.title}</div>
                    <div className="mt-2 rounded-2xl bg-[#f8fbff] px-3 py-2 text-xs font-bold text-[#006689]">
                      这天重点：{item.focus}
                    </div>
                    <p className="mt-3 text-xs leading-6 text-[#564145]">要做的事：{item.task}</p>
                    <div className="mt-3 rounded-2xl border border-dashed border-[#dbe7f3] bg-[#fafcff] px-3 py-3">
                      <div className="text-[11px] font-black tracking-[0.14em] text-[#8a94a3]">当天完成标准</div>
                      <div className="mt-2 text-xs leading-6 text-[#171c22]">产出：{item.deliverable}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {phases.map((phase, index) => {
                const isCurrent = index === currentPhaseIndex;
                const isFinished = phase.progress >= 100;
                const phaseStepCount = phase.steps.length;
                const phaseDoneCount = phase.steps.filter((step) => step.completed).length;
                const currentStep = phase.steps.find((step) => !step.completed) || phase.steps[0];
                return (
                  <div
                    key={phase.id}
                    className={`relative rounded-[24px] border p-4 transition-all ${
                      isCurrent
                        ? "border-[#fb7299]/35 bg-[#fff7fa] shadow-[0_12px_30px_rgba(251,114,153,0.10)]"
                        : isFinished
                          ? "border-emerald-200 bg-emerald-50/70"
                          : "border-[#edf1f5] bg-[#fcfdff]"
                    }`}
                  >
                    {index < phases.length - 1 ? (
                      <div className="pointer-events-none absolute -right-7 top-7 hidden items-center lg:flex">
                        <div className="h-[3px] w-8 rounded-full bg-[linear-gradient(90deg,#f7b6cb_0%,#fb7299_100%)] shadow-[0_0_12px_rgba(251,114,153,0.22)]" />
                        <div className="ml-1 flex h-6 w-6 items-center justify-center rounded-full border border-[#f6bfd1] bg-white text-[#fb7299] shadow-[0_6px_14px_rgba(251,114,153,0.16)]">
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    ) : null}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black ${
                            isFinished
                              ? "bg-emerald-500 text-white"
                              : isCurrent
                                ? "bg-[#fb7299] text-white"
                                : "bg-[#eef2f6] text-[#64748b]"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-sm font-extrabold text-[#171c22]">{phase.title}</div>
                          <div className="mt-1 text-[11px] text-[#8a94a3]">{phaseDoneCount}/{phaseStepCount} 任务已完成</div>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                          isFinished
                            ? "bg-emerald-100 text-emerald-700"
                            : isCurrent
                              ? "bg-[#ffe3ec] text-[#d84f82]"
                              : "bg-[#f3f5f8] text-[#8a94a3]"
                        }`}
                      >
                        {isFinished ? "已完成" : isCurrent ? "当前阶段" : "待推进"}
                      </span>
                    </div>

                    <p className="mt-3 text-xs leading-6 text-[#564145]">{getStageCardCopy(routeCourseId, phase, currentStep).summary}</p>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white/85 px-3 py-3">
                        <div className="text-[10px] font-black tracking-[0.14em] text-[#8a94a3]">阶段重点</div>
                        <div className="mt-2 text-sm font-bold leading-6 text-[#171c22]">
                          {getStageCardCopy(routeCourseId, phase, currentStep).focusTitle}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white/85 px-3 py-3">
                        <div className="text-[10px] font-black tracking-[0.14em] text-[#8a94a3]">当前进度</div>
                        <div className="mt-2 text-sm font-bold leading-6 text-[#171c22]">
                          {phaseDoneCount}/{phaseStepCount} 项已完成
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl border border-dashed border-[#f4ccd8] bg-white/70 px-3 py-3">
                      <div className="text-[11px] font-black tracking-[0.14em] text-[#8a94a3]">这一阶段下一步做什么</div>
                      <div className="mt-2 text-sm font-bold leading-6 text-[#171c22]">
                        {getStageCardCopy(routeCourseId, phase, currentStep).nextTitle}
                      </div>
                      <div className="mt-1 text-xs leading-6 text-[#64748b]">
                        {getStageCardCopy(routeCourseId, phase, currentStep).nextDetail}
                      </div>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className={`h-full rounded-full ${isFinished ? "bg-emerald-500" : "bg-[#fb7299]"}`}
                        style={{ width: `${phase.progress}%` }}
                      />
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#171c22]">学习建议与后续联动</h3>
                <p className="mt-1 text-xs leading-6 text-[#564145]">
                  这里会把你当前更适合的学习层级、推荐主题和后续动作收在一起。
                </p>
              </div>
              <div className="rounded-full bg-[#fff4f8] px-3 py-1 text-[10px] font-black text-[#fb7299]">
                侧边决策
              </div>
            </div>

            {levelRecommendation?.active_level ? (
              <div className="mt-4 rounded-2xl border border-[#f3d5de] bg-[linear-gradient(180deg,#fff8fb_0%,#ffffff_100%)] p-4">
                <div className="text-[10px] font-black tracking-[0.16em] text-[#8a94a3]">当前更匹配的学习层级</div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-extrabold text-[#171c22]">
                    {levelRecommendation.items.find((item) => item.level === levelRecommendation.active_level)?.label || "当前推荐层级"}
                  </div>
                  <div className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#006689]">
                    匹配度{" "}
                    {levelRecommendation.items.find((item) => item.level === levelRecommendation.active_level)?.fit_score || "--"}
                  </div>
                </div>
                <p className="mt-2 text-xs leading-6 text-[#564145]">
                  {levelRecommendation.items.find((item) => item.level === levelRecommendation.active_level)?.description ||
                    "系统会根据你的当前表现自动推荐更适合的学习难度。"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(levelRecommendation.items.find((item) => item.level === levelRecommendation.active_level)?.recommended_topics || []).map(
                    (topic) => (
                      <span key={topic} className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#171c22]">
                        {topic}
                      </span>
                    ),
                  )}
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-3">
              {(levelRecommendation?.items || [])
                .filter((item) => item.level !== levelRecommendation?.active_level)
                .slice(0, 2)
                .map((item) => (
                  <div key={item.level} className="rounded-2xl border border-[#edf1f5] bg-[#fafcff] px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-extrabold text-[#171c22]">{item.label}</div>
                      <div className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-[#8a94a3]">
                        备选
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-6 text-[#564145]">{item.description}</p>
                  </div>
                ))}
            </div>
          </section>
        </aside>
      </section>

      {error && phases.length === 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          当前学习路径暂时未能更新：{error}。页面已自动切换到备用学习路径，你仍可继续查看内容、勾选步骤和进入相关页面。
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#564145]">
            <RefreshCw className="h-4 w-4 animate-spin" />
            正在同步学习路径与步骤进度...
          </div>
        </section>
      ) : null}

      {goalModalOpen ? (
        <div className="fixed inset-0 z-[130] flex items-start justify-center bg-[#111827]/45 px-4 pt-20 backdrop-blur-[2px] sm:pt-24">
          <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,246,249,0.96))] p-5 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#fb7299]">学习目标</p>
            <h3 className="mt-2 text-xl font-black text-[#171c22]">先设目标，再生成路径</h3>
            <p className="mt-2 text-sm leading-6 text-[#5b6574]">
              路径会根据你的目标、完成时间和每日可投入时长来安排。
            </p>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs font-black text-[#564145]">学习目标</span>
                <textarea
                  value={goalDraft}
                  onChange={(event) => setGoalDraft(event.target.value)}
                  rows={3}
                  placeholder="比如：本周完成前端状态管理专题，并能独立拆分组件状态"
                  className="mt-2 w-full rounded-2xl border border-[#f3d5de] bg-white px-4 py-3 text-sm text-[#171c22] outline-none transition focus:border-[#fb7299] focus:ring-2 focus:ring-[#fb7299]/15"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-black text-[#564145]">预计完成时间</span>
                  <input
                    type="datetime-local"
                    value={goalDeadlineDraft}
                    onChange={(event) => setGoalDeadlineDraft(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-[#f3d5de] bg-white px-4 py-3 text-sm text-[#171c22] outline-none transition focus:border-[#fb7299] focus:ring-2 focus:ring-[#fb7299]/15"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black text-[#564145]">每日学习时长</span>
                  <input
                    type="number"
                    min="15"
                    step="5"
                    value={goalDailyMinutesDraft}
                    onChange={(event) => setGoalDailyMinutesDraft(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-[#f3d5de] bg-white px-4 py-3 text-sm text-[#171c22] outline-none transition focus:border-[#fb7299] focus:ring-2 focus:ring-[#fb7299]/15"
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveGoal}
                className="inline-flex items-center justify-center rounded-full bg-[#fb7299] px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(251,114,153,0.22)] transition-transform hover:-translate-y-0.5"
              >
                保存目标
              </button>
              {learningGoal ? (
                <button
                  type="button"
                  onClick={() => {
                    setGoalDraft(learningGoal.goal);
                    setGoalDeadlineDraft(learningGoal.deadline);
                    setGoalDailyMinutesDraft(String(learningGoal.dailyMinutes));
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-[#f3d5de] bg-[#fff7fa] px-5 py-2.5 text-sm font-black text-[#8a5666]"
                >
                  恢复当前目标
                </button>
              ) : null}
              {learningGoal ? (
                <button
                  type="button"
                  onClick={() => setGoalModalOpen(false)}
                  className="inline-flex items-center justify-center rounded-full border border-[#f3d5de] bg-white px-5 py-2.5 text-sm font-black text-[#8a5666]"
                >
                  先看当前路径
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#171c22]">阶段任务清单</h2>
              <p className="mt-1 text-xs text-[#564145]">这里按阶段展开全部可执行任务，你可以直接勾选推进。</p>
            </div>
            <div className="text-right text-[11px] font-semibold text-[#8a94a3]">
              <div>数据源</div>
              <div className="mt-1 font-extrabold text-[#171c22]">{usingFallback ? "备用学习路径" : "系统最新计划"}</div>
            </div>
          </div>

          <div className="space-y-8">
            {phases.map((phase) => (
              <div key={phase.id} className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#171c22]">{phase.title}</h3>
                    <p className="mt-1 text-xs leading-6 text-[#564145]">{phase.summary}</p>
                  </div>
                  <span className="rounded-full bg-[#f3f5f8] px-3 py-1 text-[11px] font-bold text-[#171c22]">
                    {phase.progress}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-[#eef2f6]">
                  <div className="h-full rounded-full bg-[#fb7299]" style={{ width: `${phase.progress}%` }} />
                </div>

                <div className="space-y-3">
                  {phase.steps.map((step) => {
                    const locked = step.status === "locked";
                    const current = step.status === "current";
                    const busy = submittingStepId === step.id;
                    return (
                      <div
                        key={step.id}
                        className={`rounded-2xl border p-4 transition-all ${
                          current
                            ? "border-[#fb7299]/40 bg-[#fff7fa]"
                            : locked
                              ? "border-slate-100 bg-slate-50 opacity-70"
                              : "border-[#E3E8EC] bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 gap-3">
                            <button
                              type="button"
                              disabled={locked || busy || step.completed}
                              onClick={() => void handleToggleStep(phase.id, step.id)}
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                step.completed
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : "border-slate-300 bg-white text-slate-400 hover:border-[#fb7299]"
                              }`}
                            >
                              {step.completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                            </button>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className={`text-sm font-extrabold ${step.completed ? "text-slate-400 line-through" : "text-[#171c22]"}`}>
                                  {step.title}
                                </h4>
                                <span className="rounded-full bg-[#f3f5f8] px-2 py-0.5 text-[10px] font-bold text-[#564145]">
                                  {step.duration}
                                </span>
                                {current ? (
                                  <span className="rounded-full bg-[#fb7299] px-2 py-0.5 text-[10px] font-bold text-white">
                                    当前先做
                                  </span>
                                ) : null}
                                {locked ? (
                                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                    待解锁
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs leading-6 text-[#564145]">{step.subtitle}</p>
                              <p className="mt-1 text-[11px] text-[#8a94a3]">完成标准：{getStepOutcomeCopy(step)}</p>
                              {step.note ? <p className="mt-1 text-[11px] text-[#006689]">进度备注：{step.note}</p> : null}
                              {step.updatedAt ? (
                                <p className="mt-1 text-[11px] text-slate-400">最近回写：{formatDateTime(step.updatedAt)}</p>
                              ) : null}
                            </div>
                          </div>

                          <button
                            onClick={() => navigate(`/resources?courseId=${course.id}`)}
                            className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#006689] hover:underline"
                          >
                            配套资源
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#171c22]">
              <Target className="h-4 w-4 text-[#fb7299]" />
              下一步可以直接去做
            </h3>
            <div className="mt-4 space-y-3 text-xs leading-6 text-[#564145]">
              <p>{plan?.progress_hint || "这条路径会把你的当前进度同步到测评、资源中心和智能助教等页面，形成连续学习链路。"}</p>
              <p>{plan?.next_action || "完成当前任务后，系统会继续结合你的画像和阶段表现，往下承接最合适的下一步。"}</p>
              <p>
                {usingFallback
                  ? "当前是备用学习路径，但打勾记录、继续追问和查看资料这些动作仍然可以正常使用。"
                  : plan?.dynamic_adjustments?.[0] || "系统会根据你完成这一步后的表现，继续调整后面的学习内容和优先级。"}
              </p>
            </div>
            <div className="mt-4 grid gap-3">
              <button
                onClick={() => navigate(`/evaluation?courseId=${course.id}`)}
                className="inline-flex items-center justify-between rounded-2xl border border-[#E3E8EC] bg-[#fafbfd] px-4 py-3 text-left text-xs font-bold text-[#171c22]"
              >
                去测评页看报告联动
                <ExternalLink className="h-4 w-4 text-[#8a94a3]" />
              </button>
              <button
                onClick={() =>
                  navigate(
                    `/tutor?courseId=${course.id}&query=${encodeURIComponent(`请结合我在《${course.title}》中的学习路径进度，继续给我下一步辅导建议。`)}`,
                  )
                }
                className="inline-flex items-center justify-between rounded-2xl border border-[#E3E8EC] bg-[#fafbfd] px-4 py-3 text-left text-xs font-bold text-[#171c22]"
              >
                去智能助教继续提问
                <Bot className="h-4 w-4 text-[#8a94a3]" />
              </button>
              <button
                onClick={() => navigate(`/resources?courseId=${course.id}`)}
                className="inline-flex items-center justify-between rounded-2xl border border-[#E3E8EC] bg-[#fafbfd] px-4 py-3 text-left text-xs font-bold text-[#171c22]"
              >
                去资源中心看推荐资料
                <BookOpen className="h-4 w-4 text-[#8a94a3]" />
              </button>
            </div>
          </section>
        </aside>
      </div>

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 rounded-2xl bg-[#171c22] px-4 py-3 text-xs font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}
