export type TrialFlowCompletion = {
  completedAt: string;
  courseId: string;
  jobRole: string;
  stageId?: number;
  evaluationRecordId?: string;
};

const STORAGE_KEY = "a3:trial-feedback:flow-completion";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function recordTrialFlowCompletion(value: Omit<TrialFlowCompletion, "completedAt">) {
  if (typeof window === "undefined") return;
  const completion: TrialFlowCompletion = { ...value, completedAt: new Date().toISOString() };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(completion));
}

export function readTrialFlowCompletion(): TrialFlowCompletion | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrialFlowCompletion;
    const completedAt = Date.parse(parsed.completedAt);
    if (!parsed.jobRole || !parsed.courseId || !Number.isFinite(completedAt) || Date.now() - completedAt > MAX_AGE_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
