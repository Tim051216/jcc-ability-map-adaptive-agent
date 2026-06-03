/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  Bookmark,
  FileText,
  Star,
  PlayCircle,
  Trash2,
  ListRestart
} from "lucide-react";
import { COURSES } from "../constants";
import { studentApi, type ResourceCard } from "../lib/studentApi";

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

function inferFileTypeFromExtension(extension?: string | null): FavoriteHandout["type"] {
  const normalized = (extension || "").toLowerCase();
  if (normalized === ".pdf") return "pdf";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(normalized)) return "image";
  if ([".mp4", ".webm", ".mov", ".m3u8"].includes(normalized)) return "video";
  return "text";
}

function inferFormatFromMime(extension?: string | null, mimeType?: string | null) {
  if (mimeType?.includes("pdf")) return "PDF Document";
  if (mimeType?.startsWith("image/")) return "PNG Graphic";
  if (mimeType?.startsWith("video/")) return "Video File";
  return `${(extension || ".txt").replace(/^\./, "").toUpperCase()} File`;
}

function formatFileSize(fileSize?: number | null) {
  if (!fileSize || fileSize <= 0) return "Unknown";
  if (fileSize >= 1024 * 1024) return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
  if (fileSize >= 1024) return `${Math.round(fileSize / 1024)} KB`;
  return `${fileSize} B`;
}

