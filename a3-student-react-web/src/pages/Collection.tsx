/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bookmark,
  Clock3,
  FileText,
  FolderHeart,
  Heart,
  ListRestart,
  Network,
  PlayCircle,
  Presentation,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { COURSES, type Course } from "../constants";
import { readPersistedCourseResourceWorkspace } from "../lib/courseResourceWorkspace";
import { exportDeckAsPptx, type DeckSlide } from "../lib/pptxExport";
import { studentApi, type ResourceCard } from "../lib/studentApi";
import { openTutorPanel } from "../lib/tutorPanel";
import { getCurrentLoggedInUserId } from "../lib/currentUser";
import { getGeneratedResourceIcon, getGeneratedResourceUiMeta } from "../lib/generatedResourceUi";
import { buildResourcesRoute, readLastRouteCourseId } from "../lib/routeCourseContext";

type CollectionTab = "All" | "Courses" | "Handouts";
const TUTOR_SESSION_TITLE_STORAGE_KEY = "a3-tutor-session-title-map";
const TUTOR_FAVORITE_HISTORY_STORAGE_KEY = "a3-tutor-favorite-history-cache";
const FAVORITE_HANDOUTS_CACHE_STORAGE_KEY = "a3-favorite-handouts-cache";
const FAVORITE_HANDOUTS_LOADING_GRACE_MS = 900;
const FAVORITE_HANDOUTS_BACKGROUND_TIMEOUT_MS = 12000;

type FavoriteHandout = {
  id: string;
  title: string;
  format: string;
  size: string;
  courseTitle: string;
  resourceId: string;
  courseId: string;
  fileId: string;
  previewUrl?: string;
  excerpt?: string;
  type: "pdf" | "text" | "image" | "video";
  rawResource?: ResourceCard | null;
};

type ClassroomFavoriteAsset = {
  id: string;
  title: string;
  courseId: string;
  sectionTitle: string;
  summary: string;
  kindLabel: string;
  kind?: "handout" | "mindmap" | "practice";
  generatedAt: string;
  actionLabel: string;
  itemType: "resource" | "ppt";
  downloadUrl?: string;
  rawContent?: string;
  previewContent?: string[];
  resourceId?: number | null;
  fileName?: string;
  slides?: DeckSlide[];
};

type FavoriteTutorSession = {
  id: string;
  sessionId: string;
  questionId: string;
  answerId?: string;
  title: string;
  preview: string;
  questionText?: string;
  answerText?: string;
  createdAt: string;
  courseId: string;
  courseTitle: string;
};

type FavoriteHandoutsCache = {
  userId: number;
  items: FavoriteHandout[];
  savedAt: string;
};

const TAB_LABELS: Record<CollectionTab, string> = {
  All: "全部收藏",
  Courses: "课程收藏",
  Handouts: "资料收藏",
};

const DEFAULT_FAVORITE_COURSES = [COURSES[0], COURSES[1]];

function inferFileTypeFromExtension(extension?: string | null): FavoriteHandout["type"] {
  const normalized = (extension || "").toLowerCase();
  if (normalized === ".pdf") return "pdf";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(normalized)) return "image";
  if ([".mp4", ".webm", ".mov", ".m3u8"].includes(normalized)) return "video";
  return "text";
}

function inferFormatFromMime(extension?: string | null, mimeType?: string | null) {
  if (mimeType?.includes("pdf")) return "PDF 文档";
  if (mimeType?.startsWith("image/")) return "图片文件";
  if (mimeType?.startsWith("video/")) return "视频文件";
  return `${(extension || ".txt").replace(/^\./, "").toUpperCase()} 文件`;
}

function formatFileSize(fileSize?: number | null) {
  if (!fileSize || fileSize <= 0) return "未知";
  if (fileSize >= 1024 * 1024) return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
  if (fileSize >= 1024) return `${Math.round(fileSize / 1024)} KB`;
  return `${fileSize} B`;
}

function isPracticeWorkbenchResource(resourceType?: string | null) {
  return resourceType === "coding_lab" || resourceType === "case_study";
}

function mapFavoriteResourcesToHandouts(items: ResourceCard[]): FavoriteHandout[] {
  return items.flatMap((resource) => {
    const sourceFiles = resource.source_files || [];
    if (sourceFiles.length) {
      return sourceFiles.map((file) => ({
        id: `${resource.resource_id || resource.title}-${file.file_id}`,
        title: file.display_name,
        format: inferFormatFromMime(file.file_extension, file.mime_type),
        size: formatFileSize(file.file_size),
        courseTitle: resource.title,
        resourceId: String(resource.resource_id || ""),
        courseId: "series-1",
        fileId: String(file.file_id),
        previewUrl: file.preview_url || file.open_url || undefined,
        excerpt: file.preview_text || resource.summary,
        type: inferFileTypeFromExtension(file.file_extension),
        rawResource: resource,
      }));
    }

    return [
      {
        id: `resource-${resource.resource_id || resource.title}`,
        title: resource.title,
        format: resource.resource_type === "practice_set" ? "练习资料" : "学习资料",
        size: resource.source_file_count && resource.source_file_count > 0 ? `${resource.source_file_count} 个文件` : "在线资料",
        courseTitle: resource.title,
        resourceId: String(resource.resource_id || ""),
        courseId: "series-1",
        fileId: String(resource.resource_id || resource.title),
        previewUrl: resource.content_markdown || undefined,
        excerpt: resource.summary,
        type: resource.resource_type === "video" ? "video" : "text",
        rawResource: resource,
      },
    ];
  });
}

