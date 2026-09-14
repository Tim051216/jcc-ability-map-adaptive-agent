/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle,
  ClipboardCheck,
  Download,
  FileCheck2,
  History,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { RECENT_ACTIVITIES } from "../constants";
import {
  studentApi,
  type GrowthMapResponse,
  type ProfileBehaviorUpdateResponse,
  type ProfileConversationFlowResponse,
  type ProfileConversationMessage,
  type ProfileDimensionData,
  type ProfileHistoryResponse,
  type ProfileSummaryResponse,
  type StudentProfileDetailResponse,
} from "../lib/studentApi";
import { getCurrentLoggedInUserId } from "../lib/currentUser";
const USER_ID = getCurrentLoggedInUserId();
const PROFILE_SECTION_TIMEOUT_MS = 4500;
const PROFILE_PAGE_CACHE_KEY = "a3-profile-page-cache";
const PROFILE_REPORT_STORAGE_KEY = "a3-profile-report-cache";
const PROFILE_PAGE_CACHE_TTL_MS = 10 * 60 * 1000;

type ProfilePageCacheRecord = {
  savedAt: number;
  profileSummary: ProfileSummaryResponse | null;
  profileDetail: StudentProfileDetailResponse | null;
  profileHistory: ProfileHistoryResponse | null;
  growthMap: GrowthMapResponse | null;
};

type ProfileReportCacheRecord = {
  generated: boolean;
  generatedAt: string;
  sbtiCode: string;
};

function getProfileLoadErrorMessage(results: PromiseSettledResult<unknown>[]) {
  const messages = results
    .filter((result) => result.status === "rejected")
    .map((result) => {
      if (result.status !== "rejected") return "";
      return result.reason instanceof Error ? result.reason.message : "岗位能力诊断部分数据加载失败";
    })
    .filter(Boolean);

  return Array.from(new Set(messages)).join("；");
}

function withProfileTimeout<T>(promise: Promise<T>, timeoutMs = PROFILE_SECTION_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("画像数据加载超时")), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function readProfilePageCache(userId: number): ProfilePageCacheRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PROFILE_PAGE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, ProfilePageCacheRecord>;
    const record = parsed[String(userId)];
    if (!record || Date.now() - record.savedAt > PROFILE_PAGE_CACHE_TTL_MS) return null;
    return record;
  } catch {
    return null;
  }
}

function writeProfilePageCache(userId: number, record: Omit<ProfilePageCacheRecord, "savedAt">) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(PROFILE_PAGE_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, ProfilePageCacheRecord>) : {};
    parsed[String(userId)] = {
      ...record,
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(PROFILE_PAGE_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore profile cache failures.
  }
}

function readProfileReportCache(userId: number): ProfileReportCacheRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_REPORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, ProfileReportCacheRecord>;
    const record = parsed[String(userId)];
    return record?.generated ? record : null;
  } catch {
    return null;
  }
}

function writeProfileReportCache(userId: number, record: ProfileReportCacheRecord) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(PROFILE_REPORT_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, ProfileReportCacheRecord>) : {};
    parsed[String(userId)] = record;
    window.localStorage.setItem(PROFILE_REPORT_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore report cache failures. The page can still render the generated report in memory.
  }
}

const CORE_AGENT_OVERVIEW = [
  {
    title: "岗位能力图谱智能体",
    detail: "读取用户画像、阶段状态和学习风格，作为全局个性化输入。",
    routeLabel: "进入画像页",
    route: "/capability",
    status: "在线",
    output: "抽取专业、目标与薄弱点",
    accent: "from-[#fff4f8] to-[#ffffff]",
  },
  {
    title: "全域问答智能体",
    detail: "不仅处理课程知识检索，还支持联网补充信息、多模态分析与连续追问。",
    routeLabel: "进入 AI 助教",
    route: "/tutor?courseId=series-2",
    status: "联动中",
    output: "承接追问、截图与资料理解",
    accent: "from-[#f4f9ff] to-[#ffffff]",
  },
  {
    title: "学习规划智能体",
    detail: "根据目标、画像和进度生成阶段任务与下一步行动建议。",
    routeLabel: "进入学习路径",
    route: "/path?courseId=series-2",
    status: "在线",
    output: "生成下一步学习路径",
    accent: "from-[#fff8f2] to-[#ffffff]",
  },
  {
    title: "资源生成智能体",
    detail: "按当前任务推荐讲义、视频、练习和补充资料。",
    routeLabel: "进入资源中心",
    route: "/resources?courseId=series-2",
    status: "在线",
    output: "补齐讲义、导图、练习",
    accent: "from-[#f7f6ff] to-[#ffffff]",
  },
  {
    title: "测评反馈智能体",
    detail: "综合测评、错题、学习报告和闭环反馈，输出最终诊断。",
    routeLabel: "进入学习报告",
    route: "/report",
    status: "待命",
    output: "定位知识盲区",
    accent: "from-[#f3fbf7] to-[#ffffff]",
  },
  {
    title: "智能复习提醒智能体",
    detail: "按学习节奏自动安排复习时机，并通过站内通知持续提醒你回到关键任务。",
    routeLabel: "进入消息中心",
    route: "/im",
    status: "排队中",
    output: "回推关键复习节点",
    accent: "from-[#f8fafc] to-[#ffffff]",
  },
];

interface CapabilityModelProps {
  user?: {
    id: string;
    name: string;
    avatar: string;
    loggedIn: boolean;
  };
}

type CapabilityAxis = {
  label: string;
  angle: number;
  score: number;
  benchmark: number;
  labelClassName: string;
};

type ConversationalProfileDimension = {
  key: string;
  label: string;
  value: string;
  confidence: "高" | "中" | "待补充";
  completeness: number;
};

const PROFILE_DIMENSION_ORDER = [
  "knowledge_base",
  "cognitive_style",
  "learning_progress",
  "error_preference",
  "interest_direction",
  "learning_habit",
] as const;

const PROFILE_DIMENSION_LABELS: Record<string, string> = {
  knowledge_base: "知识基础",
  cognitive_style: "认知风格",
  learning_progress: "学习进度",
  error_preference: "易错点偏好",
  interest_direction: "兴趣与目标方向",
  learning_habit: "学习习惯",
};

const PROFILE_DIMENSION_HINTS: Record<string, string> = {
  knowledge_base: "系统会判断你当前基础扎实度、先修情况和适合的起步深度。",
  cognitive_style: "系统会识别你更适合图解、案例、框架还是分步式理解。",
  learning_progress: "系统会结合历史学习与近期表现判断你所处阶段和推进节奏。",
  error_preference: "系统会追踪你常见卡点、错因类型与容易反复出错的知识点。",
  interest_direction: "系统会结合专业、目标和场景偏好判断更适合的学习方向。",
  learning_habit: "系统会识别你适合碎片化还是集中式学习，以及提醒强度。",
};

const SBTI_PROFILE_LABELS: Record<string, { title: string; subtitle: string }> = {
  SPTA: {
    title: "稳态实战型",
    subtitle: "结构化推进与实践验证",
  },
  STCA: {
    title: "体系建构型",
    subtitle: "先搭框架，再进入应用",
  },
  ETFI: {
    title: "探索反馈型",
    subtitle: "试错、反馈、快速修正",
  },
  SPCI: {
    title: "节奏推进型",
    subtitle: "主线清晰，渐进提升",
  },
};

const SBTI_LETTER_GUIDE: Record<string, { label: string; description: string }> = {
  S: { label: "稳态", description: "学习节奏相对稳定，适合以清晰主线持续推进。" },
  P: { label: "实战", description: "更容易通过项目、练习和即时验证把知识转成能力。" },
  T: { label: "任务", description: "需要明确目标、步骤和验收标准来降低学习摩擦。" },
  A: { label: "行动", description: "适合把结论快速落到下一步动作，而不是停留在概念层。" },
  C: { label: "建构", description: "更依赖框架、结构和概念关系来形成长期理解。" },
  E: { label: "探索", description: "对新问题和开放式任务更敏感，适合先尝试再校准。" },
  F: { label: "反馈", description: "需要高频反馈来修正理解偏差和保持学习投入。" },
  I: { label: "内化", description: "适合通过复盘、解释和再表达把知识沉淀下来。" },
};

const FALLBACK_AXES: CapabilityAxis[] = [
  { label: "规划能力", angle: -90, score: 70, benchmark: 62, labelClassName: "absolute top-1 left-1/2 -translate-x-1/2" },
  { label: "执行效率", angle: -18, score: 85, benchmark: 72, labelClassName: "absolute top-[35%] left-[78%]" },
  { label: "学习持续力", angle: 54, score: 90, benchmark: 76, labelClassName: "absolute bottom-[14%] left-[60%]" },
  { label: "认知广度", angle: 126, score: 60, benchmark: 68, labelClassName: "absolute bottom-[14%] right-[60%]" },
  { label: "成果输出", angle: 198, score: 75, benchmark: 64, labelClassName: "absolute top-[35%] right-[78%]" },
];

