const pptxgen = require("pptxgenjs");
const fs = require("fs");
const JSZip = require("jszip");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "deliverables", "a3-defense-materials", "BiliLearn-defense-presentation-readable.pptx");
const thumbnail = path.join(root, "deliverables", "a3-defense-materials", "BiliLearn-defense-presentation-thumbnail.jpeg");
const assetsDir = path.join(root, "deliverables", "a3-defense-materials", "assets");

const pptx = new pptxgen();
pptx.defineLayout({ name: "BILILEARN_WIDE", width: 13.333, height: 7.5 });
pptx.layout = "BILILEARN_WIDE";
pptx.author = "BiliLearn Team";
pptx.company = "BiliLearn";
pptx.subject = "A3-基于大模型的个性化资源生成与学习多智能体系统开发";
pptx.title = "BiliLearn Defense Presentation";
pptx.lang = "zh-CN";
pptx.theme = { headFontFace: "Microsoft YaHei", bodyFontFace: "Microsoft YaHei", lang: "zh-CN" };

const C = {
  ink: "14212A",
  sub: "5A6B78",
  faint: "F5F8FA",
  panel: "FFFFFF",
  line: "DDE8EC",
  night: "101A20",
  night2: "18252C",
  teal: "0D9488",
  mint: "D8FFF7",
  gold: "B7791F",
  goldSoft: "FFF3D7",
  blue: "3158D4",
  blueSoft: "EAF0FF",
  coral: "D95445",
  coralSoft: "FFF0EE",
  purple: "6D4ACB",
  purpleSoft: "F1ECFF",
  pink: "FF6B9A",
};
const font = "Microsoft YaHei";

