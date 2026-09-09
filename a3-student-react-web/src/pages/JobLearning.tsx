import { useEffect, useState } from "react";
import { ArrowRight, BriefcaseBusiness, CircleAlert, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { getCurrentLoggedInUserId } from "../lib/currentUser";
import { studentApi, type JobLearningOverview } from "../lib/studentApi";

export default function JobLearning() {
  const userId = getCurrentLoggedInUserId();
  const cacheKey = `job-learning-overview:${userId}:401`;
  const [data, setData] = useState<JobLearningOverview | null>(() => {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      return raw ? (JSON.parse(raw) as JobLearningOverview) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => data === null);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState(() => data?.student_goal || "");
  const [goalScene, setGoalScene] = useState(() => data?.goal_scene || "internship");
  const [savingGoal, setSavingGoal] = useState(false);

  useEffect(() => {
    let active = true;
    studentApi.getJobLearningOverview(userId, 401, 30000).then((next) => {
      try { sessionStorage.setItem(cacheKey, JSON.stringify(next)); } catch { /* Ignore storage limits. */ }
      if (active) { setData(next); setGoal(next.student_goal || ""); setGoalScene(next.goal_scene || "internship"); }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "岗位学习数据暂时不可用");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [cacheKey, userId]);

  if (loading) return <PageState><LoaderCircle className="animate-spin" />正在读取岗位学习数据...</PageState>;
  if (error) return <PageState><CircleAlert />{error}</PageState>;
  if (!data) return <PageState><CircleAlert />暂无岗位学习数据</PageState>;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8">
      <header className="border-b border-[#dfe3e8] pb-6">
        <div className="flex items-center gap-3 text-sm font-bold text-[#e4002b]"><BriefcaseBusiness size={18} />岗课赛自适应学习</div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-3xl font-black tracking-tight text-[#141414]">{data.job_name}</h1><p className="mt-2 text-sm text-[#5b6168]">岗位：{data.job_name} · 专业群：{data.professional_group} · 课程：{data.course_name}</p></div>
          <div className="flex flex-wrap items-center gap-2"><Link to="/industry-dashboard" className="inline-flex items-center gap-2 border border-[#e4002b] px-4 py-2 text-sm font-bold text-[#e4002b] hover:bg-[#fff7f8]">产业岗位分析</Link><Link to="/learning-task-factory" className="inline-flex items-center gap-2 border border-[#dfe3e8] px-4 py-2 text-sm font-bold text-[#141414] hover:border-[#e4002b] hover:text-[#e4002b]">任务转学习卡</Link><Link to="/job-learning/knowledge-catalog" className="inline-flex items-center gap-2 border border-[#dfe3e8] px-4 py-2 text-sm font-bold text-[#141414] hover:border-[#e4002b] hover:text-[#e4002b]">查看知识目录</Link>
          <Link to="/job-learning/outcomes" className="inline-flex items-center gap-2 border border-[#141414] px-4 py-2 text-sm font-bold text-[#141414] hover:bg-[#141414] hover:text-white">查看学习效果 <ArrowRight size={16} /></Link>
          </div>
        </div>
      </header>

      <section className="border border-[#dfe3e8] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-[#141414]">学习目标</h2><p className="mt-1 text-sm text-[#69717a]">目标会保存到你的岗位学习状态，供路径和建议使用。</p></div><button type="button" disabled={savingGoal || goal.trim().length < 2} onClick={async () => { setSavingGoal(true); try { const saved = await studentApi.updateJobLearningGoal({ user_id: userId, course_id: data.course_id, student_goal: goal.trim(), goal_scene: goalScene }); setData((current) => current ? { ...current, student_goal: saved.student_goal, goal_scene: saved.goal_scene } : current); } catch (reason) { setError(reason instanceof Error ? reason.message : "目标保存失败"); } finally { setSavingGoal(false); } }} className="inline-flex items-center gap-2 bg-[#e4002b] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"><Save size={15} />{savingGoal ? "保存中" : "保存目标"}</button></div><div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]"><input value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={200} placeholder="例如：完成软件开发岗位实习准备" className="border border-[#cfd5db] px-3 py-2 text-sm outline-none focus:border-[#e4002b]" /><select value={goalScene} onChange={(event) => setGoalScene(event.target.value)} className="border border-[#cfd5db] bg-white px-3 py-2 text-sm outline-none focus:border-[#e4002b]"><option value="course">课程达标</option><option value="training">综合实训</option><option value="competition">技能竞赛</option><option value="internship">岗位实习</option></select></div></section>

      <section className="grid gap-4 border-b border-[#dfe3e8] pb-6 md:grid-cols-3">
        <Info label="学习目标" value={data.student_goal || "尚未设置"} />
        <Info label="课/赛目标场景" value={data.goal_scene || "尚未设置"} />
        <Info label="诊断状态" value={data.assessment_id ? "已有诊断记录" : "尚未测评"} />
      </section>

      <section>
        <div className="flex items-center justify-between"><h2 className="text-xl font-black text-[#141414]">岗位能力概览</h2><span className="text-xs text-[#69717a]">{data.assessment_updated_at ? `更新于 ${data.assessment_updated_at}` : "等待真实测评"}</span></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.ability_dimensions.map((item) => <article key={item.code} className="border border-[#dfe3e8] p-4"><div className="flex justify-between gap-3"><div><h3 className="font-bold text-[#141414]">{item.label}</h3><code className="text-xs text-[#69717a]">{item.code}</code></div><strong className="text-2xl tabular-nums text-[#e4002b]">{item.score ?? "--"}</strong></div><div className="mt-3 h-1 bg-[#edf0f2]"><div className="h-1 bg-[#e4002b]" style={{ width: `${item.score ?? 0}%` }} /></div><p className="mt-2 text-xs text-[#69717a]">{item.assessment_status === "not_assessed" ? "暂无足够测评数据" : `基准线 ${item.benchmark} · ${item.assessment_status === "derived" ? "规则推导" : "直接测量"}`}</p></article>)}
        </div>
      </section>

      <section className="grid gap-4 border-t border-[#dfe3e8] pt-6 md:grid-cols-2">
        <SummaryList title="课程学习与实训路径" items={data.recommended_path} empty="完成岗位诊断后生成课程—实训阶段任务。" />
        <SummaryList title="课程资源与竞赛参考" items={data.recommended_resources} empty="完成岗位诊断后生成课程和竞赛匹配资源。" />
      </section>

      <section className="grid gap-4 border-t border-[#dfe3e8] pt-6 md:grid-cols-[1fr_1.4fr]">
        <div className="border border-[#dfe3e8] p-5">
          <h2 className="text-lg font-black text-[#141414]">结果可信度</h2>
          <p className="mt-2 text-sm leading-6 text-[#69717a]">
            {data.ai_generated ? "本页路径和建议由 AI 根据岗位数据生成，提交前请结合学习证据复核。" : "本页结果来自已保存的岗位学习数据。"}
          </p>
          <span className="mt-4 inline-flex border border-[#e4002b] px-2 py-1 text-xs font-bold text-[#e4002b]">
            {data.ai_generated ? "AI 生成内容" : "系统记录"}
          </span>
        </div>
        <div className="border border-[#dfe3e8] p-5">
          <h2 className="text-lg font-black text-[#141414]">依据与安全提示</h2>
          {data.citations.length ? (
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[#52606d]">
              {data.citations.slice(0, 3).map((citation, index) => (
                <li key={`${String(citation.id || citation.source || index)}`} className="border-l-2 border-[#141414] pl-3">
                  {String(citation.title || citation.source || citation.name || "岗位学习依据")}
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-[#69717a]">当前没有可展示的引用；请在知识目录查看条目来源。</p>}
          {data.safety_notices.length ? <p className="mt-4 border-t border-[#edf0f2] pt-3 text-xs leading-5 text-[#69717a]">安全提示：{data.safety_notices[0]}</p> : null}
        </div>
      </section>

      <section className="border-t border-[#dfe3e8] pt-6"><h2 className="text-xl font-black text-[#141414]">继续主流程</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><FlowLink to="/evaluation" title="岗位能力诊断" detail="完成一次真实测评" /><FlowLink to="/job-ability-graph" title="岗位能力图谱" detail="查看产业链与能力要素" /><FlowLink to="/report" title="学习报告" detail="回顾学习和测评结果" /></div></section>

      <section className="border-t border-[#dfe3e8] pt-6"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-[#e4002b]" /><h2 className="text-xl font-black text-[#141414]">下一步</h2></div><div className="mt-3 border-l-2 border-[#e4002b] bg-[#fafafa] p-4"><p className="font-bold text-[#141414]">{data.next_action?.label || "完成岗位诊断"}</p><p className="mt-1 text-sm text-[#69717a]">{data.next_action?.reason || "完成真实测评后，系统会生成可核验的岗位学习建议。"}</p>{data.next_action?.route ? <Link className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#e4002b]" to={data.next_action.route}>立即进入 <ArrowRight size={15} /></Link> : null}</div></section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="border-l-2 border-[#141414] pl-3"><div className="text-xs text-[#69717a]">{label}</div><div className="mt-1 font-bold text-[#141414]">{value}</div></div>; }
function PageState({ children }: { children: React.ReactNode }) { return <main className="mx-auto flex max-w-3xl items-center justify-center gap-3 px-4 py-24 text-sm text-[#69717a]">{children}</main>; }
function SummaryList({ title, items, empty }: { title: string; items: Array<Record<string, unknown>>; empty: string }) {
  return <div className="border border-[#dfe3e8] p-5"><h2 className="text-lg font-black text-[#141414]">{title}</h2>{items.length ? <ul className="mt-3 divide-y divide-[#edf0f2]">{items.slice(0, 4).map((item, index) => <li key={`${String(item.id || item.step_id || item.resource_id || index)}`} className="py-3"><div className="font-bold text-[#141414]">{String(item.title || item.name || `岗位学习任务 ${index + 1}`)}</div><div className="mt-1 text-xs text-[#69717a]">{String(item.reason || item.path_reason || item.status || "岗位能力提升内容")}</div></li>)}</ul> : <p className="mt-3 text-sm text-[#69717a]">{empty}</p>}</div>;
}
function FlowLink({ to, title, detail }: { to: string; title: string; detail: string }) { return <Link to={to} className="group border border-[#dfe3e8] p-4 hover:border-[#e4002b]"><div className="font-bold text-[#141414] group-hover:text-[#e4002b]">{title}</div><div className="mt-1 text-xs text-[#69717a]">{detail}</div><ArrowRight size={15} className="mt-3 text-[#e4002b]" /></Link>; }
