const AI_BASE_URL = (import.meta.env.VITE_AI_BASE_URL || "/ai/api/v1").replace(/\/$/, "");
const AI_ORIGIN = AI_BASE_URL.replace(/\/api\/v1$/, "");
const DEMO_AUTHORIZATION = "Bearer student-demo";

type StoredUserSession = {
  id?: string;
  loggedIn?: boolean;
};

function getCurrentUserId() {
  if (typeof window === "undefined") return null;
  const storageKeys = [
    "a3-student-user-session",
    "a3-student-user-session-persistent",
    "a3-student-user-session-recovery",
  ];
  for (const key of storageKeys) {
    try {
      const raw = window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StoredUserSession;
      if (parsed?.loggedIn && parsed?.id && /^\d+$/.test(String(parsed.id))) {
        return String(parsed.id);
      }
    } catch {
      // Ignore malformed session payloads.
    }
  }
  return null;
}

function buildAuthHeaders() {
  const userId = getCurrentUserId();
  return {
    Authorization: DEMO_AUTHORIZATION,
    ...(userId ? { "X-User-Id": userId, "user-info": userId } : {}),
  };
}

function shouldAttachAuthHeader(url: string) {
  try {
    const resolved = new URL(url, window.location.origin);
    return resolved.origin === new URL(AI_ORIGIN).origin;
  } catch {
    return true;
  }
}

function buildFileFetchInit(url: string): RequestInit {
  if (shouldAttachAuthHeader(url)) {
    return {
      headers: {
        Accept: "*/*",
        ...buildAuthHeaders(),
      },
    };
  }
  return {
    headers: {
      Accept: "*/*",
    },
  };
}

export interface CourseCategory {
  id: number;
  name: string;
  children: CourseCategory[];
}

export interface CourseCard {
  id: number;
  course_code: string;
  name: string;
  cover_url: string;
  price: number;
  sold: number;
  sections: number;
  teacher: string;
  teacher_name: string;
  summary: string;
  category_path: string;
  valid_duration: number;
  score: number;
}

export interface CourseTeacher {
  id: number;
  name: string;
  role: string;
  intro: string;
  icon?: string | null;
  is_show?: boolean;
}

export interface CourseDetail {
  id: number;
  course_code: string;
  name: string;
  cover_url: string;
  price: number;
  sold: number;
  teacher: string;
  teacher_name: string;
  cata_total_num: number;
  valid_duration: number;
  score: number;
  cate_names: string;
  introduce: string;
  use_people: string;
  detail: string;
  teachers: CourseTeacher[];
}

export interface LearningCourseDetail {
  id: number;
  course_code: string;
  name: string;
  cover_url: string;
  teacher_name: string;
  lesson_id: number;
  latest_section_id?: number | null;
  moment: number;
  teachers: CourseTeacher[];
  chapters: Array<{
    id: number;
    index: string;
    name: string;
    media_duration: number;
    sections: Array<{
      id: number;
      index: number;
      name: string;
      type: number;
      media_duration: number;
      trailer: boolean;
      subject_num: number;
      moment: number;
    }>;
  }>;
}

export interface LearningQuestionSummary {
  id: number;
  courseId: number;
  chapterId: number;
  sectionId: number;
  title: string;
  description: string;
  anonymity: boolean;
  userId: number;
  userName: string;
  userIcon: string;
  createTime: string;
  answerTimes: number;
  latestReplyContent?: string;
  latestReplyUser?: string;
}

export interface LearningNoteSummary {
  id: number;
  courseId: number;
  chapterId: number;
  sectionId: number;
  authorId: number;
  authorName: string;
  authorIcon: string;
  content: string;
  noteMoment: number;
  isPrivate: boolean;
  isGathered: boolean;
  createTime: string;
}

export interface LearningReplySummary {
  id: number;
  questionId: number;
  answerId?: number | null;
  targetReplyId?: number | null;
  targetUserId?: number | null;
  targetUserName?: string;
  userId: number;
  userName: string;
  userIcon: string;
  content: string;
  createTime: string;
  liked?: boolean;
  likedTimes?: number;
  replyTimes?: number;
}

export interface TutoringAssetUploadResponse {
  url: string;
  extracted_text?: string | null;
}

export interface LearningPageListResponse<T> {
  list: T[];
  total: number;
}

export interface CourseSectionPlayInfo {
  section_id: number;
  play_enabled: boolean;
  file_id?: string;
  signature?: string;
  message?: string;
}

export interface LearningProgressUpdateResponse {
  lessonId: number;
  latestSectionId: number;
  recorded: boolean;
}

export interface PersonalizedNextStepResponse {
  course_id: number;
  section_index: number;
  current_video: string;
  next_topic: string;
  next_action: string;
  target_goal: string;
  estimated_minutes: number;
  difficulty_level: string;
  reason: string;
  recommended_resources: string[];
}

export interface GoalPathItem {
  day: number;
  title: string;
  focus: string;
  task: string;
  deliverable: string;
}

export interface GoalPathResponse {
  course_id: number;
  goal_title: string;
  goal_subtitle: string;
  suitable_for: string;
  items: GoalPathItem[];
}