const slides = [
  {
    type: "cover",
    eyebrow: "中国软件杯 A3 赛题",
    title: "BiliLearn",
    subtitle: "基于大模型的个性化资源生成与学习多智能体系统",
    bullets: ["让学习平台从“资料陈列”升级为“持续推动学习”", "主线：画像 -> 路径 -> 资源 -> 辅导 -> 测评 -> 反馈"],
  },
  {
    type: "image",
    eyebrow: "项目实机",
    title: "BiliLearn 已经有完整学生端入口",
    subtitle: "真实首页截图：学习中枢、导航入口、AI 导师入口已经联通。",
    image: "overview.png",
    bullets: ["顶部导航串联摘要、路径、课堂、资源、评估、报告", "学生画像状态直接进入 AI 学习中枢", "答辩时先用这页证明项目不是概念稿"],
  },
  {
    type: "cards",
    eyebrow: "赛题理解",
    title: "A3 的重点不是“再做一个学习网站”",
    subtitle: "我们把赛题拆成三个可验收问题。",
    cards: [
      ["大模型", "模型参与资源生成、视频理解、课程问答、文件解析与反馈建议。", C.blueSoft, C.blue],
      ["个性化资源", "根据课程、目标、画像、进度和测评结果动态补齐资料。", C.goldSoft, C.gold],
      ["多智能体系统", "画像、规划、资源、答疑、反馈分工协作，共享学习状态。", C.mint, C.teal],
    ],
  },
  {
    type: "pain",
    eyebrow: "痛点洞察",
    title: "学生不是缺资料，而是缺连续学习支持",
    subtitle: "BiliLearn 解决三类断点。",
    rows: [
      ["资源断点", "资料静态、难筛选", "资源生成智能体按课程缺口补齐讲义、练习、导图"],
      ["答疑断点", "问题脱离上下文", "AI 导师结合课程、视频片段、附件正文连续解释"],
      ["反馈断点", "分数不能指导下一步", "测评与报告回写画像和路径，推动下一轮学习"],
    ],
  },
  {
    type: "loop",
    eyebrow: "总体闭环",
    title: "BiliLearn 的核心是一条学习闭环",
    subtitle: "页面只是入口，真正的产品逻辑是让学习状态持续流动。",
    steps: ["画像", "路径", "资源", "辅导", "测评", "反馈"],
    bullets: ["画像决定路径，路径决定资源需求", "辅导与测评产生新证据", "反馈再更新下一轮路径和资源"],
  },
  {
    type: "agents",
    eyebrow: "五智能体",
    title: "多智能体不是概念包装，而是明确分工",
    subtitle: "每个智能体都有输入、职责和可展示输出。",
    agents: [
      ["学习画像", "基础、偏好、薄弱点、学习阶段"],
      ["学习规划", "阶段目标、任务、下一步建议"],
      ["资源生成", "讲义、笔记、练习、脑图"],
      ["知识答疑", "RAG、附件解析、上下文问答"],
      ["测评反馈", "题目、错题、报告、改进建议"],
    ],
  },
  {
    type: "image",
    eyebrow: "学习路径",
    title: "目标式学习路径：先设目标，再生成阶段任务",
    subtitle: "真实页面截图：学生输入目标、截止时间和每日学习时长，系统生成路径。",
    image: "path.png",
    bullets: ["支持目标、时间和投入强度作为路径生成条件", "阶段任务包含视频、阅读、练习、测评等类型", "路径结果可联动资源推荐和复习提醒"],
  },
  {
    type: "image",
    eyebrow: "资源中心",
    title: "资源中心不是仓库，而是资料工作台",
    subtitle: "真实页面截图：已有资料、智能补齐、筛选、预览入口集中在一处。",
    image: "resources.png",
    bullets: ["支持讲义、笔记、视频等分类和关键词检索", "一键补讲义、补练习、补导图", "生成结果沉淀为可收藏、可预览、可下载的资源卡片"],
  },
  {
    type: "resourceFlow",
    eyebrow: "资源生成",
    title: "个性化资源生成链路",
    subtitle: "后端 ResourceService 会解析课程上下文，再生成并持久化资源。",
    bullets: ["CourseContextService 解析 courseId / courseCode", "ResourceService 规范化 knowledge_points 与 resource_types", "ResourceRepository 保存生成结果、收藏和归档状态", "ResourceSourceFileService 提供源文件预览、打开和信息水合"],
  },
  {
    type: "image",
    eyebrow: "视频 AI 陪看",
    title: "视频被结构化成可提问的学习资料",
    subtitle: "真实页面截图：资料预览台支持视频播放、文件目录和 AI 陪看提示。",
    image: "preview-video.png",
    bullets: ["1 分钟 / 3 分钟 / 深度摘要", "知识点时间轴、术语解释、双语字幕", "围绕当前片段回答“这段在讲什么”"],
  },
  {
    type: "videoInsight",
    eyebrow: "视频理解服务",
    title: "VideoInsightService 输出完整学习资料包",
    subtitle: "不只是摘要，而是可用于复习和追问的结构化结果。",
    fields: ["summary", "timeline", "terms", "subtitles", "article_pack", "formula_hint"],
    bullets: ["LLM 输出严格 JSON，字段完整后直接进入前端面板", "ask 接口结合当前秒数、时间轴和术语回答分段问题", "设置超时与 fallback，现场模型波动也能稳定演示"],
  },
  {
    type: "tutor",
    eyebrow: "AI 导师",
    title: "AI 导师支持真实学习材料输入",
    subtitle: "文本提问、附件上传、截图提问和历史会话都已接入。",
    bullets: ["支持图片、PDF、Word、Excel、PPT、txt 正文提取", "附件卡片可展开正文、复制、插入输入框、直接发送", "截图优先截取课程学习主区域，适合边看边问", "历史会话可搜索、分组和继续追问"],
  },
  {
    type: "coordinator",
    eyebrow: "答疑智能体链路",
    title: "TutoringCoordinator 不是单次模型调用",
    subtitle: "它会根据问题类型选择快速回答或完整智能体流程。",
    nodes: ["QuestionAnalyzer", "AnswerGenerator", "DiagramGenerator", "VideoRecommender", "RuntimeLogging"],
    bullets: ["轻问答 short-circuit，课程问题进入完整分析", "支持 text_delta 流式输出和 resource_update", "返回 confidence_score、knowledge_points、reference_sources", "数据库不可用时 memory_tutoring_store 兜底"],
  },
  {
    type: "image",
    eyebrow: "学习报告",
    title: "报告页把学习证据收束成下一步建议",
    subtitle: "真实页面截图：画像完整度、当前阶段、测评表现和学习方式建议可见。",
    image: "report.png",
    bullets: ["画像：阶段、学习风格、标签、SBTI 画像", "路径：完成率、已完成步骤和下一步行动", "测评与导师历史进入同一份学习证据链"],
  },
  {
    type: "image",
    eyebrow: "测评反馈",
    title: "测评不是结束，而是反馈入口",
    subtitle: "真实页面截图：测评页承接学习任务，结果回到报告与路径。",
    image: "evaluation.png",
    bullets: ["根据课程生成题目和作答任务", "记录测评历史与趋势", "薄弱点可反向影响后续资源和路径"],
  },
  {
    type: "architecture",
    eyebrow: "工程架构",
    title: "前端学习端、业务服务、Python AI 中台分层协同",
    subtitle: "架构上既保证演示稳定，也方便后续扩展智能体能力。",
    layers: [
      ["React 学习端", "路径 / 资源 / 预览 / AI 导师 / 测评 / 报告"],
      ["Java 业务服务", "learning / message / scheduler / inbox"],
      ["Python AI 中台", "LLM / RAG / 文件解析 / 视频理解 / 智能体编排"],
      ["数据与资源层", "课程资料 / 上传附件 / 生成结果 / 学习行为"],
    ],
  },
  {
    type: "demo",
    eyebrow: "现场演示",
    title: "演示按闭环走，不按菜单逐页点",
    subtitle: "这样评委看到的是系统逻辑，而不是页面清单。",
    steps: [
      ["1", "学习路径", "设目标，生成阶段任务"],
      ["2", "资源中心", "查看资料并智能补齐"],
      ["3", "视频陪学", "摘要、时间轴、术语、分段问答"],
      ["4", "AI 导师", "上传资料 / 截图 / 连续追问"],
      ["5", "学习报告", "画像、测评、资源、答疑回流"],
    ],
  },
  {
    type: "qa",
    eyebrow: "答辩备答",
    title: "把高频质疑提前变成可信回答",
    subtitle: "最后一页可作为 Q&A 备答页。",
    qas: [
      ["哪些是真实 AI？", "资源生成、视频结构化、分段问答、附件正文提取、答疑智能体都在 AI 中台实现。"],
      ["多智能体如何体现？", "系统按画像、规划、资源、答疑、反馈拆分职责，并围绕共享学习状态协作。"],
      ["和普通学习平台区别？", "普通平台展示资料；BiliLearn 动态生成资料、解释内容、评估结果并推动下一轮学习。"],
      ["现场模型不稳定怎么办？", "关键链路有本地资源、fallback 数据、超时控制和内存兜底。"],
    ],
  },
];

