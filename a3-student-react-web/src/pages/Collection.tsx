import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bookmark,
  FileText,
  Heart,
  ListRestart,
  PlayCircle,
  Star,
  Trash2,
} from "lucide-react";
import {
  ACTIVE_COURSE_ID,
  ACTIVE_USER_ID,
  buildLearnRoute,
  buildResourcePreviewRoute,
  buildResourcesRoute,
} from "../lib/courseContext";
import { resolveCourseCoverUrl, studentApi, type CourseCard, type ResourceCard } from "../lib/studentApi";

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
  if (mimeType?.startsWith("image/")) return "Image File";
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
      courseId: String(ACTIVE_COURSE_ID),
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
  const [activeTab, setActiveTab] = useState<"All" | "Courses" | "Handouts">("All");
  const [favoriteCourses, setFavoriteCourses] = useState<CourseCard[]>([]);
  const [favoriteHandouts, setFavoriteHandouts] = useState<FavoriteHandout[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingHandouts, setLoadingHandouts] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2850);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadCourseFavorites() {
      setLoadingCourses(true);
      try {
        const [dashboard, recommended] = await Promise.all([
          studentApi.getStudentDashboard(ACTIVE_USER_ID, ACTIVE_COURSE_ID),
          studentApi.listRecommendCourses("best"),
        ]);
        if (cancelled) return;
        const current = dashboard.current_course
          ? {
              id: dashboard.current_course.id,
              course_code: dashboard.current_course.course_code,
              name: dashboard.current_course.name,
              cover_url: dashboard.current_course.cover_url,
              price: 0,
              sold: 0,
              sections: dashboard.current_course.chapters.reduce((sum, item) => sum + item.sections.length, 0),
              teacher: dashboard.current_course.teacher_name,
              teacher_name: dashboard.current_course.teacher_name,
              summary: dashboard.latest_plan?.summary || dashboard.current_course.name,
              category_path: "软件工程 / 当前课程",
              valid_duration: 0,
              score: 50,
            }
          : null;
        const merged = [current, ...recommended].filter(Boolean) as CourseCard[];
        const deduped = merged.filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index);
        setFavoriteCourses(deduped.slice(0, 4));
      } catch {
        if (!cancelled) setFavoriteCourses([]);
      } finally {
        if (!cancelled) setLoadingCourses(false);
      }
    }

    void loadCourseFavorites();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFavorites() {
      setLoadingHandouts(true);
      try {
        const response = await studentApi.listFavoriteResources(ACTIVE_USER_ID);
        if (cancelled) return;
        setFavoriteHandouts(mapFavoriteResourcesToHandouts(response.items));
      } catch {
        if (!cancelled) setFavoriteHandouts([]);
      } finally {
        if (!cancelled) setLoadingHandouts(false);
      }
    }

    void loadFavorites();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleResetPresets = () => {
    setSearchQuery("");
    showToast("已重置筛选条件。");
  };

  const handleRemoveCourse = (id: number) => {
    setFavoriteCourses((prev) => prev.filter((course) => course.id !== id));
    showToast("已从课程关联列表移除。");
  };

  const handleRemoveHandout = (id: string) => {
    setFavoriteHandouts((prev) => prev.filter((item) => item.id !== id));
    showToast("已从资料收藏列表移除。");
  };

  const handleOpenHandout = (file: FavoriteHandout) => {
    navigate(buildResourcePreviewRoute(Number(file.courseId), { resourceId: file.resourceId, fileId: file.fileId }), {
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
          preview_url: file.previewUrl || null,
          open_url: file.previewUrl || "",
        },
      },
    });
  };

  const filteredCourses = favoriteCourses.filter((course) => {
    const combined = `${course.name} ${course.summary} ${course.teacher_name}`.toLowerCase();
    return combined.includes(searchQuery.toLowerCase());
  });

  const filteredHandouts = favoriteHandouts.filter((file) => {
    const combined = `${file.title} ${file.courseTitle} ${file.excerpt || ""}`.toLowerCase();
    return combined.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6 select-none" id="collection-workspace">
      <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-bold text-[#fb7299] tracking-wider font-mono">
            Personal Study Binder
          </span>
          <h1 className="font-sans text-2xl lg:text-3xl font-extrabold text-[#171c22]">
            我的课程与资料收藏
          </h1>
          <p className="text-sm text-[#564145] font-sans">
            当前收藏页已切到课程与资源收藏，不再使用本地课程常量和占位手册。
          </p>
        </div>

        <div className="p-4 bg-[#fb7299]/5 border border-[#fb7299]/20 rounded-2xl flex items-center gap-3 shrink-0">
          <Heart className="w-8 h-8 text-[#fb7299] shrink-0 fill-[#fb7299]" />
          <div>
            <p className="text-[9px] text-[#564145] font-bold uppercase font-sans">已收录总数</p>
            <p className="text-sm font-extrabold text-[#171c22]">
              共 {favoriteCourses.length + favoriteHandouts.length} 项
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white p-4.5 rounded-3xl border border-[#E3E8EC] shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {(["All", "Courses", "Handouts"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive ? "bg-[#fb7299] text-white shadow-xs" : "bg-[#eaeef6]/45 text-[#564145] hover:bg-[#eaeef6]/80"
                }`}
              >
                {tab === "All" ? "全部收藏" : tab === "Courses" ? "课程" : "资料"}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-grow lg:max-w-xl">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="搜索课程、资料标题或摘要..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50/70 hover:bg-slate-50 text-xs text-[#171c22] placeholder-slate-400 border border-[#E3E8EC] focus:border-[#fb7299] focus:bg-white rounded-xl pl-3.5 pr-8 py-2 focus:outline-hidden transition-all"
            />
          </div>

          <button
            onClick={handleResetPresets}
            className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-[11px] border border-[#E3E8EC] rounded-xl px-3.5 py-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
          >
            <ListRestart className="w-3.5 h-3.5 text-[#fb7299]" />
            <span>重置筛选</span>
          </button>
        </div>
      </section>

      <section className="space-y-6">
        {(activeTab === "All" || activeTab === "Courses") && (
          <div className="space-y-4">
            {(filteredCourses.length > 0 || loadingCourses) && (
              <h3 className="font-sans text-xs font-extrabold tracking-wider uppercase text-[#564145] pl-1">
                已关联课程 ({filteredCourses.length})
              </h3>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {loadingCourses ? (
                <div className="rounded-2xl border border-[#E3E8EC] bg-white px-4 py-6 text-sm text-[#564145]">
                  正在加载课程关联...
                </div>
              ) : null}
              {filteredCourses.map((course) => (
                <div
                  id={`favorite-course-${course.id}`}
                  key={course.id}
                  className="bg-white border border-[#E3E8EC] rounded-3xl overflow-hidden flex flex-col sm:flex-row hover:shadow-lg transition-shadow group shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => navigate(buildLearnRoute(course.id))}
                    className="sm:w-44 aspect-video sm:aspect-square bg-slate-100 shrink-0 relative overflow-hidden text-left cursor-pointer"
                  >
                    <img
                      src={resolveCourseCoverUrl(course.cover_url)}
                      alt={course.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/75 text-white font-mono text-[9px] px-1.5 py-0.5 rounded">
                      {course.sections} 节
                    </div>
                  </button>

                  <div className="p-5 flex flex-col justify-between flex-grow gap-4 min-w-0">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="bg-[#fb7299]/15 text-[#fb7299] text-[9px] font-extrabold px-2 py-0.2 rounded font-mono uppercase">
                          当前课程
                        </span>
                        <button
                          onClick={() => handleRemoveCourse(course.id)}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                          title="移除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate(buildLearnRoute(course.id))}
                        className="block text-left font-sans text-sm font-extrabold text-[#171c22] leading-snug truncate group-hover:text-[#fb7299] transition-colors cursor-pointer"
                      >
                        {course.name}
                      </button>
                      <p className="text-[11px] text-[#564145] leading-snug opacity-90">{course.summary}</p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-50 text-[10px] text-[#564145]">
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-500 stroke-none" />
                        <strong>{course.score}</strong> ({course.sold} 次学习)
                      </span>
                      <button
                        onClick={() => navigate(`/learn?courseId=${course.id}`)}
                        className="text-xs font-bold text-[#006689] hover:underline flex items-center gap-0.5 font-sans cursor-pointer"
                      >
                        <PlayCircle className="w-4 h-4 shrink-0" />
                        进入课堂
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(activeTab === "All" || activeTab === "Handouts") && (
          <div className="space-y-4">
            {(filteredHandouts.length > 0 || loadingHandouts) && (
              <h3 className="font-sans text-xs font-extrabold tracking-wider uppercase text-[#564145] pl-1 pt-2">
                已收藏资料 ({filteredHandouts.length})
              </h3>
            )}

            <div className="space-y-3">
              {loadingHandouts ? (
                <div className="rounded-2xl border border-[#E3E8EC] bg-white px-4 py-6 text-sm text-[#564145]">
                  正在加载收藏资料...
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
                        {file.format} · {file.size} · 关联资源: <strong className="text-[#006689]">{file.courseTitle}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 shrink-0 select-none">
                    <button
                      onClick={() => handleRemoveHandout(file.id)}
                      className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                      title="移除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenHandout(file)}
                      className="bg-[#006689] hover:bg-[#006689]/95 text-white font-bold text-xs px-4 py-1.8 rounded-xl flex items-center gap-1 shadow transition-all cursor-pointer"
                    >
                      <span>预览资料</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {((activeTab === "Courses" && filteredCourses.length === 0 && !loadingCourses) ||
          (activeTab === "Handouts" && filteredHandouts.length === 0 && !loadingHandouts) ||
          (!loadingCourses && !loadingHandouts && filteredCourses.length === 0 && filteredHandouts.length === 0)) && (
          <div className="bg-white border rounded-3xl p-16 text-center select-none">
            <Bookmark className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <h4 className="font-sans text-sm font-bold text-[#171c22]">当前没有匹配的课程或资料</h4>
            <p className="text-xs text-[#564145] mt-1">试试修改搜索条件，或者回到资源中心继续筛选课程资料。</p>
            <div className="mt-4 flex gap-2 justify-center">
              <button
                onClick={handleResetPresets}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold px-4 py-2 rounded-xl border cursor-pointer"
              >
                重置列表
              </button>
              <button
                onClick={() => navigate(buildResourcesRoute(ACTIVE_COURSE_ID))}
                className="bg-[#fb7299] hover:bg-[#fb7299]/90 text-white text-xs font-extrabold px-4 py-2 rounded-xl cursor-pointer"
              >
                去资源中心
              </button>
            </div>
          </div>
        )}
      </section>

      {toastMessage ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#171c22]/95 text-white text-xs font-bold px-5 py-3 rounded-full shadow-2xl z-50 flex items-center gap-2 border border-white/10">
          <span className="w-2 h-2 rounded-full bg-[#fb7299] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      ) : null}
    </div>
  );
}
