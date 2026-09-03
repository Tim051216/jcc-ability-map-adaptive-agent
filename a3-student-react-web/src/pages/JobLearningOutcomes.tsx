import { useEffect, useState } from "react";
import { ArrowLeft, CircleAlert, LoaderCircle, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { getCurrentLoggedInUserId } from "../lib/currentUser";
import { studentApi, type JobLearningOutcome } from "../lib/studentApi";

export default function JobLearningOutcomes() {
  const userId = getCurrentLoggedInUserId();
  const [data, setData] = useState<JobLearningOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; studentApi.getJobLearningOutcomes(userId).then((next) => active && setData(next)).catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "学习效果暂时不可用")); return () => { active = false; }; }, [userId]);
  if (error) return <State><CircleAlert />{error}</State>;
  if (!data) return <State><LoaderCircle className="animate-spin" />正在读取前后测数据...</State>;
  const change = data.score_change;
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8">
    <Link to="/job-learning" className="inline-flex items-center gap-2 text-sm font-bold text-[#69717a] hover:text-[#e4002b]"><ArrowLeft size={16} />返回岗位学习</Link>
    <header className="border-b border-[#dfe3e8] pb-6"><p className="text-sm font-bold text-[#e4002b]">能力诊断与学习效果</p><h1 className="mt-2 text-3xl font-black text-[#141414]">前后测变化</h1><p className="mt-2 text-sm text-[#69717a]">{data.summary}</p></header>
    <section className="grid gap-4 md:grid-cols-4">{[["状态", data.status], ["测评次数", String(data.assessment_count)], ["首次分数", data.baseline_score == null ? "--" : String(data.baseline_score)], ["最新分数", data.latest_score == null ? "--" : String(data.latest_score)]].map(([label, value]) => <div key={label} className="border border-[#dfe3e8] p-4"><div className="text-xs text-[#69717a]">{label}</div><div className="mt-2 text-xl font-black text-[#141414]">{value}</div></div>)}</section>
    <section className="border border-[#dfe3e8] p-5"><div className="flex items-center gap-3"><h2 className="text-xl font-black">总分变化</h2>{change == null ? <span className="text-sm text-[#69717a]">暂无可比较的两次测评</span> : <span className={`inline-flex items-center gap-1 text-sm font-bold ${change >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}{change > 0 ? "+" : ""}{change} 分</span>}</div><p className="mt-3 text-sm text-[#69717a]">只有至少两次真实测评时，系统才会展示前后测结论。</p></section>
    <section><h2 className="text-xl font-black">能力维度变化</h2><div className="mt-4 divide-y divide-[#dfe3e8] border-y border-[#dfe3e8]">{data.ability_changes.length ? data.ability_changes.map((item) => <div key={String(item.code)} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><div className="font-bold">{String(item.label || item.code)}</div><code className="text-xs text-[#69717a]">{String(item.code)}</code></div><div className="text-sm text-[#69717a]">{item.change == null ? "暂无变化" : `变化 ${Number(item.change) > 0 ? "+" : ""}${String(item.change)} 分`} · {String(item.assessment_status || "not_assessed")}</div></div>) : <p className="py-5 text-sm text-[#69717a]">暂无能力变化数据。</p>}</div></section>
  </main>;
}
function State({ children }: { children: React.ReactNode }) { return <main className="mx-auto flex max-w-3xl items-center justify-center gap-3 px-4 py-24 text-sm text-[#69717a]">{children}</main>; }
