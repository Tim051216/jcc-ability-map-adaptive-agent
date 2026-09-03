import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Info, LockKeyhole, Send, ShieldCheck } from "lucide-react";
import { JOB_LEARNING_CATALOG } from "../lib/jobLearningCatalog";
import { readTrialFlowCompletion } from "../lib/trialFeedback";
import { trialFeedbackApi, type TrialFeedbackReceipt } from "../lib/trialFeedbackApi";

const scoreFields = [
  { key: "pathScore", label: "岗位能力提升路径是否清晰" },
  { key: "resourceScore", label: "资源是否真实、有用且与岗位匹配" },
  { key: "courseScore", label: "不同阶段课程是否与任务对应" },
  { key: "tutorScore", label: "岗位实训导师建议是否可执行" },
  { key: "trustScore", label: "来源、AI 标识和安全提示是否清晰" },
] as const;

type ScoreKey = (typeof scoreFields)[number]["key"];

export default function TrialFeedback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const completion = useMemo(() => readTrialFlowCompletion(), []);
  const detectedRole = searchParams.get("role") || completion?.jobRole || "前端开发工程师";
  const [participantType, setParticipantType] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [institution, setInstitution] = useState("");
  const [jobRole, setJobRole] = useState(JOB_LEARNING_CATALOG[detectedRole] ? detectedRole : "前端开发工程师");
  const [scores, setScores] = useState<Record<ScoreKey, number>>({ pathScore: 0, resourceScore: 0, courseScore: 0, tutorScore: 0, trustScore: 0 });
  const [mostHelpful, setMostHelpful] = useState("");
  const [improvement, setImprovement] = useState("");
  const [continueUse, setContinueUse] = useState<boolean | null>(null);
  const [authenticityConfirmed, setAuthenticityConfirmed] = useState(false);
  const [anonymousUseConsent, setAnonymousUseConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<TrialFeedbackReceipt | null>(null);

  const allScoresSelected = Object.values(scores).every((score) => score >= 1 && score <= 5);
  const canSubmit = Boolean(
    completion && allScoresSelected && mostHelpful.trim().length >= 5 && improvement.trim().length >= 5 && continueUse !== null && authenticityConfirmed,
  );

  const handleSubmit = async () => {
    if (!completion || !canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const nextReceipt = await trialFeedbackApi.submit({
        participantType,
        institution: institution.trim() || undefined,
        jobRole,
        courseId: completion.courseId,
        stageId: completion.stageId,
        flowCompleted: true,
        ...scores,
        mostHelpful: mostHelpful.trim(),
        improvement: improvement.trim(),
        continueUse: Boolean(continueUse),
        authenticityConfirmed: true,
        anonymousUseConsent,
      });
      setReceipt(nextReceipt);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "反馈提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <main className="mx-auto max-w-3xl py-10" aria-label="试用反馈提交结果">
        <section className="rounded-[32px] border border-emerald-200 bg-white p-7 text-center shadow-[0_24px_70px_rgba(16,185,129,0.12)] md:p-10">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
          <p className="mt-5 text-xs font-black tracking-[0.18em] text-emerald-700">真实反馈已落库</p>
          <h1 className="mt-2 text-3xl font-black text-[#171c22]">感谢完成试用反馈</h1>
          <p className="mt-3 text-sm leading-7 text-[#667085]">请保存匿名回执编号。它可以用于核对提交记录，但不会在比赛材料中公开你的姓名。</p>
          <div className="mx-auto mt-6 max-w-md rounded-2xl bg-[#f7fafb] px-5 py-4 text-left ring-1 ring-[#e8edf2]">
            <div className="text-xs font-bold text-[#667085]">匿名反馈回执</div>
            <div className="mt-1 text-2xl font-black tracking-wide text-[#171c22]">{receipt.submissionCode}</div>
            <div className="mt-3 text-xs leading-6 text-[#667085]">岗位：{receipt.jobRole}<br />提交时间：{receipt.submittedAt}</div>
          </div>
          <button type="button" onClick={() => navigate("/report")} className="mt-7 rounded-2xl bg-[#171c22] px-6 py-3 text-sm font-black text-white">返回学习报告</button>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 py-4" aria-label="真实用户试用反馈表单">
      <section className="overflow-hidden rounded-[30px] border border-[#e8edf2] bg-[linear-gradient(135deg,#fff7fa,#ffffff_52%,#f0fbff)] p-6 shadow-[0_18px_55px_rgba(15,23,42,0.06)] md:p-8">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-bold text-[#667085]"><ArrowLeft className="h-4 w-4" />返回上一页</button>
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#d64d7b] ring-1 ring-[#ffd5e3]"><ClipboardCheck className="h-4 w-4" />真实用户试用反馈</div>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#171c22] md:text-4xl">完成主流程后，告诉我们真实感受</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5b6770]">问卷约需 3 分钟。请只提交本人真实体验；自动化测试、开发人员代填或虚构内容不能作为比赛用户反馈。</p>
          </div>
          <div className={`rounded-2xl border p-4 ${completion ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex items-start gap-3">
              {completion ? <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" /> : <Info className="mt-0.5 h-5 w-5 text-amber-700" />}
              <div><div className="text-sm font-black text-[#171c22]">{completion ? "已检测到本次主流程完成记录" : "尚未完成本次主流程"}</div><p className="mt-1 text-xs leading-5 text-[#667085]">{completion ? `${completion.jobRole} · ${new Date(completion.completedAt).toLocaleString("zh-CN")}` : "请先完成岗位路径、资源、课堂任务、导师辅导和测评，再回来提交。"}</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-[#e8edf2] bg-white p-6 shadow-[0_16px_42px_rgba(15,23,42,0.05)] md:p-8">
        <div className="grid gap-5 md:grid-cols-2">
          <fieldset><legend className="text-sm font-black text-[#171c22]">你的身份 *</legend><div className="mt-3 grid grid-cols-2 gap-3">{(["STUDENT", "TEACHER"] as const).map((type) => <button key={type} type="button" aria-pressed={participantType === type} onClick={() => setParticipantType(type)} className={`rounded-2xl border px-4 py-3 text-sm font-black ${participantType === type ? "border-[#fb7299] bg-[#fff4f8] text-[#d64d7b]" : "border-[#e8edf2] text-[#5b6770]"}`}>{type === "STUDENT" ? "学生" : "教师"}</button>)}</div></fieldset>
          <label className="text-sm font-black text-[#171c22]">学校或单位 <span className="font-normal text-[#98a2b3]">（选填）</span><input value={institution} onChange={(event) => setInstitution(event.target.value)} maxLength={120} placeholder="仅用于了解试用场景" className="mt-3 w-full rounded-2xl border border-[#d6dee8] px-4 py-3 text-sm font-normal outline-none focus:border-[#fb7299]" /></label>
          <label className="text-sm font-black text-[#171c22] md:col-span-2">本次体验的目标岗位 *<select value={jobRole} onChange={(event) => setJobRole(event.target.value)} className="mt-3 w-full rounded-2xl border border-[#d6dee8] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#fb7299]">{Object.keys(JOB_LEARNING_CATALOG).map((role) => <option key={role}>{role}</option>)}</select></label>
        </div>

        <div className="mt-8 border-t border-[#eef2f6] pt-7"><h2 className="text-xl font-black text-[#171c22]">体验评分</h2><p className="mt-1 text-sm text-[#667085]">1 分表示非常不符合，5 分表示非常符合。</p><div className="mt-5 space-y-4">{scoreFields.map((field) => <fieldset key={field.key} className="grid gap-3 rounded-2xl bg-[#f8fafc] p-4 md:grid-cols-[minmax(0,1fr)_260px] md:items-center"><legend className="sr-only">{field.label}</legend><div className="text-sm font-bold text-[#344054]">{field.label}</div><div className="grid grid-cols-5 gap-2" aria-label={field.label}>{[1,2,3,4,5].map((score) => <button key={score} type="button" aria-label={`${field.label} ${score} 分`} aria-pressed={scores[field.key] === score} onClick={() => setScores((current) => ({ ...current, [field.key]: score }))} className={`rounded-xl border py-2 text-sm font-black ${scores[field.key] === score ? "border-[#fb7299] bg-[#fb7299] text-white" : "border-[#dfe6ed] bg-white text-[#667085]"}`}>{score}</button>)}</div></fieldset>)}</div></div>

        <div className="mt-8 grid gap-5 border-t border-[#eef2f6] pt-7 md:grid-cols-2">
          <label className="text-sm font-black text-[#171c22]">最有帮助的部分 *<textarea value={mostHelpful} onChange={(event) => setMostHelpful(event.target.value)} maxLength={1000} placeholder="请结合实际操作描述，至少 5 个字" className="mt-3 min-h-36 w-full rounded-2xl border border-[#d6dee8] p-4 text-sm font-normal leading-7 outline-none focus:border-[#fb7299]" /></label>
          <label className="text-sm font-black text-[#171c22]">最需要改进的问题 *<textarea value={improvement} onChange={(event) => setImprovement(event.target.value)} maxLength={1000} placeholder="请描述遇到的问题及发生位置，至少 5 个字" className="mt-3 min-h-36 w-full rounded-2xl border border-[#d6dee8] p-4 text-sm font-normal leading-7 outline-none focus:border-[#fb7299]" /></label>
        </div>

        <fieldset className="mt-6"><legend className="text-sm font-black text-[#171c22]">你是否愿意继续使用？ *</legend><div className="mt-3 flex gap-3">{[true,false].map((value) => <button key={String(value)} type="button" aria-pressed={continueUse === value} onClick={() => setContinueUse(value)} className={`rounded-2xl border px-5 py-2.5 text-sm font-black ${continueUse === value ? "border-[#171c22] bg-[#171c22] text-white" : "border-[#d6dee8] text-[#667085]"}`}>{value ? "愿意" : "暂不"}</button>)}</div></fieldset>

        <div className="mt-7 space-y-3 rounded-[24px] border border-[#e8edf2] bg-[#fbfcfd] p-5">
          <label className={`flex items-start gap-3 text-sm leading-6 ${completion ? "text-[#344054]" : "text-[#98a2b3]"}`}><input type="checkbox" disabled={!completion} checked={authenticityConfirmed} onChange={(event) => setAuthenticityConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-[#fb7299]" /><span><strong>真实性确认（必选）：</strong>本人已真实完成上述学习主流程，反馈由本人填写，不是测试数据或代填内容。</span></label>
          <label className="flex items-start gap-3 text-sm leading-6 text-[#344054]"><input type="checkbox" checked={anonymousUseConsent} onChange={(event) => setAnonymousUseConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-[#fb7299]" /><span><strong>匿名展示授权（自愿）：</strong>同意将本反馈去除身份信息后用于比赛材料；不勾选也可以正常提交。</span></label>
          <div className="flex items-start gap-2 border-t border-[#e8edf2] pt-3 text-xs leading-5 text-[#667085]"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />系统保存登录用户 ID 用于真实性核验；比赛展示仅使用匿名回执、身份类型、岗位、评分和经授权的文字反馈。</div>
        </div>

        {error ? <div role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-[#667085]">提交后内容不可在页面修改；如需撤回比赛展示授权，请联系项目负责人并提供匿名回执。</p><button type="button" disabled={!canSubmit || submitting} onClick={() => void handleSubmit()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#fb7299] px-6 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(251,114,153,0.22)] disabled:cursor-not-allowed disabled:opacity-45"><Send className="h-4 w-4" />{submitting ? "正在提交..." : "提交真实试用反馈"}</button></div>
      </section>
    </main>
  );
}
