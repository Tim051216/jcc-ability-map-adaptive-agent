import { chromium, type Page } from "playwright";

const BASE_URL = "http://127.0.0.1:3002";

type ModeCheck = {
  kind: "handout" | "mindmap" | "practice" | "ppt";
  buttonName: string;
  expectedSubtitle: string;
  expectedPromptSnippet: string;
  expectedQuickPrompt: string;
};

const CHECKS: ModeCheck[] = [
  {
    kind: "handout",
    buttonName: "生成讲义 基于当前章节即时整理课堂讲义并直接下载",
    expectedSubtitle: "当前已切到讲义模式",
    expectedPromptSnippet: "课堂讲义",
    expectedQuickPrompt: "直接生成讲义",
  },
  {
    kind: "mindmap",
    buttonName: "生成导图 快速整理本节知识结构和概念关系",
    expectedSubtitle: "当前已切到导图模式",
    expectedPromptSnippet: "直接围绕",
    expectedQuickPrompt: "直接输出导图",
  },
  {
    kind: "practice",
    buttonName: "生成练习 学完即测，快速检查本节掌握情况",
    expectedSubtitle: "当前已切到练习模式",
    expectedPromptSnippet: "直接围绕",
    expectedQuickPrompt: "直接出 5 道题",
  },
  {
    kind: "ppt",
    buttonName: "生成 PPT 按当前课程和播放章节直接导出课件草案",
    expectedSubtitle: "当前已切到 PPT 模式",
    expectedPromptSnippet: "直接围绕",
    expectedQuickPrompt: "直接整理 PPT",
  },
];

async function bootstrapSession(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(() => {
    const user = { id: "1001", name: "BiliLearn 用户", avatar: "/src/assets/icon.jpeg", loggedIn: true };
    sessionStorage.setItem("a3-student-user-session", JSON.stringify(user));
    sessionStorage.setItem("hasSeenWelcome", "true");
    localStorage.setItem("a3-last-account-id", "1001");
    localStorage.setItem("a3-student-user-session-persistent", JSON.stringify(user));
    localStorage.setItem("a3-student-welcome-seen", "true");
    localStorage.setItem(
      "a3-learning-goal:1001",
      JSON.stringify({
        userId: "1001",
        courseId: "series-2",
        goal: "完成 React 状态管理复习",
        deadline: "2026-06-15T21:00",
        dailyMinutes: 45,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
  });
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    (window as typeof window & { __A3_LAST_TUTOR_PAYLOAD__?: string }).__A3_LAST_TUTOR_PAYLOAD__ = "";
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/tutoring/question") || url.includes("/tutoring/tasks")) {
        const body = typeof init?.body === "string" ? init.body : "";
        (window as typeof window & { __A3_LAST_TUTOR_PAYLOAD__?: string }).__A3_LAST_TUTOR_PAYLOAD__ = body;
      }
      return originalFetch(input, init);
    };
  });
}

async function closeTutorIfOpen(page: Page) {
  const closeButton = page.locator('button[aria-label="收起 AI 导师侧栏"]');
  if ((await closeButton.count()) > 0) {
    await closeButton.click({ force: true });
    await page.waitForTimeout(400);
  }
}

async function runCheck(page: Page, check: ModeCheck) {
  await page.goto(`${BASE_URL}/learn`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1_500);

  const trigger = page.getByRole("button", { name: check.buttonName });
  if ((await trigger.count()) !== 1) {
    throw new Error(`Button not unique for ${check.kind}`);
  }
  await trigger.click({ force: true });

  const tutorField = page.locator("#ai-tutor-message-field");
  await tutorField.waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(800);

  const tutorText = await page.locator("aside").last().innerText();
  const inputValue = await tutorField.inputValue();
  const quickPromptVisible = await page.getByText(check.expectedQuickPrompt, { exact: true }).count();
  const sendButton = page.locator("#ai-chat-send-btn");
  const sendDisabled = await sendButton.isDisabled();

  let questionText = "";
  let requestCaptured = false;
  if (!sendDisabled) {
    await page.evaluate(() => {
      (window as typeof window & { __A3_LAST_TUTOR_PAYLOAD__?: string }).__A3_LAST_TUTOR_PAYLOAD__ = "";
    });
    await sendButton.click({ force: true });
    try {
      await page.waitForFunction(
        () => Boolean((window as typeof window & { __A3_LAST_TUTOR_PAYLOAD__?: string }).__A3_LAST_TUTOR_PAYLOAD__),
        undefined,
        { timeout: 12_000 },
      );
      const rawPayload = await page.evaluate(
        () => (window as typeof window & { __A3_LAST_TUTOR_PAYLOAD__?: string }).__A3_LAST_TUTOR_PAYLOAD__ || "",
      );
      if (rawPayload) {
        const payload = JSON.parse(rawPayload) as { question_text?: string };
        questionText = payload.question_text || "";
        requestCaptured = true;
      }
    } catch {
      requestCaptured = false;
    }
  }

  const ok =
    tutorText.includes(check.expectedSubtitle) &&
    quickPromptVisible > 0 &&
    inputValue.includes("不要推荐视频、课程或外部资料") &&
    !sendDisabled &&
    requestCaptured &&
    questionText.includes("不要推荐视频、课程或外部资料") &&
    questionText.includes(check.expectedPromptSnippet);

  await closeTutorIfOpen(page);

  return {
    kind: check.kind,
    ok,
    subtitleMatched: tutorText.includes(check.expectedSubtitle),
    quickPromptMatched: quickPromptVisible > 0,
    inputSnippetMatched: inputValue.includes("不要推荐视频、课程或外部资料"),
    sendDisabled,
    requestCaptured,
    requestSnippetMatched:
      questionText.includes("不要推荐视频、课程或外部资料") && questionText.includes(check.expectedPromptSnippet),
    inputValue,
    questionText,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });

  try {
    await bootstrapSession(page);

    const results = [];
    for (const check of CHECKS) {
      results.push(await runCheck(page, check));
    }

    const summary = {
      ok: results.every((item) => item.ok),
      results,
    };

    console.log(JSON.stringify(summary, null, 2));
    if (!summary.ok) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

void main();
