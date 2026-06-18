const AI_BASE_URL = process.env.A3_AI_BASE_URL || "http://127.0.0.1:18080/api/v1";
const AUTHORIZATION = process.env.A3_AI_AUTHORIZATION || "Bearer student-demo";
const USER_ID = Number(process.env.A3_AI_USER_ID || "1001");
const COURSE_ID = Number(process.env.A3_AI_COURSE_ID || "401");
const SECTION_INDEX = Number(process.env.A3_AI_SECTION_INDEX || "3");
const WATCHED_SECONDS = Number(process.env.A3_AI_WATCHED_SECONDS || "1800");

type StepResult = {
  name: string;
  ok: boolean;
  detail: Record<string, unknown>;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${AI_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: AUTHORIZATION,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${body}`);
  }

  return JSON.parse(body) as T;
}

async function main() {
  const results: StepResult[] = [];

  const beforeNextStep = await requestJson<{
    section_index: number;
    difficulty_level: string;
    next_topic: string;
    recommended_resources: string[];
  }>(`/learning/personalized/next-step?course_id=${COURSE_ID}&section_index=0`);
  results.push({
    name: "before_next_step",
    ok: true,
    detail: {
      sectionIndex: beforeNextStep.section_index,
      difficultyLevel: beforeNextStep.difficulty_level,
      nextTopic: beforeNextStep.next_topic,
      resourceCount: beforeNextStep.recommended_resources.length,
    },
  });

  const beforeGrowthMap = await requestJson<{
    summary: string;
    dimensions: Array<{ key: string; score: number; evidence: string }>;
  }>(`/learning/personalized/growth-map?course_id=${COURSE_ID}&user_id=${USER_ID}`);
  results.push({
    name: "before_growth_map",
    ok: true,
    detail: {
      summary: beforeGrowthMap.summary,
      dimensions: beforeGrowthMap.dimensions,
    },
  });

  const sessionEvent = await requestJson<{
    total_watched_seconds: number;
    completed_sections: number[];
    recommended_level: string;
  }>(`/learning/personalized/session-event`, {
    method: "POST",
    body: JSON.stringify({
      user_id: USER_ID,
      course_id: COURSE_ID,
      section_index: SECTION_INDEX,
      event_type: "complete",
      watched_seconds: WATCHED_SECONDS,
      completed: true,
    }),
  });
  results.push({
    name: "session_event",
    ok: sessionEvent.completed_sections.includes(SECTION_INDEX),
    detail: sessionEvent,
  });

  const afterNextStep = await requestJson<{
    section_index: number;
    difficulty_level: string;
    next_topic: string;
    reason: string;
    recommended_resources: string[];
  }>(`/learning/personalized/next-step?course_id=${COURSE_ID}&section_index=${SECTION_INDEX}`);
  results.push({
    name: "after_next_step",
    ok: afterNextStep.section_index >= SECTION_INDEX,
    detail: {
      sectionIndex: afterNextStep.section_index,
      difficultyLevel: afterNextStep.difficulty_level,
      nextTopic: afterNextStep.next_topic,
      reason: afterNextStep.reason,
      resourceCount: afterNextStep.recommended_resources.length,
    },
  });

  const reviewPlan = await requestJson<{
    summary: string;
    cards: Array<{ id: string; prompt: string; next_review_in_hours: number }>;
  }>(`/learning/personalized/review-plan?course_id=${COURSE_ID}&section_index=${SECTION_INDEX}`);
  results.push({
    name: "review_plan",
    ok: reviewPlan.cards.length > 0,
    detail: {
      summary: reviewPlan.summary,
      firstCard: reviewPlan.cards[0] || null,
    },
  });

  const levelRecommendation = await requestJson<{
    active_level: string;
    items: Array<{ level: string; fit_score: number }>;
  }>(`/learning/personalized/level-recommendation?course_id=${COURSE_ID}`);
  results.push({
    name: "level_recommendation",
    ok: levelRecommendation.items.some((item) => item.level === levelRecommendation.active_level),
    detail: levelRecommendation,
  });

  const afterGrowthMap = await requestJson<{
    summary: string;
    dimensions: Array<{ key: string; score: number; evidence: string }>;
  }>(`/learning/personalized/growth-map?course_id=${COURSE_ID}&user_id=${USER_ID}`);
  results.push({
    name: "after_growth_map",
    ok: afterGrowthMap.dimensions.length > 0,
    detail: {
      summary: afterGrowthMap.summary,
      dimensions: afterGrowthMap.dimensions,
    },
  });

  const failed = results.filter((item) => !item.ok);
  console.log(
    JSON.stringify(
      {
        baseUrl: AI_BASE_URL,
        userId: USER_ID,
        courseId: COURSE_ID,
        sectionIndex: SECTION_INDEX,
        summary: {
          total: results.length,
          passed: results.length - failed.length,
          failed: failed.length,
        },
        results,
      },
      null,
      2,
    ),
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
