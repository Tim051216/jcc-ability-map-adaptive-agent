import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, Plus, Search, Send, UserRound, Users, X } from "lucide-react";
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
const IM_GROUP_META_PREFIX = "a3-im-group-meta";
const IM_READ_SESSION_PREFIX = "a3-im-read-sessions";

type FilterKey = (typeof FILTERS)[number]["key"];

type GroupMeta = {
  sessionId: string;
  ownerId: string;
  title: string;
  memberIds: string[];
  createdAt: string;
};

type AvatarProfile = {
  id?: string | number | null;
  name?: string | null;
  avatar?: string | null;
};

const IM_AVATAR_TONES = [
  { bg: "linear-gradient(135deg,#ffe4ef,#fb7299)", fg: "#7a1238" },
  { bg: "linear-gradient(135deg,#dcfce7,#22c55e)", fg: "#14532d" },
  { bg: "linear-gradient(135deg,#dbeafe,#3b82f6)", fg: "#1e3a8a" },
  { bg: "linear-gradient(135deg,#fef3c7,#f59e0b)", fg: "#78350f" },
  { bg: "linear-gradient(135deg,#ede9fe,#8b5cf6)", fg: "#3b0764" },
  { bg: "linear-gradient(135deg,#cffafe,#06b6d4)", fg: "#164e63" },
  { bg: "linear-gradient(135deg,#fee2e2,#ef4444)", fg: "#7f1d1d" },
  { bg: "linear-gradient(135deg,#fce7f3,#db2777)", fg: "#831843" },
  { bg: "linear-gradient(135deg,#e0f2fe,#0284c7)", fg: "#0c4a6e" },
  { bg: "linear-gradient(135deg,#f5f5f4,#78716c)", fg: "#292524" },
];

