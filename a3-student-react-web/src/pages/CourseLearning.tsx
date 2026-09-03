/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Tv,
  BookOpen,
  FileText,
  Award,
  Bot,
  Sparkles,
  Network,
  GraduationCap,
  Heart,
  Share2,
  Bookmark,
  CheckCircle,
  UserCircle,
  MessageCircle,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ListRestart,
  Play,
  Send,
  ThumbsUp,
  Presentation,
  Video,
  ExternalLink,
} from "lucide-react";
import { COURSES } from "../constants";
import { getCurrentLoggedInUserId, getCurrentLoggedInUserName } from "../lib/currentUser";
import { getPersonaById } from "../lib/personas";
import MarkdownRenderer from "../components/MarkdownRenderer";
import {
  studentApi,
  type CourseTeacher,
  type CourseCommentItem,
  type LearningNoteSummary,
  type LearningQuestionSummary,
  type LearningCourseDetail,
  type ManagedResourceDetail,
  type OpenClassroomBuildResponse,
  type ResourceCard,
  type VideoDanmakuItem,
} from "../lib/studentApi";
import type { DeckSlide } from "../lib/pptxExport";
import {
  persistCourseResourceWorkspace,
  readPersistedCourseResourceWorkspace,
  sanitizeWorkspaceText,
  type RecentPptArtifact,
  type RecentResourceArtifact,
  type PptExplanationVideoArtifact,
  type StoredMindmapNode,
  type StoredPracticeQuestion,
} from "../lib/courseResourceWorkspace";
import { parseQuizPaper } from "../lib/quizEngine";
import { resolveBackendCourseCode, resolveBackendCourseId } from "../lib/courseRouting";
import { persistLastRouteCourseId } from "../lib/routeCourseContext";
import { OPEN_TUTOR_PANEL_EVENT, openTutorPanel, saveActiveTutorContext } from "../lib/tutorPanel";
import { getCourseVideoInsightMeta, getCourseVideoPlaylist } from "../lib/videoCatalog";
import { getGeneratedResourceIcon, getGeneratedResourceUiMeta } from "../lib/generatedResourceUi";
import { beginUiProgress, finishUiProgress, setUiProgress } from "../lib/uiProgress";
import JobLearningContextBar from "../components/job-learning/JobLearningContextBar";
import JobStageTaskWorkbench from "../components/job-learning/JobStageTaskWorkbench";
import { getJobLearningProfile } from "../lib/jobLearningCatalog";

const HorizontalMindmap = lazy(() => import("../components/HorizontalMindmap"));
const AILoadingLottie = lazy(() => import("../components/AILoadingLottie"));

function LazyAiLoading(props: React.ComponentProps<typeof AILoadingLottie>) {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-[#E6EDF5] bg-white/80 px-4 py-3 text-center text-xs font-bold text-[#64748B]">
          正在准备生成动效...
        </div>
      }
    >
      <AILoadingLottie {...props} />
    </Suspense>
  );
}

async function exportPptxOnDemand(fileName: string, slides: DeckSlide[]) {
  const { exportDeckAsPptx } = await import("../lib/pptxExport");
  await exportDeckAsPptx(fileName, slides);
}

type DanmakuMode = "scroll" | "top" | "bottom";

type PersistedPresetDanmaku = {
  text: string;
  color: string;
  mode?: DanmakuMode;
  time: number;
};

