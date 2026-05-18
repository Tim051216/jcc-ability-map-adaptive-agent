import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Bell,
  Menu,
  ChevronDown,
  BookOpen,
  Sparkles,
  Bookmark,
  TrendingUp,
  Award,
  LayoutDashboard,
  Map,
  Radar,
  BrainCircuit,
  Code2,
  Database,
  BriefcaseBusiness,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";

const learningDirections = [
  {
    title: "人工智能导论",
    description: "适合进入能力画像、学习路径和测评联动演示",
    icon: BrainCircuit,
    href: "/path?courseId=101",
  },
  {
    title: "前端工程实践",
    description: "适合查看资源生成与项目实训型学习路径",
    icon: Code2,
    href: "/resources?courseId=401",
  },
  {
    title: "数据分析基础",
    description: "适合体验知识点分布和学习报告页面",
    icon: Database,
    href: "/report?courseId=301",
  },
  {
    title: "项目实训工作坊",
    description: "适合结合 AI 辅导与测评反馈完成学习闭环",
    icon: BriefcaseBusiness,
    href: "/tutor?courseId=401",
  },
];

type MenuPosition = {
  left: number;
  top: number;
  width: number;
};

export function Header({ title }: { title: string }) {
  const location = useLocation();
  const isResourceSection = location.pathname === "/resources" || location.pathname.startsWith("/resources/");
  const [isDirectionOpen, setIsDirectionOpen] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ left: 16, top: 60, width: 360 });
  const directionButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarSrc = avatarBroken
    ? "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%2310b981'/%3E%3Cstop offset='100%25' stop-color='%23059669'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='96' height='96' rx='48' fill='url(%23g)'/%3E%3Ctext x='48' y='57' text-anchor='middle' font-size='32' font-family='Arial, sans-serif' font-weight='700' fill='white'%3ESE%3C/text%3E%3C/svg%3E"
    : "https://lh3.googleusercontent.com/a/ACg8ocJX59OOnL4vA3vD0_Wp1Xk6X-_Gq79yZ5YmO3P-P1oI=s96-c";

  useLayoutEffect(() => {
    if (!isDirectionOpen || !directionButtonRef.current) {
      return;
    }

    const rect = directionButtonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const width = 360;
    const left = Math.min(Math.max(12, rect.left), Math.max(12, viewportWidth - width - 12));
    const top = rect.bottom + 10;

    setMenuPosition({ left, top, width });
  }, [isDirectionOpen]);

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (directionButtonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsDirectionOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDirectionOpen(false);
      }
    }

    function repositionMenu() {
      if (!isDirectionOpen || !directionButtonRef.current) {
        return;
      }
      const rect = directionButtonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const width = 360;
      const left = Math.min(Math.max(12, rect.left), Math.max(12, viewportWidth - width - 12));
      const top = rect.bottom + 10;
      setMenuPosition({ left, top, width });
    }

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", repositionMenu);
    window.addEventListener("scroll", repositionMenu, true);

    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", repositionMenu);
      window.removeEventListener("scroll", repositionMenu, true);
    };
  }, [isDirectionOpen]);

  useEffect(() => {
    setIsDirectionOpen(false);
  }, [location.pathname, location.search]);

  const directionMenu = isDirectionOpen
    ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[120] overflow-hidden rounded-[24px] border border-outline-variant/70 bg-white shadow-2xl"
          style={{ left: `${menuPosition.left}px`, top: `${menuPosition.top}px`, width: `${menuPosition.width}px` }}
        >
          <div className="border-b border-outline-variant/40 bg-surface-variant/20 px-5 py-4">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">学习方向</div>
            <div className="mt-1 text-sm text-on-surface-variant">选择一个更贴近 A3 学习闭环的演示方向</div>
          </div>
          <div className="p-3">
            {learningDirections.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  to={item.href}
                  onClick={() => setIsDirectionOpen(false)}
                  className="flex items-start gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-primary/5"
                >
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-on-surface">{item.title}</div>
                    <div className="mt-1 text-xs leading-6 text-on-surface-variant">{item.description}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-outline-variant/60 bg-white shadow-sm transition-all">
        <div className="flex h-16 items-center justify-between gap-6 px-4 md:px-10 lg:px-20">
          <div className="flex flex-1 items-center gap-6 lg:gap-12">
            <Link to="/" className="group flex shrink-0 items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-black text-white shadow-md transition-transform group-hover:rotate-6">
                A3
              </div>
              <h1 className="whitespace-nowrap text-xl font-bold text-on-surface">A3 学习平台</h1>
            </Link>

            <div className="group relative hidden w-full max-w-xl md:block">
              <Search className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-on-surface-variant/40 transition-colors group-focus-within:text-primary" />
              <input
                type="text"
                placeholder="搜索课程、知识点或学习任务..."
                className="h-11 w-full rounded-full border border-transparent bg-surface-variant/30 pl-12 pr-4 text-[14px] outline-none transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4 lg:gap-6">
            <button className="relative p-2 text-on-surface-variant transition-colors hover:text-primary" aria-label="通知">
              <Bell className="h-6 w-6" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
            </button>

            <div className="group flex cursor-pointer items-center gap-3 border-l border-outline-variant/60 pl-4">
              <div className="hidden text-right sm:block">
                <p className="text-[13px] font-bold text-on-surface transition-colors group-hover:text-primary">演示学生</p>
                <p className="text-[11px] text-on-surface-variant/70">{title}</p>
              </div>
              <img
                alt="User"
                className="h-10 w-10 rounded-full border-2 border-primary/20 object-cover p-0.5 shadow-sm transition-all group-hover:border-primary"
                src={avatarSrc}
                onError={() => setAvatarBroken(true)}
              />
            </div>
          </div>
        </div>

        <div className="flex h-12 items-center gap-8 overflow-x-auto border-t border-outline-variant/30 bg-surface/50 px-4 no-scrollbar md:px-10 lg:px-20">
          <div className="flex h-full shrink-0 items-center">
            <button
              ref={directionButtonRef}
              type="button"
              aria-expanded={isDirectionOpen}
              aria-haspopup="menu"
              onClick={() => setIsDirectionOpen((prev) => !prev)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2 py-1 text-[14px] font-bold transition-colors",
                isDirectionOpen ? "text-primary" : "text-on-surface hover:text-primary",
              )}
            >
              <Menu className="h-4 w-4" />
              学习方向
              <ChevronDown className={cn("h-4 w-4 transition-transform", isDirectionOpen ? "rotate-180" : "")} />
            </button>
          </div>

          <div className="h-6 w-px shrink-0 bg-outline-variant" />

          <nav className="flex h-full min-w-max flex-1 items-center gap-5 lg:gap-7">
            <div className="flex items-center gap-5 lg:gap-7">
              <Link to="/" className={cn("flex h-full items-center gap-1.5 whitespace-nowrap text-[14px] font-bold transition-colors hover:text-primary", location.pathname === "/" ? "border-b-2 border-primary text-primary" : "text-on-surface-variant")}>
                <LayoutDashboard className="h-4 w-4 opacity-50" />
                学习总览
              </Link>
              <Link to="/path" className={cn("flex h-full items-center gap-1.5 whitespace-nowrap text-[14px] font-bold transition-colors hover:text-primary", location.pathname === "/path" ? "border-b-2 border-primary text-primary" : "text-on-surface-variant")}>
                <Map className="h-4 w-4 opacity-50" />
                学习路径
              </Link>
              <Link to="/profile" className={cn("flex h-full items-center gap-1.5 whitespace-nowrap text-[14px] font-bold transition-colors hover:text-primary", location.pathname === "/profile" ? "border-b-2 border-primary text-primary" : "text-on-surface-variant")}>
                <Radar className="h-4 w-4 opacity-50" />
                能力画像
              </Link>
            </div>

            <div className="mx-1 h-6 w-px shrink-0 bg-outline-variant/60 lg:mx-2" />

            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar overflow-y-hidden lg:gap-6">
              <Link to="/resources?courseId=401" className={cn("flex items-center gap-1.5 whitespace-nowrap text-[14px] font-bold transition-colors hover:text-primary", isResourceSection ? "text-primary" : "text-on-surface-variant")}>
                <BookOpen className="h-4 w-4 opacity-50" />
                资源中心
              </Link>
              <Link to="/collection" className={cn("flex items-center gap-1.5 whitespace-nowrap text-[14px] font-bold transition-colors hover:text-primary", location.pathname === "/collection" ? "text-primary" : "text-on-surface-variant")}>
                <Bookmark className="h-4 w-4 opacity-50" />
                我的收藏
              </Link>
              <Link to="/report" className={cn("flex items-center gap-1.5 whitespace-nowrap text-[14px] font-bold transition-colors hover:text-primary", location.pathname === "/report" ? "text-primary" : "text-on-surface-variant")}>
                <TrendingUp className="h-4 w-4 opacity-50" />
                学习报告
              </Link>
              <Link to="/evaluation" className={cn("flex items-center gap-1.5 whitespace-nowrap text-[14px] font-bold transition-colors hover:text-primary", location.pathname === "/evaluation" ? "text-primary" : "text-on-surface-variant")}>
                <Award className="h-4 w-4 opacity-50" />
                学习测评
              </Link>
              <Link to="/tutor?courseId=401" className={cn("flex items-center gap-2 whitespace-nowrap rounded-full bg-primary/10 px-4 py-1.5 text-[14px] font-bold text-primary transition-all hover:opacity-80", location.pathname === "/tutor" ? "ring-2 ring-primary/20" : "")}>
                <Sparkles className="h-4 w-4" />
                AI 辅导
              </Link>
            </div>
          </nav>
        </div>
      </header>
      {directionMenu}
    </>
  );
}
