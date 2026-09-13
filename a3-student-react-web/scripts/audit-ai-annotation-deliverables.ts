import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const deliverablesDir = path.join(repoRoot, "deliverables");
const checks: Array<[string, boolean, string]> = [];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function check(name: string, ok: boolean, detail: string): void {
  checks.push([name, ok, detail]);
}

const requiredFiles = [
  "AI数据标注实训智能体-竞赛说明.md",
  "AI数据标注实训智能体-证据矩阵.md",
  "AI数据标注实训智能体-交付审计.md",
  "AI数据标注实训智能体-来源规则输出映射.md",
  "AI数据标注实训智能体-来源文件核验清单.md",
  "AI数据标注实训智能体-提交前总清单.md",
  "AI数据标注实训智能体-试用与演示指南.md",
  "AI数据标注实训智能体-真实试用执行清单.md",
  "AI数据标注实训智能体-场景来源核验模板.md",
  "AI数据标注实训智能体-知识来源核验审计.md",
  "AI数据标注实训智能体-缺口审计与推进计划.md",
  "06-补充材料/AI数据标注实训智能体-外部证据人工核验声明模板.md",
  "AI数据标注实训智能体-AI模拟反馈.csv",
  "AI数据标注真实用户反馈-模板.csv",
  "AI数据标注实训智能体-知识库目录.md",
  "AI数据标注实训智能体-岗位适配说明.md",
];

for (const file of requiredFiles) {
  check(`材料存在：${file}`, fs.existsSync(path.join(deliverablesDir, file)), deliverablesDir);
}
check(
  "源码知识目录模块存在",
  fs.existsSync(path.join(repoRoot, "a3-student-react-web/src/data/aiAnnotationKnowledge.ts")),
  "a3-student-react-web/src/data/aiAnnotationKnowledge.ts",
);

// Binary handoff artifacts are part of the formal submission, so verify both
// their presence and that the files are non-empty.  Text-only audits can pass
// while the actual DOCX/PPTX handoff is missing.
const requiredArtifacts = [
  "deliverables/03-作品说明/AI数据标注实训智能体-项目说明.docx",
  "deliverables/03-作品说明/AI数据标注实训智能体-演示稿.pptx",
];
for (const file of requiredArtifacts) {
  const artifactPath = path.join(repoRoot, file);
  const stat = fs.existsSync(artifactPath) ? fs.statSync(artifactPath) : undefined;
  check(`正式产物存在且非空：${path.basename(file)}`, Boolean(stat?.isFile() && stat.size > 0), file);
}

const demoRecordingFiles = [
  "deliverables/02-作品Demo/演示录屏/ai-annotation-demo-AI模拟-内部演示-20260913.webm",
  "deliverables/02-作品Demo/演示录屏/ai-annotation-demo-AI模拟-内部演示-20260913.mp4",
];
check(
  "内部演示录屏说明存在",
  fs.existsSync(path.join(deliverablesDir, "02-作品Demo/演示录屏/README.md")),
  "02-作品Demo/演示录屏/README.md",
);
check(
  "内部演示录屏文件完整",
  demoRecordingFiles.every((file) => {
    const recording = path.join(repoRoot, file);
    return fs.existsSync(recording) && fs.statSync(recording).size > 1000;
  }),
  "WebM + MP4（文件名保留 AI 模拟标识）",
);

const component = read("a3-student-react-web/src/pages/AIAnnotationAgent.tsx");
const ruleModule = read("a3-student-react-web/src/data/aiAnnotationRules.ts");
const knowledgeModule = read("a3-student-react-web/src/data/aiAnnotationKnowledge.ts");
const competition = read("deliverables/AI数据标注实训智能体-竞赛说明.md");
const mapping = read("deliverables/AI数据标注实训智能体-来源规则输出映射.md");
const simulationCsv = read("deliverables/AI数据标注实训智能体-AI模拟反馈.csv");
const realTemplate = read("deliverables/AI数据标注真实用户反馈-模板.csv");
const smoke = read("a3-student-react-web/scripts/smoke-ai-annotation-agent.ts");
const submissionAudit = read("a3-student-react-web/scripts/audit-ai-annotation-submission.ts");
const packageScript = read("scripts/package-ai-annotation.ps1");
const packageVerifierPath = path.join(repoRoot, "scripts/verify-ai-annotation-package.ps1");
const packageJson = read("a3-student-react-web/package.json");