export interface ReviewCardItem {
  id: string;
  prompt: string;
  answer: string;
  review_stage: string;
  next_review_in_hours: number;
  source_video: string;
}

export interface ReviewPlanResponse {
  course_id: number;
  summary: string;
  cards: ReviewCardItem[];
}

export interface LevelRecommendationItem {
  level: string;
  label: string;
  fit_score: number;
  description: string;
  recommended_topics: string[];
}

export interface LevelRecommendationResponse {
  course_id: number;
  active_level: string;
  items: LevelRecommendationItem[];
}

export interface GrowthDimensionItem {
  key: string;
  label: string;
  score: number;
  trend: string;
  evidence: string;
}

export interface GrowthMapResponse {
  course_id: number;
  user_id: number;
  title: string;
  summary: string;
  next_milestone: string;
  dimensions: GrowthDimensionItem[];
}

export interface LearningSessionEventResponse {
  user_id: number;
  course_id: number;
  section_index: number;
  total_watched_seconds: number;
  completed_sections: number[];
  recommended_level: string;
}

export interface PlanResourcePush {
  resource_type: string;
  title: string;
  reason: string;
  status: string;
}

export interface LearningPlanStage {
  stage_no: number;
  stage_name: string;
  focus: string;
  objective: string;
  estimated_days: number;
  status: string;
  recommended_resource_types: string[];
  completion_criteria: string[];
  stage_id?: string | null;
  goal?: string | null;
  strategy?: string | null;
}

export interface LearningPlanStep {
  step_id?: string | null;
  day: number;
  title: string;
  objective?: string | null;
  tasks: string[];
  checkpoint?: string | null;
  stage_no: number;
  stage_name?: string | null;
  node_type: string;
  status: string;
  duration_minutes: number;
  weak_point_focus: string[];
  knowledge_points: string[];
  recommended_resource_types: string[];
  resource_pushes: PlanResourcePush[];
  stage_id?: string | null;
  step_title?: string | null;
  step_description?: string | null;
  expected_outcome?: string | null;
  estimated_minutes?: number | null;
  step_type?: string | null;
}

export interface LearningPlanResponse {
  plan_id?: number | null;
  user_id: number;
  course_code: string;
  course_id?: number | null;
  course_name: string;
  summary: string;
  progress_hint: string;
  next_action: string;
  risk_alerts: string[];
  path_mode: string;
  current_stage?: string | null;
  completion_rate: number;
  dynamic_adjustments: string[];
  recommended_checkpoints: string[];
  stages: LearningPlanStage[];
  steps: LearningPlanStep[];
}

export interface PlanProgressItem {
  step_id: string;
  status: string;
  progress_note?: string | null;
  last_action: string;
  updated_at?: string | null;
}

export interface PlanProgressResponse {
  plan_id: number;
  user_id: number;
  completion_rate: number;
  completed_steps: number;
  total_steps: number;
  items: PlanProgressItem[];
}

export interface ResourceCard {
  resource_id?: number | null;
  resource_type: string;
  title: string;
  summary: string;
  content_markdown: string;
  source_titles: string[];
  study_suggestion?: string | null;
  source_file_count?: number;
  source_files?: ResourceSourceFileRef[];
}

export interface ResourceSourceFileRef {
  file_id: number;
  display_name: string;
  relative_path: string;
  top_level_category: string;
  file_extension: string;
  mime_type?: string | null;
  file_size?: number | null;
  preview_text?: string | null;
  is_inline_previewable: boolean;
  preview_mode?: string;
  preview_url?: string | null;
  open_url: string;
}

export interface ResourceListResponse {
  items: ResourceCard[];
  total: number;
}

export interface ResourceGenerationResponse {
  task_id?: number | null;
  recommended_order: string[];
  resources: ResourceCard[];
}

export interface ResourceDownloadResponse {
  resource_id: number;
  download_url: string;
  format: string;
  expires_in?: number;
  file_name?: string;
}

export interface ResourceBatchDownloadResponse {
  download_url: string;
  format: string;
  resource_count: number;
  expires_in?: number;
  file_name?: string;
}

export interface VideoInsightSummaryPack {
  minute: string;
  three_minute: string;
  deep_dive: string[];
}

export interface VideoInsightTimelinePoint {
  time: number;
  label: string;
  detail: string;
}

export interface VideoInsightTerm {
  term: string;
  time: number;
  alias?: string | null;
  explanation: string;
  background: string;
}

export interface VideoInsightCue {
  start: number;
  end: number;
  zh: string;
  en: string;
  corrected?: string | null;
}

export interface VideoInsightArticlePack {
  article: string[];
  notes: string[];
  mindmap: string[];
}

export interface VideoInsightResponse {
  resource_id?: number | null;
  file_id: number;
  title: string;
  topic: string;
  summary: VideoInsightSummaryPack;
  timeline: VideoInsightTimelinePoint[];
  terms: VideoInsightTerm[];
  subtitles: VideoInsightCue[];
  article_pack: VideoInsightArticlePack;
  formula_hint: string;
}

