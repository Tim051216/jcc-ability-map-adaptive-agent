import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// URL.pathname keeps the drive letter as part of the path on Windows (for
// example, `/F:/...`).  Convert the module URL with Node's native helper so
// the resulting absolute path is valid on both Windows and POSIX hosts.
const workspaceDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = "C:/Users/Administrator/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations";
const runtimeNodeModules = "C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const runtimeNode = "C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe";
const runtimePython = "C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
// The presentation validator imports helper packages through this variable.
// Set it from the same bundled runtime used above so the build works when
// launched from a clean shell as well as from the Codex task environment.
process.env.RUNTIME_NODE_MODULES = runtimeNodeModules;
const buildDir = path.join(workspaceDir, ".ai-annotation-ppt-build");
const outputDir = path.join(workspaceDir, "deliverables", "03-作品说明");
// Revision output used for the validation pass. After the finalizer succeeds,
// the validated bytes are copied to the stable handoff filename.
const finalPath = path.join(outputDir, "作品编码600370-答辩PPT-最新版.pptx");
const stablePath = finalPath;
const candidatePath = path.join(buildDir, "candidate.pptx");
const receiptPath = path.join(buildDir, "作品编码600370-答辩PPT-最新版.validation.json");
// Keep the deck self-contained by embedding the latest checked-in UI capture.
// The dated capture is optional and may not exist on a clean checkout.
const screenshotPath = path.join(workspaceDir, "a3-student-react-web", "output", "playwright", "ai-annotation-task-transformer-desktop.png");

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });
try {
  await fs.symlink(runtimeNodeModules, path.join(buildDir, "node_modules"), "junction");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}

// Resolve the bundled package explicitly.  ESM package resolution starts from
// the authored file's directory, so a junction inside the private build
// directory alone is not visible when this script runs from `scripts/`.
// Importing the bundle entry keeps the build reproducible without mutating the
// project root with a temporary node_modules junction.
const artifactToolEntry = path.join(runtimeNodeModules, "@oai", "artifact-tool", "dist", "artifact_tool.mjs");
const { Presentation, PresentationFile, FileBlob } = await import(pathToFileURL(artifactToolEntry).href);
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools/artifact_tool_utils.mjs")).href);

const W = 1280;
const H = 720;
const C = {
  ink: "#142B45",
  body: "#496174",
  muted: "#718394",
  line: "#D8E2EA",
  pale: "#F4F8FB",
  paleBlue: "#E8F2F8",
  blue: "#2E6F95",
  accent: "#E36B3D",
  amber: "#A96816",
  green: "#2C7A62",
  white: "#FFFFFF",
};
const FONT = "Noto Sans SC";
const TOTAL_SLIDES = 10;

function addText(slide, text, left, top, width, height, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: { left, top, width, height },
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: style.typeface ?? FONT,
    fontSize: style.fontSize ?? 22,
    bold: style.bold ?? false,
    color: style.color ?? C.body,
    autoFit: "shrinkTextOnOverflow",
    ...(style.align ? { alignment: style.align } : {}),
  };
  return shape;
}

function addRect(slide, left, top, width, height, fill, line = C.line, radius = 14) {
  return slide.shapes.add({
    geometry: "roundRect",
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: line, width: 1 },
    borderRadius: radius,
  });
}

function addRule(slide, left, top, width, color = C.line, height = 1) {
  return slide.shapes.add({
    geometry: "line",
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: color, width: 1 },
  });
}

function addHeader(slide, number, title, kicker = "AI 数据标注实训智能体") {
  addText(slide, `${String(number).padStart(2, "0")} / ${String(TOTAL_SLIDES).padStart(2, "0")}`, 72, 42, 120, 24, { fontSize: 14, bold: true, color: C.accent });
  addText(slide, kicker, 960, 44, 248, 20, { fontSize: 12, color: C.muted, align: "right" });
  addText(slide, title, 72, 86, 1040, 52, { fontSize: 34, bold: true, color: C.ink });
  addRule(slide, 72, 154, 1136, C.line);
}

function addFooter(slide, text = "人工智能技术应用专业群 · AI 数据标注工程师") {
  addRule(slide, 72, 674, 1136, C.line);
  addText(slide, text, 72, 687, 700, 16, { fontSize: 11, color: C.muted });
  addText(slide, "技术 MVP 与外部证据分开核验", 850, 687, 358, 16, { fontSize: 11, color: C.muted, align: "right" });
}

