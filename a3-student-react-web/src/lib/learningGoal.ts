export type StoredLearningGoal = {
  userId: string;
  courseId: string;
  goal: string;
  deadline: string;
  dailyMinutes: number;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_PREFIX = "a3-learning-goal:";

function getStorageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadLearningGoal(userId: string): StoredLearningGoal | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLearningGoal;
    if (!parsed?.goal || !parsed?.deadline) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLearningGoal(goal: StoredLearningGoal) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStorageKey(goal.userId), JSON.stringify(goal));
}

export function clearLearningGoal(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getStorageKey(userId));
}

export function formatGoalDeadline(value?: string | null) {
  if (!value) return "待设定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getDefaultGoalDeadline() {
  const target = new Date();
  target.setDate(target.getDate() + 7);
  target.setHours(21, 0, 0, 0);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, "0");
  const day = String(target.getDate()).padStart(2, "0");
  const hour = String(target.getHours()).padStart(2, "0");
  const minute = String(target.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function getGoalAvailableDays(deadline?: string | null) {
  if (!deadline) return 7;
  const target = new Date(deadline);
  if (Number.isNaN(target.getTime())) return 7;
  const diff = target.getTime() - Date.now();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
