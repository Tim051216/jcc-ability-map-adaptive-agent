/**
 * Pre-submission gate for the AI 数据标注竞赛 MVP.
 *
 * The technical checks are deterministic and can run locally.  The external
 * evidence checks intentionally remain BLOCKED until a real course source,
 * teacher review, and real participant feedback are supplied.  This script
 * never creates placeholder evidence and never treats AI-simulated records as
 * real-user evidence.
 *
 * Usage:
 *   npm run audit:ai-annotation-submission
 *   npm run audit:ai-annotation-submission -- --strict
 *
 * The default report exits 0 so it can be used during development.  `--strict`
 * exits 1 while any external evidence is still missing, which makes it useful
 * as a final release gate.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const deliverablesDir = path.join(repoRoot, "deliverables");
const supplementDir = path.join(deliverablesDir, "06-补充材料");
const strict = process.argv.includes("--strict");
const verificationDeclarationPath = path.join(
  supplementDir,
  "AI数据标注实训智能体-外部证据人工核验声明模板.md",
);

type Result = { area: "技术" | "外部证据" | "提交材料"; status: "PASS" | "BLOCKED" | "WARN"; name: string; detail: string };
const results: Result[] = [];

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function check(area: Result["area"], status: Result["status"], name: string, detail: string): void {
  results.push({ area, status, name, detail });
}

// A file-shaped artifact is not enough for the strict gate.  The declaration
// is a human checkpoint: it must explicitly say that the evidence was
// inspected and that each external item was confirmed.  The template remains
// present during development, but its default "待填写" state cannot pass.
const declarationText = fs.existsSync(verificationDeclarationPath)
  ? fs.readFileSync(verificationDeclarationPath, "utf8")
  : "";
const declarationComplete =
  /人工核验状态：已核验/.test(declarationText) &&
  (declarationText.match(/：已确认/g) || []).length >= 4 &&
  /核验人（负责人）：(?!_+\s*$).+/.test(declarationText) &&
  /指导教师：(?!_+\s*$).+/.test(declarationText) &&
  /核验日期：(?!____年__月__日).+/.test(declarationText);
check(
  "外部证据",
  declarationComplete ? "PASS" : "BLOCKED",
  "外部证据人工核验声明",
  declarationComplete ? "已填写已核验声明" : "待负责人和指导教师填写并确认附件",
);

/** Parse the small RFC-4180 subset emitted by the feedback exporter. */
function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (quoted) {
      if (char === '"' && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  return rows;
}

// Deterministic technical checks.
check(
  "技术",
  exists("a3-student-react-web/src/pages/AIAnnotationAgent.tsx") ? "PASS" : "BLOCKED",
  "MVP 页面源码",
  "src/pages/AIAnnotationAgent.tsx",
);
check(
  "技术",
  exists("a3-student-react-web/src/data/aiAnnotationRules.ts") ? "PASS" : "BLOCKED",
  "结构化候选规则库",
  "src/data/aiAnnotationRules.ts",
);
check(
  "技术",
  exists("a3-student-react-web/src/lib/aiAnnotationLearningTask.ts") &&
    /learning-task-transformer/.test(read("a3-student-react-web/src/pages/AIAnnotationAgent.tsx"))
      ? "PASS"
      : "BLOCKED",
  "岗位工单转学习任务闭环",
  "真实/脱敏工单 → 规则匹配 → 学习任务卡 → 量化验收与来源",
);
check(
  "技术",
  /annotation-agent/.test(read("a3-student-react-web/src/App.tsx")) ? "PASS" : "BLOCKED",
  "路由入口",
  "/annotation-agent 与 /ai-annotation-agent",
);
check(
  "技术",
  read("a3-student-react-web/package.json").includes("smoke:ai-annotation-agent") ? "PASS" : "BLOCKED",
  "自动化验收命令",
  "package.json 已声明 smoke 脚本",
);

const registrationDir = path.join(deliverablesDir, "01-报名信息");
const registrationFiles = fs.existsSync(registrationDir)
  ? fs.readdirSync(registrationDir).filter((file) => file.toLowerCase().endsWith(".pdf") && fs.statSync(path.join(registrationDir, file)).size > 1000)
  : [];
check(
  "提交材料",
  registrationFiles.length > 0 ? "WARN" : "BLOCKED",
  "报名表 PDF",
  registrationFiles.length > 0
    ? `已找到 ${registrationFiles.length} 个 PDF；请负责人核对学校、作品、团队和联系方式`
    : "待从报名系统导出并由负责人核对",
);

const demoInfo = `${read("deliverables/02-作品Demo/README.md")}\n${read("deliverables/02-作品Demo/AI数据标注实训智能体-Demo信息.md")}`;
const hasFormalHttpsDemo = /^- 正式(?: HTTPS)? Demo(?: 地址)?：https:\/\/\S+/m.test(demoInfo);
const hasFormalAgentUrl = /^- 星辰 Agent(?: 体验地址)?：https:\/\/\S+/m.test(demoInfo);
check(
  "提交材料",
  hasFormalHttpsDemo || hasFormalAgentUrl ? "WARN" : "BLOCKED",
  "正式 Demo 或星辰 Agent 地址",
  hasFormalHttpsDemo || hasFormalAgentUrl
    ? "已登记 HTTPS 地址；提交前需从外网设备实测并保存访问证据"
    : "当前只有本地地址；待登记可持续访问的 HTTPS Demo 或星辰 Agent 体验地址",
);

// These are intentionally external gates.  A template or AI simulation is not
// accepted as evidence, even when it has the right filename or shape.
const scenarioRecord = [
  "06-补充材料/场景来源-脱敏访谈或实训观察记录.pdf",
  "06-补充材料/场景来源-脱敏访谈或实训观察记录.md",
].some(exists);
check(
  "外部证据",
  scenarioRecord && declarationComplete ? "PASS" : scenarioRecord ? "WARN" : "BLOCKED",
  "真实场景来源记录",
  scenarioRecord
    ? declarationComplete
      ? "已找到记录并完成声明核验"
      : "已找到脱敏访谈/观察记录（仍需人工核对授权）"
    : "待真实课程/实训观察或教师访谈记录",
);

const teacherReview = [
  "06-补充材料/教师-标准与平台字段核验记录.pdf",
  "06-补充材料/教师-标准与平台字段核验记录.md",
].some(exists);
check(
  "外部证据",
  teacherReview && declarationComplete ? "PASS" : teacherReview ? "WARN" : "BLOCKED",
  "教师标准与字段复核",
  teacherReview
    ? declarationComplete
      ? "已找到记录并完成声明核验"
      : "已找到教师核验记录（仍需签名/日期核对）"
    : "待教师确认版本、条款、schema 与字段取值",
);

const realFeedbackCandidates = [
  path.join(deliverablesDir, "AI数据标注真实用户反馈.csv"),
  path.join(supplementDir, "AI数据标注真实用户反馈.csv"),
];
const realFeedbackPath = realFeedbackCandidates.find((candidate) => fs.existsSync(candidate));
let realFeedbackStatus: Result["status"] = "BLOCKED";
let realFeedbackDetail = "待 2 名学生 + 1 名教师实际试用并导出 CSV";
if (realFeedbackPath) {
  const csv = fs.readFileSync(realFeedbackPath, "utf8");
  const rows = parseCsvRows(csv.replace(/^\ufeff/, ""));
  const header = rows[0] || [];
  const dataRows = rows.slice(1);
  const hasThreeRows = dataRows.length >= 3;
  const typeIndex = header.indexOf("记录类型");
  const identityIndex = header.indexOf("匿名身份");
  const confirmationIndex = header.indexOf("匿名记录确认");
  const hasRequiredColumns = typeIndex >= 0 && identityIndex >= 0 && confirmationIndex >= 0;
  const hasRealType = hasRequiredColumns && dataRows.every((row) => row[typeIndex] === "真实用户试用");
  const hasConfirmation = hasRequiredColumns && dataRows.every((row) => row[confirmationIndex] === "是");
  const studentCount = hasRequiredColumns
    ? dataRows.filter((row) => row[identityIndex]?.includes("人工智能专业在校生")).length
    : 0;
  const teacherCount = hasRequiredColumns
    ? dataRows.filter((row) => row[identityIndex]?.includes("教师")).length
    : 0;
  const hasSimulationRow = hasRequiredColumns && dataRows.some((row) => /AI\s*模拟|模拟回归/.test(row[typeIndex] || ""));
  if (hasThreeRows && hasRealType && hasConfirmation && studentCount >= 2 && teacherCount >= 1 && !hasSimulationRow) {
    realFeedbackStatus = declarationComplete ? "PASS" : "WARN";
    realFeedbackDetail = declarationComplete
      ? "文件格式通过并完成声明核验"
      : "文件存在且格式像真实记录；仍需人工核对参与者身份、授权和原始反馈证据";
  } else {
    realFeedbackDetail = "文件存在但未通过行数、记录类型、匿名确认、身份构成或模拟文本检查，不能作为正式证据";
  }
}
check("外部证据", realFeedbackStatus, "真实用户反馈 CSV", realFeedbackDetail);

const feedbackEvidenceFiles = fs.existsSync(supplementDir)
  ? fs
      .readdirSync(supplementDir)
      .filter((file) => /真实用户|用户[ABC]|匿名.*反馈/.test(file) && !/模板|AI模拟|模拟/.test(file))
  : [];
check(
  "外部证据",
  feedbackEvidenceFiles.length >= 2 && declarationComplete
    ? "PASS"
    : feedbackEvidenceFiles.length >= 2
      ? "WARN"
      : "BLOCKED",
  "匿名书面/视频反馈证据",
  feedbackEvidenceFiles.length >= 2
    ? declarationComplete
      ? `已找到 ${feedbackEvidenceFiles.length} 个文件并完成声明核验`
      : `已找到 ${feedbackEvidenceFiles.length} 个候选文件；请人工核对对应身份和授权`
    : "待至少 2 份与 CSV 对应的匿名书面反馈、访谈纪要或经同意的视频",
);

// The competition package also requires a signed safety/compliance
// commitment.  Keep this as an explicit external gate: a template or a
// hand-written Markdown note is not a signed artifact and must not make the
// strict release check pass.
const signedSafetyCandidates = [
  path.join(deliverablesDir, "05-安全与合规", "AI数据标注实训智能体-安全合规承诺-已签署.pdf"),
  path.join(deliverablesDir, "05-伦理与安全合规性声明", "AI数据标注实训智能体-安全合规承诺-已签署.pdf"),
];
const signedSafetyPath = signedSafetyCandidates.find((candidate) => fs.existsSync(candidate));
const signedSafetyReady = Boolean(signedSafetyPath && fs.statSync(signedSafetyPath).size > 1000);
check(
  "提交材料",
  signedSafetyReady && declarationComplete ? "PASS" : signedSafetyReady ? "WARN" : "BLOCKED",
  "安全与合规承诺（签署版）",
  signedSafetyReady
    ? declarationComplete
      ? "已找到签署版并完成声明核验"
      : "已找到签署版；仍需人工核对签字、盖章和授权"
    : "待负责人签署并按主办方要求归档 PDF；模板不能代替签署版",
);

for (const result of results) {
  console.log(`${result.status.padEnd(7)} [${result.area}] ${result.name} — ${result.detail}`);
}

// A WARN means the file shape looks plausible but authenticity still requires
// human inspection.  Strict mode must not treat a hand-written CSV as proof.
const unresolvedExternal = results.filter((result) => result.area !== "技术" && result.status !== "PASS");
const strictFailure = strict && unresolvedExternal.length > 0;
if (strictFailure) {
  console.error(`严格提交门禁未通过：仍有 ${unresolvedExternal.length} 项外部证据或提交材料缺失/待人工核验。`);
  process.exit(1);
}

if (unresolvedExternal.length) {
  console.log(`开发模式：${unresolvedExternal.length} 项外部证据或提交材料仍待补齐；未生成或修改任何证据文件。`);
}
