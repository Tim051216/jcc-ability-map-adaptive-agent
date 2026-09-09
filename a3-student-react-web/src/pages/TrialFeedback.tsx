import { FormEvent, useState } from "react";
import { CheckCircle2, CircleAlert, Send } from "lucide-react";
import { getCurrentLoggedInUserId } from "../lib/currentUser";
import { studentApi } from "../lib/studentApi";

export default function TrialFeedback() {
  const userId = getCurrentLoggedInUserId();
  const [rating, setRating] = useState(0);
  const [strengths, setStrengths] = useState("");
  const [problems, setProblems] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (rating < 1 || strengths.trim().length < 2 || problems.trim().length < 2 || suggestions.trim().length < 2) return;
    setSaving(true); setError(null);
    try {
      await studentApi.createJobTrialFeedback({ user_id: userId, course_id: 401, participant_role: "student", identity_description: "本人试用用户", trial_task: "完成岗课赛岗位学习、课程映射与实训任务主流程", strengths: strengths.trim(), problems: problems.trim(), improvement_suggestions: suggestions.trim(), overall_rating: rating, consent_to_quote: false });
      setSubmitted(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "反馈提交失败"); } finally { setSaving(false); }
  }

  if (submitted) return <main className="mx-auto max-w-3xl px-4 py-20"><section className="border border-emerald-200 bg-emerald-50 p-8 text-center"><CheckCircle2 className="mx-auto text-emerald-700" size={44} /><h1 className="mt-4 text-2xl font-black text-[#141414]">反馈已提交</h1><p className="mt-2 text-sm text-[#52606d]">感谢你的真实体验反馈。该记录已绑定当前登录用户。</p></section></main>;
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-8"><header className="border-b border-[#dfe3e8] pb-6"><p className="text-sm font-bold text-[#e4002b]">岗课赛试用反馈</p><h1 className="mt-2 text-3xl font-black text-[#141414]">完成岗位—课程—实训主流程后，留下真实感受</h1><p className="mt-2 text-sm text-[#69717a]">反馈用于产品改进；演示数据和虚构内容不能作为比赛用户证据。</p></header><form onSubmit={submit} className="space-y-5 border border-[#dfe3e8] p-5"><fieldset><legend className="text-sm font-bold">总体评分</legend><div className="mt-3 flex gap-2">{[1,2,3,4,5].map((value) => <button key={value} type="button" aria-label={`${value} 分`} aria-pressed={rating === value} onClick={() => setRating(value)} className={`h-10 w-10 border text-sm font-bold ${rating === value ? "border-[#e4002b] bg-[#e4002b] text-white" : "border-[#cfd5db] text-[#69717a]"}`}>{value}</button>)}</div></fieldset><Field label="最有帮助的部分" value={strengths} onChange={setStrengths} /><Field label="遇到的问题" value={problems} onChange={setProblems} /><Field label="改进建议" value={suggestions} onChange={setSuggestions} />{error ? <p role="alert" className="flex items-center gap-2 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><CircleAlert size={16} />{error}</p> : null}<button type="submit" disabled={saving || rating < 1 || strengths.trim().length < 2 || problems.trim().length < 2 || suggestions.trim().length < 2} className="inline-flex items-center gap-2 bg-[#e4002b] px-5 py-3 text-sm font-bold text-white disabled:opacity-40"><Send size={16} />{saving ? "提交中" : "提交反馈"}</button></form></main>;
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-bold">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} minLength={2} maxLength={2000} className="mt-2 min-h-28 w-full border border-[#cfd5db] p-3 text-sm font-normal outline-none focus:border-[#e4002b]" /></label>; }
