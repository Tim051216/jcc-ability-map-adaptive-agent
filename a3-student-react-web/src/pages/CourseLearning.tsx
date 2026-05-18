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
  type LearningReplySummary,
} from "../lib/studentApi";
import { CourseCoverImage } from "../components/CourseCoverImage";
import { buildCourseCoverDataUri } from "../lib/courseCover";
import { cn } from "../lib/utils";

const DEFAULT_COURSE_ID = 401;
const DEFAULT_USER_ID = 1001;
const TENCENT_VOD_APP_ID = import.meta.env.VITE_TENCENT_VOD_APP_ID || "1312394356";
const TCPLAYER_SCRIPT_SRC = "https://web.sdk.qcloud.com/player/tcplayer/release/v5.1.0/tcplayer.v5.1.0.min.js";
const TCPLAYER_STYLE_HREF = "https://web.sdk.qcloud.com/player/tcplayer/release/v5.1.0/tcplayer.min.css";
const FALLBACK_SECTION_VIDEOS = [
  {
    src: "/videos/software-engineering-4th/project-demo.mp4",
    label: "演示视频",
  },
  {
    src: "/videos/software-engineering-4th/visio-flow-demo.mp4",
    label: "流程图演示",
  },
  {
    src: "/videos/software-engineering-4th/cloud-app-demo.mp4",
    label: "项目演示",
  },
] as const;

type SectionWithChapter = {
  chapterId: number;
  chapterIndex: string;
  chapterName: string;
  section: LearningCourseDetail["chapters"][number]["sections"][number];
};

type TCPlayerFactory = (
  containerId: string,
  options: {
    appID: string;
    fileID: string;
    psign: string;
    poster?: string;
    autoplay?: boolean;
    preload?: "auto" | "metadata" | "none";
    playbackRates?: number[];
  },
) => {
  dispose?: () => void;
  destroy?: () => void;
  pause?: () => void;
};

declare global {
  interface Window {
    TCPlayer?: TCPlayerFactory;
  }
}

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

