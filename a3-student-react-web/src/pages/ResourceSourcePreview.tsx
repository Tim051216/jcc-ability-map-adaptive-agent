import React, { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { pdfjs, Document, Page } from "react-pdf";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, FileText, PlayCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { studentApi, type ResourceCard, type ResourceSourceFileRef } from "../lib/studentApi";
import { cn } from "../lib/utils";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const DEFAULT_COURSE_ID = 101;
const UNCATEGORIZED_LABEL = "Uncategorized";

type ResourcePreviewRouteState = {
  initialResource?: ResourceCard | null;
  initialFileId?: number | null;
};

function getCourseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get("courseId") || DEFAULT_COURSE_ID);
}

function getResourceIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("resourceId");
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSourceFileIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("fileId");
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function setSourceFileIdInUrl(fileId?: number | null, options?: { push?: boolean }) {
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

function VideoPreview({ file }: { file: ResourceSourceFileRef }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const previewUrl = file.preview_url
    ? studentApi.buildResourceSourceFileUrl(file.preview_url)
    : studentApi.buildResourceSourceFileOpenUrl(file.open_url);
  const openUrl = studentApi.buildResourceSourceFileOpenUrl(file.open_url);
  const isHls = previewUrl.toLowerCase().includes(".m3u8");

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }

    setPlayerError(null);
    element.pause();
    element.removeAttribute("src");
    element.load();

    if (isHls) {
      if (element.canPlayType("application/vnd.apple.mpegurl")) {
        element.src = previewUrl;
        return;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, backBufferLength: 90 });
        hls.loadSource(previewUrl);
        hls.attachMedia(element);
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setPlayerError("Video stream failed to load. Please open the original file.");
            hls.destroy();
          }
        });
        return () => hls.destroy();
      }

      setPlayerError("This browser does not support HLS playback.");
      return;
    }

    element.src = previewUrl;
  }, [isHls, previewUrl]);

  return (
    <div className="rounded-[28px] border border-outline-variant/35 bg-black/95 p-3 shadow-sm">
      <video ref={videoRef} controls preload="metadata" playsInline className="h-[78vh] w-full rounded-[22px] bg-black object-contain" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 pb-1">
        <div className="flex items-center gap-2 text-xs font-medium text-white/75">
          <PlayCircle className="h-4 w-4" />
          Standard player mode with HLS fallback support.
        </div>
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-white/15"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in new window
        </a>
      </div>
      {playerError ? <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{playerError}</div> : null}
    </div>
  );
}

