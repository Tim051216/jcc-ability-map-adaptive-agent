/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import gsap from "gsap";
import {
  BookOpen,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Heart,
  LayoutGrid,
  Network,
  Presentation,
  RefreshCw,
  Search,
  Sparkles,
  UploadCloud,
  Video,
} from "lucide-react";
import {
  readPersistedCourseResourceWorkspace,
  sanitizeWorkspaceText,
  type RecentPptArtifact,
  type RecentResourceArtifact,
} from "../lib/courseResourceWorkspace";
import {
  studentApi,
  type CourseDetail,
  type CourseTeacher,
  type ProfileSummaryResponse,
  type ResourceCard,
  type ResourceSourceFileRef,
} from "../lib/studentApi";
import {
  buildProfileAwareKnowledgePoints,
  buildResourceGenerationProfileContext,
} from "../lib/profileGeneration";
import { resolveBackendCourseCode, resolveBackendCourseId } from "../lib/courseRouting";
import {
  DEFAULT_ROUTE_COURSE_ID,
  persistLastRouteCourseId,
} from "../lib/routeCourseContext";
import { getCurrentLoggedInUserId } from "../lib/currentUser";
import { exportDeckAsPptx, type DeckSlide } from "../lib/pptxExport";
import { getCourseVideoPlaylist } from "../lib/videoCatalog";
import { openTutorPanel } from "../lib/tutorPanel";
import { getGeneratedResourceIcon, getGeneratedResourceUiMeta } from "../lib/generatedResourceUi";
import AILoadingLottie from "../components/AILoadingLottie";
import { beginUiProgress, finishUiProgress, setUiProgress } from "../lib/uiProgress";

type ResourceTab = "all" | "handouts" | "notes" | "videos";

const RESOURCE_SUPPLEMENT_OPTIONS = [
  { id: "lecture_note", label: "补讲义", successLabel: "讲义资料", triggerLabel: "生成讲义资料", description: "补出可直接复习的课程讲义与重点整理" },
  { id: "practice_set", label: "补练习", successLabel: "练习资料", triggerLabel: "生成练习资料", description: "补出可立即作答的练习题与解析" },
  { id: "mindmap", label: "补导图", successLabel: "导图资料", triggerLabel: "生成导图资料", description: "补出知识结构导图，方便快速回看" },
  { id: "extended_reading", label: "补阅读", successLabel: "拓展阅读", triggerLabel: "生成拓展阅读", description: "补出原理背景、延伸材料与深入阅读" },
  { id: "coding_lab", label: "补实操", successLabel: "代码实操", triggerLabel: "生成代码实操", description: "补出案例练习、操作步骤与动手任务" },
  { id: "visual_illustration", label: "补插图", successLabel: "教学插图", triggerLabel: "生成教学插图", description: "补出结构图、流程图和课堂图示" },
  { id: "micro_video", label: "补动画", successLabel: "讲解动画", triggerLabel: "生成讲解动画", description: "补出讲解动画分镜和可视化脚本" },
  { id: "subtitle_transcript", label: "补字幕", successLabel: "ASR 字幕", triggerLabel: "生成字幕整理", description: "补出字幕转写、重点切片和课堂文本整理" },
  { id: "ocr_notes", label: "补板书", successLabel: "真实板书", triggerLabel: "生成真实板书", description: "补出 OCR 识别文本、黑板布局还原与结构化课堂笔记" },
] as const;

type ResourceSupplementType = (typeof RESOURCE_SUPPLEMENT_OPTIONS)[number]["id"];
type ResourceDisplayType = ResourceSupplementType | "ppt";

const COURSE_RESOURCE_ACTION_TYPES: ResourceSupplementType[] = [
  "extended_reading",
  "coding_lab",
  "visual_illustration",
  "ocr_notes",
];

function isCourseResourceActionType(value: ResourceDisplayType | null): value is ResourceSupplementType {
  return Boolean(value && COURSE_RESOURCE_ACTION_TYPES.includes(value as ResourceSupplementType));
}

const RESOURCE_GENERATION_HINTS: Record<ResourceSupplementType, string[]> = {
  lecture_note: ["补课程讲义", "知识主线梳理", "章节重点提炼"],
  practice_set: ["补练习题", "随堂测评", "薄弱点训练"],
  mindmap: ["补思维导图", "知识结构整理", "主线梳理"],
  extended_reading: ["补拓展阅读", "延伸背景资料", "原理补充阅读"],
  coding_lab: ["补代码实操", "案例演练", "动手实验步骤"],
  visual_illustration: ["补教学插图", "结构图示", "页面与流程示意图"],
  micro_video: ["补讲解动画", "动画分镜", "可视化讲解脚本"],
  subtitle_transcript: ["补字幕整理", "ASR 转写", "课堂文本切片"],
  ocr_notes: ["补真实板书", "OCR 识别文本", "黑板布局还原"],
};

const RESOURCE_AGENT_STEPS = [
  {
    name: "岗位学情诊断智能体",
    description: "读取专业、课程、岗位能力短板和学习目标，确定资源粒度与难度。",
  },
  {
    name: "学习规划智能体",
    description: "根据当前阶段挑出最该先补的知识点与资源顺序。",
  },
  {
    name: "资源生成智能体",
    description: "负责生成讲义、导图、练习、阅读和代码实操等主体内容。",
  },
  {
    name: "全域问答智能体",
    description: "不仅处理课程知识检索，还支持联网补充信息、多模态分析与连续追问。",
  },
  {
    name: "测评反馈智能体",
    description: "根据错题与薄弱点反向追加更针对性的训练资源。",
  },
  {
    name: "智能复习提醒智能体",
    description: "按学习节奏自动安排复习时机，并通过站内通知持续提醒你回到关键任务。",
  },
] as const;

const RESOURCE_COVERAGE_LABELS: Record<string, string> = {
  lecture_note: "讲义文档",
  course_overview: "课程总览",
  teaching_plan: "教学讲稿",
  ppt: "PPT 课件",
  mindmap: "思维导图",
  mind_map: "思维导图",
  practice_set: "练习题",
  quiz_set: "练习题",
  extended_reading: "拓展阅读",
  coding_lab: "代码实操",
  case_study: "案例拆解",
  video: "视频/动画",
  visual_illustration: "教学插图",
  micro_video: "讲解动画",
  subtitle_transcript: "ASR 字幕",
  ocr_notes: "真实板书",
};

type UiFile = {
  fileId: string;
  name: string;
  type: "pdf" | "text" | "image" | "video";
  format: string;
  size: string;
  pages?: number;
  uploadedDate: string;
  excerpt?: string;
  previewUrl?: string;
  studyAdvice?: string;
  openUrl?: string;
};

type UiResourceGroup = {
  resourceId: string;
  courseId: string;
  title: string;
  category: string;
  uploader: string;
  updatedAt: string;
  downloads: number;
  files: UiFile[];
  summary?: string;
  resourceTypes: string[];
  rawResource?: ResourceCard;
  generatedAtRank?: number;
};

type UiCourseBundle = {
  bundleId: string;
  courseId: string;
  title: string;
  summary: string;
  resourceCount: number;
  fileCount: number;
  updatedAt: string;
  categories: string[];
  resourceTypes: string[];
  files: UiFile[];
  resources: UiResourceGroup[];
  primaryResource: UiResourceGroup;
};

type ClassroomGeneratedItem =
  | ({ itemType: "ppt"; actionLabel: string } & RecentPptArtifact)
  | ({ itemType: "artifact"; actionLabel: string } & RecentResourceArtifact);

type AiPptDraft = {
  title: string;
  topic: string;
  sourceLabel: string;
  modelLabel: string;
  summary: string;
  slides: DeckSlide[];
  createdAt: string;
};

function getGeneratedItemTag(item: ClassroomGeneratedItem) {
  if (item.itemType === "ppt") {
    return getGeneratedResourceUiMeta("ppt").label;
  }
  return getGeneratedResourceUiMeta(item.kind).label;
}

function formatGeneratedHint(item: ClassroomGeneratedItem) {
  const sectionTitle = sanitizeWorkspaceText(item.sectionTitle, "当前章节");
  if (item.itemType === "ppt") {
    return `${sectionTitle} · ${item.slideCount} 页`;
  }
  return `${sectionTitle} · ${item.generatedAt}`;
}

function getGeneratedDisplayTitle(item: ClassroomGeneratedItem) {
  const sectionTitle = sanitizeWorkspaceText(item.sectionTitle, "当前章节");
  const customTitle = sanitizeWorkspaceText(item.itemType === "ppt" ? item.customTitle || "" : item.customTitle || item.title || "", "");
  if (customTitle && !/软件工程与实践|第一章|第[一二三四五六七八九十0-9]+章/.test(customTitle)) {
    return customTitle;
  }
  if (item.itemType === "ppt") {
    return `${sectionTitle} PPT 草案`;
  }
  if (item.kind === "mindmap") return `${sectionTitle} 知识导图`;
  if (item.kind === "practice") return `${sectionTitle} 练习题`;
  return `${sectionTitle} 学习讲义`;
}

function getGeneratedResourceTitle(resource: UiResourceGroup) {
  const label = RESOURCE_COVERAGE_LABELS[normalizeCoverageResourceType(resource.resourceTypes[0])] || "生成资料";
  const title = sanitizeGeneratedText(resource.title, label)
    .replace(/^软件工程与实践（第4版）\s*[·\-：:]\s*/, "")
    .replace(/^第一章[：:\s·-]*/, "")
    .replace(/^软件工程基础与软件危机[：:\s·-]*/, "");
  if (!title || title.length > 28) {
    return label;
  }
  return title;
}

function getGeneratedUiKind(resourceType?: string | null) {
  const normalizedType = normalizeCoverageResourceType(resourceType || "");
  if (normalizedType === "ppt") return "ppt";
  if (normalizedType === "mindmap") return "mindmap";
  if (normalizedType === "practice_set") return "practice";
  return "handout";
}

function GeneratedItemIcon({ item }: { item: ClassroomGeneratedItem }) {
  const Icon = item.itemType === "ppt" && item.explanationVideo ? Video : item.itemType === "ppt" ? getGeneratedResourceIcon("ppt") : getGeneratedResourceIcon(item.kind);
  return <Icon className="h-4 w-4" />;
}

function buildGeneratedResourcePreviewState(
  courseId: string,
  item: Extract<ClassroomGeneratedItem, { itemType: "artifact" }>,
) {
  const resourceType = item.kind === "handout" ? "lecture_note" : item.kind === "mindmap" ? "mindmap" : "practice_set";
  const title = getGeneratedDisplayTitle(item);
  const summary = sanitizeWorkspaceText(item.summary, "已按当前课堂上下文完成生成。");
  const previewText = item.rawContent || item.previewContent?.join("\n") || summary;
  return {
    pathname: `/resources/preview?courseId=${courseId}`,
    state: {
      initialResource: {
        resource_id: item.resourceId || null,
        resource_type: resourceType,
        title,
        summary,
        content_markdown: previewText,
        source_titles: [],
        study_suggestion:
          item.kind === "mindmap"
            ? "建议先看导图主干，再按分支顺序回到课堂或讲义补细节。"
            : item.kind === "practice"
              ? "建议先做题，再结合解析与 AI 导师定位薄弱点。"
              : "建议先通读讲义主线，再继续追问关键概念和易错点。",
        source_file_count: 0,
        source_files: [],
      },
      initialFileId: null,
      initialPreviewFile: {
        file_id: -1,
        display_name: `${title}.${item.kind === "practice" ? "md" : "md"}`,
        relative_path: "",
        top_level_category: resourceType,
        file_extension: ".md",
        mime_type: "text/markdown",
        file_size: null,
        preview_text: previewText,
        is_inline_previewable: true,
        preview_mode: "text",
        preview_url: null,
        open_url: "",
      },
    },
  };
}

function ResourceCardSkeleton() {
  return (
    <div className="rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
      <div className="space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-5 w-16 rounded-full bg-[#eef2f6]" />
          <div className="h-4 w-12 rounded-full bg-[#f3f5f7]" />
        </div>
        <div className="h-6 w-3/4 rounded-xl bg-[#eef2f6]" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded-lg bg-[#f3f5f7]" />
          <div className="h-4 w-5/6 rounded-lg bg-[#f3f5f7]" />
        </div>
        <div className="border-t border-[#f3f5f7] pt-4 space-y-3">
          <div className="h-4 w-24 rounded-lg bg-[#eef2f6]" />
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex items-center justify-between rounded-2xl border border-[#eef2f6] bg-[#fafbfd] px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-[#eef2f6]" />
                <div className="space-y-2">
                  <div className="h-3 w-32 rounded-lg bg-[#eef2f6]" />
                  <div className="h-3 w-20 rounded-lg bg-[#f3f5f7]" />
                </div>
              </div>
              <div className="h-8 w-20 rounded-xl bg-[#eef2f6]" />
            </div>
          ))}
        </div>
        <div className="border-t border-[#f3f5f7] pt-3 flex items-center justify-between">
          <div className="h-4 w-28 rounded-lg bg-[#eef2f6]" />
          <div className="h-4 w-12 rounded-lg bg-[#f3f5f7]" />
        </div>
      </div>
    </div>
  );
}

