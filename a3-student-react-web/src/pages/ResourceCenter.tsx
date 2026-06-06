/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Search,
  User,
} from "lucide-react";
import {
  ACTIVE_COURSE_ID,
  ACTIVE_USER_ID,
  buildResourcePreviewRoute,
  resolveCourseIdFromSearchParams,
} from "../lib/courseContext";
import { studentApi, type ResourceCard, type ResourceSourceFileRef } from "../lib/studentApi";

type ResourceTab = "All" | "Lecture Slides" | "Notes" | "Videos";

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
  rawResource?: ResourceCard;
};

function inferSyntheticFileExtension(file: UiFile) {
  if (file.type === "pdf") {
    return ".pdf";
  }
  if (file.type === "image") {
    return ".png";
  }
  if (file.type === "video") {
    return ".mp4";
  }
  return ".md";
}

function inferSyntheticMimeType(file: UiFile) {
  if (file.type === "pdf") {
    return "application/pdf";
  }
  if (file.type === "image") {
    return "image/png";
  }
  if (file.type === "video") {
    return "video/mp4";
  }
  return "text/markdown";
}

function buildInitialPreviewFile(resGroup: UiResourceGroup, file: UiFile) {
  const previewUrl = file.openUrl || (file.previewUrl?.startsWith("/") || /^https?:\/\//i.test(file.previewUrl || "") ? file.previewUrl : null);
  return {
    file_id: -1,
    display_name: file.name,
    relative_path: file.openUrl || file.previewUrl || file.name,
    top_level_category: resGroup.category,
    file_extension: inferSyntheticFileExtension(file),
    mime_type: inferSyntheticMimeType(file),
    file_size: null,
    preview_text: previewUrl ? file.excerpt || resGroup.summary || null : file.previewUrl || file.excerpt || resGroup.summary || null,
    is_inline_previewable: true,
    preview_mode: file.type === "text" ? "text" : file.type,
    preview_url: previewUrl,
    open_url: previewUrl || "",
  };
}

function mapResourceTypeToCategory(resourceType: string) {
  if (resourceType === "video") {
    return "Videos";
  }
  if (["lecture_note", "course_overview", "mindmap", "teaching_plan", "assessment_guide"].includes(resourceType)) {
    return "Lecture Slides";
  }
  return "Notes";
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
  const extension = file.file_extension.toLowerCase();
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
    return "PDF Document";
  }
  if (file.mime_type?.startsWith("image/")) {
    return "PNG Graphic";
  }
  return `${file.file_extension.replace(/^\./, "").toUpperCase() || "Text"} File`;
}

function mapApiResourcesToUi(items: ResourceCard[], courseId: string): UiResourceGroup[] {
  return items.map((item) => {
    const files = (item.source_files || []).map((file) => ({
      fileId: String(file.file_id),
      name: file.display_name,
      type: mapFileType(file),
      format: mapMimeToFormat(file),
      size: formatFileSize(file.file_size),
      uploadedDate: "最新",
      excerpt: file.preview_text || item.summary,
      previewUrl: file.preview_url || file.preview_text || item.content_markdown,
      studyAdvice: item.study_suggestion || undefined,
      openUrl: file.open_url,
    }));

    if (files.length === 0) {
      files.push({
        fileId: `resource-${item.resource_id || item.title}`,
        name: `${item.title}.md`,
        type: "text",
        format: "Plain Text Document",
        size: "Generated",
        uploadedDate: "最新",
        excerpt: item.summary,
        previewUrl: item.content_markdown,
        studyAdvice: item.study_suggestion || undefined,
        openUrl: "",
      });
    }

    return {
      resourceId: String(item.resource_id || item.title),
      courseId,
      title: item.title,
      category: mapResourceTypeToCategory(item.resource_type),
      uploader: "A3 Resource Engine",
      updatedAt: "最新",
      downloads: 0,
      files,
      summary: item.summary,
      rawResource: item,
    };
  });
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
  const fileId = Number(file.fileId);
  if (!Number.isFinite(fileId)) {
    return null;
  }
  return `/resources/preview?courseId=${courseId}&fileId=${fileId}`;
}

