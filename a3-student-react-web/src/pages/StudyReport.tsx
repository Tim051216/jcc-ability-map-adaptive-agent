import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BarChart,
  BookOpen,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  ACTIVE_COURSE_ID,
  ACTIVE_USER_ID,
  resolveCourseIdFromSearchParams,
} from "../lib/courseContext";
import { studentApi, type StudyReportResponse } from "../lib/studentApi";

export default function StudyReport() {
  const [searchParams] = useSearchParams();
  const courseId = resolveCourseIdFromSearchParams(searchParams, ACTIVE_COURSE_ID);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<StudyReportResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadReport() {
      setLoading(true);
      setError(null);
      try {
        const data = await studentApi.getStudentStudyReport(ACTIVE_USER_ID, courseId);
        if (!cancelled) {
          setReport(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "学习报告加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const maxHours = useMemo(
    () => Math.max(...(report?.weekly_study.map((item) => item.hours) || [1])),
    [report],
  );

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-[#E3E8EC] bg-white text-sm font-semibold text-[#564145]">
        <span className="flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          正在加载学习报告...
        </span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="rounded-3xl border border-[#E3E8EC] bg-white p-8 text-sm text-[#564145] shadow-sm">
        <p className="font-bold text-[#171c22]">学习报告暂不可用</p>
        <p className="mt-2">{error || "暂无报告数据。"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none" id="study-report-workspace">
      <section className="relative overflow-hidden rounded-[32px] border border-[#dce7ea] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(244,247,249,0.9)_40%,_rgba(219,240,238,0.9)_100%)] p-6 shadow-[0_20px_60px_rgba(15,46,57,0.08)] lg:p-8">
        <div className="relative grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#0f6c7b]">
                <Sparkles className="h-3.5 w-3.5" />
                Weekly Learning Intelligence Report
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#171c22] px-3 py-1 text-[11px] font-bold text-white">
                业务周报
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-[#171c22] lg:text-5xl">
                个人综合学习报告
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[#415058] lg:text-base">
                当前报告页已切到后端聚合数据，不再使用前端静态周报占位内容。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white/75 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6c7b83]">学习总量</p>
                <p className="mt-2 text-2xl font-extrabold text-[#171c22]">{report.total_hours.toFixed(1)}h</p>
                <p className="mt-1 text-xs text-[#5a6970]">本周累计投入</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/75 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6c7b83]">单日峰值</p>
                <p className="mt-2 text-2xl font-extrabold text-[#171c22]">{report.best_day}</p>
                <p className="mt-1 text-xs text-[#5a6970]">学习强度最高日期</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/75 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6c7b83]">日均时长</p>
                <p className="mt-2 text-2xl font-extrabold text-[#171c22]">{report.average_hours.toFixed(1)}h</p>
                <p className="mt-1 text-xs text-[#5a6970]">路径与行为估算</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/80 bg-[#171c22] p-5 text-white shadow-[0_24px_50px_rgba(23,28,34,0.18)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/55">综合诊断评分</p>
                <p className="mt-3 text-6xl font-extrabold leading-none">{report.overall_score}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <TrendingUp className="h-8 w-8 text-[#ffb74d]" />
              </div>
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#ffb74d_0%,#fb7299_55%,#4dd0e1_100%)]"
                style={{ width: `${report.overall_score}%` }}
              />
            </div>
            <div className="mt-6 space-y-3">
              {report.metrics.map((metric) => (
                <div key={metric.key} className="flex items-start gap-3 rounded-2xl bg-white/6 p-3">
                  <Clock3 className="mt-0.5 h-4.5 w-4.5 text-[#4dd0e1]" />
                  <div>
                    <p className="text-sm font-bold text-white">{metric.label}</p>
                    <p className="text-sm text-white/86">{metric.value}</p>
                    {metric.note ? <p className="text-xs text-white/60">{metric.note}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {report.metrics.map((card) => {
          const Icon = card.key === "hours" ? Clock3 : card.key === "score" ? TrendingUp : BookOpen;
          return (
            <article
              key={card.key}
              className="group overflow-hidden rounded-[28px] border border-[#dde7ea] bg-white p-5 shadow-[0_16px_40px_rgba(23,28,34,0.05)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#73838a]">{card.label}</p>
                  <p className="mt-4 text-3xl font-extrabold text-[#171c22]">{card.value}</p>
                  {card.note ? <p className="mt-2 text-sm font-bold text-[#0f6c7b]">{card.note}</p> : null}
                </div>
                <div className="rounded-2xl bg-[#fb7299]/10 p-3 text-[#fb7299]">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              {card.hint ? (
                <div className="mt-5 border-t border-[#edf2f4] pt-4">
                  <p className="text-sm leading-6 text-[#5a6970]">{card.hint}</p>
                </div>
              ) : null}
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
            </div>
          </div>

          <div className="px-4 pb-5 pt-6 md:px-6">
            <div className="rounded-[28px] bg-[linear-gradient(180deg,#f8fbfb_0%,#f3f7f8_100%)] p-4 md:p-6">
              <div className="grid h-[320px] grid-cols-7 items-end gap-3 md:gap-4">
                {report.weekly_study.map((item) => {
                  const ratio = item.hours / maxHours;
                  const isPeak = item.day === report.best_day;
                  return (
                    <div key={item.day} className="flex h-full flex-col justify-end">
                      <div className="mb-3 text-center">
                        <p className={`text-sm font-extrabold ${isPeak ? "text-[#171c22]" : "text-[#49585f]"}`}>{item.hours}h</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b989d]">{item.focus}</p>
                      </div>
                      <div className="relative flex-1 rounded-[22px] bg-white/80 p-2 shadow-[inset_0_0_0_1px_rgba(220,231,234,0.9)]">
                        <div className="flex h-full items-end">
                          <div
                            className={`w-full rounded-[18px] bg-gradient-to-t ${isPeak ? "from-[#ff8a65] via-[#fb7299] to-[#ffc371]" : "from-[#0f6c7b] via-[#1697a6] to-[#70d6df]"}`}
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
              {report.diagnosis_feed.map((item) => (
                <div key={item.id} className="rounded-2xl bg-[#f7fafb] p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-bold text-[#171c22]">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-[#5a6970]">
                        {item.gain} · {item.time}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="overflow-hidden rounded-[32px] border border-[#172127] bg-[#171c22] text-white shadow-[0_16px_50px_rgba(23,28,34,0.14)]">
            <div className="border-b border-white/10 px-6 py-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">Recommendation</p>
              <h2 className="mt-2 text-xl font-extrabold">下一步行动建议</h2>
            </div>
            <div className="space-y-3 px-6 py-5">
              {report.recommendations.map((item) => (
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
