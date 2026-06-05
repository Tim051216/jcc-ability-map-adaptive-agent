import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpenText,
  ExternalLink,
  Eye,
  FileBadge2,
  FileText,
  Film,
  FolderKanban,
  Image as ImageIcon,
  LayoutTemplate,
  LoaderCircle,
  MonitorPlay,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { ACTIVE_COURSE_ID, buildResourcesRoute, resolveCourseId } from "../lib/courseContext";
import { studentApi, type ResourceCard, type ResourceSourceFileRef } from "../lib/studentApi";

const DEFAULT_COURSE_ID = String(ACTIVE_COURSE_ID);
const UNCATEGORIZED_LABEL = "未分组资料";

type ResourcePreviewRouteState = {
  initialResource?: ResourceCard | null;
  initialFileId?: number | null;
  initialPreviewFile?: ResourceSourceFileRef | null;
};

function getCourseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(resolveCourseId(params.get("courseId"), ACTIVE_COURSE_ID));
}

function getResourceIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("resourceId");
}

function getSourceFileIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("fileId");
}

function setSourceFileIdInUrl(fileId?: string | number | null, options?: { push?: boolean }) {
  const url = new URL(window.location.href);
  if (fileId) {
    url.searchParams.set("fileId", String(fileId));
  } else {
    url.searchParams.delete("fileId");
  }
  const nextUrl = `${url.pathname}${url.search}`;
  if (options?.push) {
    window.history.pushState({ ...(window.history.state || {}), fileId: fileId ?? null }, "", nextUrl);
    return;
  }
  window.history.replaceState({ ...(window.history.state || {}), fileId: fileId ?? null }, "", nextUrl);
}

function buildFallbackSourceFile(fileId: number): ResourceSourceFileRef {
  const previewPath = `/api/v1/resource/source-files/${fileId}/preview`;
  return {
    file_id: fileId,
    display_name: `Source file #${fileId}`,
    relative_path: previewPath,
    top_level_category: UNCATEGORIZED_LABEL,
    file_extension: ".pdf",
    mime_type: "application/pdf",
    file_size: null,
    preview_text: null,
    is_inline_previewable: false,
    preview_mode: "pdf",
    preview_url: previewPath,
    open_url: previewPath,
  };
}

function resolveAssetUrl(path?: string | null) {
  if (!path) {
    return "";
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return studentApi.buildResourceSourceFileUrl(path);
}

function getSourceFilePreviewMode(file: ResourceSourceFileRef) {
  if (file.preview_mode) {
    return file.preview_mode;
  }
  const extension = file.file_extension.toLowerCase();
  const mimeType = (file.mime_type || "").toLowerCase();

  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("video/") || [".m3u8", ".mp4", ".mov", ".webm"].includes(extension)) {
    return "video";
  }
  if (extension === ".pdf" || mimeType === "application/pdf") {
    return "pdf";
  }
  if (extension === ".md" || extension === ".txt" || mimeType.startsWith("text/")) {
    return "text";
  }
  if (file.preview_text) {
    return "snippet";
  }
  if (file.is_inline_previewable) {
    return "embed";
  }
  return "unsupported";
}

function getResourceTypeLabel(type?: string | null) {
  const map: Record<string, string> = {
    video: "视频资源",
    course_video: "课程视频",
    demo_video: "演示视频",
    document: "课程文档",
    pdf: "PDF 资料",
    lecture_note: "讲义资料",
    lecture_notes: "讲义资料",
    mind_map: "知识图谱",
    mindmap: "知识图谱",
    quiz_set: "练习题",
    practice_set: "实践题包",
    extended_reading: "拓展阅读",
    coding_lab: "编码实验",
    case_study: "案例分析",
    assessment_guide: "考核说明",
    teaching_plan: "教学组织",
    course_overview: "课程总览",
  };
  return map[type || ""] || "课程资料";
}

function getCategoryLabel(label?: string | null) {
  if (!label) {
    return UNCATEGORIZED_LABEL;
  }
  return label.trim() || UNCATEGORIZED_LABEL;
}

