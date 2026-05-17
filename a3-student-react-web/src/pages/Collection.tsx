import React, { useEffect, useMemo, useState } from "react";
import { Bookmark, Calendar, Download, FileText, Filter, Search, Sparkles, Tag } from "lucide-react";
import {
  studentApi,
  type ResourceCard,
  type ResourceFavoriteSummaryResponse,
} from "../lib/studentApi";
import { cn } from "../lib/utils";

const DEFAULT_USER_ID = 1001;

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
  };
  return map[type] || type;
}

export function Collection() {
  const [resources, setResources] = useState<ResourceCard[]>([]);
  const [summary, setSummary] = useState<ResourceFavoriteSummaryResponse | null>(null);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of resources) {
      counts.set(item.resource_type, (counts.get(item.resource_type) || 0) + 1);
    }
    return [
      { name: "全部收藏", value: "all", count: resources.length },
      ...Array.from(counts.entries()).map(([type, count]) => ({
        name: formatResourceType(type),
        value: type,
        count,
      })),
    ];
  }, [resources]);

  const filteredResources = useMemo(() => {
    return resources.filter((item) => {
      const matchesType = selectedType === "all" || item.resource_type === selectedType;
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        item.title.toLowerCase().includes(term) ||
        item.summary.toLowerCase().includes(term) ||
        item.source_titles.some((source) => source.toLowerCase().includes(term));
      return matchesType && matchesSearch;
    });
  }, [resources, search, selectedType]);

  return (
    <div className="space-y-8 pb-20">
      <section className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-on-surface">我的收藏资源</h1>
          <p className="mt-2 text-lg text-on-surface-variant">
            当前页面直接读取 `/api/v1/resource/favorites` 中的真实收藏资源，不再依赖浏览器本地存储。
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button className="flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-6 py-3 font-bold text-on-surface shadow-sm transition-all hover:bg-surface-container-low">
            <Download className="h-5 w-5" />
            导出视图
          </button>
          <div className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-white shadow-lg shadow-primary/20">
            <Bookmark className="h-5 w-5" />
            {summary?.total ?? resources.length} 条实时收藏
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-8">
        <nav className="col-span-12 space-y-6 lg:col-span-3">
          <div className="rounded-2xl border border-outline-variant/30 bg-white p-4 shadow-sm">
            <h3 className="mb-4 px-4 text-[10px] font-bold uppercase tracking-wider text-outline-variant">收藏类型</h3>
            <ul className="space-y-2">
              {categories.map((cat) => (
                <li key={cat.value}>
                  <button
                    onClick={() => setSelectedType(cat.value)}
                    className={cn(
                      "w-full rounded-xl px-4 py-3 text-left text-sm font-bold transition-all",
                      selectedType === cat.value ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-surface-container-low",
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-3">
                        <Tag className={cn("h-4 w-4", selectedType === cat.value ? "text-primary" : "text-on-surface-variant/60")} />
                        {cat.name}
                      </span>
                      <span className="text-[10px] font-black opacity-60">{cat.count}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <section className="col-span-12 space-y-6 lg:col-span-9">
          <div className="flex flex-col gap-4 rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="按标题、摘要或来源知识点搜索"
                className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-11 py-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-on-surface-variant">
              <Filter className="h-4 w-4" />
              {filteredResources.length} 条收藏资源
            </div>
          </div>

          {summary ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-outline-variant">收藏总数</div>
                <div className="mt-2 text-3xl font-black text-on-surface">{summary.total}</div>
              </div>
              <div className="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-outline-variant">最近收藏</div>
                <div className="mt-2 text-sm font-bold text-on-surface">{summary.latest_favorite_at || "暂无时间记录"}</div>
              </div>
              <div className="rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-outline-variant">资源类型</div>
                <div className="mt-2 text-sm font-bold text-on-surface">{Object.keys(summary.by_type).map(formatResourceType).join("、") || "暂无"}</div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {filteredResources.map((item, index) => (
              <article
                key={`${item.resource_id || item.title}-${index}`}
                className="flex flex-col rounded-2xl border border-outline-variant/30 bg-white p-8 shadow-sm transition-all hover:shadow-xl"
              >
                <div className="mb-4 flex items-center justify-between gap-4">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
                    {formatResourceType(item.resource_type)}
                  </span>
                  <div className="rounded-full bg-primary text-white p-2">
                    <Bookmark className="h-4 w-4" />
                  </div>
                </div>

                <h4 className="text-xl font-bold text-on-surface">{item.title}</h4>
                <p className="mt-3 line-clamp-4 text-sm leading-7 text-on-surface-variant">{item.summary}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {item.source_titles.slice(0, 4).map((source) => (
                    <span key={source} className="rounded-full bg-surface-variant/60 px-3 py-1 text-[11px] text-on-surface-variant">
                      {source}
                    </span>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl bg-surface-variant/25 p-4">
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
                    <Sparkles className="h-4 w-4" />
                    学习建议
                  </div>
                  <p className="text-sm leading-7 text-on-surface-variant">
                    {item.study_suggestion || "建议结合当前学习路径检查点一起使用这条资源。"}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-outline-variant/10 pt-5 text-[11px] font-bold text-outline-variant">
                  <div className="flex items-center gap-2 uppercase tracking-widest">
                    <Calendar className="h-4 w-4" />
                    实时收藏
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {item.content_markdown.length} 字
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!loading && filteredResources.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant bg-white px-6 py-10 text-center text-sm text-on-surface-variant">
              当前筛选条件下没有匹配到收藏资源。
            </div>
          ) : null}

          {loading ? <div className="text-sm text-on-surface-variant">正在加载实时收藏资源...</div> : null}
        </section>
      </div>
    </div>
  );
}
