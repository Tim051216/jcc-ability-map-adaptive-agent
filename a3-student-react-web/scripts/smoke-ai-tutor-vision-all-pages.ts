import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = "http://127.0.0.1:3002";

const PAGES = [
  { name: "overview", path: "/" },
  { name: "learning-path", path: "/path" },
  { name: "course-learning", path: "/learn" },
  { name: "resource-center", path: "/resources" },
  { name: "evaluation", path: "/evaluation" },
  { name: "study-report", path: "/report" },
  { name: "collection", path: "/collection" },
  { name: "capability-profile", path: "/profile" },
  { name: "im-center", path: "/im" },
] as const;

const ONLY_PAGE = process.env.AI_TUTOR_ONLY_PAGE?.trim();
const WAIT_FOR_FINAL_ANSWER = process.env.AI_TUTOR_WAIT_FOR_FINAL_ANSWER !== "0";

const TEST_IMAGE_PATH = path.resolve(
  "F:\\A3-cnsoftbei\\a3-learning-agent-system\\a3-student-react-web\\src\\assets\\images\\usagi_perfect_1779717893221.png",
);
const TEST_PROMPT = "请描述我上传图片里最明显的学习场景，并告诉我适合怎么继续学。";

async function bootstrapSession(page: import("playwright").Page) {
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
}

async function openTutor(page: import("playwright").Page) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("open-ai-tutor-panel", {
        detail: {},
      }),
    );
  });
  await page.waitForSelector("#ai-tutor-message-field", { state: "visible", timeout: 20_000 });
  await page.waitForSelector("#ai-tutor-file-input", { state: "attached", timeout: 20_000 });
  await page.waitForTimeout(600);
}

async function closeTutor(page: import("playwright").Page) {
  const closeButton = page.locator('button[aria-label*="收起 AI 导师"]:visible, button[aria-label="收起 AI 导师侧栏"]:visible').last();
  if (await closeButton.count()) {
    await closeButton.click({ force: true });
    await page.waitForTimeout(500);
  }
}

async function runVisionForPage(page: import("playwright").Page, pagePath: string) {
  await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2_000);
  await openTutor(page);

  const fileInput = page.locator("#ai-tutor-file-input");
  await fileInput.setInputFiles(TEST_IMAGE_PATH);
  await page.waitForFunction(
    () => {
      const field = document.getElementById("ai-tutor-message-field");
      const tutorAside = field?.closest("aside");
      const tutorText = tutorAside?.innerText || "";
      const attachmentImage = tutorAside?.querySelector('img[alt*="usagi_perfect_1779717893221"]');
      return tutorText.includes("已添加 1 个附件") || Boolean(attachmentImage);
    },
    undefined,
    { timeout: 20_000 },
  );

  const requestPromise = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().includes("/tutoring/question"),
    { timeout: 30_000 },
  );
  await page.locator("#ai-tutor-message-field").fill(TEST_PROMPT);
  await page.evaluate(() => {
    const button = document.getElementById("ai-chat-send-btn") as HTMLButtonElement | null;
    button?.click();
  });

  const request = await requestPromise;
  const payload = request.postDataJSON() as { question_images?: string[]; question_text?: string };

  if (WAIT_FOR_FINAL_ANSWER) {
    await page.waitForFunction(
      (prompt) => {
        const field = document.getElementById("ai-tutor-message-field");
        const tutorAside = field?.closest("aside");
        const text = tutorAside?.innerText || "";
        return (
          text.includes(prompt) &&
          !text.includes("正在整理你的问题...") &&
          !text.includes("正在整理答案...") &&
          !text.includes("正在生成回答...") &&
          !text.includes("AI 导师处理中") &&
          !text.includes("当前后端回答暂时不可用") &&
          !text.includes("我先记录下你的问题了")
        );
      },
      TEST_PROMPT,
      { timeout: 60_000 },
    );
  } else {
    await page.waitForTimeout(4_000);
  }

  const tutorContainer = page.locator("#ai-tutor-message-field").locator("xpath=ancestor::aside[1]");
  const tutorText = await tutorContainer.innerText();
  const imageAttachmentCount = await tutorContainer.locator('img[alt*="usagi_perfect_1779717893221"]').count().catch(() => 0);

  const hasAnswer =
    tutorText.includes(TEST_PROMPT) &&
    !tutorText.includes("正在整理你的问题...") &&
    !tutorText.includes("正在整理答案...") &&
    !tutorText.includes("正在生成回答...") &&
    !tutorText.includes("AI 导师处理中") &&
    !tutorText.includes("当前后端回答暂时不可用") &&
    !tutorText.includes("我先记录下你的问题了");

  return {
    ok: Boolean(payload.question_images?.length) && (WAIT_FOR_FINAL_ANSWER ? hasAnswer : true) && imageAttachmentCount > 0,
    hasImagePayload: Boolean(payload.question_images?.length),
    questionId: null,
    attachmentNames: imageAttachmentCount > 0 ? ["image-attached-in-message"] : [],
    hasAnswer,
    tutorTextSnippet: tutorText.slice(0, 900),
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  const consoleLogs: Array<{ type: string; text: string }> = [];
  page.on("console", (msg) => consoleLogs.push({ type: msg.type(), text: msg.text() }));

  try {
    await bootstrapSession(page);

    const results: Array<{
      name: string;
      path: string;
      ok: boolean;
      hasImagePayload: boolean;
      questionId: string | null;
      attachmentNames: string[];
      hasAnswer: boolean;
      tutorTextSnippet?: string;
      error?: string;
    }> = [];

    const targetPages = ONLY_PAGE ? PAGES.filter((item) => item.name === ONLY_PAGE) : PAGES;

    for (const item of targetPages) {
      try {
        const result = await runVisionForPage(page, item.path);
        const pageResult = {
          name: item.name,
          path: item.path,
          ...result,
        };
        results.push(pageResult);
        console.log(JSON.stringify({ page: item.name, result: pageResult }, null, 2));
      } catch (error) {
        const pageResult = {
          name: item.name,
          path: item.path,
          ok: false,
          hasImagePayload: false,
          questionId: null,
          attachmentNames: [],
          hasAnswer: false,
          error: error instanceof Error ? error.message : String(error),
        };
        results.push(pageResult);
        console.log(JSON.stringify({ page: item.name, result: pageResult }, null, 2));
      } finally {
        await closeTutor(page);
      }
    }

    const summary = {
      ok: results.every((item) => item.ok),
      results,
      consoleLogs: consoleLogs.slice(-40),
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
