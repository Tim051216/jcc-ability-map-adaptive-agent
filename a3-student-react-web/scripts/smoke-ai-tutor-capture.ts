import { chromium } from "playwright";

const BASE_URL = process.env.AI_TUTOR_BASE_URL ?? "http://127.0.0.1:3002";

async function bootstrapSession(page: import("playwright").Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(() => {
    const user = { id: "1001", name: "BiliLearn User", avatar: "/src/assets/icon.jpeg", loggedIn: true };
    sessionStorage.setItem("a3-student-user-session", JSON.stringify(user));
    localStorage.setItem("a3-last-account-id", "1001");
    localStorage.setItem("a3-student-user-session-persistent", JSON.stringify(user));
    sessionStorage.setItem("hasSeenWelcome", "true");
    localStorage.setItem("a3-student-welcome-seen", "true");
  });
}

async function openTutor(page: import("playwright").Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("open-ai-tutor-panel", { detail: {} }));
  });
  await page.waitForTimeout(1_000);
}

async function triggerInlineCapture(page: import("playwright").Page) {
  const captureBtn = page.locator("#ai-tutor-capture-btn");
  await captureBtn.waitFor({ state: "visible", timeout: 20_000 });
  await captureBtn.click({ force: true });

  const overlay = page.locator("[data-capture-overlay='true']");
  const overlayVisible = await overlay.isVisible().catch(() => false);
  if (!overlayVisible) {
    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>("#ai-tutor-capture-btn");
      if (!button) throw new Error("capture button not found");
      button.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse" }),
      );
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    });
  }

  await overlay.waitFor({ state: "visible", timeout: 10_000 });
  const box = await overlay.boundingBox();
  if (!box) throw new Error("capture overlay bounding box unavailable");

  await page.mouse.move(box.x + 80, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 420, box.y + 320, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  const buttons = page.locator("button");
  const count = await buttons.count();
  await buttons.nth(count - 2).click({ force: true });
}

async function isCaptureHelperReady(page: import("playwright").Page) {
  return page.evaluate(async () => {
    try {
      const response = await fetch("http://127.0.0.1:39333/health");
      return response.ok;
    } catch {
      return false;
    }
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });

  try {
    await bootstrapSession(page);
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(2_500);

    await openTutor(page);

    await page.locator("#ai-tutor-message-field").waitFor({ state: "visible", timeout: 20_000 });
    await page.locator("#ai-tutor-message-field").scrollIntoViewIfNeeded();

    const helperReady = await isCaptureHelperReady(page);
    if (helperReady) {
      console.log(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: "helper_capture_requires_foreground_window",
        }, null, 2),
      );
      return;
    }

    await triggerInlineCapture(page);

    await page.waitForFunction(
      () => !!document.querySelector("img[alt='current-viewport-capture.png'], img[alt='selection-capture.png']"),
      undefined,
      { timeout: 30_000 },
    );

    const attachmentThumb = page.locator("img[alt='current-viewport-capture.png'], img[alt='selection-capture.png']").first();
    await attachmentThumb.click({ force: true });
    await page.waitForTimeout(600);

    const result = await page.evaluate(() => {
      const previewButton = Array.from(document.querySelectorAll("button")).find(
        (button) => button.getAttribute("title") === "关闭预览",
      );
      const previewImage = Array.from(document.querySelectorAll("img")).find((img) => {
        const alt = img.getAttribute("alt") || "";
        return alt === "current-viewport-capture.png" || alt === "selection-capture.png";
      }) as HTMLImageElement | undefined;

      return {
        ok: !!previewButton && !!previewImage,
        hasPreview: !!previewButton,
        previewHintVisible: document.body.innerText.includes("高清预览，关闭后可继续提问。"),
        attachmentName: previewImage?.alt || "",
        naturalWidth: previewImage?.naturalWidth || 0,
        naturalHeight: previewImage?.naturalHeight || 0,
        bodyOverflow: getComputedStyle(document.body).overflow,
        htmlOverflow: getComputedStyle(document.documentElement).overflow,
      };
    });

    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

void main();
