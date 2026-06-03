import { chromium, type Page } from "playwright";

type VideoExpectation = {
  fileId: string;
  resourceId: string;
  expectedSectionId: number;
  expectedVideoPath: string;
  expectedEpisodeTitle: string;
};

type VideoCheckResult = {
  fileId: string;
  resourceId: string;
  expectedSectionId: number;
  expectedVideoPath: string;
  expectedEpisodeTitle: string;
  resourceUrl?: string;
  learnUrl?: string;
  focusedCardExists?: number;
  focusedFileExists?: number;
  activeEpisodeTitle?: string | null;
  videoState?: {
    currentSrc: string;
    currentTime: number;
    paused: boolean;
    muted: boolean;
    readyState: number;
  };
  error?: string;
};

const BASE_URL = "http://127.0.0.1:3002";

const EXPECTATIONS: VideoExpectation[] = [
  {
    fileId: "902",
    resourceId: "900002",
    expectedSectionId: 0,
    expectedVideoPath: "/videos/software-engineering-4th/visio-flow-demo.mp4",
    expectedEpisodeTitle: "第一章：核心系统架构模式与状态边界",
  },
  {
    fileId: "901",
    resourceId: "900001",
    expectedSectionId: 1,
    expectedVideoPath: "/videos/software-engineering-4th/project-demo.mp4",
    expectedEpisodeTitle: "第二章：Hooks组合设计与Context多维切片",
  },
  {
    fileId: "903",
    resourceId: "900003",
    expectedSectionId: 2,
    expectedVideoPath: "/videos/software-engineering-4th/cloud-app-demo.mp4",
    expectedEpisodeTitle: "第三章：子组件级联渲染深度优化精讲",
  },
];

async function primeSession(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "bililearn-user-session",
      JSON.stringify({
        id: "demo2024",
        name: "联合研学契约 (灰原 & 乌萨奇)",
        avatar: "/src/assets/images/haibara_academic_1779716437995.png",
        loggedIn: true,
      }),
    );
    sessionStorage.setItem("hasSeenWelcome", "1");
  });
}

async function getActiveEpisodeTitle(page: Page) {
  const buttons = page.locator("aside section").filter({ hasText: "本课题下辖章节目录" }).locator("button");
  const count = await buttons.count();
  for (let i = 0; i < count; i += 1) {
    const button = buttons.nth(i);
    const className = (await button.getAttribute("class")) || "";
    if (className.includes("border-[#fb7299]/40")) {
      const text = await button.innerText();
      return text.split("\n")[0]?.trim() || null;
    }
  }
  return null;
}

async function checkVideoFlow(page: Page, expectation: VideoExpectation): Promise<VideoCheckResult> {
  const result: VideoCheckResult = {
    ...expectation,
  };

  try {
    const resourceUrl = `${BASE_URL}/resources?courseId=series-2&resourceId=${expectation.resourceId}`;
    await page.goto(resourceUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(1_500);

    result.resourceUrl = page.url();
    result.focusedCardExists = await page.locator(`#resource-binder-grid-${expectation.resourceId}`).count();
    result.focusedFileExists = await page.locator(`#file-node-${expectation.fileId}`).count();

    await page.locator(`#file-node-${expectation.fileId}`).click({ timeout: 15_000 });
    await page.waitForURL(/\/learn\?/, { timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 60_000 });
    await page.waitForTimeout(2_500);

    result.learnUrl = page.url();
    result.activeEpisodeTitle = await getActiveEpisodeTitle(page);

    const video = page.locator("#classroom-video-tag");
    if (await video.count()) {
      result.videoState = await video.evaluate((node) => ({
        currentSrc: node.currentSrc,
        currentTime: Number(node.currentTime.toFixed(2)),
        paused: node.paused,
        muted: node.muted,
        readyState: node.readyState,
      }));
    }
  } catch (error) {
    result.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }

  return result;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });

  await primeSession(page);

  const results: VideoCheckResult[] = [];
  for (const expectation of EXPECTATIONS) {
    results.push(await checkVideoFlow(page, expectation));
  }

  await browser.close();
  console.log(JSON.stringify({ checks: results }, null, 2));
}

void main();
