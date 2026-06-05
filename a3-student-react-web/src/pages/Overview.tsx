import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Bot,
  ClipboardCheck,
  Compass,
  FolderOpen,
  LoaderCircle,
  Sparkles,
  TrendingUp,
  Tv,
  UserCircle,
} from "lucide-react";
import { CourseCoverImage } from "../components/CourseCoverImage";
import {
  ACTIVE_COURSE_ID,
  ACTIVE_USER_ID,
  buildEvaluationRoute,
  buildLearnRoute,
  buildPathRoute,
  buildProfileRoute,
  buildResourcesRoute,
  buildTutorRoute,
} from "../lib/courseContext";
import { studentApi, type PortalDashboardResponse } from "../lib/studentApi";

export default function Overview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<PortalDashboardResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const data = await studentApi.getStudentDashboard(ACTIVE_USER_ID, ACTIVE_COURSE_ID);
        if (!cancelled) {
          setDashboard(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "首页数据加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentCourse = dashboard?.current_course || null;
  const currentCourseId = currentCourse?.id || ACTIVE_COURSE_ID;
  const metrics = dashboard?.metrics || [];
  const activities = dashboard?.activities || [];
  const featuredCourses = dashboard?.featured_courses || [];

  const quickLinks = useMemo(
    () => [
      {
        title: "继续课堂",
        desc: "进入当前课程章节与互动区",
        icon: Tv,
        onClick: () => navigate(buildLearnRoute(currentCourseId)),
      },
      {
        title: "学习路径",
        desc: "查看阶段步骤与下一步行动",
        icon: Compass,
        onClick: () => navigate(buildPathRoute(currentCourseId)),
      },
      {
        title: "资源中心",
        desc: "查看课程资源与文件预览",
        icon: FolderOpen,
        onClick: () => navigate(buildResourcesRoute(currentCourseId)),
      },
      {
        title: "测评中心",
        desc: "进入测评与错题闭环",
        icon: ClipboardCheck,
        onClick: () => navigate(buildEvaluationRoute(currentCourseId)),
      },
      {
        title: "能力画像",
        desc: "查看画像、路径和测评联动结果",
        icon: UserCircle,
        onClick: () => navigate(buildProfileRoute(currentCourseId)),
      },
      {
        title: "AI 导师",
        desc: "围绕当前课程继续追问",
        icon: Bot,
        onClick: () => navigate(buildTutorRoute(currentCourseId)),
      },
    ],
    [currentCourseId, navigate],
  );

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-[#E3E8EC] bg-white text-sm font-semibold text-[#564145]">
        <span className="flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          正在加载业务数据...
        </span>
      </div>
    );
  }

  if (error || !dashboard || !currentCourse) {
    return (
      <div className="rounded-3xl border border-[#E3E8EC] bg-white p-8 text-sm text-[#564145] shadow-sm">
        <p className="font-bold text-[#171c22]">首页业务数据暂不可用</p>
        <p className="mt-2">{error || "当前课程上下文未返回。"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none" id="overview-workspace">
      <section className="overflow-hidden rounded-[32px] border border-black/[0.06] bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfd_100%)] shadow-[0_24px_80px_rgba(17,24,39,0.08)]">
        <div className="grid gap-0 xl:grid-cols-[1.45fr_0.9fr]">
          <div className="p-6 lg:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/90 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
                <Sparkles className="h-3.5 w-3.5" />
                Student Portal
              </span>
              <span className="rounded-full border border-black/[0.06] bg-[#f6f7fb] px-3 py-1 text-[11px] font-bold text-[#6b7280]">
                已接入课程与资源链路
              </span>
            </div>

            <div className="mt-5 max-w-3xl">
              <h1 className="text-[2.1rem] font-extrabold tracking-[-0.04em] text-[#111827] lg:text-[3rem]">
                {currentCourse.name}
              </h1>
              <p className="mt-3 text-sm leading-7 text-[#564145] lg:text-base">
                当前首页内容已切到后端业务数据：课程上下文、学习路径、画像摘要、测评趋势与资源中心统一来自后端服务。
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <div
                  key={metric.key}
                  className="rounded-2xl border border-[#E8EDF2] bg-[#fafbfd] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7a8791]">{metric.label}</p>
                  <p className="mt-3 text-xl font-extrabold text-[#171c22]">{metric.value}</p>
                  {metric.note ? <p className="mt-1 text-xs font-semibold text-[#fb7299]">{metric.note}</p> : null}
                  {metric.hint ? <p className="mt-2 text-xs leading-5 text-[#5a6970]">{metric.hint}</p> : null}
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate(buildLearnRoute(currentCourseId))}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#111827] px-4 py-3 text-sm font-bold text-white shadow-[0_18px_32px_rgba(17,24,39,0.18)]"
              >
                进入当前课堂
                <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                to={buildResourcesRoute(currentCourseId)}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#E3E8EC] bg-white px-4 py-3 text-sm font-bold text-[#171c22]"
              >
                查看课程资源
                <FolderOpen className="h-4 w-4 text-[#fb7299]" />
              </Link>
            </div>
          </div>

          <div className="border-t border-black/[0.05] bg-[linear-gradient(180deg,#f9fafb_0%,#f3f4f6_100%)] p-6 xl:border-l xl:border-t-0 lg:p-8">
            <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
              <CourseCoverImage
                coverUrl={featuredCourses[0]?.cover_url || currentCourse.cover_url}
                title={featuredCourses[0]?.name || currentCourse.name}
                category={featuredCourses[0]?.category_path || "软件工程"}
                className="h-52 w-full object-cover"
              />
              <div className="space-y-3 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">当前主修课程</p>
                <p className="text-xl font-extrabold text-[#171c22]">{currentCourse.name}</p>
                <p className="text-sm leading-6 text-[#5a6970]">
                  {dashboard.profile_summary?.key_features ||
                    dashboard.latest_plan?.summary ||
                    "画像、路径和测评结果会在这里汇总显示。"}
                </p>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0f6c7b]">
                  <TrendingUp className="h-4 w-4" />
                  {dashboard.evaluation_trend?.latest_score !== undefined
                    ? `最近测评 ${Math.round(dashboard.evaluation_trend.latest_score)} 分`
                    : "等待测评结果"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              onClick={item.onClick}
              className="rounded-[28px] border border-[#E3E8EC] bg-white p-5 text-left shadow-[0_12px_36px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-extrabold text-[#171c22]">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[#5a6970]">{item.desc}</p>
                </div>
                <div className="rounded-2xl bg-[#fb7299]/10 p-3 text-[#fb7299]">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </button>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[32px] border border-[#E3E8EC] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#73838a]">Recent Activity</p>
              <h2 className="mt-2 text-xl font-extrabold text-[#171c22]">业务链路最近动态</h2>
            </div>
            <BookOpen className="h-5 w-5 text-[#fb7299]" />
          </div>
          <div className="mt-5 space-y-4">
            {activities.length ? (
              activities.map((item) => (
                <div key={item.id} className="rounded-2xl bg-[#f8fafb] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#171c22]">{item.title}</p>
                      <p className="mt-1 text-xs text-[#73838a]">{item.time}</p>
                    </div>
                    <span className="rounded-full bg-[#fb7299]/10 px-3 py-1 text-[11px] font-bold text-[#fb7299]">
                      {item.gain}
                    </span>
                  </div>
                  {item.badge ? <p className="mt-2 text-xs text-[#5a6970]">标签：{item.badge}</p> : null}
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-[#f8fafb] p-4 text-sm text-[#5a6970]">暂无可展示的业务活动。</div>
            )}
          </div>
        </div>

        <div className="rounded-[32px] border border-[#E3E8EC] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#73838a]">Featured Courses</p>
          <h2 className="mt-2 text-xl font-extrabold text-[#171c22]">推荐课程</h2>
          <div className="mt-5 space-y-4">
            {featuredCourses.map((course) => (
              <button
                key={course.id}
                type="button"
                onClick={() => navigate(buildLearnRoute(course.id || ACTIVE_COURSE_ID))}
                className="flex w-full items-center gap-3 rounded-2xl border border-[#E8EDF2] bg-[#fafbfd] p-3 text-left"
              >
                <CourseCoverImage
                  coverUrl={course.cover_url}
                  title={course.name}
                  category={course.category_path}
                  className="h-16 w-24 rounded-xl object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-[#171c22]">{course.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#5a6970]">{course.summary}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
