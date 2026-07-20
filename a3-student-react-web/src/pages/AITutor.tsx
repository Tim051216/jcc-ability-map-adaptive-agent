import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import {
  AlertCircle,
  Bot,
  Camera,
  ChevronDown,
  ChevronUp,
  Copy,
  Heart,
  FileText,
  LoaderCircle,
  MessageCircleMore,
  PanelTop,
  Trash2,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  studentApi,
  type TutoringAnswerDetail,
  type TutoringHistoryItem,
  type TutoringReferenceSource,
  type TutoringVideoRecommendation,
  type WebSearchResultItem,
} from "../lib/studentApi";
import { resolveBackendCourseId } from "../lib/courseRouting";
import { getDemoUserExperienceConfig, getDemoUserProfile } from "../lib/userProfiles";
import MarkdownRenderer from "../components/MarkdownRenderer";
import AILoadingLottie from "../components/AILoadingLottie";
import { beginUiProgress, finishUiProgress, setUiProgress } from "../lib/uiProgress";

type TutorAttachment = {
  id: string;
  name: string;
  assetUrl: string;
  previewUrl?: string;
  mimeType?: string;
  extractedText?: string;
  source: "upload" | "screenshot";
  uploadStatus?: "uploading" | "uploaded" | "local";
};

type TutorMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  createdAt: string;
  attachments?: TutorAttachment[];
  evidenceAttachments?: string[];
  videos?: TutoringVideoRecommendation[];
  status?: "pending" | "completed" | "error";
  localFallback?: boolean;
  responseSource?: "ai" | "fallback" | "cache" | string;
  fallbackReason?: string | null;
  safetyReview?: Record<string, unknown> | null;
  hallucinationReview?: Record<string, unknown> | null;
  referenceSources?: TutoringReferenceSource[] | null;
  knowledgePoints?: string[] | null;
  confidenceScore?: number | null;
  questionType?: string | null;
};

type CaptureMode = "full" | "selection";

type CaptureRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  screenX?: number;
  screenY?: number;
};

interface AITutorProps {
  user?: {
    id: string;
    name: string;
    avatar: string;
    loggedIn: boolean;
  };
  embedded?: boolean;
  initialCourseId?: string;
  initialSectionId?: string;
  initialQuery?: string;
  initialMode?: "default" | "learning" | "handout" | "mindmap" | "practice" | "ppt" | "open-classroom";
  initialTitle?: string;
  initialSubtitle?: string;
  initialVideoSrc?: string;
  initialVideoResourceId?: number;
  initialVideoFileId?: number;
  initialVideoFileName?: string;
  initialResourceId?: number;
  initialResourceTitle?: string;
  initialResourceType?: string;
  initialResourceSummary?: string;
  initialQuickPrompts?: string[];
  initialStartAt?: number;
  initialAutoplay?: boolean;
  initialMuted?: boolean;
  onClose?: () => void;
  resetToken?: number;
}

type TutorResourceContext = {
  id?: number;
  title?: string;
  type?: string;
  summary?: string;
};

type TutorTaskMode = NonNullable<AITutorProps["initialMode"]>;

const TUTOR_SESSION_STORAGE_KEY = "a3-active-tutor-session-map";
const TUTOR_SESSION_TITLE_STORAGE_KEY = "a3-tutor-session-title-map";
const TUTOR_FAVORITE_HISTORY_STORAGE_KEY = "a3-tutor-favorite-history-cache";
const TUTOR_DRAFT_STORAGE_KEY = "a3-active-tutor-draft-map";
const TUTOR_HISTORY_CACHE_STORAGE_KEY = "a3-tutor-history-cache";
const TUTOR_MEMORY_STORAGE_KEY = "a3-tutor-resolved-memory";
const TUTOR_MEMORY_LIMIT = 8;

const DEFAULT_PROMPTS = [
  "帮我总结这节内容的重点",
  "把这个知识点讲得更简单一点",
  "给我出 3 道练习题并讲解",
];

function buildModePromptSuggestions(mode: TutorTaskMode, basePrompts: string[] = DEFAULT_PROMPTS) {
  if (mode === "handout") return ["直接生成讲义", "提炼复习重点", "补充易混淆点"];
  if (mode === "mindmap") return ["直接输出导图", "讲节点关系", "给我复习顺序"];
  if (mode === "practice") return ["直接出 5 道题", "给答案和思路", "指出易错题型"];
  if (mode === "ppt") return ["直接整理 PPT", "按页展开内容", "压缩成汇报版"];
  if (mode === "open-classroom") return ["直接演示课堂", "切到 AI 助教追问", "生成随堂测验"];
  if (mode === "learning") return ["总结这段视频", "知识点时间轴", "这段在讲什么"];
  return basePrompts;
}

function buildModeInstruction(mode: TutorTaskMode) {
  if (mode === "handout") return "任务要求：不要推荐视频、课程或外部资料，直接产出讲义内容。";
  if (mode === "mindmap") return "任务要求：不要推荐视频、课程或外部资料，直接产出导图结构。";
  if (mode === "practice") return "任务要求：不要推荐视频、课程或外部资料，直接产出练习、答案和思路。";
  if (mode === "ppt") return "任务要求：不要推荐视频、课程或外部资料，直接产出逐页 PPT 草案。";
  if (mode === "open-classroom") return "任务要求：直接按 AI 教师、AI 助教、AI 测评器三种角色展开互动课堂，不先做外部资料推荐。";
  if (mode === "learning") return "场景：当前处于学习模式。";
  return "";
}

function buildModeIntro(mode: TutorTaskMode | undefined, title?: string) {
  if (mode === "handout") return `我会直接围绕「${title || "当前课程"}」帮你生成讲义，不先做资料推荐。`;
  if (mode === "mindmap") return `我会直接围绕「${title || "当前课程"}」帮你整理导图，不先做资料推荐。`;
  if (mode === "practice") return `我会直接围绕「${title || "当前课程"}」帮你生成练习，不先做资料推荐。`;
  if (mode === "ppt") return `我会直接围绕「${title || "当前课程"}」帮你整理 PPT 草案，不先做资料推荐。`;
  if (mode === "open-classroom") return `我会直接围绕「${title || "当前课程"}」接管互动课堂演示，按 AI 教师、AI 助教、AI 测评器三种角色展开。`;
  return "";
}

function buildModeSubtitle(mode: TutorTaskMode | undefined) {
  if (mode === "handout") return "当前已切到讲义模式，会优先直接产出讲义内容。";
  if (mode === "mindmap") return "当前已切到导图模式，会优先直接产出结构导图。";
  if (mode === "practice") return "当前已切到练习模式，会优先直接产出题目和解析。";
  if (mode === "ppt") return "当前已切到 PPT 模式，会优先直接产出逐页课件草案。";
  if (mode === "open-classroom") return "当前已切到互动课堂模式，会优先展开教师主讲、助教追问和随堂测验。";
  return "结合课程上下文进行问答";
}

function formatTime(value?: string | number | Date) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function formatHistoryTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveCourseId(courseId?: string) {
  if (!courseId) return undefined;
  const numericId = Number(courseId);
  if (Number.isFinite(numericId)) return numericId;
  return resolveBackendCourseId(courseId);
}

function buildHistoryMessages(
  item: TutoringHistoryItem,
): TutorMessage[] {
  const messages: TutorMessage[] = [];
  messages.push({
    id: `history-question-${item.question.id}`,
    role: "user",
    text: item.question.question_text || "这次提问没有文本内容。",
    createdAt: formatHistoryTime(item.question.create_time) || formatTime(),
    status: "completed",
  });
  if (item.answer?.answer_text) {
    messages.push({
      id: `history-answer-${item.answer.id}`,
      role: "assistant",
      text: item.answer.answer_text,
      createdAt: formatHistoryTime(item.answer.create_time) || formatTime(),
      videos: item.answer.answer_videos || undefined,
      status: "completed",
      referenceSources: item.answer.reference_sources || null,
      knowledgePoints: item.answer.knowledge_points || null,
      confidenceScore: item.answer.confidence_score || null,
      questionType: item.answer.question_type || null,
    });
  }
  return messages;
}

function isSameCalendarDay(dateA: Date, dateB: Date) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function groupHistoryItems(items: TutoringHistoryItem[]) {
  const now = new Date();
  const todayFavorites: TutoringHistoryItem[] = [];
  const todayOthers: TutoringHistoryItem[] = [];
  const earlierFavorites: TutoringHistoryItem[] = [];
  const earlierOthers: TutoringHistoryItem[] = [];

  items.forEach((item) => {
    const createdAt = new Date(item.question.create_time);
    const isToday = !Number.isNaN(createdAt.getTime()) && isSameCalendarDay(createdAt, now);
    const isFavorited = Boolean(item.is_favorited);
    if (isToday && isFavorited) {
      todayFavorites.push(item);
    } else if (isToday) {
      todayOthers.push(item);
    } else if (isFavorited) {
      earlierFavorites.push(item);
    } else {
      earlierOthers.push(item);
    }
  });

  return [
    { label: "今日收藏", items: todayFavorites },
    { label: "今日其他", items: todayOthers },
    { label: "更早收藏", items: earlierFavorites },
    { label: "更早其他", items: earlierOthers },
  ].filter((group) => group.items.length > 0);
}

function buildSessionPreview(item: TutoringHistoryItem) {
  const raw = (item.answer?.answer_text || item.question.question_text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "打开后继续围绕这次提问追问。";
  return raw.length > 54 ? `${raw.slice(0, 54)}...` : raw;
}

function formatTutorAnswerMarkdown(text?: string | null) {
  const raw = String(text || "").trim();
  if (!raw) return "导师暂时还没有返回可展示的回答。";
  return raw;
}

function buildAnswerText(answer: TutoringAnswerDetail) {
  return formatTutorAnswerMarkdown(answer.answer_text);
}

function isTransientTutorFetchError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /failed to fetch|networkerror|load failed|request timeout/i.test(error.message);
}

function buildTutorErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/^HTTP\s*5\d\d\b/i.test(message)) {
    return "AI 导师服务暂时不可用，请稍后重试。";
  }
  if (/request timeout|响应超时|timeout/i.test(message)) {
    return "这次生成时间超过预期，我已保留问题。请稍后在最近会话里查看结果，或重新发送一次。";
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "AI 导师连接暂时不稳定，请稍后重试。";
  }
  return message || "提问失败，请稍后重试。";
}

function extractBlockedFromReview(review?: Record<string, unknown> | null) {
  if (!review || typeof review !== "object") return false;
  const inputReview = review.input_review;
  const outputReview = review.output_review;
  const inputBlocked = Boolean(inputReview && typeof inputReview === "object" && "blocked" in inputReview && inputReview.blocked);
  const outputBlocked = Boolean(
    outputReview && typeof outputReview === "object" && "blocked" in outputReview && outputReview.blocked,
  );
  return inputBlocked || outputBlocked;
}

