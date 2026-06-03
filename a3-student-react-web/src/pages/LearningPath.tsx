/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Award,
  ChevronRight,
  PlayCircle,
  FileText,
  Lock,
  MessageSquare,
  Compass,
  ArrowLeft,
  Mail,
  UserCheck,
  CheckCircle2,
  GitBranch,
  FolderDown,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { LEARNING_PATHS, COURSES } from "../constants";

export default function LearningPath() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = searchParams.get("courseId") || "series-2"; // default to series-2 "Advanced React Patterns"

  // Load the matched course from our records
  const course = COURSES.find((c) => c.id === courseId) || COURSES[0];

  // Local state to simulate checklist completion of path steps
  const [phases, setPhases] = useState(LEARNING_PATHS);

  const toggleStepCompleted = (phaseIdx: number, stepIdx: number) => {
    setPhases((prevPhases) => {
      const copy = JSON.parse(JSON.stringify(prevPhases));
      const step = copy[phaseIdx].steps[stepIdx];
      if (step.status === "locked") return prevPhases; // Guard locked

      const currentVal = step.completed;
      step.completed = !currentVal;

      // Recalculate phase progress ratio automatically
      const totalSteps = copy[phaseIdx].steps.length;
      const completedSteps = copy[phaseIdx].steps.filter((s: any) => s.completed).length;
      copy[phaseIdx].progress = Math.round((completedSteps / totalSteps) * 100);

      return copy;
    });
  };

  const currentActiveStep = phases[1].steps[0]; // Building useFetch as sample active

  let categoryZh = "通用研学航道";
  if (course.category === "Design" || course.category === "Programming") categoryZh = "数字艺术重构航道";
  if (course.category === "Data") categoryZh = "数据智能与可视化航道";

  let courseTitleZh = course.title;
  if (course.title.includes("Advanced Machine Learning")) courseTitleZh = "前沿机器学习实战：极深反向传播与梯度策略";
  if (course.title.includes("Modern React Architecture")) courseTitleZh = "现代化 React 架构：极致组件虚拟化与 Context 多维切片";
  if (course.title.includes("Creative Front-End CSS Physics")) courseTitleZh = "创意前端物理动效：三维流体粒子系统与贝塞尔重力刚体";

  return (
    <div className="space-y-6 select-none" id="learning-path-workspace">
      
      {/* Back button and Roadmap selectors */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => navigate(-1)}
          className="text-xs font-semibold text-[#564145] hover:text-[#fb7299] flex items-center gap-1 cursor-pointer animate-in fade-in transition-all self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          返回视频课堂
        </button>

        {/* Horizontal course roadmap selector tree */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[11px] font-bold text-[#564145]/80 mr-1.5 shrink-0">研学航道快速切换:</span>
          {COURSES.map((c) => {
            const isActive = c.id === courseId;
            let label = "设计路线";
            if (c.id === "series-1") label = "系统架构";
            if (c.id === "series-2") label = "React性能";
            if (c.id === "series-3") label = "前端物理动效";
            if (c.id === "course-4") label = "D3.js数据图";

            return (
              <button
                key={c.id}
                onClick={() => navigate(`/path?courseId=${c.id}`)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-[#fb7299] text-white shadow-xs"
                    : "bg-white hover:bg-slate-50 text-[#564145] border border-[#E3E8EC]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Header Hero Banner: Progress & Summary Details */}
      <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 lg:p-8 flex flex-col lg:flex-row justify-between gap-6 relative overflow-hidden shadow-sm">
        <div className="space-y-4 max-w-2xl">
          <div className="flex flex-wrap gap-2">
            <span className="bg-[#fb7299]/10 text-[#fb7299] text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              {categoryZh}
            </span>
            <span className="bg-[#006689]/10 text-[#006689] text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              第 {courseId === "series-2" ? "3" : "1"} 周学修
            </span>
          </div>

          <h1 className="font-sans text-2xl lg:text-3xl font-extrabold text-[#171c22] leading-tight">
            学业成长路线图：{courseTitleZh}
          </h1>
          <p className="text-xs lg:text-sm text-[#564145] leading-relaxed font-sans opacity-95">
            掌握构建高性能、零算力浪费的大吞吐量组件和重构模型时，所必需拥有的深度思维模型、严谨代码细节及沙箱复原机制。
          </p>

          {/* Progress fill */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#171c22]">
              <span>本课题里程碑研学总路线进度</span>
              <span className="text-[#fb7299] text-sm">已攻破 {course.progress}%</span>
            </div>
            <div className="w-full h-2 bg-[#eaeef6] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#fb7299] rounded-full transition-all duration-500"
                style={{ width: `${course.progress}%` }}
              />
            </div>
            <p className="text-[10px] text-[#564145]/70">
              全盘 20 关卡指标已顺利推通至 13 个关卡，继续保持高昂的研究姿态！
            </p>
          </div>
        </div>

        {/* Call-to-action cards right side inside course hero */}
        <div className="lg:w-80 shrink-0 flex flex-col gap-3 justify-center">
          <button
            onClick={() => navigate(`/learn?courseId=${course.id}`)}
            className="w-full bg-[#fb7299] hover:bg-[#fb7299]/90 text-white font-bold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-transform hover:scale-[1.01] cursor-pointer"
          >
            <PlayCircle className="w-5 h-5 fill-white stroke-none" />
            继续攻破当前微课章节
          </button>
          
          <div className="p-4 bg-[#f0f4fc] rounded-2xl border border-blue-50 text-xs text-[#00516e] flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-[#006689] shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="font-bold">打卡冲刺特权已激活！</p>
              <p className="opacity-95 text-[10.5px]">本周你在沙箱评测中的代码完美过关率成功超越了 90% 的在线学友。</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Double-column Roadmap flow & Mentor block */}
      <div className="flex flex-col lg:flex-row gap-6 w-full">
        
        {/* Left main: Paths steps milestone checklists */}
        <div className="flex-grow bg-white rounded-3xl border border-[#E3E8EC] p-6 lg:p-8 shadow-sm space-y-8">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="font-sans text-lg font-extrabold text-[#171c22]">
              多维度里程碑研学闯关树
            </h2>
          </div>

          <div className="space-y-8 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-100">
            {phases.map((phase, pIdx) => {
              let phaseTitleZh = phase.phaseTitle;
              if (phase.phaseTitle.includes("Phase 1")) phaseTitleZh = "第一阶段：React 内置 Hooks 底层生命周期机制";
              if (phase.phaseTitle.includes("Phase 2")) phaseTitleZh = "第二阶段：自定义 Custom Hooks 高度纯原子逻辑抽离";
              if (phase.phaseTitle.includes("Phase 3")) phaseTitleZh = "第三阶段：大吞吐级组件性能级联调用优化策略";

              return (
                <div key={pIdx} className="space-y-4">
                  
                  {/* Phase Title tag heading */}
                  <div className="flex items-center justify-between pl-10 relative">
                    {/* Circle milestone indicator */}
                    <div className={`absolute left-2.5 w-[20px] h-[20px] rounded-full border-4 bg-white z-10 -translate-x-1/2 ${
                      phase.progress === 100 ? "border-emerald-500" : phase.progress > 0 ? "border-[#fb7299]" : "border-slate-300"
                    }`} />
                    <div>
                      <h3 className="font-sans text-sm font-extrabold text-[#171c22]">{phaseTitleZh}</h3>
                      <p className="text-[10px] text-[#564145]/75 mt-0.5 font-mono">本段关卡进度已克难：{phase.progress}%</p>
                    </div>
                  </div>

                  {/* Phase Steps lists */}
                  <div className="space-y-3 pl-10">
                    {phase.steps.map((step, sIdx) => {
                      const isLocked = step.status === "locked";
                      const isCurrent = step.status === "current";

                      let titleZh = step.title;
                      if (step.title.includes("Understanding useEffect")) titleZh = "完全攻克子组件 useEffect 生态生命周期";
                      if (step.title.includes("Building useFetch")) titleZh = "手写鲁棒的 custom useFetch Hook 核心实例";
                      if (step.title.includes("State Machines")) titleZh = "引入 XState 正规有限状态机接管复杂路由";

                      let subtitleZh = step.subtitle;
                      if (step.subtitle.includes("useEffect Lifecycle")) subtitleZh = "系统分析依赖项浅比较算法机制，攻克竞态并建立防抖、安全清理范式。";
                      if (step.subtitle.includes("robust custom hook")) subtitleZh = "开发能承受高重绘的高端 Hook、内聚 Loading 模组与局部切片。";
                      if (step.subtitle.includes("XState")) subtitleZh = "（解锁提示）需首要通过前置关卡。解锁手写 useFetch 来替代常规的布尔判断。";

                      let typeZh = "随堂精炼";
                      if (step.type === "video") typeZh = "微课随堂";
                      if (step.type === "reading") typeZh = "文献精读";
                      if (step.type === "quiz") typeZh = "理论自测";

                      return (
                        <div
                          key={step.id}
                          className={`p-4 rounded-2xl border transition-all relative ${
                            isLocked 
                              ? "bg-gray-50/50 border-gray-100 opacity-60" 
                              : isCurrent
                              ? "bg-gradient-to-r from-[#fb7299]/5 to-transparent border-[#fb7299]/50 shadow-sm shadow-[#fb7299]/5"
                              : "bg-white border-[#E3E8EC] hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-start gap-4 justify-between">
                            <div className="flex items-start gap-3">
                              {/* Interactive task checkbox selector */}
                              <button
                                disabled={isLocked}
                                onClick={() => toggleStepCompleted(pIdx, sIdx)}
                                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all cursor-pointer ${
                                  step.completed 
                                    ? "bg-emerald-500 border-emerald-500 text-white" 
                                    : isLocked
                                    ? "border-gray-300 bg-gray-100"
                                    : "border-gray-400 hover:border-[#fb7299]"
                                }`}
                              >
                                {step.completed && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3px]" />}
                              </button>

                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className={`text-sm font-extrabold truncate ${step.completed ? "line-through text-[#564145]/60" : "text-[#171c22]"}`}>
                                    {titleZh}
                                  </h4>
                                  {isCurrent && (
                                    <span className="bg-[#fb7299] text-white text-[9px] font-bold px-2 py-0.2 rounded font-mono uppercase tracking-wider animate-pulse shrink-0">
                                      锁定冲刺点
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#564145] leading-relaxed font-sans">{subtitleZh}</p>
                                
                                <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-[#564145]/70">
                                  <span className="bg-[#eaeef6] text-[#564145] px-1.5 py-0.2 rounded font-sans text-[9px] font-semibold tracking-wide">
                                    {typeZh}
                                  </span>
                                  <span>研学耗时约 {step.duration}</span>
                                  {step.date && <span>• 安排: {step.date === "Day 1" ? "第 一 日" : "今 日"}</span>}
                                </div>
                              </div>
                            </div>

                            {/* Quick video launch for active steps */}
                            {!isLocked && (
                              <button
                                onClick={() => navigate(`/learn?courseId=${course.id}`)}
                                className="text-xs font-semibold text-[#006689] flex items-center hover:underline shrink-0 gap-0.5"
                                title="前往随堂系统"
                              >
                                <PlayCircle className="w-4 h-4" />
                                <span className="hidden sm:inline">直通课堂</span>
                              </button>
                            )}
                            {isLocked && <Lock className="w-4 h-4 text-slate-400 shrink-0" />}

                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })}
          </div>
        </div>

        {/* Right side: Mentor index bio & relative shortcuts */}
        <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
          
          {/* A1. Mentor bio Card */}
          <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm flex flex-col gap-4 text-center">
            <h3 className="font-sans text-xs font-extrabold tracking-wider uppercase text-[#564145] text-left border-b border-gray-50 pb-2">
              本随堂金课学术主持
            </h3>

            <div className="flex flex-col items-center pt-2">
              <div className="w-18 h-18 rounded-full overflow-hidden border-2 border-[#fb7299] relative">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&fit=crop&q=80"
                  alt="陈学长"
                  className="w-full h-full object-cover"
                />
              </div>
              <h4 className="font-sans text-base font-bold text-[#171c22] mt-3">陈学长</h4>
              <p className="text-xs text-[#564145] font-sans">前沿系统重构委员会 • 大厂资深系统架构师</p>
            </div>

            <p className="text-xs text-[#564145] font-sans leading-relaxed text-center opacity-90 px-2 mt-1">
              “这条学习路径会同时被学习画像智能体、学习规划智能体和测评反馈智能体持续校准。当你需要深入解难时，知识检索与答疑智能体也会随时接入。”
            </p>

            <button
              onClick={() => {
                const queryText = `请让知识检索与答疑智能体结合我在《${courseTitleZh}》中的学习路径进度和测评反馈，帮我解析关于 Custom Hook 性能优解的学术问题。`;
                navigate(`/tutor?courseId=${course.id}&query=${encodeURIComponent(queryText)}`);
              }}
              className="w-full bg-[#f0f4fc] hover:bg-[#fb7299]/10 text-[#fb7299] hover:text-[#fb7299] font-bold text-xs py-2.5 rounded-xl border border-[#fb7299]/20 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Mail className="w-4 h-4 shrink-0" />
              向导师发起在线学术提问
            </button>
          </section>

          {/* A2. Quick Resource Files repository linkings */}
          <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm flex flex-col gap-4">
            <h3 className="font-sans text-xs font-extrabold tracking-wider uppercase text-[#171c22] border-b border-gray-50 pb-2">
              随堂高频学术文献直通车
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate(`/resources?courseId=${course.id}`)}
                className="bg-slate-50 hover:bg-slate-100 p-3 rounded-xl flex flex-col items-center justify-center text-center transition-colors border border-gray-100 cursor-pointer"
              >
                <FileText className="w-6 h-6 text-[#fb7299] mb-1.5" />
                <span className="text-[11px] font-bold text-[#171c22]">文献幻灯片</span>
              </button>

              <button
                onClick={() => window.open("https://github.com", "_blank")}
                className="bg-slate-50 hover:bg-slate-100 p-3 rounded-xl flex flex-col items-center justify-center text-center transition-colors border border-gray-100 cursor-pointer"
              >
                <GitBranch className="w-6 h-6 text-[#006689] mb-1.5" />
                <span className="text-[11px] font-bold text-[#171c22]">开源代码夹</span>
              </button>

              <button
                onClick={() => navigate(`/learn?courseId=${course.id}`)}
                className="bg-slate-50 hover:bg-slate-100 p-3 rounded-xl flex flex-col items-center justify-center text-center transition-colors border border-gray-100 cursor-pointer"
              >
                <MessageSquare className="w-6 h-6 text-amber-600 mb-1.5" />
                <span className="text-[11px] font-bold text-[#171c22]">研学答疑室</span>
              </button>

              <button
                onClick={() => navigate(`/resources?courseId=${course.id}`)}
                className="bg-slate-50 hover:bg-slate-100 p-3 rounded-xl flex flex-col items-center justify-center text-center transition-colors border border-gray-100 cursor-pointer"
              >
                <FolderDown className="w-6 h-6 text-emerald-600 mb-1.5" />
                <span className="text-[11px] font-bold text-[#171c22]">大作业安装包</span>
              </button>
            </div>
          </section>

        </aside>
      </div>

    </div>
  );
}
