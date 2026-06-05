import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  Clock,
  FileText,
  FolderDown,
  LoaderCircle,
  Lock,
  Mail,
  MessageCircle,
  MessageSquare,
  PlayCircle,
  Send,
  Sparkles,
  ThumbsUp,
  Tv,
} from "lucide-react";
import {
  ACTIVE_COURSE_ID,
  buildEvaluationRoute,
  buildLearnRoute,
  buildPathRoute,
  buildResourcesRoute,
  buildTutorRoute,
  resolveCourseIdFromSearchParams,
} from "../lib/courseContext";
import { studentApi, type CourseCommentItem, type LearningCourseDetail, type ResourceCard, type ResourceSourceFileRef, type VideoDanmakuItem } from "../lib/studentApi";

type DanmakuMode = "scroll" | "top" | "bottom";

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
  likes: number;
  badge?: string;
  liked?: boolean;
  replyTo?: string;
  parentCommentId?: number | null;
};

type ReplyTarget = {
  id: number;
  author: string;
};

const DANMAKU_SCROLL_LANES = ["12%", "22%", "32%", "42%", "52%"];
const DANMAKU_FIXED_DURATION = 3.6;
const DANMAKU_SCROLL_SPEED_PX_PER_SECOND = 132;
const DANMAKU_SCROLL_GAP_PX = 124;
const DANMAKU_SEEK_LOOKAHEAD_SECONDS = 0.45;
const DANMAKU_MAX_FIXED_STACK = 1;

