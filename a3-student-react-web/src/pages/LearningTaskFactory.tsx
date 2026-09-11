import { useState } from "react";
import { ArrowRight, BarChart3, CheckCircle2, ClipboardList, Link2, Network } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { studentApi, type LearningTaskResponse } from "../lib/studentApi";
import { getCurrentLoggedInUserId } from "../lib/currentUser";

const TASK_STORAGE_KEY = "xa-learning-task";

export default function LearningTaskFactory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [input, setInput] = useState(searchParams.get("task") || "新能源汽车电池包拆装与绝缘检测");
  const [jobName, setJobName] = useState(searchParams.get("job") || "新能源汽车维修技师");
  const [professionalGroup, setProfessionalGroup] = useState(searchParams.get("group") || "新能源汽车技术专业群");
  const [industryContext, setIndustryContext] = useState("新能源汽车售后维修与动力电池安全检测");
  const [abilityFocus, setAbilityFocus] = useState("高压下电、电池包拆装、绝缘检测");
  const [task, setTask] = useState<LearningTaskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [industryLoading, setIndustryLoading] = useState(false);

  async function importFromAbilityGraph() {
    setGraphLoading(true);
    try {
      const graph = await studentApi.generateJobAbility({ job_name: jobName, professional_group: professionalGroup });
      const focus = graph.abilities.flatMap((item) => [item.name, ...item.skill_points]).slice(0, 8);
      setAbilityFocus(focus.join("、"));
      if (graph.typical_tasks[0]) setInput(graph.typical_tasks[0]);
      setIndustryContext(`${graph.industry_chain} · ${graph.job_group}`);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "岗位能力图谱读取失败");
    } finally { setGraphLoading(false); }
  }

  async function importFromIndustryAnalysis() {
    setIndustryLoading(true);
    setSaveError(null);
    try {
      const analysis = await studentApi.getIndustryAnalysis(false, 20000, professionalGroup, jobName);
      const measuredSkills = analysis.skills.filter((item) => item.current > 0).slice(0, 8).map((item) => item.name);
      if (measuredSkills.length) setAbilityFocus(measuredSkills.join("、"));
      setIndustryContext(`${analysis.core_job} · ${analysis.collection_mode} · ${analysis.sample_count} 条公开岗位样本`);
      if (!input.trim() || input === "新能源汽车电池包拆装与绝缘检测") {
        setInput(analysis.core_job === "新能源汽车维修技师" ? "新能源汽车电池包拆装与绝缘检测" : (analysis.skills[0]?.name ? `${analysis.skills[0].name}典型工作任务` : input));
      }
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "产业岗位分析读取失败");
    } finally { setIndustryLoading(false); }
  }

  async function generate() {
    setLoading(true);
    setAdded(false);
    setGenerateError(null);
    try { setTask(await studentApi.generateLearningTask({ work_task: input, job_name: jobName, professional_group: professionalGroup, industry_context: industryContext, ability_focus: abilityFocus.split(/[、,，]/).map((item) => item.trim()).filter(Boolean) })); }
    catch (reason) { setGenerateError(reason instanceof Error ? reason.message : "学习任务卡生成失败，请检查岗位任务输入后重试"); }
    finally { setLoading(false); }
  }

  async function addToPath() {
    if (!task) return;
    setSaveError(null);
    try {
      await studentApi.createJobCoachingRecord({ user_id: getCurrentLoggedInUserId(), course_id: 401, source: "xa-learning-task", user_question: task.task_name, advice_summary: JSON.stringify(task), recommended_actions: task.steps });
      localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(task));
      setAdded(true);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "任务卡保存失败，请稍后重试");
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8">
      <header className="border-b border-[#dfe3e8] pb-6">
        <div className="flex items-center gap-2 text-sm font-bold text-[#e4002b]"><ClipboardList size={18} />赛：岗位任务转实训任务</div>
        <h1 className="mt-3 text-3xl font-black">岗位任务 → 课程实训任务卡</h1>
        <p className="mt-2 text-sm text-[#5b6168]">输入企业典型岗位任务，生成可用于课程实训或技能竞赛的工作情境、步骤、安全要点、知识技能映射和验收产出。</p>
      </header>

      <section className="border border-[#dfe3e8] p-5">
        <div className="grid gap-3 md:grid-cols-3"><label className="text-sm font-bold">职业岗位<input value={jobName} onChange={(event) => setJobName(event.target.value)} className="mt-2 w-full border border-[#cfd5db] px-3 py-2 text-sm" /></label><label className="text-sm font-bold">专业群<select value={professionalGroup} onChange={(event) => setProfessionalGroup(event.target.value)} className="mt-2 w-full border border-[#cfd5db] bg-white px-3 py-2 text-sm"><option>软件技术专业群</option><option>智能制造专业群</option><option>机电一体化技术专业群</option><option>新能源汽车技术专业群</option><option>人工智能技术应用专业群</option><option>现代物流管理专业群</option><option>建筑信息模型技术专业群</option></select></label><label className="text-sm font-bold">产业背景<input value={industryContext} onChange={(event) => setIndustryContext(event.target.value)} className="mt-2 w-full border border-[#cfd5db] px-3 py-2 text-sm" /></label></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><label className="text-sm font-bold">重点能力项（用顿号或逗号分隔）</label><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void importFromIndustryAnalysis()} disabled={industryLoading} className="inline-flex items-center gap-2 border border-[#e4002b] px-3 py-1.5 text-xs font-bold text-[#e4002b] disabled:opacity-50"><BarChart3 size={14} />{industryLoading ? "读取岗位分析中" : "从产业岗位分析带入"}</button><button type="button" onClick={() => void importFromAbilityGraph()} disabled={graphLoading} className="inline-flex items-center gap-2 border border-[#1d4ed8] px-3 py-1.5 text-xs font-bold text-[#1d4ed8] disabled:opacity-50"><Network size={14} />{graphLoading ? "读取图谱中" : "从岗位能力图谱带入"}</button></div></div><input value={abilityFocus} onChange={(event) => setAbilityFocus(event.target.value)} className="mt-2 w-full border border-[#cfd5db] px-3 py-2 text-sm" placeholder="例如：缺陷判定、质量复核、异常记录" /><label className="mt-4 block text-sm font-bold">典型工作任务</label>
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <input value={input} onChange={(event) => setInput(event.target.value)} className="min-w-0 flex-1 border border-[#cfd5db] px-3 py-2 text-sm" placeholder="例如：工业机器人坐标系切换与轨迹校准" />
          <button type="button" onClick={() => void generate()} disabled={loading || input.trim().length < 2} className="inline-flex items-center justify-center gap-2 bg-[#e4002b] px-5 py-2 text-sm font-bold text-white disabled:opacity-50"><ArrowRight size={15} />{loading ? "生成中" : "生成学习任务卡"}</button>
        </div>
      </section>

      {saveError ? <p className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{saveError}</p> : null}
      {generateError ? <p className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{generateError}</p> : null}
      {task ? <TaskCard task={task} added={added} onAdd={() => void addToPath()} onViewPath={() => navigate("/path")} /> : <section className="border border-dashed border-[#cfd5db] p-10 text-center text-sm text-[#69717a]">生成后展示完整学习任务卡，并关联实训资源。</section>}
    </main>
  );
}

