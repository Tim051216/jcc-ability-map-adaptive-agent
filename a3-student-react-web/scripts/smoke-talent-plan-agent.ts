import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const checks: Array<[string, boolean]> = [];

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator("#login-id-input").fill("demo2024");
  await page.locator("#login-password-input").fill("bililearn");
  await page.waitForTimeout(500);
  await page.locator("#login-submit-btn").click();
  await page.waitForFunction(() => window.location.pathname !== "/login", undefined, { timeout: 30_000 });

  await page.goto(`${baseUrl}/overview`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const agentButton = page.locator("#header-ai-tutor-pill");
  checks.push(["全局入口已更名", (await agentButton.innerText()).includes("培养方案优化智能体")]);
  await agentButton.click();
  const overview = page.getByTestId("talent-plan-agent-overview");
  await overview.waitFor({ state: "visible", timeout: 30_000 });
  checks.push(["智能体名称正确", (await overview.getByText("人才培养方案智能优化智能体", { exact: true }).count()) === 1]);
  const capabilityCounts = await Promise.all(["采集岗位", "分析趋势", "生成方案"].map((text) => overview.getByText(text, { exact: true }).count()));
  checks.push(["能力链完整", capabilityCounts.every((count) => count === 1)]);
  checks.push(["快捷问题符合赛题", (await page.getByText("分析当前专业与岗位技能需求的匹配度", { exact: true }).count()) === 1]);

  await overview.getByRole("link", { name: "打开数据看板" }).click();
  await page.waitForFunction(() => window.location.pathname === "/industry-dashboard", undefined, { timeout: 30_000 });
  await page.getByTestId("talent-plan-workflow").waitFor({ state: "visible", timeout: 30_000 });
  await page.getByText("匹配岗位", { exact: true }).waitFor({ state: "visible", timeout: 60_000 });

  const body = await page.locator("body").innerText();
  checks.push(["公开岗位采集可核验", body.includes("公开岗位采集 · 规则分析 · 需人工复核") && body.includes("可核验来源")]);
  checks.push(["技能趋势与匹配度可见", body.includes("技能热度曲线") && body.includes("技能热度与专业匹配度")]);
  checks.push(["专业预警可见", body.includes("专业预警与优化建议") && body.includes("预警项")]);
  checks.push(["优化方案可生成", body.includes("培养方案结构化优化清单") && body.includes("实施动作") && body.includes("数据依据")]);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出优化清单 CSV" }).click();
  const download = await downloadPromise;
  checks.push(["优化方案可导出", download.suggestedFilename().startsWith("岗位分析优化清单-")]);
} finally {
  await browser.close();
}

for (const [name, passed] of checks) console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
if (checks.some(([, passed]) => !passed)) process.exit(1);
