import { chromium, type Page } from "playwright";

type LearnFlowCheckResult = {
  courseUrl: string;
  entryNodeId?: string;
  previewUrl?: string;
  finalUrl?: string;
  previewButtonCount?: number;
  previewWorkspaceCount?: number;
  passed?: boolean;
  error?: string;
};

const BASE_URL = "http://127.0.0.1:3002";
const TARGET_URL = `${BASE_URL}/resources?courseId=series-2`;

async function primeSession(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "a3-student-user-session",
      JSON.stringify({
        id: "demo2024",
        name: "联合研学图像已接入",
        avatar: "/src/assets/images/haibara_academic_1779716437995.png",
        loggedIn: true,
      }),
    );
    sessionStorage.setItem("hasSeenWelcome", "true");
  });
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(500);
  if (!page.url().includes("/login")) {
    return;
  }
  const idInput = page.locator("#login-id-input");
  if (await idInput.count()) {
    await idInput.fill("demo2024");
    await page.locator("#login-password-input").fill("bililearn");
    await page.locator("#login-submit-btn").click({ force: true });
    await page.waitForURL("**/", { timeout: 20_000 });
    await page.waitForTimeout(800);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  const result: LearnFlowCheckResult = {
    courseUrl: TARGET_URL,
  };

  try {
    await primeSession(page);
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForSelector("[id^='file-node-']", { timeout: 20_000 });

    const firstNode = page.locator("[id^='file-node-']").first();
    const entryNodeId = await firstNode.getAttribute("id");
    result.entryNodeId = entryNodeId || undefined;

    await firstNode.click({ timeout: 20_000, force: true });
    await page.waitForFunction(
      () => window.location.pathname === "/learn" || window.location.pathname === "/resources/preview",
      undefined,
      { timeout: 30_000 },
    );
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(1800);

    result.previewUrl = page.url();

    if (page.url().includes("/resources/preview")) {
      await page.waitForSelector("#resource-source-preview-workspace", { timeout: 20_000 });
      result.previewButtonCount = await page.locator("#preview-enter-classroom-btn, #current-file-enter-classroom-btn").count();
      result.previewWorkspaceCount = await page.locator("#resource-source-preview-workspace").count();
    }

    result.finalUrl = page.url();
    result.passed =
      Boolean(result.entryNodeId) &&
      result.previewUrl?.includes("/resources/preview?courseId=series-2") === true &&
      result.finalUrl.includes("/resources/preview?courseId=series-2") &&
      result.previewWorkspaceCount === 1;
  } catch (error) {
    result.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    result.passed = false;
  }

  await browser.close();

  console.log(
    JSON.stringify(
      {
        summary: {
          total: 1,
          passed: result.passed ? 1 : 0,
          failed: result.passed ? 0 : 1,
        },
        checks: [result],
      },
      null,
      2,
    ),
  );

  if (!result.passed) {
    process.exitCode = 1;
  }
}

void main();
