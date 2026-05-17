import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  History,
  Maximize2,
  Mic,
  MoreVertical,
  Paperclip,
  Plus,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { cn } from "../lib/utils";
import { studentApi, type ChatResponse } from "../lib/studentApi";

const DEFAULT_USER_ID = 1001;
const DEFAULT_COURSE_ID = 101;

type Message = {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: string;
  trace?: string[];
  profileSummary?: string | null;
};

function getCourseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get("courseId") || DEFAULT_COURSE_ID);
}

function getTimeLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildAssistantMessage(response: ChatResponse): Message {
  return {
    id: `${Date.now()}-assistant`,
    role: "assistant",
    content: response.answer,
    timestamp: getTimeLabel(),
    trace: response.agent_trace,
    profileSummary: response.profile?.summary || null,
  };
}

function buildWelcomeMessage(content: string): Message {
  return {
    id: `welcome-${Date.now()}`,
    role: "assistant",
    content,
    timestamp: getTimeLabel(),
  };
}

export function AITutor() {
  const courseId = useMemo(() => getCourseIdFromUrl(), []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      buildWelcomeMessage("你可以直接问我这门课该怎么学、资料先看哪条、题目为什么不会，或者让我要点式帮你梳理。"),
    ]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending) {
      return;
    }

    const userMsg: Message = {
      id: `${Date.now()}-user`,
      role: "user",
      content: trimmed,
      timestamp: getTimeLabel(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const response = await studentApi.chat({
        user_id: DEFAULT_USER_ID,
        course_id: courseId,
        session_id: activeSessionId || undefined,
        message: trimmed,
        scene: "study_assistant",
      });
      if (response.session_id) {
        setActiveSessionId(response.session_id);
      }
      setMessages((prev) => [...prev, buildAssistantMessage(response)]);
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "AI 辅导请求失败";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          content: `AI 辅导请求失败：${message}`,
          timestamp: getTimeLabel(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function resetConversation() {
    setActiveSessionId(null);
    setError(null);
    setMessages([buildWelcomeMessage("对话已重置，可以重新问一个新的学习问题。")]);
  }

  const recentThreads = messages
    .filter((item) => item.role === "user")
    .slice(-4)
    .reverse()
    .map((item, index) => ({
      id: `${item.id}-${index}`,
      title: item.content.slice(0, 36),
      time: item.timestamp,
      active: index === 0,
    }));

  return (
    <div className="flex h-[calc(100vh-160px)] gap-8 pb-4">
      <section className="flex flex-1 flex-col overflow-hidden rounded-[32px] border border-outline-variant bg-white shadow-xl">
        <div className="sticky top-0 z-10 border-b border-outline-variant/30 bg-white/80 px-8 py-6 backdrop-blur-md">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                <Sparkles className="h-6 w-6 animate-pulse" />
                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-4 border-white bg-secondary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-on-surface">AI 学习助教</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-secondary">实时会话</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-surface-variant/25 px-4 py-3 text-sm text-on-surface-variant">
                不知道问什么时，可以直接发：
                <span className="ml-1 font-semibold text-on-surface">“这章我先学什么？”</span>
              </div>
              <button className="flex h-10 w-10 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-low">
                <Maximize2 className="h-5 w-5" />
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-low">
                <MoreVertical className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-10 overflow-y-auto p-12">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex max-w-4xl gap-6", msg.role === "user" ? "ml-auto flex-row-reverse" : "")}>
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md",
                  msg.role === "assistant" ? "bg-primary text-white" : "bg-on-surface text-white",
                )}
              >
                {msg.role === "assistant" ? <Bot className="h-6 w-6" /> : <User className="h-6 w-6" />}
              </div>
              <div className={cn("space-y-2", msg.role === "user" ? "text-right" : "")}>
                <div
                  className={cn(
                    "rounded-3xl p-6 text-base leading-relaxed shadow-sm",
                    msg.role === "assistant"
                      ? "rounded-tl-none border border-outline-variant/30 bg-surface-container-low text-on-surface"
                      : "rounded-tr-none bg-primary font-medium text-white",
                  )}
                >
                  {msg.content}
                </div>
                {msg.role === "assistant" && (msg.trace?.length || msg.profileSummary) ? (
                  <div className="rounded-2xl bg-surface-variant/25 px-4 py-3 text-left text-xs text-on-surface-variant">
                    {msg.trace?.length ? <div>回答依据：{msg.trace.join(" -> ")}</div> : null}
                    {msg.profileSummary ? <div className="mt-1">参考画像：{msg.profileSummary}</div> : null}
                  </div>
                ) : null}
                <span className="px-2 text-[10px] font-bold uppercase tracking-widest text-outline-variant">{msg.timestamp}</span>
              </div>
            </div>
          ))}
          {sending ? (
            <div className="flex max-w-4xl gap-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-md">
                <Bot className="h-6 w-6" />
              </div>
              <div className="rounded-3xl rounded-tl-none border border-outline-variant/30 bg-surface-container-low p-6 text-base text-on-surface">
                正在整理你的问题并准备更适合当前课程的回答...
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-outline-variant/30 bg-surface-container-low p-8">
          {error ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div> : null}
          <div className="group flex items-center rounded-2xl border border-outline-variant/50 bg-white p-2 shadow-xl transition-all focus-within:border-primary">
            <button className="flex h-12 w-12 items-center justify-center rounded-xl text-on-surface-variant transition-all hover:bg-primary/5 hover:text-primary">
              <Paperclip className="h-6 w-6" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleSend();
                }
              }}
              className="flex-1 px-4 py-3 text-base outline-none placeholder:text-on-surface-variant/40"
              placeholder="直接输入你的问题，例如：这节课我该先看笔记还是先做题？"
              type="text"
            />
            <div className="flex items-center gap-1">
              <button className="flex h-12 w-12 items-center justify-center text-on-surface-variant transition-all hover:text-secondary">
                <Mic className="h-6 w-6" />
              </button>
              <button
                onClick={() => void handleSend()}
                disabled={sending}
                className="ml-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-70"
              >
                <ArrowRight className="h-6 w-6" />
              </button>
            </div>
          </div>
          <p className="mt-4 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-on-surface-variant opacity-40">
            如果你卡住了，先把“我现在卡在哪里”发出来，AI 会更容易给到可执行建议
          </p>
        </div>
      </section>

      <aside className="flex w-80 flex-col gap-6">
        <div className="flex flex-1 flex-col rounded-[32px] border border-outline-variant bg-white p-6 shadow-sm">
          <div className="mb-8 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-black text-on-surface">
              <History className="h-4 w-4 text-primary" />
              最近问过的问题
            </h4>
            <button
              onClick={resetConversation}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <div className="scrollbar-hide flex-grow space-y-2 overflow-y-auto pr-2">
            {(recentThreads.length ? recentThreads : [{ id: "empty", title: "还没有提问", time: "现在", active: true }]).map((chat) => (
              <button
                key={chat.id}
                className={cn(
                  "group w-full rounded-2xl p-4 text-left transition-all",
                  chat.active ? "border border-primary/20 bg-primary/5" : "hover:bg-surface-container-low",
                )}
              >
                <div className="mb-1 flex items-start justify-between">
                  <span className={cn("truncate pr-4 text-sm font-bold", chat.active ? "text-primary" : "text-on-surface")}>{chat.title}</span>
                </div>
                <span className="text-[10px] font-bold uppercase text-outline-variant">{chat.time}</span>
              </button>
            ))}
          </div>

          <div className="mt-8 border-t border-outline-variant/30 pt-8">
            <div className="rounded-2xl border border-secondary/10 bg-secondary/5 p-6">
              <div className="mb-4 flex items-center gap-2 text-secondary">
                <Zap className="h-5 w-5 fill-secondary" />
                <h5 className="text-[10px] font-black uppercase tracking-widest">你可以直接让它做这些事</h5>
              </div>
              <p className="mb-4 text-xs font-medium leading-relaxed text-on-surface-variant">
                帮你梳理重点、解释不会的题、推荐资料、规划今天先学什么，或者把一段复杂内容讲简单。
              </p>
              <p className="mb-6 text-[11px] text-on-surface-variant">当前会话 `session_id`：{activeSessionId ?? "尚未返回"}</p>
              <a href={`/evaluation?courseId=${courseId}`} className="block w-full rounded-xl bg-on-surface py-3 text-center text-xs font-bold text-white transition-all hover:shadow-lg">
                去做学习测评
              </a>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
