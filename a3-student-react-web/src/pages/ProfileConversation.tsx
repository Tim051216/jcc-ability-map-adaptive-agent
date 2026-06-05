import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle, LoaderCircle, RefreshCw, Send, Sparkles } from "lucide-react";
import {
  ACTIVE_COURSE_ID,
  ACTIVE_USER_ID,
  buildProfileRoute,
  resolveCourseIdFromSearchParams,
} from "../lib/courseContext";
import {
  studentApi,
  type ProfileConversationFlowResponse,
  type ProfileConversationSessionResponse,
  type ProfileHistoryResponse,
  type StudentProfileDetailResponse,
} from "../lib/studentApi";

function formatDateTime(value?: string | null) {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toHistoryTypeLabel(changeType?: number) {
  if (changeType === 1) return "首次生成";
  if (changeType === 2) return "重新生成";
  if (changeType === 3) return "行为回写";
  return "画像更新";
}

export default function ProfileConversation() {
  const [searchParams] = useSearchParams();
  const courseId = resolveCourseIdFromSearchParams(searchParams, ACTIVE_COURSE_ID);
  const shouldAutoStart = searchParams.get("autostart") === "1";
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [conversationSession, setConversationSession] = useState<ProfileConversationSessionResponse | null>(null);
  const [conversationFlow, setConversationFlow] = useState<ProfileConversationFlowResponse | null>(null);
  const [conversationDraft, setConversationDraft] = useState("");
  const [conversationBusy, setConversationBusy] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [profileBuildBusy, setProfileBuildBusy] = useState(false);
  const [profileDetail, setProfileDetail] = useState<StudentProfileDetailResponse | null>(null);
  const [profileHistory, setProfileHistory] = useState<ProfileHistoryResponse | null>(null);

  const loadProfileMeta = async () => {
    const [detail, history] = await Promise.all([
      studentApi.getProfileDetailOrNull(ACTIVE_USER_ID),
      studentApi.getProfileHistory(ACTIVE_USER_ID, 8),
    ]);
    setProfileDetail(detail);
    setProfileHistory(history);
  };

  useEffect(() => {
    void loadProfileMeta();
  }, [courseId]);

  useEffect(() => {
    viewportRef.current?.scrollTo({
      top: viewportRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [conversationSession, conversationFlow]);

  const handleStartConversation = async () => {
    setConversationBusy(true);
    setConversationError(null);
    try {
      const session = await studentApi.startProfileConversation({
        user_id: ACTIVE_USER_ID,
        session_type: 1,
      });
      setConversationSession(session);
      setConversationFlow(null);
      setConversationDraft("");
    } catch (startError) {
      setConversationError(startError instanceof Error ? startError.message : "画像对话启动失败");
    } finally {
      setConversationBusy(false);
    }
  };

  useEffect(() => {
    if (!shouldAutoStart || conversationSession || conversationBusy) return;
    void handleStartConversation();
  }, [shouldAutoStart, conversationSession, conversationBusy]);

  const handleSendConversationMessage = async () => {
    if (!conversationSession || !conversationDraft.trim() || conversationBusy) return;
    setConversationBusy(true);
    setConversationError(null);
    try {
      const nextFlow = await studentApi.sendProfileConversationMessage({
        session_id: conversationSession.session_id,
        content: conversationDraft.trim(),
      });
      const refreshedSession = await studentApi.getProfileConversationSession(conversationSession.session_id);
      setConversationSession(refreshedSession);
      setConversationFlow(nextFlow);
      setConversationDraft("");
    } catch (sendError) {
      setConversationError(sendError instanceof Error ? sendError.message : "画像对话发送失败");
    } finally {
      setConversationBusy(false);
    }
  };

  const handleCompleteConversation = async () => {
    if (!conversationSession || profileBuildBusy) return;
    setProfileBuildBusy(true);
    setConversationError(null);
    try {
      const builtProfile = await studentApi.completeProfileConversation({
        session_id: conversationSession.session_id,
        force_complete: false,
      });
      setProfileDetail(builtProfile);
      setProfileHistory(await studentApi.getProfileHistory(ACTIVE_USER_ID, 8));
      const refreshedSession = await studentApi.getProfileConversationSession(conversationSession.session_id).catch(() => null);
      setConversationSession(refreshedSession);
    } catch (completeError) {
      setConversationError(completeError instanceof Error ? completeError.message : "画像生成失败");
    } finally {
      setProfileBuildBusy(false);
    }
  };

  const conversationMessages = useMemo(() => conversationSession?.messages || [], [conversationSession]);

  return (
    <div className="space-y-6 select-none">
      <section className="rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#fb7299]">Profile Conversation</p>
            <h1 className="mt-2 text-2xl font-extrabold text-[#171c22]">对话式画像页</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#564145]">
              当前页面直接接后端 `/profile/conversation/*`。开始会话、继续问答、完成画像和回看历史都走真实业务接口。
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to={buildProfileRoute(courseId)}
              className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#171c22] shadow-sm"
            >
              返回画像页
            </Link>
            <button
              type="button"
              onClick={() => void handleStartConversation()}
              disabled={conversationBusy}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#171c22] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {conversationBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              新建会话
            </button>
            <button
              type="button"
              onClick={() => void handleCompleteConversation()}
              disabled={!conversationSession || profileBuildBusy}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#111827] px-4 py-2 text-xs font-bold text-white shadow-[0_12px_24px_rgba(17,24,39,0.14)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {profileBuildBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              完成并生成画像
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Session</p>
              <p className="mt-1 text-lg font-extrabold text-[#171c22]">{conversationSession?.session_id || "未启动"}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Completeness</p>
              <p className="mt-1 text-lg font-extrabold text-[#171c22]">
                {conversationFlow?.completeness ?? conversationSession?.completeness ?? 0}%
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Guide</p>
              <p className="mt-1 text-sm font-bold text-[#171c22]">
                {conversationFlow?.guide_question?.related_dimension || "等待引导问题"}
              </p>
            </div>
          </div>

          {conversationFlow?.guide_question ? (
            <div className="mt-4 rounded-2xl border border-[#fb7299]/20 bg-[#fff7fb] p-4 text-sm text-[#564145]">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#fb7299]">Guide Question</p>
              <p className="mt-2 font-semibold text-[#171c22]">{conversationFlow.guide_question.question}</p>
            </div>
          ) : null}

          {conversationError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {conversationError}
            </div>
          ) : null}

          <div ref={viewportRef} className="mt-5 h-[420px] overflow-y-auto rounded-3xl border border-slate-100 bg-slate-50/60 p-4">
            {conversationMessages.length ? (
              <div className="space-y-4">
                {conversationMessages.map((message) => {
                  const isAssistant = message.role === "assistant";
                  return (
                    <div key={message.message_id} className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                          isAssistant ? "border border-slate-100 bg-white text-[#171c22]" : "bg-[#111827] text-white"
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        <div className={`mt-2 text-[10px] font-semibold ${isAssistant ? "text-slate-400" : "text-white/70"}`}>
                          {formatDateTime(message.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                还没有对话。点击“新建会话”或从画像页入口跳转后自动开始。
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <textarea
              value={conversationDraft}
              onChange={(event) => setConversationDraft(event.target.value)}
              placeholder="例如：我平时更喜欢先看结构化讲解，再做练习；最近卡在需求分析和测试用例设计。"
              className="min-h-[104px] flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#171c22] outline-none placeholder:text-slate-400 focus:border-[#fb7299]"
            />
            <button
              type="button"
              onClick={() => void handleSendConversationMessage()}
              disabled={!conversationSession || !conversationDraft.trim() || conversationBusy}
              className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-2xl bg-[#fb7299] px-4 py-3 text-sm font-bold text-white shadow-[0_14px_28px_rgba(251,114,153,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {conversationBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              发送
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#171c22]">
              <Sparkles className="h-4 w-4 text-[#fb7299]" />
              当前画像详情
            </h3>
            {profileDetail ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Completeness</p>
                    <p className="mt-1 text-lg font-extrabold text-[#171c22]">{profileDetail.completeness}%</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Version</p>
                    <p className="mt-1 text-lg font-extrabold text-[#171c22]">v{profileDetail.version}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-sm leading-6 text-[#564145]">
                  {profileDetail.summary || "暂无画像摘要。"}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                还没有真实画像详情。
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
            <h3 className="text-sm font-extrabold text-[#171c22]">画像历史</h3>
            <div className="mt-4 space-y-3">
              {profileHistory?.history.length ? (
                profileHistory.history.map((item) => (
                  <div key={item.history_id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-extrabold text-[#171c22]">{toHistoryTypeLabel(item.change_type)}</p>
                      <span className="text-[10px] font-bold text-slate-400">v{item.version}</span>
                    </div>
                    <p className="mt-1 text-xs leading-6 text-[#564145]">
                      {item.change_description || "画像发生了一次更新。"}
                    </p>
                    <p className="mt-2 text-[10px] text-slate-400">{formatDateTime(item.created_at)}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  暂无历史记录。
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
