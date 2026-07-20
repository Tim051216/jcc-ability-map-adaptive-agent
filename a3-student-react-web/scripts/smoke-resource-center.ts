import { chromium } from "playwright";

type ResourceCenterCheckResult = {
  url: string;
  finalUrl?: string;
  viewExistingCount?: number;
  generateCount?: number;
  categoryFilterCount?: number;
  searchInputCount?: number;
  passed?: boolean;
  error?: string;
};

const BASE_URL = "http://127.0.0.1:3002";
const TARGET_URL = `${BASE_URL}/resources`;

async function primeSession(page: import("playwright").Page) {
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

async function login(page: import("playwright").Page) {
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
  const result: ResourceCenterCheckResult = {
    url: TARGET_URL,
  };

  try {
    await primeSession(page);
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.locator("#resource-center-refresh-existing-btn").waitFor({ timeout: 20_000 });
    await page.locator("#resource-center-generate-btn").waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1_500);

    result.finalUrl = page.url();
    result.viewExistingCount = await page.locator("#resource-center-refresh-existing-btn").count();
    result.generateCount = await page.locator("#resource-center-generate-btn").count();
    result.categoryFilterCount = await page
      .locator("button")
      .filter({ hasText: /全部资源|讲义资料|实践笔记|视频资源/ })
      .count();
    result.searchInputCount = await page.locator("#resource-filter-input").count();

    result.passed =
      result.finalUrl.includes("/resources") &&
      result.viewExistingCount === 1 &&
      result.generateCount === 1 &&
      result.categoryFilterCount >= 4 &&
      result.searchInputCount === 1;
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
