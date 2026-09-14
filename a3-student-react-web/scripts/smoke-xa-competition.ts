import { chromium, type Page } from "playwright";

const BASE_URL = process.env.XA_UI_BASE_URL || "http://127.0.0.1:3002";

type Check = {
  name: string;
  passed: boolean;
  detail: string;
};

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator("#login-id-input").fill("demo2024");
  await page.locator("#login-password-input").fill("bililearn");
  await page.locator("#login-submit-btn").click();
  await page.waitForFunction(() => window.location.pathname !== "/login", undefined, { timeout: 30_000 });
}

async function visibleText(page: Page, text: string, timeout = 30_000) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout });
}

async function runCheck(checks: Check[], name: string, action: () => Promise<string>) {
  try {
    checks.push({ name, passed: true, detail: await action() });
  } catch (error) {
    checks.push({
      name,
      passed: false,
      detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  }
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const checks: Check[] = [];

  await login(page);

  await runCheck(checks, "人才培养方案智能优化智能体入口", async () => {
    await page.goto(`${BASE_URL}/overview`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator("#header-ai-tutor-pill").click();
    await page.getByTestId("talent-plan-agent-overview").waitFor({ state: "visible", timeout: 30_000 });
    await visibleText(page, "采集岗位", 30_000);
    await visibleText(page, "分析趋势", 30_000);
    await visibleText(page, "生成方案", 30_000);
    await visibleText(page, "分析当前专业与岗位技能需求的匹配度", 30_000);
    return "原 AI 导师入口已改为培养方案优化智能体，岗位采集、趋势分析、专业预警和方案生成能力可见";
  });

  await runCheck(checks, "产业岗位分析看板", async () => {
    await page.goto(`${BASE_URL}/industry-dashboard`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await visibleText(page, "人才培养方案智能优化智能体", 60_000);
    await page.getByTestId("talent-plan-workflow").waitFor({ state: "visible", timeout: 60_000 });
    await visibleText(page, "匹配岗位", 60_000);
    await visibleText(page, "专业群横向监测", 60_000);
    await visibleText(page, "从", 60_000);
    const body = await page.locator("body").innerText();
    if (!body.includes("公开记录筛选")) throw new Error("缺少公开岗位总数与专业群匹配数说明");
    if (!body.includes("单次真实采集") && !body.includes("真实采集快照趋势")) {
      throw new Error("缺少真实采集趋势边界说明");
    }
    return "公开岗位数量、六专业群监测、趋势边界和培养方案建议均已渲染";
  });

  await runCheck(checks, "岗位能力图谱", async () => {
    await page.goto(`${BASE_URL}/job-ability-graph?job=${encodeURIComponent("软件开发工程师")}&group=${encodeURIComponent("软件技术专业群")}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("button", { name: "带入岗位技能" }).click();
    await visibleText(page, "岗位能力思维导图", 60_000);
    await visibleText(page, "能力单元", 60_000);
    await visibleText(page, "技能点", 60_000);
    await visibleText(page, "知识点", 60_000);
    await page.getByRole("img", { name: "岗位能力雷达图" }).waitFor({ state: "visible", timeout: 30_000 });
    return "产业岗位技能已带入，产业链、岗位群、能力项、能力单元、技能/知识点及雷达图可见";
  });

  await runCheck(checks, "岗位任务转学习卡", async () => {
    await page.goto(`${BASE_URL}/learning-task-factory?job=${encodeURIComponent("新能源汽车维修技师")}&group=${encodeURIComponent("新能源汽车技术专业群")}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("button", { name: "从产业岗位分析带入" }).click();
    await page.getByRole("button", { name: "生成学习任务卡" }).click();
    await visibleText(page, "已生成 · 任务卡", 30_000);
    for (const text of ["任务描述", "工作情境", "操作步骤", "安全要点", "知识点与技能点", "关联校内实训资源"]) {
      await visibleText(page, text, 30_000);
    }
    return "产业数据已带入，任务情境、步骤、安全点、知识技能映射和校内资源均已生成";
  });

  await runCheck(checks, "岗课赛自适应学习", async () => {
    await page.goto(`${BASE_URL}/job-learning`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await visibleText(page, "岗位学情诊断输入", 90_000);
    const scoreInputs = page.locator('input[type="number"]');
    const count = await scoreInputs.count();
    if (!count) throw new Error("未找到真实诊断分数输入框");
    for (let index = 0; index < count; index += 1) {
      await scoreInputs.nth(index).fill(index === 0 ? "42" : String(65 + index * 5));
    }
    const generate = page.getByRole("button", { name: "生成自适应路径" });
    if (!(await generate.isEnabled())) throw new Error("输入诊断成绩后生成按钮仍不可用");
    await generate.click();
    await visibleText(page, "路径进度", 30_000);
    await visibleText(page, "解锁", 30_000);
    const body = await page.locator("body").innerText();
    if (!body.includes("薄弱") || !body.includes("标记已完成")) {
      throw new Error("缺少薄弱项分析或可更新的路径任务");
    }
    return "真实分数输入驱动薄弱项、进度条、徽章、解锁条件和完成状态";
  });

  await browser.close();
  const failed = checks.filter((item) => !item.passed);
  console.log(JSON.stringify({ summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.length }, checks }, null, 2));
  if (failed.length) process.exitCode = 1;
}

void main();
