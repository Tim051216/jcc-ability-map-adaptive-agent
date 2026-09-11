/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart2,
  Bell,
  BriefcaseBusiness,
  Bot,
  Code2,
  ClipboardCheck,
  ClipboardList,
  FolderOpen,
  Heart,
  Layers,
  LogOut,
  Search,
  User,
} from "lucide-react";

import { INBOX_UPDATED_EVENT, getInboxSummary, type InboxItem } from "../lib/inbox";
import { getDemoUserIdentity } from "../lib/demoUserIdentity";
import { buildResourcesRoute, buildSearchRoute, readLastRouteCourseId } from "../lib/routeCourseContext";

interface HeaderProps {
  user: {
    id: string;
    name: string;
    avatar: string;
    loggedIn: boolean;
  } | null;
  onLogout: () => void;
  onOpenTutor?: () => void;
  contentShiftClass?: string;
  onPreloadRoute?: (path: string) => void;
}

function formatNotificationTime(value?: string) {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function Header({ user, onLogout, onOpenTutor, contentShiftClass = "", onPreloadRoute }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationItems, setNotificationItems] = useState<InboxItem[]>([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const displayUser = useMemo(() => {
    if (!user) return null;
    const profile = getDemoUserIdentity(user.id);
    return {
      ...user,
      name: user.name?.trim() || profile?.name || "",
      avatar: user.avatar || profile?.avatar || "",
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function syncInbox() {
      if (!displayUser?.id || !/^\d+$/.test(displayUser.id)) {
        if (!cancelled) {
          setNotificationItems([]);
          setNotificationUnreadCount(0);
          setNotificationLoading(false);
        }
        return;
      }

      setNotificationLoading(true);
      try {
        const summary = await getInboxSummary(displayUser.id);
        if (!cancelled) {
          setNotificationItems(summary.items);
          setNotificationUnreadCount(summary.unreadCount);
        }
      } catch {
        if (!cancelled) {
          setNotificationItems([]);
          setNotificationUnreadCount(0);
        }
      } finally {
        if (!cancelled) {
          setNotificationLoading(false);
        }
      }
    }

    void syncInbox();
    window.addEventListener(INBOX_UPDATED_EVENT, syncInbox);
    return () => {
      cancelled = true;
      window.removeEventListener(INBOX_UPDATED_EVENT, syncInbox);
    };
  }, [displayUser?.id]);

  useEffect(() => {
    setShowNotificationPanel(false);
    setShowDropdown(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === "/resources") {
      setSearchQuery(new URLSearchParams(location.search).get("search") || "");
    }
    if (location.pathname === "/search") {
      setSearchQuery(new URLSearchParams(location.search).get("q") || "");
    }
  }, [location.pathname, location.search]);

  const navItems = useMemo(
    () => [
      { label: "岗课赛工作台", id: "overview", path: "/", icon: Layers },
      { label: "产业岗位分析", id: "industry-dashboard", path: "/industry-dashboard", icon: BarChart2 },
      { label: "岗位能力图谱", id: "job-ability-graph", path: "/job-ability-graph", icon: User },
      { label: "岗位任务转学习卡", id: "learning-task-factory", path: "/learning-task-factory", icon: ClipboardList },
      { label: "岗课赛自适应学习", id: "job-learning", path: "/job-learning", icon: BriefcaseBusiness },
      { label: "岗位能力诊断", id: "evaluation", path: "/evaluation", icon: ClipboardCheck },
      { label: "课程与竞赛资源", id: "resources", path: buildResourcesRoute(readLastRouteCourseId()), icon: FolderOpen },
      { label: "能力与实训报告", id: "report", path: "/report", icon: BarChart2 },
    ],
    [],
  );

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const keyword = searchQuery.trim();
    if (keyword) {
      setShowDropdown(false);
      setShowNotificationPanel(false);
      navigate(buildSearchRoute(keyword));
    }
  };

  const currentPath = location.pathname;
  const isNavItemActive = (itemPath: string) => {
    const normalizedPath = itemPath.split("?")[0] || itemPath;
    // Keep the parent岗位学习 tab inactive on child pages such as知识目录.
    if (normalizedPath === "/job-learning") return currentPath === normalizedPath;
    return currentPath === normalizedPath || (normalizedPath !== "/" && currentPath.startsWith(`${normalizedPath}/`));
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#E3E8EC] bg-white/95 shadow-sm backdrop-blur-md">
      <div className={`mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 md:px-10 ${contentShiftClass}`}>
        <div className="flex flex-grow items-center gap-4 xl:gap-6 md:flex-grow-0">
          <Link
            id="nav-brand"
            to="/"
            onMouseEnter={() => onPreloadRoute?.("/")}
            onFocus={() => onPreloadRoute?.("/")}
            onPointerDown={() => onPreloadRoute?.("/")}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#fb7299]/15 bg-[#fb7299]/5 px-3 py-1 font-sans text-xl font-extrabold ui-tracking-tighter text-[#fb7299] md:text-2xl"
          >
            岗课赛智能体
          </Link>

          <span className="hidden rounded-full bg-[#006689]/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#006689] sm:inline-block">
            岗—课—赛岗位能力已接入
          </span>
        </div>

        <form onSubmit={handleSearchSubmit} className="relative mx-4 hidden max-w-[240px] flex-grow items-center md:flex">
          <Search className="ui-text-muted-rose pointer-events-none absolute left-3 h-3.5 w-3.5" />
          <input
            id="global-search-input"
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索课程、讲义、导师..."
            className="ui-text-ink w-full rounded-xl border-none bg-[#F1F2F3] py-1 pl-8 pr-3 font-sans text-xs outline-none transition-all placeholder:ui-text-muted-rose/70 focus:ring-2 focus:ring-[#fb7299]"
          />
        </form>

        <div className="flex items-center gap-4">
          <Link
            id="header-ai-learning-hub"
            to="/resources/preview?courseId=series-1&fileId=900001&generationStage=completed&generationLabel=%E4%BB%A3%E7%A0%81%E5%AE%9E%E6%93%8D&generationType=coding_lab"
            className="hidden items-center gap-1.5 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-4 py-2 font-sans text-xs font-bold text-[#1d4ed8] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#dbeafe] md:flex"
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>代码实操台</span>
          </Link>

          <button
            id="header-ai-tutor-pill"
            type="button"
            onClick={() => onOpenTutor?.()}
            className="ui-bg-brand flex items-center gap-1.5 rounded-full px-4 py-2 font-sans text-xs font-bold text-white shadow-sm transition-all hover:bg-[#fb7299]/90 hover:shadow"
          >
            <Bot className="h-3.5 w-3.5" />
            <span>AI 导师</span>
          </button>

          <div className="relative">
            <button
              id="notification-btn"
              type="button"
              onClick={() => setShowNotificationPanel((value) => !value)}
              className="ui-text-muted-rose relative rounded-full p-1.5 transition-colors hover:bg-gray-100"
              title="站内通知"
            >
              <Bell className="h-5 w-5" />
              {notificationUnreadCount > 0 ? (
                <span className="ui-bg-brand absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black text-white ring-2 ring-white">
                  {notificationUnreadCount > 9 ? "9+" : notificationUnreadCount}
                </span>
              ) : null}
            </button>

            {showNotificationPanel ? (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowNotificationPanel(false)} />
                <div className="ui-border-app ui-radius-24 absolute right-0 z-20 mt-2 w-[340px] overflow-hidden border bg-white shadow-[0_22px_44px_rgba(15,23,42,0.12)]">
                  <div className="border-b border-[#EDF1F5] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="ui-text-ink text-sm font-extrabold">站内通知</div>
                        <div className="mt-1 text-[12px] text-[#667085]">复习提醒、系统通知会先出现在这里</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotificationPanel(false);
                          navigate("/im");
                        }}
                        className="ui-text-brand rounded-full bg-[#FFF4F8] px-3 py-1 text-[11px] font-bold"
                      >
                        查看全部
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[360px] overflow-y-auto p-2">
                    {notificationLoading ? (
                      <div className="px-3 py-8 text-center text-sm text-[#98A2B3]">正在拉取通知...</div>
                    ) : notificationItems.length > 0 ? (
                      notificationItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setShowNotificationPanel(false);
                            navigate("/im");
                          }}
                          className="flex w-full items-start gap-3 rounded-[18px] px-3 py-3 text-left transition hover:bg-[#FFF8FB]"
                        >
                          <div className={`mt-1 h-2.5 w-2.5 rounded-full ${item.isRead ? "bg-[#D0D5DD]" : "ui-bg-brand"}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <div className="ui-text-ink truncate text-sm font-bold">{item.title}</div>
                              <div className="shrink-0 text-[11px] text-[#98A2B3]">{formatNotificationTime(item.pushTime)}</div>
                            </div>
                            <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-[#667085]">{item.content}</div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-8 text-center text-sm text-[#98A2B3]">暂时没有新的站内提醒</div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {displayUser?.loggedIn ? (
            <div className="relative">
              <button
                id="profile-dropdown-btn"
                onClick={() => setShowDropdown((value) => !value)}
                className="flex h-8 w-8 overflow-hidden rounded-full border border-[#ddbfc4] ring-[#fb7299] transition-all hover:ring-2 focus:outline-none"
              >
                {displayUser.avatar ? (
                  <img src={displayUser.avatar} alt={displayUser.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-[#fff4f8] text-[#fb7299]">
                    <User className="h-4 w-4" />
                  </span>
                )}
              </button>

              {showDropdown ? (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                  <div
                    id="profile-menu-container"
                    className="absolute right-0 z-20 mt-2 w-48 rounded-2xl border border-[#E3E8EC] bg-white py-2 shadow-lg"
                  >
                    <div className="border-b border-gray-100 px-4 py-2">
                      <p className="font-mono text-xs font-semibold text-[#171c22]">ID: {displayUser.id}</p>
                      <p className="truncate font-sans text-sm font-bold text-[#564145]">{displayUser.name}</p>
                    </div>

                    <Link
                      id="profile-dropdown-me"
                      to="/job-ability-graph"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-[#564145] transition-colors hover:bg-gray-50"
                    >
                      <User className="h-4 w-4 text-[#fb7299]" />
                      岗位能力图谱
                    </Link>

                    <Link
                      id="profile-dropdown-collection"
                      to="/collection"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-[#564145] transition-colors hover:bg-gray-50"
                    >
                      <Heart className="h-4 w-4 text-[#fb7299]" />
                      我的收藏
                    </Link>

                    <button
                      id="profile-dropdown-logout"
                      onClick={() => {
                        setShowDropdown(false);
                        onLogout();
                      }}
                      className="mt-1 flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2 text-left text-sm text-red-500 transition-colors hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      退出登录
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <Link
              id="nav-login-btn"
              to="/login"
              className="rounded-full border border-[#fb7299] px-4 py-1.5 font-sans text-sm font-semibold text-[#fb7299] transition-all hover:bg-[#fb7299]/10"
            >
              登录
            </Link>
          )}
        </div>
      </div>

      <div className="ui-border-app hidden border-t bg-slate-50/50 py-1.5 md:block">
        <div className={`mx-auto flex max-w-[1280px] items-center justify-between px-4 md:px-10 ${contentShiftClass}`}>
          <nav className="flex items-center gap-1.5">
            {navItems.map((item) => {
              const isActive = isNavItemActive(item.path);
              return (
              <Link
                key={item.path}
                to={item.path}
                onMouseEnter={() => onPreloadRoute?.(item.path)}
                onFocus={() => onPreloadRoute?.(item.path)}
                onPointerDown={() => onPreloadRoute?.(item.path)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 font-sans text-xs font-bold transition-all duration-150 ${
                    isActive
                      ? "ui-bg-brand text-white shadow-sm shadow-[#fb7299]/15"
                      : "ui-text-muted-rose hover:bg-[#fb7299]/10 hover:ui-text-brand"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

        </div>
      </div>
    </header>
  );
}