function getClassroomFavoriteAssets() {
  return COURSES.flatMap((course) => {
    const workspace = readPersistedCourseResourceWorkspace(course.id);
    if (!workspace) {
      return [];
    }

    const artifacts = (workspace.recentArtifacts || [])
      .filter((item) => item.starred)
      .map<ClassroomFavoriteAsset>((item) => ({
        id: `${course.id}-${item.kind}`,
        title: item.customTitle || item.title,
        courseId: course.id,
        sectionTitle: item.sectionTitle,
        summary: item.summary,
        kindLabel: getGeneratedResourceUiMeta(item.kind).label,
        kind: item.kind,
        generatedAt: item.generatedAt,
        actionLabel: getGeneratedResourceUiMeta(item.kind).actionLabel,
        itemType: "resource",
        downloadUrl: item.downloadUrl,
        rawContent: item.rawContent,
        previewContent: item.previewContent,
        resourceId: item.resourceId,
      }));

    const ppt = workspace.recentPpt;
    const pptAsset =
      ppt && ppt.starred
        ? [
            {
              id: `${course.id}-ppt`,
              title: ppt.customTitle || ppt.fileName.replace(/\.pptx$/i, ""),
              courseId: course.id,
              sectionTitle: ppt.sectionTitle,
              summary: ppt.summary || "已按当前课堂上下文整理为课件草案。",
              kindLabel: getGeneratedResourceUiMeta("ppt").label,
              generatedAt: ppt.generatedAt,
              actionLabel: getGeneratedResourceUiMeta("ppt").actionLabel,
              itemType: "ppt" as const,
              fileName: ppt.fileName,
              slides: ppt.slides,
            },
          ]
        : [];

    return [...pptAsset, ...artifacts];
  }).sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
}