function addNotes(slide, text) {
  slide.speakerNotes.textFrame.setText(text);
}

const p = Presentation.create({ slideSize: { width: W, height: H } });

// 1 Cover
{
  const slide = p.slides.add();
  slide.background.fill = C.white;
  addRule(slide, 72, 86, 210, C.accent, 4);
  addText(slide, "AI 数据标注实训智能体", 72, 126, 900, 66, { fontSize: 46, bold: true, color: C.ink });
  addText(slide, "报名作品的核心实施模块", 76, 206, 760, 38, { fontSize: 25, bold: true, color: C.blue });
  addText(slide, "报名作品名：面向软件工程专业群的岗课赛能力图谱构建与全闭环自适应导学智能体", 78, 260, 1080, 48, { fontSize: 15, color: C.body });
  addText(slide, "服务岗位：AI 数据标注工程师", 78, 330, 640, 28, { fontSize: 20, color: C.body });
  addText(slide, "核心方向 3：岗位典型工作任务转化成学习型任务", 78, 370, 800, 28, { fontSize: 20, color: C.body });
  addText(slide, "微任务：脱敏标注工单生成可执行学习任务卡", 78, 408, 760, 28, { fontSize: 18, color: C.body });
  addRect(slide, 78, 474, 470, 78, C.paleBlue, C.paleBlue, 12);
  addText(slide, "技术 MVP 已完成", 102, 493, 210, 28, { fontSize: 20, bold: true, color: C.green });
  addText(slide, "真实场景、教师复核、真人试用待补", 302, 495, 220, 24, { fontSize: 14, color: C.amber });
  addText(slide, "页面与回答均标注“AI生成内容 · 教学辅助”", 78, 570, 520, 22, { fontSize: 14, bold: true, color: C.amber });
  addText(slide, "南京林业大学 · 负责人韩盛豪 · 作品编码 600370", 78, 620, 620, 24, { fontSize: 14, color: C.muted });
  addNotes(slide, "本页只说明作品定位。项目状态中的“待补”是事实边界，不代表已完成真实场景或真人试用。来源：deliverables/AI数据标注实训智能体-项目说明.md。");
}

// 2 Scenario
{
  const slide = p.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, 2, "场景与岗位");
  addText(slide, "候选场景必须能回答三个问题：谁、在哪个环节、遇到什么困难。", 72, 184, 760, 30, { fontSize: 21, color: C.body });
  const rows = [
    ["谁", "人工智能专业学生", "目标检测标注实训参与者"],
    ["环节", "框选与提交质检", "依据任务说明完成实例标注并提交检查"],
    ["困难", "遮挡、截断、同类实例边界判定不一致", "可能出现漏标、误合并或质检返工"],
  ];
  rows.forEach((row, i) => {
    const y = 260 + i * 104;
    addRect(slide, 72, y, 1136, 78, i === 2 ? "#FFF7F1" : C.pale, i === 2 ? "#F1D2BE" : C.line, 10);
    addText(slide, row[0], 98, y + 19, 74, 30, { fontSize: 22, bold: true, color: i === 2 ? C.accent : C.blue });
    addText(slide, row[1], 194, y + 16, 430, 28, { fontSize: 20, bold: true, color: C.ink });
    addText(slide, row[2], 650, y + 18, 500, 26, { fontSize: 17, color: C.body });
  });
  addText(slide, "当前状态：候选场景 / 待来源核验", 72, 602, 500, 24, { fontSize: 17, bold: true, color: C.amber });
  addFooter(slide);
  addNotes(slide, "场景来源尚未由真实教师或学生记录确认。正式材料应填写 deliverables/AI数据标注实训智能体-场景来源核验模板.md，并附脱敏观察或访谈记录。");
}

