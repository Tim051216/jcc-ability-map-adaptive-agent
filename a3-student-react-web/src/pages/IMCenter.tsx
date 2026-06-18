import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Search, Send, UserRound, Users } from "lucide-react";
import { INBOX_UPDATED_EVENT, listInboxItems, markInboxItemRead, type InboxItem } from "../lib/inbox";
import {
  getImEventStreamUrl,
  studentApi,
  type ImMessageResponse,
  type ImSessionSummaryResponse,
} from "../lib/studentApi";
import { DEMO_USER_PROFILES, getDemoUserProfile } from "../lib/userProfiles";

interface IMCenterProps {
  user: {
    id: string;
    name: string;
    avatar: string;
    loggedIn: boolean;
  };
}

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "unread", label: "未读" },
  { key: "group", label: "群聊" },
  { key: "direct", label: "私聊" },
  { key: "system", label: "通知" },
] as const;

const IM_CACHE_PREFIX = "a3-im-cache";
const IM_MESSAGE_CACHE_PREFIX = "a3-im-message-cache";
const IM_ACTIVE_SESSION_PREFIX = "a3-im-active-session";

type FilterKey = (typeof FILTERS)[number]["key"];

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isSessionSummary(value: unknown): value is ImSessionSummaryResponse {
  return isObjectRecord(value) && typeof value.session_id === "number";
}

function isImMessage(value: unknown): value is ImMessageResponse {
  return (
    isObjectRecord(value) &&
    typeof value.message_id === "number" &&
    typeof value.session_id === "number" &&
    typeof value.role === "string" &&
    typeof value.content === "string"
  );
}

function isInboxItem(value: unknown): value is InboxItem {
  return (
    isObjectRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.content === "string"
  );
}

function getSessionCacheKey(userId: string) {
  return `${IM_CACHE_PREFIX}:${userId}`;
}

function getMessageCacheKey(userId: string, sessionId: string) {
  return `${IM_MESSAGE_CACHE_PREFIX}:${userId}:${sessionId}`;
}

function getActiveSessionKey(userId: string) {
  return `${IM_ACTIVE_SESSION_PREFIX}:${userId}`;
}

function readActiveSessionId(userId: string) {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(getActiveSessionKey(userId)) || "";
  } catch {
    return "";
  }
}

function writeActiveSessionId(userId: string, sessionId: string) {
  if (typeof window === "undefined") return;
  try {
    if (sessionId) {
      window.sessionStorage.setItem(getActiveSessionKey(userId), sessionId);
    } else {
      window.sessionStorage.removeItem(getActiveSessionKey(userId));
    }
  } catch {
    // Ignore cache write failures.
  }
}

function readCachedSessions(userId: string): ImSessionSummaryResponse[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(getSessionCacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ImSessionSummaryResponse[];
    return Array.isArray(parsed) ? parsed.filter(isSessionSummary).map(normalizeSessionSummary) : [];
  } catch {
    try {
      window.sessionStorage.removeItem(getSessionCacheKey(userId));
    } catch {
      // Ignore storage cleanup failures.
    }
    return [];
  }
}

function writeCachedSessions(userId: string, sessions: ImSessionSummaryResponse[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(getSessionCacheKey(userId), JSON.stringify(sessions.slice(0, 20)));
  } catch {
    // Ignore cache write failures.
  }
}

function readCachedMessages(userId: string, sessionId: string): ImMessageResponse[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(getMessageCacheKey(userId, sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ImMessageResponse[];
    return Array.isArray(parsed) ? parsed.filter(isImMessage).map(normalizeImMessage) : [];
  } catch {
    try {
      window.sessionStorage.removeItem(getMessageCacheKey(userId, sessionId));
    } catch {
      // Ignore storage cleanup failures.
    }
    return [];
  }
}

function writeCachedMessages(userId: string, sessionId: string, messages: ImMessageResponse[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(getMessageCacheKey(userId, sessionId), JSON.stringify(messages.slice(-40)));
  } catch {
    // Ignore cache write failures.
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTimeOnly(value?: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function sortSessionsByLatest(items: ImSessionSummaryResponse[]) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.latest_message_at || 0).getTime();
    const rightTime = new Date(right.latest_message_at || 0).getTime();
    return rightTime - leftTime;
  });
}