function PdfPreview({ file }: { file: ResourceSourceFileRef }) {
  const previewPath = file.preview_url || file.open_url;
  const previewUrl = studentApi.buildResourceSourceFileUrl(previewPath);
  const openUrl = studentApi.buildResourceSourceFileOpenUrl(file.open_url);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(960);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const requiresProtectedFetch = !previewPath.startsWith("http://") && !previewPath.startsWith("https://");

  useEffect(() => {
    setPageNumber(1);
    setNumPages(0);
    setPdfError(null);
  }, [previewPath]);

  useEffect(() => {
    let revokedUrl: string | null = null;
    let cancelled = false;

    setPdfBlobUrl(null);

    if (!requiresProtectedFetch) {
      return;
    }

    void studentApi
      .fetchResourceFileBlob(previewPath)
      .then((blob) => {
        if (cancelled) {
          return;
        }
        revokedUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(revokedUrl);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        const message = loadError instanceof Error ? loadError.message : "PDF preview download failed";
        console.error("PDF blob fetch error:", loadError);
        setPdfError(message);
      });

    return () => {
      cancelled = true;
      if (revokedUrl) {
        URL.revokeObjectURL(revokedUrl);
      }
    };
  }, [previewPath, requiresProtectedFetch]);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setContainerWidth(Math.max(320, Math.floor(element.clientWidth - 32)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const statusText = numPages ? `Page ${pageNumber} / ${numPages}` : "Parsing PDF...";

  return (
    <div className="rounded-[28px] border border-outline-variant/35 bg-[#eef3f8] p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
        <div className="text-sm text-on-surface-variant">{statusText}</div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
            disabled={pageNumber <= 1}
            className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-white px-3 py-2 text-sm font-bold text-on-surface disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPageNumber((value) => Math.min(numPages || value, value + 1))}
            disabled={!numPages || pageNumber >= numPages}
            className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-white px-3 py-2 text-sm font-bold text-on-surface disabled:cursor-not-allowed disabled:opacity-45"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-white px-4 py-2 text-sm font-bold text-on-surface transition-colors hover:border-primary/40 hover:text-primary"
          >
            <ExternalLink className="h-4 w-4" />
            Open original
          </a>
        </div>
      </div>

      <div ref={hostRef} className="min-h-[78vh] rounded-[24px] bg-[#dde5ee] p-4">
        <Document
          file={
            requiresProtectedFetch
              ? pdfBlobUrl
              : {
                  url: previewUrl,
                  httpHeaders: (studentApi.buildResourceFileFetchInit(previewPath).headers || {}) as Record<string, string>,
                }
          }
          loading={<div className="flex min-h-[72vh] items-center justify-center rounded-[20px] bg-white text-sm text-on-surface-variant">Loading PDF...</div>}
          onLoadSuccess={({ numPages: loadedPages }) => {
            setNumPages(loadedPages);
            setPdfError(null);
          }}
          onLoadError={(error) => {
            const message = error.message || "PDF preview render failed";
            console.error("PDF preview load error:", error);
            setPdfError(message);
          }}
          error={
            <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
              <div>In-app PDF preview failed. Please use the original-file button.</div>
              {pdfError ? <div className="mt-2 break-all text-xs text-amber-800/90">{pdfError}</div> : null}
            </div>
          }
          className="flex justify-center"
        >
          {!pdfError ? (
            <Page
              pageNumber={pageNumber}
              width={Math.min(containerWidth, 1100)}
              renderAnnotationLayer
              renderTextLayer
              className="overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]"
            />
          ) : null}
        </Document>
      </div>
    </div>
  );
}

export function ResourceSourcePreview() {
  const location = useLocation();
  const routeState = (location.state || {}) as ResourcePreviewRouteState;
  const hasInitialSourceFiles = (routeState.initialResource?.source_files?.length || 0) > 0;
  const courseId = useMemo(() => getCourseIdFromUrl(), []);
  const resourceId = useMemo(() => getResourceIdFromUrl(), []);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(() => getSourceFileIdFromUrl() || routeState.initialFileId || null);
  const [resource, setResource] = useState<ResourceCard | null>(routeState.initialResource || null);
  const [loading, setLoading] = useState(!hasInitialSourceFiles);
  const [detailReady, setDetailReady] = useState(hasInitialSourceFiles);
  const [error, setError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handlePopState = () => {
      setSelectedFileId(getSourceFileIdFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!resourceId) {
      setError("Missing resource id.");
      setLoading(false);
      setDetailReady(true);
      return;
    }

    let cancelled = false;
    setLoading(!hasInitialSourceFiles);
    setDetailReady(hasInitialSourceFiles);
    setError(null);

    void studentApi
      .getResource(resourceId)
      .then((detail) => {
        if (cancelled) {
          return;
        }
        setResource(detail);
        setDetailReady(true);
        const fallbackFileId = getSourceFileIdFromUrl() || routeState.initialFileId || detail.source_files?.[0]?.file_id || null;
        setSelectedFileId(fallbackFileId);
        if (fallbackFileId) {
          setSourceFileIdInUrl(fallbackFileId);
        }
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setDetailReady(true);
        setError(loadError instanceof Error ? loadError.message : "Failed to load resource preview.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasInitialSourceFiles, resourceId, routeState.initialFileId]);

  const selectedFile = resource?.source_files?.find((item) => item.file_id === selectedFileId) || resource?.source_files?.[0] || null;

  const groupedFiles = useMemo(() => {
    const groups = new Map<string, ResourceSourceFileRef[]>();
    for (const file of resource?.source_files || []) {
      const key = file.top_level_category?.trim() || UNCATEGORIZED_LABEL;
      const existing = groups.get(key);
      if (existing) {
        existing.push(file);
      } else {
        groups.set(key, [file]);
      }
    }
    return Array.from(groups.entries()).map(([category, files]) => ({ category, files }));
  }, [resource]);

  useEffect(() => {
    if (!groupedFiles.length) {
      return;
    }
    setExpandedGroups((current) => {
      const next = { ...current };
      for (const group of groupedFiles) {
        if (!(group.category in next)) {
          next[group.category] = false;
        }
      }
      const selectedCategory =
        groupedFiles.find((group) => group.files.some((file) => file.file_id === selectedFile?.file_id))?.category || groupedFiles[0]?.category;
      if (selectedCategory) {
        next[selectedCategory] = true;
      }
      return next;
    });
  }, [groupedFiles, selectedFile]);

  useEffect(() => {
    if (!selectedFile) {
      setTextContent(null);
      setTextLoading(false);
      setTextError(null);
      return;
    }

    const previewMode = getSourceFilePreviewMode(selectedFile);
    if (previewMode !== "text") {
      setTextContent(null);
      setTextLoading(false);
      setTextError(null);
      return;
    }

    const controller = new AbortController();
    setTextLoading(true);
    setTextError(null);

    fetch(studentApi.buildResourceSourceFileUrl(selectedFile.preview_url || selectedFile.open_url), {
      ...studentApi.buildResourceFileFetchInit(selectedFile.preview_url || selectedFile.open_url),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
      })
      .then((text) => {
        setTextContent(text);
      })
      .catch((previewError) => {
        if (controller.signal.aborted) {
          return;
        }
        setTextError(previewError instanceof Error ? previewError.message : "Text preview failed.");
        setTextContent(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setTextLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedFile]);

  function toggleGroup(category: string) {
    setExpandedGroups((current) => ({ ...current, [category]: !current[category] }));
  }

  function openFilePreview(file: ResourceSourceFileRef) {
    setSelectedFileId(file.file_id);
    setExpandedGroups((current) => ({
      ...current,
      [(file.top_level_category?.trim() || UNCATEGORIZED_LABEL)]: true,
    }));
    setSourceFileIdInUrl(file.file_id, { push: true });
  }

  function renderPreview(file: ResourceSourceFileRef) {
    const openUrl = studentApi.buildResourceSourceFileOpenUrl(file.open_url);
    const previewUrl = file.preview_url ? studentApi.buildResourceSourceFileUrl(file.preview_url) : openUrl;
    const previewMode = getSourceFilePreviewMode(file);

    if (previewMode === "image") {
      return <img src={previewUrl} alt={file.display_name} className="max-h-[78vh] w-full rounded-3xl object-contain bg-white" />;
    }

    if (previewMode === "video") {
      return <VideoPreview file={file} />;
    }

    if (previewMode === "pdf" || previewMode === "office-pdf") {
      return <PdfPreview file={file} />;
    }

    if (previewMode === "embed" || previewMode === "html") {
      return <iframe title={file.display_name} src={previewUrl} className="h-[78vh] w-full rounded-3xl border border-outline-variant/30 bg-white" />;
    }

    if (previewMode === "text") {
      if (textLoading) {
        return <div className="rounded-3xl bg-white px-5 py-4 text-sm text-on-surface-variant">Loading text content...</div>;
      }
      if (textError) {
        return <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">{textError}</div>;
      }
      return (
        <div className="rounded-3xl border border-outline-variant/35 bg-[#fffdf8] p-3 shadow-inner shadow-primary/5">
          <pre className="max-h-[78vh] overflow-auto whitespace-pre-wrap rounded-[20px] bg-white px-6 py-6 font-mono text-sm leading-7 text-slate-800">
            {textContent || file.preview_text || "No text content available."}
          </pre>
        </div>
      );
    }

    if (previewMode === "snippet") {
      return (
        <div className="rounded-3xl border border-outline-variant/35 bg-[#fffdf8] p-3 shadow-inner shadow-primary/5">
          <pre className="max-h-[78vh] overflow-auto whitespace-pre-wrap rounded-[20px] bg-white px-6 py-6 font-mono text-sm leading-7 text-slate-800">
            {file.preview_text}
          </pre>
        </div>
      );
    }

    return (
      <div className="rounded-3xl border border-dashed border-outline-variant/50 bg-white px-6 py-6 text-sm leading-7 text-on-surface-variant">
        This file type is not suitable for inline preview. Please use the original-file button.
      </div>
    );
  }

  const backUrl = `/resources?courseId=${courseId}${resourceId ? `&resourceId=${resourceId}` : ""}`;
  const isHydratingSourceFiles = !!resource && !detailReady && !(resource.source_files?.length);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-10 md:px-10">
        <div className="rounded-[32px] border border-outline-variant/50 bg-white px-8 py-10 text-sm text-on-surface-variant shadow-sm">Loading resource preview...</div>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-10 md:px-10">
        <div className="rounded-[32px] border border-amber-200 bg-amber-50 px-8 py-10 text-sm text-amber-700 shadow-sm">{error || "Unable to open resource preview."}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 px-6 pb-16 pt-5 md:px-10">
      <section className="rounded-[36px] border border-outline-variant/40 bg-white px-8 py-7 shadow-sm">
        <Link to={backUrl} className="inline-flex items-center gap-2 text-sm font-bold text-primary transition-colors hover:text-primary/80">
          <ArrowLeft className="h-4 w-4" />
          Back to Resource Center
        </Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-primary">Source File Preview</div>
            <h1 className="mt-3 text-3xl font-bold text-on-surface">{resource.title}</h1>
            <p className="mt-3 max-w-4xl text-sm leading-8 text-on-surface-variant">{resource.summary}</p>
          </div>
          <div className="rounded-2xl bg-surface-variant/25 px-4 py-3 text-right">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">Files</div>
            <div className="mt-1 text-2xl font-bold text-on-surface">{resource.source_file_count || resource.source_files?.length || (isHydratingSourceFiles ? "..." : 0)}</div>
          </div>
        </div>
      </section>

      <div className="overflow-x-auto pb-2">
        <section className="grid min-w-[980px] grid-cols-[320px_minmax(0,1fr)] gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-[32px] border border-outline-variant/40 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-on-surface">Source Files</h2>
                <p className="text-sm text-on-surface-variant">Browse by category and open the preview path for each file.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {isHydratingSourceFiles ? (
                <div className="rounded-2xl border border-outline-variant/35 bg-surface-variant/10 px-4 py-5 text-sm text-on-surface-variant">
                  Loading source file list...
                </div>
              ) : groupedFiles.map((group) => {
                const expanded = expandedGroups[group.category] ?? false;
                return (
                  <div key={group.category} className="rounded-2xl border border-outline-variant/35 bg-surface-variant/10">
                    <button type="button" onClick={() => toggleGroup(group.category)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-on-surface">{group.category}</div>
                        <div className="mt-1 text-[11px] text-on-surface-variant">{group.files.length} files</div>
                      </div>
                      <div className="flex items-center gap-2 text-on-surface-variant">
                        <span className="text-[11px] font-bold">{expanded ? "Collapse" : "Expand"}</span>
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </button>

                    {expanded ? (
                      <div className="space-y-2 border-t border-outline-variant/30 px-3 py-3">
                        {group.files.map((file) => {
                          const isActive = selectedFile?.file_id === file.file_id;
                          const previewMode = getSourceFilePreviewMode(file);
                          return (
                            <button
                              key={file.file_id}
                              type="button"
                              onClick={() => openFilePreview(file)}
                              className={cn(
                                "block w-full rounded-2xl border px-4 py-3 text-left transition-colors",
                                isActive ? "border-primary bg-primary/6 shadow-sm" : "border-outline-variant/35 bg-white hover:border-primary/40 hover:bg-primary/5",
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-bold text-on-surface">{file.display_name}</div>
                                </div>
                                <div className="text-xs font-black text-primary">
                                  {previewMode === "video" ? "VIDEO" : file.file_extension.replace(".", "").toUpperCase() || "FILE"}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="rounded-[32px] border border-outline-variant/40 bg-[#f8fafc] p-5 shadow-sm">
            {selectedFile ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-[28px] bg-white px-5 py-4">
                  <div>
                    <h2 className="text-xl font-bold text-on-surface">{selectedFile.display_name}</h2>
                    <p className="mt-2 text-sm text-on-surface-variant">{selectedFile.relative_path}</p>
                  </div>
                  <a
                    href={studentApi.buildResourceSourceFileOpenUrl(selectedFile.open_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-white px-4 py-2.5 text-sm font-bold text-on-surface transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open original
                  </a>
                </div>
                <div key={selectedFile.file_id} className="mt-5">
                  {renderPreview(selectedFile)}
                </div>
              </>
            ) : isHydratingSourceFiles ? (
              <div className="rounded-[28px] border border-outline-variant/35 bg-white px-6 py-10 text-center text-sm text-on-surface-variant">
                Loading file preview...
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-outline-variant/50 bg-white px-6 py-10 text-center text-sm text-on-surface-variant">
                No previewable source file is available for this resource.
              </div>
            )}
          </section>
        </section>
      </div>
    </div>
  );
}
