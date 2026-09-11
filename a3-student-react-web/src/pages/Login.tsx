/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Lock,
  Mail,
  MessageCircleMore,
  Sparkles,
} from "lucide-react";
import {
  LAST_ACCOUNT_STORAGE_KEY,
  PERSISTENT_SESSION_STORAGE_KEY,
} from "../App";
import assetHaibaraAcademic from "../assets/images/haibara_academic_1779716437995.webp";
import assetUsagiStudy from "../assets/images/usagi_perfect_1779717893221.webp";
import StudyAssistant3D from "../components/StudyAssistant3D";

import { DEMO_USER_PROFILES, getDemoUserProfile } from "../lib/userProfiles";

interface LoginProps {
  onLoginSuccess: (
    userData: { id: string; name: string; avatar: string },
    options?: { persist?: boolean }
  ) => void;
}

type PresetState = "default" | "idFocus" | "pwdFocus" | "typing" | "error" | "success";
type LoginTutorMessage = {
  role: "assistant" | "user";
  content: string;
};

const DEMO_ACCOUNTS = DEMO_USER_PROFILES;
const LOGIN_HIGHLIGHTS = [
  { label: "岗位能力诊断", value: "动态更新", detail: "登录后恢复专业、目标、岗位能力薄弱点和学习历史。" },
  { label: "学习闭环", value: "自动衔接", detail: "继续课程测评、规划、资源生成、答疑和复习提醒。" },
  { label: "AI 导师", value: "随时追问", detail: "围绕当前课程资料和生成资源继续对话学习。" },
];
const LOGIN_POSTER_TAGS = ["岗位能力", "测评", "规划", "资源", "答疑"];
const LOGIN_LOOP_STEPS = [
  { label: "岗位学情智能体", detail: "抽取岗位、目标与能力薄弱点", status: "在线" },
  { label: "测评智能体", detail: "定位知识盲区与掌握断层", status: "联动中" },
  { label: "规划智能体", detail: "生成下一步学习路径", status: "在线" },
  { label: "资源智能体", detail: "补齐讲义、导图、练习", status: "在线" },
];
const LOGIN_POSTER_METRICS = [
  { label: "岗位能力维度", value: "6+", note: "动态更新" },
  { label: "资源类型", value: "5+", note: "按任务补齐" },
  { label: "闭环状态", value: "实时", note: "节点持续联动" },
];
const BRAND_NAME = "BiliLearn";

class LoginModelBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Login 3D model failed:", error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function LoginModelFallback({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center rounded-[32px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,248,251,0.92))] text-center shadow-[0_24px_52px_rgba(15,23,42,0.08)] ${compact ? "min-h-[190px]" : "min-h-[300px]"}`}
    >
      <div className="max-w-[240px] px-4 py-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#F6B6CA] bg-white text-[#fb7299] shadow-[0_14px_30px_rgba(251,114,153,0.16)]">
          <MessageCircleMore className="h-7 w-7" />
        </div>
        <div className="mt-3 text-sm font-black text-[#111827]">AI 导师入口</div>
        <div className="mt-1 text-[12px] leading-5 text-[#667085]">3D 模型暂未加载成功，入口页仍可正常使用。</div>
      </div>
    </div>
  );
}

