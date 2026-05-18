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
  node_type: string;
  status: string;
  duration_minutes: number;
  weak_point_focus: string[];
  knowledge_points: string[];
  recommended_resource_types: string[];
  resource_pushes: PlanResourcePush[];
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
  recommended_learning_style?: string | null;
  current_stage?: string | null;
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
  return response.json() as Promise<T>;
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
      const payload = (await response.json()) as { detail?: string };
      if (payload?.detail) {
        detail = payload.detail;
      }
    } catch {
      // Ignore JSON parse errors and keep the HTTP fallback.
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
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
  getWrongQuestions(recordId: number) {
    return request<WrongQuestionListResponse>(`/evaluation/results/${recordId}/wrong-questions`);
  },
  getProfileSummary(userId: number) {
    return request<ProfileSummaryResponse>(`/profile/conversation/profile/${userId}/summary`);
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