export interface VideoInsightAskResponse {
  answer: string;
  matched_time: number;
}

export interface VideoInsightGenerateRequest {
  resource_id?: number | null;
  file_id: number;
  resource_title?: string;
  file_name?: string;
}

export interface ResourceFavoriteSummaryResponse {
  user_id: number;
  total: number;
  by_type: Record<string, number>;
  latest_favorite_at?: string | null;
}

export interface EvaluationQuestionOption {
  key: string;
  value: string;
}

export interface EvaluationGeneratedQuestion {
  question_content: string;
  question_options: EvaluationQuestionOption[];
  correct_answer: string;
  answer_analysis: string;
  knowledge_point: string;
  difficulty_level: number;
  question_type: number;
  quality_score?: number | null;
}

export interface EvaluationQuestionGenerateResponse {
  test_id: number;
  questions: EvaluationGeneratedQuestion[];
  layered_questions?: Record<string, EvaluationGeneratedQuestion[]> | null;
  total_count: number;
}

export interface EvaluationHistoryItem {
  record_id: number;
  paper_id?: number | null;
  course_code: string;
  evaluation_type: string;
  overall_score: number;
  mastery_level: string;
  report_summary: string;
  weak_points: string[];
  knowledge_points: string[];
  created_at?: string | null;
}

export interface EvaluationHistoryResponse {
  items: EvaluationHistoryItem[];
  total: number;
}

export interface EvaluationTrendResponse {
  user_id: number;
  course_code: string;
  total: number;
  latest_score?: number | null;
  average_score?: number | null;
  best_score?: number | null;
  improvement?: number | null;
  latest_mastery_level?: string | null;
  focus_knowledge_points: string[];
}

export interface EvaluationPaperSummaryResponse {
  user_id: number;
  course_code?: string | null;
  total: number;
  total_questions: number;
  by_paper_type: Record<string, number>;
  by_question_type: Record<string, number>;
  by_knowledge_point: Record<string, number>;
  latest_paper_at?: string | null;
}

export interface EvaluationPaperQuestion {
  question_id: string;
  question_type: string;
  prompt: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  knowledge_point: string;
  difficulty: string;
}

export interface EvaluationPaperResponse {
  paper_id: number;
  user_id: number;
  course_code: string;
  paper_type: string;
  status: string;
  questions: EvaluationPaperQuestion[];
}

export interface EvaluationMetricItem {
  metric_name: string;
  score: number;
  comment: string;
}

export interface EvaluationLayerResultItem {
  level: string;
  score: number;
  status: string;
  comment: string;
}

export interface EvaluationResultResponse {
  record_id?: number | null;
  paper_id?: number | null;
  overall_score: number;
  evaluation_type: string;
  mastery_level: string;
  report_summary: string;
  strengths: string[];
  weak_points: string[];
  suggestions: string[];
  layered_results: EvaluationLayerResultItem[];
  metrics: EvaluationMetricItem[];
  knowledge_points: string[];
  recommended_actions: string[];
  path_feedback: Record<string, unknown>;
  profile_feedback: Record<string, unknown>;
}

export interface WrongQuestionItem {
  question_id: string;
  prompt: string;
  knowledge_point: string;
  user_answer: string;
  correct_answer: string;
  explanation: string;
}

export interface WrongQuestionListResponse {
  items: WrongQuestionItem[];
  total: number;
}

export interface ProfileSummaryResponse {
  profile_id?: number | null;
  user_id: number;
  completeness: number;
  sbti_code?: string | null;
  tags: string[];
  key_features?: string | null;
  dimension_completeness: Record<string, number>;
  recommended_learning_style?: string | null;
  current_stage?: string | null;
}

export interface ProfileBehaviorUpdateResponse {
  updated_dimensions: Record<string, Record<string, unknown>>;
  new_tags: string[];
  removed_tags: string[];
  summary: string;
}

export interface ChatCitation {
  title?: string | null;
  url?: string | null;
  snippet?: string | null;
}

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface WebSearchResponse {
  query: string;
  items: WebSearchResultItem[];
}

export interface WebFetchResponse {
  url: string;
  final_url: string;
  title: string;
  content: string;
  source: string;
}

export interface ChatResponse {
  session_id?: number | null;
  answer: string;
  citations: ChatCitation[];
  intent?: string | null;
  agent_trace: string[];
  profile?: {
    summary?: string | null;
    recommended_resource_types?: string[];
  } | null;
  generated_plan?: Record<string, unknown> | null;
  generated_resources: Array<Record<string, unknown>>;
  generated_evaluation?: Record<string, unknown> | null;
}

export interface ImSessionSummaryResponse {
  session_id: number;
  peer_user_id?: number | null;
  title: string;
  scene?: string | null;
  conversation_type?: "group" | "direct" | "system" | null;
  subtitle?: string | null;
  badge_label?: string | null;
  participant_label?: string | null;
  member_count?: number | null;
  unread_count: number;
  latest_message?: string | null;
  latest_message_at?: string | null;
}