function tx(slide, value, x, y, w, h, opts = {}) {
  slide.addText(value, {
    x, y, w, h,
    fontFace: font,
    fontSize: opts.size || 13,
    bold: !!opts.bold,
    color: opts.color || C.ink,
    margin: opts.margin ?? 0,
    align: opts.align || "left",
    valign: opts.valign || "top",
    fit: "shrink",
    breakLine: false,
  });
}

function box(slide, x, y, w, h, opts = {}) {
  slide.addShape(opts.shape || pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: opts.radius ?? 0.1,
    fill: { color: opts.fill || C.panel, transparency: opts.transparency || 0 },
    line: { color: opts.line || C.line, width: opts.lineWidth || 1, transparency: opts.lineTransparency || 0 },
  });
}

function bullets(slide, items, x, y, w, h, opts = {}) {
  slide.addText(items.map((item) => ({ text: item, options: { bullet: { type: "bullet" }, breakLine: true } })), {
    x, y, w, h,
    fontFace: font,
    fontSize: opts.size || 12.2,
    color: opts.color || C.ink,
    margin: 0.03,
    paraSpaceAfterPt: opts.space ?? 8,
    fit: "shrink",
    breakLine: false,
  });
}

function bg(slide, dark = false) {
  slide.background = { color: dark ? C.night : "FBFDFC" };
  if (dark) {
    slide.addShape(pptx.ShapeType.arc, { x: 8.6, y: -1.2, w: 5.3, h: 5.3, line: { color: "163A38", transparency: 100 }, fill: { color: "163A38", transparency: 12 } });
    slide.addShape(pptx.ShapeType.arc, { x: -1.2, y: 4.8, w: 3.7, h: 3.7, line: { color: "4D3C1C", transparency: 100 }, fill: { color: "4D3C1C", transparency: 20 } });
  } else {
    slide.addShape(pptx.ShapeType.arc, { x: 10.85, y: -1.45, w: 3.7, h: 3.7, line: { color: C.mint, transparency: 100 }, fill: { color: C.mint, transparency: 35 } });
  }
}

