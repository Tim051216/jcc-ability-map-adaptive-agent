import { getCurrentLoggedInUserIdString } from "./currentUser";

const configuredAiBaseUrl = (import.meta.env.VITE_AI_BASE_URL || "/ai/api/v1").replace(/\/$/, "");
const shouldPreferProxyAiBase =
  typeof window !== "undefined" &&
  ["127.0.0.1", "localhost"].includes(window.location.hostname) &&
  /^https?:\/\/(?:127\.0\.0\.1|localhost):18080\/api\/v1$/i.test(configuredAiBaseUrl);
const AI_BASE_URL = (shouldPreferProxyAiBase ? "/ai/api/v1" : configuredAiBaseUrl).replace(/\/$/, "");
const AI_ORIGIN = AI_BASE_URL.replace(/\/api\/v1$/, "");
const LOCAL_AI_BASE_URL = (import.meta.env.VITE_LOCAL_AI_BASE_URL || "http://127.0.0.1:18080/api/v1").replace(/\/$/, "");
const DEMO_AUTHORIZATION = "Bearer student-demo";

export interface IndustryAnalysisResponse {
  professional_group: string;
  core_job: string;
  collected_at: string;
  collection_mode: string;
  source_urls: string[];
  sample_count: number;
  fetched_count: number;
  skills: Array<{ name: string; current: number; previous: number; match: number; growth: number }>;
  trend_months: string[];
  trend_series: Record<string, number[]>;
  trend_source: string;
  history_count: number;
  history_span_days: number;
  alerts: Array<{ title: string; detail: string }>;
  recommendations: string[];
  optimization_plan: Array<{ priority: string; target: string; action: string; evidence: string }>;
  ai_generated: boolean;
  safety_notice: string;
}
export interface ProfessionalGroupsMonitorResponse {
  collected_at: string;
  items: Array<{ professional_group: string; core_job: string; sample_count: number; average_match: number; leading_skill: string; leading_growth: number; alert_count: number; collection_mode: string }>;
  safety_notice: string;
}
export interface JobSnapshotHistoryResponse {
  items: Array<{ collected_at: string; professional_group: string; core_job: string; source_urls: string[]; skill_summary: Array<{ name: string; current: number; previous: number; match: number; growth: number }> }>;
  safety_notice: string;
}

export interface LearningTaskResponse {
  task_id: string;
  task_name: string;
  task_description: string;
  work_context: string;
  steps: string[];
  safety_points: string[];
  knowledge_points: string[];
  skill_points: string[];
  resources: Array<{ name: string; href: string; resource_type: string }>;
  citations: string[];
  ai_generated: boolean;
  generation_mode: string;
}
export interface JobAbilityResponse {
  job_name: string; industry_chain: string; job_group: string; typical_tasks: string[];
  abilities: Array<{ name: string; score: number; ability_units: string[]; skill_points: string[]; knowledge_points: string[] }>;
  citations: string[]; ai_generated: boolean; generation_mode: string;
}
export interface AdaptiveLearningResponse {
  goal: string; goal_scene: string; job_name: string; diagnostic_summary: string;
  weak_areas: Array<{ code: string; label: string; score: number; reason: string }>;
  next_steps: Array<{ title: string; kind: string; description: string; resource: string; unlock_condition: string }>;
  progress: number; badges: string[]; ai_generated: boolean; safety_notice: string;
}

function getCurrentUserId() {
  if (typeof window === "undefined") return null;
  try {
    return getCurrentLoggedInUserIdString();
  } catch {
    return null;
  }
}

function buildAuthHeaders() {
  const userId = getCurrentUserId();
  return buildAuthHeadersForUser(userId);
}