check("规则库含 3 个稳定 ID", ["ANN-OCC-01", "ANN-TRU-01", "ANN-INS-01"].every((id) => ruleModule.includes(id)), "aiAnnotationRules.ts");
const knowledgeIds = Array.from(knowledgeModule.matchAll(/candidate\(\s*"(K\d{3})"/g), (match) => match[1]);
const uniqueKnowledgeIds = new Set(knowledgeIds);
check(
  "知识库含至少 50 条结构化内容",
  knowledgeModule.includes("AI_ANNOTATION_KNOWLEDGE") && uniqueKnowledgeIds.size >= 50,
  `aiAnnotationKnowledge.ts（检测到 ${uniqueKnowledgeIds.size} 条 K 条目）`,
);
check(
  "知识条目均带来源与候选状态",
  uniqueKnowledgeIds.size >= 50 &&
    knowledgeModule.includes('reviewStatus: "candidate"') &&
    knowledgeModule.includes("sourceId") &&
    knowledgeModule.includes("sourceLocator"),
  "aiAnnotationKnowledge.ts",
);
check(
  "规则库含来源追踪元数据",
  ["sourceId", "sourceLocator", "reviewStatus"].every((field) => ruleModule.includes(field)) &&
    ["S1", "S2", "S3"].every((sourceId) => ruleModule.includes(`sourceId: \"${sourceId}\"`)),
  "aiAnnotationRules.ts",
);
check("页面按意图匹配 1 条规则", component.includes("按意图匹配 1 条规则"), "页面副标题");
check(
  "页面显式标注 AI 生成内容",
  component.includes("AI生成内容") && component.includes("仅供教学辅助") && component.includes("教师核验"),
  "AIAnnotationAgent.tsx",
);
check("页面输出规则 ID 与来源状态", component.includes("annotation-rule-trace") && component.includes("待教师核验"), "AIAnnotationAgent.tsx");
check("规则命中后按对象携带来源", component.includes("source: matchedRule.source") && !component.includes("source: rules[0].source"), "AIAnnotationAgent.tsx");
check("反馈需确认后保存", component.includes("feedback-consent") && component.includes("!consentConfirmed"), "AIAnnotationAgent.tsx");
check("文档没有把知识库误写为仅 3 条", !competition.includes("含 3 条结构化规则的规则库"), "竞赛说明");
check(
  "文档明确区分核心规则与知识条目",
  [competition, mapping].every((text) => text.includes("核心执行规则") && text.includes("知识条目")),
  "竞赛说明/来源映射",
);
check(
  "包含岗位适配方法与范围",
  read("deliverables/AI数据标注实训智能体-岗位适配说明.md").includes("适配步骤") &&
    read("deliverables/AI数据标注实训智能体-岗位适配说明.md").includes("可适配范围"),
  "岗位适配说明",
);
check("候选规则带待核验说明", component.includes("候选规则") && component.includes("待来源核验"), "页面标签");
check("COCO 边界被明确限定", mapping.includes("`occluded`/`truncated`") && mapping.includes("学校平台 schema") && mapping.includes("不能直接支持"), "来源映射");
check(
  "反馈记录带类型和匿名确认字段",
  component.includes("recordType") &&
    component.includes("confirmedAt") &&
    component.includes('["记录类型", "匿名身份"') &&
    realTemplate.startsWith("记录类型,匿名身份") &&
    realTemplate.includes("匿名记录确认,确认时间"),
  "页面与模板",
);
check("模拟 CSV 明确标记", simulationCsv.split(/\r?\n/).slice(1).filter(Boolean).every((line) => line.startsWith("AI模拟（内部演示）")), "AI 模拟 CSV");
check("Smoke 至少覆盖 27 个断言", (smoke.match(/checks\.push\(/g) || []).length >= 27, "smoke 脚本");
check("提交预检区分开发/严格模式", submissionAudit.includes("--strict") && submissionAudit.includes("BLOCKED") && submissionAudit.includes("未生成或修改任何证据文件"), "提交预检脚本");
check("预提交包包含缺口计划", packageScript.includes("deliverables\\AI数据标注实训智能体-缺口审计与推进计划.md"), "package-ai-annotation.ps1");
check("预提交包验真脚本存在", fs.existsSync(packageVerifierPath), "scripts/verify-ai-annotation-package.ps1");
check("预提交包验真命令已声明", packageJson.includes("verify:ai-annotation-package"), "package.json");

const forbiddenStaleTerms = ["《数据标注员》职业技能等级标准（2021）", "《人工智能训练师》国家职业技能标准（2021）"];
const searchableFiles = [
  "deliverables/AI数据标注实训智能体-竞赛说明.md",
  "deliverables/AI数据标注实训智能体-证据矩阵.md",
  "deliverables/AI数据标注实训智能体-交付审计.md",
  "deliverables/AI数据标注实训智能体-来源规则输出映射.md",
  "a3-student-react-web/src/pages/AIAnnotationAgent.tsx",
];
for (const term of forbiddenStaleTerms) {
  const hits = searchableFiles.filter((file) => read(file).includes(term));
  check(`不存在旧来源名称：${term}`, hits.length === 0, hits.join(", "));
}

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok, detail] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
if (failed.length) process.exit(1);