function pill(slide, value, x, y, w, opts = {}) {
  box(slide, x, y, w, 0.34, { fill: opts.fill || C.mint, line: opts.line || C.mint, radius: 0.17 });
  tx(slide, value, x, y + 0.08, w, 0.13, { size: 8.5, bold: true, color: opts.color || C.teal, align: "center" });
}

function chrome(slide, s, idx, dark = false) {
  bg(slide, dark);
  pill(slide, s.eyebrow, 0.62, 0.45, 1.72, { fill: dark ? "163A38" : C.mint, line: dark ? "1E514E" : C.mint, color: dark ? "9CF3E8" : C.teal });
  tx(slide, s.title, 0.62, 0.9, 10.4, 0.42, { size: 22.5, bold: true, color: dark ? "FFFFFF" : C.ink });
  tx(slide, s.subtitle, 0.64, 1.43, 10.3, 0.25, { size: 11.4, color: dark ? "B7C8CF" : C.sub });
  tx(slide, "BiliLearn · A3 大模型个性化学习多智能体系统", 0.62, 7.05, 4.9, 0.14, { size: 8, color: dark ? "AFC0C8" : "8798A3" });
  tx(slide, `${String(idx).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`, 12.0, 7.05, 0.75, 0.14, { size: 8, color: dark ? "AFC0C8" : "8798A3", align: "right" });
}

function imagePath(name) {
  return path.join(assetsDir, name);
}

function addImageFrame(slide, name, x, y, w, h) {
  const p = imagePath(name);
  box(slide, x, y, w, h, { fill: "FFFFFF", line: C.line, radius: 0.14 });
  if (fs.existsSync(p)) {
    slide.addImage({ path: p, x: x + 0.12, y: y + 0.12, w: w - 0.24, h: h - 0.24, sizing: { type: "crop", x: x + 0.12, y: y + 0.12, w: w - 0.24, h: h - 0.24 } });
  } else {
    tx(slide, `缺少截图：${name}`, x + 0.2, y + 0.45, w - 0.4, 0.4, { size: 12, color: C.coral, align: "center" });
  }
}

function renderCover(s, idx) {
  const slide = pptx.addSlide();
  chrome(slide, s, idx, true);
  tx(slide, "BiliLearn", 0.72, 2.05, 5.6, 0.75, { size: 42, bold: true, color: "FFFFFF" });
  bullets(slide, s.bullets, 0.9, 3.22, 5.8, 1.2, { size: 15, color: "D6E2E6", space: 10 });
  const steps = ["画像", "路径", "资源", "辅导", "测评", "反馈"];
  steps.forEach((step, i) => {
    const x = 7.05 + (i % 2) * 2.45;
    const y = 2.08 + Math.floor(i / 2) * 1.05;
    box(slide, x, y, 1.85, 0.66, { fill: i % 2 ? "22343D" : "143E3B", line: "334B55", radius: 0.18 });
    tx(slide, step, x, y + 0.2, 1.85, 0.18, { size: 15, bold: true, color: i % 2 ? "FFFFFF" : "9CF3E8", align: "center" });
  });
}

function renderImageSlide(s, idx) {
  const slide = pptx.addSlide();
  chrome(slide, s, idx);
  addImageFrame(slide, s.image, 0.68, 2.0, 7.55, 4.72);
  box(slide, 8.55, 2.0, 3.95, 4.72, { fill: "FFFFFF", line: C.line, radius: 0.14 });
  tx(slide, "项目证据", 8.85, 2.35, 3.3, 0.24, { size: 15, bold: true, color: C.teal });
  bullets(slide, s.bullets, 8.9, 2.82, 3.25, 2.7, { size: 12.6, space: 9 });
  box(slide, 8.92, 5.9, 3.1, 0.42, { fill: C.mint, line: C.mint, radius: 0.18 });
  tx(slide, "真实运行页面截图", 8.92, 6.03, 3.1, 0.12, { size: 9.5, bold: true, color: C.teal, align: "center" });
}

