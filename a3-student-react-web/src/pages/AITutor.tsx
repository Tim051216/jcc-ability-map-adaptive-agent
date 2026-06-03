import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronDown, ChevronUp, Clock3, History, LoaderCircle, RefreshCw, Send, Sparkles, UserRound } from "lucide-react";
import {
  studentApi,
  type TutoringAnswerDetail,
  type TutoringHistoryItem,
  type TutoringVideoRecommendation,
} from "../lib/studentApi";

import assetHaibaraAcademic from "../assets/images/haibara_academic_1779716437995.png";
import assetUsagiStudy from "../assets/images/usagi_perfect_1779717893221.png";

type PersonaType = "haibara" | "usagi";

interface ChatMessage {
  sender: "user" | "bot";
  text: string;
  time: string;
  personaUsed?: PersonaType;
  videos?: TutoringVideoRecommendation[];
  referenceSources?: Array<Record<string, unknown>>;
  isStreaming?: boolean;
}

interface TutorTaskState {
  phase: "idle" | "submitting" | "running" | "slow" | "completed";
  startedAt: number | null;
  completedAt: number | null;
  taskId?: string | null;
  stageLabel?: string | null;
}

function upsertHistoryItem(
  items: TutoringHistoryItem[],
  nextItem: TutoringHistoryItem,
): TutoringHistoryItem[] {
  const existingIndex = items.findIndex((item) => item.question.id === nextItem.question.id);
  if (existingIndex === -1) {
    return [nextItem, ...items];
  }

  const cloned = [...items];
  cloned[existingIndex] = {
    ...cloned[existingIndex],
    question: {
      ...cloned[existingIndex].question,
      ...nextItem.question,
    },
    answer: nextItem.answer ?? cloned[existingIndex].answer,
    is_favorited: nextItem.is_favorited ?? cloned[existingIndex].is_favorited,
  };
  return cloned;
}

interface AITutorProps {
  user?: {
    id: string;
    name: string;
    avatar: string;
    loggedIn: boolean;
  };
}

const PERSONA_META: Record<
  PersonaType,
  {
    label: string;
    subtitle: string;
    badge: string;
    avatar: string;
    opening: string;
  }
> = {
  haibara: {
    label: "灰原哀",
    subtitle: "冷静拆解型导师",
    badge: "适合概念辨析、考点梳理、结构化答疑",
    avatar: assetHaibaraAcademic,
    opening: "我是灰原哀。问题直接说，我帮你拆清楚。",
  },
  usagi: {
    label: "乌萨奇",
    subtitle: "陪练鼓励型导师",
    badge: "适合入门提问、复习鼓劲、建立信心",
    avatar: assetUsagiStudy,
    opening: "我是乌萨奇。别紧张，我们一步一步来。",
  },
};

const COURSE_ID_MAP: Record<string, number> = {
  "series-1": 401,
  "series-2": 401,
  "series-3": 401,
  "course-4": 401,
};

const QUICK_PROMPTS = [
  "你好",
  "需求分析和概要设计有什么区别？",
  "软件测试和回归测试有什么区别？",
  "帮我用 3 点解释什么是用例设计",
];

const SLOW_TASK_THRESHOLD_MS = 8000;

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatSegment(seconds?: number) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(1, Math.floor(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function formatHistoryTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseInlineBold(inputText: string) {
  const segments = inputText.split("**");
  return segments.map((seg, idx) => {
    if (idx % 2 === 1) {
      return (
        <strong
          key={idx}
          className="rounded bg-amber-100 px-1 py-0.5 font-black text-slate-950"
        >
          {seg}
        </strong>
      );
    }
    return seg;
  });
}

function buildFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message) {
    return `这次没有顺利拿到真实答复：${message}。你可以再问一次，或者把问题说得更具体一点。`;
  }
  return "这次没有顺利拿到真实答复。你可以再问一次，或者把问题说得更具体一点。";
}

function replaceLatestStreamingMessage(
  items: ChatMessage[],
  updater: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  const next = [...items];
  for (let idx = next.length - 1; idx >= 0; idx -= 1) {
    const item = next[idx];
    if (item?.sender === "bot" && item.isStreaming) {
      next[idx] = updater(item);
      return next;
    }
  }
  return next;
}