function polarToCartesian(value: number, angle: number) {
  const radius = 34 * value;
  const radians = (angle * Math.PI) / 180;
  return {
    x: 50 + radius * Math.cos(radians),
    y: 50 + radius * Math.sin(radians),
  };
}

function buildPolygonPoints(values: number[], axes: CapabilityAxis[]) {
  return values
    .map((value, index) => {
      const point = polarToCartesian(value, axes[index].angle);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function normalizeRatio(value?: number | null, fallback = 0.5) {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  if (value > 1) return Math.min(1, value / 100);
  return Math.max(0, Math.min(1, value));
}

function buildAxesFromProfile(profile: ProfileSummaryResponse | null): CapabilityAxis[] {
  const dimensions = profile?.dimension_completeness || {};
  const execution = normalizeRatio(dimensions.execution_rate, 0.85);
  const planning = normalizeRatio(dimensions.planning, 0.72);
  const persistence = normalizeRatio(dimensions.persistence, 0.88);
  const cognition = normalizeRatio(dimensions.cognition_breadth, 0.63);
  const output = normalizeRatio(dimensions.output_quality, 0.77);

  return [
    { label: "规划能力", angle: -90, score: Math.round(planning * 100), benchmark: 62, labelClassName: "absolute top-1 left-1/2 -translate-x-1/2" },
    { label: "执行效率", angle: -18, score: Math.round(execution * 100), benchmark: 72, labelClassName: "absolute top-[35%] left-[78%]" },
    { label: "学习持续力", angle: 54, score: Math.round(persistence * 100), benchmark: 76, labelClassName: "absolute bottom-[14%] left-[60%]" },
    { label: "认知广度", angle: 126, score: Math.round(cognition * 100), benchmark: 68, labelClassName: "absolute bottom-[14%] right-[60%]" },
    { label: "成果输出", angle: 198, score: Math.round(output * 100), benchmark: 64, labelClassName: "absolute top-[35%] right-[78%]" },
  ];
}

function getStageText(value?: string | null) {
  const normalized = (value || "").toLowerCase();
  if (!normalized) return "待画像反馈";
  if (normalized.includes("advanced") || normalized.includes("deep")) return "深化提升阶段";
  if (normalized.includes("stable")) return "稳定巩固阶段";
  if (normalized.includes("start") || normalized.includes("begin")) return "起步适应阶段";
  return value || "待画像反馈";
}

function getFriendlyStyle(value?: string | null) {
  if (!value) return "当前画像未返回学习风格";
  return value;
}

function formatDimensionValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => formatDimensionValue(item))
      .filter(Boolean)
      .join("、");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const rendered = formatDimensionValue(item);
        if (!rendered) return "";
        return `${key}：${rendered}`;
      })
      .filter(Boolean);
    return entries.join("；");
  }
  return "";
}

function normalizeDimensionCard(
  dimensionCode: string,
  detailMap: Map<string, ProfileDimensionData>,
  extractionMap: Map<string, string>,
): ConversationalProfileDimension {
  const detail = detailMap.get(dimensionCode);
  const label = PROFILE_DIMENSION_LABELS[dimensionCode] || detail?.dimension_name || dimensionCode;
  const value =
    formatDimensionValue(detail?.data) ||
    extractionMap.get(dimensionCode) ||
    PROFILE_DIMENSION_HINTS[dimensionCode] ||
    "当前还在继续采集这个维度的信息。";
  const completeness = detail?.completeness ?? (extractionMap.has(dimensionCode) ? 72 : 28);
  const confidence: ConversationalProfileDimension["confidence"] =
    completeness >= 85 ? "高" : completeness >= 55 ? "中" : "待补充";

  return {
    key: dimensionCode,
    label,
    value,
    confidence,
    completeness,
  };
}

function buildRealConversationalDimensions(
  profileDetail: StudentProfileDetailResponse | null,
  extractionResult?: ProfileConversationFlowResponse["extraction_result"] | null,
) {
  const detailMap = new Map((profileDetail?.dimensions || []).map((item) => [item.dimension_code, item]));
  const extractionMap = new Map<string, string>();

  for (const item of extractionResult?.extracted_info || []) {
    const current = extractionMap.get(item.dimension) || "";
    const nextText = item.info_value?.trim();
    if (!nextText) continue;
    extractionMap.set(item.dimension, current ? `${current}；${nextText}` : nextText);
  }

  return PROFILE_DIMENSION_ORDER.map((dimensionCode) =>
    normalizeDimensionCard(dimensionCode, detailMap, extractionMap),
  );
}

function getHistoryTypeLabel(changeType: number) {
  if (changeType === 1) return "首次建档";
  if (changeType === 2) return "对话重建";
  if (changeType === 3) return "学习回写";
  return "画像更新";
}

function formatProfileMessageTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatProfileReportTime(value?: string | null) {
  if (!value) return "未生成";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "已保存";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeReportHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeReportFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 80);
}

