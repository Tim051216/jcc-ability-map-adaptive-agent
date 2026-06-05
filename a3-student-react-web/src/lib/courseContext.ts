export const ACTIVE_USER_ID = 1001;
export const ACTIVE_COURSE_ID = 401;
export const ACTIVE_COURSE_CODE = "software_engineering_4th";

const LEGACY_COURSE_ALIASES: Record<string, number> = {
  "401": ACTIVE_COURSE_ID,
  software_engineering: ACTIVE_COURSE_ID,
  "software-engineering": ACTIVE_COURSE_ID,
  software_engineering_4th: ACTIVE_COURSE_ID,
  "series-1": ACTIVE_COURSE_ID,
  "series-2": ACTIVE_COURSE_ID,
  "series-3": ACTIVE_COURSE_ID,
  "course-4": ACTIVE_COURSE_ID,
};

function buildSearch(params?: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function resolveCourseId(value?: string | number | null, fallback = ACTIVE_COURSE_ID) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  const normalized = String(value || "").trim();
  if (!normalized) {
    return fallback;
  }

  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  return LEGACY_COURSE_ALIASES[normalized] || LEGACY_COURSE_ALIASES[normalized.toLowerCase()] || fallback;
}

export function resolveCourseIdFromSearchParams(searchParams: URLSearchParams, fallback = ACTIVE_COURSE_ID) {
  return resolveCourseId(searchParams.get("courseId") ?? searchParams.get("course_id"), fallback);
}

export function buildRoute(
  pathname: string,
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  return `${pathname}${buildSearch(params)}`;
}

export function buildLearnRoute(courseId = ACTIVE_COURSE_ID, sectionId?: number | null) {
  return buildRoute("/learn", { courseId, sectionId });
}

export function buildPathRoute(courseId = ACTIVE_COURSE_ID) {
  return buildRoute("/path", { courseId });
}

export function buildResourcesRoute(
  courseId = ACTIVE_COURSE_ID,
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  return buildRoute("/resources", { courseId, ...(params || {}) });
}

export function buildResourcePreviewRoute(
  courseId = ACTIVE_COURSE_ID,
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  return buildRoute("/resources/preview", { courseId, ...(params || {}) });
}

export function buildEvaluationRoute(courseId = ACTIVE_COURSE_ID) {
  return buildRoute("/evaluation", { courseId });
}

export function buildProfileRoute(courseId = ACTIVE_COURSE_ID) {
  return buildRoute("/profile", { courseId });
}

export function buildProfileConversationRoute(
  courseId = ACTIVE_COURSE_ID,
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  return buildRoute("/profile/conversation", { courseId, ...(params || {}) });
}

export function buildTutorRoute(
  courseId = ACTIVE_COURSE_ID,
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  return buildRoute("/tutor", { courseId, ...(params || {}) });
}
