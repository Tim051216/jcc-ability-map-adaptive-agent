import { useState } from "react";
import {
  AI_ANNOTATION_RULES,
  AI_ANNOTATION_RULE_COUNT,
  type AnnotationIntent,
  type AnnotationRule,
} from "../data/aiAnnotationRules";
import {
  AI_ANNOTATION_KNOWLEDGE,
  AI_ANNOTATION_KNOWLEDGE_COUNT,
} from "../data/aiAnnotationKnowledge";
import {
  generateAnnotationLearningTask,
  type AnnotationLearningTask,
} from "../lib/aiAnnotationLearningTask";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  ClipboardList,
  ChevronDown,
  Download,
  FileText,
  MessageCircle,
  Send,
  ShieldCheck,
  UserRound,
  Workflow,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

type FeedbackRecordType = "" | "真实用户试用" | "AI模拟（内部演示）";

type Message = {
  role: "assistant" | "user";
  text: string;
  steps?: string[];
  source?: string;
  ruleId?: string;
  ruleTitle?: string;
  sourceId?: AnnotationRule["sourceId"];
  reviewStatus?: AnnotationRule["reviewStatus"];
  matchedKeywords?: string[];
  warning?: string;
  needsClarification?: boolean;
};

type FeedbackRecord = {
  recordType: Exclude<FeedbackRecordType, "">;
  identity: string;
  usefulness: string;
  usability: string;
  accuracy: string;
  feedback: string;
  at: string;
  confirmed: boolean;
  confirmedAt: string;
};

const FEEDBACK_STORAGE_KEY = "aiAnnotationTrialFeedback";
const prompts = [
  "这张图里的人被车挡住了，框怎么画？",
  "同类目标挨在一起，应该标几个框？",
  "帮我检查一张目标检测标注",
];

// 规则库维护在独立数据模块中，页面只负责检索、解释和呈现。
const rules = AI_ANNOTATION_RULES;

function readFeedbackRecords(): FeedbackRecord[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): FeedbackRecord[] => {
      if (!item || typeof item !== "object") return [];
      const record = item as Partial<FeedbackRecord>;
      const isValid = (
        (record.recordType === "真实用户试用" || record.recordType === "AI模拟（内部演示）") &&
        typeof record.identity === "string" &&
        [record.usefulness, record.usability, record.accuracy].every((value) =>
          ["1", "2", "3", "4", "5"].includes(String(value)),
        ) &&
        typeof record.feedback === "string" &&
        typeof record.at === "string"
      );
      if (!isValid) return [];
      // Records written before the confirmation field was introduced remain
      // readable and are exported as unconfirmed legacy rows; saving a new
      // row never silently deletes them.
      return [
        {
          recordType: record.recordType as Exclude<FeedbackRecordType, "">,
          identity: record.identity,
          usefulness: String(record.usefulness),
          usability: String(record.usability),
          accuracy: String(record.accuracy),
          feedback: record.feedback,
          at: record.at,
          confirmed: record.confirmed === true,
          confirmedAt: typeof record.confirmedAt === "string" ? record.confirmedAt : "",
        },
      ];
    });
  } catch {
    return [];
  }
}

function detectMatchedRules(input: string): AnnotationRule[] {
  const q = input.toLowerCase();
  const seen = new Set<AnnotationIntent>();
  return rules.filter((rule) => {
    if (seen.has(rule.intent) || !rule.keywords.some((keyword) => q.includes(keyword))) return false;
    seen.add(rule.intent);
    return true;
  });
}

function clarificationForIntents(intents: AnnotationIntent[]): string {
  const labels: Record<AnnotationIntent, string> = {
    occlusion: "遮挡",
    truncation: "截断（目标出画面）",
    instances: "同类目标粘连",
  };
  const options = intents.length
    ? intents.map((intent) => labels[intent]).join("、")
    : "遮挡、截断（目标出画面）、同类目标粘连";
  return `我同时识别到${options}几种可能。请只补充一种现象（也可以直接点快捷问题），我再给出对应框选步骤。`;
}