function triggerReportDownload(fileName: string, html: string) {
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName.endsWith(".doc") ? fileName : `${fileName}.doc`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

function getSbtiSnapshot(profile: ProfileSummaryResponse | null) {
  const code = String(profile?.sbti_code || "SPTA").toUpperCase();
  const matched = SBTI_PROFILE_LABELS[code] || SBTI_PROFILE_LABELS.SPTA;
  return {
    code,
    title: matched.title,
    subtitle: matched.subtitle,
  };
}

export default function CapabilityModel({ user }: CapabilityModelProps = {}) {
  const navigate = useNavigate();
  const activeUserId = user?.id && /^\d+$/.test(user.id) ? Number(user.id) : getCurrentLoggedInUserId();
  const radarCardRef = useRef<HTMLDivElement | null>(null);
  const profileReportRef = useRef<HTMLElement | null>(null);
  const persistedReport = readProfileReportCache(activeUserId);
  const [radarProgress, setRadarProgress] = useState(0);
  const [shouldAnimateRadar, setShouldAnimateRadar] = useState(false);
  const [profileReportGenerated, setProfileReportGenerated] = useState(Boolean(persistedReport));
  const [profileReportGeneratedAt, setProfileReportGeneratedAt] = useState<string | null>(persistedReport?.generatedAt || null);
  const [profileSummary, setProfileSummary] = useState<ProfileSummaryResponse | null>(null);
  const [lastBehaviorUpdate, setLastBehaviorUpdate] = useState<ProfileBehaviorUpdateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [writingBehavior, setWritingBehavior] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [growthMap, setGrowthMap] = useState<GrowthMapResponse | null>(null);
  const [profileDetail, setProfileDetail] = useState<StudentProfileDetailResponse | null>(null);
  const [profileHistory, setProfileHistory] = useState<ProfileHistoryResponse | null>(null);
  const [conversationSessionId, setConversationSessionId] = useState<number | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ProfileConversationMessage[]>([]);
  const [conversationInput, setConversationInput] = useState("");
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationCompleting, setConversationCompleting] = useState(false);
  const [conversationFlow, setConversationFlow] = useState<ProfileConversationFlowResponse | null>(null);
  const [conversationStatusMessage, setConversationStatusMessage] = useState<string | null>(null);
  const [conversationErrorMessage, setConversationErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const target = radarCardRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldAnimateRadar(true);
          observer.disconnect();
        }
      },
      { threshold: 0.45 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldAnimateRadar) return;

    let frameId = 0;
    const startedAt = performance.now();
    const duration = 1400;

    const animate = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setRadarProgress(eased);
      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [shouldAnimateRadar]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const loadProfile = async ({ silent = false }: { silent?: boolean } = {}) => {
    const cachedProfile = !silent ? readProfilePageCache(activeUserId) : null;
    if (cachedProfile) {
      setProfileSummary(cachedProfile.profileSummary);
      setProfileDetail(cachedProfile.profileDetail);
      setProfileHistory(cachedProfile.profileHistory);
      setGrowthMap(cachedProfile.growthMap);
      setUsingFallback(!cachedProfile.profileSummary && !cachedProfile.profileDetail);
    }

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(!cachedProfile);
    }
    setError(null);

    try {
      const [profileResult, detailResult, historyResult, growthResult] = await Promise.allSettled([
        withProfileTimeout(studentApi.getProfileSummary(activeUserId)),
        withProfileTimeout(studentApi.getProfileDetail(activeUserId)),
        withProfileTimeout(studentApi.getProfileHistory(activeUserId, 8)),
        withProfileTimeout(studentApi.getGrowthMap(401, activeUserId)),
      ]);

      const profile = profileResult.status === "fulfilled" ? profileResult.value : null;
      const detail = detailResult.status === "fulfilled" ? detailResult.value : null;
      const history = historyResult.status === "fulfilled" ? historyResult.value : null;
      const growth = growthResult.status === "fulfilled" ? growthResult.value : null;

      setProfileSummary(profile);
      setProfileDetail(detail);
      setProfileHistory(history);
      setGrowthMap(growth);
      if (profile || detail || history || growth) {
        writeProfilePageCache(activeUserId, {
          profileSummary: profile,
          profileDetail: detail,
          profileHistory: history,
          growthMap: growth,
        });
      }

      const hasCoreProfileData = Boolean(profile || detail);
      const failedResults = [profileResult, detailResult, historyResult, growthResult].filter(
        (result) => result.status === "rejected",
      );

      setUsingFallback(!hasCoreProfileData);
      setError(!hasCoreProfileData && failedResults.length > 0 ? getProfileLoadErrorMessage(failedResults) : null);
    } catch (loadError) {
      setProfileSummary(null);
      setProfileDetail(null);
      setProfileHistory(null);
      setGrowthMap(null);
      setUsingFallback(true);
      setError(loadError instanceof Error ? loadError.message : "岗位能力诊断加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [activeUserId]);

  const ensureConversationSession = async () => {
    if (conversationSessionId) return conversationSessionId;
    const session = await studentApi.startProfileConversation({
      user_id: activeUserId,
      session_type: profileDetail ? 2 : 1,
    });
    setConversationSessionId(session.session_id);
    setConversationMessages(session.messages || []);
    return session.session_id;
  };

  const handleStartConversation = async () => {
    setConversationLoading(true);
    setError(null);
    setConversationErrorMessage(null);
    setConversationStatusMessage("正在创建画像对话会话...");
    try {
      const session = await studentApi.startProfileConversation({
        user_id: activeUserId,
        session_type: profileDetail ? 2 : 1,
      });
      setConversationSessionId(session.session_id);
      setConversationMessages(session.messages || []);
      setConversationFlow(null);
      setConversationStatusMessage("会话已创建，输入一段自然语言后系统会抽取画像维度。");
      setToastMessage("画像对话已开启，请直接用自然语言描述你的专业、目标和学习情况。");
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : "开启画像对话失败";
      setError(message);
      setConversationErrorMessage(message);
      setConversationStatusMessage(null);
    } finally {
      setConversationLoading(false);
    }
  };

  const handleSendConversationMessage = async () => {
    const content = conversationInput.trim();
    if (!content) return;

    setConversationLoading(true);
    setError(null);
    setConversationErrorMessage(null);
    setConversationStatusMessage("正在创建/确认画像会话...");
    try {
      const sessionId = await ensureConversationSession();
      const optimisticUserMessage: ProfileConversationMessage = {
        message_id: Date.now(),
        role: "user",
        content,
        round_number: conversationMessages.filter((item) => item.role === "user").length + 1,
        message_type: 1,
        related_dimension: null,
        created_at: new Date().toISOString(),
      };
      setConversationMessages((current) => [...current, optimisticUserMessage]);
      setConversationInput("");
      setConversationStatusMessage("已收到回答，正在抽取知识基础、学习节奏、卡点和目标方向...");

      const response = await studentApi.sendProfileConversationMessage({
        session_id: sessionId,
        content,
      });
      setConversationFlow(response);
      setConversationMessages((current) => {
        const deduped = current.filter((item) => item.message_id !== optimisticUserMessage.message_id);
        return [...deduped, optimisticUserMessage, response.assistant_message];
      });
      const extractedCount = response.extraction_result?.extracted_info?.length || 0;
      setConversationStatusMessage(
        extractedCount
          ? `本轮已抽取 ${extractedCount} 条画像信号，当前完整度 ${response.completeness}%。`
          : `本轮已完成分析，当前完整度 ${response.completeness}%。`,
      );
      if (!response.should_continue && response.completeness >= 60) {
        setToastMessage("六维画像信息已基本齐全，可以生成正式学生画像。");
      } else {
        setToastMessage("回答已写入画像对话，右侧维度监控已刷新。");
      }
    } catch (messageError) {
      const message = messageError instanceof Error ? messageError.message : "发送画像对话失败";
      setError(message);
      setConversationErrorMessage(message);
      setConversationStatusMessage(null);
    } finally {
      setConversationLoading(false);
    }
  };

  const handleCompleteConversation = async () => {
    if (!conversationSessionId) return;

    setConversationCompleting(true);
    setError(null);
    setConversationErrorMessage(null);
    setConversationStatusMessage("正在生成正式画像并同步到路径、资源、测评和答疑...");
    try {
      const detail = await studentApi.completeProfileConversation({
        session_id: conversationSessionId,
        force_complete: false,
      });
      setProfileDetail(detail);
      await loadProfile({ silent: true });
      setConversationStatusMessage(`正式画像已生成，当前完整度 ${detail.completeness}%。`);
      setToastMessage("学生画像已正式生成，并已接入后续路径、资源、测评和答疑链路。");
    } catch (completeError) {
      const message = completeError instanceof Error ? completeError.message : "完成画像构建失败";
      setError(message);
      setConversationErrorMessage(message);
      setConversationStatusMessage(null);
    } finally {
      setConversationCompleting(false);
    }
  };

  const handleBehaviorSync = async () => {
    setWritingBehavior(true);
    setError(null);
    try {
      const result = await studentApi.reportProfileBehavior({
        user_id: USER_ID,
        behavior_type: 2,
        behavior_data: {
          scene: "student_profile_page",
          action: "manual_refresh",
          tags: profileSummary?.tags || [],
          current_stage: profileSummary?.current_stage || null,
        },
        result: "profile_manual_sync",
        duration: 60,
      });
      setLastBehaviorUpdate(result);
      await loadProfile({ silent: true });
      setConversationFlow(null);
      setToastMessage("画像行为已回写，摘要已重新同步。");
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "画像回写失败");
      setToastMessage("真实回写失败，页面仍保留当前画像与 fallback 提示。");
    } finally {
      setWritingBehavior(false);
    }
  };

  const axes = useMemo(() => (profileSummary ? buildAxesFromProfile(profileSummary) : FALLBACK_AXES), [profileSummary]);
  const radarSourceLabel = profileSummary
    ? "当前使用实时画像 summary 指标"
    : profileDetail
      ? "画像详情已接入，雷达等待 summary 同步"
      : "当前使用页面内 fallback 指标";
  const animatedScores = useMemo(() => axes.map((axis) => (axis.score / 100) * radarProgress), [axes, radarProgress]);
  const benchmarkScores = useMemo(() => axes.map((axis) => axis.benchmark / 100), [axes]);
  const overallScore = useMemo(
    () => Math.round(axes.reduce((sum, axis) => sum + axis.score, 0) / axes.length),
    [axes],
  );
  const strongestAxis = useMemo(
    () => axes.reduce((best, axis) => (axis.score > best.score ? axis : best), axes[0]),
    [axes],
  );
  const weakestAxis = useMemo(
    () => axes.reduce((weakest, axis) => (axis.score < weakest.score ? axis : weakest), axes[0]),
    [axes],
  );
  const animatedPolygonPoints = useMemo(() => buildPolygonPoints(animatedScores, axes), [animatedScores, axes]);
  const benchmarkPolygonPoints = useMemo(() => buildPolygonPoints(benchmarkScores, axes), [benchmarkScores, axes]);
  const autoConversationDimensions = useMemo(
    () => buildRealConversationalDimensions(profileDetail, conversationFlow?.extraction_result),
    [profileDetail, conversationFlow?.extraction_result],
  );
  const extractedConversationSignals = conversationFlow?.extraction_result?.extracted_info || [];
  const portraitInsightCards = useMemo(() => {
    const dimensions = [...(growthMap?.dimensions || [])].sort((a, b) => b.score - a.score);
    const strongestDimension = dimensions[0];
    const weakestDimension = dimensions[dimensions.length - 1];

    return [
      {
        key: "strength",
        eyebrow: "系统识别的优势",
        title: strongestDimension?.label || strongestAxis.label,
        description:
          strongestDimension?.evidence ||
          `系统判断你当前最稳定的能力落在 ${strongestAxis.label}，后续会优先围绕这项能力继续放大优势。`,
        tone: "from-[#fff6fa] to-[#ffffff]",
      },
      {
        key: "weakness",
        eyebrow: "系统识别的卡点",
        title: weakestDimension?.label || "当前仍需补齐的能力项",
        description:
          weakestDimension?.evidence || "系统会优先把这部分补进后续的资料推荐、练习生成和答疑重点里。",
        tone: "from-[#f7fbff] to-[#ffffff]",
      },
      {
        key: "style",
        eyebrow: "系统识别的学习方式",
        title: getFriendlyStyle(profileSummary?.recommended_learning_style),
        description: "后续的学习路径、内容讲解和随堂动作会优先按这种节奏与表达方式来组织。",
        tone: "from-[#fffaf1] to-[#ffffff]",
      },
      {
        key: "action",
        eyebrow: "系统下一步动作",
        title: "把这份画像同步到路径、资源、测评与答疑",
        description:
          growthMap?.next_milestone || "接下来系统会根据这份画像动态调整推荐顺序，而不是让所有人都看同一套内容。",
        tone: "from-[#f4fbff] to-[#ffffff]",
      },
    ];
  }, [growthMap, profileSummary?.recommended_learning_style, strongestAxis]);

  const portraitInterpretation = useMemo(() => {
    const style = getFriendlyStyle(profileSummary?.recommended_learning_style);
    const strongest = portraitInsightCards[0]?.title || strongestAxis.label;
    const weakest = portraitInsightCards[1]?.title || "需要补齐的能力项";
    const stage = getStageText(profileSummary?.current_stage);

    return {
      subtitle: growthMap?.title || `你当前处于${stage}，更适合用“${style}”继续推进`,
      summary:
        growthMap?.summary ||
      `系统判断你现在最突出的优势是“${strongest}”，但在“${weakest}”上还需要继续补强。接下来更适合先沿着当前节奏稳住优势，再通过针对性练习和资料补齐薄弱点。`,
    };
  }, [
    growthMap?.summary,
    growthMap?.title,
    portraitInsightCards,
    profileSummary?.current_stage,
    profileSummary?.recommended_learning_style,
    strongestAxis.label,
  ]);
  const profileEvidenceCards = useMemo(() => {
    const dimensions = [...(growthMap?.dimensions || [])].sort((a, b) => b.score - a.score);
    const strongestDimension = dimensions[0];
    const weakestDimension = dimensions[dimensions.length - 1];
    const recentProfileChange = profileHistory?.history?.[0];
    const stage = getStageText(profileSummary?.current_stage);
    const style = getFriendlyStyle(profileSummary?.recommended_learning_style);

    return [
      {
        key: "assessment",
        title: "测评数据",
        label: "知识掌握信号",
        icon: ClipboardCheck,
        description:
          weakestDimension?.evidence ||
          "测评得分、错题类型和薄弱知识点会写入画像，用来判断当前掌握程度与优先补齐方向。",
        result: weakestDimension?.label ? `重点关注：${weakestDimension.label}` : `当前阶段：${stage}`,
        tone: "from-[#fff4f8] to-[#ffffff]",
      },
      {
        key: "behavior",
        title: "学习行为",
        label: "学习偏好信号",
        icon: BookOpen,
        description:
          recentProfileChange?.change_description ||
          "课程学习、资源浏览、收藏、提问和停留节奏会持续回写，用来识别更适合的讲解方式与学习节奏。",
        result: `学习方式：${style}`,
        tone: "from-[#f4fbff] to-[#ffffff]",
      },
      {
        key: "assignment",
        title: "作业表现",
        label: "成果输出信号",
        icon: FileCheck2,
        description:
          strongestDimension?.evidence ||
          "练习提交、项目输出和实操反馈会进入成果输出与执行效率维度，帮助系统判断能否把知识真正用起来。",
        result: `当前优势：${strongestDimension?.label || strongestAxis.label}`,
        tone: "from-[#fffaf1] to-[#ffffff]",
      },
      {
        key: "judgement",
        title: "画像判断",
        label: "个性化结论",
        icon: Target,
        description:
          profileSummary?.key_features ||
          "岗位学情诊断智能体把这些信号汇总成当前阶段、能力强弱项和学习偏好，再同步给路径、资源、测评与 学习助手。",
        result: `画像完整度：${profileSummary?.completeness ?? overallScore}%`,
        tone: "from-[#f5f7ff] to-[#ffffff]",
      },
    ];
  }, [
    growthMap?.dimensions,
    overallScore,
    profileHistory?.history,
    profileSummary?.completeness,
    profileSummary?.current_stage,
    profileSummary?.key_features,
    profileSummary?.recommended_learning_style,
    strongestAxis.label,
  ]);
  const sbtiSnapshot = useMemo(() => getSbtiSnapshot(profileSummary), [profileSummary]);
  const sbtiBreakdown = useMemo(
    () =>
      sbtiSnapshot.code.split("").map((letter) => ({
        letter,
        ...(SBTI_LETTER_GUIDE[letter] || { label: "画像维度", description: "系统会结合当前数据继续补充这一维度的解释。" }),
      })),
    [sbtiSnapshot.code],
  );
  const reportActionPlan = useMemo(
    () => [
      {
        title: `先放大${strongestAxis.label}`,
        detail: `当前最高维度是 ${strongestAxis.label}，建议把它作为主线能力，用讲义、项目练习和 AI 答疑继续巩固。`,
      },
      {
        title: `再补齐${weakestAxis.label}`,
        detail: `当前相对薄弱的是 ${weakestAxis.label}，后续路径会优先安排短练习、错题复盘和针对性资源。`,
      },
      {
        title: "用 SPTA 节奏推进",
        detail: `${sbtiSnapshot.title}更适合“明确任务 - 动手验证 - 反馈修正”的闭环，避免只看内容不产出。`,
      },
    ],
    [sbtiSnapshot.title, strongestAxis.label, weakestAxis.label],
  );
  const handleGenerateProfileReport = () => {
    const generatedAt = new Date().toISOString();
    setProfileReportGenerated(true);
    setProfileReportGeneratedAt(generatedAt);
    writeProfileReportCache(activeUserId, {
      generated: true,
      generatedAt,
      sbtiCode: sbtiSnapshot.code,
    });
    setToastMessage("画像报告已生成，正在定位到报告区。");
    window.setTimeout(() => {
      profileReportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const handleExportProfileReport = () => {
    if (!profileReportGenerated) {
      setToastMessage("请先生成画像报告，再导出。");
      return;
    }

    const savedAt = formatProfileReportTime(profileReportGeneratedAt);
    const reportTitle = `${sbtiSnapshot.code} · ${sbtiSnapshot.title}画像解读报告`;
    const axisRows = axes
      .map(
        (axis) => `
          <tr>
            <td>${escapeReportHtml(axis.label)}</td>
            <td>${escapeReportHtml(axis.score)}</td>
            <td>${escapeReportHtml(axis.benchmark)}</td>
          </tr>
        `,
      )
      .join("");
    const sbtiRows = sbtiBreakdown
      .map(
        (item) => `
          <tr>
            <td>${escapeReportHtml(item.letter)}</td>
            <td>${escapeReportHtml(item.label)}</td>
            <td>${escapeReportHtml(item.description)}</td>
          </tr>
        `,
      )
      .join("");
    const evidenceRows = profileEvidenceCards
      .map(
        (item) => `
          <tr>
            <td>${escapeReportHtml(item.title)}</td>
            <td>${escapeReportHtml(item.result)}</td>
            <td>${escapeReportHtml(item.description)}</td>
          </tr>
        `,
      )
      .join("");
    const actionItems = reportActionPlan
      .map((item, index) => `<li><strong>${index + 1}. ${escapeReportHtml(item.title)}</strong><br />${escapeReportHtml(item.detail)}</li>`)
      .join("");
    const tagText = (profileSummary?.tags?.length ? profileSummary.tags : ["中级学习者", "结构化笔记", "动手验证"])
      .slice(0, 6)
      .join("、");

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeReportHtml(reportTitle)}</title>
          <style>
            body { font-family: "Microsoft YaHei", Arial, sans-serif; color: #171c22; line-height: 1.75; padding: 32px; }
            h1 { font-size: 26px; margin: 0 0 8px; }
            h2 { margin: 28px 0 10px; font-size: 18px; color: #fb7299; }
            .meta { color: #64748b; font-size: 13px; margin-bottom: 22px; }
            .summary { border: 1px solid #ffd6e3; background: #fff7fa; border-radius: 16px; padding: 16px; }
            .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0; }
            .metric { border: 1px solid #e5edf5; border-radius: 14px; padding: 12px; background: #fbfdff; }
            .label { color: #64748b; font-size: 12px; }
            .value { font-size: 18px; font-weight: 800; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border: 1px solid #e5edf5; padding: 9px 10px; text-align: left; vertical-align: top; }
            th { background: #fff4f8; color: #c25179; }
            li { margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <h1>${escapeReportHtml(reportTitle)}</h1>
          <div class="meta">岗位能力诊断导出 · 用户：${escapeReportHtml(user?.name || "BiliLearn 用户")} · 保存于：${escapeReportHtml(savedAt)}</div>

          <div class="summary">
            <strong>${escapeReportHtml(portraitInterpretation.subtitle)}</strong>
            <p>${escapeReportHtml(portraitInterpretation.summary)}</p>
          </div>

          <div class="metrics">
            <div class="metric"><div class="label">画像完整度</div><div class="value">${escapeReportHtml(overallScore)}%</div></div>
            <div class="metric"><div class="label">当前阶段</div><div class="value">${escapeReportHtml(getStageText(profileSummary?.current_stage))}</div></div>
            <div class="metric"><div class="label">学习风格</div><div class="value">${escapeReportHtml(getFriendlyStyle(profileSummary?.recommended_learning_style))}</div></div>
          </div>

          <h2>一、画像标签</h2>
          <p>${escapeReportHtml(tagText)}</p>

          <h2>二、SPTA 拆解</h2>
          <table>
            <thead><tr><th>字母</th><th>画像含义</th><th>解释</th></tr></thead>
            <tbody>${sbtiRows}</tbody>
          </table>

          <h2>三、五维能力分析</h2>
          <table>
            <thead><tr><th>维度</th><th>当前分</th><th>基线</th></tr></thead>
            <tbody>${axisRows}</tbody>
          </table>

          <h2>四、证据链</h2>
          <table>
            <thead><tr><th>来源</th><th>结果</th><th>说明</th></tr></thead>
            <tbody>${evidenceRows}</tbody>
          </table>

          <h2>五、后续行动</h2>
          <ol>${actionItems}</ol>
        </body>
      </html>
    `;

    const fileName = sanitizeReportFileName(`BiliLearn-${sbtiSnapshot.code}-画像报告-${new Date().toISOString().slice(0, 10)}`);
    triggerReportDownload(fileName, html);
    setToastMessage("画像报告已开始导出。");
  };

  return (
    <div className="space-y-4 select-none" id="capability-profile-workspace">
      <section className="overflow-hidden rounded-[28px] border border-[#E3E8EC] bg-[linear-gradient(135deg,#ffffff_0%,#fff8fb_55%,#f4fbff_100%)] p-3.5 shadow-[0_16px_34px_rgba(15,23,42,0.05)]">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ffd6e3] bg-white/88 px-3 py-1.5 shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-[#fb7299]" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#fb7299]">画像中心</span>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-[0.18em] ${
                usingFallback ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {usingFallback ? "稳定摘要" : "实时画像"}
            </span>
          </div>

          <div className="min-w-0 rounded-full border border-[#d9edf3] bg-white/84 px-3 py-1 text-[10px] font-bold text-[#0f6c7b] shadow-sm">
            系统自动构建并持续更新
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_248px]">
          <div className="rounded-[24px] border border-white/80 bg-white/86 p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)] backdrop-blur-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
              <div className="flex items-center gap-3">
                {user?.avatar ? (
                  <div className="h-16 w-16 overflow-hidden rounded-[20px] border border-[#f3d4dc] bg-white shadow-sm">
                    <img
                      src={user.avatar}
                      alt={user.name || "学生头像"}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : null}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-[0.24em] text-[#fb7299]">岗位能力图谱</span>
                    <span className="rounded-full bg-[#171c22] px-2.5 py-1 text-[10px] font-black tracking-[0.14em] text-white">
                      {sbtiSnapshot.code}
                    </span>
                  </div>
                  <h1 className="mt-1.5 text-[22px] font-black leading-tight tracking-[-0.05em] text-[#171c22]">
                    {user?.name || "学习者"}的岗位能力图谱
                  </h1>
                  <p className="mt-1.5 text-sm font-extrabold text-[#2b1f24]">
                    {sbtiSnapshot.title} · {sbtiSnapshot.subtitle}
                  </p>
                  <div className="mt-2 max-w-3xl rounded-[18px] border border-[#f3dce4] bg-[linear-gradient(135deg,#fff7fa_0%,#f8fbff_100%)] px-3.5 py-3 shadow-[0_10px_24px_rgba(251,114,153,0.08)]">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#fb7299]">岗位能力结论</p>
                    <p className="mt-1.5 text-[15px] font-extrabold leading-6 text-[#2b1f24]">
                      {profileSummary?.key_features ||
                        "这份画像不是手填表单，而是系统根据课程学习、资源浏览、测评反馈和自然语言提问自动生成，并持续影响后续的路径、资料、答疑与练习。"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 rounded-[22px] border border-[#edf1f5] bg-[linear-gradient(135deg,rgba(255,246,250,0.92)_0%,rgba(247,251,255,0.96)_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#fb7299]">当前阶段</p>
                    <p className="mt-1 text-sm font-extrabold text-[#171c22]">{getStageText(profileSummary?.current_stage)}</p>
                  </div>
                  <div className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#0f6c7b] shadow-sm">
                    完整度 {overallScore}%
                  </div>
                </div>
                <p className="text-[11px] leading-5 text-[#564145]">
                  {getFriendlyStyle(profileSummary?.recommended_learning_style)}
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/80">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#fb7299,#38bdf8)]"
                    style={{ width: `${Math.max(18, overallScore)}%` }}
                  />
                </div>
                <p className="text-[11px] leading-5 text-[#64748b]">
                  当前优势维度：{strongestAxis.label}
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2">
              {(profileSummary?.tags?.length ? profileSummary.tags : ["中级学习者", "结构化笔记", "动手验证", "steady 节奏"]).slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[#f1d7df] bg-[#fff7fa] px-3 py-1 text-[11px] font-bold text-[#7a5862]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => void loadProfile({ silent: true })}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-[#E3E8EC] bg-white px-4 py-2.5 text-sm font-bold text-[#171c22] shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                刷新画像
              </button>
              <button
                onClick={() => void handleBehaviorSync()}
                disabled={writingBehavior}
                className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-[#fb7299]/25 bg-[#fff4f8] px-4 py-2.5 text-sm font-bold text-[#fb7299] shadow-sm hover:bg-[#ffe8f0] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className={`h-4 w-4 ${writingBehavior ? "animate-pulse" : ""}`} />
                回写画像
              </button>
              <button
                onClick={handleGenerateProfileReport}
                className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-[#d9edf3] bg-[#f4fbff] px-4 py-2.5 text-sm font-bold text-[#0f6c7b] shadow-sm hover:bg-[#eaf7fb]"
              >
                <ArrowRight className="h-4 w-4" />
                生成画像报告
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-[#E3E8EC] bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ffd6e3] bg-[#fff7fa] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#fb7299]">
              <Sparkles className="h-3.5 w-3.5" />
              岗位学情诊断智能体
            </div>
            <h2 className="mt-2 text-[20px] font-black tracking-[-0.04em] text-[#171c22]">
              从测评、行为和作业表现生成学生画像
            </h2>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#64748b]">
              页面会把输入信号、判断依据和画像输出放在同一条链路里：先识别知识掌握程度和学习偏好，再把结果同步给路径、资源、测评与 学习助手。
            </p>
          </div>
          <div className="rounded-[18px] border border-[#d9edf3] bg-[#f4fbff] px-3.5 py-2.5 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0f6c7b]">当前结论</p>
            <p className="mt-1 text-sm font-extrabold text-[#171c22]">
              {getStageText(profileSummary?.current_stage)} · {strongestAxis.label}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {profileEvidenceCards.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className={`rounded-[24px] border border-[#edf1f5] bg-[linear-gradient(135deg,var(--tw-gradient-stops))] ${item.tone} p-4 shadow-[0_10px_24px_rgba(148,163,184,0.06)]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-white/80 bg-white text-[#171c22] shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-white/86 px-2.5 py-1 text-[10px] font-black text-[#6b7280] shadow-sm">
                    {item.label}
                  </span>
                </div>
                <h3 className="mt-3 text-[15px] font-black text-[#171c22]">{item.title}</h3>
                <p className="mt-2 min-h-[72px] text-xs leading-6 text-[#52606f]">{item.description}</p>
                <div className="mt-3 rounded-[16px] border border-white/80 bg-white/82 px-3 py-2 text-xs font-extrabold text-[#2b1f24] shadow-sm">
                  {item.result}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[32px] border border-[#E3E8EC] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff4f8] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#fb7299]">
              对话式建画像
            </div>
            <h2 className="mt-3 text-2xl font-black ui-tracking-tight text-[#171c22]">
              系统自动构建动态学生画像
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[#564145]">
              系统会结合你在课程学习、资源浏览、测评反馈和提问过程中的自然语言与行为数据，自动抽取不少于 6 个维度，并在后续学习过程中持续刷新。
            </p>
          </div>
          <div className="rounded-2xl border border-[#e8eef5] bg-[#f8fbff] px-4 py-3 text-xs text-[#4b5563]">
            当前已支持维度：知识基础 / 认知风格 / 学习进度 / 易错点偏好 / 兴趣与目标方向 / 学习习惯
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
          <div className="rounded-[28px] border border-[#edf1f5] bg-[linear-gradient(180deg,#ffffff,#fbfdff)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e5edf6] bg-[#f8fbff] px-4 py-4 text-sm leading-7 text-[#334155]">
              <div>
                <div className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#7c8aa5]">
                  画像对话入口
                </div>
                不需要填写表单，直接用自然语言描述你的专业、学习目标、过往基础、常见卡点和学习节奏，系统会自动抽取特征并追问缺失维度。
              </div>
              <button
                onClick={() => void handleStartConversation()}
                disabled={conversationLoading}
                className="inline-flex items-center gap-2 rounded-full border border-[#fb7299]/20 bg-white px-4 py-2 text-xs font-bold text-[#fb7299] shadow-sm hover:bg-[#fff7fa] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className={`h-4 w-4 ${conversationLoading ? "animate-pulse" : ""}`} />
                {conversationSessionId ? "重新开启对话" : "开始对话建画像"}
              </button>
            </div>

            <div className="mt-4 rounded-[24px] border border-[#edf1f5] bg-white">
              <div className="border-b border-[#eef2f6] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a94a3]">自然语言画像对话</div>
                    <p className="mt-1 text-sm font-bold text-[#171c22]">
                      {conversationSessionId ? "系统正在持续补全你的岗位学情诊断" : "先发起一轮自然语言对话，系统再自动补全岗位诊断"}
                    </p>
                  </div>
                  <div className="rounded-full bg-[#eef7ff] px-3 py-1 text-[11px] font-black text-[#0f6c7b]">
                    当前完整度 {conversationFlow?.completeness ?? profileDetail?.completeness ?? profileSummary?.completeness ?? 0}%
                  </div>
                </div>
              </div>

              <div className="max-h-[360px] space-y-3 overflow-y-auto px-4 py-4">
                {conversationMessages.length ? (
                  conversationMessages.map((message) => (
                    <div
                      key={`${message.message_id}-${message.created_at}`}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${
                          message.role === "user"
                            ? "bg-[#171c22] text-white"
                            : "border border-[#edf1f5] bg-[#f8fbff] text-[#334155]"
                        }`}
                      >
                        <p>{message.content}</p>
                        <div
                          className={`mt-2 text-[10px] ${message.role === "user" ? "text-white/70" : "text-[#94a3b8]"}`}
                        >
                          {formatProfileMessageTime(message.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#dbe4ee] bg-[#fbfdff] px-4 py-5 text-sm leading-7 text-[#64748b]">
                    可以直接这样说：
                    “我是软件工程专业，准备软件赛和实习，之前学过一点前端，但做项目时任务拆解和性能优化总容易卡住，希望系统按我的学习进度持续更新画像。”
                  </div>
                )}
              </div>

              <div className="border-t border-[#eef2f6] px-4 py-4">
                <textarea
                  value={conversationInput}
                  onChange={(event) => setConversationInput(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault();
                      void handleSendConversationMessage();
                    }
                  }}
                  placeholder="直接输入你的专业、学习目标、基础情况、常见卡点、偏好的学习方式与节奏..."
                  className="min-h-[96px] w-full resize-none rounded-2xl border border-[#dbe4ee] bg-[#fcfdff] px-4 py-3 text-sm text-[#171c22] outline-none transition focus:border-[#fb7299] focus:ring-2 focus:ring-[#fb7299]/10"
                />
                {(conversationStatusMessage || conversationErrorMessage || extractedConversationSignals.length > 0 || conversationLoading) ? (
                  <div
                    className={`mt-3 rounded-2xl border px-4 py-3 text-xs leading-6 ${
                      conversationErrorMessage
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-[#bfe8f3] bg-[linear-gradient(135deg,#f4fbff_0%,#fff7fa_100%)] text-[#275366]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {conversationLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      <span className="font-black">
                        {conversationErrorMessage || conversationStatusMessage || "画像信号已更新。"}
                      </span>
                    </div>
                    {extractedConversationSignals.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {extractedConversationSignals.slice(0, 8).map((item) => (
                          <span
                            key={`${item.dimension}-${item.info_key}-${item.info_value}`}
                            className="rounded-full border border-white/70 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-[#0f6c7b] shadow-sm"
                          >
                            {PROFILE_DIMENSION_LABELS[item.dimension] || item.dimension}：{item.info_value}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs leading-6 text-[#64748b]">
                    {conversationFlow?.guide_question?.question || "系统会根据你的自然语言回答自动追问缺失维度，无需逐项填表。"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void handleSendConversationMessage()}
                      disabled={conversationLoading || !conversationInput.trim()}
                      className="inline-flex items-center gap-2 rounded-full bg-[#171c22] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0f141a] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {conversationLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      {conversationLoading ? "正在抽取画像" : "发送回答"}
                    </button>
                    <button
                      onClick={() => void handleCompleteConversation()}
                      disabled={conversationCompleting || !conversationSessionId}
                      className="inline-flex items-center gap-2 rounded-full border border-[#0f6c7b]/20 bg-[#f4fbff] px-4 py-2 text-xs font-bold text-[#0f6c7b] shadow-sm hover:bg-[#eaf8fc] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle className={`h-4 w-4 ${conversationCompleting ? "animate-pulse" : ""}`} />
                      生成正式画像
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#edf1f5] bg-[linear-gradient(180deg,#ffffff,#fbfdff)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-[#171c22]">动态画像维度监控</h3>
                <p className="mt-1 text-xs leading-6 text-[#64748b]">系统持续监听学习行为并刷新这些判断，不需要额外填写表单。</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-[#eef7ff] px-3 py-1 text-[11px] font-black text-[#0f6c7b]">
                  {autoConversationDimensions.length} 个维度
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">
                  随学随新
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {autoConversationDimensions.map((item, index) => (
                <div
                  key={item.key}
                  className="rounded-[22px] border border-[#edf1f5] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] px-4 py-3.5 shadow-[0_10px_24px_rgba(148,163,184,0.06)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#171c22] px-2 text-[10px] font-black text-white">
                      {index + 1}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                        item.confidence === "高"
                          ? "bg-emerald-100 text-emerald-700"
                          : item.confidence === "中"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.confidence}
                    </span>
                  </div>
                  <div className="mt-3 text-[13px] font-extrabold text-[#171c22]">{item.label}</div>
                  <p className="mt-2 text-xs leading-6 text-[#475569]">{item.value}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        item.confidence === "高"
                          ? "bg-[linear-gradient(90deg,#10b981,#38bdf8)]"
                          : item.confidence === "中"
                            ? "bg-[linear-gradient(90deg,#f59e0b,#fb7185)]"
                            : "bg-[linear-gradient(90deg,#94a3b8,#cbd5e1)]"
                      }`}
                      style={{ width: `${Math.max(12, item.completeness)}%` }}
                    />
                  </div>
                  <div className="mt-2 text-[10px] font-bold text-[#94a3b8]">维度完整度 {item.completeness}%</div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-[#edf1f5] bg-[#fbfdff] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a94a3]">画像演化历史</div>
                  <p className="mt-1 text-sm font-bold text-[#171c22]">展示画像如何随着学习行为持续更新</p>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#171c22] shadow-sm">
                  {profileHistory?.total || 0} 条记录
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {(profileHistory?.history || []).slice(0, 4).map((item) => (
                  <div key={item.history_id} className="rounded-2xl border border-[#edf1f5] bg-white px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-extrabold text-[#171c22]">{getHistoryTypeLabel(item.change_type)}</div>
                      <div className="text-[10px] font-bold text-[#94a3b8]">{formatProfileMessageTime(item.created_at)}</div>
                    </div>
                    <p className="mt-1 text-xs leading-6 text-[#475569]">
                      {item.change_description || "系统已根据新的学习行为更新学生画像。"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.changed_dimensions.map((dimension) => (
                        <span
                          key={`${item.history_id}-${dimension}`}
                          className="rounded-full bg-[#f4f8ff] px-2.5 py-1 text-[10px] font-bold text-[#0f6c7b]"
                        >
                          {PROFILE_DIMENSION_LABELS[dimension] || dimension}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {!profileHistory?.history?.length ? (
                  <div className="rounded-2xl border border-dashed border-[#dbe4ee] bg-white px-4 py-4 text-xs leading-6 text-[#64748b]">
                    当前还没有更多演化记录。完成一次对话建画像，或继续学习、测评、答疑后，这里会自动追加更新轨迹。
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_340px]">
        <section className="rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <h3 className="flex items-center gap-2 text-base font-extrabold text-[#171c22]">
              <Activity className="h-5 w-5 text-[#fb7299]" />
              五维能力雷达
            </h3>
            <span className="text-[10px] font-bold text-slate-400">
              {radarSourceLabel}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[#e8eef5] bg-[#f8fbff] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#fb7299]">Portrait Feed</p>
              <p className="mt-2 text-sm font-extrabold text-[#171c22]">课堂、资源、测评、提问</p>
            </div>
            <div className="rounded-2xl border border-[#e8eef5] bg-[#f8fbff] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#fb7299]">画像联动</p>
              <p className="mt-2 text-sm font-extrabold text-[#171c22]">{autoConversationDimensions.length} 个维度持续刷新</p>
            </div>
            <div className="rounded-2xl border border-[#e8eef5] bg-[#f8fbff] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#fb7299]">Affect</p>
              <p className="mt-2 text-sm font-extrabold text-[#171c22]">路径、资料、答疑、练习统一联动</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-stretch">
            <div className="rounded-[30px] border border-[#e8edf6] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,249,255,0.96)_46%,rgba(253,247,251,0.98)_100%)] p-3 shadow-[0_22px_56px_rgba(15,23,42,0.08)]">
              <div className="rounded-[28px] border border-white/80 bg-[radial-gradient(circle_at_top,rgba(251,114,153,0.16),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_28%),linear-gradient(180deg,#fbfdff_0%,#f4f7ff_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.94)]">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#fb7299]">Profile Signal</p>
                  <p className="mt-1 text-sm font-extrabold text-[#171c22]">五维稳定输出</p>
                </div>
                <div className="rounded-[20px] border border-white/80 bg-white/82 px-3 py-2 text-right shadow-sm backdrop-blur">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Core Score</p>
                  <p className="text-lg font-black text-[#171c22]">{overallScore}</p>
                </div>
              </div>

                <div
                  ref={radarCardRef}
                  className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-[32px] border border-white/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(240,245,255,0.98)_56%,rgba(229,238,255,0.98))] px-7 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_22px_48px_rgba(148,163,184,0.16)]"
                >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(251,114,153,0.16),transparent_28%),radial-gradient(circle_at_50%_82%,rgba(59,130,246,0.16),transparent_20%)]" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1] h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95),rgba(255,255,255,0.55)_68%,rgba(255,255,255,0)_100%)] blur-[2px]" />

                <svg className="relative z-[2] h-full w-full" viewBox="0 0 100 100" fill="none">
                  <defs>
                    <linearGradient id="profile-radar-stroke" x1="18" y1="24" x2="82" y2="80" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#fb7299" />
                      <stop offset="45%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                    <radialGradient id="profile-radar-fill" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50 50) rotate(90) scale(36)">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
                      <stop offset="65%" stopColor="rgba(251,114,153,0.12)" />
                      <stop offset="100%" stopColor="rgba(56,189,248,0.12)" />
                    </radialGradient>
                    <filter id="profile-radar-glow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="1.8" result="blur" />
                      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.18 0" result="softGlow" />
                      <feMerge>
                        <feMergeNode in="softGlow" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {[0.2, 0.4, 0.6, 0.8, 1].map((ratio) => (
                    <polygon
                      key={ratio}
                      points={buildPolygonPoints(axes.map(() => ratio), axes)}
                      stroke={ratio === 1 ? "rgba(148,163,184,0.28)" : "rgba(148,163,184,0.16)"}
                      strokeWidth={ratio === 1 ? "0.7" : "0.45"}
                      strokeDasharray={ratio === 1 ? "0" : "1.2 2.8"}
                      fill={ratio === 1 ? "rgba(255,255,255,0.16)" : "transparent"}
                    />
                  ))}

                  {axes.map((axis) => {
                    const outerPoint = polarToCartesian(1, axis.angle);
                    return (
                      <line
                        key={axis.label}
                        x1="50"
                        y1="50"
                        x2={outerPoint.x}
                        y2={outerPoint.y}
                        stroke="rgba(148,163,184,0.16)"
                        strokeWidth="0.5"
                      />
                    );
                  })}

                  <polygon
                    points={benchmarkPolygonPoints}
                    fill="rgba(148,163,184,0.04)"
                    stroke="rgba(125,139,161,0.52)"
                    strokeWidth="0.8"
                    strokeDasharray="1.8 3"
                  />
                  <polygon
                    points={animatedPolygonPoints}
                    fill="url(#profile-radar-fill)"
                    stroke="url(#profile-radar-stroke)"
                    strokeWidth="1.55"
                    strokeLinejoin="round"
                    filter="url(#profile-radar-glow)"
                    style={{ opacity: Math.max(0.35, radarProgress) }}
                  />
                  <polygon
                    points={animatedPolygonPoints}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth="0.55"
                    strokeLinejoin="round"
                    strokeDasharray="5 7"
                    style={{ opacity: Math.max(0.28, radarProgress) }}
                  >
                    <animate attributeName="stroke-dashoffset" from="24" to="0" dur="6s" repeatCount="indefinite" />
                  </polygon>

                  {animatedScores.map((value, index) => {
                    const point = polarToCartesian(value, axes[index].angle);
                    const labelPoint = polarToCartesian(1.16, axes[index].angle);
                    return (
                      <g key={axes[index].label}>
                        <circle cx={point.x} cy={point.y} r="4.4" fill="rgba(37,99,235,0.08)">
                          <animate attributeName="r" values="4.2;5;4.2" dur="3.2s" begin={`${index * 0.18}s`} repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.18;0.32;0.18" dur="3.2s" begin={`${index * 0.18}s`} repeatCount="indefinite" />
                        </circle>
                        <circle cx={point.x} cy={point.y} r="2.5" fill="#2563eb" stroke="white" strokeWidth="1.4" />
                        <text
                          x={labelPoint.x}
                          y={labelPoint.y - 1.8}
                          textAnchor="middle"
                          fontSize="2.9"
                          fontWeight="800"
                          fill="#5b6b7f"
                        >
                          {axes[index].label}
                        </text>
                        <text
                          x={labelPoint.x}
                          y={labelPoint.y + 2.8}
                          textAnchor="middle"
                          fontSize="2.5"
                          fontWeight="700"
                          fill="rgba(100,116,139,0.92)"
                        >
                          {Math.round(axes[index].score * radarProgress)}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                <div
                  className="pointer-events-none absolute left-1/2 top-1/2 z-[3] flex h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-white/90 bg-[radial-gradient(circle,rgba(255,255,255,0.96),rgba(245,248,255,0.92)_72%,rgba(255,255,255,0.84)_100%)] text-center shadow-[0_18px_44px_rgba(148,163,184,0.20)] backdrop-blur-md"
                  style={{ opacity: Math.max(0.5, radarProgress) }}
                >
                  <span className="text-[8px] font-black uppercase tracking-[0.28em] text-slate-400">Profile Score</span>
                  <span className="mt-1 text-[36px] font-black leading-none text-[#171c22]">{overallScore}</span>
                  <span className="mt-1 text-[10px] font-bold text-[#5f6b7a]">综合评分</span>
                  <span className="mt-2 rounded-full bg-[#eef5ff] px-2.5 py-1 text-[9px] font-black text-[#2563eb]">
                    {strongestAxis.label}
                  </span>
                </div>

                <div className="pointer-events-none absolute left-4 top-4 z-[3] rounded-full border border-white/80 bg-white/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 shadow-sm backdrop-blur">
                  Live Signal
                </div>
                <div className="pointer-events-none absolute bottom-4 right-4 z-[3] rounded-full border border-white/80 bg-white/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 shadow-sm backdrop-blur">
                  Baseline
                </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/80 bg-white/78 px-3 py-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Peak Axis</p>
                    <p className="mt-1 text-sm font-extrabold text-[#171c22]">{strongestAxis.label}</p>
                    <p className="text-[11px] text-[#564145]">这是你当前最稳定、最值得继续放大的能力维度。</p>
                  </div>
                  <div className="rounded-2xl border border-white/80 bg-white/78 px-3 py-3 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Profile Tags</p>
                    <p className="mt-1 text-sm font-extrabold text-[#171c22]">{profileSummary?.tags?.slice(0, 2).join(" / ") || "画像标签生成中"}</p>
                    <p className="text-[11px] text-[#564145]">这些标签会同步影响路径推荐、资源排序和答疑表达方式。</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {axes.map((axis, index) => (
                <div
                  key={axis.label}
                  className="rounded-[22px] border border-[#edf1f5] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] px-4 py-3.5 shadow-[0_10px_24px_rgba(148,163,184,0.08)]"
                  style={{ opacity: Math.max(0.55, radarProgress) }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#171c22] text-[10px] font-black text-white">
                      {index + 1}
                    </div>
                    <div className="text-right">
                      <div className="text-[20px] font-black leading-none text-[#171c22]">{Math.round(axis.score * radarProgress)}</div>
                      <div className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Avg {axis.benchmark}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[13px] font-extrabold text-[#171c22]">{axis.label}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#fb7299,#38bdf8)] transition-all duration-700"
                      style={{ width: `${Math.max(8, axis.score * radarProgress)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
</section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-[#E3E8EC] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#171c22]">画像状态与动作</h3>
              <span className="rounded-full bg-[#f8fbff] px-2.5 py-1 text-[10px] font-black text-[#006689]">
                完整度 {Math.round((profileSummary?.completeness || 0.72) * 100)}%
              </span>
            </div>

            <div className="mt-3 rounded-2xl border border-[#edf1f5] bg-white px-4 py-3 text-xs leading-6 text-[#564145]">
              <p>画像编码：<span className="font-bold text-[#171c22]">{sbtiSnapshot.code}</span></p>
              <p>画像类型：<span className="font-bold text-[#171c22]">{sbtiSnapshot.title}</span></p>
              <p>学习风格：<span className="font-bold text-[#171c22]">{getFriendlyStyle(profileSummary?.recommended_learning_style)}</span></p>
              <p>当前阶段：<span className="font-bold text-[#171c22]">{getStageText(profileSummary?.current_stage)}</span></p>
            </div>

            <div className="mt-3 grid gap-2">
              <Link
                className="inline-flex items-center justify-between rounded-2xl border border-[#edf1f5] bg-[#f8fbff] px-3.5 py-2.5 text-xs font-bold text-[#171c22] transition hover:bg-white"
                to="/path"
              >
                <span className="inline-flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  去学习路径
                </span>
                <ArrowRight className="h-4 w-4 text-[#8a94a3]" />
              </Link>
              <Link
                className="inline-flex items-center justify-between rounded-2xl border border-[#edf1f5] bg-[#fff7fa] px-3.5 py-2.5 text-xs font-bold text-[#171c22] transition hover:bg-white"
                to="/evaluation?courseId=series-2"
              >
                <span className="inline-flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#fb7299]" />
                  去看测评反馈
                </span>
                <ArrowRight className="h-4 w-4 text-[#8a94a3]" />
              </Link>
              <Link
                className="inline-flex items-center justify-between rounded-2xl border border-[#edf1f5] bg-[#fffaf1] px-3.5 py-2.5 text-xs font-bold text-[#171c22] transition hover:bg-white"
                to="/tutor?courseId=series-2"
              >
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  去找 AI 助教
                </span>
                <ArrowRight className="h-4 w-4 text-[#8a94a3]" />
              </Link>
            </div>

            <div className="mt-3 rounded-2xl border border-[#edf1f5] bg-white px-4 py-3">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                <History className="h-3.5 w-3.5 text-[#fb7299]" />
                Latest Writeback
              </div>
              <p className="mt-1.5 text-xs font-semibold leading-6 text-[#171c22]">
                {lastBehaviorUpdate?.summary || "系统将按后续学习行为自动继续回写"}
              </p>
              {lastBehaviorUpdate?.new_tags?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {lastBehaviorUpdate.new_tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      新标签：{tag}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {RECENT_ACTIVITIES.slice(0, 2).map((item) => (
                    <span key={item.id} className="rounded-full bg-[#f8fbff] px-2 py-0.5 text-[10px] font-bold text-[#006689]">
                      {item.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      <section className="rounded-3xl border border-[#E3E8EC] bg-white p-3.5 shadow-sm">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-[#171c22]">
              <Award className="h-4 w-4 text-[#fb7299]" />
              画像已接入后续链路
            </h3>
            <p className="mt-1 text-[11px] leading-5 text-[#564145]">
              会继续影响学习路径、资源生成、学习助手回答重点和练习触发。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate("/path?courseId=series-2")}
              className="inline-flex items-center gap-2 rounded-full border border-[#E3E8EC] bg-white px-3.5 py-1.5 text-[11px] font-bold text-[#171c22] hover:bg-slate-50"
            >
              <ArrowRight className="h-4 w-4" />
              看学习路径
            </button>
            <button
              onClick={() => navigate("/resources?courseId=series-2")}
              className="inline-flex items-center gap-2 rounded-full border border-[#fb7299]/20 bg-[#fff4f8] px-3.5 py-1.5 text-[11px] font-bold text-[#fb7299] hover:bg-[#ffeaf2]"
            >
              <ArrowRight className="h-4 w-4" />
              看资源生成
            </button>
          </div>
        </div>
      </section>

      <section
        ref={profileReportRef}
        className={`rounded-3xl border p-4 shadow-sm transition-all duration-300 ${
          profileReportGenerated
            ? "border-[#ffd2e1] bg-[linear-gradient(135deg,#fff7fa_0%,#ffffff_45%,#f4fbff_100%)] shadow-[0_24px_70px_rgba(251,114,153,0.10)]"
            : "border-[#E3E8EC] bg-white"
        }`}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ffd6e3] bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#fb7299]">
              <Sparkles className="h-3.5 w-3.5" />
              AI 画像报告
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[22px] font-extrabold leading-tight text-[#171c22]">
                {sbtiSnapshot.code} · {sbtiSnapshot.title}画像解读报告
              </h3>
              <span className="rounded-full bg-[#171c22] px-2.5 py-1 text-[10px] font-black text-white">
                {profileReportGenerated ? "已生成" : "等待生成"}
              </span>
              {profileReportGenerated ? (
                <span className="rounded-full bg-[#eef8fc] px-2.5 py-1 text-[10px] font-black text-[#0f6c7b]">
                  保存于 {formatProfileReportTime(profileReportGeneratedAt)}
                </span>
              ) : null}
            </div>
            <p className="text-[15px] font-bold leading-6 text-[#2b1f24]">
              {profileReportGenerated ? portraitInterpretation.subtitle : "点击上方“生成画像报告”后，这里会汇总画像叙述、SPTA 拆解、图表分析和后续学习动作。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {profileReportGenerated ? (
              <button
                type="button"
                onClick={handleExportProfileReport}
                className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-[#dbeaf3] bg-white px-4 py-3 text-sm font-black text-[#0f6c7b] transition hover:bg-[#f4fbff]"
              >
                <Download className="h-4 w-4" />
                导出报告
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleGenerateProfileReport}
              className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-[#fb7299]/25 bg-[#fff4f8] px-4 py-3 text-sm font-black text-[#fb7299] transition hover:bg-[#ffe8f0]"
            >
              <Sparkles className="h-4 w-4" />
              {profileReportGenerated ? "更新并保存报告" : "生成完整报告"}
            </button>
          </div>
        </div>

        {profileReportGenerated ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-[26px] border border-[#f1dce5] bg-white/88 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#fb7299]">画像叙述</p>
                    <h4 className="mt-1 text-lg font-black text-[#171c22]">{user?.name || "BiliLearn 用户"}当前学习状态</h4>
                  </div>
                  <span className="rounded-full bg-[#eef8fc] px-3 py-1 text-[11px] font-black text-[#0f6c7b]">完整度 {overallScore}%</span>
                </div>
                <p className="mt-3 text-sm font-bold leading-7 text-[#2b1f24]">
                  {portraitInterpretation.summary}
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[20px] bg-[#fff7fa] px-4 py-3">
                    <p className="text-[10px] font-black text-[#fb7299]">当前阶段</p>
                    <p className="mt-1 text-sm font-extrabold text-[#171c22]">{getStageText(profileSummary?.current_stage)}</p>
                  </div>
                  <div className="rounded-[20px] bg-[#f4fbff] px-4 py-3">
                    <p className="text-[10px] font-black text-[#0f6c7b]">优势维度</p>
                    <p className="mt-1 text-sm font-extrabold text-[#171c22]">{strongestAxis.label} · {strongestAxis.score}</p>
                  </div>
                  <div className="rounded-[20px] bg-[#fffaf1] px-4 py-3">
                    <p className="text-[10px] font-black text-amber-700">待补维度</p>
                    <p className="mt-1 text-sm font-extrabold text-[#171c22]">{weakestAxis.label} · {weakestAxis.score}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-[#dbeaf3] bg-[#f4fbff] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0f6c7b]">SPTA 拆解</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {sbtiBreakdown.map((item) => (
                    <div key={`${item.letter}-${item.label}`} className="rounded-[18px] border border-white/80 bg-white px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#171c22] text-sm font-black text-white">{item.letter}</span>
                        <span className="text-sm font-black text-[#171c22]">{item.label}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#564145]">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-[26px] border border-[#e5edf5] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#fb7299]">图表分析</p>
                    <h4 className="mt-1 text-base font-black text-[#171c22]">五维能力条形解读</h4>
                  </div>
                  <Activity className="h-5 w-5 text-[#fb7299]" />
                </div>
                <div className="mt-4 space-y-3">
                  {axes.map((axis) => (
                    <div key={`report-${axis.label}`}>
                      <div className="flex items-center justify-between text-xs font-bold text-[#564145]">
                        <span>{axis.label}</span>
                        <span>{axis.score} / 基线 {axis.benchmark}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#eef2f7]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#fb7299,#38bdf8)]"
                          style={{ width: `${Math.max(8, axis.score)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 rounded-[18px] bg-[#f8fbff] px-4 py-3 text-xs leading-6 text-[#475569]">
                  雷达图显示当前画像不是单一分数，而是由规划、执行、持续力、认知广度和成果输出共同构成。系统会用最高维度承接学习优势，用最低维度决定优先补齐顺序。
                </p>
              </div>

              <div className="rounded-[26px] border border-[#e5edf5] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#fb7299]">证据链分析</p>
                    <h4 className="mt-1 text-base font-black text-[#171c22]">测评、行为、作业与画像联动</h4>
                  </div>
                  <ClipboardCheck className="h-5 w-5 text-[#fb7299]" />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {profileEvidenceCards.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={`report-${item.key}`} className={`rounded-[20px] bg-[linear-gradient(180deg,var(--tw-gradient-stops))] ${item.tone} p-3.5`}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-[#fb7299]" />
                          <p className="text-[11px] font-black text-[#171c22]">{item.title}</p>
                        </div>
                        <p className="mt-2 text-xs font-bold leading-5 text-[#564145]">{item.result}</p>
                        <p className="mt-1.5 text-xs leading-5 text-[#64748b]">{item.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-[#ffd9e6] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#fb7299]">后续安排</p>
                  <h4 className="mt-1 text-base font-black text-[#171c22]">系统会按这份报告调整下一步学习</h4>
                </div>
                <span className="rounded-full bg-[#fff4f8] px-3 py-1 text-[11px] font-black text-[#fb7299]">
                  {growthMap?.next_milestone || "先补短板，再放大优势"}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {reportActionPlan.map((item, index) => (
                  <div key={item.title} className="rounded-[20px] border border-[#edf1f5] bg-[#fbfdff] px-4 py-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#171c22] text-[11px] font-black text-white">{index + 1}</span>
                    <p className="mt-3 text-sm font-black text-[#171c22]">{item.title}</p>
                    <p className="mt-2 text-xs leading-6 text-[#564145]">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-[24px] border border-dashed border-[#dbe4ee] bg-[#fbfdff] px-4 py-5 text-sm leading-7 text-[#64748b]">
            报告会在点击后生成，并使用当前页面已经读取到的画像编码、完整度、五维雷达、画像证据和后续里程碑进行整理。
          </div>
        )}
      </section>

      {loading ? (
        <section className="rounded-2xl border border-[#d9e8fb] bg-[linear-gradient(90deg,#f8fbff_0%,#fdfdff_100%)] px-4 py-3 text-xs text-[#006689]">
          正在同步最新岗位能力诊断...
        </section>
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 rounded-2xl bg-[#171c22] px-4 py-3 text-xs font-semibold text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}
