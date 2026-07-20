/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ExternalLink, FileText, Loader2, Play, Search, Tv } from "lucide-react";

import { getCurrentLoggedInUserId } from "../lib/currentUser";
import { resolveBackendCourseCode, resolveBackendCourseId } from "../lib/courseRouting";
import { buildResourcesRoute, resolveSearchRouteCourseId } from "../lib/routeCourseContext";
import { studentApi, type LearningCourseDetail, type ResourceCard } from "../lib/studentApi";

type SearchKind = "video" | "resource";
type SearchTab = "all" | "video" | "resource" | "web";

type SearchResultItem = {
  id: string;
  kind: SearchKind;
  courseId: string;
  courseTitle: string;
  title: string;
  summary: string;
  meta: string;
  href: string;
  scoreText: string;
  coverUrl?: string;
  videoSrc?: string;
  duration?: string;
  stats?: string;
  author?: string;
};

type WebResultItem = {
  id: string;
  title: string;
  summary: string;
  source: string;
  href: string;
  tag: string;
};

const COURSE_CATALOG = [
  {
    courseId: "series-2",
    title: "软件工程与实践（第4版）",
    keywords: "软件工程 需求分析 系统设计 软件测试 项目管理 生命周期 UML 用例 接口 维护",
  },
  {
    courseId: "series-1",
    title: "现代网页设计系统实战",
    keywords: "Vue React 前端 网页 页面 组件 设计系统 CSS HTML JavaScript TypeScript Vite",
  },
  {
    courseId: "series-3",
    title: "微交互与界面动效设计",
    keywords: "动效 交互 界面 动画 反馈",
  },
  {
    courseId: "course-4",
    title: "数据叙事与可视化表达",
    keywords: "数据 可视化 图表 分析 表达",
  },
] as const;

const VIDEO_COVERS = [
  "/search-thumbs/software-crisis.jpg?v=20260717b",
  "/search-thumbs/process-model.jpg?v=20260717b",
  "/search-thumbs/requirements-design.jpg?v=20260717b",
  "/search-thumbs/testing-management.jpg?v=20260717b",
  "/search-thumbs/vue-workbench.jpg?v=20260717b",
  "/search-thumbs/design-system.jpg?v=20260717b",
];

const VIDEO_SOURCES = [
  "/videos/software-engineering-4th/project-demo.mp4",
  "/videos/software-engineering-4th/visio-flow-demo.mp4",
  "/videos/software-engineering-4th/cloud-app-demo.mp4",
];

const FALLBACK_VIDEOS: Record<string, Array<{ sectionId: number; title: string; summary: string; meta: string; coverUrl: string; videoSrc: string; duration: string; stats: string; author: string }>> = {
  "series-2": [
    {
      sectionId: 40111,
      title: "软件工程到底解决什么问题？从软件危机讲到工程化",
      summary: "理解软件工程要解决的项目失控、质量不可控和协作成本问题。",
      meta: "视频 · 第 1 讲",
      coverUrl: VIDEO_COVERS[0],
      videoSrc: VIDEO_SOURCES[0],
      duration: "12:38",
      stats: "1.2万播放 · 246弹幕 · 2026-07-08",
      author: "软件工程课程组",
    },
    {
      sectionId: 40112,
      title: "瀑布、原型、增量、螺旋模型怎么选？一节课讲清",
      summary: "对比瀑布、原型、增量与螺旋模型的适用场景。",
      meta: "视频 · 第 2 讲",
      coverUrl: VIDEO_COVERS[1],
      videoSrc: VIDEO_SOURCES[1],
      duration: "16:24",
      stats: "8,632播放 · 118弹幕 · 2026-07-09",
      author: "软件工程课程组",
    },
    {
      sectionId: 40122,
      title: "需求分析到总体设计：用例、规格说明和系统边界",
      summary: "从需求获取、用例建模到总体设计说明的完整链路。",
      meta: "视频 · 第 4 讲",
      coverUrl: VIDEO_COVERS[2],
      videoSrc: VIDEO_SOURCES[2],
      duration: "18:09",
      stats: "9,421播放 · 163弹幕 · 2026-07-10",
      author: "软件工程课程组",
    },
    {
      sectionId: 40132,
      title: "软件测试和项目协作：测试计划、回归测试、任务拆分",
      summary: "覆盖测试计划、回归测试、任务拆分和进度协同。",
      meta: "视频 · 第 6 讲",
      coverUrl: VIDEO_COVERS[3],
      videoSrc: VIDEO_SOURCES[0],
      duration: "14:52",
      stats: "7,205播放 · 92弹幕 · 2026-07-11",
      author: "软件工程课程组",
    },
  ],
  "series-1": [
    {
      sectionId: 20111,
      title: "Vue 3 项目工程化与页面结构",
      summary: "围绕前端项目组织、组件边界和页面搭建展开。",
      meta: "视频 · 第 1 讲",
      coverUrl: VIDEO_COVERS[4],
      videoSrc: VIDEO_SOURCES[1],
      duration: "13:16",
      stats: "6,880播放 · 75弹幕 · 2026-07-07",
      author: "前端工程课程组",
    },
    {
      sectionId: 20112,
      title: "组件抽象与设计系统落地",
      summary: "梳理组件复用、状态边界和交互规范。",
      meta: "视频 · 第 2 讲",
      coverUrl: VIDEO_COVERS[5],
      videoSrc: VIDEO_SOURCES[2],
      duration: "15:41",
      stats: "5,403播放 · 61弹幕 · 2026-07-07",
      author: "前端工程课程组",
    },
  ],
};