// 3 Closed loop
{
  const slide = p.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, 3, "岗位工单转学习任务闭环");
  addText(slide, "工单、规则、任务卡、教学指导和试用记录在同一条路径内完成。", 72, 184, 900, 30, { fontSize: 21, color: C.body });
  const stages = [
    ["01", "工单", "脱敏任务输入"],
    ["02", "识别", "命中 1 条规则"],
    ["03", "任务卡", "八类结构字段"],
    ["04", "指导", "步骤与依据"],
    ["05", "反馈", "记录导出 CSV"],
  ];
  stages.forEach((stage, i) => {
    const x = 72 + i * 226;
    addRect(slide, x, 290, 188, 148, i === 3 ? C.paleBlue : C.pale, i === 3 ? "#B8D4E4" : C.line, 12);
    addText(slide, stage[0], x + 18, 308, 60, 24, { fontSize: 15, bold: true, color: C.accent });
    addText(slide, stage[1], x + 18, 348, 150, 30, { fontSize: 23, bold: true, color: C.ink });
    addText(slide, stage[2], x + 18, 390, 160, 24, { fontSize: 15, color: C.body });
    if (i < stages.length - 1) {
      const arrow = addRule(slide, x + 190, 364, 34, C.blue, 2);
      arrow.line.endArrowhead = "triangle";
    }
  });
  addRect(slide, 72, 500, 1136, 94, "#FFF7F1", "#F1D2BE", 12);
  addText(slide, "闭环边界", 96, 520, 150, 24, { fontSize: 18, bold: true, color: C.accent });
  addText(slide, "任务卡包含情境、步骤、知识、技能、安全、交付物、量化验收和来源；信息不足时先澄清。", 250, 512, 900, 48, { fontSize: 16, color: C.body });
  addFooter(slide);
  addNotes(slide, "任务生成模块：a3-student-react-web/src/lib/aiAnnotationLearningTask.ts。规则库：a3-student-react-web/src/data/aiAnnotationRules.ts。页面逻辑：a3-student-react-web/src/pages/AIAnnotationAgent.tsx。反馈使用 localStorage，按记录类型导出 CSV。");
}

// 4 Rule library
{
  const slide = p.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, 4, "核心规则与知识目录");
  addText(slide, "用户输入先做意图识别，再命中 3 条核心规则中的一条；右侧知识区另有 60 条候选条目。", 72, 184, 1060, 30, { fontSize: 21, color: C.body });
  const cards = [
    ["ANN-OCC-01", "遮挡判定", "沿可见目标轮廓框选，不凭想象补全被遮挡区域。", "属性字段以学校平台 schema / 教师核验版为准"],
    ["ANN-TRU-01", "截断判定", "框贴合图像边缘，保留可见实例并检查 bbox 结构。", "COCO 不定义 truncated 字段"],
    ["ANN-INS-01", "同类目标", "可独立辨认的实例分别标框，不能合并为一个大框。", "质检阈值按课程实训手册执行"],
  ];
  cards.forEach((card, i) => {
    const x = 72 + i * 382;
    addRect(slide, x, 270, 350, 250, i === 1 ? C.paleBlue : C.pale, i === 1 ? "#B8D4E4" : C.line, 12);
    addText(slide, card[0], x + 22, 294, 160, 22, { fontSize: 14, bold: true, color: C.accent });
    addText(slide, card[1], x + 22, 334, 290, 32, { fontSize: 24, bold: true, color: C.ink });
    addText(slide, card[2], x + 22, 390, 300, 60, { fontSize: 16, color: C.body });
    addRule(slide, x + 22, 466, 304, C.line);
    addText(slide, card[3], x + 22, 480, 300, 32, { fontSize: 13, color: C.amber });
  });
  addText(slide, "3 条核心规则 + 60 条候选知识条目；均待教师按本校平台和实训手册复核", 72, 580, 1060, 24, { fontSize: 17, bold: true, color: C.amber });
  addFooter(slide);
  addNotes(slide, "候选规则与来源边界见 deliverables/AI数据标注实训智能体-来源规则输出映射.md。页面不宣称 S1-S3 已替代学校平台规则。");
}

