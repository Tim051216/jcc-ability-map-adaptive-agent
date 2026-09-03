import { useEffect, useState } from "react";
import { ArrowRight, BriefcaseBusiness, CircleAlert, LoaderCircle, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { getCurrentLoggedInUserId } from "../lib/currentUser";
import { studentApi, type JobLearningOverview } from "../lib/studentApi";

export default function JobLearning() {
  const userId = getCurrentLoggedInUserId();
  const [data, setData] = useState<JobLearningOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    studentApi.getJobLearningOverview(userId).then((next) => {
      if (active) setData(next);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "岗位学习数据暂时不可用");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  if (loading) return <PageState><LoaderCircle className="animate-spin" />正在读取岗位学习数据...</PageState>;
  if (error) return <PageState><CircleAlert />{error}</PageState>;
  if (!data) return <PageState><CircleAlert />暂无岗位学习数据</PageState>;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8">
      <header className="border-b border-[#dfe3e8] pb-6">
        <div className="flex items-center gap-3 text-sm font-bold text-[#e4002b]"><BriefcaseBusiness size={18} />岗位自适应学习</div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-3xl font-black tracking-tight text-[#141414]">{data.job_name}</h1><p className="mt-2 text-sm text-[#5b6168]">{data.professional_group} · {data.course_name}</p></div>
          <Link to="/job-learning/outcomes" className="inline-flex items-center gap-2 border border-[#141414] px-4 py-2 text-sm font-bold text-[#141414] hover:bg-[#141414] hover:text-white">查看学习效果 <ArrowRight size={16} /></Link>
        </div>
      </header>

      <section className="grid gap-4 border-b border-[#dfe3e8] pb-6 md:grid-cols-3">
        <Info label="学习目标" value={data.student_goal || "尚未设置"} />
        <Info label="目标场景" value={data.goal_scene || "尚未设置"} />
        <Info label="诊断状态" value={data.assessment_id ? "已有诊断记录" : "尚未测评"} />
      </section>

      <section>
        <div className="flex items-center justify-between"><h2 className="text-xl font-black text-[#141414]">岗位能力概览</h2><span className="text-xs text-[#69717a]">{data.assessment_updated_at ? `更新于 ${data.assessment_updated_at}` : "等待真实测评"}</span></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.ability_dimensions.map((item) => <article key={item.code} className="border border-[#dfe3e8] p-4"><div className="flex justify-between gap-3"><div><h3 className="font-bold text-[#141414]">{item.label}</h3><code className="text-xs text-[#69717a]">{item.code}</code></div><strong className="text-2xl tabular-nums text-[#e4002b]">{item.score ?? "--"}</strong></div><div className="mt-3 h-1 bg-[#edf0f2]"><div className="h-1 bg-[#e4002b]" style={{ width: `${item.score ?? 0}%` }} /></div><p className="mt-2 text-xs text-[#69717a]">{item.assessment_status === "not_assessed" ? "暂无足够测评数据" : `基准线 ${item.benchmark} · ${item.assessment_status === "derived" ? "规则推导" : "直接测量"}`}</p></article>)}
        </div>
      </section>

      <section className="border-t border-[#dfe3e8] pt-6"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-[#e4002b]" /><h2 className="text-xl font-black text-[#141414]">下一步</h2></div><div className="mt-3 border-l-2 border-[#e4002b] bg-[#fafafa] p-4"><p className="font-bold text-[#141414]">{data.next_action?.label || "完成岗位诊断"}</p><p className="mt-1 text-sm text-[#69717a]">{data.next_action?.reason || "完成真实测评后，系统会生成可核验的岗位学习建议。"}</p>{data.next_action?.route ? <Link className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#e4002b]" to={data.next_action.route}>立即进入 <ArrowRight size={15} /></Link> : null}</div></section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="border-l-2 border-[#141414] pl-3"><div className="text-xs text-[#69717a]">{label}</div><div className="mt-1 font-bold text-[#141414]">{value}</div></div>; }
function PageState({ children }: { children: React.ReactNode }) { return <main className="mx-auto flex max-w-3xl items-center justify-center gap-3 px-4 py-24 text-sm text-[#69717a]">{children}</main>; }
