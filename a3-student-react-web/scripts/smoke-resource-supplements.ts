import { chromium, type Page } from "playwright";

type SupplementCase = {
  id: string;
  label: string;
  successLabel: string;
};

type SupplementCheckResult = {
  label: string;
  successLabel: string;
  buttonVisibleInitially: boolean;
  generateStatus?: number;
  redirectedToPreview?: boolean;
  previewUrl?: string;
  previewLoaded?: boolean;
  passed?: boolean;
  error?: string;
};

type SupplementSmokeResult = {
  url: string;
  userId: string;
  courseId: string;
  cardCount?: number;
  bundleTitle?: string;
  checks: SupplementCheckResult[];
  passed?: boolean;
  error?: string;
};

const BASE_URL = "http://127.0.0.1:3002";
const TARGET_COURSE_ID = process.argv[2] || "course-4";
const TARGET_URL = `${BASE_URL}/resources?courseId=${TARGET_COURSE_ID}`;
const SESSION_KEY = "a3-student-user-session";

const CASES: SupplementCase[] = [
  { id: "extended_reading", label: "补阅读", successLabel: "拓展阅读" },
  { id: "coding_lab", label: "补实操", successLabel: "代码实操" },
  { id: "visual_illustration", label: "补插图", successLabel: "教学插图" },
  { id: "micro_video", label: "补动画", successLabel: "讲解动画" },
  { id: "subtitle_transcript", label: "补字幕", successLabel: "ASR 字幕" },
  { id: "ocr_notes", label: "补板书", successLabel: "OCR 板书" },
];

async function primeSession(page: Page, userId: string) {
  await page.addInitScript(
    ({ sessionKey, userId: nextUserId }) => {
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({
          id: nextUserId,
          name: `resource-smoke-${nextUserId}`,
          avatar: "/src/assets/images/haibara_academic_1779716437995.png",
          loggedIn: true,
        }),
      );
      sessionStorage.setItem("hasSeenWelcome", "true");
    },
    { sessionKey: SESSION_KEY, userId },
  );
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

async function openTargetPage(page: Page) {
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForSelector('[id^="resource-binder-grid-"]', { timeout: 20_000 });
  await page.waitForTimeout(1200);
}

async function waitForPreviewPage(page: Page) {
  await page.waitForURL(/\/resources\/preview\?/, { timeout: 20_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(1200);
  await page
    .waitForSelector("text=/预览|Preview|讲义|字幕|板书|导图|实操|动画|插图/", {
      timeout: 15_000,
    })
    .catch(() => undefined);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  const userId = String(Date.now()).slice(-8);
  const result: SupplementSmokeResult = {
    url: TARGET_URL,
    userId,
    courseId: TARGET_COURSE_ID,
    checks: [],
  };

  try {
    await primeSession(page, userId);
    await login(page);
    await openTargetPage(page);

    const getFirstCard = () => page.locator('[id^="resource-binder-grid-"]').first();
    const firstCard = getFirstCard();
    result.cardCount = await page.locator('[id^="resource-binder-grid-"]').count();
    result.bundleTitle = (await firstCard.locator("h3").first().textContent())?.trim() || undefined;

    for (const supplement of CASES) {
      await openTargetPage(page);
      const card = getFirstCard();
      const check: SupplementCheckResult = {
        label: supplement.label,
        successLabel: supplement.successLabel,
        buttonVisibleInitially: false,
      };

      try {
        const button = card.locator(`button[data-resource-supplement="${supplement.id}"]`).first();
        check.buttonVisibleInitially = (await button.count()) > 0;
        if (!check.buttonVisibleInitially) {
          throw new Error(`未找到补资源按钮：${supplement.label}`);
        }

        const generatePromise = page.waitForResponse(
          (response) =>
            response.url().includes("/ai/api/v1/resource/generate") &&
            response.request().method() === "POST",
          { timeout: 60_000 },
        );

        await button.click({ force: true });
        const generateResponse = await generatePromise;
        check.generateStatus = generateResponse.status();

        await waitForPreviewPage(page);
        check.previewUrl = page.url();
        check.redirectedToPreview = check.previewUrl.includes("/resources/preview?");
        check.previewLoaded =
          /[?&]resourceId=/.test(check.previewUrl) &&
          /[?&]fileId=/.test(check.previewUrl) &&
          (await page.locator("body").innerText()).length > 50;

        check.passed =
          check.generateStatus === 200 &&
          check.redirectedToPreview === true &&
          check.previewLoaded === true;
      } catch (error) {
        check.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        check.passed = false;
      }

      result.checks.push(check);
    }

    result.passed = result.checks.every((item) => item.passed);
  } catch (error) {
    result.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    result.passed = false;
  }

  await browser.close();

  console.log(
    JSON.stringify(
      {
        summary: {
          total: result.checks.length || 1,
          passed: result.checks.filter((item) => item.passed).length,
          failed: result.checks.filter((item) => !item.passed).length,
        },
        checks: result.checks,
        meta: {
          url: result.url,
          userId: result.userId,
          courseId: result.courseId,
          cardCount: result.cardCount,
          bundleTitle: result.bundleTitle,
          error: result.error,
          passed: result.passed,
        },
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
