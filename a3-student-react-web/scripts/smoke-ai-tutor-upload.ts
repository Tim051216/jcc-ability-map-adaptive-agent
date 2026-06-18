import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.AI_TUTOR_BASE_URL ?? "http://127.0.0.1:3002";
const LOGIN_ID = process.env.AI_TUTOR_LOGIN_ID ?? "demo2024";
const LOGIN_PASSWORD = process.env.AI_TUTOR_LOGIN_PASSWORD ?? "bililearn";
const PREVIEW_URL =
  process.env.AI_TUTOR_PREVIEW_URL ??
  `${BASE_URL}/resources/preview?courseId=series-2&resourceId=9921&fileId=401`;

async function login(page: import("playwright").Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 60_000 });
  const idInput = page.locator("#login-id-input");
  if (await idInput.count()) {
    await idInput.fill(LOGIN_ID);
    await page.locator("#login-password-input").fill(LOGIN_PASSWORD);
    await page.locator("#login-submit-btn").click({ force: true });
    await page.waitForURL("**/", { timeout: 20_000 });
    await page.waitForTimeout(1_000);
  }
  await page.evaluate(() => {
    sessionStorage.setItem("hasSeenWelcome", "true");
    localStorage.setItem("a3-student-welcome-seen", "true");
  });
}

async function openTutorSurface(page: import("playwright").Page) {
  await page.goto(PREVIEW_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
  const openTutorButton = page.locator('button[aria-label="打开代码实操 AI 导师"], button[aria-label="从代码实操页打开 AI 导师"]').first();
  await openTutorButton.waitFor({ state: "visible", timeout: 30_000 });
  await openTutorButton.click();
  await page.waitForSelector("#ai-tutor-message-field", { timeout: 30_000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
  const page = await context.newPage();
  const tempFile = path.join(os.tmpdir(), `bililearn-ai-tutor-${Date.now()}.txt`);

  try {
    await fs.writeFile(
      tempFile,
      [
        "React 状态管理要点",
        "1. 拆分局部状态和全局状态",
        "2. 优先保持单向数据流",
        "3. Context 配合 reducer 管理共享状态",
      ].join("\n"),
      "utf-8",
    );

    await login(page);
    await openTutorSurface(page);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(tempFile);

    const extractedBadge = page.locator('text="已提取正文"').first();
    await extractedBadge.waitFor({ state: "visible", timeout: 20_000 });

    const expandButton = page.locator('button:has-text("展开正文")').first();
    await expandButton.waitFor({ state: "visible", timeout: 20_000 });
    await expandButton.click();
    await page.waitForTimeout(1_000);

    const tutorSurface = page.locator('[data-tutor-reveal]').first();
    const surfaceText = await tutorSurface.innerText();
    const extractedContentVisible = surfaceText.includes("React 状态管理要点");
    if (!extractedContentVisible) {
      throw new Error(`Extracted text not found in tutor surface. Surface text: ${surfaceText}`);
    }

    const copyButton = page.locator('button:has-text("复制正文")').first();
    await copyButton.waitFor({ state: "visible", timeout: 20_000 });
    await copyButton.click();
    await page.waitForTimeout(500);

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    const copiedToClipboard = clipboardText.includes("React 状态管理要点");
    if (!copiedToClipboard) {
      throw new Error(`Extracted text was not copied to clipboard. Clipboard value: ${clipboardText}`);
    }

    const insertButton = page.locator('button:has-text("插入输入框")').first();
    await insertButton.waitFor({ state: "visible", timeout: 20_000 });
    await insertButton.click();
    await page.waitForTimeout(500);

    const textareaValue = await page.locator("#ai-tutor-message-field").inputValue();
    const insertedIntoComposer = textareaValue.includes("请结合附件") && textareaValue.includes("React 状态管理要点");
    if (!insertedIntoComposer) {
      throw new Error(`Extracted text was not inserted into composer. Current value: ${textareaValue}`);
    }

    const sendExtractedButton = page.locator('button:has-text("发送这段正文")').first();
    await sendExtractedButton.waitFor({ state: "visible", timeout: 20_000 });
    await sendExtractedButton.click();
    await page.waitForTimeout(1_000);

    await page.waitForTimeout(1_000);
    const sentQuestionVisible = await page
      .locator("text=这次提问已带入附件提取正文，回答会优先结合文档/资料内容。")
      .first()
      .isVisible()
      .catch(() => false);

    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        return text.includes("已结合附件：") || text.includes("附件识别保护已生效：当前为基于提取正文的快速结果");
      },
      undefined,
      { timeout: 45_000 },
    );

    const sidebarTextAfterSend = await tutorSurface.innerText();
    const sentAsQuestion =
      sidebarTextAfterSend.includes("请结合附件《") && sidebarTextAfterSend.includes("React 状态管理要点");
    if (!sentAsQuestion) {
      throw new Error(`Extracted text was not sent as a question. Tutor surface text: ${sidebarTextAfterSend}`);
    }
    const receivedAttachmentAwareReply =
      sidebarTextAfterSend.includes("已结合附件：") ||
      sidebarTextAfterSend.includes("附件识别保护已生效：当前为基于提取正文的快速结果");

    const summary = {
      ok: true,
      checks: [
        "login",
        "open_ai_tutor",
        "upload_text_file",
        "show_extracted_badge",
        "expand_extracted_text",
        "copy_extracted_text",
        "insert_into_composer",
        "send_extracted_text",
        "attachment_aware_reply",
      ],
      extractedContentVisible,
      copiedToClipboard,
      insertedIntoComposer,
      sentAsQuestion,
      sentQuestionVisible,
      receivedAttachmentAwareReply,
      previewUrl: PREVIEW_URL,
      tempFile,
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await context.close();
    await browser.close();
    await fs.rm(tempFile, { force: true });
  }
}

void main();
