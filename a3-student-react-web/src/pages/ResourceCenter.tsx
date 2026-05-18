import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  ExternalLink,
  FileText,
  Filter,
  FolderOpen,
  LibraryBig,
  RefreshCw,
  Search,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { studentApi, type ResourceCard, type ResourceSourceFileRef } from "../lib/studentApi";
import { cn } from "../lib/utils";

const DEFAULT_USER_ID = 1001;
const DEFAULT_COURSE_ID = 401;
const GENERATION_POLL_INTERVAL_MS = 3000;
const GENERATION_POLL_ATTEMPTS = 12;
const FILTERS = [
  { label: "全部资料", value: "" },
  { label: "课程笔记", value: "lecture_note" },
  { label: "课程总览", value: "course_overview" },
  { label: "知识图谱", value: "mind_map" },
  { label: "练习题", value: "practice_set" },
  { label: "案例分析", value: "case_study" },
];
const COURSE_PRESETS = [
  {
    id: 401,
    name: "软件工程完整资料库",
    description: "含课程总览、画像、知识图谱、实验课设和考核说明。",
  },
  {
    id: 101,
    name: "A3 联调演示资料",
    description: "适合看学生端画像、资源、评测三条主链路的联调文档。",
  },
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

function buildResourcePreviewPageUrl(courseId: number, resourceId: number, fileId?: number | null) {
  const params = new URLSearchParams({
    courseId: String(courseId),
    resourceId: String(resourceId),
  });
  if (fileId) {
    params.set("fileId", String(fileId));
  }
  return `/resources/preview?${params.toString()}`;
}

function buildCourseResourcesUrl(courseId: number) {
  const params = new URLSearchParams({
    courseId: String(courseId),
  });
  return `/resources?${params.toString()}`;
}

function buildResourceEntryRoute(resource: ResourceCard, courseId: number) {
  const firstFileId = resource.source_files?.[0]?.file_id || null;
  return {
    pathname: "/resources/preview",
    search: `?courseId=${courseId}&resourceId=${resource.resource_id}${firstFileId ? `&fileId=${firstFileId}` : ""}`,
  };
}

function getTypeLabel(type: string) {
  const map: Record<string, string> = {
    lecture_note: "课程笔记",
    lecture_notes: "课程笔记",
    mind_map: "知识图谱",
    mindmap: "知识图谱",
    quiz_set: "练习题",
    practice_set: "练习题",
    extended_reading: "拓展阅读",
    coding_lab: "编码实验",
    case_study: "案例分析",
    assessment_guide: "考核说明",
    teaching_plan: "教学组织",
    course_overview: "课程总览",
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

function getSourceFilePreviewLabel(file: ResourceSourceFileRef) {
  return getSourceFilePreviewMode(file) === "unsupported" ? "打开独立预览页" : "进入大屏预览";
}

function getResourceIcon(type: string) {
  if (type.includes("overview")) {
    return LibraryBig;
  }
  if (type.includes("map")) {
    return BookOpen;
  }
  if (type.includes("practice") || type.includes("quiz")) {
    return Zap;
  }
  return FileText;
}

export function ResourceCenter() {
  const navigate = useNavigate();
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

      setGenerationMessage("资料正在后台生成中，系统会继续自动刷新结果...");

      let found = false;
      for (let attempt = 0; attempt < GENERATION_POLL_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, GENERATION_POLL_INTERVAL_MS));
        try {
          const latest = await studentApi.listResources(DEFAULT_USER_ID, courseId, selectedType || undefined);
          setResources(latest.items || []);
          const newItems = (latest.items || []).filter((item) => item.resource_id && !existingIds.has(item.resource_id));
          if (newItems.length || latest.total > existingIds.size) {
            setGenerationMessage(`资料已经更新完成，现在一共有 ${latest.total} 条资源可用。`);
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

  function openResourceEntry(resource?: ResourceCard | null) {
    if (!resource?.resource_id) {
      return;
    }
    navigate(buildResourceEntryRoute(resource, courseId), {
      state: {
        initialResource: resource,
        initialFileId: resource.source_files?.[0]?.file_id || null,
      },
    });
  }

  function getResourceEntryHref(resource?: ResourceCard | null) {
    if (!resource?.resource_id) {
      return "#";
    }
    const firstFileId = resource.source_files?.[0]?.file_id || null;
    return buildResourcePreviewPageUrl(courseId, resource.resource_id, firstFileId);
  }

  function getResourceEntryLinkProps(resource?: ResourceCard | null) {
    if (!resource?.resource_id) {
      return { to: "#" };
    }
    return {
      to: buildResourceEntryRoute(resource, courseId),
      state: {
        initialResource: resource,
        initialFileId: resource.source_files?.[0]?.file_id || null,
      },
    };
  }

  const filteredResources = useMemo(() => {
    return resources.filter((item) => {
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
  }, [resources, search]);

  const selectedResource = selectedResourceDetail;
  const overviewResource = filteredResources.find((item) => item.resource_type === "course_overview") || resources.find((item) => item.resource_type === "course_overview") || null;
  const featuredResources = filteredResources.filter((item) => item.resource_id !== overviewResource?.resource_id).slice(0, 3);
  const featuredIds = new Set(featuredResources.map((item) => item.resource_id).filter((value): value is number => typeof value === "number"));
  const remainingResources = filteredResources.filter((item) => {
    if (item.resource_id === overviewResource?.resource_id) {
      return false;
    }
    if (item.resource_id && featuredIds.has(item.resource_id)) {
      return false;
    }
    return true;
  });
  const totalSourceFiles = resources.reduce((sum, item) => sum + (item.source_file_count || item.source_files?.length || 0), 0);
  const resourceTypeSummary = Object.entries(
    resources.reduce<Record<string, number>>((acc, item) => {
      const label = getTypeLabel(item.resource_type);
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {}),
  );
  const currentCoursePreset = COURSE_PRESETS.find((item) => item.id === courseId);

  return (
    <div className="space-y-8 pb-28">
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="rounded-[32px] border border-outline-variant/50 bg-white p-8 shadow-sm md:p-10">
          <div className="inline-flex rounded-full bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-primary">
            Resource Workspace
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-on-surface">资源中心</h1>
          <p className="mt-4 max-w-3xl text-sm leading-8 text-on-surface-variant">
            这里不只是“资料列表”，而是按课程上下文整理好的资料工作台。你可以先看课程总览，再按学习阶段进入笔记、图谱、练习题和原始资料文件。
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {COURSE_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(buildCourseResourcesUrl(item.id))}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  courseId === item.id ? "border-primary bg-primary/10 text-primary" : "border-outline-variant bg-white text-on-surface-variant hover:border-primary/40 hover:text-primary",
                )}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <StatCard label="当前资料数" value={String(resources.length)} hint="这一门课当前可直接打开的资源卡片" />
            <StatCard label="原始文件入口" value={String(totalSourceFiles)} hint="和课程资料库真实文件对应的入口数量" />
            <StatCard label="当前课程" value={currentCoursePreset?.name || `课程 ${courseId}`} hint={currentCoursePreset?.description || "已按当前 courseId 加载资源"} />
          </div>

          <div className="mt-8 flex flex-col gap-4 md:flex-row">
            <label className="flex h-12 flex-1 items-center gap-3 rounded-full border border-outline-variant bg-surface-variant/25 px-5">
              <Search className="h-4 w-4 text-on-surface-variant" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索资料标题、知识点、原始来源"
                className="w-full bg-transparent text-sm outline-none placeholder:text-on-surface-variant/60"
              />
            </label>
            <button
              onClick={() => void loadResources(selectedType)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-outline-variant bg-white px-5 text-sm font-bold text-on-surface"
            >
              <RefreshCw className="h-4 w-4" />
              刷新资料
            </button>
          </div>
        </div>

        <div className="rounded-[32px] bg-[#102a43] p-8 text-white shadow-lg shadow-slate-900/10">
          <div className="flex items-center gap-2 text-sm font-bold text-primary/90">
            <LibraryBig className="h-4 w-4" />
            软件工程完整资料入口
          </div>
          <h2 className="mt-4 text-2xl font-bold">{overviewResource?.title || "完整资料库总览"}</h2>
          <p className="mt-4 text-sm leading-8 text-white/82">
            软件工程课程背后是整套真实资料库。这里建议先从“课程资源总览”进入，再按课程画像、知识图谱、实验课设和考核说明继续展开。
          </p>
          <div className="mt-6 space-y-3">
            <QuickLine label="推荐入口" value={overviewResource ? "课程总览 -> 画像 -> 图谱 -> 实验课设" : "切到软件工程课程即可看到完整资料入口"} />
            <QuickLine label="适合场景" value="备课、导学、复习、实验选题、课程答疑" />
            <QuickLine label="当前状态" value={courseId === 401 ? "正在查看软件工程课程资料" : "你现在不在软件工程课程，点按钮可直接切换"} />
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              {...(courseId === 401 ? getResourceEntryLinkProps(overviewResource) : { to: buildCourseResourcesUrl(401) })}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-on-surface transition hover:shadow-lg"
            >
              打开完整资料入口
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void handleGenerateResources();
              }}
              disabled={generating}
              className="relative z-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/15 disabled:opacity-60"
            >
              <Zap className="h-4 w-4" />
              {generating ? "生成中..." : "生成一组新资料"}
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">{error}</div> : null}
      {generationMessage ? <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-700">{generationMessage}</div> : null}

      <section className="flex flex-wrap items-center gap-3">
        {FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setSelectedType(filter.value);
            }}
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
        <div className="ml-auto inline-flex items-center gap-2 rounded-full border border-outline-variant bg-white px-4 py-2 text-xs font-semibold text-on-surface-variant">
          <Filter className="h-4 w-4" />
          已按课程和资料类型筛选
        </div>
      </section>

      {resourceTypeSummary.length ? (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {resourceTypeSummary.slice(0, 4).map(([label, count]) => (
            <div key={label}>
              <StatCard label={label} value={String(count)} hint="当前筛选下的资料数量" />
            </div>
          ))}
        </section>
      ) : null}

      {overviewResource ? (
        <section className="overflow-hidden rounded-[30px] border border-outline-variant/50 bg-white shadow-sm">
          <div className="grid gap-6 p-8 lg:grid-cols-[1.05fr_0.95fr] lg:p-10">
            <div>
              <div className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary">
                完整资料库入口
              </div>
              <h2 className="mt-4 text-3xl font-bold text-on-surface">{overviewResource.title}</h2>
              <p className="mt-4 text-sm leading-8 text-on-surface-variant">{overviewResource.summary}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {overviewResource.source_titles.slice(0, 4).map((source) => (
                  <span key={source} className="rounded-full bg-surface-variant/35 px-3 py-1 text-xs text-on-surface-variant">
                    {source}
                  </span>
                ))}
              </div>
              <div className="mt-6 rounded-2xl bg-surface-variant/25 px-4 py-4 text-sm leading-7 text-on-surface">
                {overviewResource.study_suggestion || "先从总览确认资料入口，再进入更细的课程资料。"}
              </div>
            </div>
            <div className="rounded-[28px] bg-gradient-to-br from-[#10233b] via-[#16304d] to-[#0f766e] p-7 text-white shadow-lg">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-white/65">High Value Entry</div>
              <div className="mt-4 text-2xl font-bold">软件工程完整资料已经接通</div>
              <p className="mt-4 text-sm leading-8 text-white/82">
                这不是一两条演示卡片，而是整套课程资料的导入口。点开后可以继续进入课程画像、章节图谱、实验课设和原始文件预览。
              </p>
              <Link
                {...getResourceEntryLinkProps(overviewResource)}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-on-surface"
              >
                打开课程总览
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-on-surface">优先看这几条</h2>
            <p className="mt-1 text-sm text-on-surface-variant">适合第一次进入这门课时先扫一遍，能最快建立结构感。</p>
          </div>
          <div className="text-sm text-on-surface-variant">当前共找到 {filteredResources.length} 条资料</div>
        </div>

        {loading ? (
          <div className="rounded-[28px] border border-outline-variant/50 bg-white p-8 text-sm text-on-surface-variant shadow-sm">
            正在同步学习资料...
          </div>
        ) : null}

        {!loading && featuredResources.length ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {featuredResources.map((item, index) => (
              <motion.article
                key={`${item.resource_id || item.title}-${index}`}
                whileHover={{ y: -4 }}
                className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#10233b] via-[#16304d] to-[#0f766e] p-8 text-white shadow-lg"
              >
                <div className="text-xs font-black uppercase tracking-[0.2em] text-white/65">{getTypeLabel(item.resource_type)}</div>
                <h3 className="mt-4 text-2xl font-bold leading-tight">{item.title}</h3>
                <p className="mt-4 text-sm leading-8 text-white/82">{item.summary}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {item.source_titles.slice(0, 4).map((source) => (
                    <span key={source} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/85">
                      {source}
                    </span>
                  ))}
                </div>
                <div className="mt-8 flex items-center justify-between gap-4">
                  <div className="text-sm text-white/75">{item.study_suggestion || "建议先快速通读，再按当前任务重点精读。"}</div>
                  <Link {...getResourceEntryLinkProps(item)} className="inline-flex items-center gap-2 text-sm font-bold">
                    打开看看
                    <ArrowRight className="h-4 w-4" />
                  </Link>
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

      {!loading && remainingResources.length ? (
        <section>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-on-surface">全部资料</h2>
              <p className="mt-1 text-sm text-on-surface-variant">支持按类型过滤、按关键词搜索，并且可以直接进入资料详情和原始文件。</p>
            </div>
            <div className="text-sm text-on-surface-variant">已按当前课程、搜索和类型筛选</div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {remainingResources.map((item) => {
              const Icon = getResourceIcon(item.resource_type);
              const isFavorite = item.resource_id ? favoriteIds.includes(item.resource_id) : false;
              const fileCount = item.source_file_count || item.source_files?.length || 0;
              return (
                <article key={`${item.resource_id || item.title}`} className="rounded-[28px] border border-outline-variant/50 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                      <Icon className="h-6 w-6" />
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

                  <Link {...getResourceEntryLinkProps(item)} className="mt-5 block text-left">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-primary">{getTypeLabel(item.resource_type)}</div>
                    <h3 className="mt-3 text-xl font-bold text-on-surface">{item.title}</h3>
                    <p className="mt-3 line-clamp-3 text-sm leading-7 text-on-surface-variant">{item.summary}</p>
                  </Link>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {item.source_titles.slice(0, 3).map((source) => (
                      <span key={source} className="rounded-full bg-surface-variant/35 px-3 py-1 text-xs text-on-surface-variant">
                        {source}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center justify-between rounded-2xl bg-surface-variant/25 px-4 py-3 text-sm text-on-surface">
                    <span>{item.study_suggestion || "可结合当前学习路径顺序阅读。"}</span>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-xs text-on-surface-variant">
                    <span>{fileCount ? `原始文件 ${fileCount} 个` : "暂无原始文件入口"}</span>
                    <Link {...getResourceEntryLinkProps(item)} className="inline-flex items-center gap-1 font-semibold text-primary">
                      进入详情
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
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
                      <h3 className="text-base font-bold text-on-surface">原始资料文件</h3>
                      <p className="mt-1 text-sm text-on-surface-variant">这里直接对应课程文件夹里的真实资料，点开即可查看或预览。</p>
                    </div>
                    <div className="text-xs font-bold text-primary">{selectedResource.source_file_count || selectedResource.source_files.length} 个</div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedResource.source_files.map((file) => (
                      <Link
                        key={file.file_id}
                        to={selectedResource.resource_id ? buildSourcePreviewPageUrl(courseId, selectedResource.resource_id, file.file_id) : "#"}
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
                          <span>{getSourceFilePreviewLabel(file)}</span>
                        </div>
                        {file.preview_text ? <div className="mt-2 line-clamp-3 text-xs leading-6 text-on-surface">{file.preview_text}</div> : null}
                      </Link>
                    ))}
                  </div>
                </section>
              ) : resourceDetailLoading ? (
                <div className="rounded-2xl border border-outline-variant/30 bg-surface-variant/20 px-4 py-3 text-sm text-on-surface-variant">
                  正在加载原始资料列表...
                </div>
              ) : null}

              <section className="rounded-3xl border border-outline-variant/40 bg-white p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-bold text-on-surface">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  资料正文
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-3xl bg-slate-950 px-5 py-5 font-mono text-sm leading-7 text-slate-100">
                  {selectedResource.content_markdown}
                </pre>
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant/50 bg-surface-variant/20 p-4">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">{label}</div>
      <div className="mt-3 text-xl font-bold text-on-surface">{value}</div>
      <div className="mt-2 text-xs leading-6 text-on-surface-variant">{hint}</div>
    </div>
  );
}

function QuickLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl bg-white/8 px-4 py-3">
      <span className="text-xs font-bold text-white/62">{label}</span>
      <span className="text-right text-sm text-white">{value}</span>
    </div>
  );
}
