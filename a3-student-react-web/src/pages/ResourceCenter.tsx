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
  FileSpreadsheet,
  FileText,
  Heart,
  LayoutGrid,
  Network,
  Presentation,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import {
  readPersistedCourseResourceWorkspace,
  type RecentPptArtifact,
  type RecentResourceArtifact,
} from "../lib/courseResourceWorkspace";
import { studentApi, type CourseDetail, type CourseTeacher, type ResourceCard, type ResourceSourceFileRef } from "../lib/studentApi";
import { resolveBackendCourseCode, resolveBackendCourseId } from "../lib/courseRouting";
import { DEFAULT_ROUTE_COURSE_ID, persistLastRouteCourseId, readLastRouteCourseId } from "../lib/routeCourseContext";
import { getCurrentLoggedInUserId } from "../lib/currentUser";
import { exportDeckAsPptx } from "../lib/pptxExport";
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
  { id: "ocr_notes", label: "补板书", successLabel: "真实板书", triggerLabel: "生成真实板书", description: "补出 OCR 识别文本、黑板布局还原与结构化课堂笔记" },
] as const;

type ResourceSupplementType = (typeof RESOURCE_SUPPLEMENT_OPTIONS)[number]["id"];

const COURSE_RESOURCE_ACTION_TYPES: ResourceSupplementType[] = [
  "extended_reading",
  "coding_lab",
  "visual_illustration",
  "ocr_notes",
];

const RESOURCE_GENERATION_HINTS: Record<ResourceSupplementType, string[]> = {
  lecture_note: ["补课程讲义", "知识主线梳理", "章节重点提炼"],
  practice_set: ["补练习题", "随堂测评", "薄弱点训练"],
  mindmap: ["补思维导图", "知识结构整理", "主线梳理"],
  extended_reading: ["补拓展阅读", "延伸背景资料", "原理补充阅读"],
  coding_lab: ["补代码实操", "案例演练", "动手实验步骤"],
  visual_illustration: ["补教学插图", "结构图示", "页面与流程示意图"],
  ocr_notes: ["补真实板书", "OCR 识别文本", "黑板布局还原"],
};