// 5 Interaction
{
  const slide = p.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, 5, "模糊提问先澄清");
  addText(slide, "当信息不足时，系统先追问，不把猜测写成结论。", 72, 184, 760, 30, { fontSize: 21, color: C.body });
  addRect(slide, 72, 262, 520, 292, C.pale, C.line, 12);
  addText(slide, "第 1 轮", 98, 286, 100, 24, { fontSize: 14, bold: true, color: C.accent });
  addRect(slide, 98, 326, 430, 54, C.white, C.line, 10);
  addText(slide, "用户：这个怎么弄？", 120, 342, 360, 24, { fontSize: 18, color: C.ink });
  addRect(slide, 98, 408, 430, 88, C.paleBlue, "#B8D4E4", 10);
  addText(slide, "智能体：是遮挡、截断，还是同类实例粘连？当前是目标检测还是实例分割？", 120, 423, 380, 58, { fontSize: 16, color: C.body });
  addText(slide, "第 2 轮", 98, 520, 100, 22, { fontSize: 14, bold: true, color: C.blue });
  addText(slide, "用户补充任务类型和现象后，系统进入对应规则。", 190, 520, 350, 22, { fontSize: 14, color: C.body });
  addRect(slide, 656, 262, 552, 292, "#FFF7F1", "#F1D2BE", 12);
  addText(slide, "可验证的交互结果", 684, 288, 300, 26, { fontSize: 20, bold: true, color: C.accent });
  const bullets = ["支持连续 2-3 轮补充", "步骤采用口语化编号", "警示提示单独呈现", "每次回答显示依据和核验边界"];
  bullets.forEach((b, i) => {
    addText(slide, `0${i + 1}`, 686, 348 + i * 43, 52, 22, { fontSize: 14, bold: true, color: C.blue });
    addText(slide, b, 738, 346 + i * 43, 380, 24, { fontSize: 17, color: C.body });
  });
  addFooter(slide);
  addNotes(slide, "交互逻辑和 smoke 覆盖见 a3-student-react-web/scripts/smoke-ai-annotation-agent.ts。模糊输入不会直接命中规则，先进入澄清分支。");
}

// 6 Sources
{
  const slide = p.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, 6, "专业来源与边界");
  addText(slide, "来源用于支撑职业任务范围和字段结构，不越权替代学校平台细则。", 72, 184, 900, 30, { fontSize: 21, color: C.body });
  const sourceRows = [
    ["S1", "数据标注职业技能等级标准（2021 年 1.0 版）", "2D 拉框、标注实施、质量审核能力范围", "不直接给出本校字段"],
    ["S2", "人工智能训练师国家职业技能标准（2021 年版）", "数据标注工种与准确性/完整性审核", "不直接给出平台操作细则"],
    ["S3", "Microsoft COCO Dataset Data Format", "bbox、area、iscrowd、坐标结构", "不定义 occluded/truncated"],
    ["S4", "学校平台 schema、实训手册、教师核验记录", "本校字段、取值、阈值", "当前待真实补证"],
  ];
  addRect(slide, 72, 264, 1136, 48, C.ink, C.ink, 8);
  ["编号", "来源", "可支持", "边界"].forEach((h, i) => addText(slide, h, [94, 176, 610, 970][i], 278, [70, 400, 320, 190][i], 22, { fontSize: 15, bold: true, color: C.white }));
  sourceRows.forEach((row, r) => {
    const y = 312 + r * 73;
    addRect(slide, 72, y, 1136, 68, r % 2 ? C.pale : C.white, C.line, 0);
    addText(slide, row[0], 94, y + 21, 50, 22, { fontSize: 15, bold: true, color: C.accent });
    addText(slide, row[1], 176, y + 12, 408, 44, { fontSize: 14, color: C.ink });
    addText(slide, row[2], 610, y + 12, 330, 44, { fontSize: 14, color: C.body });
    addText(slide, row[3], 970, y + 12, 190, 44, { fontSize: 14, color: C.amber });
  });
  addText(slide, "正式提交需附团队实际持有版本的封面、相关条款页和教师复核记录。", 72, 620, 900, 24, { fontSize: 16, bold: true, color: C.amber });
  addFooter(slide);
  addNotes(slide, "来源文件指纹和页码定位见 deliverables/AI数据标注实训智能体-来源文件核验清单.md。COCO 官方格式页不定义 occluded/truncated；该限制必须保留在提交材料中。");
}