function formatChapterLabel(chapterIndex: string, chapterName: string) {
  const normalizedIndex = chapterIndex.replace(/^第\s*/u, "").replace(/\s*章$/u, "").trim();
  return `第 ${normalizedIndex} 章 · ${chapterName}`;
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

function ensureTcPlayerAssets() {
  if (!document.querySelector(`link[href="${TCPLAYER_STYLE_HREF}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = TCPLAYER_STYLE_HREF;
    document.head.appendChild(link);
  }

  return new Promise<void>((resolve, reject) => {
    if (window.TCPlayer) {
      resolve();
      return;
    }

    const existing = document.querySelector(`script[src="${TCPLAYER_SCRIPT_SRC}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("TCPlayer SDK 加载失败")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = TCPLAYER_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("TCPlayer SDK 加载失败"));
    document.body.appendChild(script);
  });
}

function TencentVodPlayer({
  fileId,
  signature,
  poster,
  sectionId,
}: {
  fileId: string;
  signature: string;
  poster: string;
  sectionId: number;
}) {
  const [playerError, setPlayerError] = useState<string | null>(null);

  useEffect(() => {
    const containerId = `tcplayer-${sectionId}`;
    let disposed = false;
    let player:
      | {
          dispose?: () => void;
          destroy?: () => void;
          pause?: () => void;
        }
      | undefined;

    void ensureTcPlayerAssets()
      .then(() => {
        if (disposed || !window.TCPlayer) {
          return;
        }
        setPlayerError(null);
        player = window.TCPlayer(containerId, {
          appID: TENCENT_VOD_APP_ID,
          fileID: fileId,
          psign: signature,
          poster,
          autoplay: false,
          preload: "auto",
          playbackRates: [0.75, 1, 1.25, 1.5, 2],
        });
      })
      .catch((error) => {
        if (!disposed) {
          setPlayerError(error instanceof Error ? error.message : "真实播放器初始化失败");
        }
      });

    return () => {
      disposed = true;
      try {
        player?.pause?.();
        player?.dispose?.();
        player?.destroy?.();
      } catch {
        // Ignore player teardown issues.
      }
    };
  }, [fileId, poster, sectionId, signature]);

  return (
    <div className="space-y-3">
      <div id={`tcplayer-${sectionId}`} className="h-full w-full" />
      {playerError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{playerError}</div> : null}
    </div>
  );
}

export function CourseLearning() {
  const courseId = useMemo(() => getCourseIdFromUrl(), []);
  const requestedSectionId = useMemo(() => getSectionIdFromUrl(), []);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(() => getSectionIdFromUrl());
  const [entryBadgeText, setEntryBadgeText] = useState("已进入课程学习");
  const [course, setCourse] = useState<LearningCourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<LearningQuestionSummary[]>([]);
  const [notes, setNotes] = useState<LearningNoteSummary[]>([]);
  const [playInfo, setPlayInfo] = useState<CourseSectionPlayInfo | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [progressSyncing, setProgressSyncing] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [questionTitle, setQuestionTitle] = useState("");
  const [questionDescription, setQuestionDescription] = useState("");
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [questionFormError, setQuestionFormError] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [notePrivate, setNotePrivate] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [noteFormError, setNoteFormError] = useState<string | null>(null);
  const [openQuestionId, setOpenQuestionId] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<number, string>>({});
  const [replyLoading, setReplyLoading] = useState<Record<number, boolean>>({});
  const [replySubmitting, setReplySubmitting] = useState<Record<number, boolean>>({});
  const [replyError, setReplyError] = useState<Record<number, string | null>>({});
  const [repliesByQuestion, setRepliesByQuestion] = useState<Record<number, LearningReplySummary[]>>({});
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");
  const [editingNotePrivate, setEditingNotePrivate] = useState(false);
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);
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
        const preferredId = requestedSectionId ?? detail.latest_section_id ?? flatSections[0]?.section.id ?? null;
        setActiveSectionId(preferredId);
        if (requestedSectionId) {
          setEntryBadgeText("已打开指定章节");
        } else if (detail.latest_section_id) {
          setEntryBadgeText("已恢复到上次学习位置");
        } else {
          setEntryBadgeText("已进入课程学习");
        }
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
  }, [courseId, requestedSectionId]);

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
  const realVideoReady = Boolean(playInfo?.play_enabled && playInfo.file_id && playInfo.signature && activeSection);
  const previousSection = activeSectionIndex > 0 ? sections[activeSectionIndex - 1] : null;
  const nextSection = activeSectionIndex >= 0 && activeSectionIndex < sections.length - 1 ? sections[activeSectionIndex + 1] : null;
  const completionPercent = activeSectionIndex >= 0 && sections.length ? Math.round(((activeSectionIndex + 1) / sections.length) * 100) : 0;
  const totalCourseDuration = useMemo(
    () => sections.reduce((sum, item) => sum + (item.section.media_duration || 0), 0),
    [sections],
  );

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
      studentApi.listLearningNotes(course.id, activeSection.id, false),
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

  useEffect(() => {
    setQuestionTitle("");
    setQuestionDescription("");
    setQuestionFormError(null);
    setNoteContent("");
    setNotePrivate(false);
    setNoteFormError(null);
    setOpenQuestionId(null);
    setReplyDraft({});
    setReplyLoading({});
    setReplySubmitting({});
    setReplyError({});
    setRepliesByQuestion({});
    setEditingNoteId(null);
    setEditingNoteContent("");
    setEditingNotePrivate(false);
    setSavingNoteId(null);
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

  async function refreshSectionPanels() {
    if (!course || !activeSection) {
      return;
    }
    const [questionData, noteData, playData] = await Promise.all([
      studentApi.listLearningQuestions(course.id, activeSection.id),
      studentApi.listLearningNotes(course.id, activeSection.id, false),
      studentApi.getCourseSectionPlayInfo(course.id, activeSection.id),
    ]);
    setQuestions(questionData.list);
    setNotes(noteData.list);
    setPlayInfo(playData);
  }

  async function handleSubmitQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!course || !activeSectionItem || !activeSection) {
      return;
    }
    const title = questionTitle.trim();
    const description = questionDescription.trim();
    if (!title || !description) {
      setQuestionFormError("请先填写问题标题和问题描述。");
      return;
    }
    try {
      setSubmittingQuestion(true);
      setQuestionFormError(null);
      await studentApi.createLearningQuestion({
        courseId: course.id,
        chapterId: activeSectionItem.chapterId,
        sectionId: activeSection.id,
        title,
        description,
        anonymity: false,
      });
      setQuestionTitle("");
      setQuestionDescription("");
      await refreshSectionPanels();
    } catch (submitError) {
      setQuestionFormError(submitError instanceof Error ? submitError.message : "提问失败");
    } finally {
      setSubmittingQuestion(false);
    }
  }

  async function handleOpenReplies(questionId: number) {
    const nextOpen = openQuestionId === questionId ? null : questionId;
    setOpenQuestionId(nextOpen);
    if (!nextOpen || repliesByQuestion[questionId]) {
      return;
    }
    try {
      setReplyLoading((prev) => ({ ...prev, [questionId]: true }));
      setReplyError((prev) => ({ ...prev, [questionId]: null }));
      const response = await studentApi.listLearningReplies(questionId);
      setRepliesByQuestion((prev) => ({ ...prev, [questionId]: response.list }));
    } catch (loadError) {
      setReplyError((prev) => ({ ...prev, [questionId]: loadError instanceof Error ? loadError.message : "回复加载失败" }));
    } finally {
      setReplyLoading((prev) => ({ ...prev, [questionId]: false }));
    }
  }

  async function handleSubmitReply(questionId: number) {
    const content = (replyDraft[questionId] || "").trim();
    if (!content) {
      setReplyError((prev) => ({ ...prev, [questionId]: "请先填写回复内容。" }));
      return;
    }
    try {
      setReplySubmitting((prev) => ({ ...prev, [questionId]: true }));
      setReplyError((prev) => ({ ...prev, [questionId]: null }));
      await studentApi.createLearningReply({
        questionId,
        content,
        anonymity: false,
      });
      const response = await studentApi.listLearningReplies(questionId);
      setRepliesByQuestion((prev) => ({ ...prev, [questionId]: response.list }));
      setReplyDraft((prev) => ({ ...prev, [questionId]: "" }));
      await refreshSectionPanels();
    } catch (submitError) {
      setReplyError((prev) => ({ ...prev, [questionId]: submitError instanceof Error ? submitError.message : "回复失败" }));
    } finally {
      setReplySubmitting((prev) => ({ ...prev, [questionId]: false }));
    }
  }

  async function handleSubmitNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!course || !activeSectionItem || !activeSection) {
      return;
    }
    const content = noteContent.trim();
    if (!content) {
      setNoteFormError("请先写一点笔记内容。");
      return;
    }
    try {
      setSubmittingNote(true);
      setNoteFormError(null);
      await studentApi.createLearningNote({
        courseId: course.id,
        chapterId: activeSectionItem.chapterId,
        sectionId: activeSection.id,
        content,
        noteMoment: activeSection.moment || 0,
        isPrivate: notePrivate,
      });
      setNoteContent("");
      setNotePrivate(false);
      await refreshSectionPanels();
    } catch (submitError) {
      setNoteFormError(submitError instanceof Error ? submitError.message : "新增笔记失败");
    } finally {
      setSubmittingNote(false);
    }
  }

  function startEditNote(note: LearningNoteSummary) {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
    setEditingNotePrivate(note.isPrivate);
  }

  async function handleSaveNote(noteId: number) {
    const content = editingNoteContent.trim();
    if (!content) {
      setNoteFormError("笔记内容不能为空。");
      return;
    }
    try {
      setSavingNoteId(noteId);
      setNoteFormError(null);
      await studentApi.updateLearningNote(noteId, {
        id: noteId,
        content,
        isPrivate: editingNotePrivate,
      });
      setEditingNoteId(null);
      setEditingNoteContent("");
      setEditingNotePrivate(false);
      await refreshSectionPanels();
    } catch (saveError) {
      setNoteFormError(saveError instanceof Error ? saveError.message : "笔记保存失败");
    } finally {
      setSavingNoteId(null);
    }
  }

  async function handleToggleGather(note: LearningNoteSummary) {
    try {
      if (note.isGathered) {
        await studentApi.ungatherLearningNote(note.id);
      } else {
        await studentApi.gatherLearningNote(note.id);
      }
      await refreshSectionPanels();
    } catch (toggleError) {
      setNoteFormError(toggleError instanceof Error ? toggleError.message : "笔记收藏状态更新失败");
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
      <section className="overflow-hidden rounded-[36px] border border-outline-variant/45 bg-white text-on-surface shadow-sm">
        <div className="grid gap-8 px-6 py-7 lg:grid-cols-[1.35fr_0.8fr] lg:px-8">
          <div>
            <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant transition-colors hover:text-on-surface">
              <ArrowLeft className="h-4 w-4" />
              返回学生首页
            </a>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-outline-variant/60 bg-surface-variant/25 px-3 py-1 text-xs font-bold text-on-surface">课程学习页</span>
              <span className="rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-bold text-primary">{entryBadgeText}</span>
            </div>

            <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight text-on-surface md:text-4xl">{course.name}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 text-primary" />
                {course.teacher_name || "授课教师待同步"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ListVideo className="h-4 w-4 text-primary" />
                共 {sections.length} 个章节内容
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-4 w-4 text-primary" />
                当前章节约 {formatDuration(activeSection.media_duration)}
              </span>
            </p>

            <div className="mt-8 overflow-hidden rounded-[28px] border border-outline-variant/45 bg-white shadow-sm">
              <div className="relative aspect-video overflow-hidden">
                {realVideoReady && activeSection ? (
                  <TencentVodPlayer
                    fileId={playInfo?.file_id || ""}
                    signature={playInfo?.signature || ""}
                    poster={course.cover_url ? resolveCourseCoverUrl(course.cover_url) : buildCourseCoverDataUri(course.name, course.teacher_name)}
                    sectionId={activeSection.id}
                  />
                ) : fallbackVideo ? (
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
                      poster={course.cover_url ? resolveCourseCoverUrl(course.cover_url) : buildCourseCoverDataUri(course.name, course.teacher_name)}
                      onPlay={() => setVideoPlaying(true)}
                      onPause={() => setVideoPlaying(false)}
                    >
                      <source src={fallbackVideo.src} type="video/mp4" />
                      当前浏览器暂不支持视频播放。
                    </video>
                    {!videoPlaying ? (
                      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                        <div className="rounded-3xl border border-white/20 bg-slate-950/72 px-7 py-5 text-center shadow-2xl backdrop-blur-md">
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
                  <CourseCoverImage
                    coverUrl={course.cover_url}
                    title={course.name}
                    category={course.teacher_name}
                    className="h-full w-full object-cover opacity-45"
                  />
                )}
              </div>
              <div className="border-t border-outline-variant/40 bg-white px-5 py-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="rounded-full border border-outline-variant/50 bg-surface-variant/20 px-3 py-1 text-on-surface">{getSectionTypeLabel(activeSection.type)}</span>
                    <span className="rounded-full border border-outline-variant/50 bg-surface-variant/20 px-3 py-1 text-on-surface">学习时点 {formatMoment(activeSection.moment)}</span>
                    <span className="rounded-full border border-outline-variant/50 bg-surface-variant/20 px-3 py-1 text-on-surface">关联题目 {activeSection.subject_num || 0} 道</span>
                    <span className="rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-primary">学习进度 {completionPercent}%</span>
                    <span className={cn("rounded-full px-3 py-1", realVideoReady ? "border border-primary/15 bg-primary/8 text-primary" : "border border-amber-200 bg-amber-50 text-amber-700")}>
                      {realVideoReady ? "真实签名播放" : fallbackVideo ? fallbackVideo.label : "视频待补充"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-on-surface">{activeSection.name}</h2>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        {formatChapterLabel(activeSectionItem.chapterIndex, activeSectionItem.chapterName)}
                      </p>
                      <p className="mt-2 text-sm text-on-surface-variant">
                        {realVideoReady
                          ? `当前章节正在使用真实签名播放。fileId：${playInfo?.file_id || "待补充"}。`
                          : fallbackVideo
                            ? `当前章节当前使用演示视频播放，方便先完成学习流程验证。${playInfo?.message ? `原因：${playInfo.message}` : ""}`
                            : playInfo?.message || "当前章节视频资源待补充。"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <a
                        href={`/resources?courseId=${course.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 bg-white px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-variant/25"
                      >
                        <BookOpen className="h-4 w-4" />
                        相关学习资源
                      </a>
                      <a href={`/evaluation?courseId=${course.id}`} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary/90">
                        本章测评
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[28px] border border-outline-variant/45 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-primary">上次学习落点</div>
                  <h3 className="mt-2 text-lg font-bold text-on-surface">{activeSection.name}</h3>
                </div>
                <div className="rounded-2xl bg-surface-variant/25 px-3 py-2 text-right">
                  <div className="text-[11px] text-on-surface-variant">章节序号</div>
                  <div className="text-lg font-black text-on-surface">{activeSection.index}</div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-surface-variant/20 p-4">
                  <div className="text-xs font-bold text-on-surface-variant">建议先做</div>
                  <div className="mt-2 text-sm font-semibold text-on-surface">先看本节核心讲解，再去资源中心补材料，最后做章节测评。</div>
                </div>
                <div className="rounded-2xl bg-surface-variant/20 p-4">
                  <div className="text-xs font-bold text-on-surface-variant">章节归属</div>
                  <div className="mt-2 text-sm font-semibold text-on-surface">
                    {formatChapterLabel(activeSectionItem.chapterIndex, activeSectionItem.chapterName)}
                  </div>
                </div>
                <div className="rounded-2xl bg-surface-variant/20 p-4">
                  <div className="text-xs font-bold text-on-surface-variant">课程总学习时长</div>
                  <div className="mt-2 text-sm font-semibold text-on-surface">{formatDuration(totalCourseDuration)}</div>
                </div>
                <div className="rounded-2xl bg-surface-variant/20 p-4">
                  <div className="text-xs font-bold text-on-surface-variant">学习进度同步</div>
                  <div className="mt-2 text-sm font-semibold text-on-surface">{progressSyncing ? "正在同步当前章节..." : "当前章节切换后会自动记录学习位置"}</div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!previousSection}
                  onClick={() => previousSection && switchSection(previousSection)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-outline-variant/50 bg-white px-4 py-3 text-sm font-bold text-on-surface transition-colors enabled:hover:bg-surface-variant/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft className="h-4 w-4" />
                  上一节
                </button>
                <button
                  type="button"
                  disabled={!nextSection}
                  onClick={() => nextSection && switchSection(nextSection)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white transition-colors enabled:hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一节
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>

            <section className="rounded-[28px] border border-outline-variant/45 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between px-1">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-primary">课程目录</div>
                  <h3 className="mt-1 text-sm font-semibold text-on-surface">点击任意章节继续学习</h3>
                </div>
                <div className="text-xs text-on-surface-variant">{sections.length} 节</div>
              </div>
              <div className="max-h-[540px] space-y-3 overflow-auto pr-1">
                {course.chapters.map((chapter) => (
                  <div key={chapter.id} className="rounded-2xl border border-outline-variant/35 bg-surface-variant/10 p-3">
                    <div className="px-2 pb-2">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-primary/80">
                        {formatChapterLabel(chapter.index, "").replace(" · ", "").trim()}
                      </div>
                      <div className="mt-1 text-sm font-bold text-on-surface">{chapter.name}</div>
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
                              isActive ? "bg-primary/12 text-on-surface shadow-sm ring-1 ring-primary/12" : "bg-white text-on-surface hover:bg-surface-variant/20",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-bold">{section.name}</div>
                                <div className={cn("mt-1 text-xs", isActive ? "text-primary" : "text-on-surface-variant")}>
                                  {getSectionTypeLabel(section.type)} · {formatDuration(section.media_duration)}
                                </div>
                              </div>
                              <ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0", isActive ? "text-primary" : "text-on-surface-variant")} />
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
                <p className="mt-1 text-sm text-on-surface-variant">当前章节的问题、回答和追问都直接写入真实学习接口，不再只是展示壳子。</p>
              </div>
              <div className="rounded-2xl bg-primary/8 px-4 py-2 text-right">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">真实数据</div>
                <div className="mt-1 text-lg font-bold text-on-surface">{questions.length} 条</div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <form onSubmit={handleSubmitQuestion} className="rounded-2xl border border-outline-variant/45 bg-surface-variant/10 p-4">
                <div className="text-sm font-bold text-on-surface">发起一个和本节相关的问题</div>
                <input
                  value={questionTitle}
                  onChange={(event) => setQuestionTitle(event.target.value)}
                  placeholder="问题标题，例如：这一节的核心难点是什么？"
                  className="mt-3 w-full rounded-2xl border border-outline-variant/50 bg-white px-4 py-3 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
                />
                <textarea
                  value={questionDescription}
                  onChange={(event) => setQuestionDescription(event.target.value)}
                  placeholder="补充一下你的具体困惑，这样更容易收到有效回复。"
                  className="mt-3 min-h-28 w-full rounded-2xl border border-outline-variant/50 bg-white px-4 py-3 text-sm leading-7 text-on-surface outline-none transition-colors focus:border-primary/40"
                />
                {questionFormError ? <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{questionFormError}</div> : null}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-xs text-on-surface-variant">提交后会立即刷新当前章节讨论列表。</div>
                  <button
                    type="submit"
                    disabled={submittingQuestion}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {submittingQuestion ? "提交中..." : "发布问题"}
                  </button>
                </div>
              </form>
              {panelLoading ? <div className="rounded-2xl bg-surface-variant/25 px-4 py-4 text-sm text-on-surface-variant">正在同步本节讨论数据...</div> : null}
              {!panelLoading && !questions.length ? (
                <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-variant/15 px-5 py-5 text-sm text-on-surface-variant">
                  当前章节还没有讨论数据，可以先在上面发起本节第一个问题。
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
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleOpenReplies(question.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-outline-variant/45 bg-white px-4 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-surface-variant/20"
                    >
                      <MessageSquare className="h-4 w-4 text-primary" />
                      {openQuestionId === question.id ? "收起回复" : `查看回复 (${question.answerTimes})`}
                    </button>
                    <a
                      href={`/tutor?courseId=${course.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-outline-variant/45 bg-white px-4 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-surface-variant/20"
                    >
                      去 AI 辅导继续追问
                      <ArrowRight className="h-4 w-4 text-primary" />
                    </a>
                  </div>
                  {openQuestionId === question.id ? (
                    <div className="mt-4 rounded-2xl bg-white p-4">
                      {replyLoading[question.id] ? <div className="text-sm text-on-surface-variant">正在加载回复...</div> : null}
                      {replyError[question.id] ? <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{replyError[question.id]}</div> : null}
                      {!replyLoading[question.id] && !(repliesByQuestion[question.id] || []).length ? (
                        <div className="text-sm text-on-surface-variant">这条问题还没有回复，你可以先写第一条。</div>
                      ) : null}
                      <div className="space-y-3">
                        {(repliesByQuestion[question.id] || []).map((reply) => (
                          <div key={reply.id} className="rounded-2xl border border-outline-variant/35 bg-surface-variant/10 px-4 py-3">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                              <span className="font-bold text-on-surface">{reply.userName}</span>
                              <span>{reply.createTime}</span>
                              {reply.targetUserName ? <span>回复给 {reply.targetUserName}</span> : null}
                            </div>
                            <div className="mt-2 text-sm leading-7 text-on-surface">{reply.content}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4">
                        <textarea
                          value={replyDraft[question.id] || ""}
                          onChange={(event) => setReplyDraft((prev) => ({ ...prev, [question.id]: event.target.value }))}
                          placeholder="写下你的回复，帮助同学一起推进这节内容。"
                          className="min-h-24 w-full rounded-2xl border border-outline-variant/50 bg-surface-variant/10 px-4 py-3 text-sm leading-7 text-on-surface outline-none transition-colors focus:border-primary/40"
                        />
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="text-xs text-on-surface-variant">回复会直接写入真实讨论接口。</div>
                          <button
                            type="button"
                            disabled={replySubmitting[question.id]}
                            onClick={() => void handleSubmitReply(question.id)}
                            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {replySubmitting[question.id] ? "发送中..." : "发送回复"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
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
                <p className="mt-1 text-sm text-on-surface-variant">这里已经连上真实笔记接口，可以直接新增、编辑自己的笔记，并把有价值的内容收录起来。</p>
              </div>
              <div className="rounded-2xl bg-primary/8 px-4 py-2 text-right">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">实时联动</div>
                <div className="mt-1 text-lg font-bold text-on-surface">{notes.length} 条</div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <form onSubmit={handleSubmitNote} className="rounded-2xl border border-outline-variant/45 bg-surface-variant/10 p-4">
                <div className="text-sm font-bold text-on-surface">记录这一节的学习笔记</div>
                <textarea
                  value={noteContent}
                  onChange={(event) => setNoteContent(event.target.value)}
                  placeholder="写下你对本节的理解、难点或者之后想回顾的点。"
                  className="mt-3 min-h-28 w-full rounded-2xl border border-outline-variant/50 bg-white px-4 py-3 text-sm leading-7 text-on-surface outline-none transition-colors focus:border-primary/40"
                />
                <label className="mt-3 inline-flex items-center gap-2 text-sm text-on-surface-variant">
                  <input type="checkbox" checked={notePrivate} onChange={(event) => setNotePrivate(event.target.checked)} />
                  仅自己可见
                </label>
                {noteFormError ? <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{noteFormError}</div> : null}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-xs text-on-surface-variant">保存后会回到当前章节的真实笔记列表。</div>
                  <button
                    type="submit"
                    disabled={submittingNote}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4" />
                    {submittingNote ? "保存中..." : "保存笔记"}
                  </button>
                </div>
              </form>
              {panelLoading ? <div className="rounded-2xl bg-surface-variant/25 px-4 py-4 text-sm text-on-surface-variant">正在同步本节笔记数据...</div> : null}
              {!panelLoading && !notes.length ? (
                <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-variant/15 px-5 py-5 text-sm text-on-surface-variant">
                  当前章节还没有笔记记录，可以先在上面写下这一节的第一条笔记。
                </div>
              ) : null}
              {notes.map((note) => {
                const canEditNote = note.authorId === 1 || note.authorId === DEFAULT_USER_ID;
                return (
                  <article key={note.id} className="rounded-2xl border border-outline-variant/45 bg-surface-variant/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                      <FileText className="h-4 w-4 text-primary" />
                      {note.authorName}
                    </div>
                    <div className="text-xs text-on-surface-variant">记录时点 {formatMoment(note.noteMoment)}</div>
                  </div>
                  {editingNoteId === note.id ? (
                    <div className="mt-3">
                      <textarea
                        value={editingNoteContent}
                        onChange={(event) => setEditingNoteContent(event.target.value)}
                        className="min-h-24 w-full rounded-2xl border border-outline-variant/50 bg-white px-4 py-3 text-sm leading-7 text-on-surface outline-none transition-colors focus:border-primary/40"
                      />
                      <label className="mt-3 inline-flex items-center gap-2 text-sm text-on-surface-variant">
                        <input type="checkbox" checked={editingNotePrivate} onChange={(event) => setEditingNotePrivate(event.target.checked)} />
                        仅自己可见
                      </label>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={savingNoteId === note.id}
                          onClick={() => void handleSaveNote(note.id)}
                          className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                          {savingNoteId === note.id ? "保存中..." : "保存修改"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNoteId(null)}
                          className="rounded-full border border-outline-variant/45 bg-white px-4 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-surface-variant/20"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-7 text-on-surface">{note.content}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-on-surface-variant">
                    <span>{note.createTime}</span>
                    <span>{note.isPrivate ? "私密笔记" : "公开笔记"}</span>
                    <span>{note.isGathered ? "已被收录" : "待收录"}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {canEditNote ? (
                      <button
                        type="button"
                        onClick={() => startEditNote(note)}
                        className="rounded-full border border-outline-variant/45 bg-white px-4 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-surface-variant/20"
                      >
                        编辑笔记
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleToggleGather(note)}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-bold transition-colors",
                        note.isGathered ? "bg-primary/10 text-primary hover:bg-primary/15" : "border border-outline-variant/45 bg-white text-on-surface hover:bg-surface-variant/20",
                      )}
                    >
                      {note.isGathered ? "取消收录" : "收录这条笔记"}
                    </button>
                  </div>
                  </article>
                );
              })}
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
