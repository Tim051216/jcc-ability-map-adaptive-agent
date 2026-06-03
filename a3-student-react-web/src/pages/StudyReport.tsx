/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  Award,
  BarChart,
  BookOpen,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { METRIC_SCORE } from "../constants";

const weeklyStudy = [
  { day: "周一", hrs: 2.2, focus: "回顾" },
  { day: "周二", hrs: 4.5, focus: "阅读" },
  { day: "周三", hrs: 3.1, focus: "练习" },
  { day: "周四", hrs: 5.6, focus: "精听" },
  { day: "周五", hrs: 4.0, focus: "诊断" },
  { day: "周六", hrs: 6.8, focus: "冲刺" },
  { day: "周日", hrs: 5.2, focus: "巩固" }
];

const summaryCards = [
  {
    title: "本周有效学习时长",
    value: `${METRIC_SCORE.studyTime} 小时`,
    note: METRIC_SCORE.studyTimeChange,
    hint: "覆盖视频精听、讲义研读与沙箱代码重构",
    icon: Clock3,
    accent: "from-[#ff8a65] to-[#fb7299]"
  },
  {
    title: "课程大纲达成进度",
    value: `${METRIC_SCORE.completedCount} / ${METRIC_SCORE.totalCount}`,
    note: "已达成 80.0% 目标",
    hint: "核心路径已完成大部分里程碑解锁",
    icon: BookOpen,
    accent: "from-[#1697a6] to-[#0f6c7b]"
  },
  {
    title: "导师互动诊断",
    value: "18 次",
    note: "较上月 +24%",
    hint: "围绕图表实现、React 状态治理与性能调优展开",
    icon: Bot,
    accent: "from-[#ffb74d] to-[#ff8f00]"
  }
];

const diagnosisFeed = [
  {
    title: "文献与资料审阅",
    desc: "成功下载并精读 3 份资料包，覆盖梯度推导、React 上下文优化与演示代码。",
    tone: "text-emerald-600"
  },
  {
    title: "视频课程完成率",
    desc: "《现代化 React 指标调优》系列课程已完整学习，关键章节均完成随堂标注。",
    tone: "text-sky-600"
  },
  {
    title: "实践沙箱表现",
    desc: "在性能调优沙箱中多次完成纠错闭环，说明你已具备较强的问题定位能力。",
    tone: "text-amber-600"
  }
];

const recommendations = [
  "下周优先进入进阶评估，验证复杂状态治理与图表表达能力。",
  "保持周末高强度学习节奏，同时把周一至周三的时长再拉高 15% 左右。",
  "继续结合 AI 导师问答，把“学过”转化为“能讲清、能实现、能优化”。"
];