function formatFileSize(fileSize?: number | null) {
  if (!fileSize || fileSize <= 0) {
    return "大小未知";
  }
  if (fileSize >= 1024 * 1024) {
    return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (fileSize >= 1024) {
    return `${Math.round(fileSize / 1024)} KB`;
  }
  return `${fileSize} B`;
}

function getFileKindLabel(file?: ResourceSourceFileRef | null) {
  if (!file) {
    return "文件";
  }
  const mode = getSourceFilePreviewMode(file);
  if (mode === "video") return "视频";
  if (mode === "image") return "图片";
  if (mode === "pdf" || mode === "office-pdf") return "文档";
  if (mode === "html" || mode === "embed") return "课件";
  if (mode === "text" || mode === "snippet") return "文本";
  return file.file_extension.replace(".", "").toUpperCase() || "文件";
}

function getFileIcon(file?: ResourceSourceFileRef | null) {
  const mode = file ? getSourceFilePreviewMode(file) : "unsupported";
  if (mode === "video") return Film;
  if (mode === "image") return ImageIcon;
  if (mode === "html" || mode === "embed") return LayoutTemplate;
  if (mode === "pdf" || mode === "office-pdf") return FileBadge2;
  return FileText;
}

function extractOutline(markdown?: string | null) {
  if (!markdown) {
    return [];
  }
  return markdown
    .split(/\r?\n/)
    .map((line) => line.replace(/^#{1,6}\s*/, "").replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function buildPreviewTitle(file?: ResourceSourceFileRef | null) {
  if (!file) {
    return "等待文件加载";
  }
  const mode = getSourceFilePreviewMode(file);
  if (mode === "video") return "站内视频预览";
  if (mode === "image") return "图片资料预览";
  if (mode === "html" || mode === "embed") return "Office 转换预览";
  if (mode === "pdf" || mode === "office-pdf") return "文档阅读视图";
  if (mode === "text" || mode === "snippet") return "文本精读视图";
  return "原始文件预览";
}

function PreviewShell({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-[#e4e9ef] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1f5] bg-[linear-gradient(180deg,#fbfdff_0%,#f7faff_100%)] px-5 py-4">
        <div>
          <h3 className="text-sm font-black tracking-[0.18em] text-[#006689]">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="bg-[#f7f9fc] p-4 md:p-5">{children}</div>
    </section>
  );
}

function LoadingBlock({ title }: { title: string }) {
  return (
    <div className="flex min-h-[64vh] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#d8e0ea] bg-white text-slate-500">
      <LoaderCircle className="h-8 w-8 animate-spin text-[#006689]" />
      <div className="mt-4 text-sm font-semibold">{title}</div>
    </div>
  );
}

function EmptyBlock({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[64vh] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#d8e0ea] bg-white px-6 text-center">
      <MonitorPlay className="h-9 w-9 text-[#9fb2c7]" />
      <div className="mt-4 text-base font-black text-slate-800">{title}</div>
      <div className="mt-2 max-w-xl text-sm leading-7 text-slate-500">{description}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function VideoPanel({ file }: { file: ResourceSourceFileRef }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewUrl = resolveAssetUrl(file.preview_url || file.open_url);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    element.pause();
    element.src = previewUrl;
    element.load();
    return () => {
      element.pause();
    };
  }, [previewUrl]);

  return (
    <div className="overflow-hidden rounded-[26px] bg-[#0d1524] p-3 shadow-[0_18px_44px_rgba(15,23,42,0.2)]">
      <video ref={videoRef} controls preload="metadata" playsInline className="h-[72vh] w-full rounded-[20px] bg-black object-contain" />
    </div>
  );
}

export default function ResourceSourcePreview() {
  const location = useLocation();
  const routeState = (location.state || {}) as ResourcePreviewRouteState;
  const courseId = useMemo(() => getCourseIdFromUrl(), []);
  const resourceId = useMemo(() => getResourceIdFromUrl(), []);
  const rawSourceFileId = useMemo(() => getSourceFileIdFromUrl(), []);
  const numericSourceFileId = useMemo(() => {
    const parsed = Number(rawSourceFileId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [rawSourceFileId]);

  const [resource, setResource] = useState<ResourceCard | null>(routeState.initialResource || null);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(() => numericSourceFileId || routeState.initialFileId || null);
  const [loading, setLoading] = useState(!routeState.initialResource);
  const [error, setError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [documentFrameLoaded, setDocumentFrameLoaded] = useState(false);
  const [documentFrameError, setDocumentFrameError] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      const value = getSourceFileIdFromUrl();
      const parsed = Number(value);
      setSelectedFileId(Number.isFinite(parsed) ? parsed : null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!resourceId) {
      setError("缺少资源编号，暂时无法打开这份资料。");
      setLoading(false);
      return;
    }

    const numericResourceId = Number(resourceId);
    if (!Number.isFinite(numericResourceId)) {
      setError("当前资源编号无效，无法加载详情。");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    studentApi
      .getResource(numericResourceId)
      .then((detail) => {
        if (cancelled) {
          return;
        }
        setResource(detail);
        const nextFileId = numericSourceFileId || routeState.initialFileId || detail.source_files?.[0]?.file_id || null;
        setSelectedFileId(nextFileId);
        if (nextFileId) {
          setSourceFileIdInUrl(nextFileId);
        }
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "资源预览加载失败。");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [numericSourceFileId, resourceId, routeState.initialFileId]);

  const fallbackSelectedFile =
    !resource?.source_files?.length && selectedFileId ? buildFallbackSourceFile(selectedFileId) : routeState.initialPreviewFile || null;

  const selectedFile =
    resource?.source_files?.find((item) => item.file_id === selectedFileId) ||
    resource?.source_files?.[0] ||
    fallbackSelectedFile ||
    null;

  const groupedFiles = useMemo(() => {
    const groups = new Map<string, ResourceSourceFileRef[]>();
    for (const file of resource?.source_files || []) {
      const key = getCategoryLabel(file.top_level_category);
      const existing = groups.get(key);
      if (existing) {
        existing.push(file);
      } else {
        groups.set(key, [file]);
      }
    }
    return Array.from(groups.entries()).map(([category, files]) => ({ category, files }));
  }, [resource]);

  const outlineItems = useMemo(() => extractOutline(resource?.content_markdown), [resource?.content_markdown]);
  const selectedMode = selectedFile ? getSourceFilePreviewMode(selectedFile) : "unsupported";
  const previewTitle = buildPreviewTitle(selectedFile);
  const previewOpenUrl = selectedFile ? resolveAssetUrl(selectedFile.open_url) : "";
  const previewFetchUrl = selectedFile ? resolveAssetUrl(selectedFile.preview_url || selectedFile.open_url) : "";

  useEffect(() => {
    if (!selectedFile) {
      setTextContent(null);
      setTextLoading(false);
      setTextError(null);
      return;
    }

    if (!["text", "snippet"].includes(selectedMode)) {
      setTextContent(null);
      setTextLoading(false);
      setTextError(null);
      return;
    }

    if (selectedFile.preview_text && selectedMode === "snippet") {
      setTextContent(selectedFile.preview_text);
      setTextLoading(false);
      setTextError(null);
      return;
    }

    const controller = new AbortController();
    setTextLoading(true);
    setTextError(null);

    fetch(previewFetchUrl, {
      ...studentApi.buildResourceFileFetchInit(selectedFile.preview_url || selectedFile.open_url),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
      })
      .then((text) => setTextContent(text))
      .catch((loadError) => {
        if (controller.signal.aborted) {
          return;
        }
        setTextError(loadError instanceof Error ? loadError.message : "文本预览加载失败");
        setTextContent(selectedFile.preview_text || null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setTextLoading(false);
        }
      });

    return () => controller.abort();
  }, [previewFetchUrl, selectedFile, selectedMode]);

  useEffect(() => {
    setDocumentFrameLoaded(false);
    setDocumentFrameError(false);
  }, [previewFetchUrl, selectedFile?.file_id, selectedMode]);

  useEffect(() => {
    if (!selectedFile || !["pdf", "office-pdf", "html", "embed"].includes(selectedMode)) {
      return;
    }
    if (documentFrameLoaded || documentFrameError) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDocumentFrameLoaded(true);
      setDocumentFrameError(true);
    }, 10000);

    return () => window.clearTimeout(timeoutId);
  }, [documentFrameError, documentFrameLoaded, selectedFile, selectedMode]);

  function openFilePreview(file: ResourceSourceFileRef) {
    setSelectedFileId(file.file_id);
    setSourceFileIdInUrl(file.file_id, { push: true });
  }

  function renderPreviewBody() {
    if (!selectedFile) {
      return (
        <EmptyBlock
          title="当前资源暂无可预览文件"
          description="这份资料已经有资源卡片，但当前没有读取到具体文件。你可以先返回资源中心，或稍后再尝试。"
        />
      );
    }

    if (selectedMode === "video") {
      return <VideoPanel file={selectedFile} />;
    }

    if (selectedMode === "image") {
      return (
        <div className="overflow-hidden rounded-[26px] border border-[#e4e9ef] bg-white p-3">
          <img src={previewFetchUrl} alt={selectedFile.display_name} className="max-h-[72vh] w-full rounded-[20px] object-contain bg-[#f8fafc]" />
        </div>
      );
    }

    if (["pdf", "office-pdf", "html", "embed"].includes(selectedMode)) {
      if (documentFrameError) {
        return (
          <EmptyBlock
            title="暂时无法页内打开这份文档"
            description="当前文件的在线预览地址未能正常响应，但原始文件入口仍然可用。你可以先打开原文件，或稍后刷新重试。"
            action={
              <a
                href={previewOpenUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#006689] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#005570]"
              >
                <ExternalLink className="h-4 w-4" />
                打开原文件
              </a>
            }
          />
        );
      }
      return (
        <div className="relative overflow-hidden rounded-[26px] border border-[#e4e9ef] bg-white">
          {!documentFrameLoaded ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[linear-gradient(180deg,rgba(247,249,252,0.96)_0%,rgba(247,249,252,0.88)_100%)]">
              <div className="flex items-center gap-3 rounded-full border border-[#d9e8fb] bg-white px-4 py-2 text-sm font-semibold text-[#006689] shadow-sm">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                正在加载文档预览...
              </div>
            </div>
          ) : null}
          <iframe
            title={selectedFile.display_name}
            src={previewFetchUrl}
            className="h-[74vh] w-full bg-white"
            onLoad={() => setDocumentFrameLoaded(true)}
            onError={() => {
              setDocumentFrameLoaded(true);
              setDocumentFrameError(true);
            }}
          />
        </div>
      );
    }

    if (["text", "snippet"].includes(selectedMode)) {
      if (textLoading) {
        return <LoadingBlock title="正在加载文本内容..." />;
      }
      return (
        <div className="overflow-hidden rounded-[26px] border border-[#e4e9ef] bg-white">
          <pre className="max-h-[74vh] overflow-auto whitespace-pre-wrap px-6 py-6 font-mono text-[13px] leading-7 text-slate-700">
            {textContent || textError || "当前文件暂无可读取文本内容。"}
          </pre>
        </div>
      );
    }

    return (
      <EmptyBlock
        title="当前格式不适合页内预览"
        description="这份文件已经接入资源中心，但浏览器不适合直接渲染。你仍然可以打开原文件查看完整内容。"
        action={
          <a
            href={previewOpenUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#006689] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#005570]"
          >
            <ExternalLink className="h-4 w-4" />
            打开原文件
          </a>
        }
      />
    );
  }

  const backUrl = buildResourcesRoute(Number(courseId), resourceId ? { resourceId } : undefined);
  const SelectedIcon = getFileIcon(selectedFile);

  if (loading && !resource && !selectedFile) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-10 md:px-8">
        <LoadingBlock title="正在载入资源工作台..." />
      </div>
    );
  }

  if ((!resource && !selectedFile) || (error && !resource && !selectedFile)) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-10 md:px-8">
        <EmptyBlock
          title="这份资料暂时打不开"
          description={error || "资源详情没有成功返回，请稍后重试。"}
          action={
            <Link
              to={backUrl}
              className="inline-flex items-center gap-2 rounded-full bg-[#006689] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#005570]"
            >
              <ArrowLeft className="h-4 w-4" />
              返回资源中心
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,114,153,0.10),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(0,102,137,0.10),_transparent_28%),linear-gradient(180deg,#fbfcfe_0%,#f4f7fb_46%,#f8fafc_100%)]">
      <div className="mx-auto max-w-[1520px] space-y-6 px-4 pb-12 pt-5 md:px-8 xl:px-10">
        <section className="overflow-hidden rounded-[34px] border border-[#e4e9ef] bg-white shadow-[0_24px_72px_rgba(15,23,42,0.08)]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="px-6 py-6 md:px-8 md:py-8">
              <Link to={backUrl} className="inline-flex items-center gap-2 text-sm font-bold text-[#006689] transition-colors hover:text-[#005570]">
                <ArrowLeft className="h-4 w-4" />
                返回资源中心
              </Link>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#ffe8f1] px-3 py-1 text-[11px] font-black tracking-[0.18em] text-[#fb7299]">
                  {getResourceTypeLabel(resource?.resource_type)}
                </span>
                <span className="rounded-full border border-[#dce7f2] bg-[#f8fbff] px-3 py-1 text-[11px] font-semibold text-[#006689]">
                  资源预览工作台
                </span>
              </div>
              <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-slate-900 md:text-[38px]">
                {resource?.title || "课程资料预览"}
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-8 text-slate-600 md:text-[15px]">
                {resource?.summary || "这里会优先展示原始资料的可读预览，并保持与站内整体学习体验一致。"}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-[#f2d7e3] bg-[#fff6fa] p-4">
                  <div className="text-[11px] font-black tracking-[0.18em] text-[#fb7299]">文件总数</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">
                    {resource?.source_file_count || resource?.source_files?.length || 0}
                  </div>
                  <div className="mt-2 text-xs leading-6 text-slate-500">这份资源下已接入的原始文件数量</div>
                </div>
                <div className="rounded-[24px] border border-[#d9e8fb] bg-[#f4f9ff] p-4">
                  <div className="text-[11px] font-black tracking-[0.18em] text-[#006689]">目录分组</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">{groupedFiles.length || 0}</div>
                  <div className="mt-2 text-xs leading-6 text-slate-500">按课程目录聚合后的资料分区</div>
                </div>
                <div className="rounded-[24px] border border-[#e8e1fb] bg-[#f9f7ff] p-4">
                  <div className="text-[11px] font-black tracking-[0.18em] text-[#7c3aed]">当前文件</div>
                  <div className="mt-2 text-lg font-black text-slate-900">{getFileKindLabel(selectedFile)}</div>
                  <div className="mt-2 text-xs leading-6 text-slate-500">会按文件类型自动切换最佳预览方式</div>
                </div>
              </div>
            </div>

            <aside className="border-t border-[#edf1f5] bg-[linear-gradient(180deg,#0f1b2e_0%,#16243b_100%)] px-6 py-6 text-white xl:border-l xl:border-t-0">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  <Sparkles className="h-6 w-6 text-[#ffd1df]" />
                </div>
                <div>
                  <div className="text-[11px] font-black tracking-[0.2em] text-[#ffd1df]">阅读上下文</div>
                  <div className="mt-1 text-lg font-black">先理解这份资料适合怎么用</div>
                </div>
              </div>

              <div className="mt-6 rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                    <SelectedIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">{selectedFile?.display_name || "等待文件载入"}</div>
                    <div className="mt-1 text-xs text-white/60">{selectedFile ? getFileKindLabel(selectedFile) : "文件类型识别中"}</div>
                  </div>
                </div>

                <div className="mt-4 text-sm leading-7 text-white/78">
                  {resource?.study_suggestion || "建议先快速浏览导读，再切到右侧文件目录按需精读，会更适合当前课堂学习路径。"}
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                    <div className="text-[11px] font-bold text-white/56">当前预览方式</div>
                    <div className="mt-1 text-sm text-white">{previewTitle}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
                    <div className="text-[11px] font-bold text-white/56">文件路径</div>
                    <div className="mt-1 break-all text-sm text-white/90">{selectedFile?.relative_path || "等待载入"}</div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {error ? (
          <section className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            当前资源详情加载时出现提示：{error}
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-6">
            <PreviewShell
              title={previewTitle}
              description={selectedFile ? `${selectedFile.display_name} · ${formatFileSize(selectedFile.file_size)}` : "请选择一个可预览文件"}
              action={
                selectedFile ? (
                  <a
                    href={previewOpenUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-[#006689] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#005570]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    打开原文件
                  </a>
                ) : null
              }
            >
              {renderPreviewBody()}
            </PreviewShell>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
              <div className="rounded-[30px] border border-[#e4e9ef] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <BookOpenText className="h-4 w-4 text-[#fb7299]" />
                  学习建议
                </div>
                <p className="mt-4 text-sm leading-8 text-slate-600">
                  {resource?.study_suggestion || "建议先看资料总览，再进入具体文件进行精读和比对。"}
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[22px] border border-[#f2d7e3] bg-[#fff7fa] p-4">
                    <div className="text-[11px] font-black tracking-[0.16em] text-[#fb7299]">适合场景</div>
                    <div className="mt-2 text-sm leading-7 text-slate-600">备课导览、章节预热、课堂回看、资料核对。</div>
                  </div>
                  <div className="rounded-[22px] border border-[#d9e8fb] bg-[#f4f9ff] p-4">
                    <div className="text-[11px] font-black tracking-[0.16em] text-[#006689]">预览策略</div>
                    <div className="mt-2 text-sm leading-7 text-slate-600">Office 自动转预览，文本直读，视频页内播放，异常时保留原文件入口。</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-[#e4e9ef] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <Eye className="h-4 w-4 text-[#006689]" />
                  资料提纲
                </div>
                <div className="mt-4 space-y-2">
                  {outlineItems.length ? (
                    outlineItems.map((item, index) => (
                      <div key={`${item}-${index}`} className="rounded-2xl border border-[#eef2f6] bg-[#fafcff] px-4 py-3 text-sm leading-7 text-slate-600">
                        {item}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#d8e0ea] bg-[#fafcff] px-4 py-4 text-sm text-slate-500">
                      当前资源没有可抽取的章节提纲，建议直接查看右侧原始文件目录。
                    </div>
                  )}
                </div>
              </div>
            </section>
          </main>

          <aside className="space-y-6">
            <section className="rounded-[30px] border border-[#e4e9ef] bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <FolderKanban className="h-4 w-4 text-[#006689]" />
                  文件目录
                </div>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-1 rounded-full border border-[#dce7f2] bg-[#f8fbff] px-3 py-1.5 text-[11px] font-bold text-[#006689] transition-colors hover:bg-[#eef6fb]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  刷新
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {groupedFiles.length ? (
                  groupedFiles.map((group) => (
                    <div key={group.category} className="rounded-[24px] border border-[#eef2f6] bg-[#fbfcfe] p-3">
                      <div className="px-2 pb-2 text-[11px] font-black tracking-[0.16em] text-[#006689]">{group.category}</div>
                      <div className="space-y-2">
                        {group.files.map((file) => {
                          const active = file.file_id === selectedFile?.file_id;
                          const Icon = getFileIcon(file);
                          return (
                            <button
                              key={file.file_id}
                              type="button"
                              onClick={() => openFilePreview(file)}
                              className={`w-full rounded-[18px] border px-3 py-3 text-left transition-all ${
                                active
                                  ? "border-[#fb7299]/40 bg-[#fff5f8] shadow-[0_10px_24px_rgba(251,114,153,0.10)]"
                                  : "border-transparent bg-white hover:border-[#d9e8fb] hover:bg-[#f8fbff]"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                                    active ? "bg-[#fb7299]/12 text-[#fb7299]" : "bg-[#eef5fb] text-[#006689]"
                                  }`}
                                >
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className={`truncate text-sm font-bold ${active ? "text-[#c25179]" : "text-slate-800"}`}>
                                    {file.display_name}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                    <span>{getFileKindLabel(file)}</span>
                                    <span>·</span>
                                    <span>{formatFileSize(file.file_size)}</span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[22px] border border-dashed border-[#d8e0ea] bg-[#fafcff] px-4 py-5 text-sm text-slate-500">
                    当前资源目录还没有同步出可用文件。
                  </div>
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}
