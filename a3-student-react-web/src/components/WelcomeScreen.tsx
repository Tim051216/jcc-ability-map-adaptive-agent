/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Zap,
  Terminal,
  BookmarkCheck,
  Shield,
  Activity,
  UserCheck,
  Volume2,
  Atom,
  Flame,
  Binary,
  Layers,
  Award
} from "lucide-react";

import assetAnimeClassroom from "../assets/images/anime_perfect_dual_1779718037085.webp";
import assetHaibaraAcademic from "../assets/images/haibara_academic_1779716437995.webp";
import assetUsagiStudy from "../assets/images/usagi_perfect_1779717893221.webp";

interface WelcomeScreenProps {
  onDismiss: () => void;
}

export default function WelcomeScreen({ onDismiss }: WelcomeScreenProps) {
  const [systemLoaded, setSystemLoaded] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [connectionPulse, setConnectionPulse] = useState(99.4);
  const [academicEnergy, setAcademicEnergy] = useState(120);
  const [activeSpeech, setActiveSpeech] = useState<"both" | "haibara" | "usagi">("both");
  const [pokeCount, setPokeCount] = useState(0);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Play satisfying UI futuristic synthesizer sound waves
  const playSfx = (type: "beep" | "swipe" | "energy" | "laser" | "victory") => {
    if (!soundEnabled || !audioUnlocked) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      if (ctx.state === "suspended") {
        void ctx.resume();
      }
      const now = ctx.currentTime;

      if (type === "beep") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === "swipe") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.start(now);
        osc.stop(now + 0.33);
      } else if (type === "energy") {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc1.type = "sawtooth";
        osc1.frequency.setValueAtTime(220, now);
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.4);
        
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(440, now);
        osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.4);

        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.43);
        osc2.stop(now + 0.43);
      } else if (type === "laser") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.25);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        osc.start(now);
        osc.stop(now + 0.27);
      } else if (type === "victory") {
        // Melodic sequence of happy notes
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.05, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.26);
        });
      }
    } catch (e) {
      // Audio support restrictions
    }
  };

  // Simulating live syncing metrics
  useEffect(() => {
    setSystemLoaded(true);

    const interval = setInterval(() => {
      setConnectionPulse((prev) => {
        const d = (Math.random() * 0.4 - 0.2);
        return Math.min(Math.max(parseFloat((prev + d).toFixed(2)), 98.5), 99.99);
      });
      setAcademicEnergy((prev) => {
        const d = Math.floor(Math.random() * 6 - 3);
        return Math.min(Math.max(prev + d, 100), 150);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unlockAudio = () => {
      setAudioUnlocked(true);
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  const [particles, setParticles] = useState<{ x: number; y: number; s: number; symbol: string; delay: number }[]>([]);
  useEffect(() => {
    const syms = ["√", "⚛", "sinθ", "λ", "H(x)", "Δ", "memo", "dx", "Σ", "★", "🔬", "🐰", "APTX-4869", "Yaha!", "Bili", "React", "D3"];
    const pts = Array.from({ length: 18 }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      s: Math.random() * 12 + 10,
      symbol: syms[Math.floor(Math.random() * syms.length)],
      delay: Math.random() * 2
    }));
    setParticles(pts);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center bg-pink-50/60 p-4 md:p-6 overflow-hidden select-none">
      
      {/* 1. Backdrop Ambient blur container */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <img
          src={assetAnimeClassroom}
          alt="Classroom Classroom Backdrop"
          className="w-full h-full object-cover scale-105 filter blur-xs brightness-[0.95] opacity-55"
          decoding="async"
          fetchPriority="high"
          referrerPolicy="no-referrer"
        />
        
        {/* Glow lasers in background */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-pink-200/40 rounded-full filter blur-[120px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-purple-200/40 rounded-full filter blur-[120px] pointer-events-none animate-pulse" />
        
        {/* Holographic tech grid layer */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(244,114,182,0.15)_1px,transparent_1px)] [background-size:20px_20px] opacity-80" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-pink-50/90 via-white/80 to-white/90" />
      </div>

      {/* 2. Floating Mathematics Greek formulas and atoms particles */}
      <AnimatePresence>
        {particles.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: [0.4, 0.8, 0.4],
              y: [0, -30, 0],
              x: [0, Math.random() * 20 - 10, 0]
            }}
            transition={{
              duration: 8 + i * 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: p.delay
            }}
            className="absolute font-mono text-pink-600/30 font-extrabold select-none pointer-events-none"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              fontSize: `${p.s}px`
            }}
          >
            {p.symbol}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* 3. Main Glassmorphic HUD Core Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="pointer-events-auto relative z-10 w-full max-w-5xl bg-white/94 backdrop-blur-md border-4 border-white rounded-[36px] overflow-hidden shadow-[0px_25px_70px_-15px_rgba(251,114,153,0.35)] flex flex-col justify-between max-h-[92vh]"
      >
        {/* Tech decorative HUD line overlays */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-pink-400 via-[#fb7299] to-purple-500 animate-gradient-x" />
        <div className="absolute top-4 left-6 flex items-center gap-2 text-[9px] font-mono text-slate-500/80 tracking-widest uppercase">
          <Terminal className="w-3.5 h-3.5 text-[#fb7299] animate-spin" />
          <span>岗课赛智能体 · 软件开发岗位能力工作台</span>
        </div>

        {/* Audio control button */}
        <button
          onClick={() => {
            setSoundEnabled(!soundEnabled);
            if (!soundEnabled) {
              setTimeout(() => playSfx("beep"), 50);
            }
          }}
          className="absolute top-4 right-6 p-2 bg-pink-50 hover:bg-pink-100 transition-all text-pink-600 hover:text-pink-700 rounded-lg border border-pink-200/50 flex items-center gap-1.5 text-xs font-black cursor-pointer"
        >
          <Volume2 className={`w-3.5 h-3.5 ${soundEnabled ? "text-pink-500 animate-bounce" : "text-slate-400"}`} />
          <span className="font-mono text-[10px]">{soundEnabled ? "SOUND: ON" : "SOUND: MUTED"}</span>
        </button>

        {/* HUD Top Accent Lights */}
        <div className="px-6 md:px-10 pt-12 pb-5 text-center space-y-3.5">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, type: "spring" }}
            className="ui-text-brand inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-[10px] font-extrabold tracking-wider shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#fb7299] animate-pulse" />
            <span>BILIBILI UNIVERSAL CO-RESEARCH TERMINAL</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
          </motion.div>

          <div className="space-y-1.5">
            <motion.h1
              initial={{ letterSpacing: "1px" }}
              animate={{ letterSpacing: "3px" }}
              className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 tracking-wider flex items-center justify-center gap-3 drop-shadow-sm"
            >
              岗课赛双生智慧主脑舱
            </motion.h1>
            <p className="text-slate-700 text-xs md:text-sm font-semibold max-w-xl mx-auto leading-relaxed">
              融合 <span className="text-pink-600 font-extrabold">灰原哀 (Ai Haibara)</span> 的冷静逻辑计算，与 <span className="text-amber-600 font-extrabold">乌萨奇 (Usagi Perfect)</span> 的无敌应援动力。双核驱策，引燃你的考研与程序研学潜能！
            </p>
          </div>
        </div>

        {/* 4. Core Duo Anime interactive portrait displays */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 md:px-10 py-2 flex-grow overflow-y-auto max-h-[50vh] scrollbar-thin scrollbar-thumb-slate-200">
          
          {/* Character Side: Ai Haibara */}
          <motion.div
            whileHover={{ scale: 1.015 }}
            onClick={() => {
              playSfx("laser");
              setActiveSpeech("haibara");
              setPokeCount(p => p + 1);
            }}
            className={`group cursor-pointer border-3 rounded-2xl p-5 transition-all duration-300 flex flex-col justify-between relative overflow-hidden flex-grow ${
              activeSpeech === "haibara" 
                ? "bg-purple-50/90 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.15)]" 
                : "bg-white/80 border-slate-200 hover:border-purple-300/80"
            }`}
          >
            {/* High-end cyber matrix grid decorations */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="absolute -bottom-2 -left-2 text-[28px] font-black text-purple-100/45 ui-tracking-tighter uppercase font-mono select-none">
              REVIEWER 01
            </div>

            <div className="flex gap-4 items-center mb-3">
              <div className="w-16 h-16 rounded-xl border-2 border-purple-400 overflow-hidden bg-purple-50 shrink-0 relative shadow-md">
                <img
                  src={assetHaibaraAcademic}
                  alt="灰原哀"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 text-sm font-black">灰原 哀 (Ai Haibara)</span>
                  <span className="bg-purple-600 text-white text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase">
                    Core Mentor
                  </span>
                </div>
                <p className="text-purple-700/80 text-[10px] font-mono mt-1 flex items-center gap-1 font-bold">
                  <Atom className="w-3 h-3 text-purple-500 animate-spin" />
                  <span>计算状态: 极限冷肃算法推演</span>
                </p>
              </div>
            </div>

            <div className="bg-purple-50/50 rounded-xl p-3 border border-purple-200/60 relative min-h-[70px]">
              <span className="absolute -top-2 left-2 bg-purple-600 text-white text-[8px] px-1 py-0.2 rounded font-black">
                🧪 灰原哀 · 批判意志
              </span>
              <p className="text-[11.5px] leading-relaxed text-purple-950 pt-0.5 font-medium">
                “ 哼，连接链路终于稳定下来了……不要用你粗糙的探针随意试探。准备好进行物理坐标、神经网络和 Fiber 重构了吗？别指望我会替你遮掩丝毫漏洞。 ”
              </p>
            </div>
            
            <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-purple-600/70 pt-2 border-t border-purple-100">
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-purple-500" />
                <span>计算占用率: 45%</span>
              </span>
              <span className="hover:text-purple-700 font-bold">ACTIVATE STABILIZATION 🧬</span>
            </div>
          </motion.div>

          {/* Character Side: Usagi Perfect */}
          <motion.div
            whileHover={{ scale: 1.015 }}
            onClick={() => {
              playSfx("victory");
              setActiveSpeech("usagi");
              setPokeCount(p => p + 1);
            }}
            className={`group cursor-pointer border-3 rounded-2xl p-5 transition-all duration-300 flex flex-col justify-between relative overflow-hidden flex-grow ${
              activeSpeech === "usagi" 
                ? "bg-amber-50/90 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]" 
                : "bg-white/80 border-slate-200 hover:border-amber-300/80"
            }`}
          >
            {/* High-end cyber matrix grid decorations */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="absolute -bottom-2 -left-2 text-[28px] font-black text-amber-100/40 ui-tracking-tighter uppercase font-mono select-none">
              YAHA ENERGY 02
            </div>

            <div className="flex gap-4 items-center mb-3">
              <div className="w-16 h-16 rounded-xl border-2 border-amber-400 overflow-hidden bg-amber-5 shrink-0 relative shadow-md">
                <img
                  src={assetUsagiStudy}
                  alt="乌萨奇"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 text-sm font-black">乌萨奇 (Usagi Study)</span>
                  <span className="bg-amber-500 text-slate-900 text-[8px] font-black px-1.5 py-0.2 rounded uppercase">
                    Yaha Supporter
                  </span>
                </div>
                <p className="text-amber-700/80 text-[10px] font-mono mt-1 flex items-center gap-1 font-bold">
                  <Flame className="w-3 h-3 text-amber-500 animate-pulse" />
                  <span>应援状态: 元气爆缸，魔法狂飙</span>
                </p>
              </div>
            </div>

            <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-200/60 relative min-h-[70px]">
              <span className="absolute -top-2 left-2 bg-amber-500 text-slate-900 text-[8px] px-1 py-0.2 rounded font-black">
                🐰 乌萨奇 · 应援爆发
              </span>
              <p className="text-[11.5px] leading-relaxed text-amber-950 pt-0.5 font-medium">
                “ 呀哈——！！！呜啦，啵噜哼！！！（翻译：呜呼呼！超级学术应援贴纸已粘贴成功！现在立刻向 React 渲染大魔王和 D3 clamping 难关发起最狂暴的冲击吧！！！) ”
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-amber-700/70 pt-2 border-t border-amber-100">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-500" />
                <span>研学充能: {academicEnergy}%</span>
              </span>
              <span className="hover:text-amber-800 font-bold font-mono">LAUNCH EXPLOSION ☄️</span>
            </div>
          </motion.div>

        </div>

        {/* 5. Bottom System Stats and Main Enter Gate Button */}
        <div className="px-6 md:px-10 pb-10 pt-4 bg-slate-50/90 border-t border-pink-100/80 flex flex-col md:flex-row items-center justify-between gap-6 z-10">
          
          {/* Bento stats panel info */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-mono select-none">
            
            <div className="bg-white border border-slate-100 shadow-xs rounded-xl px-3 py-1.5 text-center min-w-[100px]">
              <p className="text-[8px] text-pink-600 font-bold tracking-wider">HARMONIC RATE</p>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <span className="text-[11px] font-extrabold text-slate-800">{connectionPulse}%</span>
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
              </div>
            </div>

            <div className="bg-white border border-slate-100 shadow-xs rounded-xl px-3 py-1.5 text-center min-w-[100px]">
              <p className="text-[8px] text-purple-600 font-bold tracking-wider">ENERGY CORES</p>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <span className="text-[11px] font-extrabold text-slate-800">Active (2/2)</span>
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              </div>
            </div>

            <div className="bg-white border border-slate-100 shadow-xs rounded-xl px-3 py-1.5 text-center min-w-[100px]">
              <p className="text-[8px] text-amber-600 font-bold tracking-wider">TOUCH REVERBS</p>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <span className="text-[11px] font-extrabold text-slate-800">{pokeCount} pokes</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              </div>
            </div>

          </div>

          {/* Primary entry action */}
          <div className="relative group w-full md:w-auto">
            <button
              onClick={() => {
                sessionStorage.setItem("hasSeenWelcome", "true");
                playSfx("swipe");
                setTimeout(() => {
                  onDismiss();
                }, 500);
              }}
              className="w-full rounded-2xl border border-pink-200 bg-white px-8 py-4 text-sm font-black text-[#fb7299] transition-all duration-300 hover:border-pink-300 hover:bg-pink-50 md:w-auto"
            >
              <span>进入岗课赛智能体</span>
            </button>
          </div>

        </div>

        {/* System safety certificate */}
        <div className="absolute bottom-1 right-6 text-[8px] font-mono text-slate-400 pointer-events-none tracking-widest leading-none">
          Co-Research Neural Network Verified Protocol ACTIVE
        </div>
      </motion.div>
    </div>
  );
}
