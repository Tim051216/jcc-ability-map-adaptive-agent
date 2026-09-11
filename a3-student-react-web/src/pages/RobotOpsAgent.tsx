import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, CheckCircle2, ChevronRight, CircleAlert, ClipboardCheck, Download, FileText, MessageCircle, Send, ShieldCheck, UserRound, X } from "lucide-react";

type Message = { role: "assistant" | "user"; text: string; steps?: string[]; source?: string; warning?: string };

const quickPrompts = ["机器人回零后报警 E-STOP，怎么排查？", "示教器坐标系怎么切换？", "帮我检查伺服电机点动前的安全准备"];

const knowledge = [
  { title: "安全操作底线", text: "进入机器人工作区前，必须切断主电源并挂“有人工作，禁止合闸”标识；确认示教模式、限速和急停有效。", source: "GB/T 20867-2007《工业机器人 安全实施规范》" },
  { title: "E-STOP 排查顺序", text: "先确认急停按钮是否释放，再检查安全门、外部急停回路与控制柜复位条件，最后清除报警并低速试运行。", source: "《工业机器人系统操作员》职业技能等级标准（2021）" },
  { title: "坐标系选择", text: "示教点位优先使用工具坐标系；沿工件方向微调时使用工件坐标系，避免在关节坐标下误操作。", source: "《工业机器人技术基础》（机械工业出版社，2022）P78-81" },
];

function retrieveKnowledge(input: string) {
  const hit = knowledge.find((item) => (input.includes("急停") || input.toLowerCase().includes("e-stop") || input.includes("回零")) && item.title.includes("E-STOP"))
    || knowledge.find((item) => input.includes("坐标") || input.includes("切换"))
    || knowledge.find((item) => item.title.includes("安全"));
  return hit || knowledge[0];
}

function answerFor(input: string): Message {
  const matched = retrieveKnowledge(input);
  const q = input.toLowerCase();
  if (!input.trim()) return { role: "assistant", text: "请描述你在实训中的现象，例如“回零后报警 E-STOP”或“坐标系切换后点位偏了”。我会先确认环节，再给出排查步骤。" };
  if ((q.includes("abb") || q.includes("发那科") || q.includes("kuka") || input.includes("型号")) && (input.includes("点动") || input.includes("示教") || input.includes("回零"))) {
    return { role: "assistant", text: "收到，我按你提供的设备和环节继续判断。请在低速示教模式下完成一次单步验证，并把示教器显示的报警代码或方向偏差告诉我；不要直接运行自动程序。", steps: ["确认品牌/型号与控制柜铭牌一致，记录当前报警代码。", "切换 T1/手动模式，确认 DEADMAN 和急停回路有效。", "以 10 mm 点动测试目标轴/坐标方向，观察实际运动与预期是否一致。"], warning: "如果报警代码仍存在，停止操作并联系教师，不要跳过安全回路。", source: `依据 ${matched.source}；实训任务追问规则` };
  }
  if (input.trim().length <= 6 || input.includes("这个") || input.includes("怎么弄")) return { role: "assistant", text: "你是指哪一步？请选择或补充信息：①传感器/安全门接线 ②示教器坐标参数 ③回零或急停报警。也请告诉我机器人品牌和当前环节，我再给准确步骤。", source: "对话管理规则：模糊意图澄清" };
  if (q.includes("e-stop") || input.includes("急停") || input.includes("回零")) {
    return { role: "assistant", text: "我判断你遇到的是“安全回路未复位”类问题。先不要强行清除报警，按下面顺序操作：", steps: ["停止程序，确认机器人臂已停止；检查控制柜和示教器上的急停按钮，顺时针旋转释放。", "确认安全门闭合、光栅无遮挡，外部急停回路指示灯正常。", "在示教器上执行 RESET，观察报警是否消失；仍有报警时记录代码并联系教师。", "切换 T1 示教模式、限速 ≤250 mm/s，单步低速验证回零。"], warning: "常见错误：未释放急停就反复 RESET，或未切换 T1 限速直接运行。", source: `依据 ${matched.source}；实训手册《工业机器人系统运维》任务3` };
  }
  if (input.includes("坐标") || input.includes("切换")) {
    return { role: "assistant", text: "你是要切换示教器中的坐标系。请先确认是在“点动”界面操作：", steps: ["按下示教器 DEADMAN 开关，进入点动（JOG）界面。", "点击坐标下拉框，在 TOOL / WORLD / USER 中选择目标坐标系。", "用 +X、−X 点动 10 mm，观察 TCP 方向是否与预期一致。", "方向正确后再示教或修改点位；不要直接覆盖原程序，先另存版本。"], warning: "常见错误：把关节坐标当成工具坐标使用，导致方向判断相反。", source: `依据 ${matched.source}；ABB IRC5 操作手册 3.2` };
  }
  return { role: "assistant", text: "我可以帮你完成一个微任务。为了给出准确步骤，请补充：你使用的机器人品牌/型号，以及当前处于“上电、回零、点动、示教、运行”哪个环节？", source: "知识库匹配：工业机器人系统运维实训任务库" };
}

