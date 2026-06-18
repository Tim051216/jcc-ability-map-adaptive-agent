import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = "http://127.0.0.1:3002";
const TEST_IMAGE_PATH = path.resolve(
  "F:\\A3-cnsoftbei\\a3-learning-agent-system\\a3-student-react-web\\src\\assets\\images\\anime_classroom_1779716413190.png",
);
const TEST_PROMPT = "请描述我上传图片里最明显的学习场景，并告诉我适合怎么继续学。";

async function bootstrapSession(page: import("playwright").Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(() => {
    const user = { id: "1001", name: "BiliLearn 用户", avatar: "/src/assets/icon.jpeg", loggedIn: true };
    sessionStorage.setItem("a3-student-user-session", JSON.stringify(user));
    localStorage.setItem("a3-last-account-id", "1001");
    localStorage.setItem("a3-student-user-session-persistent", JSON.stringify(user));
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  const requests: Array<{ url: string; method: string; body?: string | null }> = [];
  const responses: Array<{ url: string; status: number }> = [];
  const consoleLogs: Array<{ type: string; text: string }> = [];

  page.on("console", (msg) => consoleLogs.push({ type: msg.type(), text: msg.text() }));
  page.on("request", (request) => {
    if (request.url().includes("/tutoring/")) {
      const body = request.postData() || null;
      requests.push({
        url: request.url(),
        method: request.method(),
        body: body
          ? JSON.stringify({
              length: body.length,
              includesQuestionImages: body.includes("\"question_images\""),
            })
          : null,
      });
    }
  });
  page.on("response", (response) => {
    if (response.url().includes("/tutoring/")) {
      responses.push({
        url: response.url(),
        status: response.status(),
      });
    }
  });

  try {
    await bootstrapSession(page);
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(2_000);

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("open-ai-tutor-panel", { detail: {} }));
    });
    await page.waitForTimeout(1_000);

    await page.locator("#ai-tutor-file-input").setInputFiles(TEST_IMAGE_PATH);
    await page.waitForTimeout(2_000);
    await page.locator("#ai-tutor-message-field").fill(TEST_PROMPT);
    await page.waitForTimeout(500);

    const sendDisabledBefore = await page.locator("#ai-chat-send-btn").isDisabled();
    const sidebarBefore = await page.locator("aside").last().innerText().catch(() => "");

    await page.evaluate(() => {
      const button = document.getElementById("ai-chat-send-btn") as HTMLButtonElement | null;
      button?.click();
    });

    await page.waitForTimeout(45_000);

    const sendDisabledAfter = await page.locator("#ai-chat-send-btn").isDisabled();
    const sidebarAfter = await page.locator("aside").last().innerText().catch(() => "");
    const attachmentNames = await page.locator("text=/anime_classroom_1779716413190\\.png/").allInnerTexts().catch(() => []);

    console.log(
      JSON.stringify(
        {
          sendDisabledBefore,
          sendDisabledAfter,
          attachmentNames,
          sidebarBefore,
          sidebarAfter,
          requests,
          responses,
          consoleLogs: consoleLogs.slice(-40),
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

void main();
