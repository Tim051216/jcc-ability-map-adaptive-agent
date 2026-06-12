import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Bot, ChevronRight, MessageCircleMore, Search, Send, Sparkles, UserRound, Users } from "lucide-react";
import { INBOX_UPDATED_EVENT, listInboxItems, markInboxItemRead, type InboxItem } from "../lib/inbox";
import { studentApi, type ImMessageResponse, type ImSessionSummaryResponse, type ProfileSummaryResponse } from "../lib/studentApi";
import { getDemoUserProfile } from "../lib/userProfiles";

interface IMCenterProps {
  user: {
    id: string;
    name: string;
    avatar: string;
    loggedIn: boolean;
  };
}

const FILTERS = [
  { key: "all", label: "全部会话" },
  { key: "unread", label: "未读" },
  { key: "group", label: "课程群" },
  { key: "direct", label: "私聊" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function formatPushTime(value?: string) {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatActiveTime(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getConversationMeta(conversation: ImSessionSummaryResponse) {
  if (conversation.conversation_type === "group") {
    return {
      icon: Users,
      iconClassName: "bg-[#fff1f6] text-[#fb7299]",
      badgeClassName: "bg-[#fff1f6] text-[#fb7299]",
    };
  }
  if (conversation.conversation_type === "system") {
    return {
      icon: Bot,
      iconClassName: "bg-[#eef7ff] text-[#0b5f85]",
      badgeClassName: "bg-[#eef7ff] text-[#0b5f85]",
    };
  }
  return {
    icon: UserRound,
    iconClassName: "bg-[#f4f7fb] text-[#475569]",
    badgeClassName: "bg-[#f4f7fb] text-[#475569]",
  };
}

function buildQuickPrompts(conversation: ImSessionSummaryResponse | null) {
  if (!conversation) {
    return ["今晚我先看哪一部分最有效？", "帮我同步一下这周作业重点", "我现在卡在这里，谁可以继续跟我讲一下？"];
  }
  if (conversation.conversation_type === "group") {
    return ["同步一下本周课堂重点", "这节课接下来最该做什么", "帮我对齐一下群里现在的共识"];
  }
  if (conversation.conversation_type === "system") {
    return ["现在要不要联网补资料", "按当前上下文继续生成讲义", "帮我判断下一步该调用哪个能力"];
  }
  return ["我卡在这里了，能继续讲吗？", "这块能帮我再说简单一点吗？", "结合我的当前进度给我下一步建议"];
}

function sortSessionsByLatest(items: ImSessionSummaryResponse[]) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.latest_message_at || 0).getTime();
    const rightTime = new Date(right.latest_message_at || 0).getTime();
    return rightTime - leftTime;
  });
}