function getStableIndex(value?: string | number | null) {
  const source = String(value || "0");
  return Array.from(source).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function getAvatarInitial(name?: string | null) {
  const trimmed = (name || "").trim();
  return trimmed ? trimmed.slice(-1) : "同";
}

function IMAvatar({
  profile,
  size = "md",
  className = "",
}: {
  profile?: AvatarProfile | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [imageErrored, setImageErrored] = useState(false);
  const profileId = profile?.id || profile?.name || "member";
  const tone = IM_AVATAR_TONES[getStableIndex(profileId) % IM_AVATAR_TONES.length];
  const sizeClassName = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-11 w-11 text-sm" : "h-9 w-9 text-xs";
  const baseClassName = `flex shrink-0 items-center justify-center rounded-full font-black shadow-sm ${sizeClassName} ${className}`;
  const avatarSrc = profile?.avatar || "";

  useEffect(() => {
    setImageErrored(false);
  }, [avatarSrc]);

  if (avatarSrc && !imageErrored) {
    return (
      <div
        className={`relative overflow-hidden ring-2 ring-white ${baseClassName}`}
        title={profile?.name || "群成员"}
        style={{ background: tone.bg }}
      >
        <img
          src={avatarSrc}
          alt={profile?.name || "头像"}
          className="h-full w-full object-cover"
          onError={() => setImageErrored(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`ring-2 ring-white ${baseClassName}`}
      style={{ background: tone.bg, color: tone.fg }}
      title={profile?.name || "群成员"}
    >
      {getAvatarInitial(profile?.name)}
    </div>
  );
}

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
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function isNumericLike(value: unknown) {
  return (
    (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" && /^-?\d+$/.test(value.trim()))
  );
}

function isSessionSummary(value: unknown): value is ImSessionSummaryResponse {
  return isObjectRecord(value) && isNumericLike(value.session_id);
}

function isImMessage(value: unknown): value is ImMessageResponse {
  return (
    isObjectRecord(value) &&
    isNumericLike(value.message_id) &&
    isNumericLike(value.session_id) &&
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

function getReadSessionKey(userId: string) {
  return `${IM_READ_SESSION_PREFIX}:${userId}`;
}

function getGroupMetaKey(userId: string) {
  return `${IM_GROUP_META_PREFIX}:${userId}`;
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

function readLocallyReadSessionIds(userId: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.sessionStorage.getItem(getReadSessionKey(userId));
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function writeLocallyReadSessionIds(userId: string, sessionIds: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(getReadSessionKey(userId), JSON.stringify(Array.from(sessionIds).slice(-80)));
  } catch {
    // Ignore cache write failures.
  }
}

function readGroupMetaMap(userId: string): Record<string, GroupMeta> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(getGroupMetaKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, GroupMeta>;
    return isObjectRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeGroupMetaMap(userId: string, metaMap: Record<string, GroupMeta>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(getGroupMetaKey(userId), JSON.stringify(metaMap));
  } catch {
    // Ignore group metadata cache failures.
  }
}

function writeGroupMeta(userId: string, meta: GroupMeta) {
  const metaMap = readGroupMetaMap(userId);
  metaMap[meta.sessionId] = meta;
  writeGroupMetaMap(userId, metaMap);
}

function getStoredGroupMeta(userId: string, sessionId: string) {
  return readGroupMetaMap(userId)[sessionId] || null;
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

function getDefaultGroupMemberIds(userId: string) {
  return DEMO_USER_PROFILES.filter((profile) => profile.id !== userId)
    .slice(0, 5)
    .map((profile) => profile.id);
}

function getGroupMemberIds(userId: string, conversation?: ImSessionSummaryResponse | null) {
  if (!conversation || conversation.conversation_type !== "group") return [];
  const storedMeta = getStoredGroupMeta(userId, String(conversation.session_id));
  return storedMeta?.memberIds?.length ? storedMeta.memberIds : getDefaultGroupMemberIds(userId).slice(0, Math.max(3, (conversation.member_count || 4) - 1));
}

function getGroupMemberProfiles(userId: string, conversation?: ImSessionSummaryResponse | null) {
  return getGroupMemberIds(userId, conversation)
    .map((memberId) => getDemoUserProfile(memberId))
    .filter(Boolean);
}

function getMessageSenderId(message: ImMessageResponse, fallbackMemberIds: string[]) {
  if (message.role.startsWith("user:")) return message.role.replace("user:", "");
  if (message.role.startsWith("member:")) return message.role.replace("member:", "");
  if (fallbackMemberIds.length > 0 && message.role !== "system") {
    return fallbackMemberIds[Math.abs(message.message_id) % fallbackMemberIds.length];
  }
  return "";
}

function buildGroupDemoMessages(userId: string, conversation: ImSessionSummaryResponse): ImMessageResponse[] {
  const memberIds = getGroupMemberIds(userId, conversation);
  const now = Date.now();
  const [first, second, third] = memberIds;
  const samples = [
    {
      role: `user:${first || userId}`,
      content: "我先把需求拆成首页、报告页和评估页三条线，今晚把待确认点列出来。",
      created_at: new Date(now - 1000 * 60 * 24).toISOString(),
    },
    {
      role: `user:${second || userId}`,
      content: "我这边补资源和路径页的演示素材，明天可以一起过一遍讲法。",
      created_at: new Date(now - 1000 * 60 * 18).toISOString(),
    },
    {
      role: `user:${userId}`,
      content: "我先改首页，再回到报告页补结论，这个顺序可以吗？",
      created_at: new Date(now - 1000 * 60 * 12).toISOString(),
    },
    {
      role: `user:${third || first || userId}`,
      content: "可以，群里先把每个人负责的页面和截止时间固定下来，后面就按清单推进。",
      created_at: new Date(now - 1000 * 60 * 8).toISOString(),
    },
  ];

  return samples.map((item, index) => ({
    message_id: Number(`${conversation.session_id}${index + 1}`.replace("-", "")) || Date.now() + index,
    session_id: conversation.session_id,
    role: item.role,
    content: item.content,
    created_at: item.created_at,
  }));
}

function buildDirectDemoMessages(userId: string, conversation: ImSessionSummaryResponse): ImMessageResponse[] {
  const peerId = conversation.peer_user_id ? String(conversation.peer_user_id) : "";
  const peerProfile = peerId ? getDemoUserProfile(peerId) : null;
  const peerName = peerProfile?.name || conversation.title || "联系人";
  const now = Date.now();
  const samples = [
    {
      role: `user:${peerId || "peer"}`,
      content: `刚同步了一条学习进度，后面可以直接在这里和${peerName}继续沟通。`,
      created_at: new Date(now - 1000 * 60 * 12).toISOString(),
    },
    {
      role: `user:${userId}`,
      content: "收到，我这边先看一下，后续有问题就在这里发。",
      created_at: new Date(now - 1000 * 60 * 8).toISOString(),
    },
    {
      role: `user:${peerId || "peer"}`,
      content: "好，我也会把课程相关的进展和待确认点同步过来。",
      created_at: new Date(now - 1000 * 60 * 4).toISOString(),
    },
  ];

  return samples.map((item, index) => ({
    message_id: Number(`${conversation.session_id}${index + 11}`.replace("-", "")) || Date.now() + index,
    session_id: conversation.session_id,
    role: item.role,
    content: item.content,
    created_at: item.created_at,
  }));
}

function buildInstantMessages(userId: string, conversation?: ImSessionSummaryResponse | null) {
  if (!conversation) return [];
  if (conversation.conversation_type === "group") {
    return buildGroupDemoMessages(userId, conversation);
  }
  if (conversation.conversation_type === "direct") {
    return buildDirectDemoMessages(userId, conversation);
  }
  return [];
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
    peer_user_id: isNumericLike(value.peer_user_id) ? asNumber(value.peer_user_id) : null,
    title: asString(value.title, ""),
    scene: asOptionalString(value.scene),
    conversation_type:
      value.conversation_type === "group" || value.conversation_type === "direct" || value.conversation_type === "system"
        ? value.conversation_type
        : null,
    subtitle: asOptionalString(value.subtitle),
    badge_label: asOptionalString(value.badge_label),
    participant_label: asOptionalString(value.participant_label),
    member_count: isNumericLike(value.member_count) ? asNumber(value.member_count) : null,
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
  locallyReadSessionIds = new Set<string>(),
) {
  if (incoming.length === 0) return current;
  const currentMap = new Map(current.filter(isSessionSummary).map((item) => [item.session_id, item]));
  return sortSessionsByLatest(
    incoming.filter(isSessionSummary).map((item) => {
      const previous = currentMap.get(item.session_id);
      const sessionId = String(item.session_id);
      if (sessionId === activeConversationId || locallyReadSessionIds.has(sessionId)) {
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

function buildFallbackSessions(userId: string): ImSessionSummaryResponse[] {
  const now = new Date().toISOString();
  const peers = DEMO_USER_PROFILES.filter((profile) => profile.id !== userId).slice(0, 5);
  const directSessions = peers.map((profile, index) =>
    sanitizeConversation({
      session_id: 900001 + index,
      peer_user_id: Number(profile.id),
      title: profile.name,
      scene: "direct",
      conversation_type: "direct",
      subtitle: profile.subtitle,
      badge_label: null,
      participant_label: profile.subtitle,
      member_count: 2,
      unread_count: index === 0 ? 1 : 0,
      latest_message: index === 0 ? "刚同步了一条学习进度，方便继续沟通。" : "可以从右侧联系人继续开聊。",
      latest_message_at: now,
    }),
  );

  return [
    sanitizeConversation({
      session_id: 900000,
      peer_user_id: null,
      title: "学习交流群",
      scene: "group",
      conversation_type: "group",
      subtitle: "课堂协作",
      badge_label: "群聊",
      participant_label: `${Math.max(3, directSessions.length + 1)} 人 · 课堂协作`,
      member_count: Math.max(3, directSessions.length + 1),
      unread_count: 0,
      latest_message: "这里会集中展示课程群、助教私聊和系统通知。",
      latest_message_at: now,
    }),
    ...directSessions,
  ];
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
  const effectiveUser = useMemo(() => {
    const profile = getDemoUserProfile(user.id);
    return {
      ...user,
      id: user.id || profile?.id || "demo2024",
      name: user.name || profile?.name || "BiliLearn 用户",
      avatar: user.avatar || profile?.avatar || "",
    };
  }, [user]);
  const fallbackSessions = useMemo(() => buildFallbackSessions(effectiveUser.id), [effectiveUser.id]);
  const cachedSessions = useMemo(() => readCachedSessions(effectiveUser.id).map(sanitizeConversation), [effectiveUser.id]);
  const initialSessions = cachedSessions.length > 0 ? cachedSessions : fallbackSessions;
  const initialSessionId =
    readActiveSessionId(effectiveUser.id) || (initialSessions[0]?.session_id ? String(initialSessions[0].session_id) : "");

  const [filter, setFilter] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [sessions, setSessions] = useState<ImSessionSummaryResponse[]>(initialSessions);
  const [activeConversationId, setActiveConversationId] = useState(initialSessionId);
  const [activeMessages, setActiveMessages] = useState<ImMessageResponse[]>(readCachedMessages(effectiveUser.id, initialSessionId));
  const [locallyReadSessionIds, setLocallyReadSessionIds] = useState<Set<string>>(() => readLocallyReadSessionIds(effectiveUser.id));
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [imLoading, setImLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState("课程协作群");
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>(() =>
    getDefaultGroupMemberIds(effectiveUser.id).slice(0, 3),
  );
  const activeConversationIdRef = useRef(initialSessionId);
  const prefetchedMessageKeysRef = useRef(new Set<string>());

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    writeActiveSessionId(effectiveUser.id, activeConversationId);
  }, [activeConversationId, effectiveUser.id]);

  useEffect(() => {
    writeLocallyReadSessionIds(effectiveUser.id, locallyReadSessionIds);
  }, [effectiveUser.id, locallyReadSessionIds]);

  useEffect(() => {
    writeCachedSessions(effectiveUser.id, sessions);
  }, [sessions, effectiveUser.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setImLoading(cachedSessions.length === 0 && fallbackSessions.length === 0);
      try {
        const sessionResponse = await studentApi.listImSessions(effectiveUser.id);

        if (cancelled) return;

        const nextSessions = (Array.isArray(sessionResponse.items) ? sessionResponse.items : [])
          .filter(isSessionSummary)
          .map(normalizeSessionSummary)
          .map(sanitizeConversation)
          .map((item) =>
            locallyReadSessionIds.has(String(item.session_id)) || String(item.session_id) === activeConversationIdRef.current
              ? { ...item, unread_count: 0 }
              : item,
          );
        if (nextSessions.length > 0) {
          setSessions(nextSessions);
          setActiveConversationId((current) => current || String(nextSessions[0]?.session_id || ""));
        } else {
          setSessions((current) => (current.length > 0 ? current : fallbackSessions));
          setActiveConversationId((current) => current || String(fallbackSessions[0]?.session_id || ""));
        }
      } catch {
        if (!cancelled) {
          setSessions((current) => (current.length > 0 ? current : fallbackSessions));
          setActiveConversationId((current) => current || String(fallbackSessions[0]?.session_id || ""));
        }
      } finally {
        if (!cancelled) {
          setImLoading(false);
        }
      }

      try {
        const inboxResponse = await listInboxItems(effectiveUser.id, { pageNo: 1, pageSize: 20 });
        if (!cancelled) {
          setInboxItems(Array.isArray(inboxResponse) ? inboxResponse.filter(isInboxItem).map(normalizeInboxItem) : []);
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

    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [cachedSessions.length, effectiveUser.id, fallbackSessions, locallyReadSessionIds]);

  useEffect(() => {
    if (!activeConversationId) return;
    let cancelled = false;
    const activeSession = sessions.find((item) => String(item.session_id) === activeConversationId) || null;
    setLocallyReadSessionIds((current) => {
      if (current.has(activeConversationId)) return current;
      const next = new Set(current);
      next.add(activeConversationId);
      return next;
    });
    setSessions((current) =>
      current.map((item) =>
        String(item.session_id) === activeConversationId ? { ...item, unread_count: 0 } : item,
      ),
    );
    const cached = readCachedMessages(effectiveUser.id, activeConversationId);
    if (cached.length > 0) {
      setActiveMessages(cached);
    } else {
      setActiveMessages(buildInstantMessages(effectiveUser.id, activeSession));
    }

    async function loadMessages() {
      setMessagesLoading(cached.length === 0);
      try {
        const response = await studentApi.listImMessages(Number(activeConversationId), effectiveUser.id);
        if (cancelled) return;
        const nextMessages = (Array.isArray(response.items) ? response.items : []).filter(isImMessage).map(normalizeImMessage);
        setActiveMessages(nextMessages);
        writeCachedMessages(effectiveUser.id, activeConversationId, nextMessages);
        setSessions((current) =>
          current.map((item) =>
            String(item.session_id) === activeConversationId ? { ...item, unread_count: 0 } : item,
          ),
        );
        void studentApi.markImSessionRead(Number(activeConversationId), effectiveUser.id).catch(() => undefined);
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
  }, [activeConversationId, effectiveUser.id]);

  useEffect(() => {
    const prefetchTargets = sessions
      .slice(0, 10)
      .map((session) => String(session.session_id))
      .filter((sessionId) => {
        const key = `${effectiveUser.id}:${sessionId}`;
        if (prefetchedMessageKeysRef.current.has(key)) return false;
        if (readCachedMessages(effectiveUser.id, sessionId).length > 0) return false;
        prefetchedMessageKeysRef.current.add(key);
        return true;
      });

    if (!prefetchTargets.length) return;
    let cancelled = false;

    async function prefetchMessages() {
      for (const sessionId of prefetchTargets) {
        if (cancelled) return;
        const numericSessionId = Number(sessionId);
        if (!Number.isFinite(numericSessionId) || numericSessionId <= 0) continue;
        try {
          const response = await studentApi.listImMessages(numericSessionId, effectiveUser.id);
          if (cancelled) return;
          const nextMessages = (Array.isArray(response.items) ? response.items : []).filter(isImMessage).map(normalizeImMessage);
          if (nextMessages.length > 0) {
            writeCachedMessages(effectiveUser.id, sessionId, nextMessages);
          }
        } catch {
          // Prefetch is opportunistic; switching still has an instant local fallback.
        }
      }
    }

    const timer = window.setTimeout(() => {
      void prefetchMessages();
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [effectiveUser.id, sessions]);

  useEffect(() => {
    async function loadInbox() {
      try {
        const nextItems = await listInboxItems(effectiveUser.id, { pageNo: 1, pageSize: 20 });
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
  }, [effectiveUser.id]);

  useEffect(() => {
    const numericUserId = Number(effectiveUser.id);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) return;

    const stream = new EventSource(getImEventStreamUrl(numericUserId));
    let pollingTimer: number | null = null;

    async function pollSessions() {
      try {
        const response = await studentApi.listImSessions(effectiveUser.id);
        const nextItems = (Array.isArray(response.items) ? response.items : [])
          .filter(isSessionSummary)
          .map(normalizeSessionSummary)
          .map(sanitizeConversation);
        setSessions((current) => mergeIncomingSessions(current, nextItems, activeConversationIdRef.current, locallyReadSessionIds));
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
        setSessions((current) => mergeIncomingSessions(current, nextItems, activeConversationIdRef.current, locallyReadSessionIds));
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
  }, [effectiveUser.id, locallyReadSessionIds]);

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
  const activeGroupProfiles = useMemo(
    () => getGroupMemberProfiles(effectiveUser.id, activeConversation),
    [activeConversation, effectiveUser.id],
  );
  const displayedMessages = useMemo(() => {
    if (activeMessages.length > 0) return activeMessages;
    if (activeConversation?.conversation_type === "group") {
      return buildGroupDemoMessages(effectiveUser.id, activeConversation);
    }
    if (activeConversation?.conversation_type === "direct") {
      return buildDirectDemoMessages(effectiveUser.id, activeConversation);
    }
    return activeMessages;
  }, [activeConversation, activeMessages, effectiveUser.id]);

  const totalUnread = useMemo(
    () => sessions.reduce((sum, item) => sum + item.unread_count, 0) + inboxItems.filter((item) => !item.isRead).length,
    [sessions, inboxItems],
  );

  const conversationPreviewItems = useMemo(() => filteredConversations.slice(0, 12), [filteredConversations]);
  const profileTagline = useMemo(() => getDemoUserProfile(effectiveUser.id)?.subtitle || "学习账号已接入", [effectiveUser.id]);
  const newChatCandidates = useMemo(() => {
    return DEMO_USER_PROFILES.filter((profile) => profile.id !== effectiveUser.id);
  }, [effectiveUser.id]);

  async function handleSend() {
    if (!activeConversation || !messageDraft.trim()) return;
    setSending(true);
    try {
      const localSent: ImMessageResponse = {
        message_id: Date.now(),
        session_id: activeConversation.session_id,
        role: `user:${effectiveUser.id}`,
        content: messageDraft.trim(),
        created_at: new Date().toISOString(),
      };
      const sent =
        activeConversation.conversation_type === "group"
          ? localSent
          : await studentApi.sendImMessage(Number(activeConversation.session_id), {
              content: messageDraft.trim(),
            }, effectiveUser.id).catch(() => localSent);
      const nextMessages = [...(activeMessages.length ? activeMessages : displayedMessages), sent];
      setActiveMessages(nextMessages);
      writeCachedMessages(effectiveUser.id, String(activeConversation.session_id), nextMessages);
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

  function toggleGroupMember(profileId: string) {
    setSelectedGroupMemberIds((current) =>
      current.includes(profileId) ? current.filter((item) => item !== profileId) : [...current, profileId],
    );
  }

  function handleCreateGroupSession() {
    const cleanName = groupNameDraft.trim() || "课程协作群";
    const memberIds = Array.from(new Set(selectedGroupMemberIds)).filter((id) => id !== effectiveUser.id);
    if (memberIds.length < 2) return;
    const now = new Date().toISOString();
    const sessionId = 970000 + Math.floor(Date.now() % 100000);
    const groupMeta: GroupMeta = {
      sessionId: String(sessionId),
      ownerId: effectiveUser.id,
      title: cleanName,
      memberIds,
      createdAt: now,
    };
    writeGroupMeta(effectiveUser.id, groupMeta);
    const newSession = sanitizeConversation({
      session_id: sessionId,
      peer_user_id: null,
      title: cleanName,
      scene: "group",
      conversation_type: "group",
      subtitle: "自建群聊",
      badge_label: "群聊",
      participant_label: `${memberIds.length + 1} 人 · 自建群聊`,
      member_count: memberIds.length + 1,
      unread_count: 0,
      latest_message: "群聊已创建，可以开始同步任务分工。",
      latest_message_at: now,
    });
    const systemMessages: ImMessageResponse[] = [
      {
        message_id: Date.now(),
        session_id: sessionId,
        role: "system",
        content: `${effectiveUser.name} 创建了群聊，并邀请 ${memberIds
          .map((id) => getDemoUserProfile(id)?.name)
          .filter(Boolean)
          .join("、")} 加入。`,
        created_at: now,
      },
      {
        message_id: Date.now() + 1,
        session_id: sessionId,
        role: `user:${memberIds[0]}`,
        content: "收到，我先把自己负责的页面状态和还缺的素材列出来。",
        created_at: new Date(Date.now() + 1000).toISOString(),
      },
      {
        message_id: Date.now() + 2,
        session_id: sessionId,
        role: `user:${memberIds[1] || memberIds[0]}`,
        content: "我负责把演示顺序和答辩问题整理成一版清单，晚点同步到群里。",
        created_at: new Date(Date.now() + 2000).toISOString(),
      },
    ];
    setSessions((current) => sortSessionsByLatest([newSession, ...current]));
    writeCachedMessages(effectiveUser.id, String(sessionId), systemMessages);
    setActiveConversationId(String(sessionId));
    setActiveMessages(systemMessages);
    setFilter("group");
    setShowCreateGroup(false);
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
        owner_name: effectiveUser.name,
      }, effectiveUser.id),
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
              <IMAvatar profile={effectiveUser} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-[#111827]">{effectiveUser.name}</div>
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
                const groupProfiles =
                  conversation.conversation_type === "group" ? getGroupMemberProfiles(effectiveUser.id, conversation) : [];

                return (
                  <button
                    key={conversation.session_id}
                    type="button"
                    onClick={() => setActiveConversationId(String(conversation.session_id))}
                    className={`flex w-full items-start gap-3 border-b border-[#eef2f7] px-4 py-4 text-left transition ${
                      isActive ? "bg-white" : "hover:bg-white/80"
                    }`}
                  >
                    {conversation.conversation_type === "group" && groupProfiles.length > 0 ? (
                      <div className="relative h-11 w-11 shrink-0">
                        {groupProfiles.slice(0, 3).map((profile, index) => (
                          <IMAvatar
                            key={profile?.id || index}
                            profile={profile}
                            size="sm"
                            className={`absolute ${
                              index === 0 ? "left-0 top-0" : index === 1 ? "right-0 top-1" : "bottom-0 left-2"
                            }`}
                          />
                        ))}
                      </div>
                    ) : conversation.conversation_type === "direct" ? (
                      <IMAvatar
                        profile={
                          peerProfile || {
                            id: conversation.peer_user_id || conversation.session_id,
                            name: conversation.title,
                            avatar: "",
                          }
                        }
                        size="lg"
                      />
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
                        {conversation.conversation_type === "group" && conversation.member_count
                          ? `${conversation.member_count} 人 · ${conversation.latest_message || conversation.participant_label || "群聊协作"}`
                          : conversation.latest_message || conversation.participant_label || conversation.subtitle || "还没有新消息"}
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
                  {activeConversation.conversation_type === "group" && activeGroupProfiles.length > 0 ? (
                    <div className="flex -space-x-2">
                      {activeGroupProfiles.slice(0, 4).map((profile) => (
                        <IMAvatar
                          key={profile?.id}
                          profile={profile}
                          className="h-10 w-10"
                        />
                      ))}
                    </div>
                  ) : activeConversation.conversation_type === "direct" ? (
                    <IMAvatar
                      profile={
                        activePeerProfile || {
                          id: activeConversation.peer_user_id || activeConversation.session_id,
                          name: activeConversation.title,
                          avatar: "",
                        }
                      }
                      className="h-10 w-10"
                    />
                  ) : activeConversationMeta ? (
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${activeConversationMeta.iconClassName}`}>
                      <activeConversationMeta.icon className="h-4.5 w-4.5" />
                    </div>
                  ) : null}
                  <div>
                    <div className="text-sm font-bold text-[#111827]">{activeConversation.title}</div>
                    <div className="text-xs text-[#64748b]">
                      {activeConversation.conversation_type === "group"
                        ? `${activeConversation.member_count || activeGroupProfiles.length + 1} 人 · ${
                            activeGroupProfiles
                              .slice(0, 4)
                              .map((profile) => profile?.name)
                              .filter(Boolean)
                              .join("、") || "课堂协作"
                          }`
                        : activeConversation.participant_label || activeConversation.subtitle || "站内沟通"}
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
                    displayedMessages.map((message) => {
                      if (message.role === "system") {
                        return (
                          <div key={message.message_id} className="flex justify-center">
                            <div className="rounded-full border border-[#dbe4ee] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#64748b] shadow-sm">
                              {message.content}
                            </div>
                          </div>
                        );
                      }

                      const groupMemberIds = getGroupMemberIds(effectiveUser.id, activeConversation);
                      const senderId = getMessageSenderId(message, groupMemberIds);
                      const isMine = senderId === effectiveUser.id || message.role === `user:${effectiveUser.id}`;
                      const senderProfile = isMine
                        ? { id: effectiveUser.id, name: effectiveUser.name, subtitle: "我", avatar: effectiveUser.avatar }
                        : getDemoUserProfile(senderId) || activePeerProfile;
                      const senderName = senderProfile?.name || (activeConversation.conversation_type === "group" ? "群成员" : activeConversation.title);
                      const senderSubtitle = senderProfile?.subtitle || (isMine ? "我" : "成员");

                      return (
                        <div key={message.message_id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          <div className={`flex max-w-[82%] items-end gap-3 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                            <IMAvatar profile={senderProfile} />

                            <div className={`${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                              {activeConversation.conversation_type === "group" ? (
                                <div className={`flex items-center gap-2 px-1 text-[11px] ${isMine ? "justify-end text-[#ea4c89]" : "text-[#64748b]"}`}>
                                  <span className="font-bold">{isMine ? "我" : senderName}</span>
                                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-[#94a3b8]">
                                    {isMine ? "当前账号" : senderSubtitle}
                                  </span>
                                </div>
                              ) : null}
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
            <button
              type="button"
              onClick={() => setShowCreateGroup((current) => !current)}
              className="flex w-full items-center justify-between rounded-2xl border border-[#f7c8d9] bg-[#fff7fb] px-4 py-3 text-left text-sm font-bold text-[#ea4c89] shadow-sm transition hover:bg-[#fff0f6]"
            >
              <span className="inline-flex items-center gap-2">
                {showCreateGroup ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                创建群聊
              </span>
              <span className="text-xs text-[#c85b84]">{selectedGroupMemberIds.length} 人已选</span>
            </button>

            {showCreateGroup ? (
              <div className="mt-3 rounded-2xl border border-[#edf2f7] bg-white p-3">
                <label className="block">
                  <span className="text-xs font-semibold text-[#64748b]">群聊名称</span>
                  <input
                    value={groupNameDraft}
                    onChange={(event) => setGroupNameDraft(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-[#dbe4ee] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#ea4c89]"
                    placeholder="比如：答辩冲刺小组"
                  />
                </label>

                <div className="mt-3 text-xs font-semibold text-[#64748b]">选择成员</div>
                <div className="mt-2 max-h-[220px] space-y-2 overflow-y-auto pr-1">
                  {newChatCandidates.map((profile) => {
                    const checked = selectedGroupMemberIds.includes(profile.id);
                    return (
                      <button
                        key={`group-${profile.id}`}
                        type="button"
                        onClick={() => toggleGroupMember(profile.id)}
                        className={`flex w-full items-center justify-between rounded-xl border px-2.5 py-2 text-left transition ${
                          checked ? "border-[#f7c8d9] bg-[#fff7fb]" : "border-[#edf2f7] bg-white hover:bg-[#f8fafc]"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <IMAvatar profile={profile} size="sm" />
                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold text-[#111827]">{profile.name}</div>
                            <div className="truncate text-[10px] text-[#94a3b8]">{profile.subtitle}</div>
                          </div>
                        </div>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            checked ? "border-[#ea4c89] bg-[#ea4c89] text-white" : "border-[#dbe4ee] text-transparent"
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleCreateGroupSession}
                  disabled={selectedGroupMemberIds.length < 2}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ea4c89] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Users className="h-4 w-4" />
                  创建并进入群聊
                </button>
              </div>
            ) : null}
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
                    <IMAvatar profile={profile} />
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
                        await markInboxItemRead(effectiveUser.id, item.id);
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
