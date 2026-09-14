import { chromium } from "playwright";

// Use the IPv4 loopback by default.  On some Windows setups `localhost`
// resolves to IPv6 first while Vite listens on the IPv4 wildcard, producing
// a false-negative smoke result even though the page is healthy.
const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const checks: Array<[string, boolean]> = [];

async function waitForAgentPage(): Promise<void> {
  // The route loads a lazy chunk on the first visit.  Waiting for the
  // visible heading avoids a timing-dependent false failure on slower disks
  // while keeping the assertion tied to a real page element.
  await page.getByText("AI 数据标注 · 质检助手", { exact: true }).waitFor({ state: "visible", timeout: 8000 });
}

try {
  await page.goto(`${baseUrl}/annotation-agent`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.location.pathname === "/login", undefined, { timeout: 8000 });
  checks.push(["未登录直达标注模块会回到 BiliLearn 登录页", new URL(page.url()).pathname === "/login"]);
  await page.locator("#login-id-input").fill("demo2024");
  await page.locator("#login-password-input").fill("bililearn");
  await page.waitForTimeout(500);
  await page.locator("#login-submit-btn").click();
  await page.waitForFunction(() => window.location.pathname === "/annotation-agent", undefined, { timeout: 20_000 });
  await waitForAgentPage();
  await page.evaluate(() => localStorage.removeItem("aiAnnotationTrialFeedback"));
  checks.push(["登录后 AI 标注模块可访问", (await page.getByText("AI 数据标注 · 质检助手", { exact: true }).count()) > 0]);
  checks.push(["标注模块可返回 BiliLearn 主线", (await page.getByRole("link", { name: "返回 BiliLearn 岗课赛自适应学习" }).count()) === 1]);
  await page.getByRole("link", { name: "返回 BiliLearn 岗课赛自适应学习" }).click();
  await page.waitForFunction(() => window.location.pathname === "/job-learning", undefined, { timeout: 30_000 });
  await page.getByTestId("annotation-agent-entry").waitFor({ state: "visible", timeout: 60_000 });
  checks.push(["BiliLearn 主页显示数据标注实训入口", (await page.getByRole("link", { name: "进入 AI 数据标注实训" }).count()) === 1]);
  await page.getByRole("link", { name: "进入 AI 数据标注实训" }).click();
  await page.waitForFunction(() => window.location.pathname === "/annotation-agent", undefined, { timeout: 30_000 });
  await waitForAgentPage();
  checks.push(["可从 BiliLearn 主页进入数据标注模块", new URL(page.url()).pathname === "/annotation-agent"]);
  const legacyResponse = await page.goto(`${baseUrl}/ai-annotation-agent`, { waitUntil: "domcontentloaded" });
  await waitForAgentPage();
  checks.push(["兼容入口可访问", legacyResponse?.status() === 200 && (await page.getByText("AI 数据标注 · 质检助手", { exact: true }).count()) > 0]);
  await page.goto(`${baseUrl}/annotation-agent`, { waitUntil: "domcontentloaded" });
  await waitForAgentPage();
  checks.push([
    "页面显示 AI 生成内容标识",
    (await page.getByTestId("ai-generated-label").count()) >= 1,
  ]);
  checks.push(["闭环流程图示可见", (await page.getByTestId("annotation-flow").count()) === 1 && (await page.getByText("输入现象", { exact: true }).count()) > 0]);
  checks.push(["框选示意图可见且标注为示意", (await page.getByTestId("annotation-sketch").count()) === 1 && (await page.getByText("示意图（非真实样本）", { exact: false }).count()) > 0]);
  checks.push([
    "页面显示知识库数量",
    (await page.getByText(/知识库\s+60\s+条/).count()) > 0 && (await page.getByText(/核心规则\s+3\s+条/).count()) > 0,
  ]);
  checks.push(["岗位工单转学习任务模块可见", (await page.getByTestId("learning-task-transformer").count()) === 1]);
  await page.getByRole("button", { name: "生成学习任务卡" }).click();
  checks.push(["空工单会要求补充真实输入", (await page.getByRole("alert").getByText("请先粘贴真实或脱敏后的数据标注工单", { exact: false }).count()) === 1]);
  await page.getByTestId("fill-work-order-example").click();
  await page.getByRole("button", { name: "生成学习任务卡" }).click();
  const generatedTask = page.getByTestId("generated-learning-task-card");
  checks.push([
    "工单可转为完整学习任务卡",
    (await generatedTask.count()) === 1 &&
      (await generatedTask.getByText("同类实例标注与质检学习任务", { exact: true }).count()) === 1 &&
      (await generatedTask.getByText("操作步骤", { exact: true }).count()) === 1 &&
      (await generatedTask.getByText("知识点", { exact: true }).count()) === 1 &&
      (await generatedTask.getByText("技能点", { exact: true }).count()) === 1 &&
      (await generatedTask.getByText("提交产出与量化验收", { exact: true }).count()) === 1 &&
      (await generatedTask.getByText("安全要点", { exact: true }).count()) === 1 &&
      (await generatedTask.getByText("LT-ANN-INS-01", { exact: true }).count()) === 1,
  ]);
  await page.getByText(/查看候选知识目录（60 条/).click();
  checks.push([
    "候选知识目录可展开",
    (await page.getByTestId("annotation-knowledge-catalog").count()) === 1 &&
      (await page.getByTestId("annotation-knowledge-catalog").getByText("K060", { exact: false }).count()) === 1,
  ]);
  const input = page.getByPlaceholder("例如：两个行人被遮挡，框怎么画…");
  await input.fill("这张图里的人被车挡住了，框怎么画？");
  await page.getByText("发送", { exact: true }).click();
  checks.push(["遮挡规则返回步骤", (await page.getByText("这是“遮挡目标”判定", { exact: false }).count()) > 0 && (await page.locator("ol").count()) > 0]);
  checks.push(["回答显示 AI 生成内容标识", (await page.getByTestId("ai-generated-result-label").count()) > 0]);
  checks.push(["结果带规则追踪元数据", (await page.getByTestId("annotation-rule-trace").count()) > 0 && (await page.getByText("ANN-OCC-01", { exact: false }).count()) > 0]);
  const evidenceTexts = await page.getByText(/^依据：/).allTextContents();
  checks.push(["依据前缀不重复", evidenceTexts.length > 0 && evidenceTexts.every((text) => !text.startsWith("依据：依据："))]);
  await input.fill("人被车挡住并且目标出画面，怎么标？");
  await page.getByText("发送", { exact: true }).click();
  checks.push(["多意图问题先澄清", (await page.getByText("同时识别到", { exact: false }).count()) > 0 && (await page.getByText("多个候选现象", { exact: false }).count()) > 0]);
  await input.fill("这个怎么弄？");
  await page.getByText("发送", { exact: true }).click();
  checks.push(["模糊问题触发追问", (await page.getByText("你遇到的是哪类情况？", { exact: false }).count()) > 0]);
  await input.fill("目标检测");
  await page.getByText("发送", { exact: true }).click();
  checks.push(["第二轮确认任务类型", (await page.getByText("已收到任务类型", { exact: false }).count()) > 0 && (await page.getByText("还差一个现象", { exact: false }).count()) > 0]);
  await input.fill("目标出画面了");
  await page.getByText("发送", { exact: true }).click();
  checks.push(["第三轮补充现象后返回规则", (await page.getByText("这是“截断目标”判定", { exact: false }).count()) > 0 && (await page.getByText("ANN-TRU-01", { exact: false }).count()) > 0]);
  await input.fill("同类目标挨在一起，应该标几个框？");
  await page.getByText("发送", { exact: true }).click();
  checks.push(["同类实例规则返回步骤", (await page.getByText("按“实例”分别标注", { exact: false }).count()) > 0]);

  await page.getByText("提交试用反馈", { exact: false }).click();
  checks.push(["反馈弹窗可打开", (await page.getByText("AI 标注助手试用反馈", { exact: true }).count()) > 0]);
  await page.locator("#feedback-record-type").selectOption("AI模拟（内部演示）");
  await page.locator("#feedback-text").fill("模拟回归：步骤清晰，建议增加示例图。");
  checks.push(["未确认时禁止保存", await page.getByText("保存反馈记录", { exact: true }).isDisabled()]);
  await page.getByLabel(/我确认该记录仅用于 AI 模拟内部演示/).check();
  await page.getByText("保存反馈记录", { exact: true }).click();
  checks.push(["反馈可保存", (await page.getByText("反馈已保存", { exact: true }).count()) > 0 && (await page.evaluate(() => JSON.parse(localStorage.getItem("aiAnnotationTrialFeedback") || "[]").length)) === 1]);
  await page.getByText("记录下一位", { exact: true }).click();
  checks.push(["可记录下一位", (await page.locator("#feedback-text").count()) === 1 && (await page.locator("#feedback-identity").inputValue()) === "B｜人工智能专业在校生"]);
  await page.locator("#feedback-text").fill("模拟回归 B：同类实例提示清晰。");
  await page.getByLabel(/我确认该记录仅用于 AI 模拟内部演示/).check();
  await page.getByText("保存反馈记录", { exact: true }).click();
  await page.getByText("记录下一位", { exact: true }).click();
  checks.push(["可记录教师", (await page.locator("#feedback-identity").inputValue()) === "C｜人工智能专业教师"]);
  await page.locator("#feedback-text").fill("模拟回归 C：建议由教师核对平台字段。");
  await page.getByLabel(/我确认该记录仅用于 AI 模拟内部演示/).check();
  await page.getByText("保存反馈记录", { exact: true }).click();
  checks.push(["三位记录均已保存", (await page.evaluate(() => JSON.parse(localStorage.getItem("aiAnnotationTrialFeedback") || "[]").length)) === 3]);
  const download = page.waitForEvent("download");
  await page.getByText("导出当前类型记录", { exact: true }).click();
  const file = await download;
  checks.push(["模拟反馈 CSV 按类型导出", file.suggestedFilename() === "AI数据标注实训智能体-AI模拟反馈.csv"]);
  checks.push(["反馈记录带有类型", (await page.evaluate(() => JSON.parse(localStorage.getItem("aiAnnotationTrialFeedback") || "[]")[0]?.recordType)) === "AI模拟（内部演示）"]);
  await page.getByLabel("关闭反馈窗口").click();
  await page.getByText("提交试用反馈", { exact: false }).click();
  checks.push(["关闭重开可继续反馈", (await page.locator("#feedback-text").count()) === 1 && (await page.getByText("反馈已保存", { exact: true }).count()) === 0]);
  await page.locator("#feedback-record-type").selectOption("真实用户试用");
  await page.locator("#feedback-text").fill("真实类型导出回归：仅验证文件分类，不代表真人反馈。");
  await page.getByLabel(/我确认以上意见由所选匿名身份本人/).check();
  await page.getByText("保存反馈记录", { exact: true }).click();
  const realDownload = page.waitForEvent("download");
  await page.getByText("导出当前类型记录", { exact: true }).click();
  const realFile = await realDownload;
  checks.push(["真实类型 CSV 独立命名", realFile.suggestedFilename() === "AI数据标注真实用户反馈.csv"]);
  checks.push(["模拟与真实记录可区分", (await page.evaluate(() => { const rows = JSON.parse(localStorage.getItem("aiAnnotationTrialFeedback") || "[]"); return rows.length === 4 && rows.filter((row: { recordType?: string }) => row.recordType === "AI模拟（内部演示）").length === 3 && rows.filter((row: { recordType?: string }) => row.recordType === "真实用户试用").length === 1; }))]);
} finally {
  await page.evaluate(() => localStorage.removeItem("aiAnnotationTrialFeedback")).catch(() => undefined);
  await browser.close();
}
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) process.exit(1);