function answer(input: string, awaitingClarification = false): Message {
  const trimmed = input.trim();
  const q = trimmed.toLowerCase();
  if (!trimmed) {
    return {
      role: "assistant",
      text: "请描述图片中的目标和困难，例如“人被车挡住了”或“两个目标挨在一起”。我会按标注规则给出判定。",
    };
  }

  const matchedRules = detectMatchedRules(trimmed);
  if (matchedRules.length > 1) {
    return {
      role: "assistant",
      text: clarificationForIntents(matchedRules.map((rule) => rule.intent)),
      source: "对话管理规则：检测到多个候选现象，先澄清再匹配规则",
      needsClarification: true,
    };
  }

  const matchedRule = matchedRules[0];
  const intent = matchedRule?.intent;
  if (intent === "occlusion") {
    return {
      role: "assistant",
      text: "这是“遮挡目标”判定。先按可见区域处理，不要凭想象补全被挡部分：",
      steps: [
        "确认目标类别仍可辨认，且不是背景纹理。",
        "沿可见目标轮廓画紧致矩形框，不把遮挡物一起框入。",
        "按学校标注平台字段填写遮挡属性（常见字段名为 occluded；以平台 schema/教师核验版为准）；若完全不可辨认，提交为疑似目标并备注给质检员。",
        "保存后抽样复核：同一批图片的遮挡目标采用同一规则。",
      ],
      warning: "常见错误：把遮挡物和目标合并，或为了“完整”把框扩到不可见区域。",
      source: matchedRule.source,
      ruleId: matchedRule.id,
      ruleTitle: matchedRule.title,
      sourceId: matchedRule.sourceId,
      reviewStatus: matchedRule.reviewStatus,
      matchedKeywords: matchedRule.keywords.filter((keyword) => q.includes(keyword)),
    };
  }
  if (intent === "truncation") {
    return {
      role: "assistant",
      text: "这是“截断目标”判定：",
      steps: [
        "确认目标类别可辨认，即使目标只露出一部分也保留实例。",
        "框的边界贴合图像边缘，不超出图片尺寸。",
        "按学校标注平台字段填写截断属性（常见字段名为 truncated；以平台 schema/教师核验版为准）。",
        "提交前按学校平台 schema 检查 bbox 的 x、y、width、height；COCO 只规定字段结构和坐标起点，不把“不得越界”归因于 COCO。",
      ],
      source: matchedRule.source,
      ruleId: matchedRule.id,
      ruleTitle: matchedRule.title,
      sourceId: matchedRule.sourceId,
      reviewStatus: matchedRule.reviewStatus,
      matchedKeywords: matchedRule.keywords.filter((keyword) => q.includes(keyword)),
    };
  }
  if (intent === "instances") {
    return {
      role: "assistant",
      text: "同类目标也要按“实例”分别标注：",
      steps: [
        "数清可以独立辨认的目标实例。",
        "每个实例单独绘制一个框，遮挡关系不改变实例数量。",
        "框与框可以重叠，但不能把两个实例合成一个大框。",
        "提交前检查类别、数量和框的对应关系。",
      ],
      source: matchedRule.source,
      ruleId: matchedRule.id,
      ruleTitle: matchedRule.title,
      sourceId: matchedRule.sourceId,
      reviewStatus: matchedRule.reviewStatus,
      matchedKeywords: matchedRule.keywords.filter((keyword) => q.includes(keyword)),
    };
  }

  if (awaitingClarification && (q.includes("目标检测") || q.includes("实例分割"))) {
    return {
      role: "assistant",
      text: "已收到任务类型。还差一个现象：目标是被遮挡、出画面（截断），还是多个同类实例粘在一起？补充其中一种，我就给出具体步骤。",
      source: "对话管理规则：第 2 轮任务类型确认",
      needsClarification: true,
    };
  }

  if (q.includes("这张") || q.includes("这个") || q.includes("怎么弄") || trimmed.length < 8) {
    return {
      role: "assistant",
      text: "你遇到的是哪类情况？请选择：①遮挡 ②截断（目标出画面）③同类目标粘连。也请补充标注任务类型（目标检测/实例分割），我再给具体框选步骤。",
      source: "对话管理规则：标注问题澄清",
      needsClarification: true,
    };
  }
  return {
    role: "assistant",
    text: "为了准确判定，请补充：目标是否被遮挡/截断？当前使用目标检测还是实例分割？",
    source: "知识库匹配：AI 数据标注实训规则库",
    needsClarification: true,
  };
}

