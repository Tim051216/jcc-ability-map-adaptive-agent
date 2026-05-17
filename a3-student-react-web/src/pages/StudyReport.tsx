import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Award,
  Calendar,
  ChevronRight,
  Download,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";
import {
  studentApi,
  type EvaluationHistoryItem,
  type EvaluationPaperSummaryResponse,
  type EvaluationTrendResponse,
  type ProfileSummaryResponse,
  type ResourceFavoriteSummaryResponse,
} from "../lib/studentApi";

const DEFAULT_USER_ID = 1001;
const DEFAULT_COURSE_ID = 101;

function getCourseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get("courseId") || DEFAULT_COURSE_ID);
}

function formatDateLabel(value?: string | null) {
  if (!value) {
    return "暂无记录";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
}

function formatResourceType(type: string) {
  const map: Record<string, string> = {
    lecture_note: "课堂笔记",
    lecture_notes: "课堂笔记",
    mind_map: "思维导图",
    quiz_set: "练习题",
    practice_set: "练习题",
    extended_reading: "拓展阅读",
    coding_lab: "编码实验",
    case_study: "案例分析",
  };
  return map[type] || type;
}

function buildScoreSeries(history: EvaluationHistoryItem[]) {
  return [...history]
    .reverse()
    .map((item, index) => ({
      name: `第 ${index + 1} 次`,
      score: item.overall_score,
      date: formatDateLabel(item.created_at),
    }));
}

function buildKnowledgeDistribution(summary: EvaluationPaperSummaryResponse | null) {
  return Object.entries(summary?.by_knowledge_point || {}).map(([name, value], index) => ({
    name,
    value,
    color: ["#004ac6", "#006c49", "#784b00", "#ba1a1a", "#5c2d91", "#0f766e"][index % 6],
  }));
}

function translateCurrentStage(value?: string | null) {
  if (!value) {
    return "暂无阶段信息";
  }

  const map: Record<string, string> = {
    "Master the A3 intelligent learning workflow": "掌握 A3 智能学习工作流",
    "Master the A3 intelligent learning workflow basics": "掌握 A3 智能学习工作流基础",
    "No active stage yet": "暂无阶段信息",
  };

  return map[value] || value;
}

export function StudyReport() {
  const courseId = useMemo(() => getCourseIdFromUrl(), []);
  const [history, setHistory] = useState<EvaluationHistoryItem[]>([]);
  const [trend, setTrend] = useState<EvaluationTrendResponse | null>(null);
  const [paperSummary, setPaperSummary] = useState<EvaluationPaperSummaryResponse | null>(null);
  const [profileSummary, setProfileSummary] = useState<ProfileSummaryResponse | null>(null);
  const [favoriteSummary, setFavoriteSummary] = useState<ResourceFavoriteSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      try {
        setLoading(true);
        setError(null);

        const historyResponse = await studentApi.getEvaluationHistory(DEFAULT_USER_ID, courseId).catch(() => ({ items: [], total: 0 }));
        const courseCode = historyResponse.items[0]?.course_code || "ml_intro";

        const [trendResponse, paperSummaryResponse, profileResponse, favoriteResponse] = await Promise.all([
          studentApi.getEvaluationTrend(DEFAULT_USER_ID, courseId).catch(() => null),
          studentApi.getEvaluationPaperSummary(DEFAULT_USER_ID, courseCode).catch(() => null),
          studentApi.getProfileSummary(DEFAULT_USER_ID).catch(() => null),
          studentApi.getFavoriteSummary(DEFAULT_USER_ID).catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        setHistory(historyResponse.items);
        setTrend(trendResponse);
        setPaperSummary(paperSummaryResponse);
        setProfileSummary(profileResponse);
        setFavoriteSummary(favoriteResponse);
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "学习报告加载失败";
          setError(message);
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

  const latestRecord = history[0] || null;
  const scoreSeries = buildScoreSeries(history);
  const knowledgeDistribution = buildKnowledgeDistribution(paperSummary);
  const strongestKnowledge = knowledgeDistribution[0]?.name || "等待试卷数据";
  const improvement = trend?.improvement ?? 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <section className="rounded-[28px] border border-outline-variant/50 bg-white p-8 shadow-sm md:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
              <Activity className="h-4 w-4" />
              学习结果总览
            </div>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-on-surface">一页看懂你最近学得怎么样</h2>
            <p className="mt-4 text-lg leading-8 text-on-surface-variant">
              这里把测评分数、知识点分布、画像变化和收藏资料汇总到一起，帮你快速判断“哪里学得不错、哪里还要补”。
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-surface-variant/25 p-4">
                <div className="text-[11px] font-bold text-primary">先看什么</div>
                <div className="mt-2 text-sm text-on-surface">先看最近分数和进步趋势</div>
              </div>
              <div className="rounded-2xl bg-surface-variant/25 p-4">
                <div className="text-[11px] font-bold text-primary">再看什么</div>
                <div className="mt-2 text-sm text-on-surface">看知识点分布找到短板</div>
              </div>
              <div className="rounded-2xl bg-surface-variant/25 p-4">
                <div className="text-[11px] font-bold text-primary">最后做什么</div>
                <div className="mt-2 text-sm text-on-surface">按页面底部建议回去补练</div>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <button className="flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-6 py-3 text-sm font-bold text-on-surface shadow-sm transition-all hover:bg-surface-container-low">
              <Share2 className="h-4 w-4" />
              分享结果
            </button>
            <button className="flex items-center gap-2 rounded-xl bg-on-surface px-8 py-3 text-sm font-bold text-white shadow-xl transition-all hover:opacity-90 active:scale-95">
              <Download className="h-4 w-4" />
              导出摘要
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">{error}</div> : null}

      <div className="grid grid-cols-12 gap-8">
        <section className="col-span-12 overflow-hidden rounded-3xl border border-outline-variant bg-white p-10 shadow-sm lg:col-span-8">
          <div className="mb-12 flex items-start justify-between gap-6">
            <div>
              <h3 className="text-2xl font-black text-on-surface">最近成绩变化</h3>
              <p className="mt-2 text-sm text-on-surface-variant">先看分数是上升还是下降，这能最快判断最近这段学习有没有效果。</p>
            </div>
            <div className="rounded-xl border border-secondary/10 bg-secondary/5 px-4 py-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-secondary" />
                <span className="text-xs font-bold text-secondary">本轮变化 {improvement >= 0 ? `+${improvement}` : improvement}</span>
              </div>
            </div>
          </div>

          {scoreSeries.length ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                {scoreSeries.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="rounded-2xl bg-surface-container-low p-5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{item.name}</div>
                    <div className="mt-2 text-3xl font-black text-primary">{item.score}</div>
                    <div className="mt-1 text-xs text-on-surface-variant">{item.date}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl bg-surface-container-low p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-bold text-on-surface">趋势变化</span>
                  <span className="text-xs text-on-surface-variant">当前掌握度：{trend?.latest_mastery_level || "--"}</span>
                </div>
                <div className="flex items-end gap-4">
                  {scoreSeries.map((item, index) => (
                    <div key={`${item.name}-bar-${index}`} className="flex flex-1 flex-col items-center gap-3">
                      <div className="flex h-44 w-full items-end rounded-2xl bg-white px-3 pb-3">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(12, item.score)}%` }}
                          transition={{ duration: 0.8, delay: index * 0.08 }}
                          className="w-full rounded-xl bg-gradient-to-t from-primary to-secondary"
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-bold text-on-surface">{item.score}</div>
                        <div className="text-[10px] text-on-surface-variant">{item.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-outline-variant px-6 py-12 text-center text-sm text-on-surface-variant">
              当前还没有可展示的测评记录，先去做一份测评，报告才会更有参考价值。
            </div>
          )}
        </section>

        <div className="col-span-12 space-y-8 lg:col-span-4">
          <div className="group relative flex h-[300px] flex-col justify-between overflow-hidden rounded-3xl bg-primary p-8 text-white shadow-xl shadow-primary/20">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-3xl transition-transform group-hover:scale-150" />
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">画像完整度</span>
              <div className="mt-2 flex items-baseline gap-2">
                <h4 className="text-6xl font-black">{profileSummary?.completeness ?? 0}</h4>
                <span className="text-xl font-bold opacity-60">%</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(8, profileSummary?.completeness ?? 0)}%` }}
                  transition={{ duration: 1 }}
                  className="h-full bg-white"
                />
              </div>
              <div className="flex items-center justify-between text-xs font-bold">
                <span>{translateCurrentStage(profileSummary?.current_stage)}</span>
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  当前阶段
                </span>
              </div>
            </div>
          </div>

          <div className="flex h-[calc(100%-340px)] flex-col rounded-3xl border border-outline-variant bg-white p-8 shadow-sm">
            <div className="mb-6 flex items-start justify-between">
              <h3 className="text-xl font-bold text-on-surface">最适合你的学习方式</h3>
              <Sparkles className="h-6 w-6 text-tertiary" />
            </div>
            <div className="flex flex-1 flex-col justify-center text-center">
              <div className="mb-6 flex items-center justify-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-8 border-tertiary/10 border-t-tertiary">
                  <span className="text-3xl font-black text-tertiary">{trend?.best_score ?? "--"}</span>
                </div>
              </div>
              <p className="text-sm font-bold text-on-surface">{profileSummary?.recommended_learning_style || "当前还没有学习方式建议。"}</p>
              <p className="mt-2 text-xs text-on-surface-variant">这里会结合你的最近成绩和画像结果，告诉你更适合怎么学。</p>
            </div>
          </div>
        </div>

        <section className="col-span-12 rounded-3xl border border-outline-variant bg-white p-8 shadow-sm lg:col-span-4">
          <h3 className="mb-8 text-xl font-bold text-on-surface">哪里掌握得多，哪里还要补</h3>
          <div className="space-y-8">
            {knowledgeDistribution.length ? (
              knowledgeDistribution.map((item) => (
                <div key={item.name} className="space-y-3">
                  <div className="flex items-end justify-between">
                    <span className="text-sm font-bold text-on-surface">{item.name}</span>
                    <span className="text-sm font-black italic" style={{ color: item.color }}>
                      {item.value}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, item.value * 16)}%` }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-on-surface-variant">当前还没有试卷知识点数据，做完测评后这里会告诉你强弱分布。</div>
            )}
          </div>

          <div className="mt-12 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
            <p className="text-xs leading-relaxed text-on-surface-variant">
              <span className="mr-1 font-bold text-primary">当前重点：</span>
              {strongestKnowledge}
            </p>
          </div>
        </section>

        <section className="col-span-12 rounded-3xl border border-outline-variant bg-white p-8 shadow-sm lg:col-span-8">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-tertiary" />
              <h3 className="text-xl font-bold text-on-surface">最近最值得关注的 4 个信号</h3>
            </div>
            <button className="text-xs font-bold text-primary hover:underline">查看全部指标</button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {[
              {
                title: "最近一次测评",
                desc: latestRecord?.report_summary || "当前还没有测评记录。",
                meta: latestRecord ? `${latestRecord.overall_score} 分` : "等待中",
                icon: Zap,
                color: "primary",
              },
              {
                title: "收藏资料",
                desc: `你现在一共收藏了 ${favoriteSummary?.total ?? 0} 条资料。`,
                meta: Object.keys(favoriteSummary?.by_type || {}).map(formatResourceType).join(" / ") || "暂无收藏",
                icon: Award,
                color: "secondary",
              },
              {
                title: "画像标签",
                desc: profileSummary?.tags.join(" / ") || "当前还没有画像标签。",
                meta: `${profileSummary?.tags.length ?? 0} 个标签`,
                icon: Target,
                color: "tertiary",
              },
              {
                title: "试卷情况",
                desc: `当前共有 ${paperSummary?.total ?? 0} 份试卷、${paperSummary?.total_questions ?? 0} 道已跟踪题目。`,
                meta: paperSummary?.latest_paper_at ? formatDateLabel(paperSummary.latest_paper_at) : "暂无试卷",
                icon: Activity,
                color: "primary",
              },
            ].map((item) => (
              <div key={item.title} className="group flex cursor-default gap-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 transition-all hover:border-primary/30">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-110",
                    item.color === "primary" ? "bg-primary text-white" : item.color === "secondary" ? "bg-secondary text-white" : "bg-tertiary text-white",
                  )}
                >
                  <item.icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="font-bold text-on-surface">{item.title}</h4>
                    <span className="text-[10px] font-bold text-on-surface-variant opacity-50">{item.meta}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative mt-12 flex flex-col items-center justify-between gap-8 overflow-hidden rounded-[2.5rem] bg-on-surface p-10 text-white md:flex-row">
            <div className="absolute inset-0 bg-primary/20 opacity-30 blur-[100px]" />
            <div className="relative z-10 flex items-center gap-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h5 className="mb-2 text-2xl font-black">接下来最值得补的地方</h5>
                <p className="max-w-sm text-sm opacity-70">
                  {trend?.focus_knowledge_points.length
                    ? `建议你下一步重点关注：${trend.focus_knowledge_points.join("、")}。`
                    : "当后续产生更多测评数据后，这里会自动告诉你下一步最该补哪部分。"}
                </p>
              </div>
            </div>
            <a
              href={`/evaluation?courseId=${courseId}`}
              className="relative z-10 flex items-center gap-3 rounded-xl bg-primary px-10 py-4 text-sm font-black text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              去做下一次测评
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </section>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
          <Calendar className="h-4 w-4" />
          正在加载学习结果...
        </div>
      ) : null}
    </div>
  );
}
