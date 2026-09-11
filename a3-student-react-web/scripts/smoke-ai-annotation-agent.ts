import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3002";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const checks: Array<[string, boolean]> = [];
try {
  await page.goto(`${baseUrl}/annotation-agent`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  checks.push(["AI 标注页面可访问", (await page.getByText("AI 数据标注 · 质检助手", { exact: true }).count()) > 0]);
  const input = page.getByPlaceholder("例如：两个行人被遮挡，框怎么画…");
  await input.fill("这张图里的人被车挡住了，框怎么画？");
  await page.getByText("发送", { exact: true }).click();
  checks.push(["遮挡规则返回步骤", (await page.getByText("这是“遮挡目标”判定", { exact: false }).count()) > 0 && (await page.locator("ol").count()) > 0]);
  await input.fill("这个怎么弄？");
  await page.getByText("发送", { exact: true }).click();
  checks.push(["模糊问题触发追问", (await page.getByText("你遇到的是哪类情况？", { exact: false }).count()) > 0]);
  await input.fill("同类目标挨在一起，应该标几个框？");
  await page.getByText("发送", { exact: true }).click();
  checks.push(["同类实例规则返回步骤", (await page.getByText("按“实例”分别标注", { exact: false }).count()) > 0]);
} finally {
  await browser.close();
}
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) process.exit(1);

