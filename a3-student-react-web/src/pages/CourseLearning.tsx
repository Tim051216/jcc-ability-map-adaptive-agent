/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import gsap from "gsap";
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
  Send,
  ThumbsUp,
  Presentation,
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
import { exportDeckAsPptx, type DeckSlide } from "../lib/pptxExport";
import {
  persistCourseResourceWorkspace,
  readPersistedCourseResourceWorkspace,
  type RecentPptArtifact,
  type RecentResourceArtifact,
  type StoredMindmapNode,
  type StoredPracticeQuestion,
} from "../lib/courseResourceWorkspace";
import { parseQuizPaper } from "../lib/quizEngine";
import { resolveBackendCourseCode, resolveBackendCourseId } from "../lib/courseRouting";
import { persistLastRouteCourseId } from "../lib/routeCourseContext";
import { OPEN_TUTOR_PANEL_EVENT, openTutorPanel, saveActiveTutorContext } from "../lib/tutorPanel";
import { getCourseVideoInsightMeta, getCourseVideoPlaylist } from "../lib/videoCatalog";
import HorizontalMindmap from "../components/HorizontalMindmap";
import { getGeneratedResourceIcon, getGeneratedResourceUiMeta } from "../lib/generatedResourceUi";
import AILoadingLottie from "../components/AILoadingLottie";
import { beginUiProgress, finishUiProgress, setUiProgress } from "../lib/uiProgress";

type DanmakuMode = "scroll" | "top" | "bottom";

type PersistedPresetDanmaku = {
  text: string;
  color: string;
  mode?: DanmakuMode;
  time: number;
};

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
const RESOURCE_GENERATION_TIMEOUT_MS = 45000;

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
    "AI 导师",
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
  const teachingPlan = resources.find((item) => item.resource_type === "teaching_plan");
  if (!teachingPlan?.content_markdown) return [];

  const lines = teachingPlan.content_markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const slideMap = new Map<string, string[]>();
  let currentSlideTitle = "";
  for (const line of lines) {
    const titleMatch = line.match(/^###\s+第\s*\d+\s*页\s+(.+)$/);
    if (titleMatch) {
      currentSlideTitle = titleMatch[1].trim();
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
      bullets: ["回看讲义主线", "结合导图复盘结构关系", "完成练习并继续追问 AI 导师"],
    },
  ];
}

function buildCourseDeckSlides(resources: ResourceCard[], courseTitle: string, sectionTitle: string): DeckSlide[] {
  if (courseTitle.includes("软件工程")) {
    const profile = buildSoftwareEngineeringChapterProfile(courseTitle, sectionTitle);
    const planSlides = parseTeachingPlanSlides(resources, courseTitle, sectionTitle);
    return planSlides.length ? [planSlides[0], ...profile.pptSlides.slice(1)] : profile.pptSlides;
  }
  const planSlides = parseTeachingPlanSlides(resources, courseTitle, sectionTitle);
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
    return [
      {
        kind: "cover" as const,
        title: courseTitle,
        subtitle: sectionTitle,
        bullets: ["当前没有足够的课件内容可以导出。"],
      },
    ];
  }

  return [
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
  ];
}

function buildResourceSummary(resource?: ResourceCard | null, fallback?: string) {
  const outline = extractResourceOutline(resource?.content_markdown || "");
  return (
    outline.find((line) => line.length >= 10) ||
    resource?.study_suggestion ||
    resource?.summary ||
    fallback ||
    "已根据当前课堂内容完成整理。"
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
    };
  });
}

