import { a3DemoScenario } from "@/mock/a3DemoData";

const FAVORITES_KEY = "a3_student_resource_favorites";
const PLAN_PROGRESS_KEY = "a3_student_plan_progress";

const RESOURCE_TYPE_ALIAS = {
  lecture_note: "lecture_notes",
};

const DEFAULT_TITLE_BY_TYPE = {
  lecture_notes: "课程讲义",
  practice_set: "分层练习",
  mind_map: "知识点思维导图说明",
  case_study: "案例拆解",
  extended_reading: "延伸阅读",
};

const safeRead = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const safeWrite = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local cache failures in demo mode.
  }
};

const normalizeText = (value, fallback = "") =>
  (value || fallback || "")
    .replace(new RegExp(a3DemoScenario.courseCode, "g"), a3DemoScenario.currentTopic)
    .replace(/learning resource/gi, "学习资源")
    .replace(/key concept map/gi, "核心概念导图")
    .replace(/\bMind Map\b/g, "思维导图");

export const normalizeResource = (resource = {}) => {
  const resourceType = RESOURCE_TYPE_ALIAS[resource.resource_type] || resource.resource_type || "lecture_notes";
  const rawTitle = resource.title || DEFAULT_TITLE_BY_TYPE[resourceType] || "学习资源";
  const title = DEFAULT_TITLE_BY_TYPE[rawTitle] || normalizeText(rawTitle, DEFAULT_TITLE_BY_TYPE[resourceType] || "学习资源");
  const summary = normalizeText(resource.summary || "");
  const studySuggestion = normalizeText(resource.study_suggestion || "");
  const sourceTitles = Array.isArray(resource.source_titles) ? resource.source_titles.map((item) => normalizeText(item, item)) : [];
  const resourceId =
    resource.resource_id ||
    ["local", resourceType, title, summary]
      .join("::")
      .replace(/\s+/g, "-");

  return {
    ...resource,
    resource_id: resourceId,
    resource_type: resourceType,
    title,
    summary,
    study_suggestion: studySuggestion,
    source_titles: sourceTitles,
  };
};

export const dedupeResources = (resources = []) => {
  const seen = new Map();
  return resources
    .map((item) => normalizeResource(item))
    .filter((item) => {
      const semanticKey = [item.resource_type, item.title].join("::");
      const existing = seen.get(semanticKey);
      if (existing) {
        if (!existing.summary && item.summary) {
          existing.summary = item.summary;
        }
        if (!existing.study_suggestion && item.study_suggestion) {
          existing.study_suggestion = item.study_suggestion;
        }
        if ((!existing.source_titles || !existing.source_titles.length) && item.source_titles?.length) {
          existing.source_titles = item.source_titles;
        }
        return false;
      }
      seen.set(semanticKey, item);
      return true;
    });
};

export const listFavoriteResources = () => dedupeResources(safeRead(FAVORITES_KEY, []));

export const saveFavoriteResource = (resource) => {
  const normalized = normalizeResource(resource);
  const next = dedupeResources([normalized, ...listFavoriteResources()]);
  safeWrite(FAVORITES_KEY, next);
  return next;
};

export const removeFavoriteResource = (resource) => {
  const resourceId = normalizeResource(resource).resource_id;
  const next = listFavoriteResources().filter((item) => item.resource_id !== resourceId);
  safeWrite(FAVORITES_KEY, next);
  return next;
};

const normalizePlanProgressPayload = (payload = {}) => ({
  plan_id: payload.plan_id,
  items: Array.isArray(payload.items) ? payload.items : [],
  completion_rate: typeof payload.completion_rate === "number" ? payload.completion_rate : 0,
});

const readPlanProgressMap = () => safeRead(PLAN_PROGRESS_KEY, {});

const writePlanProgressMap = (value) => {
  safeWrite(PLAN_PROGRESS_KEY, value);
};

export const listPlanProgress = (planId) => {
  const progressMap = readPlanProgressMap();
  return normalizePlanProgressPayload(progressMap[String(planId)] || { plan_id: planId, items: [], completion_rate: 0 });
};

export const getRecentPlanProgress = (preferredPlanId) => {
  const progressMap = readPlanProgressMap();
  const preferred = preferredPlanId ? normalizePlanProgressPayload(progressMap[String(preferredPlanId)] || {}) : null;
  if (preferred?.items?.length) {
    return preferred;
  }

  const candidates = Object.values(progressMap)
    .map((item) => normalizePlanProgressPayload(item))
    .filter((item) => item.items.length);

  if (!candidates.length) {
    return normalizePlanProgressPayload({ plan_id: preferredPlanId, items: [], completion_rate: 0 });
  }

  return candidates.sort((left, right) => {
    const leftLatest = [...left.items].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))[0];
    const rightLatest = [...right.items].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))[0];
    return String(rightLatest?.updated_at || "").localeCompare(String(leftLatest?.updated_at || ""));
  })[0];
};

export const savePlanProgressAction = ({ planId, stepId, action, stepIds = [] }) => {
  const progressMap = readPlanProgressMap();
  const current = listPlanProgress(planId);
  const statusByAction = {
    complete: "completed",
    pause: "paused",
    resume: "in_progress",
    initialize: "in_progress",
  };
  const nextItems = [...current.items];
  const itemIndex = nextItems.findIndex((item) => item.step_id === stepId);
  const nextItem = {
    step_id: stepId,
    status: statusByAction[action] || "in_progress",
    last_action: action,
    updated_at: new Date().toLocaleString("zh-CN", { hour12: false }),
  };

  if (itemIndex >= 0) {
    nextItems[itemIndex] = {
      ...nextItems[itemIndex],
      ...nextItem,
    };
  } else {
    nextItems.push(nextItem);
  }

  const trackedStepIds = stepIds.length ? stepIds : nextItems.map((item) => item.step_id).filter(Boolean);
  const completedCount = nextItems.filter((item) => item.status === "completed" && trackedStepIds.includes(item.step_id)).length;
  const completionRate = trackedStepIds.length ? Math.round((completedCount / trackedStepIds.length) * 100) : current.completion_rate;

  const nextPayload = {
    plan_id: planId,
    items: nextItems,
    completion_rate: completionRate,
  };

  progressMap[String(planId)] = nextPayload;
  writePlanProgressMap(progressMap);
  return nextPayload;
};
