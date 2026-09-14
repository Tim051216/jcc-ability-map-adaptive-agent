import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CircleAlert, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { openTutorPanel } from "../lib/tutorPanel";
import { getCurrentLoggedInUserId } from "../lib/currentUser";
import { studentApi, type JobCoachingRecord, type JobKnowledgeCatalogItem } from "../lib/studentApi";

const labels: Record<string, string> = {
  requirement_analysis: "需求分析",
  system_design: "系统设计",
  coding_implementation: "编码实现",
  software_testing: "软件测试",
  project_collaboration: "项目协作与交付",
};

export default function JobKnowledgeCatalog() {
  const [items, setItems] = useState<JobKnowledgeCatalogItem[]>([]);
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [selectedDimension, setSelectedDimension] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = getCurrentLoggedInUserId();
  const [records, setRecords] = useState<JobCoachingRecord[]>([]);
  const [taskOutput, setTaskOutput] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  useEffect(() => {
    let active = true;
    studentApi.getJobKnowledgeCatalog(undefined, 10000).then((response) => {
      if (!active) return;
      setItems(response.items);
      setDimensions(response.ability_dimensions);
      setSelectedId(response.items[0]?.id || null);
    }).catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "知识目录暂时不可用"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    studentApi.listJobCoachingRecords(userId, 401, 100, 10000).then((response) => setRecords(response.items)).catch(() => undefined);
  }, [userId]);

  const filtered = useMemo(() => selectedDimension === "all" ? items : items.filter((item) => item.ability_dimension === selectedDimension), [items, selectedDimension]);
  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || null;
  const selectedRecord = selected ? records.find((record) => record.user_question.startsWith(`[${selected.id}]`)) : undefined;

  async function submitTask(event: FormEvent) {
    event.preventDefault();
    if (!selected || taskOutput.trim().length < 2) return;
    setSavingTask(true);
    try {
      const record = await studentApi.createJobCoachingRecord({
        user_id: userId,
        course_id: 401,
        source: "knowledge_catalog",
        user_question: `[${selected.id}] ${selected.title}`,
        advice_summary: taskOutput.trim(),
        recommended_actions: [selected.acceptance_criteria],
      }, 10000);
      const completed = await studentApi.updateJobCoachingFeedback(record.id, { user_id: userId, status: "completed", helpful: true, feedback_note: "已提交目录任务产出" }, 10000);
      setRecords((current) => [completed, ...current.filter((item) => item.id !== completed.id)]);
      setTaskOutput("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "任务提交失败");
    } finally {
      setSavingTask(false);
    }
  }

  if (loading) return <State><LoaderCircle className="animate-spin" />正在读取岗位知识目录...</State>;
  if (error) return <State><CircleAlert />{error}</State>;

  return <main className="job-knowledge-catalog-page mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link to="/job-learning" className="inline-flex items-center gap-2 text-sm font-bold text-[#69717a] hover:text-[#e4002b]"><ArrowLeft size={16} />返回岗位学习</Link>
      <span className="text-xs text-[#69717a]">目录共 {items.length} 个可核验知识条目</span>
    </div>
    <header className="job-knowledge-catalog-header border-b border-[#dfe3e8] pb-6"><div className="flex items-center gap-2 text-sm font-bold text-[#e4002b]"><BookOpen size={18} />岗课赛岗位能力知识目录</div><h1 className="mt-2 text-3xl font-black tracking-tight text-[#141414]">岗位能力 → 课程知识 → 竞赛实训任务</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#69717a]">每个条目连接软件开发岗位能力、专业群课程知识和可验收的实训/竞赛产出，并保留来源与安全提示。</p></header>
    <div className="job-knowledge-catalog-filters flex gap-2 overflow-x-auto border-b border-[#dfe3e8] pb-3"><button type="button" onClick={() => setSelectedDimension("all")} className={`shrink-0 border px-3 py-2 text-sm font-bold ${selectedDimension === "all" ? "border-[#e4002b] bg-[#e4002b] text-white" : "border-[#dfe3e8] text-[#69717a]"}`}>全部（{items.length}）</button>{dimensions.map((dimension) => <button type="button" key={dimension} onClick={() => setSelectedDimension(dimension)} className={`shrink-0 border px-3 py-2 text-sm font-bold ${selectedDimension === dimension ? "border-[#e4002b] bg-[#e4002b] text-white" : "border-[#dfe3e8] text-[#69717a]"}`}>{labels[dimension] || dimension}（{items.filter((item) => item.ability_dimension === dimension).length}）</button>)}</div>
    <div className="grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
      <section className="job-knowledge-catalog-list max-h-[640px] overflow-y-auto border border-[#dfe3e8]">{filtered.map((item) => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} className={`block w-full border-b border-[#edf0f2] px-4 py-3 text-left ${selected?.id === item.id ? "border-l-4 border-l-[#e4002b] bg-[#fff5f7]" : "border-l-4 border-l-transparent hover:bg-[#fafafa]"}`}><span className="text-xs font-black text-[#e4002b]">{item.id}</span><span className="mt-1 block font-bold text-[#141414]">{item.title}</span><span className="mt-1 block text-xs text-[#69717a]">{labels[item.ability_dimension] || item.ability_dimension} · {item.ability_unit}</span></button>)}</section>
      {selected ? <article className="job-knowledge-catalog-detail border border-[#dfe3e8] p-5 md:p-7"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#edf0f2] pb-5"><div><div className="text-sm font-black text-[#e4002b]">{selected.id}</div><h2 className="mt-1 text-2xl font-black text-[#141414]">{selected.title}</h2><p className="mt-2 text-sm text-[#69717a]">{labels[selected.ability_dimension] || selected.ability_dimension} · {selected.ability_unit}</p></div><button type="button" onClick={() => openTutorPanel({ mode: "learning", query: `请围绕知识条目 ${selected.id}「${selected.title}」讲解：${selected.knowledge_point}`, title: selected.title, subtitle: selected.id })} className="inline-flex items-center gap-2 bg-[#e4002b] px-4 py-2 text-sm font-bold text-white"><BookOpen size={15} />问 学习助手</button></div><div className="mt-6 grid gap-5 md:grid-cols-2"><Detail title="知识点" value={selected.knowledge_point} /><Detail title="技能点" value={selected.skill_point} /><Detail title="适用场景" value={selected.applicable_scenario} /><Detail title="常见错误" value={selected.common_error} /><Detail title="学习建议" value={selected.learning_advice} /></div><div className="mt-6 border-t border-[#edf0f2] pt-5"><h3 className="text-sm font-black text-[#141414]">可执行任务</h3><p className="mt-2 text-sm leading-6 text-[#52606d]">{selected.task_prompt}</p><div className="mt-4 grid gap-4 md:grid-cols-2"><Detail title="提交产出" value={selected.deliverable} /><Detail title="验收标准" value={selected.acceptance_criteria} /></div><p className="mt-4 text-xs text-[#69717a]">建议用时：{selected.estimated_minutes} 分钟</p><form onSubmit={submitTask} className="mt-4 border-t border-[#edf0f2] pt-4"><label className="block text-sm font-bold text-[#141414]">提交任务产出<textarea value={taskOutput} onChange={(event) => setTaskOutput(event.target.value)} placeholder="写下你的设计、代码、测试用例或复盘结论" className="mt-2 min-h-28 w-full border border-[#cfd5db] p-3 text-sm font-normal outline-none focus:border-[#e4002b]" /></label><div className="mt-3 flex flex-wrap items-center gap-3"><button type="submit" disabled={savingTask || taskOutput.trim().length < 2} className="bg-[#e4002b] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{savingTask ? "提交中" : selectedRecord ? "更新完成记录" : "提交并完成任务"}</button>{selectedRecord ? <span className="text-sm font-bold text-emerald-700">已完成并留存记录</span> : null}</div></form></div><div className="mt-5 flex gap-3 border-t border-[#edf0f2] pt-5"><ShieldCheck size={18} className="shrink-0 text-[#e4002b]" /><div><div className="text-sm font-bold text-[#141414]">安全提示</div><p className="mt-1 text-sm leading-6 text-[#69717a]">{selected.safety_notice}</p></div></div><div className="mt-5 flex items-start gap-2 border-t border-[#edf0f2] pt-5 text-xs text-[#69717a]"><ExternalLink size={14} className="mt-0.5 shrink-0" /><span>来源：{selected.source_path}{selected.source_locator ? `｜${selected.source_locator}` : ""}</span></div></article> : <State>当前筛选没有条目</State>}
    </div>
  </main>;
}

function Detail({ title, value }: { title: string; value: string }) { return <div className="border-l-2 border-[#141414] pl-3"><h3 className="text-sm font-black text-[#141414]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#52606d]">{value}</p></div>; }
function State({ children }: { children: React.ReactNode }) { return <main className="mx-auto flex max-w-3xl items-center justify-center gap-3 px-4 py-24 text-sm text-[#69717a]">{children}</main>; }