function useTypewriterText(text: string, enabled: boolean, speed = 28, delay = 0) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!enabled) {
      setValue("");
      return;
    }

    const chars = Array.from(text);
    let startTimer = 0;
    let intervalTimer = 0;

    setValue("");
    startTimer = window.setTimeout(() => {
      let index = 0;
      intervalTimer = window.setInterval(() => {
        index += 1;
        setValue(chars.slice(0, index).join(""));
        if (index >= chars.length) {
          window.clearInterval(intervalTimer);
        }
      }, speed);
    }, delay);

    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(intervalTimer);
    };
  }, [delay, enabled, speed, text]);

  return value;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [studentId, setStudentId] = useState(() => localStorage.getItem(LAST_ACCOUNT_STORAGE_KEY) || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickLoginLoading, setQuickLoginLoading] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetState>("default");
  const [recognizedAccount, setRecognizedAccount] = useState<string | null>(() => localStorage.getItem(LAST_ACCOUNT_STORAGE_KEY));
  const [hasPersistentSession, setHasPersistentSession] = useState(
    () => Boolean(localStorage.getItem(PERSISTENT_SESSION_STORAGE_KEY))
  );
  const [useManualAccountInput, setUseManualAccountInput] = useState(false);
  const [accountMode, setAccountMode] = useState<"login" | "register">("login");
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);
  const [posterParallax, setPosterParallax] = useState({ x: 0, y: 0 });
  const [introReady, setIntroReady] = useState(false);
  const [hoveredHighlight, setHoveredHighlight] = useState<string | null>(null);
  const [loginTutorBubbleOpen, setLoginTutorBubbleOpen] = useState(false);
  const [loginTutorInput, setLoginTutorInput] = useState("");
  const [loginTutorMessages, setLoginTutorMessages] = useState<LoginTutorMessage[]>([
    {
      role: "assistant",
      content: "我在入口页，可以回答登录、账号切换、进入后能做什么这些问题。",
    },
  ]);
  const loginTutorMessagesRef = useRef<HTMLDivElement | null>(null);
  const heroTitleLeft = useTypewriterText("AI学习空间", introReady, 42, 220);
  const heroTitleRight = useTypewriterText("一键进入", introReady, 42, 980);
  const heroCopy = useTypewriterText("以岗位能力诊断为起点，联动产业分析、任务转化、资源推荐和岗课赛学习，形成完整教学闭环。", introReady, 16, 1500);
  const loginTitle = useTypewriterText("进入你的 BiliLearn", introReady, 34, 480);
  const loginCopy = useTypewriterText("选择账号进入岗课赛学习闭环，系统会接续岗位能力诊断、课程进度、生成资源和答疑上下文。", introReady, 16, 1150);
  const recognizedProfile = recognizedAccount ? getDemoUserProfile(recognizedAccount) : null;
  const selectedProfile = studentId ? getDemoUserProfile(studentId) : recognizedProfile;
  const accountOptions = [
    ...(recognizedProfile ? [recognizedProfile] : []),
    ...DEMO_ACCOUNTS.filter((account) => account.id !== recognizedAccount),
  ].slice(0, 8);

  const haibaraSpeech = {
    default: "哼，又是需要重构的难题吗？稍微动一动脑筋，倒也是不错的消遣。",
    idFocus: "这是你真实的学籍号吗？卡号包含年份和身份编码，别输错了。",
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

  useEffect(() => {
    if (!recognizedAccount) return;
    setHaibaraText("系统识别到你上次登录的账号，这次可以直接继续，不必从头重填。");
    setUsagiText("呀哈！我已经认出你啦，只要确认口令，就能马上回到上次的学习空间！");
  }, [recognizedAccount]);

  useEffect(() => {
    setHasPersistentSession(Boolean(localStorage.getItem(PERSISTENT_SESSION_STORAGE_KEY)));
  }, [recognizedAccount]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIntroReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!loginTutorBubbleOpen) return;
    window.requestAnimationFrame(() => {
      const messageLists = [
        loginTutorMessagesRef.current,
        ...Array.from(document.querySelectorAll<HTMLDivElement>('div[class*="space-y-2"][class*="overflow-y"]')),
      ].filter((messageList): messageList is HTMLDivElement => Boolean(messageList));
      messageLists.forEach((messageList) => {
        messageList.scrollTop = messageList.scrollHeight;
      });
    });
  }, [loginTutorBubbleOpen, loginTutorMessages]);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";

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
      if (studentId.trim() && password.trim()) {
        setActivePreset("success");
        setTimeout(() => {
          const normalizedStudentId = studentId.trim();
          const profile = getDemoUserProfile(normalizedStudentId);
          if (rememberMe) {
            localStorage.setItem(LAST_ACCOUNT_STORAGE_KEY, normalizedStudentId);
          } else {
            localStorage.removeItem(LAST_ACCOUNT_STORAGE_KEY);
          }
          onLoginSuccess({
            id: normalizedStudentId,
            name: profile?.name || "BiliLearn 用户",
            avatar: profile?.avatar || assetHaibaraAcademic,
          }, { persist: rememberMe });
          navigate(from, { replace: true });
        }, 850);
      } else {
        setError("学籍卡号或学习口令不能为空，请补全后继续。");
        setActivePreset("error");
      }
    }, 950);
  };

  const handleQuickContinue = () => {
    if (!recognizedAccount) return;

    setError("");
    setQuickLoginLoading(true);
    setActivePreset("success");

    setTimeout(() => {
      const profile = getDemoUserProfile(recognizedAccount);
      onLoginSuccess({
        id: recognizedAccount,
        name: profile?.name || "BiliLearn 用户",
        avatar: profile?.avatar || assetHaibaraAcademic,
      }, { persist: true });
      navigate(from, { replace: true });
    }, 420);
  };

  const handleSelectAccount = (accountId: string) => {
    const profile = getDemoUserProfile(accountId);
    setStudentId(accountId);
    setRecognizedAccount(accountId);
    setPassword("demo123");
    setError("");
    setShowDemoAccounts(false);
    setUseManualAccountInput(false);
    setAccountMode("login");
    setActivePreset("success");
    setHaibaraText(`已切换到 ${profile?.name || accountId}，确认后即可继续当前学习上下文。`);
    setUsagiText("账号已经帮你切好啦，点一下就能回到刚才那条学习主线！");
  };

  const handleCreateAccount = () => {
    setAccountMode("register");
    setUseManualAccountInput(true);
    setStudentId("");
    setPassword("");
    setError("");
    setActivePreset("idFocus");
    setHaibaraText("先建立你的学习账号，后续的学习记录、路径和反馈就能稳定接续。");
    setUsagiText("我们先把新账号建好，马上就能带你进学习空间开跑啦！");
  };

  const handlePosterParallaxMove = (event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = (event.clientX - rect.left) / rect.width - 0.5;
    const offsetY = (event.clientY - rect.top) / rect.height - 0.5;
    setPosterParallax({
      x: Number((offsetX * 18).toFixed(2)),
      y: Number((offsetY * 14).toFixed(2)),
    });
  };

  const resetPosterParallax = () => {
    setPosterParallax({ x: 0, y: 0 });
  };

  const handleOpenLoginTutor = () => {
    setLoginTutorBubbleOpen(true);
  };

  const buildLoginTutorReply = (question: string) => {
    const normalizedQuestion = question.toLowerCase().replace(/[？?！!。,.，、\s]/g, "");
    if (normalizedQuestion.includes("密码") || normalizedQuestion.includes("登录") || normalizedQuestion.includes("账号")) {
      return "这里可以选择演示账号，也可以手动输入账号密码。当前演示账号常用口令会自动填入，确认后就能回到学习空间。";
    }
    if (normalizedQuestion.includes("如何使用") || normalizedQuestion.includes("怎么使用") || normalizedQuestion.includes("系统怎么用") || normalizedQuestion.includes("功能")) {
      return "系统围绕岗课赛闭环工作：先从岗位能力诊断和测评了解当前状态，再进入课堂学习，随后生成任务卡、讲义、导图和练习，最后用报告和复习提醒跟踪进展。登录后从首页导航进入对应模块即可。";
    }
    if (normalizedQuestion.includes("课堂") || normalizedQuestion.includes("视频") || normalizedQuestion.includes("资源")) {
      return "进入后可以从课堂页继续看视频，在资源页生成讲义、PPT、练习和代码任务，AI 导师会带着当前课程上下文回答。";
    }
    if (normalizedQuestion.includes("画像") || normalizedQuestion.includes("岗位能力") || normalizedQuestion.includes("测评") || normalizedQuestion.includes("路径") || normalizedQuestion.includes("学习情况")) {
      return "系统会用岗位能力诊断、测评结果和历史进度生成个性化路径，再把课堂、任务、资源和报告串成闭环。";
    }
    if (normalizedQuestion.includes("ai导师") || normalizedQuestion.includes("答疑") || normalizedQuestion.includes("问问题")) {
      return "AI 导师会根据当前页面和已保存的学习上下文回答问题。课堂页会结合当前视频内容，资源页会结合当前资源，其他页面则依据本地知识库和你的学习记录回答。";
    }
    if (normalizedQuestion.includes("讲义") || normalizedQuestion.includes("ppt") || normalizedQuestion.includes("导图") || normalizedQuestion.includes("练习")) {
      return "在课堂页进入资源生成区，选择讲义、PPT、导图或练习即可生成对应资源。系统会优先展示知识库中已有的结果，避免重复等待。";
    }
    return "可以的。你可以问我登录入口怎么用、进入后先看哪里、AI 导师会读取哪些学习上下文。";
  };

  const buildSmartLoginTutorReply = (question: string) => {
    const normalizedQuestion = question.trim().toLowerCase();
    const hasAny = (keywords: string[]) => keywords.some((keyword) => normalizedQuestion.includes(keyword.toLowerCase()));

    if (hasAny(["密码", "口令", "登录", "账号", "切换", "demo", "demo2024", "bililearn", "1001"])) {
      return "登录这里支持两种方式：点“切换账号”选择演示账号，或手动输入账号密码。原始 Demo 账号是 demo2024，口令是 bililearn；普通演示账号也会在选择后自动填入口令，确认即可进入。";
    }
    if (hasAny(["进不去", "无法进入", "失败", "错误", "报错", "没反应", "卡住"])) {
      return "先检查账号和口令是否都有内容，再看是否选中了正确账号。若你只是想快速演示，建议切到“原始 Demo”或 1001 演示账号后直接进入。";
    }
    if (hasAny(["进入后", "进去后", "能看到", "首页", "概览", "开始"])) {
      return "进入后会先恢复你的岗位能力诊断和最近进度，再从岗位分析、任务转学习卡、岗位能力图谱和岗课赛学习页面继续。";
    }
    if (hasAny(["课堂", "视频", "播放", "暂停", "当前时间", "提问"])) {
      return "课堂页会记录视频上下文。你在课堂里点击“直接对当前视频提问”时，会带上当前视频和播放时间，方便 AI 导师围绕这段内容回答。";
    }
    if (hasAny(["资源", "资料", "ppt", "讲义", "练习", "代码", "生成"])) {
      return "资源中心可以区分原始资料和 AI 生成资料，支持生成讲义、PPT、练习、代码任务等内容，并能继续进入预览或下载。";
    }
    if (hasAny(["画像", "岗位能力", "测评", "路径", "个性化", "推荐", "计划"])) {
      return "系统会结合岗位能力诊断、测评结果、课程进度和薄弱点生成个性化路径，推荐下一步课程、资源和实训任务。";
    }
    if (hasAny(["导师", "ai", "问答", "助手", "聊天"])) {
      return "AI 导师会尽量带着当前页面上下文回答。登录页这里只提供轻量说明，进入学习空间后可以在课堂、资源、路径等页面继续问更具体的问题。";
    }
    if (hasAny(["收藏", "报告", "消息", "im", "沟通"])) {
      return "收藏页用于沉淀常用资料，报告页汇总阶段成果和薄弱点，消息页处理课程群和私聊协作。";
    }

    const fallbackReply = buildLoginTutorReply(question);
    return fallbackReply || `我先按入口页理解你的问题：“${question}”。如果你想快速体验，可以选择原始 Demo 账号进入；如果你想了解功能，可以问我“资源怎么生成”“课堂怎么提问”“学习路径怎么推荐”。`;
  };

  const handleLoginTutorSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const question = loginTutorInput.trim();
    if (!question) return;
    setLoginTutorMessages((messages) => [
      ...messages,
      { role: "user", content: question },
      { role: "assistant", content: buildSmartLoginTutorReply(question) },
    ]);
    setLoginTutorInput("");
  };

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#f6f8fb] px-3 py-3 md:px-5 md:py-4"
      style={
        {
          "--brand-pink": "#FF6AA8",
          "--brand-purple": "#7B42F5",
          "--brand-orange": "#FF9E68",
          "--text-primary": "#111827",
          "--text-secondary": "#586174",
          "--text-tertiary": "#8B95A7",
        } as React.CSSProperties
      }
    >
      <style>{`
        .login-glass {
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(255, 255, 255, 0.82);
          box-shadow: 0 10px 32px rgba(240, 160, 190, 0.09), 0 3px 10px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255, 255, 255, 0.52);
        }
        .login-glass-dark {
          background: rgba(255, 255, 255, 0.52);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.76);
          box-shadow: 0 10px 32px rgba(240, 160, 190, 0.08), 0 3px 10px rgba(0,0,0,0.03);
        }
        .login-soft-panel {
          border: 1px solid rgba(255, 236, 243, 0.95);
          background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,249,252,0.92));
          box-shadow: 0 10px 32px rgba(240, 160, 190, 0.09), 0 3px 10px rgba(0,0,0,0.03);
        }
        .login-input-shell {
          transition: all 0.22s ease-out;
          background: #fff8fb;
          border-color: rgba(246, 191, 213, 0.9);
        }
        .login-input-shell:hover {
          border-color: rgba(255, 106, 168, 0.26);
          background: rgba(255,255,255,0.98);
        }
        .login-input-shell:focus-within {
          border-color: rgba(255, 106, 168, 0.52);
          box-shadow: inset 0 0 0 1px rgba(255, 106, 168, 0.14), 0 0 0 5px rgba(255, 106, 168, 0.09), 0 12px 24px rgba(255, 156, 190, 0.10);
          transform: translateY(-1px);
          background: rgba(255,255,255,0.98);
        }
        .login-primary-button {
          transition: all 0.22s ease-out;
          position: relative;
          overflow: hidden;
        }
        .login-primary-button:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 22px 40px rgba(251, 114, 153, 0.28);
        }
        .login-primary-button:active {
          transform: translateY(1px) scale(0.98);
          filter: brightness(0.98);
        }
        .login-primary-button::before {
          content: "";
          position: absolute;
          left: 10%;
          right: 10%;
          top: 1px;
          height: 46%;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255,255,255,0.42), rgba(255,255,255,0));
          pointer-events: none;
        }
        .login-scanlines::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: linear-gradient(to bottom, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 7px);
          opacity: 0.08;
          pointer-events: none;
        }
        div[class*="space-y-2"][class*="overflow-y-auto"],
        div[class*="space-y-2"][class*="overflow-y-scroll"] {
          overflow-y: scroll;
          scrollbar-width: thin;
          scrollbar-color: #fb7299 #fff1f6;
        }
        div[class*="space-y-2"][class*="overflow-y-auto"]::-webkit-scrollbar,
        div[class*="space-y-2"][class*="overflow-y-scroll"]::-webkit-scrollbar {
          width: 8px;
        }
        div[class*="space-y-2"][class*="overflow-y-auto"]::-webkit-scrollbar-track,
        div[class*="space-y-2"][class*="overflow-y-scroll"]::-webkit-scrollbar-track {
          border-radius: 999px;
          background: #fff1f6;
        }
        div[class*="space-y-2"][class*="overflow-y-auto"]::-webkit-scrollbar-thumb,
        div[class*="space-y-2"][class*="overflow-y-scroll"]::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(251, 114, 153, 0.62);
        }
        @keyframes loginAuroraDrift {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.62; }
          50% { transform: translate3d(24px, -18px, 0) scale(1.08); opacity: 0.9; }
        }
        @keyframes loginHeroRise {
          0% { opacity: 0; transform: translate3d(0, 26px, 0) scale(0.98); filter: blur(10px); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); filter: blur(0); }
        }
        @keyframes loginSpotlightSweep {
          0% { transform: translate3d(-120%, 0, 0) rotate(0deg); opacity: 0; }
          18% { opacity: 0.16; }
          50% { opacity: 0.3; }
          100% { transform: translate3d(180%, 0, 0) rotate(8deg); opacity: 0; }
        }
        @keyframes loginEnergyStream {
          0% { transform: translate3d(-110%, 0, 0) scaleX(0.92); opacity: 0; }
          20% { opacity: 0.24; }
          50% { opacity: 0.5; }
          100% { transform: translate3d(130%, 0, 0) scaleX(1.08); opacity: 0; }
        }
        @keyframes loginBrandPulse {
          0%, 100% { opacity: 0.05; transform: scale(1); }
          50% { opacity: 0.1; transform: scale(1.02); }
        }
        @keyframes loginRibbonFloat {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -10px, 0); }
        }
        @keyframes loginParticleFloat {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.18; }
          50% { transform: translate3d(0, -18px, 0) scale(1.08); opacity: 0.34; }
        }
        @keyframes loginPosterGlow {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.75; }
          50% { transform: translate3d(0, -12px, 0) scale(1.08); opacity: 1; }
        }
        @keyframes loginPosterCardFloatA {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-3deg); }
          50% { transform: translate3d(-6px, -10px, 0) rotate(-5deg); }
        }
        @keyframes loginPosterCardFloatB {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(4deg); }
          50% { transform: translate3d(8px, -12px, 0) rotate(6deg); }
        }
        @keyframes loginPosterSweep {
          0% { transform: translateX(-140%) skewX(-18deg); opacity: 0; }
          18% { opacity: 0.5; }
          50% { opacity: 0.78; }
          100% { transform: translateX(220%) skewX(-18deg); opacity: 0; }
        }
        @keyframes loginPosterPulse {
          0%, 100% { opacity: 0.42; transform: translate3d(-50%, 0, 0) scale(0.98); }
          50% { opacity: 0.72; transform: translate3d(-50%, -4px, 0) scale(1.03); }
        }
      `}</style>
      {loginTutorBubbleOpen ? (
        <div className="fixed bottom-20 right-5 z-[80] w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-[24px] border border-[#ffd5e2] bg-white/96 shadow-[0_24px_70px_rgba(15,23,42,0.18)] backdrop-blur-xl xl:hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#f3e2e9] px-4 py-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#fb7299]">AI Tutor</div>
              <div className="text-sm font-black text-[#111827]">入口页小助手</div>
            </div>
            <button
              type="button"
              onClick={() => setLoginTutorBubbleOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#eef2f6] bg-white text-sm font-black text-[#667085] shadow-sm"
              aria-label="关闭入口页小助手"
            >
              ×
            </button>
          </div>
          <div ref={loginTutorMessagesRef} className="max-h-[260px] space-y-2 overflow-y-scroll px-4 py-3 [scrollbar-color:#fb7299_#fff1f6] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#fb7299]/60 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-[#fff1f6]">
            {loginTutorMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[88%] rounded-[18px] px-3 py-2 text-sm leading-5 ${
                  message.role === "user"
                    ? "ml-auto bg-[#fb7299] text-white"
                    : "bg-[#fff5f8] text-[#344054]"
                }`}
              >
                {message.content}
              </div>
            ))}
          </div>
          <form onSubmit={handleLoginTutorSubmit} className="flex gap-2 border-t border-[#f3e2e9] p-3">
            <input
              value={loginTutorInput}
              onChange={(event) => setLoginTutorInput(event.target.value)}
              placeholder="问登录、资源、课堂怎么用..."
              className="min-w-0 flex-1 rounded-full border border-[#eef2f6] bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-[#111827] outline-none focus:border-[#fb7299]"
            />
            <button
              type="submit"
              className="rounded-full bg-[#111827] px-4 py-2 text-sm font-black text-white shadow-[0_10px_22px_rgba(15,23,42,0.16)]"
            >
              发送
            </button>
          </form>
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(255,133,172,0.10),transparent_22%),linear-gradient(135deg,#fff9fb_0%,#fff6f9_52%,#fffafc_100%)]" />
        <div className="absolute left-[-4%] top-[10%] h-72 w-72 rounded-full ui-ui-bg-brand/10 blur-3xl" style={{ animation: "loginAuroraDrift 14s ease-in-out infinite" }} />
        <div className="absolute right-[-10%] bottom-[6%] h-96 w-96 rounded-full bg-[#ffb86b]/8 blur-3xl" style={{ animation: "loginAuroraDrift 16s ease-in-out infinite reverse" }} />
      </div>

      <div className={`relative z-10 mx-auto grid h-[calc(100vh-1.5rem)] w-full max-w-[1520px] overflow-hidden rounded-[32px] border border-white/80 bg-white/76 shadow-[0_10px_32px_rgba(240,160,190,0.09),0_3px_10px_rgba(0,0,0,0.03)] backdrop-blur-2xl transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] md:h-[calc(100vh-2rem)] lg:grid-cols-[minmax(0,1.24fr)_minmax(380px,0.76fr)] ${
        introReady ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}>
        <section className="relative hidden overflow-hidden border-r border-[#f5dbe5] bg-[linear-gradient(145deg,rgba(255,251,252,0.92)_0%,rgba(255,247,250,0.92)_52%,rgba(255,250,252,0.94)_100%)] px-8 py-6 text-[#1f2937] lg:flex lg:flex-col xl:px-9 xl:py-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,114,153,0.10),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.42),rgba(255,255,255,0.08))]" />
          <div className="absolute inset-x-0 top-0 h-px bg-white/70" />
          <div className="absolute left-[10%] top-[12%] h-40 w-40 rounded-full ui-ui-bg-brand/10 blur-3xl" style={{ animation: "loginPosterGlow 9s ease-in-out infinite" }} />
          <div className="absolute bottom-[12%] left-[34%] h-56 w-56 rounded-full bg-[#fbcfe8]/16 blur-3xl" style={{ animation: "loginPosterGlow 11s ease-in-out infinite" }} />

          <div className="relative flex h-full flex-col">
            <div className={`flex items-start justify-between gap-6 transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              introReady ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`} style={{ animation: introReady ? "loginHeroRise 900ms cubic-bezier(0.22,1,0.36,1)" : undefined }}>
              <div className="max-w-[680px]">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/85 bg-white/76 px-3 py-1 text-[10px] font-black uppercase ui-ui-tracking-tight ui-text-secondary shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  {BRAND_NAME}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-end gap-1 leading-none">
                    <span className="text-[56px] font-black tracking-[-0.08em] text-[#1f2937] xl:text-[64px]">Bili</span>
                    <span className="bg-[linear-gradient(135deg,#ff8cb0_0%,#ffb47a_48%,#ff9a7c_100%)] bg-clip-text text-[56px] font-black tracking-[-0.08em] text-transparent xl:text-[64px]">
                      Learn
                    </span>
                  </div>
                  <div className="rounded-full border border-white/85 bg-white/76 px-2.5 py-1 text-[10px] font-black uppercase ui-ui-tracking-brand text-[#f08aaa] shadow-sm backdrop-blur-sm">
                    AI Learning OS
                  </div>
                </div>
                <div className="mt-2 text-[10px] font-black uppercase tracking-[0.26em] text-[#b7a9b3]">
                  Personalized Learning Runtime
                </div>
                <h1 className="mt-2 max-w-[560px] text-[38px] font-black leading-[0.95] tracking-[-0.07em] text-[#1f2937] xl:text-[44px]">
                  <span>{heroTitleLeft}</span>
                  <span className="ml-3 bg-[linear-gradient(135deg,#ff8cb0_0%,#ffb47a_42%,#81c9ff_100%)] bg-clip-text text-transparent">
                    {heroTitleRight}
                  </span>
                </h1>
                <p className="mt-2 max-w-[500px] text-[14px] leading-6 text-[#c6b8c1]">
                  {heroCopy}
                </p>
              </div>
            </div>

            <div
              className={`login-scanlines relative mt-2 flex-1 overflow-hidden rounded-[36px] border border-white/70 bg-[linear-gradient(145deg,rgba(255,250,252,0.92)_0%,rgba(249,245,251,0.92)_42%,rgba(244,248,252,0.92)_100%)] p-5 shadow-[0_36px_100px_rgba(15,23,42,0.10)] transition-all duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] lg:overflow-visible ${
                introReady ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-10 scale-[0.96]"
              }`}
              onMouseMove={handlePosterParallaxMove}
              onMouseLeave={resetPosterParallax}
            >
              <div
                className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(251,114,153,0.14),transparent_20%),radial-gradient(circle_at_82%_18%,rgba(125,211,252,0.12),transparent_24%),radial-gradient(circle_at_55%_86%,rgba(255,255,255,0.45),transparent_30%)] transition-transform duration-300 ease-out"
                style={{ transform: `translate3d(${posterParallax.x * -0.35}px, ${posterParallax.y * -0.35}px, 0)` }}
              />
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                  <div className="select-none text-[150px] font-black uppercase tracking-[-0.08em] text-[#111827]/[0.05]" style={{ animation: "loginBrandPulse 7s ease-in-out infinite" }}>
                    {BRAND_NAME}
                  </div>
                </div>
              <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px)] [background-size:42px_42px]" />
              <div
                className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.34)_28%,transparent_48%,transparent_100%)] transition-transform duration-300 ease-out"
                style={{ transform: `translate3d(${posterParallax.x * 0.18}px, ${posterParallax.y * 0.12}px, 0)` }}
              />
              <div
                className="absolute inset-y-0 left-[-18%] w-[32%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)]"
                style={{ animation: "loginPosterSweep 8.5s ease-in-out infinite", transform: `translate3d(${posterParallax.x * 0.2}px, 0, 0)` }}
              />
              <div className="absolute inset-y-0 left-[-28%] w-[36%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.10),transparent)]" style={{ animation: "loginSpotlightSweep 6.8s ease-in-out infinite 0.8s" }} />
              <div className="absolute left-[62%] top-[8%] z-20 flex w-[252px] -translate-x-1/2 flex-col items-center justify-start gap-2 xl:left-[61%] xl:top-[7%] xl:w-[286px] xl:gap-3">
                <div
                  className={`ml-12 w-[126px] transition-all duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] xl:ml-16 xl:w-[142px] ${
                    introReady ? "opacity-95 translate-x-0 translate-y-0 rotate-0" : "opacity-0 translate-x-20 -translate-y-10 rotate-12"
                  }`}
                >
                  <div
                    className="overflow-hidden rounded-[32px] border border-white/80 bg-white/68 shadow-[0_24px_52px_rgba(15,23,42,0.12)] backdrop-blur-md transition-transform duration-300 ease-out"
                    style={{
                      animation: "loginPosterCardFloatA 10s ease-in-out infinite",
                      transform: `translate3d(${posterParallax.x * -0.12}px, ${posterParallax.y * -0.08}px, 0) rotate(-6deg) scale(0.9)`,
                    }}
                  >
                    <img src={assetHaibaraAcademic} alt="灰原哀" className="h-[148px] w-full object-cover object-top grayscale-[0.03] xl:h-[166px]" decoding="async" referrerPolicy="no-referrer" />
                    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.96))] p-4 ui-ui-text-ink">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] ui-text-subtle">Research Copilot</div>
                      <div className="mt-1 text-[20px] font-black tracking-[-0.05em]">灰原哀</div>
                    </div>
                  </div>
                </div>

                <div
                  className={`w-[198px] transition-all duration-[1500ms] ease-[cubic-bezier(0.22,1,0.36,1)] xl:w-[224px] ${
                    introReady ? "opacity-100 translate-x-0 translate-y-0 rotate-0" : "opacity-0 translate-x-28 translate-y-20 rotate-12"
                  }`}
                >
                  <div
                    className="overflow-hidden rounded-[42px] border border-white/75 bg-white/52 shadow-[0_34px_78px_rgba(15,23,42,0.12)] backdrop-blur-md transition-transform duration-300 ease-out"
                    style={{
                      animation: "loginPosterCardFloatB 11s ease-in-out infinite",
                      transform: `translate3d(${posterParallax.x * 0.18}px, ${posterParallax.y * -0.14}px, 0) rotate(2deg)`,
                    }}
                  >
                    <img src={assetUsagiStudy} alt="乌萨奇" className="h-[236px] w-full object-cover object-center xl:h-[268px]" decoding="async" referrerPolicy="no-referrer" />
                    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.96))] p-5 ui-ui-text-ink">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] ui-text-subtle">Energy Partner</div>
                      <div className="mt-1 text-[28px] font-black tracking-[-0.06em] xl:text-[30px]">乌萨奇</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <div className="rounded-full border border-[#e6d9e3] bg-white/72 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#6b7280] backdrop-blur-sm">
                      {BRAND_NAME} Stage
                    </div>
                    <div className="mt-3 max-w-[390px] text-[30px] font-black leading-[0.98] tracking-[-0.06em] ui-ui-text-ink xl:text-[34px]">
                      让智能体协作网络
                      <span className="block text-[#8b95a7]">协同推进你的学习闭环</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <div className="rounded-full border border-white/70 bg-white/72 px-3 py-1 text-[10px] font-black uppercase ui-ui-tracking-tight ui-text-secondary shadow-sm" style={{ animation: "loginRibbonFloat 8s ease-in-out infinite" }}>
                        AI Tutor Runtime
                      </div>
                      <div className="rounded-full border border-white/70 bg-white/72 px-3 py-1 text-[10px] font-black uppercase ui-ui-tracking-tight ui-text-secondary shadow-sm" style={{ animation: "loginRibbonFloat 8s ease-in-out infinite 0.5s" }}>
                        Personal Learning Graph
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative mt-3 min-h-[340px] flex-1 overflow-visible xl:min-h-[370px]">
                  <div className="absolute left-[62%] top-[10%] h-[430px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.55)_0%,rgba(251,114,153,0.10)_42%,rgba(125,211,252,0.08)_66%,transparent_78%)] blur-3xl" />
                  <div className="absolute left-[60%] top-[45%] h-[2px] w-[460px] -translate-x-1/2 overflow-hidden rounded-full bg-[#cbd5e1]/40">
                    <div className="h-full w-[58%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.8),rgba(251,114,153,0.45),rgba(125,211,252,0.40),transparent)]" style={{ animation: "loginEnergyStream 5.6s ease-in-out infinite" }} />
                  </div>
                  <div className="absolute left-[60%] top-[42%] h-24 w-24 -translate-x-1/2 rounded-full border border-white/70 bg-white/45 shadow-[0_0_40px_rgba(255,255,255,0.35)] backdrop-blur-sm" />

                  <div className="absolute right-[-2%] top-[-78%] z-[30] hidden w-[310px] xl:block xl:w-[330px]">
                    <button
                      type="button"
                      onClick={handleOpenLoginTutor}
                      className="group relative block w-full overflow-visible text-left"
                      aria-label="点击 3D 模型咨询系统相关问题"
                      title="点击 3D 模型咨询系统相关问题"
                    >
                      <span className="absolute right-8 top-2 z-20 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/82 px-3 py-1.5 text-[10px] font-black text-[#fb7299] shadow-[0_10px_24px_rgba(251,114,153,0.14)] backdrop-blur-sm transition group-hover:-translate-y-0.5">
                        <MessageCircleMore className="h-3.5 w-3.5" />
                        点我问系统
                      </span>
                      <span className="absolute left-3 top-[76px] z-20 inline-flex items-center gap-1.5 rounded-full border border-[#ffd5e2] bg-white/94 px-3 py-1.5 text-[10px] font-black text-[#fb7299] shadow-[0_10px_24px_rgba(251,114,153,0.12)] backdrop-blur-sm">
                        <MessageCircleMore className="h-3 w-3" />
                        问我
                      </span>
                      <span className="absolute inset-x-4 top-8 h-[360px] rounded-[48px] bg-[radial-gradient(circle_at_50%_20%,rgba(251,114,153,0.12),transparent_40%),radial-gradient(circle_at_70%_18%,rgba(125,211,252,0.10),transparent_30%)] blur-2xl" />
                      <LoginModelBoundary fallback={<LoginModelFallback />}>
                        <StudyAssistant3D
                          className="relative z-10 h-[500px] w-full -translate-y-2"
                          minHeightClassName="min-h-[500px]"
                          minRenderWidth={310}
                          minRenderHeight={500}
                          modelYOffset={0.78}
                          modelScale={2.72}
                        />
                      </LoginModelBoundary>
                    </button>
                    {loginTutorBubbleOpen ? (
                      <div className="absolute right-[calc(100%+16px)] top-[118px] z-[80] w-[min(360px,calc(100vw-2rem))] max-w-[360px] overflow-hidden rounded-[24px] border border-[#ffd5e2] bg-white/96 text-left shadow-[0_24px_70px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                        <div className="flex items-center justify-between gap-3 border-b border-[#f3e2e9] px-4 py-3">
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#fb7299]">AI Tutor</div>
                            <div className="text-sm font-black text-[#111827]">入口页小助手</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLoginTutorBubbleOpen(false)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#eef2f6] bg-white text-sm font-black text-[#667085] shadow-sm"
                            aria-label="关闭入口页小助手"
                          >
                            ×
                          </button>
                        </div>
                        <div className="max-h-[min(340px,calc(100vh-250px))] space-y-2 overflow-y-auto px-4 py-3">
                          {loginTutorMessages.map((message, index) => (
                            <div
                              key={`${message.role}-${index}`}
                              className={`max-w-[88%] rounded-[18px] px-3 py-2 text-sm leading-5 ${
                                message.role === "user"
                                  ? "ml-auto bg-[#fb7299] text-white"
                                  : "bg-[#fff5f8] text-[#344054]"
                              }`}
                            >
                              {message.content}
                            </div>
                          ))}
                        </div>
                        <form onSubmit={handleLoginTutorSubmit} className="flex gap-2 border-t border-[#f3e2e9] p-3">
                          <input
                            value={loginTutorInput}
                            onChange={(event) => setLoginTutorInput(event.target.value)}
                            placeholder="问登录、资源、课堂怎么用..."
                            className="min-w-0 flex-1 rounded-full border border-[#eef2f6] bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-[#111827] outline-none focus:border-[#fb7299]"
                          />
                          <button
                            type="submit"
                            className="rounded-full bg-[#111827] px-4 py-2 text-sm font-black text-white shadow-[0_10px_22px_rgba(15,23,42,0.16)]"
                          >
                            发送
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>

                  <div
                    className="absolute left-0 top-[7%] z-[5] w-[258px] rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,255,255,0.56))] p-3 shadow-[0_28px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl transition-transform duration-300 ease-out xl:w-[282px]"
                    style={{ transform: `translate3d(${posterParallax.x * 0.18}px, ${posterParallax.y * 0.12}px, 0)` }}
                  >
                    <div className="absolute inset-x-5 top-0 h-[2px] rounded-full bg-[linear-gradient(90deg,rgba(251,114,153,0),rgba(251,114,153,0.9),rgba(125,211,252,0.8),rgba(251,114,153,0))]" />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#94a3b8]">Loop Orchestrator</div>
                        <div className="mt-1 text-[18px] font-black tracking-[-0.05em] text-[#111827]">学习闭环编排中枢</div>
                  <div className="mt-1 text-[11px] leading-5 text-[#667085]">登录后会自动接管岗位能力诊断、测评、规划与资源生成，把你的下一步动作直接串起来。</div>
                      </div>
                      <div className="rounded-full border border-white/80 bg-[#111827] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)]">
                        LIVE
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {LOGIN_POSTER_METRICS.map((item) => (
                        <div key={item.label} className="rounded-2xl border border-white/80 bg-white/72 px-3 py-2.5 shadow-sm">
                          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94a3b8]">{item.label}</div>
                          <div className="mt-1 text-[18px] font-black tracking-[-0.06em] text-[#111827]">{item.value}</div>
                          <div className="mt-1 text-[10px] font-semibold text-[#7c8a9a]">{item.note}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 rounded-[24px] border border-white/78 bg-white/62 p-2.5 shadow-sm">
                      <div className="flex items-center justify-between gap-2 px-1 pb-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#94a3b8]">Core Agent Chain</div>
                        <div className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
                          4 Nodes Online
                        </div>
                      </div>
                      <div className="space-y-2">
                        {LOGIN_LOOP_STEPS.map((step, index) => (
                          <div key={step.label} className="flex items-center gap-3 rounded-2xl border border-white/74 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(248,251,255,0.72))] px-3 py-2.5 shadow-sm">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#fb7185,#7dd3fc)] text-[10px] font-black text-white shadow-[0_8px_18px_rgba(251,113,133,0.20)]">
                              {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="text-[12px] font-black text-[#111827]">{step.label}</div>
                                <span className="rounded-full bg-[#f3f8fb] px-2 py-0.5 text-[9px] font-black text-[#54738a]">{step.status}</span>
                              </div>
                              <div className="truncate text-[10px] text-[#667085]">{step.detail}</div>
                            </div>
                            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.95)]" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="absolute left-0 top-[34%] rounded-full border border-white/80 bg-white/76 px-4 py-2 text-[11px] font-black uppercase ui-ui-tracking-brand ui-text-secondary backdrop-blur-sm">
                    {BRAND_NAME} Entry
                  </div>
                  <div
                    className="absolute left-[60%] top-[10%] h-[390px] w-[2px] -translate-x-1/2 bg-[linear-gradient(180deg,rgba(203,213,225,0.0),rgba(203,213,225,0.55),rgba(203,213,225,0.0))] transition-transform duration-300 ease-out"
                    style={{ transform: `translate3d(calc(-50% + ${posterParallax.x * 0.08}px), ${posterParallax.y * -0.2}px, 0)` }}
                  />
                  <div
                    className="absolute left-[60%] top-[40%] h-60 w-60 -translate-x-1/2 rounded-full bg-white/40 blur-3xl transition-transform duration-300 ease-out"
                    style={{
                      animation: "loginPosterPulse 6.5s ease-in-out infinite",
                      transform: `translate3d(calc(-50% + ${posterParallax.x * 0.22}px), ${posterParallax.y * 0.18}px, 0)`,
                    }}
                  />
                </div>

                <div className="mt-3 flex items-end justify-end gap-2 text-[11px] font-bold ui-text-secondary">
                  <div className="flex flex-wrap justify-end gap-2">
                    {LOGIN_POSTER_TAGS.map((tag) => (
                      <div key={tag} className="rounded-full border border-white/80 bg-white/72 px-3 py-1.5 text-center shadow-sm">
                        {tag}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`relative overflow-hidden border-b border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(255,248,251,0.74)_42%,rgba(244,250,255,0.82)_100%)] p-5 transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
          introReady ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,114,153,0.14),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(125,211,252,0.16),transparent_30%)]" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-[11px] font-black uppercase ui-ui-tracking-tight ui-ui-text-brand shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  {BRAND_NAME}
                </div>
                <h1 className="mt-4 text-[30px] font-black leading-[0.96] tracking-[-0.08em] ui-ui-text-ink">
                  {BRAND_NAME}
                  <span className="block bg-[linear-gradient(135deg,#fb7299_0%,#ff8f6b_46%,#57b9ff_100%)] bg-clip-text text-transparent">
                    进入智能学习闭环
                  </span>
                </h1>
                <p className="mt-3 max-w-[360px] text-[13px] leading-6 text-[#5b6472]">
                          动态岗位学情识别学习状态，多智能体协同完成测评、规划、资源生成、答疑与复习提醒。
                </p>
              </div>
              <div className="ui-ui-radius-20 border border-white/80 bg-white/72 px-3 py-2 text-right shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-sm">
                <div className="text-[10px] font-black uppercase ui-ui-tracking-brand text-[#94a3b8]">brand entry</div>
                <div className="mt-1 text-xs font-black text-[#111827]">biliLearn</div>
              </div>
            </div>

            <div className="relative mt-5 overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,250,252,0.94),rgba(249,245,251,0.92)_42%,rgba(244,248,252,0.90)_100%)] p-4 shadow-[0_20px_48px_rgba(15,23,42,0.10)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(251,114,153,0.12),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(125,211,252,0.10),transparent_24%),radial-gradient(circle_at_50%_88%,rgba(255,255,255,0.45),transparent_28%)]" />
              <div className="relative">
                <button
                  type="button"
                  onClick={handleOpenLoginTutor}
                  className="absolute right-0 top-0 z-20 inline-flex items-center gap-1.5 rounded-full border border-[#ffd5e2] bg-white/94 px-3 py-1.5 text-[10px] font-black text-[#fb7299] shadow-[0_10px_24px_rgba(251,114,153,0.12)] backdrop-blur-sm"
                >
                  <MessageCircleMore className="h-3 w-3" />
                  问我
                </button>
                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-full border border-white/80 bg-white/76 px-3 py-1.5 text-[10px] font-black uppercase ui-ui-tracking-brand ui-text-secondary backdrop-blur-sm">
                    {BRAND_NAME} Stage
                  </div>
                  <div className="rounded-full border border-white/80 bg-white/76 px-3 py-1.5 text-[10px] font-black uppercase ui-ui-tracking-brand ui-text-secondary backdrop-blur-sm">
                    Multi-Agent Online
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenLoginTutor}
                  className="relative mt-4 block w-full overflow-hidden rounded-[26px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,250,252,0.88))] text-left shadow-[0_14px_36px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#fb7299]/15"
                  aria-label="点击 3D 模型打开入口页小助手"
                >
                  <LoginModelBoundary fallback={<LoginModelFallback compact />}>
                    <StudyAssistant3D
                      className="h-[300px] w-full -translate-y-8"
                      minHeightClassName="min-h-[300px]"
                      minRenderWidth={280}
                      minRenderHeight={300}
                      modelYOffset={1.4}
                      modelScale={2.65}
                    />
                  </LoginModelBoundary>
                </button>

                <div className="mt-4 text-[20px] font-black leading-tight tracking-[-0.05em] ui-ui-text-ink">
                    从岗位能力诊断到资源生成，一次进入完整学习闭环
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="relative overflow-hidden ui-ui-radius-24 border border-white/80 bg-white/62 shadow-sm">
                    <img src={assetHaibaraAcademic} alt="灰原哀" className="h-[220px] w-full object-cover object-top" decoding="async" referrerPolicy="no-referrer" />
                    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.96))] p-3 ui-ui-text-ink">
                      <div className="text-[10px] font-black uppercase ui-ui-tracking-brand ui-text-subtle">Research Copilot</div>
                      <div className="mt-1 text-base font-black">灰原哀</div>
                    </div>
                  </div>
                  <div className="relative overflow-hidden ui-ui-radius-24 border border-white/80 bg-white/62 shadow-sm">
                    <img src={assetUsagiStudy} alt="乌萨奇" className="h-[220px] w-full object-cover object-top" decoding="async" referrerPolicy="no-referrer" />
                    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.96))] p-3 ui-ui-text-ink">
                      <div className="text-[10px] font-black uppercase ui-ui-tracking-brand ui-text-subtle">Energy Partner</div>
                      <div className="mt-1 text-base font-black">乌萨奇</div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold ui-text-secondary">
                  {LOGIN_POSTER_TAGS.map((tag) => (
                    <div key={tag} className="rounded-full border border-white/80 bg-white/76 px-3 py-1.5 shadow-sm">
                      {tag}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`relative flex items-start justify-center overflow-hidden bg-[linear-gradient(180deg,#fcfcfd_0%,#fafbfc_42%,#f8fafc_100%)] px-5 py-2 transition-all duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-6 lg:px-8 ${
          introReady ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"
        }`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.05),transparent_34%)]" />

          <div className="relative z-10 mx-auto w-full max-w-[460px] pt-0">
            <div className="rounded-[26px] border border-[#e7ecf2] bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.98))] p-3.5 shadow-[0_24px_64px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#e8eef5] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#475467]">
                    <Sparkles className="h-3.5 w-3.5" />
                    {BRAND_NAME}
                  </div>
                  <h2 className="mt-2 text-[22px] font-black tracking-[-0.08em] ui-ui-text-ink sm:text-[26px]">
                    {loginTitle}
                  </h2>
                  <p className="mt-1 max-w-[340px] text-[11px] leading-5 ui-text-secondary">
                    {loginCopy}
                  </p>
                </div>
              </div>

               <div className="mt-2.5 ui-ui-radius-20 border border-[#eef2f6] bg-white p-3 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase ui-ui-tracking-brand ui-text-subtle">Account Access</div>
                    <div className="mt-0.5 text-[13px] font-black text-[#111827]">
                      {recognizedAccount ? "继续当前账号或切换" : "选择账号进入"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDemoAccounts((value) => !value)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#eaecf0] bg-[#f8fafc] px-3 py-1 text-[11px] font-bold text-[#475467] transition-all duration-200 hover:border-[#d0d5dd] hover:bg-white hover:shadow-sm"
                    >
                      <span>{showDemoAccounts ? "收起其他账号" : "切换账号"}</span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDemoAccounts ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>

                <div className="mt-2 overflow-hidden ui-ui-radius-18 border border-[#eaecf0] bg-[#fcfcfd] shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center gap-3 px-3 py-2">
                    <div className="relative shrink-0">
                      <div className="h-8.5 w-8.5 overflow-hidden rounded-xl border border-white/80 bg-[#f3f6fb] shadow-sm">
                        <img
                          src={selectedProfile?.avatar || recognizedProfile?.avatar || assetHaibaraAcademic}
                          alt={selectedProfile?.name || recognizedAccount || "账号头像"}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className={`absolute bottom-[-2px] right-[-2px] h-3 w-3 rounded-full border-2 border-white ${hasPersistentSession ? "bg-emerald-500" : "bg-amber-400"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-[13px] font-black ui-ui-text-ink">
                          {selectedProfile?.name || recognizedProfile?.name || "选择一个账号"}
                        </div>
                        {hasPersistentSession ? (
                          <span className="rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#027a48]">
                            当前设备
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate text-[10px] ui-text-secondary">
                        {studentId || recognizedAccount || "先从下方账号列表中选择，也可以手动输入"}
                      </div>
                    </div>
                    {!useManualAccountInput && (recognizedAccount || studentId) ? (
                      <button
                        type="button"
                        onClick={handleQuickContinue}
                        disabled={quickLoginLoading || !(recognizedAccount || studentId)}
                        className="shrink-0 rounded-full border border-[#111827] bg-[#111827] px-3 py-1 text-[10px] font-black text-white shadow-[0_8px_18px_rgba(15,23,42,0.14)]"
                      >
                        {quickLoginLoading ? "进入中..." : "继续"}
                      </button>
                    ) : null}
                  </div>

                  {showDemoAccounts ? (
                     <div className="grid gap-2 p-2">
                      {accountOptions.map((account) => {
                        const active = (studentId || recognizedAccount) === account.id;
                        return (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => handleSelectAccount(account.id)}
                            className={`flex items-center gap-3 ui-ui-radius-18 border px-3 py-2.5 text-left transition-all duration-200 ${
                              active
                                ? "border-[#d0d5dd] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.07)]"
                                : "border-[#eaecf0] bg-[#f8fafc] hover:-translate-y-0.5 hover:border-[#d0d5dd] hover:bg-white hover:shadow-[0_14px_30px_rgba(15,23,42,0.06)]"
                            }`}
                          >
                             <div className="h-10 w-10 overflow-hidden rounded-2xl border border-white bg-[#f3f6fb] shadow-sm">
                              <img src={account.avatar} alt={account.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13px] font-black ui-ui-text-ink">{account.name}</div>
                              <div className="mt-0.5 text-[11px] ui-text-secondary">{account.subtitle}</div>
                            </div>
                            {active ? (
                              <span className="rounded-full bg-[#111827] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                                已选择
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

              </div>

               {error ? (
                 <div className="mt-2.5 ui-ui-radius-18 border border-red-200 bg-red-50/90 px-3 py-2 text-sm font-bold text-red-700">
                  登录提示：{error}
                </div>
              ) : null}

              <form onSubmit={handleLoginSubmit} className="mt-2.5 space-y-2.5 ui-ui-radius-20 border border-[#eef2f6] bg-white p-3 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase ui-ui-tracking-brand ui-text-subtle">Login Form</div>
                    <div className="mt-0.5 text-[13px] font-black text-[#111827]">账号密码登录</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseManualAccountInput((value) => !value)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                      useManualAccountInput ? "bg-[#111827] text-white" : "bg-[#f8fafc] text-[#475467] border border-[#eaecf0]"
                    }`}
                  >
                    {useManualAccountInput ? "账号切换模式" : "使用当前账号"}
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="login-input-shell relative ui-ui-radius-12 border ui-border-soft-rose bg-[#fff8fb]">
                    <Mail className={`absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 transition-colors ${studentId ? "ui-ui-text-brand" : "text-slate-400"}`} />
                    <input
                      id="login-id-input"
                      type="text"
                      value={studentId}
                      onChange={(e) => {
                        setStudentId(e.target.value);
                        setUseManualAccountInput(true);
                        if (activePreset !== "typing") setActivePreset("typing");
                      }}
                      onFocus={() => setActivePreset("idFocus")}
                      onBlur={() => setActivePreset("default")}
                      placeholder={accountMode === "register" ? "创建学号 / 邮箱账号" : "请输入学号 / 邮箱账号"}
                        className="h-10.5 w-full ui-ui-radius-12 bg-transparent pl-12 pr-4 text-sm font-semibold text-slate-800 outline-hidden"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <a
                      href="#reset"
                      className="ml-auto text-[11px] font-black ui-ui-text-brand transition-colors hover:text-[#f45184]"
                      onClick={(e) => {
                        e.preventDefault();
                        setHaibaraText("如忘记学习口令，请联系教务老师或当前管理员重置。");
                        setUsagiText("别急，我们先把口令找回来，再继续学习冲刺！");
                      }}
                    >
                      忘记密码？
                    </a>
                  </div>
                  <div className="login-input-shell ui-radius-12 border-soft-rose relative border bg-[#fff8fb]">
                    <Lock className={`absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 transition-colors ${password ? "ui-text-brand" : "text-slate-400"}`} />
                    <input
                      id="login-password-input"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setUseManualAccountInput(true);
                        if (activePreset !== "typing") setActivePreset("typing");
                      }}
                      onFocus={() => setActivePreset("pwdFocus")}
                      onBlur={() => setActivePreset("default")}
                      placeholder={accountMode === "register" ? "设置学习口令" : "请输入密码"}
                        className="ui-radius-12 h-10.5 w-full bg-transparent pl-12 pr-4 text-sm font-semibold text-slate-800 outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-slate-500">
                    <input
                      id="login-remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4.5 w-4.5 rounded-[6px] border ui-border-soft-rose accent-[#fb7299]"
                    />
                    <span>记住我的账号</span>
                  </label>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                    verified
                  </span>
                </div>

                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="login-primary-button flex h-10.5 w-full items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(135deg,#fb7299,#ff8f6b)] px-4 text-sm font-black text-white shadow-[0_18px_36px_rgba(251,114,153,0.24)] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  {loading ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Sparkles className="h-4.5 w-4.5" />
                      <span>{accountMode === "register" ? "创建并进入 BiliLearn" : "进入 BiliLearn 学习空间"}</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-1.5 text-center text-[12px] leading-5 text-slate-500">
                <button
                  type="button"
                  className="font-black ui-ui-text-brand hover:text-[#f45184]"
                  onClick={handleCreateAccount}
                >
                  创建新账号
                </button>
              </div>
            </div>

            <div className="relative mt-4 overflow-hidden rounded-[28px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,247,251,0.92),rgba(255,255,255,0.96)_45%,rgba(239,248,255,0.9))] p-4 shadow-[0_26px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <div className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-[#7dd3fc]/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 left-6 h-36 w-36 rounded-full bg-[#fb7185]/18 blur-3xl" />
              <div className="relative flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#94a3b8]">Learning Loop Preview</div>
                  <div className="mt-1 text-[18px] font-black tracking-[-0.06em] text-[#111827]">
                    多智能体正在接力学习闭环
                  </div>
                </div>
                <div className="rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#fb7185] shadow-sm">
                  Live
                </div>
              </div>

              <div className="relative mt-4">
                <div className="absolute left-4 right-4 top-4 h-px bg-[linear-gradient(90deg,rgba(251,113,133,0.12),rgba(125,211,252,0.7),rgba(251,113,133,0.12))]" />
                <div className="grid grid-cols-5 gap-2">
                  {LOGIN_LOOP_STEPS.map((step, index) => (
                    <div key={step.label} className="relative min-w-0">
                      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-white bg-white text-[11px] font-black text-[#111827] shadow-[0_10px_22px_rgba(15,23,42,0.08)]">
                        {index + 1}
                      </div>
                      <div className="mt-2 rounded-2xl border border-white/80 bg-white/68 px-2 py-2 text-center shadow-sm">
                        <div className="text-[11px] font-black text-[#111827]">{step.label}</div>
                        <div className="mt-1 line-clamp-2 text-[9px] leading-4 text-[#667085]">{step.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-white/80 bg-white/70 px-3 py-2 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Today</div>
                        <div className="mt-1 text-sm font-black text-[#111827]">岗位学情已同步</div>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/70 px-3 py-2 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Next</div>
                  <div className="mt-1 text-sm font-black text-[#111827]">优先补齐薄弱点</div>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/70 px-3 py-2 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Ready</div>
                  <div className="mt-1 text-sm font-black text-[#111827]">资源生成可继续</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
