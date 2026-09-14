import { chromium } from "playwright";

type LoginSmokeResult = {
  url: string;
  finalUrl?: string;
  sessionUserId?: string | null;
  sessionLoggedIn?: boolean;
  persistedUserId?: string | null;
  passed?: boolean;
  error?: string;
};

const BASE_URL = "http://127.0.0.1:3002";
const LOGIN_URL = `${BASE_URL}/login`;
const SESSION_STORAGE_KEY = "a3-student-user-session";
const PERSISTENT_SESSION_STORAGE_KEY = "a3-student-user-session-persistent";
const RECOVERY_SESSION_STORAGE_KEY = "a3-student-user-session-recovery";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });

  const result: LoginSmokeResult = {
    url: LOGIN_URL,
  };

  try {
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator("#login-id-input").waitFor({ timeout: 20_000 });
    await page.locator("#login-id-input").fill("demo2024");
    await page.locator("#login-password-input").fill("bililearn");
    await page.waitForTimeout(500);
    await page.locator("#login-submit-btn").click({ force: true });

    await page.waitForFunction(
      () => window.location.pathname !== "/login",
      undefined,
      { timeout: 60_000 },
    );
    await page.waitForTimeout(1_200);

    const sessionState = await page.evaluate(
      ({ sessionKey, persistentKey, recoveryKey }) => ({
        finalUrl: window.location.href,
        session: (() => {
          const raw = window.sessionStorage.getItem(sessionKey);
          if (!raw) return null;
          try {
            return JSON.parse(raw) as { id?: string; loggedIn?: boolean };
          } catch {
            return null;
          }
        })(),
        persistent: (() => {
          const raw = window.localStorage.getItem(persistentKey);
          if (!raw) return null;
          try {
            return JSON.parse(raw) as { id?: string; loggedIn?: boolean };
          } catch {
            return null;
          }
        })(),
        recovery: (() => {
          const raw = window.localStorage.getItem(recoveryKey);
          if (!raw) return null;
          try {
            return JSON.parse(raw) as { id?: string; loggedIn?: boolean };
          } catch {
            return null;
          }
        })(),
      }),
      {
        sessionKey: SESSION_STORAGE_KEY,
        persistentKey: PERSISTENT_SESSION_STORAGE_KEY,
        recoveryKey: RECOVERY_SESSION_STORAGE_KEY,
      },
    );

    result.finalUrl = sessionState.finalUrl;
    result.sessionUserId = sessionState.session?.id ?? null;
    result.sessionLoggedIn = Boolean(sessionState.session?.loggedIn);
    result.persistedUserId = sessionState.persistent?.id ?? sessionState.recovery?.id ?? null;
    result.passed =
      !result.finalUrl.includes("/login") &&
      result.sessionUserId === "demo2024" &&
      result.sessionLoggedIn === true;
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
