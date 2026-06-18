export const DEMO_BACKEND_COURSE_ID = 401;

export const ROUTE_COURSE_TO_BACKEND_ID: Record<string, number> = {
  "series-1": 201,
  "series-2": 401,
  "series-3": 301,
  "course-4": 302,
};

export const ROUTE_COURSE_TO_BACKEND_CODE: Record<string, string> = {
  "series-1": "vue3_engineering",
  "series-2": "software_engineering_4th",
  "series-3": "llm_app_intro",
  "course-4": "contest_project_lab",
};

export function resolveBackendCourseId(routeCourseId?: string | null) {
  if (!routeCourseId) {
    return DEMO_BACKEND_COURSE_ID;
  }
  const normalized = routeCourseId.trim();
  if (!normalized) {
    return DEMO_BACKEND_COURSE_ID;
  }
  const numericId = Number(normalized);
  if (Number.isFinite(numericId) && numericId > 0) {
    return numericId;
  }
  return ROUTE_COURSE_TO_BACKEND_ID[normalized] ?? DEMO_BACKEND_COURSE_ID;
}

export function resolveBackendCourseCode(routeCourseId?: string | null) {
  if (!routeCourseId) {
    return "software_engineering_4th";
  }
  const normalized = routeCourseId.trim();
  if (!normalized) {
    return "software_engineering_4th";
  }
  return ROUTE_COURSE_TO_BACKEND_CODE[normalized] ?? normalized;
}
