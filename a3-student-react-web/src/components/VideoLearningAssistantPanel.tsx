import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BookText,
  BrainCircuit,
  LoaderCircle,
  MessageSquareText,
  Milestone,
} from "lucide-react";
import type {
  ResourceCard,
  ResourceSourceFileRef,
  VideoInsightAskResponse,
  VideoInsightResponse,
} from "../lib/studentApi";

export type VideoLearningAssistantData = VideoInsightResponse;

function formatTimeLabel(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function pickTopic(resource: ResourceCard | null, file: ResourceSourceFileRef) {
  const raw = `${resource?.title || ""} ${resource?.summary || ""} ${file.display_name}`.toLowerCase();
  if (raw.includes("react")) return "React 状态管理与组件协作";
  if (raw.includes("visio") || raw.includes("flow")) return "流程建模与系统分析";
  if (raw.includes("cloud")) return "云端应用集成与交互链路";
  return "软件工程项目演示与知识梳理";
}

export function buildVideoLearningAssistantData(
  file: ResourceSourceFileRef,
  resource: ResourceCard | null,
): VideoLearningAssistantData {
  const topic = pickTopic(resource, file);
  const title = resource?.title || file.display_name;

  return {
    resource_id: resource?.resource_id ?? null,
    file_id: file.file_id,
    title,
    topic,
    summary: {
      minute: `这段视频围绕“${topic}”快速建立问题背景、演示路径和最终复盘点，适合先抓主线再补细节。`,
      three_minute: `视频先交代“${topic}”要解决的场景与目标，再拆解关键步骤、判断依据和常见误区，最后回到可迁移的方法，帮助学习者把演示过程沉淀成复习材料。`,
      deep_dive: [
        "作者先用具体场景建立上下文，避免学习者只记住零散术语。",
        "中段将流程拆成可验证步骤，每一步都对应一个知识点或判断规则。",
        "视频强调的不只是怎么做，还解释了为什么这样做、容易错在哪里。",
        "如果用于复习，最值得保留的是时间节点、核心术语和步骤顺序。",
      ],
    },
    timeline: [
      { time: 8, label: "问题背景", detail: "交代本节想解决什么问题，以及学习目标。" },
      { time: 36, label: "核心概念", detail: "引入关键术语、对象关系与理解框架。" },
      { time: 78, label: "方法演示", detail: "开始进入具体流程，从输入推到结果。" },
      { time: 126, label: "规则表达", detail: "补充规则、公式或判断依据。" },
      { time: 174, label: "案例复盘", detail: "把方法映射回真实案例，说明迁移点。" },
      { time: 228, label: "总结提升", detail: "收束为复习建议与下一步动作。" },
    ],
    terms: [
      {
        term: "知识点时间轴",
        time: 32,
        alias: "Timeline",
        explanation: "把视频按时间切成可检索的知识片段，方便回看与定位。",
        background: "适合二刷、复盘和做笔记时快速定位重点。",
      },
      {
        term: "术语纠错",
        time: 92,
        alias: "Term Correction",
        explanation: "自动识别字幕翻译中的专业词误译并给出推荐表达。",
        background: "对人物名、公式名、软件名和课程术语尤其有用。",
      },
      {
        term: "结构化摘要",
        time: 142,
        alias: "Structured Summary",
        explanation: "不仅压缩内容，还保留主题、步骤、因果和结论。",
        background: "适合生成 1 分钟版、3 分钟版和深度复盘版摘要。",
      },
      {
        term: "脑图转写",
        time: 210,
        alias: "Mindmap Export",
        explanation: "把视频理解结果转成层级结构，便于记忆和讲解。",
        background: "适合考前梳理章节框架与答辩提纲。",
      },
    ],
    subtitles: [
      {
        start: 0,
        end: 22,
        zh: "这一段先建立任务背景，说明为什么这一步是整个流程的入口。",
        en: "This section sets up the task context and explains why this step is the entry point of the workflow.",
        corrected: "workflow entry point",
      },
      {
        start: 22,
        end: 60,
        zh: "作者开始拆解关键概念，并提醒要把定义和场景对应起来理解。",
        en: "The speaker starts unpacking the key concepts and reminds us to map each definition back to the scenario.",
        corrected: "key concepts",
      },
      {
        start: 60,
        end: 118,
        zh: "这里进入核心演示，重点不是操作本身，而是每一步背后的判断依据。",
        en: "This is the core demonstration, and the focus is not the action itself but the reasoning behind each step.",
        corrected: "reasoning behind each step",
      },
      {
        start: 118,
        end: 180,
        zh: "如果你在这里卡住，可以直接追问这段在讲什么或作者刚才提到的公式是什么。",
        en: "If you get stuck here, you can directly ask what this segment means or what formula was just mentioned.",
        corrected: "formula mentioned just now",
      },
      {
        start: 180,
        end: 260,
        zh: "结尾部分在做复盘，帮助你把视频内容沉淀成笔记、文章和脑图。",
        en: "The ending is a recap that helps you turn the video into notes, an article, and a mind map.",
        corrected: "recap",
      },
    ],
    article_pack: {
      article: [
        `本视频围绕“${topic}”展开，先通过真实任务建立学习目标，再逐步推进到概念、流程与复盘。`,
        "从讲解方式看，作者不是只给答案，而是在持续解释每一步为什么成立，这让内容更适合做迁移学习。",
        "如果站在复习视角，最值得二刷的位置是概念首次出现、规则被明确表达，以及案例回到实践建议的几个节点。",
      ],
      notes: [
        `主题：${topic}`,
        "先看背景，再抓核心概念，再记操作路径。",
        "出现专业术语时，优先记录定义、场景、误区三件事。",
        "复盘时用“问题 - 方法 - 依据 - 结果”四列整理最快。",
      ],
      mindmap: [
        topic,
        "├─ 背景与目标",
        "├─ 核心概念与术语",
        "├─ 流程演示与关键步骤",
        "├─ 规则/公式/判断依据",
        "└─ 复盘建议与迁移应用",
      ],
    },
    formula_hint:
      "可重点关注“输入条件 -> 判断规则 -> 输出结果”的规则化表达方式，本段更像规则链而非纯数学推导。",
  };
}

export function getActiveSubtitle(data: VideoLearningAssistantData, currentTime: number) {
  return data.subtitles.find((cue) => currentTime >= cue.start && currentTime < cue.end) || data.subtitles[0];
}

export function getActiveTerm(data: VideoLearningAssistantData, currentTime: number) {
  const sorted = [...data.terms].sort((a, b) => a.time - b.time);
  let active = sorted[0];
  for (const item of sorted) {
    if (currentTime >= item.time) {
      active = item;
    }
  }
  return active;
}

function defaultAnswer(data: VideoLearningAssistantData, currentTime: number) {
  const point = data.timeline.reduce(
    (closest, item) =>
      Math.abs(item.time - currentTime) < Math.abs(closest.time - currentTime) ? item : closest,
    data.timeline[0],
  );
  return `当前大约在 ${formatTimeLabel(currentTime)}，这一段主要在讲“${point.label}”。${point.detail}`;
}

function SectionCard({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-[#e9edf2] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[#f4f8fb] text-[#111827]">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-[#111827]">{title}</div>
          <div className="mt-1 text-xs text-[#6b7280]">{hint}</div>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function VideoLearningAssistantPanel({
  data,
  currentTime,
  isLoading = false,
  askLoading = false,
  onAsk,
}: {
  data: VideoLearningAssistantData;
  currentTime: number;
  isLoading?: boolean;
  askLoading?: boolean;
  onAsk?: (question: string) => Promise<VideoInsightAskResponse | void> | VideoInsightAskResponse | void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerMode, setAnswerMode] = useState<"auto" | "manual">("auto");
  const [materialMode, setMaterialMode] = useState<"notes" | "quiz">("notes");
  const lastDataFileIdRef = useRef<number | null>(null);
  const activeTerm = useMemo(() => getActiveTerm(data, currentTime), [currentTime, data]);

  const isSummaryQuestion = (text: string) =>
    /总结视频|总结这段视频|总结这一段|总结本段|概括视频|概括这段视频/.test(text.replace(/\s+/g, ""));
  const isTimelineQuestion = (text: string) =>
    /知识点时间轴|时间轴|时间线|知识点出现在什么时候|这段的时间轴/.test(text.replace(/\s+/g, ""));
  const isTermQuestion = (text: string) =>
    /术语解释|术语什么意思|这个术语什么意思|专业词什么意思|这个概念什么意思/.test(text.replace(/\s+/g, ""));

  useEffect(() => {
    if (answerMode === "auto") {
      setAnswer(defaultAnswer(data, currentTime));
    }
  }, [answerMode, currentTime, data]);

  useEffect(() => {
    if (lastDataFileIdRef.current === data.file_id) {
      return;
    }
    lastDataFileIdRef.current = data.file_id;
    setQuestion("");
    setAnswerMode("auto");
    setAnswer(defaultAnswer(data, currentTime));
  }, [data]);

  const generatedNotes = data.article_pack.notes;
  const generatedQuiz = [
    "1. 本段视频的核心主题是什么？",
    `2. ${data.timeline[1]?.label || "核心概念"} 主要解决了什么问题？`,
    "3. 作者提到的关键判断规则或公式，应该如何用于实际场景？",
  ];

  async function submitQuestion(text: string) {
    const normalized = text.trim();
    if (!normalized) return;
    setQuestion(normalized);
    setAnswerMode("manual");
    const summaryIntent = isSummaryQuestion(normalized);
    const timelineIntent = isTimelineQuestion(normalized);
    const termIntent = isTermQuestion(normalized);

    if (!onAsk) {
      const fallbackAnswer = summaryIntent
        ? `这段视频主要围绕“${data.topic}”展开，先建立问题背景，再拆解关键概念、方法步骤与判断依据，最后回到案例复盘和迁移应用，适合先抓主线再回看细节。`
        : timelineIntent
          ? `这段视频的知识点时间轴如下：${data.timeline.map((item) => `${formatTimeLabel(item.time)} ${item.label}`).join("；")}。`
          : termIntent
            ? `当前片段里的重点术语是“${activeTerm.term}”${activeTerm.alias ? `（${activeTerm.alias}）` : ""}。${activeTerm.explanation}${activeTerm.background ? ` ${activeTerm.background}` : ""}`
            : defaultAnswer(data, currentTime);
      setAnswer(fallbackAnswer);
      return;
    }

    const result = await onAsk(normalized);
    if (result && "answer" in result && result.answer) {
      setAnswer(result.answer);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-5">
        <SectionCard
          icon={<MessageSquareText className="h-5 w-5" />}
          title="分段问答"
          hint={`当前定位 ${formatTimeLabel(currentTime)}，问题会自动关联到这一片段`}
        >
          {isLoading ? (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-[#edf1f5] bg-[#fafcff] px-4 py-4 text-sm text-[#4b5563]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              正在生成视频理解内容
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {["总结视频", "知识点时间轴", "术语解释", "这段在讲什么", "作者刚才提到的公式是什么", "这个术语什么意思"].map((preset) => (
              <button
                key={preset}
                type="button"
                id={`video-ai-preset-${preset === "总结视频" ? "summary" : preset === "知识点时间轴" ? "timeline" : preset === "术语解释" ? "term-explain" : preset === "这段在讲什么" ? "segment" : preset === "作者刚才提到的公式是什么" ? "formula" : "term"}`}
                onClick={async () => {
                  setQuestion(preset);
                  await submitQuestion(preset);
                }}
                className="rounded-full border border-[#dce4ec] bg-white px-4 py-2 text-sm text-[#334155] transition-colors hover:bg-[#f8fafc]"
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-3">
            <input
              id="video-ai-question-input"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="可以直接输入：总结视频、知识点时间轴、术语解释、这段在讲什么、公式是什么"
              className="min-w-0 flex-1 rounded-full border border-[#dce4ec] bg-[#fbfdff] px-4 py-3 text-sm text-[#111827] outline-none transition-colors focus:border-[#94a3b8]"
            />
            <button
              type="button"
              onClick={() => void submitQuestion(question)}
              className="rounded-full bg-[#111827] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={askLoading}
            >
              {askLoading ? "思考中" : "提问"}
            </button>
          </div>

          <div
            id="video-ai-answer-card"
            className="mt-4 rounded-[24px] border border-[#e7edf3] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a94a3]">
              {isSummaryQuestion(question || answer) ? "视频总结回答" : "回答"}
            </div>
            <p id="video-ai-answer-text" className="mt-2 text-sm leading-7 text-[#334155]">
              {answer}
            </p>
          </div>
        </SectionCard>
      </section>

      <SectionCard
        icon={<BookText className="h-5 w-5" />}
        title="学习产出生成"
        hint="直接生成课堂笔记或随堂测评"
      >
        <div className="flex flex-wrap gap-2">
          {[
            { key: "notes", label: "一键生成笔记", icon: <Milestone className="h-4 w-4" /> },
            { key: "quiz", label: "生成测评", icon: <BrainCircuit className="h-4 w-4" /> },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setMaterialMode(item.key as "notes" | "quiz")}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
                materialMode === item.key
                  ? "bg-[#111827] text-white"
                  : "border border-[#dce4ec] bg-white text-[#334155] hover:bg-[#f8fafc]"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-[26px] border border-[#edf1f5] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] p-5">
          {materialMode === "notes" ? (
            <div className="space-y-3">
              {generatedNotes.map((item, index) => (
                <p key={`${item}-${index}`} className="whitespace-pre-wrap text-sm leading-8 text-[#334155]">
                  {item}
                </p>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {generatedQuiz.map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-[20px] border border-[#edf1f5] bg-[#fafcff] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a94a3]">
                    测评 {index + 1}
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[#334155]">{item}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
