/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Tv,
  BookOpen,
  Award,
  Bot,
  Heart,
  Share2,
  Bookmark,
  CheckCircle,
  UserCircle,
  MessageCircle,
  Clock,
  ArrowRight,
  ListRestart,
  Send,
  ThumbsUp,
} from "lucide-react";
import { COURSES } from "../constants";
import { studentApi, type CourseCommentItem, type VideoDanmakuItem } from "../lib/studentApi";

const LOCAL_SECTION_VIDEOS: Record<string, string[]> = {
  "series-1": [
    "/videos/software-engineering-4th/project-demo.mp4",
    "/videos/software-engineering-4th/visio-flow-demo.mp4",
    "/videos/software-engineering-4th/cloud-app-demo.mp4",
  ],
  "series-2": [
    "/videos/software-engineering-4th/visio-flow-demo.mp4",
    "/videos/software-engineering-4th/project-demo.mp4",
    "/videos/software-engineering-4th/cloud-app-demo.mp4",
  ],
  "series-3": [
    "/videos/software-engineering-4th/cloud-app-demo.mp4",
    "/videos/software-engineering-4th/project-demo.mp4",
    "/videos/software-engineering-4th/visio-flow-demo.mp4",
  ],
  "course-4": [
    "/videos/software-engineering-4th/project-demo.mp4",
    "/videos/software-engineering-4th/cloud-app-demo.mp4",
    "/videos/software-engineering-4th/visio-flow-demo.mp4",
  ],
};

type DanmakuMode = "scroll" | "top" | "bottom";

type PersistedPresetDanmaku = {
  text: string;
  color: string;
  mode?: DanmakuMode;
  time: number;
};

type ActiveCourseDanmaku = {
  id: string;
  content: string;
  color: string;
  mode: DanmakuMode;
  startTime: number;
  top?: string;
  width?: number;
  duration?: number;
  opacity?: number;
};

type CourseComment = {
  id: number;
  author: string;
  text: string;
  date: string;
  createdAt?: string | null;
  likes: number;
  badge?: string;
  liked?: boolean;
  replyTo?: string;
  parentCommentId?: number | null;
};

type CommentSortMode = "latest" | "hot";

type ReplyTarget = {
  id: number;
  author: string;
};

let localTempCommentId = -1;

const DANMAKU_SCROLL_LANES = ["12%", "22%", "32%", "42%", "52%"];
const DANMAKU_FIXED_DURATION = 3.6;
const DANMAKU_SCROLL_SPEED_PX_PER_SECOND = 132;
const DANMAKU_SCROLL_GAP_PX = 124;
const DANMAKU_SEEK_LOOKAHEAD_SECONDS = 0.45;
const DANMAKU_MAX_FIXED_STACK = 1;

// Bullet comments presets based on distinct academic courses
const PRESET_DANMAKUS_BY_COURSE: Record<string, PersistedPresetDanmaku[]> = {
  "series-2": [
    { text: "打卡！React 19 编译器确实好顶赞！✨", color: "#fb7299", time: 1.2, mode: "scroll" },
    { text: "这节课讲得太棒了，正好解决了我的状态漫溢问题", color: "#2563eb", time: 3.8, mode: "scroll" },
    { text: "终于彻底弄懂了 Context 的级联渲染阻断原理了 💡", color: "#10b981", time: 6.1, mode: "scroll" },
    { text: "前方高能，核心重绘演示开始！⚠️", color: "#ef4444", time: 9.3, mode: "top" },
    { text: "太顶了！BiliLearn 专属学术导师帮我完成了一遍梳理", color: "#fb7299", time: 12.4, mode: "scroll" },
    { text: "刘博士，请收下我的膝盖 🧎‍♂️", color: "#d97706", time: 15.6, mode: "bottom" },
    { text: "打卡第三遍，温故而知新，确实通俗且深邃！", color: "#475569", time: 18.8, mode: "scroll" },
    { text: "原来用 memo 还需要注意 props 引用一致性！精妙", color: "#0891b2", time: 22.1, mode: "scroll" }
  ],
  "series-1": [
    { text: "反向传播在极深多层网络里的确容易梯度消失啊 🔗", color: "#ef4444", time: 1.1, mode: "scroll" },
    { text: "萨教授讲得太通透了！数学公式讲解绝了", color: "#2563eb", time: 4.2, mode: "scroll" },
    { text: "听完这章豁然开朗，终于懂了链式法则！🧠", color: "#10b981", time: 7.4, mode: "scroll" },
    { text: "跳跃层 Residual Link 真是划时代的创新！👍", color: "#fb7299", time: 10.8, mode: "top" },
    { text: "用 ReLU 能完美防止不饱和溢出，妙啊！", color: "#475569", time: 14.1, mode: "scroll" },
    { text: "打卡！冲刺前沿大模型与神经网络方向！🪐", color: "#d97706", time: 17.5, mode: "bottom" },
    { text: "算法代码已经在沙箱里重构成功并过关！", color: "#0891b2", time: 20.8, mode: "scroll" },
    { text: "这里把梯度传播链拆开讲，终于没那么抽象了", color: "#7c3aed", time: 24.3, mode: "scroll" },
    { text: "这段案例推导太像面试高频题了，建议记笔记", color: "#2563eb", time: 27.9, mode: "scroll" },
    { text: "前方是关键公式，大家先别眨眼 👀", color: "#ef4444", time: 31.5, mode: "top" },
    { text: "原来参数更新不稳定时要先看学习率和激活函数配合", color: "#10b981", time: 35.8, mode: "scroll" },
    { text: "这一段真的值回票价，讲得比很多公开课清楚", color: "#fb7299", time: 38.6, mode: "scroll" },
    { text: "记下了：梯度爆炸和梯度消失要分开诊断", color: "#d97706", time: 42.1, mode: "bottom" },
    { text: "代码和公式终于对上了，之前卡住的点通了", color: "#0891b2", time: 46.8, mode: "scroll" },
    { text: "这段复盘很适合拿来做课堂总结", color: "#475569", time: 51.4, mode: "scroll" },
    { text: "后半段内容开始收束了，结构讲得很完整", color: "#2563eb", time: 56.2, mode: "scroll" },
    { text: "学到了，回头我也按这个套路重构实验报告", color: "#10b981", time: 61.7, mode: "scroll" }
  ],
  "series-3": [
    { text: "这个三维流体粒子系统真的惊艳到我了！🤯", color: "#fb7299", time: 1.4, mode: "top" },
    { text: "把牛顿重力力学公式代入 Canvas，简直是高雅艺术", color: "#2563eb", time: 4.1, mode: "scroll" },
    { text: "没有时间参数的弹簧公式确实比常规贝塞尔好！", color: "#10b981", time: 7.2, mode: "scroll" },
    { text: "炫酷！这就是原生 Canvas 与重力算法结合的力量 🚀", color: "#d97706", time: 10.6, mode: "scroll" },
    { text: "UI交互居然具有弹力感和惯性，太强了", color: "#475569", time: 14.5, mode: "bottom" },
    { text: "原来在 High-DPI 屏上乘以 devicePixelRatio 就能防发虚...", color: "#0891b2", time: 18.3, mode: "scroll" }
  ],
  "course-4": [
    { text: "D3.js 数据绑定的 .join() 真的省了无数繁复代码 ⚡", color: "#10b981", time: 1.3, mode: "scroll" },
    { text: "学到了，原来 domain() 定义域对接值域 range()！", color: "#fb7299", time: 4.4, mode: "scroll" },
    { text: "高对比度动态树图表瞬间变得生动了，配色一流！🖌️", color: "#2563eb", time: 7.9, mode: "top" },
    { text: "跟着大厂资深架构师写 D3，感觉脑子开窍了 💡", color: "#d97706", time: 11.8, mode: "scroll" },
    { text: "可视化大师，这课真的太硬核了！", color: "#475569", time: 15.2, mode: "bottom" },
    { text: "配合 D3 进行深度坐标数值插值，流畅拉满", color: "#7c3aed", time: 19.6, mode: "scroll" }
  ]
};

