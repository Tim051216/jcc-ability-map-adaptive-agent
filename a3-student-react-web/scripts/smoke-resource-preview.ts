import { chromium, type Page } from "playwright";

type PreviewCase = {
  name: string;
  url: string;
};

type PreviewCheckResult = {
  name: string;
  url: string;
  finalUrl?: string;
  passed?: boolean;
  detail?: Record<string, unknown>;
  error?: string;
};

const BASE_URL = "http://127.0.0.1:3002";

const CASES: PreviewCase[] = [
  {
    name: "mindmap-preview",
    url: `${BASE_URL}/resources/preview?courseId=series-2&resourceId=9729&fileId=401`,
  },
  {
    name: "handout-preview",
    url: `${BASE_URL}/resources/preview?courseId=series-2&resourceId=9728&fileId=401`,
  },
  {
    name: "practice-preview",
    url: `${BASE_URL}/resources/preview?courseId=series-2&resourceId=9667&fileId=401`,
  },
];

async function primeSession(page: Page) {
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
  });
}

async function checkCase(page: Page, previewCase: PreviewCase): Promise<PreviewCheckResult> {
  const result: PreviewCheckResult = {
    name: previewCase.name,
    url: previewCase.url,
  };

  try {
    let workspaceCount = 0;
    let filePillCount = 0;
    let openRawFileCount = 0;
    let bodyText = "";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await page.goto(previewCase.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      await page.waitForTimeout(1500 + attempt * 1000);
      bodyText = await page.locator("body").innerText();
      workspaceCount = await page.locator("#resource-source-preview-workspace").count();
      filePillCount = await page.locator('[id^="preview-file-pill-"]').count();
      openRawFileCount = await page.locator("button").filter({ hasText: /打开原始文件|鎵撳紑鍘熷鏂囦欢/ }).count();
      if (workspaceCount > 0 && filePillCount > 0) {
        break;
      }
    }


    const hasPreviewWorkbench = bodyText.includes("资料预览台") || bodyText.includes("璧勬枡棰勮鍙?");
    const hasCurrentAsset = bodyText.includes("当前资料") || bodyText.includes("褰撳墠璧勬枡锛?");
    const hasPreviewMode = bodyText.includes("预览方式") || bodyText.includes("棰勮鏂瑰紡");
    const hasMultimodalPanel =
      bodyText.includes("多模态教学增强结果") || bodyText.includes("澶氭ā鎬佹暀瀛﹀寮虹粨鏋?");

    result.finalUrl = page.url();
    result.detail = {
      workspaceCount,
      filePillCount,
      openRawFileCount,
      hasPreviewWorkbench,
      hasCurrentAsset,
      hasPreviewMode,
      hasMultimodalPanel,
    };
    result.passed =
      workspaceCount === 1 &&
      filePillCount >= 3 &&
      openRawFileCount >= 1 &&
      hasPreviewWorkbench &&
      hasCurrentAsset &&
      hasPreviewMode &&
      hasMultimodalPanel;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    result.passed = false;
    return result;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  const checks: PreviewCheckResult[] = [];
  for (const previewCase of CASES) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    await primeSession(page);
    checks.push(await checkCase(page, previewCase));
    await page.close();
  }

  await browser.close();

  const passed = checks.filter((item) => item.passed).length;
  const failed = checks.length - passed;

  console.log(
    JSON.stringify(
      {
        summary: {
          total: checks.length,
          passed,
          failed,
        },
        checks,
      },
      null,
      2,
    ),
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