const RESOURCE_AGENT_STEPS = [
  {
    name: "学习画像智能体",
    description: "读取专业、课程、知识短板和学习目标，确定资源粒度与难度。",
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

function getGeneratedItemTag(item: ClassroomGeneratedItem) {
  if (item.itemType === "ppt") {
    return getGeneratedResourceUiMeta("ppt").label;
  }
  return getGeneratedResourceUiMeta(item.kind).label;
}

function formatGeneratedHint(item: ClassroomGeneratedItem) {
  if (item.itemType === "ppt") {
    return `${item.sectionTitle} · ${item.slideCount} 页`;
  }
  return `${item.sectionTitle} · ${item.generatedAt}`;
}

function getGeneratedDisplayTitle(item: ClassroomGeneratedItem) {
  if (item.itemType === "ppt") {
    return item.customTitle || item.fileName.replace(/\.pptx$/i, "");
  }
  return item.customTitle || item.title;
}

function GeneratedItemIcon({ item }: { item: ClassroomGeneratedItem }) {
  const Icon = item.itemType === "ppt" ? getGeneratedResourceIcon("ppt") : getGeneratedResourceIcon(item.kind);
  return <Icon className="h-4 w-4" />;
}

function buildGeneratedResourcePreviewState(
  courseId: string,
  item: Extract<ClassroomGeneratedItem, { itemType: "artifact" }>,
) {
  const resourceType = item.kind === "handout" ? "lecture_note" : item.kind === "mindmap" ? "mindmap" : "practice_set";
  const previewText = item.rawContent || item.previewContent?.join("\n") || item.summary;
  return {
    pathname: `/resources/preview?courseId=${courseId}`,
    state: {
      initialResource: {
        resource_id: item.resourceId || null,
        resource_type: resourceType,
        title: item.customTitle || item.title,
        summary: item.summary,
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
        display_name: `${item.customTitle || item.title}.${item.kind === "practice" ? "md" : "md"}`,
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
          <div className="text-[11px] font-black tracking-[0.2em] text-[#006689]">RESOURCE CENTER</div>
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
  const mergedFiles = bundle.files.map((file, index) => {
    const fileOwner = bundle.resources.find((resource) => resource.files.some((candidate) => candidate.fileId === file.fileId)) || ownerResource;
    const previewFile = buildInitialPreviewFile(fileOwner, file);
    const numericFileId = Number(file.fileId);
    const fallbackDigits = file.fileId.match(/\d+/g);
    const fallbackNumericFileId = fallbackDigits?.length ? Number(fallbackDigits[fallbackDigits.length - 1]) : NaN;
    return {
      ...previewFile,
      file_id: Number.isFinite(numericFileId)
        ? numericFileId
        : Number.isFinite(fallbackNumericFileId)
          ? fallbackNumericFileId
          : 900_000 + index,
    };
  });
  const preferredNumericFileId = Number(preferredFileId);
  const resolvedInitialFileId =
    Number.isFinite(preferredNumericFileId) && mergedFiles.some((file) => file.file_id === preferredNumericFileId)
      ? preferredNumericFileId
      : mergedFiles[0]?.file_id || null;

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
  if (["lecture_note", "course_overview", "mindmap", "mind_map", "teaching_plan", "assessment_guide", "visual_illustration"].includes(resourceType)) {
    return "handouts";
  }
  return "notes";
}

function normalizeSupplementResourceType(resourceType?: string | null): ResourceSupplementType | null {
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
  return `${item.title.trim().toLowerCase()}::${normalizedTypes.join(",") || "other"}`;
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
          previewUrl:
            "# 拓展阅读草稿\n\n- 背景原理：补齐这一节课背后的系统动机与工程上下文。\n- 延伸材料：补出更适合继续深入的知识点与参考方向。\n- 深入阅读：为后续报告、答辩和连续追问准备更完整的素材。\n\n生成完成后，这里会自动替换成真实内容。",
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
          previewUrl:
            "# 代码实操任务单\n\n1. 理解当前案例的目标与输入输出。\n2. 按步骤完成关键代码补全与调试。\n3. 对照运行结果回看易错点与工程判断。\n\n生成完成后，这里会自动替换成真实实操内容。",
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

  return Array.from(grouped.entries()).map(([bundleCourseId, courseResources]) => {
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

export default function ResourceCenter() {
  const activeUserId = getCurrentLoggedInUserId();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = searchParams.get("courseId") || readLastRouteCourseId() || DEFAULT_ROUTE_COURSE_ID;
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
  const hasAutoFocusedRef = useRef(false);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const latestGeneratedResourceRef = useRef<HTMLButtonElement | null>(null);

  const backendCourseCode = resolveBackendCourseCode(courseId);
  const backendCourseId = resolveBackendCourseId(courseId);

  useEffect(() => {
    persistLastRouteCourseId(courseId);
  }, [courseId]);

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

  const filteredResources = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = resourceGroups.filter((group) => {
      const matchesTab = activeTab === "all" || group.category === activeTab;
      if (!normalizedQuery) {
        return matchesTab;
      }

      const matchesSearch =
        group.title.toLowerCase().includes(normalizedQuery) ||
        (group.summary || "").toLowerCase().includes(normalizedQuery) ||
        group.uploader.toLowerCase().includes(normalizedQuery) ||
        group.category.toLowerCase().includes(normalizedQuery) ||
        group.files.some(
          (file) =>
            file.name.toLowerCase().includes(normalizedQuery) ||
            file.format.toLowerCase().includes(normalizedQuery) ||
            (file.excerpt || "").toLowerCase().includes(normalizedQuery),
        );

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
  }, [activeTab, focusedResourceId, resourceGroups, searchQuery]);

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
    const primaryResourceType = resGroup.resourceTypes[0];
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
    if (isPracticeWorkbenchResource(primaryResourceType)) {
      const nextParams = new URLSearchParams({
        courseId: resGroup.courseId,
      });
      if (Number.isFinite(numericResourceId) && numericResourceId > 0) {
        nextParams.set("resourceId", String(numericResourceId));
      }
      if (selectedFile?.fileId) {
        nextParams.set("fileId", selectedFile.fileId);
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
      return;
    }
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

  const handleOpenBundleFilePreview = (bundle: UiCourseBundle, fileId: string) => {
    const ownerResource = bundle.resources.find((resource) => resource.files.some((file) => file.fileId === fileId)) || bundle.primaryResource;
    const selectedFile = bundle.files.find((file) => file.fileId === fileId) || ownerResource.files.find((file) => file.fileId === fileId) || bundle.files[0] || ownerResource.files[0];
    if (!selectedFile) {
      handleOpenPreview(ownerResource, fileId);
      return;
    }
    const courseVideoTarget = buildCourseVideoTarget(bundle.courseId, selectedFile);
    if (courseVideoTarget) {
      navigate(courseVideoTarget);
      return;
    }
    if (isPracticeWorkbenchResource(ownerResource.resourceTypes[0])) {
      handleOpenPreview(ownerResource, selectedFile.fileId || fileId);
      return;
    }
    const { previewResource, initialFileId } = buildBundlePreviewResource(bundle, ownerResource, selectedFile.fileId);
    navigate(
      `/resources/preview?courseId=${bundle.courseId}&resourceId=${ownerResource.resourceId}&fileId=${initialFileId ?? fileId}`,
      {
        state: {
          initialResource: previewResource,
          initialFileId: initialFileId ?? null,
          initialPreviewFile:
            (previewResource.source_files || []).find((file) => file.file_id === initialFileId) ||
            (previewResource.source_files || [])[0] ||
            null,
        },
      },
    );
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
    if (normalizedType !== "coding_lab" && normalizedType !== "case_study") {
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
      const response = await studentApi.generateResources({
        user_id: activeUserId,
        course_id: targetBackendCourseId,
        knowledge_points: searchQuery.trim()
          ? [searchQuery.trim()]
          : topicHint
            ? [topicHint, ...generationHints]
            : generationHints,
        resource_types: [resourceType],
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
      setResourceGroups((current) => dedupeResourceGroups([...generatedGroups, ...current]));
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

  const hasFilters = activeTab !== "all" || Boolean(searchQuery.trim());
  const recommendedFocusLabel =
    activeTab === "handouts"
      ? "优先精读讲义资料"
      : activeTab === "notes"
        ? "优先整理实践笔记"
        : activeTab === "videos"
          ? "优先观看视频资源"
          : "优先查看本课程核心资料";
  const shouldShowLoadError = Boolean(loadError) && !isLoading && resourceGroups.length === 0;

  return (
    <div ref={workspaceRef} className="space-y-4 select-none" id="resource-center-workspace">
      <section className="rounded-[24px] border border-[#dce6f4] bg-[linear-gradient(145deg,#f8fbff_0%,#eef5ff_55%,#ffffff_100%)] p-3.5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[640px]">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-[#006689] shadow-sm">
              <BookOpen className="h-3.5 w-3.5" />
              资源中心
            </div>
            <h1 className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#111827] md:text-[26px]">
              先看已有资料，不够再一键补齐
            </h1>
            <p className="mt-1 text-[12px] leading-6 text-[#4b5563]">
              这页只做两件事：浏览当前课程已有资料，或让资源智能体按当前缺口继续生成讲义、导图、练习和补充内容。
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/88 px-3 py-1 text-[11px] font-bold text-[#111827] shadow-sm">
                已收藏 {favoriteSummary} 份
              </span>
              <span className="rounded-full bg-[#f8fbff] px-3 py-1 text-[11px] font-bold text-[#006689] shadow-sm">
                {recommendedFocusLabel}
              </span>
              <span className="rounded-full bg-[#fff4f8] px-3 py-1 text-[11px] font-bold text-[#d64d7b] shadow-sm">
                智能体按缺口补资料
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
            <button
              type="button"
              id="resource-center-generate-btn"
              onClick={() => {
                void studentApi
                  .generateResources({
                    user_id: activeUserId,
                    course_id: backendCourseId,
                    knowledge_points: searchQuery.trim()
                      ? [searchQuery.trim()]
                      : ["软件工程", "当前知识短板", "阶段学习目标"],
                    resource_types: ["lecture_note", "mindmap", "practice_set", "extended_reading", "coding_lab"],
                  })
                  .then(async (response) => {
                    if (response.resources?.length) {
                      const generatedGroups = mapApiResourcesToUi(response.resources, activeCourseContext);
                      setResourceGroups((current) => {
                        const merged = [...generatedGroups, ...current];
                        const deduped = new Map<string, UiResourceGroup>();
                        for (const item of merged) {
                          const key = `${item.title}-${item.resourceTypes.join(",")}`;
                          if (!deduped.has(key)) {
                            deduped.set(key, item);
                          }
                        }
                        return Array.from(deduped.values());
                      });
                    }
                    await loadResourcesWithMode("refresh", 30000);
                    setToastMessage("已按多智能体协同方案补齐 5 类核心个性化资源。");
                  })
                  .catch(() => {
                    setToastMessage("本次 5 类资源补齐未完全成功，先继续使用当前可用资料。");
                  });
              }}
              className="inline-flex items-center gap-2 rounded-full border border-[#fb7299]/20 bg-[#fff4f8] px-3.5 py-2 text-xs font-black text-[#d64d7b] shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5"
            >
              <Sparkles className="h-4 w-4" />
              一键补齐资料
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/85 bg-white/82 px-3 py-2">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a94a3]">Runtime</div>
            <div className="mt-1 text-[12px] font-extrabold text-[#101828]">{generatingType ? "补资料中" : "资料已就绪"}</div>
          </div>
          <div className="rounded-2xl border border-white/85 bg-white/82 px-3 py-2">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a94a3]">Current Context</div>
            <div className="mt-1 text-[12px] font-extrabold text-[#101828]">{recommendedFocusLabel}</div>
          </div>
          <div className="rounded-2xl border border-white/85 bg-white/82 px-3 py-2">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a94a3]">Next Move</div>
            <div className="mt-1 text-[12px] font-extrabold text-[#101828]">按缺口继续补资料</div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-[22px] border border-[#e9edf2] bg-white/96 p-3.5 sm:flex-row sm:items-center sm:justify-between">
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
                Generated
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
              {classroomGeneratedItems.map((item, index) => (
                <article
                  key={`${item.itemType}-${item.itemType === "ppt" ? item.fileName : item.kind}-${index}`}
                  className="overflow-hidden rounded-[22px] border border-[#edf1f5] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.03)]"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-full bg-[#f7faff] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#006689]">
                      Agent Runtime
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

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenGeneratedItem(item)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#111827] px-3.5 py-2 text-[11px] font-black text-white transition hover:bg-[#1f2937]"
                      >
                        {item.itemType === "ppt" ? getGeneratedResourceUiMeta("ppt").actionLabel : getGeneratedResourceUiMeta(item.kind).actionLabel}
                      </button>
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
        <section className="overflow-hidden rounded-[28px] border border-[#f3d9e3] bg-[linear-gradient(135deg,#fff9fb_0%,#fffefe_56%,#fff7fa_100%)] shadow-[0_14px_34px_rgba(214,77,123,0.08)]">
          <div className="border-b border-[#f8dfe8] px-5 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#d64d7b] ring-1 ring-[#ffd8e5]">
                    课程资源总览
                  </span>
                  {courseDetail?.teacher_name ? (
                    <span className="rounded-full bg-[#fff1f6] px-3 py-1 text-[11px] font-semibold text-[#8d4b67] ring-1 ring-[#ffd8e5]">
                      {courseDetail.teacher_name}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-3 text-[20px] font-black tracking-[-0.03em] text-[#171c22]">
                  {courseDetail?.name || "当前课程资料工作台"}
                </h2>
                <p className="mt-2 max-w-3xl text-[12px] leading-6 text-[#6b7280]">
                  {courseDetail?.introduce || "这里会集中沉淀当前课程的讲义、导图、练习、拓展阅读、代码实操与课堂视频联动资料。"}
                </p>
              </div>

              <div className="grid min-w-[240px] grid-cols-2 gap-2 sm:min-w-[320px]">
                <div className="rounded-3xl bg-white px-4 py-3 ring-1 ring-[#f4dce5]">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d64d7b]">资料规模</div>
                  <div className="mt-1 text-[22px] font-black text-[#171c22]">{resourceGroups.length}</div>
                  <div className="text-[11px] text-[#8d4b67]">组结构化资料</div>
                </div>
                <div className="rounded-3xl bg-white px-4 py-3 ring-1 ring-[#f4dce5]">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d64d7b]">资源类型</div>
                  <div className="mt-1 text-[22px] font-black text-[#171c22]">{resourceTypeSummary.length}</div>
                  <div className="text-[11px] text-[#8d4b67]">类已整理内容</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-5 py-4 lg:grid-cols-[0.95fr,1.05fr]">
            <div className="rounded-[24px] bg-white/90 p-3.5 ring-1 ring-[#f3e1e8]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8d4b67]">重点资源分布</div>
                <div className="text-[10px] font-semibold text-[#98a2b3]">首屏只保留最关键的 5 类</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3 2xl:grid-cols-5">
                {resourceTypeSummary.slice(0, 5).map(([label, count], index) => (
                  <div key={label} className="rounded-2xl border border-[#f7e6ec] bg-[#fffafb] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-[#344054]">{label}</div>
                      <span className="rounded-full bg-[#fff1f6] px-2 py-0.5 text-[9px] font-extrabold text-[#d64d7b]">
                        TOP {index + 1}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-end justify-between gap-2">
                      <div className="text-[18px] font-black leading-none text-[#171c22]">{count}</div>
                      <div className="text-[10px] text-[#8d4b67]">可直接使用</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {visibleTeachers.length ? (
              <div className="rounded-[24px] bg-white/90 p-4 ring-1 ring-[#f3e1e8]">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8d4b67]">课程团队</div>
                <div className="mt-3 space-y-2.5">
                  {visibleTeachers.map((teacher: CourseTeacher) => (
                    <div key={teacher.id} className="rounded-2xl border border-[#f7e6ec] bg-[#fffafb] px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#fb7299]/12 text-[12px] font-black text-[#d94b7c]">
                          {teacher.name.slice(0, 1)}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[12px] font-bold text-[#171c22]">{teacher.name}</div>
                          <div className="text-[10px] text-[#667085]">{teacher.role}</div>
                        </div>
                      </div>
                      <p className="mt-2 text-[10px] leading-5 text-[#667085]">{teacher.intro}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {displayCourseBundles.length > 0 ? (
        <section className={`grid grid-cols-1 gap-3 ${displayCourseBundles.length > 1 ? "xl:grid-cols-2" : ""}`}>
          {displayCourseBundles.map((bundle) => {
            const isFocusedResource = bundle.resources.some((item) => item.resourceId === focusedResourceId);
            const optimisticGeneratedResources = optimisticGeneratedByCourse[bundle.courseId] || [];
            const mergedSupplementResources = dedupeResourceGroups([...optimisticGeneratedResources, ...bundle.resources]);
            const presentSupplementTypes = Array.from(
              new Set(
                [
                  ...bundle.resourceTypes.map((item) => normalizeSupplementResourceType(item)),
                  ...optimisticGeneratedResources.flatMap((resource) =>
                    resource.resourceTypes.map((item) => normalizeSupplementResourceType(item)),
                  ),
                ].filter(Boolean),
              ),
            ) as ResourceSupplementType[];
            const generatedSupplementTypes = Array.from(
              new Set(
                mergedSupplementResources
                  .filter((resource) => {
                    const normalizedType = normalizeSupplementResourceType(resource.resourceTypes[0]);
                    if (!normalizedType || !COURSE_RESOURCE_ACTION_TYPES.includes(normalizedType)) {
                      return false;
                    }
                    return Number.isFinite(Number(resource.resourceId));
                  })
                  .map((resource) => normalizeSupplementResourceType(resource.resourceTypes[0]))
                  .filter(Boolean),
              ),
            ) as ResourceSupplementType[];
            const missingSupplementOptions = RESOURCE_SUPPLEMENT_OPTIONS.filter(
              (option) => !presentSupplementTypes.includes(option.id),
            );
            const primaryResourceId = bundle.primaryResource.resourceId;
            const representativeFiles = bundle.files.slice(0, 2);
            const latestSupplementResources = mergedSupplementResources
              .filter((resource) => {
                const normalizedType = normalizeSupplementResourceType(resource.resourceTypes[0]);
                return normalizedType && COURSE_RESOURCE_ACTION_TYPES.includes(normalizedType);
              })
              .sort((left, right) => scoreResourceFreshness(right) - scoreResourceFreshness(left))
              .slice(0, 6);
            const latestGeneratedResource =
              generationStatus?.courseId === bundle.courseId && generationStatus.targetResourceId
                ? bundle.resources.find((resource) => resource.resourceId === generationStatus.targetResourceId) ?? null
                : null;

            return (
              <div
                id={`resource-binder-grid-${primaryResourceId}`}
                key={bundle.bundleId}
                data-resource-reveal
                className={`gsap-reveal-card gsap-hover-lift flex flex-col gap-1.5 rounded-[20px] bg-white p-2.5 transition-all group ${
                  isFocusedResource
                    ? "border-[var(--project-primary-border)] shadow-[0_22px_56px_rgba(251,114,153,0.16)] ring-1 ring-[var(--project-primary-ui-text-soft)]"
                    : "border border-[#e9edf2] shadow-[0_12px_34px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(15,23,42,0.08)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-[#fff1f6] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#d64d7b]">
                    课程资料
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#fff7fa] px-2 py-1 text-[9px] font-extrabold tracking-[0.16em] text-[#d64d7b]">
                      已整理
                    </span>
                    {isFocusedResource ? (
                      <span className="rounded-full bg-[#fb7299]/12 px-2 py-1 text-[9px] font-extrabold tracking-[0.18em] text-[#d64d7b]">
                        当前查看
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-2 lg:grid-cols-[1.2fr,0.8fr] lg:items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#fdf1f5] px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-[#d64d7b]">
                        课程工作台
                      </span>
                      <span className="hidden text-[10px] font-semibold text-[#8b95a7] sm:inline">
                        {bundle.updatedAt}
                      </span>
                    </div>

                    <h3 className="font-sans text-[14px] font-black leading-snug text-[#171c22] transition-colors group-hover:text-[#111827]">
                    {bundle.title}
                    </h3>
                    <p className="line-clamp-1 text-[10px] leading-4 text-[#564145] font-sans">
                      {bundle.summary || "当前课程已有资料已整理到一个工作台，可直接查看或继续补齐。"}
                    </p>
                  </div>

                  <div className="rounded-[14px] bg-[#fffafb] p-1.5 ring-1 ring-[#f6dfe7]">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8d4b67]">资料概览</div>
                        <div className="mt-0.5 text-[11px] font-black text-[#171c22]">
                          {bundle.resourceCount} 组 / {bundle.fileCount} 个文件
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={favoriteBusyId === primaryResourceId}
                        onClick={() => void handleToggleFavorite(primaryResourceId)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-extrabold ${
                          favoriteIds.has(primaryResourceId)
                            ? "bg-[var(--project-primary-ui-text-soft)] text-[var(--project-primary)]"
                            : "bg-white text-[#6b7280]"
                        }`}
                      >
                        <Heart className={`h-3 w-3 ${favoriteIds.has(primaryResourceId) ? "fill-current" : ""}`} />
                        {favoriteIds.has(primaryResourceId) ? "已收藏" : "收藏"}
                      </button>
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-center">
                      {[
                        { label: "资料", value: bundle.resourceCount },
                        { label: "文件", value: bundle.fileCount },
                        { label: "覆盖", value: presentSupplementTypes.length || 0 },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl bg-white px-2 py-1 ring-1 ring-[#f6e5ea]">
                          <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#8b95a7]">{item.label}</div>
                          <div className="mt-0.5 text-[12px] font-black text-[#171c22]">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-[#fff7fa] px-3 py-1.5 ring-1 ring-[#f8dfe8]">
                  <span className="text-[10px] font-semibold text-[#8d4b67]">可直接基于这门课现有资料继续答疑，并推荐下一步可看的视频链接</span>
                  <button
                    type="button"
                    onClick={() => handleOpenTutorForBundle(bundle)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#111827] px-3 py-1 text-[10px] font-black text-white transition hover:bg-[#1f2937]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    交给 AI 导师
                  </button>
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

                <div className="space-y-1.5 border-t border-gray-50 pt-1.5">
                  <p className="mb-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#564145]/80">
                    当前课程已有资料
                  </p>

                  {representativeFiles.map((fileObj) => {
                    const isVideo = fileObj.type === "video";
                    const courseVideoTarget = isVideo ? buildCourseVideoTarget(bundle.courseId, fileObj) : null;
                    const rowClassName =
                      "flex items-center justify-between rounded-[16px] border border-[#edf1f5] bg-[#fafbfd] px-2.5 py-1.5 transition-all text-[#171c22] hover:border-[#e1e7ee] hover:bg-white";
                    const fileMeta = (
                      <>
                          <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-white">
                            {fileObj.type === "pdf" ? (
                              <LayoutGrid className="w-4 h-4 text-red-500" />
                            ) : fileObj.type === "text" ? (
                              <FileText className="w-4 h-4 text-[#006689]" />
                            ) : (
                              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate pr-3 text-[10px] font-bold">{fileObj.name}</p>
                            <p className="mt-0.5 text-[8px] font-mono text-[#564145]/70">
                              {fileObj.format} · {fileObj.size}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <span
                            className={
                              courseVideoTarget
                                ? "inline-flex items-center gap-0.5 rounded-full bg-[#006689] px-2.5 py-1 text-[9px] font-bold font-sans text-white transition-colors hover:bg-[#005570]"
                                : "inline-flex items-center gap-0.5 rounded-full bg-white px-2.5 py-1 text-[9px] font-bold font-sans text-[#006689] transition-colors hover:bg-[#e8f4f8]"
                            }
                          >
                            <span>{courseVideoTarget ? "进入课堂" : "查看详情"}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
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

                  {bundle.fileCount > representativeFiles.length ? (
                    <button
                      type="button"
                      onClick={() => {
                        const nextFileId = representativeFiles[0]?.fileId;
                        if (nextFileId) {
                          handleOpenBundleFilePreview(bundle, nextFileId);
                        }
                      }}
                      className="w-full rounded-[16px] border border-dashed border-[#e5e7eb] bg-[#fafbfd] px-3 py-1.5 text-left text-[10px] font-semibold text-[#5b6574] transition hover:border-[#d7e3ef] hover:bg-white"
                    >
                      查看这门课剩余 {bundle.fileCount - representativeFiles.length} 份资料
                    </button>
                  ) : null}
                </div>

                <div className="space-y-2 border-t border-gray-50 pt-2">
                  <div className="rounded-[16px] border border-[#ffd9e5] bg-[linear-gradient(135deg,#fff7fa_0%,#fffdfd_100%)] p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#d64d7b]">
                          AI 补资源
                        </div>
                        <div className="mt-0.5 text-[11px] font-black text-[#171c22]">
                          把这门课缺的资料一键补齐
                        </div>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#d64d7b] shadow-sm">
                        多智能体协同
                      </span>
                    </div>

                    {RESOURCE_SUPPLEMENT_OPTIONS.filter((option) => COURSE_RESOURCE_ACTION_TYPES.includes(option.id)).length > 0 ? (
                      <>
                        <p className="mt-1 text-[10px] leading-4 text-[#7b8794]">
                          下面每个入口都会直接补出一种具体成果，生成后会自动定位到刚补出的内容。
                        </p>
                        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                          {RESOURCE_SUPPLEMENT_OPTIONS
                            .filter((option) => COURSE_RESOURCE_ACTION_TYPES.includes(option.id))
                            .map((option) => {
                              const isGenerating = generatingType === option.id;
                              const alreadyExists = generatedSupplementTypes.includes(option.id);
                              const isCurrentStatus =
                                generationStatus?.courseId === bundle.courseId && generationStatus.resourceType === option.id;
                              const actionMeta = getSupplementActionMeta(option.id);
                              return (
                                <button
                                  key={`${bundle.bundleId}-${option.id}`}
                                  data-resource-supplement={option.id}
                                  type="button"
                                  onClick={() => void handleGenerateResources(option.id, bundle.courseId, bundle.title)}
                                  disabled={Boolean(generatingType)}
                                  className={`rounded-[16px] border px-2.5 py-2.5 text-left transition-all disabled:opacity-60 ${
                                    isGenerating
                                      ? "border-[#d64d7b] bg-[#d64d7b] text-white shadow-[0_10px_24px_rgba(214,77,123,0.24)]"
                                      : `${actionMeta.border} bg-gradient-to-br ${actionMeta.accent} text-[#d64d7b] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(214,77,123,0.10)]`
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[14px] ${
                                            isGenerating ? "bg-white/14 text-white" : actionMeta.iconTone
                                          }`}
                                        >
                                          {isGenerating ? (
                                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <Sparkles className="h-3.5 w-3.5" />
                                          )}
                                        </span>
                                        <span className={`text-[9px] font-extrabold uppercase tracking-[0.16em] ${isGenerating ? "text-white/80" : "text-[#a85578]"}`}>
                                          {actionMeta.eyebrow}
                                        </span>
                                      </div>
                                      <div className="mt-1.5 min-w-0">
                                        <div className="text-[11px] font-black leading-none">
                                          {isGenerating
                                            ? `正在生成${option.successLabel}`
                                            : isCurrentStatus && generationStatus?.stage === "completed"
                                              ? `${option.successLabel}已生成`
                                              : option.triggerLabel}
                                        </div>
                                        <div className={`mt-1 text-[9px] leading-4 ${isGenerating ? "text-white/85" : "text-[#8d4b67]"}`}>
                                          {option.description}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="shrink-0 pt-0.5">
                                      {alreadyExists ? (
                                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                                          isGenerating ? "bg-white/15 text-white" : "bg-[#fff1f6] text-[#b83280]"
                                        }`}>
                                          已有
                                        </span>
                                      ) : (
                                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                                          isGenerating ? "bg-white/15 text-white" : "bg-[#fff7fa] text-[#d64d7b]"
                                        }`}>
                                          新生成
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                          })}
                        </div>
                        {generationStatus?.courseId === bundle.courseId ? (
                          <div className="mt-2.5 rounded-[22px] border border-[#ffe1eb] bg-white/95 px-3 py-3 shadow-[0_8px_24px_rgba(214,77,123,0.08)]">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#d64d7b]">
                                  资源生成状态
                                </div>
                                <p className="mt-1 text-[10px] font-semibold text-[#6b7280]">
                                  {generationStatus.stage === "running"
                                    ? `${generationStatus.successLabel}生成中，通常只需十几秒。`
                                    : `${generationStatus.successLabel}已补齐，下面就是刚生成出来的成果。`}
                                </p>
                              </div>
                              <div className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                                generationStatus.stage === "running"
                                  ? "bg-[#fff1f6] text-[#d64d7b]"
                                  : "bg-[#ecfdf3] text-[#027a48]"
                              }`}>
                                {generationStatus.stage === "running" ? "生成中" : "已完成"}
                              </div>
                            </div>
                          </div>
                        ) : null}
                        {generationStatus?.courseId === bundle.courseId && generationStatus.stage === "running" ? (
                          <div className="mt-2.5 grid gap-2 md:grid-cols-2">
                            {Array.from({ length: 2 }).map((_, index) => (
                              <div
                                key={`pending-supplement-${index}`}
                                className="rounded-2xl border border-dashed border-[#f7bfd1] bg-[#fffafb] px-3 py-2.5"
                              >
                                <div className="flex items-center gap-2">
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#d64d7b]" />
                                  <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#d64d7b]">
                                    正在生成
                                  </span>
                                </div>
                                <div className="mt-3 h-3 w-24 rounded-full bg-[#ffe5ee]" />
                                <div className="mt-2 h-3 w-full rounded-full bg-[#fff1f6]" />
                                <div className="mt-1.5 h-3 w-4/5 rounded-full bg-[#fff1f6]" />
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {latestSupplementResources.length > 0 ? (
                          <div className="mt-2.5 space-y-2 rounded-2xl bg-white/80 p-2 ring-1 ring-[#ffe1eb]">
                            <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#d64d7b]">
                              最新补充内容
                            </div>
                            <div className="space-y-2">
                              {latestSupplementResources.map((resource) => {
                                const previewFile = resource.files[0];
                                const normalizedType = normalizeSupplementResourceType(resource.resourceTypes[0]);
                                const option = RESOURCE_SUPPLEMENT_OPTIONS.find((item) => item.id === normalizedType);
                                const previewMeta = buildSupplementPreviewMeta(normalizedType);
                                const shouldHighlight =
                                  generationStatus?.stage === "completed" &&
                                  generationStatus.targetResourceId === resource.resourceId;
                                return (
                                  <button
                                    key={`latest-${resource.resourceId}`}
                                    type="button"
                                    ref={shouldHighlight ? latestGeneratedResourceRef : null}
                                    onClick={() => handleOpenPreview(resource, previewFile?.fileId || resource.resourceId)}
                                    className={`flex w-full items-start justify-between rounded-[22px] border px-3 py-3 text-left transition hover:bg-white ${
                                      shouldHighlight
                                        ? "border-[#ee8eae] bg-[linear-gradient(135deg,#fff8fb_0%,#ffffff_100%)] shadow-[0_10px_28px_rgba(214,77,123,0.14)] ring-1 ring-[#f8bfd3]"
                                        : "border-[#fbe2ea] bg-[#fffafb] hover:border-[#f5b8ca]"
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="rounded-full bg-[#fff1f6] px-2 py-0.5 text-[9px] font-extrabold text-[#c23d72]">
                                          {option?.successLabel || "补充资料"}
                                        </span>
                                        {shouldHighlight ? (
                                          <span className="rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[9px] font-extrabold text-[#027a48]">
                                            刚生成
                                          </span>
                                        ) : null}
                                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${previewMeta.tone}`}>
                                          {previewMeta.badge}
                                        </span>
                                      </div>
                                      <p className="mt-1.5 truncate text-[11px] font-black text-[#171c22]">{resource.title}</p>
                                      <p className="line-clamp-2 text-[9px] leading-4.5 text-[#7b8794]">{resource.summary}</p>
                                      {renderSupplementPreview(resource, normalizedType)}
                                    </div>
                                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#d64d7b]" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-1.5">
                  <button
                    type="button"
                    onClick={() => navigate(`/learn?courseId=${bundle.courseId}`)}
                    className="w-full rounded-full bg-[#111827] px-4 py-2 text-[10px] font-bold text-white transition hover:bg-[#1f2937]"
                  >
                    进入课程学习
                  </button>
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