/**
 * A compact, self-contained visual aid for the two boundary cases covered by
 * the rules.  It is deliberately labelled as an illustration rather than a
 * dataset sample: the page must not imply that a real image or annotation was
 * collected when the team has not yet completed external user testing.
 */
function AnnotationSketch() {
  return (
    <div className="rounded-2xl border border-[#dde2ee] bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-bold">框选示意</h3>
          <p className="mt-1 text-xs text-slate-500">用颜色记住边界，不凭想象补全目标</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">课堂示例</span>
      </div>
      <figure aria-label="遮挡与截断目标框选示意图">
        <svg data-testid="annotation-sketch" role="img" aria-labelledby="annotation-sketch-title annotation-sketch-desc" viewBox="0 0 640 220" className="h-auto w-full rounded-xl border border-slate-200 bg-[#f8fafc]">
          <title id="annotation-sketch-title">遮挡与截断目标框选示意</title>
          <desc id="annotation-sketch-desc">左侧展示被车辆遮挡的人，只框可见目标；右侧展示出画面的目标，框贴合图像边缘。</desc>
          <rect x="12" y="12" width="300" height="196" rx="12" fill="#eef2ff" />
          <rect x="328" y="12" width="300" height="196" rx="12" fill="#ecfeff" />
          <text x="28" y="38" fill="#3730a3" fontSize="15" fontWeight="700">遮挡 · 只框可见区域</text>
          <text x="344" y="38" fill="#155e75" fontSize="15" fontWeight="700">截断 · 框贴图像边缘</text>

          {/* Occlusion panel: a person behind a vehicle. */}
          <rect x="28" y="54" width="268" height="136" rx="8" fill="#dbeafe" />
          <circle cx="117" cy="88" r="13" fill="#fbbf24" />
          <path d="M117 102 L117 147 M117 115 L99 131 M117 115 L135 128 M117 147 L103 173 M117 147 L132 173" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
          <path d="M73 139 H250 Q263 139 263 151 V177 H62 V151 Q62 139 73 139 Z" fill="#64748b" />
          <circle cx="93" cy="177" r="13" fill="#1e293b" />
          <circle cx="229" cy="177" r="13" fill="#1e293b" />
          <rect x="84" y="72" width="66" height="108" rx="4" fill="none" stroke="#16a34a" strokeWidth="4" />
          <text x="158" y="88" fill="#166534" fontSize="13" fontWeight="700">绿色框 = 可见目标</text>
          <text x="158" y="108" fill="#475569" fontSize="12">车辆不纳入目标框</text>
          <line x1="151" y1="96" x2="136" y2="101" stroke="#16a34a" strokeWidth="2" />

          {/* Truncation panel: the target continues beyond the right edge. */}
          <rect x="344" y="54" width="268" height="136" rx="8" fill="#cffafe" />
          <rect x="558" y="54" width="54" height="136" fill="#a5f3fc" opacity="0.65" />
          <circle cx="548" cy="103" r="18" fill="#fbbf24" />
          <path d="M548 123 L548 176 M548 137 L528 151 M548 137 L574 148 M548 176 L531 190 M548 176 L568 190" stroke="#334155" strokeWidth="10" strokeLinecap="round" />
          <rect x="510" y="82" width="102" height="108" rx="4" fill="none" stroke="#0891b2" strokeWidth="4" />
          <line x1="612" y1="66" x2="612" y2="190" stroke="#dc2626" strokeDasharray="5 5" strokeWidth="2" />
          <text x="357" y="88" fill="#0e7490" fontSize="13" fontWeight="700">蓝色框 = 保留实例</text>
          <text x="357" y="108" fill="#475569" fontSize="12">右边界到图片边缘为止</text>
          <line x1="505" y1="96" x2="520" y2="102" stroke="#0891b2" strokeWidth="2" />
        </svg>
        <figcaption className="mt-2 text-[11px] leading-5 text-slate-500">示意图（非真实样本）：遮挡物不纳入目标框；截断目标框不超出图片尺寸。</figcaption>
      </figure>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-emerald-50 px-2.5 py-2 text-emerald-800"><span className="font-semibold">保留：</span>可辨认实例</div>
        <div className="rounded-lg bg-amber-50 px-2.5 py-2 text-amber-800"><span className="font-semibold">核对：</span>字段以学校 schema 为准</div>
      </div>
    </div>
  );
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function AIAnnotationAgent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "你好，我是 AI 数据标注实训助手。专门帮助你判断遮挡、截断和同类目标边界，减少返工。",
    },
  ]);
  const [input, setInput] = useState("");
  const [awaitingClarification, setAwaitingClarification] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [identity, setIdentity] = useState("A｜人工智能专业在校生");
  const [recordType, setRecordType] = useState<FeedbackRecordType>("");
  const [sent, setSent] = useState(false);
  const [rating, setRating] = useState({ usefulness: "5", usability: "5", accuracy: "5" });
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [showKnowledgeCatalog, setShowKnowledgeCatalog] = useState(false);
  const [workOrder, setWorkOrder] = useState("");
  const [learningTask, setLearningTask] = useState<AnnotationLearningTask | null>(null);
  const [taskGenerationMessage, setTaskGenerationMessage] = useState("");

  const send = (value = input) => {
    if (!value.trim()) return;
    const response = answer(value, awaitingClarification);
    setMessages((current) => [...current, { role: "user", text: value }, response]);
    setInput("");
    setAwaitingClarification(Boolean(response.needsClarification));
  };

  const generateLearningTask = () => {
    const result = generateAnnotationLearningTask(workOrder);
    if (result.status === "clarify") {
      setLearningTask(null);
      setTaskGenerationMessage(result.message);
      return;
    }
    setLearningTask(result.task);
    setTaskGenerationMessage("");
  };

  const save = () => {
    if (!recordType || !text.trim() || !consentConfirmed) return;
    const now = new Date().toISOString();
    const old = readFeedbackRecords();
    const next: FeedbackRecord = {
      recordType,
      identity,
      ...rating,
      feedback: text.trim(),
      at: now,
      confirmed: true,
      confirmedAt: now,
    };
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify([...old, next]));
    setSent(true);
  };

  const recordNext = () => {
    setSent(false);
    setText("");
    setRating({ usefulness: "5", usability: "5", accuracy: "5" });
    setConsentConfirmed(false);
    setIdentity(
      identity.startsWith("A")
        ? "B｜人工智能专业在校生"
        : identity.startsWith("B")
          ? "C｜人工智能专业教师"
          : "A｜人工智能专业在校生",
    );
  };

  const closeFeedback = () => {
    setOpen(false);
    setSent(false);
    setText("");
    setIdentity("A｜人工智能专业在校生");
    setRecordType("");
    setRating({ usefulness: "5", usability: "5", accuracy: "5" });
    setConsentConfirmed(false);
  };

  const exportCsv = (typeFilter?: Exclude<FeedbackRecordType, "">) => {
    const allRows = readFeedbackRecords();
    // Only explicitly confirmed rows are eligible for export. Legacy rows
    // without the confirmation field remain readable for local inspection but
    // cannot silently enter a submission package.
    const rows = (typeFilter ? allRows.filter((row) => row.recordType === typeFilter) : allRows).filter(
      (row) => row.confirmed,
    );
    if (!rows.length) return;
    const csv = [
      ["记录类型", "匿名身份", "实用性", "易用性", "准确性", "反馈", "时间", "匿名记录确认", "确认时间"].map(csvCell).join(","),
      ...rows.map((row) =>
        [
          row.recordType,
          row.identity,
          row.usefulness,
          row.usability,
          row.accuracy,
          row.feedback,
          row.at,
          row.confirmed ? "是" : "否",
          row.confirmedAt,
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\r\n");
    const kinds = new Set(rows.map((row) => row.recordType));
    const filename =
      kinds.size === 1 && kinds.has("真实用户试用")
        ? "AI数据标注真实用户反馈.csv"
        : kinds.size === 1 && kinds.has("AI模拟（内部演示）")
          ? "AI数据标注实训智能体-AI模拟反馈.csv"
          : "AI数据标注实训智能体-反馈记录.csv";
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-[#172033]">
      <header className="border-b border-[#dde2ee] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-stretch justify-between gap-3 px-3 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/job-learning"
              aria-label="返回 BiliLearn 岗课赛自适应学习"
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-[#5146c7] hover:text-[#5146c7]"
            >
              <ArrowLeft size={17} />
              <span className="hidden sm:inline">返回 BiliLearn</span>
            </Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5146c7] text-white">
              <Bot size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#5146c7]">BiliLearn · 扩展岗位实训模块</p>
              <h1 className="text-lg font-bold">AI 数据标注 · 质检助手</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 sm:justify-end sm:text-sm">
            <span
              data-testid="ai-generated-label"
              title="页面回答来自候选规则库，仅供教学辅助，提交前需教师核验"
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-800"
            >
              AI生成内容
            </span>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">核心规则 {AI_ANNOTATION_RULE_COUNT} 条</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">知识库 {AI_ANNOTATION_KNOWLEDGE_COUNT} 条</span>
            <span className="hidden items-center gap-1 md:flex">
              <ShieldCheck size={16} />一致性优先
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-3 py-6 sm:px-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-5">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#5146c7]">候选场景 · 待来源核验 · 人工智能专业</p>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                需教师/实训记录确认
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold">
              人工智能专业学生在目标检测标注实训中，对遮挡、截断和同类目标边界判定不一致，可能导致质检返工。
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              服务岗位：AI 数据标注工程师。当前页面使用候选场景描述；正式提交前需用课程/实训观察记录或教师访谈核验“谁—环节—困难”。
            </p>
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              <CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span><strong>AI生成内容：</strong>以下回答由候选规则库生成，仅供教学辅助；提交作业或生产标注前请由教师核验。</span>
            </p>
          </div>

          <div className="overflow-hidden border border-slate-200 bg-white" data-testid="learning-task-transformer">
            <div className="grid border-b border-slate-200 md:grid-cols-[92px_1fr]">
              <div className="flex items-center justify-center bg-[#002FA7] px-4 py-5 text-3xl font-black tabular-nums text-white">
                03
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center gap-2 text-[#002FA7]">
                  <ClipboardList size={18} aria-hidden="true" />
                  <h3 className="font-bold">岗位工单转学习任务卡</h3>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  核心方向 3：输入真实或脱敏后的标注工单，自动生成任务名称、工作情境、步骤、知识点、技能点、安全要点与验收标准。
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2">
              <div className="border-b border-slate-200 p-5 md:border-b-0 md:border-r">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label htmlFor="annotation-work-order" className="text-sm font-bold text-slate-800">
                    01｜企业或实训工单
                  </label>
                  <button
                    type="button"
                    data-testid="fill-work-order-example"
                    onClick={() => setWorkOrder("目标检测标注工单：两名同类行人挨在一起但仍可分别辨认，请分别框选并完成提交前质检。")}
                    className="text-xs font-semibold text-[#002FA7] underline underline-offset-4"
                  >
                    填入脱敏示例
                  </button>
                </div>
                <textarea
                  id="annotation-work-order"
                  value={workOrder}
                  onChange={(event) => setWorkOrder(event.target.value)}
                  placeholder="粘贴工单，并写明任务类型、目标类别和遮挡/截断/同类实例现象…"
                  className="h-32 w-full resize-y border border-slate-300 bg-white p-3 text-sm leading-6 outline-none focus:border-[#002FA7]"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] leading-5 text-slate-500">不得粘贴未授权原图、姓名、学号、账号或生产数据。</p>
                  <button
                    type="button"
                    onClick={generateLearningTask}
                    className="bg-[#002FA7] px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                  >
                    生成学习任务卡
                  </button>
                </div>
                {taskGenerationMessage ? (
                  <p role="alert" className="mt-3 border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    {taskGenerationMessage}
                  </p>
                ) : null}
              </div>

              <div className="min-h-64 bg-slate-50 p-5">
                <p className="mb-3 text-sm font-bold text-slate-800">02｜生成结果</p>
                {learningTask ? (
                  <article className="space-y-4" data-testid="generated-learning-task-card">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-[#002FA7] px-2 py-1 text-[10px] font-bold text-white">{learningTask.id}</span>
                        <span className="border border-amber-300 px-2 py-1 text-[10px] font-semibold text-amber-800">
                          {learningTask.reviewStatus === "candidate" ? "候选规则·待教师核验" : "已核验"}
                        </span>
                      </div>
                      <h4 className="mt-2 text-lg font-bold text-slate-900">{learningTask.taskName}</h4>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{learningTask.taskDescription}</p>
                    </div>
                    <div className="border-y border-slate-200 py-3 text-xs leading-5 text-slate-600">
                      <p className="font-semibold text-slate-800">工作情境</p>
                      <p>{learningTask.workContext}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">操作步骤</p>
                      <ol className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">
                        {learningTask.steps.map((step, index) => <li key={step}>{index + 1}. {step}</li>)}
                      </ol>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-bold text-slate-800">知识点</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{learningTask.knowledgePoints.join("、")}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">技能点</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{learningTask.skillPoints.join("、")}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">提交产出与量化验收</p>
                      <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-600">
                        {learningTask.deliverables.map((item) => <li key={item}>产出：{item}</li>)}
                        {learningTask.acceptanceCriteria.map((item) => <li key={item}>验收：{item}</li>)}
                      </ul>
                    </div>
                    <div className="border-l-2 border-amber-500 bg-amber-50 px-3 py-2">
                      <p className="text-xs font-bold text-amber-900">安全要点</p>
                      <ul className="mt-1 space-y-1 text-xs leading-5 text-amber-900">
                        {learningTask.safetyPoints.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                    <p className="text-[11px] leading-5 text-slate-500">依据：{learningTask.citations.join("；")}</p>
                  </article>
                ) : (
                  <div className="flex min-h-52 items-center justify-center border border-dashed border-slate-300 bg-white p-6 text-center text-xs leading-6 text-slate-500">
                    输入单一微任务工单后生成。若同时出现遮挡和截断，系统会先要求缩小任务范围。
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#dde2ee] bg-white">
            <div className="border-b border-[#edf0f5] px-5 py-4">
              <div className="flex items-center gap-2">
                <Workflow size={17} className="text-[#5146c7]" aria-hidden="true" />
                <h3 className="font-bold">标注判定对话台</h3>
              </div>
              <p className="text-xs text-slate-500">输入图片现象，按意图匹配 1 条规则，获取步骤、错误提示与依据</p>
            </div>
            <div
              aria-label="标注闭环流程"
              data-testid="annotation-flow"
              className="flex items-center gap-2 overflow-x-auto border-b border-[#edf0f5] px-5 py-3 text-[11px] text-slate-500"
            >
              {["输入现象", "匹配规则", "生成步骤", "质检反馈"].map((label, index) => (
                <div key={label} className="flex shrink-0 items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 font-semibold text-[#5146c7]">
                    {index + 1}
                  </span>
                  <span className="font-medium">{label}</span>
                  {index < 3 ? <span aria-hidden="true" className="text-slate-300">→</span> : null}
                </div>
              ))}
            </div>
            <div aria-live="polite" className="max-h-[470px] space-y-4 overflow-y-auto p-5">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      message.role === "user" ? "bg-slate-200" : "bg-indigo-100 text-[#5146c7]"
                    }`}
                  >
                    {message.role === "user" ? <UserRound size={16} /> : <Bot size={17} />}
                  </div>
                  <div
                    className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      message.role === "user" ? "bg-[#5146c7] text-white" : "bg-[#f6f7fb] text-slate-700"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <p className="mb-2 text-[10px] font-semibold tracking-wide text-amber-700" data-testid="ai-generated-result-label">
                        AI生成内容 · 教学辅助
                      </p>
                    ) : null}
                    <p>{message.text}</p>
                    {message.ruleId ? (
                      <div
                        className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800"
                        data-testid="annotation-rule-trace"
                      >
                        <span className="font-semibold">命中候选规则：</span>
                        {message.ruleId} · {message.ruleTitle} · 来源 {message.sourceId}
                        {message.reviewStatus === "candidate" ? " · 待教师核验" : " · 已核验"}
                        {message.matchedKeywords?.length ? ` · 关键词：${message.matchedKeywords.join("、")}` : ""}
                      </div>
                    ) : null}
                    {message.steps ? (
                      <ol className="mt-3 space-y-2">
                        {message.steps.map((step, stepIndex) => (
                          <li key={step} className="flex gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5146c7] text-xs font-bold text-white">
                              {stepIndex + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                    {message.warning ? (
                      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <CircleAlert size={14} className="mr-1 inline" />
                        {message.warning}
                      </p>
                    ) : null}
                    {message.source ? (
                      <p className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-500">依据：{message.source}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-[#edf0f5] p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => send(prompt)}
                    className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs text-[#5146c7] transition hover:bg-indigo-100"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <label htmlFor="annotation-question" className="sr-only">
                  描述标注问题
                </label>
                <input
                  id="annotation-question"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") send();
                  }}
                  placeholder="例如：两个行人被遮挡，框怎么画…"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#5146c7]"
                />
                <button
                  type="button"
                  onClick={() => send()}
                  className="flex items-center gap-2 rounded-xl bg-[#5146c7] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#4338a8]"
                >
                  <Send size={16} />发送
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-[#dde2ee] bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardCheck size={18} className="text-[#5146c7]" />
              <h3 className="font-bold">标注任务卡</h3>
            </div>
            <div className="space-y-3 text-sm">
              <p>
                <b>01 识别实例</b>
                <br />
                <span className="text-xs text-slate-500">区分类别与独立目标</span>
              </p>
              <p>
                <b>02 判定属性</b>
                <br />
                <span className="text-xs text-slate-500">遮挡/截断字段以学校平台 schema 为准</span>
              </p>
              <p>
                <b>03 质检提交</b>
                <br />
                <span className="text-xs text-slate-500">检查数量、边界和一致性</span>
              </p>
            </div>
          </div>

          <AnnotationSketch />

          <div className="rounded-2xl border border-[#dde2ee] bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-bold">知识依据</h3>
                <p className="mt-1 text-[11px] text-slate-500">核心执行规则与候选知识目录分开维护</p>
              </div>
              <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">候选规则</span>
            </div>
            <div className="space-y-4">
              {rules.map((rule) => (
                <div key={rule.id} className="border-l-2 border-indigo-300 pl-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{rule.title}</p>
                    <span className="text-[10px] text-slate-400">{rule.id}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{rule.text}</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#5146c7]">
                    {rule.sourceId} · {rule.sourceLocator} · {rule.reviewStatus === "candidate" ? "待教师核验" : "已核验"}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">{rule.source}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-[#edf0f5] pt-3">
              <button
                type="button"
                onClick={() => setShowKnowledgeCatalog((current) => !current)}
                aria-expanded={showKnowledgeCatalog}
                className="flex w-full items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-left text-xs font-semibold text-[#5146c7] transition hover:bg-indigo-50"
              >
                <span>查看候选知识目录（{AI_ANNOTATION_KNOWLEDGE_COUNT} 条，均待教师核验）</span>
                <ChevronDown size={15} className={`transition-transform ${showKnowledgeCatalog ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {showKnowledgeCatalog ? (
                <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1" data-testid="annotation-knowledge-catalog">
                  {AI_ANNOTATION_KNOWLEDGE.map((entry) => (
                    <article key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-700">{entry.id} · {entry.title}</p>
                        <span className="shrink-0 text-[10px] text-slate-400">{entry.sourceId} · 待核验</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-600">{entry.content}</p>
                      <p className="mt-1 text-[10px] leading-4 text-[#5146c7]">来源编号：{entry.sourceId}；定位：{entry.sourceLocator}</p>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl border border-dashed border-indigo-300 bg-indigo-50 p-4 text-left text-sm font-semibold text-[#5146c7] transition hover:bg-indigo-100"
          >
            <span className="flex items-center gap-2">
              <MessageCircle size={17} />提交试用反馈
            </span>
            <FileText size={17} />
          </button>
        </aside>
      </main>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation">
          <div className="w-full max-w-md rounded-2xl bg-white p-6" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
            <div className="flex items-center justify-between">
              <h3 id="feedback-title" className="font-bold">
                AI 标注助手试用反馈
              </h3>
              <button type="button" onClick={closeFeedback} aria-label="关闭反馈窗口" className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            {sent ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={38} />
                <p className="font-semibold">反馈已保存</p>
                <p className="mt-1 text-xs text-slate-500">
                  当前记录类型：{recordType === "AI模拟（内部演示）" ? "AI 模拟（内部演示）" : "真实用户试用"}；本次类型已保存 {readFeedbackRecords().filter((row) => row.recordType === recordType && row.confirmed).length} 条。请确认类型后再用于提交材料。
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={recordNext} className="rounded-lg bg-[#5146c7] px-4 py-2 text-sm font-semibold text-white">
                    记录下一位
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCsv(recordType || undefined)}
                    className="flex items-center gap-2 rounded-lg border border-[#5146c7] px-4 py-2 text-sm text-[#5146c7]"
                  >
                    <Download size={16} />导出当前类型记录
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                  记录类型必须如实选择：只有目标参与者本人完成试用后，才能选择“真实用户试用”；没有真实参与者时请选择“AI 模拟（内部演示）”，不得把模拟记录当作第 8 项证据。
                </div>

                <label htmlFor="feedback-record-type" className="mt-4 block text-sm font-medium">
                  记录类型
                </label>
                <select
                  id="feedback-record-type"
                  value={recordType}
                  onChange={(event) => {
                    setRecordType(event.target.value as FeedbackRecordType);
                    setConsentConfirmed(false);
                  }}
                  className="mt-1 w-full rounded-lg border p-2"
                >
                  <option value="">请选择记录类型</option>
                  <option value="真实用户试用">真实用户试用（现场填写）</option>
                  <option value="AI模拟（内部演示）">AI 模拟（内部演示）</option>
                </select>

                <label htmlFor="feedback-identity" className="mt-4 block text-sm font-medium">
                  匿名身份（由项目成员分配）
                </label>
                <select id="feedback-identity" value={identity} onChange={(event) => setIdentity(event.target.value)} className="mt-1 w-full rounded-lg border p-2">
                  <option>A｜人工智能专业在校生</option>
                  <option>B｜人工智能专业在校生</option>
                  <option>C｜人工智能专业教师</option>
                </select>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {([
                    ["usefulness", "实用性"],
                    ["usability", "易用性"],
                    ["accuracy", "准确性"],
                  ] as const).map(([key, label]) => (
                    <label key={key} htmlFor={`feedback-${key}`} className="text-xs">
                      {label}
                      <select
                        id={`feedback-${key}`}
                        value={rating[key]}
                        onChange={(event) => setRating((current) => ({ ...current, [key]: event.target.value }))}
                        className="mt-1 w-full rounded border p-2"
                      >
                        <option>5</option>
                        <option>4</option>
                        <option>3</option>
                        <option>2</option>
                        <option>1</option>
                      </select>
                    </label>
                  ))}
                </div>

                <label htmlFor="feedback-text" className="sr-only">
                  具体意见
                </label>
                <textarea
                  id="feedback-text"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={recordType === "AI模拟（内部演示）" ? "请写下模拟意见（仅用于内部演示）…" : "请写下参与者本人填写的具体意见…"}
                  className="mt-4 h-24 w-full rounded-lg border p-3 text-sm"
                />
                <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600" htmlFor="feedback-consent">
                  <input
                    id="feedback-consent"
                    type="checkbox"
                    checked={consentConfirmed}
                    onChange={(event) => setConsentConfirmed(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#5146c7]"
                  />
                  <span>
                    {recordType === "真实用户试用"
                      ? "我确认以上意见由所选匿名身份本人在完成试用后填写，并同意以匿名方式用于本项目内部改进/竞赛材料核验。"
                      : "我确认该记录仅用于 AI 模拟内部演示，不作为真实用户证据；如有真人参与，必须切换为“真实用户试用”并由本人确认。"}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={save}
                  disabled={!recordType || !text.trim() || !consentConfirmed}
                  className="mt-3 w-full rounded-lg bg-[#5146c7] py-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  保存反馈记录
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
