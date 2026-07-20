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

export type PptExplanationVideoArtifact = {
  title: string;
  summary: string;
  generatedAt: string;
  durationLabel: string;
  voiceRole: string;
  storyboard: Array<{
    slideIndex: number;
    title: string;
    narration: string;
    visualHint: string;
    durationSeconds: number;
  }>;
  transcript: string;
  videoUrl?: string;
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
  explanationVideo?: PptExplanationVideoArtifact | null;
  pptTemplate?: "academic" | "defense" | "warm" | "chalkboard" | "techGrid" | "minimalReport";
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

export function isCorruptedWorkspaceText(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return false;
  return /[?？]{3,}/.test(text) || /�{2,}/.test(text) || /(?:Ã|å|ç|é|æ|è|ä|Â|¤|½|¼|º){4,}/.test(text);
}

export function sanitizeWorkspaceText(value?: string | null, fallback = "当前章节") {
  const text = String(value || "").trim();
  if (!text || isCorruptedWorkspaceText(text)) {
    return fallback;
  }
  return text;
}

function sanitizeRecentArtifact(item: RecentResourceArtifact): RecentResourceArtifact {
  const sectionTitle = sanitizeWorkspaceText(item.sectionTitle, "当前章节");
  const titleFallback =
    item.kind === "mindmap"
      ? `软件工程与实践（第4版） · ${sectionTitle} 知识导图`
      : item.kind === "practice"
        ? `软件工程与实践（第4版） · ${sectionTitle} 练习`
        : `软件工程与实践（第4版） · ${sectionTitle} 讲义`;
  return {
    ...item,
    sectionTitle,
    title: sanitizeWorkspaceText(item.title, titleFallback),
    customTitle: item.customTitle ? sanitizeWorkspaceText(item.customTitle, titleFallback) : undefined,
    summary: sanitizeWorkspaceText(item.summary, "已按当前课堂上下文完成生成。"),
  };
}

function sanitizeRecentPpt(item: RecentPptArtifact | null | undefined): RecentPptArtifact | null {
  if (!item) return null;
  const sectionTitle = sanitizeWorkspaceText(item.sectionTitle, "当前章节");
  return {
    ...item,
    sectionTitle,
    fileName: sanitizeWorkspaceText(item.fileName, `软件工程与实践（第4版）-${sectionTitle}.pptx`),
    customTitle: item.customTitle ? sanitizeWorkspaceText(item.customTitle, `软件工程与实践（第4版） · ${sectionTitle} PPT`) : undefined,
    summary: item.summary ? sanitizeWorkspaceText(item.summary, "已按当前课堂上下文完成生成。") : undefined,
    explanationVideo: item.explanationVideo
      ? {
          ...item.explanationVideo,
          title: sanitizeWorkspaceText(item.explanationVideo.title, `${sectionTitle} PPT 讲解视频`),
          summary: sanitizeWorkspaceText(item.explanationVideo.summary, "已根据 PPT 页面生成讲解视频脚本。"),
          transcript: sanitizeWorkspaceText(item.explanationVideo.transcript, "讲解稿已生成。"),
          storyboard: Array.isArray(item.explanationVideo.storyboard)
            ? item.explanationVideo.storyboard.map((scene) => ({
                ...scene,
                title: sanitizeWorkspaceText(scene.title, `第 ${scene.slideIndex} 页`),
                narration: sanitizeWorkspaceText(scene.narration, "讲解这一页的核心内容。"),
                visualHint: sanitizeWorkspaceText(scene.visualHint, "跟随页面重点进行镜头推进。"),
                durationSeconds: Number(scene.durationSeconds) > 0 ? Number(scene.durationSeconds) : 24,
              }))
            : [],
        }
      : null,
  };
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
          })).map(sanitizeRecentArtifact)
        : [],
      recentPpt: sanitizeRecentPpt(parsed.recentPpt),
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
