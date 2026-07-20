export const LAST_ROUTE_COURSE_ID_STORAGE_KEY = "a3-last-route-course-id";
export const DEFAULT_ROUTE_COURSE_ID = "series-2";

export function readLastRouteCourseId() {
  if (typeof window === "undefined") {
    return DEFAULT_ROUTE_COURSE_ID;
  }
  const value = window.localStorage.getItem(LAST_ROUTE_COURSE_ID_STORAGE_KEY)?.trim();
  return value || DEFAULT_ROUTE_COURSE_ID;
}

export function persistLastRouteCourseId(courseId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  const value = (courseId || "").trim();
  if (!value) {
    return;
  }
  window.localStorage.setItem(LAST_ROUTE_COURSE_ID_STORAGE_KEY, value);
}

export function buildResourcesRoute(courseId?: string | null, search?: string) {
  const params = new URLSearchParams();
  params.set("courseId", DEFAULT_ROUTE_COURSE_ID);
  if (search?.trim()) {
    params.set("search", search.trim());
  }
  return `/resources?${params.toString()}`;
}

export function buildSearchRoute(search: string) {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("q", search.trim());
  }
  return `/search?${params.toString()}`;
}

export function resolveSearchRouteCourseId(search: string, fallbackCourseId?: string | null) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) {
    return (fallbackCourseId || readLastRouteCourseId()).trim() || DEFAULT_ROUTE_COURSE_ID;
  }

  if (/软件|需求|测试|项目管理|项目计划|生命周期|瀑布|螺旋|用例|uml|系统设计|接口|维护|工程/.test(normalized)) {
    return "series-2";
  }

  if (/vue|react|前端|网页|页面|组件|设计系统|交互|css|html|javascript|typescript|vite/.test(normalized)) {
    return "series-1";
  }

  return (fallbackCourseId || readLastRouteCourseId()).trim() || DEFAULT_ROUTE_COURSE_ID;
}
