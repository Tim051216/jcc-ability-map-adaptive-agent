import { useEffect, useState } from "react";
import { ArrowRight, BriefcaseBusiness, CircleAlert, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { getCurrentLoggedInUserId } from "../lib/currentUser";
import { studentApi, type AdaptiveLearningResponse, type JobLearningOverview } from "../lib/studentApi";

export default function JobLearning() {
  const userId = getCurrentLoggedInUserId();
  const cacheKey = `job-learning-overview:${userId}:401`;
  const completionKey = `job-learning-completed:${userId}:401`;
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
  const [adaptive, setAdaptive] = useState<AdaptiveLearningResponse | null>(null);
  const [adaptiveLoading, setAdaptiveLoading] = useState(false);
  const [completedSkills, setCompletedSkills] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(completionKey);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [diagnosticScores, setDiagnosticScores] = useState<Record<string, number>>({});

  useEffect(() => {
    try { localStorage.setItem(completionKey, JSON.stringify(completedSkills)); } catch { /* Ignore storage limits. */ }
  }, [completionKey, completedSkills]);

  async function refreshAdaptive(nextCompletedSkills = completedSkills) {
    if (!data?.student_goal) return;
    setAdaptiveLoading(true);
    try {
      const result = await studentApi.recommendAdaptiveLearning({
        goal: data.student_goal,
        goal_scene: data.goal_scene || "internship",
        job_name: data.job_name,
        assessment_scores: Object.fromEntries(data.ability_dimensions.filter((item) => item.score !== null && item.score !== undefined).map((item) => [item.code, item.score ?? 0])),
        ability_labels: Object.fromEntries(data.ability_dimensions.map((item) => [item.code, item.label])),
        completed_skills: nextCompletedSkills,
      });
      setAdaptive(result);
    } catch { setAdaptive(null); }
    finally { setAdaptiveLoading(false); }
  }

  useEffect(() => {
    let active = true;
    // The portal overview aggregates course, goal, evaluation and path data;
    // allow a cold local service enough time to finish its first DB read.
    studentApi.getJobLearningOverview(userId, 401, 60000).then((next) => {
      try { sessionStorage.setItem(cacheKey, JSON.stringify(next)); } catch { /* Ignore storage limits. */ }
      if (active) {
        setData(next); setGoal(next.student_goal || ""); setGoalScene(next.goal_scene || "internship");
        setDiagnosticScores(Object.fromEntries(next.ability_dimensions.filter((item) => item.score !== null && item.score !== undefined).map((item) => [item.code, item.score as number])));
      }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "岗位学习数据暂时不可用");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [cacheKey, userId]);

  useEffect(() => {
    if (!data?.student_goal || data.student_goal.length < 2) return;
    const measuredScores = Object.fromEntries(data.ability_dimensions.filter((item) => item.score !== null && item.score !== undefined).map((item) => [item.code, item.score ?? 0]));
    if (!Object.keys(measuredScores).length) {
      setAdaptive(null);
      setAdaptiveLoading(false);
      return;
    }
    void refreshAdaptive();
  }, [data?.student_goal, data?.goal_scene, data?.job_name, data?.ability_dimensions]);

  async function runDiagnostic() {
    if (!data?.student_goal || Object.keys(diagnosticScores).length === 0) return;
    setAdaptiveLoading(true);
    try {
      setAdaptive(await studentApi.recommendAdaptiveLearning({ goal: data.student_goal, goal_scene: data.goal_scene || goalScene, job_name: data.job_name, assessment_scores: diagnosticScores, ability_labels: Object.fromEntries(data.ability_dimensions.map((item) => [item.code, item.label])), completed_skills: completedSkills }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "岗位学情诊断失败");
    } finally { setAdaptiveLoading(false); }
  }

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

      <section className="border border-[#dfe3e8] bg-[#fffafa] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-[#141414]">目标驱动的岗·课·赛自适应建议</h2><p className="mt-1 text-sm text-[#69717a]">根据目标设定与当前诊断分数，动态定位薄弱项并调整学习顺序。</p></div>{adaptiveLoading ? <span className="text-xs text-[#69717a]">正在诊断...</span> : adaptive ? <span className="text-xs font-bold text-[#16803c]">路径进度 {adaptive.progress}%</span> : null}</div>{adaptive ? <><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf0f2]" aria-label={`路径进度 ${adaptive.progress}%`}><div className="h-full rounded-full bg-[#e4002b] transition-all" style={{ width: `${adaptive.progress}%` }} /></div><p className="mt-3 text-sm leading-6 text-[#52606d]">{adaptive.diagnostic_summary}</p><div className="mt-3 flex flex-wrap gap-2">{adaptive.badges.map((badge) => <span key={badge} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#e4002b]">{badge}</span>)}</div><div className="mt-4 grid gap-3 md:grid-cols-3">{adaptive.next_steps.map((step) => { const done = completedSkills.includes(step.title); return <article key={step.title} className={`border bg-white p-3 ${done ? "border-[#16803c]" : "border-[#f0d7df]"}`}><div className="text-xs font-black text-[#e4002b]">{step.kind}</div><h3 className="mt-1 text-sm font-bold">{step.title}</h3><p className="mt-2 text-xs leading-5 text-[#69717a]">{step.description}</p><div className="mt-2 text-[11px] text-[#52606d]">解锁：{step.unlock_condition}</div><button type="button" onClick={() => { const next = done ? completedSkills.filter((item) => item !== step.title) : [...completedSkills, step.title]; setCompletedSkills(next); void refreshAdaptive(next); }} className="mt-3 border border-[#16803c] px-2 py-1 text-xs font-bold text-[#16803c]">{done ? "撤销完成" : "标记已完成"}</button></article>; })}</div><p className="mt-3 text-xs text-[#69717a]">{adaptive.safety_notice}</p></> : <p className="mt-3 text-sm text-[#69717a]">保存学习目标并完成诊断后，将在这里生成个性化路径。</p>}</section>

      <section className="border border-[#dfe3e8] bg-[#f8fbff] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-[#141414]">岗位学情诊断输入</h2><p className="mt-1 text-sm text-[#69717a]">填写真实测评结果后，系统才能生成个性化路径；未填写维度不会自动补分。</p></div><button type="button" onClick={() => void runDiagnostic()} disabled={adaptiveLoading || !data.student_goal || Object.keys(diagnosticScores).length === 0} className="bg-[#141414] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{adaptiveLoading ? "诊断中" : "生成自适应路径"}</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{data.ability_dimensions.map((item) => <label key={item.code} className="text-xs font-bold text-[#52606d]">{item.label}<input type="number" min={0} max={100} value={diagnosticScores[item.code] ?? ""} onChange={(event) => { const value = event.target.value; setDiagnosticScores((current) => { const next = { ...current }; if (value === "") delete next[item.code]; else next[item.code] = Math.max(0, Math.min(100, Number(value))); return next; }); }} placeholder="未测评" className="mt-1 w-full border border-[#cfd5db] bg-white px-2 py-2 text-sm font-normal" /></label>)}</div></section>

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
          {data.safety_notices.length ? <p className="mt-4 border-t border-[#edf0f2] pt-3 text-xs leading-5 text-[#69717a]">安全提示：{typeof data.safety_notices[0] === "string" ? data.safety_notices[0] : data.safety_notices[0]?.content || "请结合来源和学习证据进行人工复核。"}</p> : null}
        </div>
      </section>

      <section className="border-t border-[#dfe3e8] pt-6"><h2 className="text-xl font-black text-[#141414]">继续主流程</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><FlowLink to="/evaluation" title="岗位能力诊断" detail="完成一次真实测评" /><FlowLink to="/job-ability-graph" title="岗位能力图谱" detail="查看产业链与能力要素" /><FlowLink to="/report" title="学习报告" detail="回顾学习和测评结果" /><FlowLink to="/trial-feedback" title="提交试用反馈" detail="记录教师/学生真实体验" /></div></section>

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
