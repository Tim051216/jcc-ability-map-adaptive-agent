export const OPEN_TUTOR_PANEL_EVENT = "open-ai-tutor-panel";
export const ACTIVE_TUTOR_CONTEXT_STORAGE_KEY = "a3-active-tutor-context";

export type TutorPanelPayload = {
  courseId?: string;
  sectionId?: number;
  query?: string;
  initialQuery?: string;
  mode?: "default" | "learning" | "handout" | "mindmap" | "practice" | "ppt";
  title?: string;
  subtitle?: string;
  videoSrc?: string;
  videoResourceId?: number;
  videoFileId?: number;
  videoFileName?: string;
  resourceId?: number;
  resourceTitle?: string;
  resourceType?: string;
  resourceSummary?: string;
  quickPrompts?: string[];
  startAt?: number;
  autoplay?: boolean;
  muted?: boolean;
};

export function openTutorPanel(payload: TutorPanelPayload = {}) {
  window.dispatchEvent(new CustomEvent<TutorPanelPayload>(OPEN_TUTOR_PANEL_EVENT, { detail: payload }));
}

export function saveActiveTutorContext(payload: TutorPanelPayload) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ACTIVE_TUTOR_CONTEXT_STORAGE_KEY, JSON.stringify(payload));
}

export function loadActiveTutorContext(): TutorPanelPayload | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.sessionStorage.getItem(ACTIVE_TUTOR_CONTEXT_STORAGE_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as TutorPanelPayload;
  } catch {
    return undefined;
  }
}