function formatDate(value?: string | null) {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function mapComments(items: CourseCommentItem[]): CourseComment[] {
  return items.map((item) => ({
    id: item.id,
    author: item.author,
    text: item.content,
    date: formatDate(item.created_at),
    likes: item.likes,
    badge: item.badge || undefined,
    liked: item.liked,
    replyTo: item.reply_to?.author,
    parentCommentId: item.parent_comment_id ?? null,
  }));
}

function resolveVideoSrc(playbackUrl?: string | null) {
  if (!playbackUrl) return "";
  return studentApi.buildResourceSourceFileUrl(playbackUrl);
}

function findFallbackCoursewareFile(resources: ResourceCard[]): { resource: ResourceCard; file: ResourceSourceFileRef } | null {
  const preferredExtensions = [".pdf", ".ppt", ".pptx"];
  for (const extension of preferredExtensions) {
    for (const resource of resources) {
      for (const file of resource.source_files || []) {
        if ((file.file_extension || "").toLowerCase() === extension) {
          return { resource, file };
        }
      }
    }
  }
  return null;
}

export default function CourseLearning() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = resolveCourseIdFromSearchParams(searchParams, ACTIVE_COURSE_ID);
  const sectionIdFromUrl = Number(searchParams.get("sectionId") || "");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nextDanmakuIndexRef = useRef(0);
  const laneAvailableAtRef = useRef<number[]>(new Array(DANMAKU_SCROLL_LANES.length).fill(0));
  const emittedDanmakuIdsRef = useRef<Set<number>>(new Set());

  const [course, setCourse] = useState<LearningCourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [fallbackCourseware, setFallbackCourseware] = useState<{ resource: ResourceCard; file: ResourceSourceFileRef } | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [danmakuEnabled, setDanmakuEnabled] = useState(true);
  const [persistedDanmakus, setPersistedDanmakus] = useState<VideoDanmakuItem[]>([]);
  const [activeDanmakus, setActiveDanmakus] = useState<ActiveCourseDanmaku[]>([]);
  const [newDanmakuText, setNewDanmakuText] = useState("");
  const [danmakuColor, setDanmakuColor] = useState("#fb7299");
  const [danmakuMode, setDanmakuMode] = useState<DanmakuMode>("scroll");
  const [comments, setComments] = useState<CourseComment[]>([]);
  const [userComment, setUserComment] = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const sections = useMemo(
    () => course?.chapters.flatMap((chapter) => chapter.sections.map((section) => ({ ...section, chapterName: chapter.name }))) || [],
    [course],
  );

  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId) || sections[0] || null,
    [activeSectionId, sections],
  );

  const activeVideoKey = useMemo(
    () => `${courseId}:${activeSection?.id || "section"}:${playbackUrl || "video"}`,
    [activeSection?.id, courseId, playbackUrl],
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 2800);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadCourse() {
      setLoading(true);
      setError(null);
      try {
        const detail = await studentApi.getLearningCourseDetail(courseId);
        if (cancelled) return;
        setCourse(detail);
        const detailSections = detail.chapters.flatMap((chapter) => chapter.sections);
        const resolvedSectionId =
          detailSections.find((section) => section.id === sectionIdFromUrl)?.id ||
          detail.latest_section_id ||
          detail.chapters[0]?.sections[0]?.id ||
          null;
        setActiveSectionId(resolvedSectionId);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "课堂数据加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCourse();
    return () => {
      cancelled = true;
    };
  }, [courseId, sectionIdFromUrl]);

  useEffect(() => {
    if (!activeSectionId) return;
    navigate(buildLearnRoute(courseId, activeSectionId), { replace: true });
  }, [activeSectionId, courseId, navigate]);

  useEffect(() => {
    if (!activeSection) return;
    let cancelled = false;

    async function loadPlayback() {
      const payload = await studentApi.getCourseSectionPlayInfo(courseId, activeSection.id);
      if (!cancelled) {
        setPlaybackUrl(resolveVideoSrc(payload.playback_url));
        setFallbackCourseware(null);
      }
    }

    void loadPlayback().catch(() => {
      if (!cancelled) {
        setPlaybackUrl("");
        setFallbackCourseware(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeSection, courseId]);

  useEffect(() => {
    if (playbackUrl) {
      setFallbackCourseware(null);
      return;
    }
    let cancelled = false;

    async function loadFallbackCourseware() {
      try {
        const response = await studentApi.listResources(1001, courseId);
        if (!cancelled) {
          setFallbackCourseware(findFallbackCoursewareFile(response.items));
        }
      } catch {
        if (!cancelled) {
          setFallbackCourseware(null);
        }
      }
    }

    void loadFallbackCourseware();
    return () => {
      cancelled = true;
    };
  }, [courseId, playbackUrl]);

  useEffect(() => {
    if (!activeSection) return;
    let cancelled = false;

    async function loadComments() {
      const response = await studentApi.listCourseComments({
        course_key: String(courseId),
        section_index: activeSection.index - 1,
        limit: 100,
      });
      if (!cancelled) {
        setComments(mapComments(response.items));
      }
    }

    void loadComments().catch(() => {
      if (!cancelled) setComments([]);
    });
    return () => {
      cancelled = true;
    };
  }, [activeSection, courseId]);

  useEffect(() => {
    if (!activeSection) return;
    let cancelled = false;

    async function loadDanmaku() {
      const response = await studentApi.listVideoDanmaku(activeVideoKey, 300);
      if (!cancelled) {
        setPersistedDanmakus(response.items);
      }
    }

    void loadDanmaku().catch(() => {
      if (!cancelled) setPersistedDanmakus([]);
    });
    return () => {
      cancelled = true;
    };
  }, [activeSection, activeVideoKey]);

  useEffect(() => {
    nextDanmakuIndexRef.current = 0;
    laneAvailableAtRef.current = new Array(DANMAKU_SCROLL_LANES.length).fill(0);
    emittedDanmakuIdsRef.current = new Set();
    setActiveDanmakus([]);
  }, [activeVideoKey]);

  const sortedDanmakus = useMemo(
    () => [...persistedDanmakus].sort((a, b) => a.start_time - b.start_time || a.id - b.id),
    [persistedDanmakus],
  );

  const emitDanmaku = (item: VideoDanmakuItem) => {
    if (emittedDanmakuIdsRef.current.has(item.id)) return;
    emittedDanmakuIdsRef.current.add(item.id);

    if (item.mode === "top" || item.mode === "bottom") {
      const sameModeCount = activeDanmakus.filter((dan) => dan.mode === item.mode).length;
      if (sameModeCount >= DANMAKU_MAX_FIXED_STACK) return;
      setActiveDanmakus((prev) => [
        ...prev,
        {
          id: String(item.id),
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

    const lane = laneAvailableAtRef.current.findIndex((availableAt) => availableAt <= item.start_time);
    const actualLane = lane === -1 ? 0 : lane;
    const width = Math.max(92, item.content.length * 16 + 28);
    const duration = Math.max(8.2, width / DANMAKU_SCROLL_SPEED_PX_PER_SECOND + 7.1);
    laneAvailableAtRef.current[actualLane] =
      item.start_time + Math.min(duration * 0.42, 4.4) + DANMAKU_SCROLL_GAP_PX / DANMAKU_SCROLL_SPEED_PX_PER_SECOND;

    setActiveDanmakus((prev) => [
      ...prev,
      {
        id: String(item.id),
        content: item.content,
        color: item.color,
        mode: "scroll",
        startTime: item.start_time,
        top: DANMAKU_SCROLL_LANES[actualLane],
        width,
        duration,
      },
    ]);
  };

  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !danmakuEnabled) return;
    const currentTime = video.currentTime;
    while (
      nextDanmakuIndexRef.current < sortedDanmakus.length &&
      sortedDanmakus[nextDanmakuIndexRef.current].start_time <= currentTime + DANMAKU_SEEK_LOOKAHEAD_SECONDS
    ) {
      emitDanmaku(sortedDanmakus[nextDanmakuIndexRef.current]);
      nextDanmakuIndexRef.current += 1;
    }
  };

  const handleDanmakuComplete = (id: string) => {
    setActiveDanmakus((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmitDanmaku = async () => {
    if (!newDanmakuText.trim() || !activeSection) return;
    try {
      const created = await studentApi.createVideoDanmaku({
        video_key: activeVideoKey,
        course_id: courseId,
        section_id: activeSection.id,
        content: newDanmakuText.trim(),
        color: danmakuColor,
        mode: danmakuMode,
        start_time: Math.max(0, videoRef.current?.currentTime || 0),
      });
      setPersistedDanmakus((prev) => [...prev, created]);
      setNewDanmakuText("");
      showToast("弹幕已发送");
    } catch {
      showToast("弹幕发送失败");
    }
  };

  const handleSubmitComment = async () => {
    if (!userComment.trim() || !activeSection) return;
    try {
      await studentApi.createCourseComment({
        course_key: String(courseId),
        section_index: activeSection.index - 1,
        content: userComment.trim(),
        parent_comment_id: replyTarget?.id,
      });
      const response = await studentApi.listCourseComments({
        course_key: String(courseId),
        section_index: activeSection.index - 1,
        limit: 100,
      });
      setComments(mapComments(response.items));
      setUserComment("");
      setReplyTarget(null);
      showToast("评论已发布");
    } catch {
      showToast("评论发布失败");
    }
  };

  const handleToggleCommentLike = async (commentId: number) => {
    try {
      const result = await studentApi.toggleCourseCommentLike(commentId);
      setComments((prev) =>
        prev.map((item) =>
          item.id === commentId ? { ...item, liked: result.liked, likes: result.likes } : item,
        ),
      );
    } catch {
      showToast("点赞失败");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-[#E3E8EC] bg-white text-sm font-semibold text-[#564145]">
        <span className="flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          正在加载课堂数据...
        </span>
      </div>
    );
  }

  if (error || !course || !activeSection) {
    return (
      <div className="rounded-3xl border border-[#E3E8EC] bg-white p-8 text-sm text-[#564145] shadow-sm">
        <p className="font-bold text-[#171c22]">课堂数据暂不可用</p>
        <p className="mt-2">{error || "当前课程或章节不存在。"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none" id="course-learning-workspace">
      <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase font-bold text-[#fb7299] tracking-wider font-mono">Live Classroom</p>
            <h1 className="text-2xl font-extrabold text-[#171c22]">{course.name}</h1>
            <p className="mt-2 text-sm text-[#564145]">当前课堂页已切到课程详情、章节和播放接口，不再使用本地课程常量与视频映射。</p>
          </div>
          <button
            onClick={() => navigate(buildPathRoute(courseId))}
            className="rounded-2xl bg-[#111827] px-4 py-3 text-sm font-bold text-white"
          >
            查看学习路径
          </button>
        </div>
      </section>

      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="flex-grow space-y-6">
          <section className="relative overflow-hidden rounded-3xl border border-[#E3E8EC] bg-black shadow-sm">
            {playbackUrl ? (
              <video
                ref={videoRef}
                controls
                autoPlay
                className="h-[260px] w-full bg-black object-cover md:h-[420px]"
                src={playbackUrl}
                onPlay={() => setVideoPlaying(true)}
                onPause={() => setVideoPlaying(false)}
                onTimeUpdate={handleVideoTimeUpdate}
              />
            ) : (
              <div className="flex h-[260px] items-center justify-center text-sm font-semibold text-white/70 md:h-[420px]">
                当前章节暂无可播放视频
              </div>
            )}

            {danmakuEnabled ? (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {activeDanmakus.map((dan) => (
                  <div
                    key={dan.id}
                    className="absolute whitespace-nowrap text-white"
                    style={{
                      top: dan.mode === "scroll" ? dan.top : dan.mode === "top" ? "12%" : "80%",
                      color: dan.color,
                      left: dan.mode === "scroll" ? "100%" : "50%",
                      transform: dan.mode === "scroll" ? undefined : "translateX(-50%)",
                      width: dan.width ? `${dan.width}px` : undefined,
                      animation: dan.mode === "scroll" ? `danmaku-scroll ${dan.duration}s linear` : `danmaku-fade ${dan.duration}s linear`,
                      opacity: dan.opacity,
                    }}
                    onAnimationEnd={() => handleDanmakuComplete(dan.id)}
                  >
                    {dan.content}
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#171c22]">{activeSection.name}</h2>
                <p className="text-xs text-[#564145]/70">{activeSection.chapterName} · 预计 {Math.round(activeSection.media_duration / 60)} 分钟</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDanmakuEnabled((value) => !value)}
                  className="rounded-xl border border-[#E3E8EC] px-3 py-2 text-xs font-bold text-[#171c22]"
                >
                  {danmakuEnabled ? "关闭弹幕" : "开启弹幕"}
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <input
                value={newDanmakuText}
                onChange={(event) => setNewDanmakuText(event.target.value)}
                placeholder="发一条课堂弹幕..."
                className="rounded-xl border border-[#E3E8EC] px-3 py-2 text-sm outline-none"
              />
              <input
                value={danmakuColor}
                onChange={(event) => setDanmakuColor(event.target.value)}
                type="color"
                className="h-11 w-full rounded-xl border border-[#E3E8EC] bg-white px-2 py-2 md:w-14"
              />
              <button
                onClick={handleSubmitDanmaku}
                className="rounded-xl bg-[#fb7299] px-4 py-2 text-sm font-bold text-white"
              >
                <Send className="inline-block h-4 w-4 mr-1" />
                发送
              </button>
            </div>
          </section>

          <section className="bg-white rounded-3xl border border-[#E3E8EC] p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-extrabold text-[#171c22]">课堂评论</h2>
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                value={userComment}
                onChange={(event) => setUserComment(event.target.value)}
                placeholder={replyTarget ? `回复 ${replyTarget.author} ...` : "写下你的想法、疑问或课堂收获..."}
                className="rounded-xl border border-[#E3E8EC] px-3 py-3 text-sm outline-none"
              />
              <button
                onClick={handleSubmitComment}
                className="rounded-xl bg-[#111827] px-4 py-3 text-sm font-bold text-white"
              >
                发布评论
              </button>
            </div>

            <div className="space-y-3">
              {comments.map((comment) => (
                <article key={comment.id} className="rounded-2xl border border-slate-100 bg-[linear-gradient(180deg,#ffffff,#fbfdff)] px-4 py-4">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ecf7ff,#d6ebff)] text-sm font-black text-[#2563eb]">
                      {comment.author[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-sm font-extrabold text-[#171c22]">{comment.author}</span>
                        {comment.badge ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                            {comment.badge}
                          </span>
                        ) : null}
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
                            comment.liked ? "bg-[#fb7299]/10 text-[#fb7299]" : "hover:bg-slate-100 hover:text-[#171c22]"
                          }`}
                        >
                          <ThumbsUp className={`h-3.5 w-3.5 ${comment.liked ? "fill-current" : ""}`} />
                          <span>赞同 {comment.likes}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplyTarget({ id: comment.id, author: comment.author })}
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

        <aside className="w-full lg:w-80 shrink-0 space-y-6">
          <section className="bg-white rounded-3xl border border-[#E3E8EC] p-5 shadow-sm">
            <h2 className="font-sans text-xs font-extrabold tracking-wider uppercase text-[#171c22] border-b border-gray-50 pb-2.5 mb-3">
              章节目录
            </h2>
            <div className="space-y-2">
              {sections.map((section) => {
                const isActive = section.id === activeSection.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSectionId(section.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all border flex items-start gap-2.5 cursor-pointer ${
                      isActive ? "bg-[#fb7299]/5 border-[#fb7299]/40 text-[#fb7299]" : "bg-white border-transparent hover:border-gray-200"
                    }`}
                  >
                    <Tv className={`w-4 h-4 shrink-0 mt-0.5 ${isActive ? "text-[#fb7299]" : "text-[#564145]/70"}`} />
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${isActive ? "text-[#fb7299]" : "text-[#171c22]"}`}>
                        {section.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-[#564145]/70 font-mono">
                        <span>{Math.round(section.media_duration / 60)} 分钟</span>
                        <span>{section.chapterName}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="bg-white rounded-3xl border border-[#E3E8EC] p-5 shadow-sm space-y-4">
            <h3 className="font-sans text-xs font-extrabold tracking-wider uppercase text-[#171c22] border-b border-gray-50 pb-2">
              学习联动入口
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate(buildResourcesRoute(courseId))}
                className="w-full text-left rounded-2xl border border-[#e6edf5] bg-[linear-gradient(180deg,#f9fbff,#f3f7fc)] px-3.5 py-3.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fb7299]/10 text-[#fb7299]"><BookOpen className="w-4 h-4" /></div>
                  <div>
                    <p className="font-bold">课程资料</p>
                    <p className="text-[10px] text-[#564145]/70">讲义、PPT、实验与考核资源</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#564145]/50 shrink-0" />
              </button>

              <button
                onClick={() => navigate(buildEvaluationRoute(courseId))}
                className="w-full text-left rounded-2xl border border-[#d7e7ea] bg-[linear-gradient(180deg,#f7fcfd,#eef8fa)] px-3.5 py-3.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#006689]/10 text-[#006689]"><Award className="w-4 h-4" /></div>
                  <div>
                    <p className="font-bold">测评中心</p>
                    <p className="text-[10px] text-[#564145]/70">错题、画像与路径回流</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#564145]/50 shrink-0" />
              </button>

              <button
                onClick={() => navigate(buildTutorRoute(courseId))}
                className="w-full text-left rounded-2xl border border-amber-100 bg-[linear-gradient(180deg,#fffaf1,#fff5df)] px-3.5 py-3.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Bot className="w-4 h-4" /></div>
                  <div>
                    <p className="font-bold">AI 导师答疑</p>
                    <p className="text-[10px] text-[#564145]/70">围绕当前课程继续追问</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#564145]/50 shrink-0" />
              </button>

              <button
                onClick={() => navigate(`/collection`)}
                className="w-full text-left rounded-2xl border border-[#e6edf5] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-3.5 py-3.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><FolderDown className="w-4 h-4" /></div>
                  <div>
                    <p className="font-bold">收藏与回看</p>
                    <p className="text-[10px] text-[#564145]/70">保存课堂资料和重点文件</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#564145]/50 shrink-0" />
              </button>
            </div>
          </section>
        </aside>
      </div>

      {toastMessage ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#171c22]/95 text-white text-xs font-bold px-5 py-3 rounded-full shadow-2xl z-50 flex items-center gap-2 border border-white/10">
          <span className="w-2 h-2 rounded-full bg-[#fb7299] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      ) : null}

      <style>{`
        @keyframes danmaku-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(calc(-100vw - 320px)); }
        }
        @keyframes danmaku-fade {
          0% { opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
