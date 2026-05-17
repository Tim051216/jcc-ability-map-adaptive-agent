import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bookmark, BookOpen, ExternalLink, FileText, Filter, RefreshCw, Search, Sparkles, X, Zap } from "lucide-react";
import { motion } from "motion/react";
import { studentApi, type ResourceCard, type ResourceSourceFileRef } from "../lib/studentApi";
import { cn } from "../lib/utils";

const DEFAULT_USER_ID = 1001;
const DEFAULT_COURSE_ID = 101;
const GENERATION_POLL_INTERVAL_MS = 3000;
const GENERATION_POLL_ATTEMPTS = 12;
const FILTERS = [
  { label: "全部资料", value: "" },
  { label: "课堂笔记", value: "lecture_note" },
  { label: "思维导图", value: "mind_map" },
  { label: "练习题", value: "practice_set" },
  { label: "案例分析", value: "case_study" },
];

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

function setResourceIdInUrl(resourceId?: number | null, options?: { push?: boolean }) {
  const url = new URL(window.location.href);
  if (resourceId) {
    url.searchParams.set("resourceId", String(resourceId));
  } else {
    url.searchParams.delete("resourceId");
  }
  const nextUrl = `${url.pathname}${url.search}`;
  const nextState = {
    ...(window.history.state || {}),
    resourceCenterDetail: Boolean(resourceId),
    resourceId: resourceId ?? null,
  };

  if (options?.push) {
    window.history.pushState(nextState, "", nextUrl);
    return;
  }

  window.history.replaceState(nextState, "", nextUrl);
}

function buildSourcePreviewPageUrl(courseId: number, resourceId: number, fileId: number) {
  const params = new URLSearchParams({
    courseId: String(courseId),
    resourceId: String(resourceId),
    fileId: String(fileId),
  });
  return `/resources/preview?${params.toString()}`;
}

function getTypeLabel(type: string) {
  const map: Record<string, string> = {
    lecture_note: "课堂笔记",
    lecture_notes: "课堂笔记",
    mind_map: "思维导图",
    quiz_set: "练习题",
    practice_set: "练习题",
    extended_reading: "拓展阅读",
    coding_lab: "编码实验",
    case_study: "案例分析",
    assessment_guide: "测评指南",
    teaching_plan: "教学计划",
    course_overview: "课程导览",
  };
  return map[type] || type;
}