function TaskCard({ task, added, onAdd, onViewPath }: { task: LearningTaskResponse; added: boolean; onAdd: () => void; onViewPath: () => void }) {
  const generationLabel = task.generation_mode === "rule-template" ? "规则模板 · 待教师复核" : "模型生成内容";
  return <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
    <article className="border border-[#dfe3e8] p-5">
      <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold text-[#e4002b]">已生成 · 任务卡 {task.task_id}</div><h2 className="mt-2 text-2xl font-black">{task.task_name}</h2></div><span className="border border-[#e4002b] px-2 py-1 text-xs font-bold text-[#e4002b]">{generationLabel}</span></div>
      <div className="mt-5 border-l-2 border-[#141414] bg-[#fafafa] p-3 text-sm leading-6"><b>任务描述：</b>{task.task_description}</div><div className="mt-3 border-l-2 border-[#e4002b] bg-[#fff7f8] p-3 text-sm leading-6"><b>工作情境：</b>{task.work_context}</div>
      <h3 className="mt-5 font-black">操作步骤</h3>
      <ol className="mt-3 space-y-3">{task.steps.map((step, index) => <li key={step} className="flex gap-3 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#141414] text-xs font-bold text-white">{index + 1}</span>{step}</li>)}</ol>
      <div className="mt-5 border-t border-[#edf0f2] pt-4 text-sm"><b>安全要点：</b>{task.safety_points.join("；")}</div>
    </article>
    <aside className="space-y-4">
      <div className="border border-[#dfe3e8] p-5"><h3 className="font-black">知识点与技能点</h3><div className="mt-3 text-xs font-bold text-[#69717a]">知识点</div>{task.knowledge_points.map((item) => <div key={item} className="mt-2 rounded bg-[#f7f7f8] px-3 py-2 text-sm">{item}</div>)}<div className="mt-4 text-xs font-bold text-[#69717a]">技能点</div>{task.skill_points.map((item) => <div key={item} className="mt-2 rounded bg-[#fff7f8] px-3 py-2 text-sm">{item}</div>)}</div>
      <div className="border border-[#dfe3e8] p-5"><h3 className="font-black">关联校内实训资源</h3>{task.resources.map((item) => <Link key={item.href} to={item.href} className="mt-3 flex items-center gap-2 text-sm text-[#1d4ed8] hover:underline"><Link2 size={14} className="text-[#e4002b]" /><span>{item.name}</span><span className="text-[10px] text-[#69717a]">{item.resource_type}</span></Link>)}<div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#16803c]"><button type="button" onClick={onAdd} className="inline-flex items-center gap-2 rounded border border-[#16803c] px-3 py-2 font-bold hover:bg-[#f4fbf4]"><CheckCircle2 size={15} />{added ? "已加入个性化学习路径" : "加入个性化学习路径"}</button>{added ? <button type="button" onClick={onViewPath} className="text-[#e4002b] underline">立即查看路径</button> : null}</div></div>
    </aside>
  </section>;
}