// 7 Product screenshot
{
  const slide = p.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, 7, "可运行前端 MVP");
  addText(slide, "页面入口：/annotation-agent  ·  默认端口：3002", 72, 184, 700, 28, { fontSize: 21, color: C.body });
  addRect(slide, 72, 260, 380, 300, C.pale, C.line, 12);
  addText(slide, "现场演示顺序", 98, 288, 240, 26, { fontSize: 20, bold: true, color: C.ink });
  const demo = ["岗位工单转学习任务卡", "多意图输入先澄清", "任务步骤与量化验收", "规则依据与边界提示", "反馈类型与 CSV 导出"];
  demo.forEach((item, i) => {
    addText(slide, `${i + 1}`, 100, 342 + i * 39, 28, 24, { fontSize: 15, bold: true, color: C.accent });
    addText(slide, item, 142, 340 + i * 39, 250, 24, { fontSize: 16, color: C.body });
  });
  try {
    const bytes = await fs.readFile(screenshotPath);
    slide.images.add({ blob: bytes, contentType: "image/png", alt: "AI 数据标注实训智能体页面截图", fit: "contain", position: { left: 500, top: 222, width: 708, height: 380 }, geometry: "roundRect", borderRadius: 12 });
  } catch {
    addRect(slide, 500, 260, 708, 300, C.paleBlue, "#B8D4E4", 12);
    addText(slide, "技术演示截图待更新", 720, 390, 280, 30, { fontSize: 22, bold: true, color: C.blue, align: "center" });
  }
  addText(slide, "截图仅作为技术演示证据，不替代真人试用证据。", 500, 620, 708, 22, { fontSize: 14, color: C.muted, align: "right" });
  addFooter(slide);
  addNotes(slide, `页面截图：${screenshotPath}。运行说明见 deliverables/02-作品Demo/AI数据标注实训智能体-Demo信息.md。`);
}

// 8 Status
{
  const slide = p.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, 8, "核心方向与八项要求");
  addRect(slide, 72, 166, 1136, 48, C.paleBlue, "#B8D4E4", 8);
  addText(slide, "核心方向 3", 92, 178, 150, 22, { fontSize: 16, bold: true, color: C.blue });
  addText(slide, "岗位典型工作任务 → 可执行学习任务卡（已实现）", 250, 177, 790, 24, { fontSize: 17, bold: true, color: C.green });
  const rows = [
    ["1", "场景真实性", "待真实来源记录", C.amber],
    ["2", "功能闭环性", "已实现", C.green],
    ["3", "内容专业性", "候选来源待教师复核", C.amber],
    ["4", "交互友好性", "已实现", C.green],
    ["5", "专业群与岗位", "已确定", C.green],
    ["6", "可交互 MVP", "已实现", C.green],
    ["7", "知识嵌入", "已实现，待 S4 核验", C.amber],
    ["8", "真实用户测试", "待 2 名学生 + 1 名教师", C.amber],
  ];
  rows.forEach((row, i) => {
    const y = 222 + i * 43;
    addRule(slide, 72, y + 43, 1136, C.line);
    addText(slide, row[0], 84, y + 10, 32, 22, { fontSize: 15, bold: true, color: C.accent });
    addText(slide, row[1], 140, y + 8, 250, 24, { fontSize: 17, bold: true, color: C.ink });
    addText(slide, row[2], 500, y + 8, 580, 24, { fontSize: 16, color: row[3] });
  });
  addRect(slide, 72, 584, 1136, 58, "#FFF7F1", "#F1D2BE", 10);
  addText(slide, "正式状态：技术 MVP 已完成，外部证据待补。AI 模拟记录不能替代第 8 项。", 96, 601, 1060, 24, { fontSize: 16, bold: true, color: C.amber });
  addFooter(slide);
  addNotes(slide, "截至 2026-09-14 的自动化结果：npm run lint 通过，npm run build 通过，npm run smoke:ai-annotation-agent 34/34 通过，npm run audit:ai-annotation-deliverables 全部通过，预提交包验真以最新包验证记录为准。上述结果不证明真实场景、教师复核或真人试用。来源：deliverables/AI数据标注实训智能体-自动化验收记录.md。" );
}

