/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Star,
  Tv,
  MessageSquare,
  Compass,
  ArrowRight,
  Radar,
  Award,
  BookOpen,
  Target,
  ListRestart,
  UserCircle,
  Bot
} from "lucide-react";
import { COURSES, RECENT_ACTIVITIES, METRIC_SCORE } from "../constants";

interface OverviewProps {
  user?: {
    id: string;
    name: string;
    avatar: string;
    loggedIn: boolean;
  };
}

type DanmakuTemplate = {
  id: string;
  text: string;
  color: string;
  sizeClassName: string;
  fontWeightClassName?: string;
  time: number;
};

type ActiveDanmaku = DanmakuTemplate & {
  lane: number;
  top: string;
  duration: number;
  width: number;
};

const HERO_DANMAKU_TIMELINE: DanmakuTemplate[] = [
  { id: "dan-1", text: "前排前排 🍿", color: "#ffffff", sizeClassName: "text-sm", fontWeightClassName: "font-semibold", time: 0.8 },
  { id: "dan-2", text: "这节课的案例拆得好细", color: "#fb7299", sizeClassName: "text-base", fontWeightClassName: "font-bold", time: 2.2 },
  { id: "dan-3", text: "请教下 Context 怎么优化性能啊？", color: "#00a1d6", sizeClassName: "text-lg", fontWeightClassName: "font-bold", time: 4.6 },
  { id: "dan-4", text: "打卡第15天！", color: "#ff8fab", sizeClassName: "text-base", fontWeightClassName: "font-bold", time: 6.4 },
  { id: "dan-5", text: "原来 useRef 是这么一回事", color: "#ffffff", sizeClassName: "text-sm", time: 8.6 },
  { id: "dan-6", text: "这个交互重构思路很像真实项目", color: "#ffd166", sizeClassName: "text-sm", fontWeightClassName: "font-semibold", time: 10.5 },
  { id: "dan-7", text: "BiliBot 的答疑真的有点东西", color: "#00FFC2", sizeClassName: "text-sm", fontWeightClassName: "font-semibold", time: 12.9 },
  { id: "dan-8", text: "100% completed!", color: "#ffffff", sizeClassName: "text-base", fontWeightClassName: "font-bold", time: 15.4 },
  { id: "dan-9", text: "老师讲到渲染链路这里突然听懂了", color: "#ffffff", sizeClassName: "text-sm", time: 18.2 },
  { id: "dan-10", text: "这个例子太像我前几天改的需求了", color: "#fb7299", sizeClassName: "text-sm", fontWeightClassName: "font-semibold", time: 21.1 },
  { id: "dan-11", text: "React 19 compiler is so fast", color: "#00FFC2", sizeClassName: "text-sm", fontWeightClassName: "font-semibold", time: 24.4 },
  { id: "dan-12", text: "后面的等等我", color: "#ffffff", sizeClassName: "text-xs", time: 27.6 },
];

const DANMAKU_LANES = ["8%", "16%", "24%", "32%", "40%"];
const DANMAKU_BASE_DURATION = 8.8;
const DANMAKU_SPEED_PX_PER_SECOND = 136;
const DANMAKU_GAP_PX = 124;
const DANMAKU_SEEK_LOOKAHEAD_SECONDS = 0.45;

