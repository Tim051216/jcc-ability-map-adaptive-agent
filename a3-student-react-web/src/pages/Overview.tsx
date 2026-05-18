import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Calendar, GraduationCap, History, Sparkles, Users } from "lucide-react";
import { motion } from "motion/react";
import { CourseCoverImage } from "../components/CourseCoverImage";
import {
  studentApi,
  type CourseCard,
  type CourseCategory,
  type LearningCourseDetail,
} from "../lib/studentApi";

function formatSold(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}千`;
  }
  return String(value);
}

function formatMinutes(value: number) {
  const minutes = Math.max(1, Math.round(value / 60));
  return `${minutes} 分钟`;
}

export function Overview() {
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [freeCourses, setFreeCourses] = useState<CourseCard[]>([]);
  const [bestCourses, setBestCourses] = useState<CourseCard[]>([]);
  const [currentCourse, setCurrentCourse] = useState<LearningCourseDetail | null>(null);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      try {
        setLoading(true);
        setError(null);

        const [categoryData, freeData, bestData, learningData] = await Promise.all([
          studentApi.listCategories(),
          studentApi.listRecommendCourses("free"),
          studentApi.listRecommendCourses("best"),
          studentApi.getLearningCourseDetail(401),
        ]);

        if (cancelled) {
          return;
        }

        setCategories(categoryData);
        setFreeCourses(freeData);
        setBestCourses(bestData);
        setCurrentCourse(learningData);
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "学习总览加载失败";
          setError(message);
          setCategories([]);
          setFreeCourses([]);
          setBestCourses([]);
          setCurrentCourse(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOverview();
    return () => {
      cancelled = true;
    };
  }, []);

  const heroSlides = useMemo(() => {
    const courseMap = new Map<number, CourseCard>();
    [...freeCourses, ...bestCourses].forEach((course) => {
      if (!courseMap.has(course.id)) {
        courseMap.set(course.id, course);
      }
    });
    return Array.from(courseMap.values()).slice(0, 5);
  }, [freeCourses, bestCourses]);

  const heroCourse = heroSlides[activeHeroIndex] || heroSlides[0] || null;
  const featuredCourses = bestCourses;
  const primaryCategory = categories[0] || null;
  const latestSection = currentCourse?.chapters
    .flatMap((chapter) => chapter.sections)
    .find((section) => section.id === currentCourse.latest_section_id);
  const totalSections = currentCourse?.chapters.reduce((sum, chapter) => sum + chapter.sections.length, 0) || 0;
  const progressPercent = useMemo(() => {
    if (!currentCourse || !totalSections) {
      return 0;
    }
    return Math.min(100, Math.max(8, Math.round((((latestSection?.index || 1) - 1) / totalSections) * 100)));
  }, [currentCourse, latestSection, totalSections]);
  const continueLearningHref = currentCourse
    ? `/learn?courseId=${currentCourse.id}${currentCourse.latest_section_id ? `&sectionId=${currentCourse.latest_section_id}` : ""}`
      : heroCourse
      ? `/learn?courseId=${heroCourse.id}`
      : "/learn";

  useEffect(() => {
    if (!heroSlides.length) {
      return;
    }
    setActiveHeroIndex((current) => (current >= heroSlides.length ? 0 : current));
  }, [heroSlides]);

  useEffect(() => {
    if (heroSlides.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveHeroIndex((current) => (current + 1) % heroSlides.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  const goToPrevHero = () => {
    if (!heroSlides.length) {
      return;
    }
    setActiveHeroIndex((current) => (current - 1 + heroSlides.length) % heroSlides.length);
  };

  const goToNextHero = () => {
    if (!heroSlides.length) {
      return;
    }
    setActiveHeroIndex((current) => (current + 1) % heroSlides.length);
  };

  return (
    <div className="pb-20">
      {error ? (
        <div className="mx-auto mt-6 max-w-[1240px] rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
          {error}
        </div>
      ) : null}

      {heroCourse ? (
        <section className="border-b border-outline-variant/60 bg-white shadow-sm">
          <div className="mx-auto grid max-w-[1240px] grid-cols-12">
            <aside className="col-span-3 hidden bg-[#2a2f37] py-5 text-white lg:block">
              <div className="border-b border-white/10 px-6 pb-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">学习方向</p>
              </div>
              <nav className="space-y-1 px-2 pt-3">
                {categories.map((category) => (
                  <div key={category.id} className="rounded-xl px-4 py-3 transition-colors hover:bg-white/8">
                    <div className="text-sm font-bold">{category.name}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {category.children.map((child) => (
                        <span key={child.id} className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] text-white/80">
                          {child.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            </aside>

            <div className="col-span-12 lg:col-span-9">
              <div className="relative h-[520px] overflow-hidden">
                {heroSlides.map((course, index) => (
                  <motion.div
                    key={course.id}
                    className="absolute inset-0"
                    initial={false}
                    animate={{
                      opacity: index === activeHeroIndex ? 1 : 0,
                      scale: index === activeHeroIndex ? 1 : 1.04,
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  >
                    <CourseCoverImage
                      coverUrl={course.cover_url}
                      title={course.name}
                      category={course.category_path}
                      className="h-full w-full object-cover"
                    />
                  </motion.div>
                ))}
                <div className="absolute inset-0 bg-gradient-to-r from-[#07111dcc] via-[#0f2432c2] to-[#00c17b66]" />
                {heroSlides.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={goToPrevHero}
                      className="absolute left-5 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white backdrop-blur transition hover:bg-black/35"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={goToNextHero}
                      className="absolute right-5 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white backdrop-blur transition hover:bg-black/35"
                    >
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </>
                ) : null}
                <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-12 lg:px-16">
                  <div className="mb-5 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                      {heroCourse.category_path}
                    </span>
                    <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                      共 {heroCourse.sections} 节内容
                    </span>
                  </div>

                  <p className="text-sm font-black uppercase tracking-[0.2em] text-primary/90">推荐你先从这门课开始</p>
                  <h2 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-white md:text-5xl">{heroCourse.name}</h2>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-white/88 md:text-lg">
                    {heroCourse.summary || "从课程学习、资源使用到测评反馈，这里会帮你把整条学习流程串起来。"}
                  </p>

                  <div className="mt-8 flex flex-wrap gap-4">
                    <a
                      href={`/path?courseId=${heroCourse.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 font-bold text-white shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02]"
                    >
                      去看学习安排
                      <ArrowRight className="h-4 w-4" />
                    </a>
                    <a
                      href={`/resources?courseId=${heroCourse.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-7 py-3 font-bold text-white backdrop-blur"
                    >
                      先领学习资料
                    </a>
                  </div>

                  <div className="mt-10 grid max-w-3xl gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                      <div className="text-[11px] font-bold text-white/70">适合谁</div>
                      <div className="mt-2 text-sm font-semibold text-white">想快速进入课程主线的学生</div>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                      <div className="text-[11px] font-bold text-white/70">你会得到</div>
                      <div className="mt-2 text-sm font-semibold text-white">学习路径、资源包和测评入口</div>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                      <div className="text-[11px] font-bold text-white/70">建议动作</div>
                      <div className="mt-2 text-sm font-semibold text-white">先看路径，再进资源中心</div>
                    </div>
                  </div>

                  {heroSlides.length > 1 ? (
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        {heroSlides.map((course, index) => (
                          <button
                            key={course.id}
                            type="button"
                            onClick={() => setActiveHeroIndex(index)}
                            className={`h-2.5 rounded-full transition-all ${
                              index === activeHeroIndex ? "w-10 bg-white" : "w-2.5 bg-white/45 hover:bg-white/70"
                            }`}
                            aria-label={`切换到 ${course.name}`}
                          />
                        ))}
                      </div>
                      <div className="hidden flex-wrap gap-2 md:flex">
                        {heroSlides.map((course, index) => (
                          <button
                            key={`${course.id}-chip`}
                            type="button"
                            onClick={() => setActiveHeroIndex(index)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur transition ${
                              index === activeHeroIndex
                                ? "border-white/30 bg-white/20 text-white"
                                : "border-white/15 bg-black/15 text-white/75 hover:bg-white/10"
                            }`}
                          >
                            {course.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mx-auto max-w-[1240px] px-4 py-10 md:px-8">
        {loading ? <div className="mb-6 text-sm text-on-surface-variant">正在加载学习总览...</div> : null}

        {!loading && !heroCourse ? (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-white px-6 py-10 text-center text-sm text-on-surface-variant">
            暂时还没有可展示的学习总览数据。
          </div>
        ) : null}

        {heroCourse ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="space-y-8 lg:col-span-9">
              <section className="overflow-hidden rounded-[28px] border border-outline-variant/50 bg-white p-8 shadow-sm">
                <div className="flex flex-col gap-8 xl:flex-row xl:items-center">
                  <div className="flex items-center gap-5 xl:w-[360px]">
                    <CourseCoverImage
                      coverUrl={currentCourse?.cover_url || heroCourse.cover_url}
                      title={currentCourse?.name || heroCourse.name}
                      category={heroCourse.category_path}
                      className="h-24 w-36 rounded-2xl object-cover shadow-md"
                    />
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">你当前最该继续的内容</p>
                      <h3 className="mt-2 text-2xl font-bold text-on-surface">{currentCourse?.name || heroCourse.name}</h3>
                      <p className="mt-1 text-sm text-on-surface-variant">{currentCourse?.teacher_name || heroCourse.teacher_name}</p>
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="mb-3 flex items-end justify-between">
                      <div className="space-y-1">
                        <p className="flex items-center gap-2 text-sm font-medium text-on-surface-variant">
                          <History className="h-4 w-4 text-primary" />
                          上次学到：{latestSection?.name || "还没有章节学习进度"}
                        </p>
                        <p className="text-xs text-on-surface-variant/75">这里告诉你现在从哪一节接着学最省时间。</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black italic text-primary">{progressPercent}%</div>
                      </div>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-surface-variant/40">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.8 }}
                        className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-300"
                      />
                    </div>
                  </div>

                  <a href={continueLearningHref} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-4 font-bold text-white shadow-lg shadow-primary/20">
                    继续本次学习
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </section>

              <section>
                <div className="mb-5 flex items-end justify-between border-b border-outline-variant pb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-on-surface">适合先入门的课程</h3>
                    <p className="mt-1 text-sm text-on-surface-variant">如果你还没确定从哪门课开始，可以先看这些低门槛推荐。</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {freeCourses.map((course) => (
                    <article key={course.id} className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-white shadow-sm transition-shadow hover:shadow-lg">
                      <CourseCoverImage
                        coverUrl={course.cover_url}
                        title={course.name}
                        category={course.category_path}
                        className="h-52 w-full object-cover"
                      />
                      <div className="p-6">
                        <div className="mb-3 flex items-center justify-between text-xs font-bold">
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">{course.category_path}</span>
                          <span className="text-secondary">可直接开始</span>
                        </div>
                        <h4 className="text-xl font-bold text-on-surface">{course.name}</h4>
                        <p className="mt-3 line-clamp-2 text-sm leading-7 text-on-surface-variant">{course.summary}</p>
                        <div className="mt-5 flex items-center justify-between text-sm text-on-surface-variant">
                          <span className="flex items-center gap-1.5">
                            <GraduationCap className="h-4 w-4 text-primary" />
                            {course.teacher_name}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users className="h-4 w-4" />
                            {formatSold(course.sold)}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-5 flex items-end justify-between border-b border-outline-variant pb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-on-surface">适合深入提升的课程</h3>
                    <p className="mt-1 text-sm text-on-surface-variant">当你已经熟悉基础内容后，可以从这里挑下一门进阶课。</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {featuredCourses.map((course) => (
                    <article key={course.id} className="group overflow-hidden rounded-2xl border border-outline-variant/60 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
                      <div className="relative h-44 overflow-hidden">
                        <CourseCoverImage
                          coverUrl={course.cover_url}
                          title={course.name}
                          category={course.category_path}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                          <div className="text-xs font-bold text-white/90">{course.teacher_name}</div>
                        </div>
                      </div>
                      <div className="p-5">
                        <h4 className="line-clamp-2 min-h-12 text-lg font-bold text-on-surface">{course.name}</h4>
                        <p className="mt-3 line-clamp-3 text-sm leading-7 text-on-surface-variant">{course.summary}</p>
                        <div className="mt-5 flex items-center justify-between text-xs text-on-surface-variant">
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="h-4 w-4 text-primary" />
                            {course.sections} 节内容
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users className="h-4 w-4" />
                            {formatSold(course.sold)}
                          </span>
                          <span>{course.score} 分</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-6 lg:col-span-3">
              <section className="rounded-2xl border border-outline-variant/60 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-bold text-on-surface">今天先看这三件事</h3>
                  <Calendar className="h-4 w-4 text-on-surface-variant/50" />
                </div>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl bg-surface-variant/30 p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">先定方向</div>
                    <div className="mt-2 text-sm font-semibold text-on-surface">{primaryCategory?.name || "暂无方向数据"}</div>
                    <div className="mt-2 text-xs text-on-surface-variant">
                      {primaryCategory?.children.map((item) => item.name).join(" / ") || "稍后会展示课程子方向"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-surface-variant/30 p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">再安排时间</div>
                    <div className="mt-2 text-sm font-semibold text-on-surface">{formatMinutes(currentCourse?.moment || 0)}</div>
                    <div className="mt-2 text-xs text-on-surface-variant">这是系统根据当前课程内容估算的一次学习时长。</div>
                  </div>
                  <div className="rounded-2xl bg-surface-variant/30 p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">最后开学</div>
                    <div className="mt-2 text-sm font-semibold text-on-surface">{latestSection?.name || "从课程开头开始"}</div>
                    <div className="mt-2 text-xs text-on-surface-variant">如果你不确定先学哪里，就从这里进入最直接。</div>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl bg-primary p-6 text-white shadow-lg shadow-primary/20">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Sparkles className="h-4 w-4" />
                  一条最省心的学习路线
                </div>
                <p className="mt-4 text-sm leading-7 text-white/85">
                  如果你不想自己判断，建议按“学习路径 → 资源中心 → 学习测评 → AI 辅导”的顺序走一遍，理解成本最低。
                </p>
                <a href="/path?courseId=101" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-white">
                  直接进入学习路径
                  <ArrowRight className="h-4 w-4" />
                </a>
              </section>

              <section className="rounded-2xl border border-dashed border-outline-variant bg-white p-6 text-center shadow-sm">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">当前状态</div>
                <div className="mt-3 text-lg font-bold text-on-surface">{loading ? "正在同步学习总览" : "已准备好开始学习"}</div>
                <p className="mt-2 text-sm leading-7 text-on-surface-variant">你现在可以直接进入路径、资源、测评或 AI 辅导，不需要先做额外配置。</p>
              </section>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
