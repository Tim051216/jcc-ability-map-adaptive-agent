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
  params.set("courseId", (courseId || readLastRouteCourseId()).trim() || DEFAULT_ROUTE_COURSE_ID);
  if (search?.trim()) {
    params.set("search", search.trim());
  }
  return `/resources?${params.toString()}`;
}