function formatFileSize(fileSize?: number | null) {
  if (!fileSize || fileSize <= 0) {
    return null;
  }
  if (fileSize >= 1024 * 1024) {
    return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (fileSize >= 1024) {
    return `${Math.round(fileSize / 1024)} KB`;
  }
  return `${fileSize} B`;
}

function getSourceFilePreviewMode(file: ResourceSourceFileRef) {
  const extension = file.file_extension.toLowerCase();
  const mimeType = (file.mime_type || "").toLowerCase();

  if (mimeType.startsWith("image/")) {
    return "image";
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

export function ResourceCenter() {
  const courseId = useMemo(() => getCourseIdFromUrl(), []);
  const [resources, setResources] = useState<ResourceCard[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(() => getResourceIdFromUrl());
  const [selectedResourceDetail, setSelectedResourceDetail] = useState<ResourceCard | null>(null);
  const [resourceDetailLoading, setResourceDetailLoading] = useState(false);
  async function loadResources(resourceType = selectedType, options?: { silent?: boolean }) {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      setError(null);
      const [response, favorites] = await Promise.all([
        studentApi.listResources(DEFAULT_USER_ID, courseId, resourceType || undefined),
        studentApi.listFavoriteResources(DEFAULT_USER_ID),
      ]);
      setResources(response.items || []);
      setFavoriteIds(
        (favorites.items || [])
          .map((item) => item.resource_id)
          .filter((value): value is number => typeof value === "number"),
      );
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "学习资料加载失败";
      setResources([]);
      setError(message);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadResources(selectedType);
  }, [courseId, selectedType]);

  useEffect(() => {
    const handlePopState = () => {
      setSelectedResourceId(getResourceIdFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!selectedResourceId) {
      setSelectedResourceDetail(null);
      setResourceDetailLoading(false);
      return;
    }

    const fallbackResource = resources.find((item) => item.resource_id === selectedResourceId) || null;
    setSelectedResourceDetail(fallbackResource);
    setResourceDetailLoading(true);

    let cancelled = false;
    void studentApi
      .getResource(selectedResourceId)
      .then((detail) => {
        if (!cancelled) {
          setSelectedResourceDetail(detail);
        }
      })
      .catch((detailError) => {
        if (!cancelled) {
          const message = detailError instanceof Error ? detailError.message : "资料详情加载失败";
          setError(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setResourceDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resources, selectedResourceId]);

  async function handleGenerateResources() {
    const existingIds = new Set(resources.map((item) => item.resource_id).filter(Boolean));

    try {
      setGenerating(true);
      setError(null);
      setGenerationMessage("正在为你准备一组新的学习资料...");
      const payload = {
        user_id: DEFAULT_USER_ID,
        course_id: courseId,
        knowledge_points: ["学习画像", "学习路径", "资源生成", "学习报告"],
        resource_types: ["lecture_note", "mind_map", "practice_set", "case_study"],
      };

      const generated = await Promise.race([
        studentApi.generateResources(payload),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("generation_pending")), 8000)),
      ]);

      if (generated.resources?.length) {
        setResources(generated.resources);
        setGenerationMessage(`资料已准备好，刚刚新增了 ${generated.resources.length} 条可直接使用的资源。`);
        await loadResources(selectedType, { silent: true });
      }
    } catch (generateError) {
      const message = generateError instanceof Error ? generateError.message : "学习资料生成失败";
      if (message !== "generation_pending") {
        setError(message);
        setGenerationMessage(null);
        setGenerating(false);
        return;
      }

      setGenerationMessage("资料正在后台生成中，系统正在自动刷新最新结果...");

      let found = false;
      for (let attempt = 0; attempt < GENERATION_POLL_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, GENERATION_POLL_INTERVAL_MS));
        try {
          const latest = await studentApi.listResources(DEFAULT_USER_ID, courseId, selectedType || undefined);
          setResources(latest.items || []);

          const newItems = (latest.items || []).filter((item) => item.resource_id && !existingIds.has(item.resource_id));
          if (newItems.length || latest.total > existingIds.size) {
            setGenerationMessage(`资料已经更新完成，现在共有 ${latest.total} 条资源可用。`);
            await loadResources(selectedType, { silent: true });
            found = true;
            break;
          }
        } catch (pollError) {
          const pollMessage = pollError instanceof Error ? pollError.message : "资料刷新失败";
          setError(pollMessage);
          break;
        }
      }

      if (!found) {
        setGenerationMessage("任务已经提交，但资料还没显示出来。稍后点一次刷新即可。");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleFavorite(resourceId?: number | null) {
    if (!resourceId) {
      return;
    }
    try {
      await studentApi.favoriteResource(resourceId, DEFAULT_USER_ID);
      setFavoriteIds((prev) => (prev.includes(resourceId) ? prev : [...prev, resourceId]));
    } catch (favoriteError) {
      const message = favoriteError instanceof Error ? favoriteError.message : "收藏资料失败";
      setError(message);
    }
  }

  function openResourceDetail(resourceId?: number | null) {
    if (!resourceId) {
      return;
    }
    setSelectedResourceId(resourceId);
    if (getResourceIdFromUrl() === resourceId) {
      setResourceIdInUrl(resourceId);
      return;
    }
    setResourceIdInUrl(resourceId, { push: true });
  }

  function closeResourceDetail() {
    const historyState = window.history.state as { resourceCenterDetail?: boolean } | null;
    setSelectedResourceId(null);
    if (historyState?.resourceCenterDetail && getResourceIdFromUrl()) {
      window.history.back();
      return;
    }
    setResourceIdInUrl(null);
  }

  const filteredResources = resources.filter((item) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return true;
    }
    return (
      item.title.toLowerCase().includes(keyword) ||
      item.summary.toLowerCase().includes(keyword) ||
      item.source_titles.some((source) => source.toLowerCase().includes(keyword))
    );
  });

  const featuredResources = filteredResources.slice(0, 2);
  const selectedResource = selectedResourceDetail;

  return (
    <div className="space-y-10 pb-28">
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[32px] border border-outline-variant/50 bg-white p-8 shadow-sm md:p-10">
          <div className="inline-flex rounded-full bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-primary">
            学习资料中心
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-on-surface">先找资料，再开始学，这里帮你一步到位</h1>
          <p className="mt-4 max-w-3xl text-sm leading-8 text-on-surface-variant">
            你可以在这里直接拿到当前课程要用的笔记、导图、练习题和案例。看不懂课程时先来找资料，准备测评前也可以先来补材料。
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-surface-variant/25 p-4">
              <div className="text-[11px] font-bold text-primary">如果你刚开始学</div>
              <div className="mt-2 text-sm text-on-surface">先看课堂笔记和课程导览</div>
            </div>
            <div className="rounded-2xl bg-surface-variant/25 p-4">
              <div className="text-[11px] font-bold text-primary">如果你准备练习</div>
              <div className="mt-2 text-sm text-on-surface">优先打开练习题和案例分析</div>
            </div>
            <div className="rounded-2xl bg-surface-variant/25 p-4">
              <div className="text-[11px] font-bold text-primary">如果你想快速过一遍</div>
              <div className="mt-2 text-sm text-on-surface">直接看思维导图最省时间</div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 md:flex-row">
            <label className="flex h-12 flex-1 items-center gap-3 rounded-full border border-outline-variant bg-surface-variant/25 px-5">
              <Search className="h-4 w-4 text-on-surface-variant" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="直接搜资料标题、知识点或关键词"
                className="w-full bg-transparent text-sm outline-none placeholder:text-on-surface-variant/60"
              />
            </label>
            <button
              onClick={() => void loadResources(selectedType)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-outline-variant bg-white px-5 text-sm font-bold text-on-surface"
            >
              <RefreshCw className="h-4 w-4" />
              更新资料
            </button>
          </div>
        </div>

        <div className="rounded-[32px] bg-primary p-8 text-white shadow-lg shadow-primary/20">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Sparkles className="h-4 w-4" />
            不知道看什么时
          </div>
          <h2 className="mt-4 text-2xl font-bold">让系统先帮你备一套资料</h2>
          <p className="mt-4 text-sm leading-8 text-white/85">
            一键生成当前课程常用的笔记、导图、练习题和案例包，适合不想自己筛资料的同学。
          </p>
          <button
            onClick={() => void handleGenerateResources()}
            disabled={generating}
            className="mt-8 inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-bold text-on-surface disabled:opacity-60"
          >
            <Zap className="h-4 w-4 text-primary" />
            {generating ? "正在准备..." : "帮我生成一套资料"}
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">{error}</div>
      ) : null}

      {generationMessage ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-700">{generationMessage}</div>
      ) : null}

      <section className="flex flex-wrap items-center gap-3">
        {FILTERS.map((filter) => (
          <button
            key={filter.label}
            onClick={() => setSelectedType(filter.value)}
            className={cn(
              "rounded-full border px-5 py-2.5 text-sm font-bold transition-colors",
              selectedType === filter.value
                ? "border-on-surface bg-on-surface text-white"
                : "border-outline-variant bg-white text-on-surface-variant hover:border-primary/40 hover:text-primary",
            )}
          >
            {filter.label}
          </button>
        ))}
        <div className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-white text-on-surface-variant">
          <Filter className="h-4 w-4" />
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-on-surface">最值得先看的资料</h2>
            <p className="mt-1 text-sm text-on-surface-variant">如果你时间不多，先从这两条开始最快进入状态。</p>
          </div>
          <div className="text-sm text-on-surface-variant">当前共找到 {filteredResources.length} 条资料</div>
        </div>

        {loading ? (
          <div className="rounded-[28px] border border-outline-variant/50 bg-white p-8 text-sm text-on-surface-variant shadow-sm">
            正在同步学习资料...
          </div>
        ) : null}

        {!loading && featuredResources.length ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {featuredResources.map((item, index) => (
              <motion.article
                key={`${item.resource_id || item.title}-${index}`}
                whileHover={{ y: -4 }}
                className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#10233b] via-[#16304d] to-[#0f766e] p-8 text-white shadow-lg"
              >
                <div className="text-xs font-black uppercase tracking-[0.2em] text-white/65">{getTypeLabel(item.resource_type)}</div>
                <h3 className="mt-4 text-3xl font-bold leading-tight">{item.title}</h3>
                <p className="mt-4 text-sm leading-8 text-white/82">{item.summary}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {item.source_titles.slice(0, 4).map((source) => (
                    <span key={source} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/85">
                      {source}
                    </span>
                  ))}
                </div>
                <div className="mt-8 flex items-center justify-between gap-4">
                  <div className="text-sm text-white/75">{item.study_suggestion || "建议和当前学习任务一起看，效果最好。"}</div>
                  <button onClick={() => openResourceDetail(item.resource_id)} className="inline-flex items-center gap-2 text-sm font-bold">
                    打开看看
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        ) : null}

        {!loading && !filteredResources.length ? (
          <div className="rounded-[28px] border border-dashed border-outline-variant bg-white p-10 text-center shadow-sm">
            <div className="text-2xl font-bold text-on-surface">这门课还没有可用资料</div>
            <p className="mt-3 text-sm leading-8 text-on-surface-variant">你可以点上面的按钮，让系统先帮你生成一套资料包。</p>
          </div>
        ) : null}
      </section>

      {!loading && filteredResources.length ? (
        <section>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-on-surface">全部资料</h2>
              <p className="mt-1 text-sm text-on-surface-variant">按类型筛选后，直接点开就能读内容。</p>
            </div>
            <div className="text-sm text-on-surface-variant">已按当前搜索条件和类型筛选</div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredResources.map((item) => {
              const isFavorite = item.resource_id ? favoriteIds.includes(item.resource_id) : false;
              return (
                <article key={`${item.resource_id || item.title}`} className="rounded-[28px] border border-outline-variant/50 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                      {item.resource_type.includes("map") ? <BookOpen className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleFavorite(item.resource_id);
                      }}
                      className={cn(
                        "rounded-full p-2 transition-colors",
                        isFavorite ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-surface-variant/35",
                      )}
                    >
                      <Bookmark className="h-5 w-5" />
                    </button>
                  </div>

                  <button onClick={() => openResourceDetail(item.resource_id)} className="mt-5 block text-left">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-primary">{getTypeLabel(item.resource_type)}</div>
                    <h3 className="mt-3 text-xl font-bold text-on-surface">{item.title}</h3>
                    <p className="mt-3 line-clamp-3 text-sm leading-7 text-on-surface-variant">{item.summary}</p>
                  </button>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {item.source_titles.slice(0, 3).map((source) => (
                      <span key={source} className="rounded-full bg-surface-variant/35 px-3 py-1 text-xs text-on-surface-variant">
                        {source}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => openResourceDetail(item.resource_id)}
                    className="mt-6 block w-full rounded-2xl bg-surface-variant/25 px-4 py-3 text-left text-sm leading-7 text-on-surface"
                  >
                    {item.study_suggestion || "如果你不知道怎么用，先按当前学习路径顺序来读这条资料。"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {selectedResource ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#08131f]/45 backdrop-blur-sm">
          <button aria-label="关闭资料详情" className="flex-1" onClick={closeResourceDetail} />
          <aside className="relative h-full w-full max-w-3xl overflow-y-auto border-l border-outline-variant/30 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-outline-variant/30 bg-white/95 px-6 py-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-primary">{getTypeLabel(selectedResource.resource_type)}</div>
                  <h2 className="mt-2 text-2xl font-bold text-on-surface">{selectedResource.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-on-surface-variant">{selectedResource.summary}</p>
                </div>
                <button
                  onClick={closeResourceDetail}
                  className="rounded-full border border-outline-variant p-2 text-on-surface-variant transition-colors hover:bg-surface-variant/30"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedResource.source_titles.map((source) => (
                  <span key={source} className="rounded-full bg-surface-variant/45 px-3 py-1 text-xs text-on-surface-variant">
                    {source}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="rounded-2xl bg-surface-variant/25 px-4 py-3 text-sm leading-7 text-on-surface">
                {selectedResource.study_suggestion || "建议先快速通读，再结合当前任务重点精读。"}
              </div>
              {selectedResource.source_files?.length ? (
                <section className="rounded-3xl border border-outline-variant/40 bg-white p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-on-surface">原始资料</h3>
                      <p className="mt-1 text-sm text-on-surface-variant">这里直接对应课程文件夹里的真实资料，点开即可查看或下载。</p>
                    </div>
                    <div className="text-xs font-bold text-primary">
                      {selectedResource.source_file_count || selectedResource.source_files.length} 份
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="space-y-3">
                      {selectedResource.source_files.map((file) => (
                        <a
                          key={file.file_id}
                          href={selectedResource.resource_id ? buildSourcePreviewPageUrl(courseId, selectedResource.resource_id, file.file_id) : "#"}
                          className="block rounded-2xl border border-outline-variant/35 bg-surface-variant/20 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-on-surface">{file.display_name}</div>
                              <div className="mt-1 text-xs text-on-surface-variant">{file.top_level_category}</div>
                            </div>
                            <div className="inline-flex items-center gap-2 text-xs font-bold text-primary">
                              {file.file_extension.replace(".", "").toUpperCase() || "FILE"}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-on-surface-variant">{file.relative_path}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-on-surface-variant">
                            {formatFileSize(file.file_size) ? <span>{formatFileSize(file.file_size)}</span> : null}
                            <span>{getSourceFilePreviewMode(file) === "unsupported" ? "打开独立预览页" : "进入大屏预览"}</span>
                          </div>
                          {file.preview_text ? <div className="mt-2 line-clamp-3 text-xs leading-6 text-on-surface">{file.preview_text}</div> : null}
                        </a>
                      ))}
                    </div>
                  </div>
                </section>
              ) : resourceDetailLoading ? (
                <div className="rounded-2xl border border-outline-variant/30 bg-surface-variant/20 px-4 py-3 text-sm text-on-surface-variant">
                  正在加载原始资料列表...
                </div>
              ) : null}
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-3xl bg-slate-950 px-5 py-5 font-mono text-sm leading-7 text-slate-100">
                {selectedResource.content_markdown}
              </pre>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