function EmptyResourceState({
  isFiltering,
  onReset,
}: {
  isFiltering: boolean;
  onReset: () => void;
}) {
  return (
    <section className="rounded-[28px] border border-[#e8edf2] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-8 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
        <div>
          <div className="text-[11px] font-black tracking-[0.2em] text-[#006689]">资源中心</div>
          <h2 className="mt-3 text-[28px] font-black tracking-[-0.04em] text-[#171c22]">
            {isFiltering ? "没有匹配到当前筛选结果" : "资料正在同步中"}
          </h2>
          <p className="mt-3 max-w-2xl text-[14px] leading-7 text-[#5b6574]">
            {isFiltering
              ? "换个关键词，或者先回到全部资源继续浏览。"
              : "资源目录已经准备好，数据返回后会直接填进列表。"}
          </p>
        </div>
        <div className="flex md:justify-end">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center rounded-full bg-[#006689] px-5 py-3 text-sm font-black text-white transition-colors hover:bg-[#005570]"
          >
            {isFiltering ? "清空筛选" : "查看全部资源"}
          </button>
        </div>
      </div>
    </section>
  );
}

function buildInitialPreviewFile(resGroup: UiResourceGroup, file: UiFile) {
  const previewUrl = file.openUrl || (file.previewUrl?.startsWith("/") || /^https?:\/\//i.test(file.previewUrl || "") ? file.previewUrl : null);
  return {
    file_id: -1,
    display_name: file.name,
    relative_path: file.openUrl || file.previewUrl || file.name,
    top_level_category: resGroup.category,
    file_extension: file.type === "pdf" ? ".pdf" : file.type === "image" ? ".png" : file.type === "video" ? ".mp4" : ".txt",
    mime_type: file.type === "pdf" ? "application/pdf" : file.type === "image" ? "image/png" : file.type === "video" ? "video/mp4" : "text/plain",
    file_size: null,
    preview_text: previewUrl ? file.excerpt || resGroup.summary || null : file.previewUrl || file.excerpt || resGroup.summary || null,
    is_inline_previewable: true,
    preview_mode: file.type === "text" ? "text" : file.type,
    preview_url: previewUrl,
    open_url: previewUrl || "",
  };
}

function buildBundlePreviewResource(
  bundle: UiCourseBundle,
  ownerResource: UiResourceGroup,
  preferredFileId?: string,
) {
  const fileIdPairs = bundle.files.map((file, index) => {
    const numericFileId = Number(file.fileId);
    return {
      rawFileId: file.fileId,
      numericFileId: Number.isFinite(numericFileId) ? numericFileId : 900_000 + index,
    };
  });
  const mergedFiles = bundle.files.map((file, index) => {
    const fileOwner = bundle.resources.find((resource) => resource.files.some((candidate) => candidate.fileId === file.fileId)) || ownerResource;
    const previewFile = buildInitialPreviewFile(fileOwner, file);
    return {
      ...previewFile,
      file_id: fileIdPairs[index]?.numericFileId ?? 900_000 + index,
    };
  });
  const preferredNumericFileId = Number(preferredFileId);
  const preferredPair = preferredFileId ? fileIdPairs.find((item) => item.rawFileId === preferredFileId) : null;
  const resolvedInitialFileId =
    preferredPair?.numericFileId ||
    (Number.isFinite(preferredNumericFileId) && mergedFiles.some((file) => file.file_id === preferredNumericFileId)
      ? preferredNumericFileId
      : mergedFiles[0]?.file_id || null);

  const previewResource = {
    ...(ownerResource.rawResource || bundle.primaryResource.rawResource || {
      resource_type: "course_overview",
      title: bundle.title,
      summary: bundle.summary,
      content_markdown: bundle.summary,
      source_titles: [],
    }),
    resource_id: ownerResource.rawResource?.resource_id || bundle.primaryResource.rawResource?.resource_id || null,
    title: bundle.title,
    summary: bundle.summary || ownerResource.summary,
    content_markdown:
      ownerResource.rawResource?.content_markdown ||
      bundle.primaryResource.rawResource?.content_markdown ||
      bundle.summary ||
      "当前课程资料已聚合到课程工作台，可继续查看文件详情。",
    source_file_count: mergedFiles.length,
    source_files: mergedFiles,
    source_titles:
      ownerResource.rawResource?.source_titles ||
      bundle.primaryResource.rawResource?.source_titles ||
      [],
    study_suggestion:
      ownerResource.rawResource?.study_suggestion ||
      bundle.primaryResource.rawResource?.study_suggestion ||
      "建议先浏览课程内已有资料，再按需继续补充阅读、实操、插图、字幕或板书。",
  };

  return {
    previewResource,
    initialFileId: resolvedInitialFileId,
  };
}

function mapResourceTypeToCategory(resourceType: string) {
  if (resourceType === "video" || resourceType === "micro_video") {
    return "videos";
  }
  if (["lecture_note", "course_overview", "mindmap", "mind_map", "teaching_plan", "ppt", "assessment_guide", "visual_illustration"].includes(resourceType)) {
    return "handouts";
  }
  return "notes";
}

function normalizeSupplementResourceType(resourceType?: string | null): ResourceDisplayType | null {
  if (!resourceType) return null;
  if (["lecture_note", "course_overview", "teaching_plan", "assessment_guide"].includes(resourceType)) {
    return "lecture_note";
  }
  if (resourceType === "practice_set") {
    return "practice_set";
  }
  if (resourceType === "mindmap" || resourceType === "mind_map") {
    return "mindmap";
  }
  if (resourceType === "ppt") {
    return "ppt";
  }
  if (resourceType === "extended_reading") {
    return "extended_reading";
  }
  if (resourceType === "coding_lab" || resourceType === "case_study") {
    return "coding_lab";
  }
  if (resourceType === "visual_illustration") {
    return "visual_illustration";
  }
  if (resourceType === "micro_video") {
    return "micro_video";
  }
  if (resourceType === "subtitle_transcript") {
    return "subtitle_transcript";
  }
  if (resourceType === "ocr_notes") {
    return "ocr_notes";
  }
  return null;
}

function isPracticeWorkbenchResource(resourceType?: string | null) {
  return resourceType === "coding_lab" || resourceType === "case_study";
}

function normalizeCoverageResourceType(resourceType?: string | null) {
  if (!resourceType) {
    return "other";
  }
  if (["lecture_note", "course_overview", "teaching_plan", "assessment_guide"].includes(resourceType)) {
    return "lecture_note";
  }
  if (resourceType === "mindmap" || resourceType === "mind_map") {
    return "mindmap";
  }
  if (resourceType === "ppt" || resourceType === "teaching_plan") {
    return "ppt";
  }
  if (resourceType === "practice_set" || resourceType === "quiz_set") {
    return "practice_set";
  }
  if (resourceType === "coding_lab" || resourceType === "case_study") {
    return "coding_lab";
  }
  if (["visual_illustration", "micro_video", "subtitle_transcript", "ocr_notes"].includes(resourceType)) {
    return resourceType;
  }
  return resourceType;
}

function buildInlineSvgDataUrl(markup: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;
}

function buildTeachingIllustrationPreview(courseId: string) {
  const palette =
    courseId === "series-2"
      ? { bg: "#eff6ff", card: "#dbeafe", line: "#2563eb", accent: "#0f172a" }
      : { bg: "#fdf2f8", card: "#fce7f3", line: "#db2777", accent: "#111827" };
  return buildInlineSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="860" viewBox="0 0 1400 860">
      <rect width="1400" height="860" rx="40" fill="${palette.bg}"/>
      <rect x="88" y="84" width="1224" height="692" rx="34" fill="white"/>
      <text x="124" y="156" font-size="38" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">BiliLearn 多模态知识讲解示意图</text>
      <text x="124" y="206" font-size="20" font-family="Arial, sans-serif" fill="#475467">教学插图由 Stable Diffusion 类模型生成，用于讲义、PPT、答疑页和课堂悬浮讲解。</text>
      <rect x="124" y="256" width="328" height="168" rx="26" fill="${palette.card}"/>
      <rect x="536" y="256" width="328" height="168" rx="26" fill="${palette.card}"/>
      <rect x="948" y="256" width="240" height="168" rx="26" fill="${palette.card}"/>
      <rect x="124" y="496" width="1064" height="168" rx="26" fill="#f8fafc"/>
      <path d="M208 338 C276 286, 340 286, 408 338" stroke="${palette.line}" stroke-width="14" fill="none" stroke-linecap="round"/>
      <circle cx="214" cy="340" r="22" fill="${palette.line}" opacity="0.18"/>
      <circle cx="286" cy="340" r="22" fill="${palette.line}" opacity="0.35"/>
      <circle cx="358" cy="340" r="22" fill="${palette.line}" opacity="0.6"/>
      <rect x="570" y="296" width="260" height="18" rx="9" fill="${palette.line}" opacity="0.75"/>
      <rect x="570" y="334" width="210" height="18" rx="9" fill="${palette.line}" opacity="0.48"/>
      <rect x="570" y="372" width="176" height="18" rx="9" fill="${palette.line}" opacity="0.28"/>
      <circle cx="1016" cy="340" r="54" fill="${palette.line}" opacity="0.18"/>
      <path d="M986 340 L1010 364 L1054 314" stroke="${palette.line}" stroke-width="14" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="124" y="456" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">输入知识点 -> 生成课堂插图 -> 嵌入讲义/PPT/答疑</text>
      <text x="124" y="548" font-size="18" font-family="Arial, sans-serif" fill="#344054">1. 根据知识点、实验流程或系统架构自动生成插图。</text>
      <text x="124" y="590" font-size="18" font-family="Arial, sans-serif" fill="#344054">2. 与 ASR/OCR 提取出的术语、字幕、板书内容自动对齐。</text>
      <text x="124" y="632" font-size="18" font-family="Arial, sans-serif" fill="#344054">3. 讲义、PPT、视频讲解页共用一套多模态理解结果。</text>
    </svg>
  `);
}

function buildGeneratedIllustrationPreview(courseId: string, title: string, sourceTitles: string[]) {
  const palette =
    courseId === "series-2"
      ? { bg: "#eff6ff", card: "#dbeafe", line: "#2563eb", accent: "#0f172a", soft: "#93c5fd" }
      : { bg: "#fff7ed", card: "#ffedd5", line: "#ea580c", accent: "#1f2937", soft: "#fdba74" };
  const labels = sourceTitles.filter(Boolean).slice(0, 4);
  while (labels.length < 4) {
    labels.push(["输入条件", "结构节点", "过程说明", "结果输出"][labels.length]);
  }
  const blueprint =
    /流程|过程|链路/.test(title)
      ? "流程链路版"
      : /架构|结构|系统/.test(title)
        ? "结构总览版"
        : "讲义插图版";
  return buildInlineSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="860" viewBox="0 0 1400 860">
      <rect width="1400" height="860" rx="40" fill="${palette.bg}"/>
      <rect x="88" y="84" width="1224" height="692" rx="34" fill="white"/>
      <text x="124" y="150" font-size="38" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">${title}</text>
      <text x="124" y="194" font-size="19" font-family="Arial, sans-serif" fill="#475467">AI 教学插图预览：把当前知识点转成可直接放进讲义、PPT 与答辩页的结构化图示。</text>
      <rect x="1100" y="126" width="144" height="34" rx="17" fill="${palette.card}"/>
      <text x="1172" y="148" text-anchor="middle" font-size="16" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">${blueprint}</text>
      <rect x="124" y="256" width="270" height="144" rx="26" fill="${palette.card}"/>
      <rect x="456" y="256" width="270" height="144" rx="26" fill="${palette.card}"/>
      <rect x="788" y="256" width="270" height="144" rx="26" fill="${palette.card}"/>
      <rect x="1120" y="256" width="124" height="144" rx="26" fill="${palette.card}"/>
      <path d="M394 328 L456 328" stroke="${palette.line}" stroke-width="10" stroke-linecap="round"/>
      <path d="M726 328 L788 328" stroke="${palette.line}" stroke-width="10" stroke-linecap="round"/>
      <path d="M1058 328 L1120 328" stroke="${palette.line}" stroke-width="10" stroke-linecap="round"/>
      <circle cx="1244" cy="328" r="24" fill="${palette.line}" opacity="0.15"/>
      <path d="M1230 328 L1240 338 L1260 316" stroke="${palette.line}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="150" y="306" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">${labels[0]}</text>
      <text x="482" y="306" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">${labels[1]}</text>
      <text x="814" y="306" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">${labels[2]}</text>
      <text x="1140" y="306" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">${labels[3]}</text>
      <rect x="124" y="472" width="1120" height="170" rx="28" fill="#f8fafc"/>
      <rect x="156" y="506" width="182" height="16" rx="8" fill="${palette.soft}"/>
      <rect x="156" y="540" width="236" height="16" rx="8" fill="${palette.line}" opacity="0.22"/>
      <rect x="438" y="506" width="182" height="16" rx="8" fill="${palette.soft}"/>
      <rect x="438" y="540" width="236" height="16" rx="8" fill="${palette.line}" opacity="0.22"/>
      <rect x="720" y="506" width="182" height="16" rx="8" fill="${palette.soft}"/>
      <rect x="720" y="540" width="236" height="16" rx="8" fill="${palette.line}" opacity="0.22"/>
      <rect x="1002" y="506" width="182" height="16" rx="8" fill="${palette.soft}"/>
      <rect x="1002" y="540" width="182" height="16" rx="8" fill="${palette.line}" opacity="0.22"/>
      <text x="156" y="596" font-size="18" font-family="Arial, sans-serif" fill="#475467">推荐用途：讲义配图、课堂讲解、答辩结构说明、AI 导师流程解释</text>
      <rect x="124" y="684" width="182" height="86" rx="22" fill="${palette.card}"/>
      <rect x="336" y="684" width="182" height="86" rx="22" fill="${palette.card}"/>
      <rect x="548" y="684" width="182" height="86" rx="22" fill="${palette.card}"/>
      <text x="144" y="718" font-size="16" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">缩略版式 A</text>
      <text x="356" y="718" font-size="16" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">缩略版式 B</text>
      <text x="568" y="718" font-size="16" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">缩略版式 C</text>
      <rect x="144" y="734" width="110" height="10" rx="5" fill="${palette.line}" opacity="0.55"/>
      <rect x="356" y="734" width="110" height="10" rx="5" fill="${palette.line}" opacity="0.55"/>
      <rect x="568" y="734" width="110" height="10" rx="5" fill="${palette.line}" opacity="0.55"/>
      <rect x="760" y="684" width="484" height="86" rx="22" fill="#f8fafc"/>
      <text x="786" y="718" font-size="16" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">插图投放位：讲义页 / PPT 页 / AI 导师页</text>
      <text x="786" y="748" font-size="15" font-family="Arial, sans-serif" fill="#667085">同一张图会裁成不同版式，保证课堂、资源页和答辩展示观感统一。</text>
    </svg>
  `);
}

function formatFileSize(fileSize?: number | null) {
  if (!fileSize || fileSize <= 0) {
    return "未知";
  }
  if (fileSize >= 1024 * 1024) {
    return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (fileSize >= 1024) {
    return `${Math.round(fileSize / 1024)} KB`;
  }
  return `${fileSize} B`;
}

function mapFileType(file: ResourceSourceFileRef): UiFile["type"] {
  const extension = (file.file_extension || "").toLowerCase();
  if (extension === ".pdf") {
    return "pdf";
  }
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(extension)) {
    return "image";
  }
  if ([".mp4", ".webm", ".mov", ".m3u8"].includes(extension)) {
    return "video";
  }
  return "text";
}

function mapMimeToFormat(file: ResourceSourceFileRef) {
  if (file.mime_type?.includes("pdf")) {
    return "PDF 文档";
  }
  if (file.mime_type?.startsWith("image/")) {
    return "图片文件";
  }
  return `${(file.file_extension || "").replace(/^\./, "").toUpperCase() || "文本"} 文件`;
}

function sanitizeGeneratedText(value?: string | null, fallback = "当前主题") {
  const text = (value || "").trim();
  if (!text) {
    return fallback;
  }
  if (/[?？]{3,}/.test(text) || /�{2,}/.test(text)) {
    return text.replace(/[?？]{3,}|�{2,}/g, fallback).trim();
  }
  return text;
}

function normalizeAiPptTopic(value: string, fallback: string) {
  return sanitizeGeneratedText(value, fallback).replace(/\s+/g, " ").slice(0, 80);
}

function splitSourceIntoKeyPoints(sourceText: string, topic: string) {
  const normalized = sourceText
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`|[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const chunks = normalized
    .split(/[。！？!?；;\n\r]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 6)
    .slice(0, 10);
  if (chunks.length >= 4) return chunks;
  return [
    `${topic}的概念边界与课程定位`,
    `${topic}在真实项目或课堂任务中的典型问题`,
    `${topic}的流程、方法与关键判断点`,
    `${topic}的案例拆解、课堂互动与复习任务`,
  ];
}

function buildAiPptDraft(topicInput: string, sourceText: string, courseTitle: string, sourceLabel: string): AiPptDraft {
  const topic = normalizeAiPptTopic(topicInput, courseTitle || "课程主题");
  const keyPoints = splitSourceIntoKeyPoints(sourceText, topic);
  const accent = "#E4002B";
  const slides: DeckSlide[] = [
    {
      kind: "cover",
      title: `${topic} 自动生成课件`,
      subtitle: `${courseTitle || "课程资源"} · 阿里通义/万相接口位 + 本地课件渲染`,
      bullets: ["课程主题识别", "讲义内容提炼", "逐页配图提示词", "PPTX 与网页预览同步生成"],
      accent,
      speakerNote: `开场说明：本课件围绕${topic}生成，适合课堂讲授、资源演示与课题答辩。`,
      illustration: {
        title: "课程主题到课件的生成链路",
        caption: "主题/讲义 -> LLM 大纲 -> AI 配图 -> PPTX 渲染",
        type: "flow" as const,
      },
    },
    {
      kind: "agenda",
      title: "生成流程",
      subtitle: "从讲义文档到可下载课件",
      bullets: ["解析课程主题与讲义文本", "生成结构化页级大纲", "为每页生成教学配图提示词", "统一导出 PPTX 并提供在线预览"],
      accent,
      speakerNote: "这一页用于向评委说明功能闭环和技术路线。",
      illustration: {
        title: "AI PPT 生成流水线",
        caption: "文本抽取、模型生成、视觉增强、文件导出",
        type: "flow" as const,
      },
    },
    ...keyPoints.slice(0, 4).map((point, index): DeckSlide => ({
      kind: "content" as const,
      title: index === 0 ? "核心概念" : index === 1 ? "问题场景" : index === 2 ? "方法流程" : "课堂应用",
      subtitle: point.slice(0, 42),
      bullets: [
        point,
        `围绕“${topic}”提炼可讲、可问、可练的课堂内容。`,
        index % 2 === 0 ? "适合用流程图或结构图解释关键关系。" : "适合用案例图或场景图辅助学生理解。",
      ],
      accent,
      speakerNote: `讲解建议：先用一句话概括“${point.slice(0, 36)}”，再连接到课程任务。`,
      illustration: {
        title: `${topic} · ${index === 0 ? "结构图" : index === 1 ? "场景图" : index === 2 ? "流程图" : "总结图"}`,
        caption: `AI 绘图提示词：教学插画，主题为${topic}，画面突出${point.slice(0, 28)}，清晰、适合课堂 PPT。`,
        type: index === 2 ? "flow" : index === 1 ? "scenario" : "concept",
      },
    })),
    {
      kind: "ending",
      title: "课堂总结与下一步",
      subtitle: "把 PPT 继续转成学习资源闭环",
      bullets: ["导出 .pptx 后可用于课堂讲解和答辩展示", "在线幻灯片保留每页讲稿与配图提示词", "后端可替换为阿里通义千问 + 通义万相正式生成链路"],
      accent,
      speakerNote: "收束到系统价值：不是单页生成，而是能进入资源中心、课堂和 AI 导师的完整闭环。",
      illustration: {
        title: "从课件到学习闭环",
        caption: "PPT、讲义、练习、AI 导师统一承接",
        type: "summary" as const,
      },
    },
  ];

  return {
    title: `${topic} AI 自动生成 PPT`,
    topic,
    sourceLabel,
    modelLabel: "阿里通义千问/万相接口位",
    summary: `已根据${sourceLabel}生成 ${slides.length} 页课件结构、讲稿和逐页配图提示词。`,
    slides,
    createdAt: new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
  };
}

function buildAiPptFileName(draft: AiPptDraft) {
  return `${draft.topic.replace(/[\\/:*?"<>|]/g, "-")}-AI自动生成PPT.pptx`;
}

function mapApiResourcesToUi(items: ResourceCard[], courseId: string): UiResourceGroup[] {
  return items.flatMap((item) => {
    try {
      const safeTitle = sanitizeGeneratedText(item.title, "当前课程资料");
      const safeSummary = sanitizeGeneratedText(item.summary, "已生成可直接学习的个性化资料。");
      const normalizedType = normalizeSupplementResourceType(item.resource_type);
      const files = (item.source_files || []).map((file) => ({
        fileId: String(file.file_id),
        name: sanitizeGeneratedText(file.display_name, safeTitle),
        type: mapFileType(file),
        format: mapMimeToFormat(file),
        size: formatFileSize(file.file_size),
        uploadedDate: "最新",
        excerpt: sanitizeGeneratedText(file.preview_text || item.summary, safeSummary),
        previewUrl:
          normalizedType === "visual_illustration"
            ? file.preview_url || file.open_url || file.preview_text || item.content_markdown
            : file.preview_url || file.preview_text || item.content_markdown,
        studyAdvice: sanitizeGeneratedText(item.study_suggestion, "建议结合课堂内容一起使用。") || undefined,
        openUrl: file.open_url,
      }));

      const fallbackFileName =
        normalizedType === "mindmap"
          ? `${safeTitle}.md`
          : normalizedType === "ppt"
            ? `${safeTitle}.pptx`
          : normalizedType === "practice_set"
            ? `${safeTitle}.json`
            : normalizedType === "extended_reading"
              ? `${safeTitle}.md`
              : normalizedType === "coding_lab"
                ? `${safeTitle}.md`
                : `${safeTitle}.md`;
      const normalizedFiles =
        files.length > 0
          ? files
          : [
              {
                fileId: String(item.resource_id || 900001),
                name:
                  normalizedType === "visual_illustration"
                    ? `${safeTitle}.svg`
                    : fallbackFileName,
                type: normalizedType === "visual_illustration" ? ("image" as const) : ("text" as const),
                format:
                  normalizedType === "practice_set"
                    ? "JSON 练习"
                    : normalizedType === "ppt"
                      ? "PPT 课件"
                    : normalizedType === "coding_lab"
                      ? "代码实操"
                      : normalizedType === "visual_illustration"
                        ? "教学插图"
                        : normalizedType === "micro_video"
                          ? "动画分镜"
                      : normalizedType === "mindmap"
                        ? "导图预览"
                        : "Markdown 文档",
                size: "在线生成",
                uploadedDate: "最新",
                excerpt: safeSummary || item.content_markdown?.slice(0, 120) || "已生成可直接学习的个性化资料。",
                previewUrl:
                  normalizedType === "visual_illustration"
                    ? buildGeneratedIllustrationPreview(courseId, safeTitle, item.source_titles || [])
                    : item.content_markdown,
                studyAdvice: sanitizeGeneratedText(item.study_suggestion, "建议结合课堂内容一起使用。") || undefined,
              },
            ];

      return [
        {
          resourceId: String(item.resource_id || safeTitle),
          courseId,
          title: safeTitle,
          category: mapResourceTypeToCategory(item.resource_type),
          uploader: "课程资源库",
          updatedAt: "最新",
          downloads: 0,
          files: normalizedFiles,
          summary: safeSummary,
          resourceTypes: [item.resource_type],
          generatedAtRank: Number(item.resource_id) || Date.now(),
          rawResource: {
            ...item,
            title: safeTitle,
            summary: safeSummary,
            study_suggestion: sanitizeGeneratedText(item.study_suggestion, "建议结合课堂内容一起使用。"),
            source_titles: (item.source_titles || []).map((sourceTitle) => sanitizeGeneratedText(sourceTitle, "当前主题")),
          },
        },
      ];
    } catch {
      return [];
    }
  });
}

function buildResourceDedupKey(item: UiResourceGroup) {
  const normalizedTypes = Array.from(new Set(item.resourceTypes.map((type) => normalizeCoverageResourceType(type)))).sort();
  const normalizedTitle = item.title
    .trim()
    .toLowerCase()
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/\s+/g, "")
    .replace(/[·:：｜|_\-—]/g, "")
    .replace(/[()]/g, "")
    .replace(/软件工程与实践第?4版/g, "")
    .replace(/softwareengineeringandpractice4thedition/g, "")
    .replace(/softwareengineeringpractice4thedition/g, "")
    .replace(/课程资源包|资源包|核心资料|学习资料|courseresourcepackage|resourcepackage|corematerials|learningmaterials/g, "")
    .replace(/中文|英文|中文版|英文版|chinese|english|cn|en/g, "");
  const titleKey = normalizedTitle || `${item.courseId}-${item.category}`;
  return `${item.courseId}::${item.category}::${titleKey}::${normalizedTypes.join(",") || "other"}`;
}

function scoreResourceFreshness(item: UiResourceGroup) {
  const numericId = Number(item.resourceId);
  if (Number.isFinite(numericId)) {
    return numericId;
  }
  return item.files.length;
}

function dedupeResourceGroups(items: UiResourceGroup[]) {
  const deduped = new Map<string, UiResourceGroup>();
  for (const item of items) {
    const key = buildResourceDedupKey(item);
    const existing = deduped.get(key);
    if (!existing || scoreResourceFreshness(item) >= scoreResourceFreshness(existing)) {
      deduped.set(key, item);
    }
  }
  return Array.from(deduped.values()).sort((left, right) => scoreResourceFreshness(right) - scoreResourceFreshness(left));
}

function buildSupplementPreviewBullets(resource: UiResourceGroup) {
  const seedText = resource.files[0]?.excerpt || resource.summary || "";
  const normalized = seedText
    .split(/\r?\n|。|；|;|•/)
    .map((line) => line.replace(/^[-*#\d.\s]+/, "").trim())
    .filter((line) => line.length >= 6);
  return Array.from(new Set(normalized)).slice(0, 3);
}

function buildSupplementPreviewMeta(resourceType?: ResourceSupplementType | null) {
  switch (resourceType) {
    case "extended_reading":
      return { badge: "阅读重点", tone: "text-[#7c2d12] bg-[#fff7ed]" };
    case "coding_lab":
      return { badge: "实操任务", tone: "text-[#065f46] bg-[#ecfdf3]" };
    case "visual_illustration":
      return { badge: "图示结构", tone: "text-[#1d4ed8] bg-[#eff6ff]" };
    case "micro_video":
      return { badge: "分镜摘要", tone: "text-[#7e22ce] bg-[#faf5ff]" };
    case "subtitle_transcript":
      return { badge: "字幕片段", tone: "text-[#0f766e] bg-[#ecfeff]" };
    case "ocr_notes":
      return { badge: "真实板书", tone: "text-[#9a3412] bg-[#fef3c7]" };
    default:
      return { badge: "内容摘要", tone: "text-[#475467] bg-[#f4f7fb]" };
  }
}

function getSupplementActionMeta(resourceType: ResourceSupplementType) {
  switch (resourceType) {
    case "extended_reading":
      return {
        eyebrow: "延伸理解",
        accent: "from-[#fff1e8] via-[#fff7f0] to-white",
        border: "border-[#fed7aa]",
        iconTone: "bg-[#fff7ed] text-[#c2410c]",
      };
    case "coding_lab":
      return {
        eyebrow: "动手验证",
        accent: "from-[#ecfdf3] via-[#f4fff8] to-white",
        border: "border-[#bbf7d0]",
        iconTone: "bg-[#ecfdf3] text-[#15803d]",
      };
    case "visual_illustration":
      return {
        eyebrow: "课堂图示",
        accent: "from-[#eff6ff] via-[#f6faff] to-white",
        border: "border-[#bfdbfe]",
        iconTone: "bg-[#eff6ff] text-[#2563eb]",
      };
    case "micro_video":
      return {
        eyebrow: "动画讲解",
        accent: "from-[#faf5ff] via-[#fcfaff] to-white",
        border: "border-[#e9d5ff]",
        iconTone: "bg-[#faf5ff] text-[#9333ea]",
      };
    case "subtitle_transcript":
      return {
        eyebrow: "字幕整理",
        accent: "from-[#ecfeff] via-[#f5feff] to-white",
        border: "border-[#a5f3fc]",
        iconTone: "bg-[#ecfeff] text-[#0f766e]",
      };
    case "ocr_notes":
      return {
        eyebrow: "真实板书",
        accent: "from-[#fffbeb] via-[#fffdf4] to-white",
        border: "border-[#fde68a]",
        iconTone: "bg-[#fef3c7] text-[#b45309]",
      };
    default:
      return {
        eyebrow: "AI 补全",
        accent: "from-[#fff7fa] via-white to-white",
        border: "border-[#f5b8ca]",
        iconTone: "bg-[#fff1f6] text-[#d64d7b]",
      };
  }
}

function renderSupplementPreview(resource: UiResourceGroup, resourceType?: ResourceSupplementType | null) {
  const bullets = buildSupplementPreviewBullets(resource);

  if (resourceType === "extended_reading") {
    return (
      <div className="mt-2.5 rounded-[16px] border border-[#fed7aa] bg-[#fffaf5] p-2.5">
        <div className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#9a3412]">阅读结构</div>
        <div className="mt-2 grid gap-1.5">
          {(bullets.length ? bullets : [resource.summary]).slice(0, 3).map((bullet, index) => (
            <div key={`${resource.resourceId}-reading-${index}`} className="rounded-xl bg-white px-2.5 py-2 text-[10px] leading-5 text-[#7c2d12]">
              {index + 1}. {bullet}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (resourceType === "coding_lab") {
    return (
      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
        {["任务目标", "交付物"].map((label, index) => (
          <div key={`${resource.resourceId}-lab-${label}`} className="rounded-[16px] border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-2.5">
            <div className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#15803d]">{label}</div>
            <div className="mt-1.5 text-[10px] leading-5 text-[#166534]">
              {(bullets[index] || bullets[0] || resource.summary).slice(0, 60)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (resourceType === "micro_video") {
    return (
      <div className="mt-2.5 grid gap-1.5">
        {(bullets.length ? bullets : [resource.summary]).slice(0, 3).map((bullet, index) => (
          <div key={`${resource.resourceId}-video-${index}`} className="flex items-center gap-2 rounded-[16px] border border-[#e9d5ff] bg-[#faf5ff] px-2.5 py-2">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white text-[9px] font-extrabold text-[#7e22ce]">
              {index + 1}
            </span>
            <span className="text-[10px] leading-5 text-[#6b21a8]">{bullet}</span>
          </div>
        ))}
      </div>
    );
  }

  if (!bullets.length) {
    return null;
  }

  return (
    <div className="mt-2 grid gap-1.5">
      {bullets.map((bullet, bulletIndex) => (
        <div
          key={`${resource.resourceId}-preview-${bulletIndex}`}
          className="rounded-xl bg-white/90 px-2.5 py-2 text-[10px] leading-5 text-[#475467] ring-1 ring-[#f3d9e3]"
        >
          {bullet}
        </div>
      ))}
    </div>
  );
}

function normalizeVideoPath(path?: string) {
  if (!path) {
    return "";
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      return new URL(path).pathname;
    } catch {
      return path;
    }
  }
  return path;
}

function buildCourseVideoTarget(courseId: string, file?: UiFile) {
  if (!file || file.type !== "video") {
    return null;
  }
  const candidates = [file.openUrl, file.previewUrl].map(normalizeVideoPath).filter(Boolean);
  if (!candidates.length) {
    return null;
  }
  const orderedVideos = getCourseVideoPlaylist(courseId);
  const sectionIndex = orderedVideos.findIndex((item) => candidates.includes(item));
  if (sectionIndex < 0) {
    return null;
  }
  return `/learn?courseId=${courseId}&sectionId=${sectionIndex}&startAt=0&autoplay=1&muted=1`;
}

function buildFallbackExtendedReadingMarkdown(courseId: string) {
  const isVueCourse = courseId === "series-1";
  const courseTitle = isVueCourse ? "Vue 3 项目工程化落地" : "当前课程";
  const theme = isVueCourse ? "组件组织、状态边界、接口联调与前端工程协作" : "课程核心概念、实践语境与项目迁移";
  return [
    `# ${courseTitle}拓展阅读`,
    "",
    "## 1. 阅读定位",
    `这份资料不是课堂讲义的重复摘录，而是用于补齐“为什么要这样设计”和“真实项目中如何落地”的拓展阅读。阅读重点是把 ${theme} 放回完整工程场景中理解。`,
    "",
    "## 2. 学习目标",
    "- 能说明本节知识点解决的真实问题，而不是只复述概念定义。",
    "- 能把课堂示例迁移到项目场景，判断哪些代码应该抽象、哪些状态应该下沉、哪些逻辑应该拆成服务。",
    "- 能在答辩或项目报告中讲清技术选择、边界划分、风险点和验证方式。",
    "",
    "## 3. 前置知识检查",
    "| 检查项 | 达标表现 | 需要回看的内容 |",
    "| --- | --- | --- |",
    "| 课程主线 | 能说出本节课从问题到实现的顺序 | 视频主线、课堂讲义 |",
    "| 概念边界 | 能区分概念之间的职责差异 | 术语表、老师板书 |",
    "| 项目语境 | 能把知识点对应到页面、接口、数据或部署环节 | 实操任务单、项目代码 |",
    "",
    "## 4. 背景原理",
    isVueCourse
      ? "在 Vue 3 项目里，页面能跑起来只是第一层目标。真正影响后续维护的是组件边界、组合式逻辑复用、状态读写路径、接口错误处理和多人协作规范。如果这些边界没有提前设计，后期很容易出现“页面越写越长、状态到处传、接口变化牵一发动全身”的问题。"
      : "课堂知识点通常来自真实工程问题的抽象。学习时不能只记住结论，还要理解它出现的背景：它试图降低什么复杂度、约束什么风险、提升哪一类协作效率。",
    "",
    "## 5. 核心概念展开",
    "### 5.1 问题来源",
    "先判断当前知识点面对的是理解问题、设计问题、实现问题还是协作问题。不同问题对应的解决方式不同，不能把所有内容都当成代码技巧处理。",
    "",
    "### 5.2 结构边界",
    isVueCourse
      ? "组件负责表达页面结构，组合式函数负责复用状态逻辑，接口层负责隔离后端变化，路由和权限负责控制访问路径。边界越清楚，越容易做单元测试、联调和后续迭代。"
      : "结构边界决定后续复习和迁移是否顺畅。建议按“输入、处理、输出、反馈”四个环节梳理每个知识点的位置。",
    "",
    "### 5.3 工程验证",
    "任何设计都需要验证：页面是否能正常交互、异常状态是否覆盖、数据是否能回显、接口失败是否有提示、多人修改时是否容易冲突。",
    "",
    "## 6. 场景案例",
    isVueCourse
      ? "以资源中心页面为例：资料列表、文件预览、AI 补齐、收藏状态和学习建议都不是孤立按钮。它们共同构成一个学习资料工作流，因此需要统一资源模型、统一跳转参数、统一预览页，而不是每个入口各写一套页面。"
      : "以课程资源页为例：同一份知识可以出现在讲义、练习、导图、板书和 AI 导师对话里。系统需要保证这些入口指向同一学习目标，否则学生会看到很多碎片，却无法形成主线。",
    "",
    "## 7. 对比理解",
    "| 做法 | 短期效果 | 长期风险 | 推荐处理 |",
    "| --- | --- | --- | --- |",
    "| 只完成页面展示 | 进度快 | 后续难维护、难复用 | 抽出统一数据模型和预览入口 |",
    "| 每个入口单独跳转 | 局部可用 | 用户体验不一致 | 统一路由参数和展示规范 |",
    "| 文档只写结论 | 看起来简短 | 学生无法迁移 | 补背景、案例、问题和验收标准 |",
    "",
    "## 8. 阅读任务",
    "1. 用 3 句话概括本节知识点解决的工程问题。",
    "2. 找出一个课堂示例可以迁移到项目中的场景。",
    "3. 写出一个可能出错的边界情况，并说明如何验证。",
    "4. 准备一段答辩说明：为什么你的项目要采用当前设计。",
    "",
    "## 9. 验收标准",
    "- 能独立解释核心概念，不依赖原文照读。",
    "- 能把概念落到页面、接口、数据或协作流程中。",
    "- 能说出至少一个替代方案，以及为什么当前方案更适合本项目。",
    "- 能形成下一步实操计划：改哪个模块、验证哪个状态、补哪类资料。",
  ].join("\n");
}

function buildFallbackCodingLabMarkdown(courseId: string) {
  const isVueCourse = courseId === "series-1";
  return [
    "# 代码实操任务单",
    "",
    "## 1. 任务目标",
    isVueCourse
      ? "围绕 Vue 3 项目工程化场景完成一次小型重构：把页面中的资料打开、状态判断和异常提示整理为更清晰的流程。"
      : "围绕当前课程知识点完成一次可运行、可验证、可复盘的代码实操任务。",
    "",
    "## 2. 输入条件",
    "- 已理解当前课程主线和资料预览流程。",
    "- 已能找到页面入口、资源数据和跳转参数。",
    "- 已准备至少 2 个正常场景和 1 个异常场景用于验证。",
    "",
    "## 3. 实现步骤",
    "1. 阅读现有代码，标出数据来源、用户操作和页面跳转位置。",
    "2. 抽出判断规则：哪些参数必须存在，哪些参数可以兜底，哪些情况必须提示用户。",
    "3. 完成实现后，分别验证资源中心、收藏页、直接 URL 三种入口。",
    "4. 记录验证结果：页面是否正确显示、是否进入统一预览页、异常状态是否可理解。",
    "",
    "## 4. 提交要求",
    "| 项目 | 要求 |",
    "| --- | --- |",
    "| 功能 | 能从指定入口打开资料并显示完整正文 |",
    "| 体验 | 页面结构清晰，有目录、正文和资料信息 |",
    "| 稳定性 | 缺少文件或接口超时时不出现空白页 |",
    "| 可解释性 | 能说明为什么这样组织代码和页面 |",
    "",
    "## 5. 自测清单",
    "- [ ] 点击资源中心的核心资料能直接进入预览页。",
    "- [ ] 点击收藏页的预览资料能进入同一套预览页。",
    "- [ ] 文本、PDF、图片、视频、代码实操不会互相误判。",
    "- [ ] 页面宽度较小时仍能看到关键信息。",
    "",
    "## 6. 复盘问题",
    "- 哪个判断最容易写成硬编码？",
    "- 哪个状态最容易导致空白页？",
    "- 如果后端接口字段变化，前端应在哪里做兼容？",
  ].join("\n");
}

function buildLocalFallbackResources(courseId: string): UiResourceGroup[] {
  const orderedVideos = getCourseVideoPlaylist(courseId);
  const previewVideo = orderedVideos[0];
  const illustrationPreview = buildTeachingIllustrationPreview(courseId);

  return [
    {
      resourceId: `${courseId}-fallback-reading`,
      courseId,
      title: "课程拓展阅读",
      category: "handouts",
      uploader: "AI 资料补全引擎",
      updatedAt: "刚刚",
      downloads: 0,
      summary: "围绕当前章节补出原理背景、延伸材料与深入阅读，适合在掌握主线后继续展开。",
      resourceTypes: ["extended_reading"],
      files: [
        {
          fileId: `${courseId}-fallback-reading-file`,
          name: "课程拓展阅读.md",
          type: "text",
          format: "拓展阅读",
          size: "在线生成",
          uploadedDate: "最新",
          excerpt: "包括背景原理、延伸知识点、对比材料与继续阅读建议。",
          previewUrl: buildFallbackExtendedReadingMarkdown(courseId),
        },
      ],
    },
    {
      resourceId: `${courseId}-fallback-handout`,
      courseId,
      title: "课程讲义速览",
      category: "handouts",
      uploader: "课程资料库",
      updatedAt: "刚刚",
      downloads: 0,
      summary: "优先回看本节的核心概念、结构关系和高频术语，先建立主线再进入细节。",
      resourceTypes: ["lecture_note"],
      files: [
        {
          fileId: `${courseId}-fallback-handout-file`,
          name: "课程讲义速览.pdf",
          type: "pdf",
          format: "PDF 文档",
          size: "本地预览",
          uploadedDate: "最新",
          excerpt: "这是一份本地预置讲义，用来保证资源页首屏可以立即浏览。",
        },
      ],
    },
    {
      resourceId: `${courseId}-fallback-coding-lab`,
      courseId,
      title: "代码实操任务单",
      category: "notes",
      uploader: "AI 实操引擎",
      updatedAt: "刚刚",
      downloads: 0,
      summary: "围绕当前知识点补出案例练习、操作步骤与动手任务，适合直接进入实操演练。",
      resourceTypes: ["coding_lab"],
      files: [
        {
          fileId: `${courseId}-fallback-coding-lab-file`,
          name: "代码实操任务单.md",
          type: "text",
          format: "代码实操",
          size: "在线生成",
          uploadedDate: "最新",
          excerpt: "包括任务目标、案例背景、步骤拆解和提交要求。",
          previewUrl: buildFallbackCodingLabMarkdown(courseId),
        },
      ],
    },
    {
      resourceId: `${courseId}-fallback-video`,
      courseId,
      title: "课堂视频回看",
      category: "videos",
      uploader: "课堂视频库",
      updatedAt: "刚刚",
      downloads: 0,
      summary: "适合直接续看当前课程视频，先把主线内容走完，再回头精读资料。",
      resourceTypes: ["video"],
      files: [
        {
          fileId: `${courseId}-fallback-video-file`,
          name: "课堂视频回看.mp4",
          type: "video",
          format: "MP4 文件",
          size: "流媒体",
          uploadedDate: "最新",
          excerpt: "这是一条本地视频入口，用来保证资源页首屏可以立刻进入课程内容。",
          openUrl: previewVideo,
          previewUrl: previewVideo,
        },
      ],
    },
    {
      resourceId: `${courseId}-fallback-illustration`,
      courseId,
      title: "AI 教学插图与流程示意",
      category: "handouts",
      uploader: "多模态资源引擎",
      updatedAt: "刚刚",
      downloads: 0,
      summary: "基于知识点自动生成流程图、结构图和实验示意图，用于讲义、PPT 和课堂答疑中的图文增强展示。",
      resourceTypes: ["visual_illustration"],
      files: [
        {
          fileId: `${courseId}-fallback-illustration-file`,
          name: "教学插图-系统流程示意.svg",
          type: "image",
          format: "AI 生成插图",
          size: "在线生成",
          uploadedDate: "最新",
          excerpt: "Stable Diffusion 类文生图能力生成的课堂示意图，可直接用于演示和课件。",
          previewUrl: illustrationPreview,
          openUrl: illustrationPreview,
        },
      ],
    },
    {
      resourceId: `${courseId}-fallback-animation`,
      courseId,
      title: "知识点讲解动画样片",
      category: "videos",
      uploader: "多模态视频引擎",
      updatedAt: "刚刚",
      downloads: 0,
      summary: "围绕当前课程章节生成 30 到 60 秒的知识点动画，用于课前导入、实验演示和答辩短视频。",
      resourceTypes: ["micro_video"],
      files: [
        {
          fileId: `${courseId}-fallback-animation-file`,
          name: "知识点讲解动画.mp4",
          type: "video",
          format: "讲解动画",
          size: "流媒体",
          uploadedDate: "最新",
          excerpt: "Open-Sora 类文生视频能力生成的短动画，适合做多模态教学视频展示。",
          openUrl: previewVideo,
          previewUrl: previewVideo,
        },
      ],
    },
    {
      resourceId: `${courseId}-fallback-asr`,
      courseId,
      title: "课堂字幕与语音转写",
      category: "notes",
      uploader: "Whisper ASR",
      updatedAt: "刚刚",
      downloads: 0,
      summary: "自动提取课堂视频的逐句字幕、术语纠错和时间戳，支撑视频总结、分段问答与双语字幕。",
      resourceTypes: ["subtitle_transcript"],
      files: [
        {
          fileId: `${courseId}-fallback-asr-file`,
          name: "课堂字幕转写.txt",
          type: "text",
          format: "ASR 字幕",
          size: "在线生成",
          uploadedDate: "最新",
          excerpt:
            "00:00 课程背景与目标\n00:22 核心概念拆解\n01:04 系统流程说明\n01:42 关键公式与工程判断\n02:18 课堂总结与复习建议",
          previewUrl:
            "00:00 课程背景与目标\n00:22 核心概念拆解\n01:04 系统流程说明\n01:42 关键公式与工程判断\n02:18 课堂总结与复习建议\n\nWhisper 负责把视频语音转成结构化字幕，并回写到视频问答与知识点时间轴。",
        },
      ],
    },
    {
      resourceId: `${courseId}-fallback-ocr`,
      courseId,
      title: "真实板书生成与课件文字抽取",
      category: "notes",
      uploader: "PaddleOCR",
      updatedAt: "刚刚",
      downloads: 0,
      summary: "从实验截图、教师板书和 PPT 页面中提取文字，自动补充到知识库和可读讲义里。",
      resourceTypes: ["ocr_notes"],
      files: [
        {
          fileId: `${courseId}-fallback-ocr-file`,
          name: "真实板书生成稿.md",
          type: "text",
          format: "真实板书",
          size: "在线生成",
          uploadedDate: "最新",
          excerpt:
            "OCR 识别文本：状态边界要和组件职责一起设计\n黑板布局还原：左侧放问题，中间放主线，右侧放检查项\n结构化笔记：渲染性能问题先定位，再优化",
          previewUrl:
            "# 真实板书生成稿\n\n## OCR 识别文本\n- 状态边界要和组件职责一起设计\n- Context 切片优先按读写热点划分\n- 渲染性能问题先定位，再优化\n\n## 黑板布局还原\n- 左区：本节问题与目标\n- 中区：状态边界、组件职责、数据流主线\n- 右区：性能检查项与课后复盘动作\n\n## 可直接抄写的板书版式\n```text\n【前端工程化状态边界】\n1. 问题：组件职责不清会放大状态复杂度\n2. 结构：状态来源 -> 读写热点 -> Context 切片 -> 渲染验证\n3. 易错：先优化代码而不是先定位瓶颈\n```\n\nPaddleOCR 会把课件页面、板书截图与实验示意图中的文字抽出后，交给资源生成智能体整理为可复习的真实板书稿。",
        },
      ],
    },
  ];
}

function buildLocalFallbackFavoriteIds(resources: UiResourceGroup[]) {
  return new Set(resources.slice(0, 1).map((item) => item.resourceId));
}

function buildResourceTutorPrompt(resource: UiResourceGroup) {
  const categoryLabel =
    resource.category === "handouts" ? "讲义资料" : resource.category === "videos" ? "视频资源" : "实践笔记";
  return `请结合这份${categoryLabel}《${resource.title}》，先用中文梳理主线，再给我推荐 3 个最值得继续看的相关视频资源。每个推荐都要附上可点击链接、推荐理由、适合当前阶段的原因，并告诉我先看哪一个。`;
}

function buildCourseBundleTutorPrompt(bundle: UiCourseBundle) {
  return `请结合课程《${bundle.title}》当前已有的讲义、视频、笔记和补充资料，先梳理这门课的学习主线，再给我推荐 3 个下一步最值得看的视频资源。每个推荐都要附上可点击链接、推荐理由、对应解决的问题，以及建议的观看顺序。`;
}

function buildCourseBundles(resources: UiResourceGroup[], courseDetailMap: Map<string, CourseDetail | null>) {
  const grouped = new Map<string, UiResourceGroup[]>();
  for (const resource of resources) {
    const list = grouped.get(resource.courseId) || [];
    list.push(resource);
    grouped.set(resource.courseId, list);
  }

  return Array.from(grouped.entries()).map(([bundleCourseId, rawCourseResources]) => {
    const courseResources = dedupeResourceGroups(rawCourseResources);
    const primaryResource =
      courseResources.find((item) => item.category === "handouts") ||
      courseResources.find((item) => item.category === "videos") ||
      courseResources[0];
    const detail = courseDetailMap.get(bundleCourseId);
    const files = courseResources.flatMap((item) => item.files);
    const resourceTypes = Array.from(new Set(courseResources.flatMap((item) => item.resourceTypes)));
    const categories = Array.from(new Set(courseResources.map((item) => item.category)));
    const coverageLabels = Array.from(
      new Set(
        resourceTypes.map((resourceType) => {
          const normalized = normalizeCoverageResourceType(resourceType);
          return RESOURCE_COVERAGE_LABELS[normalized] || RESOURCE_COVERAGE_LABELS[resourceType] || "课程资料";
        }),
      ),
    ).slice(0, 4);
    const summary = detail?.introduce
      ? `${detail.introduce} 当前已整理 ${coverageLabels.join("、")} 等 ${courseResources.length} 组资料。`
      : `这门课当前已整理 ${coverageLabels.join("、")} 等 ${courseResources.length} 组资料，适合先快速浏览已有内容，再按缺口继续补齐。`;

    return {
      bundleId: `course-bundle-${bundleCourseId}`,
      courseId: bundleCourseId,
      title: detail?.name || primaryResource?.title?.replace(/速览|回看|样片|识别与课件文字抽取/g, "").trim() || "当前课程",
      summary,
      resourceCount: courseResources.length,
      fileCount: files.length,
      updatedAt: primaryResource?.updatedAt || "刚刚",
      categories,
      resourceTypes,
      files,
      resources: courseResources,
      primaryResource,
    } satisfies UiCourseBundle;
  });
}

function normalizeSearchText(value?: string | number | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildSearchTokens(query: string) {
  const normalized = normalizeSearchText(query);
  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
}

function getRouteCourseSearchText(courseId: string) {
  if (courseId === "series-2") {
    return "软件工程与实践 第4版 软件工程基础 需求分析 系统设计 测试维护 项目管理 生命周期 瀑布模型 螺旋模型 用例 UML 接口 文档";
  }
  if (courseId === "series-1") {
    return "现代网页设计系统实战 Vue React 前端 网页 页面 组件 设计系统 交互 CSS HTML JavaScript TypeScript Vite";
  }
  return "";
}

function buildResourceSearchText(group: UiResourceGroup, courseDetail?: CourseDetail | null) {
  const rawResource = group.rawResource;
  const fileText = group.files
    .map((file) =>
      [
        file.name,
        file.format,
        file.type,
        file.size,
        file.excerpt,
        file.studyAdvice,
        file.previewUrl && !/^data:|^https?:\/\//i.test(file.previewUrl) ? file.previewUrl : "",
      ].join(" "),
    )
    .join(" ");

  return normalizeSearchText(
    [
      getRouteCourseSearchText(group.courseId),
      courseDetail?.name,
      courseDetail?.introduce,
      courseDetail?.teacher_name,
      courseDetail?.cate_names,
      group.title,
      group.summary,
      group.uploader,
      group.category,
      group.updatedAt,
      group.resourceTypes.join(" "),
      fileText,
      rawResource?.title,
      rawResource?.summary,
      rawResource?.content_markdown,
      rawResource?.study_suggestion,
      rawResource?.source_titles?.join(" "),
    ].join(" "),
  );
}

function doesResourceMatchSearch(group: UiResourceGroup, query: string, courseDetail?: CourseDetail | null) {
  const tokens = buildSearchTokens(query);
  if (tokens.length === 0) {
    return true;
  }
  const searchableText = buildResourceSearchText(group, courseDetail);
  return tokens.every((token) => searchableText.includes(token));
}

export default function ResourceCenter() {
  const activeUserId = getCurrentLoggedInUserId();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const routeCourseId = searchParams.get("courseId") || "";
  const courseId = DEFAULT_ROUTE_COURSE_ID;
  const focusedResourceId = searchParams.get("resourceId");
  const searchParamText = searchParams.get("search") || "";

  const [activeTab, setActiveTab] = useState<ResourceTab>("all");
  const [searchQuery, setSearchQuery] = useState(searchParamText);
  const [activeCourseContext, setActiveCourseContext] = useState(courseId);
  const [resourceGroups, setResourceGroups] = useState<UiResourceGroup[]>(() => buildLocalFallbackResources(courseId));
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingType, setGeneratingType] = useState<ResourceSupplementType | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => buildLocalFallbackFavoriteIds(buildLocalFallbackResources(courseId)));
  const [favoriteSummary, setFavoriteSummary] = useState(buildLocalFallbackFavoriteIds(buildLocalFallbackResources(courseId)).size);
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<{
    courseId: string;
    resourceType: ResourceSupplementType;
    successLabel: string;
    stage: "running" | "completed";
    targetResourceId?: string;
  } | null>(null);
  const [optimisticGeneratedByCourse, setOptimisticGeneratedByCourse] = useState<Record<string, UiResourceGroup[]>>({});
  const [classroomExpanded, setClassroomExpanded] = useState(true);
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [profileSummary, setProfileSummary] = useState<ProfileSummaryResponse | null>(null);
  const [aiPptTopic, setAiPptTopic] = useState("");
  const [aiPptSourceText, setAiPptSourceText] = useState("");
  const [aiPptSourceLabel, setAiPptSourceLabel] = useState("课程主题");
  const [aiPptDraft, setAiPptDraft] = useState<AiPptDraft | null>(null);
  const [aiPptActiveSlide, setAiPptActiveSlide] = useState(0);
  const [aiPptGenerating, setAiPptGenerating] = useState(false);
  const hasAutoFocusedRef = useRef(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const latestGeneratedResourceRef = useRef<HTMLButtonElement | null>(null);

  const backendCourseCode = resolveBackendCourseCode(courseId);
  const backendCourseId = resolveBackendCourseId(courseId);

  useEffect(() => {
    persistLastRouteCourseId(courseId);
  }, [courseId]);

  useEffect(() => {
    if (routeCourseId === DEFAULT_ROUTE_COURSE_ID) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("courseId", DEFAULT_ROUTE_COURSE_ID);
    navigate(`/resources?${nextParams.toString()}`, { replace: true });
  }, [navigate, routeCourseId, searchParams]);

  useEffect(() => {
    const fallbackResources = buildLocalFallbackResources(courseId);
    setActiveCourseContext(courseId);
    setResourceGroups(fallbackResources);
    setFavoriteIds(buildLocalFallbackFavoriteIds(fallbackResources));
    setFavoriteSummary(buildLocalFallbackFavoriteIds(fallbackResources).size);
    setHasLoadedOnce(false);
    setIsLoading(true);
    setOptimisticGeneratedByCourse({});
  }, [courseId]);

  useEffect(() => {
    setSearchQuery(searchParamText);
  }, [searchParamText]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!generationStatus || generationStatus.stage !== "completed") return;
    const timer = window.setTimeout(() => setGenerationStatus(null), 3200);
    return () => window.clearTimeout(timer);
  }, [generationStatus]);

  useEffect(() => {
    if (!workspaceRef.current) return;
    const cards = workspaceRef.current.querySelectorAll<HTMLElement>("[data-resource-reveal]");
    if (!cards.length) return;

    gsap.fromTo(
      cards,
      { opacity: 0, y: 22, scale: 0.985 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.72,
        ease: "power3.out",
        stagger: 0.05,
      },
    );
  }, [resourceGroups, activeTab, searchQuery, generatingType]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateResourceCenter() {
      setLoadError(null);
      setRefreshing(false);
      const resourceTask = studentApi.listResourcesByCourseCode(activeUserId, backendCourseCode);
      const favoriteTask = studentApi.listFavoriteResources(activeUserId, 3000);
      const summaryTask = studentApi.getFavoriteSummary(activeUserId, 3000);

      try {
        const resourceResult = await resourceTask;
        if (!cancelled) {
          setResourceGroups(mapApiResourcesToUi(resourceResult.items, activeCourseContext));
          setLoadError(null);
        }
      } catch (resourceError) {
        if (!cancelled) {
          const nextError = resourceError instanceof Error ? resourceError.message : "资源加载失败";
          setLoadError(nextError);
          setToastMessage("已先展示本地资料，实时资源同步暂时未完成。");
        }
      } finally {
        if (!cancelled) {
          setHasLoadedOnce(true);
          setIsLoading(false);
        }
      }

      void favoriteTask.then((favoriteList) => {
        if (cancelled) return;
        setFavoriteIds(new Set(favoriteList.items.map((item) => String(item.resource_id || item.title))));
      }).catch(() => {
        // Keep existing local favorite state.
      });

      void summaryTask.then((summary) => {
        if (cancelled) return;
        setFavoriteSummary(summary.total || 0);
      }).catch(() => {
        // Keep existing local summary state.
      });
    }

    void hydrateResourceCenter();
    return () => {
      cancelled = true;
    };
  }, [activeCourseContext, activeUserId, backendCourseCode]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateCourseDetail() {
      const backendCourseIdMap: Record<string, number> = {
        "series-1": 201,
        "series-2": 401,
        "series-3": 301,
        "course-4": 302,
      };
      const backendCourseId = backendCourseIdMap[courseId] || 201;
      try {
        const detail = await studentApi.getCourseDetail(backendCourseId);
        if (!cancelled) {
          setCourseDetail(detail);
        }
      } catch {
        if (!cancelled) {
          setCourseDetail(null);
        }
      }
    }

    void hydrateCourseDetail();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    void studentApi
      .getProfileSummary(activeUserId)
      .then((summary) => {
        if (!cancelled) {
          setProfileSummary(summary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfileSummary(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeUserId]);

  const filteredResources = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = resourceGroups.filter((group) => {
      const matchesTab = activeTab === "all" || group.category === activeTab;
      if (!normalizedQuery) {
        return matchesTab;
      }

      const matchesSearch = doesResourceMatchSearch(group, normalizedQuery, courseDetail);

      return matchesTab && matchesSearch;
    });

    if (!focusedResourceId) {
      return filtered;
    }

    return [...filtered].sort((left, right) => {
      const leftFocused = left.resourceId === focusedResourceId ? 1 : 0;
      const rightFocused = right.resourceId === focusedResourceId ? 1 : 0;
      return rightFocused - leftFocused;
    });
  }, [activeTab, courseDetail, focusedResourceId, resourceGroups, searchQuery]);

  const fallbackResources = useMemo(() => {
    const filtered = resourceGroups.filter((group) => activeTab === "all" || group.category === activeTab);
    if (!focusedResourceId) {
      return filtered;
    }
    return [...filtered].sort((left, right) => {
      const leftFocused = left.resourceId === focusedResourceId ? 1 : 0;
      const rightFocused = right.resourceId === focusedResourceId ? 1 : 0;
      return rightFocused - leftFocused;
    });
  }, [activeTab, focusedResourceId, resourceGroups]);

  const hasSearchQuery = Boolean(searchQuery.trim());
  const isSearchFallback = hasSearchQuery && filteredResources.length === 0 && fallbackResources.length > 0;
  const displayResources = isSearchFallback ? fallbackResources : filteredResources;
  const visibleTeachers = (courseDetail?.teachers || []).filter((item) => item.is_show !== false).slice(0, 3);
  const displayCourseBundles = useMemo(
    () => buildCourseBundles(displayResources, new Map([[courseId, courseDetail]])),
    [courseDetail, courseId, displayResources],
  );
  const resourceTypeSummary = useMemo(() => {
    const stats = new Map<string, number>();
    for (const item of resourceGroups) {
      for (const resourceType of item.resourceTypes) {
        const normalizedType = normalizeCoverageResourceType(resourceType);
        const nextKey =
          normalizedType === "lecture_note"
            ? "讲义/教案"
            : normalizedType === "mindmap"
              ? "导图"
              : normalizedType === "practice_set"
                ? "练习"
                : normalizedType === "extended_reading"
                  ? "阅读"
                  : normalizedType === "coding_lab"
                    ? "实操"
                    : normalizedType === "video"
                      ? "视频"
                      : normalizedType === "ppt"
                        ? "PPT"
                        : "资料";
        stats.set(nextKey, (stats.get(nextKey) || 0) + 1);
      }
    }
    return Array.from(stats.entries()).sort((left, right) => right[1] - left[1]).slice(0, 5);
  }, [resourceGroups]);
  const classroomWorkspace = useMemo(() => readPersistedCourseResourceWorkspace(courseId), [courseId]);
  const classroomGeneratedItems = useMemo<ClassroomGeneratedItem[]>(() => {
    const artifacts = (classroomWorkspace?.recentArtifacts || []).map((item) => ({
      ...item,
      itemType: "artifact" as const,
      actionLabel: "打开资料",
    }));
    const pptItems = classroomWorkspace?.recentPpt
      ? [
          {
            ...classroomWorkspace.recentPpt,
            itemType: "ppt" as const,
            actionLabel: "导出 PPT",
          },
        ]
      : [];
    return [...pptItems, ...artifacts].sort((left, right) => {
      const starDiff = Number(Boolean(right.starred)) - Number(Boolean(left.starred));
      if (starDiff !== 0) return starDiff;
      return right.generatedAt.localeCompare(left.generatedAt);
    });
  }, [classroomWorkspace]);
  const classroomGeneratedPptItems = classroomGeneratedItems.filter((item) => item.itemType === "ppt");
  const classroomGeneratedResourceItems = classroomGeneratedItems.filter((item) => item.itemType !== "ppt");
  const optimisticGeneratedResources = useMemo(
    () => dedupeResourceGroups(optimisticGeneratedByCourse[courseId] || []),
    [courseId, optimisticGeneratedByCourse],
  );
  const optimisticGeneratedPptResources = optimisticGeneratedResources.filter(
    (item) => normalizeCoverageResourceType(item.resourceTypes[0]) === "ppt",
  );
  const optimisticGeneratedStudyResources = optimisticGeneratedResources.filter(
    (item) => normalizeCoverageResourceType(item.resourceTypes[0]) !== "ppt",
  );

  useEffect(() => {
    if (!focusedResourceId || isLoading || hasAutoFocusedRef.current) {
      return;
    }

    const targetNode = document.getElementById(`resource-binder-grid-${focusedResourceId}`);
    if (!targetNode) {
      return;
    }

    hasAutoFocusedRef.current = true;
    window.requestAnimationFrame(() => {
      targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [focusedResourceId, isLoading, filteredResources]);

  useEffect(() => {
    hasAutoFocusedRef.current = false;
  }, [focusedResourceId]);

  const handleOpenPreview = (
    resGroup: UiResourceGroup,
    fileId: string,
    previewGenerationIntent?: {
      stage: "running" | "completed";
      successLabel: string;
      resourceType?: ResourceSupplementType;
    } | null,
  ) => {
    const numericFileId = Number(fileId);
    const numericResourceId = Number(resGroup.resourceId);
    const selectedFile = resGroup.files.find((item) => item.fileId === fileId);
    const courseVideoTarget = previewGenerationIntent ? null : buildCourseVideoTarget(resGroup.courseId, selectedFile);
    if (courseVideoTarget) {
      navigate(courseVideoTarget);
      return;
    }
    const appendGenerationParams = (params: URLSearchParams) => {
      if (!previewGenerationIntent) return params;
      params.set("generationStage", previewGenerationIntent.stage);
      params.set("generationLabel", previewGenerationIntent.successLabel);
      if (previewGenerationIntent.resourceType) {
        params.set("generationType", previewGenerationIntent.resourceType);
      }
      return params;
    };
    const nextParams = new URLSearchParams({
      courseId: resGroup.courseId,
      fileId,
    });
    if (Number.isFinite(numericResourceId) && numericResourceId > 0) {
      nextParams.set("resourceId", String(numericResourceId));
    }
    appendGenerationParams(nextParams);
    const targetUrl = `/resources/preview?${nextParams.toString()}`;
    if (previewGenerationIntent?.stage === "running") {
      window.location.assign(targetUrl);
      return;
    }
    navigate(targetUrl, {
      state: {
        initialResource: resGroup.rawResource || null,
        initialFileId: Number.isFinite(numericFileId) ? numericFileId : null,
        initialPreviewFile: selectedFile ? buildInitialPreviewFile(resGroup, selectedFile) : null,
        generationIntent: previewGenerationIntent || null,
      },
    });
  };

  const handleOpenBundleFilePreview = (bundle: UiCourseBundle, fileId?: string | null) => {
    const usableBundleFiles = bundle.files.filter((file) => file.fileId && file.fileId !== "undefined" && file.fileId !== "null");
    const requestedFile = fileId ? usableBundleFiles.find((file) => file.fileId === fileId) : null;
    const selectedFile = requestedFile || usableBundleFiles[0] || bundle.files[0] || bundle.primaryResource.files[0];

    if (!selectedFile?.fileId) {
      setToastMessage("这组资料还没有可打开的文件，请先刷新资料或选择下方具体文件。");
      return;
    }

    const ownerResource =
      bundle.resources.find((resource) => resource.files.some((file) => file.fileId === selectedFile.fileId)) ||
      bundle.resources.find((resource) => Number.isFinite(Number(resource.resourceId)) && Number(resource.resourceId) > 0) ||
      bundle.primaryResource;

    const courseVideoTarget = buildCourseVideoTarget(bundle.courseId, selectedFile);
    if (courseVideoTarget) {
      navigate(courseVideoTarget);
      return;
    }
    const { previewResource, initialFileId } = buildBundlePreviewResource(bundle, ownerResource, selectedFile.fileId);
    const resolvedFileId = initialFileId ?? Number(selectedFile.fileId);
    const routeResourceId = Number.isFinite(Number(ownerResource.resourceId)) && Number(ownerResource.resourceId) > 0
      ? ownerResource.resourceId
      : Number.isFinite(Number(bundle.primaryResource.resourceId)) && Number(bundle.primaryResource.resourceId) > 0
        ? bundle.primaryResource.resourceId
        : Number.isFinite(Number(focusedResourceId)) && Number(focusedResourceId) > 0
          ? focusedResourceId
          : "";

    const nextParams = new URLSearchParams({
      courseId: bundle.courseId,
      fileId: String(Number.isFinite(Number(resolvedFileId)) ? resolvedFileId : selectedFile.fileId),
    });
    if (routeResourceId) {
      nextParams.set("resourceId", routeResourceId);
    }
    navigate(`/resources/preview?${nextParams.toString()}`, {
      state: {
        initialResource: previewResource,
        initialFileId: Number.isFinite(Number(resolvedFileId)) ? Number(resolvedFileId) : null,
        initialPreviewFile:
          (previewResource.source_files || []).find((file) => file.file_id === Number(resolvedFileId)) ||
          (previewResource.source_files || [])[0] ||
          null,
      },
    });
  };

  useEffect(() => {
    if (!focusedResourceId || isLoading) {
      return;
    }
    const targetResource = resourceGroups.find((item) => item.resourceId === focusedResourceId);
    if (!targetResource) {
      return;
    }
    const normalizedType = normalizeSupplementResourceType(targetResource.resourceTypes[0]);
    if (normalizedType !== "coding_lab") {
      return;
    }
    const previewFile = targetResource.files[0];
    handleOpenPreview(targetResource, previewFile?.fileId || targetResource.resourceId);
  }, [focusedResourceId, isLoading, resourceGroups]);

  const loadResourcesWithMode = async (
    mode: "initial" | "refresh" = "initial",
    timeoutMs?: number,
    nextCourseId?: string,
  ) => {
    const targetCourseId = nextCourseId || courseId;
    const targetBackendCourseCode = resolveBackendCourseCode(targetCourseId);
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);
    try {
      const response = await studentApi.listResourcesByCourseCode(
        activeUserId,
        targetBackendCourseCode,
        undefined,
        timeoutMs,
      );
      const nextGroups = dedupeResourceGroups(mapApiResourcesToUi(response.items, targetCourseId));
      setResourceGroups((current) =>
        mode === "refresh" ? dedupeResourceGroups([...nextGroups, ...current]) : nextGroups,
      );
      setLoadError(null);
      setHasLoadedOnce(true);
      if (mode === "refresh") {
        setToastMessage("资源列表已刷新。");
      }
    } catch (error) {
      const nextError = error instanceof Error ? error.message : "资源加载失败";
      if (resourceGroups.length === 0) {
        setLoadError(nextError);
      } else {
        setLoadError(null);
      }
      if (mode === "refresh") {
        setToastMessage("真实资源刷新超时，当前继续展示本地可用资料。");
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleGenerateResources = async (
    resourceType: ResourceSupplementType,
    bundleCourseId?: string,
    topicHint?: string,
  ) => {
    const option = RESOURCE_SUPPLEMENT_OPTIONS.find((item) => item.id === resourceType);
    const targetCourseId = bundleCourseId || courseId;
    const targetBackendCourseId = resolveBackendCourseId(targetCourseId);
    setGeneratingType(resourceType);
    setGenerationStatus({
      courseId: targetCourseId,
      resourceType,
      successLabel: option?.successLabel || "目标资源",
      stage: "running",
    });
    setLoadError(null);
    beginUiProgress(0.16);
    setUiProgress(0.3);
    if (resourceType === "coding_lab") {
      const fallbackCodingLab = buildLocalFallbackResources(targetCourseId).find((item) => item.resourceTypes.includes("coding_lab"));
      const fallbackFileId = fallbackCodingLab?.files[0]?.fileId || fallbackCodingLab?.resourceId;
      if (fallbackCodingLab && fallbackFileId) {
        window.requestAnimationFrame(() => {
          handleOpenPreview(fallbackCodingLab, fallbackFileId, {
            stage: "running",
            successLabel: option?.successLabel || "代码实操",
            resourceType,
          });
        });
      }
    }
    try {
      const generationHints = RESOURCE_GENERATION_HINTS[resourceType] || ["核心知识点"];
      const profileContext = buildResourceGenerationProfileContext(profileSummary);
      const knowledgePoints = buildProfileAwareKnowledgePoints({
        profile: profileSummary,
        courseTitle: courseDetail?.name || currentCourseTitle || "当前课程",
        sectionTitle: topicHint || resourceType,
        resourceTitle: topicHint || option?.successLabel || "生成资料",
        resourceSummary: option?.description || "按当前课堂资料补充学习内容",
        generationLabel: option?.triggerLabel || option?.successLabel || resourceType,
        searchQuery: searchQuery.trim(),
        extraHints: searchQuery.trim()
          ? [searchQuery.trim()]
          : topicHint
            ? [topicHint, ...generationHints]
            : generationHints,
      });
      const response = await studentApi.generateResources({
        user_id: activeUserId,
        course_id: targetBackendCourseId,
        knowledge_points: knowledgePoints,
        resource_types: [resourceType],
        profile_context: profileContext,
      });
      setUiProgress(0.62);
      const generatedGroups = response.resources?.length
        ? mapApiResourcesToUi(
            response.resources.filter((item) => normalizeCoverageResourceType(item.resource_type) === resourceType),
            targetCourseId,
          )
        : [];
      if (!generatedGroups.length) {
        throw new Error(`当前没有生成出${option?.successLabel || "目标资源"}`);
      }
      const nextPrimaryResource =
        generatedGroups
          .slice()
          .sort((left, right) => (right.generatedAtRank || 0) - (left.generatedAtRank || 0))[0] || generatedGroups[0];
      setOptimisticGeneratedByCourse((current) => ({
        ...current,
        [targetCourseId]: dedupeResourceGroups([...(current[targetCourseId] || []), ...generatedGroups]),
      }));
      setUiProgress(0.92);
      setToastMessage(`已补入${option?.successLabel || "目标资源"}。`);
      setGenerationStatus({
        courseId: targetCourseId,
        resourceType,
        successLabel: option?.successLabel || "目标资源",
        stage: "completed",
        targetResourceId: nextPrimaryResource?.resourceId,
      });
      setGeneratingType(null);
      finishUiProgress();
      const nextPrimaryFileId = nextPrimaryResource?.files[0]?.fileId || nextPrimaryResource?.resourceId;
      window.requestAnimationFrame(() => {
        if (nextPrimaryFileId) {
          handleOpenPreview(nextPrimaryResource, nextPrimaryFileId);
          return;
        }
        latestGeneratedResourceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      void loadResourcesWithMode("refresh", 30000, targetCourseId).catch(() => {
        setToastMessage("最新资源已先展示，后台同步稍慢，当前可先直接查看。");
      });
    } catch (error) {
      setLoadError(null);
      setGenerationStatus(null);
      setToastMessage(error instanceof Error ? error.message : "暂时没补齐成功，先继续看现有资料。");
    } finally {
      finishUiProgress();
      setGeneratingType((current) => (current === resourceType ? null : current));
    }
  };

  const handleToggleFavorite = async (resourceId: string) => {
    const numericId = Number(resourceId);
    if (!Number.isFinite(numericId)) {
      setToastMessage("当前资源缺少可收藏编号，暂无法回写。");
      return;
    }

    setFavoriteBusyId(resourceId);
    try {
      const result = await studentApi.favoriteResource(numericId, activeUserId);
      setFavoriteIds((current) => {
        const next = new Set(current);
        if (result.favorite) {
          next.add(resourceId);
        } else {
          next.delete(resourceId);
        }
        return next;
      });
      setFavoriteSummary((current) => Math.max(0, current + (result.favorite ? 1 : -1)));
      setToastMessage(result.favorite ? "已加入收藏。" : "已取消收藏。");
    } catch {
      setToastMessage("收藏回写失败，页面保留当前状态。");
    } finally {
      setFavoriteBusyId(null);
    }
  };

  const handleOpenTutorForResource = (resource: UiResourceGroup) => {
    openTutorPanel({
      courseId: resource.courseId,
      mode: "default",
      title: `${resource.title} · 资料精读`,
      subtitle: "AI 导师会结合当前资源页上下文继续讲解、提炼重点和安排下一步。",
      resourceId: Number(resource.resourceId) || undefined,
      resourceTitle: resource.title,
      resourceType: resource.rawResource?.resource_type || resource.resourceTypes[0],
      resourceSummary: resource.summary || "当前资源已同步到资料中心。",
      query: buildResourceTutorPrompt(resource),
      quickPrompts: ["提炼这份资料重点", "按考试/项目角度讲", "告诉我下一步先看什么"],
    });
  };

  const handleOpenTutorForBundle = (bundle: UiCourseBundle) => {
    openTutorPanel({
      courseId: bundle.courseId,
      mode: "default",
      title: `${bundle.title} · 课程资料工作台`,
      subtitle: "AI 导师会结合当前课程已有资料和缺口，继续讲解、补充和安排下一步。",
      resourceId: Number(bundle.primaryResource.resourceId) || undefined,
      resourceTitle: bundle.title,
      resourceType: bundle.primaryResource.rawResource?.resource_type || bundle.resourceTypes[0],
      resourceSummary: bundle.summary,
      query: buildCourseBundleTutorPrompt(bundle),
      quickPrompts: ["先梳理这门课的资料主线", "我应该先看哪份资料", "缺什么资源最值得先补"],
    });
  };

  const handleOpenGeneratedItem = (item: ClassroomGeneratedItem) => {
    if (item.itemType === "ppt") {
      exportDeckAsPptx(item.fileName, item.slides);
      setToastMessage("课堂 PPT 已开始导出。");
      return;
    }
    const previewTarget = buildGeneratedResourcePreviewState(courseId, item);
    navigate(previewTarget.pathname, {
      state: {
        ...previewTarget.state,
        generationIntent: {
          stage: "completed",
          successLabel: item.itemType === "artifact"
            ? item.kind === "handout"
              ? "拓展阅读"
              : item.kind === "mindmap"
                ? "知识导图"
                : "练习资料"
            : "课堂 PPT",
        },
      },
    });
  };

  const handleOpenPptExplanationVideo = (item: Extract<ClassroomGeneratedItem, { itemType: "ppt" }>) => {
    if (!item.explanationVideo) {
      setToastMessage("这份 PPT 还没有生成讲解视频，请先回课堂页生成。");
      return;
    }
    openTutorPanel({
      courseId,
      mode: "ppt",
      title: item.explanationVideo.title,
      subtitle: `${item.explanationVideo.durationLabel} · ${item.explanationVideo.storyboard.length} 段分镜`,
      resourceTitle: getGeneratedDisplayTitle(item),
      resourceType: "ppt_explanation_video",
      resourceSummary: item.explanationVideo.summary,
      query: `请按照这份 PPT 讲解视频脚本继续讲解，并优先按分镜顺序展开：\n\n${item.explanationVideo.transcript}`,
      quickPrompts: ["按分镜讲一遍", "压缩成 1 分钟", "生成答辩口播稿"],
    });
    setToastMessage("AI 导师已接入 PPT 讲解视频脚本。");
  };

  const handleAiPptFileUpload = async (file?: File | null) => {
    if (!file) return;
    setAiPptSourceLabel(file.name);
    if (file.type.includes("pdf") || /\.pdf$/i.test(file.name)) {
      setAiPptSourceText(`已上传 PDF 讲义：${file.name}。正式后端会先抽取 PDF 纯文本，再交给阿里模型生成 PPT 大纲。`);
      setToastMessage("PDF 已接入生成流程，演示模式先使用文件名和课程上下文生成。");
      return;
    }
    try {
      const text = await file.text();
      setAiPptSourceText(text.slice(0, 9000));
      setToastMessage("讲义文本已读取，可以生成 PPT。");
    } catch {
      setAiPptSourceText(`已上传讲义文件：${file.name}`);
      setToastMessage("文件读取失败，已保留文件名用于生成。");
    }
  };

  const handleGenerateAiPpt = async () => {
    const courseTitle = courseDetail?.name || primaryCourseBundle?.title || currentCourseTitle || "软件工程";
    const topic = aiPptTopic.trim() || searchQuery.trim() || courseTitle;
    setAiPptGenerating(true);
    beginUiProgress(0.18);
    setUiProgress(0.34);
    const draft = buildAiPptDraft(topic, aiPptSourceText, courseTitle, aiPptSourceLabel);
    setAiPptDraft(draft);
    setAiPptActiveSlide(0);
    setToastMessage("已生成在线幻灯片预览，正在尝试同步后端 PPT 资源。");
    try {
      const profileContext = buildResourceGenerationProfileContext(profileSummary);
      const knowledgePoints = buildProfileAwareKnowledgePoints({
        profile: profileSummary,
        courseTitle,
        sectionTitle: topic,
        resourceTitle: aiPptSourceLabel || topic,
        resourceSummary: aiPptSourceText || "课程主题",
        generationLabel: "PPT 课件",
        searchQuery: searchQuery.trim(),
        extraHints: [draft.topic, draft.sourceLabel, ...draft.slides.slice(0, 3).map((slide) => slide.title)],
      });
      const response = await studentApi.generateResources({
        user_id: activeUserId,
        course_id: backendCourseId,
        knowledge_points: knowledgePoints,
        resource_types: ["ppt"],
        profile_context: profileContext,
      });
      const generatedGroups = response.resources?.length
        ? mapApiResourcesToUi(
            response.resources.filter((item) => normalizeCoverageResourceType(item.resource_type) === "ppt"),
            courseId,
          )
        : [];
      if (generatedGroups.length) {
        setOptimisticGeneratedByCourse((current) => ({
          ...current,
          [courseId]: dedupeResourceGroups([...(current[courseId] || []), ...generatedGroups]),
        }));
        setToastMessage("PPT 已生成，并放入 AI 生成结果区。");
      }
    } catch {
      setToastMessage("后端 PPT 接口暂未返回，已保留本地可下载 PPT。");
    } finally {
      setUiProgress(0.92);
      finishUiProgress();
      setAiPptGenerating(false);
    }
  };

  const handleExportAiPpt = () => {
    if (!aiPptDraft) {
      setToastMessage("请先生成 PPT。");
      return;
    }
    void exportDeckAsPptx(buildAiPptFileName(aiPptDraft), aiPptDraft.slides);
    setToastMessage("PPTX 已开始导出。");
  };

  const hasFilters = activeTab !== "all" || Boolean(searchQuery.trim());
  const recommendedFocusLabel =
    activeTab === "handouts"
      ? "优先精读讲义资料"
      : activeTab === "notes"
        ? "优先整理实践笔记"
        : activeTab === "videos"
          ? "优先观看视频资源"
          : "优先查看本课程核心资料";
  const totalFileCount = resourceGroups.reduce((sum, item) => sum + item.files.length, 0);
  const readyResourceTypeCount = resourceTypeSummary.length;
  const generationStatusLabel = generatingType ? "正在补齐资源" : hasLoadedOnce ? "实时资料已同步" : "正在同步资料";
  const primaryCourseBundle = displayCourseBundles[0] || null;
  const currentCourseTitle = courseDetail?.name || primaryCourseBundle?.title || "软件工程";
  const currentCourseSummary =
    courseDetail?.introduce ||
    primaryCourseBundle?.summary ||
    "围绕岗位能力对应课程整理讲义、实践笔记、竞赛参考和 AI 补充资料，支持预览、任务关联和继续训练。";
  const nextResourceAction = generatingType
    ? "等待当前资源生成完成"
    : totalFileCount > 0
      ? "先打开核心资料查看"
      : "先刷新同步课程资料";
  const shouldShowLoadError = Boolean(loadError) && !isLoading && resourceGroups.length === 0;

  return (
    <div ref={workspaceRef} className="space-y-3 select-none" id="resource-center-workspace">
      <section className="overflow-hidden rounded-[24px] border border-[#dce6f4] bg-[linear-gradient(135deg,#ffffff_0%,#f7fbff_48%,#fff4f8_100%)] p-3 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[10px] font-black text-[#006689] shadow-sm">
              <BookOpen className="h-3.5 w-3.5" />
              课程与竞赛资源工作台
            </div>
            <h1 className="mt-2 text-[23px] font-black tracking-[-0.05em] text-[#111827] md:text-[28px]">
              {currentCourseTitle}资源包
            </h1>
            <p className="mt-1.5 max-w-3xl text-[12px] leading-6 text-[#4b5563]">
              {currentCourseSummary}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/88 px-3 py-1 text-[11px] font-bold text-[#111827] shadow-sm">
                已收藏 {favoriteSummary} 份
              </span>
              <span className="rounded-full bg-[#f8fbff] px-3 py-1 text-[11px] font-bold text-[#006689] shadow-sm">
                {recommendedFocusLabel}
              </span>
              <span className="rounded-full bg-[#fff4f8] px-3 py-1 text-[11px] font-bold text-[#d64d7b] shadow-sm">
              按岗位任务补充
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {[
                { label: "资料状态", value: generationStatusLabel },
                { label: "当前规模", value: `${resourceGroups.length} 组 / ${totalFileCount} 个文件` },
                { label: "下一步", value: nextResourceAction },
              ].map((item) => (
                <div key={item.label} className="rounded-[16px] border border-white/85 bg-white/84 px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                  <div className="text-[10px] font-black text-[#8a94a3]">{item.label}</div>
                  <div className="mt-1 line-clamp-2 text-[13px] font-extrabold text-[#101828]">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[20px] border border-white/85 bg-white/86 p-3 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
            <div className="text-[10px] font-black text-[#8a94a3]">资源闭环</div>
            <div className="mt-3 space-y-2">
              {[
                { label: "看已有", detail: totalFileCount ? `${totalFileCount} 个文件可打开` : "等待资料同步" },
                { label: "补缺口", detail: readyResourceTypeCount ? `${readyResourceTypeCount} 类资源已覆盖` : "打开资料页后按需生成" },
                { label: "问导师", detail: "带着当前资源上下文继续追问" },
              ].map((item, index) => (
                <div key={item.label} className="flex items-center gap-3 rounded-2xl bg-[#f7fafb] px-3 py-1.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-[#006689] ring-1 ring-[#e1ebf5]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-[#171c22]">{item.label}</div>
                    <div className="mt-0.5 line-clamp-1 text-[10px] text-[#667085]">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              id="resource-center-refresh-existing-btn"
              onClick={() => {
                setActiveTab("all");
                void loadResourcesWithMode("refresh");
              }}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-full border border-[#d7e3ef] bg-white px-3.5 py-2 text-xs font-black text-[#111827] shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              刷新资料
            </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#dfe7ef] bg-white/96 p-3 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
        <div className="grid gap-3 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="rounded-[20px] border border-[#edf1f6] bg-[#f8fbff] p-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-black text-[#006689] ring-1 ring-[#dce8f3]">
              <Presentation className="h-3.5 w-3.5" />
              AI 自动生成 PPT
            </div>
            <h2 className="mt-3 text-[18px] font-black text-[#111827]">主题/讲义一键生成课件</h2>
            <p className="mt-1 text-[12px] leading-5 text-[#667085]">
              输入课程主题，或上传 md/pdf 讲义；系统会生成结构化大纲、逐页配图提示词、在线幻灯片和可下载 PPTX。
            </p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[11px] font-black text-[#344054]">课程主题</span>
                <input
                  value={aiPptTopic}
                  onChange={(event) => setAiPptTopic(event.target.value)}
                  placeholder="例如：软件工程基础与软件危机"
                  className="mt-1 w-full rounded-2xl border border-[#e2e8f0] bg-white px-3 py-2.5 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#006689] focus:ring-2 focus:ring-[#006689]/10"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-black text-[#344054]">讲义文本 / Markdown</span>
                <textarea
                  value={aiPptSourceText}
                  onChange={(event) => {
                    setAiPptSourceText(event.target.value);
                    setAiPptSourceLabel("手动输入讲义");
                  }}
                  placeholder="可粘贴课程讲义、md 大纲、课堂笔记；上传 pdf 时会先进入后端文本抽取链路。"
                  rows={5}
                  className="mt-1 w-full resize-none rounded-2xl border border-[#e2e8f0] bg-white px-3 py-2.5 text-sm leading-6 text-[#111827] outline-none transition focus:border-[#006689] focus:ring-2 focus:ring-[#006689]/10"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#dce6f4] bg-white px-3.5 py-2 text-[12px] font-black text-[#344054] transition hover:border-[#006689]/40 hover:text-[#006689]">
                  <UploadCloud className="h-4 w-4" />
                  上传 md/pdf
                  <input
                    type="file"
                    accept=".md,.markdown,.txt,.pdf,text/markdown,text/plain,application/pdf"
                    className="hidden"
                    onChange={(event) => void handleAiPptFileUpload(event.target.files?.[0])}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleGenerateAiPpt()}
                  disabled={aiPptGenerating}
                  className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles className={`h-4 w-4 ${aiPptGenerating ? "animate-spin" : ""}`} />
                  {aiPptGenerating ? "生成中" : "生成 PPT"}
                </button>
                <button
                  type="button"
                  onClick={handleExportAiPpt}
                  disabled={!aiPptDraft}
                  className="inline-flex items-center gap-2 rounded-full border border-[#dce6f4] bg-white px-4 py-2 text-[12px] font-black text-[#006689] transition hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  下载 PPTX
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {["LLM 大纲", "AI 配图", "PPTX 渲染"].map((item, index) => (
                <div key={item} className="rounded-2xl bg-white px-3 py-2 ring-1 ring-[#e8edf2]">
                  <div className="text-[9px] font-black text-[#8b95a7]">STEP {index + 1}</div>
                  <div className="mt-1 text-[12px] font-black text-[#111827]">{item}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[20px] border border-[#edf1f6] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-4">
            {aiPptDraft ? (
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-black text-[#8b95a7]">{aiPptDraft.modelLabel}</div>
                      <h3 className="mt-1 text-[18px] font-black text-[#111827]">{aiPptDraft.title}</h3>
                    </div>
                    <span className="rounded-full bg-[#fff1f6] px-3 py-1 text-[10px] font-black text-[#d64d7b]">
                      {aiPptDraft.slides.length} 页 · {aiPptDraft.createdAt}
                    </span>
                  </div>

                  <div className="mt-3 aspect-video overflow-hidden rounded-[20px] border border-[#d9e5f2] bg-[#111827] p-5 text-white shadow-[0_18px_38px_rgba(15,23,42,0.14)]">
                    {(() => {
                      const slide = aiPptDraft.slides[Math.min(aiPptActiveSlide, aiPptDraft.slides.length - 1)];
                      return (
                        <div className="flex h-full flex-col justify-between">
                          <div>
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[11px] font-black text-white/82">
                              <Eye className="h-3.5 w-3.5" />
                              在线幻灯片预览
                            </div>
                            <h4 className="mt-4 text-[28px] font-black leading-tight">{slide.title}</h4>
                            {slide.subtitle ? <p className="mt-2 text-[14px] font-semibold text-white/68">{slide.subtitle}</p> : null}
                          </div>
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
                            <ul className="space-y-2 text-[13px] leading-5 text-white/82">
                              {slide.bullets.slice(0, 4).map((bullet) => (
                                <li key={bullet} className="flex gap-2">
                                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#fb7299]" />
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="rounded-2xl border border-white/12 bg-white/8 p-3">
                              <div className="text-[11px] font-black text-[#ffb4cc]">{slide.illustration?.title || "AI 配图"}</div>
                              <p className="mt-1 line-clamp-4 text-[11px] leading-5 text-white/68">{slide.illustration?.caption || "生成教学插图用于当前页面。"}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="space-y-2">
                  {aiPptDraft.slides.map((slide, index) => (
                    <button
                      key={`${slide.title}-${index}`}
                      type="button"
                      onClick={() => setAiPptActiveSlide(index)}
                      className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                        aiPptActiveSlide === index
                          ? "border-[#006689] bg-[#eef9fc] text-[#006689]"
                          : "border-[#e8edf2] bg-white text-[#475467] hover:bg-[#f8fbff]"
                      }`}
                    >
                      <div className="text-[10px] font-black">第 {index + 1} 页</div>
                      <div className="mt-0.5 line-clamp-1 text-[12px] font-black">{slide.title}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[280px] items-center justify-center rounded-[18px] border border-dashed border-[#d7e3ef] bg-white/70 px-6 text-center">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f8fbff] text-[#006689] ring-1 ring-[#dce8f3]">
                    <Presentation className="h-6 w-6" />
                  </div>
                  <h3 className="mt-3 text-[16px] font-black text-[#111827]">等待生成在线幻灯片</h3>
                  <p className="mt-1 max-w-md text-[12px] leading-5 text-[#667085]">
                    生成后这里会展示每页标题、要点、讲稿和 AI 配图提示词，并可直接导出 PPTX。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-[20px] border border-[#e9edf2] bg-white/96 p-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#111827] px-3 py-1 text-[11px] font-bold text-white">
            {displayResources.length} 条
          </span>
          {[
            { label: "全部资源", value: "all" },
            { label: "讲义资料", value: "handouts" },
            { label: "实践笔记", value: "notes" },
            { label: "视频资源", value: "videos" },
          ].map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value as ResourceTab)}
                className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all cursor-pointer ${
                  isActive ? "bg-[#111827] text-white shadow-sm" : "bg-[#f3f5f8] text-[#4b5563] hover:bg-[#eceff3]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#564145]" />
          <input
            id="resource-filter-input"
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索标题、摘要或文件名"
            className="w-full rounded-full border border-transparent bg-[#f3f5f7] py-2 pl-9 pr-3 text-xs text-[#171c22] outline-none transition focus:border-[var(--project-primary-border)] focus:bg-white focus:ring-1 focus:ring-[var(--project-primary-soft)]"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] sm:hidden">
          {activeTab !== "all" ? (
            <span className="rounded-full bg-[#f3f5f8] px-3 py-1 font-semibold text-[#4b5563]">
              分类：{
                activeTab === "handouts"
                  ? "讲义资料"
                  : activeTab === "notes"
                    ? "实践笔记"
                    : "视频资源"
              }
            </span>
          ) : null}
          {searchQuery.trim() ? (
            <span className="rounded-full bg-[#f8fbff] px-3 py-1 font-semibold text-[#006689]">
              关键词：{searchQuery.trim()}
            </span>
          ) : null}
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setActiveTab("all");
                setSearchQuery("");
              }}
              className="text-[11px] font-bold text-[#5b6574] transition hover:text-[#111827]"
            >
              清空筛选
            </button>
          ) : null}
        </div>
      </section>

      {searchParamText || isSearchFallback || isLoading || shouldShowLoadError ? (
        <section
          className={`rounded-[20px] px-4 py-3 text-xs font-semibold ${
            shouldShowLoadError || isSearchFallback
              ? "border border-amber-200 bg-amber-50 text-amber-800"
              : "border border-[#d9e8fb] bg-[linear-gradient(90deg,#f8fbff_0%,#fdfdff_100%)] text-[#006689]"
          }`}
        >
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
            {searchParamText ? <span>当前按 “{searchParamText}” 查看资源。</span> : null}
            {isSearchFallback ? <span>“{searchQuery.trim()}” 没有精确匹配，已先展示可继续浏览的资料。</span> : null}
            {isLoading ? (
              <span>{hasLoadedOnce ? "正在同步最新资源，当前内容已经可以直接浏览。" : "正在准备资源列表，当前内容会优先展示可用资料。"}</span>
            ) : null}
            {shouldShowLoadError ? <span>实时同步暂时延后，当前内容仍可直接浏览。</span> : null}
          </div>
        </section>
      ) : null}

      {optimisticGeneratedResources.length > 0 ? (
        <section className="rounded-[20px] border border-[#dfe7ef] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-2 border-b border-[#e8edf2] pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[10px] font-black text-[#006689]">AI 生成结果</div>
              <h2 className="mt-1 text-[18px] font-black text-[#111827]">新生成内容单独归档</h2>
              <p className="mt-1 text-[12px] text-[#667085]">PPT 课件和补充资料不再混入原始课程资料，便于对比、下载和继续编辑。</p>
            </div>
            <span className="rounded-full bg-[#111827] px-3 py-1 text-[11px] font-bold text-white">
              {optimisticGeneratedResources.length} 项
            </span>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {[
              { title: "PPT 课件", items: optimisticGeneratedPptResources, empty: "暂无新生成 PPT" },
              { title: "AI 资料", items: optimisticGeneratedStudyResources, empty: "暂无新生成资料" },
            ].map((group) => (
              <div key={group.title} className="rounded-[16px] border border-[#e8edf2] bg-[#fbfdff] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[14px] font-black text-[#111827]">{group.title}</h3>
                  <span className="text-[11px] font-bold text-[#8b95a7]">{group.items.length} 项</span>
                </div>
                {group.items.length ? (
                  <div className="grid gap-2">
                    {group.items.slice(0, 4).map((resource) => {
                      const resourceType = normalizeCoverageResourceType(resource.resourceTypes[0]);
                      const uiKind = getGeneratedUiKind(resourceType);
                      const meta = getGeneratedResourceUiMeta(uiKind);
                      const Icon = getGeneratedResourceIcon(uiKind);
                      return (
                        <article key={resource.resourceId} className="rounded-[14px] border border-[#edf1f5] bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.pillClass}`}>
                                {meta.label}
                              </span>
                              <h4 className="mt-2 line-clamp-1 text-[14px] font-black text-[#111827]">
                                {getGeneratedResourceTitle(resource)}
                              </h4>
                              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#667085]">
                                {resource.summary || resource.files[0]?.excerpt || "已按当前课程上下文生成。"}
                              </p>
                            </div>
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f8fbff] text-[#006689]">
                              <Icon className="h-4 w-4" />
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenPreview(resource, resource.files[0]?.fileId || resource.resourceId)}
                              className="rounded-full bg-[#111827] px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-[#1f2937]"
                            >
                              {resourceType === "ppt" ? "查看/导出" : "查看资料"}
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/learn?courseId=${resource.courseId}`)}
                              className="rounded-full border border-[#d7e3ef] bg-white px-3 py-1.5 text-[11px] font-black text-[#006689] transition hover:bg-[#f8fbff]"
                            >
                              回到课堂
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[14px] border border-dashed border-[#d7e3ef] bg-white px-3 py-6 text-center text-[12px] font-semibold text-[#8b95a7]">
                    {group.empty}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {classroomGeneratedItems.length > 0 ? (
        <section className="overflow-hidden rounded-[28px] border border-[#dfe7ef] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_56%,#fff7fa_100%)] shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
          <button
            type="button"
            onClick={() => setClassroomExpanded((current) => !current)}
            className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
          >
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/82 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-[#006689] ring-1 ring-[#e3ebf4]">
                <Sparkles className="h-3.5 w-3.5" />
                课堂生成资料
              </div>
              <h2 className="mt-2 text-[18px] font-black tracking-[-0.03em] text-[#171c22]">
                刚刚在课堂里生成的资料
              </h2>
              <p className="mt-1 text-[12px] text-[#6b7280]">
                同步课堂里刚生成的讲义、PPT、导图和练习。
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[#111827] px-3 py-1 text-[11px] font-bold text-white">
                {classroomGeneratedItems.length} 项
              </span>
              <ChevronDown
                className={`h-4 w-4 text-[#6b7280] transition-transform ${classroomExpanded ? "" : "-rotate-90"}`}
              />
            </div>
          </button>

          {classroomExpanded ? (
            <div className="grid gap-3 border-t border-[#eef2f6] px-4 py-4 lg:grid-cols-2">
              {[
                { title: "PPT 课件", items: classroomGeneratedPptItems, empty: "课堂里还没有生成 PPT" },
                { title: "AI 资料", items: classroomGeneratedResourceItems, empty: "课堂里还没有生成讲义、导图或练习" },
              ].map((group) => (
                <div key={group.title} className="rounded-[20px] border border-[#e8edf2] bg-[#fbfdff] p-3">
                  <div className="mb-3 flex items-center justify-between border-b border-[#eef2f6] pb-2">
                    <h3 className="text-[14px] font-black text-[#111827]">{group.title}</h3>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#667085] ring-1 ring-[#e8edf2]">
                      {group.items.length} 项
                    </span>
                  </div>
                  {group.items.length ? (
                    <div className="grid gap-3">
                      {group.items.map((item, index) => (
                <article
                  key={`${item.itemType}-${item.itemType === "ppt" ? item.fileName : item.kind}-${index}`}
                  className="overflow-hidden rounded-[22px] border border-[#edf1f5] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.03)]"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-full bg-[#f7faff] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#006689]">
                      生成结果
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e8eef6]">
                      <div className="h-full w-full rounded-full bg-[#111827]" />
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] ${
                          item.itemType === "ppt"
                            ? getGeneratedResourceUiMeta("ppt").pillClass
                            : getGeneratedResourceUiMeta(item.kind).pillClass
                        }`}
                      >
                        {getGeneratedItemTag(item)}
                      </span>
                      <h3 className="mt-2 line-clamp-1 text-[15px] font-black text-[#171c22]">
                        <span className="inline-flex items-center gap-1.5">
                          {item.starred ? <Bookmark className="h-3.5 w-3.5 fill-current text-[#fb7299]" /> : null}
                          <span>{getGeneratedDisplayTitle(item)}</span>
                        </span>
                      </h3>
                      <p className="mt-1 text-[11px] font-semibold text-[#7b8794]">
                        {formatGeneratedHint(item)}
                      </p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f8fbff] text-[#006689]">
                      <GeneratedItemIcon item={item} />
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-2 text-[12px] leading-5 text-[#4b5563]">
                    {item.summary || item.previewContent?.[0] || "已按当前课堂上下文完成生成。"}
                  </p>

                  {item.itemType === "ppt" && item.explanationVideo ? (
                    <div className="mt-3 rounded-[18px] border border-[#d9e5ff] bg-[#f8fbff] px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#2563eb]">
                          <Video className="h-3.5 w-3.5" />
                          PPT 讲解视频已生成
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#64748b] ring-1 ring-[#e2e8f0]">
                          {item.explanationVideo.durationLabel} · {item.explanationVideo.storyboard.length} 段
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#5b6574]">{item.explanationVideo.summary}</p>
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenGeneratedItem(item)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#111827] px-3.5 py-2 text-[11px] font-black text-white transition hover:bg-[#1f2937]"
                      >
                        {item.itemType === "ppt" ? getGeneratedResourceUiMeta("ppt").actionLabel : getGeneratedResourceUiMeta(item.kind).actionLabel}
                      </button>
                    {item.itemType === "ppt" && item.explanationVideo ? (
                      <button
                        type="button"
                        onClick={() => handleOpenPptExplanationVideo(item)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#d9e5ff] bg-[#eff6ff] px-3.5 py-2 text-[11px] font-black text-[#2563eb] transition hover:bg-[#dbeafe]"
                      >
                        <Video className="h-3.5 w-3.5" />
                        查看讲解视频
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => navigate(`/learn?courseId=${courseId}`)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#dce6f4] bg-white px-3.5 py-2 text-[11px] font-black text-[#006689] transition hover:bg-[#f8fbff]"
                    >
                      回到课堂
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[16px] border border-dashed border-[#d7e3ef] bg-white px-3 py-8 text-center text-[12px] font-semibold text-[#8b95a7]">
                      {group.empty}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {isLoading && !resourceGroups.length ? (
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="md:col-span-2 rounded-[28px] border border-[#e8edf2] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_58%,#fff5f8_100%)] px-6 py-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <AILoadingLottie
              caption="资源生成智能体正在编排资料工作台"
              subcaption="讲义、导图、练习和代码实操会分批到位，不会再让页面长时间空白等待。"
            />
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <ResourceCardSkeleton key={index} />
          ))}
        </section>
      ) : null}

      {courseDetail || resourceTypeSummary.length ? (
        <section className="rounded-[20px] border border-[#e8edf2] bg-white/96 px-4 py-2.5 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#f7fafb] px-3 py-1 text-[10px] font-black text-[#667085] ring-1 ring-[#e8edf2]">
                  资源覆盖导航
                </span>
                {courseDetail?.teacher_name ? (
                  <span className="rounded-full bg-[#fff1f6] px-3 py-1 text-[10px] font-bold text-[#8d4b67] ring-1 ring-[#ffd8e5]">
                    {courseDetail.teacher_name}
                  </span>
                ) : null}
                <span className="rounded-full bg-[#111827] px-3 py-1 text-[10px] font-black text-white">
                  {resourceGroups.length} 组资料
                </span>
                <span className="rounded-full bg-[#006689]/10 px-3 py-1 text-[10px] font-black text-[#006689]">
                  {resourceTypeSummary.length} 类资源
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-[12px] leading-6 text-[#667085]">
                {courseDetail?.introduce || "讲义、导图、练习、拓展阅读、代码实操与课堂视频已汇入同一个资源包。"}
              </p>
            </div>

            <div className="no-scrollbar flex gap-2 overflow-x-auto xl:max-w-[620px]">
              {resourceTypeSummary.slice(0, 5).map(([label, count], index) => (
                <div key={label} className="min-w-[118px] rounded-2xl border border-[#e8edf2] bg-[#f8fbff] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[11px] font-black text-[#344054]">{label}</div>
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black text-[#006689]">{index + 1}</span>
                  </div>
                  <div className="mt-1 flex items-end justify-between">
                    <div className="text-lg font-black leading-none text-[#171c22]">{count}</div>
                    <div className="text-[9px] font-semibold text-[#8d4b67]">可用</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {displayCourseBundles.length > 0 ? (
        <section className={`grid grid-cols-1 gap-3 ${displayCourseBundles.length > 1 ? "xl:grid-cols-2" : ""}`}>
          {displayCourseBundles.map((bundle) => {
            const isFocusedResource = bundle.resources.some((item) => item.resourceId === focusedResourceId);
            const presentSupplementTypes = Array.from(
              new Set(
                bundle.resourceTypes.map((item) => normalizeSupplementResourceType(item)).filter(Boolean),
              ),
            ) as ResourceSupplementType[];
            const primaryResourceId = bundle.primaryResource.resourceId;
            const representativeFiles = bundle.files.slice(0, 4);
            const latestGeneratedResource =
              generationStatus?.courseId === bundle.courseId && generationStatus.targetResourceId
                ? bundle.resources.find((resource) => resource.resourceId === generationStatus.targetResourceId) ?? null
                : null;

            return (
              <div
                id={`resource-binder-grid-${primaryResourceId}`}
                key={bundle.bundleId}
                data-resource-reveal
                className={`gsap-reveal-card gsap-hover-lift flex flex-col gap-2 rounded-[24px] bg-white p-3 transition-all group ${
                  isFocusedResource
                    ? "border-[var(--project-primary-border)] shadow-[0_22px_56px_rgba(251,114,153,0.16)] ring-1 ring-[var(--project-primary-ui-text-soft)]"
                    : "border border-[#e9edf2] shadow-[0_12px_34px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(15,23,42,0.08)]"
                }`}
              >
                <div className="flex flex-col gap-3 rounded-[20px] border border-[#eef2f6] bg-[linear-gradient(135deg,#f8fbff_0%,#fffafd_100%)] px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#006689] ring-1 ring-[#dce8f3]">
                        课程资源包
                      </span>
                      <span className="hidden text-[10px] font-semibold text-[#8b95a7] sm:inline">
                        {bundle.updatedAt}
                      </span>
                      {isFocusedResource ? (
                        <span className="rounded-full bg-[#fb7299]/12 px-2 py-1 text-[9px] font-extrabold text-[#d64d7b]">
                          当前查看
                        </span>
                      ) : null}
                    </div>

                    <h3 className="font-sans text-[18px] font-black leading-snug tracking-[-0.03em] text-[#171c22] transition-colors group-hover:text-[#111827]">
                      {bundle.title}
                    </h3>
                    <p className="line-clamp-2 max-w-2xl text-[12px] leading-5 text-[#667085] font-sans">
                      {bundle.summary || "当前课程已有资料已整理到一个工作台，可直接查看或继续补齐。"}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {representativeFiles[0] ? (
                      <button
                        type="button"
                        onClick={() => handleOpenBundleFilePreview(bundle, representativeFiles[0].fileId)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#111827] px-3.5 py-2 text-[11px] font-black text-white transition hover:bg-[#1f2937]"
                      >
                        打开核心资料
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleOpenTutorForBundle(bundle)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#d7e3ef] bg-white px-3.5 py-2 text-[11px] font-black text-[#006689] transition hover:bg-[#f8fbff]"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      问 AI 导师
                    </button>
                    <button
                      type="button"
                      disabled={favoriteBusyId === primaryResourceId}
                      onClick={() => void handleToggleFavorite(primaryResourceId)}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-[11px] font-extrabold ${
                        favoriteIds.has(primaryResourceId)
                          ? "bg-[var(--project-primary-ui-text-soft)] text-[var(--project-primary)]"
                          : "bg-white text-[#6b7280] ring-1 ring-[#e8edf2]"
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${favoriteIds.has(primaryResourceId) ? "fill-current" : ""}`} />
                      {favoriteIds.has(primaryResourceId) ? "已收藏" : "收藏"}
                    </button>
                  </div>
                </div>

                {latestGeneratedResource ? (
                  <div className="rounded-[16px] border border-[#f5b8ca] bg-[linear-gradient(135deg,#fff7fb_0%,#ffffff_100%)] p-2.5 shadow-[0_8px_18px_rgba(214,77,123,0.08)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-1 rounded-full bg-[#fff1f6] px-2.5 py-1 text-[10px] font-extrabold tracking-[0.16em] text-[#d64d7b]">
                          <Sparkles className="h-3 w-3" />
                          刚刚生成
                        </div>
                        <div className="mt-1 text-[13px] font-black text-[#171c22]">
                          {latestGeneratedResource.title}
                        </div>
                        <p className="mt-1 line-clamp-1 text-[10px] leading-4 text-[#6b7280]">
                          {latestGeneratedResource.summary || "已按当前课程上下文补齐新资料，可直接打开查看。"}
                        </p>
                        <p className="mt-1 text-[10px] font-bold text-[#d64d7b]">
                          这是你刚才点击补充后实时生成的新内容
                        </p>
                      </div>
                      <button
                        type="button"
                        ref={latestGeneratedResourceRef}
                        onClick={() =>
                          handleOpenPreview(
                            latestGeneratedResource,
                            latestGeneratedResource.files[0]?.fileId || latestGeneratedResource.resourceId,
                          )
                        }
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#d64d7b] px-3 py-1 text-[10px] font-black text-white transition hover:bg-[#c13d6b]"
                      >
                        立即查看
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="border-t border-[#eef2f6] pt-3">
                  <section className="overflow-hidden rounded-[22px] border border-[#e8edf2] bg-[#fbfdff]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef2f6] bg-white/80 px-3.5 py-3">
                      <div>
                        <div className="text-[10px] font-black tracking-[0.16em] text-[#006689]">学习资料</div>
                        <h4 className="mt-1 text-[15px] font-black text-[#171c22]">先从这些内容进入学习</h4>
                      </div>
                      <div className="flex gap-1.5 text-center">
                        {[
                          { label: "资料组", value: bundle.resourceCount },
                          { label: "文件", value: bundle.fileCount },
                          { label: "覆盖", value: presentSupplementTypes.length || 0 },
                        ].map((item) => (
                          <div key={item.label} className="min-w-16 rounded-2xl bg-[#f8fbff] px-3 py-1.5 ring-1 ring-[#e8edf2]">
                            <div className="text-[8px] font-bold text-[#8b95a7]">{item.label}</div>
                            <div className="mt-0.5 text-[15px] font-black leading-none text-[#171c22]">{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-3">
                    <div className="mb-3 grid gap-2 text-[11px] font-bold text-[#667085] sm:grid-cols-3">
                      {[
                        "核心资料优先打开",
                        "视频可直达课堂",
                        "资料页内按需生成",
                      ].map((item, index) => (
                        <div key={item} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-[#edf1f5]">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#eaf7fb] text-[10px] font-black text-[#006689]">
                            {index + 1}
                          </span>
                          {item}
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      {representativeFiles.map((fileObj, index) => {
                        const isVideo = fileObj.type === "video";
                        const courseVideoTarget = isVideo ? buildCourseVideoTarget(bundle.courseId, fileObj) : null;
                        const ownerResource = bundle.resources.find((resource) =>
                          resource.files.some((file) => file.fileId === fileObj.fileId),
                        );
                        const isPracticeTaskFile = isPracticeWorkbenchResource(ownerResource?.resourceTypes[0]);
                        const rowClassName =
                          "group/file flex min-h-[72px] items-center justify-between rounded-[18px] border border-[#e5ebf2] bg-white px-3 py-2.5 text-[#171c22] transition-all hover:-translate-y-0.5 hover:border-[#cfe0ef] hover:shadow-[0_12px_26px_rgba(15,23,42,0.06)]";
                        const fileMeta = (
                          <>
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#edf1f5] bg-[#f8fbff]">
                                {fileObj.type === "pdf" ? (
                                  <LayoutGrid className="h-5 w-5 text-red-500" />
                                ) : fileObj.type === "text" ? (
                                  <FileText className="h-5 w-5 text-[#006689]" />
                                ) : (
                                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="rounded-full bg-[#f3f7fb] px-2 py-0.5 text-[9px] font-black text-[#667085]">
                                    {String(index + 1).padStart(2, "0")}
                                  </span>
                                  <p className="truncate pr-2 text-[12px] font-black">{fileObj.name}</p>
                                </div>
                                <p className="mt-1 text-[10px] font-semibold text-[#8b95a7]">
                                  {fileObj.format} · {fileObj.size}
                                </p>
                              </div>
                            </div>

                            <span
                              className={
                                courseVideoTarget
                                  ? "inline-flex shrink-0 items-center gap-1 rounded-full bg-[#006689] px-3 py-1.5 text-[10px] font-black text-white transition-colors hover:bg-[#005570]"
                                  : "inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eef7fb] px-3 py-1.5 text-[10px] font-black text-[#006689] transition-colors group-hover/file:bg-[#006689] group-hover/file:text-white"
                              }
                            >
                              {courseVideoTarget ? "进入课堂" : isPracticeTaskFile ? "查看任务" : "查看详情"}
                              <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                          </>
                        );

                        if (courseVideoTarget) {
                          return (
                            <Link
                              id={`file-node-${fileObj.fileId}`}
                              key={fileObj.fileId}
                              to={courseVideoTarget}
                              className={rowClassName}
                            >
                              {fileMeta}
                            </Link>
                          );
                        }

                        return (
                          <button
                            id={`file-node-${fileObj.fileId}`}
                            key={fileObj.fileId}
                            type="button"
                            onClick={() => handleOpenBundleFilePreview(bundle, fileObj.fileId)}
                            className={`${rowClassName} w-full text-left`}
                          >
                            {fileMeta}
                          </button>
                        );
                      })}
                    </div>

                    {bundle.fileCount > representativeFiles.length ? (
                      <button
                        type="button"
                        onClick={() => {
                          const nextFileId = representativeFiles[0]?.fileId;
                          if (nextFileId) {
                            handleOpenBundleFilePreview(bundle, nextFileId);
                          }
                        }}
                        className="mt-2 flex w-full items-center justify-between rounded-[18px] border border-dashed border-[#d7e3ef] bg-white px-4 py-2 text-left text-[11px] font-black text-[#5b6574] transition hover:border-[#006689]/40 hover:bg-[#f8fbff]"
                      >
                        <span>查看这门课剩余 {bundle.fileCount - representativeFiles.length} 份资料</span>
                        <ChevronRight className="h-3.5 w-3.5 text-[#006689]" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => navigate(`/learn?courseId=${bundle.courseId}`)}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#111827] px-4 py-3 text-[12px] font-black text-white transition hover:bg-[#1f2937]"
                    >
                      进入课程学习
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    </div>
                  </section>
                </div>

              </div>
            );
          })}
        </section>
      ) : !isLoading ? (
        <EmptyResourceState
          isFiltering={hasFilters}
          onReset={() => {
              setActiveTab("all");
              setSearchQuery("");
          }}
        />
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 rounded-2xl bg-[#171c22] px-4 py-3 text-xs font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}

