import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, Award, Clock3, HelpCircle, History, LoaderCircle, MessageSquare, Sparkles } from "lucide-react";
import {
  ACTIVE_COURSE_ID,
  ACTIVE_USER_ID,
  buildPathRoute,
  buildProfileConversationRoute,
  resolveCourseIdFromSearchParams,
} from "../lib/courseContext";
import {
  studentApi,
  type CapabilityProfileResponse,
  type ProfileHistoryResponse,
  type StudentProfileDetailResponse,
} from "../lib/studentApi";

const AXIS_ANGLES = [-90, -18, 54, 126, 198];
const AXIS_LABEL_CLASSES = [
  "absolute top-1 left-1/2 -translate-x-1/2",
  "absolute top-[35%] left-[78%]",
  "absolute bottom-[14%] left-[60%]",
  "absolute bottom-[14%] right-[60%]",
  "absolute top-[35%] right-[78%]",
];

function polarToCartesian(value: number, angle: number) {
  const radius = 34 * value;
  const radians = (angle * Math.PI) / 180;
  return {
    x: 50 + radius * Math.cos(radians),
    y: 50 + radius * Math.sin(radians),
  };
}

function buildPolygonPoints(values: number[]) {
  return values
    .map((value, index) => {
      const point = polarToCartesian(value, AXIS_ANGLES[index] || 0);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

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

export default function CapabilityModel() {
  const [searchParams] = useSearchParams();
  const courseId = resolveCourseIdFromSearchParams(searchParams, ACTIVE_COURSE_ID);
  const radarCardRef = useRef<HTMLDivElement | null>(null);
  const [radarProgress, setRadarProgress] = useState(0);
  const [shouldAnimateRadar, setShouldAnimateRadar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<CapabilityProfileResponse | null>(null);
  const [profileSummaryMissing, setProfileSummaryMissing] = useState(false);
  const [profileDetail, setProfileDetail] = useState<StudentProfileDetailResponse | null>(null);
  const [profileHistory, setProfileHistory] = useState<ProfileHistoryResponse | null>(null);

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
    let cancelled = false;

    async function loadProfilePage() {
      setLoading(true);
      setError(null);
      try {
        const [capabilityData, profileSummary, detail, history] = await Promise.all([
          studentApi.getStudentCapabilityProfile(ACTIVE_USER_ID, courseId),
          studentApi.getProfileSummaryOrNull(ACTIVE_USER_ID),
          studentApi.getProfileDetailOrNull(ACTIVE_USER_ID),
          studentApi.getProfileHistory(ACTIVE_USER_ID, 8),
        ]);
        if (cancelled) return;
        setProfile(capabilityData);
        setProfileSummaryMissing(!profileSummary);
        setProfileDetail(detail);
        setProfileHistory(history);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "能力画像加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfilePage();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

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

  const axes = profile?.axes || [];
  const animatedScores = useMemo(
    () => axes.map((axis) => (axis.score / 100) * radarProgress),
    [axes, radarProgress],
  );
  const benchmarkScores = useMemo(() => axes.map((axis) => axis.benchmark / 100), [axes]);
  const animatedPolygonPoints = useMemo(() => buildPolygonPoints(animatedScores), [animatedScores]);
  const benchmarkPolygonPoints = useMemo(() => buildPolygonPoints(benchmarkScores), [benchmarkScores]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-[#E3E8EC] bg-white text-sm font-semibold text-[#564145]">
        <span className="flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          正在加载能力画像...
        </span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-3xl border border-[#E3E8EC] bg-white p-8 text-sm text-[#564145] shadow-sm">
        <p className="font-bold text-[#171c22]">能力画像暂不可用</p>
        <p className="mt-2">{error || "暂无画像数据。"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none" id="capability-profile-workspace">
      <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 lg:p-8 shadow-sm flex flex-col gap-5">
        <span className="text-[10px] uppercase font-bold text-[#fb7299] tracking-wider font-mono">
          Capability Profile Center
        </span>
        <h1 className="font-sans text-2xl lg:text-3xl font-extrabold text-[#171c22] tracking-tight">
          当前学习能力画像
        </h1>
        <p className="text-sm text-[#564145] leading-relaxed max-w-4xl">
          这里展示真实画像、测评与学习路径联动结果。开始画像对话会跳转到独立对话页，不再在当前页原地开聊。
        </p>
      </section>

      <section className="rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#fb7299]">Profile Entry</p>
            <h2 className="mt-2 text-xl font-extrabold text-[#171c22]">
              {profileSummaryMissing ? "当前账号还没有画像" : "继续维护你的学习画像"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#564145]">
              {profileSummaryMissing
                ? "画像不是默认数据。点击下方按钮会跳转到真实的对话式画像页，并自动开始一次新会话。"
                : "你可以进入独立画像对话页，对已有画像继续补充、校正并重新生成。"}
            </p>
          </div>
          <Link
            to={buildProfileConversationRoute(courseId, { autostart: 1 })}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111827] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_32px_rgba(17,24,39,0.16)]"
          >
            <MessageSquare className="h-4 w-4" />
            开始画像对话
          </Link>
        </div>
      </section>

      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="flex-grow bg-white border border-[#E3E8EC] rounded-3xl p-6 lg:p-8 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
            <h3 className="font-sans text-base font-extrabold text-[#171c22] flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#fb7299]" />
              五维能力雷达图
            </h3>
            <span className="text-[10px] text-slate-400 font-bold">真实画像 + 测评 + 路径联动</span>
          </div>

          <div className="mx-auto w-full max-w-[420px] rounded-[32px] border border-[#e8edf6] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,255,0.94)_48%,rgba(253,247,251,0.96)_100%)] p-3 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <div className="rounded-[28px] border border-white/80 bg-[radial-gradient(circle_at_top,rgba(251,114,153,0.14),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.14),transparent_28%),linear-gradient(180deg,#f9fbff_0%,#f4f7ff_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#fb7299] font-mono">Profile Chamber</p>
                  <p className="mt-1 text-sm font-extrabold text-[#171c22]">能力中枢追踪</p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-right shadow-sm backdrop-blur">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 font-mono">Overall</p>
                  <p className="text-lg font-black text-[#171c22]">{profile.overall_score}</p>
                </div>
              </div>

              <div
                ref={radarCardRef}
                className="relative mx-auto aspect-square w-full max-w-[320px] select-none overflow-hidden rounded-[30px] border border-white/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(241,245,255,0.96)_58%,rgba(234,242,255,0.98))] px-8 py-9 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_18px_40px_rgba(148,163,184,0.16)]"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,114,153,0.18),transparent_44%),radial-gradient(circle_at_50%_78%,rgba(59,130,246,0.16),transparent_28%)] opacity-90" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/55 shadow-[0_12px_40px_rgba(255,255,255,0.7)] backdrop-blur-md" />

                <svg className="relative z-[1] h-full w-full text-slate-300" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.75">
                  <circle cx="50" cy="50" r="32" stroke="rgba(148,163,184,0.18)" strokeDasharray="1.5 2.5" />
                  <circle cx="50" cy="50" r="23" stroke="rgba(148,163,184,0.14)" strokeDasharray="1.5 2.5" />
                  <circle cx="50" cy="50" r="14" stroke="rgba(148,163,184,0.12)" strokeDasharray="1.5 2.5" />
                  <polygon points="50,16 82.3,39.5 70,77.5 30,77.5 17.7,39.5" stroke="currentColor" strokeWidth="0.8" />
                  <line x1="50" y1="50" x2="50" y2="16" />
                  <line x1="50" y1="50" x2="82.3" y2="39.5" />
                  <line x1="50" y1="50" x2="70" y2="77.5" />
                  <line x1="50" y1="50" x2="30" y2="77.5" />
                  <line x1="50" y1="50" x2="17.7" y2="39.5" />
                  <polygon points={benchmarkPolygonPoints} fill="rgba(148,163,184,0.08)" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
                  <polygon points={animatedPolygonPoints} fill="rgba(251,114,153,0.24)" stroke="#fb7299" strokeWidth="2.2" />
                  {animatedScores.map((value, index) => {
                    const point = polarToCartesian(value, AXIS_ANGLES[index] || 0);
                    return (
                      <g key={axes[index]?.label || index}>
                        <circle cx={point.x} cy={point.y} r="5.3" fill="rgba(59,130,246,0.14)" stroke="none" />
                        <circle cx={point.x} cy={point.y} r="3.1" fill="#2563eb" stroke="white" strokeWidth="1.7" />
                      </g>
                    );
                  })}
                </svg>

                <div
                  className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-22 w-22 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-white/80 bg-white/80 text-center shadow-[0_10px_30px_rgba(148,163,184,0.24)] backdrop-blur-md"
                  style={{ opacity: Math.max(0.45, radarProgress) }}
                >
                  <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 font-mono">Core Score</span>
                  <span className="text-2xl font-black text-[#171c22]">{profile.overall_score}</span>
                  <span className="text-[10px] font-bold text-[#564145]">五维均衡稳定</span>
                </div>

                {axes.map((axis, index) => (
                  <div
                    key={axis.label}
                    className={`${AXIS_LABEL_CLASSES[index]} z-10 whitespace-nowrap rounded-2xl border border-white/80 bg-white/88 px-2.5 py-1.5 text-[10px] shadow-[0_8px_18px_rgba(148,163,184,0.18)] backdrop-blur-sm`}
                    style={{ opacity: Math.max(0.5, radarProgress) }}
                  >
                    <div className="font-extrabold text-[#171c22]">{axis.label}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[9px] font-bold text-slate-400">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#fb7299]" />
                      {Math.round(axis.score * radarProgress)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/80 bg-white/75 px-3 py-3 shadow-sm backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-mono">Peak Axis</p>
                  <p className="mt-1 text-sm font-extrabold text-[#171c22]">{profile.strongest_axis}</p>
                  <p className="text-[11px] text-[#564145]">当前领先维度。</p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/75 px-3 py-3 shadow-sm backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-mono">Agent Sync</p>
                  <p className="mt-1 text-sm font-extrabold text-[#171c22]">画像 / 路径 / 测评已联动</p>
                  <p className="text-[11px] text-[#564145]">画像对话已拆到独立页面。</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="w-full lg:w-80 shrink-0 space-y-6">
          <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm space-y-4">
            <h3 className="font-sans text-xs font-extrabold uppercase tracking-wider text-[#171c22] border-b border-gray-100 pb-2.5">
              成就
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              {profile.achievements.map((achievement) => {
                const Icon = achievement.status === "achieved" ? Award : HelpCircle;
                return (
                  <div key={achievement.id} className="flex flex-col items-center p-2.5 bg-[#fb7299]/5 rounded-2xl border border-[#fb7299]/15">
                    <div className="w-10 h-10 rounded-full bg-[#fb7299]/15 flex items-center justify-center text-[#fb7299] mb-1.5">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[9.5px] font-bold text-[#171c22] leading-tight">{achievement.title}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm space-y-4 flex flex-col justify-between">
            <h3 className="font-sans text-xs font-extrabold uppercase tracking-wider text-[#171c22] border-b border-gray-100 pb-2.5 flex items-center gap-1.5">
              <History className="w-4 h-4 text-[#fb7299]" />
              最近业务动态
            </h3>
            <div className="space-y-4">
              {profile.recent_activities.map((act) => (
                <div key={act.id} className="relative pl-5 before:absolute before:left-1.5 before:top-1.5 before:bottom-[-20px] before:w-0.5 before:bg-slate-100 last:before:hidden text-xs">
                  <div className="absolute left-[3px] top-[5px] w-2 h-2 rounded-full bg-[#fb7299]" />
                  <p className="text-[#171c22] font-semibold">{act.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] text-[#564145]/75 font-mono">{act.time}</span>
                    <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1 py-0.2 rounded font-bold font-mono">{act.gain}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm space-y-5">
        <h3 className="font-sans text-sm font-extrabold text-[#171c22] flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#fb7299] shrink-0" />
          诊断结论与建议
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[#f0f4fc]/65 rounded-2xl border border-blue-50 text-xs leading-relaxed">
            <p className="uppercase tracking-wider font-extrabold text-[#006689] text-[9px] mb-1 font-mono">Current Status</p>
            <h4 className="font-bold text-[#171c22] text-sm mb-1.5">能力诊断摘要</h4>
            <p className="text-[#564145]">{profile.diagnosis_summary}</p>
          </div>
          <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100 text-xs text-[#00516e] leading-relaxed">
            <p className="uppercase tracking-wider font-extrabold text-emerald-800 text-[9px] mb-1 font-mono">Recommended Actions</p>
            <div className="space-y-2 mt-1.5">
              {profile.recommendations.map((item) => (
                <p key={item} className="flex items-start gap-1.5 font-sans font-medium text-emerald-950">
                  <span className="text-emerald-700 shrink-0 font-extrabold">+</span>
                  {item}
                </p>
              ))}
              <p className="flex items-start gap-1.5 font-sans font-medium text-emerald-950">
                <span className="text-emerald-700 shrink-0 font-extrabold">+</span>
                前往 <Link className="text-[#006689] underline font-bold" to={buildPathRoute(courseId)}>学习路径</Link> 继续推进。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        <section className="rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#171c22]">
              <Sparkles className="h-4 w-4 text-[#fb7299]" />
              当前画像详情
            </h3>
            <Link
              to={buildProfileConversationRoute(courseId, { autostart: 1 })}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#171c22] shadow-sm"
            >
              <MessageSquare className="h-4 w-4" />
              前往对话页
            </Link>
          </div>

          {profileDetail ? (
            <div className="space-y-4">
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

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Summary</p>
                <p className="mt-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-sm leading-6 text-[#564145]">
                  {profileDetail.summary || "暂无画像摘要。"}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Tags</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profileDetail.tags.length ? (
                    profileDetail.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-[#fb7299]/20 bg-[#fb7299]/5 px-3 py-1 text-xs font-bold text-[#fb7299]">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">暂无标签</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              还没有真实画像详情。进入对话页完成一次画像会话后，这里会自动更新。
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[#E3E8EC] bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#171c22]">
            <Clock3 className="h-4 w-4 text-[#fb7299]" />
            画像历史
          </h3>
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
      </section>
    </div>
  );
}
