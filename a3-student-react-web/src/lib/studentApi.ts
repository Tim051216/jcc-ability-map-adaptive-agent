const AI_BASE_URL = (import.meta.env.VITE_AI_BASE_URL || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
const AI_ORIGIN = AI_BASE_URL.replace(/\/api\/v1$/, "");
const DEMO_AUTHORIZATION = "Bearer student-demo";

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
        Authorization: DEMO_AUTHORIZATION,
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

export interface LearningCourseDetail {
  id: number;
  course_code: string;
  name: string;
  cover_url: string;
  teacher_name: string;
  lesson_id: number;
  latest_section_id?: number | null;
  moment: number;
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

export interface LearningPageListResponse<T> {
  list: T[];
  total: number;
}

export interface CourseSectionPlayInfo {
  section_id: number;
  play_enabled: boolean;
  file_id?: string;
  signature?: string;
  playback_url?: string;
  message?: string;
}

export interface LearningProgressUpdateResponse {
  lessonId: number;
  latestSectionId: number;
  recorded: boolean;
}

export interface PlanResourcePush {
  resource_type: string;
  title: string;
  reason: string;
  status: string;
  resource_id?: number | null;
  resource_title?: string | null;
  source_file_id?: number | null;
  open_url?: string | null;
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
  chapter_id?: number | null;
  chapter_name?: string | null;
  section_id?: number | null;
  node_type: string;
  status: string;
  duration_minutes: number;
  weak_point_focus: string[];
  knowledge_points: string[];
  recommended_resource_types: string[];
  resource_pushes: PlanResourcePush[];
  resource_ids?: number[];
  resource_titles?: string[];
  path_reason?: string | null;
}

export interface LearningPlanResponse {
  plan_id?: number | null;
  user_id: number;
  course_code: string;
  course_id?: number | null;
  course_name: string;
  summary: string;
  profile_summary?: string | null;
  progress_hint: string;
  next_action: string;
  risk_alerts: string[];
  path_mode: string;
  current_stage?: string | null;
  recommended_learning_style?: string | null;
  available_resource_types?: string[];
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
  tags: string[];
  key_features?: string | null;
  dimension_completeness: Record<string, number>;
  dimension_sources: Record<string, string[]>;
  recommended_learning_style?: string | null;
  current_stage?: string | null;
  score_breakdown: Record<string, number>;
  latest_evaluation_diff: Record<string, Record<string, unknown>>;
}

export interface ProfileBehaviorUpdateResponse {
  updated_dimensions: Record<string, Record<string, unknown>>;
  new_tags: string[];
  removed_tags: string[];
  summary: string;
  before_summary?: Record<string, unknown>;
  after_summary?: Record<string, unknown>;
  latest_evaluation_diff?: Record<string, Record<string, unknown>>;
}

export interface ProfileConversationMessage {
  message_id: number;
  role: string;
  content: string;
  round_number: number;
  message_type: number;
  related_dimension?: string | null;
  created_at: string;
}

export interface ProfileConversationSessionResponse {
  session_id: number;
  user_id: number;
  status: number;
  session_type: number;
  total_rounds: number;
  collected_dimensions: string[];
  completeness: number;
  start_time: string;
  end_time?: string | null;
  messages: ProfileConversationMessage[];
}

export interface ProfileGuideQuestion {
  question: string;
  related_dimension?: string | null;
  question_type: number;
  suggestions: string[];
}

export interface ProfileExtractedInfoItem {
  dimension: string;
  info_key: string;
  info_value: string;
  confidence: number;
}

export interface ProfileExtractionResult {
  extracted_info: ProfileExtractedInfoItem[];
  missing_dimensions: string[];
  completeness: number;
}

export interface ProfileConversationFlowResponse {
  session_id: number;
  assistant_message: ProfileConversationMessage;
  guide_question?: ProfileGuideQuestion | null;
  extraction_result?: ProfileExtractionResult | null;
  profile_summary?: ProfileSummaryResponse | null;
  should_continue: boolean;
  completeness: number;
}

export interface ProfileDimensionData {
  dimension_code: string;
  dimension_name: string;
  data: Record<string, unknown>;
  completeness: number;
  sources: string[];
}

export interface StudentProfileDetailResponse {
  profile_id?: number | null;
  user_id: number;
  version: number;
  dimensions: ProfileDimensionData[];
  tags: string[];
  completeness: number;
  summary?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  score_breakdown: Record<string, number>;
  latest_evaluation_diff: Record<string, Record<string, unknown>>;
}

export interface ProfileHistoryItemResponse {
  history_id: number;
  profile_id: number;
  version: number;
  change_type: number;
  change_description?: string | null;
  changed_dimensions: string[];
  created_at: string;
}

export interface ProfileHistoryResponse {
  user_id: number;
  profile_id: number;
  history: ProfileHistoryItemResponse[];
  total: number;
}

export interface ChatCitation {
  title?: string | null;
  url?: string | null;
  snippet?: string | null;
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

export interface PortalMetricItem {
  key: string;
  label: string;
  value: string;
  note?: string | null;
  hint?: string | null;
}

export interface PortalActivityItem {
  id: string;
  time: string;
  title: string;
  gain: string;
  badge?: string | null;
}

export interface PortalDashboardResponse {
  featured_courses: CourseCard[];
  current_course?: LearningCourseDetail | null;
  metrics: PortalMetricItem[];
  activities: PortalActivityItem[];
  profile_summary?: ProfileSummaryResponse | null;
  latest_plan?: LearningPlanResponse | null;
  evaluation_trend?: EvaluationTrendResponse | null;
  latest_evaluations: EvaluationHistoryItem[];
}

export interface CapabilityAxisItem {
  label: string;
  score: number;
  benchmark: number;
  note?: string | null;
}

export interface CapabilityAchievementItem {
  id: string;
  title: string;
  status: string;
}

export interface CapabilityProfileResponse {
  overall_score: number;
  strongest_axis: string;
  axes: CapabilityAxisItem[];
  recent_activities: PortalActivityItem[];
  achievements: CapabilityAchievementItem[];
  diagnosis_summary: string;
  recommendations: string[];
}

export interface StudyWeekItem {
  day: string;
  hours: number;
  focus: string;
}

export interface StudyReportResponse {
  overall_score: number;
  total_hours: number;
  average_hours: number;
  best_day: string;
  weekly_study: StudyWeekItem[];
  metrics: PortalMetricItem[];
  diagnosis_feed: PortalActivityItem[];
  recommendations: string[];
}

function parseJsonPreservingLargeIds<T>(rawText: string): T {
  if (!rawText) {
    return JSON.parse("null") as T;
  }
  const normalized = rawText.replace(
    /"((?:question|session|answer)_id)"\s*:\s*(-?\d{16,})/g,
    (_, key: string, value: string) => `"${key}":"${value}"`,
  );
  return JSON.parse(normalized) as T;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${AI_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: DEMO_AUTHORIZATION,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return parseJsonPreservingLargeIds<T>(await response.text());
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${AI_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: DEMO_AUTHORIZATION,
      ...(init.headers || {}),
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
  return parseJsonPreservingLargeIds<T>(await response.text());
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

export const studentApi = {
  getStudentDashboard(userId: number, courseId?: number) {
    const params = new URLSearchParams({ user_id: String(userId) });
    if (courseId) {
      params.set("course_id", String(courseId));
    }
    return request<PortalDashboardResponse>(`/student-portal/dashboard?${params.toString()}`);
  },
  getStudentCapabilityProfile(userId: number, courseId?: number) {
    const params = new URLSearchParams({ user_id: String(userId) });
    if (courseId) {
      params.set("course_id", String(courseId));
    }
    return request<CapabilityProfileResponse>(`/student-portal/capability-profile?${params.toString()}`);
  },
  getStudentStudyReport(userId: number, courseId?: number) {
    const params = new URLSearchParams({ user_id: String(userId) });
    if (courseId) {
      params.set("course_id", String(courseId));
    }
    return request<StudyReportResponse>(`/student-portal/study-report?${params.toString()}`);
  },
  listCategories() {
    return request<CourseCategory[]>("/course/categories");
  },
  listRecommendCourses(bucket: "free" | "best" | "new") {
    return request<CourseCard[]>(`/course/recommend/${bucket}`);
  },
  getLearningCourseDetail(courseId: number) {
    return request<LearningCourseDetail>(`/course/courses/${courseId}/learning`);
  },
  getCourseSectionPlayInfo(courseId: number, sectionId: number) {
    return request<CourseSectionPlayInfo>(`/course/courses/${courseId}/sections/${sectionId}/play`);
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
  listResources(userId: number, courseId: number, resourceType?: string) {
    const params = new URLSearchParams({
      user_id: String(userId),
      course_id: String(courseId),
    });
    if (resourceType) {
      params.set("resource_type", resourceType);
    }
    return request<ResourceListResponse>(`/resource?${params.toString()}`);
  },
  getResource(resourceId: number) {
    return request<ResourceCard>(`/resource/${resourceId}`);
  },
  listFavoriteResources(userId: number) {
    return request<ResourceListResponse>(`/resource/favorites?user_id=${userId}`);
  },
  getFavoriteSummary(userId: number) {
    return request<ResourceFavoriteSummaryResponse>(`/resource/favorites/summary?user_id=${userId}`);
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
  async getProfileSummaryOrNull(userId: number) {
    try {
      return await request<ProfileSummaryResponse>(`/profile/conversation/profile/${userId}/summary`);
    } catch (error) {
      if (error instanceof Error && /画像不存在|HTTP 404/i.test(error.message)) {
        return null;
      }
      throw error;
    }
  },
  startProfileConversation(payload: {
    user_id: number;
    session_type?: number;
  }) {
    return requestJson<ProfileConversationSessionResponse>("/profile/conversation/start", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  sendProfileConversationMessage(payload: {
    session_id: number;
    content: string;
  }) {
    return requestJson<ProfileConversationFlowResponse>("/profile/conversation/message", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  completeProfileConversation(payload: {
    session_id: number;
    force_complete?: boolean;
  }) {
    return requestJson<StudentProfileDetailResponse>("/profile/conversation/complete", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getProfileConversationSession(sessionId: number) {
    return request<ProfileConversationSessionResponse>(`/profile/conversation/session/${sessionId}`);
  },
  getProfileDetail(userId: number) {
    return request<StudentProfileDetailResponse>(`/profile/conversation/profile/${userId}`);
  },
  async getProfileDetailOrNull(userId: number) {
    try {
      return await request<StudentProfileDetailResponse>(`/profile/conversation/profile/${userId}`);
    } catch (error) {
      if (error instanceof Error && /画像不存在|HTTP 404/i.test(error.message)) {
        return null;
      }
      throw error;
    }
  },
  getProfileHistory(userId: number, limit = 10) {
    return request<ProfileHistoryResponse>(`/profile/conversation/profile/${userId}/history?limit=${limit}`);
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
    return `${wsOrigin}/api/v1/tutoring/stream/${questionId}?access_token=${encodeURIComponent("student-demo")}`;
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