function getFavoriteTutorSessions(): FavoriteTutorSession[] {
  if (typeof window === "undefined") return [];
  try {
    const rawTitleMap = window.localStorage.getItem(TUTOR_SESSION_TITLE_STORAGE_KEY);
    const titleMap = rawTitleMap ? (JSON.parse(rawTitleMap) as Record<string, string>) : {};
    const rawHistory = window.localStorage.getItem(TUTOR_FAVORITE_HISTORY_STORAGE_KEY);
    const history = rawHistory ? (JSON.parse(rawHistory) as FavoriteTutorSession[]) : [];
    return history
      .map((item) => ({
        ...item,
        title: titleMap[item.sessionId] || item.title || "AI 导师会话",
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch {
    return [];
  }
}

function inferSyntheticFileExtension(file: FavoriteHandout) {
  if (file.type === "pdf") return ".pdf";
  if (file.type === "image") return ".png";
  if (file.type === "video") return ".mp4";
  return ".md";
}

function inferSyntheticMimeType(file: FavoriteHandout) {
  if (file.type === "pdf") return "application/pdf";
  if (file.type === "image") return "image/png";
  if (file.type === "video") return "video/mp4";
  return "text/markdown";
}

function buildPreviewFileState(file: FavoriteHandout) {
  const resolvedUrl =
    file.previewUrl && (file.previewUrl.startsWith("/") || /^https?:\/\//i.test(file.previewUrl))
      ? file.previewUrl
      : null;
  const numericFileId = Number(file.fileId);
  const fallbackFileId = Number.isFinite(numericFileId) && numericFileId > 0 ? numericFileId : Number(file.resourceId) || -1;

  return {
    initialResource: file.rawResource || null,
    initialFileId: fallbackFileId > 0 ? fallbackFileId : null,
    initialPreviewFile: {
      file_id: fallbackFileId,
      display_name: file.title,
      relative_path: file.previewUrl || file.title,
      top_level_category: "收藏资料",
      file_extension: inferSyntheticFileExtension(file),
      mime_type: inferSyntheticMimeType(file),
      file_size: null,
      preview_text: file.excerpt || null,
      is_inline_previewable: true,
      preview_mode: file.type === "text" ? "text" : file.type,
      preview_url: resolvedUrl,
      open_url: resolvedUrl || "",
    },
  };
}

function buildClassroomAssetPreviewState(asset: ClassroomFavoriteAsset) {
  const resourceType = asset.kind === "handout" ? "lecture_note" : asset.kind === "mindmap" ? "mindmap" : "practice_set";
  const previewText = asset.rawContent || asset.previewContent?.join("\n") || asset.summary;
  const syntheticFileId = Number(asset.resourceId) > 0 ? Number(asset.resourceId) : 900000 + Math.abs(hashString(asset.id) % 9999);
  const previewFile = {
    file_id: syntheticFileId,
    display_name: `${asset.title}.md`,
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
  };
  return {
    initialResource: {
      resource_id: asset.resourceId || syntheticFileId,
      resource_type: resourceType,
      title: asset.title,
      summary: asset.summary,
      content_markdown: previewText,
      source_titles: [],
      study_suggestion:
        asset.kind === "mindmap"
          ? "建议先顺着导图主干看结构，再按分支顺序回到课堂继续学习。"
          : asset.kind === "practice"
            ? "建议先完成练习，再结合解析和 AI 导师继续补薄弱点。"
            : "建议先通读讲义主线，再围绕关键概念继续提问和展开。",
      source_file_count: 1,
      source_files: [previewFile],
    } satisfies ResourceCard,
    initialFileId: syntheticFileId,
    initialPreviewFile: previewFile,
  };
}

function readCachedFavoriteHandouts(userId: number): FavoriteHandout[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAVORITE_HANDOUTS_CACHE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as FavoriteHandoutsCache) : null;
    return parsed?.userId === userId && Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function writeCachedFavoriteHandouts(userId: number, items: FavoriteHandout[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      FAVORITE_HANDOUTS_CACHE_STORAGE_KEY,
      JSON.stringify({
        userId,
        items,
        savedAt: new Date().toISOString(),
      } satisfies FavoriteHandoutsCache),
    );
  } catch {
    // Local cache is only a speed-up; failing to persist should not block the page.
  }
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function buildPreviewSearch(courseId: string, resourceId?: string | number | null, fileId?: string | number | null) {
  const params = new URLSearchParams({ courseId });
  const numericResourceId = Number(resourceId);
  const numericFileId = Number(fileId);
  if (Number.isFinite(numericResourceId) && numericResourceId > 0) {
    params.set("resourceId", String(numericResourceId));
  }
  if (Number.isFinite(numericFileId) && numericFileId > 0) {
    params.set("fileId", String(numericFileId));
  }
  return params.toString();
}

function ClassroomAssetIcon({ asset }: { asset: ClassroomFavoriteAsset }) {
  const Icon = asset.itemType === "ppt" ? getGeneratedResourceIcon("ppt") : getGeneratedResourceIcon(asset.kind || "handout");
  return <Icon className="h-3.5 w-3.5" />;
}

function matchesQuery(texts: Array<string | undefined>, query: string) {
  if (!query) return true;
  return texts.some((text) => (text || "").toLowerCase().includes(query));
}

function getHandoutTypeLabel(type: FavoriteHandout["type"]) {
  if (type === "pdf") return "讲义";
  if (type === "video") return "视频附件";
  if (type === "image") return "图示资料";
  return "文本资料";
}

function getStudyPriority(progress: number) {
  if (progress >= 70) return { label: "优先复习", tone: "text-[var(--project-primary)] bg-[var(--project-primary-soft)]" };
  if (progress >= 30) return { label: "继续推进", tone: "text-amber-700 bg-amber-50" };
  return { label: "建议启动", tone: "text-emerald-700 bg-emerald-50" };
}

function CollectionCourseCard({
  course,
  onOpen,
  onRemove,
}: {
  course: Course;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const priority = getStudyPriority(course.progress);

  return (
    <div
      id={`favorite-course-${course.id}`}
      className="group overflow-hidden rounded-[28px] border border-[#e8ecf1] bg-white shadow-[0_14px_36px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_20px_46px_rgba(15,23,42,0.08)]"
    >
      <button type="button" onClick={onOpen} className="relative h-48 w-full overflow-hidden bg-slate-100 text-left">
        <img
          src={course.image}
          alt={course.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.78))] p-4">
          <div className="flex items-center justify-between gap-3">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${priority.tone}`}>
              {priority.label}
            </span>
            <span className="rounded-full bg-black/55 px-2 py-1 font-mono text-[10px] text-white">
              {course.duration}
            </span>
          </div>
        </div>
      </button>

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full bg-[var(--project-primary-soft)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--project-primary)]">
              {course.category}
            </div>
            <button
              type="button"
              onClick={onOpen}
              className="mt-3 block text-left text-[18px] font-black leading-snug tracking-[-0.03em] text-[#171c22] transition-colors group-hover:text-[var(--project-primary)]"
            >
              {course.title}
            </button>
            <p className="mt-2 text-sm leading-6 text-[#5b6574]">{course.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-xl border border-[#edf1f5] p-2 text-slate-400 transition-colors hover:border-red-100 hover:text-red-500"
            title="取消收藏"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-2xl border border-[#eef2f6] bg-[#fafbfd] p-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#5b6574]">
            <span>学习进度</span>
            <span>{course.progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef2f6]">
            <div
              className="h-full rounded-full bg-[var(--project-primary)] transition-all"
              style={{ width: `${Math.max(8, course.progress)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#f1f4f7] pt-3 text-[11px] text-[#5b6574]">
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-500 stroke-none" />
            <strong className="text-[#171c22]">{course.rating}</strong> · {course.views} 浏览
          </span>
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-3 py-1.5 font-bold text-white transition-colors hover:bg-[#1f2937]"
          >
            <PlayCircle className="h-4 w-4" />
            继续学习
          </button>
        </div>
      </div>
    </div>
  );
}

function CollectionHandoutRow({
  file,
  removing,
  onOpen,
  onRemove,
}: {
  file: FavoriteHandout;
  removing: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      id={`favorite-handout-${file.id}`}
      className="group flex flex-col gap-4 rounded-[24px] border border-[#e8ecf1] bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.07)] sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--project-primary-border)] bg-[var(--project-primary-soft)] text-[var(--project-primary)]">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#f4f6f8] px-2.5 py-1 text-[10px] font-extrabold text-[#5b6574]">
              {getHandoutTypeLabel(file.type)}
            </span>
            <span className="rounded-full bg-[#f4f6f8] px-2.5 py-1 text-[10px] font-bold text-[#7a8391]">
              {file.size}
            </span>
          </div>
          <div className="mt-2 text-[15px] font-extrabold text-[#171c22]">{file.title}</div>
          <div className="mt-1 text-[12px] text-[#5b6574]">
            关联课程：<span className="font-bold text-[var(--project-primary)]">{file.courseTitle}</span> · {file.format}
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#6b7280]">
            {file.excerpt || "已收藏到学习资料列表，可随时回看、跳转预览或继续回到课程学习。"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="rounded-xl border border-[#edf1f5] p-2 text-slate-400 transition-colors hover:border-red-100 hover:text-red-500 disabled:opacity-60"
          title="取消收藏"
        >
          {removing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 rounded-xl bg-[var(--project-primary)] px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-[var(--project-primary-hover)]"
        >
          预览资料
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function CollectionEmptyState({
  onReset,
  onGoResources,
}: {
  onReset: () => void;
  onGoResources: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-[#e8ecf1] bg-white px-8 py-16 text-center shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
      <Bookmark className="mx-auto mb-4 h-12 w-12 text-slate-200" />
      <h4 className="text-lg font-black tracking-[-0.03em] text-[#171c22]">当前筛选下还没有可展示的收藏</h4>
      <p className="mt-2 text-sm leading-7 text-[#5b6574]">可以换一个关键词，或者直接回资源中心继续补充常用讲义、课程和复习资料。</p>
      <div className="mt-5 flex justify-center gap-2">
        <button
          type="button"
          onClick={onReset}
          className="rounded-xl border border-[#e5e7eb] bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-800 hover:bg-slate-200"
        >
          重置列表
        </button>
        <button
          type="button"
          onClick={onGoResources}
          className="rounded-xl bg-[var(--project-primary)] px-4 py-2 text-xs font-extrabold text-white hover:bg-[var(--project-primary-hover)]"
        >
          去资源中心
        </button>
      </div>
    </div>
  );
}

export default function Collection() {
  const navigate = useNavigate();
  const activeUserId = getCurrentLoggedInUserId();

  const [activeTab, setActiveTab] = useState<CollectionTab>("All");
  const [favoriteCourses, setFavoriteCourses] = useState<Course[]>(DEFAULT_FAVORITE_COURSES);
  const [favoriteHandouts, setFavoriteHandouts] = useState<FavoriteHandout[]>(() => readCachedFavoriteHandouts(activeUserId));
  const [classroomFavoriteAssets, setClassroomFavoriteAssets] = useState<ClassroomFavoriteAsset[]>(() => getClassroomFavoriteAssets());
  const [favoriteTutorSessions, setFavoriteTutorSessions] = useState<FavoriteTutorSession[]>(() => getFavoriteTutorSessions());
  const [loadingHandouts, setLoadingHandouts] = useState(false);
  const [refreshingFavorites, setRefreshingFavorites] = useState(false);
  const [removingFavoriteId, setRemovingFavoriteId] = useState<string | null>(null);
  const [removingTutorSessionId, setRemovingTutorSessionId] = useState<string | null>(null);
  const [previewTutorSession, setPreviewTutorSession] = useState<FavoriteTutorSession | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const toastTimerRef = useRef<number | null>(null);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const showToast = (message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2600);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const loadFavoriteHandouts = async (mode: "initial" | "refresh" = "initial") => {
    const hasCachedHandouts = favoriteHandouts.length > 0;
    if (mode === "refresh") {
      setRefreshingFavorites(true);
    } else if (!hasCachedHandouts) {
      setLoadingHandouts(true);
    }

    const syncFavorites = studentApi.listFavoriteResources(activeUserId, FAVORITE_HANDOUTS_BACKGROUND_TIMEOUT_MS).then((response) => {
      const nextHandouts = mapFavoriteResourcesToHandouts(response.items);
      setFavoriteHandouts(nextHandouts);
      writeCachedFavoriteHandouts(activeUserId, nextHandouts);
      if (mode === "refresh") {
        showToast("收藏列表已刷新。");
      }
    }).catch((error: unknown) => {
      if (mode === "refresh") {
        showToast(error instanceof Error && error.message === "Request timeout" ? "收藏同步超时，已保留当前列表。" : "收藏同步失败，已保留当前列表。");
      } else if (!hasCachedHandouts) {
        setFavoriteHandouts(readCachedFavoriteHandouts(activeUserId));
      }
    });

    if (mode === "refresh") {
      await syncFavorites;
      setRefreshingFavorites(false);
      return;
    }

    const finishedQuickly = await Promise.race([
      syncFavorites.then(() => true),
      wait(FAVORITE_HANDOUTS_LOADING_GRACE_MS).then(() => false),
    ]);
    if (!finishedQuickly) {
      setLoadingHandouts(false);
      return;
    }
    setLoadingHandouts(false);
  };

  useEffect(() => {
    void loadFavoriteHandouts();
  }, []);

  useEffect(() => {
    setClassroomFavoriteAssets(getClassroomFavoriteAssets());
    setFavoriteTutorSessions(getFavoriteTutorSessions());
  }, []);

  const filteredCourses = useMemo(() => {
    return favoriteCourses.filter((course) =>
      matchesQuery([course.title, course.subtitle, course.category, course.description], normalizedQuery),
    );
  }, [favoriteCourses, normalizedQuery]);

  const filteredHandouts = useMemo(() => {
    return favoriteHandouts.filter((file) =>
      matchesQuery([file.title, file.courseTitle, file.format, file.excerpt], normalizedQuery),
    );
  }, [favoriteHandouts, normalizedQuery]);

  const filteredClassroomAssets = useMemo(() => {
    return classroomFavoriteAssets.filter((item) =>
      matchesQuery([item.title, item.sectionTitle, item.summary, item.kindLabel], normalizedQuery),
    );
  }, [classroomFavoriteAssets, normalizedQuery]);

  const filteredTutorSessions = useMemo(() => {
    return favoriteTutorSessions.filter((item) =>
      matchesQuery([item.title, item.preview, item.courseTitle], normalizedQuery),
    );
  }, [favoriteTutorSessions, normalizedQuery]);

  const totalFavorites =
    favoriteCourses.length + favoriteHandouts.length + classroomFavoriteAssets.length + favoriteTutorSessions.length;
  const activeCourse = favoriteCourses[0];
  const topHandout = favoriteHandouts[0];
  const collectionAgentStatus = normalizedQuery
    ? `正在按“${searchQuery.trim()}”整理你的收藏`
    : "正在按课程与资料类型整理你的收藏";
  const activeTabCount =
    activeTab === "Courses"
      ? filteredCourses.length
      : activeTab === "Handouts"
        ? filteredHandouts.length + filteredClassroomAssets.length + filteredTutorSessions.length
        : filteredCourses.length + filteredHandouts.length + filteredClassroomAssets.length + filteredTutorSessions.length;
  const reviewQueueCount = favoriteHandouts.length + classroomFavoriteAssets.length + favoriteTutorSessions.length;
  const nextReviewTitle = topHandout?.title || classroomFavoriteAssets[0]?.title || favoriteTutorSessions[0]?.title || "先去资源中心收藏一份资料";

  const shouldShowEmpty =
    (activeTab === "Courses" && filteredCourses.length === 0) ||
    (activeTab === "Handouts" && !loadingHandouts && filteredHandouts.length === 0) ||
    (activeTab === "All" &&
      filteredCourses.length === 0 &&
      filteredHandouts.length === 0 &&
      filteredClassroomAssets.length === 0 &&
      filteredTutorSessions.length === 0);

  const handleReset = () => {
    setFavoriteCourses(DEFAULT_FAVORITE_COURSES);
    setSearchQuery("");
    showToast("已重置当前筛选。");
  };

  const handleRemoveCourse = (courseId: string) => {
    setFavoriteCourses((current) => current.filter((course) => course.id !== courseId));
    showToast("已移出课程收藏。");
  };

  const handleRemoveHandout = async (favoriteId: string) => {
    const target = favoriteHandouts.find((item) => item.id === favoriteId);
    const numericResourceId = Number(target?.resourceId || "");

    if (!target || !Number.isFinite(numericResourceId)) {
      setFavoriteHandouts((current) => {
        const next = current.filter((item) => item.id !== favoriteId);
        writeCachedFavoriteHandouts(activeUserId, next);
        return next;
      });
      showToast("当前资料缺少真实编号，已执行本地移除。");
      return;
    }

    setRemovingFavoriteId(favoriteId);
    try {
      await studentApi.favoriteResource(numericResourceId, activeUserId);
      setFavoriteHandouts((current) => {
        const next = current.filter((item) => item.id !== favoriteId);
        writeCachedFavoriteHandouts(activeUserId, next);
        return next;
      });
      showToast("已取消资料收藏。");
    } catch {
      showToast("取消收藏失败，当前先保留原列表。");
    } finally {
      setRemovingFavoriteId(null);
    }
  };

  const handleOpenHandout = (file: FavoriteHandout) => {
    const previewSearch = buildPreviewSearch(file.courseId, file.resourceId || file.rawResource?.resource_id, file.fileId);
    navigate(`/resources/preview?${previewSearch}`, {
      state: buildPreviewFileState(file),
    });
  };

  const handleOpenClassroomAsset = (asset: ClassroomFavoriteAsset) => {
    if (asset.itemType === "ppt" && asset.fileName && asset.slides) {
      exportDeckAsPptx(asset.fileName, asset.slides);
      showToast("课堂 PPT 已开始导出。");
      return;
    }
    if (asset.itemType === "resource" && asset.kind) {
      const previewState = buildClassroomAssetPreviewState(asset);
      const previewSearch = buildPreviewSearch(asset.courseId, previewState.initialResource.resource_id, previewState.initialFileId);
      navigate(`/resources/preview?${previewSearch}`, {
        state: previewState,
      });
      return;
    }
    if (asset.downloadUrl) {
      window.open(asset.downloadUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleOpenTutorSession = (session: FavoriteTutorSession) => {
    openTutorPanel({
      courseId: session.courseId,
      mode: "default",
      title: session.title,
      subtitle: "从学习收藏里继续回到这条 AI 导师会话。",
      query: session.preview,
    });
  };

  const handleRemoveTutorSession = async (session: FavoriteTutorSession) => {
    setRemovingTutorSessionId(session.id);
    try {
      await studentApi.removeTutoringFavorite(session.questionId);
    } catch {
      // Keep going so local collection state is still cleaned up.
    }

    try {
      const raw = window.localStorage.getItem(TUTOR_FAVORITE_HISTORY_STORAGE_KEY);
      const current = raw ? (JSON.parse(raw) as FavoriteTutorSession[]) : [];
      const next = current.filter((item) => item.id !== session.id);
      window.localStorage.setItem(TUTOR_FAVORITE_HISTORY_STORAGE_KEY, JSON.stringify(next));
      setFavoriteTutorSessions(next);
      showToast("已从学习收藏中移除这条 AI 会话。");
    } catch {
      setFavoriteTutorSessions((current) => current.filter((item) => item.id !== session.id));
      showToast("本地会话收藏已移除。");
    } finally {
      setRemovingTutorSessionId(null);
    }
  };

  return (
    <div className="space-y-6 select-none" id="collection-workspace">
      <section className="overflow-hidden rounded-[28px] border border-[#e7ebf0] bg-[linear-gradient(135deg,#ffffff_0%,#fff8fb_55%,#f4fbff_100%)] shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
        <div className="relative p-5 lg:p-6">
          <div className="space-y-4 xl:pr-[340px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--project-primary-border)] bg-white px-3 py-1 text-[10px] font-black text-[var(--project-primary)]">
                <FolderHeart className="h-3.5 w-3.5" />
                学习收藏工作台
              </div>
              <h1 className="mt-3 text-[24px] font-black tracking-[-0.05em] text-[#171c22] lg:text-[32px]">把要回看的内容收成一张复习清单</h1>
              <p className="mt-2 max-w-2xl text-[13px] leading-7 text-[#564145]">
                课程、资源、课堂生成内容和 AI 导师会话会沉淀到同一个列表里。这里不只是收藏夹，而是你下次继续学习时的入口。
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#0f172a] px-3 py-1.5 text-[10px] font-black text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)]">
                <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                  <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-white/72">同步状态</span>
                <span className="text-white">{collectionAgentStatus}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[22px] border border-white/80 bg-white/88 px-4 py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="text-[10px] font-black text-[#8a94a3]">收藏总览</div>
                <div className="mt-1.5 text-[30px] font-black ui-tracking-tight text-[#171c22]">{totalFavorites}</div>
                <div className="mt-1 text-xs text-[#5b6574]">课程与资料已放进同一收藏列表</div>
              </div>
              <div className="rounded-[22px] border border-white/80 bg-white/88 px-4 py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="text-[10px] font-black text-[#8a94a3]">当前筛选</div>
                <div className="mt-1.5 text-[30px] font-black ui-tracking-tight text-[#171c22]">{activeTabCount}</div>
                <div className="mt-1 text-xs text-[#5b6574]">{TAB_LABELS[activeTab]}可直接打开</div>
              </div>
              <div className="rounded-[22px] border border-white/80 bg-white/88 px-4 py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="text-[10px] font-black text-[#8a94a3]">优先课程</div>
                <div className="mt-1.5 text-[15px] font-black leading-6 text-[#171c22]">{activeCourse?.title || "待整理"}</div>
                <div className="mt-1 text-xs text-[#5b6574]">建议先回看主线课程，再进入资料复习</div>
              </div>
              <div className="rounded-[22px] border border-white/80 bg-white/88 px-4 py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="text-[10px] font-black text-[#8a94a3]">复习队列</div>
                <div className="mt-1.5 line-clamp-1 text-[15px] font-black leading-6 text-[#171c22]">{nextReviewTitle}</div>
                <div className="mt-1 text-xs text-[#5b6574]">{reviewQueueCount} 项资料和会话可继续回看</div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-[28px] border border-[#e8ecf1] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(["All", "Courses", "Handouts"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-4 py-2 text-xs font-extrabold transition-all ${
                  isActive
                    ? "bg-[var(--project-primary)] text-white shadow-sm"
                    : "bg-[var(--project-primary-soft)] text-[#564145] hover:bg-[var(--project-primary-soft-strong)]"
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            );
          })}
        </div>

        <div className="flex flex-grow flex-col gap-3 sm:flex-row lg:max-w-2xl">
          <div className="relative flex-grow">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索课程名、资料名或复习主题..."
              className="w-full rounded-xl border border-[#E3E8EC] bg-slate-50/70 px-3.5 py-2 pr-8 text-xs text-[#171c22] outline-none transition-all placeholder:text-slate-400 hover:bg-slate-50 focus:border-[var(--project-primary)] focus:bg-white"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E3E8EC] bg-slate-50 px-3.5 py-2 text-[11px] font-extrabold text-slate-700 transition-all hover:bg-slate-100"
          >
            <ListRestart className="h-3.5 w-3.5 text-[var(--project-primary)]" />
            重置筛选
          </button>

          <button
            type="button"
            onClick={() => void loadFavoriteHandouts("refresh")}
            disabled={refreshingFavorites}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E3E8EC] bg-slate-50 px-3.5 py-2 text-[11px] font-extrabold text-slate-700 transition-all hover:bg-slate-100 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[var(--project-primary)] ${refreshingFavorites ? "animate-spin" : ""}`} />
            刷新收藏
          </button>
        </div>
      </section>

      <section className="space-y-8">
        {(activeTab === "All" || activeTab === "Courses") && (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8a94a3]">课程收藏</div>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#171c22]">继续学习的主线课程</h2>
                <p className="mt-1 text-sm text-[#5b6574]">适合先恢复上下文，再决定接下来该回看哪些讲义和附件。</p>
              </div>
              <div className="rounded-full bg-[#f4f6f8] px-3 py-1 text-xs font-bold text-[#5b6574]">
                共 {filteredCourses.length} 门
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {filteredCourses.map((course) => (
                <div key={course.id}>
                  <CollectionCourseCard
                    course={course}
                    onOpen={() => navigate(`/learn?courseId=${course.id}`)}
                    onRemove={() => handleRemoveCourse(course.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

{(activeTab === "All" || activeTab === "Handouts") && (
          <div className="space-y-4">
            {filteredClassroomAssets.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8a94a3]">课堂生成收藏</div>
                    <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#171c22]">课堂里标星过的重点资料</h2>
                    <p className="mt-1 text-sm text-[#5b6574]">讲义、导图、练习和 PPT 会一起沉淀在这里，方便后续继续学习。</p>
                  </div>
                  <div className="rounded-full bg-[#f4f6f8] px-3 py-1 text-xs font-bold text-[#5b6574]">
                    共 {filteredClassroomAssets.length} 项
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {filteredClassroomAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className={`rounded-[24px] border p-4 shadow-[0_12px_32px_rgba(15,23,42,0.04)] ${
                        asset.itemType === "ppt"
                          ? getGeneratedResourceUiMeta("ppt").cardClass
                          : asset.kind
                            ? getGeneratedResourceUiMeta(asset.kind).cardClass
                            : "border-[#e8ecf1] bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                                asset.itemType === "ppt"
                                  ? getGeneratedResourceUiMeta("ppt").pillClass
                                  : asset.kind
                                    ? getGeneratedResourceUiMeta(asset.kind).pillClass
                                    : "bg-[var(--project-primary-soft)] text-[var(--project-primary)]"
                              }`}
                            >
                              <span className="inline-flex items-center gap-1">
                                <ClassroomAssetIcon asset={asset} />
                                {asset.kindLabel}
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#fff7ed] px-2.5 py-1 text-[10px] font-bold text-amber-700">
                              <Bookmark className="h-3 w-3 fill-current" />
                              已收藏
                            </span>
                          </div>
                          <h3 className="mt-2 text-[15px] font-black text-[#171c22]">{asset.title}</h3>
                          <p className="mt-1 text-[11px] font-semibold text-[#7b8794]">
                            {asset.sectionTitle} · {asset.generatedAt}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/learn?courseId=${asset.courseId}`)}
                          className="rounded-full bg-[#f8fbff] px-3 py-1.5 text-[10px] font-bold text-[#006689] transition hover:bg-[#eef6ff]"
                        >
                          回到课堂
                        </button>
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#6b7280]">{asset.summary}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenClassroomAsset(asset)}
                          className="inline-flex items-center gap-1 rounded-xl bg-[#111827] px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-[#1f2937]"
                        >
                          {asset.actionLabel}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/learn?courseId=${asset.courseId}`)}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#e5e7eb] bg-slate-50 px-4 py-2 text-xs font-extrabold text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          去原课堂
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {filteredTutorSessions.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8a94a3]">AI 导师收藏</div>
                    <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#171c22]">值得回看的问答会话</h2>
                    <p className="mt-1 text-sm text-[#5b6574]">这里会沉淀你标记过的重要 AI 导师会话，方便后续继续追问。</p>
                  </div>
                  <div className="rounded-full bg-[#f4f6f8] px-3 py-1 text-xs font-bold text-[#5b6574]">
                    共 {filteredTutorSessions.length} 条
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {filteredTutorSessions.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-[24px] border border-[#e8ecf1] bg-white p-4 text-left shadow-[0_12px_32px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.07)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#fff2f7] px-2.5 py-1 text-[10px] font-extrabold text-[#d64d7b]">
                              AI 会话
                            </span>
                            <span className="rounded-full bg-[#f4f6f8] px-2.5 py-1 text-[10px] font-bold text-[#7a8391]">
                              {session.courseTitle}
                            </span>
                          </div>
                          <h3 className="mt-2 text-[15px] font-black text-[#171c22]">{session.title}</h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#6b7280]">{session.preview}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRemoveTutorSession(session)}
                          disabled={removingTutorSessionId === session.id}
                          className="shrink-0 rounded-xl border border-[#edf1f5] p-2 text-slate-400 transition-colors hover:border-red-100 hover:text-red-500 disabled:opacity-60"
                          title="取消收藏"
                        >
                          {removingTutorSessionId === session.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setPreviewTutorSession(session)}
                          className="mr-2 inline-flex items-center gap-1 rounded-xl border border-[#e5e7eb] bg-slate-50 px-4 py-2 text-xs font-extrabold text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          预览会话
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenTutorSession(session)}
                          className="inline-flex items-center gap-1 rounded-xl bg-[#111827] px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-[#1f2937]"
                        >
                          继续追问
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8a94a3]">资料收藏</div>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#171c22]">快速复习与预览资料</h2>
                <p className="mt-1 text-sm text-[#5b6574]">适合临时回顾、章节巩固和考前冲刺时快速打开。</p>
              </div>
              <div className="rounded-full bg-[#f4f6f8] px-3 py-1 text-xs font-bold text-[#5b6574]">
                共 {filteredHandouts.length} 份
              </div>
            </div>

            <div className="space-y-3">
              {loadingHandouts ? (
                <div className="rounded-[24px] border border-[#e8ecf1] bg-white px-4 py-6 text-sm text-[#564145] shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                  正在加载资料收藏...
                </div>
              ) : null}

              {filteredHandouts.map((file) => (
                <div key={file.id}>
                  <CollectionHandoutRow
                    file={file}
                    removing={removingFavoriteId === file.id}
                    onOpen={() => handleOpenHandout(file)}
                    onRemove={() => void handleRemoveHandout(file.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {shouldShowEmpty ? (
          <CollectionEmptyState onReset={handleReset} onGoResources={() => navigate(buildResourcesRoute(readLastRouteCourseId()))} />
        ) : null}
      </section>

      {toastMessage ? (
        <div className="animate-in fade-in slide-in-from-bottom-5 fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#171c22]/95 px-5 py-3 text-xs font-bold text-white shadow-2xl duration-200">
          <span className="h-2 w-2 animate-ping rounded-full bg-[var(--project-primary)]" />
          <span>{toastMessage}</span>
        </div>
      ) : null}

      {previewTutorSession ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-[#e8ecf1] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#fff2f7] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#d64d7b]">
                  AI Session
                </div>
                <h3 className="mt-3 text-[22px] font-black tracking-[-0.04em] text-[#171c22]">{previewTutorSession.title}</h3>
                <p className="mt-2 text-sm text-[#5b6574]">{previewTutorSession.courseTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTutorSession(null)}
                className="rounded-full bg-[#f5f7fa] px-3 py-1.5 text-xs font-bold text-[#667085] transition hover:bg-[#eef2f6]"
              >
                关闭
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl border border-[#eef2f6] bg-[#fafbfd] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a94a3]">你的提问</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#171c22]">
                  {previewTutorSession.questionText || previewTutorSession.preview || "当前没有更多问题正文。"}
                </p>
              </div>
              <div className="rounded-2xl border border-[#eef2f6] bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a94a3]">AI 回答</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#5b6574]">
                  {previewTutorSession.answerText || "当前缓存里还没有这轮回答全文，继续追问后会补齐。"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setPreviewTutorSession(null);
                  handleOpenTutorSession(previewTutorSession);
                }}
                className="inline-flex items-center gap-1 rounded-xl bg-[#111827] px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-[#1f2937]"
              >
                继续追问
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