export interface ImSessionListResponse {
  items: ImSessionSummaryResponse[];
  total: number;
}

export interface ImMessageResponse {
  message_id: number;
  session_id: number;
  role: string;
  content: string;
  created_at?: string | null;
}

export interface ImMessageListResponse {
  items: ImMessageResponse[];
  total: number;
}

export interface TutoringVideoRecommendation {
  video_id: number;
  title: string;
  url: string;
  thumbnail?: string | null;
  duration?: number | null;
  relevance_score?: number | null;
  recommendation_reason?: string | null;
  source_platform?: string | null;
  bv_id?: string | null;
  external_link?: boolean;
  segments?: Array<{
    start_sec?: number;
    end_sec?: number;
    reason?: string;
  }>;
}

export interface TutoringAnswerDetail {
  status: string;
  question_id: string;
  session_id?: string | null;
  answer_id?: string | null;
  answer_text: string;
  diagrams?: unknown[] | null;
  videos?: TutoringVideoRecommendation[] | null;
  reference_sources?: Array<Record<string, unknown>> | null;
  confidence_score?: number | null;
  generation_time?: number | null;
  should_escalate?: boolean;
  question_type?: string | null;
  knowledge_points?: string[] | null;
}

export interface TutoringQuestionSubmitResponse {
  question_id: string;
  session_id?: string | null;
}

export interface TutoringTaskSubmitResponse {
  task_id: string;
  status: string;
  question_id: string;
  session_id?: string | null;
  poll_interval_ms?: number;
}

export interface TutoringTaskStatusResponse {
  task_id: string;
  status: "pending" | "running" | "completed" | "failed";
  question_id?: string | null;
  session_id?: string | null;
  result?: TutoringAnswerDetail | null;
  error_message?: string | null;
}

export interface TutoringHistoryQuestion {
  id: string;
  session_id: string;
  question_text: string;
  persona?: "haibara" | "usagi" | null;
  course_id?: number | null;
  section_id?: number | null;
  question_type?: string | null;
  knowledge_points?: string[] | null;
  create_time: string;
  update_time: string;
}

export interface TutoringHistoryAnswer {
  id: string;
  question_id: string;
  session_id: string;
  answer_text: string;
  answer_diagrams?: unknown[] | null;
  answer_videos?: TutoringVideoRecommendation[] | null;
  reference_sources?: Array<Record<string, unknown>> | null;
  confidence_score?: number | null;
  generation_time?: number | null;
  create_time: string;
  update_time: string;
}

export interface TutoringHistoryItem {
  question: TutoringHistoryQuestion;
  answer?: TutoringHistoryAnswer | null;
  is_favorited?: boolean;
}

export interface TutoringHistoryResponse {
  total: number;
  page: number;
  page_size: number;
  items: TutoringHistoryItem[];
}

export interface TutoringFavoriteResponse {
  status: string;
  favorite_id?: string | number;
}

export interface VideoDanmakuItem {
  id: number;
  video_key: string;
  user_id: number;
  user_name: string;
  course_id?: number | null;
  section_id?: number | null;
  content: string;
  color: string;
  mode: "scroll" | "top" | "bottom";
  start_time: number;
  created_at?: string | null;
}

export interface VideoDanmakuListResponse {
  total: number;
  items: VideoDanmakuItem[];
}

export interface CourseCommentReplyInfo {
  id: number;
  author: string;
}

export interface CourseCommentItem {
  id: number;
  course_key: string;
  section_index?: number | null;
  user_id: number;
  author: string;
  content: string;
  created_at?: string | null;
  likes: number;
  liked: boolean;
  badge?: string | null;
  parent_comment_id?: number | null;
  reply_to?: CourseCommentReplyInfo | null;
}

export interface CourseCommentListResponse {
  total: number;
  items: CourseCommentItem[];
}

export interface CourseCommentLikeResponse {
  comment_id: number;
  liked: boolean;
  likes: number;
}

function parseJsonPreservingLargeIds<T>(rawText: string): T {
  if (!rawText) {
    return JSON.parse("null") as T;
  }
  const normalized = rawText.replace(
    /"((?:question|session|answer)_id)"\s*:\s*(-?\d{16,})/g,
    (_, key: string, value: string) => `"${key}":"${value}"`,
  );
  return repairMojibakeDeep(JSON.parse(normalized)) as T;
}

function looksLikeMojibake(value: string) {
  return /[ÃÂæçåäöï¿½]{2,}|æ[\s\S]{0,6}ç|å[\s\S]{0,6}é/.test(value);
}

function tryRepairUtf8Mojibake(value: string) {
  if (!looksLikeMojibake(value)) {
    return value;
  }
  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
    const repaired = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return repaired && repaired.includes("�") === false ? repaired : value;
  } catch {
    return value;
  }
}

function repairMojibakeDeep<T>(value: T): T {
  if (typeof value === "string") {
    return tryRepairUtf8Mojibake(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => repairMojibakeDeep(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, repairMojibakeDeep(nested)]),
    ) as T;
  }
  return value;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const buffer = await response.arrayBuffer();
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  return parseJsonPreservingLargeIds<T>(decoded);
}