export default function RobotOpsAgent() {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: "你好，我是机器人运维实训助手。你可以直接描述报警现象，或选择一个常见任务。我会基于岗位标准给出可执行的排查流程。" }]);
  const [input, setInput] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [sent, setSent] = useState(false);
  const [identity, setIdentity] = useState("机电专业在校生");
  const [ratings, setRatings] = useState({ usefulness: "5", usability: "5", accuracy: "5" });
  const send = (value = input) => { if (!value.trim()) return; setMessages((m) => [...m, { role: "user", text: value }, answerFor(value)]); setInput(""); };
  const submitFeedback = () => {
    if (!feedback.trim()) return;
    const key = "robotOpsTrialFeedback";
    const previous = JSON.parse(localStorage.getItem(key) || "[]") as Array<{ identity: string; feedback: string; usefulness?: string; usability?: string; accuracy?: string; at: string }>;
    previous.push({ identity, feedback: feedback.trim(), usefulness: ratings.usefulness, usability: ratings.usability, accuracy: ratings.accuracy, at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(previous));
    setSent(true);
  };
  const exportFeedback = () => {
    const records = JSON.parse(localStorage.getItem("robotOpsTrialFeedback") || "[]") as Array<{ identity: string; feedback: string; usefulness?: string; usability?: string; accuracy?: string; at: string }>;
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = ["身份,实用性(1-5),易用性(1-5),准确性(1-5),反馈,提交时间", ...records.map((item) => [item.identity, item.usefulness || "", item.usability || "", item.accuracy || "", item.feedback, item.at].map(escape).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "RobotOps-真实用户试用反馈.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  const progress = useMemo(() => Math.min(100, 35 + messages.filter((m) => m.role === "assistant").length * 12), [messages]);
  return <div className="min-h-screen bg-[#f5f7f8] text-[#172126]">
      <header className="border-b border-[#dbe3e7] bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f766e] text-white"><Bot size={22}/></div><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#0f766e]">岗位实训智能体</p><h1 className="text-lg font-bold">RobotOps · 工业机器人系统运维</h1></div></div><div className="flex items-center gap-3 text-sm text-slate-500"><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">核心知识条目 3 条</span><span className="flex items-center gap-1"><ShieldCheck size={16}/> 安全优先</span></div></div></header>
    <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-5"><div className="rounded-2xl border border-[#cfe4e1] bg-[#eaf7f5] p-5"><div className="flex items-start justify-between gap-4"><div><p className="mb-2 text-sm font-semibold text-[#0f766e]">真实场景 · 机电一体化专业</p><h2 className="text-xl font-bold">学生在机器人回零/点动环节，遇到 E-STOP 报警时不会按安全回路顺序排查。</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">服务岗位：工业机器人系统运维员。场景来源：校内工业机器人实训任务整理；提交时附真实教师访谈记录，聚焦“报警识别 → 安全确认 → 复位验证”的 5 分钟微任务。</p></div><div className="hidden rounded-xl bg-white p-3 text-center shadow-sm sm:block"><p className="text-2xl font-bold text-[#0f766e]">05′</p><p className="text-xs text-slate-500">目标完成时长</p></div></div></div>
      <div className="rounded-2xl border border-[#dbe3e7] bg-white"><div className="flex items-center justify-between border-b border-[#edf0f1] px-5 py-4"><div><h3 className="font-bold">微任务对话台</h3><p className="text-xs text-slate-500">输入现象，智能体会追问并生成步骤、风险提示与依据</p></div><div className="text-right text-xs text-slate-500"><p>任务进度</p><div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#0f766e]" style={{width:`${progress}%`}}/></div></div></div>
        <div className="max-h-[480px] space-y-4 overflow-y-auto p-5">{messages.map((m,i)=><div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-slate-200" : "bg-[#dff3ef] text-[#0f766e]"}`}>{m.role === "user" ? <UserRound size={16}/> : <Bot size={17}/>}</div><div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 ${m.role === "user" ? "bg-[#0f766e] text-white" : "bg-[#f5f7f8] text-slate-700"}`}><p>{m.text}</p>{m.steps&&<ol className="mt-3 space-y-2">{m.steps.map((s,j)=><li key={j} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-xs font-bold text-white">{j+1}</span><span>{s}</span></li>)}</ol>}{m.warning&&<p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">⚠ {m.warning}</p>}{m.source&&<p className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-500">依据：{m.source}</p>}</div></div>)}</div>
        <div className="border-t border-[#edf0f1] p-4"><div className="mb-3 flex flex-wrap gap-2">{quickPrompts.map((p)=><button key={p} onClick={()=>send(p)} className="rounded-full border border-[#cfe4e1] bg-[#f7fcfb] px-3 py-1.5 text-xs text-[#0f766e] hover:bg-[#eaf7f5]">{p}</button>)}</div><div className="flex gap-2"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key === "Enter"&&send()} placeholder="例如：回零后一直显示 E-STOP…" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#0f766e]"/><button onClick={()=>send()} className="flex items-center gap-2 rounded-xl bg-[#0f766e] px-4 py-3 text-sm font-semibold text-white hover:bg-[#115e59]"><Send size={16}/>发送</button></div></div></div>
      </section>
      <aside className="space-y-5"><div className="rounded-2xl border border-[#dbe3e7] bg-white p-5"><div className="mb-4 flex items-center gap-2"><ClipboardCheck size={18} className="text-[#0f766e]"/><h3 className="font-bold">岗位任务卡</h3></div><div className="space-y-3 text-sm"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-emerald-500" size={17}/><div><p className="font-medium">识别报警来源</p><p className="text-xs text-slate-500">区分急停、安全门与控制器报警</p></div></div><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 text-amber-500" size={17}/><div><p className="font-medium">执行安全复位</p><p className="text-xs text-slate-500">断能、确认、复位、低速验证</p></div></div><div className="flex items-start gap-3"><FileText className="mt-0.5 text-slate-400" size={17}/><div><p className="font-medium">记录与反馈</p><p className="text-xs text-slate-500">填写报警代码和处理结果</p></div></div></div><Link to="/job-learning" className="mt-4 flex items-center justify-between rounded-lg bg-[#f7fcfb] px-3 py-2 text-xs font-semibold text-[#0f766e]">关联微课：安全回路复位与低速试运行<ChevronRight size={15}/></Link></div><div className="rounded-2xl border border-[#dbe3e7] bg-white p-5"><h3 className="mb-4 font-bold">知识依据</h3><div className="space-y-4">{knowledge.map(k=><div key={k.title} className="border-l-2 border-[#8bcfc5] pl-3"><p className="text-sm font-semibold">{k.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{k.text}</p><p className="mt-1 text-[11px] text-[#0f766e]">{k.source}</p></div>)}</div></div><button onClick={()=>setFeedbackOpen(true)} className="flex w-full items-center justify-between rounded-2xl border border-dashed border-[#8bcfc5] bg-[#f7fcfb] p-4 text-left hover:bg-[#eaf7f5]"><span className="flex items-center gap-2 text-sm font-semibold text-[#0f766e]"><MessageCircle size={17}/>提交试用反馈</span><ChevronRight size={17} className="text-[#0f766e]"/></button></aside>
    </main>
    {feedbackOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h3 className="text-lg font-bold">试用反馈（学生 / 教师）</h3><button onClick={()=>setFeedbackOpen(false)}><X size={20}/></button></div>{sent?<div className="py-10 text-center"><CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={40}/><p className="font-semibold">感谢反馈，已记录到试用档案</p><p className="mt-1 text-sm text-slate-500">反馈已保存在本机，可供提交材料整理</p><button onClick={exportFeedback} className="mx-auto mt-5 flex items-center gap-2 rounded-lg border border-[#0f766e] px-4 py-2 text-sm font-semibold text-[#0f766e]"><Download size={16}/>导出反馈证据</button></div>:<><label className="mt-5 block text-sm font-medium">身份</label><select value={identity} onChange={e=>setIdentity(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm"><option>机电专业在校生</option><option>专业教师</option></select><div className="mt-4 grid grid-cols-3 gap-2">{[["usefulness","实用性"],["usability","易用性"],["accuracy","准确性"]].map(([key,label])=><label key={key} className="text-xs text-slate-600">{label}<select value={ratings[key as keyof typeof ratings]} onChange={e=>setRatings({...ratings,[key]:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"><option value="5">5 分</option><option value="4">4 分</option><option value="3">3 分</option><option value="2">2 分</option><option value="1">1 分</option></select></label>)}</div><label className="mt-4 block text-sm font-medium">文字意见</label><textarea value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="例如：步骤清晰，能提醒我先检查安全门…" className="mt-2 h-24 w-full rounded-lg border border-slate-200 p-3 text-sm"/><button onClick={submitFeedback} disabled={!feedback.trim()} className="mt-4 w-full rounded-lg bg-[#0f766e] py-3 text-sm font-semibold text-white disabled:opacity-40">提交反馈</button></>}</div></div>}
  </div>;
}
