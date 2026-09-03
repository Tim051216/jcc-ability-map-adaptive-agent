import { getCurrentLoggedInUserIdString } from "./currentUser";

const LEARNING_BASE_URL = (import.meta.env.VITE_LEARNING_SERVICE_BASE_URL || "/learning-api").replace(/\/$/, "");

export type TrialFeedbackPayload = {
  participantType: "STUDENT" | "TEACHER";
  institution?: string;
  jobRole: string;
  courseId: string;
  stageId?: number;
  flowCompleted: true;
  pathScore: number;
  resourceScore: number;
  courseScore: number;
  tutorScore: number;
  trustScore: number;
  mostHelpful: string;
  improvement: string;
  continueUse: boolean;
  authenticityConfirmed: true;
  anonymousUseConsent: boolean;
};

export type TrialFeedbackReceipt = {
  submissionCode: string;
  participantType: string;
  jobRole: string;
  submittedAt: string;
  anonymousUseConsent: boolean;
};

type ApiEnvelope<T> = { code?: number; msg?: string; data?: T };

async function learningRequest<T>(path: string, init: RequestInit): Promise<T> {
  const userId = getCurrentLoggedInUserIdString();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${LEARNING_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer student-demo",
        "X-User-Id": userId,
        "user-info": userId,
        ...(init.headers || {}),
      },
    });
    const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
    if (!response.ok || (typeof body.code === "number" && body.code !== 200)) {
      throw new Error(body.msg || `反馈服务暂时不可用（${response.status}）`);
    }
    if (body.data === undefined) throw new Error("反馈服务返回内容不完整");
    return body.data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("反馈提交超时，请检查学习服务后重试");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export const trialFeedbackApi = {
  submit(payload: TrialFeedbackPayload) {
    return learningRequest<TrialFeedbackReceipt>("/learning/trial-feedback", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  mine() {
    return learningRequest<TrialFeedbackReceipt[]>("/learning/trial-feedback/mine", { method: "GET" });
  },
};
