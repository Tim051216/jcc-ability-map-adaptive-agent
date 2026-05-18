import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Clock3,
  ExternalLink,
  Filter,
  FolderOpen,
  ListChecks,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { studentApi, type ResourceCard, type ResourceFavoriteSummaryResponse } from "../lib/studentApi";
import { cn } from "../lib/utils";

const DEFAULT_USER_ID = 1001;
const DEFAULT_COURSE_ID = 401;
const VIEW_TABS = [
  { label: "全部收藏", value: "all" },
  { label: "继续学习", value: "continue" },
  { label: "分类整理", value: "organized" },
] as const;
const SORT_OPTIONS = [
  { label: "推荐顺序", value: "recommended" },
  { label: "标题 A-Z", value: "title" },
  { label: "资料类型", value: "type" },
] as const;

type ViewTab = (typeof VIEW_TABS)[number]["value"];
type SortMode = (typeof SORT_OPTIONS)[number]["value"];

function getCourseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const value = Number(params.get("courseId") || DEFAULT_COURSE_ID);
  return Number.isFinite(value) ? value : DEFAULT_COURSE_ID;
}

function formatResourceType(type: string) {
  const map: Record<string, string> = {
    lecture_note: "课程笔记",
    lecture_notes: "课程笔记",
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

function formatTimeLabel(value?: string | null) {
  if (!value) {
    return "最近未记录";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function buildResourceDetailUrl(courseId: number, resourceId?: number | null) {
  if (!resourceId) {
    return `/resources?courseId=${courseId}`;
  }
  return `/resources?courseId=${courseId}&resourceId=${resourceId}`;
}

function getSearchableText(item: ResourceCard) {
  return [item.title, item.summary, item.study_suggestion || "", item.resource_type, ...item.source_titles].join(" ").toLowerCase();
}

function getContinuePriority(item: ResourceCard) {
  const scoreMap: Record<string, number> = {
    course_overview: 100,
    lecture_note: 90,
    lecture_notes: 90,
    mind_map: 80,
    practice_set: 70,
    quiz_set: 70,
    case_study: 60,
    coding_lab: 55,
    assessment_guide: 45,
    extended_reading: 35,
    teaching_plan: 20,
  };
  return scoreMap[item.resource_type] || 10;
}

function getLearningStageLabel(type: string) {
  const stageMap: Record<string, string> = {
    course_overview: "先建立全局认识",
    lecture_note: "先建立基础理解",
    lecture_notes: "先建立基础理解",
    mind_map: "适合快速串联知识点",
    practice_set: "适合练习和自测",
    quiz_set: "适合练习和自测",
    case_study: "适合理解真实场景",
    coding_lab: "适合动手应用",
    assessment_guide: "适合考前过重点",
    extended_reading: "适合扩展补充",
    teaching_plan: "适合了解课程安排",
  };
  return stageMap[type] || "适合作为本轮学习补充";
}

function sortResources(items: ResourceCard[], mode: SortMode) {
  const next = [...items];
  if (mode === "title") {
    next.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
    return next;
  }
  if (mode === "type") {
    next.sort((a, b) => formatResourceType(a.resource_type).localeCompare(formatResourceType(b.resource_type), "zh-CN"));
    return next;
  }
  next.sort((a, b) => getContinuePriority(b) - getContinuePriority(a));
  return next;
}

export function Collection() {
  const courseId = useMemo(() => getCourseIdFromUrl(), []);
  const [resources, setResources] = useState<ResourceCard[]>([]);
  const [summary, setSummary] = useState<ResourceFavoriteSummaryResponse | null>(null);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<ViewTab>("all");
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadFavorites() {
      try {
        setLoading(true);
        setError(null);
        const [favoriteResponse, summaryResponse] = await Promise.all([
          studentApi.listFavoriteResources(DEFAULT_USER_ID),
          studentApi.getFavoriteSummary(DEFAULT_USER_ID),
        ]);
        if (!cancelled) {
          setResources(favoriteResponse.items || []);
          setSummary(summaryResponse);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "收藏资源加载失败";
          setError(message);
          setResources([]);
          setSummary(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFavorites();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggleFavorite(resourceId?: number | null) {
    if (!resourceId || updatingIds.includes(resourceId)) {
      return;
    }

    try {
      setUpdatingIds((prev) => [...prev, resourceId]);
      const result = await studentApi.favoriteResource(resourceId, DEFAULT_USER_ID);
      if (result.favorite === false) {
        setResources((prev) => prev.filter((item) => item.resource_id !== resourceId));
        setSummary((prev) => {
          if (!prev) {
            return prev;
          }
          const target = resources.find((item) => item.resource_id === resourceId);
          const nextByType = { ...prev.by_type };
          if (target?.resource_type && nextByType[target.resource_type]) {
            nextByType[target.resource_type] = Math.max(0, nextByType[target.resource_type] - 1);
            if (nextByType[target.resource_type] === 0) {
              delete nextByType[target.resource_type];
            }
          }
          return {
            ...prev,
            total: Math.max(0, prev.total - 1),
            by_type: nextByType,
          };
        });
      }
    } catch (toggleError) {
      const message = toggleError instanceof Error ? toggleError.message : "收藏状态更新失败";
      setError(message);
    } finally {
      setUpdatingIds((prev) => prev.filter((id) => id !== resourceId));
    }
  }

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of resources) {
      counts.set(item.resource_type, (counts.get(item.resource_type) || 0) + 1);
    }
    return [
      { name: "全部", value: "all", count: resources.length },
      ...Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({
          name: formatResourceType(type),
          value: type,
          count,
        })),
    ];
  }, [resources]);

  const filteredResources = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matched = resources.filter((item) => {
      const matchesType = selectedType === "all" || item.resource_type === selectedType;
      const matchesSearch = !term || getSearchableText(item).includes(term);
      return matchesType && matchesSearch;
    });
    return sortResources(matched, sortMode);
  }, [resources, search, selectedType, sortMode]);

  const highlightedResources = useMemo(
    () => sortResources(filteredResources, "recommended").slice(0, 2),
    [filteredResources],
  );

  const compactTypes = useMemo(
    () =>
      Object.entries(summary?.by_type || ({} as Record<string, number>))
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 3),
    [summary],
  );

  const continueResources = useMemo(
    () => sortResources(filteredResources, "recommended").slice(0, 6),
    [filteredResources],
  );

  const organizedSections = useMemo(
    () => [
      {
        title: "先学这里",
        desc: "参考 LinkedIn Learning 的 My Learning，把最适合起步的收藏放在前面。",
        items: filteredResources.filter((item) =>
          ["course_overview", "lecture_note", "lecture_notes", "mind_map"].includes(item.resource_type),
        ),
      },
      {
        title: "练习强化",
        desc: "参考 Udemy 愿望单的待学逻辑，这一组适合学完就立刻做题或应用。",
        items: filteredResources.filter((item) =>
          ["practice_set", "quiz_set", "coding_lab", "case_study"].includes(item.resource_type),
        ),
      },
      {
        title: "考前和补充",
        desc: "参考 Skillshare 列表分组，把冲刺和补充资料单独放在一起。",
        items: filteredResources.filter((item) =>
          ["assessment_guide", "extended_reading", "teaching_plan"].includes(item.resource_type),
        ),
      },
    ].filter((section) => section.items.length > 0),
    [filteredResources],
  );

  const nextRecommendation = continueResources[0] || null;
  const visibleResources =
    activeTab === "continue"
      ? continueResources
      : activeTab === "organized"
        ? []
        : filteredResources;

  return (
    <div className="space-y-8 pb-24">
      <section className="overflow-hidden rounded-[36px] border border-outline-variant/50 bg-gradient-to-br from-[#0b2239] via-[#103557] to-[#136f63] p-8 text-white shadow-xl shadow-slate-900/10 md:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-white/80">
              <Bookmark className="h-4 w-4" />
              我的收藏
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tight">把收藏变成待学清单，而不是资料说明页</h1>
            <p className="mt-4 text-sm leading-8 text-white/80">
              这里参考了 Saved、Wishlist、My Learning 这类学习产品页面的写法，重点是先看什么、怎么继续、怎么快速回到学习流。
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-xl">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/65">收藏总数</div>
              <div className="mt-3 text-3xl font-bold">{summary?.total ?? resources.length}</div>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/65">最近收藏</div>
              <div className="mt-3 text-sm font-semibold leading-6">{formatTimeLabel(summary?.latest_favorite_at)}</div>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/65">常收藏类型</div>
              <div className="mt-3 text-sm font-semibold leading-6">
                {compactTypes.length ? compactTypes.map(([type]) => formatResourceType(type)).join(" / ") : "还没有分类偏好"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">{error}</div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[30px] border border-outline-variant/40 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索标题、摘要、学习建议、来源"
                className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low px-11 py-3.5 text-sm text-on-surface outline-none transition-colors focus:border-primary"
              />
            </label>
            <a
              href={`/resources?courseId=${courseId}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-outline-variant/40 bg-white px-5 text-sm font-bold text-on-surface transition-colors hover:border-primary/35 hover:text-primary"
            >
              <FolderOpen className="h-4 w-4" />
              去资料中心
            </a>
          </div>
        </div>

        <div className="rounded-[30px] border border-outline-variant/40 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-primary">快速筛选</div>
              <div className="mt-1 text-sm text-on-surface-variant">先按类型收缩范围，再决定先学哪条。</div>
            </div>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Filter className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedType(cat.value)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-bold transition-colors",
                  selectedType === cat.value
                    ? "border-on-surface bg-on-surface text-white"
                    : "border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:border-primary/35 hover:text-primary",
                )}
              >
                {cat.name}
                <span className="ml-2 opacity-60">{cat.count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="rounded-[30px] border border-outline-variant/40 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                {VIEW_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm font-bold transition-colors",
                      activeTab === tab.value ? "bg-on-surface text-white" : "bg-surface-container-low text-on-surface-variant hover:text-primary",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <label className="inline-flex items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="font-semibold">排序</span>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="bg-transparent font-semibold text-on-surface outline-none"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {!loading && highlightedResources.length ? (
            <section className="space-y-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-primary">优先打开</div>
                  <h2 className="mt-2 text-2xl font-bold text-on-surface">先看这几条，最快进入状态</h2>
                </div>
                <div className="text-sm text-on-surface-variant">{filteredResources.length} 条符合当前筛选</div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                {highlightedResources.map((item, index) => (
                  <article
                    key={`${item.resource_id || item.title}-${index}`}
                    className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#f6f1df] via-[#fff9ef] to-[#ecf8f2] p-7 shadow-sm ring-1 ring-black/5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-primary">{formatResourceType(item.resource_type)}</div>
                        <h3 className="mt-3 text-2xl font-bold text-on-surface">{item.title}</h3>
                      </div>
                      <div className="rounded-full bg-white p-2 text-primary shadow-sm">
                        <Sparkles className="h-5 w-5" />
                      </div>
                    </div>

                    <p className="mt-4 line-clamp-3 text-sm leading-7 text-on-surface-variant">{item.summary}</p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {item.source_titles.slice(0, 4).map((source) => (
                        <span key={source} className="rounded-full bg-white/85 px-3 py-1 text-xs text-on-surface-variant ring-1 ring-black/5">
                          {source}
                        </span>
                      ))}
                    </div>

                    <div className="mt-6 rounded-3xl bg-white/80 p-4 ring-1 ring-black/5">
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-primary">
                        <Clock3 className="h-4 w-4" />
                        学习建议
                      </div>
                      <p className="mt-2 text-sm leading-7 text-on-surface">
                        {item.study_suggestion || "建议把这条资料作为本轮学习的第一入口，先过一遍再进入细节。"}
                      </p>
                    </div>

                    <div className="mt-4 inline-flex rounded-full bg-on-surface/5 px-3 py-1 text-xs font-semibold text-on-surface-variant">
                      {getLearningStageLabel(item.resource_type)}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <a
                        href={buildResourceDetailUrl(courseId, item.resource_id)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-on-surface px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                      >
                        继续学习
                        <ArrowRight className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => void handleToggleFavorite(item.resource_id)}
                        disabled={item.resource_id ? updatingIds.includes(item.resource_id) : true}
                        className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant/50 bg-white px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        取消收藏
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-primary">收藏列表</div>
                <h2 className="mt-2 text-2xl font-bold text-on-surface">
                  {activeTab === "continue" ? "先处理这些最值得继续的资料" : activeTab === "organized" ? "按学习场景整理你的收藏" : "所有收藏都能直接操作"}
                </h2>
              </div>
              <div className="text-sm text-on-surface-variant">
                {activeTab === "continue"
                  ? "把收藏页做成待学队列，更接近真实学习产品。"
                  : activeTab === "organized"
                    ? "把收藏按任务场景重排，而不是只按时间堆在一起。"
                    : "打开资料、查看摘要、移出收藏，都在卡片上直接完成。"}
              </div>
            </div>

            {loading ? (
              <div className="rounded-[28px] border border-outline-variant/40 bg-white px-6 py-10 text-sm text-on-surface-variant shadow-sm">
                正在加载你的收藏资料...
              </div>
            ) : null}

            {!loading && activeTab === "organized" && organizedSections.length ? (
              <div className="space-y-5">
                {organizedSections.map((section) => (
                  <div key={section.title} className="rounded-[28px] border border-outline-variant/40 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-2 border-b border-outline-variant/20 pb-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-primary">
                          <ListChecks className="h-4 w-4" />
                          {section.title}
                        </div>
                        <p className="mt-2 text-sm leading-7 text-on-surface-variant">{section.desc}</p>
                      </div>
                      <div className="text-sm font-semibold text-on-surface-variant">{section.items.length} 条资料</div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {section.items.map((item, index) => {
                        const isUpdating = item.resource_id ? updatingIds.includes(item.resource_id) : false;
                        return (
                          <article
                            key={`${section.title}-${item.resource_id || item.title}-${index}`}
                            className="rounded-3xl bg-surface-container-low p-5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-xs font-black uppercase tracking-[0.16em] text-primary">{formatResourceType(item.resource_type)}</div>
                                <h3 className="mt-3 text-lg font-bold text-on-surface">{item.title}</h3>
                              </div>
                              <button
                                onClick={() => void handleToggleFavorite(item.resource_id)}
                                disabled={isUpdating || !item.resource_id}
                                className="rounded-full bg-white p-2 text-on-surface-variant transition-colors hover:text-rose-600 disabled:opacity-60"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <p className="mt-3 line-clamp-2 text-sm leading-7 text-on-surface-variant">{item.summary}</p>
                            <div className="mt-4 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-on-surface-variant">
                              {getLearningStageLabel(item.resource_type)}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {item.source_titles.slice(0, 3).map((source) => (
                                <span key={source} className="rounded-full bg-white px-3 py-1 text-xs text-on-surface-variant">
                                  {source}
                                </span>
                              ))}
                            </div>
                            <a href={buildResourceDetailUrl(courseId, item.resource_id)} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">
                              打开资料
                              <ArrowRight className="h-4 w-4" />
                            </a>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {!loading && activeTab !== "organized" && visibleResources.length ? (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {visibleResources.map((item, index) => {
                  const isUpdating = item.resource_id ? updatingIds.includes(item.resource_id) : false;
                  return (
                    <article
                      key={`${item.resource_id || item.title}-${index}`}
                      className="rounded-[28px] border border-outline-variant/40 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                            {formatResourceType(item.resource_type)}
                          </div>
                          <h3 className="mt-4 text-xl font-bold text-on-surface">{item.title}</h3>
                        </div>
                        <div className="rounded-full bg-primary text-white p-2 shadow-sm">
                          <Bookmark className="h-4 w-4" />
                        </div>
                      </div>

                      <p className="mt-4 line-clamp-3 text-sm leading-7 text-on-surface-variant">{item.summary}</p>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {item.source_titles.slice(0, 4).map((source) => (
                          <span key={source} className="rounded-full bg-surface-variant/35 px-3 py-1 text-xs text-on-surface-variant">
                            {source}
                          </span>
                        ))}
                      </div>

                      <div className="mt-5 rounded-2xl bg-surface-container-low p-4">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-primary">怎么用这条资料</div>
                        <p className="mt-2 text-sm leading-7 text-on-surface">
                          {item.study_suggestion || "建议作为当前知识点的补充材料，先看摘要，再进入完整内容。"}
                        </p>
                      </div>

                      <div className="mt-4 inline-flex rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
                        {getLearningStageLabel(item.resource_type)}
                      </div>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <a
                          href={buildResourceDetailUrl(courseId, item.resource_id)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-on-surface px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                        >
                          打开资料
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => void handleToggleFavorite(item.resource_id)}
                          disabled={isUpdating || !item.resource_id}
                          className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant/50 bg-white px-4 py-3 text-sm font-bold text-on-surface transition-colors hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          {isUpdating ? "处理中..." : "移出收藏"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}

            {!loading &&
            ((activeTab === "organized" && organizedSections.length === 0) || (activeTab !== "organized" && visibleResources.length === 0)) ? (
              <div className="rounded-[28px] border border-dashed border-outline-variant/50 bg-white px-6 py-12 text-center shadow-sm">
                <div className="text-2xl font-bold text-on-surface">当前筛选下没有收藏资料</div>
                <p className="mt-3 text-sm leading-7 text-on-surface-variant">换个类型、清空搜索，或者去资料中心把常用内容收进来。</p>
                <a href={`/resources?courseId=${courseId}`} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white">
                  去资料中心找资料
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[30px] border border-outline-variant/40 bg-white p-6 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-primary">下一步建议</div>
            {nextRecommendation ? (
              <>
                <h3 className="mt-3 text-xl font-bold text-on-surface">{nextRecommendation.title}</h3>
                <p className="mt-3 text-sm leading-7 text-on-surface-variant">{nextRecommendation.summary}</p>
                <div className="mt-4 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {getLearningStageLabel(nextRecommendation.resource_type)}
                </div>
                <a
                  href={buildResourceDetailUrl(courseId, nextRecommendation.resource_id)}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary"
                >
                  现在去学
                  <ArrowRight className="h-4 w-4" />
                </a>
              </>
            ) : (
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">先收藏几条资料，这里就会开始给你推荐下一步。</p>
            )}
          </div>

          <div className="rounded-[30px] border border-outline-variant/40 bg-white p-6 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-primary">这个页像什么</div>
            <div className="mt-4 space-y-3 text-sm leading-7 text-on-surface-variant">
              <p>像 LinkedIn Learning 的 My Learning：先看待继续内容。</p>
              <p>像 Udemy 的 Wishlist：先把想学的收起来，再统一进入。</p>
              <p>像 Skillshare 的 Lists：允许按学习场景重新整理收藏。</p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