function buildAuthHeadersForUser(userId?: string | number | null) {
  const normalizedUserId = userId ? String(userId) : "";
  return {
    Authorization: DEMO_AUTHORIZATION,
    ...(normalizedUserId ? { "X-User-Id": normalizedUserId, "user-info": normalizedUserId } : {}),
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

export function getImEventStreamUrl(userId: number | string) {
  const resolved = new URL(`${AI_BASE_URL}/chat/stream`, window.location.origin);
  resolved.searchParams.set("user_id", String(userId));
  return resolved.toString();
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
  generated_at?: string | null;
  updated_at?: string | null;
  generation_context?: Record<string, unknown> | null;
}

export type JobAbilityAssessmentStatus = "measured" | "derived" | "not_assessed";
export type JobCoachingStatus = "planned" | "in_progress" | "completed" | "abandoned";
export type TrialParticipantRole = "student" | "teacher" | "enterprise_mentor";

export interface JobAbilityDimension {
  code: string;
  label: string;
  score: number | null;
  benchmark: number;
  assessment_status: JobAbilityAssessmentStatus;
  evidence: string[];
}

export interface JobLearningOverview {
  user_id: number;
  course_id: number;
  course_code: string;
  course_name: string;
  professional_group: string;
  job_name: string;
  student_goal: string | null;
  goal_scene: string | null;
  assessment_id: string | null;
  assessment_updated_at: string | null;
  ability_dimensions: JobAbilityDimension[];
  weak_abilities: Array<Record<string, unknown>>;
  recommended_path: Array<Record<string, unknown>>;
  recommended_resources: Array<Record<string, unknown>>;
  citations: Array<Record<string, unknown>>;
  safety_notices: Array<string | { code?: string; content?: string; severity?: string }>;
  ai_generated: boolean;
  next_action: { action_type: string; label: string; route: string; reason: string } | null;
}

export interface JobLearningOutcome {
  user_id: number;
  course_id: number;
  status: "insufficient_data" | "baseline_only" | "comparable";
  assessment_count: number;
  baseline_assessment_id: string | null;
  latest_assessment_id: string | null;
  baseline_score: number | null;
  latest_score: number | null;
  score_change: number | null;
  ability_changes: Array<{
    code: string;
    label: string;
    before_score: number | null;
    after_score: number | null;
    change: number | null;
    assessment_status: JobAbilityAssessmentStatus;
  }>;
  coaching: {
    total: number;
    planned: number;
    in_progress: number;
    completed: number;
    abandoned: number;
    completion_rate: number;
    helpful_count: number;
    rated_count: number;
    average_rating: number | null;
  };
  summary: string;
}

export interface JobKnowledgeCatalogItem {
  id: string;
  title: string;
  ability_dimension: string;
  ability_unit: string;
  knowledge_point: string;
  skill_point: string;
  applicable_scenario: string;
  common_error: string;
  learning_advice: string;
  safety_notice: string;
  source_path: string;
  source_locator: string | null;
  task_prompt: string;
  deliverable: string;
  acceptance_criteria: string;
  estimated_minutes: number;
}

export interface JobKnowledgeCatalogResponse {
  total: number;
  ability_dimensions: string[];
  items: JobKnowledgeCatalogItem[];
}

export interface JobCoachingRecord {
  id: number;
  user_id: number;
  course_id: number;
  source: string;
  user_question: string;
  advice_summary: string;
  recommended_actions: string[];
  status: JobCoachingStatus;
  helpful: boolean | null;
  rating: number | null;
  feedback_note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface JobTrialFeedback {
  id: number;
  user_id: number;
  course_id: number;
  participant_role: TrialParticipantRole;
  identity_description: string;
  trial_task: string;
  strengths: string;
  problems: string;
  improvement_suggestions: string;
  overall_rating: number;
  consent_to_quote: boolean;
  created_at: string | null;
  updated_at: string | null;
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
  safety_review?: Record<string, unknown> | null;
  hallucination_review?: Record<string, unknown> | null;
}

export interface JavaRunResponse {
  success: boolean;
  compile_ok: boolean;
  run_ok: boolean;
  stdout: string;
  stderr: string;
  exit_code?: number | null;
  compile_output: string;
}

export interface JavaReviewResponse {
  success: boolean;
  summary: string;
  key_issues: string[];
  suggested_code: string;
  next_steps: string[];
}

export interface ResourceDownloadResponse {
  resource_id: number;
  download_url: string;
  format: string;
  expires_in?: number;
  file_name?: string;
}

export interface ManagedResourceDetail extends ResourceCard {
  id: number;
  resource_name?: string;
  description?: string;
  content?: string;
  document?: Record<string, unknown> | null;
  mindmap?: Record<string, unknown> | null;
  question_bank?: Record<string, unknown> | null;
  questions?: Array<Record<string, unknown>>;
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
  fallback_count?: number;
  fallback_knowledge_points?: string[];
  safety_review?: Record<string, unknown> | null;
  hallucination_review?: Record<string, unknown> | null;
  source?: "ai" | "fallback" | "cache";
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
  recommended_actions?: string[];
  suggestions?: string[];
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
  source?: string;
}

export interface EvaluationPaperResponse {
  paper_id: number;
  user_id: number;
  course_code: string;
  paper_type: string;
  status: string;
  source?: string;
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

export interface ProfileGuideQuestionResponse {
  question: string;
  related_dimension?: string | null;
  question_type: number;
  suggestions: string[];
}

export interface ProfileConversationFlowResponse {
  session_id: number;
  assistant_message: ProfileConversationMessage;
  guide_question?: ProfileGuideQuestionResponse | null;
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
  sources?: string[];
}

export interface ProfileEvaluationDiffItem {
  label?: string;
  before?: unknown;
  after?: unknown;
}

export interface StudentProfileDetailResponse {
  profile_id?: number | null;
  user_id: number;
  version: number;
  dimensions: ProfileDimensionData[];
  tags: string[];
  completeness: number;
  score_breakdown?: Record<string, number | string>;
  latest_evaluation_diff?: Record<string, ProfileEvaluationDiffItem>;
  summary?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProfileBehaviorUpdateResponse {
  updated_dimensions: Record<string, Record<string, unknown>>;
  new_tags: string[];
  removed_tags: string[];
  summary: string;
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
  safety_review?: Record<string, unknown> | null;
  hallucination_review?: Record<string, unknown> | null;
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

export interface ImSessionReadResponse {
  session_id: number;
  user_id: number;
  last_read_message_id: number;
  unread_count: number;
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

export interface TutoringReferenceSource {
  title?: string | null;
  source?: string | null;
  source_type?: string | null;
  file_name?: string | null;
  document_title?: string | null;
  document_id?: string | number | null;
  url?: string | null;
  snippet?: string | null;
  content?: string | null;
  summary?: string | null;
  score?: number | null;
  relevance_score?: number | null;
  knowledge_points?: string[] | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
}

export interface TutoringAnswerDetail {
  status: string;
  question_id: string;
  session_id?: string | null;
  answer_id?: string | null;
  answer_text: string;
  diagrams?: unknown[] | null;
  videos?: TutoringVideoRecommendation[] | null;
  reference_sources?: TutoringReferenceSource[] | null;
  confidence_score?: number | null;
  generation_time?: number | null;
  should_escalate?: boolean;
  question_type?: string | null;
  knowledge_points?: string[] | null;
  question_analysis?: {
    question_type?: string | null;
    knowledge_points?: string[] | null;
    similar_questions?: unknown[] | null;
    [key: string]: unknown;
  } | null;
  safety_review?: Record<string, unknown> | null;
  hallucination_review?: Record<string, unknown> | null;
  source?: "ai" | "fallback" | "cache" | string;
  fallback_reason?: string | null;
  error_message?: string | null;
  error?: string | null;
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
  reference_sources?: TutoringReferenceSource[] | null;
  confidence_score?: number | null;
  question_type?: string | null;
  knowledge_points?: string[] | null;
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

export interface OpenClassroomAgentCard {
  role: string;
  name: string;
  responsibility: string;
  style: string;
  output: string;
}

export interface OpenClassroomInteractionTurn {
  speaker: string;
  goal: string;
  script: string;
}

export interface OpenClassroomQuizQuestion {
  questionType: "single_choice" | "multiple_choice" | "short_answer";
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  knowledgeTag: string;
}

export interface OpenClassroomPptSlide {
  pageNo: number;
  title: string;
  bullets: string[];
  speakerNote: string;
}

export interface OpenClassroomBuildResponse {
  courseCode?: string | null;
  courseName?: string | null;
  lessonTitle: string;
  sceneSummary: string;
  completionStatus: string;
  frameworkNote: string;
  agentCards: OpenClassroomAgentCard[];
  interactionScript: OpenClassroomInteractionTurn[];
  quizQuestions: OpenClassroomQuizQuestion[];
  pptOutline: OpenClassroomPptSlide[];
  generatedResources: string[];
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

function isTransientNetworkError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return false;
  }
  if (error instanceof TypeError) {
    return true;
  }
  if (error instanceof Error) {
    return /failed to fetch|networkerror|load failed/i.test(error.message);
  }
  return false;
}

async function readErrorDetail(response: Response) {
  let detail = response.status >= 500 ? "服务暂时不可用，请稍后重试。" : `HTTP ${response.status}`;
  try {
    const payload = await readJsonResponse<{ detail?: string; message?: string }>(response);
    if (payload?.detail?.trim()) {
      return payload.detail.trim();
    }
    if (payload?.message?.trim()) {
      return payload.message.trim();
    }
  } catch {
    try {
      const text = await response.text();
      if (text.trim()) {
        return text.trim();
      }
    } catch {
      // Ignore body parsing failures and keep the HTTP fallback.
    }
  }
  return detail;
}

async function request<T>(path: string, timeoutMs?: number): Promise<T> {
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
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
        throw new Error(await readErrorDetail(response));
      }
      return readJsonResponse<T>(response);
    } catch (error) {
      lastError = error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Request timeout");
      }
      if (!isTransientNetworkError(error) || attempt === maxAttempts - 1) {
        throw error;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Network request failed");
}

async function requestDirectLocal<T>(path: string, timeoutMs?: number): Promise<T> {
  if (typeof window === "undefined" || !["127.0.0.1", "localhost"].includes(window.location.hostname)) {
    throw new Error("本地后端直连仅在本机开发环境启用");
  }
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId =
    timeoutMs && controller
      ? window.setTimeout(() => {
          controller.abort();
        }, timeoutMs)
      : null;
  try {
    const response = await fetch(`${LOCAL_AI_BASE_URL}${path}`, {
      signal: controller?.signal,
      headers: {
        Accept: "application/json",
        ...buildAuthHeaders(),
      },
    });
    if (!response.ok) {
      throw new Error(await readErrorDetail(response));
    }
    return readJsonResponse<T>(response);
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
      throw new Error(await readErrorDetail(response));
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

async function requestJsonDirectLocal<T>(path: string, init: RequestInit, timeoutMs?: number): Promise<T> {
  if (typeof window === "undefined" || !["127.0.0.1", "localhost"].includes(window.location.hostname)) {
    throw new Error("本地后端直连仅在本机开发环境启用");
  }
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId =
    timeoutMs && controller
      ? window.setTimeout(() => {
          controller.abort();
        }, timeoutMs)
      : null;
  try {
    const response = await fetch(`${LOCAL_AI_BASE_URL}${path}`, {
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
      throw new Error(await readErrorDetail(response));
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

async function requestJsonWithLocalFallback<T>(path: string, init: RequestInit, timeoutMs?: number): Promise<T> {
  try {
    return await requestJson<T>(path, init, timeoutMs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const shouldFallback =
      /HTTP 404|Failed to fetch|NetworkError|load failed|Request timeout/i.test(message) || isTransientNetworkError(error);
    if (!shouldFallback) {
      throw error;
    }
    return requestJsonDirectLocal<T>(path, init, timeoutMs);
  }
}

async function requestWithLocalFallback<T>(path: string, timeoutMs?: number): Promise<T> {
  try {
    return await request<T>(path, timeoutMs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const shouldFallback =
      /HTTP 404|Failed to fetch|NetworkError|load failed|Request timeout/i.test(message) || isTransientNetworkError(error);
    if (!shouldFallback) {
      throw error;
    }
    return requestDirectLocal<T>(path, timeoutMs);
  }
}

async function requestAsUser<T>(path: string, userId: string | number, timeoutMs?: number): Promise<T> {
  const fetchJson = async (baseUrl: string) => {
    const controller = timeoutMs ? new AbortController() : null;
    const timeoutId =
      timeoutMs && controller
        ? window.setTimeout(() => {
            controller.abort();
          }, timeoutMs)
        : null;
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        signal: controller?.signal,
        headers: {
          Accept: "application/json",
          ...buildAuthHeadersForUser(userId),
        },
      });
      if (!response.ok) {
        throw new Error(await readErrorDetail(response));
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
  };

  const localBrowser = typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname);
  // User-scoped portal calls return a relatively large structured payload.
  // In local development, bypass Vite's /ai proxy first so a slow proxy
  // handshake does not consume the whole timeout before the direct service
  // request is attempted.
  const preferredBaseUrl = localBrowser && AI_BASE_URL.startsWith("/ai/") ? LOCAL_AI_BASE_URL : AI_BASE_URL;
  const fallbackBaseUrl = preferredBaseUrl === AI_BASE_URL ? LOCAL_AI_BASE_URL : AI_BASE_URL;
  try {
    return await fetchJson(preferredBaseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const shouldFallback =
      /HTTP 404|Failed to fetch|NetworkError|load failed|Request timeout/i.test(message) || isTransientNetworkError(error);
    if (!shouldFallback) {
      throw error;
    }
    if (!localBrowser) {
      throw error;
    }
    return fetchJson(fallbackBaseUrl);
  }
}

async function requestJsonAsUser<T>(
  path: string,
  init: RequestInit,
  userId: string | number,
  timeoutMs?: number,
): Promise<T> {
  const fetchJson = async (baseUrl: string) => {
    const controller = timeoutMs ? new AbortController() : null;
    const timeoutId =
      timeoutMs && controller
        ? window.setTimeout(() => {
            controller.abort();
          }, timeoutMs)
        : null;
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        signal: controller?.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...buildAuthHeadersForUser(userId),
          ...(init.headers || {}),
        },
      });
      if (!response.ok) {
        throw new Error(await readErrorDetail(response));
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
  };

  const localBrowser = typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname);
  const preferredBaseUrl = localBrowser && AI_BASE_URL.startsWith("/ai/") ? LOCAL_AI_BASE_URL : AI_BASE_URL;
  const fallbackBaseUrl = preferredBaseUrl === AI_BASE_URL ? LOCAL_AI_BASE_URL : AI_BASE_URL;
  try {
    return await fetchJson(preferredBaseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const shouldFallback =
      /HTTP 404|Failed to fetch|NetworkError|load failed|Request timeout/i.test(message) || isTransientNetworkError(error);
    if (!shouldFallback) {
      throw error;
    }
    if (!localBrowser) {
      throw error;
    }
    return fetchJson(fallbackBaseUrl);
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
  getIndustryAnalysis(refresh = false, timeoutMs = 8000, professionalGroup = "软件技术专业群", coreJob?: string, sourceUrls?: string) {
    const query = new URLSearchParams({ refresh: String(refresh), professional_group: professionalGroup });
    if (coreJob) query.set("core_job", coreJob);
    if (sourceUrls?.trim()) query.set("source_urls", sourceUrls.trim());
    return request<IndustryAnalysisResponse>(`/xa-competition/industry/jobs-analysis?${query.toString()}`, timeoutMs);
  },
  getProfessionalGroupsMonitor(refresh = false, timeoutMs = 12000, sourceUrls?: string) {
    const query = new URLSearchParams({ refresh: String(refresh) });
    if (sourceUrls?.trim()) query.set("source_urls", sourceUrls.trim());
    return request<ProfessionalGroupsMonitorResponse>(`/xa-competition/industry/professional-groups?${query.toString()}`, timeoutMs);
  },
  getJobSnapshotHistory(professionalGroup?: string, coreJob?: string, limit = 30, timeoutMs = 8000) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (professionalGroup) query.set("professional_group", professionalGroup);
    if (coreJob) query.set("core_job", coreJob);
    return request<JobSnapshotHistoryResponse>(`/xa-competition/industry/snapshots?${query.toString()}`, timeoutMs);
  },
  generateLearningTask(payload: { work_task: string; job_name?: string; professional_group?: string; industry_context?: string; ability_focus?: string[] }, timeoutMs = 10000) {
    return requestJson<LearningTaskResponse>("/xa-competition/learning-task/generate", { method: "POST", body: JSON.stringify(payload) }, timeoutMs);
  },
  generateJobAbility(payload: { job_name: string; professional_group?: string; observed_skills?: string[]; typical_tasks?: string[] }, timeoutMs = 10000) {
    return requestJson<JobAbilityResponse>("/xa-competition/job-ability/generate", { method: "POST", body: JSON.stringify(payload) }, timeoutMs);
  },
  recommendAdaptiveLearning(payload: { goal: string; goal_scene?: string; job_name?: string; assessment_scores?: Record<string, number>; ability_labels?: Record<string, string>; completed_skills?: string[] }, timeoutMs = 10000) {
    return requestJson<AdaptiveLearningResponse>("/xa-competition/adaptive-learning/recommend", { method: "POST", body: JSON.stringify(payload) }, timeoutMs);
  },
  getJobLearningOverview(userId: number, courseId = 401, timeoutMs = 8000) {
    return requestAsUser<JobLearningOverview>(
      `/student-portal/job-learning?user_id=${userId}&course_id=${courseId}`,
      userId,
      timeoutMs,
    );
  },
  getJobLearningOutcomes(userId: number, courseId = 401, timeoutMs = 8000) {
    return requestAsUser<JobLearningOutcome>(
      `/student-portal/job-learning/outcomes?user_id=${userId}&course_id=${courseId}`,
      userId,
      timeoutMs,
    );
  },

  getJobKnowledgeCatalog(abilityDimension?: string, timeoutMs = 8000) {
    const query = abilityDimension ? `?ability_dimension=${encodeURIComponent(abilityDimension)}` : "";
    return request<JobKnowledgeCatalogResponse>(
      `/student-portal/job-learning/knowledge-catalog${query}`,
      timeoutMs,
    );
  },
  updateJobLearningGoal(payload: { user_id: number; course_id?: number; student_goal: string; goal_scene: string }, timeoutMs = 8000) {
    return requestJsonAsUser<{ user_id: number; course_id: number; job_name: string; student_goal: string; goal_scene: string; updated_at: string | null }>(
      "/student-portal/job-learning/goal",
      { method: "PUT", body: JSON.stringify({ course_id: 401, ...payload }) },
      payload.user_id,
      timeoutMs,
    );
  },
  listJobCoachingRecords(userId: number, courseId = 401, limit = 20, timeoutMs = 8000) {
    return requestAsUser<{ total: number; items: JobCoachingRecord[] }>(
      `/student-portal/job-learning/coaching-records?user_id=${userId}&course_id=${courseId}&limit=${limit}`,
      userId,
      timeoutMs,
    );
  },
  createJobCoachingRecord(
    payload: {
      user_id: number;
      course_id?: number;
      source?: string;
      user_question: string;
      advice_summary: string;
      recommended_actions?: string[];
    },
    timeoutMs = 8000,
  ) {
    return requestJsonAsUser<JobCoachingRecord>(
      "/student-portal/job-learning/coaching-records",
      { method: "POST", body: JSON.stringify({ course_id: 401, ...payload }) },
      payload.user_id,
      timeoutMs,
    );
  },
  updateJobCoachingFeedback(
    recordId: number,
    payload: { user_id: number; status: JobCoachingStatus; helpful?: boolean; rating?: number; feedback_note?: string },
    timeoutMs = 8000,
  ) {
    return requestJsonAsUser<JobCoachingRecord>(
      `/student-portal/job-learning/coaching-records/${recordId}/feedback`,
      { method: "PATCH", body: JSON.stringify(payload) },
      payload.user_id,
      timeoutMs,
    );
  },
  listJobTrialFeedback(userId: number, courseId = 401, limit = 20, timeoutMs = 8000) {
    return requestAsUser<{ total: number; items: JobTrialFeedback[] }>(
      `/student-portal/job-learning/trial-feedback?user_id=${userId}&course_id=${courseId}&limit=${limit}`,
      userId,
      timeoutMs,
    );
  },
  createJobTrialFeedback(
    payload: Omit<JobTrialFeedback, "id" | "created_at" | "updated_at">,
    timeoutMs = 8000,
  ) {
    return requestJsonAsUser<JobTrialFeedback>(
      "/student-portal/job-learning/trial-feedback",
      { method: "POST", body: JSON.stringify(payload) },
      payload.user_id,
      timeoutMs,
    );
  },
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
  getGoalPath(courseId: number, timeoutMs = 5000) {
    return request<GoalPathResponse>(`/learning/personalized/goal-path?course_id=${courseId}`, timeoutMs);
  },
  getReviewPlan(courseId: number, sectionIndex = 0, timeoutMs = 5000) {
    return request<ReviewPlanResponse>(
      `/learning/personalized/review-plan?course_id=${courseId}&section_index=${sectionIndex}`,
      timeoutMs,
    );
  },
  getLevelRecommendation(courseId: number, timeoutMs = 5000) {
    return request<LevelRecommendationResponse>(`/learning/personalized/level-recommendation?course_id=${courseId}`, timeoutMs);
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
  getLatestLearningPlan(userId: number, courseId: number, timeoutMs = 6000) {
    return request<LearningPlanResponse>(`/plan/latest?user_id=${userId}&course_id=${courseId}`, timeoutMs);
  },
  generateLearningPlan(payload: {
    user_id: number;
    course_id: number;
    target: string;
    available_days: number;
    daily_study_minutes: number;
  }, timeoutMs = 10000) {
    return requestJson<LearningPlanResponse>("/plan/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }, timeoutMs);
  },
  getPlanProgress(planId: number, userId: number, timeoutMs = 4000) {
    return request<PlanProgressResponse>(`/plan/${planId}/progress?user_id=${userId}`, timeoutMs);
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
  listResourcesByCourseCode(userId: number, courseCode?: string, resourceType?: string, timeoutMs = 20000) {
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
  async getResource(resourceId: number, timeoutMs = 30000) {
    try {
      return await request<ResourceCard>(`/resource/${resourceId}`, timeoutMs);
    } catch (error) {
      console.warn("资源详情代理请求失败，尝试本地后端直连。", error);
      return requestDirectLocal<ResourceCard>(`/resource/${resourceId}`, timeoutMs);
    }
  },
  getManagedResourceDetail(resourceId: number) {
    return request<ManagedResourceDetail>(`/resource/v2/${resourceId}/detail`);
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
    profile_context?: Record<string, unknown> | null;
  }) {
    return requestJson<ResourceGenerationResponse>(
      "/resource/generate",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      90000,
    );
  },

  runJavaCode(payload: {
    source_code: string;
    class_name?: string;
    stdin?: string;
    timeout_seconds?: number;
  }) {
    return requestJsonWithLocalFallback<JavaRunResponse>(
      "/resource/java-run",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      15000,
    );
  },
  reviewJavaCode(payload: {
    source_code: string;
    problem_statement?: string;
    resource_title?: string;
    compile_output?: string;
    runtime_output?: string;
    expected_output?: string;
  }) {
    return requestJsonWithLocalFallback<JavaReviewResponse>(
      "/resource/java-review",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      30000,
    );
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
    }, 18_000);
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
    } catch {
      return null;
    }
  },
  getProfileSummary(userId: number) {
    return request<ProfileSummaryResponse>(`/profile/conversation/profile/${userId}/summary`);
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
  listImSessions(userId?: string | number) {
    return userId
      ? requestAsUser<ImSessionListResponse>("/chat/sessions", userId, 6000)
      : requestWithLocalFallback<ImSessionListResponse>("/chat/sessions", 6000);
  },
  createImSession(payload: { peer_user_id: number; peer_name?: string; owner_name?: string }, userId?: string | number) {
    const init = {
      method: "POST",
      body: JSON.stringify(payload),
    };
    return userId
      ? requestJsonAsUser<ImSessionSummaryResponse>("/chat/sessions", init, userId, 6000)
      : requestJsonWithLocalFallback<ImSessionSummaryResponse>("/chat/sessions", init, 6000);
  },
  listImMessages(sessionId: number, userId?: string | number) {
    return userId
      ? requestAsUser<ImMessageListResponse>(`/chat/sessions/${sessionId}/messages`, userId, 6000)
      : requestWithLocalFallback<ImMessageListResponse>(`/chat/sessions/${sessionId}/messages`, 6000);
  },
  markImSessionRead(sessionId: number, userId?: string | number) {
    const init = {
      method: "PUT",
    };
    return userId
      ? requestJsonAsUser<ImSessionReadResponse>(`/chat/sessions/${sessionId}/read`, init, userId, 6000)
      : requestJsonWithLocalFallback<ImSessionReadResponse>(`/chat/sessions/${sessionId}/read`, init, 6000);
  },
  sendImMessage(sessionId: number, payload: { content: string }, userId?: string | number) {
    const init = {
      method: "POST",
      body: JSON.stringify(payload),
    };
    return userId
      ? requestJsonAsUser<ImMessageResponse>(`/chat/sessions/${sessionId}/messages`, init, userId, 6000)
      : requestJsonWithLocalFallback<ImMessageResponse>(`/chat/sessions/${sessionId}/messages`, init, 6000);
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
  buildOpenClassroom(payload: {
    courseCode?: string;
    courseName?: string;
    lessonTitle: string;
    studentQuestion?: string;
    focusPoints?: string[];
    targetResourceTypes?: string[];
    audienceLevel?: "beginner" | "intermediate" | "advanced";
    durationMinutes?: number;
  }) {
    return requestJson<OpenClassroomBuildResponse>("/open-classroom/build", {
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
    }, 12_000);
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
    return request<TutoringAnswerDetail>(`/tutoring/answer/${questionId}`, 30_000);
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
    const userId = getCurrentUserId();
    if (userId) {
      // Prefer the active frontend user id so the WebSocket subscribes to the
      // same question owner as the HTTP submit call.
      return `${wsOrigin}/api/v1/tutoring/stream/${questionId}?${new URLSearchParams({
        user_id: userId,
      }).toString()}`;
    }
    return `${wsOrigin}/api/v1/tutoring/stream/${questionId}?${new URLSearchParams({
      access_token: "student-demo",
    }).toString()}`;
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
    return request<TutoringHistoryResponse>(`/tutoring/history${suffix}`, 8_000);
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
    return request<VideoDanmakuListResponse>(`/danmaku?${search.toString()}`, 2500);
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
    return requestJson<VideoDanmakuItem>(
      "/danmaku",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      2500,
    );
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
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
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
