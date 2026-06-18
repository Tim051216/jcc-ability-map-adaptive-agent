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

async function bootstrapSession(page: import("playwright").Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(() => {
    const user = { id: "1001", name: "BiliLearn 用户", avatar: "/src/assets/icon.jpeg", loggedIn: true };
    sessionStorage.setItem("a3-student-user-session", JSON.stringify(user));
    localStorage.setItem("a3-last-account-id", "1001");
    localStorage.setItem("a3-student-user-session-persistent", JSON.stringify(user));
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
  await page.waitForTimeout(900);
}

async function closeTutor(page: import("playwright").Page) {
  const closeButton = page.locator('button[aria-label="收起 AI 导师"]:visible');
  if (await closeButton.count()) {
    await closeButton.click({ force: true });
    await page.waitForTimeout(600);
  }
}

async function runCaptureForPage(page: import("playwright").Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2_000);
  await openTutor(page);

  const captureBtn = page.locator("#ai-tutor-capture-btn");
  await captureBtn.waitFor({ state: "visible", timeout: 20_000 });
  await page.evaluate(() => {
    const button = document.getElementById("ai-tutor-capture-btn") as HTMLButtonElement | null;
    button?.click();
  });
  await page.waitForTimeout(7_000);

  const bodyText = await page.locator("body").innerText();
  const tutorText = await page.locator("aside").last().innerText().catch(() => "");
  const attachmentNames = await page
    .locator("text=/current-viewport-capture\\.png|main-learning-area-capture\\.png|selection-capture\\.png|full-page-capture\\.png/")
    .allInnerTexts()
    .catch(() => []);

  const failureLine =
    tutorText
      .split("\n")
      .find((line) => line.includes("截图失败") || line.includes("当前页面截图失败了")) || null;

  const ok = bodyText.includes("截图已加入聊天框") && attachmentNames.length > 0;

  return {
    ok,
    hasSuccessMessage: bodyText.includes("截图已加入聊天框"),
    hasFailureMessage: bodyText.includes("当前页面截图失败了"),
    attachmentNames,
    failureLine,
    tutorTextSnippet: tutorText.slice(0, 600),
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
      hasSuccessMessage: boolean;
      hasFailureMessage: boolean;
      attachmentNames: string[];
      failureLine?: string | null;
      tutorTextSnippet?: string;
      error?: string;
    }> = [];

    for (const item of PAGES) {
      try {
        const result = await runCaptureForPage(page, item.path);
        results.push({
          name: item.name,
          path: item.path,
          ...result,
        });
      } catch (error) {
        results.push({
          name: item.name,
          path: item.path,
          ok: false,
          hasSuccessMessage: false,
          hasFailureMessage: false,
          attachmentNames: [],
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        await closeTutor(page);
      }
    }

    const summary = {
      ok: results.every((item) => item.ok),
      results,
      consoleLogs: consoleLogs.slice(-30),
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