function isAdvancedDeck(slides?: DeckSlide[]) {
  return Boolean(
    slides?.some((slide) => slide.title.includes("章节定位") || slide.title.includes("关系梳理")),
  );
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

function buildFallbackPracticeQuestions(courseTitle: string, sectionTitle: string): PracticeQuestion[] {
  if (courseTitle.includes("软件工程")) {
    return buildSoftwareEngineeringChapterProfile(courseTitle, sectionTitle).practiceQuestions;
  }
  return [
    {
      id: "practice-1",
      question: `学习《${sectionTitle}》时，最应该优先建立的是什么？`,
      options: ["章节主线与要解决的问题", "只背术语定义", "只记页面样式", "先跳过结构关系"],
      answer: ["A"],
      explanation: "先抓住章节主线和问题背景，再去理解细节和实现，复习效率更高。",
      questionType: "single",
      knowledgeTag: courseTitle,
    },
    {
      id: "practice-2",
      question: `如果要真正掌握《${sectionTitle}》里的复杂知识点，更合适的学习顺序是什么？`,
      options: ["直接做题碰运气", "先看结构再拆细节", "只看总结不看过程", "遇到难点就跳过"],
      answer: ["B"],
      explanation: "先建立整体结构，再逐步深入，是更稳定也更容易迁移的学习路径。",
      questionType: "single",
      knowledgeTag: sectionTitle,
    },
    {
      id: "practice-3",
      question: `以下哪些动作更适合在学完《${sectionTitle}》后做复盘巩固？`,
      options: ["整理讲义重点", "画出知识关系图", "只看标题不展开", "做针对性练习"],
      answer: ["A", "B", "D"],
      explanation: "讲义、导图和练习是完整的复盘闭环。",
      questionType: "multiple",
      knowledgeTag: sectionTitle,
    },
    {
      id: "practice-4",
      question: `请用 2 到 3 句话说明《${sectionTitle}》里最容易混淆的点，并给出你的区分方法。`,
      options: [],
      answer: [],
      explanation: "先写出你的理解，再交给 AI 导师做针对性讲解和纠偏。",
      questionType: "short",
      knowledgeTag: "易错点",
    },
    {
      id: "practice-5",
      question: `如果把《${sectionTitle}》放到一个真实项目或页面中，你会优先检查哪类设计是否合理？`,
      options: ["概念边界和结构主线", "配色是否足够花哨", "按钮数量是否更多", "标题是否更长"],
      answer: ["A"],
      explanation: "真实落地时最先影响质量的通常是概念边界、结构关系和场景适配，而不是表面装饰。",
      questionType: "single",
      knowledgeTag: "场景迁移",
    },
  ];
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
  return <HorizontalMindmap nodes={nodes} variant="compact" />;
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
                  placeholder="写下你的思路，提交后可继续交给 AI 导师讲解。"
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
): ResourceCard {
  const titleSuffix =
    resourceType === "mindmap" ? "导图" : resourceType === "practice_set" ? "练习" : "讲义";
  const fallbackBullets =
    resourceType === "mindmap"
      ? [
          `## ${courseTitle} · ${sectionTitle} 导图`,
          "- 核心概念：先明确本节主线概念与定义边界",
          "- 结构关系：再梳理模块之间的依赖与调用关系",
          "- 复习顺序：建议先总览结构，再逐点展开细节",
        ]
      : resourceType === "practice_set"
        ? [
            `## ${courseTitle} · ${sectionTitle} 练习`,
            "1. 先用一句话说明本节核心概念是什么",
            "2. 结合一个实际场景说明它为什么这样设计",
            "3. 说出最容易出错的点，以及你会怎么规避",
          ]
        : [
            `## ${courseTitle} · ${sectionTitle} 讲义`,
            "### 本节主线",
            "这一节要先弄清当前章节到底在解决什么问题，再去看模块、流程和关系，而不是只记几个孤立名词。",
            "### 学习目标",
            "- 理解本节最核心的设计目的",
            "- 掌握本节提到的主要模块与关系",
            "- 能把知识点放回实际场景中解释清楚",
            "### 关键结构",
            "学习时建议按“问题背景 -> 核心概念 -> 结构关系 -> 场景落地”的顺序往下理解，这样更容易形成完整主线。",
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
        ? "建议先独立完成一轮，再让 AI 导师讲解你的思路漏洞。"
        : "建议先顺着当前内容快速通读一遍，再继续问 AI 导师补细节。",
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
    return `你现在不要推荐视频、课程或外部资料。请直接围绕《${targetTitle}》输出这一节的随堂练习：先给我 5 道题，再给参考答案和解题思路，最后指出这一节最容易错的题型。`;
  }
  if (kind === "ppt") {
    return `你现在不要推荐视频、课程或外部资料。请直接围绕《${targetTitle}》输出这一节的 PPT 草案：按“封面 / 本节目标 / 核心概念 / 关键结构 / 示例 / 总结”给出逐页内容。`;
  }
  return `你现在不要推荐视频、课程或外部资料。请直接围绕《${targetTitle}》输出这一节的课堂讲义：先写本节主线，再写关键概念与结构细节，最后给我一份复习重点。`;
}

function buildGenerationTutorQuickPrompts(kind: "handout" | "mindmap" | "practice" | "ppt") {
  if (kind === "mindmap") return ["直接输出导图", "解释节点关系", "给我复习顺序"];
  if (kind === "practice") return ["直接出 5 道题", "给答案和思路", "指出易错题型"];
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

function mapLibraryResourceTag(resourceType: string) {
  if (resourceType === "mindmap") return "导图";
  if (resourceType === "practice_set") return "练习";
  if (resourceType === "course_overview") return "总览";
  if (resourceType === "teaching_plan") return "教案";
  return "讲义";
}

export default function CourseLearning() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = searchParams.get("courseId") || "series-2"; // default to Advanced React Patterns
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
  const episodes = [
    { title: "第一章：软件工程基础与软件危机", duration: "12:15", watched: true },
    { title: "第二章：可行性分析与研发策划", duration: "16:40", watched: true },
    { title: "第三章：软件需求分析与文档建模", duration: "15:20", watched: false },
    { title: "第四章：软件设计、测试与项目管理", duration: "22:10", watched: false }
  ];

  // Local state for interactive features
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeEpisodeIdx, setActiveEpisodeIdx] = useState(() => {
    const restored = initialRuntimeRef.current?.activeEpisodeIdx;
    if (typeof restored === "number" && restored >= 0 && restored < episodes.length) {
      return restored;
    }
    return 0;
  });
  const [chapterListCollapsed, setChapterListCollapsed] = useState(() => initialRuntimeRef.current?.chapterListCollapsed ?? false);
  const [userComment, setUserComment] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoFrameReady, setVideoFrameReady] = useState(false);
  const [showVideoLoadingOverlay, setShowVideoLoadingOverlay] = useState(false);
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
  const [commentSort, setCommentSort] = useState<CommentSortMode>("latest");
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [generatingHandout, setGeneratingHandout] = useState(false);
  const [generatingPpt, setGeneratingPpt] = useState(false);
  const [generatingMindmap, setGeneratingMindmap] = useState(false);
  const [generatingPractice, setGeneratingPractice] = useState(false);
  const [generatingOpenClassroom, setGeneratingOpenClassroom] = useState(false);
  const [openClassroomPreview, setOpenClassroomPreview] = useState<ClassroomPreviewState | null>(null);
  const activeEpisode = episodes[activeEpisodeIdx] || episodes[0];
  const currentSectionTitle = activeEpisode?.title || "当前章节";
  const persistedResourceWorkspace = useMemo(() => readPersistedCourseResourceWorkspace(courseId), [courseId]);
  const [recentArtifacts, setRecentArtifacts] = useState<RecentResourceArtifact[]>(() =>
    filterWorkspaceArtifactsByCourseTitle(persistedResourceWorkspace?.recentArtifacts, course.title),
  );
  const [recentPpt, setRecentPpt] = useState<RecentPptArtifact | null>(() =>
    upgradeRecentPptArtifact(
      filterWorkspacePptByCourseTitle(persistedResourceWorkspace?.recentPpt, course.title),
      course.title,
      currentSectionTitle,
    ),
  );
  const [collapsedRecentKeys, setCollapsedRecentKeys] = useState<string[]>([]);
  const [showOnlyCurrentSectionResults, setShowOnlyCurrentSectionResults] = useState(
    () => persistedResourceWorkspace?.showOnlyCurrentSectionResults ?? true,
  );
  const [previewState, setPreviewState] = useState<ResourcePreviewState | null>(null);
  const [pptViewer, setPptViewer] = useState<PptViewerState | null>(null);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, string[]>>({});
  const [practiceShortAnswers, setPracticeShortAnswers] = useState<Record<string, string>>({});
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);
  const [courseLibraryResources, setCourseLibraryResources] = useState<ResourceCard[]>([]);
  const [courseLibraryLoading, setCourseLibraryLoading] = useState(true);
  const [learningCourseDetail, setLearningCourseDetail] = useState<LearningCourseDetail | null>(null);
  const nextDanmakuIndexRef = useRef(0);
  const laneAvailableAtRef = useRef<number[]>(new Array(DANMAKU_SCROLL_LANES.length).fill(0));
  const emittedDanmakuIdsRef = useRef<Set<number>>(new Set());
  const lastVideoTimeRef = useRef(0);

  useEffect(() => {
    if (!learnWorkspaceRef.current) return;
    const revealNodes = learnWorkspaceRef.current.querySelectorAll<HTMLElement>("[data-learn-reveal]");
    if (!revealNodes.length) return;
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
  const previewRecommendation = useMemo<PreviewRecommendation | null>(() => {
    if (!previewState) return null;
    if (previewState.kind === "ppt") {
      return {
        title: "推荐下一步",
        detail: "先快速过一遍课件结构，再交给 AI 导师逐页拆解，会比直接从视频硬听更容易形成主线。",
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
      detail: "先做这组练习，再交给 AI 导师讲错题思路，能更快定位薄弱点。",
      actionLabel: "让 AI 讲题思路",
      onAction: () => {
        setPreviewState(null);
        openLearningTutorWithPrompt(`请结合这份练习《${previewState.title}》继续给我讲题思路，并告诉我这节课还该补哪些题型。`);
      },
    };
  }, [previewState]);

  useEffect(() => {
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
  }, [courseId]);

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
            ["lecture_note", "mindmap", "practice_set", "course_overview", "teaching_plan"].includes(item.resource_type),
          ),
        );
      } catch {
        // Keep current course library resources to avoid blanking the panel while syncing fails.
      } finally {
        if (!cancelled) {
          setCourseLibraryLoading(false);
        }
      }
    }

    void hydrateCourseLibrary();
    return () => {
      cancelled = true;
    };
  }, [activeUserId, backendCourseCode]);

  useEffect(() => {
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

    void hydrateLearningCourseDetail();
    return () => {
      cancelled = true;
    };
  }, [backendCourseId]);

  useEffect(() => {
    persistCourseResourceWorkspace(courseId, {
      recentArtifacts,
      recentPpt,
      showOnlyCurrentSectionResults,
    });
  }, [courseId, recentArtifacts, recentPpt, showOnlyCurrentSectionResults]);

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
                onClick={() => setActiveEpisodeIdx(idx)}
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

  useEffect(() => {
    saveActiveTutorContext({
      courseId,
      sectionId: activeEpisodeIdx,
      mode: "learning",
      title: course.title,
      subtitle: `${activeEpisode.title} · ${String(Math.floor(currentPlaybackTime / 60)).padStart(2, "0")}:${String(Math.floor(currentPlaybackTime % 60)).padStart(2, "0")}`,
      videoSrc: activeVideoSrc,
      videoResourceId: activeVideoInsightMeta?.resourceId,
      videoFileId: activeVideoInsightMeta?.fileId,
      videoFileName: activeVideoInsightMeta?.fileName,
      quickPrompts: learningAssistantPrompts,
      startAt: Number(videoRef.current?.currentTime || currentPlaybackTime || 0),
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
              Learning Runtime
            </div>
            <div className="mt-3 text-[15px] font-black tracking-[-0.02em] ui-text-ink">
              右侧 AI 导师已经接入当前视频、章节和播放进度
            </div>
            <div className="mt-1.5 max-w-2xl text-[12px] leading-6 text-[#526071]">
              在这一页边看边问，它会结合当前片段、术语上下文和课堂生成结果继续讲。
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const startAt = rememberCurrentPlayback();
              openTutorPanel({
                courseId,
                sectionId: activeEpisodeIdx,
                mode: "learning",
                title: course.title,
                subtitle: `${activeEpisode.title} · ${String(Math.floor(currentPlaybackTime / 60)).padStart(2, "0")}:${String(Math.floor(currentPlaybackTime % 60)).padStart(2, "0")}`,
                videoSrc: activeVideoSrc,
                videoResourceId: activeVideoInsightMeta?.resourceId,
                videoFileId: activeVideoInsightMeta?.fileId,
                videoFileName: activeVideoInsightMeta?.fileName,
                quickPrompts: learningAssistantPrompts,
                startAt,
                autoplay: true,
                muted: true,
              });
            }}
            className="shrink-0 rounded-full bg-[#111827] px-5 py-2.5 text-sm font-black text-white shadow-[0_12px_32px_rgba(17,24,39,0.2)] transition-all hover:-translate-y-0.5 hover:bg-[#0b1220]"
          >
            直接对当前视频提问
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="course-glass-info-card">
            <div className="text-[10px] font-black uppercase ui-tracking-brand ui-text-subtle">Current Context</div>
            <div className="mt-2 text-[13px] font-extrabold ui-text-ink">{activeEpisode.title}</div>
            <div className="mt-1 text-[11px] leading-5 ui-text-body">问题会优先锚定到当前章节和正在播放的内容，不会泛泛而谈。</div>
          </div>
          <div className="course-glass-info-card">
            <div className="text-[10px] font-black uppercase ui-tracking-brand ui-text-subtle">Live Progress</div>
            <div className="mt-2 text-[13px] font-extrabold ui-text-ink">
              {String(Math.floor(currentPlaybackTime / 60)).padStart(2, "0")}:{String(Math.floor(currentPlaybackTime % 60)).padStart(2, "0")}
            </div>
            <div className="mt-1 text-[11px] leading-5 ui-text-body">播放节点、课堂生成资料和你的提问会一起进入导师上下文。</div>
          </div>
          <div className="course-glass-info-card">
            <div className="text-[10px] font-black uppercase ui-tracking-brand ui-text-subtle">Next Move</div>
            <div className="mt-2 text-[13px] font-extrabold ui-text-ink">先看视频，再追问卡点</div>
            <div className="mt-1 text-[11px] leading-5 ui-text-body">适合解释公式、拆术语、补代码思路，或把刚生成的讲义继续讲透。</div>
          </div>
        </div>
      </div>
    </section>
  );

  const classroomResourceWorkspaceButtonsSection = (
    <section
      data-learn-reveal
      className="overflow-hidden ui-radius-28 border border-[#dfe7ef] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_58%,#fff7fa_100%)] p-5 shadow-[0_16px_38px_rgba(15,23,42,0.06)] space-y-4"
    >
      <div className="border-b border-white/75 pb-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/88 px-3 py-1 text-[10px] font-black uppercase ui-tracking-brand text-[#5e6c7b] ring-1 ring-[#e5ebf2]">
          <Sparkles className="h-3.5 w-3.5 ui-text-brand" />
          Agent Runtime
        </div>
        <h3 className="mt-3 font-sans text-xs font-extrabold tracking-wider uppercase ui-text-ink">
          课堂资源工作台
        </h3>
        <p className="mt-1 text-[11px] ui-text-secondary">
          围绕当前章节生成讲义、课件、导图和练习；结果显示在视频下方。
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="course-mini-stat">
            <div className="text-[10px] font-black uppercase ui-tracking-tight ui-text-subtle">Current Step</div>
            <div className="mt-1 text-[12px] font-extrabold ui-text-ink">
              {generatingHandout || generatingMindmap || generatingPractice || generatingPpt ? "智能体正在生成中" : "等待你的触发"}
            </div>
          </div>
          <div className="course-mini-stat">
            <div className="text-[10px] font-black uppercase ui-tracking-tight ui-text-subtle">Current Context</div>
            <div className="mt-1 text-[12px] font-extrabold ui-text-ink">{activeEpisode.title}</div>
          </div>
          <div className="course-mini-stat">
            <div className="text-[10px] font-black uppercase ui-tracking-tight ui-text-subtle">Next Move</div>
            <div className="mt-1 text-[12px] font-extrabold ui-text-ink">下方结果区实时回填</div>
          </div>
        </div>
      </div>

      {(generatingHandout || generatingMindmap || generatingPractice || generatingPpt) ? (
        <div className="course-generated-loading">
          <AILoadingLottie
            caption="课堂资源正在生成"
            subcaption="系统会一边生成一边在下方结果区回填，不需要离开当前课堂。"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={() => void handleGenerateHandout()}
          disabled={generatingHandout || generatingPpt || generatingMindmap || generatingPractice}
          className="course-resource-action course-resource-action--handout"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs">
              <div className="course-resource-icon course-resource-icon--handout">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold ui-text-ink">{generatingHandout ? "正在生成讲义..." : "生成讲义"}</p>
                <p className="text-[10px] ui-text-muted-rose/70">基于当前章节即时整理课堂讲义并直接下载</p>
                <div className="course-resource-progress-track course-resource-progress-track--handout">
                  <div className={`course-resource-progress-bar course-resource-progress-bar--handout ${generatingHandout ? "w-2/3 animate-pulse" : "w-8"}`} />
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 ui-text-muted-rose/50" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => void handleGenerateMindmap()}
          disabled={generatingHandout || generatingPpt || generatingMindmap || generatingPractice}
          className="course-resource-action course-resource-action--mindmap"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs">
              <div className="course-resource-icon course-resource-icon--mindmap">
                <Network className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold ui-text-ink">{generatingMindmap ? "正在生成导图..." : "生成导图"}</p>
                <p className="text-[10px] ui-text-muted-rose/70">快速整理本节知识结构和概念关系</p>
                <div className="course-resource-progress-track course-resource-progress-track--mindmap">
                  <div className={`course-resource-progress-bar course-resource-progress-bar--mindmap ${generatingMindmap ? "w-2/3 animate-pulse" : "w-8"}`} />
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 ui-text-muted-rose/50" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => void handleGeneratePpt()}
          disabled={generatingPpt || generatingHandout || generatingMindmap || generatingPractice}
          className="course-resource-action course-resource-action--ppt"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs">
              <div className="course-resource-icon course-resource-icon--ppt">
                <Presentation className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold ui-text-ink">{generatingPpt ? "正在生成 PPT..." : "生成 PPT"}</p>
                <p className="text-[10px] ui-text-muted-rose/70">按当前课程和播放章节直接导出课件草案</p>
                <div className="course-resource-progress-track course-resource-progress-track--ppt">
                  <div className={`course-resource-progress-bar course-resource-progress-bar--ppt ${generatingPpt ? "w-2/3 animate-pulse" : "w-8"}`} />
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 ui-text-muted-rose/50" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => void handleGeneratePractice()}
          disabled={generatingPpt || generatingHandout || generatingMindmap || generatingPractice}
          className="course-resource-action course-resource-action--practice"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs">
              <div className="course-resource-icon course-resource-icon--practice">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold ui-text-ink">{generatingPractice ? "正在生成练习..." : "生成练习"}</p>
                <p className="text-[10px] ui-text-muted-rose/70">学完即测，快速检查本节掌握情况</p>
                <div className="course-resource-progress-track course-resource-progress-track--practice">
                  <div className={`course-resource-progress-bar course-resource-progress-bar--practice ${generatingPractice ? "w-2/3 animate-pulse" : "w-8"}`} />
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 ui-text-muted-rose/50" />
          </div>
        </button>
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
                <AILoadingLottie
                  caption="生成结果正在回填"
                  subcaption="下方卡片会逐步切换成可下载、可预览、可继续交给 AI 导师的正式结果。"
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
                        Agent Runtime
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
                            交给 AI 导师
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
                              <HorizontalMindmap
                                nodes={artifactMindmapNodes}
                                title="Section Mindmap"
                                subtitle="按当前章节主线、概念分支和复习顺序横向展开。"
                                variant="compact"
                              />
                            </div>
                          ) : artifact.kind === "practice" && practiceQuestions.length ? (
                            <div className="mt-4 ui-radius-28 border border-[#F8DEB1] bg-[linear-gradient(135deg,#fffaf0,#ffffff)] p-4 shadow-[0_18px_34px_rgba(245,158,11,0.08)]">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-[11px] font-black uppercase ui-tracking-tight text-[#d97706]">Practice Preview</div>
                                  <p className="mt-1 text-sm font-black ui-text-ink">随堂练习题卡</p>
                                  <p className="mt-1 text-[11px] leading-5 ui-text-body">先快速做题，再把不会的题继续交给 AI 导师讲透。</p>
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
                            交给 AI 导师
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
                              exportDeckAsPptx(visibleRecentPpt.fileName, visibleRecentPpt.slides);
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
                                  <div className="relative aspect-video bg-[radial-gradient(circle_at_18%_18%,rgba(251,114,153,0.22),transparent_28%),linear-gradient(135deg,#ffffff_0%,#F2F7FF_100%)] p-3">
                                    <div className="absolute left-0 top-0 h-full w-2 bg-[#2563eb]" />
                                    <div className="ml-3 flex h-full flex-col justify-between rounded-xl bg-white/82 p-3 ring-1 ring-white/80">
                                      <div>
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="course-chip-blue">
                                            Slide {slide.index}
                                          </span>
                                          <span className="text-[9px] font-black ui-text-subtle">{slide.typeLabel}</span>
                                        </div>
                                        <h4 className="mt-2 line-clamp-2 text-[13px] font-black leading-5 ui-text-ink">{slide.title}</h4>
                                        {slide.subtitle ? <p className="mt-1 line-clamp-1 text-[10px] font-semibold ui-text-secondary">{slide.subtitle}</p> : null}
                                      </div>
                                      <div className="space-y-1.5">
                                        {slide.bullets.map((bullet, bulletIndex) => (
                                          <div key={`${cardKey}-slide-${slide.index}-${bulletIndex}`} className="flex items-center gap-1.5">
                                            <span className="h-1.5 w-1.5 shrink-0 rounded-full ui-bg-brand" />
                                            <span className="line-clamp-1 text-[9.5px] font-semibold ui-text-body">{bullet}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
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
                  <div className="w-full max-w-5xl overflow-hidden ui-radius-28 border border-white/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
                    <div className="flex items-center justify-between gap-4 border-b ui-border-soft px-5 py-4">
                      <div className="min-w-0">
                        <div className="text-[11px] font-black uppercase ui-tracking-tight ui-text-navy">PPT Viewer</div>
                        <h3 className="mt-1 truncate text-sm font-black ui-text-ink">{pptViewer.title}</h3>
                        <p className="mt-1 truncate text-[10px] ui-text-secondary">{pptViewer.fileName}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPptViewer(null)}
                        className="shrink-0 rounded-full ui-bg-panel px-3 py-1.5 text-[10px] font-black ui-text-body hover:bg-[#EEF2F6]"
                      >
                        关闭
                      </button>
                    </div>

                    <div className="grid lg:grid-cols-[1.25fr_0.75fr]">
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

                        <div className="overflow-hidden ui-radius-28 border border-[#DCE7F7] bg-white shadow-[0_24px_48px_rgba(37,99,235,0.08)]">
                          <div className="relative aspect-[16/9] bg-[radial-gradient(circle_at_18%_18%,rgba(251,114,153,0.18),transparent_28%),linear-gradient(135deg,#FFFFFF_0%,#F2F7FF_100%)] p-6">
                            <div className="absolute left-0 top-0 h-full w-3 ui-bg-brand" />
                            <div className="ml-4 flex h-full flex-col justify-between ui-radius-22 bg-white/90 p-6 ring-1 ring-white/80">
                              <div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="rounded-full bg-[#FFF1F5] px-3 py-1 text-[10px] font-black ui-text-brand">
                                    {activePptSlide.kind === "cover" ? "封面" : activePptSlide.kind === "agenda" ? "目录" : activePptSlide.kind === "ending" ? "结束页" : "内容页"}
                                  </span>
                                  <span className="text-[10px] font-black ui-text-subtle">播放中</span>
                                </div>
                                <h2 className="mt-4 text-2xl font-black leading-tight ui-text-ink">{activePptSlide.title}</h2>
                                {activePptSlide.subtitle ? <p className="mt-3 text-sm font-semibold leading-6 ui-text-secondary">{activePptSlide.subtitle}</p> : null}
                              </div>

                              <div className="space-y-3">
                                {activePptSlide.bullets.slice(0, 4).map((bullet, index) => (
                                  <div key={`${pptViewer.slideIndex}-${index}`} className="flex items-start gap-3">
                                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ui-bg-dark text-[10px] font-black text-white">
                                      {index + 1}
                                    </span>
                                    <p className="text-[13px] leading-6 ui-text-ink">{bullet}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border-t ui-border-soft bg-[#FCFDFE] p-5 lg:border-l lg:border-t-0">
                        <div className="text-[11px] font-black uppercase ui-tracking-tight ui-text-navy">Slides</div>
                        <p className="mt-1 text-sm font-black ui-text-ink">点击切换播放</p>
                        <div className="mt-4 max-h-[460px] space-y-3 overflow-auto pr-1">
                          {buildPptPreviewCards(pptViewer.slides).map((slide) => (
                            <button
                              key={`viewer-${slide.index}`}
                              type="button"
                              onClick={() => setPptViewer((current) => (current ? { ...current, slideIndex: slide.index - 1 } : current))}
                              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                                pptViewer.slideIndex + 1 === slide.index
                                  ? "border-[#fb7299] bg-[#FFF7FA] shadow-[0_12px_24px_rgba(251,114,153,0.14)]"
                                  : "border-[#E8EDF5] bg-white hover:border-[#D6E4FF]"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ui-bg-dark text-[10px] font-black text-white">
                                  {slide.index}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[9px] font-black ui-text-navy">{slide.typeLabel}</span>
                                    <span className="text-[9px] font-black ui-text-subtle">播放</span>
                                  </div>
                                  <p className="mt-2 text-sm font-black ui-text-ink">{slide.title}</p>
                                  {slide.subtitle ? <p className="mt-1 text-[11px] leading-5 ui-text-secondary">{slide.subtitle}</p> : null}
                                </div>
                              </div>
                            </button>
                          ))}
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
    setCurrentPlaybackTime(0);
    setVideoFrameReady(false);
    setShowVideoLoadingOverlay(true);
    const loadingOverlayTimer = window.setTimeout(() => {
      setShowVideoLoadingOverlay(false);
    }, 1200);
    const runtime = readPersistedCourseRuntime(courseId);
    const savedPlayback = Number(localStorage.getItem(playbackStorageKey) || "0");
    const runtimePlayback =
      runtime && runtime.activeEpisodeIdx === activeEpisodeIdx && runtime.currentPlaybackTime > 0
        ? runtime.currentPlaybackTime
        : 0;
    pendingResumeTimeRef.current = shouldAutoplayOnEnter
      ? resumeStartAt
      : runtimePlayback > 0
        ? runtimePlayback
        : savedPlayback > 0
          ? savedPlayback
          : null;
    shouldResumeAutoplayRef.current = shouldAutoplayOnEnter || Boolean(runtime?.wasPlaying);
    shouldResumeMutedRef.current = shouldMuteOnEnter || Boolean(runtime?.wasPlaying);
    if (videoRef.current) {
      videoRef.current.preload = "metadata";
      videoRef.current.load();
    }
    return () => window.clearTimeout(loadingOverlayTimer);
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
    resetDanmakuRuntime();
    void hydratePresetDanmaku();
  }, [activeVideoKey]);

  useEffect(() => {
    void hydrateCourseComments().catch(() => {
      showToast("评论加载失败，请稍后重试");
      setComments(buildFallbackCourseComments());
    });
  }, [courseId, activeEpisodeIdx]);

  useEffect(() => {
    void hydrateLearningFeed();
  }, [activeEpisodeIdx, backendCourseId]);

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
    if (!video) {
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
  }, [activeVideoSrc, sortedDanmakus]);

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

  const handleGenerateHandout = async () => {
    if (generatingHandout || generatingPpt || generatingMindmap || generatingPractice) return;
    setGeneratingHandout(true);
    beginUiProgress(0.14);
    setUiProgress(0.24);
    revealRecentArtifact({
      kind: "handout",
      title: `${course.title} · ${currentSectionTitle} 讲义`,
      summary: "正在整理本节讲义，完成后会自动切换成可下载版本。",
      downloadUrl: "",
      generatedAt: formatGenerationTime(),
      sectionTitle: currentSectionTitle,
      previewContent: buildExpandedHandoutPreviewContent(null, course.title, currentSectionTitle).slice(0, 6),
      loading: true,
    });
    try {
      const result = await Promise.race([
        studentApi.generateResources({
          user_id: activeUserId,
          course_id: backendCourseId,
          knowledge_points: [course.title, currentSectionTitle],
          resource_types: ["lecture_note"],
        }),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("RESOURCE_GENERATE_TIMEOUT")), RESOURCE_GENERATION_TIMEOUT_MS),
        ),
      ]);
      setUiProgress(0.56);
      const hydratedResources = await loadGeneratedResourceCards(result.resources || []);
      const firstResourceId = Number(hydratedResources?.[0]?.resource_id);
      const primaryResource = hydratedResources?.[0];
      if (Number.isFinite(firstResourceId)) {
        const download = await studentApi.getResourceDownloadUrl(firstResourceId, activeUserId, "docx");
        const workspaceUrl = buildWorkspaceResourceLink(courseId, currentSectionTitle, "handout", `${course.title} · ${currentSectionTitle} 讲义`);
        const nextArtifact: RecentResourceArtifact = {
          kind: "handout",
          resourceId: primaryResource?.resource_id ? Number(primaryResource.resource_id) : null,
          preferredFormat: "docx",
          title: `${course.title} · ${currentSectionTitle} 讲义`,
          summary: buildResourceSummary(primaryResource, "已整理出本节讲义，适合课后快速复习。"),
          downloadUrl: download.download_url || workspaceUrl,
          generatedAt: formatGenerationTime(),
          sectionTitle: currentSectionTitle,
          previewContent: buildExpandedHandoutPreviewContent(primaryResource, course.title, currentSectionTitle),
          rawContent: primaryResource?.content_markdown || "",
        };
        revealRecentArtifact(nextArtifact);
        expandRecentCard("artifact-handout");
        setUiProgress(0.92);
        showToast("讲义已生成，结果已显示在视频下方，可直接下载或交给 AI 导师继续展开");
      } else {
        showToast("讲义已生成，但暂时没有拿到下载链接");
      }
    } catch {
      const fallbackResource = buildLocalGeneratedResource("lecture_note", course.title, currentSectionTitle);
      revealRecentArtifact({
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
      });
      expandRecentCard("artifact-handout");
      showToast("讲义已先用课堂内版本生成，结果已显示在视频下方，可继续下载或交给 AI 导师");
    } finally {
      finishUiProgress();
      setGeneratingHandout(false);
    }
  };

  const handleGenerateMindmap = async () => {
    if (generatingHandout || generatingPpt || generatingMindmap || generatingPractice) return;
    setGeneratingMindmap(true);
    beginUiProgress(0.14);
    setUiProgress(0.26);
    revealRecentArtifact({
      kind: "mindmap",
      title: `${course.title} · ${currentSectionTitle} 导图`,
      summary: "正在生成本节知识结构导图，完成后会自动切换成结构化导图。",
      downloadUrl: "",
      generatedAt: formatGenerationTime(),
      sectionTitle: currentSectionTitle,
      previewContent: ["正在提炼核心概念", "正在梳理知识分支关系", "完成后可下载导图结构"],
      loading: true,
    });
    try {
      const result = await Promise.race([
        studentApi.generateResources({
          user_id: activeUserId,
          course_id: backendCourseId,
          knowledge_points: [course.title, currentSectionTitle],
          resource_types: ["mindmap"],
        }),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("RESOURCE_GENERATE_TIMEOUT")), RESOURCE_GENERATION_TIMEOUT_MS),
        ),
      ]);
      setUiProgress(0.58);
      const hydratedResources = await loadGeneratedResourceCards(result.resources || []);
      const firstResourceId = Number(hydratedResources?.[0]?.resource_id);
      const primaryResource = hydratedResources?.[0];
      if (Number.isFinite(firstResourceId)) {
        const download = await studentApi.getResourceDownloadUrl(firstResourceId, activeUserId, "markdown");
        const workspaceUrl = buildWorkspaceResourceLink(courseId, currentSectionTitle, "mindmap", `${course.title} · ${currentSectionTitle} 导图`);
        const mindmapNodes = extractMindmapNodes(primaryResource, course.title, currentSectionTitle);
        const nextArtifact: RecentResourceArtifact = {
          kind: "mindmap",
          resourceId: primaryResource?.resource_id ? Number(primaryResource.resource_id) : null,
          preferredFormat: "xmind",
          title: `${course.title} · ${currentSectionTitle} 导图`,
          summary: buildResourceSummary(primaryResource, "已提炼出本节知识结构，适合先总览再精读。"),
          downloadUrl: download.download_url || workspaceUrl,
          generatedAt: formatGenerationTime(),
          sectionTitle: currentSectionTitle,
          previewContent: buildResourcePreviewContent(primaryResource, ["已提炼出本节知识结构，适合先总览再精读。"]),
          rawContent: primaryResource?.content_markdown || "",
          mindmapNodes,
        };
        revealRecentArtifact(nextArtifact);
        expandRecentCard("artifact-mindmap");
        setUiProgress(0.92);
        showToast("导图已生成，结果已显示在视频下方，可直接下载或交给 AI 导师继续展开");
      } else {
        showToast("导图已生成，但暂时没有拿到下载链接");
      }
    } catch {
      const fallbackResource = buildLocalGeneratedResource("mindmap", course.title, currentSectionTitle);
      revealRecentArtifact({
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
      });
      expandRecentCard("artifact-mindmap");
      showToast("导图已先用课堂内版本生成，结果已显示在视频下方，可继续下载或交给 AI 导师");
    } finally {
      finishUiProgress();
      setGeneratingMindmap(false);
    }
  };

  const handleGeneratePractice = async () => {
    if (generatingHandout || generatingPpt || generatingMindmap || generatingPractice) return;
    setGeneratingPractice(true);
    beginUiProgress(0.14);
    setUiProgress(0.26);
    revealRecentArtifact({
      kind: "practice",
      title: `${course.title} · ${currentSectionTitle} 练习`,
      summary: "正在根据当前章节生成随堂测评，完成后会自动切换成可作答练习。",
      downloadUrl: "",
      generatedAt: formatGenerationTime(),
      sectionTitle: currentSectionTitle,
      previewContent: ["正在生成单选、多选与简答题", "正在整理答案与解析", "完成后可立即提交判分"],
      loading: true,
    });
    try {
      const result = await Promise.race([
        studentApi.generateResources({
          user_id: activeUserId,
          course_id: backendCourseId,
          knowledge_points: [course.title, currentSectionTitle],
          resource_types: ["practice_set"],
        }),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("RESOURCE_GENERATE_TIMEOUT")), RESOURCE_GENERATION_TIMEOUT_MS),
        ),
      ]);
      setUiProgress(0.58);
      const hydratedResources = await loadGeneratedResourceCards(result.resources || []);
      const firstResourceId = Number(hydratedResources?.[0]?.resource_id);
      const primaryResource = hydratedResources?.[0];
      if (Number.isFinite(firstResourceId)) {
        const download = await studentApi.getResourceDownloadUrl(firstResourceId, activeUserId, "markdown");
        const workspaceUrl = buildWorkspaceResourceLink(courseId, currentSectionTitle, "practice", `${course.title} · ${currentSectionTitle} 练习`);
        const practiceQuestions = extractPracticeQuestions(primaryResource, course.title, currentSectionTitle);
        const nextArtifact: RecentResourceArtifact = {
          kind: "practice",
          resourceId: primaryResource?.resource_id ? Number(primaryResource.resource_id) : null,
          preferredFormat: "docx",
          title: `${course.title} · ${currentSectionTitle} 练习`,
          summary: buildResourceSummary(primaryResource, "已生成针对本节知识点的随堂练习。"),
          downloadUrl: download.download_url || workspaceUrl,
          generatedAt: formatGenerationTime(),
          sectionTitle: currentSectionTitle,
          previewContent: buildResourcePreviewContent(primaryResource, ["已生成针对本节知识点的随堂练习。"]),
          rawContent: primaryResource?.content_markdown || "",
          practiceQuestions,
        };
        revealRecentArtifact(nextArtifact);
        expandRecentCard("artifact-practice");
        setUiProgress(0.92);
        showToast("练习已生成，结果已显示在视频下方，可直接作答、下载或交给 AI 导师继续讲解");
      } else {
        showToast("练习已生成，但暂时没有拿到下载链接");
      }
    } catch {
      const fallbackResource = buildLocalGeneratedResource("practice_set", course.title, currentSectionTitle);
      revealRecentArtifact({
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
      });
      expandRecentCard("artifact-practice");
      showToast("练习已先用课堂内版本生成，结果已显示在视频下方，可继续作答、下载或交给 AI 导师");
    } finally {
      finishUiProgress();
      setGeneratingPractice(false);
    }
  };

  const handleGeneratePpt = async () => {
    if (generatingPpt || generatingHandout || generatingMindmap || generatingPractice) return;
    setGeneratingPpt(true);
    beginUiProgress(0.14);
    setUiProgress(0.24);
    revealRecentPpt({
      resourceId: null,
      fileName: `${course.title.replace(/[\\/:*?\"<>|]+/g, "-")}-${currentSectionTitle.replace(/[\\/:*?\"<>|]+/g, "-")}.pptx`,
      slideCount: 0,
      generatedAt: formatGenerationTime(),
      slides: [],
      summary: "正在按当前章节整理课件草案，完成后会自动切换成可导出的分页课件。",
      sectionTitle: currentSectionTitle,
      downloadUrl: "",
      preferredFormat: "pptx",
      previewContent: ["正在生成封面与章节目标", "正在整理核心知识分页", "完成后可直接导出 PPT 文件"],
      loading: true,
    });
    try {
      const result = await Promise.race([
        studentApi.generateResources({
          user_id: activeUserId,
          course_id: backendCourseId,
          knowledge_points: [course.title, currentSectionTitle],
          resource_types: ["course_overview", "teaching_plan", "lecture_note"],
        }),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("RESOURCE_GENERATE_TIMEOUT")), RESOURCE_GENERATION_TIMEOUT_MS),
        ),
      ]);
      setUiProgress(0.62);
      const hydratedResources = await loadGeneratedResourceCards(result.resources || []);
      const teachingPlanResource =
        hydratedResources.find((item) => item.resource_type === "teaching_plan") || hydratedResources[0] || null;
      const fileName = `${course.title.replace(/[\\/:*?"<>|]+/g, "-")}-${currentSectionTitle.replace(/[\\/:*?"<>|]+/g, "-")}.pptx`;
      const slides = buildCourseDeckSlides(hydratedResources, course.title, currentSectionTitle);
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
          ? buildSoftwareEngineeringChapterProfile(course.title, currentSectionTitle).pptSummary
          : "已按当前课程与章节整理为封面、目录、内容页和结尾页的课件草案。",
        sectionTitle: currentSectionTitle,
        downloadUrl,
        preferredFormat: "pptx",
        rawContent: teachingPlanResource?.content_markdown || "",
      };
      revealRecentPpt(nextPpt);
      expandRecentCard("artifact-ppt");
      setUiProgress(0.92);
      showToast("PPT 草案已生成，结果已显示在视频下方，可直接导出或交给 AI 导师继续展开");
    } catch {
      const fallbackSlides = buildCourseDeckSlides(
        [buildLocalGeneratedResource("lecture_note", course.title, currentSectionTitle)],
        course.title,
        currentSectionTitle,
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
      };
      revealRecentPpt(fallbackPpt);
      expandRecentCard("artifact-ppt");
      showToast("PPT 草案已先用课堂内版本生成，结果已显示在视频下方，可继续导出或交给 AI 导师");
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
    if (!videoRef.current) {
      return;
    }

    if (!videoRef.current.paused) {
      videoRef.current.pause();
      setVideoPlaying(false);
      return;
    }

    try {
      await videoRef.current.play();
      setVideoPlaying(true);
    } catch {
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
  const resolvedMeta = courseMetaResolved[courseId] ?? {
    category: "通用研学航道",
    title: course.title,
    uploader: course.uploader,
    summary: "围绕核心知识点、典型案例与实操节奏展开讲解，适合边看边记，快速形成完整理解。",
  };

  return (
    <div ref={learnWorkspaceRef} className="space-y-6" id="course-learning-classroom">
      
      {/* Dynamic Header Path Indicator */}
      <div className="flex items-center justify-between text-xs ui-text-muted-rose">
        <div className="flex items-center gap-1.5 font-mono">
          <Link to="/" className="hover:ui-text-brand">首页</Link>
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
          
          {/* Lecture Player with Custom Bullet Comments Layer */}
          <div className="rounded-t-3xl bg-black overflow-hidden relative aspect-video shadow-lg border-t border-x ui-border-app group">
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

            <video
              id="classroom-video-tag"
              ref={videoRef}
              key={activeEpisodeIdx} // Remounts to reset play status if switched
              controls
              autoPlay={false}
              preload="metadata"
              className="relative z-0 w-full h-full object-cover"
              onLoadedMetadata={(event) => {
                const duration = Number(event.currentTarget.duration || 0);
                setVideoDuration(Number.isFinite(duration) ? duration : 0);
              }}
              onLoadedData={() => {
                setVideoFrameReady(true);
                setShowVideoLoadingOverlay(false);
              }}
              onCanPlay={() => {
                setVideoFrameReady(true);
                setShowVideoLoadingOverlay(false);
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
          <div className="mb-6 -mt-0.5 flex flex-col gap-3 rounded-b-[28px] border-x border-b ui-border-app/15 bg-[#171c22] px-4 py-3 shadow-[0_14px_30px_rgba(15,23,42,0.18)] sm:flex-row sm:items-center">
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
                右侧 AI 导师已联动
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

      {classroomGeneratedResultsSection}

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