function normalizeSessionSummary(value: ImSessionSummaryResponse): ImSessionSummaryResponse {
  return {
    session_id: asNumber(value.session_id),
    peer_user_id: typeof value.peer_user_id === "number" && Number.isFinite(value.peer_user_id) ? value.peer_user_id : null,
    title: asString(value.title, ""),
    scene: asOptionalString(value.scene),
    conversation_type:
      value.conversation_type === "group" || value.conversation_type === "direct" || value.conversation_type === "system"
        ? value.conversation_type
        : null,
    subtitle: asOptionalString(value.subtitle),
    badge_label: asOptionalString(value.badge_label),
    participant_label: asOptionalString(value.participant_label),
    member_count: typeof value.member_count === "number" && Number.isFinite(value.member_count) ? value.member_count : null,
    unread_count: Math.max(0, asNumber(value.unread_count)),
    latest_message: asOptionalString(value.latest_message),
    latest_message_at: asOptionalString(value.latest_message_at),
  };
}

function normalizeImMessage(value: ImMessageResponse): ImMessageResponse {
  return {
    message_id: asNumber(value.message_id),
    session_id: asNumber(value.session_id),
    role: asString(value.role, "assistant"),
    content: asString(value.content, ""),
    created_at: asOptionalString(value.created_at),
  };
}

function normalizeInboxItem(value: InboxItem): InboxItem {
  return {
    id: asString(value.id, ""),
    type: asNumber(value.type),
    title: asString(value.title, "系统通知"),
    content: asString(value.content, ""),
    isRead: Boolean(value.isRead),
    publisher: asString(value.publisher, "系统"),
    pushTime: asString(value.pushTime, ""),
  };
}

function hasBrokenText(value?: string | null) {
  if (!value) return false;
  return /[锟�]/.test(value) || value.includes("???");
}

function getConversationMeta(conversation: ImSessionSummaryResponse) {
  if (conversation.conversation_type === "group") {
    return {
      icon: Users,
      iconClassName: "bg-[#ffe8ef] text-[#ea4c89]",
    };
  }
  if (conversation.conversation_type === "system") {
    return {
      icon: Bell,
      iconClassName: "bg-[#e8f4ff] text-[#2563eb]",
    };
  }
  return {
    icon: UserRound,
    iconClassName: "bg-[#eef2f6] text-[#475569]",
  };
}

function sanitizeConversation(conversation: ImSessionSummaryResponse): ImSessionSummaryResponse {
  const normalizedConversation = normalizeSessionSummary(conversation);
  const peerProfile =
    normalizedConversation.conversation_type === "direct" && normalizedConversation.peer_user_id
      ? getDemoUserProfile(String(normalizedConversation.peer_user_id))
      : null;

  const title =
    normalizedConversation.conversation_type === "group"
      ? "学习交流群"
      : normalizedConversation.conversation_type === "system"
        ? "系统通知"
        : peerProfile?.name || normalizedConversation.title || "站内联系人";

  const subtitle =
    normalizedConversation.conversation_type === "group"
      ? "课堂协作"
      : normalizedConversation.conversation_type === "system"
        ? "系统同步"
        : peerProfile?.subtitle || "站内沟通";

  return {
    ...normalizedConversation,
    title: hasBrokenText(normalizedConversation.title) || !normalizedConversation.title ? title : normalizedConversation.title,
    subtitle:
      hasBrokenText(normalizedConversation.subtitle) || !normalizedConversation.subtitle
        ? subtitle
        : normalizedConversation.subtitle,
    participant_label:
      hasBrokenText(normalizedConversation.participant_label) || !normalizedConversation.participant_label
        ? subtitle
        : normalizedConversation.participant_label,
  };
}

function mergeIncomingSessions(
  current: ImSessionSummaryResponse[],
  incoming: ImSessionSummaryResponse[],
  activeConversationId: string,
) {
  const currentMap = new Map(current.filter(isSessionSummary).map((item) => [item.session_id, item]));
  return sortSessionsByLatest(
    incoming.filter(isSessionSummary).map((item) => {
      const previous = currentMap.get(item.session_id);
      if (String(item.session_id) === activeConversationId) {
        return {
          ...item,
          unread_count: 0,
          latest_message: previous?.latest_message || item.latest_message,
        };
      }
      return item;
    }),
  );
}