export default function ResourceCenter() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = resolveCourseIdFromSearchParams(searchParams, ACTIVE_COURSE_ID);
  const focusedResourceId = searchParams.get("resourceId");
  const searchParamText = searchParams.get("search") || "";

  const [activeTab, setActiveTab] = useState<ResourceTab>("All");
  const [searchQuery, setSearchQuery] = useState(searchParamText);
  const [activeCourseContext, setActiveCourseContext] = useState(courseId);
  const [resourceGroups, setResourceGroups] = useState<UiResourceGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasAutoFocusedRef = useRef(false);

  useEffect(() => {
    setActiveCourseContext(courseId);
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;

    async function loadResources() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const response = await studentApi.listResources(ACTIVE_USER_ID, activeCourseContext);
        if (cancelled) {
          return;
        }
        setResourceGroups(mapApiResourcesToUi(response.items, String(activeCourseContext)));
      } catch (error) {
        if (cancelled) {
          return;
        }
        setResourceGroups([]);
        setLoadError(error instanceof Error ? error.message : "资源加载失败");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadResources();
    return () => {
      cancelled = true;
    };
  }, [activeCourseContext]);

  const filteredResources = useMemo(() => {
    const filtered = resourceGroups.filter((group) => {
        const matchesTab = activeTab === "All" || group.category === activeTab;
        const matchesSearch =
          group.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (group.summary || "").toLowerCase().includes(searchQuery.toLowerCase());
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

  const handleOpenPreview = (resGroup: UiResourceGroup, fileId: string) => {
    const numericFileId = Number(fileId);
    const selectedFile = resGroup.files.find((item) => item.fileId === fileId);
    const courseVideoTarget = buildCourseVideoTarget(resGroup.courseId, selectedFile);
    if (courseVideoTarget) {
      navigate(courseVideoTarget);
      return;
    }
    navigate(buildResourcePreviewRoute(Number(resGroup.courseId), { resourceId: resGroup.resourceId, fileId }), {
      state: {
        initialResource: resGroup.rawResource || null,
        initialFileId: Number.isFinite(numericFileId) ? numericFileId : null,
        initialPreviewFile: selectedFile ? buildInitialPreviewFile(resGroup, selectedFile) : null,
      },
    });
  };

  return (
    <div className="space-y-6 select-none" id="resource-center-workspace">
      <section className="bg-gradient-to-r from-[#ffd9e0]/40 via-[#f0f4fc]/30 to-white rounded-3xl border border-[#E3E8EC] p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
        <div className="space-y-2">
          <span className="text-[10px] tracking-[0.24em] font-extrabold text-[#fb7299]">
            课程资源中枢
          </span>
          <h1 className="font-sans text-2xl lg:text-3xl font-extrabold text-[#171c22]">
            备课资料与学术讲义下载
          </h1>
          <p className="text-sm text-[#564145] font-sans max-w-2xl">
            这里集中展示课程讲义、实践笔记与站内视频资源。系统会优先读取后端资源，并结合当前学习进度，为你整理更适合当前阶段的资料入口。
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-[#F1F2F3] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#564145]/70">当前课程</p>
          <p className="mt-1 text-sm font-extrabold text-[#171c22]">软件工程与实践（第4版）</p>
        </div>
      </section>

      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-3xl border border-[#E3E8EC]">
        <div className="flex flex-wrap gap-2">
          {[
            { label: "全部资源", value: "All" },
            { label: "讲义资料", value: "Lecture Slides" },
            { label: "实践笔记", value: "Notes" },
            { label: "视频资源", value: "Videos" },
          ].map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value as ResourceTab)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive ? "bg-[#006689] text-white shadow" : "bg-[#eaeef6]/45 text-[#564145] hover:bg-[#eaeef6]/80"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#564145]" />
          <input
            id="resource-filter-input"
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索资源标题..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#F1F2F3] border-none rounded-xl text-xs focus:ring-1 focus:ring-[#fb7299] text-[#171c22] outline-none"
          />
        </div>
      </section>

      {loadError && !isLoading ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          后端资源暂时不可用：{loadError}
        </section>
      ) : null}

      {isLoading ? (
        <section className="bg-white rounded-3xl p-12 text-center border border-[#E3E8EC]">
          <p className="text-sm font-bold text-[#171c22]">正在加载资源...</p>
        </section>
      ) : null}

      {!isLoading && filteredResources.length > 0 ? (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredResources.map((groupedItem) => {
            const isFocusedResource = groupedItem.resourceId === focusedResourceId;
            const categoryZh =
              groupedItem.category === "Lecture Slides"
                ? "讲义资料"
                : groupedItem.category === "Videos"
                  ? "视频资源"
                  : "实践笔记";

            return (
              <div
                id={`resource-binder-grid-${groupedItem.resourceId}`}
                key={groupedItem.resourceId}
                className={`bg-white rounded-3xl p-6 transition-all flex flex-col justify-between gap-5 group ${
                  isFocusedResource
                    ? "border-[#fb7299]/45 shadow-[0_18px_48px_rgba(251,114,153,0.16)] ring-1 ring-[#fb7299]/18"
                    : "border border-[#E3E8EC] shadow-sm hover:shadow-lg"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="bg-[#fb7299]/15 text-[#fb7299] text-[9px] font-extrabold px-2.5 py-0.5 rounded-sm uppercase font-mono tracking-wide">
                      {categoryZh}
                    </span>
                    <div className="flex items-center gap-2">
                      {isFocusedResource ? (
                        <span className="rounded-full bg-[#006689]/10 px-2 py-0.5 text-[9px] font-extrabold tracking-[0.18em] text-[#006689]">
                          当前查看
                        </span>
                      ) : null}
                      <span className="text-[10px] text-[#564145]/75 font-mono">
                        资源文件 {groupedItem.files.length}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-sans text-base font-extrabold text-[#171c22] leading-snug group-hover:text-[#fb7299] transition-colors">
                    {groupedItem.title}
                  </h3>
                  <p className="text-xs text-[#564145] leading-relaxed font-sans mt-1">
                    {groupedItem.summary || "暂无摘要"}
                  </p>
                </div>

                <div className="space-y-2.5 border-t border-gray-50 pt-4">
                  <p className="text-[10px] uppercase tracking-wider font-extrabold text-[#564145]/80 mb-2">
                    资源文件 ({groupedItem.files.length})
                  </p>

                  {groupedItem.files.map((fileObj) => {
                    const isVideo = fileObj.type === "video";
                    const courseVideoTarget = isVideo ? buildCourseVideoTarget(groupedItem.courseId, fileObj) : null;
                    const rowClassName =
                      "flex items-center justify-between p-3 bg-[#eaeef6]/20 hover:bg-[#eaeef6]/40 border border-[#eaeef6]/40 rounded-2xl transition-all text-[#171c22]";
                    const fileMeta = (
                      <>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0">
                            {fileObj.type === "pdf" ? (
                              <LayoutGrid className="w-4 h-4 text-red-500" />
                            ) : fileObj.type === "text" ? (
                              <FileText className="w-4 h-4 text-[#006689]" />
                            ) : (
                              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate pr-3">{fileObj.name}</p>
                            <p className="text-[9px] font-mono text-[#564145]/70 mt-0.5">
                              {fileObj.format} · {fileObj.size}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <span
                            className={
                              courseVideoTarget
                                ? "inline-flex items-center gap-0.5 rounded-xl bg-[#006689] px-3 py-2 text-xs font-bold font-sans text-white transition-colors hover:bg-[#005570]"
                                : "inline-flex items-center gap-0.5 rounded-xl px-3 py-2 text-xs font-bold font-sans text-[#006689] transition-colors hover:bg-[#e8f4f8]"
                            }
                          >
                            <span>{courseVideoTarget ? "进入课堂" : "进入预览"}</span>
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
                        onClick={() => handleOpenPreview(groupedItem, fileObj.fileId)}
                        className={`${rowClassName} w-full text-left`}
                      >
                        {fileMeta}
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-gray-100 pt-3 flex justify-between items-center text-[10px] text-[#564145]/70 font-sans">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-[#fb7299]" />
                    提供者：<strong className="text-[#171c22] font-semibold">{groupedItem.uploader}</strong>
                  </span>
                  <span>{groupedItem.updatedAt}</span>
                </div>
              </div>
            );
          })}
        </section>
      ) : !isLoading ? (
        <section className="bg-white rounded-3xl p-12 text-center border border-[#E3E8EC]">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-[#171c22]">当前没有可用资源。</p>
          <p className="mt-2 text-xs text-[#564145]">
            {loadError ? "请先检查后端资源接口或数据库数据。" : "数据库里暂时还没有这门课对应的讲义、笔记或视频资源。"}
          </p>
          <button
            onClick={() => {
              setActiveTab("All");
              setSearchQuery("");
            }}
            className="text-xs font-bold text-[#fb7299] hover:underline mt-2 cursor-pointer"
          >
            重置筛选
          </button>
        </section>
      ) : null}
    </div>
  );
}

