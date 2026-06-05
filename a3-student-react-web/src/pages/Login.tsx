/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Bot,
  Heart,
  Info,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";

import assetAnimeClassroom from "../assets/images/anime_perfect_dual_1779718037085.png";
import assetHaibaraAcademic from "../assets/images/haibara_academic_1779716437995.png";
import assetUsagiStudy from "../assets/images/usagi_perfect_1779717893221.png";

interface LoginProps {
  onLoginSuccess: (userData: { id: string; name: string; avatar: string }) => void;
}

type PresetState = "default" | "idFocus" | "pwdFocus" | "typing" | "error" | "success";

export default function Login({ onLoginSuccess }: LoginProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [studentId, setStudentId] = useState("demo2024");
  const [password, setPassword] = useState("bililearn");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetState>("default");

  const haibaraSpeech = {
    default: "哼，又是需要重构的难题吗？稍微动一动脑筋，倒也是不错的消遣。",
    idFocus: "这是你的学籍号吗？卡号包含年份和身份编码，别输错了。",
    pwdFocus: "登录密钥就像配方里的最后一环，顺序错了，整个流程都会中断。",
    typing: "敲击键盘的节奏还不错。保持专注，系统会配合你的速度。",
    error: "无效的密码或学籍。第一步验证就崩掉的话，后面可谈不上推进。",
    success: "验证完毕。既然契约成立，那就跟上来，别在入口浪费时间。",
  };

  const usagiSpeech = {
    default: "哈？！呀哈！！！你终于上线啦！快和我们一起冲进代码世界玩耍！",
    idFocus: "哇哦，正在识别你的专属学号，像给入场券贴上亮闪闪的星星！",
    pwdFocus: "前方是密码结界！别怕，我会蹦蹦跳跳帮你撞开它！",
    typing: "继续继续！你的手速已经有一点点热血主角的味道啦！",
    error: "欸？没对上……没关系，我们再检查一次，这次一定能跳过去！",
    success: "通过啦！双人学习战舰准备发射，目标是今天的高能进步！",
  };

  const [haibaraText, setHaibaraText] = useState(haibaraSpeech.default);
  const [usagiText, setUsagiText] = useState(usagiSpeech.default);

  useEffect(() => {
    setHaibaraText(haibaraSpeech[activePreset]);
    setUsagiText(usagiSpeech[activePreset]);
  }, [activePreset]);

  const fromState = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const fromPathname = fromState?.pathname || "/";
  const fromSearch = fromState?.search || "";
  const from = fromPathname === "/login" ? "/" : `${fromPathname}${fromSearch}`;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!studentId || !password) {
      setError("请填写专属学籍凭证后登录。");
      setActivePreset("error");
      return;
    }

    setLoading(true);
    setActivePreset("typing");

    setTimeout(() => {
      setLoading(false);
      if (studentId === "demo2024" && password === "bililearn") {
        setActivePreset("success");
        setTimeout(() => {
          onLoginSuccess({
            id: "demo2024",
            name: "联合研学契约 (灰原 & 乌萨奇)",
            avatar: assetHaibaraAcademic,
          });
          navigate(from, { replace: true });
        }, 850);
      } else {
        setError("无效学籍卡或密码错误。卡面登录凭证：demo2024 / bililearn");
        setActivePreset("error");
      }
    }, 950);
  };

  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#fff5f1_0%,#eef5fb_42%,#f8fbff_70%,#ffffff_100%)] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-5%] top-[-10%] h-72 w-72 rounded-full bg-[#ff8ba7]/18 blur-3xl" />
        <div className="absolute right-[-8%] top-[10%] h-80 w-80 rounded-full bg-[#88c8ff]/18 blur-3xl" />
        <div className="absolute bottom-[-12%] left-[24%] h-96 w-96 rounded-full bg-[#ffd76a]/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.18),transparent_28%,transparent_72%,rgba(255,255,255,0.14))]" />
      </div>

      <div className="relative z-10 flex w-full max-w-6xl overflow-hidden rounded-[36px] border-[3px] border-slate-900 bg-white/88 shadow-[0_30px_90px_rgba(15,23,42,0.18),10px_10px_0px_rgba(15,23,42,0.96)] backdrop-blur md:min-h-[760px]">
        <section className="relative hidden w-[54%] flex-col justify-between overflow-hidden border-r-[3px] border-slate-900 bg-[linear-gradient(180deg,#fff6ef_0%,#f8fbff_56%,#fdfdff_100%)] md:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,114,153,0.14),transparent_28%),radial-gradient(circle_at_left_bottom,rgba(86,185,255,0.14),transparent_30%)]" />

          <div className="relative border-b-[3px] border-slate-900 p-5">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08),transparent_55%)]" />
            <div className="relative overflow-hidden rounded-[28px] border-[3px] border-slate-900 shadow-[0_12px_32px_rgba(15,23,42,0.16)]">
              <img
                src={assetAnimeClassroom}
                alt="双角色研学教室"
                className="h-[230px] w-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_24%,rgba(15,23,42,0.08)_54%,rgba(15,23,42,0.58)_100%)]" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border-2 border-slate-900 bg-[#fb7299] px-4 py-2 text-[11px] font-extrabold tracking-[0.18em] text-white shadow-[0_4px_0px_rgba(15,23,42,1)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>双角色联学协议</span>
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-white">灰原哀 & 乌萨奇</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-100/90">
                      研究型冷静导师 + 元气型鼓励拍档
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-white/70 bg-white/18 px-4 py-3 text-right text-white backdrop-blur">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/80">Study Mode</div>
                  <div className="mt-1 text-base font-black">Academic Active</div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex-1 px-5 py-5">
            <div className="grid gap-4">
              <div className="flex items-center justify-between px-1">
                <div className="inline-flex items-center gap-2 text-[11px] font-black tracking-[0.18em] text-[#fb7299]">
                  <Heart className="h-4 w-4 fill-[#fb7299]" />
                  <span>学习战友同步在线</span>
                </div>
                <div className="rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                  duo active
                </div>
              </div>

              <div className="rounded-[28px] border-[3px] border-slate-900 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <div className="flex items-start gap-4">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl border-[3px] border-slate-900 bg-[#f8ebff] shadow-[0_4px_0px_rgba(15,23,42,0.96)]">
                    <img
                      src={assetHaibaraAcademic}
                      alt="灰原哀"
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-black text-slate-900">灰原哀</h4>
                        <span className="rounded-full bg-[#7c3aed] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                          research-b
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-400">研究助理</span>
                    </div>
                    <div className="rounded-[22px] border-2 border-[#e7d6ff] bg-[linear-gradient(180deg,#fcf7ff,#f8f1ff)] px-4 py-3 text-sm font-bold leading-6 text-[#4c1d95]">
                      {haibaraText}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border-[3px] border-slate-900 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <div className="flex items-start gap-4">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl border-[3px] border-slate-900 bg-[#fff4d6] shadow-[0_4px_0px_rgba(15,23,42,0.96)]">
                    <img
                      src={assetUsagiStudy}
                      alt="乌萨奇"
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-black text-slate-900">乌萨奇</h4>
                        <span className="rounded-full bg-[#f59e0b] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                          energy-s
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-400">考级应援</span>
                    </div>
                    <div className="rounded-[22px] border-2 border-[#f8da8f] bg-[linear-gradient(180deg,#fffaf0,#fff3d7)] px-4 py-3 text-sm font-black leading-6 text-[#92400e]">
                      {usagiText}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border-2 border-slate-200 bg-white/78 px-5 py-4">
                <div className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Academic Terminal Kit
                </div>
                <div className="grid grid-cols-2 gap-3 text-[12px] font-bold text-slate-700">
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-3">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span>智能追踪能力模型</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-3">
                    <Star className="h-4 w-4 text-amber-500" />
                    <span>随堂文献收藏库</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-3">
                    <Bot className="h-4 w-4 text-sky-500" />
                    <span>AI 双导师协同答疑</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-3">
                    <BookOpen className="h-4 w-4 text-[#fb7299]" />
                    <span>闭环微测评终端</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative flex min-h-[760px] flex-1 items-center justify-center bg-[linear-gradient(180deg,#fffdfd_0%,#fff7fb_44%,#f7fbff_100%)] px-6 py-8 md:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,114,153,0.09),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(103,180,255,0.08),transparent_36%)]" />
          <div className="absolute left-6 top-6 hidden rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 shadow-sm md:block">
            dual-auth gateway
          </div>

          <div className="relative z-10 mx-auto w-full max-w-md space-y-5">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#fb7299]/30 bg-[#fff1f5] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#fb7299]">
                <Sparkles className="h-3.5 w-3.5" />
                <span>BiliLearn v2.0</span>
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl font-black tracking-tight text-slate-950">研学集结契约书</h1>
                <p className="max-w-sm text-sm font-semibold leading-7 text-slate-500">
                  建立学伴协同身份，与灰原和乌萨奇一起进入更沉浸、更可靠的双导师学习入口。
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[28px] border-[3px] border-slate-900 bg-[linear-gradient(135deg,#f2f8ff,#fff8fb_55%,#fffdf7)] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
              <div className="absolute right-4 top-3 text-[44px] font-black text-slate-900/6">ID</div>
              <div className="relative flex items-start gap-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0f6e8c]" />
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black tracking-[0.12em] text-[#0f6e8c]">演示身份卡已注入</p>
                    <span className="rounded-full bg-[#fb7299]/15 px-2 py-1 text-[10px] font-black text-[#fb7299]">
                      即刻可用
                    </span>
                  </div>
                  <div className="grid gap-2 text-[12px] font-bold text-slate-700">
                    <div className="flex items-center justify-between rounded-2xl bg-white/85 px-3 py-2">
                      <span>Student ID</span>
                      <span className="font-mono text-[#fb7299]">demo2024</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/85 px-3 py-2">
                      <span>Password</span>
                      <span className="font-mono text-[#fb7299]">bililearn</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error ? (
              <div className="rounded-[22px] border-2 border-red-300 bg-red-50 px-4 py-3 text-sm font-black text-red-700 shadow-sm">
                契约警报：{error}
              </div>
            ) : null}

            <form onSubmit={handleLoginSubmit} className="space-y-4 rounded-[30px] border-[3px] border-slate-900 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.1)]">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">
                  学籍卡号 / 绑定邮箱
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-id-input"
                    type="text"
                    value={studentId}
                    onChange={(e) => {
                      setStudentId(e.target.value);
                      if (activePreset !== "typing") setActivePreset("typing");
                    }}
                    onFocus={() => setActivePreset("idFocus")}
                    onBlur={() => setActivePreset("default")}
                    placeholder="请输入 demo2024 ..."
                    className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-slate-50/70 pl-12 pr-4 text-sm font-bold text-slate-800 outline-hidden transition-all focus:border-[#fb7299] focus:bg-white focus:ring-4 focus:ring-[#fb7299]/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">
                    学术密钥
                  </label>
                  <a
                    href="#reset"
                    className="text-[11px] font-black text-[#fb7299] transition-colors hover:text-[#f45184]"
                    onClick={(e) => {
                      e.preventDefault();
                      setHaibaraText("别担心，演示环境里输入 bililearn 就能继续。");
                      setUsagiText("记住 bililearn！这可是今天的幸运小密码！");
                    }}
                  >
                    忘记密码？
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-password-input"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (activePreset !== "typing") setActivePreset("typing");
                    }}
                    onFocus={() => setActivePreset("pwdFocus")}
                    onBlur={() => setActivePreset("default")}
                    placeholder="请输入 bililearn ..."
                    className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-slate-50/70 pl-12 pr-4 text-sm font-bold text-slate-800 outline-hidden transition-all focus:border-[#fb7299] focus:bg-white focus:ring-4 focus:ring-[#fb7299]/10"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-slate-500">
                  <input
                    id="login-remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4.5 w-4.5 rounded accent-[#fb7299]"
                  />
                  <span>在当前设备保留 30 天学习身份</span>
                </label>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  secure
                </span>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                disabled={loading}
                className="flex h-13 w-full items-center justify-center gap-2 rounded-[22px] border-[3px] border-slate-900 bg-[linear-gradient(135deg,#fb7299,#ff8f6b)] px-4 text-sm font-black text-white shadow-[0_10px_0px_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_0px_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_5px_0px_rgba(15,23,42,1)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-[0_8px_0px_rgba(148,163,184,1)]"
              >
                {loading ? (
                  <span className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-4.5 w-4.5" />
                    <span>立即进入双导师学习舱</span>
                  </>
                )}
              </button>
            </form>

            <div className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4 text-sm font-semibold leading-7 text-slate-500 shadow-sm">
              还没有建立学习契约？
              <a
                href="#request"
                className="ml-1 font-black text-[#fb7299] hover:text-[#f45184]"
                onClick={(e) => {
                  e.preventDefault();
                  setHaibaraText("先去登记身份，回来之后我们再继续推进。");
                  setUsagiText("快去申请加入！我会在这里给你留一个热乎乎的位置！");
                }}
              >
                向教务端申请开通档案
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
