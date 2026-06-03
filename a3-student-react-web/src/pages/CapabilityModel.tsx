/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Radar,
  Award,
  TrendingUp,
  Activity,
  History,
  CheckCircle,
  HelpCircle,
  Zap,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { RECENT_ACTIVITIES } from "../constants";

interface CapabilityModelProps {
  user?: {
    id: string;
    name: string;
    avatar: string;
    loggedIn: boolean;
  };
}

const CAPABILITY_AXES = [
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

function buildPolygonPoints(values: number[]) {
  return values
    .map((value, index) => {
      const point = polarToCartesian(value, CAPABILITY_AXES[index].angle);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

export default function CapabilityModel({ user }: CapabilityModelProps = {}) {
  const radarCardRef = useRef<HTMLDivElement | null>(null);
  const [radarProgress, setRadarProgress] = useState(0);
  const [shouldAnimateRadar, setShouldAnimateRadar] = useState(false);

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
      {
        threshold: 0.45,
      },
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

  const animatedScores = useMemo(
    () => CAPABILITY_AXES.map((axis) => (axis.score / 100) * radarProgress),
    [radarProgress],
  );
  const benchmarkScores = useMemo(
    () => CAPABILITY_AXES.map((axis) => axis.benchmark / 100),
    [],
  );
  const overallScore = useMemo(
    () => Math.round(CAPABILITY_AXES.reduce((sum, axis) => sum + axis.score, 0) / CAPABILITY_AXES.length),
    [],
  );
  const strongestAxis = useMemo(
    () => CAPABILITY_AXES.reduce((best, axis) => (axis.score > best.score ? axis : best), CAPABILITY_AXES[0]),
    [],
  );
  const animatedPolygonPoints = useMemo(() => buildPolygonPoints(animatedScores), [animatedScores]);
  const benchmarkPolygonPoints = useMemo(() => buildPolygonPoints(benchmarkScores), [benchmarkScores]);

  return (
    <div className="space-y-6 select-none" id="capability-profile-workspace">
      
      {/* 1. 头部卡片：个人能力图谱概述 */}
      <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 lg:p-8 shadow-sm flex flex-col md:flex-row justify-between gap-6">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {user?.avatar && (
            <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border border-[#ddbfc4] shadow-sm">
              <img
                src={user.avatar}
                alt={user.name || "学者"}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-[#fb7299] tracking-wider font-mono">
              Five Core Agents Profile Center • 五个核心智能体画像中枢
            </span>
            <h1 className="font-sans text-2xl lg:text-3xl font-extrabold text-[#171c22] tracking-tight">
              {user?.name || "卓越学者"} 的五维能力画像 <span className="text-[#fb7299]">(5-Agent Capability Profile)</span>
            </h1>
            <p className="text-sm text-[#564145] font-sans leading-relaxed max-w-2xl opacity-90">
              系统将实时跟踪你在概念验证、代码重构、随堂测评以及讲义研读中的各项指标。学习画像智能体会统筹分析这些数据，并联动知识检索与答疑、学习规划、资源生成、测评反馈四个核心智能体，共同支撑“5 个核心智能体支撑的学习闭环”。
            </p>
          </div>
        </div>

        {/* 全局成就等级徽章 */}
        <div className="bg-[#fb7299]/5 border border-[#fb7299]/20 p-4 rounded-2xl flex items-center gap-3 shrink-0 self-start md:self-center">
          <div className="w-12 h-12 rounded-full bg-[#fb7299] flex items-center justify-center text-white shrink-0 font-extrabold text-sm shadow-md shadow-[#fb7299]/20">
            Lv.4
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider font-bold text-[#fb7299] font-mono">Level Ranking</p>
            <p className="text-sm font-extrabold text-[#171c22]">卓越研学者 (资深学者)</p>
          </div>
        </div>
      </section>

      {/* 2. 双栏布局：五维雷达图 & 荣誉勋章、最近学业动态 */}
      <div className="flex flex-col lg:flex-row gap-6 w-full">
        
        {/* 左侧：精美的高对比度 SVG 五维能力雷达图 */}
        <div className="flex-grow bg-white border border-[#E3E8EC] rounded-3xl p-6 lg:p-8 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
            <h3 className="font-sans text-base font-extrabold text-[#171c22] flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#fb7299]" />
              五维学术核心指标 (Capability Radar)
            </h3>
            <span className="text-[10px] text-slate-400 font-bold">由学习画像智能体实时评估，并同步给其余 4 个核心智能体</span>
          </div>

          <div className="mx-auto w-full max-w-[420px] rounded-[32px] border border-[#e8edf6] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(247,249,255,0.94)_48%,rgba(253,247,251,0.96)_100%)] p-3 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <div className="rounded-[28px] border border-white/80 bg-[radial-gradient(circle_at_top,rgba(251,114,153,0.14),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.14),transparent_28%),linear-gradient(180deg,#f9fbff_0%,#f4f7ff_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#fb7299] font-mono">Profile Chamber</p>
                  <p className="mt-1 text-sm font-extrabold text-[#171c22]">能力中枢追踪舱</p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-right shadow-sm backdrop-blur">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 font-mono">Overall</p>
                  <p className="text-lg font-black text-[#171c22]">{overallScore}</p>
                </div>
              </div>

              <div
                ref={radarCardRef}
                className="relative mx-auto aspect-square w-full max-w-[320px] select-none overflow-hidden rounded-[30px] border border-white/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(241,245,255,0.96)_58%,rgba(234,242,255,0.98))] px-8 py-9 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_18px_40px_rgba(148,163,184,0.16)]"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,114,153,0.18),transparent_44%),radial-gradient(circle_at_50%_78%,rgba(59,130,246,0.16),transparent_28%)] opacity-90" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/55 shadow-[0_12px_40px_rgba(255,255,255,0.7)] backdrop-blur-md" />

                <svg
                  className="relative z-[1] h-full w-full text-slate-300"
                  viewBox="0 0 100 100"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.75"
                  shapeRendering="geometricPrecision"
                >
                  <circle cx="50" cy="50" r="32" stroke="rgba(148,163,184,0.18)" strokeDasharray="1.5 2.5" />
                  <circle cx="50" cy="50" r="23" stroke="rgba(148,163,184,0.14)" strokeDasharray="1.5 2.5" />
                  <circle cx="50" cy="50" r="14" stroke="rgba(148,163,184,0.12)" strokeDasharray="1.5 2.5" />
                  <polygon points="50,16 82.3,39.5 70,77.5 30,77.5 17.7,39.5" stroke="currentColor" strokeWidth="0.8" />
                  <polygon points="50,27.5 71.4,43.1 63.2,68.2 36.8,68.2 28.6,43.1" stroke="currentColor" strokeWidth="0.55" strokeDasharray="1.5,1.8" />
                  <polygon points="50,38.8 60.7,46.5 56.6,59.1 43.4,59.1 39.3,46.5" stroke="currentColor" strokeWidth="0.55" strokeDasharray="1.5,1.8" />

                  <line x1="50" y1="50" x2="50" y2="16" />
                  <line x1="50" y1="50" x2="82.3" y2="39.5" />
                  <line x1="50" y1="50" x2="70" y2="77.5" />
                  <line x1="50" y1="50" x2="30" y2="77.5" />
                  <line x1="50" y1="50" x2="17.7" y2="39.5" />

                  <polygon
                    points={benchmarkPolygonPoints}
                    fill="rgba(148,163,184,0.08)"
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <polygon
                    points={animatedPolygonPoints}
                    fill="rgba(251,114,153,0.24)"
                    stroke="#fb7299"
                    strokeWidth="2.2"
                    style={{
                      filter: "drop-shadow(0 0 16px rgba(251,114,153,0.24))",
                    }}
                  />
                  {animatedScores.map((value, index) => {
                    const point = polarToCartesian(value, CAPABILITY_AXES[index].angle);
                    return (
                      <g key={CAPABILITY_AXES[index].label}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="5.3"
                          fill="rgba(59,130,246,0.14)"
                          stroke="none"
                          className="animate-pulse"
                          style={{ animationDelay: `${index * 120}ms` }}
                        />
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
                  <span className="text-2xl font-black text-[#171c22]">{overallScore}</span>
                  <span className="text-[10px] font-bold text-[#564145]">五维均衡稳定</span>
                </div>

                {CAPABILITY_AXES.map((axis, index) => (
                  <div
                    key={axis.label}
                    className={`${axis.labelClassName} z-10 whitespace-nowrap rounded-2xl border border-white/80 bg-white/88 px-2.5 py-1.5 text-[10px] shadow-[0_8px_18px_rgba(148,163,184,0.18)] backdrop-blur-sm transition-transform hover:scale-[1.03]`}
                    style={{
                      opacity: Math.max(0.5, radarProgress),
                      transform: `${axis.labelClassName.includes("-translate-x-1/2") ? "translateX(-50%) " : ""}translateY(${(1 - radarProgress) * 8}px)`,
                      transitionDelay: `${index * 60}ms`,
                    }}
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
                  <p className="mt-1 text-sm font-extrabold text-[#171c22]">{strongestAxis.label}</p>
                  <p className="text-[11px] text-[#564145]">当前领先维度，适合继续拉开优势。</p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/75 px-3 py-3 shadow-sm backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-mono">Agent Sync</p>
                  <p className="mt-1 text-sm font-extrabold text-[#171c22]">4 个协同智能体已同步</p>
                  <p className="text-[11px] text-[#564145]">规划、答疑、测评与资源策略已联动更新。</p>
                </div>
              </div>
            </div>
          </div>

          {/* 雷达图例说明 */}
          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 pt-1 text-[11px] font-mono font-medium text-[#564145]">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 bg-[#fb7299] rounded-sm inline-block" />
              当前学者评定
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 bg-slate-200 rounded-sm inline-block border border-dashed border-slate-400" />
              同席学友基准值 (Cohort Average)
            </span>
          </div>
        </div>

        {/* 右侧边栏：已获勋章 & 个人历史学业动态 */}
        <aside className="w-full lg:w-80 shrink-0 space-y-6">
          
          {/* 我的个人勋章墙 */}
          <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm space-y-4">
            <h3 className="font-sans text-xs font-extrabold uppercase tracking-wider text-[#171c22] border-b border-gray-100 pb-2.5">
              研学金闪闪勋章 (Achievements)
            </h3>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="flex flex-col items-center p-2.5 bg-[#fb7299]/5 rounded-2xl border border-[#fb7299]/15">
                <div className="w-10 h-10 rounded-full bg-[#fb7299]/15 flex items-center justify-center text-[#fb7299] mb-1.5">
                  <Zap className="w-5 h-5 fill-current animate-bounce" />
                </div>
                <span className="text-[9.5px] font-bold text-[#171c22] leading-tight">30天勤学打卡</span>
              </div>

              <div className="flex flex-col items-center p-2.5 bg-[#006689]/5 rounded-2xl border border-[#006689]/15">
                <div className="w-10 h-10 rounded-full bg-[#006689]/15 flex items-center justify-center text-[#006689] mb-1.5">
                  <Award className="w-5 h-5" />
                </div>
                <span className="text-[9.5px] font-bold text-[#171c22] leading-tight">全席前5%精英</span>
              </div>

              <div className="flex flex-col items-center p-2.5 bg-gray-50 rounded-2xl border border-gray-100 opacity-60">
                <div className="w-10 h-10 rounded-full bg-slate-200/50 flex items-center justify-center text-slate-400 mb-1.5">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <span className="text-[9.5px] font-bold text-[#171c22] leading-tight">未解锁成就</span>
              </div>
            </div>
          </section>

          {/* 随堂学业大事记 */}
          <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm space-y-4 flex flex-col justify-between">
            <h3 className="font-sans text-xs font-extrabold uppercase tracking-wider text-[#171c22] border-b border-gray-100 pb-2.5 flex items-center gap-1.5">
              <History className="w-4 h-4 text-[#fb7299]" />
              学业实践日志 (Action Logs)
            </h3>

            <div className="space-y-4">
              {RECENT_ACTIVITIES.map((act) => {
                // Determine localized title label
                let titleZh = act.title;
                if (act.title.includes("Completed Module")) titleZh = "顺利解锁 'React 高阶重构模式' 新路线";
                if (act.title.includes("Submitted Project")) titleZh = "成功推送并归档 '商城仪表盘' 完结大作业";
                if (act.title.includes("Started Course")) titleZh = "启航 'UI/UX 先进交互原理解析' 精英课题";

                return (
                  <div key={act.id} className="relative pl-5 before:absolute before:left-1.5 before:top-1.5 before:bottom-[-20px] before:w-0.5 before:bg-slate-100 last:before:hidden text-xs">
                    {/* Point */}
                    <div className="absolute left-[3px] top-[5px] w-2 h-2 rounded-full bg-[#fb7299]" />
                    <p className="text-[#171c22] font-semibold">{titleZh}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] text-[#564145]/75 font-mono">{act.time}</span>
                      <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1 py-0.2 rounded font-bold font-mono">{act.gain}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

        </aside>
      </div>

      {/* 3. 底部版块：系统推荐策略与综合诊断 */}
      <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm space-y-5">
        <h3 className="font-sans text-sm font-extrabold text-[#171c22] flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#fb7299] shrink-0" />
          研学报告诊断结论 & 辅导调优建议 (5-Agent Diagnostics)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[#f0f4fc]/65 rounded-2xl border border-blue-50 text-xs leading-relaxed">
            <p className="uppercase tracking-wider font-extrabold text-[#006689] text-[9px] mb-1 font-mono">Current Status • 状态诊断</p>
            <h4 className="font-bold text-[#171c22] text-sm mb-1.5">高效、连贯的学习执行期</h4>
            <p className="text-[#564145]">
              过去30天内，你在 React 最佳架构实践中展示了优异的习惯持续力，测评通过速度处于前 5%。但对“认知广度”与“规划力”的相关重构模型仍有空白，建议适当增加机器学习及 D3.js 图形可视化类讲义精读。
            </p>
          </div>

          <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100 text-xs text-[#00516e] leading-relaxed">
            <p className="uppercase tracking-wider font-extrabold text-emerald-800 text-[9px] mb-1 font-mono">Recommended Actions • 下步行动</p>
            <div className="space-y-2 mt-1.5">
              <p className="flex items-start gap-1.5 font-sans font-medium text-emerald-950">
                <span className="text-emerald-700 shrink-0 font-extrabold">•</span> 前往 <Link className="text-[#006689] underline font-bold" to="/path">学习路径</Link>，打卡完成 “第二阶段：Custom Hooks 组合” 中的实操验证。
              </p>
              <p className="flex items-start gap-1.5 font-sans font-medium text-emerald-950">
                <span className="text-emerald-700 shrink-0 font-extrabold">•</span> 前往 <Link className="text-[#fb7299] underline font-bold" to="/tutor">知识检索与答疑</Link>，让答疑智能体结合画像、规划与测评结果，深入解析 “React useCallback 优化防止重渲染” 的底层细节。
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