export default function IMCenter({ user }: IMCenterProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [sessions, setSessions] = useState<ImSessionSummaryResponse[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [activeMessages, setActiveMessages] = useState<ImMessageResponse[]>([]);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [profileSummary, setProfileSummary] = useState<ProfileSummaryResponse | null>(null);
  const [imLoading, setImLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function syncSessions() {
      setImLoading(true);
      try {
        const response = await studentApi.listImSessions();
        if (!cancelled) {
          setSessions(response.items || []);
          setActiveConversationId((current) => current || response.items?.[0]?.session_id?.toString() || "");
        }
      } catch {
        if (!cancelled) {
          setSessions([]);
        }
      } finally {
        if (!cancelled) {
          setImLoading(false);
        }
      }
    }
    void syncSessions();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  useEffect(() => {
    if (!activeConversationId) return;
    let cancelled = false;
    async function syncMessages() {
      try {
        const response = await studentApi.listImMessages(Number(activeConversationId));
        if (!cancelled) {
          setActiveMessages(response.items || []);
          setSessions((current) =>
            current.map((item) =>
              String(item.session_id) === activeConversationId && item.unread_count > 0 ? { ...item, unread_count: 0 } : item,
            ),
          );
        }
      } catch {
        if (!cancelled) {
          setActiveMessages([]);
        }
      }
    }
    void syncMessages();
    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  useEffect(() => {
    let cancelled = false;

    async function syncInbox() {
      setInboxLoading(true);
      try {
        const nextItems = await listInboxItems(user.id, { pageNo: 1, pageSize: 20 });
        if (!cancelled) {
          setInboxItems(nextItems);
        }
      } catch {
        if (!cancelled) {
          setInboxItems([]);
        }
      } finally {
        if (!cancelled) {
          setInboxLoading(false);
        }
      }
    }

    syncInbox();
    window.addEventListener(INBOX_UPDATED_EVENT, syncInbox);
    return () => {
      cancelled = true;
      window.removeEventListener(INBOX_UPDATED_EVENT, syncInbox);
    };
  }, [user.id]);

  useEffect(() => {
    let cancelled = false;
    const numericUserId = Number(user.id);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
      setProfileSummary(null);
      return;
    }

    async function syncProfileSummary() {
      try {
        const summary = await studentApi.getProfileSummary(numericUserId);
        if (!cancelled) {
          setProfileSummary(summary);
        }
      } catch {
        if (!cancelled) {
          setProfileSummary(null);
        }
      }
    }

    void syncProfileSummary();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const filteredConversations = useMemo(() => {
    return sessions.filter((conversation) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "unread"
            ? conversation.unread_count > 0
            : filter === "group"
              ? conversation.conversation_type === "group"
              : conversation.conversation_type !== "group";
      const matchesSearch =
        !searchQuery.trim() ||
        `${conversation.title} ${conversation.subtitle || ""}`.toLowerCase().includes(searchQuery.trim().toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [filter, sessions, searchQuery]);

  const groupedConversations = useMemo(
    () => [
      {
        key: "group",
        label: "课程群",
        items: filteredConversations.filter((item) => item.conversation_type === "group"),
      },
      {
        key: "direct",
        label: "私聊",
        items: filteredConversations.filter((item) => item.conversation_type === "direct"),
      },
      {
        key: "system",
        label: "系统协同",
        items: filteredConversations.filter((item) => item.conversation_type === "system"),
      },
    ].filter((group) => group.items.length > 0),
    [filteredConversations],
  );

  useEffect(() => {
    if (filteredConversations.length && !filteredConversations.some((item) => String(item.session_id) === activeConversationId)) {
      setActiveConversationId(String(filteredConversations[0].session_id));
    }
  }, [activeConversationId, filteredConversations]);

  const activeConversation =
    sessions.find((item) => String(item.session_id) === activeConversationId) || filteredConversations[0] || null;

  const totalUnread = useMemo(
    () => sessions.reduce((sum, conversation) => sum + conversation.unread_count, 0) + inboxItems.filter((item) => !item.isRead).length,
    [sessions, inboxItems],
  );

  const profileTagline = profileSummary?.tags?.length
    ? profileSummary.tags.slice(0, 3).join(" / ")
    : profileSummary?.recommended_learning_style || "当前账号已接入";
  const quickPrompts = useMemo(() => buildQuickPrompts(activeConversation), [activeConversation]);

  const handleSend = async () => {
    if (!activeConversation || !messageDraft.trim()) return;
    setSending(true);
    try {
      const sent = await studentApi.sendImMessage(Number(activeConversation.session_id), { content: messageDraft.trim() });
      setActiveMessages((current) => [...current, sent]);
      setSessions((current) =>
        sortSessionsByLatest(
          current.map((item) =>
            item.session_id === activeConversation.session_id
              ? {
                  ...item,
                  latest_message: sent.content,
                  latest_message_at: sent.created_at || new Date().toISOString(),
                  unread_count: 0,
                }
              : item,
          ),
        ),
      );
      setMessageDraft("");
    } finally {
      setSending(false);
    }
  };

  const activeConversationMeta = activeConversation ? getConversationMeta(activeConversation) : null;
  const activePeerProfile =
    activeConversation?.conversation_type === "direct" ? getDemoUserProfile(activeConversation.peer_user_id || activeConversation.session_id) : null;

  return (
    <div className="space-y-5" id="im-center-workspace">
      <section className="rounded-[28px] border border-[#E3E8EC] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff4f8] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#fb7299]">
              <Sparkles className="h-3.5 w-3.5" />
              Message Center
            </div>
            <h1 className="mt-3 text-2xl font-extrabold text-[#171c22]">课程沟通和站内提醒放在一起处理</h1>
            <p className="mt-2 text-sm leading-7 text-[#564145]">复习提醒先用站内通知承接，课程群和私聊继续保留在这个消息中心里。</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px]">
            <div className="rounded-2xl border border-[#edf1f5] bg-[#fff8fb] px-4 py-3">
              <div className="text-[10px] font-black tracking-[0.18em] text-[#8a94a3]">未读消息</div>
              <div className="mt-2 text-lg font-extrabold text-[#171c22]">{totalUnread}</div>
            </div>
            <div className="rounded-2xl border border-[#edf1f5] bg-[#fff8fb] px-4 py-3">
              <div className="text-[10px] font-black tracking-[0.18em] text-[#8a94a3]">站内提醒</div>
              <div className="mt-2 text-lg font-extrabold text-[#171c22]">{inboxItems.length}</div>
            </div>
            <div className="rounded-2xl border border-[#edf1f5] bg-[#fff8fb] px-4 py-3">
              <div className="text-[10px] font-black tracking-[0.18em] text-[#8a94a3]">当前账号</div>
              <div className="mt-2 flex items-center gap-3">
                {user.avatar ? <img src={user.avatar} alt={user.name} className="h-9 w-9 rounded-full object-cover ring-1 ring-[#f3d9e3]" /> : null}
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold text-[#171c22]">{user.name}</div>
                  <div className="mt-0.5 truncate text-[11px] font-semibold text-[#8a94a3]">{profileTagline}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 2xl:grid-cols-[320px_minmax(0,1fr)_360px] xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border border-[#E3E8EC] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a94a3]" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索会话、课程、联系人"
              className="w-full rounded-2xl border border-[#edf1f5] bg-[#fafbfd] py-3 pl-10 pr-4 text-sm text-[#171c22] outline-none transition focus:border-[#fb7299]"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                  filter === item.key ? "bg-[#fb7299] text-white shadow-sm" : "border border-[#edf1f5] bg-white text-[#564145] hover:bg-[#fff4f8]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-4">
            {groupedConversations.map((group) => (
              <div key={group.key}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="text-[11px] font-black tracking-[0.16em] text-[#8a94a3]">{group.label}</div>
                  <div className="text-[11px] font-bold text-[#98A2B3]">{group.items.length}</div>
                </div>
                <div className="space-y-3">
                  {group.items.map((conversation) => {
                    const meta = getConversationMeta(conversation);
                    const Icon = meta.icon;
                    const isActive = String(conversation.session_id) === activeConversationId;
                    const peerProfile =
                      conversation.conversation_type === "direct"
                        ? getDemoUserProfile(conversation.peer_user_id || conversation.session_id)
                        : null;
                    return (
                      <button
                        key={conversation.session_id}
                        type="button"
                        onClick={() => setActiveConversationId(String(conversation.session_id))}
                        className={`w-full rounded-[22px] border px-4 py-3 text-left transition-all ${
                          isActive
                            ? "border-[#fb7299]/30 bg-[#fff7fa] shadow-[0_12px_24px_rgba(251,114,153,0.08)]"
                            : "border-[#edf1f5] bg-white hover:border-[#fb7299]/20 hover:bg-[#fffafb]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            {peerProfile?.avatar ? (
                              <img src={peerProfile.avatar} alt={peerProfile.name} className="h-10 w-10 rounded-2xl object-cover ring-1 ring-[#f3d9e3]" />
                            ) : (
                              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${meta.iconClassName}`}>
                                <Icon className="h-4.5 w-4.5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="truncate text-sm font-extrabold text-[#171c22]">{conversation.title}</div>
                                {conversation.badge_label ? (
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${meta.badgeClassName}`}>{conversation.badge_label}</span>
                                ) : null}
                              </div>
                              <div className="mt-1 text-[11px] font-bold text-[#8a94a3]">
                                {conversation.participant_label || conversation.subtitle || "站内私聊"}
                                {conversation.member_count ? ` · ${conversation.member_count}人` : ""}
                              </div>
                              <div className="mt-2 line-clamp-2 text-xs leading-5 text-[#5b6574]">{conversation.latest_message || "还没有消息"}</div>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-[10px] font-bold text-[#98A2B3]">{formatActiveTime(conversation.latest_message_at)}</div>
                            {conversation.unread_count > 0 ? (
                              <div className="mt-2 inline-flex min-w-5 items-center justify-center rounded-full bg-[#fb7299] px-1.5 py-0.5 text-[10px] font-black text-white">
                                {conversation.unread_count}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded-[28px] border border-[#E3E8EC] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          {activeConversation ? (
            <>
              <div className="flex flex-col gap-3 border-b border-[#edf1f5] pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    {activePeerProfile?.avatar ? (
                      <img src={activePeerProfile.avatar} alt={activePeerProfile.name} className="h-11 w-11 rounded-2xl object-cover ring-1 ring-[#f3d9e3]" />
                    ) : activeConversationMeta ? (
                      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${activeConversationMeta.iconClassName}`}>
                        <activeConversationMeta.icon className="h-5 w-5" />
                      </div>
                    ) : null}
                    <h2 className="text-lg font-extrabold text-[#171c22]">{activeConversation.title}</h2>
                  </div>
                  <p className="mt-1 text-sm text-[#5b6574]">
                    {activeConversation.participant_label || activeConversation.subtitle || "站内私聊"}
                    {activeConversation.member_count ? ` · ${activeConversation.member_count}人` : ""}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-[#8a94a3]">
                    当前登录用户：{user.name}{profileSummary?.current_stage ? ` · ${profileSummary.current_stage}` : ""} · 最近活跃 {formatActiveTime(activeConversation.latest_message_at)}
                  </p>
                </div>
                <div className="rounded-full border border-[#edf1f5] bg-white px-3 py-1.5 text-xs font-bold text-[#564145]">
                  {activeConversation.badge_label || "真实会话"}
                </div>
              </div>

              <div className="mt-4 max-h-[520px] space-y-4 overflow-y-auto pr-1">
                {activeMessages.map((message) => (
                  <div key={message.message_id} className={message.role === `user:${user.id}` ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={`max-w-[86%] rounded-[22px] px-4 py-3 ${
                        message.role === `user:${user.id}` ? "bg-[#171c22] text-white" : "border border-[#edf1f5] bg-[#fafbfd] text-[#171c22]"
                      }`}
                    >
                      <div className="text-[11px] font-black opacity-75">{message.role === `user:${user.id}` ? user.name : activeConversation.title}</div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                      <div className="mt-2 text-[10px] opacity-70">{message.created_at || "--"}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[24px] border border-[#edf1f5] bg-[#fffafc] p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setMessageDraft(prompt)}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#564145] shadow-sm ring-1 ring-[#edf1f5]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <textarea
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    rows={3}
                    placeholder="输入你想发给这位站内用户的消息"
                    className="min-h-[92px] flex-1 rounded-[22px] border border-[#edf1f5] bg-white px-4 py-3 text-sm text-[#171c22] outline-none transition focus:border-[#fb7299]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sending}
                    className="inline-flex h-[92px] shrink-0 items-center gap-2 rounded-[22px] bg-[#fb7299] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(251,114,153,0.24)]"
                  >
                    <Send className="h-4 w-4" />
                    {sending ? "发送中" : "发送"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-[#edf1f5] bg-[#fafbfd] text-sm font-semibold text-[#8a94a3]">
              {imLoading ? "正在加载会话" : "还没有匹配到会话"}
            </div>
          )}
        </section>

        <aside className="rounded-[28px] border border-[#E3E8EC] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] xl:col-span-2 2xl:col-span-1">
          <div className="flex items-start justify-between gap-3 border-b border-[#edf1f5] pb-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF4F8] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#fb7299]">
                <Bell className="h-3.5 w-3.5" />
                Inbox
              </div>
              <h2 className="mt-3 text-lg font-extrabold text-[#171c22]">系统通知</h2>
              <p className="mt-1 text-sm leading-6 text-[#667085]">复习提醒先从这里触达，后面再接更多推送通道。</p>
            </div>
            <div className="rounded-2xl bg-[#FFF8FB] px-3 py-2 text-right">
              <div className="text-[10px] font-black tracking-[0.18em] text-[#98A2B3]">未读</div>
              <div className="mt-1 text-lg font-extrabold text-[#171c22]">{inboxItems.filter((item) => !item.isRead).length}</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {inboxLoading ? (
              <div className="rounded-[22px] border border-dashed border-[#edf1f5] bg-[#fafbfd] px-4 py-8 text-center text-sm text-[#98A2B3]">
                正在拉取站内提醒...
              </div>
            ) : inboxItems.length > 0 ? (
              inboxItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={async () => {
                    if (item.isRead) return;
                    try {
                      await markInboxItemRead(user.id, item.id);
                      setInboxItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
                    } catch {
                      // Keep the current UI state when marking as read fails.
                    }
                  }}
                  className={`w-full rounded-[22px] border px-4 py-4 text-left transition-all ${
                    item.isRead ? "border-[#edf1f5] bg-white" : "border-[#fb7299]/20 bg-[#fff7fa] shadow-[0_10px_24px_rgba(251,114,153,0.06)]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 h-2.5 w-2.5 rounded-full ${item.isRead ? "bg-[#D0D5DD]" : "bg-[#fb7299]"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-extrabold text-[#171c22]">{item.title}</div>
                        <div className="shrink-0 text-[11px] font-semibold text-[#98A2B3]">{formatPushTime(item.pushTime)}</div>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[#5b6574]">{item.content}</div>
                      {!item.isRead ? <div className="mt-3 text-[11px] font-bold text-[#fb7299]">点击后标记为已读</div> : null}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-[#edf1f5] bg-[#fafbfd] px-4 py-8 text-center text-sm text-[#98A2B3]">
                暂时还没有站内提醒
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
