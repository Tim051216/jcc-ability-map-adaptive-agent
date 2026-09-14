import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDown, BarChart3, BrainCircuit, Loader2, Network, Radar, ShieldCheck } from "lucide-react";
import { JobAbilityResponse, studentApi } from "../lib/studentApi";

const presets = ["工业机器人系统运维员", "AI 数据标注工程师", "新能源汽车维修技师", "仓储规划师", "BIM 建模师"];

export default function JobAbilityGraph() {
  const [searchParams] = useSearchParams();
  const [job, setJob] = useState(searchParams.get("job") || "新能源汽车维修技师");
  const [group, setGroup] = useState(searchParams.get("group") || "新能源汽车技术专业群");
  const [graph, setGraph] = useState<JobAbilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [observedSkills, setObservedSkills] = useState<string[]>([]);
  async function generate(event?: FormEvent) {
    event?.preventDefault(); const name = job.trim(); if (!name) return setError("请输入职业岗位名称");
    setLoading(true); setError("");
    try { setGraph(await studentApi.generateJobAbility({ job_name: name, professional_group: group, observed_skills: observedSkills })); }
    catch (err) { setError(err instanceof Error ? err.message : "岗位能力图谱生成失败，请稍后重试"); }
    finally { setLoading(false); }
  }
  async function importIndustrySkills() {
    setAnalysisLoading(true); setError("");
    try {
      const analysis = await studentApi.getIndustryAnalysis(false, 20000, group, job);
      const skills = analysis.skills.filter((item) => item.current > 0).slice(0, 10).map((item) => item.name);
      setObservedSkills(skills);
      setGraph(await studentApi.generateJobAbility({ job_name: job.trim(), professional_group: group, observed_skills: skills }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "产业岗位技能读取失败"); }
    finally { setAnalysisLoading(false); }
  }
  const radar = useMemo(() => (graph?.abilities || []).flatMap((ability) => ability.ability_units.map((unit) => ({ name: unit, score: ability.score }))), [graph]);
  const generationLabel = graph?.generation_mode === "rule-template" ? "规则智能体生成 · 待教师复核" : "模型智能体生成 · 待教师复核";
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8">
    <header className="border-b border-[#dfe3e8] pb-6"><div className="flex items-center gap-2 text-sm font-bold text-[#e4002b]"><Network size={18} />场景二 · 挖掘岗位能力生成岗位能力图谱</div><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-black">岗位能力图谱</h1><p className="mt-2 text-sm text-[#5b6168]">输入具体职业岗位，沿“产业链→岗位群→能力项→能力单元→技能/知识点”生成可视化结构。</p></div><form onSubmit={generate} className="flex flex-wrap gap-2"><input value={job} onChange={(e) => setJob(e.target.value)} list="job-presets" placeholder="如：工业机器人系统运维员" className="w-64 border border-[#cfd5db] bg-white px-3 py-2 text-sm" /><datalist id="job-presets">{presets.map((x) => <option key={x} value={x} />)}</datalist><select value={group} onChange={(e) => setGroup(e.target.value)} className="border border-[#cfd5db] bg-white px-3 py-2 text-sm"><option>智能制造专业群</option><option>人工智能技术应用专业群</option><option>新能源汽车技术专业群</option><option>软件技术专业群</option><option>现代物流管理专业群</option><option>建筑信息模型技术专业群</option></select><button type="button" onClick={() => void importIndustrySkills()} disabled={analysisLoading || loading} className="flex items-center gap-2 border border-[#1d4ed8] px-3 py-2 text-xs font-bold text-[#1d4ed8] disabled:opacity-60"><BarChart3 size={14} />{analysisLoading ? "读取岗位分析中" : "带入岗位技能"}</button><button disabled={loading || analysisLoading} className="flex items-center gap-2 bg-[#e4002b] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{loading && <Loader2 size={15} className="animate-spin" />}生成图谱</button></form></div>{observedSkills.length ? <div className="mt-3 text-xs text-[#1d4ed8]">已接入公开岗位分析技能：{observedSkills.join("、")}</div> : null}{error && <div className="mt-3 rounded border border-[#f2b8c2] bg-[#fff7f8] px-3 py-2 text-sm text-[#b42336]">{error}</div>}</header>
    {!graph && !loading && <section className="border border-dashed border-[#cfd5db] bg-[#fafafa] p-10 text-center text-sm text-[#69717a]">输入岗位并点击“生成图谱”，系统将自动梳理产业链、岗位群、典型任务和能力要素。</section>}
    {graph && <><section className="border border-[#dfe3e8] bg-[#fafafa] p-5"><div className="flex flex-wrap items-center justify-center gap-2 text-center text-sm font-bold"><span className="rounded-full bg-[#141414] px-4 py-2 text-white">{graph.industry_chain}</span><ArrowDown className="rotate-[-90deg] text-[#e4002b]" size={17} /><span className="rounded-full border border-[#141414] px-4 py-2">{graph.job_group}</span><ArrowDown className="rotate-[-90deg] text-[#e4002b]" size={17} /><span className="rounded-full border border-[#e4002b] bg-[#fff7f8] px-4 py-2 text-[#e4002b]">{graph.job_name}</span></div><div className="mt-4 text-center text-xs text-[#69717a]">专业群：{group} · 典型任务自动拆解</div></section>
      <AbilityMindmap graph={graph} />
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]"><div className="space-y-4"><h2 className="text-xl font-black">典型工作任务</h2>{graph.typical_tasks.map((task, i) => <div key={task} className="border border-[#dfe3e8] p-4"><div className="text-xs font-bold text-[#e4002b]">典型工作任务 {i + 1}</div><div className="mt-1 font-bold">{task}</div><div className="mt-2 text-xs text-[#69717a]">关联能力：{graph.abilities.filter((ability) => (ability.related_tasks || []).includes(task)).map((ability) => ability.name).join("、") || "待教师复核"}</div></div>)}<h2 className="pt-2 text-xl font-black">岗位能力拆解</h2>{graph.abilities.map((ability) => <article key={ability.name} className="border border-[#dfe3e8] p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="font-black">{ability.name}</h3><p className="mt-1 text-xs text-[#69717a]">岗位要求权重（不是学生测评分数）</p></div><span className="text-2xl font-black text-[#e4002b]">{ability.score}%</span></div><div className="mt-3 h-2 rounded bg-[#edf0f2]"><div className="h-2 rounded bg-[#e4002b]" style={{ width: `${ability.score}%` }} /></div>{(ability.related_tasks || []).length > 0 && <div className="mt-4 border-l-2 border-[#1d4ed8] pl-3"><div className="text-xs font-bold text-[#1d4ed8]">来源任务</div><div className="mt-1 text-sm text-[#52606d]">{ability.related_tasks.join("；")}</div></div>}<div className="mt-4 grid gap-3 md:grid-cols-3"><PointList title="能力单元" items={ability.ability_units} tone="bg-[#f7f7f8]" /><PointList title="技能点" items={ability.skill_points} tone="bg-[#fff7f8]" /><PointList title="知识点" items={ability.knowledge_points} tone="bg-[#f3f8ff]" /></div></article>)}</div><aside className="space-y-4"><div className="border border-[#dfe3e8] p-5"><div className="flex items-center gap-2"><Radar size={18} className="text-[#e4002b]" /><h2 className="font-black">岗位要求雷达图</h2></div><p className="mt-1 text-xs text-[#69717a]">展示各能力单元继承的岗位要求权重，不代表学生当前掌握度。</p><RadarChart items={radar} /></div><div className="border border-[#dfe3e8] p-5"><div className="flex items-center gap-2"><BrainCircuit size={18} className="text-[#e4002b]" /><h2 className="font-black">岗位胜任说明</h2></div><p className="mt-3 text-sm leading-6 text-[#52606d]">胜任该岗位需要同时掌握上述能力单元、技能点和知识点；系统会将薄弱能力同步到测评与岗课赛自适应学习路径。</p><div className="mt-4 flex items-center gap-2 text-xs text-[#16803c]"><ShieldCheck size={15} />{generationLabel}</div>{graph.citations?.length > 0 && <div className="mt-3 text-xs text-[#69717a]">依据：{graph.citations.join("；")}</div>}</div></aside></section></>}
  </main>;
}

function PointList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return <div><div className="text-xs font-bold text-[#69717a]">{title}</div>{items.map((item) => <div key={item} className={`mt-2 rounded px-2 py-1 text-xs ${tone}`}>{item}</div>)}</div>;
}

function AbilityMindmap({ graph }: { graph: JobAbilityResponse }) {
  const stages = [
    ["产业链", graph.industry_chain],
    ["岗位群", graph.job_group],
    ["职业岗位", graph.job_name],
  ];
  return <section className="border border-[#dfe3e8] p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">岗位能力思维导图</h2><p className="mt-1 text-xs text-[#69717a]">完整呈现产业链、岗位群、职业岗位、典型任务、能力项与知识技能点。</p></div><span className="text-xs text-[#69717a]">6 层结构 · {graph.abilities.length} 个能力项</span></div><div className="mt-5 grid gap-2 md:grid-cols-3">{stages.map(([label, value], index) => <div key={label} className={`relative border p-3 ${index === 2 ? "border-[#e4002b] bg-[#fff7f8]" : "border-[#dfe3e8] bg-[#f7f7f8]"}`}><div className="text-[10px] font-bold text-[#69717a]">{String(index + 1).padStart(2, "0")} · {label}</div><div className="mt-1 text-sm font-black">{value}</div>{index < stages.length - 1 && <ArrowDown size={16} className="absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 text-[#e4002b] md:-right-3 md:bottom-auto md:left-auto md:top-1/2 md:-translate-y-1/2 md:rotate-[-90deg]" />}</div>)}</div><div className="mt-4 grid gap-3 lg:grid-cols-[200px_1fr]"><div className="border border-[#1d4ed8] bg-[#eff6ff] p-3"><div className="text-[10px] font-bold text-[#1d4ed8]">04 · 典型工作任务</div><div className="mt-2 space-y-2">{graph.typical_tasks.map((task, index) => <div key={task} className="text-xs leading-5"><span className="font-bold">T{index + 1}</span> {task}</div>)}</div></div><div className="space-y-3">{graph.abilities.map((ability, index) => <div key={ability.name} className="border border-[#dfe3e8] bg-white p-3"><div className="flex flex-wrap items-center gap-2"><span className="bg-[#e4002b] px-3 py-1 text-xs font-black text-white">05 · 能力项 {index + 1} · {ability.name}</span><span className="text-xs font-bold text-[#e4002b]">要求权重 {ability.score}%</span></div>{(ability.related_tasks || []).length > 0 && <div className="mt-2 text-xs text-[#1d4ed8]">由任务拆解：{ability.related_tasks.join("、")}</div>}<div className="mt-3 grid gap-2 md:grid-cols-3"><MindmapBranch title="06 · 能力单元" items={ability.ability_units} tone="bg-[#f7f7f8]" /><MindmapBranch title="06 · 技能点" items={ability.skill_points} tone="bg-[#fff1f4]" /><MindmapBranch title="06 · 知识点" items={ability.knowledge_points} tone="bg-[#eff6ff]" /></div></div>)}</div></div></section>;
}

function MindmapBranch({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return <div><div className="mb-1 text-[10px] font-black uppercase tracking-wide text-[#69717a]">{title}</div>{items.map((item) => <div key={item} className={`mt-1 rounded px-2 py-1 text-xs ${tone}`}>{item}</div>)}</div>;
}

function RadarChart({ items }: { items: Array<{ name: string; score: number }> }) {
  const size = 250, center = size / 2, radius = 78;
  const point = (index: number, value: number) => { const angle = -Math.PI / 2 + (index * 2 * Math.PI) / Math.max(1, items.length); const r = radius * value / 100; return [center + Math.cos(angle) * r, center + Math.sin(angle) * r]; };
  const polygon = (factor: number) => items.map((_, index) => point(index, factor).join(",")).join(" ");
  const values = items.map((item, index) => point(index, item.score).join(",")).join(" ");
  return <svg viewBox={`0 0 ${size} ${size}`} className="mt-3 w-full" role="img" aria-label="岗位能力雷达图"><polygon points={polygon(100)} fill="none" stroke="#dfe3e8" /> <polygon points={polygon(50)} fill="none" stroke="#edf0f2" /> <polygon points={values} fill="#e4002b" fillOpacity="0.18" stroke="#e4002b" strokeWidth="2" />{items.map((item, index) => { const [x, y] = point(index, 100); return <g key={item.name}><line x1={center} y1={center} x2={x} y2={y} stroke="#edf0f2" /><text x={x} y={y} textAnchor="middle" fontSize="10" fill="#52606d">{item.name} {item.score}</text></g>; })}</svg>;
}
