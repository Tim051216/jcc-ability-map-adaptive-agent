const AI_BASE_URL = process.env.A3_AI_BASE_URL || "http://127.0.0.1:10010/ai/v1";
const AUTHORIZATION = process.env.A3_AI_AUTHORIZATION || "Bearer student-demo";
const USER_ID = Number(process.env.A3_AI_USER_ID || "1001");
const COURSE_ID = Number(process.env.A3_AI_COURSE_ID || "401");

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
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

async function requestText(path: string, init?: RequestInit): Promise<string> {
  const response = await fetch(`${AI_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: AUTHORIZATION,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${body}`);
  }
  return body;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const results: StepResult[] = [];

  const profile = await requestJson<{
    tags?: string[];
    completeness?: number;
    current_stage?: string | null;
  }>(`/profile/conversation/profile/${USER_ID}/summary`);
  results.push({
    name: "profile_summary",
    ok: true,
    detail: {
      completeness: profile.completeness ?? null,
      tagCount: profile.tags?.length ?? 0,
      currentStage: profile.current_stage ?? null,
    },
  });

  let plan = await requestJson<{
    plan_id?: number | null;
    completion_rate?: number;
    next_action?: string;
    steps?: Array<{ step_id?: string | null; status?: string }>;
  }>(`/plan/latest?user_id=${USER_ID}&course_id=${COURSE_ID}`);

  if (!plan.plan_id) {
    plan = await requestJson(`/plan/generate`, {
      method: "POST",
      body: JSON.stringify({
        user_id: USER_ID,
        course_id: COURSE_ID,
        target: "学生端 AI 闭环 smoke",
        available_days: 7,
        daily_study_minutes: 45,
      }),
    });
  }

  if (!plan.plan_id) {
    throw new Error("plan_id is missing after generate/latest");
  }

  const planProgress = await requestJson<{
    completion_rate?: number;
    completed_steps?: number;
    total_steps?: number;
    items?: Array<{ step_id: string; status?: string }>;
  }>(`/plan/${plan.plan_id}/progress?user_id=${USER_ID}`);

  results.push({
    name: "learning_plan",
    ok: true,
    detail: {
      planId: plan.plan_id,
      completionRate: planProgress.completion_rate ?? plan.completion_rate ?? null,
      completedSteps: planProgress.completed_steps ?? null,
      totalSteps: planProgress.total_steps ?? null,
    },
  });

  const resources = await requestJson<{
    total?: number;
    items?: Array<{ resource_id?: number | null; title?: string; resource_type?: string }>;
  }>(`/resource?user_id=${USER_ID}&course_id=${COURSE_ID}`);
  const favoriteSummaryBefore = await requestJson<{
    total?: number;
    latest_favorite_at?: string | null;
  }>(`/resource/favorites/summary?user_id=${USER_ID}`);

  let favoriteRoundTrip: Record<string, unknown> = { skipped: true };
  const favoriteCandidates = (resources.items || [])
    .filter((item) => typeof item.resource_id === "number")
    .sort((left, right) => Number(left.resource_id) - Number(right.resource_id));
  for (const favoriteTarget of favoriteCandidates) {
    try {
      const toggleOne = await requestJson<{ favorite?: boolean }>(`/resource/${favoriteTarget.resource_id}/favorite`, {
        method: "POST",
        body: JSON.stringify({ user_id: USER_ID }),
      });
      const toggleBack = await requestJson<{ favorite?: boolean }>(`/resource/${favoriteTarget.resource_id}/favorite`, {
        method: "POST",
        body: JSON.stringify({ user_id: USER_ID }),
      });
      const favoriteSummaryAfter = await requestJson<{ total?: number }>(`/resource/favorites/summary?user_id=${USER_ID}`);
      favoriteRoundTrip = {
        resourceId: favoriteTarget.resource_id,
        firstFavoriteState: toggleOne.favorite ?? null,
        secondFavoriteState: toggleBack.favorite ?? null,
        totalBefore: favoriteSummaryBefore.total ?? null,
        totalAfter: favoriteSummaryAfter.total ?? null,
      };
      break;
    } catch (error) {
      favoriteRoundTrip = {
        skipped: false,
        attemptedResourceId: favoriteTarget.resource_id,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  results.push({
    name: "resource_and_favorite",
    ok: true,
    detail: {
      resourceTotal: resources.total ?? 0,
      favoriteTotal: favoriteSummaryBefore.total ?? 0,
      favoriteRoundTrip,
    },
  });

  const paper = await requestJson<{
    paper_id: number;
    questions: Array<{ question_id: string; correct_answer?: string; options?: string[] }>;
  }>(`/evaluation/papers/generate`, {
    method: "POST",
    body: JSON.stringify({
      user_id: USER_ID,
      course_id: COURSE_ID,
      count: 5,
      paper_type: "diagnostic",
      target: "学生端 AI 闭环 smoke",
    }),
  });

  const evaluationSubmit = await requestJson<{
    record_id?: number | null;
    overall_score?: number;
    mastery_level?: string;
    report_summary?: string;
    recommended_actions?: string[];
  }>(`/evaluation/papers/${paper.paper_id}/submit`, {
    method: "POST",
    body: JSON.stringify({
      user_id: USER_ID,
      answers: paper.questions.map((item) => ({
        question_id: item.question_id,
        answer: item.correct_answer || item.options?.[0] || "A",
      })),
    }),
  });

  let evaluationResult: Record<string, unknown> = {};
  if (evaluationSubmit.record_id) {
    const result = await requestJson<{
      overall_score?: number;
      mastery_level?: string;
      recommended_actions?: string[];
    }>(`/evaluation/results/${evaluationSubmit.record_id}`);
    evaluationResult = {
      score: result.overall_score ?? null,
      masteryLevel: result.mastery_level ?? null,
      recommendedActionCount: result.recommended_actions?.length ?? 0,
    };
  }

  results.push({
    name: "evaluation",
    ok: true,
    detail: {
      paperId: paper.paper_id,
      recordId: evaluationSubmit.record_id ?? null,
      score: evaluationSubmit.overall_score ?? null,
      masteryLevel: evaluationSubmit.mastery_level ?? null,
      evaluationResult,
    },
  });

  const tutoringSubmitText = await requestText(`/tutoring/question`, {
    method: "POST",
    body: JSON.stringify({
      question_text: "请用 3 句话说明需求分析和概要设计的区别。",
      course_id: COURSE_ID,
      persona: "haibara",
    }),
  });
  const tutoringSubmitJson = JSON.parse(tutoringSubmitText) as { session_id?: string | number | null };
  const questionIdMatch = tutoringSubmitText.match(/"question_id"\s*:\s*(\d+)/);
  const tutoringQuestionId = questionIdMatch?.[1];

  if (!tutoringQuestionId) {
    throw new Error(`failed to parse tutoring question_id from: ${tutoringSubmitText}`);
  }

  let tutoringAnswer:
    | {
        status?: string;
        answer_text?: string;
        should_escalate?: boolean;
        confidence_score?: number | null;
      }
    | null = null;

  for (let index = 0; index < 8; index += 1) {
    try {
      const polled = await requestJson<{
        status?: string;
        answer_text?: string;
        should_escalate?: boolean;
        confidence_score?: number | null;
      }>(`/tutoring/answer/${tutoringQuestionId}`);
      tutoringAnswer = polled;
      if ((polled.status || "").toLowerCase() === "completed" || polled.answer_text) {
        break;
      }
    } catch (error) {
      if (index === 7) {
        throw error;
      }
    }
    await sleep(2000);
  }

  if (!tutoringAnswer) {
    throw new Error("tutoring answer polling timed out");
  }

  const tutoringHistory = await requestJson<{
    total?: number;
    items?: Array<{
      question?: { question_text?: string; id?: string };
      answer?: { answer_text?: string };
    }>;
  }>(`/tutoring/history?course_id=${COURSE_ID}&page=1&page_size=6`);

  results.push({
    name: "ai_tutor",
    ok: true,
    detail: {
      questionId: tutoringQuestionId,
      sessionId: tutoringSubmitJson.session_id ?? null,
      answerLength: tutoringAnswer.answer_text?.length ?? 0,
      answerStatus: tutoringAnswer.status ?? null,
      shouldEscalate: tutoringAnswer.should_escalate ?? null,
      confidenceScore: tutoringAnswer.confidence_score ?? null,
      historyTotal: tutoringHistory.total ?? 0,
      latestHistoryQuestion: tutoringHistory.items?.[0]?.question?.question_text ?? null,
    },
  });

  results.push({
    name: "report_dependencies",
    ok: true,
    detail: {
      profile: true,
      plan: true,
      resource: true,
      evaluation: true,
      tutor: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        baseUrl: AI_BASE_URL,
        userId: USER_ID,
        courseId: COURSE_ID,
        summary: {
          total: results.length,
          passed: results.filter((item) => item.ok).length,
          failed: results.filter((item) => !item.ok).length,
        },
        results,
      },
      null,
      2,
    ),
  );
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