export default function Overview({ user }: OverviewProps = {}) {
  const navigate = useNavigate();
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const [videoMuted, setVideoMuted] = useState(true);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [danmakuEnabled, setDanmakuEnabled] = useState(true);
  const [radarExpanded, setRadarExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeDanmakus, setActiveDanmakus] = useState<ActiveDanmaku[]>([]);
  const capabilityMetrics = useMemo(
    () => [
      { label: "代码逻辑力", value: 88, tone: "from-[#7c3aed] to-[#5b7cff]", note: "结构拆解" },
      { label: "理论储备", value: 82, tone: "from-[#06b6d4] to-[#3b82f6]", note: "概念沉淀" },
      { label: "交互美感", value: 76, tone: "from-[#fb7185] to-[#f97316]", note: "界面表达" },
      { label: "沙箱调试", value: 91, tone: "from-[#14b8a6] to-[#10b981]", note: "定位修正" },
      { label: "专注抗压", value: 79, tone: "from-[#f59e0b] to-[#eab308]", note: "稳定推进" },
    ],
    [],
  );
  const nextDanmakuIndexRef = useRef(0);
  const laneAvailableAtRef = useRef<number[]>(new Array(DANMAKU_LANES.length).fill(0));
  const activeDanmakusRef = useRef<ActiveDanmaku[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    // Auto clear previous schedules if any
    const id = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Filter out series that have watching watch ratio (progress > 0)
  const ongoingSeries = COURSES.filter(c => c.progress > 0);

  useEffect(() => {
    activeDanmakusRef.current = activeDanmakus;
  }, [activeDanmakus]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRadarExpanded(true);
    }, 180);
    return () => window.clearTimeout(timer);
  }, []);

  const resolvedHeroLanes = DANMAKU_LANES;

  const resetDanmakuTimeline = () => {
    nextDanmakuIndexRef.current = 0;
    laneAvailableAtRef.current = new Array(resolvedHeroLanes.length).fill(0);
    setActiveDanmakus([]);
  };

  const pickDanmakuLane = (currentTime: number) => {
    const laneIndex = laneAvailableAtRef.current.findIndex((availableAt) => availableAt <= currentTime);
    return laneIndex === -1 ? 0 : laneIndex;
  };

  const spawnDanmaku = (item: DanmakuTemplate) => {
    const lane = pickDanmakuLane(item.time);
    const width = Math.max(88, item.text.length * 16 + 24);
    const duration = Math.max(DANMAKU_BASE_DURATION, width / DANMAKU_SPEED_PX_PER_SECOND + 7.2);
    laneAvailableAtRef.current[lane] = item.time + Math.min(duration * 0.42, 4.6) + DANMAKU_GAP_PX / DANMAKU_SPEED_PX_PER_SECOND;

    const activeItem: ActiveDanmaku = {
      ...item,
      lane,
      top: resolvedHeroLanes[lane],
      duration,
      width,
    };

    setActiveDanmakus((prev) => [...prev, activeItem]);
  };

  const handleVideoTimeUpdate = () => {
    const video = heroVideoRef.current;
    if (!video || !danmakuEnabled) return;

    const currentTime = video.currentTime;

    while (
      nextDanmakuIndexRef.current < HERO_DANMAKU_TIMELINE.length &&
      HERO_DANMAKU_TIMELINE[nextDanmakuIndexRef.current].time <= currentTime + 0.15
    ) {
      spawnDanmaku(HERO_DANMAKU_TIMELINE[nextDanmakuIndexRef.current]);
      nextDanmakuIndexRef.current += 1;
    }
  };

  const handleDanmakuComplete = (id: string) => {
    setActiveDanmakus((prev) => prev.filter((item) => item.id !== id));
  };

  const emitDanmakuAroundCurrentTime = (currentTime: number) => {
    const startIndex = HERO_DANMAKU_TIMELINE.findIndex((item) => item.time >= Math.max(0, currentTime - 0.12));
    if (startIndex === -1) {
      return;
    }

    let pointer = startIndex;
    while (
      pointer < HERO_DANMAKU_TIMELINE.length &&
      HERO_DANMAKU_TIMELINE[pointer].time <= currentTime + DANMAKU_SEEK_LOOKAHEAD_SECONDS
    ) {
      spawnDanmaku(HERO_DANMAKU_TIMELINE[pointer]);
      pointer += 1;
    }
  };

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;

    const handleSeeking = () => {
      const currentTime = video.currentTime;
      nextDanmakuIndexRef.current = HERO_DANMAKU_TIMELINE.findIndex((item) => item.time >= currentTime);
      if (nextDanmakuIndexRef.current === -1) {
        nextDanmakuIndexRef.current = HERO_DANMAKU_TIMELINE.length;
      }

      laneAvailableAtRef.current = new Array(resolvedHeroLanes.length).fill(currentTime);
      setActiveDanmakus([]);
      window.setTimeout(() => {
        emitDanmakuAroundCurrentTime(currentTime);
      }, 0);
    };

    const handleEnded = () => {
      resetDanmakuTimeline();
    };

    const handlePlay = () => setVideoPlaying(true);
    const handlePause = () => setVideoPlaying(false);

    video.addEventListener("seeking", handleSeeking);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [danmakuEnabled, resolvedHeroLanes]);

  useEffect(() => {
    if (!danmakuEnabled) {
      setActiveDanmakus([]);
      return;
    }

    if (videoPlaying) {
      handleVideoTimeUpdate();
    }
  }, [danmakuEnabled, videoPlaying]);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;

    const handleLoop = () => {
      if (video.currentTime < 0.35) {
        resetDanmakuTimeline();
      }
    };

    video.addEventListener("timeupdate", handleLoop);
    return () => video.removeEventListener("timeupdate", handleLoop);
  }, []);

  useEffect(() => {
    laneAvailableAtRef.current = new Array(resolvedHeroLanes.length).fill(heroVideoRef.current?.currentTime || 0);
    setActiveDanmakus([]);
    if (danmakuEnabled && videoPlaying) {
      window.setTimeout(() => {
        handleVideoTimeUpdate();
      }, 0);
    }
  }, [danmakuEnabled, resolvedHeroLanes, videoPlaying]);

  const danmakuPlaybackState = useMemo(() => (videoPlaying ? "running" : "paused"), [videoPlaying]);
  const radarPoints = useMemo(() => {
    const centerX = 150;
    const centerY = 150;
    const baseRadius = 96;
    return capabilityMetrics.map((metric, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / capabilityMetrics.length;
      const ratio = (radarExpanded ? metric.value : 0) / 100;
      const radius = baseRadius * ratio;
      const labelRadius = 126;
      return {
        ...metric,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        labelX: centerX + Math.cos(angle) * labelRadius,
        labelY: centerY + Math.sin(angle) * labelRadius,
      };
    });
  }, [capabilityMetrics, radarExpanded]);
  const radarPolygonPoints = useMemo(
    () => radarPoints.map((point) => `${point.x},${point.y}`).join(" "),
    [radarPoints],
  );

  useEffect(() => {
    resetDanmakuTimeline();
  }, []);

  const handleRefreshRecommended = () => {
    // Shuffle recommendation cards just to feel fully responsive
    showToast("正在根据学籍四阶档案为您重新校准推荐课程大纲...");
  };

  const startLiveRoom = () => {
    const resumeAt = Math.max(0, Math.floor(heroVideoRef.current?.currentTime || 0));
    navigate(`/learn?courseId=${COURSES[0].id}&startAt=${resumeAt}&autoplay=1&muted=1`);
  };

  return (
    <div className="space-y-8 select-none" id="overview-workspace">
      
      {/* 1. Hero Live Video Background Area */}
      <section className="relative w-full rounded-3xl overflow-hidden shadow-md group min-h-[380px] md:min-h-[460px] flex items-center bg-black">
        {/* Actual Video Element */}
        <div className="absolute inset-0">
          <video
            id="hero-video-player"
            ref={heroVideoRef}
            autoPlay
            loop
            muted={videoMuted}
            playsInline
            className={`h-full w-full object-cover transition-opacity duration-300 ${videoPlaying ? "opacity-100" : "opacity-75"} animate-referrer`}
            referrerPolicy="no-referrer"
            onTimeUpdate={handleVideoTimeUpdate}
            onLoadedData={resetDanmakuTimeline}
            onEnded={resetDanmakuTimeline}
          >
            <source
              src="/videos/software-engineering-4th/project-demo.mp4"
              type="video/mp4"
            />
          </video>
          {/* Gradient subtle shadow block shielding text metrics */}
          <div
            className={`absolute inset-0 transition-all duration-300 ${
              videoPlaying
                ? "opacity-0"
                : "bg-gradient-to-r from-[#171c22]/90 via-[#171c22]/60 to-transparent opacity-100"
            }`}
          ></div>
        </div>

        {/* Floating Danmaku Bullet comments layer */}
        {danmakuEnabled && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
            {activeDanmakus.map((dan) => (
              <div
                key={dan.id}
                className={`danmaku-item absolute whitespace-nowrap text-white ${dan.sizeClassName} ${dan.fontWeightClassName || ""}`}
                style={{
                  top: dan.top,
                  color: dan.color,
                  left: "100%",
                  width: `${dan.width}px`,
                  animationDuration: `${dan.duration}s`,
                  animationPlayState: danmakuPlaybackState,
                }}
                onAnimationEnd={() => handleDanmakuComplete(dan.id)}
              >
                {dan.text}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          aria-label="进入当前课程播放页"
          onClick={startLiveRoom}
          className="absolute inset-x-0 top-0 bottom-20 z-[15] cursor-pointer bg-transparent"
        />

        {/* Content Details Overlaid */}
        <div
          className={`relative z-20 p-8 md:p-12 lg:p-16 flex flex-col items-start w-full md:w-3/4 lg:w-2/3 transition-all duration-300 ${
            videoPlaying ? "pointer-events-none opacity-0 translate-y-3" : "pointer-events-auto opacity-100 translate-y-0"
          }`}
        >
          <div className="bg-[#fb7299] text-white text-[11px] font-bold px-3.5 py-1 rounded-full uppercase mb-4 tracking-wider shadow-md animate-pulse">
            Live • 随堂重播学术研习
          </div>
          
          <h1 className="text-3xl md:text-4xl lg:text-5xl leading-[1.1] font-extrabold text-white mb-5 tracking-tight drop-shadow">
            UI/UX 高原重构：高转化交互系统底蕴与设计微课
          </h1>
          
          <p className="text-white/90 text-sm md:text-base mb-8 font-medium max-w-[555px] drop-shadow-sm leading-relaxed">
            与 5,420 名学者共同剖析行为心理学在前端界面重构中的应用。揭示极致渲染流背后的精细逻辑，攻破设计阻塞。
          </p>

          <button
            id="hero-enter-live-room-btn"
            onClick={(e) => {
              e.stopPropagation();
              startLiveRoom();
            }}
            className="bg-[#fb7299] hover:bg-[#fb7299]/90 text-white font-bold text-base px-8 py-3.5 rounded-2xl flex items-center gap-2.5 transition-all hover:scale-[1.03] shadow-lg shadow-[#fb7299]/35 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-white" />
            进入互动课堂
          </button>
        </div>

        {/* Player controls */}
        <div className="absolute bottom-6 right-6 flex flex-wrap items-center justify-end gap-3 z-30 pointer-events-auto">
          {/* Mute toggle button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setVideoMuted(!videoMuted);
            }}
            className="w-10 h-10 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center text-white hover:bg-[#fb7299] transition-colors cursor-pointer"
            title={videoMuted ? "开启声音" : "静音"}
          >
            {videoMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
          </button>

          {/* Pause / Play controls */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const video = document.getElementById("hero-video-player") as HTMLVideoElement;
              if (video) {
                if (videoPlaying) {
                  video.pause();
                } else {
                  video.play();
                }
                setVideoPlaying(!videoPlaying);
              }
            }}
            className="w-10 h-10 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center text-white hover:bg-[#fb7299] transition-colors cursor-pointer"
            title={videoPlaying ? "暂停" : "放映"}
          >
            {videoPlaying ? (
              <Pause className="w-4.5 h-4.5" />
            ) : (
              <Play className="w-4.5 h-4.5 fill-white stroke-none" />
            )}
          </button>

          {/* Toggle Bullet Comment Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDanmakuEnabled(!danmakuEnabled);
            }}
            className={`h-10 rounded-full backdrop-blur-md flex items-center justify-center text-xs font-bold transition-all px-4 cursor-pointer ${
              danmakuEnabled ? "bg-[#fb7299] text-white" : "bg-black/45 text-white/80"
            }`}
          >
            {danmakuEnabled ? "弹幕: 开启" : "弹幕: 关闭"}
          </button>

        </div>
      </section>

      {/* 2. Split Dashboard Structure layout */}
      <div className="flex flex-col lg:flex-row gap-8 w-full">
        
        {/* Main Content Area Left Column */}
        <div className="flex-grow flex flex-col gap-8 min-w-0">
          
          {/* A. My Ongoing Series (我的在追计划) */}
          <section id="ongoing-series-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-sans text-xl md:text-2xl font-bold text-[#171c22] flex items-center gap-2">
                <span className="w-2.5 h-5 bg-[#fb7299] rounded-full shrink-0"></span>
                我的在追温习计划
              </h2>
              <div className="flex gap-1.5">
                <button
                  onClick={() => showToast("正在载入此前的温习计划...")}
                  className="w-8 h-8 rounded-full bg-white border border-[#E3E8EC] flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-[#564145]" />
                </button>
                <button
                  onClick={() => showToast("正在切换至后续的进修计划...")}
                  className="w-8 h-8 rounded-full bg-white border border-[#E3E8EC] flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 text-[#564145]" />
                </button>
              </div>
            </div>

            {/* Scrolling Card List Flex container */}
            <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar scroll-smooth">
              {ongoingSeries.map((series) => {
                let seriesTitleZh = series.title;
                if (series.title.includes("Advanced Machine Learning")) seriesTitleZh = "前沿机器学习实战：极深反向传播与梯度策略";
                if (series.title.includes("Modern React Architecture")) seriesTitleZh = "现代化 React 架构：极致组件虚拟化与 Context 多维切片";

                let lastWatchedEpisodeZh = series.lastWatchedEpisode;
                if (series.lastWatchedEpisode.includes("Ep.12 Gradient Ascent")) lastWatchedEpisodeZh = "第12讲 梯度攀升与拟合微积分公式";
                if (series.lastWatchedEpisode.includes("Ep.5 Context Overuse")) lastWatchedEpisodeZh = "第5讲 规避 Context 滥用造成的级联重新渲染";

                return (
                  <div
                    id={`ongoing-series-card-${series.id}`}
                    key={series.id}
                    onClick={() => navigate(`/learn?courseId=${series.id}`)}
                    className="min-w-[290px] md:min-w-[320px] bg-white rounded-2xl border border-[#E3E8EC] p-4 shadow-sm hover:shadow-md hover:border-[#fb7299]/30 transition-all cursor-pointer flex gap-4 shrink-0 group relative overflow-hidden"
                  >
                    {/* Thumbnail Image */}
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 shrink-0 relative border border-gray-100">
                      <img
                        src={series.image}
                        alt={seriesTitleZh}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded-sm font-mono">
                        {series.progress}%
                      </div>
                    </div>

                    {/* Series Progress Details */}
                    <div className="flex flex-col justify-between flex-grow min-w-0">
                      <div>
                        <h3 className="font-sans text-xs font-bold text-[#171c22] line-clamp-2 leading-tight group-hover:text-[#fb7299] transition-colors">
                          {seriesTitleZh}
                        </h3>
                        <p className="text-[10px] text-[#fb7299] font-bold mt-1 tracking-wide">
                          {series.progress === 100 ? "学完课件" : `连载至 Ep.${series.id === "series-1" ? "15/16" : "8/8"}`}
                        </p>
                      </div>

                      <div className="mt-2">
                        <div className="w-full h-1 bg-[#eaeef6] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#fb7299] rounded-full"
                            style={{ width: `${series.progress}%` }}
                          />
                        </div>
                        <p className="text-[9px] font-mono text-[#564145]/70 truncate mt-1">
                          上次温习到: {lastWatchedEpisodeZh}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* B. Recommended for You (为您推荐) */}
          <section id="recommendations-courses-section">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-sans text-xl md:text-2xl font-bold text-[#171c22] flex items-center gap-2">
                <span className="w-2.5 h-5 bg-[#006689] rounded-full shrink-0"></span>
                智能学术推荐
              </h2>
              <button
                onClick={handleRefreshRecommended}
                className="text-xs font-semibold text-[#006689] flex items-center gap-1.5 hover:bg-[#006689]/10 px-3.5 py-1.5 rounded-full transition-all border border-[#006689]/20 shadow-sm cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                换一换大纲
              </button>
            </div>

            {/* Bento Grid: 3 big dynamic video elements + 1 functional shortcut badge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-5">
              
              {/* Loop recommendations */}
              {COURSES.slice(0, 3).map((course) => {
                let courseTitleZh = course.title;
                if (course.title.includes("Advanced Machine Learning")) courseTitleZh = "前沿机器学习实战：极深反向传播与梯度策略";
                if (course.title.includes("Modern React Architecture")) courseTitleZh = "现代化 React 架构：极致组件虚拟化与 Context 多维切片";
                if (course.title.includes("Creative Front-End CSS Physics")) courseTitleZh = "创意前端物理动效：三维流体粒子系统与贝塞尔重力刚体";

                let courseSubtitleZh = course.subtitle;
                if (course.subtitle.includes("Dive deep into deep neural networks")) courseSubtitleZh = "深入讲解BP公式的反向求导细节与正则化";
                if (course.subtitle.includes("Master virtual rendering")) courseSubtitleZh = "精细剖析 Fiber 递归树级联优化的防御机制";
                if (course.subtitle.includes("Animate elements dynamically")) courseSubtitleZh = "高频画布重绘时的 GPU 缓存分层与硬件解析";

                let categoryZh = course.category === "Data" ? "数据智能" : "数字艺术";

                let uploaderZh = course.uploader;
                if (course.uploader.includes("Dr. Alexander")) uploaderZh = "刘博士 (学海带头人)";
                if (course.uploader.includes("Prof. Sarah")) uploaderZh = "萨教授 (首席主讲)";
                if (course.uploader.includes("Justin")) uploaderZh = "架构师 Justin";

                return (
                  <div
                    id={`recommended-card-${course.id}`}
                    key={course.id}
                    onClick={() => navigate(`/learn?courseId=${course.id}`)}
                    className="bg-white rounded-2xl border border-[#E3E8EC] overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group"
                  >
                    {/* Thumbnail Banner */}
                    <div className="relative aspect-video bg-gray-100 overflow-hidden border-b border-[#eaeef6]">
                      <img
                        src={course.image}
                        alt={courseTitleZh}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-sm text-white font-mono text-[10px] px-2 py-0.5 rounded">
                        {course.duration}
                      </div>
                      {course.progress > 0 && (
                        <div className="absolute top-2 left-2 bg-[#fb7299] text-white font-sans font-extrabold text-[9px] px-2 py-0.5 rounded uppercase tracking-wider">
                          已研习 {course.progress}%
                        </div>
                      )}
                    </div>

                    {/* Metadata fields */}
                    <div className="p-4 flex flex-col flex-grow justify-between gap-3">
                      <div>
                        <h3 className="font-sans text-sm font-bold text-[#171c22] line-clamp-1 group-hover:text-[#fb7299] transition-colors leading-snug">
                          {courseTitleZh}
                        </h3>
                        <p className="text-xs text-[#564145] line-clamp-1 mt-1 opacity-90">{courseSubtitleZh}</p>
                      </div>

                      <div className="mt-auto pt-3 border-t border-gray-100 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-[#564145] text-xs">
                          {course.uploaderAvatar ? (
                            <img
                              src={course.uploaderAvatar}
                              alt={uploaderZh}
                              className="w-4 h-4 rounded-full object-cover border border-[#ddbfc4]"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <UserCircle className="w-4 h-4 text-[#fb7299]" />
                          )}
                          <span className="truncate font-medium">{uploaderZh}</span>
                          <span className="text-amber-500 font-bold flex items-center gap-0.5 ml-auto text-xs shrink-0">
                            <Star className="w-3.5 h-3.5 fill-amber-500 stroke-none" />
                            {course.rating} 分
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[#564145]/70 text-[11px] font-mono font-medium">
                          <div className="flex items-center gap-2.5">
                            <span className="flex items-center gap-1"><Play className="w-3 h-3 fill-current" /> {course.views} 次放映</span>
                            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {course.comments} 互动</span>
                          </div>
                          <span className="bg-[#f0f4fc] text-[#006689] px-2 py-0.5 rounded-md font-bold font-sans text-[10px]">
                            {categoryZh}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 4th Slot: Shortcut Features (快捷功能) inside recommendations grid */}
              <div className="bg-white rounded-2xl border border-[#E3E8EC] p-5 flex flex-col shadow-sm justify-between gap-4">
                <div>
                  <h3 className="font-sans text-sm font-extrabold text-[#171c22] flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#fb7299]" />
                    随堂高效快捷航标
                  </h3>
                  <p className="text-xs text-[#564145] select-none">为正在积极冲刺研学成果的学子准备的随堂直通通路。</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate(`/path?courseId=${COURSES[0].id}`)}
                    className="bg-[#fb7299]/5 hover:bg-[#fb7299]/10 text-[#fb7299] rounded-xl flex flex-col items-center justify-center p-3 text-center transition-all border border-[#fb7299]/10 cursor-pointer"
                  >
                    <Target className="w-6 h-6 mb-1" />
                    <span className="text-xs font-bold font-sans">我的路线图</span>
                    <span className="text-[9px] opacity-75 mt-0.5 truncate max-w-full">研学里程碑进度</span>
                  </button>

                  <button
                    onClick={() => navigate(`/evaluation?courseId=${COURSES[0].id}`)}
                    className="bg-[#006689]/5 hover:bg-[#006689]/10 text-[#006689] rounded-xl flex flex-col items-center justify-center p-3 text-center transition-all border border-[#006689]/10 cursor-pointer"
                  >
                    <Award className="w-6 h-6 mb-1" />
                    <span className="text-xs font-bold font-sans">随堂金牌测评</span>
                    <span className="text-[9px] opacity-75 mt-0.5 truncate max-w-full">真题小测诊断</span>
                  </button>

                  <button
                    onClick={() => navigate(`/resources?courseId=${COURSES[0].id}`)}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl flex flex-col items-center justify-center p-3 text-center transition-all border border-emerald-100 cursor-pointer"
                  >
                    <BookOpen className="w-6 h-6 mb-1" />
                    <span className="text-xs font-bold font-sans">随堂金课文献</span>
                    <span className="text-[9px] opacity-75 mt-0.5 truncate max-w-full">精品幻灯课件包</span>
                  </button>

                  <button
                    onClick={() => navigate(`/tutor?courseId=${COURSES[0].id}`)}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl flex flex-col items-center justify-center p-3 text-center transition-all border border-amber-100 cursor-pointer"
                  >
                    <Bot className="w-6 h-6 mb-1 font-bold" />
                    <span className="text-xs font-bold font-sans">AI 导师答疑</span>
                    <span className="text-[9px] opacity-75 mt-0.5 truncate max-w-full">扫清思维死角</span>
                  </button>
                </div>
              </div>

            </div>
          </section>

        </div>

        {/* Right sidebar column section */}
        <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-6">

          {/* B1. Capability Radar (能力画像 Widget) */}
          <div className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-sm font-extrabold text-[#171c22] flex items-center gap-1.5">
                <Radar className="w-4 h-4 text-[#fb7299]" />
                我的研学五维雷达画像
              </h3>
              <span className="bg-[#fb7299]/15 text-[#fb7299] text-[9px] font-bold px-2 py-0.5 rounded-full font-mono">
                学学金阶 LV.4
              </span>
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-[#e8edf6] bg-[linear-gradient(180deg,#f9fbff_0%,#ffffff_52%,#fff8fb_100%)] p-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,114,153,0.10),transparent_26%),radial-gradient(circle_at_left_bottom,rgba(59,130,246,0.10),transparent_34%)]" />
              <div className="relative mb-4 flex items-center justify-between rounded-2xl border border-white/80 bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Radar Canvas</p>
                  <p className="text-sm font-extrabold text-[#171c22]">五维能力动态展开图</p>
                </div>
                <div className="rounded-full bg-[#171c22] px-2.5 py-1 text-[10px] font-black text-white">
                  总评 {METRIC_SCORE.overallScore}
                </div>
              </div>

              <div className="relative rounded-[24px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(248,250,255,0.92))] px-3 py-4 shadow-[0_18px_40px_rgba(148,163,184,0.15)]">
                <div className="mx-auto w-full max-w-[320px]">
                  <svg viewBox="0 0 300 300" className="h-[300px] w-full overflow-visible">
                    {[0.2, 0.4, 0.6, 0.8, 1].map((ratio) => {
                      const ringPoints = capabilityMetrics
                        .map((_, index) => {
                          const angle = -Math.PI / 2 + (Math.PI * 2 * index) / capabilityMetrics.length;
                          const radius = 96 * ratio;
                          const x = 150 + Math.cos(angle) * radius;
                          const y = 150 + Math.sin(angle) * radius;
                          return `${x},${y}`;
                        })
                        .join(" ");
                      return (
                        <polygon
                          key={ratio}
                          points={ringPoints}
                          fill={ratio === 1 ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.16)"}
                          stroke="rgba(148,163,184,0.28)"
                          strokeWidth="1"
                        />
                      );
                    })}

                    {capabilityMetrics.map((_, index) => {
                      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / capabilityMetrics.length;
                      const x = 150 + Math.cos(angle) * 96;
                      const y = 150 + Math.sin(angle) * 96;
                      return (
                        <line
                          key={`axis-${index}`}
                          x1="150"
                          y1="150"
                          x2={x}
                          y2={y}
                          stroke="rgba(148,163,184,0.26)"
                          strokeWidth="1"
                        />
                      );
                    })}

                    <polygon
                      points={radarPolygonPoints}
                      fill="rgba(59,130,246,0.22)"
                      stroke="rgba(37,99,235,0.95)"
                      strokeWidth="3"
                      style={{
                        filter: "drop-shadow(0 12px 24px rgba(37,99,235,0.22))",
                        transition: "all 900ms cubic-bezier(0.22, 1, 0.36, 1)",
                      }}
                    />

                    {radarPoints.map((point, index) => (
                      <g key={point.label}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="8"
                          fill="white"
                          style={{ transition: "all 900ms cubic-bezier(0.22, 1, 0.36, 1)", transitionDelay: `${index * 80}ms` }}
                        />
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="5"
                          fill={point.tone.includes("#06b6d4") ? "#0ea5e9" : point.tone.includes("#14b8a6") ? "#10b981" : point.tone.includes("#f59e0b") ? "#f59e0b" : point.tone.includes("#fb7185") ? "#f97316" : "#6366f1"}
                          style={{ transition: "all 900ms cubic-bezier(0.22, 1, 0.36, 1)", transitionDelay: `${index * 80}ms` }}
                        />
                        <text
                          x={point.labelX}
                          y={point.labelY}
                          textAnchor="middle"
                          className="fill-[#334155]"
                          style={{ fontSize: "11px", fontWeight: 800 }}
                        >
                          {point.label}
                        </text>
                        <text
                          x={point.labelX}
                          y={point.labelY + 16}
                          textAnchor="middle"
                          className="fill-[#94a3b8]"
                          style={{ fontSize: "9px", fontWeight: 700 }}
                        >
                          {point.note}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  {capabilityMetrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-2xl border border-white/90 bg-white/75 px-3 py-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-[#171c22]">{metric.label}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">
                          {metric.value}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] font-semibold text-slate-400">{metric.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-xs">
              <span className="text-[#564145]">学籍状态: <strong className="text-[#fb7299] font-bold">四阶卓越研究员</strong></span>
              <Link to="/profile" className="text-[#006689] font-semibold hover:underline flex items-center gap-0.5">
                学籍详情
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* B2. Learning Dynamic Activity logs feed */}
          <div className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-sm font-extrabold text-[#171c22]">
                最新随堂研学动态
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            </div>

            <div className="space-y-4">
              {RECENT_ACTIVITIES.map((activity) => {
                let timeZh = activity.time;
                if (activity.time.includes("2 hours ago")) timeZh = "2 小时前";
                if (activity.time.includes("Yesterday")) timeZh = "昨天";
                if (activity.time.includes("3 days ago")) timeZh = "3 天前";

                let titleZh = activity.title;
                if (activity.title.includes("Completed Module: Advanced React Patterns")) titleZh = "完成微课: 深度 React 性能模式";
                if (activity.title.includes("Submitted Project: E-commerce Dashboard")) titleZh = "通关沙盒: 现代化电商仪表盘";
                if (activity.title.includes("Started Course: UI/UX Principles")) titleZh = "开启研学: 体验设计核心原则";

                let badgeZh = activity.badge;
                if (activity.badge?.includes("Execution +5")) badgeZh = "实践力 +5";
                if (activity.badge?.includes("Output +10")) badgeZh = "创造力 +10";
                if (activity.badge?.includes("Breadth +2")) badgeZh = "知识面 +2";

                return (
                  <div key={activity.id} className="flex gap-3 items-start text-xs border-b border-gray-50 pb-2.5 last:border-0 last:pb-0">
                    <div className="w-7 h-7 rounded-full bg-[#fb7299]/10 flex items-center justify-center shrink-0 text-[#fb7299]">
                      <Award className="w-3.5 h-3.5" />
                    </div>
                    <div className="pt-0.5">
                      <p className="text-[#171c22] font-semibold">{titleZh}</p>
                      <div className="flex items-center gap-1.5 mt-1 font-mono text-[10px] text-[#564145]/70">
                        <span>{timeZh}</span>
                        <span>•</span>
                        <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.2 rounded font-sans text-[8px] font-bold">
                          {badgeZh}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* B3. Secondary decorative learning banner values */}
          <div className="rounded-3xl p-5 bg-gradient-to-br from-[#006689] to-[#006689]/85 text-white flex flex-col justify-between h-40 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 bottom-0 opacity-10 shrink-0 select-none">
              <Compass className="w-32 h-32" />
            </div>
            <div className="z-10">
              <p className="text-[10px] uppercase font-bold tracking-wider opacity-75">里程碑重大活动</p>
              <h4 className="text-sm font-extrabold mt-1 leading-snug">
                携手参与 2026 智能前端创研大赛！
              </h4>
              <p className="text-xs opacity-90 mt-1 lines-clamp-2">完成指定微自测，即可零门槛在线兑换入会资格与免费入场券。</p>
            </div>
            <button
              onClick={() => navigate("/evaluation")}
              className="bg-white text-[#006689] text-xs font-bold px-4 py-2 rounded-xl self-start hover:bg-[#f7f9ff] transition-colors shadow mt-3 cursor-pointer"
            >
              检验我的入场资格
            </button>
          </div>

        </aside>
      </div>

      {/* Beautiful In-App Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#171c22]/95 text-white text-xs font-bold px-5 py-3 rounded-full shadow-2xl z-50 flex items-center gap-2 border border-white/10 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <span className="w-2 h-2 rounded-full bg-[#fb7299] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