async function request<T>(path: string, timeoutMs?: number): Promise<T> {
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId =
    timeoutMs && controller
      ? window.setTimeout(() => {
          controller.abort();
        }, timeoutMs)
      : null;
  try {
    const response = await fetch(`${AI_BASE_URL}${path}`, {
      signal: controller?.signal,
      headers: {
        Accept: "application/json",
        ...buildAuthHeaders(),
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return readJsonResponse<T>(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timeout");
    }
    throw error;
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

async function requestJson<T>(path: string, init: RequestInit, timeoutMs?: number): Promise<T> {
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId =
    timeoutMs && controller
      ? window.setTimeout(() => {
          controller.abort();
        }, timeoutMs)
      : null;
  try {
    const response = await fetch(`${AI_BASE_URL}${path}`, {
      ...init,
      signal: controller?.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...buildAuthHeaders(),
        ...(init.headers || {}),
      },
    });
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const payload = await readJsonResponse<{ detail?: string }>(response);
        if (payload?.detail) {
          detail = payload.detail;
        }
      } catch {
        // Ignore JSON parse errors and keep the HTTP fallback.
      }
      throw new Error(detail);
    }
    return readJsonResponse<T>(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timeout");
    }
    throw error;
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

async function requestWithRetry<T>(factory: () => Promise<T>, retries = 1): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await factory();
    } catch (error) {
      lastError = error;
      const isTimeout = error instanceof Error && error.message === "Request timeout";
      if (!isTimeout || attempt === retries) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unknown request error");
}

export function resolveCourseCoverUrl(coverUrl: string) {
  if (!coverUrl) {
    return "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=1200";
  }
  if (/^https?:\/\//i.test(coverUrl)) {
    return coverUrl;
  }
  if (coverUrl.startsWith("/src/assets/course-covers/")) {
    return coverUrl.replace("/src/assets/course-covers/", "/course-covers/");
  }
  return coverUrl;
}

const getVideoInsightRequest = (resourceId: number, fileId: number, fileName?: string) => {
  const params = new URLSearchParams({
    file_id: String(fileId),
  });
  if (fileName) {
    params.set("file_name", fileName);
  }
  return request<VideoInsightResponse>(`/resource/${resourceId}/video-insight?${params.toString()}`);
};

const generateVideoInsightRequest = (payload: VideoInsightGenerateRequest) =>
  requestJson<VideoInsightResponse>(
    "/resource/video-insight",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    15000,
  );

const askVideoInsightRequest = (payload: {
  resource_id?: number | null;
  file_id: number;
  question: string;
  current_time?: number;
  resource_title?: string;
  file_name?: string;
}) =>
  requestJson<VideoInsightAskResponse>(
    "/resource/video-insight/ask",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    4000,
  );

export const studentApi = {
  listCategories() {
    return request<CourseCategory[]>("/course/categories");
  },
  listRecommendCourses(bucket: "free" | "best" | "new") {
    return request<CourseCard[]>(`/course/recommend/${bucket}`);
  },
  getCourseDetail(courseId: number) {
    return request<CourseDetail>(`/course/courses/${courseId}`);
  },
  listCourseTeachers(courseId: number) {
    return request<CourseTeacher[]>(`/course/courses/${courseId}/teachers`);
  },
  getLearningCourseDetail(courseId: number) {
    return request<LearningCourseDetail>(`/course/courses/${courseId}/learning`);
  },
  getCourseSectionPlayInfo(courseId: number, sectionId: number) {
    return request<CourseSectionPlayInfo>(`/course/courses/${courseId}/sections/${sectionId}/play`);
  },
  getPersonalizedNextStep(courseId: number, sectionIndex = 0) {
    return request<PersonalizedNextStepResponse>(
      `/learning/personalized/next-step?course_id=${courseId}&section_index=${sectionIndex}`,
    );
  },
  getGoalPath(courseId: number) {
    return request<GoalPathResponse>(`/learning/personalized/goal-path?course_id=${courseId}`);
  },
  getReviewPlan(courseId: number, sectionIndex = 0) {
    return request<ReviewPlanResponse>(
      `/learning/personalized/review-plan?course_id=${courseId}&section_index=${sectionIndex}`,
    );
  },
  getLevelRecommendation(courseId: number) {
    return request<LevelRecommendationResponse>(`/learning/personalized/level-recommendation?course_id=${courseId}`);
  },
  getGrowthMap(courseId: number, userId: number) {
    return request<GrowthMapResponse>(`/learning/personalized/growth-map?course_id=${courseId}&user_id=${userId}`);
  },
  postLearningSessionEvent(payload: {
    user_id: number;
    course_id: number;
    section_index: number;
    event_type: string;
    watched_seconds: number;
    completed?: boolean;
  }) {
    return requestJson<LearningSessionEventResponse>("/learning/personalized/session-event", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateLearningProgress(courseId: number, payload: { sectionId: number; lessonId?: number; moment?: number; duration?: number }) {
    return requestJson<LearningProgressUpdateResponse>(`/course/courses/${courseId}/learning-progress`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  listLearningQuestions(courseId: number, sectionId?: number, onlyMine = false) {
    const params = new URLSearchParams({
      courseId: String(courseId),
      onlyMine: String(onlyMine),
      pageNo: "1",
      pageSize: "6",
    });
    if (sectionId) {
      params.set("sectionId", String(sectionId));
    }
    return request<LearningPageListResponse<LearningQuestionSummary>>(`/learning/questions/page?${params.toString()}`);
  },
  listLearningNotes(courseId: number, sectionId?: number, onlyMine = false) {
    const params = new URLSearchParams({
      courseId: String(courseId),
      onlyMine: String(onlyMine),
      pageNo: "1",
      pageSize: "6",
    });
    if (sectionId) {
      params.set("sectionId", String(sectionId));
    }
    return request<LearningPageListResponse<LearningNoteSummary>>(`/learning/notes/page?${params.toString()}`);
  },
  listLearningReplies(questionId?: number, answerId?: number) {
    const params = new URLSearchParams({
      pageNo: "1",
      pageSize: "20",
    });
    if (questionId) {
      params.set("questionId", String(questionId));
    }
    if (answerId) {
      params.set("answerId", String(answerId));
    }
    return request<LearningPageListResponse<LearningReplySummary>>(`/learning/replies/page?${params.toString()}`);
  },
  createLearningQuestion(payload: {
    courseId: number;
    chapterId: number;
    sectionId: number;
    title: string;
    description: string;
    anonymity?: boolean;
  }) {
    return requestJson<LearningQuestionSummary>("/learning/questions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  createLearningReply(payload: {
    questionId: number;
    answerId?: number;
    targetReplyId?: number;
    targetUserId?: number;
    content: string;
    anonymity?: boolean;
  }) {
    return requestJson<LearningReplySummary>("/learning/replies", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  createLearningNote(payload: {
    courseId: number;
    chapterId: number;
    sectionId: number;
    content: string;
    noteMoment?: number;
    isPrivate?: boolean;
  }) {
    return requestJson<LearningNoteSummary>("/learning/notes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateLearningNote(noteId: number, payload: { id: number; content: string; isPrivate?: boolean }) {
    return requestJson<LearningNoteSummary>(`/learning/notes/${noteId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  gatherLearningNote(noteId: number) {
    return requestJson<LearningNoteSummary>(`/learning/notes/gathers/${noteId}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  ungatherLearningNote(noteId: number) {
    return requestJson<LearningNoteSummary>(`/learning/notes/gathers/${noteId}`, {
      method: "DELETE",
    });
  },
  getLatestLearningPlan(userId: number, courseId: number) {
    return request<LearningPlanResponse>(`/plan/latest?user_id=${userId}&course_id=${courseId}`);
  },
  generateLearningPlan(payload: {
    user_id: number;
    course_id: number;
    target: string;
    available_days: number;
    daily_study_minutes: number;
  }) {
    return requestJson<LearningPlanResponse>("/plan/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getPlanProgress(planId: number, userId: number) {
    return request<PlanProgressResponse>(`/plan/${planId}/progress?user_id=${userId}`);
  },
  completePlanStep(planId: number, stepId: string, userId: number) {
    return requestJson<PlanProgressResponse>(`/plan/${planId}/steps/${stepId}/complete`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  },
  listResources(userId: number, courseId: number, resourceType?: string, timeoutMs = 6000) {
    const params = new URLSearchParams({
      user_id: String(userId),
      course_id: String(courseId),
    });
    if (resourceType) {
      params.set("resource_type", resourceType);
    }
    return request<ResourceListResponse>(`/resource?${params.toString()}`, timeoutMs);
  },
  listResourcesByCourseCode(userId: number, courseCode?: string, resourceType?: string, timeoutMs = 6000) {
    const params = new URLSearchParams({
      user_id: String(userId),
    });
    if (courseCode) {
      params.set("course_code", courseCode);
    }
    if (resourceType) {
      params.set("resource_type", resourceType);
    }
    return request<ResourceListResponse>(`/resource?${params.toString()}`, timeoutMs);
  },
  getResource(resourceId: number) {
    return request<ResourceCard>(`/resource/${resourceId}`);
  },
  getVideoInsight(resourceId: number, fileId: number, fileName?: string) {
    return getVideoInsightRequest(resourceId, fileId, fileName);
  },
  generateVideoInsight(payload: VideoInsightGenerateRequest) {
    return generateVideoInsightRequest(payload);
  },
  askVideoInsight(payload: {
    resource_id?: number | null;
    file_id: number;
    question: string;
    current_time?: number;
    resource_title?: string;
    file_name?: string;
  }) {
    return askVideoInsightRequest(payload);
  },
  listFavoriteResources(userId: number, timeoutMs = 12000) {
    return requestWithRetry(
      () => request<ResourceListResponse>(`/resource/favorites?user_id=${userId}`, timeoutMs),
      1,
    );
  },
  getFavoriteSummary(userId: number, timeoutMs = 10000) {
    return requestWithRetry(
      () => request<ResourceFavoriteSummaryResponse>(`/resource/favorites/summary?user_id=${userId}`, timeoutMs),
      1,
    );
  },
  generateResources(payload: {
    user_id: number;
    course_id: number;
    knowledge_points: string[];
    resource_types: string[];
  }) {
    return requestJson<ResourceGenerationResponse>("/resource/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  favoriteResource(resourceId: number, userId: number) {
    return requestJson<{ resource_id: number; user_id: number; favorite: boolean }>(
      `/resource/${resourceId}/favorite`,
      {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      },
    );
  },
  getResourceDownloadUrl(resourceId: number, userId: number, format = "markdown") {
    return request<ResourceDownloadResponse>(
      `/resource/v2/${resourceId}/download?user_id=${userId}&format=${encodeURIComponent(format)}`,
    );
  },
  batchDownloadResources(payload: {
    resource_ids: number[];
    user_id: number;
    format?: string;
  }) {
    return requestJson<ResourceBatchDownloadResponse>("/resource/v2/batch-download", {
      method: "POST",
      body: JSON.stringify({
        resource_ids: payload.resource_ids,
        user_id: payload.user_id,
        format: payload.format || "zip",
      }),
    });
  },
  generateEvaluationQuestions(payload: {
    test_id: number;
    knowledge_points: string[];
    difficulty_level: number;
    question_type: number;
    count: number;
    generate_layered?: boolean;
    course_context?: string;
    persist_to_db?: boolean;
  }) {
    return requestJson<EvaluationQuestionGenerateResponse>("/evaluation/questions/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getEvaluationHistory(userId: number, courseId: number) {
    return request<EvaluationHistoryResponse>(`/evaluation/history?user_id=${userId}&course_id=${courseId}`);
  },
  getEvaluationTrend(userId: number, courseId: number) {
    return request<EvaluationTrendResponse>(`/evaluation/trend?user_id=${userId}&course_id=${courseId}`);
  },
  getEvaluationPaperSummary(userId: number, courseCode: string) {
    return request<EvaluationPaperSummaryResponse>(`/evaluation/papers/summary?user_id=${userId}&course_code=${encodeURIComponent(courseCode)}`);
  },
  generateEvaluationPaper(payload: {
    user_id: number;
    course_id?: number;
    course_code?: string;
    target?: string;
    knowledge_points?: string[];
    paper_type?: string;
    question_count?: number;
  }) {
    return requestJson<EvaluationPaperResponse>("/evaluation/papers/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getEvaluationPaper(paperId: number) {
    return request<EvaluationPaperResponse>(`/evaluation/papers/${paperId}`);
  },
  submitEvaluationPaper(
    paperId: number,
    payload: {
      user_id: number;
      answers: Array<{ question_id: string; answer: string }>;
      scene?: string;
      profile?: Record<string, unknown> | null;
      plan?: Record<string, unknown> | null;
      resources?: Array<Record<string, unknown>>;
      learning_duration_minutes?: number;
      resource_usage_count?: number;
    },
  ) {
    return requestJson<EvaluationResultResponse>(`/evaluation/papers/${paperId}/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getEvaluationResult(recordId: number) {
    return request<EvaluationResultResponse>(`/evaluation/results/${recordId}`);
  },
  getWrongQuestions(recordId: number) {
    return request<WrongQuestionListResponse>(`/evaluation/results/${recordId}/wrong-questions`);
  },
  getProfileSummary(userId: number) {
    return request<ProfileSummaryResponse>(`/profile/conversation/profile/${userId}/summary`);
  },
  reportProfileBehavior(payload: {
    user_id: number;
    behavior_type: number;
    behavior_data: Record<string, unknown>;
    resource_type?: string;
    resource_id?: number;
    result?: string;
    duration?: number;
  }) {
    return requestJson<ProfileBehaviorUpdateResponse>("/profile/conversation/behavior", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  chat(payload: {
    user_id: number;
    message: string;
    session_id?: number | null;
    course_id?: number;
    course_code?: string;
    scene?: string;
  }) {
    return requestJson<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  listImSessions() {
    return request<ImSessionListResponse>("/chat/sessions");
  },
  createImSession(payload: { peer_user_id: number; peer_name?: string }) {
    return requestJson<ImSessionSummaryResponse>("/chat/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  listImMessages(sessionId: number) {
    return request<ImMessageListResponse>(`/chat/sessions/${sessionId}/messages`);
  },
  sendImMessage(sessionId: number, payload: { content: string }) {
    return requestJson<ImMessageResponse>(`/chat/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  webSearch(payload: {
    query: string;
    top_k?: number;
    domain_whitelist?: string[];
  }) {
    return requestJson<WebSearchResponse>("/web-tools/search", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  webFetch(payload: {
    url: string;
    max_chars?: number;
  }) {
    return requestJson<WebFetchResponse>("/web-tools/fetch", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  submitTutoringQuestion(payload: {
    question_text: string;
    question_images?: string[];
    course_id?: number;
    section_id?: number;
    session_id?: string | number | null;
    persona?: "haibara" | "usagi";
  }) {
    return requestJson<TutoringQuestionSubmitResponse>("/tutoring/question", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async uploadTutoringAsset(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${AI_BASE_URL}/tutoring/upload-image`, {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
        ...buildAuthHeaders(),
      },
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const payload = parseJsonPreservingLargeIds<{ detail?: string }>(await response.text());
        if (payload?.detail) {
          detail = payload.detail;
        }
      } catch {
        // Ignore JSON parse errors and keep the HTTP fallback.
      }
      throw new Error(detail);
    }

    return parseJsonPreservingLargeIds<TutoringAssetUploadResponse>(await response.text());
  },
  getTutoringAnswer(questionId: string | number) {
    return request<TutoringAnswerDetail>(`/tutoring/answer/${questionId}`);
  },
  submitTutoringTask(payload: {
    question_text: string;
    question_images?: string[];
    course_id?: number;
    section_id?: number;
    session_id?: string | number | null;
    persona?: "haibara" | "usagi";
  }) {
    return requestJson<TutoringTaskSubmitResponse>("/tutoring/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getTutoringTaskStatus(taskId: string | number) {
    return request<TutoringTaskStatusResponse>(`/tutoring/tasks/${taskId}`);
  },
  getTutoringStreamUrl(questionId: string | number) {
    const wsOrigin = AI_ORIGIN.replace(/^http/i, "ws");
    const search = new URLSearchParams({
      access_token: "student-demo",
    });
    const userId = getCurrentUserId();
    if (userId) {
      search.set("user_id", userId);
    }
    return `${wsOrigin}/api/v1/tutoring/stream/${questionId}?${search.toString()}`;
  },
  listTutoringHistory(params?: {
    course_id?: number;
    page?: number;
    page_size?: number;
    keyword?: string;
  }) {
    const search = new URLSearchParams();
    if (params?.course_id) {
      search.set("course_id", String(params.course_id));
    }
    if (params?.page) {
      search.set("page", String(params.page));
    }
    if (params?.page_size) {
      search.set("page_size", String(params.page_size));
    }
    if (params?.keyword) {
      search.set("keyword", params.keyword);
    }
    const suffix = search.size ? `?${search.toString()}` : "";
    return request<TutoringHistoryResponse>(`/tutoring/history${suffix}`);
  },
  addTutoringFavorite(payload: { question_id: string | number; answer_id: string | number; note?: string }) {
    const search = new URLSearchParams({
      question_id: String(payload.question_id),
      answer_id: String(payload.answer_id),
    });
    if (payload.note) {
      search.set("note", payload.note);
    }
    return requestJson<TutoringFavoriteResponse>(`/tutoring/favorite?${search.toString()}`, {
      method: "POST",
    });
  },
  removeTutoringFavorite(questionId: string | number) {
    return requestJson<TutoringFavoriteResponse>(`/tutoring/favorite/${questionId}`, {
      method: "DELETE",
    });
  },
  deleteTutoringHistoryItem(questionId: string | number) {
    return requestJson<{ status: string }>(`/tutoring/question/${questionId}`, {
      method: "DELETE",
    });
  },
  listVideoDanmaku(videoKey: string, limit = 200) {
    const search = new URLSearchParams({
      video_key: videoKey,
      limit: String(limit),
    });
    return request<VideoDanmakuListResponse>(`/danmaku?${search.toString()}`);
  },
  createVideoDanmaku(payload: {
    video_key: string;
    content: string;
    color: string;
    mode: "scroll" | "top" | "bottom";
    start_time: number;
    course_id?: number;
    section_id?: number;
  }) {
    return requestJson<VideoDanmakuItem>("/danmaku", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  listCourseComments(params: {
    course_key: string;
    section_index?: number;
    limit?: number;
  }) {
    const search = new URLSearchParams({
      course_key: params.course_key,
      limit: String(params.limit ?? 100),
    });
    if (typeof params.section_index === "number") {
      search.set("section_index", String(params.section_index));
    }
    return request<CourseCommentListResponse>(`/course-comments?${search.toString()}`);
  },
  createCourseComment(payload: {
    course_key: string;
    section_index?: number;
    content: string;
    parent_comment_id?: number;
  }) {
    return requestJson<CourseCommentItem>("/course-comments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  toggleCourseCommentLike(commentId: number) {
    return requestJson<CourseCommentLikeResponse>(`/course-comments/${commentId}/like`, {
      method: "POST",
    });
  },
  buildResourceSourceFileUrl(path: string) {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    return `${AI_ORIGIN}${path}`;
  },
  buildResourceSourceFileOpenUrl(openUrl: string) {
    return this.buildResourceSourceFileUrl(openUrl);
  },
  async fetchResourceFileBlob(path: string) {
    const url = this.buildResourceSourceFileUrl(path);
    const response = await fetch(url, buildFileFetchInit(url));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.blob();
  },
  buildResourceFileFetchInit(path: string) {
    const url = this.buildResourceSourceFileUrl(path);
    return buildFileFetchInit(url);
  },
};
