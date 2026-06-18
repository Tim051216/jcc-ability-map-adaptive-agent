import { chromium } from "playwright";

type BundleSmokeResult = {
  url: string;
  cardCount?: number;
  bundleTitle?: string;
  previewFromFilePassed?: boolean;
  previewFromMorePassed?: boolean;
  tutorOpenPassed?: boolean;
  tutorPayload?: Record<string, unknown> | null;
  finalUrl?: string;
  passed?: boolean;
  error?: string;
};

const BASE_URL = "http://127.0.0.1:3002";
const TARGET_URL = `${BASE_URL}/resources?courseId=series-2`;

async function primeSession(page: import("playwright").Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "bililearn-user-session",
      JSON.stringify({
        id: "demo2024",
        name: "联合研学画像已接入",
        avatar: "/src/assets/images/haibara_academic_1779716437995.png",
        loggedIn: true,
      }),
    );
    sessionStorage.setItem("hasSeenWelcome", "true");
    (window as typeof window & { __tutorEvents?: unknown[] }).__tutorEvents = [];
    window.addEventListener("open-ai-tutor-panel", (event) => {
      const customEvent = event as CustomEvent;
      const events = ((window as typeof window & { __tutorEvents?: unknown[] }).__tutorEvents ||= []);
      events.push(customEvent.detail ?? null);
    });
  });
}

async function login(page: import("playwright").Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(500);
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
  const result: BundleSmokeResult = {
    url: TARGET_URL,
  };

  try {
    await primeSession(page);
    await login(page);
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    const getFirstCard = () => page.locator('[id^="resource-binder-grid-"]').first();
    await page.waitForSelector('[id^="resource-binder-grid-"]', { timeout: 20_000 });
    await page.waitForTimeout(1200);

    const cards = page.locator('[id^="resource-binder-grid-"]');
    result.cardCount = await cards.count();

    let firstCard = getFirstCard();
    result.bundleTitle = (await firstCard.locator("h3").first().textContent())?.trim() || undefined;

    const firstFileButton = firstCard.locator('button[id^="file-node-"]').first();
    if (await firstFileButton.count()) {
      await firstFileButton.click({ force: true });
      await page.waitForURL("**/resources/preview**", { timeout: 20_000 });
      await page.locator("#resource-source-preview-workspace").waitFor({ timeout: 20_000 });
      result.previewFromFilePassed = page.url().includes("/resources/preview");
      await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      await page.waitForSelector('[id^="resource-binder-grid-"]', { timeout: 20_000 });
      firstCard = getFirstCard();
    } else {
      result.previewFromFilePassed = false;
    }

    const moreButton = firstCard.getByRole("button", { name: "查看这门课剩余资料" });
    if (await moreButton.count()) {
      await moreButton.click({ force: true });
      await page.waitForURL("**/resources/preview**", { timeout: 20_000 });
      await page.locator("#resource-source-preview-workspace").waitFor({ timeout: 20_000 });
      result.previewFromMorePassed = page.url().includes("/resources/preview");
      await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      await page.waitForSelector('[id^="resource-binder-grid-"]', { timeout: 20_000 });
      firstCard = getFirstCard();
    } else {
      result.previewFromMorePassed = true;
    }

    await firstCard.waitFor({ timeout: 20_000 });
    const tutorButtons = firstCard.locator("button");
    const tutorButtonTexts = await tutorButtons.evaluateAll((nodes) =>
      nodes.map((node) => (node.textContent || "").replace(/\s+/g, " ").trim()),
    );
    const tutorIndex = tutorButtonTexts.findIndex((text) => text.includes("交给 AI 导师"));
    if (tutorIndex === -1) {
      throw new Error(`未找到交给 AI 导师按钮: ${JSON.stringify(tutorButtonTexts)}`);
    }
    await tutorButtons.nth(tutorIndex).click({ force: true });
    await page.waitForFunction(() => {
      const events = (window as typeof window & { __tutorEvents?: unknown[] }).__tutorEvents;
      return Array.isArray(events) && events.length > 0;
    }, { timeout: 10_000 });

    const tutorPayload = await page.evaluate(() => {
      const events = (window as typeof window & { __tutorEvents?: unknown[] }).__tutorEvents || [];
      return (events[events.length - 1] as Record<string, unknown> | null) || null;
    });

    result.tutorPayload = tutorPayload;
    result.tutorOpenPassed = Boolean(
      tutorPayload &&
        typeof tutorPayload === "object" &&
        tutorPayload.courseId &&
        tutorPayload.title,
    );
    result.finalUrl = page.url();
    result.passed = Boolean(result.previewFromFilePassed && result.previewFromMorePassed && result.tutorOpenPassed);
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