const FALLBACK_RESOURCES: Record<string, Array<{ resourceId: number; title: string; summary: string; meta: string }>> = {
  "series-2": [
    { resourceId: 7001, title: "软件工程课程总览", summary: "建立软件工程基础、过程模型、需求分析、系统设计、测试维护与项目管理的整体结构。", meta: "资料 · 课程总览" },
    { resourceId: 7002, title: "需求分析速记卡", summary: "复盘需求获取、用例建模、需求规格说明和需求评审的关键点。", meta: "资料 · 讲义" },
    { resourceId: 7003, title: "软件测试练习题", summary: "围绕测试策略、回归测试、缺陷定位和项目协作进行测前热身。", meta: "资料 · 练习" },
  ],
  "series-1": [
    { resourceId: 20101, title: "Vue 3 项目工程化资源包", summary: "整理前端项目结构、组件抽象、状态管理和接口联调资料。", meta: "资料 · 资源包" },
    { resourceId: 20102, title: "设计系统落地讲义", summary: "围绕页面规范、组件复用和交互状态建立统一设计语言。", meta: "资料 · 讲义" },
  ],
};

const WEB_SOURCE_PRESETS = [
  { id: "bing", title: "Bing 全网检索", source: "Bing", tag: "综合搜索", url: (q: string) => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
  { id: "baidu", title: "百度全网检索", source: "Baidu", tag: "中文资料", url: (q: string) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}` },
  { id: "bilibili", title: "Bilibili 视频检索", source: "Bilibili", tag: "公开视频", url: (q: string) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(q)}` },
  { id: "github", title: "GitHub 项目检索", source: "GitHub", tag: "代码项目", url: (q: string) => `https://github.com/search?q=${encodeURIComponent(q)}&type=repositories` },
  { id: "scholar", title: "Google Scholar 学术检索", source: "Google Scholar", tag: "论文资料", url: (q: string) => `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}` },
] as const;

const COURSE_SEARCH_HINTS: Record<string, string> = {
  "series-2": "software engineering requirements design testing project management lifecycle UML use case",
  "series-1": "vue react frontend component design system css javascript typescript vite",
  "series-3": "interaction motion animation ui ux feedback",
  "course-4": "data visualization chart dashboard storytelling analytics",
};

const COURSE_GITHUB_HINTS: Record<string, string> = {
  "series-2": "software engineering project requirements testing",
  "series-1": "vue react design-system frontend",
  "series-3": "ui animation interaction motion",
  "course-4": "data visualization dashboard chart",
};

