import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  ChevronRight,
  Clock3,
  FileText,
  GraduationCap,
  ListVideo,
  MessageSquare,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import {
  resolveCourseCoverUrl,
  studentApi,
  type CourseSectionPlayInfo,
  type LearningCourseDetail,
  type LearningNoteSummary,
  type LearningQuestionSummary,
} from "../lib/studentApi";
import { cn } from "../lib/utils";

const DEFAULT_COURSE_ID = 401;
const FALLBACK_SECTION_VIDEOS = [
  {
    src: "/videos/software-engineering-4th/project-demo.mp4",
    label: "临时演示视频 1",
  },
  {
    src: "/videos/software-engineering-4th/visio-flow-demo.mp4",
    label: "临时演示视频 2",
  },
  {
    src: "/videos/software-engineering-4th/cloud-app-demo.mp4",
    label: "临时演示视频 3",
  },
] as const;

type SectionWithChapter = {
  chapterId: number;
  chapterIndex: string;
  chapterName: string;
  section: LearningCourseDetail["chapters"][number]["sections"][number];
};

function getCourseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const parsed = Number(params.get("courseId") || DEFAULT_COURSE_ID);
  return Number.isFinite(parsed) ? parsed : DEFAULT_COURSE_ID;
}

function getSectionIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("sectionId");
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function setSectionIdInUrl(sectionId: number, options?: { push?: boolean }) {
  const url = new URL(window.location.href);
  url.searchParams.set("sectionId", String(sectionId));
  const nextUrl = `${url.pathname}${url.search}`;
  if (options?.push) {
    window.history.pushState({ ...(window.history.state || {}), sectionId }, "", nextUrl);
    return;
  }
  window.history.replaceState({ ...(window.history.state || {}), sectionId }, "", nextUrl);
}

