import { useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardList, Link2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { studentApi, type LearningTaskResponse } from "../lib/studentApi";
import { getCurrentLoggedInUserId } from "../lib/currentUser";

const TASK_STORAGE_KEY = "xa-learning-task";

export default function LearningTaskFactory() {
  const navigate = useNavigate();
  const [input, setInput] = useState("软件开发工程师：用户登录与权限管理模块开发");
  const [task, setTask] = useState<LearningTaskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setAdded(false);
    try { setTask(await studentApi.generateLearningTask({ work_task: input })); }
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
        <p className="mt-2 text-sm text-[#5b6168]">输入软件开发岗位任务，生成可用于课程实训或技能竞赛的工作情境、步骤、安全要点、知识技能映射和验收产出。</p>
      </header>

      <section className="border border-[#dfe3e8] p-5">
        <label className="text-sm font-bold">软件开发岗位典型工作任务</label>
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <input value={input} onChange={(event) => setInput(event.target.value)} className="min-w-0 flex-1 border border-[#cfd5db] px-3 py-2 text-sm" placeholder="例如：工业机器人坐标系切换与轨迹校准" />
          <button type="button" onClick={() => void generate()} disabled={loading || input.trim().length < 2} className="inline-flex items-center justify-center gap-2 bg-[#e4002b] px-5 py-2 text-sm font-bold text-white disabled:opacity-50"><ArrowRight size={15} />{loading ? "生成中" : "生成学习任务卡"}</button>
        </div>
      </section>

      {saveError ? <p className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{saveError}</p> : null}
      {task ? <TaskCard task={task} added={added} onAdd={() => void addToPath()} onViewPath={() => navigate("/path")} /> : <section className="border border-dashed border-[#cfd5db] p-10 text-center text-sm text-[#69717a]">生成后展示完整学习任务卡，并关联实训资源。</section>}
    </main>
  );
}

function TaskCard({ task, added, onAdd, onViewPath }: { task: LearningTaskResponse; added: boolean; onAdd: () => void; onViewPath: () => void }) {
  return <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
    <article className="border border-[#dfe3e8] p-5">
      <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold text-[#e4002b]">已生成 · 任务卡 {task.task_id}</div><h2 className="mt-2 text-2xl font-black">{task.task_name}</h2></div><span className="border border-[#e4002b] px-2 py-1 text-xs font-bold text-[#e4002b]">AI 生成内容</span></div>
      <div className="mt-5 border-l-2 border-[#141414] bg-[#fafafa] p-3 text-sm leading-6"><b>工作情境：</b>{task.work_context}</div>
      <h3 className="mt-5 font-black">操作步骤</h3>
      <ol className="mt-3 space-y-3">{task.steps.map((step, index) => <li key={step} className="flex gap-3 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#141414] text-xs font-bold text-white">{index + 1}</span>{step}</li>)}</ol>
      <div className="mt-5 border-t border-[#edf0f2] pt-4 text-sm"><b>安全要点：</b>{task.safety_points.join("；")}</div>
    </article>
    <aside className="space-y-4">
      <div className="border border-[#dfe3e8] p-5"><h3 className="font-black">知识点与技能点</h3><div className="mt-3 text-xs font-bold text-[#69717a]">知识点</div>{task.knowledge_points.map((item) => <div key={item} className="mt-2 rounded bg-[#f7f7f8] px-3 py-2 text-sm">{item}</div>)}<div className="mt-4 text-xs font-bold text-[#69717a]">技能点</div>{task.skill_points.map((item) => <div key={item} className="mt-2 rounded bg-[#fff7f8] px-3 py-2 text-sm">{item}</div>)}</div>
      <div className="border border-[#dfe3e8] p-5"><h3 className="font-black">关联校内实训资源</h3>{task.resources.map((item) => <div key={item} className="mt-3 flex items-center gap-2 text-sm"><Link2 size={14} className="text-[#e4002b]" />{item}</div>)}<div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#16803c]"><button type="button" onClick={onAdd} className="inline-flex items-center gap-2 rounded border border-[#16803c] px-3 py-2 font-bold hover:bg-[#f4fbf4]"><CheckCircle2 size={15} />{added ? "已加入个性化学习路径" : "加入个性化学习路径"}</button>{added ? <button type="button" onClick={onViewPath} className="text-[#e4002b] underline">立即查看路径</button> : null}</div></div>
    </aside>
  </section>;
}