function formatGenerationTime() {
  return new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ActiveCourseDanmaku = {
  id: string;
  content: string;
  color: string;
  mode: DanmakuMode;
  startTime: number;
  top?: string;
  width?: number;
  duration?: number;
  opacity?: number;
};

type CourseComment = {
  id: number;
  author: string;
  text: string;
  date: string;
  createdAt?: string | null;
  likes: number;
  badge?: string;
  liked?: boolean;
  replyTo?: string;
  parentCommentId?: number | null;
};

type CommentSortMode = "latest" | "hot";

type ReplyTarget = {
  id: number;
  author: string;
};

type RecentHandoutArtifact = {
  title: string;
  downloadUrl: string;
  generatedAt: string;
};

type PracticeQuestion = StoredPracticeQuestion;

type MindmapNode = StoredMindmapNode;

type GeneratedArtifactKind = "handout" | "mindmap" | "practice" | "ppt";

function getGeneratedResultMeta(kind: GeneratedArtifactKind) {
  const uiMeta = getGeneratedResourceUiMeta(kind);
  return {
    label: uiMeta.label,
    resultLabel: uiMeta.resultLabel,
    description: uiMeta.description,
    Icon: getGeneratedResourceIcon(kind),
    pillClass: uiMeta.pillClass,
    borderClass: uiMeta.borderClass,
    bgClass: uiMeta.bgClass,
    iconClass: uiMeta.iconClass,
    buttonClass: uiMeta.buttonClass,
  };
}

type ResourcePreviewState =
  | {
      kind: "resource";
      resourceKind: "handout" | "mindmap" | "practice";
      title: string;
      tag: string;
      sectionTitle: string;
      summary: string;
      content: string[];
      downloadUrl: string;
      questions?: PracticeQuestion[];
      mindmapNodes?: MindmapNode[];
      loading?: boolean;
    }
  | {
      kind: "ppt";
      title: string;
      tag: string;
      sectionTitle: string;
      summary: string;
      content: string[];
      fileName: string;
      slides: DeckSlide[];
      loading?: boolean;
    };

type PptViewerState = {
  title: string;
  fileName: string;
  slides: DeckSlide[];
  slideIndex: number;
};

type PreviewRecommendation = {
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
};

type ClassroomPreviewState = OpenClassroomBuildResponse & {
  generatedAt: string;
};

let localTempCommentId = -1;

const DANMAKU_SCROLL_LANES = ["12%", "22%", "32%", "42%", "52%"];
const DANMAKU_FIXED_DURATION = 3.6;
const DANMAKU_SCROLL_SPEED_PX_PER_SECOND = 132;
const DANMAKU_SCROLL_GAP_PX = 124;
const DANMAKU_SEEK_LOOKAHEAD_SECONDS = 0.45;
const DANMAKU_MAX_FIXED_STACK = 1;
const COURSE_RUNTIME_STORAGE_PREFIX = "a3-course-runtime";
const RESOURCE_GENERATION_TIMEOUT_MS = 3000;
const RESOURCE_REUSE_LOOKUP_TIMEOUT_MS = 1800;

// Bullet comments presets based on distinct academic courses
const PRESET_DANMAKUS_BY_COURSE: Record<string, PersistedPresetDanmaku[]> = {
  "series-2": [
    { text: "软件工程第一章先把主线搭起来，后面章节就顺了", color: "#fb7299", time: 1.2, mode: "scroll" },
    { text: "可行性分析和需求分析终于分清楚了", color: "#2563eb", time: 3.8, mode: "scroll" },
    { text: "这节把软件生命周期讲得很清楚，适合复习前先看一遍", color: "#10b981", time: 6.1, mode: "scroll" },
    { text: "前方重点：过程模型和阶段产出要记牢", color: "#ef4444", time: 9.3, mode: "top" },
    { text: "课程资料和实验安排终于串起来了", color: "#fb7299", time: 12.4, mode: "scroll" },
    { text: "这门课拿来做答辩和课设都很有用", color: "#d97706", time: 15.6, mode: "bottom" },
    { text: "复习的时候先看导图再回讲义，效率高很多", color: "#475569", time: 18.8, mode: "scroll" },
    { text: "原来测试、维护和项目管理在这门课里是连着讲的", color: "#0891b2", time: 22.1, mode: "scroll" }
  ],
  "series-1": [
    { text: "反向传播在极深多层网络里的确容易梯度消失啊 🔗", color: "#ef4444", time: 1.1, mode: "scroll" },
    { text: "萨教授讲得太通透了！数学公式讲解绝了", color: "#2563eb", time: 4.2, mode: "scroll" },
    { text: "听完这章豁然开朗，终于懂了链式法则！🧠", color: "#10b981", time: 7.4, mode: "scroll" },
    { text: "跳跃层 Residual Link 真是划时代的创新！👍", color: "#fb7299", time: 10.8, mode: "top" },
    { text: "用 ReLU 能完美防止不饱和溢出，妙啊！", color: "#475569", time: 14.1, mode: "scroll" },
    { text: "打卡！冲刺前沿大模型与神经网络方向！🪐", color: "#d97706", time: 17.5, mode: "bottom" },
    { text: "算法代码已经在沙箱里重构成功并过关！", color: "#0891b2", time: 20.8, mode: "scroll" },
    { text: "这里把梯度传播链拆开讲，终于没那么抽象了", color: "#7c3aed", time: 24.3, mode: "scroll" },
    { text: "这段案例推导太像面试高频题了，建议记笔记", color: "#2563eb", time: 27.9, mode: "scroll" },
    { text: "前方是关键公式，大家先别眨眼 👀", color: "#ef4444", time: 31.5, mode: "top" },
    { text: "原来参数更新不稳定时要先看学习率和激活函数配合", color: "#10b981", time: 35.8, mode: "scroll" },
    { text: "这一段真的值回票价，讲得比很多公开课清楚", color: "#fb7299", time: 38.6, mode: "scroll" },
    { text: "记下了：梯度爆炸和梯度消失要分开诊断", color: "#d97706", time: 42.1, mode: "bottom" },
    { text: "代码和公式终于对上了，之前卡住的点通了", color: "#0891b2", time: 46.8, mode: "scroll" },
    { text: "这段复盘很适合拿来做课堂总结", color: "#475569", time: 51.4, mode: "scroll" },
    { text: "后半段内容开始收束了，结构讲得很完整", color: "#2563eb", time: 56.2, mode: "scroll" },
    { text: "学到了，回头我也按这个套路重构实验报告", color: "#10b981", time: 61.7, mode: "scroll" }
  ],
  "series-3": [
    { text: "这个三维流体粒子系统真的惊艳到我了！🤯", color: "#fb7299", time: 1.4, mode: "top" },
    { text: "把牛顿重力力学公式代入 Canvas，简直是高雅艺术", color: "#2563eb", time: 4.1, mode: "scroll" },
    { text: "没有时间参数的弹簧公式确实比常规贝塞尔好！", color: "#10b981", time: 7.2, mode: "scroll" },
    { text: "炫酷！这就是原生 Canvas 与重力算法结合的力量 🚀", color: "#d97706", time: 10.6, mode: "scroll" },
    { text: "UI交互居然具有弹力感和惯性，太强了", color: "#475569", time: 14.5, mode: "bottom" },
    { text: "原来在 High-DPI 屏上乘以 devicePixelRatio 就能防发虚...", color: "#0891b2", time: 18.3, mode: "scroll" }
  ],
  "course-4": [
    { text: "D3.js 数据绑定的 .join() 真的省了无数繁复代码 ⚡", color: "#10b981", time: 1.3, mode: "scroll" },
    { text: "学到了，原来 domain() 定义域对接值域 range()！", color: "#fb7299", time: 4.4, mode: "scroll" },
    { text: "高对比度动态树图表瞬间变得生动了，配色一流！🖌️", color: "#2563eb", time: 7.9, mode: "top" },
    { text: "跟着大厂资深架构师写 D3，感觉脑子开窍了 💡", color: "#d97706", time: 11.8, mode: "scroll" },
    { text: "可视化大师，这课真的太硬核了！", color: "#475569", time: 15.2, mode: "bottom" },
    { text: "配合 D3 进行深度坐标数值插值，流畅拉满", color: "#7c3aed", time: 19.6, mode: "scroll" }
  ]
};

const PRESET_COMMENTS_BY_COURSE: Record<string, Array<{ userId: number; content: string }>> = {
  "series-1": [
    { userId: 1002, content: "复合组件这套拆分方式很适合课程页，插槽边界清楚，后续扩展也更稳。" },
    { userId: 1003, content: "这一段把 Hooks 缓存、引用稳定性和组件重渲染的关系讲得很透，回头复盘时特别好整理成笔记。" },
  ],
  "series-2": [
    { userId: 1002, content: "这一节把软件工程基础、过程模型和课程主线串起来了，适合先建立整体认知。" },
    { userId: 1003, content: "建议把需求、设计、实现、测试这些阶段和对应文档一起记，后面做课设会轻松很多。" },
  ],
};

function getPlaybackStorageKey(courseId: string, episodeIndex: number) {
  return `a3-course-playback:${courseId}:${episodeIndex}`;
}

function readSavedPlaybackTime(courseId: string, episodeIndex: number) {
  if (typeof window === "undefined") return 0;
  const value = Number(window.localStorage.getItem(getPlaybackStorageKey(courseId, episodeIndex)) || "0");
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatPlaybackClock(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function getCourseRuntimeStorageKey(courseId: string) {
  return `${COURSE_RUNTIME_STORAGE_PREFIX}:${courseId}`;
}

type PersistedCourseRuntime = {
  activeEpisodeIdx: number;
  chapterListCollapsed: boolean;
  currentPlaybackTime: number;
  wasPlaying: boolean;
  updatedAt: number;
};

function readPersistedCourseRuntime(courseId: string): PersistedCourseRuntime | null {
  try {
    const raw = localStorage.getItem(getCourseRuntimeStorageKey(courseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCourseRuntime;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistCourseRuntime(courseId: string, payload: Omit<PersistedCourseRuntime, "updatedAt">) {
  localStorage.setItem(
    getCourseRuntimeStorageKey(courseId),
    JSON.stringify({
      ...payload,
      updatedAt: Date.now(),
    } satisfies PersistedCourseRuntime),
  );
}

function normalizeResourceLine(line: string) {
  return line.replace(/^#{1,3}\s*/, "").replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, "").trim();
}

function extractResourceOutline(markdown: string) {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const outline = lines.filter((line) => /^#{1,3}\s|^[-*]\s|^\d+\.\s/.test(line)).slice(0, 8);
  return (outline.length ? outline : lines).map(normalizeResourceLine).filter(Boolean);
}

function extractStructuredResourceOutline(markdown: string, maxLines = 12) {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const structured = lines.filter((line) => /^#{1,3}\s|^[-*]\s|^\d+[.)]\s/.test(line)).slice(0, maxLines);
  if (structured.length) {
    return structured;
  }
  return lines.slice(0, maxLines).map((line, index) => `${index === 0 ? "# " : "## "}${normalizeResourceLine(line)}`);
}

function extractResourceSections(markdown: string, maxSections = 18) {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  return normalized
    .split(/\n\s*\n+/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => normalizeResourceLine(line))
        .join("\n"),
    )
    .map((block) => block.trim())
    .filter(Boolean)
    .slice(0, maxSections);
}

function dedupePreviewLines(lines: string[], limit = 10) {
  return Array.from(
    new Set(
      lines
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter((line) => line.length >= 6),
    ),
  ).slice(0, limit);
}

function pickDeckLines(lines: string[], fallback: string[], limit = 4) {
  const useful = dedupePreviewLines(
    lines
      .map((line) => normalizeResourceLine(line))
      .map((line) => line.replace(/`{1,3}/g, "").replace(/\*\*/g, "").trim())
      .filter((line) => line.length >= 8 && line.length <= 86),
    limit,
  );
  return useful.length >= Math.min(2, limit) ? useful.slice(0, limit) : fallback.slice(0, limit);
}

type SoftwareEngineeringChapterProfile = {
  chapterTitle: string;
  focus: string;
  keywords: string[];
  handoutSections: string[];
  practiceQuestions: PracticeQuestion[];
  pptSummary: string;
  pptSlides: DeckSlide[];
};

function buildSoftwareEngineeringChapterProfile(courseTitle: string, sectionTitle: string): SoftwareEngineeringChapterProfile {
  const normalizedSection = sectionTitle.trim();
  if (normalizedSection.includes("第二章")) {
    return {
      chapterTitle: "第二章：可行性分析与研发策划",
      focus: "先判断项目值不值得做，再明确资源、周期、风险和实施路径。",
      keywords: ["可行性分析", "技术可行性", "经济可行性", "项目计划", "风险识别"],
      handoutSections: [
        `## ${courseTitle} · ${normalizedSection}\n\n这一章的核心不是立刻开工，而是在开工前把“值不值得做、能不能做、准备怎么做”讲清楚。`,
        "### 可行性分析主线\n- 先看业务目标是否成立\n- 再判断技术、经济、进度、法律与运行条件\n- 最后给出是否立项及实施建议",
        "### 研发策划抓手\n- 明确范围、里程碑、角色分工\n- 预估成本、工期与资源投入\n- 提前识别高风险环节并准备预案",
        "### 常见误区\n- 只谈技术实现，不谈业务收益\n- 计划写得很满，却没有缓冲与风险策略\n- 直接承诺上线时间，没有拆清关键路径",
        "### 复习重点\n- 会区分几类可行性\n- 能描述立项前的核心判断依据\n- 能用一个项目案例说明策划怎么落地",
      ],
      practiceQuestions: [
        { id: "practice-1", question: `《${normalizedSection}》最先要回答的问题是什么？`, options: ["项目值不值得做、能不能做", "界面颜色是否统一", "按钮动效是否足够炫", "代码写得是否更短"], answer: ["A"], explanation: "可行性分析首先关注项目是否值得投入，以及是否具备落地条件。", questionType: "single", knowledgeTag: "可行性分析" },
        { id: "practice-2", question: "以下哪些属于可行性分析常见维度？", options: ["技术可行性", "经济可行性", "运行可行性", "法律可行性"], answer: ["A", "B", "C", "D"], explanation: "可行性分析通常至少覆盖技术、经济、运行和法律等维度。", questionType: "multiple", knowledgeTag: "可行性维度" },
        { id: "practice-3", question: "在研发策划阶段，最不应该忽略的内容是什么？", options: ["里程碑和风险预案", "封面是否好看", "文案是否更长", "动画是否更多"], answer: ["A"], explanation: "研发策划要把任务拆解、时间安排和风险控制一并讲清楚。", questionType: "single", knowledgeTag: "研发策划" },
        { id: "practice-4", question: `请简述《${normalizedSection}》里“可行性分析”和“研发策划”的区别。`, options: [], answer: [], explanation: "前者偏向是否立项的判断，后者偏向立项后的组织实施方案。", questionType: "short", knowledgeTag: "概念辨析" },
        { id: "practice-5", question: "如果一个项目业务价值不清、工期极紧、关键技术不成熟，你应该先做什么？", options: ["补充可行性分析并重新评估立项", "直接开始编码", "先做宣传页面", "先把汇报 PPT 做满"], answer: ["A"], explanation: "这类项目前置风险很高，应先回到可行性分析和立项判断。", questionType: "single", knowledgeTag: "项目判断" },
      ],
      pptSummary: "围绕项目立项判断、可行性维度、研发策划抓手和风险控制整理成可答辩的章节课件。",
      pptSlides: [
        { kind: "cover", title: `${courseTitle}`, subtitle: normalizedSection, bullets: ["从可行性分析走到研发策划"] },
        { kind: "agenda", title: "本节结构", subtitle: "先判断，再策划，再控制风险", bullets: ["为什么要做可行性分析", "常见可行性维度", "研发策划与实施路径", "风险识别与答辩表达"] },
        { kind: "content", title: "01 立项前先回答什么", subtitle: "值不值得做、能不能做", bullets: ["业务目标是否明确", "关键技术是否可获得", "成本与收益是否匹配", "上线节奏是否可控"] },
        { kind: "content", title: "02 可行性分析维度", subtitle: "至少形成多维判断", bullets: ["技术可行性：方案、工具、团队是否支持", "经济可行性：投入产出是否合理", "运行与法律可行性：组织环境和合规是否满足"] },
        { kind: "content", title: "03 研发策划核心", subtitle: "把执行路径写清楚", bullets: ["范围与里程碑", "角色分工与资源安排", "关键路径、依赖与缓冲"] },
        { kind: "content", title: "04 风险与答辩表达", subtitle: "展示你有项目治理意识", bullets: ["识别高风险节点", "准备替代方案和缓冲策略", "说明为什么当前计划具备可操作性"] },
        { kind: "ending", title: "复习动作", subtitle: "把分析和策划串起来", bullets: ["用一个真实项目写 1 份简版可行性分析", "列出 3 个关键风险", "再生成练习验证理解"] },
      ],
    };
  }
  if (normalizedSection.includes("第三章")) {
    return {
      chapterTitle: "第三章：软件需求分析与文档建模",
      focus: "把模糊需求转成可沟通、可验证、可实现的模型与文档。",
      keywords: ["需求获取", "需求分析", "数据流图", "用例图", "需求规格说明"],
      handoutSections: [
        `## ${courseTitle} · ${normalizedSection}\n\n这一章最重要的能力，是把用户想法、业务流程和系统边界表达成团队都能理解的需求文档。`,
        "### 需求分析主线\n- 从用户问题和业务流程出发\n- 明确功能需求与非功能需求\n- 把自然语言需求转成结构化模型",
        "### 常见建模方式\n- 数据流图：看信息如何流动\n- 用例图：看角色与系统交互\n- 需求规格说明书：沉淀范围、规则与约束",
        "### 易错点\n- 只记录表面诉求，不追问真实业务目标\n- 功能需求写得很多，却没有验收标准\n- 模型画出来了，但和文字说明不一致",
        "### 复习重点\n- 会区分需求获取、分析、建模的作用\n- 会说明数据流图和用例图分别解决什么问题\n- 能写出一个小系统的关键需求条目",
      ],
      practiceQuestions: [
        { id: "practice-1", question: `《${normalizedSection}》里需求分析的核心作用是什么？`, options: ["把模糊诉求转成可实现的系统需求", "只做页面配色决策", "只写总结不建模", "先跳过用户场景"], answer: ["A"], explanation: "需求分析要把业务诉求转化为清晰、可实现、可验证的需求。", questionType: "single", knowledgeTag: "需求分析" },
        { id: "practice-2", question: "以下哪些更适合用于需求建模？", options: ["数据流图", "用例图", "需求规格说明书", "实体关系分析"], answer: ["A", "B", "C", "D"], explanation: "这些都是需求阶段常见的表达与分析方式。", questionType: "multiple", knowledgeTag: "文档建模" },
        { id: "practice-3", question: "需求文档最需要避免的问题是什么？", options: ["描述模糊、没有边界和验收标准", "标题过短", "页数不够多", "字体不够大"], answer: ["A"], explanation: "模糊需求会直接影响设计、开发和测试质量。", questionType: "single", knowledgeTag: "需求文档" },
        { id: "practice-4", question: `请用自己的话说明《${normalizedSection}》中“需求获取”和“需求分析”的区别。`, options: [], answer: [], explanation: "获取偏收集，分析偏提炼与结构化，两者不能混为一谈。", questionType: "short", knowledgeTag: "概念辨析" },
        { id: "practice-5", question: "当用户说“系统要好用”时，你下一步更合理的动作是什么？", options: ["追问具体场景、角色和验收标准", "直接开始设计数据库", "先做动画效果", "把这句原样抄进文档"], answer: ["A"], explanation: "抽象诉求必须继续拆解，否则无法形成可执行需求。", questionType: "single", knowledgeTag: "需求获取" },
      ],
      pptSummary: "围绕需求获取、分析、建模与规格说明组织成更贴近软件工程课程的章节课件。",
      pptSlides: [
        { kind: "cover", title: `${courseTitle}`, subtitle: normalizedSection, bullets: ["把模糊诉求转成明确需求"] },
        { kind: "agenda", title: "本节结构", subtitle: "需求获取到文档建模", bullets: ["需求为什么重要", "如何分析与分解", "常见建模工具", "文档如何支撑后续开发"] },
        { kind: "content", title: "01 需求分析解决什么问题", subtitle: "统一理解与边界", bullets: ["把用户语言转成系统语言", "明确功能与非功能要求", "减少返工与沟通偏差"] },
        { kind: "content", title: "02 需求获取与整理", subtitle: "来源决定质量", bullets: ["访谈、观察、问卷、业务资料", "识别核心角色与典型场景", "提炼优先级和约束条件"] },
        { kind: "content", title: "03 建模表达", subtitle: "让需求可被讨论与验证", bullets: ["数据流图体现信息流动", "用例图体现角色交互", "规格说明书沉淀细节与边界"] },
        { kind: "content", title: "04 易错与答辩点", subtitle: "证明你理解需求工程", bullets: ["不要停留在表面描述", "必须补足边界与验收标准", "模型和文档要互相印证"] },
        { kind: "ending", title: "复习动作", subtitle: "让需求真正落地", bullets: ["选一个功能场景写需求条目", "补 1 张简单用例图", "再做练习巩固"] },
      ],
    };
  }
  if (normalizedSection.includes("第四章")) {
    return {
      chapterTitle: "第四章：软件设计、测试与项目管理",
      focus: "把需求落到设计、实现、测试与项目协同，确保系统可交付、可维护。",
      keywords: ["概要设计", "详细设计", "软件测试", "项目管理", "质量保证"],
      handoutSections: [
        `## ${courseTitle} · ${normalizedSection}\n\n这一章把前面的分析结果真正推进到工程交付：既要设计结构，也要控制质量、进度和团队协同。`,
        "### 设计到交付主线\n- 先做概要设计，明确系统结构\n- 再做详细设计，落到模块与接口\n- 配合测试与项目管理保证质量和进度",
        "### 测试核心\n- 测试不是最后补一下，而是贯穿开发全过程\n- 常见包括单元测试、集成测试、系统测试和验收测试",
        "### 项目管理关注点\n- 进度、成本、质量三者平衡\n- 团队协作与沟通机制\n- 风险跟踪与变更控制",
        "### 复习重点\n- 会区分概要设计与详细设计\n- 会说明不同测试层次的作用\n- 能描述项目管理如何支撑软件交付",
      ],
      practiceQuestions: [
        { id: "practice-1", question: `《${normalizedSection}》中软件设计的目标更接近什么？`, options: ["把需求转成可实现的系统结构与模块方案", "只决定页面配色", "只负责写总结", "只在项目结束后再考虑"], answer: ["A"], explanation: "设计阶段要把需求转化为结构、模块、接口和实现方案。", questionType: "single", knowledgeTag: "软件设计" },
        { id: "practice-2", question: "以下哪些属于常见的软件测试层次？", options: ["单元测试", "集成测试", "系统测试", "验收测试"], answer: ["A", "B", "C", "D"], explanation: "这些都是经典的软件测试层次。", questionType: "multiple", knowledgeTag: "软件测试" },
        { id: "practice-3", question: "项目管理最需要平衡的因素通常包括哪些？", options: ["进度", "成本", "质量", "团队协同"], answer: ["A", "B", "C", "D"], explanation: "项目管理不是只盯时间，而是综合平衡进度、成本、质量和协作。", questionType: "multiple", knowledgeTag: "项目管理" },
        { id: "practice-4", question: `请简述《${normalizedSection}》里概要设计与详细设计的差别。`, options: [], answer: [], explanation: "概要设计看整体结构，详细设计看模块内部实现与接口细节。", questionType: "short", knowledgeTag: "概念辨析" },
        { id: "practice-5", question: "如果项目进度紧张但缺陷持续上升，最合理的处理是什么？", options: ["重新评估计划并增加质量控制", "直接忽略测试", "先上线再说", "只换一套新配色"], answer: ["A"], explanation: "项目管理需要平衡进度和质量，不能用牺牲质量换表面按期。", questionType: "single", knowledgeTag: "质量控制" },
      ],
      pptSummary: "围绕系统设计、测试层次、质量保证和项目管理组织成更完整的软件工程交付课件。",
      pptSlides: [
        { kind: "cover", title: `${courseTitle}`, subtitle: normalizedSection, bullets: ["从设计走向测试与项目交付"] },
        { kind: "agenda", title: "本节结构", subtitle: "设计、测试、管理一体化", bullets: ["设计阶段做什么", "测试如何保证质量", "项目管理如何控节奏", "答辩时怎么讲交付能力"] },
        { kind: "content", title: "01 软件设计目标", subtitle: "把需求变成结构", bullets: ["概要设计明确系统结构", "详细设计落到模块、接口和算法", "设计质量直接影响后续开发与维护"] },
        { kind: "content", title: "02 测试层次", subtitle: "质量不是最后补救", bullets: ["单元测试保证局部正确", "集成测试关注模块协作", "系统与验收测试关注整体交付"] },
        { kind: "content", title: "03 项目管理抓手", subtitle: "让团队按质量交付", bullets: ["进度、成本、质量平衡", "沟通机制与角色协同", "风险跟踪与变更控制"] },
        { kind: "content", title: "04 答辩表达重点", subtitle: "体现工程完整性", bullets: ["设计决定结构", "测试保证质量", "管理保障落地", "三者共同支撑系统交付"] },
        { kind: "ending", title: "复习动作", subtitle: "形成交付视角", bullets: ["画出设计到测试流程", "整理测试层次区别", "复盘一个项目管理风险案例"] },
      ],
    };
  }
  return {
    chapterTitle: "第一章：软件工程基础与软件危机",
    focus: "理解软件危机为什么出现，以及软件工程如何用过程、方法与工具来控制复杂度。",
    keywords: ["软件危机", "软件工程", "生命周期", "过程模型", "质量属性"],
    handoutSections: [
      `## ${courseTitle} · ${normalizedSection}\n\n这一章不是在背定义，而是在回答一个根本问题：软件项目为什么总会失控，软件工程又如何把这种失控拉回可治理状态。`,
      "### 软件危机主线\n- 需求变化快、规模越来越大\n- 开发过程缺规范，质量和进度失控\n- 维护成本高，团队协作困难",
      "### 软件工程要解决什么\n- 用过程、方法和工具控制复杂度\n- 用文档、模型和规范提升可沟通性\n- 用质量管理降低返工和风险",
      "### 生命周期与过程模型\n- 生命周期强调从立项到维护的完整阶段\n- 典型过程模型包括瀑布、原型、增量、迭代等\n- 不同模型适配不同项目场景",
      "### 复习重点\n- 会说清软件危机的表现\n- 会解释软件工程的目标\n- 会举例说明生命周期和过程模型的作用",
    ],
    practiceQuestions: [
      { id: "practice-1", question: `《${normalizedSection}》里“软件危机”主要反映了什么问题？`, options: ["软件项目复杂度提升后质量、进度和成本难以控制", "界面颜色不够统一", "按钮太少", "文档标题不够长"], answer: ["A"], explanation: "软件危机强调的是复杂项目中普遍出现的质量、进度、成本与维护失控。", questionType: "single", knowledgeTag: "软件危机" },
      { id: "practice-2", question: "软件工程希望通过哪些方式缓解软件危机？", options: ["规范过程", "方法支持", "工具辅助", "质量控制"], answer: ["A", "B", "C", "D"], explanation: "软件工程本质上就是用过程、方法、工具和管理把复杂开发变得可控。", questionType: "multiple", knowledgeTag: "软件工程目标" },
      { id: "practice-3", question: "下列哪项更符合软件生命周期的理解？", options: ["从立项到维护的一整套阶段过程", "只指编码阶段", "只在测试后才开始", "只是一份总结文档"], answer: ["A"], explanation: "生命周期强调软件从提出到退役的全阶段过程。", questionType: "single", knowledgeTag: "生命周期" },
      { id: "practice-4", question: `请用 2 到 3 句话说明《${normalizedSection}》里为什么会出现“软件危机”。`, options: [], answer: [], explanation: "可以从规模扩大、需求变化、沟通协作和质量失控几个角度回答。", questionType: "short", knowledgeTag: "原因分析" },
      { id: "practice-5", question: "如果一个团队总是延期、返工、缺陷多，你更应该优先补哪方面能力？", options: ["过程规范与工程管理能力", "页面装饰风格", "标题长度", "动画数量"], answer: ["A"], explanation: "这类问题通常反映的是工程过程和质量控制能力不足。", questionType: "single", knowledgeTag: "场景迁移" },
    ],
    pptSummary: "围绕软件危机、软件工程目标、生命周期与过程模型整理成更贴合课程第一章的课件。",
    pptSlides: [
      { kind: "cover", title: `${courseTitle}`, subtitle: normalizedSection, bullets: ["理解软件危机与软件工程的诞生背景"] },
      { kind: "agenda", title: "本节结构", subtitle: "先看问题，再看解决路径", bullets: ["什么是软件危机", "软件工程要解决什么", "生命周期如何组织开发", "典型过程模型怎么选"] },
      { kind: "content", title: "01 软件危机是什么", subtitle: "为什么项目经常失控", bullets: ["规模扩大、需求变化快", "质量、进度、成本难以稳定控制", "维护困难、协作成本上升"] },
      { kind: "content", title: "02 软件工程的目标", subtitle: "把复杂开发变成可治理过程", bullets: ["引入规范过程和文档体系", "沉淀方法、工具与质量控制", "提升协作效率和系统可维护性"] },
      { kind: "content", title: "03 生命周期视角", subtitle: "软件不是只看编码", bullets: ["立项、分析、设计、实现、测试、维护构成完整链路", "每一阶段都有自己的产出与职责", "前期工作越清晰，后期返工越少"] },
      { kind: "content", title: "04 过程模型选择", subtitle: "不同场景用不同组织方式", bullets: ["瀑布模型适合需求稳定场景", "原型和迭代模型更适合需求需持续澄清的项目", "模型选择本质上是风险控制策略"] },
      { kind: "ending", title: "复习动作", subtitle: "把概念变成判断能力", bullets: ["归纳软件危机三种典型表现", "比较两种过程模型差异", "再做一轮练习验证理解"] },
    ],
  };
}

function buildTopicKeywords(courseTitle: string, sectionTitle: string, resourceLines: string[]) {
  if (courseTitle.includes("软件工程")) {
    return buildSoftwareEngineeringChapterProfile(courseTitle, sectionTitle).keywords;
  }
  const source = `${courseTitle} ${sectionTitle} ${resourceLines.slice(0, 8).join(" ")}`;
  const candidates = [
    "核心概念",
    "结构关系",
    "实现路径",
    "质量验证",
    "应用场景",
    "上下游依赖",
    "知识导图",
    "随堂练习",
    "学习闭环",
    "课堂资源",
    "测评反馈",
    "岗位实训导师",
  ];
  const matched = candidates.filter((item) => source.toLowerCase().includes(item.toLowerCase()));
  return (matched.length ? matched : ["问题背景", "结构拆解", "场景落地", "复盘迁移"]).slice(0, 4);
}

function parseMermaidMindmap(markdown: string, fallbackTitle: string): MindmapNode[] | null {
  const match = markdown.match(/```mermaid\s+mindmap([\s\S]*?)```/i);
  if (!match) return null;
  const body = match[1]
    .split("\n")
    .map((line) => line.replace(/\t/g, "    "))
    .filter((line) => line.trim().length > 0);
  if (!body.length) return null;

  const rootNode: MindmapNode = {
    id: "mindmap-root",
    label: fallbackTitle,
    depth: 0,
    children: [],
  };
  const stack: Array<{ indent: number; node: MindmapNode }> = [{ indent: -1, node: rootNode }];
  let nodeIndex = 0;

  for (const rawLine of body) {
    const indent = rawLine.match(/^\s*/)?.[0].length ?? 0;
    let label = rawLine.trim();
    if (!label) continue;
    if (label.startsWith("root((") && label.endsWith("))")) {
      rootNode.label = label.slice(6, -2).trim() || fallbackTitle;
      continue;
    }
    label = label
      .replace(/^[-*]\s*/, "")
      .replace(/^[A-Za-z0-9_\-\u4e00-\u9fa5]+::/, "")
      .replace(/\(\(/g, "")
      .replace(/\)\)/g, "")
      .trim();
    if (!label) continue;

    const node: MindmapNode = {
      id: `mindmap-node-${++nodeIndex}`,
      label,
      depth: 1,
      children: [],
    };
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    node.depth = stack.length;
    stack[stack.length - 1].node.children.push(node);
    stack.push({ indent, node });
  }

  return rootNode.children.length ? [rootNode] : null;
}

function parseTeachingPlanSlides(resources: ResourceCard[], courseTitle: string, sectionTitle: string): DeckSlide[] {
  const teachingPlan = resources.find((item) => item.resource_type === "ppt" || item.resource_type === "teaching_plan");
  if (!teachingPlan?.content_markdown) return [];

  const lines = teachingPlan.content_markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const slideMap = new Map<string, string[]>();
  let currentSlideTitle = "";
  for (const line of lines) {
    const headingMatch = line.match(/^###\s+(.+)$/);
    const headingText = headingMatch?.[1]?.trim() || "";
    if (headingText && /^\D*\d+/.test(headingText)) {
      currentSlideTitle = headingText.replace(/^\D*\d+\s*\D{0,3}\s*/, "").trim() || headingText;
      slideMap.set(currentSlideTitle, []);
      continue;
    }
    if (currentSlideTitle && /^-\s+/.test(line)) {
      slideMap.get(currentSlideTitle)?.push(normalizeResourceLine(line));
    }
  }

  const entries = Array.from(slideMap.entries());
  if (!entries.length) return [];

  return [
    {
      kind: "cover" as const,
      title: `${courseTitle} · ${sectionTitle}`,
      subtitle: "课堂课件导出版",
      bullets: ["基于教学脚本生成，可直接用于展示、导出和答辩讲解"],
    },
    ...entries.map(([title, bullets], index) => ({
      kind: "content" as const,
      title: `${String(index + 1).padStart(2, "0")} ${title}`,
      subtitle: bullets[0] || `${sectionTitle} 课堂讲解页`,
      bullets: bullets.slice(0, 4),
    })),
    {
      kind: "ending" as const,
      title: "课后行动",
      subtitle: "形成学习闭环",
    bullets: ["回看讲义主线", "结合导图复盘结构关系", "完成练习并继续追问岗位实训导师"],
    },
  ];
}

function buildCourseDeckSlides(
  resources: ResourceCard[],
  courseTitle: string,
  sectionTitle: string,
  outlineLines: string[] = [],
  templateId: PptTemplateId = "academic",
): DeckSlide[] {
  const planSlides = parseTeachingPlanSlides(resources, courseTitle, sectionTitle);
  const cleanOutline = outlineLines.map((item) => item.trim()).filter(Boolean).slice(0, 8);
  if (cleanOutline.length >= 3) {
    const generatedSlides: DeckSlide[] = [
      {
        kind: "cover" as const,
        title: courseTitle,
        subtitle: sectionTitle,
        bullets: ["按已确认大纲生成，可继续编辑、播放和导出"],
      },
      {
        kind: "agenda" as const,
        title: "课件目录",
        subtitle: "先确认结构，再展开内容",
        bullets: cleanOutline.slice(0, 6),
      },
      ...cleanOutline.map((outline, index) => ({
        kind: "content" as const,
        title: `${String(index + 1).padStart(2, "0")} ${outline}`,
        subtitle:
          index === 0
            ? "先说明本页为什么重要"
            : index === cleanOutline.length - 1
              ? "收束到复习、练习或答辩表达"
              : "围绕本页主题展开关键结构",
        bullets: [
          `核心观点：${outline}`,
          "讲解方式：先给定义或背景，再说明结构关系",
          "课堂落点：结合当前章节案例或项目任务解释",
          "检查方式：用一个问题、练习或答辩表达验证理解",
        ],
      })),
      {
        kind: "ending" as const,
        title: "学习闭环",
        subtitle: "讲义、导图、课件和练习保持同一条主线",
        bullets: ["回看大纲是否完整", "补充需要展开的细节", "用练习验证是否真正掌握"],
      },
    ];
    return attachPptIllustrations(applyPptTemplate(generatedSlides, templateId), courseTitle, sectionTitle);
  }
  if (courseTitle.includes("软件工程")) {
    const profile = buildSoftwareEngineeringChapterProfile(courseTitle, sectionTitle);
    const slides = planSlides.length >= 6
      ? planSlides
      : planSlides.length
        ? [planSlides[0], ...profile.pptSlides.slice(1)]
        : profile.pptSlides;
    return attachPptIllustrations(applyPptTemplate(slides, templateId), courseTitle, sectionTitle);
  }
  const resourceLines = dedupePreviewLines(
    resources.flatMap((item) => extractResourceOutline(item.content_markdown || "")),
    24,
  );
  const planHighlights = planSlides.flatMap((slide) => slide.bullets).slice(0, 4);
  const topicKeywords = buildTopicKeywords(courseTitle, sectionTitle, resourceLines);
  const professionalContext = `${courseTitle} · ${sectionTitle}`;
  const mainArgument = `本节的核心价值在于把零散知识点串成完整主线：知道它是什么，更知道它为什么重要、怎么落地、怎样用于项目与答辩表达。`;
  const contentSlides: DeckSlide[] = [
    {
      kind: "content" as const,
      title: "01 章节定位：先回答这节课在解决什么问题",
      subtitle: "先抓主线，再展开细节",
      bullets: [
        "先说清这一章的核心问题是什么，为什么它值得单独学习",
        "再说明它与前后章节如何衔接，而不是把概念孤立记忆",
        "最后把知识点放回真实项目、课堂任务或比赛答辩场景中理解",
        planHighlights[0] || `本节结论：${sectionTitle} 应被讲成一条完整的学习与应用主线，而不是零散知识点集合`,
      ],
    },
    {
      kind: "content" as const,
      title: "02 核心结构：这节课内部由哪些部分组成",
      subtitle: "从结构关系入手建立整体感",
      bullets: [
        "先拆清主概念、子模块、流程或文档之间的关系",
        "注意哪些是上游输入，哪些是中间过程，哪些是最终输出",
        "结构越清楚，后面的做题、讲解和答辩表达就越稳定",
        planHighlights[1] || "建议先画出主线，再补充细节，不要一开始就钻进局部术语。",
      ],
    },
    {
      kind: "content" as const,
      title: "03 关系梳理：把概念边界和上下游关系讲透",
      subtitle: "避免只会背名词，不会解释联系",
      bullets: [
        "解释每个核心概念分别解决什么问题，它们之间又如何衔接",
        "对容易混淆的相邻概念，要主动给出边界和区别",
        "把知识点放进一条完整链路里，理解通常比死记硬背更牢靠",
        `关键词映射：${topicKeywords.join(" / ")} 不是孤立概念，而是这一章的主线组成部分`,
      ],
    },
    {
      kind: "content" as const,
      title: "04 场景迁移：把知识点放回真实任务里验证",
      subtitle: "让课堂内容具备项目落地感",
      bullets: [
        "试着回答：如果把这节内容用到课程设计、项目开发或比赛答辩里，该怎么讲",
        "优先关注哪些判断会直接影响结果质量，而不是只看表面形式",
        "能举出一个应用场景，通常比能背出三个术语更能说明你真的掌握了",
        "把知识点迁移到真实任务，是检验理解深度的最好方式之一",
      ],
    },
    {
      kind: "content" as const,
      title: "05 复习策略：怎样把这一章真正学会",
      subtitle: "从看懂到讲清，再到会用",
      bullets: [
        "先看讲义梳理主线，再用导图建立结构，再通过练习验证掌握情况",
        "做题时不要只看答案，要回到概念边界和结构关系找原因",
        "如果能用自己的话复述主线，再举出一个真实场景，基本就算真正理解了",
        "最后把易错点整理出来，下一轮复习会更有针对性",
      ],
    },
    {
      kind: "content" as const,
      title: "06 闭环价值：为什么要同时有讲义、导图、练习和 PPT",
      subtitle: "不同资源服务不同学习动作",
      bullets: [
        "讲义负责精读，导图负责建立结构，练习负责验证掌握度，PPT负责展示与答辩表达",
        "四类资源不是重复生成，而是在同一知识点上提供不同视角的支撑",
        "资源形态越完整，后续问答、复习和学习报告就越容易形成真正闭环",
        "多资源协同的目标不是炫技，而是降低理解门槛、提高迁移效率",
      ],
    },
    {
      kind: "content" as const,
      title: "07 结果衡量：怎样判断这一章真的学会了",
      subtitle: "从会看走到会讲、会做、会迁移",
      bullets: [
        "是否能用自己的话复述主线，而不是重复原文",
        "是否能解释关键概念之间的边界和联系",
        "是否能把知识点迁移到真实项目、课堂任务或答辩场景",
        "是否能通过练习和错因复盘证明理解不是停留在表面",
      ],
    },
    {
      kind: "content" as const,
      title: "08 答辩表达：把这一章讲成评委能听懂的完整故事",
      subtitle: "从问题、结构到落地，形成稳定叙述",
      bullets: [
        mainArgument,
        "先讲背景和问题，再讲核心结构，最后讲它在项目里的实际价值",
        "当你能把一章内容讲成完整故事，评委看到的就不只是知识点，而是工程理解能力",
        "真正的竞争力来自学习闭环：学什么、怎么学、如何验证、怎样继续改进，都能被系统支撑",
      ],
    },
  ].filter((slide) => slide.bullets.length > 0) satisfies DeckSlide[];

  if (!contentSlides.length) {
    return attachPptIllustrations([
      {
        kind: "cover" as const,
        title: courseTitle,
        subtitle: sectionTitle,
        bullets: ["当前没有足够的课件内容可以导出。"],
      },
    ], courseTitle, sectionTitle);
  }

  return attachPptIllustrations(applyPptTemplate([
    {
      kind: "cover" as const,
      title: professionalContext,
      subtitle: "高级工程汇报版：架构治理、智能闭环与产品化表达",
      bullets: ["从单页功能演示升级为可用于答辩的系统设计叙事"],
    },
    {
      kind: "agenda" as const,
      title: "高级汇报目录",
      subtitle: "按“洞察 -> 张力 -> 架构 -> 权衡 -> 指标 -> 路线”的逻辑组织",
      bullets: contentSlides.map((slide) => slide.title).slice(0, 6),
    },
    ...contentSlides,
    {
      kind: "ending" as const,
      title: "Appendix：评委追问准备",
      subtitle: "提前准备能体现专业度的追问答案",
      bullets: [
        "如果被问“为什么不是普通播放器”：回答学习行为回流、智能资源生成和能力画像闭环",
        "如果被问“为什么架构复杂”：回答多模块异步协作需要边界治理，否则后续功能不可维护",
        "如果被问“如何证明有效”：回答用生成成功率、复习触达率、掌握度提升和证据复用率验证",
      ],
    },
  ], templateId), courseTitle, sectionTitle);
}

function buildResourceSummary(resource?: ResourceCard | null, fallback?: string) {
  const outline = extractResourceOutline(resource?.content_markdown || "");
  return sanitizeWorkspaceText(
    outline.find((line) => line.length >= 10) ||
    resource?.study_suggestion ||
    resource?.summary ||
    fallback ||
    "已根据当前课堂内容完成整理。",
    fallback || "已根据当前课堂内容完成整理。",
  );
}

function buildDefaultResourceOutline(courseTitle: string, sectionTitle: string) {
  const normalizedSection = sectionTitle.trim() || "当前章节";
  if (courseTitle.includes("软件工程")) {
    return [
      `${normalizedSection} 的课程定位与学习目标`,
      "核心概念、关键术语和边界辨析",
      "软件工程流程中的阶段产出与协作关系",
      "结合课程设计或项目案例说明应用方式",
      "易错点、答辩表达和课后练习安排",
    ];
  }
  return [
    `${normalizedSection} 的问题背景与学习目标`,
    "核心概念和关键结构拆解",
    "重要流程、公式或方法的使用边界",
    "课堂案例与真实任务中的应用方式",
    "易错点总结和课后巩固任务",
  ];
}

function parseEditableOutline(value: string, courseTitle: string, sectionTitle: string) {
  const lines = value
    .split("\n")
    .map((line) => normalizeResourceLine(line))
    .filter(Boolean);
  return (lines.length ? lines : buildDefaultResourceOutline(courseTitle, sectionTitle)).slice(0, 8);
}

function buildOutlineMarkdown(outlineLines: string[]) {
  return outlineLines.map((line, index) => `${index + 1}. ${line}`).join("\n");
}

type PptTemplateId = "academic" | "defense" | "warm" | "chalkboard" | "techGrid" | "minimalReport";

const PPT_TEMPLATE_OPTIONS: Array<{
  id: PptTemplateId;
  label: string;
  detail: string;
  source: string;
  layout: "whiteboard" | "report" | "warmClass" | "chalkboard" | "techGrid" | "minimal";
  swatches: string[];
}> = [
  {
    id: "academic",
    label: "学术白板",
    detail: "适合课程讲解，页面克制、留白清楚。",
    source: "参考 Canva 教育课件",
    layout: "whiteboard",
    swatches: ["#FFFFFF", "#DEB7A8", "#DDE7B5"],
  },
  {
    id: "defense",
    label: "蓝色答辩",
    detail: "适合项目汇报，重点突出、结构更硬朗。",
    source: "参考 Slidesgo 技术答辩",
    layout: "report",
    swatches: ["#0F2A5F", "#2F6BFF", "#EAF1FF"],
  },
  {
    id: "warm",
    label: "暖色课堂",
    detail: "适合教学展示，亲和、层次更明显。",
    source: "参考 SlidesCarnival 教学模板",
    layout: "warmClass",
    swatches: ["#FFF7ED", "#F97316", "#FED7AA"],
  },
  {
    id: "chalkboard",
    label: "黑板板书",
    detail: "适合概念讲解，像课堂板书一样按层级展开。",
    source: "参考 Microsoft 教育模板",
    layout: "chalkboard",
    swatches: ["#102A2A", "#DFF7EF", "#F8D47A"],
  },
  {
    id: "techGrid",
    label: "科技网格",
    detail: "适合软件工程、系统设计和流程架构展示。",
    source: "参考 Slidesgo 科技课件",
    layout: "techGrid",
    swatches: ["#08111F", "#20D3EE", "#7C3AED"],
  },
  {
    id: "minimalReport",
    label: "极简报告",
    detail: "适合正式汇报，图文比例稳定、信息密度高。",
    source: "参考 Canva 商务报告",
    layout: "minimal",
    swatches: ["#F8FAFC", "#111827", "#94A3B8"],
  },
];

function applyPptTemplate(slides: DeckSlide[], templateId: PptTemplateId): DeckSlide[] {
  return slides.map((slide) => ({
    ...slide,
    accent: templateId,
  }));
}

function getPptTemplateOption(templateId?: string | null) {
  return PPT_TEMPLATE_OPTIONS.find((item) => item.id === templateId) || PPT_TEMPLATE_OPTIONS[0];
}

function getSlideTemplateId(slide?: Pick<DeckSlide, "accent"> | null): PptTemplateId {
  const accent = String(slide?.accent || "");
  return PPT_TEMPLATE_OPTIONS.some((item) => item.id === accent) ? (accent as PptTemplateId) : "academic";
}

function PptTemplateMiniPreview({ template }: { template: (typeof PPT_TEMPLATE_OPTIONS)[number] }) {
  const [background, ink, accent] = template.swatches;
  return (
    <div className="relative h-14 w-[86px] shrink-0 overflow-hidden rounded-md border border-[#D4DCE6] bg-white">
      <div className="absolute inset-0" style={{ background }} />
      {template.layout === "report" ? (
        <>
          <div className="absolute left-0 top-0 h-full w-4" style={{ backgroundColor: ink }} />
          <div className="absolute left-6 top-3 h-1.5 w-10 rounded-full" style={{ backgroundColor: accent }} />
          <div className="absolute left-6 top-6 h-2 w-14 rounded-sm bg-white/90" />
          <div className="absolute left-6 top-10 h-1 w-9 rounded-full bg-white/70" />
        </>
      ) : template.layout === "chalkboard" ? (
        <>
          <div className="absolute inset-1 rounded border border-white/20" />
          <div className="absolute left-3 top-3 h-1 w-12 rounded-full" style={{ backgroundColor: ink }} />
          <div className="absolute left-3 top-7 h-1 w-9 rounded-full bg-white/70" />
          <div className="absolute bottom-2 left-3 h-1 w-16 rounded-full" style={{ backgroundColor: accent }} />
        </>
      ) : template.layout === "techGrid" ? (
        <>
          <div className="absolute inset-0 opacity-35" style={{ backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`, backgroundSize: "14px 14px" }} />
          <div className="absolute left-3 top-3 h-1.5 w-14 rounded-full" style={{ backgroundColor: accent }} />
          <div className="absolute bottom-3 right-3 h-5 w-8 rounded border border-white/30 bg-white/10" />
        </>
      ) : template.layout === "minimal" ? (
        <>
          <div className="absolute left-3 top-3 h-1.5 w-16 rounded-full" style={{ backgroundColor: ink }} />
          <div className="absolute left-3 top-7 h-1 w-11 rounded-full" style={{ backgroundColor: accent }} />
          <div className="absolute bottom-3 left-3 right-3 grid grid-cols-3 gap-1">
            <span className="h-4 rounded bg-white" />
            <span className="h-4 rounded bg-white" />
            <span className="h-4 rounded bg-white" />
          </div>
        </>
      ) : template.layout === "warmClass" ? (
        <>
          <div className="absolute left-2 top-2 h-9 w-10 rounded-lg bg-white/85" />
          <div className="absolute right-2 top-3 h-1.5 w-8 rounded-full" style={{ backgroundColor: ink }} />
          <div className="absolute right-2 top-7 h-1 w-12 rounded-full" style={{ backgroundColor: accent }} />
          <div className="absolute bottom-2 right-2 h-2 w-10 rounded-full" style={{ backgroundColor: ink }} />
        </>
      ) : (
        <>
          <div className="absolute left-0 top-0 h-full w-2" style={{ backgroundColor: accent }} />
          <div className="absolute left-4 top-3 h-2 w-14 rounded-full" style={{ backgroundColor: ink }} />
          <div className="absolute left-4 top-7 h-1 w-10 rounded-full bg-[#CBD5E1]" />
          <div className="absolute bottom-3 left-4 h-4 w-14 rounded bg-white/90" />
        </>
      )}
    </div>
  );
}

function PptTemplateDeckPreview({
  template,
  compact = false,
}: {
  template: (typeof PPT_TEMPLATE_OPTIONS)[number];
  compact?: boolean;
}) {
  const [surface, ink, accent] = template.swatches;
  const dark = template.layout === "chalkboard" || template.layout === "techGrid" || template.layout === "report";
  const slideBase = `relative overflow-hidden rounded-md border ${dark ? "border-white/15" : "border-[#D4DCE6]"} shadow-sm`;
  const titleColor = dark ? "bg-white/85" : "bg-[#111827]";
  const mutedColor = dark ? "bg-white/45" : "bg-[#CBD5E1]";
  const canvasStyle =
    template.layout === "techGrid"
      ? {
          background: surface,
          backgroundImage: `linear-gradient(${accent}55 1px, transparent 1px), linear-gradient(90deg, ${accent}55 1px, transparent 1px)`,
          backgroundSize: compact ? "13px 13px" : "18px 18px",
        }
      : { background: surface };

  return (
    <div className={compact ? "grid grid-cols-[1.25fr_0.78fr_0.78fr] gap-1.5" : "grid grid-cols-[1.25fr_0.78fr_0.78fr] gap-2"}>
      <div className={`${slideBase} ${compact ? "h-[58px]" : "h-[118px]"} p-2`} style={canvasStyle}>
        {template.layout === "report" ? <div className="absolute left-0 top-0 h-full w-[18%]" style={{ backgroundColor: ink }} /> : null}
        {template.layout === "whiteboard" ? <div className="absolute left-0 top-0 h-full w-2" style={{ backgroundColor: accent }} /> : null}
        {template.layout === "chalkboard" ? <div className="absolute inset-2 rounded border border-white/20" /> : null}
        {template.layout === "minimal" ? <div className="absolute left-0 top-0 h-1.5 w-full" style={{ backgroundColor: ink }} /> : null}
        {template.layout === "warmClass" ? <div className="absolute -left-5 -top-5 h-16 w-20 rounded-full bg-white/80" /> : null}
        <div className={`relative z-10 flex h-full flex-col justify-between ${template.layout === "report" ? "ml-[18%]" : ""}`}>
          <div>
            <div className="h-1.5 w-12 rounded-full" style={{ backgroundColor: accent }} />
            <div className={`mt-2 h-2 ${compact ? "w-16" : "w-24"} rounded-full ${titleColor}`} />
            <div className={`mt-1.5 h-1 ${compact ? "w-12" : "w-20"} rounded-full ${mutedColor}`} />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <span className="h-3 rounded bg-white/60" />
            <span className="h-3 rounded bg-white/40" />
            <span className="h-3 rounded bg-white/60" />
          </div>
        </div>
      </div>

      <div className={`${slideBase} ${compact ? "h-[58px]" : "h-[118px]"} p-2`} style={canvasStyle}>
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div>
            <div className={`h-1.5 ${compact ? "w-10" : "w-14"} rounded-full ${titleColor}`} />
            <div className={`mt-1.5 h-1 ${compact ? "w-8" : "w-11"} rounded-full ${mutedColor}`} />
          </div>
          <div className="space-y-1.5">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
                <span className={`h-1 flex-1 rounded-full ${mutedColor}`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`${slideBase} ${compact ? "h-[58px]" : "h-[118px]"} p-2`} style={canvasStyle}>
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className={`h-1.5 ${compact ? "w-9" : "w-14"} rounded-full ${titleColor}`} />
          <div className="grid grid-cols-2 gap-1.5">
            <span className="h-4 rounded bg-white/70" />
            <span className="h-4 rounded bg-white/45" />
            <span className="h-4 rounded bg-white/45" />
            <span className="h-4 rounded bg-white/70" />
          </div>
          <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: accent }} />
        </div>
      </div>
    </div>
  );
}

function PptSlideThumbnail({
  slide,
  active = false,
  small = false,
}: {
  slide: ReturnType<typeof buildPptPreviewCards>[number];
  active?: boolean;
  small?: boolean;
}) {
  const template = getPptTemplateOption(getSlideTemplateId({ accent: slide.accent }));
  const [surface, ink, accent] = template.swatches;
  const isDark = template.layout === "chalkboard" || template.layout === "techGrid" || template.layout === "report";
  const titleColor = isDark ? "text-white" : "text-[#111827]";
  const mutedColor = isDark ? "text-white/72" : "text-[#64748B]";
  const bulletDot = template.layout === "techGrid" ? "rounded-sm" : "rounded-full";
  return (
    <div
      className={`relative aspect-video overflow-hidden rounded-md border ${
        active ? "border-[#002FA7]" : "border-[#DCE7F7]"
      } ${small ? "p-2" : "p-3"}`}
      style={{ background: surface }}
    >
      {template.layout === "techGrid" ? (
        <div className="absolute inset-0 opacity-35" style={{ backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`, backgroundSize: "22px 22px" }} />
      ) : null}
      {template.layout === "report" ? <div className="absolute left-0 top-0 h-full w-4" style={{ backgroundColor: ink }} /> : null}
      {template.layout === "whiteboard" ? <div className="absolute left-0 top-0 h-full w-2" style={{ backgroundColor: accent }} /> : null}
      {template.layout === "warmClass" ? <div className="absolute -left-6 -top-6 h-20 w-24 rounded-full bg-white/80" /> : null}
      {template.layout === "chalkboard" ? <div className="absolute inset-2 rounded border border-white/15" /> : null}
      {template.layout === "minimal" ? <div className="absolute left-0 top-0 h-1.5 w-full" style={{ backgroundColor: ink }} /> : null}
      <div
        className={`relative z-10 flex h-full flex-col justify-between ${
          template.layout === "report" ? "ml-4" : ""
        } ${template.layout === "whiteboard" ? "ml-2 rounded-lg bg-white/84 p-2 ring-1 ring-white/80" : ""}`}
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-black ${
                isDark ? "bg-white/14 text-white" : "bg-white/80 text-[#002FA7]"
              }`}
            >
              {String(slide.index).padStart(2, "0")}
            </span>
            <span className={`text-[9px] font-black ${mutedColor}`}>{slide.typeLabel}</span>
          </div>
          <h4 className={`mt-2 line-clamp-2 ${small ? "text-[10px]" : "text-[13px]"} font-black leading-5 ${titleColor}`}>
            {slide.title}
          </h4>
          {!small && slide.subtitle ? <p className={`mt-1 line-clamp-1 text-[10px] font-semibold ${mutedColor}`}>{slide.subtitle}</p> : null}
        </div>
        <div className={small ? "space-y-1" : "space-y-1.5"}>
          {slide.bullets.slice(0, small ? 2 : 3).map((bullet, bulletIndex) => (
            <div key={`${slide.index}-${bulletIndex}`} className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 shrink-0 ${bulletDot}`} style={{ backgroundColor: accent }} />
              <span className={`line-clamp-1 ${small ? "text-[8.5px]" : "text-[9.5px]"} font-semibold ${mutedColor}`}>{bullet}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PptSlideStage({ slide, slideIndex }: { slide: DeckSlide; slideIndex: number }) {
  const template = getPptTemplateOption(getSlideTemplateId(slide));
  const [surface, ink, accent] = template.swatches;
  const isDark = template.layout === "chalkboard" || template.layout === "techGrid" || template.layout === "report";
  return (
    <div className="overflow-hidden ui-radius-28 border border-[#DCE7F7] bg-white shadow-[0_24px_48px_rgba(37,99,235,0.08)]">
      <div className="relative aspect-[16/9] p-6" style={{ background: surface }}>
        {template.layout === "techGrid" ? (
          <div className="absolute inset-0 opacity-35" style={{ backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`, backgroundSize: "32px 32px" }} />
        ) : null}
        {template.layout === "report" ? <div className="absolute left-0 top-0 h-full w-16" style={{ backgroundColor: ink }} /> : null}
        {template.layout === "whiteboard" ? <div className="absolute left-0 top-0 h-full w-3" style={{ backgroundColor: accent }} /> : null}
        {template.layout === "warmClass" ? <div className="absolute -left-12 -top-12 h-40 w-48 rounded-full bg-white/80" /> : null}
        {template.layout === "chalkboard" ? <div className="absolute inset-5 rounded-xl border border-white/15" /> : null}
        {template.layout === "minimal" ? <div className="absolute left-0 top-0 h-3 w-full" style={{ backgroundColor: ink }} /> : null}
        <div
          className={`relative z-10 grid h-full gap-4 ${
            template.layout === "report" ? "ml-14" : template.layout === "whiteboard" ? "ml-4" : ""
          } ${template.layout === "techGrid" || template.layout === "report" ? "lg:grid-cols-[minmax(0,1fr)_250px]" : "lg:grid-cols-[minmax(0,1fr)_250px]"} ${
            template.layout === "whiteboard" ? "ui-radius-22 bg-white/90 p-6 ring-1 ring-white/80" : "p-3"
          }`}
        >
          <div className="flex min-w-0 flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-black ${
                    isDark ? "bg-white/14 text-white" : "bg-[#FFF1F5] ui-text-brand"
                  }`}
                >
                  {slide.kind === "cover" ? "封面" : slide.kind === "agenda" ? "目录" : slide.kind === "ending" ? "结束页" : "内容页"}
                </span>
                <span className={`text-[10px] font-black ${isDark ? "text-white/55" : "ui-text-subtle"}`}>
                  {getPptTemplateOption(getSlideTemplateId(slide)).label} · 第 {slideIndex + 1} 页
                </span>
              </div>
              <h2 className={`mt-4 text-2xl font-black leading-tight ${isDark ? "text-white" : "ui-text-ink"}`}>{slide.title}</h2>
              {slide.subtitle ? <p className={`mt-3 text-sm font-semibold leading-6 ${isDark ? "text-white/72" : "ui-text-secondary"}`}>{slide.subtitle}</p> : null}
            </div>
            <div className="space-y-3">
              {slide.bullets.slice(0, 4).map((bullet, index) => (
                <div key={`${slideIndex}-${index}`} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white" style={{ backgroundColor: accent }}>
                    {index + 1}
                  </span>
                  <p className={`text-[13px] leading-6 ${isDark ? "text-white/86" : "ui-text-ink"}`}>{bullet}</p>
                </div>
              ))}
            </div>
          </div>
          <div className={`hidden min-h-0 rounded-2xl border p-4 lg:block ${isDark ? "border-white/14 bg-white/8" : "border-[#DCE7F7] bg-white/72"}`}>
            <div>
              <PptIllustrationScene illustration={slide.illustration} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildSlideIllustration(slide: DeckSlide, index: number, courseTitle: string, sectionTitle: string): NonNullable<DeckSlide["illustration"]> {
  if (slide.kind === "cover") {
    return {
      type: "scenario",
      title: "课程场景图",
      caption: `用课堂、资料和练习三个元素表现《${courseTitle}》的学习入口。`,
    };
  }
  if (slide.kind === "agenda") {
    return {
      type: "flow",
      title: "章节路线图",
      caption: `把《${sectionTitle}》拆成从目标、概念到练习的学习路径。`,
    };
  }
  if (slide.kind === "ending") {
    return {
      type: "summary",
      title: "学习闭环图",
      caption: "用讲义、导图、练习和答疑构成课后复习闭环。",
    };
  }
  const cleanTitle = slide.title.replace(/^\d+\s*/, "").replace(/^[：:、.\-\s]+/, "");
  return {
    type: index % 3 === 0 ? "flow" : index % 3 === 1 ? "concept" : "scenario",
    title: `${cleanTitle.slice(0, 12) || "本页"}图解`,
    caption: `围绕“${cleanTitle || slide.title}”生成结构图，帮助学生先看懂关系，再进入要点。`,
  };
}

function attachPptIllustrations(slides: DeckSlide[], courseTitle: string, sectionTitle: string): DeckSlide[] {
  return slides.map((slide, index) => ({
    ...slide,
    illustration: slide.illustration || buildSlideIllustration(slide, index, courseTitle, sectionTitle),
  }));
}

const PPT_ILLUSTRATION_IMAGE = "/generated-resource-illustrations/ppt/software-engineering-classroom.svg";

function PptIllustrationScene({
  illustration,
  compact = false,
}: {
  illustration?: DeckSlide["illustration"];
  compact?: boolean;
}) {
  const [imageReady, setImageReady] = useState(true);
  const title = (illustration?.title || "概念结构图").replace(/插画/g, "图解");
  const caption = (illustration?.caption || "用图像把本页内容转成更容易讲解的视觉线索。").replace(/插画/g, "图像");
  const imageClass = compact ? "h-[86px] w-full rounded-md object-contain" : "h-[190px] w-full rounded-xl object-contain";

  return (
    <div className={compact ? "overflow-hidden rounded-lg border border-[#DCE7F7] bg-[#F8FBFF] p-1" : ""}>
      <div className="overflow-hidden rounded-xl border border-[#DCE7F7] bg-[#F8FBFF]">
        {imageReady ? (
          <img
            src={PPT_ILLUSTRATION_IMAGE}
            alt={title}
            className={imageClass}
            decoding="async"
            onError={() => setImageReady(false)}
          />
        ) : (
          <svg viewBox="0 0 260 168" role="img" aria-label={title} className={imageClass}>
            <rect width="260" height="168" rx="18" fill="#F8FBFF" />
            <rect x="24" y="24" width="122" height="62" rx="12" fill="#FFFFFF" stroke="#CFE0FF" strokeWidth="2" />
            <rect x="42" y="42" width="68" height="6" rx="3" fill="#2563EB" />
            <rect x="42" y="58" width="88" height="4" rx="2" fill="#CBD5E1" />
            <circle cx="58" cy="112" r="17" fill="#FFD7C2" />
            <path d="M42 108c6-22 31-22 37 0-13-9-25-9-37 0Z" fill="#7C3AED" />
            <path d="M45 131c6-22 30-24 39 0l12 30H34Z" fill="#FB7299" />
            <rect x="104" y="102" width="54" height="35" rx="10" fill="#FFFFFF" stroke="#F9A8D4" strokeWidth="2" />
            <rect x="180" y="60" width="52" height="42" rx="12" fill="#FFFFFF" stroke="#CFE0FF" strokeWidth="2" />
            <path d="M154 119c18-18 32-22 49-15" fill="none" stroke="#2563EB" strokeWidth="5" strokeLinecap="round" />
            <path d="m200 96 14 10-15 9" fill="none" stroke="#2563EB" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="28" y="145" width="202" height="9" rx="4.5" fill="#FED7AA" />
          </svg>
        )}
      </div>
      {!compact ? (
        <>
          <div className="mt-2 text-sm font-black ui-text-ink">{title}</div>
          <p className="mt-1 line-clamp-3 text-[11px] font-semibold leading-5 ui-text-secondary">{caption}</p>
        </>
      ) : null}
    </div>
  );
}

function buildResourcePreviewContent(resource?: ResourceCard | null, fallback?: string[]) {
  const rawMarkdown = resource?.content_markdown || "";
  if (resource?.resource_type === "lecture_note" || resource?.resource_type === "lecture_notes") {
    const sections = extractResourceSections(rawMarkdown, 24);
    if (sections.length) return dedupePreviewLines(sections, 10);
  }
  const outline = dedupePreviewLines(extractResourceOutline(rawMarkdown), 10);
  if (outline.length) return outline;
  if (resource?.summary) return [resource.summary];
  return fallback || ["当前没有更多可预览的内容。"];
}

function buildExpandedHandoutPreviewContent(
  resource: ResourceCard | null | undefined,
  courseTitle: string,
  sectionTitle: string,
) {
  const baseSections = buildResourcePreviewContent(resource, []);
  const meaningfulSections = baseSections.filter((item) => item.trim().length > 12);
  if (courseTitle.includes("软件工程")) {
    const profile = buildSoftwareEngineeringChapterProfile(courseTitle, sectionTitle);
    if (meaningfulSections.length >= 4) {
      return dedupePreviewLines(meaningfulSections, 10);
    }
    return Array.from(new Set([...meaningfulSections, ...profile.handoutSections].map((item) => item.trim()).filter(Boolean))).slice(0, 10);
  }
  const topicTitle = `${courseTitle} · ${sectionTitle}`;
  const generatedSections = [
    `## ${topicTitle}\n\n先不要把这节课当成零散知识点集合，而要把它理解成一条完整的工程决策链：**它解决什么问题、为什么要这样拆、真实项目里如何落地**。`,
    [
      "### 本节关注点",
      "- 这一章最核心的问题是什么",
      "- 关键概念之间的边界如何区分",
      "- 结构关系应该按什么顺序理解",
      "- 真实场景里它通常怎么落地",
    ].join("\n"),
    [
      "### 判断公式",
      "可以把本节的设计判断先简化成一个学习公式：",
      "",
      "`学习收益 = 主线清晰度 + 结构理解度 + 场景迁移力`",
      "",
      "当一个学习结果同时提升这三个维度时，它通常就更容易进入长期记忆和真实表达。",
    ].join("\n"),
    [
      "### 概念拆解",
      "1. 先理解定义：它是什么。",
      "2. 再理解关系：它和相邻概念有什么边界。",
      "3. 最后理解场景：什么时候该用，什么时候不要硬用。",
    ].join("\n"),
    [
      "### 结构关系",
      "建议按下面这条链来梳理：",
      "",
      "`问题背景 -> 核心概念 -> 结构关系 -> 场景落地 -> 易错辨析`",
      "",
      "这样更容易把课堂内容讲成一条主线，而不是碎片记忆。",
    ].join("\n"),
    [
      "### 课堂案例",
      `把 ${courseTitle} 放回真实课程任务里看：你需要的不只是知道定义，而是知道这一章怎样支撑后面的设计、开发、测试或项目表达。`,
      "",
      "> 真正稳定的掌握，不是背得越多越好，而是能把主线、关系和场景讲清楚。",
    ].join("\n"),
    [
      "### 复习重点",
      "- 先复述本节主线",
      "- 再画出模块关系",
      "- 最后用自己的话解释一个关键设计为什么成立",
    ].join("\n"),
    [
      "### 易错提醒",
      "| 常见误区 | 更合理的判断 |",
      "| --- | --- |",
      "| 只记住定义 | 还要理解问题背景和使用边界 |",
      "| 只看单个知识点 | 应该先建立章节主线 |",
      "| 会做一道题就算掌握 | 还要能迁移到真实场景 |",
    ].join("\n"),
    [
      "### 课后动作",
      "写下 `3 个关键词 + 2 个易混点 + 1 个真实场景`，然后再生成练习题回测一次掌握情况。",
    ].join("\n"),
  ];

  const merged = [...meaningfulSections, ...generatedSections];
  return Array.from(new Set(merged.map((item) => item.trim()).filter(Boolean))).slice(0, 10);
}

function buildHandoutPreviewSections(items: string[]) {
  const fallbackTitles = ["课堂主线", "核心问题", "概念拆解", "结构关系", "案例理解", "复习重点", "易错提醒", "课后练习"];

  return items.map((item, index) => {
    const normalized = item.trim();
    const [maybeTitle, ...bodyParts] = normalized.split(/[：:]/);
    const hasInlineTitle = bodyParts.length > 0 && maybeTitle.length <= 12;
    const title = hasInlineTitle ? maybeTitle : fallbackTitles[index] || `讲义补充 ${index + 1}`;
    const body = hasInlineTitle ? bodyParts.join("：").trim() : normalized;

    return {
      title,
      body,
    };
  });
}

function buildPptPreviewCards(slides: DeckSlide[]) {
  return slides.slice(0, 10).map((slide, index) => {
    const typeLabel =
      slide.kind === "cover" ? "封面" : slide.kind === "agenda" ? "目录" : slide.kind === "ending" ? "结束页" : "内容页";
    return {
      index: index + 1,
      typeLabel,
      title: slide.title,
      subtitle: slide.subtitle || "",
      bullets: slide.bullets.slice(0, 3),
      accent: slide.accent || "",
      illustration: slide.illustration,
    };
  });
}

function isAdvancedDeck(slides?: DeckSlide[]) {
  return Boolean(
    slides?.some((slide) => slide.title.includes("章节定位") || slide.title.includes("关系梳理")),
  );
}

function buildPptExplanationVideoArtifact(
  artifact: RecentPptArtifact,
  courseTitle: string,
  sectionTitle: string,
): PptExplanationVideoArtifact {
  const title = artifact.customTitle || artifact.fileName.replace(/\.pptx$/i, "");
  const slides = artifact.slides?.length ? artifact.slides : buildCourseDeckSlides([], courseTitle, sectionTitle);
  const storyboard = slides.slice(0, 8).map((slide, index) => {
    const bullets = slide.bullets?.slice(0, 3) || [];
    const speakerNote = (slide as { speakerNote?: string }).speakerNote || "";
    const narration =
      speakerNote ||
      `这一页围绕“${slide.title}”展开，先抓住${bullets[0] || "本页主线"}，再结合${bullets[1] || "关键概念"}和${bullets[2] || "课堂示例"}完成理解。`;
    return {
      slideIndex: index + 1,
      title: slide.title,
      narration,
      visualHint:
        slide.kind === "cover"
          ? "封面停留，标题轻微推进，建立课程主题。"
          : slide.kind === "ending"
            ? "结尾页收束，突出复习任务和下一步行动。"
            : "镜头跟随本页要点逐条高亮，右下角保留页码和章节名。",
      durationSeconds: slide.kind === "cover" || slide.kind === "ending" ? 18 : 28,
    };
  });
  const totalSeconds = storyboard.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    title: `${title} · 讲解视频`,
    summary: `已根据 ${slides.length} 页 PPT 生成讲解分镜、旁白稿和视频预览，用于课堂回看或答辩演示。`,
    generatedAt: formatGenerationTime(),
    durationLabel: `${minutes}:${String(seconds).padStart(2, "0")}`,
    voiceRole: "AI 教师旁白",
    storyboard,
    transcript: storyboard.map((scene) => `第 ${scene.slideIndex} 页《${scene.title}》：${scene.narration}`).join("\n\n"),
    videoUrl: "",
  };
}

function upgradeRecentPptArtifact(
  artifact: RecentPptArtifact | null | undefined,
  courseTitle: string,
  sectionTitle: string,
) {
  if (!artifact || artifact.loading || isAdvancedDeck(artifact.slides)) return artifact || null;
  const slides = buildCourseDeckSlides([], courseTitle, artifact.sectionTitle || sectionTitle);
  return {
    ...artifact,
    slides,
    slideCount: slides.length,
    summary: "已升级为高级工程汇报版：围绕架构治理、设计权衡、指标体系和答辩表达组织内容。",
  };
}

function toResourceCardFromManagedDetail(detail: ManagedResourceDetail): ResourceCard {
  const contentMarkdown =
    detail.content_markdown ||
    detail.content ||
    (typeof detail.document?.content_markdown === "string" ? detail.document.content_markdown : "") ||
    (typeof detail.mindmap?.mermaid_code === "string" ? detail.mindmap.mermaid_code : "") ||
    (detail.question_bank ? JSON.stringify(detail.question_bank, null, 2) : "");

  return {
    resource_id: detail.resource_id ?? detail.id,
    resource_type: detail.resource_type,
    title: detail.title || detail.resource_name || "未命名资源",
    summary: detail.summary || detail.description || "已生成资源内容",
    content_markdown: contentMarkdown,
    source_titles: Array.isArray(detail.source_titles) ? detail.source_titles : [],
    study_suggestion: detail.study_suggestion,
    source_file_count: detail.source_file_count,
    source_files: detail.source_files,
    generated_at: detail.generated_at,
    updated_at: detail.updated_at,
    generation_context: detail.generation_context,
  };
}

function buildWorkspaceResourceLink(
  courseId: string,
  sectionTitle: string,
  resourceKind: "handout" | "mindmap" | "practice",
  title: string,
) {
  const params = new URLSearchParams({
    courseId,
    view: resourceKind,
    title,
    section: sectionTitle,
  });
  return `/resources?${params.toString()}`;
}

function sanitizeDownloadName(value: string, ext: string) {
  const cleaned = value.replace(/[\\/:*?"<>|]+/g, "-").trim() || "resource";
  return cleaned.endsWith(`.${ext}`) ? cleaned : `${cleaned}.${ext}`;
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

function downloadWordDocument(title: string, sections: string[]) {
  const safeTitle = title.replace(/[&<>"]/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    return "&quot;";
  });
  const body = sections
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `<p>${item.replace(/[&<>"]/g, (char) => {
      if (char === "&") return "&amp;";
      if (char === "<") return "&lt;";
      if (char === ">") return "&gt;";
      return "&quot;";
    })}</p>`)
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${safeTitle}</title><style>body{font-family:"Microsoft YaHei",sans-serif;padding:32px;line-height:1.8;color:#1f2937}h1{font-size:24px;margin:0 0 20px}p{margin:0 0 12px}strong{font-weight:700}</style></head><body><h1>${safeTitle}</h1>${body}</body></html>`;
  triggerBlobDownload(new Blob([html], { type: "application/msword" }), sanitizeDownloadName(title, "doc"));
}

function downloadTextAsset(title: string, content: string, ext: string, mime = "text/plain;charset=utf-8") {
  triggerBlobDownload(new Blob([content], { type: mime }), sanitizeDownloadName(title, ext));
}

function serializeMindmapNodes(nodes: MindmapNode[], depth = 0): string[] {
  return nodes.flatMap((node) => {
    const prefix = depth === 0 ? "# " : `${"  ".repeat(Math.max(0, depth - 1))}- `;
    return [`${prefix}${node.label}`, ...serializeMindmapNodes(node.children || [], depth + 1)];
  });
}

function buildPracticeDownloadText(title: string, questions: PracticeQuestion[]) {
  return [
    title,
    ...questions.map((question, index) => {
      const options = question.options.length
        ? `\n${question.options
            .map((option, optionIndex) => `${String.fromCharCode(65 + optionIndex)}. ${option}`)
            .join("\n")}`
        : "";
      const answer = question.answer.length ? `\n答案：${question.answer.join(" / ")}` : "";
      const explanation = question.explanation ? `\n解析：${question.explanation}` : "";
      const tag = question.knowledgeTag ? `\n知识点：${question.knowledgeTag}` : "";
      return `${index + 1}. ${question.question}${options}${answer}${explanation}${tag}`;
    }),
  ].join("\n\n");
}

function buildComputerSciencePracticeQuestions(sectionTitle: string): PracticeQuestion[] {
  const section = sectionTitle.trim() || "当前章节";
  return [
    {
      id: "cs-practice-1",
      question: "使用数组实现栈时，`top` 表示栈顶元素下标，容量为 `capacity`。执行 `push(x)` 前应优先判断哪一项？",
      options: ["`top == capacity - 1`", "`top == -1`", "`x == 0`", "数组是否已经升序"],
      answer: ["A"],
      explanation: "数组栈容量固定，入栈前必须先判断栈满，否则 `top + 1` 后写入会造成数组越界。",
      questionType: "single",
      knowledgeTag: "数据结构：栈",
    },
    {
      id: "cs-practice-2",
      question: "括号匹配、浏览器后退、函数调用栈这些场景共同依赖哪种访问规则？",
      options: ["FIFO", "LIFO", "随机访问", "按 key 哈希访问"],
      answer: ["B"],
      explanation: "这些场景都要求后进入的数据先被处理，符合栈的 LIFO（Last In First Out）规则。",
      questionType: "single",
      knowledgeTag: "数据结构：栈",
    },
    {
      id: "cs-practice-3",
      question: "下面哪些结构或场景符合队列的 FIFO 特性？",
      options: ["打印任务排队", "消息队列消费", "广度优先搜索 BFS", "递归函数调用返回"],
      answer: ["A", "B", "C"],
      explanation: "队列强调先入先出，打印任务、消息消费和 BFS 都典型使用队列；递归调用返回更接近栈。",
      questionType: "multiple",
      knowledgeTag: "数据结构：队列",
    },
    {
      id: "cs-practice-4",
      question: "对长度为 n 的无序数组进行线性查找，最坏情况下时间复杂度是多少？",
      options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      answer: ["C"],
      explanation: "最坏情况下目标元素不存在或位于最后一个位置，需要检查 n 个元素，因此是 O(n)。",
      questionType: "single",
      knowledgeTag: "算法复杂度",
    },
    {
      id: "cs-practice-5",
      question: "判断题：二分查找可以直接用于任意无序数组。",
      options: ["正确", "错误"],
      answer: ["B"],
      explanation: "二分查找依赖有序性，只有在数据有序或能按单调关系排除一半搜索空间时才适用。",
      questionType: "single",
      knowledgeTag: "算法：二分查找",
    },
    {
      id: "cs-practice-6",
      question: "阅读 Java 代码：`int[] a = {2, 4, 6}; System.out.println(a[2]);` 输出结果是什么？",
      options: ["2", "4", "6", "数组越界"],
      answer: ["C"],
      explanation: "Java 数组下标从 0 开始，`a[2]` 访问第三个元素，输出 6。",
      questionType: "single",
      knowledgeTag: "Java 数组",
    },
    {
      id: "cs-practice-7",
      question: "在 Java 中使用 `HashMap<String, Integer>` 统计单词出现次数时，最核心的操作是哪组？",
      options: ["按 key 查询旧次数", "将新次数写回 key", "每次都排序整个数组", "用下标直接访问字符串地址"],
      answer: ["A", "B"],
      explanation: "词频统计的关键是根据单词 key 读取旧值，再把 `old + 1` 写回；不需要每次整体排序。",
      questionType: "multiple",
      knowledgeTag: "Java 集合",
    },
    {
      id: "cs-practice-8",
      question: "数据库用户表中 `email` 字段要求不能重复，并且经常按邮箱登录查询，应该优先考虑什么设计？",
      options: ["给 `email` 建唯一索引", "把邮箱字段改成更长的名字", "每次登录全表扫描", "删除主键"],
      answer: ["A"],
      explanation: "唯一索引既能约束邮箱不重复，也能提升按邮箱查询的效率。",
      questionType: "single",
      knowledgeTag: "数据库索引",
    },
    {
      id: "cs-practice-9",
      question: "操作系统中，多个线程同时修改共享计数器，如果没有锁或原子操作，最可能出现什么问题？",
      options: ["竞态条件", "DNS 解析失败", "SQL 语法错误", "数组自动扩容"],
      answer: ["A"],
      explanation: "共享变量并发读写缺少同步时，执行顺序不确定，可能导致结果丢失或不一致。",
      questionType: "single",
      knowledgeTag: "操作系统：线程同步",
    },
    {
      id: "cs-practice-10",
      question: `结合《${section}》，请设计一个“小型在线题库”的核心数据结构或表结构，并说明至少 2 个关键字段为什么这样设计。`,
      options: [],
      answer: [],
      explanation: "参考思路：可从题目表、选项表、提交记录表展开，说明题目 id、知识点、题型、正确答案、用户答案、提交时间等字段的作用。",
      questionType: "short",
      knowledgeTag: "综合应用",
    },
  ];
}

function buildFallbackPracticeQuestions(_courseTitle: string, sectionTitle: string): PracticeQuestion[] {
  return buildComputerSciencePracticeQuestions(sectionTitle);
}

function buildMindmapTreeFromLines(title: string, lines: string[]): MindmapNode[] {
  const normalizedLines = lines.map((line) => line.trim()).filter(Boolean);
  const nodes = normalizedLines.map((line, index) => {
    const depth =
      /^###\s/.test(line) ? 3
      : /^##\s/.test(line) ? 2
      : /^#\s/.test(line) ? 1
      : /^[-*]\s/.test(line) ? 3
      : /^\d+[.)]\s/.test(line) ? 2
      : index === 0 ? 1 : 2;
    const label = line.replace(/^#{1,3}\s*/, "").replace(/^[-*]\s*/, "").replace(/^\d+[.)]\s*/, "").trim();
    return {
      id: `mindmap-${index + 1}`,
      label,
      depth,
      children: [],
    } satisfies MindmapNode;
  });

  const rootNode: MindmapNode = {
    id: "mindmap-root",
    label: title,
    depth: 0,
    children: [],
  };
  const depthStack: MindmapNode[] = [rootNode];

  for (const node of nodes) {
    while (depthStack.length && depthStack[depthStack.length - 1].depth >= node.depth) {
      depthStack.pop();
    }
    depthStack[depthStack.length - 1]?.children.push(node);
    depthStack.push(node);
  }

  if (!rootNode.children.length) {
    rootNode.children.push({
      id: "mindmap-empty",
      label: "正在整理本节知识结构",
      depth: 1,
      children: [],
    });
  }

  return [rootNode];
}

function extractMindmapNodes(resource: ResourceCard | null | undefined, title: string, sectionTitle: string): MindmapNode[] {
  const mermaidMindmap = parseMermaidMindmap(resource?.content_markdown || "", `${title} ${sectionTitle}`);
  if (mermaidMindmap?.length) {
    return mermaidMindmap;
  }
  const lines = dedupePreviewLines(extractStructuredResourceOutline(resource?.content_markdown || ""), 16);
  if (lines.length) {
    return buildMindmapTreeFromLines(`${title} ${sectionTitle}`, lines);
  }
  return buildMindmapTreeFromLines(`${title} ${sectionTitle}`, [
    `# ${sectionTitle}`,
    "## 核心概念",
    "- 先明确本节的定义和主线",
    "## 结构关系",
    "- 梳理知识点之间的依赖关系",
    "## 应用场景",
    "- 把概念放回真实项目或课堂案例中理解",
    "## 复习顺序",
    "- 先总览，再细读，再做练习",
  ]);
}

function MindmapTreeView({ nodes }: { nodes: MindmapNode[] }) {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-[#D6F5E8] bg-[#F5FFFB] px-4 py-5 text-center text-xs font-bold text-[#10B981]">
          正在加载导图预览...
        </div>
      }
    >
      <HorizontalMindmap nodes={nodes} variant="compact" />
    </Suspense>
  );
}

function InlinePreviewContent({
  previewState,
  practiceAnswers,
  practiceShortAnswers,
  practiceSubmitted,
  practiceScore,
  onTogglePracticeChoice,
  onPracticeShortAnswerChange,
  onSubmitPractice,
}: {
  previewState: ResourcePreviewState;
  practiceAnswers: Record<string, string[]>;
  practiceShortAnswers: Record<string, string>;
  practiceSubmitted: boolean;
  practiceScore: { correct: number; total: number; percent: number } | null;
  onTogglePracticeChoice: (questionId: string, optionKey: string, isMultiple: boolean) => void;
  onPracticeShortAnswerChange: (questionId: string, value: string) => void;
  onSubmitPractice: () => void;
}) {
  if (previewState.kind === "resource" && previewState.resourceKind === "practice" && previewState.questions?.length) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-[#E6ECF5] bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold ui-text-ink">随堂测评</div>
              <p className="mt-1 text-[11px] leading-5 ui-text-secondary">客观题即时判分，简答题可先记录思路再继续追问。</p>
            </div>
            <button
              type="button"
              disabled={previewState.loading}
              onClick={onSubmitPractice}
              className={`inline-flex h-9 items-center justify-center rounded-full px-4 text-[11px] font-semibold transition ${
                previewState.loading ? "bg-[#CBD5E1] text-white cursor-not-allowed" : "ui-bg-dark text-white hover:bg-black"
              }`}
            >
              提交判分
            </button>
          </div>
          {practiceSubmitted && practiceScore ? (
            <div className="mt-3 rounded-2xl bg-[#F8FAFC] px-3.5 py-3 text-sm ui-text-ink">
              客观题得分：{practiceScore.correct} / {practiceScore.total}（{practiceScore.percent} 分）
            </div>
          ) : null}
        </div>

        {previewState.questions.map((question, index) => {
          const selected = practiceAnswers[question.id] || [];
          const isShort = question.questionType === "short";
          const isMultiple = question.questionType === "multiple";
          const isCorrect =
            !isShort &&
            [...selected].sort().join("|") === [...question.answer].sort().join("|") &&
            question.answer.length > 0;
          return (
            <div key={question.id} className="rounded-2xl bg-white px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)] ring-1 ring-[#EEF2F6]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full ui-bg-dark px-2 text-[10px] font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="rounded-full ui-bg-panel px-2.5 py-1 text-[10px] font-semibold ui-text-body">
                      {isShort ? "简答题" : isMultiple ? "多选题" : "单选题"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 ui-text-ink">{question.question}</p>
                </div>
                {practiceSubmitted && !isShort ? (
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${isCorrect ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#FEF3F2] text-[#B42318]"}`}>
                    {isCorrect ? "回答正确" : "继续巩固"}
                  </span>
                ) : null}
              </div>

              {isShort ? (
                <textarea
                  value={practiceShortAnswers[question.id] || ""}
                  onChange={(event) => onPracticeShortAnswerChange(question.id, event.target.value)}
                  rows={4}
                    placeholder="写下你的思路，提交后可继续交给岗位实训导师讲解。"
                  className="mt-3 w-full rounded-2xl border border-[#DCE6F2] bg-[#FCFDFE] px-3 py-3 text-sm leading-6 ui-text-ink outline-none transition focus:border-[#171717]"
                />
              ) : (
                <div className="mt-3 space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const optionKey = String.fromCharCode(65 + optionIndex);
                    const checked = selected.includes(optionKey);
                    const revealCorrect = practiceSubmitted && question.answer.includes(optionKey);
                    return (
                      <button
                        key={`${question.id}-${optionKey}`}
                        type="button"
                        onClick={() => onTogglePracticeChoice(question.id, optionKey, isMultiple)}
                        className={`flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                          checked
                            ? "border-[#171717] ui-bg-dark text-white"
                            : revealCorrect
                              ? "border-[#12B76A] bg-[#ECFDF3] text-[#065F46]"
                              : "border-[#E7ECF2] bg-[#FCFDFE] ui-text-ink hover:border-[#CBD5E1]"
                        }`}
                      >
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/90 text-[10px] font-bold text-[#171717]">
                          {optionKey}
                        </span>
                        <span className="text-sm leading-6">{option}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {practiceSubmitted ? (
                <div className="mt-3 rounded-2xl bg-[#F8FAFC] px-3.5 py-3 text-sm leading-6 ui-text-body">
                  {!isShort && question.answer.length ? <p>答案：{question.answer.join(" / ")}</p> : null}
                  {question.explanation ? <p className="mt-1">解析：{question.explanation}</p> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  if (previewState.kind === "resource" && previewState.resourceKind === "mindmap" && previewState.mindmapNodes?.length) {
    return <MindmapTreeView nodes={previewState.mindmapNodes} />;
  }

  return (
    <div className="space-y-2.5">
      {previewState.content.map((item, index) => (
        <div key={`${previewState.title}-${index}`} className="rounded-2xl bg-white px-3.5 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)] ring-1 ring-[#EEF2F6]">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ui-bg-dark text-[10px] font-bold text-white">
              {index + 1}
            </span>
            <MarkdownRenderer content={item} className="flex-1 ui-text-ink" />
          </div>
        </div>
      ))}
    </div>
  );
}

function extractPracticeQuestions(resource: ResourceCard | null | undefined, courseTitle: string, sectionTitle: string): PracticeQuestion[] {
  const raw = resource?.content_markdown?.trim() || "";
  if (raw.startsWith("{") || raw.startsWith("[")) {
    const parsedPaper = parseQuizPaper(raw);
    if (parsedPaper?.questions.length) {
      return parsedPaper.questions.map((item, index) => ({
        ...item,
        id: item.id || `practice-${index + 1}`,
      }));
    }
  }
  return buildFallbackPracticeQuestions(courseTitle, sectionTitle);
}
function buildLocalGeneratedResource(
  resourceType: ResourceCard["resource_type"],
  courseTitle: string,
  sectionTitle: string,
  outlineLines: string[] = [],
): ResourceCard {
  const titleSuffix =
    resourceType === "mindmap" ? "导图" : resourceType === "practice_set" ? "练习" : "讲义";
  const cleanOutline = outlineLines.map((item) => item.trim()).filter(Boolean).slice(0, 8);
  const outlineMarkdown = cleanOutline.length ? buildOutlineMarkdown(cleanOutline) : "";
  const fallbackBullets =
    resourceType === "mindmap"
      ? [
          `## ${courseTitle} · ${sectionTitle} 导图`,
          ...(cleanOutline.length
            ? cleanOutline.map((item) => `- ${item}`)
            : [
                "- 核心概念：先明确本节主线概念与定义边界",
                "- 结构关系：再梳理模块之间的依赖与调用关系",
                "- 复习顺序：建议先总览结构，再逐点展开细节",
              ]),
        ]
      : resourceType === "practice_set"
        ? [
            `## ${courseTitle} · ${sectionTitle} 练习`,
            ...(cleanOutline.length
              ? cleanOutline.slice(0, 5).map((item, index) => `${index + 1}. 围绕“${item}”设计一道理解或应用题，并写出答题依据。`)
              : [
                  "1. 先用一句话说明本节核心概念是什么",
                  "2. 结合一个实际场景说明它为什么这样设计",
                  "3. 说出最容易出错的点，以及你会怎么规避",
                ]),
          ]
        : [
            `## ${courseTitle} · ${sectionTitle} 讲义`,
            "### 本节主线",
            cleanOutline[0] || "这一节要先弄清当前章节到底在解决什么问题，再去看模块、流程和关系，而不是只记几个孤立名词。",
            "### 学习目标",
            ...(cleanOutline.length
              ? cleanOutline.slice(0, 4).map((item) => `- ${item}`)
              : [
                  "- 理解本节最核心的设计目的",
                  "- 掌握本节提到的主要模块与关系",
                  "- 能把知识点放回实际场景中解释清楚",
                ]),
            "### 关键结构",
            outlineMarkdown || "学习时建议按“问题背景 -> 核心概念 -> 结构关系 -> 场景落地”的顺序往下理解，这样更容易形成完整主线。",
            "### 复习重点",
            "- 先抓主线，再补细节",
            "- 注意相邻概念之间的区别",
            "- 最后做一轮练习验证是否真的掌握",
          ];

  return {
    resource_id: null,
    resource_type: resourceType,
    title: `${courseTitle} · ${sectionTitle} ${titleSuffix}`,
    summary:
      resourceType === "mindmap"
        ? "已按当前章节整理本地导图，可先看结构，再等真实结果同步。"
        : resourceType === "practice_set"
          ? "已按当前章节整理本地练习，可先做一轮自测，再等真实结果同步。"
          : "已按当前章节整理本地讲义，可先继续阅读，再等真实结果同步。",
    content_markdown: fallbackBullets.join("\n"),
    source_titles: [`${titleSuffix}即时整理`],
    study_suggestion:
      resourceType === "practice_set"
        ? "建议先独立完成一轮，再让岗位实训导师讲解你的思路漏洞。"
        : "建议先顺着当前内容快速通读一遍，再继续问岗位实训导师补细节。",
    source_file_count: 0,
    source_files: [],
  };
}

async function loadGeneratedResourceCards(resources: ResourceCard[]) {
  const resourceIds = resources
    .map((resource) => Number(resource.resource_id))
    .filter((resourceId) => Number.isFinite(resourceId) && resourceId > 0);

  if (!resourceIds.length) {
    return resources;
  }

  const detailResults = await Promise.allSettled(
    resourceIds.map((resourceId) => studentApi.getManagedResourceDetail(resourceId)),
  );

  const detailMap = new Map<number, ResourceCard>();
  detailResults.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    detailMap.set(resourceIds[index], toResourceCardFromManagedDetail(result.value));
  });

  return resources.map((resource) => {
    const resourceId = Number(resource.resource_id);
    return detailMap.get(resourceId) || resource;
  });
}

async function openBackendResourceDownload(resourceId: number, userId: number, format: string) {
  const download = await studentApi.getResourceDownloadUrl(resourceId, userId, format);
  window.open(download.download_url, "_blank", "noopener,noreferrer");
}

function buildTutorPromptForResource(resource: ResourceCard) {
  if (resource.resource_type === "mindmap") {
    return `请结合这份导图《${resource.title}》继续讲解这些知识点之间的关系，并告诉我应该按什么顺序复习。`;
  }
  if (resource.resource_type === "practice_set") {
    return `请结合这份练习《${resource.title}》继续给我讲题思路，并告诉我这节课还该补哪些题型。`;
  }
  if (resource.resource_type === "course_overview" || resource.resource_type === "teaching_plan") {
    return `请结合这份资料《${resource.title}》继续帮我梳理这门课的主线，并告诉我当前这一章最值得先看什么。`;
  }
  return `请结合这份讲义《${resource.title}》继续展开讲解，并告诉我这一节最容易混淆的地方。`;
}

function buildGenerationTutorPrompt(
  kind: "handout" | "mindmap" | "practice" | "ppt",
  courseTitle: string,
  sectionTitle: string,
  assetTitle?: string,
) {
  const targetTitle = assetTitle || `${courseTitle} · ${sectionTitle}`;
  if (kind === "mindmap") {
    return `你现在不要推荐视频、课程或外部资料。请直接围绕《${targetTitle}》输出这一节的知识导图结果：先给出 1 份树状结构导图，再补充节点之间的关系，最后给出复习顺序。`;
  }
  if (kind === "practice") {
    return `你现在不要推荐视频、课程或外部资料。请直接围绕《${targetTitle}》输出这一节的计算机课程随堂练习：至少给我 10 道题，覆盖数据结构、编程语言、算法复杂度、数据库或操作系统等具体考点；题型包含单选、多选、判断、代码阅读、简答和应用题；每题都给参考答案和解题思路，避免泛泛的软件工程流程题。`;
  }
  if (kind === "ppt") {
    return `你现在不要推荐视频、课程或外部资料。请直接围绕《${targetTitle}》输出这一节的 PPT 草案：按“封面 / 本节目标 / 核心概念 / 关键结构 / 示例 / 总结”给出逐页内容。`;
  }
  return `你现在不要推荐视频、课程或外部资料。请直接围绕《${targetTitle}》输出这一节的课堂讲义：先写本节主线，再写关键概念与结构细节，最后给我一份复习重点。`;
}

function buildGenerationTutorQuickPrompts(kind: "handout" | "mindmap" | "practice" | "ppt") {
  if (kind === "mindmap") return ["直接输出导图", "解释节点关系", "给我复习顺序"];
  if (kind === "practice") return ["直接出 10 道题", "加入代码阅读题", "按知识点分层"];
  if (kind === "ppt") return ["直接整理 PPT", "按页展开内容", "压缩成汇报版"];
  return ["直接生成讲义", "提炼复习重点", "补充易混淆点"];
}

function replaceRecentArtifact(list: RecentResourceArtifact[], nextItem: RecentResourceArtifact) {
  return [
    nextItem,
    ...list.filter((item) => !(item.kind === nextItem.kind && item.sectionTitle === nextItem.sectionTitle)),
  ];
}

function mapLibraryResourceKind(resourceType: string): "handout" | "mindmap" | "practice" {
  if (resourceType === "mindmap") {
    return "mindmap";
  }
  if (resourceType === "practice_set") {
    return "practice";
  }
  return "handout";
}

function filterWorkspaceArtifactsByCourseTitle(
  artifacts: RecentResourceArtifact[] | undefined,
  courseTitle: string,
) {
  if (!Array.isArray(artifacts) || !courseTitle.trim()) {
    return [];
  }
  const normalizedTitle = courseTitle.trim();
  return artifacts.filter((item) => {
    const text = `${item.title || ""}\n${item.summary || ""}\n${item.rawContent || ""}`;
    return !text.trim() || text.includes(normalizedTitle);
  });
}

function filterWorkspacePptByCourseTitle(
  artifact: RecentPptArtifact | null | undefined,
  courseTitle: string,
) {
  if (!artifact || !courseTitle.trim()) {
    return null;
  }
  const normalizedTitle = courseTitle.trim();
  const text = `${artifact.fileName || ""}\n${artifact.summary || ""}\n${artifact.rawContent || ""}\n${artifact.customTitle || ""}`;
  return !text.trim() || text.includes(normalizedTitle) ? artifact : null;
}

function formatResourceGeneratedAt(resource: ResourceCard) {
  const value = resource.generated_at || resource.updated_at;
  if (!value) return "历史生成";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "历史生成";
  return parsed.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveGeneratedSectionTitle(resource: ResourceCard, fallbackSectionTitle: string) {
  const contextPoints = Array.isArray(resource.generation_context?.knowledge_points)
    ? resource.generation_context?.knowledge_points
    : [];
  const candidates = [...contextPoints, ...(resource.source_titles || [])]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item) => sanitizeWorkspaceText(item, "") !== "");
  return (
    sanitizeWorkspaceText(
      candidates.find((item) => item.includes("章：") || item.includes("章:") || item.includes("节")) ||
      candidates[1] ||
      fallbackSectionTitle,
      fallbackSectionTitle,
    )
  );
}

function mapBackendResourceToArtifact(
  resource: ResourceCard,
  courseTitle: string,
  fallbackSectionTitle: string,
  courseId: string,
): RecentResourceArtifact | null {
  const sectionTitle = resolveGeneratedSectionTitle(resource, fallbackSectionTitle);
  const common = {
    resourceId: resource.resource_id ? Number(resource.resource_id) : null,
    summary: buildResourceSummary(resource, "已从历史生成记录恢复。"),
    generatedAt: formatResourceGeneratedAt(resource),
    sectionTitle,
    rawContent: resource.content_markdown || "",
  };
  if (resource.resource_type === "lecture_note" || resource.resource_type === "lecture_notes") {
    return {
      ...common,
      kind: "handout",
      preferredFormat: "docx",
      title: resource.title || `${courseTitle} · ${sectionTitle} 讲义`,
      downloadUrl: buildWorkspaceResourceLink(courseId, sectionTitle, "handout", resource.title || `${courseTitle} · ${sectionTitle} 讲义`),
      previewContent: buildExpandedHandoutPreviewContent(resource, courseTitle, sectionTitle),
    };
  }
  if (resource.resource_type === "mindmap" || resource.resource_type === "mind_map") {
    return {
      ...common,
      kind: "mindmap",
      preferredFormat: "xmind",
      title: resource.title || `${courseTitle} · ${sectionTitle} 导图`,
      downloadUrl: buildWorkspaceResourceLink(courseId, sectionTitle, "mindmap", resource.title || `${courseTitle} · ${sectionTitle} 导图`),
      previewContent: buildResourcePreviewContent(resource, ["已从历史导图记录恢复。"]),
      mindmapNodes: extractMindmapNodes(resource, courseTitle, sectionTitle),
    };
  }
  if (resource.resource_type === "practice_set" || resource.resource_type === "quiz_set") {
    return {
      ...common,
      kind: "practice",
      preferredFormat: "docx",
      title: resource.title || `${courseTitle} · ${sectionTitle} 练习`,
      downloadUrl: buildWorkspaceResourceLink(courseId, sectionTitle, "practice", resource.title || `${courseTitle} · ${sectionTitle} 练习`),
      previewContent: buildResourcePreviewContent(resource, ["已从历史练习记录恢复。"]),
      practiceQuestions: extractPracticeQuestions(resource, courseTitle, sectionTitle),
    };
  }
  return null;
}

function mapBackendResourceToPpt(
  resource: ResourceCard,
  courseTitle: string,
  fallbackSectionTitle: string,
): RecentPptArtifact | null {
  if (resource.resource_type !== "ppt") return null;
  const sectionTitle = resolveGeneratedSectionTitle(resource, fallbackSectionTitle);
  const slides = buildCourseDeckSlides([resource], courseTitle, sectionTitle);
  return {
    resourceId: resource.resource_id ? Number(resource.resource_id) : null,
    fileName: `${(resource.title || `${courseTitle}-${sectionTitle}`).replace(/[\\/:*?"<>|]+/g, "-")}.pptx`,
    slideCount: slides.length,
    generatedAt: formatResourceGeneratedAt(resource),
    slides,
    summary: buildResourceSummary(resource, "已从历史 PPT 记录恢复。"),
    sectionTitle,
    downloadUrl: "",
    preferredFormat: "pptx" as const,
    rawContent: resource.content_markdown || "",
  } satisfies RecentPptArtifact;
}

function mapLibraryResourceTag(resourceType: string) {
  if (resourceType === "mindmap") return "导图";
  if (resourceType === "practice_set") return "练习";
  if (resourceType === "ppt") return "PPT";
  if (resourceType === "course_overview") return "总览";
  if (resourceType === "teaching_plan") return "教案";
  return "讲义";
}

export default function CourseLearning() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = searchParams.get("courseId") || "series-2"; // default to Advanced React Patterns
  const routeRole = searchParams.get("role") || searchParams.get("job") || searchParams.get("position") || "";
  const roleProfile = getJobLearningProfile(routeRole);
  const requestedRoleStageIndex = Math.max(
    0,
    Math.min(roleProfile.stages.length - 1, Number(searchParams.get("stageId") || "1") - 1),
  );
  const selectedRoleStage = roleProfile.stages[requestedRoleStageIndex] || roleProfile.stages[0];
  const routeTask = searchParams.get("task") || selectedRoleStage.task;
  const routeDeliverable = searchParams.get("deliverable") || selectedRoleStage.deliverable;
  useEffect(() => {
    persistLastRouteCourseId(courseId);
  }, [courseId]);
  const sectionId = searchParams.get("sectionId");
  const resumeStartAt = Math.max(0, Number(searchParams.get("startAt") || "0"));
  const shouldAutoplayOnEnter = searchParams.get("autoplay") === "1";
  const shouldMuteOnEnter = searchParams.get("muted") === "1";
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const learnWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const initialRuntimeRef = useRef<PersistedCourseRuntime | null>(readPersistedCourseRuntime(courseId));
  const pendingResumeTimeRef = useRef<number | null>(
    shouldAutoplayOnEnter
      ? resumeStartAt
      : initialRuntimeRef.current?.currentPlaybackTime && initialRuntimeRef.current.currentPlaybackTime > 0
        ? initialRuntimeRef.current.currentPlaybackTime
        : null,
  );
  const shouldResumeAutoplayRef = useRef<boolean>(shouldAutoplayOnEnter || Boolean(initialRuntimeRef.current?.wasPlaying));
  const shouldResumeMutedRef = useRef<boolean>(shouldMuteOnEnter || Boolean(initialRuntimeRef.current?.wasPlaying));
  const activeUserId = getCurrentLoggedInUserId();
  const activeUserName = getCurrentLoggedInUserName();

  // Fetch current course
  const course = COURSES.find((c) => c.id === courseId) || COURSES[0];

  // Episodes list corresponding to this course representation
  const roleEpisodes = roleProfile.stages.map((stage, index) => ({
    title: `阶段 ${index + 1}：${stage.title}`,
    duration: stage.duration,
    watched: index === 0,
  }));
  const episodes = routeRole ? roleEpisodes : [
    { title: "第一章：软件工程基础与软件危机", duration: "12:15", watched: true },
    { title: "第二章：可行性分析与研发策划", duration: "16:40", watched: true },
    { title: "第三章：软件需求分析与文档建模", duration: "15:20", watched: false },
    { title: "第四章：软件设计、测试与项目管理", duration: "22:10", watched: false },
  ];

  // Local state for interactive features
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeEpisodeIdx, setActiveEpisodeIdx] = useState(() => {
    // A stage selected from the path/resource pages is an explicit navigation
    // instruction and must not be replaced by an older course-level runtime.
    if (routeRole && searchParams.has("stageId")) {
      return requestedRoleStageIndex;
    }
    const restored = initialRuntimeRef.current?.activeEpisodeIdx;
    if (typeof restored === "number" && restored >= 0 && restored < episodes.length) {
      return restored;
    }
    return 0;
  });
  useEffect(() => {
    if (routeRole && searchParams.has("stageId")) {
      setActiveEpisodeIdx(requestedRoleStageIndex);
    }
  }, [requestedRoleStageIndex, routeRole, searchParams]);
  const [chapterListCollapsed, setChapterListCollapsed] = useState(() => initialRuntimeRef.current?.chapterListCollapsed ?? false);
  const [userComment, setUserComment] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(() => Number(pendingResumeTimeRef.current || 0));
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoFrameReady, setVideoFrameReady] = useState(false);
  const [showVideoLoadingOverlay, setShowVideoLoadingOverlay] = useState(shouldAutoplayOnEnter);
  const [videoSourceMounted, setVideoSourceMounted] = useState(() => shouldAutoplayOnEnter);
  const [danmakuEnabled, setDanmakuEnabled] = useState(true);
  const [newDanmakuText, setNewDanmakuText] = useState("");
  const [danmakuColor, setDanmakuColor] = useState("#fb7299");
  const [danmakuMode, setDanmakuMode] = useState<DanmakuMode>("scroll");
  const [persistedDanmakus, setPersistedDanmakus] = useState<VideoDanmakuItem[]>([]);
  const [activeDanmakus, setActiveDanmakus] = useState<ActiveCourseDanmaku[]>([]);
  const [comments, setComments] = useState<CourseComment[]>([]);
  const [learningQuestions, setLearningQuestions] = useState<LearningQuestionSummary[]>([]);
  const [learningNotes, setLearningNotes] = useState<LearningNoteSummary[]>([]);
  const [learningFeedLoading, setLearningFeedLoading] = useState(true);
  const [pageShellReady, setPageShellReady] = useState(false);
  const [commentSort, setCommentSort] = useState<CommentSortMode>("latest");
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [generatingHandout, setGeneratingHandout] = useState(false);
  const [generatingPpt, setGeneratingPpt] = useState(false);
  const [generatingPptVideo, setGeneratingPptVideo] = useState(false);
  const [generatingMindmap, setGeneratingMindmap] = useState(false);
  const [generatingPractice, setGeneratingPractice] = useState(false);
  const [generatingOpenClassroom, setGeneratingOpenClassroom] = useState(false);
  const [openClassroomPreview, setOpenClassroomPreview] = useState<ClassroomPreviewState | null>(null);
  const activeEpisode = episodes[activeEpisodeIdx] || episodes[0];
  const currentSectionTitle = activeEpisode?.title || "当前章节";
  const activeRoleStage = roleProfile.stages[activeEpisodeIdx] || selectedRoleStage;
  const switchChapter = (index: number) => {
    setActiveEpisodeIdx(index);
    if (!routeRole) return;
    const stage = roleProfile.stages[index];
    const params = new URLSearchParams(searchParams);
    params.set("role", roleProfile.role);
    params.set("stageId", String(index + 1));
    params.set("ability", stage.ability);
    params.set("task", stage.task);
    params.set("deliverable", stage.deliverable);
    navigate(`/learn?${params.toString()}`, { replace: true });
  };
  const [selectedResourceDraftType, setSelectedResourceDraftType] = useState<"handout" | "mindmap" | "ppt" | "pptVideo" | "practice">("ppt");
  const [selectedPptTemplate, setSelectedPptTemplate] = useState<PptTemplateId>("academic");
  const [resourceOutlineDraft, setResourceOutlineDraft] = useState(() =>
    buildDefaultResourceOutline(course.title, currentSectionTitle).join("\n"),
  );
  const outlineLines = useMemo(
    () => parseEditableOutline(resourceOutlineDraft, course.title, currentSectionTitle),
    [course.title, currentSectionTitle, resourceOutlineDraft],
  );
  const [recentArtifacts, setRecentArtifacts] = useState<RecentResourceArtifact[]>([]);
  const [recentPpt, setRecentPpt] = useState<RecentPptArtifact | null>(null);
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const [collapsedRecentKeys, setCollapsedRecentKeys] = useState<string[]>([]);
  const [showOnlyCurrentSectionResults, setShowOnlyCurrentSectionResults] = useState(true);
  const [previewState, setPreviewState] = useState<ResourcePreviewState | null>(null);
  const [pptViewer, setPptViewer] = useState<PptViewerState | null>(null);
  const [pptPlaying, setPptPlaying] = useState(false);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, string[]>>({});
  const [practiceShortAnswers, setPracticeShortAnswers] = useState<Record<string, string>>({});
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);
  const [courseLibraryResources, setCourseLibraryResources] = useState<ResourceCard[]>([]);
  const [courseLibraryLoading, setCourseLibraryLoading] = useState(false);
  const [learningCourseDetail, setLearningCourseDetail] = useState<LearningCourseDetail | null>(null);
  const nextDanmakuIndexRef = useRef(0);
  const laneAvailableAtRef = useRef<number[]>(new Array(DANMAKU_SCROLL_LANES.length).fill(0));
  const emittedDanmakuIdsRef = useRef<Set<number>>(new Set());
  const lastVideoTimeRef = useRef(0);

  useEffect(() => {
    if (!pageShellReady) return;
    let cancelled = false;
    const markReady = () => {
      if (!cancelled) {
        setPageShellReady(true);
      }
    };
    const first = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(markReady);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(first);
    };
  }, []);

  useEffect(() => {
    setResourceOutlineDraft(buildDefaultResourceOutline(course.title, currentSectionTitle).join("\n"));
  }, [course.title, currentSectionTitle]);

  useEffect(() => {
    if (!pptPlaying || !pptViewer?.slides.length) return;
    const timer = window.setInterval(() => {
      setPptViewer((current) => {
        if (!current) return current;
        if (current.slideIndex >= current.slides.length - 1) {
          setPptPlaying(false);
          return current;
        }
        return { ...current, slideIndex: current.slideIndex + 1 };
      });
    }, 2600);
    return () => window.clearInterval(timer);
  }, [pptPlaying, pptViewer?.slides.length]);

  useEffect(() => {
    if (!learnWorkspaceRef.current) return;
    const revealNodes = learnWorkspaceRef.current.querySelectorAll<HTMLElement>("[data-learn-reveal]");
    if (!revealNodes.length) return;
    let cancelled = false;
    const runReveal = async () => {
      const { default: gsap } = await import("gsap");
      if (cancelled) return;
      gsap.fromTo(
        revealNodes,
        { opacity: 0, y: 24, scale: 0.985 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.72,
          ease: "power3.out",
          stagger: 0.05,
        },
      );
    };
    const idleId =
      "requestIdleCallback" in window
        ? (window as Window & { requestIdleCallback: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback(
            () => void runReveal(),
            { timeout: 1200 },
          )
        : globalThis.setTimeout(() => void runReveal(), 80);
    return () => {
      cancelled = true;
      if ("cancelIdleCallback" in window) {
        (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(Number(idleId));
      } else {
        globalThis.clearTimeout(Number(idleId));
      }
    };
  }, [courseId, activeEpisodeIdx]);

  const activeVideoSrc = useMemo(() => {
    const localVideos = getCourseVideoPlaylist(courseId);
    if (localVideos?.length) {
      return localVideos[activeEpisodeIdx % localVideos.length];
    }
    return course.playbackUrl || "/videos/software-engineering-4th/project-demo.mp4";
  }, [activeEpisodeIdx, course.playbackUrl, courseId]);
  const activeVideoInsightMeta = useMemo(() => getCourseVideoInsightMeta(activeVideoSrc), [activeVideoSrc]);
  const backendCourseId = useMemo(() => resolveBackendCourseId(courseId), [courseId]);
  const backendCourseCode = useMemo(() => resolveBackendCourseCode(courseId), [courseId]);
  const playbackStorageKey = useMemo(() => getPlaybackStorageKey(courseId, activeEpisodeIdx), [activeEpisodeIdx, courseId]);
  const visibleRecentArtifacts = useMemo(
    () =>
      [...(showOnlyCurrentSectionResults
        ? recentArtifacts.filter((item) => item.sectionTitle === currentSectionTitle)
        : recentArtifacts)].sort((left, right) => {
          const starDiff = Number(Boolean(right.starred)) - Number(Boolean(left.starred));
          if (starDiff !== 0) return starDiff;
          return right.generatedAt.localeCompare(left.generatedAt);
        }),
    [currentSectionTitle, recentArtifacts, showOnlyCurrentSectionResults],
  );
  const visibleRecentPpt =
    recentPpt && (!showOnlyCurrentSectionResults || recentPpt.sectionTitle === currentSectionTitle) ? recentPpt : null;
  const visibleCourseLibraryResources = useMemo(
    () => courseLibraryResources.slice(0, 4),
    [courseLibraryResources],
  );
  const visibleCourseTeachers = useMemo(
    () => (learningCourseDetail?.teachers || []).filter((item) => item.is_show !== false).slice(0, 3),
    [learningCourseDetail],
  );
  const isRecentCardExpanded = (cardKey: string) => !collapsedRecentKeys.includes(cardKey);

  const toggleRecentCardExpanded = (cardKey: string) => {
    setCollapsedRecentKeys((current) =>
      current.includes(cardKey) ? current.filter((item) => item !== cardKey) : [...current, cardKey],
    );
  };

  const expandRecentCard = (cardKey: string) => {
    setCollapsedRecentKeys((current) => current.filter((item) => item !== cardKey));
  };

  const activePptSlide = pptViewer?.slides[pptViewer.slideIndex] || null;
  const updateActivePptSlide = (patch: Partial<DeckSlide>) => {
    setPptViewer((current) => {
      if (!current) return current;
      const slides = current.slides.map((slide, index) =>
        index === current.slideIndex ? { ...slide, ...patch } : slide,
      );
      setRecentPpt((ppt) => (ppt ? { ...ppt, slides } : ppt));
      return { ...current, slides };
    });
  };

  const updateActivePptBullet = (bulletIndex: number, value: string) => {
    if (!activePptSlide) return;
    const bullets = [...activePptSlide.bullets];
    bullets[bulletIndex] = value;
    updateActivePptSlide({ bullets });
  };
  const courseLibraryTypeSummary = useMemo(() => {
    const stats = new Map<string, number>();
    for (const item of courseLibraryResources) {
      const key =
        item.resource_type === "mindmap" || item.resource_type === "mind_map"
          ? "导图"
          : item.resource_type === "practice_set"
            ? "练习"
            : item.resource_type === "course_overview" || item.resource_type === "teaching_plan"
              ? "总览/教案"
              : "讲义";
      stats.set(key, (stats.get(key) || 0) + 1);
    }
    return Array.from(stats.entries()).slice(0, 4);
  }, [courseLibraryResources]);
  const mergeResourcesIntoCourseLibrary = (resources: ResourceCard[]) => {
    const libraryReadyResources = resources.filter((item) => Number(item.resource_id) > 0);
    if (!libraryReadyResources.length) return;
    setCourseLibraryResources((current) => {
      const merged = [...current];
      for (const resource of libraryReadyResources) {
        const resourceId = Number(resource.resource_id);
        const existingIndex = merged.findIndex((item) => Number(item.resource_id) === resourceId);
        if (existingIndex >= 0) {
          merged[existingIndex] = { ...merged[existingIndex], ...resource };
        } else {
          merged.unshift(resource);
        }
      }
      return merged;
    });
  };
  const refreshCourseLibraryFromDatabase = async () => {
    try {
      const result = await studentApi.listResourcesByCourseCode(activeUserId, backendCourseCode);
      setCourseLibraryResources(
        (result.items || []).filter((item) =>
          ["lecture_note", "mindmap", "practice_set", "course_overview", "teaching_plan", "ppt"].includes(item.resource_type),
        ),
      );
    } catch {
      // The generated card is already merged locally; keep it visible if the library refresh is still warming up.
    }
  };
  const previewRecommendation = useMemo<PreviewRecommendation | null>(() => {
    if (!previewState) return null;
    if (previewState.kind === "ppt") {
      return {
        title: "推荐下一步",
        detail: "先快速过一遍课件结构，再交给岗位实训导师逐页拆解，会比直接从视频硬听更容易形成主线。",
        actionLabel: "让 AI 逐页讲",
        onAction: () => {
          const prompt = `请结合这份课件《${previewState.title}》继续给我讲这一节的主线，并把每一页分别在讲什么说清楚。`;
          setPreviewState(null);
          openLearningTutorWithPrompt(prompt);
        },
      };
    }
    if (previewState.resourceKind === "handout") {
      return {
        title: "推荐下一步",
        detail: "看完讲义后，最适合立刻做一轮练习，这样能最快验证这一节是不是真的已经掌握。",
        actionLabel: "下一步生成练习",
        onAction: () => {
          setPreviewState(null);
          void handleGeneratePractice();
        },
      };
    }
    if (previewState.resourceKind === "mindmap") {
      return {
        title: "推荐下一步",
        detail: "导图适合先搭结构，下一步更适合补一份讲义，把每个节点的细节真正讲透。",
        actionLabel: "下一步生成讲义",
        onAction: () => {
          setPreviewState(null);
          void handleGenerateHandout();
        },
      };
    }
    return {
      title: "推荐下一步",
        detail: "先做这组练习，再交给岗位实训导师讲错题思路，能更快定位薄弱点。",
      actionLabel: "让 AI 讲题思路",
      onAction: () => {
        setPreviewState(null);
        openLearningTutorWithPrompt(`请结合这份练习《${previewState.title}》继续给我讲题思路，并告诉我这节课还该补哪些题型。`);
      },
    };
  }, [previewState]);

  useEffect(() => {
    setWorkspaceHydrated(false);
    const hydratePersistedWorkspace = () => {
      const persisted = readPersistedCourseResourceWorkspace(courseId);
      setRecentArtifacts(filterWorkspaceArtifactsByCourseTitle(persisted?.recentArtifacts, course.title));
      setRecentPpt(
        upgradeRecentPptArtifact(
          filterWorkspacePptByCourseTitle(persisted?.recentPpt, course.title),
          course.title,
          currentSectionTitle,
        ),
      );
      setShowOnlyCurrentSectionResults(persisted?.showOnlyCurrentSectionResults ?? true);
      setCollapsedRecentKeys([]);
      setPreviewState(null);
      setPracticeAnswers({});
      setPracticeShortAnswers({});
      setPracticeSubmitted(false);
      setWorkspaceHydrated(true);
    };
    const timeoutId = window.setTimeout(hydratePersistedWorkspace, 0);
    return () => window.clearTimeout(timeoutId);
  }, [course.title, courseId, currentSectionTitle]);

  useEffect(() => {
    if (previewState?.kind === "resource" && previewState.resourceKind === "practice") {
      setPracticeAnswers({});
      setPracticeShortAnswers({});
      setPracticeSubmitted(false);
      return;
    }
    setPracticeAnswers({});
    setPracticeShortAnswers({});
    setPracticeSubmitted(false);
  }, [previewState]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateCourseLibrary() {
      setCourseLibraryLoading(true);
      try {
        const result = await studentApi.listResourcesByCourseCode(activeUserId, backendCourseCode);
        if (cancelled) return;
        setCourseLibraryResources(
          (result.items || []).filter((item) =>
            ["lecture_note", "mindmap", "practice_set", "course_overview", "teaching_plan", "ppt"].includes(item.resource_type),
          ),
        );
        const backendArtifacts = (result.items || [])
          .map((item) => mapBackendResourceToArtifact(item, course.title, currentSectionTitle, courseId))
          .filter((item): item is RecentResourceArtifact => Boolean(item));
        const backendPpt =
          (result.items || [])
            .map((item) => mapBackendResourceToPpt(item, course.title, currentSectionTitle))
            .filter((item): item is RecentPptArtifact => Boolean(item))
            .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0] || null;
        if (backendArtifacts.length) {
          setRecentArtifacts((current) => {
            const merged = [...current];
            for (const artifact of backendArtifacts) {
              const exists = merged.some(
                (item) =>
                  item.resourceId &&
                  artifact.resourceId &&
                  item.resourceId === artifact.resourceId,
              );
              if (!exists) {
                merged.push(artifact);
              }
            }
            return merged;
          });
        }
        if (backendPpt) {
          setRecentPpt((current) => current || backendPpt);
        }
      } catch {
        // Keep current course library resources to avoid blanking the panel while syncing fails.
      } finally {
        if (!cancelled) {
          setCourseLibraryLoading(false);
        }
      }
    }

    const timeoutId = window.setTimeout(() => void hydrateCourseLibrary(), 650);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeUserId, backendCourseCode, course.title, courseId, currentSectionTitle, pageShellReady]);

  useEffect(() => {
    if (!pageShellReady) return;
    let cancelled = false;

    async function hydrateLearningCourseDetail() {
      try {
        const detail = await studentApi.getLearningCourseDetail(backendCourseId);
        if (!cancelled) {
          setLearningCourseDetail(detail);
        }
      } catch {
        if (!cancelled) {
          setLearningCourseDetail(null);
        }
      }
    }

    const timeoutId = window.setTimeout(() => void hydrateLearningCourseDetail(), 900);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [backendCourseId, pageShellReady]);

  useEffect(() => {
    if (!workspaceHydrated) return;
    persistCourseResourceWorkspace(courseId, {
      recentArtifacts,
      recentPpt,
      showOnlyCurrentSectionResults,
    });
  }, [courseId, recentArtifacts, recentPpt, showOnlyCurrentSectionResults, workspaceHydrated]);

  const chapterPlaylistSection = (
    <section className="overflow-hidden ui-radius-28 border border-[#dfe7ef] bg-[linear-gradient(135deg,#ffffff_0%,#f7fbff_62%,#fff7fa_100%)] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
      <button
        type="button"
        onClick={() => setChapterListCollapsed((collapsed) => !collapsed)}
        className="mb-4 flex w-full items-center justify-between border-b border-white/70 pb-3 text-left"
      >
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-[10px] font-black uppercase ui-tracking-brand text-[#5e6c7b] ring-1 ring-[#e4ebf2]">
            <Tv className="h-3.5 w-3.5 ui-text-brand" />
            Chapter Navigator
          </div>
          <h2 className="mt-3 font-sans text-sm font-extrabold tracking-wider uppercase ui-text-ink">
            本课题下辖章节目录
          </h2>
          <p className="mt-1 text-[10px] ui-text-body">
            {chapterListCollapsed ? `当前查看：${activeEpisode.title}` : "点击可切换当前学习章节"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-[#475569]">
          {chapterListCollapsed ? "展开" : "收起"}
          {chapterListCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </span>
      </button>

      {chapterListCollapsed ? (
        <button
          type="button"
          onClick={() => setChapterListCollapsed(false)}
          className="w-full rounded-2xl border border-[#f0d9e3] bg-[linear-gradient(180deg,#fffafb,#ffffff)] px-4 py-3 text-left transition-all hover:border-[#fb7299]/25"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl ui-bg-brand/10 ui-text-brand">
              <Tv className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold ui-text-ink">{activeEpisode.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] ui-text-body font-mono">
                <span>{activeEpisode.duration} 分钟</span>
                {activeEpisode.watched ? (
                  <span className="text-emerald-600 font-bold font-sans">已看完</span>
                ) : (
                  <span className="text-amber-600 font-bold font-sans">继续学习中</span>
                )}
              </div>
            </div>
          </div>
        </button>
      ) : (
        <div className="space-y-2.5">
          {episodes.map((ep, idx) => {
            const isActive = idx === activeEpisodeIdx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => switchChapter(idx)}
                aria-pressed={isActive}
                aria-label={`切换到${ep.title}`}
                className={`w-full cursor-pointer ui-radius-20 border p-3.5 text-left transition-all flex items-start gap-3 ${
                  isActive
                    ? "border-[#fb7299]/35 bg-[linear-gradient(180deg,#fff5f9_0%,#ffffff_100%)] ui-text-brand shadow-[0_12px_30px_rgba(251,114,153,0.12)]"
                    : "border-white/70 bg-white/84 hover:border-[#dce6f2] hover:bg-white"
                }`}
              >
                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isActive ? "ui-bg-brand/10 ui-text-brand" : "bg-[#f5f8fb] text-[#6b7280]"}`}>
                  <Tv className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${isActive ? "ui-bg-brand text-white" : "bg-[#eef2f6] ui-text-secondary"}`}>
                      0{idx + 1}
                    </span>
                    {ep.watched ? (
                      <span className="rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[10px] font-black text-[#027a48]">已看完</span>
                    ) : null}
                  </div>
                  <p className={`mt-2 text-[13px] font-bold truncate ${isActive ? "text-[#d94d7d]" : "ui-text-ink"}`}>
                    {ep.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] font-mono ui-text-muted-rose/70">
                    <span>{ep.duration} 分钟</span>
                    <span>{isActive ? "当前章节" : "可切换"}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

  const learningAssistantPrompts = [
    "总结视频",
    "知识点时间轴",
    "术语解释",
    "这段在讲什么",
    "作者刚才提到的公式是什么",
    "这个术语什么意思",
  ];
  const buildVideoTutorQuery = (startAt: number) =>
    `我正在看《${course.title}》的“${activeEpisode.title}”，当前视频停在 ${formatPlaybackClock(startAt)}。\n\n请先结合这个时间点解释当前片段在讲什么，并帮我指出这里最容易问的问题。`;

  useEffect(() => {
    const startAt = Number(videoRef.current?.currentTime || currentPlaybackTime || 0);
    saveActiveTutorContext({
      courseId,
      sectionId: activeEpisodeIdx,
      mode: "learning",
      title: course.title,
      subtitle: `${activeEpisode.title} · ${formatPlaybackClock(startAt)}`,
      videoSrc: activeVideoSrc,
      videoResourceId: activeVideoInsightMeta?.resourceId,
      videoFileId: activeVideoInsightMeta?.fileId,
      videoFileName: activeVideoInsightMeta?.fileName,
      quickPrompts: learningAssistantPrompts,
      startAt,
      autoplay: true,
      muted: true,
    });
  }, [activeEpisodeIdx, activeVideoInsightMeta, activeVideoSrc, course.title, courseId, currentPlaybackTime, episodes]);

  const videoLearningAiSection = (
    <section className="overflow-hidden ui-radius-28 border border-[#dfe7ef] bg-[linear-gradient(135deg,#0f172a_0%,#132238_45%,#1c3553_100%)] p-[1px] shadow-[0_20px_48px_rgba(15,23,42,0.18)]">
      <div className="rounded-[27px] bg-[radial-gradient(circle_at_top_right,rgba(251,114,153,0.16),transparent_32%),linear-gradient(180deg,#fbfdff_0%,#f4f8fc_100%)] px-4 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/88 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#46607a] ring-1 ring-[#e5ebf2]">
              <Bot className="h-3.5 w-3.5 ui-text-brand" />
              学习现场
            </div>
            <div className="mt-3 text-[15px] font-black tracking-[-0.02em] ui-text-ink">
          右侧岗位实训导师已经接入当前视频、章节和播放进度
            </div>
            <div className="mt-1.5 max-w-2xl text-[12px] leading-6 text-[#526071]">
              在这一页边看边问，它会结合当前片段、术语上下文和课堂生成结果继续讲。
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const startAt = rememberCurrentPlayback();
              const playbackLabel = formatPlaybackClock(startAt);
              openTutorPanel({
                courseId,
                sectionId: activeEpisodeIdx,
                mode: "learning",
                title: course.title,
                subtitle: `${activeEpisode.title} · ${playbackLabel}`,
                query: buildVideoTutorQuery(startAt),
                videoSrc: activeVideoSrc,
                videoResourceId: activeVideoInsightMeta?.resourceId,
                videoFileId: activeVideoInsightMeta?.fileId,
                videoFileName: activeVideoInsightMeta?.fileName,
                quickPrompts: [
                  `解释 ${playbackLabel} 这一段`,
                  "这里的重点是什么",
                  "给我举个例子",
                  ...learningAssistantPrompts,
                ],
                startAt,
                autoplay: true,
                muted: true,
              });
    showToast(`岗位实训导师已读取当前视频 ${playbackLabel} 的上下文`);
            }}
            className="shrink-0 rounded-full bg-[#111827] px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_32px_rgba(17,24,39,0.2)] transition-all hover:-translate-y-0.5 hover:bg-[#0b1220]"
          >
            直接对当前视频提问
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="course-glass-info-card">
            <div className="text-[10px] font-black uppercase ui-tracking-brand ui-text-subtle">当前上下文</div>
            <div className="mt-2 text-[13px] font-extrabold ui-text-ink">{activeEpisode.title}</div>
            <div className="mt-1 text-[11px] leading-5 ui-text-body">问题会优先锚定到当前章节和正在播放的内容，不会泛泛而谈。</div>
          </div>
          <div className="course-glass-info-card">
            <div className="text-[10px] font-black uppercase ui-tracking-brand ui-text-subtle">播放进度</div>
            <div className="mt-2 text-[13px] font-extrabold ui-text-ink">
              {String(Math.floor(currentPlaybackTime / 60)).padStart(2, "0")}:{String(Math.floor(currentPlaybackTime % 60)).padStart(2, "0")}
            </div>
            <div className="mt-1 text-[11px] leading-5 ui-text-body">播放节点、课堂生成资料和你的提问会一起进入导师上下文。</div>
          </div>
          <div className="course-glass-info-card">
            <div className="text-[10px] font-black uppercase ui-tracking-brand ui-text-subtle">下一步</div>
            <div className="mt-2 text-[13px] font-extrabold ui-text-ink">先看视频，再追问卡点</div>
            <div className="mt-1 text-[11px] leading-5 ui-text-body">适合解释公式、拆术语、补代码思路，或把刚生成的讲义继续讲透。</div>
          </div>
        </div>
      </div>
    </section>
  );

  const resourceDraftOptions = [
    {
      id: "handout" as const,
      label: "讲义",
      title: "复习讲义",
      detail: "按大纲生成可阅读的课堂讲义",
      Icon: FileText,
      loading: generatingHandout,
      onGenerate: () => void handleGenerateHandout(),
    },
    {
      id: "mindmap" as const,
      label: "导图",
      title: "结构导图",
      detail: "按大纲整理知识结构和概念关系",
      Icon: Network,
      loading: generatingMindmap,
      onGenerate: () => void handleGenerateMindmap(),
    },
    {
      id: "ppt" as const,
      label: "PPT",
      title: "课件草案",
      detail: "生成可查看、播放、编辑的课件页",
      Icon: Presentation,
      loading: generatingPpt,
      onGenerate: () => void handleGeneratePpt(),
    },
    {
      id: "pptVideo" as const,
      label: "视频",
      title: "PPT讲解视频",
      detail: "把课件页转成分镜和旁白讲解",
      Icon: Video,
      loading: generatingPptVideo,
      onGenerate: () => void handleGeneratePptExplanationVideo(),
    },
    {
      id: "practice" as const,
      label: "练习",
      title: "随堂练习",
      detail: "按大纲生成题目、选项和解析",
      Icon: Sparkles,
      loading: generatingPractice,
      onGenerate: () => void handleGeneratePractice(),
    },
  ];
  const activeResourceDraftOption =
    resourceDraftOptions.find((option) => option.id === selectedResourceDraftType) || resourceDraftOptions[0];
  const resourceGenerationBusy = generatingHandout || generatingMindmap || generatingPractice || generatingPpt;
  const resourceActionBusy = resourceGenerationBusy || generatingPptVideo;

  const classroomResourceWorkspaceButtonsSection = (
    <section
      data-learn-reveal
      className="overflow-hidden rounded-2xl border border-[#D4DCE6] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
    >
      <div className="border-b border-[#E5EAF1] pb-3">
        <div className="inline-flex items-center gap-2 rounded-md bg-[#EEF3FF] px-2.5 py-1 text-[10px] font-black text-[#002FA7]">
          <Sparkles className="h-3.5 w-3.5 ui-text-brand" />
          AI 资料生成
        </div>
        <h3 className="mt-2 text-sm font-black text-[#111827]">
          先生成可编辑大纲，再生成对应资料
        </h3>
        <p className="mt-1 text-[11px] leading-5 text-[#64748B]">
          大纲会作为生成依据传入讲义、导图、PPT 和练习，先改结构再生成，减少跑题。
        </p>
      </div>

      {resourceGenerationBusy ? (
        <div className="course-generated-loading">
          <LazyAiLoading
            caption="课堂资源正在生成"
            subcaption="生成会围绕当前大纲展开，完成后自动打开结果预览。"
          />
        </div>
      ) : null}

      <div className="mt-3 grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          {resourceDraftOptions.map((option) => {
            const Icon = option.Icon;
            const active = selectedResourceDraftType === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedResourceDraftType(option.id)}
                disabled={resourceActionBusy}
                className={`rounded-lg border px-3 py-2 text-left transition disabled:opacity-60 ${
                  active
                    ? "border-[#002FA7] bg-[#F7F9FF] text-[#002FA7]"
                    : "border-[#E5EAF1] bg-white text-[#334155] hover:border-[#BFD0FF] hover:bg-[#FAFBFF]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs font-black">{option.label}</span>
                </div>
                <div className="mt-1 text-[10px] leading-4 text-[#64748B]">{option.detail}</div>
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border border-[#D4DCE6] bg-[#FAFBFC]">
          <div className="flex items-center justify-between gap-2 border-b border-[#E5EAF1] px-3 py-2">
            <div>
              <div className="text-xs font-black text-[#111827]">可编辑大纲</div>
              <div className="mt-0.5 text-[10px] text-[#64748B]">每行一个小节，生成时会按这些小节展开。</div>
            </div>
            <button
              type="button"
              onClick={() => setResourceOutlineDraft(buildDefaultResourceOutline(course.title, currentSectionTitle).join("\n"))}
              className="rounded-md border border-[#D4DCE6] bg-white px-2 py-1 text-[10px] font-bold text-[#475569] hover:bg-[#F7F7F8]"
            >
              重置
            </button>
          </div>
          <textarea
            value={resourceOutlineDraft}
            onChange={(event) => setResourceOutlineDraft(event.target.value)}
            disabled={resourceGenerationBusy}
            rows={6}
            className="min-h-[136px] w-full resize-y bg-white px-3 py-2 text-xs leading-6 text-[#111827] outline-none placeholder:text-[#94A3B8] disabled:opacity-60"
            placeholder="输入生成大纲，每行一个要点"
          />
        </div>

        {(selectedResourceDraftType === "ppt" || selectedResourceDraftType === "pptVideo") ? (
          <div className="rounded-lg border border-[#D4DCE6] bg-white px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-black text-[#111827]">PPT 模板</div>
                <div className="mt-0.5 text-[10px] text-[#64748B]">模板会影响封面、目录、内容页版式和导出 PPT。</div>
              </div>
              <span className="rounded-sm bg-[#EEF3FF] px-2 py-1 text-[10px] font-black text-[#002FA7]">
                {getPptTemplateOption(selectedPptTemplate).label}
              </span>
            </div>
            <div className="mt-3 rounded-xl border border-[#DDE7F2] bg-[#F8FAFC] p-2">
              <PptTemplateDeckPreview template={getPptTemplateOption(selectedPptTemplate)} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-black text-[#111827]">{getPptTemplateOption(selectedPptTemplate).label}</div>
                  <div className="mt-0.5 text-[10px] leading-4 text-[#64748B]">{getPptTemplateOption(selectedPptTemplate).detail}</div>
                </div>
                <span className="rounded bg-white px-2 py-1 text-[9px] font-bold text-[#64748B] ring-1 ring-[#E2E8F0]">
                  {getPptTemplateOption(selectedPptTemplate).source}
                </span>
              </div>
            </div>
            <div className="mt-3 grid max-h-[340px] gap-2 overflow-auto pr-1">
              {PPT_TEMPLATE_OPTIONS.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedPptTemplate(template.id)}
                  disabled={resourceActionBusy}
                  className={`rounded-xl border p-2 text-left transition disabled:opacity-60 ${
                    selectedPptTemplate === template.id
                      ? "border-[#002FA7] bg-[#F7F9FF]"
                      : "border-[#E5EAF1] bg-white hover:border-[#BFD0FF]"
                  }`}
                >
                  <PptTemplateDeckPreview template={template} compact />
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="text-xs font-black text-[#111827]">{template.label}</div>
                        <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] font-bold text-[#64748B]">
                          {template.source}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] leading-4 text-[#64748B]">{template.detail}</div>
                    </div>
                    {selectedPptTemplate === template.id ? (
                      <span className="shrink-0 rounded-full bg-[#002FA7] px-2 py-0.5 text-[9px] font-black text-white">已选</span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-[#E5EAF1] bg-white px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-black text-[#111827]">{activeResourceDraftOption.title}</div>
              <div className="mt-1 truncate text-[10px] text-[#64748B]">
                当前章节：{currentSectionTitle} · {outlineLines.length} 个大纲点
              </div>
            </div>
            <button
              type="button"
              onClick={activeResourceDraftOption.onGenerate}
              disabled={resourceActionBusy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#002FA7] px-3 py-2 text-xs font-black text-white transition hover:bg-[#00247D] disabled:opacity-60"
            >
              {activeResourceDraftOption.loading ? "生成中" : `生成${activeResourceDraftOption.title}`}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );

  const classroomGeneratedResultsSection =
    visibleRecentArtifacts.length > 0 || visibleRecentPpt ? (
      <section className="overflow-hidden ui-radius-28 border border-[#dfe7ef] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_52%,#fff8fb_100%)] p-4 shadow-[0_16px_38px_rgba(15,23,42,0.06)] space-y-3">
        <div className="ui-radius-22 border border-white/80 bg-white/82 px-4 py-3 backdrop-blur-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-black uppercase ui-tracking-tight ui-text-subtle">Generated</p>
                  <span className="rounded-full ui-bg-panel px-2 py-0.5 text-[10px] font-bold ui-text-secondary">
                    {visibleRecentArtifacts.length + (visibleRecentPpt ? 1 : 0)} 项结果
                  </span>
                </div>
                <p className="mt-1 text-sm font-extrabold ui-text-ink">本节生成结果</p>
                <p className="mt-1 text-[10px] ui-text-secondary">实时生成、直接预览、继续追问。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/resources?courseId=${course.id}`)}
                  className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold ui-text-body ring-1 ring-[#E7ECF2] transition hover:bg-[#F8FAFC]"
                >
                  去资源页
                </button>
                <button
                  type="button"
                  onClick={() => setShowOnlyCurrentSectionResults((value) => !value)}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-semibold transition ${
                    showOnlyCurrentSectionResults
                      ? "ui-bg-dark text-white"
                      : "ui-bg-panel ui-text-body hover:bg-[#EEF2F6]"
                  }`}
                >
                  {showOnlyCurrentSectionResults ? "只看当前章节" : "查看全部章节"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecentArtifacts([]);
                    setRecentPpt(null);
                    setCollapsedRecentKeys([]);
                  }}
                  className="rounded-full ui-bg-panel px-3 py-1.5 text-[10px] font-semibold ui-text-body transition hover:bg-[#EEF2F6]"
                >
                  清空结果
                </button>
              </div>
            </div>

            {(generatingHandout || generatingMindmap || generatingPractice || generatingPpt) ? (
              <div className="mt-3 ui-radius-20 border border-[#e8edf2] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_56%,#fff5f8_100%)] px-4 py-3.5">
                <LazyAiLoading
                  caption="生成结果正在回填"
          subcaption="下方卡片会逐步切换成可下载、可预览、可继续交给岗位实训导师的正式结果。"
                />
              </div>
            ) : null}

            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              {visibleRecentArtifacts.map((artifact) => {
                const cardKey = `artifact-${artifact.kind}`;
                const expanded = isRecentCardExpanded(cardKey);
                const displayTitle = artifact.customTitle || artifact.title;
                const practiceQuestions =
                  artifact.kind === "practice"
                    ? artifact.practiceQuestions?.length
                      ? artifact.practiceQuestions
                      : extractPracticeQuestions(
                          {
                            resource_id: null,
                            resource_type: "practice_set",
                            title: displayTitle,
                            summary: artifact.summary,
                            content_markdown: artifact.rawContent || (artifact.previewContent || []).join("\n"),
                            source_titles: [],
                            study_suggestion: "",
                            source_file_count: 0,
                            source_files: [],
                          },
                          course.title,
                          artifact.sectionTitle,
                        )
                    : [];
                const artifactMindmapNodes =
                  artifact.kind === "mindmap"
                    ? artifact.mindmapNodes?.length
                      ? artifact.mindmapNodes
                      : buildMindmapTreeFromLines(displayTitle, artifact.previewContent || [artifact.summary])
                    : [];
                const artifactPreviewItems =
                  artifact.kind === "handout"
                    ? buildExpandedHandoutPreviewContent(
                        {
                          resource_id: null,
                          resource_type: "lecture_note",
                          title: displayTitle,
                          summary: artifact.summary,
                          content_markdown: artifact.rawContent || (artifact.previewContent || []).join("\n"),
                          source_titles: [],
                          study_suggestion: "",
                          source_file_count: 0,
                          source_files: [],
                        },
                        course.title,
                        artifact.sectionTitle,
                      )
                    : artifact.previewContent || [artifact.summary];
                const handoutPreviewSections =
                  artifact.kind === "handout" ? buildHandoutPreviewSections(artifactPreviewItems) : [];
                const resultMeta = getGeneratedResultMeta(artifact.kind);
                const ResultIcon = resultMeta.Icon;
                return (
                  <div
                    key={cardKey}
                    className={`overflow-hidden rounded-[26px] border ${resultMeta.borderClass} ${resultMeta.bgClass} px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(15,23,42,0.08)] ${
                      artifact.kind === "mindmap" || artifact.kind === "handout" ? "xl:col-span-2" : ""
                    }`}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-white/82 px-2.5 py-1 text-[10px] font-black uppercase ui-tracking-tight text-[#516072] ring-1 ring-black/5">
                        生成结果
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${resultMeta.pillClass}`}>
                        {artifact.loading ? "生成中" : "已完成"}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/60">
                        <div className={`h-full rounded-full ${artifact.loading ? "w-2/3 animate-pulse ui-bg-brand" : "w-full bg-[#111827]"}`} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleRecentCardExpanded(cardKey)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center ui-radius-18 ${resultMeta.iconClass}`}>
                          <ResultIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${resultMeta.pillClass}`}>
                              来自：{resultMeta.label}
                            </span>
                            <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black ui-text-body ring-1 ring-black/5">
                              {resultMeta.resultLabel}
                            </span>
                            {artifact.starred ? <Bookmark className="h-3.5 w-3.5 fill-current ui-text-brand" /> : null}
                          </div>
                          <p className="mt-2 text-sm font-extrabold leading-5 ui-text-ink">{displayTitle}</p>
                          <p className="mt-1 text-[11px] leading-5 ui-text-secondary">
                            {resultMeta.description}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] ui-text-subtle">
                            <span>章节：{artifact.sectionTitle}</span>
                            <span>·</span>
                            <span>{artifact.generatedAt}</span>
                          </div>
                        </div>
                      </div>
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/82 ui-text-secondary shadow-sm">
                        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </button>

                    {expanded ? (
                      <div className="mt-3 border-t border-white/80 pt-3">
                        <div className="rounded-2xl bg-white/55 px-3 py-2.5 text-[10px] leading-5 ui-text-body ring-1 ring-white/70">
                          {artifact.summary}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={artifact.loading}
                            onClick={() => {
                              const prompt =
                                artifact.kind === "handout"
                                  ? `请结合这份讲义《${displayTitle}》继续展开讲解，并告诉我这一节最容易混淆的地方。`
                                  : artifact.kind === "mindmap"
                                    ? `请结合这份导图《${displayTitle}》继续讲解这些知识点之间的关系，并告诉我应该按什么顺序复习。`
                                    : `请结合这份练习《${displayTitle}》继续给我讲题思路，并告诉我这节课还该补哪些题型。`;
                              openLearningTutorWithPrompt(prompt);
                            }}
                            className={`rounded-full px-3 py-1.5 text-[10px] font-semibold transition ${
                              artifact.loading ? "bg-[#CBD5E1] text-white cursor-not-allowed" : "ui-bg-dark text-white hover:bg-black"
                            }`}
                          >
                  交给岗位实训导师
                          </button>
                          <button
                            type="button"
                            disabled={artifact.loading || !artifact.downloadUrl}
                            onClick={async () => {
                              try {
                                if (artifact.resourceId && artifact.preferredFormat) {
                                  const backendFormat =
                                    artifact.preferredFormat === "txt" ? "markdown" : artifact.preferredFormat;
                                  await openBackendResourceDownload(artifact.resourceId, activeUserId, backendFormat);
                                  return;
                                }
                              } catch {
                                // Fall through to local export when backend delivery is unavailable.
                              }

                              if (artifact.kind === "handout") {
                                const handoutSections =
                                  artifact.rawContent?.trim()
                                    ? buildExpandedHandoutPreviewContent(
                                        {
                                          resource_id: null,
                                          resource_type: "lecture_note",
                                          title: displayTitle,
                                          summary: artifact.summary,
                                          content_markdown: artifact.rawContent,
                                          source_titles: [],
                                          study_suggestion: "",
                                          source_file_count: 0,
                                          source_files: [],
                                        },
                                        course.title,
                                        artifact.sectionTitle,
                                      )
                                    : buildExpandedHandoutPreviewContent(null, course.title, artifact.sectionTitle);
                                downloadWordDocument(displayTitle, handoutSections);
                                return;
                              }
                              if (artifact.kind === "mindmap") {
                                const mindmapText = artifactMindmapNodes.length
                                  ? serializeMindmapNodes(artifactMindmapNodes).join("\n")
                                  : artifact.rawContent || (artifact.previewContent || [artifact.summary]).join("\n");
                                downloadTextAsset(displayTitle, mindmapText, "md", "text/markdown;charset=utf-8");
                                return;
                              }
                              downloadTextAsset(displayTitle, buildPracticeDownloadText(displayTitle, practiceQuestions), "txt");
                            }}
                            className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold transition ${
                              artifact.loading || !artifact.downloadUrl
                                ? "border-[#E5E7EB] ui-bg-panel ui-text-subtle cursor-not-allowed"
                                : "border-white/70 bg-white/82 ui-text-body hover:bg-white"
                            }`}
                          >
                            {artifact.kind === "practice" ? "下载练习" : artifact.kind === "mindmap" ? "下载导图" : "下载讲义"}
                          </button>
                        </div>

                        {!artifact.loading ? (
                          artifact.kind === "mindmap" ? (
                            <div className="mt-4 ui-radius-28 border border-[#D6F5E8] bg-[linear-gradient(135deg,#f5fffb,#fcfefe)] p-4 shadow-[0_18px_34px_rgba(16,185,129,0.08)]">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-[11px] font-black uppercase ui-tracking-tight text-[#10b981]">Mindmap Preview</div>
                                  <p className="mt-1 text-sm font-black ui-text-ink">本节知识结构图</p>
                                  <p className="mt-1 text-[11px] leading-5 ui-text-body">适合先看主线，再按分支定位概念关系和复习顺序。</p>
                                </div>
                                <span className="rounded-full bg-[#ECFDF3] px-3 py-1 text-[10px] font-black text-[#027A48]">
                                  {artifactMindmapNodes.length || 0} 个主节点
                                </span>
                              </div>
                              <Suspense
                                fallback={
                                  <div className="rounded-2xl border border-[#D6F5E8] bg-[#F5FFFB] px-4 py-5 text-center text-xs font-bold text-[#10B981]">
                                    正在加载导图预览...
                                  </div>
                                }
                              >
                                <HorizontalMindmap
                                  nodes={artifactMindmapNodes}
                                  title="Section Mindmap"
                                  subtitle="按当前章节主线、概念分支和复习顺序横向展开。"
                                  variant="compact"
                                />
                              </Suspense>
                            </div>
                          ) : artifact.kind === "practice" && practiceQuestions.length ? (
                            <div className="mt-4 ui-radius-28 border border-[#F8DEB1] bg-[linear-gradient(135deg,#fffaf0,#ffffff)] p-4 shadow-[0_18px_34px_rgba(245,158,11,0.08)]">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-[11px] font-black uppercase ui-tracking-tight text-[#d97706]">Practice Preview</div>
                                  <p className="mt-1 text-sm font-black ui-text-ink">随堂练习题卡</p>
                  <p className="mt-1 text-[11px] leading-5 ui-text-body">先快速做题，再把不会的题继续交给岗位实训导师讲透。</p>
                                </div>
                                <span className="rounded-full bg-[#FFF3D6] px-3 py-1 text-[10px] font-black text-[#b45309]">
                                  预览前 3 题
                                </span>
                              </div>
                              <div className="space-y-3">
                                {practiceQuestions.slice(0, 3).map((question, index) => (
                                  <div key={question.id} className="ui-radius-22 border border-[#F8E7C8] bg-white px-4 py-3.5 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                                    <div className="flex items-start gap-3">
                                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f59e0b] text-[10px] font-bold text-white">
                                        {index + 1}
                                      </span>
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold leading-6 ui-text-ink">{question.question}</p>
                                        {question.options.length ? (
                                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                            {question.options.map((option, optionIndex) => (
                                              <div key={`${question.id}-${optionIndex}`} className="rounded-xl border border-[#F3F4F6] bg-[#FCFCFD] px-3 py-2 text-[11px] leading-5 ui-text-secondary">
                                                <span className="font-bold text-[#b45309]">{String.fromCharCode(65 + optionIndex)}.</span> {option}
                                              </div>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : artifact.kind === "handout" ? (
                            <div className="mt-4 rounded-3xl border border-[#F7C7D8] bg-[linear-gradient(135deg,#fff8fb,#ffffff)] p-4 shadow-[0_16px_32px_rgba(251,114,153,0.08)]">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-[11px] font-black uppercase ui-tracking-tight ui-text-brand">Full Handout Preview</div>
                                  <p className="mt-1 text-sm font-black ui-text-ink">学习讲义手册</p>
                                  <p className="mt-1 text-[11px] leading-5 ui-text-body">适合顺着主线通读，再挑重点模块逐块精读。</p>
                                </div>
                                <span className="course-chip-pink">
                                  {handoutPreviewSections.length} 个讲义模块
                                </span>
                              </div>
                              <div className="mt-3 grid gap-3 xl:grid-cols-3">
                                {handoutPreviewSections.map((section, index) => (
                                  <div key={`${cardKey}-handout-${index}`} className="ui-radius-22 border border-[#FBE3EB] bg-[#FFFBFD] px-3.5 py-3 shadow-[0_10px_20px_rgba(251,114,153,0.05)]">
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ui-bg-brand text-[10px] font-black text-white">
                                        {index + 1}
                                      </span>
                                      <h4 className="text-sm font-black ui-text-ink">{section.title}</h4>
                                    </div>
                                    <p className="mt-2 text-[12px] leading-6 ui-text-body">{section.body}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 rounded-2xl border border-[#E8EDF5] bg-[#FCFDFE] p-3.5">
                              <div className="mb-3 text-[11px] font-black uppercase ui-tracking-tight ui-text-subtle">Inline Preview</div>
                              <div className="space-y-2.5">
                                {artifactPreviewItems.slice(0, 10).map((item, index) => (
                                  <div key={`${cardKey}-${index}`} className="rounded-2xl border ui-border-soft bg-white px-3.5 py-3">
                                    <div className="flex items-start gap-3">
                                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ui-bg-dark text-[10px] font-bold text-white">
                                        {index + 1}
                                      </span>
                                      <p className="text-sm leading-6 ui-text-ink">{item}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {visibleRecentPpt ? (() => {
                const cardKey = "artifact-ppt";
                const expanded = isRecentCardExpanded(cardKey);
                const displayTitle = visibleRecentPpt.customTitle || visibleRecentPpt.fileName.replace(/\.pptx$/i, "");
                const resultMeta = getGeneratedResultMeta("ppt");
                const ResultIcon = resultMeta.Icon;
                const pptPreviewCards = buildPptPreviewCards(visibleRecentPpt.slides || []);
                return (
                  <div key={cardKey} className={`rounded-[26px] border ${resultMeta.borderClass} ${resultMeta.bgClass} px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] xl:col-span-2`}>
                    <button
                      type="button"
                      onClick={() => toggleRecentCardExpanded(cardKey)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${resultMeta.iconClass}`}>
                          <ResultIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${resultMeta.pillClass}`}>
                              来自：{resultMeta.label}
                            </span>
                            <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black ui-text-body ring-1 ring-black/5">
                              {resultMeta.resultLabel}
                            </span>
                            {visibleRecentPpt.starred ? <Bookmark className="h-3.5 w-3.5 fill-current ui-text-navy" /> : null}
                          </div>
                          <p className="mt-2 truncate text-sm font-extrabold leading-5 ui-text-ink">{displayTitle}</p>
                          <p className="mt-1 text-[11px] leading-5 ui-text-secondary">
                            {resultMeta.description}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] ui-text-subtle">
                            <span>{visibleRecentPpt.loading ? "正在生成中" : `${visibleRecentPpt.slideCount} 页 .pptx 已生成`}</span>
                            <span>·</span>
                            <span>章节：{visibleRecentPpt.sectionTitle}</span>
                            <span>·</span>
                            <span>{visibleRecentPpt.generatedAt}</span>
                          </div>
                        </div>
                      </div>
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/82 ui-text-secondary shadow-sm">
                        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </button>

                    {expanded ? (
                      <div className="mt-3 border-t border-white/80 pt-3">
                        <div className="rounded-2xl bg-white/60 px-3 py-2.5 text-[10px] leading-5 ui-text-body ring-1 ring-white/70">
                          {visibleRecentPpt.summary || "当前没有更多说明。"}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={visibleRecentPpt.loading}
                            onClick={() => {
                              const prompt = `请结合这份课件《${displayTitle}》继续给我讲这一节的主线，并把每一页分别在讲什么说清楚。`;
                              openLearningTutorWithPrompt(prompt);
                            }}
                            className={`rounded-full px-3 py-1.5 text-[10px] font-semibold transition ${
                              visibleRecentPpt.loading ? "bg-[#CBD5E1] text-white cursor-not-allowed" : "ui-bg-dark text-white hover:bg-black"
                            }`}
                          >
                    交给岗位实训导师
                          </button>
                          <button
                            type="button"
                            disabled={visibleRecentPpt.loading || generatingPptVideo}
                            onClick={() => void handleGeneratePptExplanationVideo(visibleRecentPpt)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold transition ${
                              visibleRecentPpt.loading || generatingPptVideo
                                ? "border-[#E5E7EB] ui-bg-panel ui-text-subtle cursor-not-allowed"
                                : "border-[#D6E4FF] bg-[#EFF6FF] text-[#2563eb] hover:bg-[#DBEAFE]"
                            }`}
                          >
                            <Video className="h-3.5 w-3.5" />
                            {generatingPptVideo ? "生成视频中" : visibleRecentPpt.explanationVideo ? "重新生成讲解视频" : "生成讲解视频"}
                          </button>
                          <button
                            type="button"
                            disabled={visibleRecentPpt.loading}
                            onClick={async () => {
                              try {
                                if (visibleRecentPpt.resourceId && visibleRecentPpt.preferredFormat) {
                                  await openBackendResourceDownload(
                                    visibleRecentPpt.resourceId,
                                    activeUserId,
                                    visibleRecentPpt.preferredFormat,
                                  );
                                  return;
                                }
                              } catch {
                                // Fall back to client-side export when backend delivery is unavailable.
                              }
                              await exportPptxOnDemand(visibleRecentPpt.fileName, visibleRecentPpt.slides);
                            }}
                            className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold transition ${
                              visibleRecentPpt.loading
                                ? "border-[#E5E7EB] ui-bg-panel ui-text-subtle cursor-not-allowed"
                                : "border-white/70 bg-white/82 ui-text-body hover:bg-white"
                            }`}
                          >
                            导出 PPT
                          </button>
                        </div>

                        {visibleRecentPpt.explanationVideo ? (
                          <div className="mt-4 overflow-hidden rounded-3xl border border-[#D6E4FF] bg-[linear-gradient(135deg,#0F172A_0%,#172554_56%,#111827_100%)] text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
                              <div className="relative min-h-[220px] overflow-hidden p-5">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(251,114,153,0.28),transparent_34%),radial-gradient(circle_at_88%_12%,rgba(96,165,250,0.26),transparent_30%)]" />
                                <div className="relative flex h-full min-h-[190px] flex-col justify-between rounded-2xl border border-white/16 bg-white/8 p-4 backdrop-blur">
                                  <div>
                                    <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[10px] font-black text-white/86">
                                      <Video className="h-3.5 w-3.5 text-[#93C5FD]" />
                                      PPT 讲解视频
                                    </div>
                                    <h4 className="mt-3 text-lg font-black leading-snug">{visibleRecentPpt.explanationVideo.title}</h4>
                                    <p className="mt-2 max-w-xl text-xs leading-6 text-white/70">{visibleRecentPpt.explanationVideo.summary}</p>
                                  </div>
                                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                                    <div className="rounded-2xl border border-white/12 bg-white/10 px-3 py-2">
                                      <div className="text-[10px] font-bold text-white/52">时长</div>
                                      <div className="mt-1 text-sm font-black">{visibleRecentPpt.explanationVideo.durationLabel}</div>
                                    </div>
                                    <div className="rounded-2xl border border-white/12 bg-white/10 px-3 py-2">
                                      <div className="text-[10px] font-bold text-white/52">分镜</div>
                                      <div className="mt-1 text-sm font-black">{visibleRecentPpt.explanationVideo.storyboard.length} 段</div>
                                    </div>
                                    <div className="rounded-2xl border border-white/12 bg-white/10 px-3 py-2">
                                      <div className="text-[10px] font-bold text-white/52">旁白</div>
                                      <div className="mt-1 truncate text-sm font-black">{visibleRecentPpt.explanationVideo.voiceRole}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="border-t border-white/12 bg-black/18 p-4 lg:border-l lg:border-t-0">
                                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#93C5FD]">Storyboard</div>
                                <div className="mt-3 max-h-[260px] space-y-2 overflow-auto pr-1">
                                  {visibleRecentPpt.explanationVideo.storyboard.slice(0, 5).map((scene) => (
                                    <div key={`${visibleRecentPpt.fileName}-video-scene-${scene.slideIndex}`} className="rounded-2xl border border-white/10 bg-white/8 px-3 py-2.5">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-black text-white/80">第 {scene.slideIndex} 页</span>
                                        <span className="text-[10px] font-bold text-white/50">{scene.durationSeconds}s</span>
                                      </div>
                                      <div className="mt-2 text-xs font-black text-white">{scene.title}</div>
                                      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-white/62">{scene.narration}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {!visibleRecentPpt.loading ? (
                          <div className="mt-4 rounded-3xl border border-[#D6E4FF] bg-[linear-gradient(180deg,#F8FBFF_0%,#FFFFFF_100%)] p-4 shadow-[0_18px_36px_rgba(37,99,235,0.08)]">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="text-[11px] font-black uppercase ui-tracking-tight ui-text-navy">PPTX Deck Preview</div>
                                <p className="mt-1 text-sm font-black ui-text-ink">课件页缩略面板</p>
                                <p className="mt-1 text-[11px] leading-5 ui-text-body">每一页都可以直接点开查看，适合快速过目录和页面主线。</p>
                              </div>
                              <span className="course-chip-pink">
                                {visibleRecentPpt.fileName.endsWith(".pptx") ? visibleRecentPpt.fileName : `${visibleRecentPpt.fileName}.pptx`}
                              </span>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                              {pptPreviewCards.map((slide) => (
                                <button
                                  key={`${cardKey}-slide-${slide.index}`}
                                  type="button"
                                  onClick={() =>
                                    setPptViewer({
                                      title: displayTitle,
                                      fileName: visibleRecentPpt.fileName,
                                      slides: visibleRecentPpt.slides || [],
                                      slideIndex: slide.index - 1,
                                    })
                                  }
                                  className="overflow-hidden rounded-2xl border border-[#DCE7F7] bg-white text-left shadow-[0_12px_26px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(37,99,235,0.14)]"
                                >
                                  <PptSlideThumbnail slide={slide} />
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })() : null}

              {pptViewer && activePptSlide ? (
                <div className="fixed inset-0 z-[220] flex items-center justify-center bg-[#0f172a]/55 px-4 py-6 backdrop-blur-sm">
                  <div className="w-full max-w-[1180px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
                    <div className="flex items-center justify-between gap-4 border-b ui-border-soft px-5 py-4">
                      <div className="min-w-0">
                        <div className="text-[11px] font-black text-[#002FA7]">智能 PPT 预览与编辑</div>
                        <h3 className="mt-1 truncate text-sm font-black ui-text-ink">{pptViewer.title}</h3>
                        <p className="mt-1 truncate text-[10px] ui-text-secondary">{pptViewer.fileName}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPptPlaying((value) => !value)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-[#002FA7] px-3 py-1.5 text-[10px] font-black text-white hover:bg-[#00247D]"
                        >
                          <Play className="h-3 w-3" />
                          {pptPlaying ? "暂停播放" : "播放"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPptViewer(null)}
                          className="rounded-md border border-[#D4DCE6] bg-white px-3 py-1.5 text-[10px] font-black text-[#475569] hover:bg-[#F7F7F8]"
                        >
                          关闭
                        </button>
                      </div>
                    </div>

                    <div className="grid max-h-[76vh] min-h-[620px] lg:grid-cols-[170px_minmax(0,1fr)_270px]">
                      <div className="hidden border-r border-[#D4DCE6] bg-[#F7F9FC] p-3 lg:block">
                        <div className="mb-3 text-[11px] font-black text-[#002FA7]">幻灯片</div>
                        <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
                          {buildPptPreviewCards(pptViewer.slides).map((slide) => (
                            <button
                              key={`thumb-${slide.index}`}
                              type="button"
                              onClick={() => {
                                setPptPlaying(false);
                                setPptViewer((current) => (current ? { ...current, slideIndex: slide.index - 1 } : current));
                              }}
                              className={`w-full rounded-lg border bg-white p-1.5 text-left transition ${
                                pptViewer.slideIndex + 1 === slide.index
                                  ? "border-[#002FA7] shadow-[0_8px_18px_rgba(0,47,167,0.12)]"
                                  : "border-[#E5EAF1] hover:border-[#BFD0FF]"
                              }`}
                            >
                              <PptSlideThumbnail slide={slide} active={pptViewer.slideIndex + 1 === slide.index} small />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="bg-[linear-gradient(180deg,#F8FBFF_0%,#FFFFFF_100%)] p-5">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="inline-flex items-center gap-2 rounded-full bg-[#EFF6FF] px-3 py-1 text-[10px] font-black ui-text-navy">
                            <span>第 {pptViewer.slideIndex + 1} 页</span>
                            <span>·</span>
                            <span>{activePptSlide.kind === "cover" ? "封面" : activePptSlide.kind === "agenda" ? "目录" : activePptSlide.kind === "ending" ? "结束页" : "内容页"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPptViewer((current) => (current ? { ...current, slideIndex: Math.max(0, current.slideIndex - 1) } : current))}
                              disabled={pptViewer.slideIndex <= 0}
                              className="course-outline-action"
                            >
                              上一页
                            </button>
                            <button
                              type="button"
                              onClick={() => setPptViewer((current) => (current ? { ...current, slideIndex: Math.min(current.slides.length - 1, current.slideIndex + 1) } : current))}
                              disabled={pptViewer.slideIndex >= pptViewer.slides.length - 1}
                              className="course-outline-action"
                            >
                              下一页
                            </button>
                          </div>
                        </div>

                        <PptSlideStage slide={activePptSlide} slideIndex={pptViewer.slideIndex} />
                      </div>

                      <div className="border-t border-[#D4DCE6] bg-[#FCFDFE] p-4 lg:border-l lg:border-t-0">
                        <div className="text-[11px] font-black text-[#002FA7]">编辑当前页</div>
                        <p className="mt-1 text-xs font-black text-[#111827]">第 {pptViewer.slideIndex + 1} 页内容</p>
                        <div className="mt-4 space-y-3">
                          <label className="block">
                            <span className="text-[10px] font-black text-[#64748B]">大标题</span>
                            <input
                              value={activePptSlide.title}
                              onChange={(event) => updateActivePptSlide({ title: event.target.value })}
                              className="mt-1 w-full rounded-md border border-[#D4DCE6] bg-white px-2.5 py-2 text-xs font-bold text-[#111827] outline-none focus:border-[#002FA7]"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-black text-[#64748B]">小标题</span>
                            <input
                              value={activePptSlide.subtitle || ""}
                              onChange={(event) => updateActivePptSlide({ subtitle: event.target.value })}
                              className="mt-1 w-full rounded-md border border-[#D4DCE6] bg-white px-2.5 py-2 text-xs text-[#111827] outline-none focus:border-[#002FA7]"
                            />
                          </label>
                          <div>
                            <div className="mb-1 text-[10px] font-black text-[#64748B]">页面要点</div>
                            <div className="space-y-2">
                              {activePptSlide.bullets.slice(0, 5).map((bullet, bulletIndex) => (
                                <textarea
                                  key={`edit-bullet-${pptViewer.slideIndex}-${bulletIndex}`}
                                  value={bullet}
                                  onChange={(event) => updateActivePptBullet(bulletIndex, event.target.value)}
                                  rows={2}
                                  className="w-full resize-none rounded-md border border-[#D4DCE6] bg-white px-2.5 py-2 text-[11px] leading-5 text-[#111827] outline-none focus:border-[#002FA7]"
                                />
                              ))}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void exportPptxOnDemand(pptViewer.fileName, pptViewer.slides)}
                            className="mt-1 w-full rounded-md bg-[#111827] px-3 py-2 text-xs font-black text-white hover:bg-black"
                          >
                            导出当前 PPT
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
        </div>
      </section>
    ) : null;

  // Parse sectionId if provided
  useEffect(() => {
    if (sectionId) {
      const parsed = parseInt(sectionId, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed < episodes.length) {
        setActiveEpisodeIdx(parsed);
      }
      return;
    }

    const runtime = readPersistedCourseRuntime(courseId);
    if (runtime) {
      if (runtime.activeEpisodeIdx >= 0 && runtime.activeEpisodeIdx < episodes.length) {
        setActiveEpisodeIdx(runtime.activeEpisodeIdx);
      } else {
        setActiveEpisodeIdx(0);
      }
      setChapterListCollapsed(Boolean(runtime.chapterListCollapsed));
      return;
    }

    setActiveEpisodeIdx(0);
    setChapterListCollapsed(false);
  }, [courseId, episodes.length, sectionId]);

  useEffect(() => {
    setVideoPlaying(false);
    setVideoFrameReady(false);
    const runtime = readPersistedCourseRuntime(courseId);
    const savedPlayback = Number(localStorage.getItem(playbackStorageKey) || "0");
    const runtimePlayback =
      runtime && runtime.activeEpisodeIdx === activeEpisodeIdx && runtime.currentPlaybackTime > 0
        ? runtime.currentPlaybackTime
        : 0;
    const nextResumeTime = shouldAutoplayOnEnter
      ? resumeStartAt
      : runtimePlayback > 0
        ? runtimePlayback
        : savedPlayback > 0
          ? savedPlayback
          : null;
    pendingResumeTimeRef.current = nextResumeTime;
    setCurrentPlaybackTime(Number(nextResumeTime || 0));
    setVideoSourceMounted(shouldAutoplayOnEnter);
    setShowVideoLoadingOverlay(shouldAutoplayOnEnter);
    shouldResumeAutoplayRef.current = shouldAutoplayOnEnter || Boolean(runtime?.wasPlaying);
    shouldResumeMutedRef.current = shouldMuteOnEnter || Boolean(runtime?.wasPlaying);
  }, [activeEpisodeIdx, activeVideoSrc, courseId, playbackStorageKey, resumeStartAt, shouldAutoplayOnEnter, shouldMuteOnEnter]);

  const activeVideoKey = useMemo(
    () => `${courseId}:${activeEpisodeIdx}`,
    [activeEpisodeIdx, courseId],
  );

  const resetDanmakuRuntime = () => {
    nextDanmakuIndexRef.current = 0;
    laneAvailableAtRef.current = new Array(resolvedScrollLanes.length).fill(0);
    emittedDanmakuIdsRef.current = new Set();
    setActiveDanmakus([]);
  };

  const hydratePresetDanmaku = async () => {
    const presets = PRESET_DANMAKUS_BY_COURSE[courseId] || PRESET_DANMAKUS_BY_COURSE["series-2"];
    const fallbackItems: VideoDanmakuItem[] = presets.map((item, index) => ({
      id: index + 1,
      video_key: activeVideoKey,
      user_id: activeUserId,
      user_name: activeUserName,
      content: item.text,
      color: item.color,
      mode: item.mode || "scroll",
      start_time: item.time,
      created_at: null,
    }));
    setPersistedDanmakus(fallbackItems);
    try {
      const existing = await studentApi.listVideoDanmaku(activeVideoKey, 300);
      if (existing.total === 0) {
        return;
      }
      if (existing.total >= presets.length) {
        setPersistedDanmakus(existing.items);
        return;
      }

      const seeded: VideoDanmakuItem[] = [...existing.items];
      const existingKeys = new Set(
        existing.items.map((item) => `${item.content}|${item.start_time}|${item.mode}`),
      );
      for (const item of presets) {
        const presetKey = `${item.text}|${item.time}|${item.mode || "scroll"}`;
        if (existingKeys.has(presetKey)) {
          continue;
        }
        try {
          const created = await studentApi.createVideoDanmaku({
            video_key: activeVideoKey,
            content: item.text,
            color: item.color,
            mode: item.mode || "scroll",
            start_time: item.time,
          });
          seeded.push(created);
        } catch {
          seeded.push({
            id: -(seeded.length + 1),
            video_key: activeVideoKey,
            user_id: activeUserId,
            user_name: activeUserName,
            content: item.text,
            color: item.color,
            mode: item.mode || "scroll",
            start_time: item.time,
            created_at: null,
          });
        }
      }
      setPersistedDanmakus(seeded);
    } catch {
      // The classroom should still show local bullet comments when the API is slow.
    }
  };

  useEffect(() => {
    if (routeRole) {
      setPersistedDanmakus([]);
      resetDanmakuRuntime();
      return;
    }
    resetDanmakuRuntime();
    void hydratePresetDanmaku();
  }, [activeVideoKey, routeRole]);

  useEffect(() => {
    if (routeRole) {
      setComments([]);
      return;
    }
    void hydrateCourseComments().catch(() => {
      showToast("评论加载失败，请稍后重试");
      setComments(buildFallbackCourseComments());
    });
  }, [courseId, activeEpisodeIdx, routeRole]);

  useEffect(() => {
    if (routeRole) {
      setLearningQuestions([]);
      setLearningNotes([]);
      setLearningFeedLoading(false);
      return;
    }
    void hydrateLearningFeed();
  }, [activeEpisodeIdx, backendCourseId, routeRole]);

  const sortedDanmakus = useMemo(() => {
    const baseItems = [...persistedDanmakus].sort((a, b) => a.start_time - b.start_time || a.id - b.id);
    if (baseItems.length === 0) {
      return baseItems;
    }

    const lastStartTime = baseItems[baseItems.length - 1]?.start_time ?? 0;
    const timelineEnd = Math.max(videoDuration || 0, 150);
    if (lastStartTime >= timelineEnd - 12) {
      return baseItems;
    }

    const cycleSeconds = Math.max(24, lastStartTime + 10);
    const repeatedItems: VideoDanmakuItem[] = [];
    for (let offset = cycleSeconds; offset <= timelineEnd + 12; offset += cycleSeconds) {
      for (const item of baseItems) {
        const startTime = item.start_time + offset;
        if (startTime > timelineEnd + 12) {
          continue;
        }
        repeatedItems.push({
          ...item,
          id: -Math.round(offset * 1000) - item.id,
          start_time: startTime,
          created_at: item.created_at ?? null,
        });
      }
    }

    return [...baseItems, ...repeatedItems].sort((a, b) => a.start_time - b.start_time || a.id - b.id);
  }, [persistedDanmakus, videoDuration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSourceMounted) {
      return;
    }

    const resumePlayback = async () => {
      const nextStartTime = pendingResumeTimeRef.current;
      if (nextStartTime === null) {
        return;
      }

      const maxStartTime =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.max(0, video.duration - 0.8)
          : nextStartTime;
      const safeStartTime = Math.min(nextStartTime, maxStartTime);

      try {
        video.currentTime = safeStartTime;
      } catch {
        return;
      }

      lastVideoTimeRef.current = safeStartTime;
      syncDanmakuTimeline(safeStartTime);

      if (!shouldResumeAutoplayRef.current) {
        pendingResumeTimeRef.current = null;
        setCurrentPlaybackTime(safeStartTime);
        setVideoPlaying(false);
        return;
      }

      try {
        if (shouldResumeMutedRef.current) {
          video.muted = true;
          video.defaultMuted = true;
        }
        await video.play();
        setVideoPlaying(true);
      } catch {
        setVideoPlaying(false);
      }

      pendingResumeTimeRef.current = null;
    };

    const handleLoadedMetadata = () => {
      void resumePlayback();
    };

    if (video.readyState >= 1) {
      void resumePlayback();
      return;
    }

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [activeVideoSrc, sortedDanmakus, videoSourceMounted]);

  useEffect(() => {
    persistCourseRuntime(courseId, {
      activeEpisodeIdx,
      chapterListCollapsed,
      currentPlaybackTime: Number(videoRef.current?.currentTime || currentPlaybackTime || 0),
      wasPlaying: videoPlaying,
    });
  }, [activeEpisodeIdx, chapterListCollapsed, courseId, currentPlaybackTime, videoPlaying]);

  const resolvedScrollLanes = DANMAKU_SCROLL_LANES;

  const pickScrollLane = (currentTime: number) => {
    const laneIndex = laneAvailableAtRef.current.findIndex((availableAt) => availableAt <= currentTime);
    return laneIndex === -1 ? 0 : laneIndex;
  };

  const pushActiveDanmaku = (item: VideoDanmakuItem) => {
    if (emittedDanmakuIdsRef.current.has(item.id)) {
      return;
    }

    if (item.mode === "top" || item.mode === "bottom") {
      const sameModeCount = activeDanmakus.filter((dan) => dan.mode === item.mode).length;
      if (sameModeCount >= DANMAKU_MAX_FIXED_STACK) {
        return;
      }
      emittedDanmakuIdsRef.current.add(item.id);
      setActiveDanmakus((prev) => [
        ...prev,
        {
          id: `${item.id}`,
          content: item.content,
          color: item.color,
          mode: item.mode,
          startTime: item.start_time,
          duration: DANMAKU_FIXED_DURATION,
          opacity: 0.84,
        },
      ]);
      return;
    }

    emittedDanmakuIdsRef.current.add(item.id);
    const lane = pickScrollLane(item.start_time);
    const width = Math.max(92, item.content.length * 16 + 28);
    const duration = Math.max(8.2, width / DANMAKU_SCROLL_SPEED_PX_PER_SECOND + 7.1);
    laneAvailableAtRef.current[lane] =
      item.start_time + Math.min(duration * 0.42, 4.4) + DANMAKU_SCROLL_GAP_PX / DANMAKU_SCROLL_SPEED_PX_PER_SECOND;

    setActiveDanmakus((prev) => [
      ...prev,
      {
        id: `${item.id}`,
        content: item.content,
        color: item.color,
        mode: "scroll",
        startTime: item.start_time,
        top: resolvedScrollLanes[lane],
        width,
        duration,
        opacity: 0.84,
      },
    ]);
  };

  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !danmakuEnabled) return;

    const currentTime = video.currentTime;
    while (
      nextDanmakuIndexRef.current < sortedDanmakus.length &&
      sortedDanmakus[nextDanmakuIndexRef.current].start_time <= currentTime + 0.12
    ) {
      pushActiveDanmaku(sortedDanmakus[nextDanmakuIndexRef.current]);
      nextDanmakuIndexRef.current += 1;
    }
  };

  const isDanmakuStillVisibleAt = (item: VideoDanmakuItem, currentTime: number) => {
    if (item.mode === "top" || item.mode === "bottom") {
      return item.start_time <= currentTime && currentTime <= item.start_time + DANMAKU_FIXED_DURATION;
    }

    const width = Math.max(92, item.content.length * 16 + 28);
    const duration = Math.max(8.2, width / DANMAKU_SCROLL_SPEED_PX_PER_SECOND + 7.1);
    return item.start_time <= currentTime && currentTime <= item.start_time + duration;
  };

  const visibleDanmakus = useMemo(() => {
    if (!danmakuEnabled) {
      return [];
    }

    const laneAvailability = new Array(DANMAKU_SCROLL_LANES.length).fill(0);
    const nextVisible: ActiveCourseDanmaku[] = [];
    let topStack = 0;
    let bottomStack = 0;

    for (const item of sortedDanmakus) {
      if (!isDanmakuStillVisibleAt(item, currentPlaybackTime)) {
        continue;
      }

      if (item.mode === "top" || item.mode === "bottom") {
        if (item.mode === "top" && topStack >= DANMAKU_MAX_FIXED_STACK) {
          continue;
        }
        if (item.mode === "bottom" && bottomStack >= DANMAKU_MAX_FIXED_STACK) {
          continue;
        }
        if (item.mode === "top") {
          topStack += 1;
        } else {
          bottomStack += 1;
        }

        nextVisible.push({
          id: `${item.id}`,
          content: item.content,
          color: item.color,
          mode: item.mode,
          startTime: item.start_time,
          duration: DANMAKU_FIXED_DURATION,
          opacity: 0.84,
        });
        continue;
      }

      const laneIndex = laneAvailability.findIndex((availableAt) => availableAt <= item.start_time);
      const resolvedLane = laneIndex === -1 ? 0 : laneIndex;
      const width = Math.max(92, item.content.length * 16 + 28);
      const duration = Math.max(8.2, width / DANMAKU_SCROLL_SPEED_PX_PER_SECOND + 7.1);
      laneAvailability[resolvedLane] =
        item.start_time + Math.min(duration * 0.42, 4.4) + DANMAKU_SCROLL_GAP_PX / DANMAKU_SCROLL_SPEED_PX_PER_SECOND;

      nextVisible.push({
        id: `${item.id}`,
        content: item.content,
        color: item.color,
        mode: "scroll",
        startTime: item.start_time,
        top: DANMAKU_SCROLL_LANES[resolvedLane],
        width,
        duration,
        opacity: 0.84,
      });
    }

    return nextVisible;
  }, [currentPlaybackTime, danmakuEnabled, sortedDanmakus]);

  const syncDanmakuTimeline = (currentTime: number) => {
    const nextLaneAvailability = new Array(resolvedScrollLanes.length).fill(currentTime);
    const nextActiveDanmakus: ActiveCourseDanmaku[] = [];
    const replayedIds = new Set<number>();
    let fixedStackTop = 0;
    let fixedStackBottom = 0;
    let pointer = 0;

    for (const item of sortedDanmakus) {
      const shouldReplayNow =
        isDanmakuStillVisibleAt(item, currentTime) ||
        (item.start_time > currentTime && item.start_time <= currentTime + DANMAKU_SEEK_LOOKAHEAD_SECONDS);

      if (item.start_time <= currentTime + 0.12) {
        pointer += 1;
      }

      if (!shouldReplayNow) {
        if (item.start_time > currentTime + DANMAKU_SEEK_LOOKAHEAD_SECONDS) {
          break;
        }
        continue;
      }

      replayedIds.add(item.id);

      if (item.mode === "top" || item.mode === "bottom") {
        if (item.mode === "top" && fixedStackTop >= DANMAKU_MAX_FIXED_STACK) {
          continue;
        }
        if (item.mode === "bottom" && fixedStackBottom >= DANMAKU_MAX_FIXED_STACK) {
          continue;
        }
        if (item.mode === "top") {
          fixedStackTop += 1;
        } else {
          fixedStackBottom += 1;
        }
        nextActiveDanmakus.push({
          id: `${item.id}`,
          content: item.content,
          color: item.color,
          mode: item.mode,
          startTime: item.start_time,
          duration: DANMAKU_FIXED_DURATION,
          opacity: 0.84,
        });
        continue;
      }

      const laneIndex = nextLaneAvailability.findIndex((availableAt) => availableAt <= item.start_time);
      const resolvedLane = laneIndex === -1 ? 0 : laneIndex;
      const width = Math.max(92, item.content.length * 16 + 28);
      const duration = Math.max(8.2, width / DANMAKU_SCROLL_SPEED_PX_PER_SECOND + 7.1);
      nextLaneAvailability[resolvedLane] =
        item.start_time + Math.min(duration * 0.42, 4.4) + DANMAKU_SCROLL_GAP_PX / DANMAKU_SCROLL_SPEED_PX_PER_SECOND;

      nextActiveDanmakus.push({
        id: `${item.id}`,
        content: item.content,
        color: item.color,
        mode: "scroll",
        startTime: item.start_time,
        top: resolvedScrollLanes[resolvedLane],
        width,
        duration,
        opacity: 0.84,
      });
    }

    laneAvailableAtRef.current = nextLaneAvailability;
    emittedDanmakuIdsRef.current = replayedIds;
    setActiveDanmakus(nextActiveDanmakus);
    nextDanmakuIndexRef.current = pointer;
  };

  const emitDanmakuAroundCurrentTime = (currentTime: number) => {
    const startIndex = sortedDanmakus.findIndex((item) => item.start_time >= Math.max(0, currentTime - 0.12));
    if (startIndex === -1) {
      return;
    }

    let pointer = startIndex;
    while (
      pointer < sortedDanmakus.length &&
      sortedDanmakus[pointer].start_time <= currentTime + DANMAKU_SEEK_LOOKAHEAD_SECONDS
    ) {
      pushActiveDanmaku(sortedDanmakus[pointer]);
      pointer += 1;
    }
  };

  const removeActiveDanmaku = (id: string) => {
    setActiveDanmakus((prev) => prev.filter((item) => item.id !== id));
  };

  const handleVideoTimelineUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const currentTime = video.currentTime;
    setCurrentPlaybackTime(currentTime);
    if (currentTime > 0.5) {
      localStorage.setItem(playbackStorageKey, String(currentTime));
    }
    if (Math.abs(currentTime - lastVideoTimeRef.current) > 1.35) {
      syncDanmakuTimeline(currentTime);
    }
    lastVideoTimeRef.current = currentTime;

    if (currentTime < 0.35 && nextDanmakuIndexRef.current >= sortedDanmakus.length) {
      resetDanmakuRuntime();
    }

    handleVideoTimeUpdate();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleSeeking = () => {
      const currentTime = video.currentTime;
      lastVideoTimeRef.current = currentTime;
      window.setTimeout(() => {
        syncDanmakuTimeline(currentTime);
      }, 0);
    };

    video.addEventListener("seeking", handleSeeking);
    video.addEventListener("seeked", handleSeeking);
    return () => {
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("seeked", handleSeeking);
    };
  }, [resolvedScrollLanes, sortedDanmakus]);

  useEffect(() => {
    if (danmakuEnabled && videoPlaying) {
      handleVideoTimeUpdate();
    }
  }, [danmakuEnabled, videoPlaying, sortedDanmakus]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const syncPlaybackClock = () => {
      setCurrentPlaybackTime(Number(video.currentTime || 0));
    };

    syncPlaybackClock();
    const timer = window.setInterval(syncPlaybackClock, 120);
    return () => {
      window.clearInterval(timer);
    };
  }, [activeVideoSrc, videoPlaying]);

  useEffect(() => {
    if (!danmakuEnabled || sortedDanmakus.length === 0) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const currentTime = Math.max(
      Number(video.currentTime || 0),
      pendingResumeTimeRef.current ?? 0,
      shouldAutoplayOnEnter ? resumeStartAt : 0,
    );
    if (currentTime <= 0) {
      return;
    }

    window.setTimeout(() => {
      syncDanmakuTimeline(currentTime);
      lastVideoTimeRef.current = currentTime;
    }, 0);
  }, [danmakuEnabled, resumeStartAt, shouldAutoplayOnEnter, sortedDanmakus]);

  const handleSendDanmaku = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDanmakuText.trim()) return;

    const startTime = Number(videoRef.current?.currentTime || 0);
    const content = newDanmakuText.trim();

    void (async () => {
      try {
        const created = await studentApi.createVideoDanmaku({
          video_key: activeVideoKey,
          content,
          color: danmakuColor,
          mode: danmakuMode,
          start_time: startTime,
        });
        setPersistedDanmakus((prev) => [...prev, created]);
        if (Math.abs(startTime - Number(videoRef.current?.currentTime || 0)) < 1.2) {
          pushActiveDanmaku(created);
        }
        setNewDanmakuText("");
        showToast("学友弹幕成功发射并登屏！🚀");
      } catch {
        showToast("弹幕发送失败，请稍后重试");
      }
    })();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2850);
  };

  const formatGenerationTime = () =>
    new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const openLearningTutorWithPrompt = (
    prompt: string,
    mode: "learning" | "handout" | "mindmap" | "practice" | "ppt" | "open-classroom" = "learning",
  ) => {
    const startAt = rememberCurrentPlayback();
    const panelMode = mode === "open-classroom" ? "learning" : mode;
    openTutorPanel({
      courseId,
      sectionId: activeEpisodeIdx,
      mode: panelMode,
      title: course.title,
      subtitle: `${activeEpisode.title} · ${String(Math.floor(currentPlaybackTime / 60)).padStart(2, "0")}:${String(Math.floor(currentPlaybackTime % 60)).padStart(2, "0")}`,
      videoSrc: activeVideoSrc,
      videoResourceId: activeVideoInsightMeta?.resourceId,
      videoFileId: activeVideoInsightMeta?.fileId,
      videoFileName: activeVideoInsightMeta?.fileName,
      query: prompt,
      quickPrompts:
        mode === "learning" || mode === "open-classroom"
          ? learningAssistantPrompts
          : buildGenerationTutorQuickPrompts(mode),
      startAt,
      autoplay: true,
      muted: true,
    });
  };

  const togglePracticeChoice = (questionId: string, optionKey: string, isMultiple: boolean) => {
    setPracticeAnswers((prev) => {
      const current = prev[questionId] || [];
      if (isMultiple) {
        const next = current.includes(optionKey)
          ? current.filter((item) => item !== optionKey)
          : [...current, optionKey];
        return { ...prev, [questionId]: next };
      }
      return { ...prev, [questionId]: [optionKey] };
    });
  };

  const practiceScore = useMemo(() => {
    if (!(previewState?.kind === "resource" && previewState.resourceKind === "practice" && previewState.questions?.length)) {
      return null;
    }
    const objectiveQuestions = previewState.questions.filter((item) => item.questionType !== "short");
    if (!objectiveQuestions.length) {
      return {
        correct: 0,
        total: 0,
        percent: 100,
      };
    }
    let correct = 0;
    for (const question of objectiveQuestions) {
      const expected = [...question.answer].sort().join("|");
      const actual = [...(practiceAnswers[question.id] || [])].sort().join("|");
      if (expected && expected === actual) {
        correct += 1;
      }
    }
    return {
      correct,
      total: objectiveQuestions.length,
      percent: Math.round((correct / objectiveQuestions.length) * 100),
    };
  }, [practiceAnswers, previewState]);

  const buildInlinePreviewState = (
    artifact: RecentResourceArtifact,
    displayTitle: string,
  ): ResourcePreviewState => ({
    kind: "resource",
    resourceKind: artifact.kind,
    title: displayTitle,
    tag: artifact.kind === "handout" ? "讲义" : artifact.kind === "mindmap" ? "导图" : "练习",
    sectionTitle: artifact.sectionTitle,
    summary: artifact.summary,
    content: artifact.previewContent || [artifact.summary],
    downloadUrl: artifact.downloadUrl,
    loading: artifact.loading,
    questions:
      artifact.kind === "practice"
        ? extractPracticeQuestions(
            {
              resource_type: "practice_set",
              title: displayTitle,
              summary: artifact.summary,
              content_markdown: (artifact.previewContent || []).join("\n"),
              source_titles: [],
            },
            course.title,
            artifact.sectionTitle,
          )
        : undefined,
    mindmapNodes:
      artifact.kind === "mindmap"
        ? buildMindmapTreeFromLines(displayTitle, artifact.previewContent || [artifact.summary])
        : undefined,
  });

const upsertRecentArtifact = (artifact: RecentResourceArtifact) => {
    setRecentArtifacts((prev) => replaceRecentArtifact(prev, artifact));
  };

  const revealRecentArtifact = (artifact: RecentResourceArtifact) => {
    upsertRecentArtifact(artifact);
    setShowOnlyCurrentSectionResults(true);
    expandRecentCard(`artifact-${artifact.kind}`);
    setPreviewState({
      kind: "resource",
      resourceKind: artifact.kind,
      title: artifact.customTitle || artifact.title,
      tag: artifact.kind === "handout" ? "讲义" : artifact.kind === "mindmap" ? "导图" : "练习",
      sectionTitle: artifact.sectionTitle,
      summary: artifact.summary,
      content: artifact.previewContent || [artifact.summary],
      downloadUrl: artifact.downloadUrl,
      questions: artifact.practiceQuestions,
      mindmapNodes: artifact.mindmapNodes,
      loading: artifact.loading,
    });
  };

  const revealRecentPpt = (artifact: RecentPptArtifact) => {
    setRecentPpt(artifact);
    setShowOnlyCurrentSectionResults(true);
    expandRecentCard("artifact-ppt");
    setPreviewState({
      kind: "ppt",
      title: artifact.customTitle || artifact.fileName.replace(/\.pptx$/i, ""),
      tag: "PPT",
      sectionTitle: artifact.sectionTitle,
      summary: artifact.summary || "当前没有更多说明。",
      content: artifact.previewContent || [],
      fileName: artifact.fileName,
      slides: artifact.slides,
    });
  };

  const openGeneratedResourcePreview = (
    resource: ResourceCard,
    label: string,
    stage: "running" | "completed" = "completed",
    replace = false,
  ) => {
    const firstFile = resource.source_files?.[0] || null;
    const resourceId = Number(resource.resource_id);
    const fileId = Number(firstFile?.file_id || resource.resource_id);
    const params = new URLSearchParams({ courseId });
    if (Number.isFinite(resourceId) && resourceId > 0) {
      params.set("resourceId", String(resourceId));
    }
    if (Number.isFinite(fileId) && fileId > 0) {
      params.set("fileId", String(fileId));
    }
    params.set("generationStage", stage);
    params.set("generationLabel", label);
    params.set("generationType", resource.resource_type);
    navigate(`/resources/preview?${params.toString()}`, {
      replace,
      state: {
        initialResource: resource,
        initialFileId: Number.isFinite(fileId) && fileId > 0 ? fileId : null,
        initialPreviewFile: firstFile,
        generationIntent: {
          stage,
          label,
          type: resource.resource_type,
        },
      },
    });
  };

  const buildPreviewResourceFromArtifact = (
    artifact: RecentResourceArtifact,
    resourceType: ResourceCard["resource_type"],
    sourceResource?: ResourceCard | null,
  ): ResourceCard => ({
    ...(sourceResource || {}),
    resource_id: sourceResource?.resource_id ?? artifact.resourceId ?? null,
    resource_type: resourceType,
    title: artifact.customTitle || artifact.title,
    summary: artifact.summary,
    content_markdown:
      artifact.rawContent ||
      sourceResource?.content_markdown ||
      artifact.previewContent?.join("\n\n") ||
      artifact.summary,
    source_titles: sourceResource?.source_titles?.length ? sourceResource.source_titles : [artifact.sectionTitle],
      study_suggestion: sourceResource?.study_suggestion || "可在这个预览页直接查看生成内容，也可以继续交给岗位实训导师追问。",
    source_file_count: sourceResource?.source_file_count || sourceResource?.source_files?.length || 0,
    source_files: sourceResource?.source_files || [],
    generated_at: sourceResource?.generated_at,
    updated_at: sourceResource?.updated_at,
    generation_context: sourceResource?.generation_context || null,
  });

  const buildPptPreviewResource = (artifact: RecentPptArtifact, sourceResource?: ResourceCard | null): ResourceCard => {
    const title = artifact.customTitle || artifact.fileName.replace(/\.pptx$/i, "");
    const templateId =
      artifact.pptTemplate ||
      ((artifact.slides?.find((slide) => PPT_TEMPLATE_OPTIONS.some((template) => template.id === slide.accent))?.accent as PptTemplateId | undefined) || "academic");
    const slideMarkdown = artifact.slides
      .map((slide) => {
        const bullets = slide.bullets?.length ? slide.bullets.map((item) => `- ${item}`).join("\n") : "- 暂无要点";
        const speakerNote = (slide as { speakerNote?: string }).speakerNote;
        const illustration = slide.illustration
          ? `\n\n> 图解：${slide.illustration.title.replace(/插画/g, "图解")}｜${slide.illustration.caption.replace(/插画/g, "图像")}`
          : "";
        return `## ${slide.title}\n\n${slide.subtitle ? `${slide.subtitle}\n\n` : ""}${bullets}${illustration}${speakerNote ? `\n\n> ${speakerNote}` : ""}`;
      })
      .join("\n\n");
    const markedSlideMarkdown = `<!-- ppt-template:${templateId} -->\n\n${slideMarkdown}`;
    return {
      ...(sourceResource || {}),
      resource_id: sourceResource?.resource_id ?? artifact.resourceId ?? null,
      resource_type: "ppt",
      title,
      summary: artifact.summary || "已按当前章节生成课件草案。",
      content_markdown: artifact.rawContent ? `<!-- ppt-template:${templateId} -->\n\n${artifact.rawContent}` : markedSlideMarkdown || artifact.previewContent?.join("\n\n") || artifact.summary || title,
      source_titles: sourceResource?.source_titles?.length ? sourceResource.source_titles : [artifact.sectionTitle],
      study_suggestion: sourceResource?.study_suggestion || "先浏览课件结构，再把不清楚的页交给岗位实训导师继续讲解。",
      source_file_count: sourceResource?.source_file_count || sourceResource?.source_files?.length || 0,
      source_files: sourceResource?.source_files || [],
      generated_at: sourceResource?.generated_at,
      updated_at: sourceResource?.updated_at,
      generation_context: sourceResource?.generation_context || null,
    };
  };

  const buildPptExplanationVideoPreviewResource = (artifact: RecentPptArtifact): ResourceCard => {
    const video = artifact.explanationVideo || buildPptExplanationVideoArtifact(artifact, course.title, currentSectionTitle);
    const title = video.title || `${artifact.fileName.replace(/\.pptx$/i, "")} · 讲解视频`;
    const storyboardMarkdown = video.storyboard
      .map(
        (scene) =>
          `## ${String(scene.slideIndex).padStart(2, "0")} ${scene.title}\n\n- 时长：${scene.durationSeconds} 秒\n- 画面：${scene.visualHint}\n- 旁白：${scene.narration}`,
      )
      .join("\n\n");
    const content = `# ${title}\n\n${video.summary}\n\n## 视频信息\n\n- 时长：${video.durationLabel}\n- 旁白：${video.voiceRole}\n- 分镜：${video.storyboard.length} 段\n\n${storyboardMarkdown}\n\n## 完整旁白稿\n\n${video.transcript}`;
    return {
      resource_id: artifact.resourceId ?? null,
      resource_type: "micro_video",
      title,
      summary: video.summary,
      content_markdown: content,
      source_titles: [artifact.sectionTitle, artifact.fileName],
      study_suggestion: "先看分镜和旁白稿，再根据需要让岗位实训导师压缩成答辩口播或课堂短视频脚本。",
      source_file_count: 1,
      source_files: [
        {
          file_id: 930001,
          display_name: `${title}.md`,
          relative_path: `generated://ppt-explanation-video/${artifact.sectionTitle}`,
          top_level_category: "PPT讲解视频",
          file_extension: ".md",
          mime_type: "text/markdown",
          file_size: content.length,
          preview_text: content,
          preview_mode: "text",
          preview_url: null,
          open_url: "",
          is_inline_previewable: true,
        },
      ],
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      generation_context: {
        course_id: backendCourseId,
        course_code: backendCourseCode,
        knowledge_points: [course.title, currentSectionTitle, "PPT讲解视频"],
        resource_types: ["micro_video"],
      },
    };
  };

  const pickReusableResource = (resources: ResourceCard[], resourceTypes: string[]) => {
    const normalizedTypes = new Set(resourceTypes);
    const deduped = new Map<number | string, ResourceCard>();
    for (const resource of resources) {
      if (!normalizedTypes.has(resource.resource_type)) continue;
      const key = resource.resource_id ? `id:${resource.resource_id}` : `${resource.resource_type}:${resource.title}`;
      if (!deduped.has(key)) {
        deduped.set(key, resource);
      }
    }

    const candidates = Array.from(deduped.values());
    if (!candidates.length) return null;

    const currentSectionMatches = candidates.filter((resource) => {
      const sectionTitle = resolveGeneratedSectionTitle(resource, "");
      const haystack = `${resource.title || ""}\n${resource.summary || ""}\n${resource.content_markdown || ""}\n${resource.source_titles?.join("\n") || ""}`;
      return (
        (sectionTitle && currentSectionTitle.includes(sectionTitle)) ||
        (sectionTitle && sectionTitle.includes(currentSectionTitle)) ||
        haystack.includes(currentSectionTitle)
      );
    });

    return [...(currentSectionMatches.length ? currentSectionMatches : candidates)].sort((left, right) => {
      const leftTime = new Date(left.updated_at || left.generated_at || 0).getTime() || 0;
      const rightTime = new Date(right.updated_at || right.generated_at || 0).getTime() || 0;
      return rightTime - leftTime;
    })[0] || null;
  };

  const findReusableResourceFromLibrary = async (resourceTypes: string[]) => {
    const localMatch = pickReusableResource(courseLibraryResources, resourceTypes);
    if (localMatch) {
      return localMatch;
    }

    try {
      const result = await Promise.race([
        studentApi.listResourcesByCourseCode(activeUserId, backendCourseCode),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("RESOURCE_REUSE_LOOKUP_TIMEOUT")), RESOURCE_REUSE_LOOKUP_TIMEOUT_MS),
        ),
      ]);
      const reusableItems = (result.items || []).filter((item) =>
        ["lecture_note", "mindmap", "mind_map", "practice_set", "quiz_set", "ppt"].includes(item.resource_type),
      );
      setCourseLibraryResources(reusableItems);
      return pickReusableResource(reusableItems, resourceTypes);
    } catch {
      return null;
    }
  };

  const pickRecentArtifact = (kind: RecentResourceArtifact["kind"]) => {
    const candidates = recentArtifacts.filter((item) => item.kind === kind && !item.loading);
    return (
      candidates.find((item) => item.sectionTitle === currentSectionTitle) ||
      candidates.find((item) => item.sectionTitle.includes(currentSectionTitle) || currentSectionTitle.includes(item.sectionTitle)) ||
      candidates[0] ||
      null
    );
  };

  const toggleRecentArtifactStar = (kind: RecentResourceArtifact["kind"]) => {
    setRecentArtifacts((prev) =>
      prev.map((item) => (item.kind === kind ? { ...item, starred: !item.starred } : item)),
    );
  };

  const handleGenerateOpenClassroom = async () => {
    if (generatingOpenClassroom || generatingHandout || generatingPpt || generatingMindmap || generatingPractice) return;
    setGeneratingOpenClassroom(true);
    setOpenClassroomPreview({
      courseCode: backendCourseCode,
      courseName: course.title,
      lessonTitle: currentSectionTitle,
      sceneSummary: "正在组织 AI 教师、AI 助教与测评器的互动课堂脚本。",
      completionStatus: "processing",
      frameworkNote: "正在生成互动课堂结构，请稍候。",
      agentCards: [],
      interactionScript: [],
      quizQuestions: [],
      pptOutline: [],
      generatedResources: ["课堂讲义", "互动测验", "PPT 草案"],
      generatedAt: formatGenerationTime(),
    });
    try {
      const result = await studentApi.buildOpenClassroom({
        courseCode: backendCourseCode,
        courseName: course.title,
        lessonTitle: currentSectionTitle,
        focusPoints: [currentSectionTitle, "核心概念理解", "知识迁移应用"],
        targetResourceTypes: ["课堂讲义", "互动测验", "PPT 草案", "导学提纲"],
        audienceLevel: "intermediate",
        durationMinutes: 30,
      });
      setOpenClassroomPreview({
        ...result,
        generatedAt: formatGenerationTime(),
      });
      showToast("AI 互动课堂已生成，可直接查看教师主讲、助教追问、测验与课件草案");
    } catch {
      setOpenClassroomPreview({
        courseCode: backendCourseCode,
        courseName: course.title,
        lessonTitle: currentSectionTitle,
        sceneSummary: `已先按《${currentSectionTitle}》切换到课堂内互动脚本，可继续演示 AI 教师、助教和测评器配合流程。`,
        completionStatus: "fallback",
        frameworkNote: "互动课堂服务暂时较慢，当前展示的是课堂内可直接演示的本地版本。",
        agentCards: [
          {
            role: "teacher",
            name: "AI 教师",
            responsibility: `主讲 ${currentSectionTitle} 的核心主线`,
            style: "先总后分、结构化讲解",
            output: "输出课堂主讲内容与重点提示",
          },
          {
            role: "assistant",
            name: "AI 助教",
            responsibility: "追问学生理解盲区并做即时澄清",
            style: "鼓励式追问、举例说明",
            output: "输出追问话术与补充解释",
          },
          {
            role: "quiz_master",
            name: "AI 测评器",
            responsibility: "生成随堂题并指出薄弱知识点",
            style: "短题快检、即时反馈",
            output: "输出题目、答案和解析",
          },
        ],
        interactionScript: [
          {
            speaker: "AI 教师",
            goal: "建立主线",
            script: `今天先抓住《${currentSectionTitle}》的主线，不急着背结论，先明确它到底在解决什么问题。`,
          },
          {
            speaker: "AI 助教",
            goal: "暴露误区",
            script: "你先用一句自己的话复述这一节，我来帮你判断是没理解概念，还是没理清关系。",
          },
          {
            speaker: "AI 测评器",
            goal: "即时检测",
            script: "听完这一段后立刻做一题，最能判断你是真的懂了还是只是看懂了。",
          },
        ],
        quizQuestions: [
          {
            questionType: "single_choice",
            question: `《${currentSectionTitle}》这一节最该先抓住的是什么？`,
            options: ["章节主线", "零散术语", "结论背诵", "题海训练"],
            answer: "章节主线",
            explanation: "先明确主线，后续细节和题目才有依附关系。",
            knowledgeTag: currentSectionTitle,
          },
        ],
        pptOutline: [
          {
            pageNo: 1,
            title: currentSectionTitle,
            bullets: ["本节目标", "核心概念", "结构关系"],
            speakerNote: "开场先告诉学生这一节学完能得到什么。",
          },
        ],
        generatedResources: ["课堂讲义", "互动测验", "PPT 草案", "导学提纲"],
        generatedAt: formatGenerationTime(),
      });
      showToast("AI 互动课堂已先切换到课堂内演示版本，可继续查看完整脚本");
    } finally {
      setGeneratingOpenClassroom(false);
    }
  };

  const renameRecentArtifact = (kind: RecentResourceArtifact["kind"], fallbackTitle: string) => {
    const nextTitle = window.prompt("给这份资料起个名字", fallbackTitle)?.trim();
    if (!nextTitle) {
      return;
    }
    setRecentArtifacts((prev) =>
      prev.map((item) => (item.kind === kind ? { ...item, customTitle: nextTitle } : item)),
    );
    showToast("资料名称已更新");
  };

  const removeRecentArtifact = (kind: RecentResourceArtifact["kind"]) => {
    setRecentArtifacts((prev) => prev.filter((item) => item.kind !== kind));
    setCollapsedRecentKeys((current) => current.filter((item) => item !== `artifact-${kind}`));
  };

  const toggleRecentPptStar = () => {
    setRecentPpt((prev) => (prev ? { ...prev, starred: !prev.starred } : prev));
  };

  const renameRecentPptArtifact = (fallbackTitle: string) => {
    const nextTitle = window.prompt("给这份 PPT 起个名字", fallbackTitle)?.trim();
    if (!nextTitle) {
      return;
    }
    setRecentPpt((prev) => (prev ? { ...prev, customTitle: nextTitle } : prev));
    showToast("PPT 名称已更新");
  };

  const copyRecentArtifactShareText = async (payload: {
    title: string;
    sectionTitle: string;
    kindLabel: string;
    summary: string;
  }) => {
    const shareText = `${payload.kindLabel}：${payload.title}\n章节：${payload.sectionTitle}\n摘要：${payload.summary}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        showToast("分享文案已复制");
        return;
      }
    } catch {
      // fall through to prompt
    }
    window.prompt("复制这段分享文案", shareText);
  };

  const clearRecentPptArtifact = () => {
    setRecentPpt(null);
    setCollapsedRecentKeys((current) => current.filter((item) => item !== "artifact-ppt"));
  };

  const handleGeneratePptExplanationVideo = async (sourcePpt?: RecentPptArtifact | null) => {
    if (generatingPptVideo || generatingPpt) return;
    let targetPpt = sourcePpt || recentPpt;
    if (targetPpt?.loading) {
      showToast("PPT 正在生成中，完成后再生成讲解视频");
      return;
    }

    setGeneratingPptVideo(true);
    try {
      if (!targetPpt) {
        const slides = buildCourseDeckSlides(
          [buildLocalGeneratedResource("lecture_note", course.title, currentSectionTitle, outlineLines)],
          course.title,
          currentSectionTitle,
          outlineLines,
          selectedPptTemplate,
        );
        targetPpt = {
          resourceId: null,
          fileName: `${course.title.replace(/[\\/:*?"<>|]+/g, "-")}-${currentSectionTitle.replace(/[\\/:*?"<>|]+/g, "-")}.pptx`,
          slideCount: slides.length,
          generatedAt: formatGenerationTime(),
          slides,
          summary: "已为讲解视频同步生成配套 PPT 草案。",
          sectionTitle: currentSectionTitle,
          downloadUrl: "",
          preferredFormat: "pptx",
          pptTemplate: selectedPptTemplate,
        };
      }
      const explanationVideo = buildPptExplanationVideoArtifact(targetPpt, course.title, currentSectionTitle);
      const nextPpt = {
        ...targetPpt,
        explanationVideo,
      };
      setRecentPpt(nextPpt);
      setShowOnlyCurrentSectionResults(true);
      expandRecentCard("artifact-ppt");
      showToast("PPT 讲解视频已生成，正在打开预览页");
      openGeneratedResourcePreview(
        buildPptExplanationVideoPreviewResource(nextPpt),
        "PPT讲解视频",
      );
    } finally {
      setGeneratingPptVideo(false);
    }
  };

  const handleGenerateHandout = async () => {
    if (generatingHandout || generatingPpt || generatingMindmap || generatingPractice) return;
    setGeneratingHandout(true);
    const reusableResource = await findReusableResourceFromLibrary(["lecture_note", "lecture_notes"]);
    if (reusableResource) {
      const reusableArtifact = mapBackendResourceToArtifact(reusableResource, course.title, currentSectionTitle, courseId);
      if (reusableArtifact) {
        upsertRecentArtifact(reusableArtifact);
        showToast("已找到资料库里的讲义，正在直接打开");
        openGeneratedResourcePreview(
          buildPreviewResourceFromArtifact(reusableArtifact, "lecture_note", reusableResource),
          "课堂讲义",
        );
        setGeneratingHandout(false);
        return;
      }
    }
    const optimisticHandoutResource = buildLocalGeneratedResource("lecture_note", course.title, currentSectionTitle, outlineLines);
    const optimisticHandoutArtifact: RecentResourceArtifact = {
      kind: "handout",
      resourceId: null,
      preferredFormat: "docx",
      title: `${course.title} · ${currentSectionTitle} 讲义`,
      summary: buildResourceSummary(optimisticHandoutResource, "系统已进入讲义生成流程，当前先打开课堂内可读预览稿。"),
      downloadUrl: buildWorkspaceResourceLink(courseId, currentSectionTitle, "handout", `${course.title} · ${currentSectionTitle} 讲义`),
      generatedAt: formatGenerationTime(),
      sectionTitle: currentSectionTitle,
      previewContent: buildExpandedHandoutPreviewContent(optimisticHandoutResource, course.title, currentSectionTitle),
      rawContent: optimisticHandoutResource.content_markdown || "",
    };
    upsertRecentArtifact(optimisticHandoutArtifact);
    showToast("正在打开讲义预览页，正式内容会继续生成");
    openGeneratedResourcePreview(
      buildPreviewResourceFromArtifact(optimisticHandoutArtifact, "lecture_note", optimisticHandoutResource),
      "课堂讲义",
      "running",
    );
    beginUiProgress(0.14);
    setUiProgress(0.24);
    try {
      const result = await Promise.race([
        studentApi.generateResources({
          user_id: activeUserId,
          course_id: backendCourseId,
          knowledge_points: [course.title, currentSectionTitle, ...outlineLines],
          resource_types: ["lecture_note"],
        }),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("RESOURCE_GENERATE_TIMEOUT")), RESOURCE_GENERATION_TIMEOUT_MS),
        ),
      ]);
      setUiProgress(0.56);
      const hydratedResources = await loadGeneratedResourceCards(result.resources || []);
      mergeResourcesIntoCourseLibrary(hydratedResources);
      void refreshCourseLibraryFromDatabase();
      const firstResourceId = Number(hydratedResources?.[0]?.resource_id);
      const primaryResource = hydratedResources?.[0];
      if (primaryResource) {
        const workspaceUrl = buildWorkspaceResourceLink(courseId, currentSectionTitle, "handout", `${course.title} · ${currentSectionTitle} 讲义`);
        let downloadUrl = workspaceUrl;
        if (Number.isFinite(firstResourceId) && firstResourceId > 0) {
          const download = await studentApi.getResourceDownloadUrl(firstResourceId, activeUserId, "docx");
          downloadUrl = download.download_url || workspaceUrl;
        }
        const nextArtifact: RecentResourceArtifact = {
          kind: "handout",
          resourceId: primaryResource?.resource_id ? Number(primaryResource.resource_id) : null,
          preferredFormat: "docx",
          title: `${course.title} · ${currentSectionTitle} 讲义`,
          summary: buildResourceSummary(primaryResource, "已整理出本节讲义，适合课后快速复习。"),
          downloadUrl,
          generatedAt: formatGenerationTime(),
          sectionTitle: currentSectionTitle,
          previewContent: buildExpandedHandoutPreviewContent(primaryResource, course.title, currentSectionTitle),
          rawContent: primaryResource?.content_markdown || "",
        };
        upsertRecentArtifact(nextArtifact);
        setUiProgress(0.92);
        showToast("讲义已生成，正在刷新预览页");
        openGeneratedResourcePreview(
          buildPreviewResourceFromArtifact(nextArtifact, "lecture_note", primaryResource),
          "课堂讲义",
          "completed",
          true,
        );
      } else {
        showToast("讲义已生成，但暂时没有拿到下载链接");
      }
    } catch {
      const fallbackResource = buildLocalGeneratedResource("lecture_note", course.title, currentSectionTitle, outlineLines);
      const fallbackArtifact: RecentResourceArtifact = {
        kind: "handout",
        resourceId: fallbackResource.resource_id ? Number(fallbackResource.resource_id) : null,
        preferredFormat: "docx",
        title: `${course.title} · ${currentSectionTitle} 讲义`,
        summary: buildResourceSummary(fallbackResource, "已切换为课堂内本地讲义，可先继续学习。"),
        downloadUrl: buildWorkspaceResourceLink(courseId, currentSectionTitle, "handout", `${course.title} · ${currentSectionTitle} 讲义`),
        generatedAt: formatGenerationTime(),
        sectionTitle: currentSectionTitle,
        previewContent: buildExpandedHandoutPreviewContent(fallbackResource, course.title, currentSectionTitle),
        rawContent: fallbackResource.content_markdown || "",
      };
      upsertRecentArtifact(fallbackArtifact);
      showToast("讲义暂时切到课堂内版本，已刷新预览页");
      openGeneratedResourcePreview(
        buildPreviewResourceFromArtifact(fallbackArtifact, "lecture_note", fallbackResource),
        "课堂讲义",
        "completed",
        true,
      );
    } finally {
      finishUiProgress();
      setGeneratingHandout(false);
    }
  };

  const handleGenerateMindmap = async () => {
    if (generatingHandout || generatingPpt || generatingMindmap || generatingPractice) return;
    setGeneratingMindmap(true);
    const reusableResource = await findReusableResourceFromLibrary(["mindmap", "mind_map"]);
    if (reusableResource) {
      const reusableArtifact = mapBackendResourceToArtifact(reusableResource, course.title, currentSectionTitle, courseId);
      if (reusableArtifact) {
        upsertRecentArtifact(reusableArtifact);
        showToast("已找到资料库里的导图，正在直接打开");
        openGeneratedResourcePreview(
          buildPreviewResourceFromArtifact(reusableArtifact, "mindmap", reusableResource),
          "课堂导图",
        );
        setGeneratingMindmap(false);
        return;
      }
    }
    const optimisticMindmapResource = buildLocalGeneratedResource("mindmap", course.title, currentSectionTitle, outlineLines);
    const optimisticMindmapArtifact: RecentResourceArtifact = {
      kind: "mindmap",
      resourceId: null,
      preferredFormat: "xmind",
      title: `${course.title} · ${currentSectionTitle} 导图`,
      summary: buildResourceSummary(optimisticMindmapResource, "系统已进入导图生成流程，当前先打开结构预览稿。"),
      downloadUrl: buildWorkspaceResourceLink(courseId, currentSectionTitle, "mindmap", `${course.title} · ${currentSectionTitle} 导图`),
      generatedAt: formatGenerationTime(),
      sectionTitle: currentSectionTitle,
      previewContent: buildResourcePreviewContent(optimisticMindmapResource, ["系统正在补全正式导图文件，当前先展示结构预览。"]),
      rawContent: optimisticMindmapResource.content_markdown || "",
      mindmapNodes: extractMindmapNodes(optimisticMindmapResource, course.title, currentSectionTitle),
    };
    upsertRecentArtifact(optimisticMindmapArtifact);
    showToast("正在打开导图预览页，正式内容会继续生成");
    openGeneratedResourcePreview(
      buildPreviewResourceFromArtifact(optimisticMindmapArtifact, "mindmap", optimisticMindmapResource),
      "课堂导图",
      "running",
    );
    beginUiProgress(0.14);
    setUiProgress(0.26);
    try {
      const result = await Promise.race([
        studentApi.generateResources({
          user_id: activeUserId,
          course_id: backendCourseId,
          knowledge_points: [course.title, currentSectionTitle, ...outlineLines],
          resource_types: ["mindmap"],
        }),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("RESOURCE_GENERATE_TIMEOUT")), RESOURCE_GENERATION_TIMEOUT_MS),
        ),
      ]);
      setUiProgress(0.58);
      const hydratedResources = await loadGeneratedResourceCards(result.resources || []);
      mergeResourcesIntoCourseLibrary(hydratedResources);
      void refreshCourseLibraryFromDatabase();
      const firstResourceId = Number(hydratedResources?.[0]?.resource_id);
      const primaryResource = hydratedResources?.[0];
      if (primaryResource) {
        const workspaceUrl = buildWorkspaceResourceLink(courseId, currentSectionTitle, "mindmap", `${course.title} · ${currentSectionTitle} 导图`);
        let downloadUrl = workspaceUrl;
        if (Number.isFinite(firstResourceId) && firstResourceId > 0) {
          const download = await studentApi.getResourceDownloadUrl(firstResourceId, activeUserId, "markdown");
          downloadUrl = download.download_url || workspaceUrl;
        }
        const mindmapNodes = extractMindmapNodes(primaryResource, course.title, currentSectionTitle);
        const nextArtifact: RecentResourceArtifact = {
          kind: "mindmap",
          resourceId: primaryResource?.resource_id ? Number(primaryResource.resource_id) : null,
          preferredFormat: "xmind",
          title: `${course.title} · ${currentSectionTitle} 导图`,
          summary: buildResourceSummary(primaryResource, "已提炼出本节知识结构，适合先总览再精读。"),
          downloadUrl,
          generatedAt: formatGenerationTime(),
          sectionTitle: currentSectionTitle,
          previewContent: buildResourcePreviewContent(primaryResource, ["已提炼出本节知识结构，适合先总览再精读。"]),
          rawContent: primaryResource?.content_markdown || "",
          mindmapNodes,
        };
        upsertRecentArtifact(nextArtifact);
        setUiProgress(0.92);
        showToast("导图已生成，正在刷新预览页");
        openGeneratedResourcePreview(
          buildPreviewResourceFromArtifact(nextArtifact, "mindmap", primaryResource),
          "课堂导图",
          "completed",
          true,
        );
      } else {
        showToast("导图已生成，但暂时没有拿到下载链接");
      }
    } catch {
      const fallbackResource = buildLocalGeneratedResource("mindmap", course.title, currentSectionTitle, outlineLines);
      const fallbackArtifact: RecentResourceArtifact = {
        kind: "mindmap",
        resourceId: fallbackResource.resource_id ? Number(fallbackResource.resource_id) : null,
        preferredFormat: "xmind",
        title: `${course.title} · ${currentSectionTitle} 导图`,
        summary: buildResourceSummary(fallbackResource, "已切换为课堂内本地导图，可先继续学习。"),
        downloadUrl: buildWorkspaceResourceLink(courseId, currentSectionTitle, "mindmap", `${course.title} · ${currentSectionTitle} 导图`),
        generatedAt: formatGenerationTime(),
        sectionTitle: currentSectionTitle,
        previewContent: buildResourcePreviewContent(fallbackResource, ["已切换为课堂内本地导图，可先继续学习。"]),
        rawContent: fallbackResource.content_markdown || "",
        mindmapNodes: extractMindmapNodes(fallbackResource, course.title, currentSectionTitle),
      };
      upsertRecentArtifact(fallbackArtifact);
      showToast("导图暂时切到课堂内版本，已刷新预览页");
      openGeneratedResourcePreview(
        buildPreviewResourceFromArtifact(fallbackArtifact, "mindmap", fallbackResource),
        "课堂导图",
        "completed",
        true,
      );
    } finally {
      finishUiProgress();
      setGeneratingMindmap(false);
    }
  };

  const handleGeneratePractice = async () => {
    if (generatingHandout || generatingPpt || generatingMindmap || generatingPractice) return;
    setGeneratingPractice(true);
    const reusableResource = await findReusableResourceFromLibrary(["practice_set", "quiz_set"]);
    if (reusableResource) {
      const reusableArtifact = mapBackendResourceToArtifact(reusableResource, course.title, currentSectionTitle, courseId);
      if (reusableArtifact) {
        upsertRecentArtifact(reusableArtifact);
        showToast("已找到资料库里的练习，正在直接打开");
        openGeneratedResourcePreview(
          buildPreviewResourceFromArtifact(reusableArtifact, "practice_set", reusableResource),
          "课堂练习",
        );
        setGeneratingPractice(false);
        return;
      }
    }
    const optimisticPracticeResource = buildLocalGeneratedResource("practice_set", course.title, currentSectionTitle, outlineLines);
    const optimisticPracticeArtifact: RecentResourceArtifact = {
      kind: "practice",
      resourceId: null,
      preferredFormat: "docx",
      title: `${course.title} · ${currentSectionTitle} 练习`,
      summary: buildResourceSummary(optimisticPracticeResource, "系统已进入练习生成流程，当前先打开随堂练习预览。"),
      downloadUrl: buildWorkspaceResourceLink(courseId, currentSectionTitle, "practice", `${course.title} · ${currentSectionTitle} 练习`),
      generatedAt: formatGenerationTime(),
      sectionTitle: currentSectionTitle,
      previewContent: buildResourcePreviewContent(optimisticPracticeResource, ["系统正在补全正式练习文件，当前先展示可答题预览。"]),
      rawContent: optimisticPracticeResource.content_markdown || "",
    };
    upsertRecentArtifact(optimisticPracticeArtifact);
    showToast("正在打开练习预览页，正式内容会继续生成");
    openGeneratedResourcePreview(
      buildPreviewResourceFromArtifact(optimisticPracticeArtifact, "practice_set", optimisticPracticeResource),
      "课堂练习",
      "running",
    );
    beginUiProgress(0.14);
    setUiProgress(0.26);
    try {
      const result = await Promise.race([
        studentApi.generateResources({
          user_id: activeUserId,
          course_id: backendCourseId,
          knowledge_points: [course.title, currentSectionTitle, ...outlineLines],
          resource_types: ["practice_set"],
        }),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("RESOURCE_GENERATE_TIMEOUT")), RESOURCE_GENERATION_TIMEOUT_MS),
        ),
      ]);
      setUiProgress(0.58);
      const hydratedResources = await loadGeneratedResourceCards(result.resources || []);
      mergeResourcesIntoCourseLibrary(hydratedResources);
      void refreshCourseLibraryFromDatabase();
      const firstResourceId = Number(hydratedResources?.[0]?.resource_id);
      const primaryResource = hydratedResources?.[0];
      if (primaryResource) {
        const workspaceUrl = buildWorkspaceResourceLink(courseId, currentSectionTitle, "practice", `${course.title} · ${currentSectionTitle} 练习`);
        let downloadUrl = workspaceUrl;
        if (Number.isFinite(firstResourceId) && firstResourceId > 0) {
          const download = await studentApi.getResourceDownloadUrl(firstResourceId, activeUserId, "markdown");
          downloadUrl = download.download_url || workspaceUrl;
        }
        const practiceQuestions = extractPracticeQuestions(primaryResource, course.title, currentSectionTitle);
        const nextArtifact: RecentResourceArtifact = {
          kind: "practice",
          resourceId: primaryResource?.resource_id ? Number(primaryResource.resource_id) : null,
          preferredFormat: "docx",
          title: `${course.title} · ${currentSectionTitle} 练习`,
          summary: buildResourceSummary(primaryResource, "已生成针对本节知识点的随堂练习。"),
          downloadUrl,
          generatedAt: formatGenerationTime(),
          sectionTitle: currentSectionTitle,
          previewContent: buildResourcePreviewContent(primaryResource, ["已生成针对本节知识点的随堂练习。"]),
          rawContent: primaryResource?.content_markdown || "",
          practiceQuestions,
        };
        upsertRecentArtifact(nextArtifact);
        setUiProgress(0.92);
        showToast("练习已生成，正在刷新预览页");
        openGeneratedResourcePreview(
          buildPreviewResourceFromArtifact(nextArtifact, "practice_set", primaryResource),
          "课堂练习",
          "completed",
          true,
        );
      } else {
        showToast("练习已生成，但暂时没有拿到下载链接");
      }
    } catch {
      const fallbackResource = buildLocalGeneratedResource("practice_set", course.title, currentSectionTitle, outlineLines);
      const fallbackArtifact: RecentResourceArtifact = {
        kind: "practice",
        resourceId: fallbackResource.resource_id ? Number(fallbackResource.resource_id) : null,
        preferredFormat: "docx",
        title: `${course.title} · ${currentSectionTitle} 练习`,
        summary: buildResourceSummary(fallbackResource, "已切换为课堂内本地练习，可先继续学习。"),
        downloadUrl: buildWorkspaceResourceLink(courseId, currentSectionTitle, "practice", `${course.title} · ${currentSectionTitle} 练习`),
        generatedAt: formatGenerationTime(),
        sectionTitle: currentSectionTitle,
        previewContent: buildResourcePreviewContent(fallbackResource, ["已切换为课堂内本地练习，可先继续学习。"]),
        rawContent: fallbackResource.content_markdown || "",
        practiceQuestions: extractPracticeQuestions(fallbackResource, course.title, currentSectionTitle),
      };
      upsertRecentArtifact(fallbackArtifact);
      showToast("练习暂时切到课堂内版本，已刷新预览页");
      openGeneratedResourcePreview(
        buildPreviewResourceFromArtifact(fallbackArtifact, "practice_set", fallbackResource),
        "课堂练习",
        "completed",
        true,
      );
    } finally {
      finishUiProgress();
      setGeneratingPractice(false);
    }
  };

  const handleGeneratePpt = async () => {
    if (generatingPpt || generatingHandout || generatingMindmap || generatingPractice) return;
    setGeneratingPpt(true);
    const reusableResource = await findReusableResourceFromLibrary(["ppt"]);
    if (reusableResource) {
      const reusablePpt = mapBackendResourceToPpt(reusableResource, course.title, currentSectionTitle);
      if (reusablePpt) {
        setRecentPpt(reusablePpt);
        showToast("已找到资料库里的 PPT，正在直接打开");
        openGeneratedResourcePreview(
          buildPptPreviewResource(reusablePpt, reusableResource),
          "课堂 PPT",
        );
        setGeneratingPpt(false);
        return;
      }
    }
    const optimisticSlides = buildCourseDeckSlides(
      [buildLocalGeneratedResource("lecture_note", course.title, currentSectionTitle, outlineLines)],
      course.title,
      currentSectionTitle,
      outlineLines,
      selectedPptTemplate,
    );
    const optimisticPpt: RecentPptArtifact = {
      resourceId: null,
      fileName: `${course.title.replace(/[\\/:*?"<>|]+/g, "-")}-${currentSectionTitle.replace(/[\\/:*?"<>|]+/g, "-")}.pptx`,
      slideCount: optimisticSlides.length,
      generatedAt: formatGenerationTime(),
      slides: optimisticSlides,
      summary: "系统已进入 PPT 生成流程，当前先打开可预览草案。",
      sectionTitle: currentSectionTitle,
      downloadUrl: "",
      preferredFormat: "pptx",
      pptTemplate: selectedPptTemplate,
    };
    setRecentPpt(optimisticPpt);
    showToast("正在打开 PPT 预览页，正式内容会继续生成");
    openGeneratedResourcePreview(buildPptPreviewResource(optimisticPpt, null), "课堂 PPT", "running");
    beginUiProgress(0.14);
    setUiProgress(0.24);
    try {
      const result = await Promise.race([
        studentApi.generateResources({
          user_id: activeUserId,
          course_id: backendCourseId,
          knowledge_points: [course.title, currentSectionTitle, ...outlineLines],
          resource_types: ["ppt"],
        }),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("RESOURCE_GENERATE_TIMEOUT")), RESOURCE_GENERATION_TIMEOUT_MS),
        ),
      ]);
      setUiProgress(0.62);
      const hydratedResources = await loadGeneratedResourceCards(result.resources || []);
      mergeResourcesIntoCourseLibrary(hydratedResources);
      void refreshCourseLibraryFromDatabase();
      const teachingPlanResource =
        hydratedResources.find((item) => item.resource_type === "ppt") ||
        hydratedResources.find((item) => item.resource_type === "teaching_plan") ||
        hydratedResources[0] ||
        null;
      const fileName = `${course.title.replace(/[\\/:*?"<>|]+/g, "-")}-${currentSectionTitle.replace(/[\\/:*?"<>|]+/g, "-")}.pptx`;
      const slides = buildCourseDeckSlides(hydratedResources, course.title, currentSectionTitle, outlineLines, selectedPptTemplate);
      let downloadUrl = "";
      if (teachingPlanResource?.resource_id) {
        try {
          const download = await studentApi.getResourceDownloadUrl(Number(teachingPlanResource.resource_id), activeUserId, "pptx");
          downloadUrl = download.download_url || "";
        } catch {
          downloadUrl = "";
        }
      }
      const nextPpt: RecentPptArtifact = {
        resourceId: teachingPlanResource?.resource_id ? Number(teachingPlanResource.resource_id) : null,
        fileName,
        slideCount: slides.length,
        generatedAt: formatGenerationTime(),
        slides,
        summary: course.title.includes("软件工程")
          ? `已按确认大纲生成 ${slides.length} 页可播放课件。`
          : "已按当前课程与章节整理为封面、目录、内容页和结尾页的课件草案。",
        sectionTitle: currentSectionTitle,
        downloadUrl,
        preferredFormat: "pptx",
        rawContent: teachingPlanResource?.content_markdown || "",
        pptTemplate: selectedPptTemplate,
      };
      setRecentPpt(nextPpt);
      setUiProgress(0.92);
      showToast("PPT 草案已生成，正在刷新预览页");
      openGeneratedResourcePreview(
        buildPptPreviewResource(nextPpt, teachingPlanResource),
        "课堂 PPT",
        "completed",
        true,
      );
    } catch {
      const fallbackSlides = buildCourseDeckSlides(
        [buildLocalGeneratedResource("lecture_note", course.title, currentSectionTitle, outlineLines)],
        course.title,
        currentSectionTitle,
        outlineLines,
        selectedPptTemplate,
      );
      const fallbackPpt: RecentPptArtifact = {
        resourceId: null,
        fileName: `${course.title.replace(/[\\/:*?"<>|]+/g, "-")}-${currentSectionTitle.replace(/[\\/:*?"<>|]+/g, "-")}.pptx`,
        slideCount: fallbackSlides.length,
        generatedAt: formatGenerationTime(),
        slides: fallbackSlides,
        summary: "真实课件暂时较慢，已先按当前章节生成课堂内可预览的 PPT 草案。",
        sectionTitle: currentSectionTitle,
        downloadUrl: "",
        preferredFormat: "pptx",
        pptTemplate: selectedPptTemplate,
      };
      setRecentPpt(fallbackPpt);
      showToast("PPT 草案暂时切到课堂内版本，已刷新预览页");
      openGeneratedResourcePreview(
        buildPptPreviewResource(fallbackPpt, null),
        "课堂 PPT",
        "completed",
        true,
      );
    } finally {
      finishUiProgress();
      setGeneratingPpt(false);
    }
  };

  const formatCommentDate = (createdAt?: string | null) => {
    if (!createdAt) {
      return "刚刚";
    }
    const parsed = new Date(createdAt);
    if (Number.isNaN(parsed.getTime())) {
      return createdAt;
    }
    const diffMinutes = Math.max(0, Math.round((Date.now() - parsed.getTime()) / 60000));
    if (diffMinutes < 1) {
      return "刚刚";
    }
    if (diffMinutes < 60) {
      return `${diffMinutes} 分钟前`;
    }
    if (diffMinutes < 1440) {
      return `${Math.floor(diffMinutes / 60)} 小时前`;
    }
    return `${Math.floor(diffMinutes / 1440)} 天前`;
  };

  const mapCourseComment = (item: CourseCommentItem): CourseComment => ({
    id: item.id,
    author: item.author,
    text: item.content,
    date: formatCommentDate(item.created_at),
    createdAt: item.created_at,
    likes: item.likes,
    badge: item.badge || "课堂互动",
    liked: item.liked,
    replyTo: item.reply_to?.author,
    parentCommentId: item.parent_comment_id,
  });

  const buildFallbackCourseComments = () => {
    const presetComments = PRESET_COMMENTS_BY_COURSE[courseId] || PRESET_COMMENTS_BY_COURSE["series-1"] || [];
    const zack = getPersonaById("student-zack");
    const emily = getPersonaById("student-emily");
    return presetComments.map((preset, index) => ({
      id: -(activeEpisodeIdx * 100 + index + 1),
      author:
        preset.userId === 1002
          ? `${zack?.name || "Zack Dev"}`
          : preset.userId === 1003
            ? `${emily?.name || "Emily UI"}`
            : "课堂同学",
      text: preset.content,
      date: "刚刚",
      createdAt: null,
      likes: Math.max(3, 9 - index * 2),
      badge:
        preset.userId === 1002
          ? `${zack?.title || "软件工程方向学生"}`
          : preset.userId === 1003
            ? `${emily?.title || "交互设计方向学生"}`
            : "课堂互动",
      liked: false,
      parentCommentId: null,
    })) satisfies CourseComment[];
  };

  const getCommentTimestamp = (comment: CourseComment) => {
    if (!comment.createdAt) {
      return 0;
    }
    const parsed = new Date(comment.createdAt).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const nestedComments = useMemo(() => {
    const compareTopLevel = (a: CourseComment, b: CourseComment) => {
      if (commentSort === "hot" && b.likes !== a.likes) {
        return b.likes - a.likes;
      }
      const timeDiff = getCommentTimestamp(b) - getCommentTimestamp(a);
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return b.id - a.id;
    };

    const compareReplies = (a: CourseComment, b: CourseComment) => {
      const timeDiff = getCommentTimestamp(a) - getCommentTimestamp(b);
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return a.id - b.id;
    };

    const childrenByParent = new Map<number, CourseComment[]>();
    const topLevel: CourseComment[] = [];

    comments.forEach((comment) => {
      if (comment.parentCommentId) {
        const siblings = childrenByParent.get(comment.parentCommentId) || [];
        siblings.push(comment);
        childrenByParent.set(comment.parentCommentId, siblings);
        return;
      }
      topLevel.push(comment);
    });

    topLevel.sort(compareTopLevel);
    childrenByParent.forEach((items) => items.sort(compareReplies));

    const buildNestedChild = (comment: CourseComment, depth: number): Array<{ item: CourseComment; depth: number }> => {
      const children = childrenByParent.get(comment.id) || [];
      return [
        { item: comment, depth },
        ...children.flatMap((child) => buildNestedChild(child, depth + 1)),
      ];
    };

    return topLevel.flatMap((comment) => buildNestedChild(comment, 0));
  }, [commentSort, comments]);

  const hydrateCourseComments = async () => {
    const fallbackComments = buildFallbackCourseComments();
    try {
      const existing = await studentApi.listCourseComments({
        course_key: courseId,
        section_index: activeEpisodeIdx,
        limit: 100,
      });
      if (existing.total > 0) {
        setComments(existing.items.map(mapCourseComment));
        return;
      }
    } catch {
      setComments(fallbackComments);
      return;
    }

    if (!fallbackComments.length) {
      setComments([]);
      return;
    }

    const seeded: CourseComment[] = [];
    for (const preset of PRESET_COMMENTS_BY_COURSE[courseId] || PRESET_COMMENTS_BY_COURSE["series-1"] || []) {
      try {
        const created = await studentApi.createCourseComment({
          course_key: courseId,
          section_index: activeEpisodeIdx,
          content: preset.content,
        });
        const zack = getPersonaById("student-zack");
        const emily = getPersonaById("student-emily");
        seeded.push(
          mapCourseComment({
            ...created,
            author:
              preset.userId === 1002
                ? `${zack?.name || "Zack Dev"}`
                : preset.userId === 1003
                  ? `${emily?.name || "Emily UI"}`
                  : created.author,
            badge:
              preset.userId === 1002
                ? `${zack?.title || "软件工程方向学生"}`
                : preset.userId === 1003
                  ? `${emily?.title || "交互设计方向学生"}`
                  : created.badge,
          }),
        );
      } catch {
        seeded.push(fallbackComments[seeded.length]);
      }
    }
    setComments(seeded.filter(Boolean));
  };

  const hydrateLearningFeed = async () => {
    setLearningFeedLoading(true);
    const [questionResult, noteResult] = await Promise.allSettled([
      studentApi.listLearningQuestions(backendCourseId, undefined, true),
      studentApi.listLearningNotes(backendCourseId, undefined, true),
    ]);

    if (questionResult.status === "fulfilled") {
      setLearningQuestions(questionResult.value.list || []);
    } else {
      setLearningQuestions([]);
    }

    if (noteResult.status === "fulfilled") {
      setLearningNotes(noteResult.value.list || []);
    } else {
      setLearningNotes([]);
    }

    if (questionResult.status === "rejected" && noteResult.status === "rejected") {
      showToast("课堂学习记录加载失败，请稍后重试");
    }

    setLearningFeedLoading(false);
  };

  const handleVideoPlayPause = async () => {
    if (!videoSourceMounted) {
      pendingResumeTimeRef.current = currentPlaybackTime > 0 ? currentPlaybackTime : pendingResumeTimeRef.current;
      shouldResumeAutoplayRef.current = true;
      setShowVideoLoadingOverlay(true);
      setVideoSourceMounted(true);
      return;
    }

    if (!videoRef.current) {
      return;
    }

    if (!videoRef.current.paused) {
      videoRef.current.pause();
      setVideoPlaying(false);
      return;
    }

    try {
      setShowVideoLoadingOverlay(true);
      await videoRef.current.play();
      setVideoPlaying(true);
    } catch {
      setShowVideoLoadingOverlay(false);
      showToast("当前视频暂时无法播放，请稍后重试");
    }
  };

  const rememberCurrentPlayback = () => {
    const now = Number(videoRef.current?.currentTime || currentPlaybackTime || 0);
    if (now > 0.5) {
      localStorage.setItem(playbackStorageKey, String(now));
    }
    return now;
  };

  useEffect(() => {
    const handleTutorOpen = () => {
      rememberCurrentPlayback();
    };

    window.addEventListener(OPEN_TUTOR_PANEL_EVENT, handleTutorOpen as EventListener);
    return () => window.removeEventListener(OPEN_TUTOR_PANEL_EVENT, handleTutorOpen as EventListener);
  }, [currentPlaybackTime, playbackStorageKey]);

  const handleToggleFavorite = () => {
    setIsFavorite(!isFavorite);
    // Dynamic feedback
    showToast(isFavorite ? "已移出我的研学收藏夹" : "已成功加入我的研学收藏夹！");
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userComment.trim() || submittingComment) return;

    const content = userComment.trim();
    const activeReplyTarget = replyTarget;
    const optimisticId = localTempCommentId--;
    const optimisticComment: CourseComment = {
      id: optimisticId,
      author: "你",
      text: content,
      date: "刚刚",
      createdAt: new Date().toISOString(),
      likes: 0,
      badge: "我的讨论",
      liked: false,
      replyTo: activeReplyTarget?.author,
      parentCommentId: activeReplyTarget?.id ?? null,
    };
    setSubmittingComment(true);
    setReplyTarget(null);
    setUserComment("");
    setComments((prev) => [optimisticComment, ...prev]);

    void (async () => {
      try {
        await Promise.race([
          studentApi.createCourseComment({
            course_key: courseId,
            section_index: activeEpisodeIdx,
            content,
            parent_comment_id: activeReplyTarget?.id,
          }),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error("COMMENT_SUBMIT_TIMEOUT")), 8000),
          ),
        ]);
        await hydrateCourseComments();
        showToast("讨论已发布");
      } catch {
        setComments((prev) => prev.filter((comment) => comment.id !== optimisticId));
        setUserComment(content);
        setReplyTarget(activeReplyTarget);
        showToast("讨论发布失败，请稍后重试");
      } finally {
        setSubmittingComment(false);
      }
    })();
  };

  const handleToggleCommentLike = (commentId: number) => {
    const target = comments.find((item) => item.id === commentId);
    if (!target) {
      return;
    }

    void (async () => {
      try {
        const result = await studentApi.toggleCourseCommentLike(target.id);
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  liked: result.liked,
                  likes: result.likes,
                }
              : comment,
          ),
        );
        showToast(result.liked ? "已赞同这条讨论" : "已取消赞同");
      } catch {
        showToast("点赞失败，请稍后重试");
      }
    })();
  };

  const handleReplyComment = (commentId: number, author: string) => {
    setReplyTarget({ id: commentId, author });
    window.setTimeout(() => {
      commentInputRef.current?.focus();
      commentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
    showToast(`已切换到回复输入，可直接回复 ${author}`);
  };

  let categoryZh = "通用研学航道";
  if (course.category === "Design" || course.category === "Programming") categoryZh = "数字艺术重构航道";
  if (course.category === "Data") categoryZh = "数据智能与可视化航道";

  let courseTitleZh = course.title;
  if (course.title.includes("Advanced Machine Learning")) courseTitleZh = "前沿机器学习实战：极深反向传播与梯度策略";
  if (course.title.includes("Modern React Architecture")) courseTitleZh = "现代化 React 架构：极致组件虚拟化与 Context 多维切片";
  if (course.title.includes("Creative Front-End CSS Physics")) courseTitleZh = "创意前端物理动效：三维流体粒子系统与贝塞尔重力刚体";
  if (course.title.includes("Data Storytelling Masterclass")) courseTitleZh = "D3 数据叙事表达：高对比动态图表与视觉推演";

  let uploaderZh = course.uploader;
  if (course.uploader.includes("Dr. Alexander")) uploaderZh = "刘博士 (学海带头人)";
  if (course.uploader.includes("Prof. Sarah")) uploaderZh = "萨教授 (首席主讲)";
  if (course.uploader.includes("Justin")) uploaderZh = "架构师 Justin";
  if (course.uploader.includes("TechElite Academy")) uploaderZh = "孙以澄老师";
  if (course.uploader.includes("Design Mastery Lab")) uploaderZh = "李闻川老师";
  if (course.uploader.includes("Sarah Jenkins Studio")) uploaderZh = "何青岚老师";
  if (course.uploader.includes("DataInsights Research")) uploaderZh = "乔知远老师";

  let courseSummaryZh = "围绕核心知识点、典型案例与实操节奏展开讲解，适合边看边记，快速形成完整理解。";
  if (course.title.includes("Advanced Machine Learning")) {
    courseSummaryZh = "聚焦反向传播、梯度稳定与深层网络训练策略，把公式理解和模型直觉一起建立起来。";
  }
  if (course.title.includes("Modern React Architecture")) {
    courseSummaryZh = "围绕状态边界、组件拆分与渲染优化展开，帮助你把 React 工程结构真正搭稳。";
  }
  if (course.title.includes("Creative Front-End CSS Physics")) {
    courseSummaryZh = "从动效力学到视觉节奏，拆解粒子、弹性和空间感，适合前端视觉表达进阶。";
  }
  if (course.title.includes("Data Storytelling Masterclass")) {
    courseSummaryZh = "把数据结构、图表表现和故事表达串成一条线，适合提升信息设计与可视化思维。";
  }

  const courseMetaResolved: Record<string, { category: string; title: string; uploader: string; summary: string }> = {
    "series-1": {
      category: "数字艺术重构航道",
      title: "现代 Web 设计系统实战",
      uploader: "孙以澄老师",
      summary: "围绕设计规范、组件体系、页面层级与交互协同展开讲解，适合在看课过程中同步沉淀成自己的设计系统方法论。",
    },
    "series-2": {
      category: "软件工程核心课程航道",
      title: "软件工程与实践（第4版）",
      uploader: "贾铁军老师",
      summary: "围绕软件工程基础、需求分析、系统设计、编码实现、测试维护与项目管理展开，适合结合真实课程资料形成完整学习闭环。",
    },
    "series-3": {
      category: "数字艺术重构航道",
      title: "微交互与界面动效设计",
      uploader: "何青岚老师",
      summary: "从弹性、惯性到节奏控制，分步骤讲清微交互中的物理感表达与视觉反馈，让界面呈现更完整的生命力。",
    },
    "course-4": {
      category: "数据智能与可视化航道",
      title: "D3.js 数据叙事与可视化表达",
      uploader: "乔知远老师",
      summary: "通过坐标映射、图表层级与过渡动画，把原始数据整理成有表达力的数据叙事页面，强化分析与展示一体化能力。",
    },
  };
  const resolvedMeta = routeRole ? {
    category: `${roleProfile.role}岗位实训`,
    title: `${selectedRoleStage.title}实训`,
    uploader: selectedRoleStage.resources[0]?.source || "官方岗位资源",
    summary: `${selectedRoleStage.task} 阶段产出：${selectedRoleStage.deliverable}`,
  } : courseMetaResolved[courseId] ?? {
    category: "通用研学航道",
    title: course.title,
    uploader: course.uploader,
    summary: "围绕核心知识点、典型案例与实操节奏展开讲解，适合边看边记，快速形成完整理解。",
  };

  return (
    <div ref={learnWorkspaceRef} className="space-y-6" id="course-learning-classroom">
      <JobLearningContextBar
        kind="learn"
        fallbackAbility={resolvedMeta.category}
        fallbackTask={`完成《${resolvedMeta.title}》当前章节学习、代码练习与阶段产出`}
      />
      <section aria-label="当前岗位实训任务" className="border border-[#cfe3ef] bg-[#f8fcff] p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-black tracking-[0.16em] text-[#006689]">岗位课程与实训</div>
            <h2 className="mt-1 text-lg font-black text-[#172033]">{roleProfile.role} · {selectedRoleStage.title}</h2>
            <p className="mt-1 text-sm text-[#5b6574]">能力维度：{selectedRoleStage.ability}</p>
          </div>
          <button type="button" onClick={() => navigate(`/resources?${new URLSearchParams({ courseId, role: roleProfile.role, ability: selectedRoleStage.ability, task: routeTask, deliverable: routeDeliverable, returnTo: `/learn?${searchParams.toString()}` }).toString()}`)} className="border border-[#006689] bg-white px-4 py-2 text-xs font-black text-[#006689] hover:bg-[#eaf8ff]">打开岗位资源</button>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="border border-[#dbe7f0] bg-white p-3 text-xs leading-5 text-[#475467]"><span className="font-black text-[#172033]">代码/实践任务：</span>{routeTask}</div>
          <div className="border border-[#dbe7f0] bg-white p-3 text-xs leading-5 text-[#475467]"><span className="font-black text-[#172033]">阶段产出：</span>{routeDeliverable}</div>
        </div>
      </section>
      
      {/* Dynamic Header Path Indicator */}
      <div className="flex items-center justify-between text-xs ui-text-muted-rose">
        <div className="flex items-center gap-1.5 font-mono">
          <Link to="/" className="hover:ui-text-brand">岗位学习总览</Link>
          <span>/</span>
          <span className="ui-text-brand font-bold">{resolvedMeta.category}</span>
          <span>/</span>
          <span className="truncate">{resolvedMeta.title}</span>
        </div>
      </div>

      {/* Main Classroom Double Column Panel */}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        
        {/* Left Column: Player & Metadata Detail Sheets */}
        <div id="course-learning-primary-column" className="min-w-0 flex-1 space-y-6 xl:max-w-none">
          {routeRole ? (
            <section aria-label="岗位实训资源课堂" className="overflow-hidden border border-[#cfe3ef] bg-white shadow-sm">
              <div className="border-b border-[#dbe7f0] bg-[#f3fbff] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-[10px] font-black tracking-[0.16em] text-[#006689]">岗位可核验资源课堂</div>
                    <h2 className="mt-1 text-2xl font-black text-[#172033]">{roleProfile.role} · {activeRoleStage.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-[#5b6574]">{activeRoleStage.task}</p>
                  </div>
                  <span className="shrink-0 border border-[#f3bed0] bg-[#fff3f7] px-3 py-1.5 text-[11px] font-bold text-[#d64d82]">公开课程 · 来源可核验</span>
                </div>
              </div>
              <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-3">
                  {activeRoleStage.resources[0]?.videoUrl ? (
                    <div className="overflow-hidden border border-[#dbe7f0] bg-[#111827] shadow-sm">
                      <div className="flex items-center justify-between bg-[#172033] px-4 py-2 text-[11px] font-bold text-white">
                        <span>岗位视频课程 · {activeRoleStage.resources[0].title}</span>
                        <span className="text-[#9fe8f5]">{activeRoleStage.duration}</span>
                      </div>
                      <div className="aspect-video w-full">
                        <iframe
                          title={`${roleProfile.role} ${activeRoleStage.title}视频课程`}
                          src={activeRoleStage.resources[0].videoUrl}
                          className="h-full w-full"
                          loading="lazy"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#172033] px-4 py-2 text-[10px] leading-5 text-white/70">
                        <span>视频来源：{activeRoleStage.resources[0].source} · 课程内容与岗位任务对应，请结合下方产出完成实践。</span>
                        <a href={`https://www.bilibili.com/video/${activeRoleStage.resources[0].videoUrl.match(/bvid=([^&]+)/)?.[1] || ""}`} target="_blank" rel="noreferrer" className="shrink-0 border border-white/30 px-2 py-1 text-white hover:border-white">打开 Bilibili</a>
                      </div>
                    </div>
                  ) : null}
                  <div className="border border-[#dbe7f0] bg-[#fbfdff] p-4">
                    <div className="text-xs font-black text-[#172033]">本阶段执行清单</div>
                    <ol className="mt-3 space-y-2 text-sm leading-6 text-[#475467]">
                      <li>1. 明确输入、处理步骤和验收问题。</li>
                      <li>2. 结合官方资料完成最小可验证实践。</li>
                      <li>3. 提交阶段产出：{activeRoleStage.deliverable}</li>
                    </ol>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeRoleStage.resources.map((resource) => (
                      <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-[#006689] bg-[#006689] px-4 py-2 text-xs font-black text-white hover:bg-[#00536f]">
                        打开 {resource.title}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ))}
                    <button type="button" onClick={() => navigate(`/tutor?${new URLSearchParams({ courseId, role: roleProfile.role, stageId: String(activeEpisodeIdx + 1), ability: activeRoleStage.ability, task: activeRoleStage.task, deliverable: activeRoleStage.deliverable, returnTo: `/learn?${searchParams.toString()}` }).toString()}`)} className="border border-[#d64d82] bg-white px-4 py-2 text-xs font-black text-[#d64d82] hover:bg-[#fff3f7]">询问岗位实训导师</button>
                  </div>
                </div>
                <aside className="border border-[#dbe7f0] bg-white p-4">
                  <div className="text-[10px] font-black tracking-[0.14em] text-[#8a94a3]">资源与能力</div>
                  <div className="mt-2 text-sm font-black text-[#006689]">{activeRoleStage.ability}</div>
                  {activeRoleStage.resources.map((resource) => (
                    <div key={resource.url} className="mt-3 border-t border-[#edf2f7] pt-3 text-xs leading-5 text-[#667085]">
                      <div className="font-black text-[#172033]">{resource.source}</div>
                      <div className="mt-1">{resource.summary}</div>
                    </div>
                  ))}
                  <div className="mt-4 border-t border-[#edf2f7] pt-3 text-[11px] leading-5 text-[#667085]">阶段产出：{activeRoleStage.deliverable}</div>
                </aside>
              </div>
            </section>
          ) : null}

          {routeRole ? (
            <JobStageTaskWorkbench
              key={`${roleProfile.role}-${activeEpisodeIdx}`}
              role={roleProfile.role}
              stageIndex={activeEpisodeIdx}
              stageCount={roleProfile.stages.length}
              ability={activeRoleStage.ability}
              task={activeRoleStage.task}
              deliverable={activeRoleStage.deliverable}
              onNextStage={() => switchChapter(Math.min(activeEpisodeIdx + 1, roleProfile.stages.length - 1))}
              onGoEvaluation={() => {
                const params = new URLSearchParams({
                  courseId,
                  role: roleProfile.role,
                  stageId: String(activeEpisodeIdx + 1),
                  ability: activeRoleStage.ability,
                  task: activeRoleStage.task,
                  deliverable: activeRoleStage.deliverable,
                  completed: "true",
                  source: "job-stage-task",
                  returnTo: `/path?courseId=${courseId}&role=${encodeURIComponent(roleProfile.role)}`,
                });
                navigate(`/evaluation?${params.toString()}`);
              }}
            />
          ) : null}
          
          {/* Lecture Player with Custom Bullet Comments Layer */}
          <div className={`${routeRole ? "hidden" : ""} rounded-t-3xl bg-black overflow-hidden relative aspect-video shadow-lg border-t border-x ui-border-app group`}>
            {/* Real-time HTML Overlay Bullet comments */}
            {danmakuEnabled && (
              <div
                className="absolute inset-x-0 top-0 bottom-12 pointer-events-none overflow-hidden z-30 select-none"
                data-danmaku-debug={`${currentPlaybackTime.toFixed(2)}|${visibleDanmakus.length}|${persistedDanmakus.length}`}
              >
                {visibleDanmakus.map((dan) =>
                  dan.mode === "scroll" ? (
                    <div
                      key={dan.id}
                      className="danmaku-item absolute whitespace-nowrap text-sm font-bold opacity-95"
                      style={{
                        top: dan.top,
                        left: "100%",
                        color: dan.color,
                        width: `${dan.width}px`,
                        opacity: dan.opacity ?? 0.76,
                        animationDuration: `${dan.duration}s`,
                        animationPlayState: videoPlaying ? "running" : "paused",
                      }}
                      onAnimationEnd={() => removeActiveDanmaku(dan.id)}
                    >
                      {dan.content}
                    </div>
                  ) : (
                    <div
                      key={dan.id}
                      className="danmaku-fixed-item absolute left-1/2 -translate-x-1/2 whitespace-nowrap px-1 text-sm font-bold opacity-95"
                      style={{
                        top: dan.mode === "top" ? "8%" : undefined,
                        bottom: dan.mode === "bottom" ? "8%" : undefined,
                        color: dan.color,
                        opacity: dan.opacity ?? 0.76,
                        animationDuration: `${dan.duration}s`,
                        animationPlayState: videoPlaying ? "running" : "paused",
                      }}
                      onAnimationEnd={() => removeActiveDanmaku(dan.id)}
                    >
                      {dan.content}
                    </div>
                  ),
                )}
              </div>
            )}

            <div className="pointer-events-none absolute right-4 top-4 z-20 flex items-center gap-2">
              <div className="rounded-full border border-white/12 bg-black/30 px-3 py-1.5 text-[11px] font-bold text-white/88 backdrop-blur-md">
                {videoPlaying ? "正在播放" : "已暂停"}
              </div>
              <div className="rounded-full border border-white/12 bg-black/30 px-3 py-1.5 text-[11px] font-bold text-white/88 backdrop-blur-md">
                {String(Math.floor(currentPlaybackTime / 60)).padStart(2, "0")}:{String(Math.floor(currentPlaybackTime % 60)).padStart(2, "0")}
              </div>
            </div>

            {videoSourceMounted ? (
              <video
                id="classroom-video-tag"
                ref={videoRef}
                key={activeEpisodeIdx} // Remounts to reset play status if switched
                controls
                autoPlay={false}
                preload={currentPlaybackTime > 0 ? "auto" : "metadata"}
                poster={currentPlaybackTime > 0 ? undefined : course.image}
                className="relative z-0 h-full w-full object-cover"
                onLoadedMetadata={(event) => {
                  const duration = Number(event.currentTarget.duration || 0);
                  setVideoDuration(Number.isFinite(duration) ? duration : 0);
                }}
                onSeeked={() => {
                  setVideoFrameReady(true);
                  setShowVideoLoadingOverlay(false);
                }}
                onLoadedData={() => {
                  setVideoFrameReady(true);
                  setShowVideoLoadingOverlay(false);
                }}
                onCanPlay={() => {
                  setVideoFrameReady(true);
                  setShowVideoLoadingOverlay(false);
                }}
                onError={() => {
                  setShowVideoLoadingOverlay(false);
                  showToast("当前视频加载失败，请稍后重试");
                }}
                onPlay={() => setVideoPlaying(true)}
                onPause={() => setVideoPlaying(false)}
                onTimeUpdate={handleVideoTimelineUpdate}
              >
                <source
                  src={activeVideoSrc}
                  type="video/mp4"
                />
              </video>
            ) : (
              <button
                type="button"
                onClick={handleVideoPlayPause}
                className="relative z-0 flex h-full w-full cursor-pointer items-center justify-center overflow-hidden bg-[#111827] text-left"
                aria-label="开始播放课堂视频"
              >
                <img
                  src={course.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-55"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,24,39,0.22)_0%,rgba(17,24,39,0.38)_48%,rgba(17,24,39,0.82)_100%)]" />
                <div className="relative flex max-w-[560px] flex-col items-center px-6 text-center text-white">
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-white/18 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-md transition-transform group-hover:scale-105">
                    <Play className="ml-1 h-7 w-7 fill-white" />
                  </span>
                  <p className="mt-5 text-lg font-black">{currentSectionTitle}</p>
                  <p className="mt-2 max-w-[420px] text-sm leading-6 text-white/76">
                    点击后再加载课堂视频，先保持页面响应和 AI 工作台可用。
                  </p>
                </div>
              </button>
            )}
            {showVideoLoadingOverlay && !videoFrameReady ? (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
                <div className="rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-center text-white shadow-2xl">
                  <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-[#fb7299]" />
                  <p className="text-sm font-extrabold">正在加载课堂视频</p>
                  <p className="mt-1 text-[11px] text-white/70">播放器马上就绪，可直接点击播放</p>
                </div>
              </div>
            ) : null}
          </div>

          {/* BiliLearn Bullet Control Center Bar */}
          <div className={`${routeRole ? "hidden" : ""} mb-6 -mt-0.5 flex flex-col gap-3 rounded-b-[28px] border-x border-b ui-border-app/15 bg-[#171c22] px-4 py-3 shadow-[0_14px_30px_rgba(15,23,42,0.18)] sm:flex-row sm:items-center`}>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDanmakuEnabled(!danmakuEnabled)}
                className={`px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition-all ${
                  danmakuEnabled
                    ? "ui-bg-brand text-white hover:ui-bg-brand/90"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>{danmakuEnabled ? "弹幕已开启" : "弹幕已关闭"}</span>
              </button>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">({persistedDanmakus.length} 条课堂弹幕)</span>
            </div>

            <form onSubmit={handleSendDanmaku} className="flex-grow w-full flex items-center gap-2">
              <input
                type="text"
                placeholder="发一条课堂弹幕，留下你的即时想法..."
                value={newDanmakuText}
                onChange={(e) => setNewDanmakuText(e.target.value)}
                maxLength={45}
                className="flex-grow bg-slate-800/85 hover:bg-slate-800 focus:bg-slate-900 border border-slate-700/80 focus:border-[#fb7299]/50 rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-hidden transition-all text-ellipsis"
              />
              <button
                type="submit"
                className="ui-bg-brand hover:ui-bg-brand/90 text-white rounded-xl px-3 py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>发送弹幕</span>
              </button>
            </form>

            <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
              <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[10px] font-bold text-white/72">
                当前进度 {String(Math.floor(currentPlaybackTime / 60)).padStart(2, "0")}:{String(Math.floor(currentPlaybackTime % 60)).padStart(2, "0")}
              </div>
              <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[10px] font-bold text-white/72">
                右侧岗位实训导师已联动
              </div>
            </div>
          </div>

          {/* Player controls metadata title bar */}
          <section className="bg-white rounded-3xl border ui-border-app p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ui-bg-brand/10 ui-text-brand text-[10px] font-extrabold px-2.5 py-1 rounded-full ui-tracking-tight">
                    精品随堂实录
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                    第 {activeEpisodeIdx + 1} 课
                  </span>
                </div>
                <h1 className="font-sans text-xl md:text-2xl font-extrabold ui-text-ink">
                  {resolvedMeta.title}
                </h1>
                <p className="text-sm text-[#415066] font-sans font-semibold">
                  {activeEpisode.title}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] ui-text-body">
                  <span className="rounded-full bg-slate-50 px-2.5 py-1">时长约 {activeEpisode.duration}</span>
                  <span className="rounded-full bg-slate-50 px-2.5 py-1">建议边看边记</span>
                  <span className="rounded-full bg-slate-50 px-2.5 py-1">资源已配套</span>
                </div>
                <p className="max-w-3xl text-xs leading-6 ui-text-muted-rose/88">
                  {resolvedMeta.summary}
                </p>
              </div>

              {/* Action utilities */}
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleToggleFavorite}
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                    isFavorite 
                      ? "ui-bg-brand/10 border-[#fb7299] ui-text-brand" 
                      : "ui-border-app hover:bg-slate-50 ui-text-muted-rose"
                  }`}
                  title="收藏本课"
                >
                  <Heart className={`w-4.5 h-4.5 ${isFavorite ? "fill-current" : ""}`} />
                </button>
                <button
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(window.location.href);
                    } catch (e) {}
                    showToast("大作业直通分享链接已成功复制！");
                  }}
                  className="p-2.5 rounded-xl border ui-border-app hover:bg-slate-50 flex items-center justify-center ui-text-muted-rose transition-all cursor-pointer"
                  title="分享链接"
                >
                  <Share2 className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* Author details */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {course.uploaderAvatar ? (
                <div className="w-9 h-9 rounded-full overflow-hidden border border-[#ddbfc4] shrink-0">
                  <img
                    src={course.uploaderAvatar}
                    alt={resolvedMeta.uploader}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <UserCircle className="w-9 h-9 ui-text-brand" />
              )}
              <div className="space-y-1">
                <p className="font-bold ui-text-ink">{resolvedMeta.uploader}</p>
                <p className="text-[10px] ui-text-muted-rose/70">BiliLearn 认证讲师</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] ui-text-body sm:ml-auto">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">课程难度：进阶</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">适合场景：课堂实战</span>
              </div>
            </div>
          </section>

          {chapterPlaylistSection}

          <section className="overflow-hidden ui-radius-28 border border-[#dfe7ef] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_58%,#fff8fb_100%)] p-6 shadow-[0_16px_36px_rgba(15,23,42,0.06)] space-y-4">
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-sans text-lg font-extrabold ui-text-ink">你的课堂学习痕迹</h3>
                <p className="mt-1 text-[11px] font-medium ui-text-muted-rose/72">
                  当前章节下的提问和笔记都直接来自你的学习数据，不再是固定演示内容。
                </p>
              </div>
              <span className="inline-flex self-start rounded-full border border-[#171717]/10 ui-bg-dark/5 px-2.5 py-1 text-[10px] font-bold text-[#171717]">
                真实学习数据
              </span>
            </div>

            {learningFeedLoading ? (
              <div className="rounded-2xl border border-dashed border-[#DCE6F2] bg-[#FCFDFE] px-4 py-6 text-sm ui-text-secondary">
                正在同步当前课堂的提问与笔记...
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border ui-border-soft bg-[linear-gradient(180deg,#fcfdff,#ffffff)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-black uppercase ui-tracking-tight ui-text-subtle">Questions</div>
                      <h4 className="mt-1 text-sm font-bold ui-text-ink">本节课堂提问</h4>
                    </div>
                    <span className="rounded-full ui-bg-panel px-2.5 py-1 text-[10px] font-bold ui-text-secondary">
                      {learningQuestions.length} 条
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {learningQuestions.length ? (
                      learningQuestions.slice(0, 3).map((question) => (
                        <article key={question.id} className="rounded-2xl border ui-border-soft bg-white px-4 py-3">
                          <div className="flex items-center gap-2 text-[10px] ui-text-subtle">
                            <span className="rounded-full bg-[#FFF2F7] px-2 py-0.5 font-bold text-[#d64d82]">
                              {question.anonymity ? "匿名提问" : question.userName}
                            </span>
                            <span>{formatCommentDate(question.createTime)}</span>
                          </div>
                          <h5 className="mt-2 text-sm font-bold ui-text-ink">{question.title}</h5>
                          <p className="mt-1 text-[12px] leading-6 ui-text-secondary">{question.description}</p>
                          {question.latestReplyContent ? (
                            <div className="mt-3 rounded-2xl bg-[#F8FAFC] px-3 py-2.5 text-[12px] ui-text-body">
                              <span className="font-semibold ui-text-ink">{question.latestReplyUser || "最新回复"}：</span>
                              {question.latestReplyContent}
                            </div>
                          ) : null}
                        </article>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[#DCE6F2] bg-white px-4 py-5 text-[12px] ui-text-secondary">
                        当前章节还没有你的课堂提问。
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border ui-border-soft bg-[linear-gradient(180deg,#fffafc,#ffffff)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-black uppercase ui-tracking-tight text-[#d64d82]">Notes</div>
                      <h4 className="mt-1 text-sm font-bold ui-text-ink">本节课堂笔记</h4>
                    </div>
                    <span className="rounded-full bg-[#FFF2F7] px-2.5 py-1 text-[10px] font-bold text-[#d64d82]">
                      {learningNotes.length} 条
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {learningNotes.length ? (
                      learningNotes.slice(0, 3).map((note) => (
                        <article key={note.id} className="rounded-2xl border border-[#F4E3EA] bg-white px-4 py-3">
                          <div className="flex items-center justify-between gap-3 text-[10px] ui-text-subtle">
                            <span>{note.authorName}</span>
                            <span>{Math.floor((note.noteMoment || 0) / 60)}:{String((note.noteMoment || 0) % 60).padStart(2, "0")}</span>
                          </div>
                          <p className="mt-2 text-[13px] leading-6 ui-text-body">{note.content}</p>
                          <div className="mt-3 flex items-center gap-2 text-[10px]">
                            <span className={`rounded-full px-2 py-0.5 font-bold ${note.isGathered ? "bg-[#ECFDF3] text-[#027A48]" : "ui-bg-panel ui-text-secondary"}`}>
                              {note.isGathered ? "已归档" : "课堂笔记"}
                            </span>
                            {note.isPrivate ? (
                              <span className="rounded-full bg-[#FFF4ED] px-2 py-0.5 font-bold text-[#C4320A]">仅自己可见</span>
                            ) : null}
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[#F4E3EA] bg-white px-4 py-5 text-[12px] ui-text-secondary">
                        当前章节还没有你的课堂笔记。
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Interactive Comments Panel */}
          <section className="overflow-hidden ui-radius-28 border border-[#dfe7ef] bg-[linear-gradient(135deg,#ffffff_0%,#fbfdff_56%,#fff7fa_100%)] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)] space-y-4">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-sans text-lg font-extrabold ui-text-ink">课堂讨论</h3>
                  <span className="rounded-full bg-[#FFF1F5] px-2.5 py-1 text-[10px] font-bold ui-text-brand">
                    {comments.length} 条动态
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-medium ui-text-muted-rose/72">
                  记录收获、补充案例、追问难点，讨论会按时间和热度自动整理。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setCommentSort("latest")}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                      commentSort === "latest" ? "bg-white ui-text-ink shadow-sm" : "ui-text-body"
                    }`}
                  >
                    最新
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommentSort("hot")}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                      commentSort === "hot" ? "bg-white ui-text-ink shadow-sm" : "ui-text-body"
                    }`}
                  >
                    最热
                  </button>
                </div>
              </div>
            </div>

            <form
              onSubmit={handlePostComment}
              className="ui-radius-24 border border-[#edf1f5] bg-[linear-gradient(180deg,#fcfdff,#f8fbff)] p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold ui-text-ink">发一条课堂动态</p>
                  <p className="mt-1 text-[10px] ui-text-muted-rose/65">写结论、补充案例、记录卡点，或直接接一句讨论。</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold ui-text-secondary ring-1 ring-[#E7ECF2]">
                    公开到本课堂
                  </span>
                  <span className="shrink-0 text-[10px] font-mono ui-text-muted-rose/55">{userComment.trim().length}/120</span>
                </div>
              </div>
              <div className="ui-radius-22 border border-slate-200 bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                <input
                  ref={commentInputRef}
                  type="text"
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  maxLength={120}
                  disabled={submittingComment}
                  placeholder={replyTarget ? `回复 ${replyTarget.author}，补充你的观点...` : "写下你的想法、疑问，或这节课最值得记住的一点..."}
                  className="min-w-0 w-full bg-transparent px-1 py-1 text-sm leading-7 ui-text-ink outline-none transition-all placeholder:text-[#94a3b8] disabled:cursor-wait disabled:text-slate-400"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] ui-text-subtle">
                    <span className="rounded-full ui-bg-panel px-2.5 py-1">课堂观点</span>
                    <span className="rounded-full ui-bg-panel px-2.5 py-1">案例补充</span>
                    <span className="rounded-full ui-bg-panel px-2.5 py-1">追问卡点</span>
                  </div>
                  <button
                    type="submit"
                    disabled={submittingComment}
                    className="shrink-0 rounded-full ui-bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(251,114,153,0.18)] transition-all hover:ui-bg-brand/92 disabled:cursor-wait disabled:opacity-70 sm:min-w-[132px]"
                  >
                    {submittingComment ? "发布中..." : "发布讨论"}
                  </button>
                </div>
              </div>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border ui-border-soft bg-white px-4 py-3">
              <div className="text-[11px] ui-text-body">
                当前按{commentSort === "latest" ? "最新" : "最热"}排序，回复会自动收在原讨论下面。
              </div>
              <div className="flex items-center gap-2 text-[10px] font-semibold ui-text-subtle">
                <span className="rounded-full ui-bg-panel px-2.5 py-1">信息流视图</span>
                <span className="rounded-full ui-bg-panel px-2.5 py-1">嵌套回复</span>
              </div>
            </div>

            {replyTarget ? (
              <div className="flex items-center justify-between rounded-2xl border border-[#fb7299]/18 bg-[#fff7fa] px-4 py-3 text-[12px] text-[#a64b6d]">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 ui-text-brand" />
                  <span>正在回复 <span className="font-bold">{replyTarget.author}</span></span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  className="rounded-full px-2 py-1 text-[11px] font-bold ui-text-brand transition-colors hover:ui-bg-brand/10"
                >
                  取消回复
                </button>
              </div>
            ) : null}

            <div className="space-y-3">
              {nestedComments.length ? (
                nestedComments.map(({ item: comment, depth }) => (
                  <article
                    key={comment.id}
                    className={`relative ui-radius-24 border px-4 py-4 transition-colors hover:border-[#fb7299]/18 hover:shadow-[0_14px_30px_rgba(15,23,42,0.05)] ${
                      depth > 0
                        ? "border-[#f3d6df] bg-[linear-gradient(180deg,#fffafb,#ffffff)] shadow-[inset_3px_0_0_rgba(251,114,153,0.18)]"
                        : "border-slate-100 bg-[linear-gradient(180deg,#ffffff,#fbfdff)]"
                    }`}
                    style={{
                      marginLeft: `${depth * 18}px`,
                      width: depth > 0 ? `calc(100% - ${depth * 18}px)` : "100%",
                    }}
                  >
                    {depth > 0 ? (
                      <>
                        <span className="absolute -left-3 top-5 h-px w-3 rounded-full bg-[#f3b6c9]" />
                        <span className="absolute -left-3 top-0 h-5 w-px bg-[#f8ccda]" />
                      </>
                    ) : null}
                    <div className="flex gap-3">
                      <div
                        className={`flex shrink-0 items-center justify-center rounded-full text-sm font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] ${
                          depth > 0
                            ? "h-8 w-8 bg-[linear-gradient(135deg,#fff1f5,#ffdbe7)] text-[#c25179]"
                            : "h-10 w-10 bg-[linear-gradient(135deg,#ecf7ff,#d6ebff)] ui-text-navy"
                        }`}
                      >
                        {comment.author[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-sm font-extrabold ui-text-ink">{comment.author}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              depth === 0 ? "bg-slate-100 text-slate-500" : "bg-[#fff1f5] text-[#c25179]"
                            }`}
                          >
                            {comment.badge || "课堂互动"}
                          </span>
                          <span className="text-[10px] font-mono ui-text-muted-rose/60">{comment.date}</span>
                          {depth === 0 ? (
                            <span className="rounded-full bg-[#EFF8FF] px-2 py-0.5 text-[10px] font-bold text-[#175CD3]">主讨论</span>
                          ) : (
                            <span className="rounded-full bg-[#FFF1F5] px-2 py-0.5 text-[10px] font-bold text-[#C25179]">回复</span>
                          )}
                        </div>
                        {comment.replyTo ? (
                          <div className="mt-2 inline-flex items-center gap-1 rounded-full ui-bg-brand/8 px-2.5 py-1 text-[11px] font-medium text-[#c25179]">
                            <span className="ui-text-brand">@</span>
                            <span>{comment.replyTo}</span>
                          </div>
                        ) : null}
                        <div
                          className={`mt-2 ${
                            depth > 0
                              ? "ui-radius-18 border border-[#f9d9e4] bg-white/90 px-3 py-2.5"
                              : ""
                          }`}
                        >
                          <p className={`text-sm text-[#415066] ${depth > 0 ? "leading-6" : "leading-7"}`}>{comment.text}</p>
                        </div>
                        <div className="mt-3 flex items-center gap-3 text-[11px] font-medium text-[#6b7280]">
                          <button
                            type="button"
                            onClick={() => handleToggleCommentLike(comment.id)}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors ${
                              comment.liked
                                ? "ui-bg-brand/10 ui-text-brand"
                                : "hover:bg-slate-100 hover:ui-text-ink"
                            }`}
                          >
                            <ThumbsUp className={`h-3.5 w-3.5 ${comment.liked ? "fill-current" : ""}`} />
                            <span>赞同 {comment.likes}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReplyComment(comment.id, comment.author)}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-slate-100 hover:ui-text-ink"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>回复</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[#F4E3EA] bg-white px-4 py-6 text-[12px] leading-6 ui-text-secondary">
                  当前章节暂时还没有讨论内容，稍后会自动回填预置讨论；你也可以先发布第一条观点。
                </div>
              )}
            </div>
          </section>

        </div>

        {/* Right Column: Episodes & Direct Shortcut Panels */}
        <aside className="w-full shrink-0 space-y-6 xl:w-[400px] 2xl:w-[430px]">
          
          {classroomResourceWorkspaceButtonsSection}

          {videoLearningAiSection}

        </aside>

      </div>

      {/* 4. Bottom Section: Other Recommended Courses switched directly in Classroom */}
      <section className="course-panel-surface space-y-4">
        <div className="flex items-center justify-between border-b border-gray-50 pb-3">
          <h3 className="font-sans text-sm font-extrabold ui-text-ink flex items-center gap-1.5">
            <span className="w-2.5 h-4.5 ui-bg-brand rounded-sm shrink-0"></span>
            同等学期其他精品研学课堂
          </h3>
          <span className="text-[10px] ui-text-muted-rose/70">点击可瞬间切换当前自测试看</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {COURSES.filter(c => c.id !== course.id).map(otherCourse => {
            let otherTitleZh = otherCourse.title;
            if (otherCourse.title.includes("Advanced Machine Learning")) otherTitleZh = "前沿机器学习：极深反向传播神经网络";
            if (otherCourse.title.includes("Modern React Architecture")) otherTitleZh = "现代化 React 架构：组件虚拟化性能级联";
            if (otherCourse.title.includes("Creative Front-End CSS Physics")) otherTitleZh = "创意前端物理动效：三维流体粒子系统与贝塞尔重力";
            if (otherCourse.title.includes("Data Storytelling Masterclass")) otherTitleZh = "D3.js 数据可视化与高对比度动态树图表";

            let categoryZh = "其他研学";
            if (otherCourse.category === "Design") categoryZh = "数字艺术";
            if (otherCourse.category === "Programming") categoryZh = "研发重构";
            if (otherCourse.category === "Data") categoryZh = "数据智能";

            const otherTeacher =
              otherCourse.id === "series-2"
                ? "Design Mastery Lab"
                : otherCourse.id === "series-3"
                  ? "Sarah Jenkins Studio"
                  : otherCourse.id === "course-4"
                    ? "DataInsights Research"
                    : otherCourse.uploader;

            const otherHighlight =
              otherCourse.id === "series-2"
                ? "界面叙事"
                : otherCourse.id === "series-3"
                  ? "品牌表达"
                  : otherCourse.id === "course-4"
                    ? "数据洞察"
                    : "学习专题";

            return (
              <button
                key={otherCourse.id}
                onClick={() => {
                  navigate(`/learn?courseId=${otherCourse.id}`);
                  setActiveEpisodeIdx(0); // reset episode selection to first one
                  showToast(`已为您成功切换至课题：《${otherTitleZh}》`);
                }}
                className="group border ui-border-app hover:border-[#fb7299]/30 rounded-2xl p-3.5 bg-[linear-gradient(180deg,#ffffff,#fbfcff)] hover:bg-slate-50/50 transition-all flex gap-3 text-left items-start cursor-pointer transition-transform hover:scale-[1.01] hover:shadow-[0_14px_30px_rgba(15,23,42,0.06)]"
              >
                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-slate-100 relative shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <img
                    src={otherCourse.image}
                    alt={otherTitleZh}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                </div>
                {/* Content info */}
                <div className="min-w-0 flex flex-col justify-between py-0.5">
                  <span className="text-[8px] bg-slate-100 ui-text-muted-rose font-extrabold px-1.5 py-0.2 rounded self-start font-mono uppercase">
                    {categoryZh}
                  </span>
                  <h4 className="text-xs font-bold ui-text-ink mt-1 group-hover:ui-text-brand transition-colors truncate">
                    {otherTitleZh}
                  </h4>
                  <p className="text-[9.5px] ui-text-muted-rose/70 font-mono mt-0.5">
                    主讲: {otherCourse.id === "series-2" ? "Design Mastery Lab" : otherCourse.id === "series-3" ? "Sarah Jenkins Studio" : otherCourse.id === "course-4" ? "DataInsights Research" : otherCourse.uploader}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Beautiful In-App Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#171c22]/95 text-white text-xs font-bold px-5 py-3 rounded-full shadow-2xl z-50 flex items-center gap-2 border border-white/10 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <span className="w-2 h-2 rounded-full ui-bg-brand animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