function renderCards(s, idx) {
  const slide = pptx.addSlide();
  chrome(slide, s, idx);
  s.cards.forEach(([h, b, fill, color], i) => {
    const x = 0.82 + i * 4.1;
    box(slide, x, 2.25, 3.55, 3.25, { fill, line: fill, radius: 0.16 });
    tx(slide, h, x + 0.25, 2.78, 2.95, 0.28, { size: 20, bold: true, color });
    tx(slide, b, x + 0.28, 3.45, 2.85, 1.05, { size: 14, color: C.ink });
  });
}

function renderPain(s, idx) {
  const slide = pptx.addSlide();
  chrome(slide, s, idx);
  s.rows.forEach(([a, b, c], i) => {
    const y = 2.15 + i * 1.32;
    tx(slide, a, 0.9, y + 0.24, 1.35, 0.24, { size: 16, bold: true, color: [C.coral, C.gold, C.teal][i] });
    box(slide, 2.35, y, 3.6, 0.84, { fill: C.coralSoft, line: "F2D0CB", radius: 0.12 });
    tx(slide, b, 2.6, y + 0.28, 3.1, 0.18, { size: 13, color: C.ink });
    tx(slide, "→", 6.17, y + 0.26, 0.4, 0.2, { size: 20, bold: true, color: "8295A0", align: "center" });
    box(slide, 6.82, y, 5.45, 0.84, { fill: "F7FFFD", line: "BFECE5", radius: 0.12 });
    tx(slide, c, 7.08, y + 0.24, 4.9, 0.24, { size: 12.7, color: C.ink });
  });
}

function renderLoop(s, idx) {
  const slide = pptx.addSlide();
  chrome(slide, s, idx);
  s.steps.forEach((step, i) => {
    const x = 0.78 + i * 2.05;
    box(slide, x, 2.32, 1.55, 1.05, { fill: i % 2 ? "FFFFFF" : C.mint, line: i % 2 ? C.line : "A9EADF", radius: 0.18 });
    tx(slide, step, x, 2.68, 1.55, 0.18, { size: 16, bold: true, color: i % 2 ? C.ink : C.teal, align: "center" });
    if (i < s.steps.length - 1) tx(slide, "→", x + 1.62, 2.72, 0.35, 0.18, { size: 18, bold: true, color: "8798A3", align: "center" });
  });
  box(slide, 1.2, 4.28, 10.9, 1.25, { fill: C.night, line: C.night, radius: 0.18 });
  bullets(slide, s.bullets, 1.65, 4.58, 10.0, 0.65, { size: 14.2, color: "FFFFFF", space: 7 });
}

function renderAgents(s, idx) {
  const slide = pptx.addSlide();
  chrome(slide, s, idx);
  box(slide, 4.7, 2.78, 3.95, 0.66, { fill: C.night, line: C.night, radius: 0.2 });
  tx(slide, "共享学习状态", 4.7, 3.0, 3.95, 0.16, { size: 15, bold: true, color: "FFFFFF", align: "center" });
  s.agents.forEach(([h, b], i) => {
    const x = i < 3 ? 0.72 + i * 4.1 : 2.75 + (i - 3) * 4.1;
    const y = i < 3 ? 2.0 : 4.45;
    box(slide, x, y, 3.45, 1.18, { fill: i % 2 ? C.goldSoft : "FFFFFF", line: i % 2 ? "F1D899" : C.line, radius: 0.15 });
    tx(slide, h, x + 0.22, y + 0.24, 3.0, 0.2, { size: 14.5, bold: true, color: i % 2 ? C.gold : C.teal });
    tx(slide, b, x + 0.22, y + 0.62, 2.95, 0.24, { size: 11.6, color: C.sub });
  });
}