function mapFavoriteResourcesToHandouts(items: ResourceCard[]): FavoriteHandout[] {
  return items.flatMap((resource) =>
    (resource.source_files || []).map((file) => ({
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
    })),
  );
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

export default function Collection() {
  const navigate = useNavigate();

  // Selected filter state
  const [activeTab, setActiveTab] = useState<"All" | "Courses" | "Handouts">("All");

  // Local state for interactive items representing favorite nodes
  const [favoriteCourses, setFavoriteCourses] = useState([COURSES[0], COURSES[1]]);
  const [favoriteHandouts, setFavoriteHandouts] = useState<FavoriteHandout[]>([]);
  const [loadingHandouts, setLoadingHandouts] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search filter query state
  const [searchQuery, setSearchQuery] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2850);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadFavorites() {
      setLoadingHandouts(true);
      try {
        const response = await studentApi.listFavoriteResources(1001);
        if (cancelled) {
          return;
        }
        setFavoriteHandouts(mapFavoriteResourcesToHandouts(response.items));
      } catch {
        if (cancelled) {
          return;
        }
        setFavoriteHandouts([]);
      } finally {
        if (!cancelled) {
          setLoadingHandouts(false);
        }
      }
    }

    void loadFavorites();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleResetPresets = () => {
    setFavoriteCourses([COURSES[0], COURSES[1]]);
    setSearchQuery("");
    showToast("已重置筛选条件。");
  };

  const handleRemoveCourse = (id: string) => {
    setFavoriteCourses(favoriteCourses.filter((c) => c.id !== id));
    showToast("已成功为您移出微课视频收藏。");
  };

  const handleRemoveHandout = (id: string) => {
    setFavoriteHandouts(favoriteHandouts.filter((h) => h.id !== id));
    showToast("已成功为您移出文献课件收藏。");
  };

  const handleOpenHandout = (file: FavoriteHandout) => {
    navigate(`/resources/preview?courseId=${file.courseId}&resourceId=${file.resourceId}&fileId=${file.fileId}`, {
      state: {
        initialResource: file.rawResource || null,
        initialFileId: Number.isFinite(Number(file.fileId)) ? Number(file.fileId) : null,
        initialPreviewFile: {
          file_id: Number.isFinite(Number(file.fileId)) ? Number(file.fileId) : -1,
          display_name: file.title,
          relative_path: file.previewUrl || file.title,
          top_level_category: "收藏资料",
          file_extension: inferSyntheticFileExtension(file),
          mime_type: inferSyntheticMimeType(file),
          file_size: null,
          preview_text: file.excerpt || null,
          is_inline_previewable: true,
          preview_mode: file.type === "text" ? "text" : file.type,
          preview_url:
            file.previewUrl && (file.previewUrl.startsWith("/") || /^https?:\/\//i.test(file.previewUrl))
              ? file.previewUrl
              : null,
          open_url:
            file.previewUrl && (file.previewUrl.startsWith("/") || /^https?:\/\//i.test(file.previewUrl))
              ? file.previewUrl
              : "",
        },
      },
    });
  };

  const tabMap = {
    All: "全部收藏",
    Courses: "精品微课视频",
    Handouts: "随堂幻灯课件"
  };

  // Perform multi-dimensional search filtering
  const filteredCourses = favoriteCourses.filter(course => {
    const courseTitleZh = course.title + " 前沿机器学习实战：极深反向传播与梯度策略 现代化 React 架构：极致组件虚拟化与 Context 多维切片";
    return courseTitleZh.toLowerCase().includes(searchQuery.toLowerCase()) || 
           course.subtitle?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredHandouts = favoriteHandouts.filter(file => {
    return file.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
           file.courseTitle.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6 select-none" id="collection-workspace">
      
      {/* 1. Header Hero detailing collection parameters */}
      <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-bold text-[#fb7299] tracking-wider font-mono">
            Personal Study Binder • 个人随堂知识夹
          </span>
          <h1 className="font-sans text-2xl lg:text-3xl font-extrabold text-[#171c22]">
            我的综合研学收藏夹
          </h1>
          <p className="text-sm text-[#564145] font-sans">
            分类汇集、检索与复习您在各个微课堂及精品研学中添加收藏的微课视频、随堂文献讲义，帮助您随时温旧知新。
          </p>
        </div>

        {/* Global item counts wrapper */}
        <div className="p-4 bg-[#fb7299]/5 border border-[#fb7299]/20 rounded-2xl flex items-center gap-3 shrink-0">
          <Heart className="w-8 h-8 text-[#fb7299] shrink-0 fill-[#fb7299]" />
          <div>
            <p className="text-[9px] text-[#564145] font-bold uppercase font-sans">已收藏条目总数</p>
            <p className="text-sm font-extrabold text-[#171c22]">
              共 {favoriteCourses.length + favoriteHandouts.length} 个研学资源
            </p>
          </div>
        </div>
      </section>

      {/* 2. Selection Tabs filter bar with live search & restore actions */}
      <section className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white p-4.5 rounded-3xl border border-[#E3E8EC] shadow-sm">
        {/* Tab Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {(["All", "Courses", "Handouts"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#fb7299] text-white shadow-xs"
                    : "bg-[#eaeef6]/45 text-[#564145] hover:bg-[#eaeef6]/80"
                }`}
              >
                {tabMap[tab]}
              </button>
            );
          })}
        </div>

        {/* Live Search Input & Reset Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-grow lg:max-w-xl">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="全域搜索收藏夹 (关键词, 关联讲课, 课件等)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50/70 hover:bg-slate-50 text-xs text-[#171c22] placeholder-slate-400 border border-[#E3E8EC] focus:border-[#fb7299] focus:bg-white rounded-xl pl-3.5 pr-8 py-2 focus:outline-hidden transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                ×
              </button>
            )}
          </div>

          <button
            onClick={handleResetPresets}
            className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-[11px] border border-[#E3E8EC] rounded-xl px-3.5 py-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            title="复置收藏夹为学术示范初始配置"
          >
            <ListRestart className="w-3.5 h-3.5 text-[#fb7299]" />
            <span>重置恢复范本</span>
          </button>
        </div>
      </section>

      {/* 3. Render lists of bookmarked items in grid layout */}
      <section className="space-y-6">
        
        {/* Render Saved Courses if selected */}
        {(activeTab === "All" || activeTab === "Courses") && (
          <div className="space-y-4">
            {filteredCourses.length > 0 && (
              <h3 className="font-sans text-xs font-extrabold tracking-wider uppercase text-[#564145] pl-1">
                已收藏的高性能微课视频 ({filteredCourses.length})
              </h3>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredCourses.map((course) => {
                let courseTitleZh = course.title;
                if (course.title.includes("Advanced Machine Learning")) courseTitleZh = "前沿机器学习实战：极深反向传播与梯度策略";
                if (course.title.includes("Modern React Architecture")) courseTitleZh = "现代化 React 架构：极致组件虚拟化与 Context 多维切片";

                let courseSubtitleZh = course.subtitle;
                if (course.subtitle?.includes("Dive deep into deep neural networks")) courseSubtitleZh = "深度剥丝抽茧梯度传播误差与调优公式原理";
                if (course.subtitle?.includes("Master virtual rendering")) courseSubtitleZh = "全面理解 React Fiber 树的级联调度与拦截策略";

                return (
                  <div
                    id={`favorite-course-${course.id}`}
                    key={course.id}
                    className="bg-white border border-[#E3E8EC] rounded-3xl overflow-hidden flex flex-col sm:flex-row hover:shadow-lg transition-shadow group shrink-0"
                  >
                    {/* Image container */}
                    <button
                      type="button"
                      onClick={() => navigate(`/learn?courseId=${course.id}`)}
                      className="sm:w-44 aspect-video sm:aspect-square bg-slate-100 shrink-0 relative overflow-hidden text-left cursor-pointer"
                    >
                      <img
                        src={course.image}
                        alt={courseTitleZh}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute bottom-2 right-2 bg-black/75 text-white font-mono text-[9px] px-1.5 py-0.5 rounded">
                        {course.duration}
                      </div>
                    </button>

                    {/* Metadata and Actions section */}
                    <div className="p-5 flex flex-col justify-between flex-grow gap-4 min-w-0">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="bg-[#fb7299]/15 text-[#fb7299] text-[9px] font-extrabold px-2 py-0.2 rounded font-mono uppercase">
                            {course.category === "Machine Learning" ? "机器学习" : "前端开发"}
                          </span>
                          <button
                            onClick={() => handleRemoveCourse(course.id)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                            title="取消收藏"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => navigate(`/learn?courseId=${course.id}`)}
                          className="block text-left font-sans text-sm font-extrabold text-[#171c22] leading-snug truncate group-hover:text-[#fb7299] transition-colors cursor-pointer"
                        >
                          {courseTitleZh}
                        </button>
                        <p className="text-[11px] text-[#564145] leading-snug truncate opacity-90">{courseSubtitleZh}</p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-50 text-[10px] text-[#564145]">
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-500 stroke-none" />
                          <strong>{course.rating}</strong> ({course.views}次精听)
                        </span>
                        <button
                          onClick={() => navigate(`/learn?courseId=${course.id}`)}
                          className="text-xs font-bold text-[#006689] hover:underline flex items-center gap-0.5 font-sans cursor-pointer"
                        >
                          <PlayCircle className="w-4 h-4 shrink-0" />
                          进入研习
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Render Saved Handouts if selected */}
        {(activeTab === "All" || activeTab === "Handouts") && (
          <div className="space-y-4">
            {filteredHandouts.length > 0 && (
              <h3 className="font-sans text-xs font-extrabold tracking-wider uppercase text-[#564145] pl-1 pt-2">
                已收藏的随堂文献讲义与代码包 ({filteredHandouts.length})
              </h3>
            )}

            <div className="space-y-3">
              {loadingHandouts ? (
                <div className="rounded-2xl border border-[#E3E8EC] bg-white px-4 py-6 text-sm text-[#564145]">
                  正在加载资料收藏...
                </div>
              ) : null}
              {filteredHandouts.map((file) => (
                <div
                  id={`favorite-handout-${file.id}`}
                  key={file.id}
                  className="p-4 bg-white border border-[#E3E8EC] rounded-2xl hover:border-gray-300 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0 border border-red-100 text-red-500">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-[#171c22] truncate">{file.title}</p>
                      <p className="text-[10px] text-[#564145]/70 font-mono mt-0.5">
                        {file.format} • {file.size} • 关联讲课: <strong className="text-[#006689]">{file.courseTitle}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 shrink-0 select-none">
                    <button
                    onClick={() => handleRemoveHandout(file.id)}
                      className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                      title="取消收藏"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenHandout(file)}
                      className="bg-[#006689] hover:bg-[#006689]/95 text-white font-bold text-xs px-4 py-1.8 rounded-xl flex items-center gap-1 shadow transition-all cursor-pointer"
                    >
                      <span>预览文献</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty status check */}
        {((activeTab === "Courses" && filteredCourses.length === 0) ||
          (activeTab === "Handouts" && filteredHandouts.length === 0) ||
          (filteredCourses.length === 0 && filteredHandouts.length === 0)) && (
          <div className="bg-white border rounded-3xl p-16 text-center select-none">
            <Bookmark className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <h4 className="font-sans text-sm font-bold text-[#171c22]">未匹配到符合您检索或筛选条件的书签信息</h4>
            <p className="text-xs text-[#564145] mt-1">请尝试修改您的检索关键字，或者点击上方“重置恢复范本”一键载入学术默认列表。</p>
            <div className="mt-4 flex gap-2 justify-center">
              <button
                onClick={handleResetPresets}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold px-4 py-2 rounded-xl border cursor-pointer"
              >
                重置列表
              </button>
              <button
                onClick={() => navigate("/")}
                className="bg-[#fb7299] hover:bg-[#fb7299]/90 text-white text-xs font-extrabold px-4 py-2 rounded-xl cursor-pointer"
              >
                去微课堂找灵感
              </button>
            </div>
          </div>
        )}

      </section>

      {/* Beautiful In-App Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#171c22]/95 text-white text-xs font-bold px-5 py-3 rounded-full shadow-2xl z-50 flex items-center gap-2 border border-white/10 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <span className="w-2 h-2 rounded-full bg-[#fb7299] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