export default function StudyReport() {
  const maxHours = Math.max(...weeklyStudy.map((item) => item.hrs));
  const totalHours = weeklyStudy.reduce((sum, item) => sum + item.hrs, 0);
  const averageHours = (totalHours / weeklyStudy.length).toFixed(1);
  const bestDay = weeklyStudy.reduce((best, item) => (item.hrs > best.hrs ? item : best), weeklyStudy[0]);

  return (
    <div className="space-y-6 select-none" id="study-report-workspace">
      <section className="relative overflow-hidden rounded-[32px] border border-[#dce7ea] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(244,247,249,0.9)_40%,_rgba(219,240,238,0.9)_100%)] p-6 shadow-[0_20px_60px_rgba(15,46,57,0.08)] lg:p-8">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(251,114,153,0.12),transparent_32%,rgba(15,108,123,0.12)_75%,rgba(255,183,77,0.12))]" />
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#fb7299]/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-36 w-36 rounded-full bg-[#1697a6]/10 blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#0f6c7b] backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Weekly Learning Intelligence Report
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#171c22] px-3 py-1 text-[11px] font-bold text-white">
                <Calendar className="h-3.5 w-3.5 text-[#ffb74d]" />
                统计周期 10月18日 - 10月25日
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-[#171c22] lg:text-5xl">
                个人综合学术研学报告
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[#415058] lg:text-base">
                这是一份由学习路径、课程精听、资源研读、自测表现与 AI 导师互动共同生成的周报。
                它不只记录你学了多久，更强调你在本周的学习密度、完成质量与下一步跃迁空间。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white/75 p-4 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6c7b83]">学习总量</p>
                <p className="mt-2 text-2xl font-extrabold text-[#171c22]">{totalHours.toFixed(1)}h</p>
                <p className="mt-1 text-xs text-[#5a6970]">本周累计投入，整体节奏稳定上扬</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/75 p-4 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6c7b83]">单日峰值</p>
                <p className="mt-2 text-2xl font-extrabold text-[#171c22]">{bestDay.hrs}h</p>
                <p className="mt-1 text-xs text-[#5a6970]">{bestDay.day} 学习强度最高，进入冲刺状态</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/75 p-4 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6c7b83]">日均时长</p>
                <p className="mt-2 text-2xl font-extrabold text-[#171c22]">{averageHours}h</p>
                <p className="mt-1 text-xs text-[#5a6970]">已接近目标线，周中仍有提升空间</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/80 bg-[#171c22] p-5 text-white shadow-[0_24px_50px_rgba(23,28,34,0.18)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/60">综合诊断评分</p>
                <p className="mt-3 text-6xl font-extrabold leading-none">{METRIC_SCORE.overallScore}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <Award className="h-8 w-8 text-[#ffb74d]" />
              </div>
            </div>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#ffb74d_0%,#fb7299_55%,#4dd0e1_100%)]"
                style={{ width: `${METRIC_SCORE.overallScore}%` }}
              />
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-start gap-3 rounded-2xl bg-white/6 p-3">
                <Flame className="mt-0.5 h-4.5 w-4.5 text-[#ff8a65]" />
                <p className="text-sm leading-6 text-white/86">
                  你的理论掌握与实践修正能力均处于高水平，尤其在复杂问题排错上表现突出。
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-white/6 p-3">
                <TrendingUp className="mt-0.5 h-4.5 w-4.5 text-[#4dd0e1]" />
                <p className="text-sm leading-6 text-white/86">
                  当前状态适合进入更高难度的阶段性评估，把“会做”进一步提升为“会优化、会表达”。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="group overflow-hidden rounded-[28px] border border-[#dde7ea] bg-white p-5 shadow-[0_16px_40px_rgba(23,28,34,0.05)] transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#73838a]">{card.title}</p>
                  <p className="mt-4 text-3xl font-extrabold text-[#171c22]">{card.value}</p>
                  <p className="mt-2 text-sm font-bold text-[#0f6c7b]">{card.note}</p>
                </div>
                <div className={`rounded-2xl bg-gradient-to-br p-3 text-white shadow-lg ${card.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[#edf2f4] pt-4">
                <p className="max-w-[85%] text-sm leading-6 text-[#5a6970]">{card.hint}</p>
                <ChevronRight className="h-4.5 w-4.5 text-[#b7c4c8] transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <article className="overflow-hidden rounded-[32px] border border-[#dde7ea] bg-white shadow-[0_16px_50px_rgba(23,28,34,0.05)]">
          <div className="flex flex-col gap-4 border-b border-[#edf2f4] px-6 py-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#73838a]">Study Rhythm</p>
              <h2 className="mt-2 flex items-center gap-2 text-xl font-extrabold text-[#171c22]">
                <BarChart className="h-5 w-5 text-[#fb7299]" />
                周学习时长趋势
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#5a6970]">
                从周四开始进入高效区间，周末形成明显峰值，说明你的深度学习更适合集中式推进。
              </p>
            </div>
            <div className="rounded-2xl bg-[#f4f8f8] px-4 py-3 text-sm font-semibold text-[#0f6c7b]">
              目标标线：4.0 小时 / 日
            </div>
          </div>

          <div className="px-4 pb-5 pt-6 md:px-6">
            <div className="rounded-[28px] bg-[linear-gradient(180deg,#f8fbfb_0%,#f3f7f8_100%)] p-4 md:p-6">
              <div className="grid h-[320px] grid-cols-7 items-end gap-3 md:gap-4">
                {weeklyStudy.map((item) => {
                  const ratio = item.hrs / maxHours;
                  const isPeak = item.day === bestDay.day;
                  return (
                    <div key={item.day} className="flex h-full flex-col justify-end">
                      <div className="mb-3 text-center">
                        <p className={`text-sm font-extrabold ${isPeak ? "text-[#171c22]" : "text-[#49585f]"}`}>{item.hrs}h</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b989d]">{item.focus}</p>
                      </div>

                      <div className="relative flex-1 rounded-[22px] bg-white/80 p-2 shadow-[inset_0_0_0_1px_rgba(220,231,234,0.9)]">
                        <div className="absolute inset-x-2 top-[26%] border-t border-dashed border-[#d8e2e6]" />
                        <div className="absolute inset-x-2 top-[52%] border-t border-dashed border-[#d8e2e6]" />
                        <div className="absolute inset-x-2 top-[78%] border-t border-dashed border-[#d8e2e6]" />
                        <div className="flex h-full items-end">
                          <div
                            className={`w-full rounded-[18px] bg-gradient-to-t transition-all duration-500 ${
                              isPeak
                                ? "from-[#ff8a65] via-[#fb7299] to-[#ffc371]"
                                : "from-[#0f6c7b] via-[#1697a6] to-[#70d6df]"
                            }`}
                            style={{ height: `${Math.max(22, ratio * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-3 text-center">
                        <p className="text-sm font-bold text-[#171c22]">{item.day}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </article>

        <aside className="space-y-6">
          <article className="rounded-[32px] border border-[#dde7ea] bg-white p-6 shadow-[0_16px_40px_rgba(23,28,34,0.05)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#73838a]">Diagnostic Feed</p>
            <h2 className="mt-2 text-xl font-extrabold text-[#171c22]">学习表现切面</h2>

            <div className="mt-5 space-y-4">
              {diagnosisFeed.map((item) => (
                <div key={item.title} className="rounded-2xl bg-[#f7fafb] p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${item.tone}`} />
                    <div>
                      <p className="font-bold text-[#171c22]">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-[#5a6970]">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="overflow-hidden rounded-[32px] border border-[#172127] bg-[#171c22] text-white shadow-[0_16px_50px_rgba(23,28,34,0.14)]">
            <div className="border-b border-white/10 px-6 py-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">Recommendation</p>
              <h2 className="mt-2 text-xl font-extrabold">下周行动建议</h2>
            </div>

            <div className="space-y-3 px-6 py-5">
              {recommendations.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl bg-white/6 p-4">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffb74d] text-xs font-extrabold text-[#171c22]">
                    +
                  </span>
                  <p className="text-sm leading-6 text-white/88">{item}</p>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