const PRESET_COMMENTS_BY_COURSE: Record<string, Array<{ userId: number; content: string }>> = {
  "series-1": [
    { userId: 1002, content: "复合组件这套拆分方式很适合课程页，插槽边界清楚，后续扩展也更稳。" },
    { userId: 1003, content: "这一段把 Hooks 缓存、引用稳定性和组件重渲染的关系讲得很透，回头复盘时特别好整理成笔记。" },
  ],
  "series-2": [
    { userId: 1002, content: "这节课对 Context 和拆分边界的处理很实用，适合直接迁到项目里。" },
    { userId: 1003, content: "把状态切片、渲染链路和组件职责放在一起看，理解会清楚很多。" },
  ],
};

export default function CourseLearning() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = searchParams.get("courseId") || "series-2"; // default to Advanced React Patterns
  const sectionId = searchParams.get("sectionId");
  const resumeStartAt = Math.max(0, Number(searchParams.get("startAt") || "0"));
  const shouldAutoplayOnEnter = searchParams.get("autoplay") === "1";
  const shouldMuteOnEnter = searchParams.get("muted") === "1";
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const pendingResumeTimeRef = useRef<number | null>(shouldAutoplayOnEnter ? resumeStartAt : null);

  // Fetch current course
  const course = COURSES.find((c) => c.id === courseId) || COURSES[0];

  // Episodes list corresponding to this course representation
  const episodes = [
    { title: "第一章：核心系统架构模式与状态边界", duration: "12:15", watched: true },
    { title: "第二章：Hooks组合设计与Context多维切片", duration: "16:40", watched: true },
    { title: "第三章：子组件级联渲染深度优化精讲", duration: "15:20", watched: false },
    { title: "第四章：性能剖析器 (Profiler) 与编译器新纪元", duration: "22:10", watched: false }
  ];

  // Local state for interactive features
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeEpisodeIdx, setActiveEpisodeIdx] = useState(0);
  const [userComment, setUserComment] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [danmakuEnabled, setDanmakuEnabled] = useState(true);
  const [newDanmakuText, setNewDanmakuText] = useState("");
  const [danmakuColor, setDanmakuColor] = useState("#fb7299");
  const [danmakuMode, setDanmakuMode] = useState<DanmakuMode>("scroll");
  const [persistedDanmakus, setPersistedDanmakus] = useState<VideoDanmakuItem[]>([]);
  const [activeDanmakus, setActiveDanmakus] = useState<ActiveCourseDanmaku[]>([]);
  const [comments, setComments] = useState<CourseComment[]>([]);
  const [commentSort, setCommentSort] = useState<CommentSortMode>("latest");
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const nextDanmakuIndexRef = useRef(0);
  const laneAvailableAtRef = useRef<number[]>(new Array(DANMAKU_SCROLL_LANES.length).fill(0));
  const emittedDanmakuIdsRef = useRef<Set<number>>(new Set());
  const lastVideoTimeRef = useRef(0);

  const activeVideoSrc = useMemo(() => {
    const localVideos = LOCAL_SECTION_VIDEOS[courseId];
    if (localVideos?.length) {
      return localVideos[activeEpisodeIdx % localVideos.length];
    }
    return course.playbackUrl || "/videos/software-engineering-4th/project-demo.mp4";
  }, [activeEpisodeIdx, course.playbackUrl, courseId]);

  // Parse sectionId if provided
  useEffect(() => {
    if (sectionId) {
      const parsed = parseInt(sectionId, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed < episodes.length) {
        setActiveEpisodeIdx(parsed);
      }
    }
  }, [sectionId]);

  useEffect(() => {
    setVideoPlaying(false);
    setCurrentPlaybackTime(0);
    pendingResumeTimeRef.current = shouldAutoplayOnEnter ? resumeStartAt : null;
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [activeVideoSrc, resumeStartAt, shouldAutoplayOnEnter]);

  const activeVideoKey = useMemo(
    () => `${courseId}:${activeEpisodeIdx}:${activeVideoSrc}`,
    [activeEpisodeIdx, activeVideoSrc, courseId],
  );

  const resetDanmakuRuntime = () => {
    nextDanmakuIndexRef.current = 0;
    laneAvailableAtRef.current = new Array(resolvedScrollLanes.length).fill(0);
    emittedDanmakuIdsRef.current = new Set();
    setActiveDanmakus([]);
  };

  const hydratePresetDanmaku = async () => {
    const presets = PRESET_DANMAKUS_BY_COURSE[courseId] || PRESET_DANMAKUS_BY_COURSE["series-2"];
    const fallbackItems: VideoDanmakuItem[] = presets.map((item, index) => ({
      id: index + 1,
      video_key: activeVideoKey,
      user_id: 1001,
      user_name: "学友 1001",
      content: item.text,
      color: item.color,
      mode: item.mode || "scroll",
      start_time: item.time,
      created_at: null,
    }));
    try {
      const existing = await studentApi.listVideoDanmaku(activeVideoKey, 300);
      if (existing.total === 0) {
        setPersistedDanmakus(fallbackItems);
        return;
      }
      if (existing.total >= presets.length) {
        setPersistedDanmakus(existing.items);
        return;
      }

      const seeded: VideoDanmakuItem[] = [...existing.items];
      const existingKeys = new Set(
        existing.items.map((item) => `${item.content}|${item.start_time}|${item.mode}`),
      );
      for (const item of presets) {
        const presetKey = `${item.text}|${item.time}|${item.mode || "scroll"}`;
        if (existingKeys.has(presetKey)) {
          continue;
        }
        const created = await studentApi.createVideoDanmaku({
          video_key: activeVideoKey,
          content: item.text,
          color: item.color,
          mode: item.mode || "scroll",
          start_time: item.time,
        });
        seeded.push(created);
      }
      setPersistedDanmakus(seeded);
    } catch {
      showToast("弹幕数据加载失败，已暂时回退到本地模式");
      setPersistedDanmakus(fallbackItems);
    }
  };

  useEffect(() => {
    resetDanmakuRuntime();
    void hydratePresetDanmaku();
  }, [activeVideoKey]);

  useEffect(() => {
    void hydrateCourseComments().catch(() => {
      showToast("评论加载失败，请稍后重试");
      setComments([]);
    });
  }, [courseId, activeEpisodeIdx]);

  const sortedDanmakus = useMemo(
    () => [...persistedDanmakus].sort((a, b) => a.start_time - b.start_time || a.id - b.id),
    [persistedDanmakus],
  );

  useEffect(() => {
    if (!shouldAutoplayOnEnter) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const resumePlayback = async () => {
      const nextStartTime = pendingResumeTimeRef.current;
      if (nextStartTime === null) {
        return;
      }

      const maxStartTime =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.max(0, video.duration - 0.8)
          : nextStartTime;
      const safeStartTime = Math.min(nextStartTime, maxStartTime);

      try {
        video.currentTime = safeStartTime;
      } catch {
        return;
      }

      lastVideoTimeRef.current = safeStartTime;
      syncDanmakuTimeline(safeStartTime);

      try {
        if (shouldMuteOnEnter) {
          video.muted = true;
          video.defaultMuted = true;
        }
        await video.play();
        setVideoPlaying(true);
      } catch {
        setVideoPlaying(false);
      }

      pendingResumeTimeRef.current = null;
    };

    const handleLoadedMetadata = () => {
      void resumePlayback();
    };

    if (video.readyState >= 1) {
      void resumePlayback();
      return;
    }

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [activeVideoSrc, shouldAutoplayOnEnter, shouldMuteOnEnter, sortedDanmakus]);

  const resolvedScrollLanes = DANMAKU_SCROLL_LANES;

  const pickScrollLane = (currentTime: number) => {
    const laneIndex = laneAvailableAtRef.current.findIndex((availableAt) => availableAt <= currentTime);
    return laneIndex === -1 ? 0 : laneIndex;
  };

  const pushActiveDanmaku = (item: VideoDanmakuItem) => {
    if (emittedDanmakuIdsRef.current.has(item.id)) {
      return;
    }

    if (item.mode === "top" || item.mode === "bottom") {
      const sameModeCount = activeDanmakus.filter((dan) => dan.mode === item.mode).length;
      if (sameModeCount >= DANMAKU_MAX_FIXED_STACK) {
        return;
      }
      emittedDanmakuIdsRef.current.add(item.id);
      setActiveDanmakus((prev) => [
        ...prev,
        {
          id: `${item.id}`,
          content: item.content,
          color: item.color,
          mode: item.mode,
          startTime: item.start_time,
          duration: DANMAKU_FIXED_DURATION,
          opacity: 0.84,
        },
      ]);
      return;
    }

    emittedDanmakuIdsRef.current.add(item.id);
    const lane = pickScrollLane(item.start_time);
    const width = Math.max(92, item.content.length * 16 + 28);
    const duration = Math.max(8.2, width / DANMAKU_SCROLL_SPEED_PX_PER_SECOND + 7.1);
    laneAvailableAtRef.current[lane] =
      item.start_time + Math.min(duration * 0.42, 4.4) + DANMAKU_SCROLL_GAP_PX / DANMAKU_SCROLL_SPEED_PX_PER_SECOND;

    setActiveDanmakus((prev) => [
      ...prev,
      {
        id: `${item.id}`,
        content: item.content,
        color: item.color,
        mode: "scroll",
        startTime: item.start_time,
        top: resolvedScrollLanes[lane],
        width,
        duration,
        opacity: 0.84,
      },
    ]);
  };

  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !danmakuEnabled) return;

    const currentTime = video.currentTime;
    while (
      nextDanmakuIndexRef.current < sortedDanmakus.length &&
      sortedDanmakus[nextDanmakuIndexRef.current].start_time <= currentTime + 0.12
    ) {
      pushActiveDanmaku(sortedDanmakus[nextDanmakuIndexRef.current]);
      nextDanmakuIndexRef.current += 1;
    }
  };

  const isDanmakuStillVisibleAt = (item: VideoDanmakuItem, currentTime: number) => {
    if (item.mode === "top" || item.mode === "bottom") {
      return item.start_time <= currentTime && currentTime <= item.start_time + DANMAKU_FIXED_DURATION;
    }

    const width = Math.max(92, item.content.length * 16 + 28);
    const duration = Math.max(8.2, width / DANMAKU_SCROLL_SPEED_PX_PER_SECOND + 7.1);
    return item.start_time <= currentTime && currentTime <= item.start_time + duration;
  };

  const visibleDanmakus = useMemo(() => {
    if (!danmakuEnabled) {
      return [];
    }

    const laneAvailability = new Array(DANMAKU_SCROLL_LANES.length).fill(0);
    const nextVisible: ActiveCourseDanmaku[] = [];
    let topStack = 0;
    let bottomStack = 0;

    for (const item of sortedDanmakus) {
      if (!isDanmakuStillVisibleAt(item, currentPlaybackTime)) {
        continue;
      }

      if (item.mode === "top" || item.mode === "bottom") {
        if (item.mode === "top" && topStack >= DANMAKU_MAX_FIXED_STACK) {
          continue;
        }
        if (item.mode === "bottom" && bottomStack >= DANMAKU_MAX_FIXED_STACK) {
          continue;
        }
        if (item.mode === "top") {
          topStack += 1;
        } else {
          bottomStack += 1;
        }

        nextVisible.push({
          id: `${item.id}`,
          content: item.content,
          color: item.color,
          mode: item.mode,
          startTime: item.start_time,
          duration: DANMAKU_FIXED_DURATION,
          opacity: 0.84,
        });
        continue;
      }

      const laneIndex = laneAvailability.findIndex((availableAt) => availableAt <= item.start_time);
      const resolvedLane = laneIndex === -1 ? 0 : laneIndex;
      const width = Math.max(92, item.content.length * 16 + 28);
      const duration = Math.max(8.2, width / DANMAKU_SCROLL_SPEED_PX_PER_SECOND + 7.1);
      laneAvailability[resolvedLane] =
        item.start_time + Math.min(duration * 0.42, 4.4) + DANMAKU_SCROLL_GAP_PX / DANMAKU_SCROLL_SPEED_PX_PER_SECOND;

      nextVisible.push({
        id: `${item.id}`,
        content: item.content,
        color: item.color,
        mode: "scroll",
        startTime: item.start_time,
        top: DANMAKU_SCROLL_LANES[resolvedLane],
        width,
        duration,
        opacity: 0.84,
      });
    }

    return nextVisible;
  }, [currentPlaybackTime, danmakuEnabled, sortedDanmakus]);

  const syncDanmakuTimeline = (currentTime: number) => {
    const nextLaneAvailability = new Array(resolvedScrollLanes.length).fill(currentTime);
    const nextActiveDanmakus: ActiveCourseDanmaku[] = [];
    const replayedIds = new Set<number>();
    let fixedStackTop = 0;
    let fixedStackBottom = 0;
    let pointer = 0;

    for (const item of sortedDanmakus) {
      const shouldReplayNow =
        isDanmakuStillVisibleAt(item, currentTime) ||
        (item.start_time > currentTime && item.start_time <= currentTime + DANMAKU_SEEK_LOOKAHEAD_SECONDS);

      if (item.start_time <= currentTime + 0.12) {
        pointer += 1;
      }

      if (!shouldReplayNow) {
        if (item.start_time > currentTime + DANMAKU_SEEK_LOOKAHEAD_SECONDS) {
          break;
        }
        continue;
      }

      replayedIds.add(item.id);

      if (item.mode === "top" || item.mode === "bottom") {
        if (item.mode === "top" && fixedStackTop >= DANMAKU_MAX_FIXED_STACK) {
          continue;
        }
        if (item.mode === "bottom" && fixedStackBottom >= DANMAKU_MAX_FIXED_STACK) {
          continue;
        }
        if (item.mode === "top") {
          fixedStackTop += 1;
        } else {
          fixedStackBottom += 1;
        }
        nextActiveDanmakus.push({
          id: `${item.id}`,
          content: item.content,
          color: item.color,
          mode: item.mode,
          startTime: item.start_time,
          duration: DANMAKU_FIXED_DURATION,
          opacity: 0.84,
        });
        continue;
      }

      const laneIndex = nextLaneAvailability.findIndex((availableAt) => availableAt <= item.start_time);
      const resolvedLane = laneIndex === -1 ? 0 : laneIndex;
      const width = Math.max(92, item.content.length * 16 + 28);
      const duration = Math.max(8.2, width / DANMAKU_SCROLL_SPEED_PX_PER_SECOND + 7.1);
      nextLaneAvailability[resolvedLane] =
        item.start_time + Math.min(duration * 0.42, 4.4) + DANMAKU_SCROLL_GAP_PX / DANMAKU_SCROLL_SPEED_PX_PER_SECOND;

      nextActiveDanmakus.push({
        id: `${item.id}`,
        content: item.content,
        color: item.color,
        mode: "scroll",
        startTime: item.start_time,
        top: resolvedScrollLanes[resolvedLane],
        width,
        duration,
        opacity: 0.84,
      });
    }

    laneAvailableAtRef.current = nextLaneAvailability;
    emittedDanmakuIdsRef.current = replayedIds;
    setActiveDanmakus(nextActiveDanmakus);
    nextDanmakuIndexRef.current = pointer;
  };

  const emitDanmakuAroundCurrentTime = (currentTime: number) => {
    const startIndex = sortedDanmakus.findIndex((item) => item.start_time >= Math.max(0, currentTime - 0.12));
    if (startIndex === -1) {
      return;
    }

    let pointer = startIndex;
    while (
      pointer < sortedDanmakus.length &&
      sortedDanmakus[pointer].start_time <= currentTime + DANMAKU_SEEK_LOOKAHEAD_SECONDS
    ) {
      pushActiveDanmaku(sortedDanmakus[pointer]);
      pointer += 1;
    }
  };

  const removeActiveDanmaku = (id: string) => {
    setActiveDanmakus((prev) => prev.filter((item) => item.id !== id));
  };

  const handleVideoTimelineUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const currentTime = video.currentTime;
    setCurrentPlaybackTime(currentTime);
    if (Math.abs(currentTime - lastVideoTimeRef.current) > 1.35) {
      syncDanmakuTimeline(currentTime);
    }
    lastVideoTimeRef.current = currentTime;

    if (currentTime < 0.35 && nextDanmakuIndexRef.current >= sortedDanmakus.length) {
      resetDanmakuRuntime();
    }

    handleVideoTimeUpdate();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleSeeking = () => {
      const currentTime = video.currentTime;
      lastVideoTimeRef.current = currentTime;
      window.setTimeout(() => {
        syncDanmakuTimeline(currentTime);
      }, 0);
    };

    video.addEventListener("seeking", handleSeeking);
    video.addEventListener("seeked", handleSeeking);
    return () => {
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("seeked", handleSeeking);
    };
  }, [resolvedScrollLanes, sortedDanmakus]);

  useEffect(() => {
    if (danmakuEnabled && videoPlaying) {
      handleVideoTimeUpdate();
    }
  }, [danmakuEnabled, videoPlaying, sortedDanmakus]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const syncPlaybackClock = () => {
      setCurrentPlaybackTime(Number(video.currentTime || 0));
    };

    syncPlaybackClock();
    const timer = window.setInterval(syncPlaybackClock, 120);
    return () => {
      window.clearInterval(timer);
    };
  }, [activeVideoSrc, videoPlaying]);

  useEffect(() => {
    if (!danmakuEnabled || sortedDanmakus.length === 0) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const currentTime = Math.max(
      Number(video.currentTime || 0),
      pendingResumeTimeRef.current ?? 0,
      shouldAutoplayOnEnter ? resumeStartAt : 0,
    );
    if (currentTime <= 0) {
      return;
    }

    window.setTimeout(() => {
      syncDanmakuTimeline(currentTime);
      lastVideoTimeRef.current = currentTime;
    }, 0);
  }, [danmakuEnabled, resumeStartAt, shouldAutoplayOnEnter, sortedDanmakus]);

  const handleSendDanmaku = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDanmakuText.trim()) return;

    const startTime = Number(videoRef.current?.currentTime || 0);
    const content = newDanmakuText.trim();

    void (async () => {
      try {
        const created = await studentApi.createVideoDanmaku({
          video_key: activeVideoKey,
          content,
          color: danmakuColor,
          mode: danmakuMode,
          start_time: startTime,
        });
        setPersistedDanmakus((prev) => [...prev, created]);
        if (Math.abs(startTime - Number(videoRef.current?.currentTime || 0)) < 1.2) {
          pushActiveDanmaku(created);
        }
        setNewDanmakuText("");
        showToast("学友弹幕成功发射并登屏！🚀");
      } catch {
        showToast("弹幕发送失败，请稍后重试");
      }
    })();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2850);
  };

  const formatCommentDate = (createdAt?: string | null) => {
    if (!createdAt) {
      return "刚刚";
    }
    const parsed = new Date(createdAt);
    if (Number.isNaN(parsed.getTime())) {
      return createdAt;
    }
    const diffMinutes = Math.max(0, Math.round((Date.now() - parsed.getTime()) / 60000));
    if (diffMinutes < 1) {
      return "刚刚";
    }
    if (diffMinutes < 60) {
      return `${diffMinutes} 分钟前`;
    }
    if (diffMinutes < 1440) {
      return `${Math.floor(diffMinutes / 60)} 小时前`;
    }
    return `${Math.floor(diffMinutes / 1440)} 天前`;
  };

  const mapCourseComment = (item: CourseCommentItem): CourseComment => ({
    id: item.id,
    author: item.author,
    text: item.content,
    date: formatCommentDate(item.created_at),
    createdAt: item.created_at,
    likes: item.likes,
    badge: item.badge || "课堂互动",
    liked: item.liked,
    replyTo: item.reply_to?.author,
    parentCommentId: item.parent_comment_id,
  });

  const getCommentTimestamp = (comment: CourseComment) => {
    if (!comment.createdAt) {
      return 0;
    }
    const parsed = new Date(comment.createdAt).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const nestedComments = useMemo(() => {
    const compareTopLevel = (a: CourseComment, b: CourseComment) => {
      if (commentSort === "hot" && b.likes !== a.likes) {
        return b.likes - a.likes;
      }
      const timeDiff = getCommentTimestamp(b) - getCommentTimestamp(a);
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return b.id - a.id;
    };

    const compareReplies = (a: CourseComment, b: CourseComment) => {
      const timeDiff = getCommentTimestamp(a) - getCommentTimestamp(b);
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return a.id - b.id;
    };

    const childrenByParent = new Map<number, CourseComment[]>();
    const topLevel: CourseComment[] = [];

    comments.forEach((comment) => {
      if (comment.parentCommentId) {
        const siblings = childrenByParent.get(comment.parentCommentId) || [];
        siblings.push(comment);
        childrenByParent.set(comment.parentCommentId, siblings);
        return;
      }
      topLevel.push(comment);
    });

    topLevel.sort(compareTopLevel);
    childrenByParent.forEach((items) => items.sort(compareReplies));

    const buildNestedChild = (comment: CourseComment, depth: number): Array<{ item: CourseComment; depth: number }> => {
      const children = childrenByParent.get(comment.id) || [];
      return [
        { item: comment, depth },
        ...children.flatMap((child) => buildNestedChild(child, depth + 1)),
      ];
    };

    return topLevel.flatMap((comment) => buildNestedChild(comment, 0));
  }, [commentSort, comments]);

  const hydrateCourseComments = async () => {
    const existing = await studentApi.listCourseComments({
      course_key: courseId,
      section_index: activeEpisodeIdx,
      limit: 100,
    });
    if (existing.total > 0) {
      setComments(existing.items.map(mapCourseComment));
      return;
    }

    const presetComments = PRESET_COMMENTS_BY_COURSE[courseId] || PRESET_COMMENTS_BY_COURSE["series-1"] || [];
    if (!presetComments.length) {
      setComments([]);
      return;
    }

    const seeded: CourseComment[] = [];
    for (const preset of presetComments) {
      const created = await studentApi.createCourseComment({
        course_key: courseId,
        section_index: activeEpisodeIdx,
        content: preset.content,
      });
      seeded.push(
        mapCourseComment({
          ...created,
          author: preset.userId === 1002 ? "学者 Zack Dev" : preset.userId === 1003 ? "学者 Emily UI" : created.author,
          badge: preset.userId === 1002 ? "高赞笔记" : preset.userId === 1003 ? "课堂总结" : created.badge,
        }),
      );
    }
    setComments(seeded);
  };

  const handleVideoPlayPause = async () => {
    if (!videoRef.current) {
      return;
    }

    if (!videoRef.current.paused) {
      videoRef.current.pause();
      setVideoPlaying(false);
      return;
    }

    try {
      await videoRef.current.play();
      setVideoPlaying(true);
    } catch {
      showToast("当前视频暂时无法播放，请稍后重试");
    }
  };

  const handleToggleFavorite = () => {
    setIsFavorite(!isFavorite);
    // Dynamic feedback
    showToast(isFavorite ? "已移出我的研学收藏夹" : "已成功加入我的研学收藏夹！");
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userComment.trim() || submittingComment) return;

    const content = userComment.trim();
    const activeReplyTarget = replyTarget;
    const optimisticId = localTempCommentId--;
    const optimisticComment: CourseComment = {
      id: optimisticId,
      author: "你",
      text: content,
      date: "刚刚",
      createdAt: new Date().toISOString(),
      likes: 0,
      badge: "我的讨论",
      liked: false,
      replyTo: activeReplyTarget?.author,
      parentCommentId: activeReplyTarget?.id ?? null,
    };
    setSubmittingComment(true);
    setReplyTarget(null);
    setUserComment("");
    setComments((prev) => [optimisticComment, ...prev]);

    void (async () => {
      try {
        await Promise.race([
          studentApi.createCourseComment({
            course_key: courseId,
            section_index: activeEpisodeIdx,
            content,
            parent_comment_id: activeReplyTarget?.id,
          }),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error("COMMENT_SUBMIT_TIMEOUT")), 8000),
          ),
        ]);
        await hydrateCourseComments();
        showToast("讨论已发布");
      } catch {
        setComments((prev) => prev.filter((comment) => comment.id !== optimisticId));
        setUserComment(content);
        setReplyTarget(activeReplyTarget);
        showToast("讨论发布失败，请稍后重试");
      } finally {
        setSubmittingComment(false);
      }
    })();
  };

  const handleToggleCommentLike = (commentId: number) => {
    const target = comments.find((item) => item.id === commentId);
    if (!target) {
      return;
    }

    void (async () => {
      try {
        const result = await studentApi.toggleCourseCommentLike(target.id);
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  liked: result.liked,
                  likes: result.likes,
                }
              : comment,
          ),
        );
        showToast(result.liked ? "已赞同这条讨论" : "已取消赞同");
      } catch {
        showToast("点赞失败，请稍后重试");
      }
    })();
  };

  const handleReplyComment = (commentId: number, author: string) => {
    setReplyTarget({ id: commentId, author });
    window.setTimeout(() => {
      commentInputRef.current?.focus();
      commentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
    showToast(`已切换到回复输入，可直接回复 ${author}`);
  };

  let categoryZh = "通用研学航道";
  if (course.category === "Design" || course.category === "Programming") categoryZh = "数字艺术重构航道";
  if (course.category === "Data") categoryZh = "数据智能与可视化航道";

  let courseTitleZh = course.title;
  if (course.title.includes("Advanced Machine Learning")) courseTitleZh = "前沿机器学习实战：极深反向传播与梯度策略";
  if (course.title.includes("Modern React Architecture")) courseTitleZh = "现代化 React 架构：极致组件虚拟化与 Context 多维切片";
  if (course.title.includes("Creative Front-End CSS Physics")) courseTitleZh = "创意前端物理动效：三维流体粒子系统与贝塞尔重力刚体";
  if (course.title.includes("Data Storytelling Masterclass")) courseTitleZh = "D3 数据叙事表达：高对比动态图表与视觉推演";

  let uploaderZh = course.uploader;
  if (course.uploader.includes("Dr. Alexander")) uploaderZh = "刘博士 (学海带头人)";
  if (course.uploader.includes("Prof. Sarah")) uploaderZh = "萨教授 (首席主讲)";
  if (course.uploader.includes("Justin")) uploaderZh = "架构师 Justin";

  let courseSummaryZh = "围绕核心知识点、典型案例与实操节奏展开讲解，适合边看边记，快速形成完整理解。";
  if (course.title.includes("Advanced Machine Learning")) {
    courseSummaryZh = "聚焦反向传播、梯度稳定与深层网络训练策略，把公式理解和模型直觉一起建立起来。";
  }
  if (course.title.includes("Modern React Architecture")) {
    courseSummaryZh = "围绕状态边界、组件拆分与渲染优化展开，帮助你把 React 工程结构真正搭稳。";
  }
  if (course.title.includes("Creative Front-End CSS Physics")) {
    courseSummaryZh = "从动效力学到视觉节奏，拆解粒子、弹性和空间感，适合前端视觉表达进阶。";
  }
  if (course.title.includes("Data Storytelling Masterclass")) {
    courseSummaryZh = "把数据结构、图表表现和故事表达串成一条线，适合提升信息设计与可视化思维。";
  }

  const courseMetaResolved: Record<string, { category: string; title: string; uploader: string; summary: string }> = {
    "series-1": {
      category: "数字艺术重构航道",
      title: "现代 Web 设计系统实战",
      uploader: "TechElite Academy",
      summary: "围绕设计规范、组件体系、页面层级与交互协同展开讲解，适合在看课过程中同步沉淀成自己的设计系统方法论。",
    },
    "series-2": {
      category: "研发重构进阶航道",
      title: "React 高阶模式与性能优化",
      uploader: "Design Mastery Lab",
      summary: "系统拆解状态边界、复合组件、上下文切片与渲染优化，帮助你把 React 工程能力真正用到复杂业务场景里。",
    },
    "series-3": {
      category: "数字艺术重构航道",
      title: "微交互与界面动效设计",
      uploader: "Sarah Jenkins Studio",
      summary: "从弹性、惯性到节奏控制，分步骤讲清微交互中的物理感表达与视觉反馈，让界面呈现更完整的生命力。",
    },
    "course-4": {
      category: "数据智能与可视化航道",
      title: "D3.js 数据叙事与可视化表达",
      uploader: "DataInsights Research",
      summary: "通过坐标映射、图表层级与过渡动画，把原始数据整理成有表达力的数据叙事页面，强化分析与展示一体化能力。",
    },
  };
  const resolvedMeta = courseMetaResolved[courseId] ?? {
    category: "通用研学航道",
    title: course.title,
    uploader: course.uploader,
    summary: "围绕核心知识点、典型案例与实操节奏展开讲解，适合边看边记，快速形成完整理解。",
  };

  return (
    <div className="space-y-6" id="course-learning-classroom">
      
      {/* Dynamic Header Path Indicator */}
      <div className="flex items-center justify-between text-xs text-[#564145]">
        <div className="flex items-center gap-1.5 font-mono">
          <Link to="/" className="hover:text-[#fb7299]">首页</Link>
          <span>/</span>
          <span className="text-[#fb7299] font-bold">{resolvedMeta.category}</span>
          <span>/</span>
          <span className="truncate">{resolvedMeta.title}</span>
        </div>
      </div>

      {/* Main Classroom Double Column Panel */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left Column: Player & Metadata Detail Sheets */}
        <div className="flex-grow space-y-6 min-w-0">
          
          {/* Lecture Player with Custom Bullet Comments Layer */}
          <div className="rounded-t-3xl bg-black overflow-hidden relative aspect-video shadow-lg border-t border-x border-[#E3E8EC] group">
            {/* Real-time HTML Overlay Bullet comments */}
            {danmakuEnabled && (
              <div
                className="absolute inset-x-0 top-0 bottom-12 pointer-events-none overflow-hidden z-20 select-none"
                data-danmaku-debug={`${currentPlaybackTime.toFixed(2)}|${visibleDanmakus.length}|${persistedDanmakus.length}`}
              >
                {visibleDanmakus.map((dan) =>
                  dan.mode === "scroll" ? (
                    <div
                      key={dan.id}
                      className="danmaku-item absolute whitespace-nowrap text-sm font-bold opacity-95"
                      style={{
                        top: dan.top,
                        left: "100%",
                        color: dan.color,
                        width: `${dan.width}px`,
                        opacity: dan.opacity ?? 0.76,
                        animationDuration: `${dan.duration}s`,
                        animationPlayState: videoPlaying ? "running" : "paused",
                      }}
                      onAnimationEnd={() => removeActiveDanmaku(dan.id)}
                    >
                      {dan.content}
                    </div>
                  ) : (
                    <div
                      key={dan.id}
                      className="danmaku-fixed-item absolute left-1/2 -translate-x-1/2 whitespace-nowrap px-1 text-sm font-bold opacity-95"
                      style={{
                        top: dan.mode === "top" ? "8%" : undefined,
                        bottom: dan.mode === "bottom" ? "8%" : undefined,
                        color: dan.color,
                        opacity: dan.opacity ?? 0.76,
                        animationDuration: `${dan.duration}s`,
                        animationPlayState: videoPlaying ? "running" : "paused",
                      }}
                      onAnimationEnd={() => removeActiveDanmaku(dan.id)}
                    >
                      {dan.content}
                    </div>
                  ),
                )}
              </div>
            )}

            <video
              id="classroom-video-tag"
              ref={videoRef}
              key={activeEpisodeIdx} // Remounts to reset play status if switched
              controls
              autoPlay={false}
              className="w-full h-full object-cover"
              poster={course.image}
              onPlay={() => setVideoPlaying(true)}
              onPause={() => setVideoPlaying(false)}
              onTimeUpdate={handleVideoTimelineUpdate}
            >
              <source
                src={activeVideoSrc}
                type="video/mp4"
              />
            </video>
          </div>

          {/* BiliLearn Bullet Control Center Bar */}
          <div className="bg-[#171c22] border-b border-x border-[#E3E8EC]/15 px-4 py-3 rounded-b-3xl flex flex-col sm:flex-row items-center gap-3 shadow-xl -mt-0.5 mb-6">
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDanmakuEnabled(!danmakuEnabled)}
                className={`px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition-all ${
                  danmakuEnabled
                    ? "bg-[#fb7299] text-white hover:bg-[#fb7299]/90"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>{danmakuEnabled ? "弹幕已开启" : "弹幕已关闭"}</span>
              </button>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">({persistedDanmakus.length} 条课堂弹幕)</span>
            </div>

            <form onSubmit={handleSendDanmaku} className="flex-grow w-full flex items-center gap-2">
              <input
                type="text"
                placeholder="发一条课堂弹幕，留下你的即时想法..."
                value={newDanmakuText}
                onChange={(e) => setNewDanmakuText(e.target.value)}
                maxLength={45}
                className="flex-grow bg-slate-800/85 hover:bg-slate-800 focus:bg-slate-900 border border-slate-700/80 focus:border-[#fb7299]/50 rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-hidden transition-all text-ellipsis"
              />
              <button
                type="submit"
                className="bg-[#fb7299] hover:bg-[#fb7299]/90 text-white rounded-xl px-3 py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>发送弹幕</span>
              </button>
            </form>
          </div>

          {/* Player controls metadata title bar */}
          <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-[#fb7299]/10 text-[#fb7299] text-[10px] font-extrabold px-2.5 py-1 rounded-full tracking-[0.16em]">
                    精品随堂实录
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                    第 {activeEpisodeIdx + 1} 课
                  </span>
                </div>
                <h1 className="font-sans text-xl md:text-2xl font-extrabold text-[#171c22]">
                  {resolvedMeta.title}
                </h1>
                <p className="text-sm text-[#415066] font-sans font-semibold">
                  {episodes[activeEpisodeIdx].title}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#64748b]">
                  <span className="rounded-full bg-slate-50 px-2.5 py-1">时长约 {episodes[activeEpisodeIdx].duration}</span>
                  <span className="rounded-full bg-slate-50 px-2.5 py-1">建议边看边记</span>
                  <span className="rounded-full bg-slate-50 px-2.5 py-1">资源已配套</span>
                </div>
                <p className="max-w-3xl text-xs leading-6 text-[#564145]/88">
                  {resolvedMeta.summary}
                </p>
              </div>

              {/* Action utilities */}
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleToggleFavorite}
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                    isFavorite 
                      ? "bg-[#fb7299]/10 border-[#fb7299] text-[#fb7299]" 
                      : "border-[#E3E8EC] hover:bg-slate-50 text-[#564145]"
                  }`}
                  title="收藏本课"
                >
                  <Heart className={`w-4.5 h-4.5 ${isFavorite ? "fill-current" : ""}`} />
                </button>
                <button
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(window.location.href);
                    } catch (e) {}
                    showToast("大作业直通分享链接已成功复制！");
                  }}
                  className="p-2.5 rounded-xl border border-[#E3E8EC] hover:bg-slate-50 flex items-center justify-center text-[#564145] transition-all cursor-pointer"
                  title="分享链接"
                >
                  <Share2 className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* Author details */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {course.uploaderAvatar ? (
                <div className="w-9 h-9 rounded-full overflow-hidden border border-[#ddbfc4] shrink-0">
                  <img
                    src={course.uploaderAvatar}
                    alt={resolvedMeta.uploader}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <UserCircle className="w-9 h-9 text-[#fb7299]" />
              )}
              <div className="space-y-1">
                <p className="font-bold text-[#171c22]">{resolvedMeta.uploader}</p>
                <p className="text-[10px] text-[#564145]/70">BiliLearn 认证讲师</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#64748b] sm:ml-auto">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">课程难度：进阶</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">适合场景：课堂实战</span>
              </div>
            </div>
          </section>

          {/* Interactive Comments Panel */}
          <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-sans text-lg font-extrabold text-[#171c22]">
                  学友研学讨论区
                </h3>
                <p className="mt-1 text-[11px] font-medium text-[#564145]/72">
                  当前共 {comments.length} 条交流，可用于记录收获、补充案例与追问难点。
                </p>
              </div>
              <span className="inline-flex self-start rounded-full border border-[#fb7299]/15 bg-[#fb7299]/8 px-2.5 py-1 text-[10px] font-bold text-[#fb7299]">
                课堂讨论
              </span>
            </div>

            <form
              onSubmit={handlePostComment}
              className="rounded-2xl border border-[#edf1f5] bg-[linear-gradient(180deg,#fcfdff,#f8fbff)] p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#171c22]">发布你的课堂观点</p>
                  <p className="mt-1 text-[10px] text-[#564145]/65">可以写结论、补充案例，或说明你的卡点。</p>
                </div>
                <span className="shrink-0 text-[10px] font-mono text-[#564145]/55">{userComment.trim().length}/120</span>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                <input
                  ref={commentInputRef}
                  type="text"
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  maxLength={120}
                  disabled={submittingComment}
                  placeholder={replyTarget ? `回复 ${replyTarget.author}，补充你的观点...` : "写下你的想法、疑问，或这节课最值得记住的一点..."}
                  className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#171c22] outline-none transition-all placeholder:text-[#94a3b8] disabled:cursor-wait disabled:bg-slate-50 disabled:text-slate-400 focus:border-[#fb7299]/45 focus:ring-2 focus:ring-[#fb7299]/12"
                />
                <button
                  type="submit"
                  disabled={submittingComment}
                  className="shrink-0 rounded-2xl bg-[#fb7299] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(251,114,153,0.18)] transition-all hover:bg-[#fb7299]/92 disabled:cursor-wait disabled:opacity-70 sm:min-w-[132px]"
                >
                  {submittingComment ? "发布中..." : "发布讨论"}
                </button>
              </div>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-[#64748b]">
                当前按{commentSort === "latest" ? "最新" : "最热"}排序，回复收在原评论下方。
              </div>
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setCommentSort("latest")}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                    commentSort === "latest" ? "bg-white text-[#171c22] shadow-sm" : "text-[#64748b]"
                  }`}
                >
                  最新
                </button>
                <button
                  type="button"
                  onClick={() => setCommentSort("hot")}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                    commentSort === "hot" ? "bg-white text-[#171c22] shadow-sm" : "text-[#64748b]"
                  }`}
                >
                  最热
                </button>
              </div>
            </div>

            {replyTarget ? (
              <div className="flex items-center justify-between rounded-2xl border border-[#fb7299]/18 bg-[#fff7fa] px-4 py-3 text-[12px] text-[#a64b6d]">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-[#fb7299]" />
                  <span>正在回复 <span className="font-bold">{replyTarget.author}</span></span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  className="rounded-full px-2 py-1 text-[11px] font-bold text-[#fb7299] transition-colors hover:bg-[#fb7299]/10"
                >
                  取消回复
                </button>
              </div>
            ) : null}

            <div className="space-y-3">
              {nestedComments.map(({ item: comment, depth }) => (
                <article
                  key={comment.id}
                  className={`rounded-2xl border bg-[linear-gradient(180deg,#ffffff,#fbfdff)] px-4 py-4 transition-colors hover:border-[#fb7299]/18 ${
                    depth > 0
                      ? "border-[#f3d6df] bg-[linear-gradient(180deg,#fffafb,#ffffff)] shadow-[inset_3px_0_0_rgba(251,114,153,0.18)]"
                      : "border-slate-100"
                  }`}
                  style={{ marginLeft: `${depth * 20}px` }}
                >
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ecf7ff,#d6ebff)] text-sm font-black text-[#2563eb] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                      {comment.author[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-sm font-extrabold text-[#171c22]">{comment.author}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          {comment.badge || "课堂互动"}
                        </span>
                        <span className="text-[10px] font-mono text-[#564145]/60">{comment.date}</span>
                      </div>
                      {comment.replyTo ? (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#fb7299]/8 px-2.5 py-1 text-[11px] font-medium text-[#c25179]">
                          <span className="text-[#fb7299]">@</span>
                          <span>{comment.replyTo}</span>
                        </div>
                      ) : null}
                      <p className="mt-2 text-sm leading-7 text-[#415066]">{comment.text}</p>
                      <div className="mt-3 flex items-center gap-3 text-[11px] font-medium text-[#6b7280]">
                        <button
                          type="button"
                          onClick={() => handleToggleCommentLike(comment.id)}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors ${
                            comment.liked
                              ? "bg-[#fb7299]/10 text-[#fb7299]"
                              : "hover:bg-slate-100 hover:text-[#171c22]"
                          }`}
                        >
                          <ThumbsUp className={`h-3.5 w-3.5 ${comment.liked ? "fill-current" : ""}`} />
                          <span>赞同 {comment.likes}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReplyComment(comment.id, comment.author)}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-slate-100 hover:text-[#171c22]"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>回复</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

        </div>

        {/* Right Column: Episodes & Direct Shortcut Panels */}
        <aside className="w-full lg:w-80 shrink-0 space-y-6">
          
          {/* Episodes Playlist selector */}
          <section className="bg-white rounded-3xl border border-[#E3E8EC] p-5 shadow-sm">
            <h2 className="font-sans text-xs font-extrabold tracking-wider uppercase text-[#171c22] border-b border-gray-50 pb-2.5 mb-3">
              本课题下辖章节目录
            </h2>

            <div className="space-y-2">
              {episodes.map((ep, idx) => {
                const isActive = idx === activeEpisodeIdx;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveEpisodeIdx(idx)}
                    className={`w-full text-left p-3 rounded-xl transition-all border flex items-start gap-2.5 cursor-pointer ${
                      isActive 
                        ? "bg-[#fb7299]/5 border-[#fb7299]/40 text-[#fb7299]" 
                        : "bg-white border-transparent hover:border-gray-200"
                    }`}
                  >
                    <Tv className={`w-4 h-4 shrink-0 mt-0.5 ${isActive ? "text-[#fb7299]" : "text-[#564145]/70"}`} />
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${isActive ? "text-[#fb7299]" : "text-[#171c22]"}`}>
                        {ep.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-[#564145]/70 font-mono">
                        <span>{ep.duration} 分钟</span>
                        {ep.watched && (
                          <span className="text-emerald-600 font-bold font-sans text-[8px] flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> 已看完
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Integrated Study Tools Redirect Link shortcuts */}
          <section className="bg-white rounded-3xl border border-[#E3E8EC] p-5 shadow-sm space-y-4">
            <h3 className="font-sans text-xs font-extrabold tracking-wider uppercase text-[#171c22] border-b border-gray-50 pb-2">
              随堂自测与文献拓展工具
            </h3>

            <div className="space-y-3">
              
              {/* Pointing to Resources */}
              <button
                onClick={() => navigate(`/resources?courseId=${course.id}`)}
                className="w-full text-left rounded-2xl border border-[#e6edf5] bg-[linear-gradient(180deg,#f9fbff,#f3f7fc)] px-3.5 py-3.5 transition-all hover:border-[#cfdceb] hover:shadow-[0_12px_26px_rgba(15,23,42,0.06)] flex items-center justify-between cursor-pointer text-[#171c22]"
              >
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fb7299]/10 text-[#fb7299]"><BookOpen className="w-4 h-4" /></div>
                  <div>
                    <p className="font-bold">随堂幻灯精品教辅</p>
                    <p className="text-[10px] text-[#564145]/70">精细考点 PDF 文献与大纲包</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#564145]/50 shrink-0" />
              </button>

              {/* Pointing to evaluation */}
              <button
                onClick={() => navigate(`/evaluation?courseId=${course.id}`)}
                className="w-full text-left rounded-2xl border border-[#d7e7ea] bg-[linear-gradient(180deg,#f7fcfd,#eef8fa)] px-3.5 py-3.5 transition-all hover:border-[#bdd6dc] hover:shadow-[0_12px_26px_rgba(15,23,42,0.06)] flex items-center justify-between cursor-pointer text-[#171c22]"
              >
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#006689]/10 text-[#006689]"><Award className="w-4 h-4" /></div>
                  <div>
                    <p className="font-bold">高难要点阶段评测</p>
                    <p className="text-[10px] text-[#564145]/70">一题测出理论实践短板</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#564145]/50 shrink-0" />
              </button>

          {/* Pointing to AI Tutor query params */}
              <button
                onClick={() => {
                  const askQuery = `BiliBot老师，我想深度向您请教关于《${courseTitleZh}》第 ${activeEpisodeIdx + 1} 章中关于优化与性能防御机制的最佳实践？`;
                  navigate(`/tutor?courseId=${course.id}&query=${encodeURIComponent(askQuery)}`);
                }}
                className="w-full text-left rounded-2xl border border-amber-100 bg-[linear-gradient(180deg,#fffaf1,#fff5df)] px-3.5 py-3.5 transition-all hover:border-amber-200 hover:shadow-[0_12px_26px_rgba(15,23,42,0.06)] flex items-center justify-between cursor-pointer text-[#171c22]"
              >
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Bot className="w-4 h-4" /></div>
                  <div>
                    <p className="font-bold">提问 AI 导师 BiliBot</p>
                    <p className="text-[10px] text-[#564145]/70">扫清编译报错或逻辑公式死角</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#564145]/50 shrink-0" />
              </button>

            </div>
          </section>

        </aside>

      </div>

      {/* 4. Bottom Section: Other Recommended Courses switched directly in Classroom */}
      <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-50 pb-3">
          <h3 className="font-sans text-sm font-extrabold text-[#171c22] flex items-center gap-1.5">
            <span className="w-2.5 h-4.5 bg-[#fb7299] rounded-sm shrink-0"></span>
            同等学期其他精品研学课堂
          </h3>
          <span className="text-[10px] text-[#564145]/70">点击可瞬间切换当前自测试看</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {COURSES.filter(c => c.id !== course.id).map(otherCourse => {
            let otherTitleZh = otherCourse.title;
            if (otherCourse.title.includes("Advanced Machine Learning")) otherTitleZh = "前沿机器学习：极深反向传播神经网络";
            if (otherCourse.title.includes("Modern React Architecture")) otherTitleZh = "现代化 React 架构：组件虚拟化性能级联";
            if (otherCourse.title.includes("Creative Front-End CSS Physics")) otherTitleZh = "创意前端物理动效：三维流体粒子系统与贝塞尔重力";
            if (otherCourse.title.includes("Data Storytelling Masterclass")) otherTitleZh = "D3.js 数据可视化与高对比度动态树图表";

            let categoryZh = "其他研学";
            if (otherCourse.category === "Design") categoryZh = "数字艺术";
            if (otherCourse.category === "Programming") categoryZh = "研发重构";
            if (otherCourse.category === "Data") categoryZh = "数据智能";

            const otherTeacher =
              otherCourse.id === "series-2"
                ? "Design Mastery Lab"
                : otherCourse.id === "series-3"
                  ? "Sarah Jenkins Studio"
                  : otherCourse.id === "course-4"
                    ? "DataInsights Research"
                    : otherCourse.uploader;

            const otherHighlight =
              otherCourse.id === "series-2"
                ? "界面叙事"
                : otherCourse.id === "series-3"
                  ? "品牌表达"
                  : otherCourse.id === "course-4"
                    ? "数据洞察"
                    : "学习专题";

            return (
              <button
                key={otherCourse.id}
                onClick={() => {
                  navigate(`/learn?courseId=${otherCourse.id}`);
                  setActiveEpisodeIdx(0); // reset episode selection to first one
                  showToast(`已为您成功切换至课题：《${otherTitleZh}》`);
                }}
                className="group border border-[#E3E8EC] hover:border-[#fb7299]/30 rounded-2xl p-3.5 bg-[linear-gradient(180deg,#ffffff,#fbfcff)] hover:bg-slate-50/50 transition-all flex gap-3 text-left items-start cursor-pointer transition-transform hover:scale-[1.01] hover:shadow-[0_14px_30px_rgba(15,23,42,0.06)]"
              >
                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-slate-100 relative shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <img
                    src={otherCourse.image}
                    alt={otherTitleZh}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                </div>
                {/* Content info */}
                <div className="min-w-0 flex flex-col justify-between py-0.5">
                  <span className="text-[8px] bg-slate-100 text-[#564145] font-extrabold px-1.5 py-0.2 rounded self-start font-mono uppercase">
                    {categoryZh}
                  </span>
                  <h4 className="text-xs font-bold text-[#171c22] mt-1 group-hover:text-[#fb7299] transition-colors truncate">
                    {otherTitleZh}
                  </h4>
                  <p className="text-[9.5px] text-[#564145]/70 font-mono mt-0.5">
                    主讲: {otherCourse.id === "series-2" ? "Design Mastery Lab" : otherCourse.id === "series-3" ? "Sarah Jenkins Studio" : otherCourse.id === "course-4" ? "DataInsights Research" : otherCourse.uploader}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

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