function buildStatusCopy(taskState: TutorTaskState, elapsedMs: number) {
  if (taskState.phase === "submitting") {
    return {
      title: "正在提交问题",
      subtitle: "问题已经送进导师工作流，马上开始处理。",
      tone: "pink",
    } as const;
  }

  if (taskState.phase === "running") {
    return {
      title: taskState.stageLabel || "导师正在生成答复",
      subtitle: `正在整理分析与作答，当前已等待 ${formatElapsed(elapsedMs)}。`,
      tone: "sky",
    } as const;
  }

  if (taskState.phase === "slow") {
    return {
      title: taskState.stageLabel || "这题还在认真作答中",
      subtitle: `长任务仍在继续执行，当前已等待 ${formatElapsed(elapsedMs)}。`,
      tone: "amber",
    } as const;
  }

  if (taskState.phase === "completed" && taskState.completedAt && taskState.startedAt) {
    return {
      title: "答复已完成",
      subtitle: `本轮真实答复已返回，总耗时 ${formatElapsed(taskState.completedAt - taskState.startedAt)}。`,
      tone: "emerald",
    } as const;
  }

  return {
    title: "准备就绪",
    subtitle: "可继续当前会话，也可以点左侧历史记录恢复之前的问题。",
    tone: "slate",
  } as const;
}

function createOpeningMessage(persona: PersonaType): ChatMessage {
  return {
    sender: "bot",
    text: PERSONA_META[persona].opening,
    time: "\u521a\u521a",
    personaUsed: persona,
  };
}

function mapHistorySessionToMessages(items: TutoringHistoryItem[], persona: PersonaType): ChatMessage[] {
  if (!items.length) {
    return [createOpeningMessage(persona)];
  }

  const sorted = [...items].sort((left, right) => {
    return new Date(left.question.create_time).getTime() - new Date(right.question.create_time).getTime();
  });

  const messages: ChatMessage[] = [];
  for (const item of sorted) {
    messages.push({
      sender: "user",
      text: item.question.question_text,
      time: formatHistoryTime(item.question.create_time),
    });
    if (item.answer?.answer_text) {
      const historyPersona: PersonaType =
        item.question.persona === "usagi"
          ? "usagi"
          : item.question.persona === "haibara"
            ? "haibara"
            : persona;
      messages.push({
        sender: "bot",
        text: item.answer.answer_text,
        time: formatHistoryTime(item.answer.create_time),
        personaUsed: historyPersona,
        videos: (item.answer.answer_videos || []).filter((video) => video.external_link !== false),
        referenceSources: item.answer.reference_sources || [],
      });
    }
  }

  return messages.length ? messages : [createOpeningMessage(persona)];
}

async function waitForTutoringResult(
  questionId: string,
  onProgress?: (phase: TutorTaskState["phase"], label?: string) => void,
  onTextDelta?: (chunk: string) => void,
  onResourceUpdate?: (payload: Partial<TutoringAnswerDetail>) => void,
): Promise<TutoringAnswerDetail> {
  return new Promise<TutoringAnswerDetail>((resolve, reject) => {
    const socket = new WebSocket(studentApi.getTutoringStreamUrl(questionId));
    let settled = false;
    let completedPayload: TutoringAnswerDetail | null = null;

    const finishResolve = (payload: TutoringAnswerDetail) => {
      if (settled) return;
      settled = true;
      try {
        socket.close();
      } catch {
        // Ignore close failures after completion.
      }
      resolve(payload);
    };

    const finishReject = (error: Error) => {
      if (settled) return;
      settled = true;
      try {
        socket.close();
      } catch {
        // Ignore close failures after errors.
      }
      reject(error);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          chunk_type?: string;
          content?: TutoringAnswerDetail | string;
          metadata?: { label?: string };
        };

        if (payload.chunk_type === "step") {
          onProgress?.("running", payload.metadata?.label || undefined);
          return;
        }

        if (payload.chunk_type === "text_delta") {
          if (typeof payload.content === "string" && payload.content) {
            onTextDelta?.(payload.content);
          }
          return;
        }

        if (payload.chunk_type === "complete") {
          completedPayload = payload.content as TutoringAnswerDetail;
          onProgress?.("completed");
          return;
        }

        if (payload.chunk_type === "resource_update") {
          const nextPatch = payload.content as Partial<TutoringAnswerDetail>;
          if (completedPayload) {
            completedPayload = {
              ...completedPayload,
              ...nextPatch,
              diagrams: nextPatch.diagrams ?? completedPayload.diagrams,
              videos: nextPatch.videos ?? completedPayload.videos,
              reference_sources: nextPatch.reference_sources ?? completedPayload.reference_sources,
              confidence_score: nextPatch.confidence_score ?? completedPayload.confidence_score,
              should_escalate: nextPatch.should_escalate ?? completedPayload.should_escalate,
            };
          }
          onResourceUpdate?.(nextPatch);
          return;
        }

        if (payload.chunk_type === "saved") {
          onProgress?.("completed");
          finishResolve((completedPayload ?? payload.content) as TutoringAnswerDetail);
          return;
        }

        if (payload.chunk_type === "error") {
          finishReject(
            new Error(typeof payload.content === "string" ? payload.content : "AI 导师生成失败"),
          );
        }
      } catch (error) {
        finishReject(error instanceof Error ? error : new Error("AI 导师返回了无法解析的数据"));
      }
    };

    socket.onerror = () => {
      finishReject(new Error("AI 导师流式连接失败"));
    };

    socket.onclose = (event) => {
      if (!settled && !event.wasClean) {
        finishReject(new Error("AI 导师连接被中断"));
      }
    };
  });
}