function extractReviewSummary(review?: Record<string, unknown> | null) {
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

function extractUngroundedReview(review?: Record<string, unknown> | null) {
  if (!review || typeof review !== "object") return false;
  return review.grounded === false;
}

function extractUngroundedSummary(review?: Record<string, unknown> | null) {
  if (!review || typeof review !== "object") return "";
  return typeof review.summary === "string" ? review.summary : "";
}

function formatVideoDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function normalizeKnowledgePoints(answer?: TutoringAnswerDetail | null) {
  const merged = [
    ...(answer?.knowledge_points || []),
    ...(answer?.question_analysis?.knowledge_points || []),
    ...(answer?.reference_sources || []).flatMap((source) => source.knowledge_points || source.tags || []),
  ];
  return Array.from(new Set(merged.map((item) => String(item || "").trim()).filter(Boolean))).slice(0, 8);
}

function getReferenceTitle(source: TutoringReferenceSource, index: number) {
  return (
    source.title ||
    source.document_title ||
    source.file_name ||
    (typeof source.metadata?.title === "string" ? source.metadata.title : "") ||
    (typeof source.metadata?.source === "string" ? source.metadata.source : "") ||
    `知识库片段 ${index + 1}`
  );
}

function getReferenceSourceLabel(source: TutoringReferenceSource) {
  return (
    source.source ||
    source.source_type ||
    (typeof source.metadata?.source_type === "string" ? source.metadata.source_type : "") ||
    (typeof source.metadata?.collection === "string" ? source.metadata.collection : "") ||
    "本地知识库"
  );
}

function getReferenceSnippet(source: TutoringReferenceSource) {
  const raw = source.snippet || source.summary || source.content || "";
  return raw.replace(/\s+/g, " ").trim();
}

function getReferenceScore(source: TutoringReferenceSource) {
  const score = typeof source.relevance_score === "number" ? source.relevance_score : source.score;
  if (typeof score !== "number" || !Number.isFinite(score)) return "";
  const normalized = score <= 1 ? Math.round(score * 100) : Math.round(score);
  return `${Math.max(0, Math.min(100, normalized))}%`;
}

function KnowledgeEvidencePanel({
  sources,
  knowledgePoints,
  confidenceScore,
  questionType,
}: {
  sources?: TutoringReferenceSource[] | null;
  knowledgePoints?: string[] | null;
  confidenceScore?: number | null;
  questionType?: string | null;
}) {
  const visibleSources = (sources || []).filter(Boolean).slice(0, 4);
  const visibleKnowledgePoints = Array.from(new Set((knowledgePoints || []).map((item) => item.trim()).filter(Boolean))).slice(0, 8);
  const confidenceLabel =
    typeof confidenceScore === "number" && Number.isFinite(confidenceScore)
      ? `${Math.round(Math.max(0, Math.min(1, confidenceScore)) * 100)}%`
      : "";

  if (!visibleSources.length && !visibleKnowledgePoints.length && !confidenceLabel && !questionType) {
    return null;
  }

  return (
    <section className="mt-4 overflow-hidden rounded-[18px] border border-[#D7E2F2] bg-[#FFFFFF] text-[#172033] shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <div className="grid grid-cols-[6px_1fr] border-b border-[#E6EDF5]">
        <div className="bg-[#002FA7]" />
        <div className="px-3.5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#002FA7]">RAG Evidence</div>
              <div className="mt-1 text-[13px] font-black text-[#111827]">知识库来源与命中依据</div>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-bold text-[#475467]">
              {questionType ? <span className="rounded-full border border-[#D7E2F2] px-2.5 py-1">类型：{questionType}</span> : null}
              {confidenceLabel ? <span className="rounded-full border border-[#D7E2F2] px-2.5 py-1">置信度：{confidenceLabel}</span> : null}
              <span className="rounded-full border border-[#D7E2F2] px-2.5 py-1">来源：{visibleSources.length || 0}</span>
            </div>
          </div>
          {visibleKnowledgePoints.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {visibleKnowledgePoints.map((point) => (
                <span key={point} className="rounded-full bg-[#EEF3FF] px-2.5 py-1 text-[10px] font-bold text-[#002FA7]">
                  {point}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {visibleSources.length ? (
        <div className="divide-y divide-[#EEF2F6]">
          {visibleSources.map((source, index) => {
            const title = getReferenceTitle(source, index);
            const label = getReferenceSourceLabel(source);
            const snippet = getReferenceSnippet(source);
            const score = getReferenceScore(source);
            return (
              <article key={`${title}-${index}`} className="grid gap-2 px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-black leading-5 text-[#111827]">{title}</div>
                    <div className="mt-0.5 text-[10px] font-bold text-[#667085]">{label}</div>
                  </div>
                  {score ? (
                    <span className="shrink-0 rounded-full bg-[#F5F8FF] px-2.5 py-1 text-[10px] font-black text-[#002FA7]">
                      匹配 {score}
                    </span>
                  ) : null}
                </div>
                {snippet ? <p className="line-clamp-3 text-[11px] leading-5 text-[#475467]">{snippet}</p> : null}
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-[#002FA7] underline-offset-2 hover:underline">
                    打开来源
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="px-3.5 py-3 text-[11px] leading-5 text-[#667085]">
          本次回答没有返回可引用的知识库片段；如果需要可追问“请只基于本地知识库回答并列出来源”。
        </div>
      )}
    </section>
  );
}

async function waitForTutoringTaskResult(taskId: string | number, maxAttempts = 30, intervalMs = 1200) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const status = await studentApi.getTutoringTaskStatus(taskId);
    if (status.status === "completed" && status.result) {
      return status.result;
    }
    if (status.status === "failed") {
      throw new Error(status.error_message || "AI 导师生成失败，请稍后重试。");
    }
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }
  throw new Error("AI 导师响应超时，请稍后重试。");
}

function extractStreamingTextChunk(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  const chunkType = typeof record.chunk_type === "string" ? record.chunk_type : "";
  if (chunkType && chunkType !== "text_delta") {
    return "";
  }
  const candidates = [record.content, record.delta, record.text, record.chunk, record.token, record.message];
  for (const item of candidates) {
    if (typeof item === "string" && item) return item;
  }
  return "";
}

function extractStreamingFinalText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  const chunkType = typeof record.chunk_type === "string" ? record.chunk_type.toLowerCase() : "";
  if (!["complete", "saved"].includes(chunkType)) {
    return "";
  }

  const content = record.content;
  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }
  if (content && typeof content === "object") {
    const answerText = (content as Record<string, unknown>).answer_text;
    if (typeof answerText === "string" && answerText.trim()) {
      return answerText.trim();
    }
  }
  return "";
}

function extractStreamingFinalAnswer(payload: unknown): TutoringAnswerDetail | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const chunkType = typeof record.chunk_type === "string" ? record.chunk_type.toLowerCase() : "";
  if (!["complete", "saved"].includes(chunkType)) {
    return null;
  }
  const content = record.content;
  if (!content || typeof content !== "object") {
    return null;
  }
  const answerText = (content as Record<string, unknown>).answer_text;
  if (typeof answerText !== "string" || !answerText.trim()) {
    return null;
  }
  return content as unknown as TutoringAnswerDetail;
}

function splitStreamingChunk(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!normalized) return [];
  const pieces: string[] = [];
  let buffer = "";
  for (const char of normalized) {
    buffer += char;
    if (char === "\n" || "，。！？；：,.!?;:".includes(char) || buffer.length >= 6) {
      pieces.push(buffer);
      buffer = "";
    }
  }
  if (buffer) {
    pieces.push(buffer);
  }
  return pieces;
}

function isStreamingTerminalEvent(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  const chunkType = typeof record.chunk_type === "string" ? record.chunk_type : "";
  const status = typeof record.status === "string" ? record.status : typeof record.state === "string" ? record.state : "";
  const eventName = typeof record.event === "string" ? record.event : typeof record.type === "string" ? record.type : "";
  return ["saved", "done", "finished", "error"].includes(chunkType.toLowerCase()) ||
    ["completed", "complete", "done", "finished", "error"].includes(status.toLowerCase()) ||
    ["completed", "complete", "done", "finished", "error"].includes(eventName.toLowerCase());
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hasUnsupportedColorFunction(value: string) {
  return value.includes("oklab(") || value.includes("oklch(");
}

function triggerCaptureButton(
  event: Pick<PointerEvent | MouseEvent, "preventDefault" | "stopPropagation"> | null,
  callback: () => void,
) {
  event?.preventDefault();
  event?.stopPropagation();
  callback();
}

function sanitizeClonedCaptureDocument(clonedDocument: Document) {
  clonedDocument
    .querySelectorAll("[data-capture-overlay='true'], [data-capture-controls='true']")
    .forEach((node) => node.remove());

  const styleOverride = clonedDocument.createElement("style");
  styleOverride.setAttribute("data-capture-sanitize", "true");
  styleOverride.textContent = `
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
    }
  `;
  clonedDocument.head.appendChild(styleOverride);

  const clonedElements = Array.from(clonedDocument.querySelectorAll<HTMLElement>("*"));
  const targetProperties = [
    "background",
    "background-color",
    "background-image",
    "color",
    "border-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "outline-color",
    "text-decoration-color",
    "box-shadow",
    "filter",
    "backdrop-filter",
  ] as const;

  clonedElements.forEach((node) => {
    const inlineStyle = node.getAttribute("style");
    if (inlineStyle && hasUnsupportedColorFunction(inlineStyle.toLowerCase())) {
      const sanitizedStyle = inlineStyle
        .split(";")
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .filter((declaration) => !hasUnsupportedColorFunction(declaration.toLowerCase()))
        .join("; ");
      if (sanitizedStyle) {
        node.setAttribute("style", sanitizedStyle);
      } else {
        node.removeAttribute("style");
      }
    }

    const computedStyle = window.getComputedStyle(node);
    targetProperties.forEach((propertyName) => {
      const propertyValue = computedStyle.getPropertyValue(propertyName);
      if (!propertyValue || !hasUnsupportedColorFunction(propertyValue.toLowerCase())) return;
      if (
        propertyName === "background" ||
        propertyName === "background-image" ||
        propertyName === "box-shadow" ||
        propertyName === "filter" ||
        propertyName === "backdrop-filter"
      ) {
        node.style.setProperty(propertyName, "none");
      } else if (propertyName === "color" || propertyName === "text-decoration-color") {
        node.style.setProperty(propertyName, "#0f172a");
      } else {
        node.style.setProperty(propertyName, "#e2e8f0");
      }
    });
  });
}

function buildAttachmentPrompt(text: string) {
  return `请结合附件《提取正文》讲解：\n${text}`;
}

function buildAttachmentExtractedSummary(attachments: TutorAttachment[]) {
  return attachments
    .map((item) => {
      const extracted = (item.extractedText || "").trim();
      if (!extracted) return "";
      return `附件《${item.name}》提取内容：\n${extracted}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function hasExtractedAttachment(attachments?: TutorAttachment[]) {
  return Boolean(attachments?.some((item) => (item.extractedText || "").trim()));
}

function collectAttachmentExtractedText(attachments: TutorAttachment[]) {
  return attachments
    .map((item) => (item.extractedText || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function looksLikeGenericAttachmentQuestion(text: string) {
  const normalized = text.replace(/\s+/g, "");
  return [
    "这是什么",
    "这个是什么",
    "这是什么东西",
    "这玩意是什么",
    "帮我看看",
    "帮我看看这个",
    "帮我看看这是什么",
    "看看这个",
    "看看这是什么",
  ].includes(normalized);
}

function buildAttachmentQuestion(text: string, attachments: TutorAttachment[]) {
  const cleaned = text.trim();
  const extractedAttachments = attachments.filter((item) => (item.extractedText || "").trim());
  if (!extractedAttachments.length) {
    return cleaned;
  }

  const attachmentNames = extractedAttachments.map((item) => item.name).join("、");
  if (!cleaned || looksLikeGenericAttachmentQuestion(cleaned)) {
    return `请先判断我上传的附件《${attachmentNames}》分别是什么类型的资料，再用中文概括它主要在讲什么、有哪些关键要点。`;
  }
  return cleaned;
}

function buildPendingAssistantText(attachments: TutorAttachment[]) {
  const extractedAttachments = attachments.filter((item) => (item.extractedText || "").trim());
  if (!extractedAttachments.length) {
    return "正在生成回答...";
  }
  const names = extractedAttachments.map((item) => item.name).join("、");
  return `正在识别附件《${names}》的内容并组织回答...`;
}

function buildAttachmentLocalFallback(attachments: TutorAttachment[]) {
  const extractedAttachments = attachments.filter((item) => (item.extractedText || "").trim());
  if (!extractedAttachments.length) {
    return "";
  }

  const first = extractedAttachments[0];
  const lines = String(first.extractedText || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean);
  const subject = lines[0] || first.name;
  const highlights = lines.slice(1, 4).filter((line) => line !== subject);

  const loweredName = first.name.toLowerCase();
  const fileType = loweredName.endsWith(".docx") || loweredName.endsWith(".doc")
    ? "Word 文档"
    : loweredName.endsWith(".xlsx") || loweredName.endsWith(".xls")
      ? "Excel 表格"
      : loweredName.endsWith(".pptx") || loweredName.endsWith(".ppt")
        ? "PPT 课件"
        : loweredName.endsWith(".pdf")
          ? "PDF 资料"
          : "附件资料";

  const parts = [
    `这是一个 ${fileType}《${first.name}》。`,
    `从当前提取到的内容看，它主要在讲：${subject}。`,
  ];
  if (highlights.length) {
    parts.push(`我先读到的几个要点是：${highlights.join("；")}。`);
  }
  parts.push("如果你愿意，我可以继续按“主题、重点、难点”帮你往下拆。");
  return parts.join("\n\n");
}

function looksLikeMisdirectedAttachmentAnswer(text: string, attachments: TutorAttachment[], effectiveQuestionText: string) {
  if (!hasExtractedAttachment(attachments)) {
    return false;
  }
  if (!looksLikeGenericAttachmentQuestion(effectiveQuestionText)) {
    return false;
  }
  const normalized = text.replace(/\s+/g, "");
  return normalized.includes("现在是") || normalized.includes("今天是") || normalized.includes("当前时间");
}

function getPreferredCaptureRect(mode: CaptureMode, fallbackRect?: CaptureRect | null) {
  if (mode === "selection" && fallbackRect) return fallbackRect;

  const primaryColumn = document.getElementById("course-learning-primary-column");
  if (primaryColumn) {
    const box = primaryColumn.getBoundingClientRect();
    const fullHeight = Math.max(
      primaryColumn.scrollHeight,
      primaryColumn.clientHeight,
      Math.round(box.height),
    );
    if (box.width > 40 && fullHeight > 40) {
      return {
        x: clamp(box.left, 0, window.innerWidth),
        y: clamp(box.top, 0, window.innerHeight),
        width: clamp(box.width, 1, window.innerWidth),
        height: Math.max(1, Math.round(fullHeight)),
      };
    }
  }

  return fallbackRect || { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
}

function getSelectionCaptureTarget(rect: CaptureRect) {
  const centerX = clamp(rect.x + rect.width / 2, 0, window.innerWidth - 1);
  const centerY = clamp(rect.y + rect.height / 2, 0, window.innerHeight - 1);
  let node = document.elementFromPoint(centerX, centerY) as HTMLElement | null;
  const viewportArea = Math.max(window.innerWidth * window.innerHeight, 1);
  const selectionLeft = rect.x;
  const selectionTop = rect.y;
  const selectionRight = rect.x + rect.width;
  const selectionBottom = rect.y + rect.height;

  while (node && node !== document.body && node !== document.documentElement) {
    const box = node.getBoundingClientRect();
    const containsSelection =
      box.left <= selectionLeft &&
      box.top <= selectionTop &&
      box.right >= selectionRight &&
      box.bottom >= selectionBottom;
    const area = Math.max(box.width * box.height, 1);
    if (containsSelection && box.width > 8 && box.height > 8 && area <= viewportArea * 2.8) {
      return node;
    }
    node = node.parentElement;
  }

  return document.body;
}

async function waitForVideoReady(video: HTMLVideoElement) {
  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) return;
  await new Promise<void>((resolve, reject) => {
    const handleLoaded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("当前标签页画面读取失败"));
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", handleLoaded);
      video.removeEventListener("error", handleError);
    };
    video.addEventListener("loadeddata", handleLoaded, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
}

async function captureActiveWindowSelection(rect: CaptureRect, fileName: string) {
  const search = new URLSearchParams({
    x: String(Math.max(0, Math.round(rect.x))),
    y: String(Math.max(0, Math.round(rect.y))),
    width: String(Math.max(1, Math.round(rect.width))),
    height: String(Math.max(1, Math.round(rect.height))),
  });
  if (Number.isFinite(rect.screenX)) {
    search.set("screenX", String(Math.round(rect.screenX!)));
  }
  if (Number.isFinite(rect.screenY)) {
    search.set("screenY", String(Math.round(rect.screenY!)));
  }
  const response = await fetch(`http://127.0.0.1:39333/capture-active-window?${search.toString()}`);
  if (!response.ok) {
    let details = "";
    try {
      details = (await response.text()).trim();
    } catch {
      details = "";
    }
    if (response.status === 404) {
      throw new Error("LOCAL_SCREENSHOT_HELPER_ROUTE_MISSING");
    }
    throw new Error(details || "真实截图服务调用失败");
  }
  const payload = (await response.json()) as {
    ok?: boolean;
    base64?: string;
    fileName?: string;
    mimeType?: string;
    error?: string;
  };
  if (!payload.ok || !payload.base64) {
    throw new Error(payload.error || "真实截图结果为空");
  }
  const binary = atob(payload.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], payload.fileName || fileName, {
    type: payload.mimeType || "image/png",
  });
}

async function buildFallbackCaptureFile(rect: CaptureRect, fileName: string) {
  const width = Math.max(280, Math.min(Math.round(rect.width || 360), 960));
  const height = Math.max(160, Math.min(Math.round(rect.height || 220), 720));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("截图画布创建失败");
  context.fillStyle = "#f7f8fb";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#d9e0ea";
  context.lineWidth = 2;
  context.strokeRect(1, 1, width - 2, height - 2);
  context.fillStyle = "#171c22";
  context.font = "bold 18px sans-serif";
  context.fillText("已记录当前框选区域", 24, 48);
  context.fillStyle = "#667085";
  context.font = "14px sans-serif";
  context.fillText("截图生成超时，已保留附件占位。", 24, 82);
  context.fillText("可以继续提问，或重新框选截图。", 24, 108);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("截图失败");
  return new File([blob], fileName, { type: "image/png" });
}

function getResourceTypeLabel(type?: string) {
  if (type === "mindmap") return "导图";
  if (type === "practice_set") return "练习";
  if (type === "course_overview") return "总览";
  if (type === "teaching_plan") return "教案";
  if (type === "lecture_note") return "讲义";
  return "资料";
}

function buildResourcePromptSuggestions(resource?: TutorResourceContext | null) {
  if (!resource?.title) return [];
  if (resource.type === "mindmap") return ["拆这份导图", "讲知识点关系", "给我复习顺序"];
  if (resource.type === "practice_set") return ["讲这组练习", "按题型查薄弱点", "补 3 道相似题"];
  return ["讲这份资料主线", "提炼重点", "找最易混淆点"];
}

function buildTutorSessionStorageKey(userId?: string, courseId?: string, sectionId?: string) {
  return `${userId || "anonymous"}::${courseId || "global"}::${sectionId || "all"}`;
}

function buildTutorGlobalStorageKey(userId?: string) {
  return `${userId || "anonymous"}::global::all`;
}

function buildTutorCourseStorageKey(userId?: string, _courseId?: string) {
  return buildTutorGlobalStorageKey(userId);
}

function buildLegacyTutorCourseStorageKey(userId?: string, courseId?: string) {
  return buildTutorSessionStorageKey(userId, courseId);
}

type StoredTutorDraft = {
  sessionId: string | null;
  messages: TutorMessage[];
  inputValue: string;
  extractedText: string;
  showExtractedText: boolean;
};

function loadStoredTutorSession(userId?: string, courseId?: string, sectionId?: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.localStorage.getItem(TUTOR_SESSION_STORAGE_KEY) ||
      window.sessionStorage.getItem(TUTOR_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return (
      parsed[buildTutorCourseStorageKey(userId, courseId)] ||
      parsed[buildLegacyTutorCourseStorageKey(userId, courseId)] ||
      parsed[buildTutorSessionStorageKey(userId, courseId, sectionId)] ||
      null
    );
  } catch {
    return null;
  }
}

function saveStoredTutorSession(sessionId: string, userId?: string, courseId?: string, sectionId?: string) {
  if (typeof window === "undefined" || !sessionId) return;
  try {
    const raw = window.localStorage.getItem(TUTOR_SESSION_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    parsed[buildTutorCourseStorageKey(userId, courseId)] = sessionId;
    parsed[buildTutorSessionStorageKey(userId, courseId, sectionId)] = sessionId;
    window.localStorage.setItem(TUTOR_SESSION_STORAGE_KEY, JSON.stringify(parsed));
    window.sessionStorage.setItem(TUTOR_SESSION_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage failures and keep the in-memory session only.
  }
}

function clearStoredTutorSession(userId?: string, courseId?: string, sectionId?: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(TUTOR_SESSION_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    delete parsed[buildTutorCourseStorageKey(userId, courseId)];
    delete parsed[buildTutorSessionStorageKey(userId, courseId, sectionId)];
    window.localStorage.setItem(TUTOR_SESSION_STORAGE_KEY, JSON.stringify(parsed));
    window.sessionStorage.setItem(TUTOR_SESSION_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage failures.
  }
}

function isLegacyDefaultTutorMessage(message: TutorMessage) {
  if (message.id === "intro" || message.id === "capability-demo") return true;
  if (message.role !== "assistant") return false;
  return message.text.includes("我可以直接围绕") && message.text.includes("快速示例");
}

function sanitizeStoredTutorDraft(draft?: StoredTutorDraft | null) {
  if (!draft) return null;
  const messages = (draft.messages || [])
    .filter((message) => !isLegacyDefaultTutorMessage(message))
    .map((message) =>
      message.role === "assistant"
        ? {
            ...message,
            text: cleanTutorDisplayText(message.text),
          }
        : message,
    );
  const sanitizedDraft =
    messages.length === draft.messages.length &&
    messages.every((message, index) => message.text === draft.messages[index]?.text)
      ? draft
      : { ...draft, messages };
  return isMeaningfulTutorDraft(sanitizedDraft) ? sanitizedDraft : null;
}

function loadStoredTutorDraft(userId?: string, courseId?: string, sectionId?: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TUTOR_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, StoredTutorDraft>;
    const storageKey = buildTutorSessionStorageKey(userId, courseId, sectionId);
    const globalKey = buildTutorCourseStorageKey(userId, courseId);
    const legacyCourseKey = buildLegacyTutorCourseStorageKey(userId, courseId);
    const storedDraft = parsed[globalKey] || parsed[legacyCourseKey] || parsed[storageKey] || null;
    const sanitizedDraft = sanitizeStoredTutorDraft(storedDraft);
    if (sanitizedDraft !== storedDraft) {
      if (sanitizedDraft) {
        parsed[globalKey] = sanitizedDraft;
      } else {
        delete parsed[globalKey];
        delete parsed[legacyCourseKey];
        delete parsed[storageKey];
      }
      window.localStorage.setItem(TUTOR_DRAFT_STORAGE_KEY, JSON.stringify(parsed));
    }
    return sanitizedDraft;
  } catch {
    return null;
  }
}

function saveStoredTutorDraft(draft: StoredTutorDraft, userId?: string, courseId?: string, sectionId?: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(TUTOR_DRAFT_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, StoredTutorDraft>) : {};
    const storageKey = buildTutorSessionStorageKey(userId, courseId, sectionId);
    const sanitizedDraft = sanitizeStoredTutorDraft(draft);
    if (sanitizedDraft) {
      parsed[buildTutorCourseStorageKey(userId, courseId)] = sanitizedDraft;
      parsed[storageKey] = sanitizedDraft;
    } else {
      delete parsed[buildTutorCourseStorageKey(userId, courseId)];
      delete parsed[storageKey];
    }
    window.localStorage.setItem(TUTOR_DRAFT_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage failures.
  }
}

function clearStoredTutorDraft(userId?: string, courseId?: string, sectionId?: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(TUTOR_DRAFT_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, StoredTutorDraft>;
    delete parsed[buildTutorCourseStorageKey(userId, courseId)];
    delete parsed[buildTutorSessionStorageKey(userId, courseId, sectionId)];
    window.localStorage.setItem(TUTOR_DRAFT_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage failures.
  }
}

function loadTutorHistoryCache(userId?: string, courseId?: string) {
  if (typeof window === "undefined") return [] as TutoringHistoryItem[];
  try {
    const raw = window.localStorage.getItem(TUTOR_HISTORY_CACHE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, TutoringHistoryItem[]>;
    return parsed[buildTutorCourseStorageKey(userId, courseId)] || parsed[buildLegacyTutorCourseStorageKey(userId, courseId)] || [];
  } catch {
    return [];
  }
}

function saveTutorHistoryCache(items: TutoringHistoryItem[], userId?: string, courseId?: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(TUTOR_HISTORY_CACHE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, TutoringHistoryItem[]>) : {};
    const seen = new Set<string>();
    parsed[buildTutorCourseStorageKey(userId, courseId)] = items
      .filter((item) => {
        const id = String(item.question.id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, 30);
    window.localStorage.setItem(TUTOR_HISTORY_CACHE_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore cache failures.
  }
}

function rememberTutorResolvedIssue(userId: string | undefined, courseId: string | undefined, question: string, answer: string) {
  if (typeof window === "undefined") return;
  const normalizedQuestion = normalizeSummaryText(question);
  const normalizedAnswer = normalizeSummaryText(answer);
  if (!normalizedQuestion || !normalizedAnswer) return;
  try {
    const raw = window.localStorage.getItem(TUTOR_MEMORY_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Array<{ question: string; answer: string; resolvedAt: string }>>) : {};
    const key = buildTutorCourseStorageKey(userId, courseId);
    const current = parsed[key] || [];
    parsed[key] = [
      {
        question: normalizedQuestion.slice(0, 120),
        answer: normalizedAnswer.slice(0, 180),
        resolvedAt: new Date().toISOString(),
      },
      ...current.filter((item) => item.question !== normalizedQuestion.slice(0, 120)),
    ].slice(0, TUTOR_MEMORY_LIMIT);
    window.localStorage.setItem(TUTOR_MEMORY_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore memory failures.
  }
}

function loadTutorResolvedMemory(userId?: string, courseId?: string) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TUTOR_MEMORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, Array<{ question: string; answer: string; resolvedAt: string }>>;
    return parsed[buildTutorCourseStorageKey(userId, courseId)] || parsed[buildLegacyTutorCourseStorageKey(userId, courseId)] || [];
  } catch {
    return [];
  }
}

function isInvalidTutoringSessionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("会话无效或无权访问") || message.toLowerCase().includes("invalid session");
}

function isMeaningfulTutorDraft(draft: StoredTutorDraft) {
  return (
    draft.messages.length > 0 ||
    Boolean(draft.inputValue.trim()) ||
    Boolean(draft.extractedText.trim())
  );
}

function normalizeSummaryText(text?: string | null) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/场景：当前处于学习模式。/g, "")
    .replace(/视频文件：[^。！？\n]+/g, "")
    .replace(/参考时间：[^。！？\n]+/g, "")
    .replace(/当前资料：[^。！？\n]+/g, "")
    .replace(/资料摘要：[^。！？\n]+/g, "")
    .trim();
}

function buildSessionSummaryTitle(item: TutoringHistoryItem) {
  const question = normalizeSummaryText(item.question.question_text);
  const answer = normalizeSummaryText(item.answer?.answer_text);
  const source = `${question} ${answer}`.trim();
  if (!source) return "新的对话";

  if (/导图|知识点关系|复习顺序/.test(source)) return "导图拆解与复习顺序";
  if (/练习|题型|错题|讲题/.test(source)) return "练习讲解与薄弱点定位";
  if (/画像|学习风格|阶段|能力/.test(source)) return "学习画像解读";
  if (/路径|下一步|先做什么|学习计划/.test(source)) return "下一步学习规划";
  if (/讲义|资料|主线|重点|精读/.test(source)) return "课程资料精读";
  if (/视频|课堂|这一段|术语|总结/.test(source)) return "课堂内容答疑";

  const sentence = source
    .split(/[。！？!?\n]/)
    .map((part) => part.trim())
    .find((part) => part.length >= 6);
  const fallback = sentence || source;
  return fallback.length > 18 ? `${fallback.slice(0, 18)}...` : fallback;
}

function loadStoredSessionTitles() {
  if (typeof window === "undefined") return {} as Record<string, string>;
  try {
    const raw = window.localStorage.getItem(TUTOR_SESSION_TITLE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveStoredSessionTitles(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TUTOR_SESSION_TITLE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage failures.
  }
}

function resolveSessionTitle(item: TutoringHistoryItem, titleMap: Record<string, string>) {
  const sessionId = String(item.question.session_id || item.answer?.session_id || item.question.id);
  return titleMap[sessionId] || buildSessionSummaryTitle(item);
}

function syncFavoriteHistoryCache(item: TutoringHistoryItem, titleMap: Record<string, string>, shouldFavorite: boolean, courseId?: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(TUTOR_FAVORITE_HISTORY_STORAGE_KEY);
    const current = raw ? (JSON.parse(raw) as Array<Record<string, string>>) : [];
    const questionId = String(item.question.id);
    const sessionId = String(item.question.session_id || item.answer?.session_id || item.question.id);
    const nextTitle = resolveSessionTitle(item, titleMap);
    const nextEntry = {
      id: `${sessionId}-${questionId}`,
      sessionId,
      questionId,
      answerId: item.answer?.id ? String(item.answer.id) : "",
      title: nextTitle,
      preview: buildSessionPreview(item),
      questionText: item.question.question_text || "",
      answerText: item.answer?.answer_text || "",
      createdAt: item.question.create_time,
      courseId: courseId || `series-${item.question.course_id || 1}`,
      courseTitle: nextTitle,
    };
    const filtered = current.filter((entry) => String(entry.questionId) !== questionId);
    const next = shouldFavorite ? [nextEntry, ...filtered] : filtered;
    window.localStorage.setItem(TUTOR_FAVORITE_HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore cache sync failures.
  }
}

function normalizeDisplaySurface(value?: string) {
  if (value === "browser" || value === "window" || value === "monitor") return value;
  return "unknown";
}

function buildCaptureSuccessMessage(surface: string) {
  if (surface === "monitor") return "已截取整个屏幕";
  if (surface === "window") return "已截取当前窗口";
  return "已截取当前页面";
}

function buildQuickLocalReply(text: string, title?: string, subtitle?: string) {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[!！?？~。、，；;：:“”"'`（）()\[\]【】]/g, "");
  if (!normalized) return null;

  const greetingReplies = new Map<string, string>([
    ["你好", "你好，我在。"],
    ["您好", "您好，我在。"],
    ["hi", "Hi，我在。"],
    ["hello", "Hello，我在。"],
    ["哈喽", "哈喽，我在。"],
    ["在吗", "在的，你说。"],
    ["在不在", "在的，你说。"],
    ["有人吗", "我在，你说。"],
  ]);
  const greetingReply = greetingReplies.get(normalized);
  if (greetingReply) {
    return greetingReply;
  }

  if (["你是谁", "你是干嘛的", "你能做什么", "你会什么"].includes(normalized)) {
    return `我是右侧的 AI 导师，可以陪你看${title || "这节课"}，也能帮你解释概念、看截图，或者继续顺着${subtitle || "当前内容"}往下讲。`;
  }

  const asksForDemoSummary =
    /演示|展示|答辩|汇报|讲解|介绍/.test(normalized) &&
    /两句话|2句话|一句话|概括|总结|简单|怎么讲|怎么演示|适合怎么|资源页|当前页面|这页/.test(normalized);
  if (asksForDemoSummary) {
    return "演示时先用一个真实学习任务跑通资源检索、筛选、打开与下载的完整闭环。再补充分类维护、资源更新和学习任务联动，说明它不是静态页面，而是能支撑日常教学的资源中枢。";
  }

  if (["谢谢", "谢了", "多谢", "ok", "okay", "好的", "收到", "行", "知道了"].includes(normalized)) {
    return "好，我们继续。";
  }

  return null;
}

function isSystemUsageQuestion(text: string) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return (
    /如何使用|怎么使用|怎么用|如何用|从哪里开始|从哪开始|怎么开始|使用该系统|使用这个系统|这个系统/.test(normalized) ||
    /这个页面.*做什么|这个页面.*怎么用|当前页面.*怎么用|页面.*是什么意思|页面.*怎么使用/.test(normalized) ||
    /项目.*怎么启动|系统.*怎么启动|怎么联调|本地启动|管理端.*怎么用|知识库.*怎么用/.test(normalized)
  );
}

function looksLikeOnlineCourseSearch(text: string) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  const wantsRecommendation = /推荐|找|搜|搜索|有没有|给我.*(链接|网址)|课程|网课|视频|教程|公开课/.test(normalized);
  const wantsOnlineCourse = /网课|课程|视频课|教程|公开课|b站|bilibili|哔哩|慕课|mooc|java|python|vue|react|前端|后端/.test(normalized);
  return wantsRecommendation && wantsOnlineCourse;
}

function formatVideoContextTime(seconds?: number) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "当前时间点";
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${minutes}:${String(restSeconds).padStart(2, "0")}`;
}

function buildCurrentVideoLocalAnswer(question: string, title?: string, subtitle?: string, startAt?: number, fileName?: string) {
  const timeLabel = formatVideoContextTime(startAt);
  const contextTitle = title || "当前课程";
  const contextSubtitle = subtitle || fileName || "当前视频片段";
  const normalized = `${question} ${contextTitle} ${contextSubtitle}`.toLowerCase();
  const focusHints: string[] = [];

  if (/软件工程|软件危机|software/.test(normalized)) {
    focusHints.push("这一段大概率在说明软件工程为什么出现：项目规模变大后，单靠个人经验很难保证进度、质量和可维护性。");
    focusHints.push("重点可以抓三件事：软件危机的表现、工程化方法的价值、以及需求到维护这一整套生命周期管理。");
  }
  if (/需求|requirement/.test(normalized)) {
    focusHints.push("如果当前片段在讲需求，核心是把用户真实目标转成清晰、可验证、可追踪的系统规格。");
  }
  if (/设计|架构|architecture/.test(normalized)) {
    focusHints.push("如果当前片段在讲设计或架构，重点是模块如何划分、职责如何分配，以及后续开发和维护会不会容易。");
  }
  if (/测试|test/.test(normalized)) {
    focusHints.push("如果当前片段在讲测试，重点不是只找 bug，而是用系统化用例验证软件是否满足需求和质量目标。");
  }

  const fallbackHint =
    "我现在会按当前视频上下文回答，不去推荐外部课程。这个时间点通常适合先问：这里提出了什么概念、它解决什么问题、后面会怎样用到。";

  return [
    `已读取当前视频位置：${contextTitle} / ${contextSubtitle} / ${timeLabel}。`,
    "",
    focusHints.length ? focusHints.join("\n") : fallbackHint,
    "",
    "你可以继续追问“这一段用一句话概括”“这里有哪些考试点”或“给我举个项目例子”，我会继续围绕当前视频片段讲。",
  ].join("\n");
}

function shouldAutoAttachCourseLinks(text: string) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  if (/链接|网址|网课|视频课|教程|公开课|b站|bilibili|哔哩|慕课|mooc/.test(normalized)) return true;
  return /怎么学|如何学|学习路线|怎么用|如何使用|入门|推荐资料|推荐课程|课程推荐|视频推荐|讲解视频/.test(normalized);
}

function buildOnlineCourseSearchQuery(text: string) {
  const normalized = text
    .replace(/[，。！？!?]/g, " ")
    .replace(/给我|帮我|推荐|找|搜|搜索|有没有|一些|几个|网课|课程|视频课|教程|链接|网址/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const topic = normalized || text.replace(/\s+/g, " ").trim() || "Java";
  return `${topic} B站 网课 教程`;
}

function buildCourseSearchAnswer(query: string, items: WebSearchResultItem[]) {
  const filteredItems = items
    .filter((item) => item.title && item.url)
    .slice(0, 5);
  if (!filteredItems.length) {
    const bilibiliSearchUrl = `https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`;
    return `我没有拿到稳定的搜索结果，可以先从这个 B 站搜索入口打开：\n[在 Bilibili 搜索「${query}」](${bilibiliSearchUrl})`;
  }
  const lines = filteredItems.map((item, index) => {
    const snippet = item.snippet ? `\n   ${item.snippet.replace(/\s+/g, " ").slice(0, 90)}` : "";
    return `${index + 1}. [${item.title}](${item.url})${snippet}`;
  });
  const bilibiliSearchUrl = `https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`;
  return [
    `我先按「${query}」联网找了几条可打开的课程资源：`,
    "",
    ...lines,
    "",
    `更多结果：[继续在 Bilibili 搜索](${bilibiliSearchUrl})`,
  ].join("\n");
}

async function searchOnlineCourseLinks(text: string) {
  const query = buildOnlineCourseSearchQuery(text);
  try {
    const response = await studentApi.webSearch({
      query,
      top_k: 5,
      domain_whitelist: ["bilibili.com", "bilibili.tv", "imooc.com", "icourse163.org"],
    });
    return buildCourseSearchAnswer(query, response.items || []);
  } catch {
    return buildCourseSearchAnswer(query, []);
  }
}

async function buildAutoCourseLinksSection(text: string) {
  const query = buildOnlineCourseSearchQuery(text);
  try {
    const response = await studentApi.webSearch({
      query,
      top_k: 4,
      domain_whitelist: ["bilibili.com", "bilibili.tv", "imooc.com", "icourse163.org"],
    });
    return `\n\n相关视频/课程链接\n${buildCourseSearchAnswer(query, response.items || [])}`;
  } catch {
    return `\n\n相关视频/课程链接\n${buildCourseSearchAnswer(query, [])}`;
  }
}

function cleanTutorDisplayText(text: string) {
  if (/^HTTP\s*5\d\d\s*$/i.test(text.trim())) {
    return "AI 导师服务暂时不可用，请稍后重试。";
  }
  if (/^Request timeout\s*$/i.test(text.trim())) {
    return "这次生成时间超过预期，我已保留问题。请稍后在最近会话里查看结果，或重新发送一次。";
  }
  const unwantedLines = new Set([
    "你先把真正想问的那句说出来，会更快。",
    "- 你先把真正想问的那句说出来，会更快。",
    "• 你先把真正想问的那句说出来，会更快。",
  ]);
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*>\s?/, ""))
    .filter((line) => {
      const trimmed = line.trim().replace(/^[-*•]\s*/, "");
      if (unwantedLines.has(trimmed)) return false;
      if (/^(#{1,6}\s*)?回答[:：]?$/.test(trimmed)) return false;
      return true;
    })
    .join("\n")
    .replace(/^\s*[-*•]\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function shouldRenderTutorMarkdown(text: string) {
  return /```|\|.*\||\$\$?|!\[|]\(/im.test(text);
}

export default function AITutor(props: AITutorProps = {}) {
  const {
    user,
    embedded = false,
    initialCourseId,
    initialSectionId,
    initialQuery,
    initialMode,
    initialTitle,
    initialSubtitle,
    initialVideoSrc,
    initialVideoResourceId,
    initialVideoFileId,
    initialResourceId,
    initialResourceTitle,
    initialResourceType,
    initialResourceSummary,
    initialVideoFileName,
    initialQuickPrompts,
    initialStartAt,
    initialAutoplay,
    initialMuted,
    onClose,
    resetToken,
  } = props;
  const preferFreshTaskContext = false;
  const resolvedUserId = user?.id || "1001";
  const resolvedUserProfile = useMemo(() => getDemoUserProfile(resolvedUserId), [resolvedUserId]);
  const userExperience = useMemo(() => getDemoUserExperienceConfig(resolvedUserId), [resolvedUserId]);

  const resolvedCourseId = useMemo(() => resolveCourseId(initialCourseId), [initialCourseId]);
  const resourceContext = useMemo<TutorResourceContext>(
    () => ({
      id: initialResourceId,
      title: initialResourceTitle,
      type: initialResourceType,
      summary: initialResourceSummary,
    }),
    [initialResourceId, initialResourceSummary, initialResourceTitle, initialResourceType],
  );
  const storedSessionId = useMemo(
    () => loadStoredTutorSession(resolvedUserId, initialCourseId, initialSectionId ? String(initialSectionId) : undefined),
    [resolvedUserId, initialCourseId, initialSectionId],
  );
  const storedDraft = useMemo(
    () => loadStoredTutorDraft(resolvedUserId, initialCourseId, initialSectionId ? String(initialSectionId) : undefined),
    [resolvedUserId, initialCourseId, initialSectionId],
  );
  const resolvedTutorMemory = useMemo(
    () => loadTutorResolvedMemory(resolvedUserId, initialCourseId),
    [resolvedUserId, initialCourseId, resetToken],
  );
  const quickPrompts = useMemo(
    () => {
      const modePrompts = buildModePromptSuggestions(initialMode || "default", userExperience.tutorPrompts);
      const resourcePrompts = buildResourcePromptSuggestions(resourceContext);
      if (initialQuickPrompts?.length) {
        return Array.from(new Set([...initialQuickPrompts, ...resourcePrompts, ...modePrompts, ...userExperience.tutorPrompts])).slice(0, 6);
      }
      return Array.from(new Set([...(resourcePrompts.length ? resourcePrompts : []), ...modePrompts, ...userExperience.tutorPrompts])).slice(0, 6);
    },
    [initialMode, initialQuickPrompts, resourceContext, userExperience],
  );

  const [messages, setMessages] = useState<TutorMessage[]>(() =>
    !preferFreshTaskContext && storedDraft?.messages?.length
      ? storedDraft.messages
      : [],
  );
  const [inputValue, setInputValue] = useState(
    !preferFreshTaskContext ? storedDraft?.inputValue || initialQuery || "" : initialQuery || "",
  );
  const [attachments, setAttachments] = useState<TutorAttachment[]>([]);
  const [historyItems, setHistoryItems] = useState<TutoringHistoryItem[]>([]);
  const [sessionTitleMap, setSessionTitleMap] = useState<Record<string, string>>(() => loadStoredSessionTitles());
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [historyFullscreen, setHistoryFullscreen] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(storedDraft?.sessionId || storedSessionId);
  const [historyBusyQuestionId, setHistoryBusyQuestionId] = useState<string | null>(null);
  const [collapsedHistoryGroups, setCollapsedHistoryGroups] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [composerError, setComposerError] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<TutorAttachment | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState(storedDraft?.extractedText || "");
  const [showExtractedText, setShowExtractedText] = useState(storedDraft?.showExtractedText || false);
  const [capturePending, setCapturePending] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureHelperReady, setCaptureHelperReady] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("full");
  const [captureRect, setCaptureRect] = useState<CaptureRect | null>(null);
  const [dragging, setDragging] = useState(false);
  const [captureSurfaceLabel, setCaptureSurfaceLabel] = useState<string>("当前页面");

  const listRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const captureButtonRef = useRef<HTMLButtonElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; screenX: number; screenY: number } | null>(null);
  const tutorSurfaceRef = useRef<HTMLDivElement | null>(null);

  const filteredHistoryItems = useMemo(() => {
    const keyword = historySearch.trim().toLowerCase();
    if (!keyword) return historyItems;
    return historyItems.filter((item) => {
      const haystack = `${item.question.question_text || ""} ${item.answer?.answer_text || ""}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [historyItems, historySearch]);

  const groupedHistoryItems = useMemo(() => groupHistoryItems(filteredHistoryItems), [filteredHistoryItems]);

  useEffect(() => {
    if (!historyItems.length) return;
    setSessionTitleMap((current) => {
      let changed = false;
      const next = { ...current };
      historyItems.forEach((item) => {
        const sessionId = String(item.question.session_id || item.answer?.session_id || item.question.id);
        if (!next[sessionId]) {
          next[sessionId] = buildSessionSummaryTitle(item);
          changed = true;
        }
      });
      if (changed) {
        saveStoredSessionTitles(next);
      }
      return changed ? next : current;
    });
  }, [historyItems]);

  useEffect(() => {
    if (!tutorSurfaceRef.current) return;
    const blocks = tutorSurfaceRef.current.querySelectorAll<HTMLElement>("[data-tutor-reveal]");
    if (!blocks.length) return;
    gsap.fromTo(
      blocks,
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: 0.56,
        stagger: 0.04,
        ease: "power2.out",
      },
    );
  }, [embedded, historyFullscreen, activeQuestionId]);

  useEffect(() => {
    if (!preferFreshTaskContext && storedDraft?.messages?.length) {
      setMessages(storedDraft.messages);
      setInputValue(initialQuery || storedDraft.inputValue || "");
      setActiveQuestionId(storedDraft.sessionId || storedSessionId);
      setExtractedText(storedDraft.extractedText || "");
      setShowExtractedText(Boolean(storedDraft.showExtractedText));
    } else {
      setMessages([]);
      setInputValue(initialQuery || "");
      setActiveQuestionId(preferFreshTaskContext ? null : storedSessionId);
      setExtractedText("");
      setShowExtractedText(false);
    }
    setAttachments([]);
    setComposerError("");
    setPreviewAttachment(null);
    setCapturePending(false);
    setCaptureRect(null);
    setCaptureMode("full");
    setHistoryFullscreen(false);
    setCaptureSurfaceLabel("当前页面");
  }, [initialQuery, preferFreshTaskContext, resetToken, storedDraft, storedSessionId]);

  useEffect(() => {
    if (!activeQuestionId) return;
    saveStoredTutorSession(
      activeQuestionId,
      resolvedUserId,
      initialCourseId,
      initialSectionId ? String(initialSectionId) : undefined,
    );
  }, [activeQuestionId, resolvedUserId, initialCourseId, initialSectionId]);

  useEffect(() => {
    const sectionKey = initialSectionId ? String(initialSectionId) : undefined;
    const draft: StoredTutorDraft = {
      sessionId: activeQuestionId,
      messages,
      inputValue,
      extractedText,
      showExtractedText,
    };
    if (isMeaningfulTutorDraft(draft)) {
      saveStoredTutorDraft(draft, resolvedUserId, initialCourseId, sectionKey);
    } else {
      clearStoredTutorDraft(resolvedUserId, initialCourseId, sectionKey);
    }
  }, [
    activeQuestionId,
    extractedText,
    resolvedUserId,
    initialCourseId,
    initialSectionId,
    inputValue,
    messages,
    showExtractedText,
  ]);

  useEffect(() => {
    if (!listRef.current || previewAttachment || capturePending) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, attachments, previewAttachment, capturePending]);

  useEffect(() => {
    if (!previewAttachment && !capturePending) return;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, [previewAttachment, capturePending]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const ensureCaptureHelperReady = async () => {
    try {
      const response = await fetch("http://127.0.0.1:39333/capture-active-window?x=0&y=0&width=1&height=1");
      const ready = response.ok || response.status !== 404;
      setCaptureHelperReady(ready);
      return ready;
    } catch {
      setCaptureHelperReady(false);
      return false;
    }
  };

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      const cachedHistory = loadTutorHistoryCache(resolvedUserId, initialCourseId);
      if (cachedHistory.length) {
        setHistoryItems(cachedHistory);
      }
      setHistoryLoading(!cachedHistory.length);
      setHistoryError("");
      try {
        const response = await studentApi.listTutoringHistory({
          course_id: resolvedCourseId,
          page: 1,
          page_size: 8,
        });
        if (!active) return;
        const nextItems = response.items?.length ? response.items : cachedHistory;
        setHistoryItems(nextItems || []);
        if (response.items?.length) {
          saveTutorHistoryCache(response.items, resolvedUserId, initialCourseId);
        }
      } catch (error) {
        if (!active) return;
        setHistoryItems(cachedHistory);
        const message = error instanceof Error ? error.message : "";
        if (!cachedHistory.length) {
          setHistoryError(
            /HTTP\s*5\d\d|Failed to fetch|NetworkError/i.test(message)
              ? "最近会话暂时连接不上，已显示本地空状态。"
              : "加载历史会话失败，请稍后重试。",
          );
        }
      } finally {
        if (active) setHistoryLoading(false);
      }
    }
    void loadHistory();
    return () => {
      active = false;
    };
  }, [resolvedCourseId, resolvedUserId, initialCourseId, resetToken]);

  const openHistoryItem = (item: TutoringHistoryItem) => {
    setActiveQuestionId(String(item.question.session_id || item.answer?.session_id || item.question.id));
    setMessages(buildHistoryMessages(item));
    setAttachments([]);
    setComposerError("");
    setHistoryFullscreen(false);
  };

  const handleStartFreshConversation = () => {
    const sectionKey = initialSectionId ? String(initialSectionId) : undefined;
    clearStoredTutorSession(resolvedUserId, initialCourseId, sectionKey);
    clearStoredTutorDraft(resolvedUserId, initialCourseId, sectionKey);
    setActiveQuestionId(null);
    setMessages([]);
    setInputValue("");
    setAttachments([]);
    setExtractedText("");
    setShowExtractedText(false);
    setComposerError("");
    setPreviewAttachment(null);
    setCaptureRect(null);
    setCapturePending(false);
    setHistoryFullscreen(false);
    setToastMessage("已开始新的对话。");
    window.requestAnimationFrame(() => {
      messageInputRef.current?.focus();
    });
  };

  const handleToggleHistoryFavorite = async (item: TutoringHistoryItem) => {
    const questionId = String(item.question.id);
    const answerId = item.answer?.id;
    if (!answerId) {
      setToastMessage("当前会话还没有可收藏的回答。");
      return;
    }

    setHistoryBusyQuestionId(questionId);
    try {
      if (item.is_favorited) {
        await studentApi.removeTutoringFavorite(questionId);
      } else {
        await studentApi.addTutoringFavorite({ question_id: questionId, answer_id: answerId });
      }
      syncFavoriteHistoryCache(item, sessionTitleMap, !item.is_favorited, initialCourseId);
      setHistoryItems((current) =>
        current.map((entry) =>
          String(entry.question.id) === questionId ? { ...entry, is_favorited: !item.is_favorited } : entry,
        ),
      );
      setToastMessage(item.is_favorited ? "已取消收藏这条会话。" : "已收藏这条会话。");
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : "会话收藏操作失败。");
    } finally {
      setHistoryBusyQuestionId(null);
    }
  };

  const handleDeleteHistoryItem = async (item: TutoringHistoryItem) => {
    const questionId = String(item.question.id);
    setHistoryBusyQuestionId(questionId);
    try {
      await studentApi.deleteTutoringHistoryItem(questionId);
      syncFavoriteHistoryCache(item, sessionTitleMap, false, initialCourseId);
      setHistoryItems((current) => {
        const next = current.filter((entry) => String(entry.question.id) !== questionId);
        saveTutorHistoryCache(next, resolvedUserId, initialCourseId);
        return next;
      });
      const deletedSessionId = String(item.question.session_id || item.answer?.session_id || item.question.id);
      if (activeQuestionId === questionId || activeQuestionId === deletedSessionId) {
        handleStartFreshConversation();
      }
      setToastMessage("这条历史会话已删除。");
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : "删除历史会话失败。");
    } finally {
      setHistoryBusyQuestionId(null);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => {
      const next = current.filter((item) => item.id !== id);
      setExtractedText(collectAttachmentExtractedText(next));
      return next;
    });
    if (previewAttachment?.id === id) setPreviewAttachment(null);
  };

  const uploadAsset = async (file: File, source: TutorAttachment["source"]): Promise<TutorAttachment> => {
    const response = await studentApi.uploadTutoringAsset(file);
    const extracted = response.extracted_text?.trim() || "";
    if (extracted) {
      setShowExtractedText(false);
      if (source === "screenshot") {
        setInputValue((current) => {
          const nextPrompt = buildAttachmentPrompt(extracted);
          if (!current.trim()) return nextPrompt;
          if (current.includes(extracted)) return current;
          return `${current.trim()}\n\n${nextPrompt}`;
        });
      }
      setToastMessage("已提取正文");
    }
    const isImage = file.type.startsWith("image/");
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      assetUrl: response.url,
      previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      mimeType: file.type,
      extractedText: extracted || undefined,
      source,
      uploadStatus: "uploaded",
    };
  };

  const attachScreenshotImmediately = (file: File, successMessage: string) => {
    const previewUrl = URL.createObjectURL(file);
    const localAttachment: TutorAttachment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      assetUrl: previewUrl,
      previewUrl,
      mimeType: file.type,
      source: "screenshot",
      uploadStatus: "uploading",
    };

    setAttachments((current) => {
      const merged = [...current, localAttachment];
      setExtractedText(collectAttachmentExtractedText(merged));
      return merged;
    });
    setToastMessage(successMessage);
    window.requestAnimationFrame(() => {
      messageInputRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      messageInputRef.current?.focus();
    });

    void (async () => {
      try {
        const response = await Promise.race([
          studentApi.uploadTutoringAsset(file),
          new Promise<never>((_, reject) => {
            window.setTimeout(() => reject(new Error("SCREENSHOT_UPLOAD_TIMEOUT")), 6000);
          }),
        ]);
        const extracted = response.extracted_text?.trim() || "";
        if (extracted) {
          setShowExtractedText(false);
          setInputValue((current) => {
            const nextPrompt = buildAttachmentPrompt(extracted);
            if (!current.trim()) return nextPrompt;
            if (current.includes(extracted)) return current;
            return `${current.trim()}\n\n${nextPrompt}`;
          });
        }
        setAttachments((current) => {
          const next = current.map((item) =>
            item.id === localAttachment.id
              ? {
                  ...item,
                  assetUrl: response.url,
                  extractedText: extracted || undefined,
                  uploadStatus: "uploaded" as const,
                }
              : item,
          );
          setExtractedText(collectAttachmentExtractedText(next));
          return next;
        });
        if (extracted) {
          setToastMessage("已提取正文");
        }
      } catch {
        setAttachments((current) => {
          const next = current.map((item) =>
            item.id === localAttachment.id
              ? {
                  ...item,
                  uploadStatus: "local" as const,
                }
              : item,
          );
          setExtractedText(collectAttachmentExtractedText(next));
          return next;
        });
      }
    })();
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    setComposerError("");
    setUploading(true);
    beginUiProgress(0.16);
    setUiProgress(0.34);
    try {
      const next = await Promise.all(Array.from(files).map((file: File) => uploadAsset(file, "upload")));
      setAttachments((current) => {
        const merged = [...current, ...next];
        setExtractedText(collectAttachmentExtractedText(merged));
        return merged;
      });
      setUiProgress(0.92);
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : "文件上传失败");
    } finally {
      finishUiProgress();
      setUploading(false);
      event.target.value = "";
    }
  };

  const resetCaptureState = () => {
    setCapturePending(false);
    setCaptureMode("full");
    setCaptureRect(null);
    setDragging(false);
    dragStartRef.current = null;
  };

  const captureVisibleBrowserSurface = async (rect: CaptureRect, fileName: string) => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("当前浏览器不支持原生屏幕共享截图");
    }

    const supportedConstraints = navigator.mediaDevices.getSupportedConstraints?.() || {};
    const stream = await navigator.mediaDevices.getDisplayMedia({
      preferCurrentTab: supportedConstraints.displaySurface ? false : undefined,
      video: {
        displaySurface: "browser",
      } as MediaTrackConstraints,
      audio: false,
    } as DisplayMediaStreamOptions);

    const video = document.createElement("video");
    video.playsInline = true;
    video.muted = true;
    video.srcObject = stream;

    try {
      const [track] = stream.getVideoTracks();
      if (!track) throw new Error("没有获取到可截图的视频轨道");

      const settings = track.getSettings() as MediaTrackSettings & { displaySurface?: string };
      const displaySurface = normalizeDisplaySurface(settings.displaySurface);
      const surfaceLabel = displaySurface === "monitor" ? "整个屏幕" : displaySurface === "window" ? "当前窗口" : "当前页面";
      setCaptureSurfaceLabel(surfaceLabel);

      await video.play();
      await waitForVideoReady(video);
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const sourceWidth = video.videoWidth || Math.round(window.innerWidth * (window.devicePixelRatio || 1));
      const sourceHeight = video.videoHeight || Math.round(window.innerHeight * (window.devicePixelRatio || 1));
      let sx = 0;
      let sy = 0;
      let sw = sourceWidth;
      let sh = sourceHeight;

      if (displaySurface === "browser") {
        const scaleX = sourceWidth / Math.max(window.innerWidth, 1);
        const scaleY = sourceHeight / Math.max(window.innerHeight, 1);
        sx = clamp(Math.round(rect.x * scaleX), 0, sourceWidth);
        sy = clamp(Math.round(rect.y * scaleY), 0, sourceHeight);
        sw = clamp(Math.round(rect.width * scaleX), 1, sourceWidth - sx || 1);
        sh = clamp(Math.round(rect.height * scaleY), 1, sourceHeight - sy || 1);
      }

      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("截图画布创建失败");

      context.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("截图失败");
      return new File([blob], fileName, { type: "image/png" });
    } finally {
      video.pause();
      video.srcObject = null;
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const handlePasteCapture = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files: File[] = [];
    const clipboardFiles = event.clipboardData?.files;
    if (clipboardFiles) {
      for (let index = 0; index < clipboardFiles.length; index += 1) {
        const file = clipboardFiles.item(index);
        if (file && file.type.startsWith("image/")) {
          files.push(file);
        }
      }
    }
    if (!files.length) return;
    event.preventDefault();
    setComposerError("");
    setUploading(true);
    try {
      const next = await Promise.all(files.map((file) => uploadAsset(file, "upload")));
      setAttachments((current) => {
        const merged = [...current, ...next];
        setExtractedText(collectAttachmentExtractedText(merged));
        return merged;
      });
      setToastMessage("截图已粘贴");
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : "粘贴截图失败");
    } finally {
      setUploading(false);
    }
  };

  const readClipboardScreenshot = async (): Promise<File | null> => {
    if (!navigator.clipboard?.read) return null;
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith("image/"));
      if (!imageType) continue;
      const blob = await item.getType(imageType);
      const extension = imageType.includes("png") ? "png" : imageType.includes("jpeg") ? "jpg" : "img";
      return new File([blob], `system-capture-${Date.now()}.${extension}`, { type: imageType });
    }
    return null;
  };

  const captureFromLocalHelper = async (): Promise<File | null> => {
    try {
      const response = await fetch("http://127.0.0.1:39333/capture");
      if (!response.ok) return null;
      const payload = (await response.json()) as { ok?: boolean; base64?: string; mimeType?: string; fileName?: string };
      if (!payload?.ok || !payload.base64) return null;
      const mimeType = payload.mimeType || "image/png";
      const binary = window.atob(payload.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new File([bytes], payload.fileName || `system-capture-${Date.now()}.png`, { type: mimeType });
    } catch {
      return null;
    }
  };

  const handleInlineCapture = async () => {
    if (sending || uploading || capturing) return;
    setComposerError("");
    setCapturing(true);
    beginUiProgress(0.16);
    setUiProgress(0.3);
    try {
      const file = (await captureFromLocalHelper()) || (await readClipboardScreenshot());
      if (!file) {
        throw new Error("系统截图未返回图片，请完成截图后重试。");
      }
      const attachment = await uploadAsset(file, "screenshot");
      attachment.previewUrl = URL.createObjectURL(file);
      setAttachments((current) => {
        const merged = [...current, attachment];
        setExtractedText(collectAttachmentExtractedText(merged));
        return merged;
      });
      setUiProgress(0.92);
      setToastMessage("已添加系统截图");
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : "系统截图失败");
    } finally {
      finishUiProgress();
      setCapturing(false);
      resetCaptureState();
    }
  };

  const handleSelectionCaptureStart = () => {
    if (sending || uploading || capturing) return;
    setComposerError("");
    setCaptureMode("selection");
    setCaptureRect(null);
    setDragging(false);
    dragStartRef.current = null;
    setCaptureSurfaceLabel("框选区域");
    setCapturePending(true);
  };

  const handleLongPageCapture = () => {
    if (sending || uploading || capturing) return;
    setComposerError("");
    void exportCapture({ mode: "full" });
  };

  const buildCaptureSandbox = () => {
    const sandbox = document.createElement("div");
    sandbox.style.position = "fixed";
    sandbox.style.left = "-100000px";
    sandbox.style.top = "0";
    sandbox.style.width = `${window.innerWidth}px`;
    sandbox.style.height = `${window.innerHeight}px`;
    sandbox.style.overflow = "hidden";
    sandbox.style.pointerEvents = "none";
    sandbox.setAttribute("aria-hidden", "true");

    const clone = document.body.cloneNode(true) as HTMLElement;
    const originalElements = Array.from(document.body.querySelectorAll<HTMLElement>("*"));
    const clonedElements = Array.from(clone.querySelectorAll<HTMLElement>("*"));

    clone.style.width = `${window.innerWidth}px`;
    clone.style.height = `${window.innerHeight}px`;
    clone.style.margin = "0";
    clone.style.overflow = "hidden";
    clone.style.pointerEvents = "none";
    clone.querySelectorAll("[data-capture-overlay='true'], [data-capture-controls='true']").forEach((node) => node.remove());

    const rootStyle = window.getComputedStyle(document.body);
    for (const propertyName of Array.from(rootStyle)) {
      if (propertyName.startsWith("--")) continue;
      const propertyValue = rootStyle.getPropertyValue(propertyName);
      if (hasUnsupportedColorFunction(propertyValue)) continue;
      clone.style.setProperty(propertyName, propertyValue, rootStyle.getPropertyPriority(propertyName));
    }

    clonedElements.forEach((node, index) => {
      const original = originalElements[index];
      if (!original) return;
      const style = window.getComputedStyle(original);
      for (const propertyName of Array.from(style)) {
        if (propertyName.startsWith("--")) continue;
        const propertyValue = style.getPropertyValue(propertyName);
        if (hasUnsupportedColorFunction(propertyValue)) {
          if (propertyName === "background-image" || propertyName.includes("shadow") || propertyName.includes("filter")) {
            node.style.setProperty(propertyName, "none");
          }
          continue;
        }
        node.style.setProperty(propertyName, propertyValue, style.getPropertyPriority(propertyName));
      }
      node.style.animation = "none";
      node.style.transition = "none";
      node.style.caretColor = "transparent";
      node.removeAttribute("class");
    });

    clone.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      if (/^https?:\/\//i.test(src)) {
        const placeholder = document.createElement("div");
        placeholder.style.width = `${img.clientWidth || img.width || 160}px`;
        placeholder.style.height = `${img.clientHeight || img.height || 100}px`;
        placeholder.style.display = "flex";
        placeholder.style.alignItems = "center";
        placeholder.style.justifyContent = "center";
        placeholder.style.borderRadius = "16px";
        placeholder.style.background = "linear-gradient(135deg,#fdf2f8 0%,#fff7ed 100%)";
        placeholder.style.color = "#9f1239";
        placeholder.style.fontSize = "12px";
        placeholder.style.fontWeight = "700";
        placeholder.textContent = img.alt || "学习资源预览";
        img.replaceWith(placeholder);
      }
    });

    clone.querySelectorAll<HTMLVideoElement>("video").forEach((video) => {
      const placeholder = document.createElement("div");
      placeholder.style.width = `${video.clientWidth || 320}px`;
      placeholder.style.height = `${video.clientHeight || 180}px`;
      placeholder.style.display = "flex";
      placeholder.style.flexDirection = "column";
      placeholder.style.alignItems = "center";
      placeholder.style.justifyContent = "center";
      placeholder.style.borderRadius = "20px";
      placeholder.style.background = "linear-gradient(135deg,#111827 0%,#334155 100%)";
      placeholder.style.color = "#fff";
      placeholder.innerHTML = "<div style='font-size:28px;line-height:1'>▶</div><div>视频区域已纳入截图</div>";
      video.replaceWith(placeholder);
    });

    sandbox.appendChild(clone);
    document.body.appendChild(sandbox);
    return { sandbox, clone };
  };

  const exportCapture = async (options?: { mode?: CaptureMode; rect?: CaptureRect | null }) => {
    if (capturing) return;
    setCapturing(true);
    setComposerError("");
    try {
      const effectiveMode = options?.mode ?? captureMode;
      const requestedRect =
        effectiveMode === "selection" && options?.rect
          ? options.rect
          : effectiveMode === "selection" && captureRect
            ? captureRect
            : null;
      const rect = getPreferredCaptureRect(effectiveMode, requestedRect);
      const fileName = effectiveMode === "selection" ? "selection-capture.png" : "full-page-capture.png";
      let file: File | null = null;
      const captureSurface = "browser";
      const captureOverlays = Array.from(document.querySelectorAll<HTMLElement>("[data-capture-overlay='true'], [data-capture-controls='true']"));
      const previousVisibilities = captureOverlays.map((node) => node.style.visibility);
      captureOverlays.forEach((node) => {
        node.style.visibility = "hidden";
      });
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 30));
        let fallbackMessage = "";
        const helperReady = effectiveMode === "selection" ? captureHelperReady : false;
        if (effectiveMode === "selection" && helperReady) {
          try {
            file = await captureActiveWindowSelection(rect, fileName);
          } catch (helperError) {
            fallbackMessage =
              helperError instanceof Error && helperError.message === "LOCAL_SCREENSHOT_HELPER_ROUTE_MISSING"
                ? "本地真实截图服务未更新，已自动切换为兼容截图模式。"
                : "真实截图暂时不可用，已自动切换为兼容截图模式。";
            setCaptureHelperReady(false);
          }
        }
        if (!file) {
          const captureTarget =
            effectiveMode === "selection"
              ? getSelectionCaptureTarget(rect)
              : (document.getElementById("course-learning-primary-column") || document.getElementById("root") || document.body);
          const targetRect = captureTarget.getBoundingClientRect();
          const shouldUseFallbackSelectionCapture =
            effectiveMode === "selection" &&
            (captureTarget === document.body ||
              captureTarget === document.documentElement ||
              Math.max(targetRect.width * targetRect.height, 1) > Math.max(rect.width * rect.height * 12, 360000));
          const captureHeight =
            effectiveMode === "selection"
              ? Math.max(1, Math.round(rect.height))
              : Math.max(
                  (captureTarget as HTMLElement).scrollHeight || 0,
                  (captureTarget as HTMLElement).clientHeight || 0,
                  Math.round(targetRect.height || 0),
                );
          const cropX =
            effectiveMode === "selection"
              ? clamp(Math.round(rect.x - targetRect.left), 0, Math.max(Math.round(targetRect.width), 1))
              : 0;
          const cropY =
            effectiveMode === "selection"
              ? clamp(Math.round(rect.y - targetRect.top), 0, Math.max(Math.round(targetRect.height), 1))
              : 0;
          const cropWidth =
            effectiveMode === "selection"
              ? clamp(Math.round(rect.width), 1, Math.max(Math.round(targetRect.width) - cropX, 1))
              : Math.max(1, Math.round(targetRect.width || window.innerWidth));
          const cropHeight =
            effectiveMode === "selection"
              ? clamp(Math.round(rect.height), 1, Math.max(Math.round(targetRect.height) - cropY, 1))
              : Math.max(1, Math.round(captureHeight));
          if (shouldUseFallbackSelectionCapture) {
            file = await buildFallbackCaptureFile(rect, fileName);
          } else {
          const html2canvasModule = await import("html2canvas");
          const renderCanvas = html2canvasModule.default(captureTarget as HTMLElement, {
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
            scale: effectiveMode === "selection" ? 1.25 : Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2),
            x: cropX,
            y: cropY,
            width: cropWidth,
            height: cropHeight,
            windowWidth:
              effectiveMode === "selection"
                ? Math.ceil(Math.max((captureTarget as HTMLElement).scrollWidth || 0, targetRect.width || window.innerWidth))
                : Math.ceil(targetRect.width || window.innerWidth),
            windowHeight:
              effectiveMode === "selection"
                ? Math.ceil(Math.max((captureTarget as HTMLElement).scrollHeight || 0, targetRect.height || window.innerHeight))
                : Math.ceil(cropHeight),
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDocument) => {
              sanitizeClonedCaptureDocument(clonedDocument);
            },
          });
          try {
            const canvas = await Promise.race([
              renderCanvas,
              new Promise<HTMLCanvasElement>((_, reject) => {
                window.setTimeout(() => reject(new Error("CAPTURE_RENDER_TIMEOUT")), 8000);
              }),
            ]);
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
            if (!blob) throw new Error("截图失败");
            file = new File([blob], fileName, { type: "image/png" });
          } catch (renderError) {
            if (effectiveMode !== "selection" || !(renderError instanceof Error) || renderError.message !== "CAPTURE_RENDER_TIMEOUT") {
              throw renderError;
            }
            file = await buildFallbackCaptureFile(rect, fileName);
          }
          if (fallbackMessage) {
            setComposerError(fallbackMessage);
          }
          }
        }
      } finally {
        captureOverlays.forEach((node, index) => {
          node.style.visibility = previousVisibilities[index] || "";
        });
      }

      attachScreenshotImmediately(file, effectiveMode === "selection" ? "已添加框选截图" : "已添加整页长截图");
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : "当前页面截图失败了");
    } finally {
      setCapturing(false);
      resetCaptureState();
    }
  };

  const submitQuestion = async (rawText?: string) => {
    const text = (rawText ?? inputValue).trim();
    if (!text && attachments.length === 0) {
      setComposerError("先输入一个问题，或者先附上一张截图 / 资料。");
      return;
    }
    if (attachments.some((item) => item.uploadStatus === "uploading")) {
      setComposerError("截图还在上传，请稍等几秒后再发送。");
      return;
    }

    setComposerError("");
    setSending(true);
    beginUiProgress(0.14);
    setUiProgress(0.24);
    const askedAt = formatTime();
    const outgoingAttachments = attachments;
    const effectiveQuestionText = buildAttachmentQuestion(text, outgoingAttachments);
    const attachmentExtractedSummary = buildAttachmentExtractedSummary(outgoingAttachments);
    const evidenceAttachments = outgoingAttachments
      .filter((item) => (item.extractedText || "").trim())
      .map((item) => item.name);
    const imageAttachmentUrls = outgoingAttachments
      .filter((item) => (item.mimeType || "").startsWith("image/") && item.uploadStatus !== "local")
      .map((item) => item.assetUrl);
    const isClassroomPage = typeof window !== "undefined" && window.location.pathname === "/learn";
    const shouldUseSystemKnowledgeAnswer = outgoingAttachments.length === 0 && isSystemUsageQuestion(text);
    const hasCurrentVideoContext =
      outgoingAttachments.length === 0 &&
      isClassroomPage &&
      !shouldUseSystemKnowledgeAnswer &&
      (Boolean(initialVideoSrc) || typeof initialStartAt === "number" || typeof initialVideoFileId === "number");
    const quickLocalReply = outgoingAttachments.length === 0 ? buildQuickLocalReply(text, initialTitle, initialSubtitle) : null;
    const promptLines = [effectiveQuestionText || (attachmentExtractedSummary ? "请结合这份附件讲解重点，并先概括核心内容。" : "")];
    const modeInstruction = buildModeInstruction(initialMode || "default");
    if (shouldUseSystemKnowledgeAnswer) {
      promptLines.push("请基于本地知识库回答该系统如何使用，并列出命中的本地知识库依据；不要按当前视频片段回答。");
    }
    if (modeInstruction && !shouldUseSystemKnowledgeAnswer) promptLines.push(modeInstruction);
    if (!shouldUseSystemKnowledgeAnswer) {
      if (isClassroomPage && initialVideoFileName) promptLines.push(`视频文件：${initialVideoFileName}`);
      if (initialResourceTitle) promptLines.push(`当前资料：${getResourceTypeLabel(initialResourceType)}《${initialResourceTitle}》`);
      if (initialResourceSummary) promptLines.push(`资料摘要：${initialResourceSummary}`);
      if (isClassroomPage && typeof initialStartAt === "number") promptLines.push(`参考时间：${Math.max(0, Math.floor(initialStartAt))} 秒`);
    }
    if (resolvedTutorMemory.length) {
      promptLines.push(
        [
          "已解决问题记忆：",
          ...resolvedTutorMemory.slice(0, 5).map((item, index) => `${index + 1}. 已问：${item.question}；已答：${item.answer}`),
          "如果用户再次提到相同问题，请先承接已解决结论，不要重复当成新问题。",
        ].join("\n"),
      );
    }
    if (attachmentExtractedSummary) {
      promptLines.push(attachmentExtractedSummary);
    } else if (extractedText && outgoingAttachments.length) {
      promptLines.push(`附件提取正文：\n${extractedText}`);
    }
    const finalQuestion = promptLines.filter(Boolean).join("\n\n");

    const userMessage: TutorMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: effectiveQuestionText || "请结合这份附件帮我分析。",
      createdAt: askedAt,
      attachments: outgoingAttachments.length ? outgoingAttachments : undefined,
      status: "completed",
    };

    if (hasCurrentVideoContext) {
      const pendingVideoMessage: TutorMessage = {
        id: `assistant-video-${Date.now()}`,
        role: "assistant",
        text: "正在结合当前视频时间点分析...",
        createdAt: askedAt,
        status: "pending",
      };
      setMessages((current) => [...current, userMessage, pendingVideoMessage]);
      setInputValue("");
      setAttachments([]);
      setExtractedText("");

      try {
        let answerText = "";
        let videoResponseSource = "video-local";
        if (typeof initialVideoFileId === "number") {
          const insightAnswer = await studentApi.askVideoInsight({
            resource_id: initialVideoResourceId ?? null,
            file_id: initialVideoFileId,
            question: effectiveQuestionText || text,
            current_time: typeof initialStartAt === "number" ? initialStartAt : undefined,
            resource_title: initialTitle,
            file_name: initialVideoFileName,
          });
          answerText = insightAnswer.answer || "";
          if (answerText.trim() && typeof insightAnswer.matched_time === "number") {
            answerText = `${answerText.trim()}\n\n定位时间：${formatVideoContextTime(insightAnswer.matched_time)}`;
          }
          if (answerText.trim()) {
            videoResponseSource = "video-insight";
          }
        }
        if (!answerText.trim()) {
          answerText = buildCurrentVideoLocalAnswer(
            effectiveQuestionText || text,
            initialTitle,
            initialSubtitle,
            initialStartAt,
            initialVideoFileName,
          );
        }
        setMessages((current) =>
          current.map((item) =>
            item.id === pendingVideoMessage.id
              ? {
                  ...item,
                  text: answerText,
                  status: "completed",
                  responseSource: videoResponseSource,
                }
              : item,
          ),
        );
      } catch {
        const answerText = buildCurrentVideoLocalAnswer(
          effectiveQuestionText || text,
          initialTitle,
          initialSubtitle,
          initialStartAt,
          initialVideoFileName,
        );
        setMessages((current) =>
          current.map((item) =>
            item.id === pendingVideoMessage.id
              ? {
                  ...item,
                  text: answerText,
                  status: "completed",
                  responseSource: "video-local",
                }
              : item,
          ),
        );
      } finally {
        finishUiProgress();
        setSending(false);
      }
      return;
    }

    if (quickLocalReply) {
      const assistantMessage: TutorMessage = {
        id: `assistant-local-${Date.now()}`,
        role: "assistant",
        text: quickLocalReply,
        createdAt: askedAt,
        status: "completed",
      };
      setMessages((current) => [...current, userMessage, assistantMessage]);
      setInputValue("");
      setAttachments([]);
      setExtractedText("");
      finishUiProgress();
      setSending(false);
      return;
    }

    if (!hasCurrentVideoContext && !shouldUseSystemKnowledgeAnswer && outgoingAttachments.length === 0 && looksLikeOnlineCourseSearch(text)) {
      const pendingSearchMessage: TutorMessage = {
        id: `assistant-web-search-${Date.now()}`,
        role: "assistant",
        text: "正在联网搜索可打开的课程链接...",
        createdAt: askedAt,
        status: "pending",
      };
      setMessages((current) => [...current, userMessage, pendingSearchMessage]);
      setInputValue("");
      setAttachments([]);
      setExtractedText("");
      try {
        const answerText = await searchOnlineCourseLinks(text);
        setMessages((current) =>
          current.map((item) =>
            item.id === pendingSearchMessage.id
              ? {
                  ...item,
                  text: answerText,
                  status: "completed",
                  responseSource: "web-search",
                }
              : item,
          ),
        );
      } catch {
        setMessages((current) =>
          current.map((item) =>
            item.id === pendingSearchMessage.id
              ? {
                  ...item,
                  text: "联网搜索暂时不可用，你可以稍后再试，或换一个更具体的课程关键词。",
                  status: "error",
                }
              : item,
          ),
        );
      } finally {
        finishUiProgress();
        setSending(false);
      }
      return;
    }

    const pendingAssistantMessage: TutorMessage = {
      id: `assistant-pending-${Date.now()}`,
      role: "assistant",
      text: buildPendingAssistantText(outgoingAttachments),
      createdAt: askedAt,
      evidenceAttachments: evidenceAttachments.length ? evidenceAttachments : undefined,
      status: "pending",
    };

    setMessages((current) => [...current, userMessage, pendingAssistantMessage]);
    setInputValue("");

    try {
      const questionPayload = {
        question_text: finalQuestion || "请结合附件内容进行讲解。",
        question_images: imageAttachmentUrls,
        course_id: resolvedCourseId,
        section_id: initialSectionId ? Number(initialSectionId) || undefined : undefined,
        session_id: activeQuestionId,
        persona: "haibara" as const,
      };
      let submitResponse;
      try {
        submitResponse = await studentApi.submitTutoringQuestion(questionPayload);
      } catch (error) {
        if (!activeQuestionId || !isInvalidTutoringSessionError(error)) {
          throw error;
        }
        const sectionKey = initialSectionId ? String(initialSectionId) : undefined;
        setActiveQuestionId(null);
        clearStoredTutorSession(resolvedUserId, initialCourseId, sectionKey);
        clearStoredTutorDraft(resolvedUserId, initialCourseId, sectionKey);
        submitResponse = await studentApi.submitTutoringQuestion({
          ...questionPayload,
          session_id: null,
        });
      }
      setUiProgress(0.52);

      let streamedText = "";
      let streamSettled = false;
      let streamedCompleteText = "";
      let streamedFinalAnswer: TutoringAnswerDetail | null = null;
      let socket: WebSocket | null = null;
      let streamReady = false;
      let sawStreamingChunk = false;
      let visualText = "";
      const pendingChunkQueue: string[] = [];
      let chunkPumpTimer: number | null = null;
      const flushStreamedText = (nextText?: string) => {
        const visibleText = nextText ?? visualText;
        setMessages((current) =>
          current.map((item) =>
            item.id === pendingAssistantMessage.id
              ? {
                  ...item,
                  text: visibleText || "正在生成回答...",
                  status: "pending",
                }
              : item,
          ),
        );
      };
      const stopChunkPump = () => {
        if (chunkPumpTimer !== null) {
          window.clearTimeout(chunkPumpTimer);
          chunkPumpTimer = null;
        }
      };
      const pumpChunkQueue = () => {
        chunkPumpTimer = null;
        const nextPiece = pendingChunkQueue.shift();
        if (!nextPiece) return;
        visualText += nextPiece;
        flushStreamedText(visualText);
        if (pendingChunkQueue.length > 0) {
          chunkPumpTimer = window.setTimeout(pumpChunkQueue, 18);
        }
      };
      const enqueueVisualChunk = (chunk: string) => {
        const parts = splitStreamingChunk(chunk);
        if (!parts.length) return;
        pendingChunkQueue.push(...parts);
        if (chunkPumpTimer === null) {
          pumpChunkQueue();
        }
      };
      try {
        const streamUrl = studentApi.getTutoringStreamUrl(submitResponse.question_id);
        socket = new WebSocket(streamUrl);
        socket.onopen = () => {
          streamReady = true;
        };
        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(String(event.data ?? "{}")) as Record<string, unknown>;
            const nextChunk = extractStreamingTextChunk(payload);
            if (nextChunk) {
              sawStreamingChunk = true;
              streamedText += nextChunk;
              enqueueVisualChunk(nextChunk);
            }
            const nextFinalText = extractStreamingFinalText(payload);
            if (nextFinalText) {
              streamedCompleteText = nextFinalText;
              if (!sawStreamingChunk) {
                streamedText = nextFinalText;
                visualText = "";
                pendingChunkQueue.length = 0;
                enqueueVisualChunk(nextFinalText);
              }
            }
            const nextFinalAnswer = extractStreamingFinalAnswer(payload);
            if (nextFinalAnswer) {
              streamedFinalAnswer = nextFinalAnswer;
            }
            if (isStreamingTerminalEvent(payload)) {
              streamSettled = true;
              socket?.close();
            }
          } catch {
            // Ignore malformed streaming payloads and keep the polling fallback.
          }
        };
        socket.onerror = () => {
          socket?.close();
        };
      } catch {
        socket = null;
      }

      const directAnswerPromise = (async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 6000));
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 18; attempt += 1) {
          try {
            const nextAnswer = await studentApi.getTutoringAnswer(submitResponse.question_id);
            if (nextAnswer.status === "processing") {
              await new Promise((resolve) => window.setTimeout(resolve, 3200));
              continue;
            }
            if (nextAnswer.status === "failed") {
              throw new Error(nextAnswer.error_message || nextAnswer.error || "AI 导师生成失败，请稍后重试。");
            }
            return nextAnswer;
          } catch (error) {
            lastError = error;
            if (!isTransientTutorFetchError(error)) {
              throw error;
            }
            if (streamSettled || streamedFinalAnswer || streamedCompleteText || streamedText) {
              return null;
            }
            await new Promise((resolve) => window.setTimeout(resolve, Math.min(5000, 1800 * (attempt + 1))));
          }
        }
        if (streamSettled || streamedFinalAnswer || streamedCompleteText || streamedText) {
          return null;
        }
        throw lastError instanceof Error ? lastError : new Error("AI 导师响应超时，请稍后重试。");
      })();

      let answer: TutoringAnswerDetail | null = null;
      const startedAt = Date.now();
      let nudgedLongWait = false;
      while (!answer) {
        if (streamSettled && (streamedFinalAnswer || streamedCompleteText || streamedText)) {
          break;
        }

        const settled = await Promise.race([
          directAnswerPromise.then((value) => ({ kind: "answer" as const, value })),
          new Promise<{ kind: "tick" }>((resolve) =>
            window.setTimeout(() => resolve({ kind: "tick" }), streamReady ? 400 : 180),
          ),
        ]);
        if (settled.kind === "answer") {
          if (settled.value && settled.value.status !== "processing") {
            answer = settled.value;
            break;
          }
          continue;
        }

        const elapsed = Date.now() - startedAt;
        if (!nudgedLongWait && elapsed > 15000) {
          nudgedLongWait = true;
          setMessages((current) =>
            current.map((item) =>
              item.id === pendingAssistantMessage.id
                ? {
                    ...item,
                    text:
                      visualText ||
                      streamedText ||
                      "内容稍微复杂一点，AI 导师还在继续生成，我会自动等待完成后回填。",
                    status: "pending",
                  }
                : item,
            ),
          );
        }
      }
      if (socket && socket.readyState === WebSocket.OPEN && !streamSettled) {
        socket.close();
      }
      stopChunkPump();
      setUiProgress(0.92);
      const resolvedAnswer = answer || streamedFinalAnswer;
      const finalRenderedText = (
        (resolvedAnswer ? buildAnswerText(resolvedAnswer) : "") ||
        streamedCompleteText ||
        streamedText
      ).trim();
      const answerMessage: TutorMessage = {
        id: `assistant-${submitResponse.question_id}`,
        role: "assistant",
        text: finalRenderedText || "导师暂时还没有返回可展示的回答。",
        createdAt: formatTime(),
        evidenceAttachments: evidenceAttachments.length ? evidenceAttachments : undefined,
        videos:
          resolvedAnswer?.videos ||
          (
            resolvedAnswer as (TutoringAnswerDetail & {
              answer_videos?: TutoringVideoRecommendation[] | null;
            }) | null
          )?.answer_videos ||
          undefined,
        status: "completed",
        localFallback: false,
        responseSource: resolvedAnswer?.source || "ai",
        fallbackReason: resolvedAnswer?.fallback_reason || null,
        safetyReview: resolvedAnswer?.safety_review || null,
        hallucinationReview: resolvedAnswer?.hallucination_review || null,
        referenceSources: resolvedAnswer?.reference_sources || null,
        knowledgePoints: normalizeKnowledgePoints(resolvedAnswer),
        confidenceScore: resolvedAnswer?.confidence_score || null,
        questionType: resolvedAnswer?.question_type || resolvedAnswer?.question_analysis?.question_type || null,
      };

      setMessages((current) =>
        current.map((item) => (item.id === pendingAssistantMessage.id ? answerMessage : item)),
      );
      if (
        outgoingAttachments.length === 0 &&
        shouldAutoAttachCourseLinks(text) &&
        !answerMessage.videos?.length &&
        !/相关视频\/课程链接|Bilibili|bilibili|哔哩/.test(answerMessage.text)
      ) {
        void buildAutoCourseLinksSection(text).then((linksSection) => {
          setMessages((current) =>
            current.map((item) =>
              item.id === answerMessage.id && !/相关视频\/课程链接|Bilibili|bilibili|哔哩/.test(item.text)
                ? {
                    ...item,
                    text: `${item.text}${linksSection}`,
                    responseSource: item.responseSource || "ai",
                  }
                : item,
            ),
          );
        });
      }
      const nextSessionId = String(submitResponse.session_id || submitResponse.question_id);
      setActiveQuestionId(nextSessionId);
      saveStoredTutorSession(
        nextSessionId,
        resolvedUserId,
        initialCourseId,
        initialSectionId ? String(initialSectionId) : undefined,
      );
      setSessionTitleMap((current) => {
        if (current[nextSessionId]) return current;
        const next = {
          ...current,
          [nextSessionId]: buildSessionSummaryTitle({
            question: {
              id: String(submitResponse.question_id),
              session_id: nextSessionId,
              question_text: finalQuestion || text || "新的对话",
              create_time: new Date().toISOString(),
            },
            answer: {
              id: `answer-${submitResponse.question_id}`,
              question_id: String(submitResponse.question_id),
              session_id: nextSessionId,
              answer_text: resolvedAnswer?.answer_text || streamedCompleteText || streamedText || "",
              create_time: new Date().toISOString(),
            },
          } as TutoringHistoryItem),
        };
        saveStoredSessionTitles(next);
        return next;
      });
      const localHistoryItem: TutoringHistoryItem = {
        question: {
          id: String(submitResponse.question_id),
          session_id: nextSessionId,
          question_text: finalQuestion || text || "新的对话",
          persona: "haibara",
          course_id: resolvedCourseId,
          section_id: initialSectionId ? Number(initialSectionId) || null : null,
          question_type: initialMode || "default",
          knowledge_points: [],
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
        },
        answer: {
          id: resolvedAnswer?.answer_id || `answer-${submitResponse.question_id}`,
          question_id: String(submitResponse.question_id),
          session_id: nextSessionId,
          answer_text: finalRenderedText || resolvedAnswer?.answer_text || streamedCompleteText || streamedText || "",
          answer_diagrams: resolvedAnswer?.diagrams || null,
          answer_videos: resolvedAnswer?.videos || null,
          reference_sources: resolvedAnswer?.reference_sources || null,
          confidence_score: resolvedAnswer?.confidence_score || null,
          generation_time: resolvedAnswer?.generation_time || null,
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
        },
        is_favorited: false,
      };
      setHistoryItems((current) => {
        const next = [localHistoryItem, ...current.filter((item) => String(item.question.id) !== String(submitResponse.question_id))].slice(0, 30);
        saveTutorHistoryCache(next, resolvedUserId, initialCourseId);
        return next;
      });
      rememberTutorResolvedIssue(resolvedUserId, initialCourseId, effectiveQuestionText || text, finalRenderedText);
      setAttachments([]);
      setExtractedText("");
      studentApi
        .listTutoringHistory({
          course_id: resolvedCourseId,
          page: 1,
          page_size: 8,
        })
        .then((refreshed) => {
          if (refreshed.items?.length) {
            setHistoryItems(refreshed.items);
            saveTutorHistoryCache(refreshed.items, resolvedUserId, initialCourseId);
          }
        })
        .catch(() => {
          // History refresh is helpful, but it should never keep the composer stuck in "sending".
        });
    } catch (error) {
      const errorText = buildTutorErrorMessage(error);
      setMessages((current) =>
        current.map((item) =>
          item.id === pendingAssistantMessage.id
            ? {
                ...item,
                text: errorText,
                status: "error",
                localFallback: false,
              }
            : item,
        ),
      );
    } finally {
      finishUiProgress();
      setSending(false);
    }
  };

  const handleCopyExtractedText = async () => {
    if (!extractedText) return;
    try {
      await navigator.clipboard.writeText(extractedText);
      setToastMessage("正文已复制");
    } catch {
      setToastMessage("复制失败，请手动选择内容");
    }
  };

  const handleInsertExtractedText = () => {
    if (!extractedText) return;
    setInputValue(buildAttachmentPrompt(extractedText));
    setToastMessage("正文已插入输入框");
  };

  const handleSendExtractedText = () => {
    if (!extractedText) return;
    void submitQuestion(buildAttachmentPrompt(extractedText));
  };

  const overlaySelection = captureRect && captureMode === "selection" && captureRect.width > 1 && captureRect.height > 1;
  const containerClassName = embedded
    ? "flex h-full min-h-0 bg-transparent"
    : "mx-auto flex h-[calc(100vh-64px)] max-w-7xl bg-transparent px-4 py-4";

  return (
    <>
      <div ref={tutorSurfaceRef} className={containerClassName}>
        <div className="relative flex h-full min-h-0 w-full overflow-hidden rounded-[28px] border border-[#E7ECF0] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <aside className="hidden">
            <div className="border-b border-[#E7ECF0] px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF2F7] text-[#E85D8E]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">AI 导师</p>
                  <p className="text-xs text-[#64748b]">{buildModeSubtitle(initialMode || "default")}</p>
                </div>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="rounded-2xl border border-[#E7ECF0] bg-white px-4 py-4">
                <p className="text-sm font-semibold text-[#0f172a]">{initialTitle || "当前课程"}</p>
                <p className="mt-2 text-xs leading-6 text-[#64748b]">
                  {initialSubtitle || "你可以围绕当前课程、视频片段、截图或资料直接提问。"}
                </p>
                {initialResourceTitle ? (
                  <div className="mt-3 rounded-2xl bg-[#F8FAFC] px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#667085]">
                        {getResourceTypeLabel(initialResourceType)}
                      </span>
                      <p className="min-w-0 truncate text-xs font-semibold text-[#111827]">{initialResourceTitle}</p>
                    </div>
                    {initialResourceSummary ? (
                      <p className="mt-2 text-[11px] leading-5 text-[#667085]">{initialResourceSummary}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {extractedText ? (
              <div className="px-5 pb-4">
                <div className="rounded-2xl border border-[#F5D0E0] bg-[#FFF8FB] px-4 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#d64d82]">已提取正文</div>
                    <button
                      type="button"
                      onClick={() => setShowExtractedText((value) => !value)}
                      className="text-[11px] font-semibold text-[#d64d82]"
                    >
                      {showExtractedText ? "收起正文" : "展开正文"}
                    </button>
                  </div>
                  {showExtractedText ? (
                    <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl bg-white px-3 py-3 text-[11px] leading-5 text-[#344054]">
                      {extractedText}
                    </pre>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopyExtractedText()}
                      aria-label="复制提取正文"
                      className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#344054]"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      复制正文
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertExtractedText}
                      aria-label="插入提取正文到输入框"
                      className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#344054]"
                    >
                      插入输入框
                    </button>
                    <button
                      type="button"
                      onClick={handleSendExtractedText}
                      aria-label="发送提取正文"
                      className="rounded-full bg-[#171c22] px-3 py-1.5 text-[11px] font-semibold text-white"
                    >
                      发送这段正文
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 px-3 pb-3">
              <div className="mb-3 flex items-center justify-between px-2">
                <p className="text-xs font-semibold tracking-[0.18em] text-[#94a3b8]">最近会话</p>
                {historyLoading ? <LoaderCircle className="h-4 w-4 animate-spin text-[#94a3b8]" /> : null}
              </div>

              <button
                type="button"
                onClick={() => setHistoryFullscreen(true)}
                className="flex h-[92px] w-full items-center justify-center rounded-[26px] border border-[#E7ECF0] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:border-[#E85D8E]/35 hover:bg-[#FFF9FC]"
                title="打开最近会话页"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#171c22] text-white">
                    <div className="text-center text-sm font-black leading-4">
                      最近
                      <br />
                      会话
                    </div>
                  </div>
                  <div className="text-[11px] font-semibold text-[#667085]">点击进入完整会话页</div>
                </div>
              </button>

              {historyError ? (
                <div className="mt-3 rounded-[18px] border border-[#F5D0D0] bg-[#FFF7F7] px-3 py-2.5 text-xs leading-5 text-[#B42318]">
                  {historyError}
                </div>
              ) : null}
            </div>
          </aside>

          <section data-tutor-reveal className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)]">
            {historyFullscreen ? (
              <>
                <div className="border-b border-[#EEF2F6] px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF2F7] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#e85d8e]">
                        <Sparkles className="h-3.5 w-3.5" />
                        Session Deck
                      </div>
                      <h2 className="mt-3 text-lg font-extrabold text-[#171c22]">最近会话页</h2>
                      <p className="mt-1 text-sm leading-6 text-[#667085]">这里是独立于 AI 导师主会话的完整最近会话页，适合集中检索、回看与续聊。</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleStartFreshConversation}
                        className="rounded-full bg-[#171c22] px-4 py-2 text-xs font-semibold text-white transition hover:bg-black"
                      >
                        新建对话
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryFullscreen(false)}
                        className="rounded-full border border-[#E7ECF0] bg-white px-4 py-2 text-xs font-semibold text-[#344054] transition hover:border-[#d8dee6] hover:bg-[#f8fafc]"
                        title="返回 AI 导师"
                      >
                        返回导师
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <input
                      value={historySearch}
                      onChange={(event) => setHistorySearch(event.target.value)}
                      className="w-full rounded-2xl border border-[#E7ECF0] bg-white px-4 py-3 text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
                      placeholder="搜索历史会话"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  {historyError ? (
                    <div className="rounded-2xl border border-[#F5D0D0] bg-[#FFF7F7] px-4 py-4 text-sm text-[#B42318]">{historyError}</div>
                  ) : null}

                  {!historyLoading && filteredHistoryItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#D7DEE7] bg-white px-4 py-6 text-sm leading-7 text-[#64748b]">
                      暂时还没有匹配的历史提问。
                    </div>
                  ) : null}

                  <div className="space-y-5">
                    {groupedHistoryItems.map((group) => (
                      <div key={group.label} className="space-y-3">
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsedHistoryGroups((current) => ({
                              ...current,
                              [group.label]: !current[group.label],
                            }))
                          }
                          className="flex w-full items-center justify-between rounded-2xl bg-[#f8fafc] px-3 py-2 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#94a3b8]">{group.label}</div>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#667085]">
                              {group.items.length}
                            </span>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 text-[#98a2b3] transition-transform ${
                              collapsedHistoryGroups[group.label] ? "-rotate-90" : ""
                            }`}
                          />
                        </button>
                        {!collapsedHistoryGroups[group.label] ? (
                        <div className="grid gap-3 xl:grid-cols-2">
                          {group.items.map((item) => {
                            const itemSessionId = String(item.question.session_id || item.answer?.session_id || item.question.id);
                            const active = activeQuestionId === itemSessionId;
                            const busy = historyBusyQuestionId === String(item.question.id);
                            return (
                              <div
                                key={item.question.id}
                                className={`rounded-[24px] border px-4 py-4 text-left transition ${
                                  active
                                    ? "border-[#E85D8E] bg-[#FFF6FA] shadow-[0_12px_24px_rgba(232,93,142,0.12)]"
                                    : "border-[#E7ECF0] bg-white hover:border-[#d8dee6] hover:bg-[#fcfdff]"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <button
                                      type="button"
                                      onClick={() => openHistoryItem(item)}
                                      className="min-w-0 text-left"
                                    >
                                      <div className="line-clamp-1 text-[15px] font-semibold text-[#0f172a]">
                                        {resolveSessionTitle(item, sessionTitleMap)}
                                      </div>
                                      <div className="mt-2 line-clamp-2 text-sm leading-6 text-[#64748b]">{buildSessionPreview(item)}</div>
                                    </button>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <div className="text-[11px] text-[#94a3b8]">{formatHistoryTime(item.question.create_time)}</div>
                                    <div className="mt-2 flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void handleToggleHistoryFavorite(item)}
                                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                                          item.is_favorited
                                            ? "bg-[#fff1f5] text-[#e85d8e]"
                                            : "bg-[#f5f7fa] text-[#667085] hover:bg-[#eef2f6] hover:text-[#171c22]"
                                        } disabled:opacity-50`}
                                        title={item.is_favorited ? "取消收藏" : "收藏会话"}
                                      >
                                        <Heart className={`h-3.5 w-3.5 ${item.is_favorited ? "fill-current" : ""}`} />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void handleDeleteHistoryItem(item)}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f5f7fa] text-[#667085] transition hover:bg-[#fff1f3] hover:text-[#d92d20] disabled:opacity-50"
                                        title="删除会话"
                                      >
                                        {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
            <div className="border-b border-[#EEF2F6] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF2F7] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#e85d8e]">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Tutor
                  </div>
                  <button
                    type="button"
                    onClick={handleStartFreshConversation}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-semibold text-[#344054] transition hover:bg-[#F5F7FA] hover:text-[#171c22]"
                    title="开启一条新的导师会话"
                    aria-label="新对话"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    新对话
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHistoryFullscreen(true)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F7FA] text-[#667085] transition hover:bg-[#EEF2F6] hover:text-[#171c22]"
                    title="最近会话"
                    aria-label="最近会话"
                  >
                    <MessageCircleMore className="h-4 w-4" />
                  </button>
                  {onClose ? (
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F7FA] text-[#667085] transition hover:bg-[#EEF2F6] hover:text-[#171c22]"
                      title="关闭 AI 导师"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              {!collapsed ? (
            <div className="mt-2 overflow-x-auto pb-1">
                  <div className="flex w-max gap-2 pr-2">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInputValue(prompt)}
                      className="whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#564145] shadow-sm ring-1 ring-[#E7ECF0] transition hover:bg-[#FFF8FB]"
                    >
                      {prompt}
                    </button>
                  ))}
                  </div>
                </div>
              ) : null}
            </div>

            {!collapsed ? (
              <>
                <div ref={listRef} className={`flex-1 space-y-3 px-4 py-3 ${previewAttachment ? "overflow-hidden" : "overflow-y-auto"}`}>
                  {messages.length === 0 ? (
                    <div className="flex h-full min-h-[220px] items-center justify-center">
                      <div className="max-w-[320px] rounded-[22px] border border-dashed border-[#D6DEE8] bg-white/72 px-5 py-5 text-center shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F5F7FA] text-[#667085]">
                          <MessageCircleMore className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-[13px] font-bold text-[#171c22]">还没有对话记录</div>
                        <p className="mt-1 text-[12px] leading-5 text-[#667085]">
                          直接输入问题，或选择上方快捷问题开始；课堂上下文会在回答时自动参考。
                        </p>
                      </div>
                    </div>
                  ) : messages.map((message) => (
                    <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex gap-3"}>
                      {message.role === "assistant" ? (
                        <div className="flex h-8 w-8 shrink-0 overflow-hidden rounded-2xl border border-[#f4d8e4] bg-[linear-gradient(180deg,#fff7fb,#fff1f6)] shadow-[0_8px_18px_rgba(232,93,142,0.14)]">
                          {resolvedUserProfile?.avatar ? (
                            <img src={resolvedUserProfile.avatar} alt={resolvedUserProfile.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[#e85d8e]">
                              <Sparkles className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      ) : null}
                      <div className="max-w-[88%]">
                        <div
                          className={
                            message.role === "user"
                              ? "rounded-[20px] rounded-br-md bg-[#171c22] px-3.5 py-2.5 text-[13px] leading-5 text-white"
                              : "rounded-[20px] rounded-tl-md border border-[#EEF2F6] bg-white px-3.5 py-2.5 text-[13px] leading-5 text-[#171c22]"
                          }
                        >
                          {message.role === "assistant" ? (
                            shouldRenderTutorMarkdown(cleanTutorDisplayText(message.text)) ? (
                              <MarkdownRenderer
                                content={cleanTutorDisplayText(message.text)}
                                className="[&_.katex]:text-inherit [&_h1]:text-[#171c22] [&_h2]:text-[#171c22] [&_h3]:text-[#171c22]"
                              />
                            ) : (
                              <p className="whitespace-pre-wrap">{cleanTutorDisplayText(message.text)}</p>
                            )
                          ) : (
                            <p className="whitespace-pre-wrap">{message.text}</p>
                          )}
                          {message.videos?.length ? (
                            <div className="mt-4 space-y-3">
                              <div className="overflow-hidden rounded-[18px] border border-[#E7ECF0]">
                                <div className="grid grid-cols-[56px_110px_minmax(220px,1fr)_minmax(200px,1fr)] gap-0 bg-[#F8FAFC] px-3 py-2 text-[11px] font-bold text-[#475467]">
                                  <span>#</span>
                                  <span>平台</span>
                                  <span>标题</span>
                                  <span>链接</span>
                                </div>
                                <div className="divide-y divide-[#EEF2F6]">
                                  {message.videos.map((video, index) => (
                                    <div
                                      key={`${video.video_id}-${index}`}
                                      className="grid grid-cols-[56px_110px_minmax(220px,1fr)_minmax(200px,1fr)] gap-0 px-3 py-3 text-[12px] text-[#171c22]"
                                    >
                                      <span className="font-semibold text-[#667085]">{index + 1}</span>
                                      <span>{video.source_platform || "Bilibili"}</span>
                                      <span className="pr-4 leading-6">{video.title}</span>
                                      <a
                                        href={video.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="truncate text-[#0b5f85] underline-offset-2 hover:underline"
                                      >
                                        {video.url}
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="text-[12px] font-semibold text-[#344054]">
                                  视频学习资源 {message.videos.length}
                                </div>
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                  {message.videos.map((video, index) => (
                                    <a
                                      key={`card-${video.video_id}-${index}`}
                                      href={video.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="group overflow-hidden rounded-[20px] border border-[#E7ECF0] bg-white transition hover:-translate-y-0.5 hover:border-[#E85D8E]/30 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
                                    >
                                      <div className="relative aspect-[16/10] bg-[linear-gradient(135deg,#f8fafc,#eef2f6)]">
                                        {video.thumbnail ? (
                                          <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover" />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center text-[#98A2B3]">
                                            <PanelTop className="h-8 w-8" />
                                          </div>
                                        )}
                                        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
                                          <span className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white">
                                            {video.source_platform || "Bilibili"}
                                          </span>
                                          {formatVideoDuration(video.duration) ? (
                                            <span className="rounded-full bg-white/88 px-2.5 py-1 text-[10px] font-semibold text-[#111827]">
                                              {formatVideoDuration(video.duration)}
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                      <div className="p-3">
                                        <div className="line-clamp-2 text-[13px] font-semibold leading-6 text-[#171c22]">
                                          {video.title}
                                        </div>
                                        {video.recommendation_reason ? (
                                          <div className="mt-2 line-clamp-2 text-[11px] leading-5 text-[#667085]">
                                            {video.recommendation_reason}
                                          </div>
                                        ) : null}
                                        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-[#98A2B3]">
                                          <span>{video.bv_id || "外部资源"}</span>
                                          <span className="font-semibold text-[#E85D8E]">
                                            {typeof video.relevance_score === "number"
                                              ? `匹配 ${Math.round(video.relevance_score * 100)}%`
                                              : "打开观看"}
                                          </span>
                                        </div>
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : null}
                          {message.role === "assistant" ? (
                            <KnowledgeEvidencePanel
                              sources={message.referenceSources}
                              knowledgePoints={message.knowledgePoints}
                              confidenceScore={message.confidenceScore}
                              questionType={message.questionType}
                            />
                          ) : null}
                          {message.attachments?.length ? (
                            <div className="mt-2.5 flex flex-wrap gap-2">
                              {message.attachments.map((attachment) =>
                                attachment.previewUrl ? (
                                  <button
                                    key={attachment.id}
                                    type="button"
                                    onClick={() => setPreviewAttachment(attachment)}
                                    className="overflow-hidden rounded-xl"
                                  >
                                    <img src={attachment.previewUrl} alt={attachment.name} className="h-16 w-20 object-cover ring-1 ring-white/10" />
                                  </button>
                                ) : (
                                  <a
                                    key={attachment.id}
                                    href={attachment.assetUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs"
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                    {attachment.name}
                                  </a>
                                ),
                              )}
                            </div>
                          ) : null}
                          {message.role === "user" && hasExtractedAttachment(message.attachments) ? (
                            <div className="mt-2 rounded-2xl border border-[#f3c8d8] bg-[#fff7fb] px-3 py-2 text-[11px] leading-5 text-[#b42363]">
                              这次提问已带入附件提取正文，回答会优先结合文档/资料内容。
                            </div>
                          ) : null}
                          {message.role === "assistant" && message.evidenceAttachments?.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {message.evidenceAttachments.map((name) => (
                                <span
                                  key={`${message.id}-${name}`}
                                  className="rounded-full border border-[#f3c8d8] bg-[#fff7fb] px-3 py-1 text-[11px] font-medium text-[#b42363]"
                                >
                                  已结合附件：{name}
                                </span>
                              ))}
                              {message.localFallback ? (
                                <span className="rounded-full border border-[#fde68a] bg-[#fffbea] px-3 py-1 text-[11px] font-medium text-[#b54708]">
                                  附件识别保护已生效：当前为基于提取正文的快速结果
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                          {message.role === "assistant" && message.localFallback && !message.evidenceAttachments?.length ? (
                            <div className="mt-2">
                              <span className="rounded-full border border-[#fde68a] bg-[#fffbea] px-3 py-1 text-[11px] font-medium text-[#b54708]">
                                附件识别保护已生效：当前为基于提取正文的快速结果
                              </span>
                            </div>
                          ) : null}
                          {message.role === "assistant" && message.responseSource === "fallback" && !message.localFallback ? (
                            <div className="mt-2">
                              <span className="rounded-full border border-[#dbeafe] bg-[#f8fbff] px-3 py-1 text-[11px] font-medium text-[#1d4ed8]">
                                已切换本地省额度模式：当前回答优先使用本地解析与降级链路生成
                              </span>
                            </div>
                          ) : null}
                          {message.role === "assistant" && extractBlockedFromReview(message.safetyReview) ? (
                            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>{extractReviewSummary(message.safetyReview) || "这条回答触发了内容安全保护，已自动收敛输出。"}</span>
                              </div>
                            </div>
                          ) : null}
                          {message.role === "assistant" &&
                          !extractBlockedFromReview(message.safetyReview) &&
                          extractUngroundedReview(message.hallucinationReview) ? (
                            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>{extractUngroundedSummary(message.hallucinationReview) || "这条回答有部分内容待核验，建议结合课程资料再确认。"}</span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-1 text-[11px] text-[#98A2B3]">{message.createdAt}</div>
                      </div>
                    </div>
                  ))}

                </div>

                <div className="border-t border-[#EEF2F6] bg-white px-4 py-3">
                  {attachments.length ? (
                    <div className="mb-2.5 flex gap-2 overflow-x-auto">
                      {attachments.map((item) => (
                        <div key={item.id} className="relative w-[112px] shrink-0 overflow-hidden rounded-xl ring-1 ring-[#E9EEF3]">
                          {item.previewUrl ? (
                            <button type="button" onClick={() => setPreviewAttachment(item)} className="block w-full text-left">
                              <img src={item.previewUrl} alt={item.name} className="h-16 w-full object-cover" />
                              <div className="truncate bg-white px-2 py-1 text-[10px] text-[#475467]">{item.name}</div>
                            </button>
                          ) : (
                            <a href={item.assetUrl} target="_blank" rel="noreferrer" className="block bg-white px-2 py-3 text-[10px] text-[#475467]">
                              <div className="flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5" />
                                <span className="truncate">{item.name}</span>
                              </div>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAttachment(item.id)}
                            className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-white"
                            aria-label={`移除附件 ${item.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                          {item.uploadStatus === "uploading" ? (
                            <div className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                              上传中
                            </div>
                          ) : item.extractedText ? (
                            <div className="absolute left-1.5 top-1.5 rounded-full bg-[#fff7fb] px-1.5 py-0.5 text-[9px] font-semibold text-[#b42363] ring-1 ring-[#f3c8d8]">
                              已提取正文
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {hasExtractedAttachment(attachments) ? (
                    <div className="mb-2.5 rounded-2xl border border-[#f3c8d8] bg-[#fff7fb] px-3 py-2 text-[11px] leading-5 text-[#b42363]">
                      当前附件已提取正文。发送后会优先识别附件类型，再概括主要内容和关键要点。
                    </div>
                  ) : null}

                  {(sending || uploading || capturing) ? (
                    <div className="mb-3 rounded-[22px] border border-[#e8edf2] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_56%,#fff5f8_100%)] px-4 py-4">
                      <AILoadingLottie
                        caption={
                          sending
                            ? (hasExtractedAttachment(attachments)
                              ? "正在识别附件内容并生成讲解"
                              : "AI 导师正在组织回答")
                            : capturing
                              ? "正在处理截图上下文"
                              : "正在上传附件并挂接上下文"
                        }
                        subcaption="当前会话会持续保留上下文，完成后会直接回填到这条对话里。"
                      />
                    </div>
                  ) : null}

                  <div className="rounded-[22px] border border-[#E7ECF0] bg-white p-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                    <textarea
                      id="ai-tutor-message-field"
                      ref={messageInputRef}
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      onPaste={(event) => void handlePasteCapture(event)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void submitQuestion();
                        }
                      }}
                      placeholder={userExperience.tutorPlaceholder}
                      className="min-h-[56px] w-full resize-none border-none bg-transparent px-1 py-1.5 text-[13px] leading-5 text-[#101828] outline-none placeholder:text-[#98A2B3]"
                    />

                    <div className="mt-1.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            ref={captureButtonRef}
                            id="ai-tutor-capture-btn"
                            type="button"
                            onClick={(event) => triggerCaptureButton(event, handleSelectionCaptureStart)}
                            disabled={sending || uploading || capturing}
                            aria-label="框选截图"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5F7FA] text-[#667085] transition hover:bg-[#EEF2F6] hover:text-[#171c22] disabled:opacity-50"
                            title="框选截图"
                          >
                            <Camera className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={handleLongPageCapture}
                            disabled={sending || uploading || capturing}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5F7FA] text-[#667085] transition hover:bg-[#EEF2F6] hover:text-[#171c22] disabled:opacity-50"
                            title="整页长截图"
                          >
                            <PanelTop className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={sending || uploading}
                            aria-label="上传图片或文档"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5F7FA] text-[#667085] transition hover:bg-[#EEF2F6] hover:text-[#171c22] disabled:opacity-50"
                            title="上传图片或文档"
                          >
                            {uploading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          </button>
                        </div>

                        <button
                          id="ai-chat-send-btn"
                          type="button"
                          onClick={() => void submitQuestion()}
                          disabled={
                            sending ||
                            uploading ||
                            attachments.some((item) => item.uploadStatus === "uploading") ||
                            (!inputValue.trim() && attachments.length === 0)
                          }
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#171717] px-4 text-[12px] font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span>{sending ? "发送中" : "发送"}</span>
                          {!sending ? <Send className="h-3.5 w-3.5" /> : null}
                        </button>
                      </div>

                      <div className="text-[11px] leading-4 text-[#98A2B3]">
                        {attachments.length
                          ? `已添加 ${attachments.length} 个附件`
                          : "左一是框选截图，左二是整页长截图，也支持 Ctrl+V 粘贴截图和上传文件"}
                      </div>
                    </div>
                  </div>

                  {composerError ? <div className="mt-2 text-xs text-[#d92d20]">{composerError}</div> : null}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.txt,.md,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                    multiple
                    className="hidden"
                    onChange={handleUpload}
                  />
                </div>
              </>
            ) : (
              <div className="px-4 py-3 text-[12px] text-[#667085]">已收起，展开后可继续提问、截图和追问。</div>
            )}
              </>
            )}
          </section>

        </div>
      </div>

      {capturePending &&
        createPortal(
          <div
            data-capture-overlay="true"
            className="fixed inset-0 z-[12000] cursor-crosshair bg-[rgba(15,23,42,0.18)]"
            onPointerDown={(event) => {
              if (captureMode !== "selection" || (event.target as HTMLElement).closest("[data-capture-controls='true']")) return;
              const x = clamp(event.clientX, 0, window.innerWidth);
              const y = clamp(event.clientY, 0, window.innerHeight);
              const screenX = event.screenX;
              const screenY = event.screenY;
              dragStartRef.current = { x, y, screenX, screenY };
              setDragging(true);
              setCaptureRect({
                x,
                y,
                width: 0,
                height: 0,
                screenX,
                screenY,
              });
            }}
            onPointerMove={(event) => {
              if (!dragging || captureMode !== "selection" || !dragStartRef.current) return;
              const x = clamp(event.clientX, 0, window.innerWidth);
              const y = clamp(event.clientY, 0, window.innerHeight);
              const start = dragStartRef.current;
              const screenX = event.screenX;
              const screenY = event.screenY;
              setCaptureRect({
                x: Math.min(start.x, x),
                y: Math.min(start.y, y),
                width: Math.abs(x - start.x),
                height: Math.abs(y - start.y),
                screenX: Math.min(start.screenX, screenX),
                screenY: Math.min(start.screenY, screenY),
              });
            }}
            onPointerUp={() => {
              setDragging(false);
              dragStartRef.current = null;
            }}
            onPointerLeave={() => {
              setDragging(false);
              dragStartRef.current = null;
            }}
          >
            <div
              data-capture-controls="true"
              className="pointer-events-auto absolute left-1/2 top-6 z-[12010] flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-3 py-2 shadow-[0_12px_30px_rgba(15,23,42,0.16)]"
            >
              <div className="rounded-full bg-[#171c22] px-3 py-1.5 text-sm font-medium text-white">框选截图</div>
              <button
                type="button"
                onClick={() => void exportCapture({ mode: "selection" })}
                disabled={capturing || !overlaySelection}
                className="rounded-full bg-[#fb7299] px-4 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {capturing ? "生成中..." : "确认"}
              </button>
              <button
                type="button"
                onClick={resetCaptureState}
                disabled={capturing}
                className="rounded-full bg-[#F5F7FA] px-4 py-1.5 text-sm font-medium text-[#344054]"
              >
                取消
              </button>
            </div>

            <div data-capture-controls="true" className="pointer-events-none absolute left-1/2 top-20 z-[12010] -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white">
              拖出一个区域后，点击上方确认
            </div>

            {overlaySelection ? (
              <>
                <div
                  className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.42)]"
                  style={{ left: captureRect.x, top: captureRect.y, width: captureRect.width, height: captureRect.height }}
                />
                <div
                  className="pointer-events-none absolute rounded-full bg-black/72 px-2 py-1 text-[11px] text-white"
                  style={{ left: captureRect.x + captureRect.width + 10, top: captureRect.y + captureRect.height + 10 }}
                >
                  {Math.round(captureRect.width)} × {Math.round(captureRect.height)}
                </div>
              </>
            ) : null}
          </div>,
          document.body,
        )}

      {previewAttachment?.previewUrl &&
        createPortal(
          <div className="fixed inset-0 z-[12500] flex items-center justify-center bg-[rgba(15,23,42,0.68)] p-5">
            <div className="relative flex max-h-[92vh] w-[min(96vw,1600px)] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_32px_80px_rgba(15,23,42,0.3)]">
              <div className="flex items-center justify-between border-b border-[#EEF2F6] px-5 py-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-[#171c22]">{previewAttachment.name}</div>
                  <div className="mt-1 text-xs text-[#667085]">高清预览，关闭后可继续提问。</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F7FA] text-[#344054] transition hover:bg-[#EAEEF3]"
                  title="关闭预览"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center justify-center overflow-hidden bg-[#F8FAFC] p-4">
                <div className="flex w-full items-center justify-center">
                  <img
                    src={previewAttachment.previewUrl}
                    alt={previewAttachment.name}
                    className="block max-h-[calc(92vh-96px)] w-auto max-w-full rounded-2xl bg-white object-contain shadow-[0_20px_40px_rgba(15,23,42,0.12)]"
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {toastMessage ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[13000] -translate-x-1/2 rounded-full bg-[#171c22] px-4 py-2 text-sm text-white shadow-[0_12px_40px_rgba(15,23,42,0.24)]">
          {toastMessage}
        </div>
      ) : null}
    </>
  );
}