function ConversationListSkeleton() {
  return (
    <div className="space-y-3 px-4 py-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 rounded-2xl bg-white px-3 py-3">
          <div className="h-11 w-11 animate-pulse rounded-full bg-[#eef2f7]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-[#eef2f7]" />
            <div className="h-3 w-40 animate-pulse rounded bg-[#f2f5f9]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function IMCenter({ user }: IMCenterProps) {
  const cachedSessions = useMemo(() => readCachedSessions(user.id).map(sanitizeConversation), [user.id]);
  const initialSessionId =
    readActiveSessionId(user.id) || (cachedSessions[0]?.session_id ? String(cachedSessions[0].session_id) : "");

  const [filter, setFilter] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [sessions, setSessions] = useState<ImSessionSummaryResponse[]>(cachedSessions);
  const [activeConversationId, setActiveConversationId] = useState(initialSessionId);
  const [activeMessages, setActiveMessages] = useState<ImMessageResponse[]>(readCachedMessages(user.id, initialSessionId));
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [imLoading, setImLoading] = useState(cachedSessions.length === 0);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const activeConversationIdRef = useRef(initialSessionId);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    writeActiveSessionId(user.id, activeConversationId);
  }, [activeConversationId, user.id]);

  useEffect(() => {
    writeCachedSessions(user.id, sessions);
  }, [sessions, user.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setImLoading(cachedSessions.length === 0);
      try {
        const [sessionResponse, inboxResponse] = await Promise.all([
          studentApi.listImSessions(),
          listInboxItems(user.id, { pageNo: 1, pageSize: 20 }),
        ]);

        if (cancelled) return;

        const nextSessions = (Array.isArray(sessionResponse.items) ? sessionResponse.items : [])
          .filter(isSessionSummary)
          .map(normalizeSessionSummary)
          .map(sanitizeConversation);
        setSessions(nextSessions);
        setActiveConversationId((current) => current || String(nextSessions[0]?.session_id || ""));
        setInboxItems(Array.isArray(inboxResponse) ? inboxResponse.filter(isInboxItem).map(normalizeInboxItem) : []);
      } catch {
        if (!cancelled && cachedSessions.length === 0) {
          setSessions([]);
        }
      } finally {
        if (!cancelled) {
          setImLoading(false);
          setInboxLoading(false);
        }
      }
    }

    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [cachedSessions.length, user.id]);

  useEffect(() => {
    if (!activeConversationId) return;
    let cancelled = false;
    const cached = readCachedMessages(user.id, activeConversationId);
    if (cached.length > 0) {
      setActiveMessages(cached);
    }

    async function loadMessages() {
      setMessagesLoading(cached.length === 0);
      try {
        const response = await studentApi.listImMessages(Number(activeConversationId));
        if (cancelled) return;
        const nextMessages = (Array.isArray(response.items) ? response.items : []).filter(isImMessage).map(normalizeImMessage);
        setActiveMessages(nextMessages);
        writeCachedMessages(user.id, activeConversationId, nextMessages);
        setSessions((current) =>
          current.map((item) =>
            String(item.session_id) === activeConversationId ? { ...item, unread_count: 0 } : item,
          ),
        );
        void studentApi.markImSessionRead(Number(activeConversationId)).catch(() => undefined);
      } catch {
        if (!cancelled && cached.length === 0) {
          setActiveMessages([]);
        }
      } finally {
        if (!cancelled) {
          setMessagesLoading(false);
        }
      }
    }

    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [activeConversationId, user.id]);

  useEffect(() => {
    async function loadInbox() {
      try {
        const nextItems = await listInboxItems(user.id, { pageNo: 1, pageSize: 20 });
        setInboxItems(Array.isArray(nextItems) ? nextItems.filter(isInboxItem).map(normalizeInboxItem) : []);
      } catch {
        // Keep current inbox state.
      } finally {
        setInboxLoading(false);
      }
    }

    void loadInbox();
    window.addEventListener(INBOX_UPDATED_EVENT, loadInbox);
    return () => {
      window.removeEventListener(INBOX_UPDATED_EVENT, loadInbox);
    };
  }, [user.id]);

  useEffect(() => {
    const numericUserId = Number(user.id);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) return;

    const stream = new EventSource(getImEventStreamUrl(numericUserId));
    let pollingTimer: number | null = null;

    async function pollSessions() {
      try {
        const response = await studentApi.listImSessions();
        const nextItems = (Array.isArray(response.items) ? response.items : [])
          .filter(isSessionSummary)
          .map(normalizeSessionSummary)
          .map(sanitizeConversation);
        setSessions((current) => mergeIncomingSessions(current, nextItems, activeConversationIdRef.current));
      } catch {
        // Keep current UI state on polling failure.
      }
    }

    stream.addEventListener("open", () => {
      setStreamConnected(true);
      if (pollingTimer) {
        window.clearInterval(pollingTimer);
        pollingTimer = null;
      }
    });

    stream.addEventListener("im-update", (event) => {
      setStreamConnected(true);
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { items?: ImSessionSummaryResponse[] };
        const nextItems = (Array.isArray(payload.items) ? payload.items : [])
          .filter(isSessionSummary)
          .map(normalizeSessionSummary)
          .map(sanitizeConversation);
        setSessions((current) => mergeIncomingSessions(current, nextItems, activeConversationIdRef.current));
        setActiveConversationId((current) => current || String(nextItems[0]?.session_id || ""));
      } catch {
        // Ignore malformed stream payloads.
      }
    });

    stream.addEventListener("error", () => {
      setStreamConnected(false);
      if (!pollingTimer) {
        pollingTimer = window.setInterval(() => {
          void pollSessions();
        }, 6000);
      }
    });

    return () => {
      stream.close();
      if (pollingTimer) {
        window.clearInterval(pollingTimer);
      }
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
              : filter === "direct"
                ? conversation.conversation_type === "direct"
                : conversation.conversation_type === "system";

      const haystack = `${conversation.title} ${conversation.subtitle || ""} ${conversation.participant_label || ""}`.toLowerCase();
      const matchesSearch = !searchQuery.trim() || haystack.includes(searchQuery.trim().toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [filter, searchQuery, sessions]);

  useEffect(() => {
    if (filteredConversations.length && !filteredConversations.some((item) => String(item.session_id) === activeConversationId)) {
      setActiveConversationId(String(filteredConversations[0].session_id));
    }
  }, [activeConversationId, filteredConversations]);

  const activeConversation =
    sessions.find((item) => String(item.session_id) === activeConversationId) || filteredConversations[0] || null;

  const activeConversationMeta = activeConversation ? getConversationMeta(activeConversation) : null;
  const activePeerProfile =
    activeConversation?.conversation_type === "direct" && activeConversation.peer_user_id
      ? getDemoUserProfile(activeConversation.peer_user_id)
      : null;

  const totalUnread = useMemo(
    () => sessions.reduce((sum, item) => sum + item.unread_count, 0) + inboxItems.filter((item) => !item.isRead).length,
    [sessions, inboxItems],
  );

  const conversationPreviewItems = useMemo(() => filteredConversations.slice(0, 12), [filteredConversations]);
  const profileTagline = useMemo(() => getDemoUserProfile(user.id)?.subtitle || "学习账号已接入", [user.id]);
  const newChatCandidates = useMemo(() => {
    return DEMO_USER_PROFILES.filter((profile) => profile.id !== user.id);
  }, [user.id]);

  async function handleSend() {
    if (!activeConversation || !messageDraft.trim()) return;
    setSending(true);
    try {
      const sent = await studentApi.sendImMessage(Number(activeConversation.session_id), {
        content: messageDraft.trim(),
      });
      const nextMessages = [...activeMessages, sent];
      setActiveMessages(nextMessages);
      writeCachedMessages(user.id, String(activeConversation.session_id), nextMessages);
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
  }

  async function handleCreateDirectSession(profileId: string) {
    const profile = getDemoUserProfile(profileId);
    if (!profile) return;
    const existingDirectSession = sessions.find(
      (item) => item.conversation_type === "direct" && String(item.peer_user_id || "") === profileId,
    );
    if (existingDirectSession) {
      setActiveConversationId(String(existingDirectSession.session_id));
      return;
    }
    const session = sanitizeConversation(
      await studentApi.createImSession({
        peer_user_id: Number(profileId),
        peer_name: profile.name,
        owner_name: user.name,
      }),
    );
    setSessions((current) => sortSessionsByLatest([session, ...current.filter((item) => item.session_id !== session.session_id)]));
    setActiveConversationId(String(session.session_id));
  }

  return (
    <div className="rounded-[28px] border border-[#e8edf3] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
      <div className="grid min-h-[760px] grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_280px]">
        <aside className="border-b border-[#edf2f7] bg-[#f8fafc] xl:border-b-0 xl:border-r">
          <div className="border-b border-[#edf2f7] px-4 py-4">
            <div className="flex items-center gap-3">
              {user.avatar ? <img src={user.avatar} alt={user.name} className="h-11 w-11 rounded-full object-cover" /> : null}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-[#111827]">{user.name}</div>
                <div className="truncate text-xs text-[#6b7280]">{profileTagline}</div>
              </div>
              <div className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-[#ea4c89]">{totalUnread} 未读</div>
            </div>

            <div className="mt-4 rounded-2xl bg-white px-3 py-2">
              <div className="flex items-center gap-2 text-[#94a3b8]">
                <Search className="h-4 w-4" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索"
                  className="w-full bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#94a3b8]"
                />
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    filter === item.key ? "bg-[#ea4c89] text-white" : "bg-white text-[#475569]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[620px] overflow-y-auto">
            {imLoading && conversationPreviewItems.length === 0 ? (
              <ConversationListSkeleton />
            ) : conversationPreviewItems.length > 0 ? (
              conversationPreviewItems.map((conversation) => {
                const meta = getConversationMeta(conversation);
                const Icon = meta.icon;
                const isActive = String(conversation.session_id) === activeConversationId;
                const peerProfile =
                  conversation.conversation_type === "direct" && conversation.peer_user_id
                    ? getDemoUserProfile(conversation.peer_user_id)
                    : null;

                return (
                  <button
                    key={conversation.session_id}
                    type="button"
                    onClick={() => setActiveConversationId(String(conversation.session_id))}
                    className={`flex w-full items-start gap-3 border-b border-[#eef2f7] px-4 py-4 text-left transition ${
                      isActive ? "bg-white" : "hover:bg-white/80"
                    }`}
                  >
                    {peerProfile?.avatar ? (
                      <img src={peerProfile.avatar} alt={peerProfile.name} className="h-11 w-11 rounded-full object-cover" />
                    ) : (
                      <div className={`flex h-11 w-11 items-center justify-center rounded-full ${meta.iconClassName}`}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-semibold text-[#111827]">{conversation.title}</div>
                        <div className="shrink-0 text-[11px] text-[#94a3b8]">{formatTimeOnly(conversation.latest_message_at)}</div>
                      </div>
                      <div className="mt-1 truncate text-xs text-[#64748b]">
                        {conversation.latest_message || conversation.participant_label || conversation.subtitle || "还没有新消息"}
                      </div>
                    </div>

                    {conversation.unread_count > 0 ? (
                      <div className="mt-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#ea4c89] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {conversation.unread_count}
                      </div>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="px-6 py-10 text-center text-sm text-[#94a3b8]">没有匹配的会话</div>
            )}
          </div>
        </aside>

        <section className="flex min-h-[760px] flex-col bg-white">
          {activeConversation ? (
            <>
              <div className="flex items-center justify-between border-b border-[#edf2f7] px-5 py-4">
                <div className="flex items-center gap-3">
                  {activePeerProfile?.avatar ? (
                    <img src={activePeerProfile.avatar} alt={activePeerProfile.name} className="h-10 w-10 rounded-full object-cover" />
                  ) : activeConversationMeta ? (
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${activeConversationMeta.iconClassName}`}>
                      <activeConversationMeta.icon className="h-4.5 w-4.5" />
                    </div>
                  ) : null}
                  <div>
                    <div className="text-sm font-bold text-[#111827]">{activeConversation.title}</div>
                    <div className="text-xs text-[#64748b]">
                      {activeConversation.participant_label || activeConversation.subtitle || "站内沟通"}
                    </div>
                  </div>
                </div>

                <div className="text-right text-xs text-[#64748b]">
                  <div>{streamConnected ? "实时同步中" : "轮询同步中"}</div>
                  <div className="mt-1">{activeConversation.latest_message_at ? formatDateTime(activeConversation.latest_message_at) : "暂无动态"}</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-[#f4f7fb] px-5 py-5">
                <div className="mx-auto max-w-3xl space-y-4">
                  {messagesLoading && activeMessages.length === 0 ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}>
                          <div className="h-16 w-[60%] animate-pulse rounded-2xl bg-white/90" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    activeMessages.map((message) => {
                      const isMine = message.role === `user:${user.id}`;
                      const senderAvatar = isMine ? user.avatar : activePeerProfile?.avatar || "";

                      return (
                        <div key={message.message_id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          <div className={`flex max-w-[82%] items-end gap-3 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                            {senderAvatar ? (
                              <img src={senderAvatar} alt={isMine ? user.name : activeConversation.title} className="h-9 w-9 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e7edf5] text-[#64748b]">
                                <UserRound className="h-4 w-4" />
                              </div>
                            )}

                            <div className={`${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                              <div
                                className={`rounded-2xl px-4 py-3 text-sm leading-7 ${
                                  isMine ? "bg-[#ea4c89] text-white" : "border border-[#e6ebf2] bg-white text-[#111827]"
                                }`}
                              >
                                {message.content}
                              </div>
                              <div className="px-1 text-[11px] text-[#94a3b8]">{formatDateTime(message.created_at)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="border-t border-[#edf2f7] bg-white px-5 py-4">
                <div className="mx-auto max-w-3xl">
                  <textarea
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    rows={4}
                    placeholder="输入消息"
                    className="w-full resize-none rounded-2xl border border-[#dbe3ec] px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#ea4c89]"
                  />
                  <div className="mt-3 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={sending}
                      className="inline-flex items-center gap-2 rounded-full bg-[#ea4c89] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" />
                      {sending ? "发送中" : "发送"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center bg-[#f4f7fb] text-sm text-[#94a3b8]">
              {imLoading ? "正在同步会话列表..." : "请选择一个会话"}
            </div>
          )}
        </section>

        <aside className="border-t border-[#edf2f7] bg-[#fbfcfe] xl:border-t-0 xl:border-l">
          <div className="border-b border-[#edf2f7] px-4 py-4">
            <div className="text-sm font-bold text-[#111827]">联系人</div>
            <div className="mt-1 text-xs text-[#64748b]">这里和登录页使用同一批演示账号，便于你直接切号验证私聊与实时消息。</div>
          </div>

          <div className="border-b border-[#edf2f7] px-4 py-4">
            <div className="mb-3 text-xs font-semibold text-[#64748b]">发起新私聊</div>
            <div className="grid gap-2">
              {newChatCandidates.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => void handleCreateDirectSession(profile.id)}
                  className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-left transition hover:bg-[#f8fafc]"
                >
                  <div className="flex items-center gap-3">
                    <img src={profile.avatar} alt={profile.name} className="h-9 w-9 rounded-full object-cover" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#111827]">{profile.name}</div>
                      <div className="truncate text-xs text-[#94a3b8]">{profile.subtitle}</div>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-[#ea4c89]">开聊</div>
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-semibold text-[#64748b]">系统通知</div>
              <div className="rounded-full bg-[#ea4c89] px-2 py-0.5 text-[10px] font-semibold text-white">
                {inboxItems.filter((item) => !item.isRead).length}
              </div>
            </div>

            <div className="space-y-2">
              {inboxLoading ? (
                <div className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-[#94a3b8]">正在拉取提醒...</div>
              ) : inboxItems.length > 0 ? (
                inboxItems.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={async () => {
                      if (item.isRead) return;
                      try {
                        await markInboxItemRead(user.id, item.id);
                        setInboxItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry)));
                      } catch {
                        // Keep current UI when marking fails.
                      }
                    }}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      item.isRead ? "border-[#edf2f7] bg-white" : "border-[#f7d4e3] bg-[#fff7fb]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#111827]">{item.title}</div>
                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-[#64748b]">{item.content}</div>
                      </div>
                      {!item.isRead ? <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[#ea4c89]" /> : null}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-[#94a3b8]">暂时没有新的系统通知</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