export default function AITutor({ user }: AITutorProps = {}) {
  const [searchParams] = useSearchParams();
  const initialCourseId = searchParams.get("courseId") || "series-2";
  const initialQuery = searchParams.get("query") || "";

  const [activeCourseId] = useState(initialCourseId);
  const [activePersona, setActivePersona] = useState<PersonaType>("haibara");
  const [tutoringSessionId, setTutoringSessionId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([createOpeningMessage("haibara")]);
  const [inputMessage, setInputMessage] = useState(initialQuery);
  const [isTyping, setIsTyping] = useState(false);
  const [taskState, setTaskState] = useState<TutorTaskState>({
    phase: "idle",
    startedAt: null,
    completedAt: null,
    taskId: null,
  });
  const [elapsedMs, setElapsedMs] = useState(0);
  const [historyItems, setHistoryItems] = useState<TutoringHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingBubbleCreatedAtRef = useRef<number>(0);

  const activePersonaMeta = useMemo(() => PERSONA_META[activePersona], [activePersona]);
  const statusCopy = useMemo(() => buildStatusCopy(taskState, elapsedMs), [taskState, elapsedMs]);
  const numericCourseId = useMemo(() => COURSE_ID_MAP[activeCourseId] ?? 401, [activeCourseId]);

  const sessionGroups = useMemo(() => {
    const grouped = new Map<string, TutoringHistoryItem[]>();
    for (const item of historyItems) {
      const key = item.question.session_id;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(item);
    }
    return Array.from(grouped.entries())
      .map(([sessionId, items]) => {
        const sorted = [...items].sort(
          (left, right) =>
            new Date(right.question.create_time).getTime() - new Date(left.question.create_time).getTime(),
        );
        return {
          sessionId,
          items: sorted,
          latest: sorted[0],
        };
      })
      .sort(
        (left, right) =>
          new Date(right.latest.question.create_time).getTime() -
          new Date(left.latest.question.create_time).getTime(),
      );
  }, [historyItems]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!taskState.startedAt || taskState.phase === "idle" || taskState.phase === "completed") {
      setElapsedMs(0);
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - taskState.startedAt);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [taskState]);

  useEffect(() => {
    if (taskState.phase !== "running") return;
    if (elapsedMs < SLOW_TASK_THRESHOLD_MS) return;
    setTaskState((prev) =>
      prev.phase === "running"
        ? {
            ...prev,
            phase: "slow",
            stageLabel: prev.stageLabel || "正在做更深一层的整理",
          }
        : prev,
    );
  }, [elapsedMs, taskState.phase]);

  const loadHistory = async (preferredSessionId?: string | null) => {
    setHistoryLoading(true);
    try {
      const response = await studentApi.listTutoringHistory({
        course_id: numericCourseId,
        page: 1,
        page_size: 50,
      });
      setHistoryItems(response.items || []);

      const nextSessionId =
        preferredSessionId ||
        selectedSessionId ||
        tutoringSessionId ||
        response.items?.[0]?.question?.session_id ||
        null;

      if (nextSessionId) {
        const sessionItems = response.items.filter((item) => item.question.session_id === nextSessionId);
        if (sessionItems.length) {
          setSelectedSessionId(nextSessionId);
          setTutoringSessionId(nextSessionId);
          setMessages(mapHistorySessionToMessages(sessionItems, activePersona));
          return;
        }
      }

      if (!response.items.length) {
        setMessages([createOpeningMessage(activePersona)]);
      }
    } catch {
      if (!historyItems.length) {
        setMessages([createOpeningMessage(activePersona)]);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [numericCourseId]);

  useEffect(() => {
    if (!selectedSessionId) {
      if (!historyItems.length) {
        setMessages([createOpeningMessage(activePersona)]);
      }
      return;
    }
    const sessionItems = historyItems.filter((item) => item.question.session_id === selectedSessionId);
    if (sessionItems.length) {
      setMessages(mapHistorySessionToMessages(sessionItems, activePersona));
    }
  }, [activePersona]);

  useEffect(() => {
    if (initialQuery.trim()) {
      handleSendPrompt(initialQuery);
    }
  }, []);

  const renderFormattedMessage = (text: string) => {
    const lines = text.split("\n");
    return (
      <div className="space-y-2">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-1.5" />;
          }
          if (trimmed.startsWith("## ")) {
            return (
              <h4 key={idx} className="text-sm font-black text-slate-900">
                {trimmed.slice(3)}
              </h4>
            );
          }
          if (/^\d+\.\s/.test(trimmed)) {
            return (
              <p key={idx} className="text-xs leading-6 text-slate-800">
                {parseInlineBold(trimmed)}
              </p>
            );
          }
          return (
            <p key={idx} className="whitespace-pre-wrap text-xs leading-6 text-slate-800">
              {parseInlineBold(line)}
            </p>
          );
        })}
      </div>
    );
  };

  const renderVideoRecommendations = (videos?: TutoringVideoRecommendation[]) => {
    if (!videos || videos.length === 0) return null;

    return (
      <div className="mt-4 grid gap-3">
        {videos.map((video) => {
          const primarySegment = video.segments?.[0];
          return (
            <a
              key={video.video_id}
              href={video.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl border-2 border-slate-900 bg-white p-3 shadow-[2px_2px_0px_#000] transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-[11px] font-black text-slate-900">{video.title}</div>
                  <div className="text-[11px] font-semibold text-slate-500">
                    {video.source_platform?.toUpperCase() || "视频"}
                    {video.duration ? ` · ${formatDuration(video.duration)}` : ""}
                  </div>
                </div>
                <div className="rounded-full bg-pink-100 px-2 py-1 text-[10px] font-black text-[#fb7299]">
                  推荐
                </div>
              </div>

              {video.recommendation_reason ? (
                <p className="mt-2 text-[11px] leading-5 text-slate-600">{video.recommendation_reason}</p>
              ) : null}

              {primarySegment ? (
                <p className="mt-2 text-[11px] font-semibold text-slate-500">
                  建议看片段：{formatSegment(primarySegment.start_sec)} - {formatSegment(primarySegment.end_sec)}
                </p>
              ) : null}
            </a>
          );
        })}
      </div>
    );
  };

  const renderReferenceSources = (sources?: Array<Record<string, unknown>>) => {
    if (!sources || sources.length === 0) return null;

    return (
      <div className="mt-4 space-y-2">
        <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-sky-700">
          联网来源
        </div>
        <div className="grid gap-2">
          {sources.slice(0, 3).map((source, idx) => {
            const title = String(source.title || source.name || `来源 ${idx + 1}`);
            const url = String(source.url || "");
            const excerpt = String(source.excerpt || "");
            const sourceType = String(source.source_type || "web").toUpperCase();
            return (
              <a
                key={`${title}-${idx}`}
                href={url || undefined}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 shadow-sm transition-colors hover:border-sky-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-black text-slate-900">{title}</div>
                    {excerpt ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{excerpt}</p>
                    ) : null}
                    {url ? <div className="mt-2 truncate text-[10px] font-semibold text-sky-700">{url}</div> : null}
                  </div>
                  <div className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
                    {sourceType}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    );
  };

  async function handleSendPrompt(promptText: string) {
    const cleaned = promptText.trim();
    if (!cleaned || isTyping) return;

    const personaAtSend = activePersona;
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const startedAt = Date.now();
    const replyTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setMessages((prev) => {
      const base =
        !selectedSessionId && prev.length === 1 && prev[0]?.sender === "bot"
          ? []
          : prev;
      return [
        ...base,
        {
          sender: "user",
          text: cleaned,
          time: now,
        },
        {
          sender: "bot",
          text: "",
          time: replyTime,
          personaUsed: personaAtSend,
          videos: [],
          isStreaming: true,
        },
      ];
    });
    streamingBubbleCreatedAtRef.current = Date.now();
    setInputMessage("");

    setIsTyping(true);
    setTaskState({
      phase: "submitting",
      startedAt,
      completedAt: null,
      taskId: null,
      stageLabel: "正在提交问题",
    });
    setElapsedMs(0);

    try {
      const taskResult = await studentApi.submitTutoringQuestion({
        question_text: cleaned,
        course_id: numericCourseId,
        session_id: tutoringSessionId,
        persona: personaAtSend,
      });

      if (taskResult.session_id) {
        setTutoringSessionId(taskResult.session_id);
        setSelectedSessionId(taskResult.session_id);
      }

      setTaskState({
        phase: "running",
        startedAt,
        completedAt: null,
        taskId: taskResult.question_id,
        stageLabel: "问题分析中",
      });

      const answerResult = await waitForTutoringResult(
        taskResult.question_id,
        (phase, label) => {
          setTaskState((prev) => ({
            ...prev,
            phase:
              prev.startedAt && Date.now() - prev.startedAt >= SLOW_TASK_THRESHOLD_MS && phase === "running"
                ? "slow"
                : phase,
            startedAt: prev.startedAt ?? startedAt,
            taskId: taskResult.question_id,
            stageLabel: label ?? prev.stageLabel ?? null,
          }));
        },
        (chunk) => {
          setMessages((prev) =>
            replaceLatestStreamingMessage(prev, (item) => ({
              ...item,
              text: `${item.text}${chunk}`,
            })),
          );
        },
        (resourcePatch) => {
          const nextVideos = (resourcePatch.videos || []).filter((video) => video.external_link !== false);
          setMessages((prev) => {
            const next = [...prev];
            for (let idx = next.length - 1; idx >= 0; idx -= 1) {
              if (next[idx]?.sender === "bot") {
                next[idx] = {
                  ...next[idx],
                  videos: nextVideos,
                  referenceSources: (resourcePatch.reference_sources || []) as Array<Record<string, unknown>>,
                };
                break;
              }
            }
            return next;
          });
          setHistoryItems((prev) =>
            upsertHistoryItem(prev, {
              question: {
                id: taskResult.question_id,
                session_id: taskResult.session_id || tutoringSessionId || selectedSessionId || taskResult.question_id,
                question_text: cleaned,
                persona: personaAtSend,
                course_id: numericCourseId,
                section_id: null,
                question_type: null,
                knowledge_points: null,
                create_time: new Date().toISOString(),
                update_time: new Date().toISOString(),
              },
              answer: {
                id: `${taskResult.question_id}-answer`,
                question_id: taskResult.question_id,
                session_id: taskResult.session_id || tutoringSessionId || selectedSessionId || taskResult.question_id,
                answer_text: "",
                answer_diagrams: resourcePatch.diagrams || [],
                answer_videos: resourcePatch.videos || [],
                reference_sources: resourcePatch.reference_sources || [],
                confidence_score: resourcePatch.confidence_score ?? null,
                generation_time: null,
                create_time: new Date().toISOString(),
                update_time: new Date().toISOString(),
              },
              is_favorited: false,
            }),
          );
        },
      );

      const finalText = answerResult.answer_text || "我整理一下再回答你。";
      const finalVideos = (answerResult.videos || []).filter((video) => video.external_link !== false);
      setMessages((prev) =>
        replaceLatestStreamingMessage(prev, (item) => ({
          ...item,
          text: item.text || finalText,
          videos: finalVideos,
          referenceSources: (answerResult.reference_sources || []) as Array<Record<string, unknown>>,
          isStreaming: false,
        })),
      );

      const completedAt = Date.now();
      const completedIso = new Date(completedAt).toISOString();
      const resolvedSessionId = taskResult.session_id || tutoringSessionId || selectedSessionId || null;

      setHistoryItems((prev) =>
        upsertHistoryItem(prev, {
          question: {
            id: taskResult.question_id,
            session_id: resolvedSessionId || taskResult.question_id,
            question_text: cleaned,
            persona: personaAtSend,
            course_id: numericCourseId,
            section_id: null,
            question_type: answerResult.question_type ?? null,
            knowledge_points: answerResult.knowledge_points ?? null,
            create_time: completedIso,
            update_time: completedIso,
          },
          answer: {
            id: answerResult.answer_id || `${taskResult.question_id}-answer`,
            question_id: taskResult.question_id,
            session_id: resolvedSessionId || taskResult.question_id,
            answer_text: finalText,
            answer_diagrams: answerResult.diagrams || [],
            answer_videos: answerResult.videos || [],
            reference_sources: answerResult.reference_sources || [],
            confidence_score: answerResult.confidence_score ?? null,
            generation_time: answerResult.generation_time ?? null,
            create_time: completedIso,
            update_time: completedIso,
          },
          is_favorited: false,
        }),
      );

      setTaskState({
        phase: "completed",
        startedAt,
        completedAt,
        taskId: taskResult.question_id,
        stageLabel: "答复已完成",
      });

      void loadHistory(taskResult.session_id || tutoringSessionId);
    } catch (error) {
      setTaskState({
        phase: "idle",
        startedAt: null,
        completedAt: null,
        taskId: null,
        stageLabel: null,
      });
      setMessages((prev) =>
        replaceLatestStreamingMessage(prev, (item) => ({
          ...item,
          text: buildFailureMessage(error),
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          personaUsed: personaAtSend,
          videos: [],
          isStreaming: false,
        })),
      );
    } finally {
      setIsTyping(false);
    }
  }

  const handleSelectSession = (sessionId: string) => {
    const sessionItems = historyItems.filter((item) => item.question.session_id === sessionId);
    setSelectedSessionId(sessionId);
    setTutoringSessionId(sessionId);
    setTaskState({
      phase: "idle",
      startedAt: null,
      completedAt: null,
      taskId: null,
      stageLabel: null,
    });
    setMessages(mapHistorySessionToMessages(sessionItems, activePersona));
  };

  const handleStartFresh = () => {
    setSelectedSessionId(null);
    setTutoringSessionId(null);
    setTaskState({
      phase: "idle",
      startedAt: null,
      completedAt: null,
      taskId: null,
      stageLabel: null,
    });
    setMessages([createOpeningMessage(activePersona)]);
  };

  const statusToneClass =
    statusCopy.tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : statusCopy.tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : statusCopy.tone === "sky"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : statusCopy.tone === "pink"
            ? "border-pink-200 bg-pink-50 text-pink-700"
            : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border-4 border-slate-900 bg-white shadow-[6px_6px_0px_#0f172a]">
        <div className="border-b-2 border-slate-100 bg-[linear-gradient(135deg,#fff7ed,#f8fafc_45%,#fdf2f8)] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex rounded-full border-2 border-slate-900 bg-pink-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#fb7299]">
                智能导师答疑中枢
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-slate-900">AI 导师答疑台</h1>
                <p className="max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                  当前优先使用真实后端答复，并保留同一会话的历史记录。刷新页面后，也可以从左侧继续之前的提问。
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => loadHistory()}
                className="inline-flex items-center gap-2 self-start rounded-xl border-2 border-slate-900 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-[2px_2px_0px_#000] transition-transform hover:-translate-y-0.5"
              >
                <RefreshCw className={`h-4 w-4 ${historyLoading ? "animate-spin" : ""}`} />
                刷新记录
              </button>
              <button
                type="button"
                onClick={handleStartFresh}
                className="inline-flex items-center gap-2 self-start rounded-xl border-2 border-slate-900 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-[2px_2px_0px_#000] transition-transform hover:-translate-y-0.5"
              >
                <Sparkles className="h-4 w-4" />
                新开会话
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-r-2 border-slate-100 bg-[#fcfcfd] p-5">
            <div className="space-y-4">
              {(Object.entries(PERSONA_META) as Array<[PersonaType, (typeof PERSONA_META)[PersonaType]]>).map(
                ([personaKey, persona]) => (
                  <button
                    key={personaKey}
                    type="button"
                    onClick={() => setActivePersona(personaKey)}
                    className={`w-full rounded-3xl border-2 p-4 text-left transition-all ${
                      activePersona === personaKey
                        ? "border-slate-900 bg-[linear-gradient(135deg,#fff7ed,#ffffff_45%,#fdf2f8)] shadow-[4px_4px_0px_#000] -translate-y-0.5"
                        : "border-slate-200 bg-white hover:border-slate-400 hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 overflow-hidden rounded-2xl border-2 border-slate-900 bg-slate-100 shadow-[2px_2px_0px_#000]">
                        <img
                          src={persona.avatar}
                          alt={persona.label}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-black text-slate-900">{persona.label}</h2>
                          {activePersona === personaKey ? (
                            <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-black text-[#fb7299]">
                              当前
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs font-bold text-slate-500">{persona.subtitle}</p>
                        <p className="text-[11px] leading-5 text-slate-600">{persona.badge}</p>
                      </div>
                    </div>
                  </button>
                ),
              )}
            </div>

            <div className="mt-6 rounded-3xl border-2 border-slate-900 bg-white p-4 shadow-[3px_3px_0px_#000]">
              <button
                type="button"
                onClick={() => setHistoryCollapsed((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  <History className="h-4 w-4" />
                  历史对话
                  {sessionGroups.length > 0 ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">
                      {sessionGroups.length}
                    </span>
                  ) : null}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-black text-slate-500">
                  {historyCollapsed ? "展开" : "收起"}
                  {historyCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                </div>
              </button>

              {!historyCollapsed ? (
                <div className="mt-3 space-y-3">
                  {historyLoading ? (
                    <div className="text-xs font-semibold text-slate-500">正在加载历史记录...</div>
                  ) : sessionGroups.length === 0 ? (
                    <div className="text-xs font-semibold leading-5 text-slate-500">
                      还没有历史对话。提一个问题后，这里会自动保存。
                    </div>
                  ) : (
                    sessionGroups.map((group) => (
                      <button
                        key={group.sessionId}
                        type="button"
                        onClick={() => handleSelectSession(group.sessionId)}
                        className={`w-full rounded-2xl border-2 p-3 text-left transition-all ${
                          selectedSessionId === group.sessionId
                            ? "border-slate-900 bg-slate-900 text-white shadow-[3px_3px_0px_#000]"
                            : "border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-white"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                              selectedSessionId === group.sessionId
                                ? "bg-white/15 text-white"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {selectedSessionId === group.sessionId ? "当前会话" : "历史会话"}
                          </div>
                          <div
                            className={`text-[10px] font-black ${
                              selectedSessionId === group.sessionId ? "text-slate-300" : "text-slate-400"
                            }`}
                          >
                            {group.items.length} 轮
                          </div>
                        </div>
                        <div className="line-clamp-2 text-xs font-black">
                          {group.latest.question.question_text}
                        </div>
                        <div
                          className={`mt-2 text-[11px] font-semibold ${
                            selectedSessionId === group.sessionId ? "text-slate-300" : "text-slate-500"
                          }`}
                        >
                          {formatHistoryTime(group.latest.question.create_time)}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="mt-3 text-[11px] font-semibold text-slate-500">
                  {historyLoading
                    ? "正在加载历史记录..."
                    : sessionGroups.length > 0
                      ? `已收起 ${sessionGroups.length} 组历史对话`
                      : "还没有历史对话"}
                </div>
              )}
            </div>

          </aside>

          <section className="flex min-h-[720px] flex-col bg-white p-5">
            <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="rounded-[24px] border-2 border-slate-900 bg-[linear-gradient(135deg,#fff8f1,#ffffff_52%,#fdf2f8)] px-4 py-4 shadow-[3px_3px_0px_#000]">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">会话摘要</div>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-2xl border-2 border-slate-900 bg-slate-100">
                        <img
                          src={activePersonaMeta.avatar}
                          alt={activePersonaMeta.label}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-base font-black text-slate-900">{activePersonaMeta.label}</div>
                        <div className="text-[11px] font-bold text-slate-500">{activePersonaMeta.subtitle}</div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-full bg-pink-100 px-3 py-1 text-[11px] font-black text-[#fb7299]">
                    {selectedSessionId ? "已接续历史会话" : "新会话待开始"}
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">答疑模式</div>
                    <div className="mt-1 text-xs font-bold text-slate-700">真实后端答复优先</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">历史状态</div>
                    <div className="mt-1 text-xs font-bold text-slate-700">
                      {sessionGroups.length > 0 ? `已累计 ${sessionGroups.length} 组对话` : "暂无历史会话"}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${taskState.phase === "idle" || taskState.phase === "completed" ? "rounded-[24px] border px-4 py-4" : "hidden"} ${statusToneClass}`}>
                <div className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] opacity-70">运行状态</div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {taskState.phase === "completed" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : taskState.phase === "running" || taskState.phase === "submitting" ? (
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                    ) : taskState.phase === "slow" ? (
                      <Clock3 className="h-5 w-5" />
                    ) : (
                      <Sparkles className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black">{statusCopy.title}</div>
                    <div className="mt-1 text-xs font-semibold leading-5">{statusCopy.subtitle}</div>
                    {taskState.taskId ? (
                      <div className="mt-2 text-[11px] font-bold opacity-70">任务 ID：{taskState.taskId}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className={`mb-4 hidden rounded-2xl border px-4 py-3 ${statusToneClass}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {taskState.phase === "completed" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : taskState.phase === "running" || taskState.phase === "submitting" ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : taskState.phase === "slow" ? (
                    <Clock3 className="h-5 w-5" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black">{statusCopy.title}</div>
                  <div className="mt-1 text-xs font-semibold leading-5">{statusCopy.subtitle}</div>
                  {taskState.taskId ? (
                    <div className="mt-2 text-[11px] font-bold opacity-70">任务 ID：{taskState.taskId}</div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">快速开始</div>
              <div className="mt-2 text-xs font-semibold text-slate-500">
                不知道怎么开口时，可以直接点一个常见问题。
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSendPrompt(prompt)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 transition-colors hover:border-[#fb7299] hover:text-[#fb7299]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto pr-1">
              {messages.map((msg, idx) => {
                if (msg.sender === "user") {
                  const userInitial = (user?.name || "同学").trim().charAt(0) || "我";
                  return (
                    <div key={idx} className="flex justify-end gap-3">
                      <div className="max-w-[82%]">
                        <div className="mb-1 flex items-center justify-end gap-2 text-right text-[11px] font-black text-slate-400">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">我的提问</span>
                          <span>{user?.name || "同学"}</span>
                        </div>
                        <div className="rounded-[26px] rounded-tr-md border-2 border-slate-900 bg-[linear-gradient(135deg,#0f172a,#1e293b)] px-4 py-3 text-sm font-bold text-white shadow-[3px_3px_0px_#000]">
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                          <div className="mt-2 text-right text-[10px] font-semibold text-slate-400">{msg.time}</div>
                        </div>
                      </div>
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl border-2 border-slate-900 bg-[linear-gradient(135deg,#fda4af,#fb7185)] shadow-[2px_2px_0px_#000]">
                        {user?.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user?.name || "当前学生"}
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#ffe4e6,#fb7185)] text-white">
                            <UserRound className="h-4 w-4" strokeWidth={2.4} />
                            <span className="mt-0.5 text-[10px] font-black leading-none">{userInitial}</span>
                          </div>
                        )}
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border border-slate-900 bg-emerald-400" />
                      </div>
                    </div>
                  );
                }

                const personaLabel = PERSONA_META[msg.personaUsed || activePersona]?.label || "AI 导师";
                const isThinkingBubble = Boolean(msg.isStreaming && !msg.text.trim());
                const bubbleShellClass = isThinkingBubble
                  ? "inline-flex min-h-[54px] items-center gap-3 rounded-[26px] rounded-tl-md border-2 border-slate-900 bg-[linear-gradient(135deg,#fffdfd,#f3f8ff)] px-4 py-3 shadow-[3px_3px_0px_#000] transition-all duration-300 ease-out"
                  : "block min-h-[54px] rounded-[26px] rounded-tl-md border-2 border-slate-900 bg-[linear-gradient(135deg,#fefefe,#eef8ff)] px-4 py-3 shadow-[3px_3px_0px_#000] transition-all duration-300 ease-out";
                return (
                  <div key={idx} className="flex gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-2xl border-2 border-slate-900 bg-slate-100 shadow-[2px_2px_0px_#000]">
                      <img
                        src={PERSONA_META[msg.personaUsed || activePersona]?.avatar || activePersonaMeta.avatar}
                        alt={personaLabel}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0 max-w-[88%] flex-1">
                      <div className="mb-1 flex items-center gap-2 text-[11px] font-black text-slate-400">
                        {isThinkingBubble ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[#fb7299]" />
                        ) : (
                          <Clock3 className="h-3.5 w-3.5 text-[#fb7299]" />
                        )}
                        <span>{msg.time}</span>
                        <span>·</span>
                        <span>{personaLabel}</span>
                      </div>
                      <div className={bubbleShellClass}>
                        {isThinkingBubble ? (
                          <>
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-black text-slate-500 shadow-sm">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#fb7299]" />
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#fb7299] [animation-delay:120ms]" />
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#fb7299] [animation-delay:240ms]" />
                            </span>
                            <span className="text-sm font-semibold text-slate-500">正在思考回答...</span>
                          </>
                        ) : (
                          <>
                            {renderFormattedMessage(msg.text)}
                            {renderVideoRecommendations(msg.videos)}
                            {renderReferenceSources(msg.referenceSources)}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isTyping && !(messages[messages.length - 1]?.sender === "bot" && messages[messages.length - 1]?.isStreaming) ? (
                <div className="flex gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-2xl border-2 border-slate-900 bg-slate-100 shadow-[2px_2px_0px_#000]">
                    <img
                      src={activePersonaMeta.avatar}
                      alt={activePersonaMeta.label}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0 max-w-[88%] flex-1">
                    <div className="mb-1 flex items-center gap-2 text-[11px] font-black text-slate-400">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[#fb7299]" />
                      <span>{activePersonaMeta.label}</span>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-[26px] rounded-tl-md border-2 border-slate-900 bg-[linear-gradient(135deg,#fefefe,#eef8ff)] px-4 py-3 shadow-[3px_3px_0px_#000]">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[#fb7299]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[#fb7299] [animation-delay:120ms]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[#fb7299] [animation-delay:240ms]" />
                    </div>
                  </div>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendPrompt(inputMessage);
              }}
              className="mt-5 flex items-stretch gap-3 border-t-2 border-slate-100 pt-5"
            >
              <input
                id="ai-tutor-message-field"
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="继续当前会话提问，比如：需求分析和概要设计有什么区别？"
                className="h-12 flex-1 rounded-2xl border-2 border-slate-900 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none transition-colors focus:border-[#fb7299] focus:bg-white"
              />
              <button
                id="ai-chat-send-btn"
                type="submit"
                disabled={isTyping}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-slate-900 bg-[#fb7299] px-5 text-sm font-black text-white shadow-[2px_2px_0px_#000] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
              >
                <Send className="h-4 w-4" />
                发送问题
              </button>
            </form>
          </section>
        </div>
      </section>
    </div>
  );
}
