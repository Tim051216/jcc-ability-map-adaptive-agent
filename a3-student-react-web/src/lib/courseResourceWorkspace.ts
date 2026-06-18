import type { DeckSlide } from "./pptxExport";

export type StoredPracticeQuestion = {
  id: string;
  question: string;
  options: string[];
  answer: string[];
  explanation?: string;
  questionType: "single" | "multiple" | "short";
  knowledgeTag?: string;
};

export type StoredMindmapNode = {
  id: string;
  label: string;
  depth: number;
  children: StoredMindmapNode[];
};

export type RecentPptArtifact = {
  resourceId?: number | null;
  fileName: string;
  slideCount: number;
  generatedAt: string;
  slides: DeckSlide[];
  summary?: string;
  sectionTitle: string;
  downloadUrl?: string;
  preferredFormat?: "pptx";
  previewContent?: string[];
  rawContent?: string;
  practiceQuestions?: StoredPracticeQuestion[];
  mindmapNodes?: StoredMindmapNode[];
  customTitle?: string;
  starred?: boolean;
  loading?: boolean;
};

export type RecentResourceArtifact = {
  kind: "handout" | "mindmap" | "practice";
  resourceId?: number | null;
  title: string;
  summary: string;
  downloadUrl: string;
  generatedAt: string;
  sectionTitle: string;
  preferredFormat?: "docx" | "markdown" | "json" | "txt" | "mermaid" | "xmind";
  previewContent?: string[];
  rawContent?: string;
  practiceQuestions?: StoredPracticeQuestion[];
  mindmapNodes?: StoredMindmapNode[];
  customTitle?: string;
  starred?: boolean;
  loading?: boolean;
};

export type PersistedCourseResourceWorkspace = {
  recentArtifacts: RecentResourceArtifact[];
  recentPpt: RecentPptArtifact | null;
  showOnlyCurrentSectionResults: boolean;
  updatedAt: number;
};

export const COURSE_RESOURCE_WORKSPACE_STORAGE_PREFIX = "a3-course-resource-workspace-v3";

export function getCourseResourceWorkspaceStorageKey(courseId: string) {
  return `${COURSE_RESOURCE_WORKSPACE_STORAGE_PREFIX}:${courseId}`;
}

export function readPersistedCourseResourceWorkspace(courseId: string): PersistedCourseResourceWorkspace | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(getCourseResourceWorkspaceStorageKey(courseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCourseResourceWorkspace;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      recentArtifacts: Array.isArray(parsed.recentArtifacts)
        ? parsed.recentArtifacts.map((item) => ({
            ...item,
            resourceId: typeof item?.resourceId === "number" ? item.resourceId : null,
            preferredFormat:
              item?.preferredFormat === "docx" ||
              item?.preferredFormat === "markdown" ||
              item?.preferredFormat === "json" ||
              item?.preferredFormat === "mermaid" ||
              item?.preferredFormat === "xmind" ||
              item?.preferredFormat === "txt"
                ? item.preferredFormat
                : undefined,
            rawContent: typeof item?.rawContent === "string" ? item.rawContent : undefined,
            practiceQuestions: Array.isArray(item?.practiceQuestions) ? item.practiceQuestions : undefined,
            mindmapNodes: Array.isArray(item?.mindmapNodes) ? item.mindmapNodes : undefined,
          }))
        : [],
      recentPpt: parsed.recentPpt || null,
      showOnlyCurrentSectionResults: parsed.showOnlyCurrentSectionResults ?? true,
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch {
    return null;
  }
}

export function persistCourseResourceWorkspace(
  courseId: string,
  payload: Omit<PersistedCourseResourceWorkspace, "updatedAt">,
) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(
    getCourseResourceWorkspaceStorageKey(courseId),
    JSON.stringify({
      ...payload,
      updatedAt: Date.now(),
    } satisfies PersistedCourseResourceWorkspace),
  );
}