// 9 Team and iteration plan
{
  const slide = p.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, 9, "团队分工与迭代计划");
  addText(slide, "团队信息已按盖章报名表填写；联系方式与学号仅保留在报名表扫描件中。", 72, 184, 1060, 30, { fontSize: 21, color: C.body });
  addRect(slide, 72, 258, 548, 330, C.pale, C.line, 12);
  addText(slide, "南京林业大学参赛团队", 98, 284, 420, 28, { fontSize: 22, bold: true, color: C.ink });
  const roles = [
    ["负责人", "韩盛豪（人工智能专业）"],
    ["团队成员", "张文馨、蒋孟窈、朱佳音"],
    ["所在学院", "信息科学技术学院、人工智能学院"],
    ["指导教师", "徐雨凤（副教授）、张晓丹（讲师）"],
  ];
  roles.forEach((row, i) => {
    const y = 340 + i * 52;
    addText(slide, row[0], 100, y, 120, 22, { fontSize: 16, bold: true, color: C.accent });
    addText(slide, row[1], 230, y, 350, 22, { fontSize: 16, color: C.body });
  });
  addRect(slide, 656, 258, 552, 330, C.paleBlue, "#B8D4E4", 12);
  addText(slide, "四阶段迭代", 682, 284, 240, 28, { fontSize: 22, bold: true, color: C.ink });
  const iterations = [
    ["01", "MVP（已完成）", "工单转任务卡、3 条规则、60 条候选条目"],
    ["02", "教师核验（待补）", "锁定学校 schema、条款、阈值与授权"],
    ["03", "真实试用（待补）", "2 名学生 + 1 名教师，形成可追溯证据"],
    ["04", "平台发布（已提交审核）", "Agent ID 5816885；公开体验链接待平台审核生成"],
  ];
  iterations.forEach((row, i) => {
    const y = 340 + i * 56;
    addText(slide, row[0], 684, y, 50, 22, { fontSize: 15, bold: true, color: C.blue });
    addText(slide, row[1], 746, y, 150, 22, { fontSize: 16, bold: true, color: C.ink });
    addText(slide, row[2], 900, y, 270, 34, { fontSize: 13, color: C.body });
  });
  addFooter(slide);
  addNotes(slide, "团队姓名、学校和指导教师来自作品编码 600370 的盖章报名表扫描件。外部测评仍须由真实参与者完成，不能用 AI 模拟替代。星辰 Agent ID 为 5816885，公开体验链接待审核生成。");
}

// 10 Innovation and adaptation
{
  const slide = p.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, 10, "创新点与岗位适配");
  addText(slide, "把企业式工单转成可验收的学习任务卡，并让规则来源贯穿生成、指导、反馈和提交审计。", 72, 184, 1060, 30, { fontSize: 21, color: C.body });
  const cards = [
    ["可追溯", "每条核心规则和知识条目都有稳定 ID、来源编号、定位与核验状态。", C.paleBlue],
    ["可执行", "任务卡同时给情境、步骤、知识技能、安全、交付物和量化验收标准。", C.pale],
    ["可适配", "替换触发词、条目、schema 与 smoke 用例即可迁移到语音切分或文本分类教学。", "#FFF7F1"],
  ];
  cards.forEach((card, i) => {
    const x = 72 + i * 382;
    addRect(slide, x, 274, 350, 210, card[2], C.line, 12);
    addText(slide, card[0], x + 24, 302, 180, 28, { fontSize: 23, bold: true, color: C.accent });
    addText(slide, card[1], x + 24, 354, 300, 90, { fontSize: 17, color: C.body });
  });
  addRect(slide, 72, 526, 1136, 76, C.pale, C.line, 10);
  addText(slide, "适配边界：候选内容必须经目标课程教师核验；不用于未经授权的生产质量判定或安全关键决策。", 98, 550, 1080, 28, { fontSize: 17, bold: true, color: C.amber });
  addFooter(slide);
  addNotes(slide, "创新点和适配方法为本作品的设计说明，不代表已完成其他专业的真实部署。适配前应替换来源与字段，并重新执行 smoke 和教师核验。具体说明见 AI数据标注实训智能体-项目说明.md。");
}

await (await PresentationFile.exportPptx(p)).save(candidatePath);
const result = await finalizePresentation({
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: runtimePython,
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit", "--validate-heading-punctuation"],
  explicitTotalSlideCount: TOTAL_SLIDES,
  fontPolicy: { basis: "design", families: [FONT], scriptFonts: { ea: FONT } },
  verifyArtifactToolImport: true,
  receiptPath,
});
console.log(JSON.stringify({ finalPath, receiptPath, sha256: result.finalSha256 }, null, 2));
console.log(JSON.stringify({ stablePath }, null, 2));