function renderResourceFlow(s, idx) {
  const slide = pptx.addSlide();
  chrome(slide, s, idx);
  const nodes = ["课程上下文", "知识点规范化", "资源生成", "持久化", "预览/收藏"];
  nodes.forEach((n, i) => {
    const x = 0.82 + i * 2.45;
    box(slide, x, 2.35, 1.85, 0.95, { fill: i % 2 ? C.goldSoft : C.mint, line: i % 2 ? "F1D899" : "A9EADF", radius: 0.18 });
    tx(slide, n, x, 2.72, 1.85, 0.16, { size: 12.6, bold: true, color: i % 2 ? C.gold : C.teal, align: "center" });
    if (i < nodes.length - 1) tx(slide, "→", x + 1.92, 2.72, 0.36, 0.16, { size: 18, bold: true, color: "8798A3", align: "center" });
  });
  box(slide, 1.15, 4.15, 10.95, 1.55, { fill: "FFFFFF", line: C.line, radius: 0.16 });
  bullets(slide, s.bullets, 1.55, 4.5, 10.2, 0.85, { size: 13.2, space: 6 });
}

function renderVideoInsight(s, idx) {
  const slide = pptx.addSlide();
  chrome(slide, s, idx);
  s.fields.forEach((f, i) => {
    const x = 0.95 + (i % 3) * 3.95;
    const y = 2.15 + Math.floor(i / 3) * 1.18;
    box(slide, x, y, 3.25, 0.78, { fill: i % 2 ? C.blueSoft : "FFFFFF", line: i % 2 ? "CBD8FF" : C.line, radius: 0.16 });
    tx(slide, f, x, y + 0.25, 3.25, 0.16, { size: 14, bold: true, color: i % 2 ? C.blue : C.ink, align: "center" });
  });
  bullets(slide, s.bullets, 1.2, 5.0, 10.8, 0.8, { size: 13.2, space: 7 });
}

function renderTutor(s, idx) {
  const slide = pptx.addSlide();
  chrome(slide, s, idx);
  const files = ["图片", "PDF", "Word", "Excel", "PPT", "TXT"];
  files.forEach((f, i) => {
    const x = 1.0 + i * 1.86;
    box(slide, x, 2.25, 1.34, 0.85, { fill: i % 2 ? C.blueSoft : "FFFFFF", line: i % 2 ? "CBD8FF" : C.line, radius: 0.18 });
    tx(slide, f, x, 2.57, 1.34, 0.16, { size: 13.5, bold: true, color: i % 2 ? C.blue : C.ink, align: "center" });
  });
  box(slide, 1.0, 3.72, 11.35, 2.0, { fill: "FFFFFF", line: C.line, radius: 0.16 });
  bullets(slide, s.bullets, 1.45, 4.08, 10.5, 1.1, { size: 13.2, space: 7 });
}

function renderCoordinator(s, idx) {
  const slide = pptx.addSlide();
  chrome(slide, s, idx);
  s.nodes.forEach((n, i) => {
    const x = 0.8 + i * 2.48;
    box(slide, x, 2.22, 1.95, 0.86, { fill: i % 2 ? C.purpleSoft : C.mint, line: i % 2 ? "D9CFFF" : "A9EADF", radius: 0.16 });
    tx(slide, n, x + 0.12, 2.52, 1.7, 0.15, { size: 10.7, bold: true, color: i % 2 ? C.purple : C.teal, align: "center" });
    if (i < s.nodes.length - 1) tx(slide, "→", x + 2.0, 2.54, 0.3, 0.14, { size: 16, bold: true, color: "8798A3", align: "center" });
  });
  bullets(slide, s.bullets, 1.15, 4.05, 10.9, 1.2, { size: 13.2, space: 7 });
}

function renderArchitecture(s, idx) {
  const slide = pptx.addSlide();
  chrome(slide, s, idx);
  s.layers.forEach(([h, b], i) => {
    const y = 2.0 + i * 1.02;
    box(slide, 0.95, y, 11.45, 0.76, { fill: [C.blueSoft, "FFFFFF", C.mint, C.goldSoft][i], line: [C.blueSoft, C.line, C.mint, C.goldSoft][i], radius: 0.14 });
    tx(slide, h, 1.25, y + 0.25, 1.75, 0.16, { size: 13.5, bold: true, color: [C.blue, C.ink, C.teal, C.gold][i] });
    tx(slide, b, 3.3, y + 0.25, 8.55, 0.16, { size: 12.5, color: C.ink });
  });
}