function formatDuration(seconds: number) {
  if (!seconds) {
    return "时长待同步";
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours} 小时 ${restMinutes} 分钟` : `${hours} 小时`;
}

function formatMoment(seconds: number) {
  const safeSeconds = Math.max(0, seconds || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
}

function getSectionTypeLabel(type: number) {
  if (type === 2) {
    return "实战训练";
  }
  if (type === 3) {
    return "随堂测评";
  }
  return "课程讲解";
}

function getFallbackVideo(sectionId: number | null) {
  if (!sectionId) {
    return null;
  }
  return FALLBACK_SECTION_VIDEOS[sectionId % FALLBACK_SECTION_VIDEOS.length];
}

export function CourseLearning() {
  const courseId = useMemo(() => getCourseIdFromUrl(), []);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(() => getSectionIdFromUrl());
  const [course, setCourse] = useState<LearningCourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<LearningQuestionSummary[]>([]);
  const [notes, setNotes] = useState<LearningNoteSummary[]>([]);
  const [playInfo, setPlayInfo] = useState<CourseSectionPlayInfo | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [progressSyncing, setProgressSyncing] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const syncedSectionIdsRef = useRef<Set<number>>(new Set());
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const handlePopState = () => {
      setActiveSectionId(getSectionIdFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCourse() {
      try {
        setLoading(true);
        setError(null);
        const detail = await studentApi.getLearningCourseDetail(courseId);
        if (cancelled) {
          return;
        }
        setCourse(detail);
        const flatSections = detail.chapters.flatMap((chapter) =>
          chapter.sections.map((section) => ({
            chapterId: chapter.id,
            chapterIndex: chapter.index,
            chapterName: chapter.name,
            section,
          })),
        );
        const preferredId = getSectionIdFromUrl() ?? detail.latest_section_id ?? flatSections[0]?.section.id ?? null;
        setActiveSectionId(preferredId);
        if (preferredId) {
          setSectionIdInUrl(preferredId);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "课程学习页加载失败");
          setCourse(null);
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
  }, [courseId]);

  const sections = useMemo<SectionWithChapter[]>(
    () =>
      course?.chapters.flatMap((chapter) =>
        chapter.sections.map((section) => ({
          chapterId: chapter.id,
          chapterIndex: chapter.index,
          chapterName: chapter.name,
          section,
        })),
      ) || [],
    [course],
  );

  const activeSectionIndex = sections.findIndex((item) => item.section.id === activeSectionId);
  const activeSectionItem = sections[activeSectionIndex >= 0 ? activeSectionIndex : 0] || null;
  const activeSection = activeSectionItem?.section || null;
  const fallbackVideo = getFallbackVideo(activeSection?.id || null);
  const previousSection = activeSectionIndex > 0 ? sections[activeSectionIndex - 1] : null;
  const nextSection = activeSectionIndex >= 0 && activeSectionIndex < sections.length - 1 ? sections[activeSectionIndex + 1] : null;
  const completionPercent = activeSectionIndex >= 0 && sections.length ? Math.round(((activeSectionIndex + 1) / sections.length) * 100) : 0;

  useEffect(() => {
    if (!course || !activeSection) {
      setQuestions([]);
      setNotes([]);
      setPlayInfo(null);
      return;
    }

    let cancelled = false;
    setPanelLoading(true);

    Promise.all([
      studentApi.listLearningQuestions(course.id, activeSection.id),
      studentApi.listLearningNotes(course.id, activeSection.id),
      studentApi.getCourseSectionPlayInfo(course.id, activeSection.id),
    ])
      .then(([questionData, noteData, playData]) => {
        if (cancelled) {
          return;
        }
        setQuestions(questionData.list);
        setNotes(noteData.list);
        setPlayInfo(playData);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setQuestions([]);
        setNotes([]);
        setPlayInfo(null);
      })
      .finally(() => {
        if (!cancelled) {
          setPanelLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [course, activeSection]);

  useEffect(() => {
    if (!course || !activeSection || syncedSectionIdsRef.current.has(activeSection.id)) {
      return;
    }
    let cancelled = false;
    setProgressSyncing(true);
    studentApi
      .updateLearningProgress(course.id, {
        lessonId: course.lesson_id,
        sectionId: activeSection.id,
        moment: activeSection.moment || 0,
        duration: activeSection.media_duration || 0,
      })
      .then(() => {
        if (!cancelled) {
          syncedSectionIdsRef.current.add(activeSection.id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          syncedSectionIdsRef.current.delete(activeSection.id);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProgressSyncing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [course, activeSection]);

  useEffect(() => {
    setVideoPlaying(false);
  }, [activeSection?.id]);

  function switchSection(item: SectionWithChapter) {
    setActiveSectionId(item.section.id);
    setSectionIdInUrl(item.section.id, { push: true });
  }

  async function playCurrentVideo() {
    if (!videoRef.current) {
      return;
    }
    videoRef.current.muted = false;
    try {
      await videoRef.current.play();
      setVideoPlaying(true);
    } catch {
      videoRef.current.muted = true;
      try {
        await videoRef.current.play();
        setVideoPlaying(true);
      } catch {
        setVideoPlaying(false);
      }
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1380px] px-6 py-10 md:px-10">
        <div className="rounded-[32px] border border-outline-variant/50 bg-white px-8 py-10 text-sm text-on-surface-variant shadow-sm">
          正在打开课程学习页...
        </div>
      </div>
    );
  }

  if (error || !course || !activeSectionItem || !activeSection) {
    return (
      <div className="mx-auto max-w-[1380px] px-6 py-10 md:px-10">
        <div className="rounded-[32px] border border-amber-200 bg-amber-50 px-8 py-10 text-sm text-amber-700 shadow-sm">
          {error || "暂时无法定位要学习的章节。"}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-6 px-4 pb-16 pt-4 md:px-8">
      <section className="overflow-hidden rounded-[36px] border border-outline-variant/45 bg-[linear-gradient(135deg,#0f172a_0%,#12314f_52%,#14532d_100%)] text-white shadow-[0_20px_60px_rgba(15,23,42,0.22)]">
        <div className="grid gap-8 px-6 py-7 lg:grid-cols-[1.35fr_0.8fr] lg:px-8">
          <div>
            <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-white/82 transition-colors hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              返回学生首页
            </a>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white/90">课程学习页</span>
              <span className="rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-100">已定位到上次学习章节</span>
            </div>

            <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight md:text-4xl">{course.name}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/78">
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 text-emerald-200" />
                {course.teacher_name || "授课教师待同步"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ListVideo className="h-4 w-4 text-emerald-200" />
                共 {sections.length} 个章节内容
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-4 w-4 text-emerald-200" />
                当前章节约 {formatDuration(activeSection.media_duration)}
              </span>
            </p>

            <div className="mt-8 overflow-hidden rounded-[28px] border border-white/12 bg-black/20 shadow-2xl backdrop-blur-sm">
              <div className="relative aspect-video overflow-hidden">
                {fallbackVideo ? (
                  <>
                    {!videoPlaying ? (
                      <button
                        type="button"
                        onClick={() => void playCurrentVideo()}
                        className="absolute inset-0 z-10 block"
                        aria-label="播放当前视频"
                      />
                    ) : null}
                    <video
                      key={activeSection.id}
                      ref={videoRef}
                      className="h-full w-full bg-slate-950 object-contain"
                      controls
                      playsInline
                      preload="metadata"
                      poster={resolveCourseCoverUrl(course.cover_url)}
                      onPlay={() => setVideoPlaying(true)}
                      onPause={() => setVideoPlaying(false)}
                    >
                      <source src={fallbackVideo.src} type="video/mp4" />
                      当前浏览器暂不支持视频播放。
                    </video>
                    {!videoPlaying ? (
                      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                        <div className="rounded-full border border-white/20 bg-slate-950/72 px-7 py-5 text-center shadow-2xl backdrop-blur-md">
                          <div className="flex items-center justify-center gap-3 text-xl font-black text-white">
                            <PlayCircle className="h-9 w-9 text-emerald-300" />
                            点击这里播放
                          </div>
                          <div className="mt-2 text-sm text-white/70">点视频中间任意位置都可以开始播放</div>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <img src={resolveCourseCoverUrl(course.cover_url)} alt={course.name} className="h-full w-full object-cover opacity-45" />
                )}
                {!videoPlaying ? (
                  <>
                    <div className="pointer-events-none absolute inset-x-0 top-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(15,23,42,0.15),transparent)] p-6 md:p-8">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200/90">当前播放章节</p>
                          <h2 className="mt-3 text-2xl font-black md:text-3xl">{activeSection.name}</h2>
                          <p className="mt-3 text-sm leading-7 text-white/80">
                            第 {activeSectionItem.chapterIndex} 章 · {activeSectionItem.chapterName}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-right backdrop-blur-sm">
                          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-100/80">学习进度</div>
                          <div className="mt-1 text-2xl font-black text-white">{completionPercent}%</div>
                        </div>
                      </div>
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(15,23,42,0.96),rgba(15,23,42,0.58),transparent)] p-6 md:p-8">
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2 text-xs font-bold">
                          <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-white/90">{getSectionTypeLabel(activeSection.type)}</span>
                          <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-white/90">学习时点 {formatMoment(activeSection.moment)}</span>
                          <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-white/90">关联题目 {activeSection.subject_num || 0} 道</span>
                          {activeSection.trailer ? (
                            <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-amber-100">支持试看</span>
                          ) : null}
                          {fallbackVideo ? (
                            <span className="rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1 text-emerald-100">{fallbackVideo.label}</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-white/78">
                          <PlayCircle className="h-5 w-5 text-emerald-200" />
                          {playInfo?.play_enabled
                            ? `当前页已显示本地演示视频，后续可切换到真实签名流。fileId：${playInfo.file_id || "待补充"}。`
                            : fallbackVideo
                              ? "已接入本地演示视频资源，当前章节可以直接播放。"
                              : playInfo?.message || "当前章节视频资源待补充。"}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              <div className="border-t border-white/10 bg-slate-950/78 px-5 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 text-xs font-bold text-white/88">
                      <span className="rounded-full border border-white/12 bg-white/6 px-3 py-1">{getSectionTypeLabel(activeSection.type)}</span>
                      <span className="rounded-full border border-white/12 bg-white/6 px-3 py-1">学习时点 {formatMoment(activeSection.moment)}</span>
                      <span className="rounded-full border border-white/12 bg-white/6 px-3 py-1">关联题目 {activeSection.subject_num || 0} 道</span>
                      {activeSection.trailer ? <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-amber-100">支持试看</span> : null}
                      {fallbackVideo ? <span className="rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1 text-emerald-100">{fallbackVideo.label}</span> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/72">
                      <span className="inline-flex items-center gap-2">
                        <PlayCircle className="h-4 w-4 text-emerald-300" />
                        {activeSection.name}
                      </span>
                      <span>第 {activeSectionItem.chapterIndex} 章 · {activeSectionItem.chapterName}</span>
                      <span>学习进度 {completionPercent}%</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={`/resources?courseId=${course.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/14"
                    >
                      <BookOpen className="h-4 w-4" />
                      相关学习资源
                    </a>
                    <a href={`/evaluation?courseId=${course.id}`} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-900 transition-transform hover:scale-[1.02]">
                      本章测评
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[28px] border border-white/12 bg-white/8 p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/80">上次学习落点</div>
                  <h3 className="mt-2 text-lg font-bold text-white">{activeSection.name}</h3>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-2 text-right">
                  <div className="text-[11px] text-white/60">章节序号</div>
                  <div className="text-lg font-black text-white">{activeSection.index}</div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-white/8 p-4">
                  <div className="text-xs font-bold text-white/68">建议先做</div>
                  <div className="mt-2 text-sm font-semibold text-white">先看本节核心讲解，再去资源中心补材料，最后做章节测评。</div>
                </div>
                <div className="rounded-2xl bg-white/8 p-4">
                  <div className="text-xs font-bold text-white/68">章节归属</div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    第 {activeSectionItem.chapterIndex} 章 · {activeSectionItem.chapterName}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/8 p-4">
                  <div className="text-xs font-bold text-white/68">课程总时长估算</div>
                  <div className="mt-2 text-sm font-semibold text-white">{formatDuration(course.moment)}</div>
                </div>
                <div className="rounded-2xl bg-white/8 p-4">
                  <div className="text-xs font-bold text-white/68">章节记忆状态</div>
                  <div className="mt-2 text-sm font-semibold text-white">{progressSyncing ? "正在写回当前章节..." : "当前章节切换后会写回 latest_section_id"}</div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!previousSection}
                  onClick={() => previousSection && switchSection(previousSection)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm font-bold text-white transition-colors enabled:hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft className="h-4 w-4" />
                  上一节
                </button>
                <button
                  type="button"
                  disabled={!nextSection}
                  onClick={() => nextSection && switchSection(nextSection)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition-colors enabled:hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一节
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/12 bg-slate-950/24 p-4 backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between px-1">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/70">课程目录</div>
                  <h3 className="mt-1 text-sm font-semibold text-white/88">点击任意章节继续学习</h3>
                </div>
                <div className="text-xs text-white/58">{sections.length} 节</div>
              </div>
              <div className="max-h-[540px] space-y-3 overflow-auto pr-1">
                {course.chapters.map((chapter) => (
                  <div key={chapter.id} className="rounded-2xl border border-white/8 bg-white/6 p-3">
                    <div className="px-2 pb-2">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-100/68">第 {chapter.index} 章</div>
                      <div className="mt-1 text-sm font-bold text-white">{chapter.name}</div>
                    </div>
                    <div className="space-y-2">
                      {chapter.sections.map((section) => {
                        const isActive = section.id === activeSection.id;
                        return (
                          <button
                            key={section.id}
                            type="button"
                            onClick={() =>
                              switchSection({
                                chapterId: chapter.id,
                                chapterIndex: chapter.index,
                                chapterName: chapter.name,
                                section,
                              })
                            }
                            className={cn(
                              "w-full rounded-2xl px-3 py-3 text-left transition-all",
                              isActive ? "bg-emerald-300 text-slate-950 shadow-lg shadow-emerald-500/20" : "bg-white/6 text-white/82 hover:bg-white/10",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-bold">{section.name}</div>
                                <div className={cn("mt-1 text-xs", isActive ? "text-slate-700" : "text-white/55")}>
                                  {getSectionTypeLabel(section.type)} · {formatDuration(section.media_duration)}
                                </div>
                              </div>
                              <ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0", isActive ? "text-slate-700" : "text-white/45")} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <div className="rounded-[30px] border border-outline-variant/40 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">这一节你该怎么学</h3>
                <p className="text-sm text-on-surface-variant">把页面交互意图做成一眼就懂的动作建议，减少来回判断。</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-surface-variant/25 p-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-primary">第一步</div>
                <div className="mt-2 text-sm font-semibold text-on-surface">先看本节核心讲解</div>
                <p className="mt-2 text-xs leading-6 text-on-surface-variant">从当前章节开始，不再回到学习路径重新找入口。</p>
              </div>
              <div className="rounded-2xl bg-surface-variant/25 p-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-primary">第二步</div>
                <div className="mt-2 text-sm font-semibold text-on-surface">补相关资源材料</div>
                <p className="mt-2 text-xs leading-6 text-on-surface-variant">资源中心会继续复用当前课程上下文，方便马上补知识点。</p>
              </div>
              <div className="rounded-2xl bg-surface-variant/25 p-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-primary">第三步</div>
                <div className="mt-2 text-sm font-semibold text-on-surface">做章节测评和提问</div>
                <p className="mt-2 text-xs leading-6 text-on-surface-variant">本节相关题目和讨论会同步收口到同一个学习闭环里。</p>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-outline-variant/40 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-on-surface">本节讨论区</h3>
                <p className="mt-1 text-sm text-on-surface-variant">这里展示和当前章节直接关联的提问，不再让用户自己到处找。</p>
              </div>
              <div className="rounded-2xl bg-primary/8 px-4 py-2 text-right">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">真实数据</div>
                <div className="mt-1 text-lg font-bold text-on-surface">{questions.length} 条</div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {panelLoading ? <div className="rounded-2xl bg-surface-variant/25 px-4 py-4 text-sm text-on-surface-variant">正在同步本节讨论数据...</div> : null}
              {!panelLoading && !questions.length ? (
                <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-variant/15 px-5 py-5 text-sm text-on-surface-variant">
                  当前章节还没有讨论数据，可以先去 AI 辅导页发起提问。
                </div>
              ) : null}
              {questions.map((question) => (
                <article key={question.id} className="rounded-2xl border border-outline-variant/45 bg-surface-variant/10 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="text-base font-bold text-on-surface">{question.title}</h4>
                      <p className="mt-2 text-sm leading-7 text-on-surface-variant">{question.description}</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm">
                      <div className="text-[11px] text-on-surface-variant">回复数</div>
                      <div className="text-base font-black text-primary">{question.answerTimes}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-on-surface-variant">
                    <span className="inline-flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-primary" />
                      {question.userName}
                    </span>
                    <span>{question.createTime}</span>
                    {question.latestReplyUser ? <span>最近回复：{question.latestReplyUser}</span> : null}
                  </div>
                  {question.latestReplyContent ? <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-on-surface">{question.latestReplyContent}</div> : null}
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[30px] border border-outline-variant/40 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-on-surface">本节学习笔记</h3>
                <p className="mt-1 text-sm text-on-surface-variant">把真实笔记数据放到播放页里，用户能直接看见别人记录了什么。</p>
              </div>
              <div className="rounded-2xl bg-primary/8 px-4 py-2 text-right">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">实时联动</div>
                <div className="mt-1 text-lg font-bold text-on-surface">{notes.length} 条</div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {panelLoading ? <div className="rounded-2xl bg-surface-variant/25 px-4 py-4 text-sm text-on-surface-variant">正在同步本节笔记数据...</div> : null}
              {!panelLoading && !notes.length ? (
                <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-variant/15 px-5 py-5 text-sm text-on-surface-variant">
                  当前章节还没有公开笔记，后续可以把笔记创建入口也补到这一页。
                </div>
              ) : null}
              {notes.map((note) => (
                <article key={note.id} className="rounded-2xl border border-outline-variant/45 bg-surface-variant/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                      <FileText className="h-4 w-4 text-primary" />
                      {note.authorName}
                    </div>
                    <div className="text-xs text-on-surface-variant">记录时点 {formatMoment(note.noteMoment)}</div>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-on-surface">{note.content}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-on-surface-variant">
                    <span>{note.createTime}</span>
                    <span>{note.isPrivate ? "私密笔记" : "公开笔记"}</span>
                    <span>{note.isGathered ? "已被收录" : "待收录"}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-outline-variant/40 bg-[linear-gradient(145deg,#f8fffb_0%,#effaf5_100%)] p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">学完这一节以后</h3>
                <p className="text-sm text-on-surface-variant">让后续动作更顺，而不是把用户丢回一堆泛入口里。</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <a
                href={`/resources?courseId=${course.id}`}
                className="flex items-center justify-between rounded-2xl border border-outline-variant/40 bg-white px-4 py-4 transition-colors hover:border-primary/35 hover:bg-primary/5"
              >
                <div>
                  <div className="text-sm font-bold text-on-surface">去资源中心补材料</div>
                  <div className="mt-1 text-xs text-on-surface-variant">围绕当前课程继续看讲义、摘要和知识梳理。</div>
                </div>
                <ArrowRight className="h-4 w-4 text-primary" />
              </a>
              <a
                href={`/evaluation?courseId=${course.id}`}
                className="flex items-center justify-between rounded-2xl border border-outline-variant/40 bg-white px-4 py-4 transition-colors hover:border-primary/35 hover:bg-primary/5"
              >
                <div>
                  <div className="text-sm font-bold text-on-surface">去做章节测评</div>
                  <div className="mt-1 text-xs text-on-surface-variant">检查这一节是否真正掌握，而不是只停留在看过。</div>
                </div>
                <ArrowRight className="h-4 w-4 text-primary" />
              </a>
              <a
                href={`/tutor?courseId=${course.id}`}
                className="flex items-center justify-between rounded-2xl border border-outline-variant/40 bg-white px-4 py-4 transition-colors hover:border-primary/35 hover:bg-primary/5"
              >
                <div>
                  <div className="text-sm font-bold text-on-surface">去 AI 辅导继续提问</div>
                  <div className="mt-1 text-xs text-on-surface-variant">把这一节没消化的概念、疑难点直接接到辅导场景里。</div>
                </div>
                <ArrowRight className="h-4 w-4 text-primary" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