type WebSourceId = (typeof WEB_SOURCE_PRESETS)[number]["id"];

function getCourseSearchContext(courseId: string) {
  const course = COURSE_CATALOG.find((item) => item.courseId === courseId);
  return {
    title: course?.title || "当前课程",
    keywords: course?.keywords || "",
    hints: COURSE_SEARCH_HINTS[courseId] || "",
  };
}

function buildWebSearchQuery(sourceId: WebSourceId, keyword: string, courseId: string) {
  const context = getCourseSearchContext(courseId);
  const baseTerms = [keyword, context.title, context.keywords].filter(Boolean).join(" ").trim();
  const sourceSpecificHints = context.hints || context.keywords;
  switch (sourceId) {
    case "github":
      return `${COURSE_GITHUB_HINTS[courseId] || sourceSpecificHints} in:name,description,readme stars:>10`;
    case "baidu":
      return `${keyword} ${context.title} ${context.keywords} 课程 讲义 课件 习题`;
    case "scholar":
      return `${keyword} ${context.title} ${context.keywords} 教学 论文 PDF`;
    case "bilibili":
      return `${baseTerms} 教学 讲解 课程`;
    case "bing":
    default:
      return `${baseTerms} 教学 资料 代码 示例`;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Search request timeout")), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function normalizeText(value?: string | number | null) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildTokens(query: string) {
  const normalized = normalizeText(query);
  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
}

function includesQuery(text: string, tokens: string[]) {
  if (tokens.length === 0) return true;
  const normalized = normalizeText(text);
  return tokens.every((token) => normalized.includes(token));
}

function getCatalogTitle(courseId: string) {
  return COURSE_CATALOG.find((item) => item.courseId === courseId)?.title || "当前课程";
}

function getCatalogSearchText(courseId: string) {
  const course = COURSE_CATALOG.find((item) => item.courseId === courseId);
  return course ? `${course.title} ${course.keywords}` : "";
}

function buildResourcePreviewHref(courseId: string, resource: ResourceCard) {
  const params = new URLSearchParams({ courseId });
  if (resource.resource_id) {
    params.set("resourceId", String(resource.resource_id));
  }
  params.set("fileId", String(resource.resource_id || 900001));
  return `/resources/preview?${params.toString()}`;
}

function getVideoVisual(index: number) {
  return {
    coverUrl: VIDEO_COVERS[index % VIDEO_COVERS.length],
    videoSrc: VIDEO_SOURCES[index % VIDEO_SOURCES.length],
    duration: ["12:38", "16:24", "18:09", "14:52", "13:16", "15:41"][index % 6],
    stats: ["1.2万播放 · 246弹幕", "8,632播放 · 118弹幕", "9,421播放 · 163弹幕", "7,205播放 · 92弹幕"][index % 4],
  };
}

function buildFallbackResourceResults(courseId: string, query: string, courseTitle: string) {
  const tokens = buildTokens(query);
  return (FALLBACK_RESOURCES[courseId] || [])
    .filter((resource) => includesQuery([getCatalogSearchText(courseId), courseTitle, resource.title, resource.summary, resource.meta].join(" "), tokens))
    .map((resource) => ({
      id: `fallback-resource-${courseId}-${resource.resourceId}`,
      kind: "resource" as const,
      courseId,
      courseTitle,
      title: resource.title,
      summary: resource.summary,
      meta: resource.meta,
      href: buildResourcesRoute(courseId, query),
      scoreText: "本地可用资料",
    }));
}

function buildResourceResults(courseId: string, resources: ResourceCard[], query: string, courseTitle: string) {
  const tokens = buildTokens(query);
  return resources
    .filter((resource) =>
      includesQuery(
        [
          getCatalogSearchText(courseId),
          courseTitle,
          resource.title,
          resource.summary,
          resource.resource_type,
          resource.content_markdown,
          resource.study_suggestion,
          resource.source_titles?.join(" "),
          resource.source_files?.map((file) => `${file.display_name || ""} ${file.preview_text || ""}`).join(" "),
        ].join(" "),
        tokens,
      ),
    )
    .map((resource) => ({
      id: `resource-${courseId}-${resource.resource_id || resource.title}`,
      kind: "resource" as const,
      courseId,
      courseTitle,
      title: resource.title || "课程资料",
      summary: resource.summary || resource.study_suggestion || "可进入资料页查看正文、来源文件和学习建议。",
      meta: resource.source_file_count ? `资料 · ${resource.source_file_count} 个文件` : `资料 · ${resource.resource_type || "课程资源"}`,
      href: buildResourcePreviewHref(courseId, resource),
      scoreText: "匹配资料标题、摘要或正文",
    }));
}

function buildVideoResults(courseId: string, detail: LearningCourseDetail | null, query: string, courseTitle: string) {
  const tokens = buildTokens(query);
  const apiVideos =
    detail?.chapters.flatMap((chapter) =>
      chapter.sections.map((section, index) => {
        const visual = getVideoVisual(index);
        return {
          sectionId: section.id,
          title: section.name,
          summary: `${chapter.name} · ${Math.max(1, Math.round((section.media_duration || 0) / 60))} 分钟`,
          meta: `视频 · 第 ${section.index} 讲`,
          coverUrl: visual.coverUrl,
          videoSrc: visual.videoSrc,
          duration: visual.duration,
          stats: `${visual.stats} · 最近更新`,
          author: courseTitle,
        };
      }),
    ) || [];
  const candidates = apiVideos.length ? apiVideos : FALLBACK_VIDEOS[courseId] || [];

  return candidates
    .filter((video) => includesQuery([getCatalogSearchText(courseId), courseTitle, video.title, video.summary, video.meta].join(" "), tokens))
    .map((video) => ({
      id: `video-${courseId}-${video.sectionId}`,
      kind: "video" as const,
      courseId,
      courseTitle,
      title: video.title,
      summary: video.summary,
      meta: video.meta,
      href: `/learn?courseId=${courseId}&sectionId=${video.sectionId}`,
      scoreText: "匹配课程视频或章节主题",
      coverUrl: video.coverUrl,
      videoSrc: video.videoSrc,
      duration: video.duration,
      stats: video.stats,
      author: video.author,
    }));
}

function buildWebResults(query: string): WebResultItem[] {
  const keyword = query.trim();
  if (!keyword) return [];
  const courseId = resolveSearchRouteCourseId(keyword);
  return WEB_SOURCE_PRESETS.map((source) => ({
    id: `web-${source.id}`,
    title: `${source.title}：${keyword}`,
    source: source.source,
    tag: source.tag,
    href: source.url(buildWebSearchQuery(source.id, keyword, courseId)),
    summary: `跳转到 ${source.source} 检索「${keyword}」的具体资料；已按课程上下文补充更合适的关键词和站点约束。`,
  }));
}

async function loadCourseSearchResults(courseId: string, query: string, userId: number) {
  const backendCourseId = resolveBackendCourseId(courseId);
  const backendCourseCode = resolveBackendCourseCode(courseId);
  const [courseDetail, learningDetail, resourceList] = await Promise.allSettled([
    withTimeout(studentApi.getCourseDetail(backendCourseId), 3500),
    withTimeout(studentApi.getLearningCourseDetail(backendCourseId), 3500),
    withTimeout(studentApi.listResourcesByCourseCode(userId, backendCourseCode, undefined, 4500), 5200),
  ]);

  const courseTitle = courseDetail.status === "fulfilled" && courseDetail.value?.name ? courseDetail.value.name : getCatalogTitle(courseId);
  const videos = buildVideoResults(courseId, learningDetail.status === "fulfilled" ? learningDetail.value : null, query, courseTitle);
  const apiResources = buildResourceResults(courseId, resourceList.status === "fulfilled" ? resourceList.value.items || [] : [], query, courseTitle);
  const resources = apiResources.length ? apiResources : buildFallbackResourceResults(courseId, query, courseTitle);

  return { videos, resources };
}

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q")?.trim() || "";
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<SearchTab>("all");
  const userId = getCurrentLoggedInUserId();

  useEffect(() => {
    let cancelled = false;
    let apiTimer: number | undefined;
    async function runSearch() {
      if (!query) {
        setResults([]);
        setLoadFailed(false);
        return;
      }
      setIsLoading(true);
      setLoadFailed(false);
      const preferredCourseId = resolveSearchRouteCourseId(query);
      const preferredCourseTitle = getCatalogTitle(preferredCourseId);
      const fallbackResults = [
        ...buildVideoResults(preferredCourseId, null, query, preferredCourseTitle),
        ...buildFallbackResourceResults(preferredCourseId, query, preferredCourseTitle),
      ];
      setResults(fallbackResults);
      setIsLoading(false);
      const orderedCourses = [
        preferredCourseId,
        ...COURSE_CATALOG.map((course) => course.courseId).filter((courseId) => courseId !== preferredCourseId),
      ];
      apiTimer = window.setTimeout(() => {
        void (async () => {
          try {
            const loaded = await Promise.allSettled(orderedCourses.map((courseId) => loadCourseSearchResults(courseId, query, userId)));
            if (!cancelled) {
              const nextResults = loaded
                .flatMap((item) => (item.status === "fulfilled" ? [...item.value.videos, ...item.value.resources] : []))
                .slice(0, 40);
              setResults(nextResults.length ? nextResults : fallbackResults);
              setLoadFailed(loaded.some((item) => item.status === "rejected"));
            }
          } catch {
            if (!cancelled) {
              setResults(fallbackResults);
              setLoadFailed(true);
            }
          } finally {
            if (!cancelled) {
              setIsLoading(false);
            }
          }
        })();
      }, 900);
    }

    void runSearch();
    return () => {
      cancelled = true;
      if (apiTimer) {
        window.clearTimeout(apiTimer);
      }
    };
  }, [query, userId]);

  const videoResults = useMemo(() => results.filter((item) => item.kind === "video"), [results]);
  const resourceResults = useMemo(() => results.filter((item) => item.kind === "resource"), [results]);
  const webResults = useMemo(() => buildWebResults(query), [query]);
  const hasQuery = Boolean(query);
  const searchTabs: Array<{ id: SearchTab; label: string; count: number }> = [
    { id: "all", label: "综合", count: results.length + webResults.length },
    { id: "video", label: "视频", count: videoResults.length },
    { id: "resource", label: "资料", count: resourceResults.length },
    { id: "web", label: "全网", count: webResults.length },
  ];
  const showVideoResults = activeTab === "all" || activeTab === "video";
  const showResourceResults = activeTab === "all" || activeTab === "resource";
  const showWebResultsInMain = activeTab === "web";
  const showWebSidebar = activeTab === "all";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f6f7f8] text-[#18191c]">
      <section className="border-b border-[#e3e5e7] bg-white">
        <div className="mx-auto max-w-[1180px] px-4 py-5 md:px-8">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const nextQuery = String(formData.get("q") || "").trim();
              if (nextQuery) {
                navigate(`/search?q=${encodeURIComponent(nextQuery)}`);
              }
            }}
            className="mx-auto flex max-w-[720px] overflow-hidden rounded-md border border-[#00aeec] bg-white"
          >
            <input
              id="search-results-input"
              name="q"
              defaultValue={query}
              className="min-w-0 flex-1 px-4 py-2.5 text-[15px] outline-none"
              placeholder="搜索课程视频、讲义、练习资料"
            />
            <button type="submit" className="flex items-center gap-1 bg-[#00aeec] px-5 text-sm font-medium text-white transition hover:bg-[#009bd9]">
              <Search className="h-4 w-4" />
              搜索
            </button>
          </form>
          <div className="mt-5 flex flex-wrap items-center gap-7 border-b border-[#e3e5e7] text-sm">
            {searchTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={activeTab === tab.id}
                className={`relative pb-3 font-medium transition ${activeTab === tab.id ? "text-[#00aeec]" : "text-[#61666d] hover:text-[#00aeec]"}`}
              >
                {tab.label}
                <span className="ml-1 text-xs text-[#9499a0]">{tab.count}</span>
                {activeTab === tab.id ? <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-[#00aeec]" /> : null}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#9499a0]">
            <span>{hasQuery ? `搜索「${query}」` : "输入关键词后开始搜索"}</span>
            <span>课程视频、资料和公开视频入口会在这里汇总</span>
            {loadFailed ? <span className="text-[#f69b00]">部分接口暂时不可用，已展示本地可用内容</span> : null}
          </div>
        </div>
      </section>

      <main className={`mx-auto grid max-w-[1180px] gap-5 px-4 py-5 md:px-8 ${showWebSidebar ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "lg:grid-cols-1"}`}>
        <div className="min-w-0 space-y-5">

        {isLoading ? (
          <div className="flex min-h-[220px] items-center justify-center border border-[#d9dde3] bg-white text-sm font-bold text-[#4b5563]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#002FA7]" />
            正在同步更多真实资料
          </div>
        ) : null}

        {!isLoading && hasQuery && !results.length && !webResults.length ? (
          <div className="border border-[#d9dde3] bg-white p-8">
            <h2 className="text-xl font-black">没有找到匹配结果</h2>
            <p className="mt-2 text-sm text-[#4b5563]">可以换一个关键词，或先进入资源中心查看该课程的全部资料。</p>
            <Link className="mt-5 inline-flex items-center gap-2 bg-[#111827] px-4 py-2 text-sm font-black text-white" to={buildResourcesRoute(resolveSearchRouteCourseId(query), query)}>
              去资源中心
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}

        {!isLoading && (results.length || webResults.length) ? (
          <>
            {showVideoResults ? <VideoSection items={videoResults} /> : null}
            {showResourceResults ? <ResultSection title="资料结果" kind="resource" items={resourceResults} /> : null}
            {showWebResultsInMain ? <WebResultSection items={webResults} /> : null}
          </>
        ) : null}

        {loadFailed ? (
          <div className="border border-[#f59e0b] bg-[#fffbeb] px-4 py-3 text-xs font-bold text-[#92400e]">
            实时接口暂时不可用，当前先展示本地可用的视频、资料和全网检索入口。
          </div>
        ) : null}
        </div>
        {showWebSidebar ? (
          <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <WebResultSection items={webResults} />
          </aside>
        ) : null}
      </main>
    </div>
  );
}

function VideoSection({ items }: { items: SearchResultItem[] }) {
  const navigate = useNavigate();
  const coverStyles = [
    "from-[#00aeec] via-[#5cc8f4] to-[#eaf8ff]",
    "from-[#fb7299] via-[#ff9fbd] to-[#fff1f6]",
    "from-[#5b7cfa] via-[#8ea3ff] to-[#f0f3ff]",
    "from-[#22c55e] via-[#77d99a] to-[#effaf3]",
  ];
  return (
    <section className="rounded-md border border-[#e3e5e7] bg-white">
      <div className="flex items-center justify-between border-b border-[#e3e5e7] px-4 py-3">
        <div className="flex items-center gap-2">
          <Tv className="h-4 w-4 text-[#00aeec]" />
          <h2 className="text-sm font-black">视频结果</h2>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#9499a0]">
          <span>综合排序</span>
          <span>{items.length} 条</span>
        </div>
      </div>
      <div className="divide-y divide-[#f1f2f3]">
        {items.length ? (
          items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              data-search-result="video"
              onClick={() => navigate(item.href)}
              className="group flex w-full gap-4 px-4 py-4 text-left transition hover:bg-[#f6f7f8]"
            >
              <div className={`relative h-[108px] w-[192px] shrink-0 overflow-hidden rounded-md bg-gradient-to-br ${coverStyles[index % coverStyles.length]}`}>
                <div className="absolute inset-0 p-3 text-white">
                  <div className="inline-flex rounded bg-white/22 px-1.5 py-0.5 text-[10px] font-bold">{item.meta.replace("视频 · ", "")}</div>
                  <div className="mt-3 line-clamp-2 max-w-[140px] text-[15px] font-black leading-5 drop-shadow-sm">
                    {item.title}
                  </div>
                  <div className="absolute bottom-2 left-3 text-[10px] font-bold text-white/85">{item.author || item.courseTitle}</div>
                </div>
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    decoding="async"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-transparent" />
                <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-bold text-white">
                  {item.duration || "12:00"}
                </span>
                <span className="absolute left-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100">
                  <Play className="h-3.5 w-3.5 fill-current" />
                </span>
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <h3 className="line-clamp-2 text-[15px] font-semibold leading-6 text-[#18191c] group-hover:text-[#00aeec]">{item.title}</h3>
                <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-[#61666d]">{item.summary}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#9499a0]">
                  <span>{item.stats || "6,000播放 · 60弹幕"}</span>
                  <span>{item.author || item.courseTitle}</span>
                  <span>{item.meta}</span>
                </div>
                <div className="mt-2 inline-flex rounded border border-[#e3e5e7] bg-[#f6f7f8] px-2 py-0.5 text-[12px] font-medium text-[#61666d]">
                  {item.scoreText}
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="border border-dashed border-[#d9dde3] p-6 text-sm font-bold text-[#6b7280]">
            暂无匹配的视频。
          </div>
        )}
      </div>
    </section>
  );
}

function ResultSection({ title, kind, items }: { title: string; kind: SearchKind; items: SearchResultItem[] }) {
  const Icon = kind === "video" ? Tv : FileText;
  const navigate = useNavigate();
  return (
    <section className="rounded-md border border-[#e3e5e7] bg-white">
      <div className="flex items-center justify-between border-b border-[#d9dde3] px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[#00aeec]" />
          <h2 className="text-sm font-black">{title}</h2>
        </div>
        <span className="text-xs font-medium text-[#9499a0]">{items.length} 条</span>
      </div>
      <div className="divide-y divide-[#e5e7eb]">
        {items.length ? (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              data-search-result={kind}
              onClick={() => navigate(item.href)}
              className="group block w-full p-4 text-left transition hover:bg-[#f6f7f8]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#9499a0]">{item.courseTitle}</div>
                  <h3 className="mt-2 text-base font-semibold leading-6 text-[#18191c] group-hover:text-[#00aeec]">{item.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#4b5563]">{item.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-[#6b7280]">
                    <span className="rounded border border-[#e3e5e7] bg-[#f6f7f8] px-2 py-1">{item.meta}</span>
                    <span className="rounded border border-[#e3e5e7] bg-[#f6f7f8] px-2 py-1">{item.scoreText}</span>
                  </div>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#9499a0] transition group-hover:translate-x-1 group-hover:text-[#00aeec]" />
              </div>
            </button>
          ))
        ) : (
          <div className="p-6 text-sm font-bold text-[#6b7280]">暂无匹配的{kind === "video" ? "视频" : "资料"}。</div>
        )}
      </div>
    </section>
  );
}

function WebResultSection({ items }: { items: WebResultItem[] }) {
  return (
    <section className="rounded-md border border-[#e3e5e7] bg-white">
      <div className="flex items-center justify-between border-b border-[#d9dde3] px-4 py-3">
        <div className="flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-[#00aeec]" />
          <h2 className="text-sm font-black">全网线索</h2>
        </div>
        <span className="text-xs font-medium text-[#9499a0]">{items.length} 条</span>
      </div>
      <div className="divide-y divide-[#e5e7eb]">
        {items.map((item) => (
          <a key={item.id} href={item.href} target="_blank" rel="noreferrer" className="group block p-4 transition hover:bg-[#f6f7f8]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#9499a0]">{item.source}</div>
                <h3 className="mt-2 text-sm font-semibold leading-6 text-[#18191c] group-hover:text-[#00aeec]">{item.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#4b5563]">{item.summary}</p>
                <div className="mt-3 inline-flex rounded border border-[#e3e5e7] bg-[#f6f7f8] px-2 py-1 text-[11px] font-bold text-[#6b7280]">{item.tag}</div>
              </div>
              <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-[#9499a0] transition group-hover:translate-x-1 group-hover:text-[#00aeec]" />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