function renderDemo(s, idx) {
  const slide = pptx.addSlide();
  chrome(slide, s, idx);
  s.steps.forEach(([n, h, b], i) => {
    const x = 0.75 + i * 2.48;
    box(slide, x, 2.35, 2.0, 1.8, { fill: i === 2 ? C.night : "FFFFFF", line: i === 2 ? C.night : C.line, radius: 0.18 });
    pill(slide, n, x + 0.72, 2.65, 0.55, { fill: i === 2 ? "27424D" : C.mint, line: i === 2 ? "27424D" : C.mint, color: i === 2 ? "FFFFFF" : C.teal });
    tx(slide, h, x + 0.12, 3.18, 1.76, 0.18, { size: 12.6, bold: true, color: i === 2 ? "FFFFFF" : C.ink, align: "center" });
    tx(slide, b, x + 0.18, 3.58, 1.64, 0.28, { size: 10.4, color: i === 2 ? "B7C8CF" : C.sub, align: "center" });
  });
  box(slide, 1.15, 5.25, 10.95, 0.56, { fill: C.goldSoft, line: C.goldSoft, radius: 0.2 });
  tx(slide, "讲法：不要逐个介绍按钮，要按“学生如何被系统持续推进学习”来演示。", 1.35, 5.45, 10.5, 0.14, { size: 12.2, bold: true, color: C.gold, align: "center" });
}

function renderQA(s, idx) {
  const slide = pptx.addSlide();
  chrome(slide, s, idx);
  s.qas.forEach(([q, a], i) => {
    const y = 2.05 + i * 1.1;
    box(slide, 0.95, y, 11.4, 0.78, { fill: i % 2 ? "FFFFFF" : "F7FFFD", line: i % 2 ? C.line : "BFECE5", radius: 0.14 });
    tx(slide, q, 1.25, y + 0.22, 2.6, 0.16, { size: 12.2, bold: true, color: i % 2 ? C.blue : C.teal });
    tx(slide, a, 4.0, y + 0.2, 7.8, 0.2, { size: 11.6, color: C.ink });
  });
}

function renderSlide(s, idx) {
  if (s.type === "cover") return renderCover(s, idx);
  if (s.type === "image") return renderImageSlide(s, idx);
  if (s.type === "cards") return renderCards(s, idx);
  if (s.type === "pain") return renderPain(s, idx);
  if (s.type === "loop") return renderLoop(s, idx);
  if (s.type === "agents") return renderAgents(s, idx);
  if (s.type === "resourceFlow") return renderResourceFlow(s, idx);
  if (s.type === "videoInsight") return renderVideoInsight(s, idx);
  if (s.type === "tutor") return renderTutor(s, idx);
  if (s.type === "coordinator") return renderCoordinator(s, idx);
  if (s.type === "architecture") return renderArchitecture(s, idx);
  if (s.type === "demo") return renderDemo(s, idx);
  if (s.type === "qa") return renderQA(s, idx);
  return renderCards(s, idx);
}

slides.forEach((s, idx) => renderSlide(s, idx + 1));

async function addThumbnail(fileName) {
  if (!fs.existsSync(thumbnail)) return;
  const zip = await JSZip.loadAsync(fs.readFileSync(fileName));
  zip.file("docProps/thumbnail.jpeg", fs.readFileSync(thumbnail));
  const relsPath = "_rels/.rels";
  const relsXml = await zip.file(relsPath).async("string");
  if (!relsXml.includes("metadata/thumbnail")) {
    zip.file(
      relsPath,
      relsXml.replace("</Relationships>", '\t\t<Relationship Id="rIdThumbnail" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail" Target="docProps/thumbnail.jpeg"/></Relationships>'),
    );
  }
  const contentTypesPath = "[Content_Types].xml";
  const contentTypesXml = await zip.file(contentTypesPath).async("string");
  if (!contentTypesXml.includes('Extension="jpeg"')) {
    zip.file(contentTypesPath, contentTypesXml.replace("</Types>", '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>'));
  }
  fs.writeFileSync(fileName, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

async function main() {
  await pptx.writeFile({ fileName: out });
  await addThumbnail(out);
  console.log(out);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
