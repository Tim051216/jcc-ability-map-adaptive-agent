/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, Bell, Bot, LogOut, Heart, BarChart2, Award, User, Menu, X, Layers, Compass, Tv, FolderOpen, ClipboardCheck } from "lucide-react";

interface HeaderProps {
  user: {
    id: string;
    name: string;
    avatar: string;
    loggedIn: boolean;
  } | null;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: "摘要", id: "overview", path: "/", icon: Layers },
    { label: "路径", id: "path", path: "/path", icon: Compass },
    { label: "课堂", id: "learn", path: "/learn", icon: Tv },
    { label: "资源", id: "resources", path: "/resources", icon: FolderOpen },
    { label: "收藏", id: "collection", path: "/collection", icon: Heart },
    { label: "评估", id: "evaluation", path: "/evaluation", icon: ClipboardCheck },
    { label: "报告", id: "report", path: "/report", icon: BarChart2 },
    { label: "自画像", id: "profile", path: "/profile", icon: User },
    { label: "AI导师", id: "tutor", path: "/tutor", icon: Bot },
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/resources?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const currentPath = location.pathname;

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E3E8EC] shadow-sm">
      <div className="max-w-[1280px] mx-auto px-4 md:px-10 h-16 flex items-center justify-between">
        {/* Left Side: Brand & Level display */}
        <div className="flex items-center gap-4 xl:gap-6 flex-grow md:flex-grow-0">
          <Link
            id="nav-brand"
            to="/"
            className="font-sans text-xl md:text-2xl font-extrabold text-[#fb7299] tracking-tighter flex items-center gap-1.5 shrink-0 bg-[#fb7299]/5 px-3 py-1 rounded-full border border-[#fb7299]/15"
          >
            BiliLearn
          </Link>
          
          <span className="hidden sm:inline-block bg-[#006689]/10 text-[#006689] text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
            Lv.4 研学者画像已接入
          </span>
        </div>

        {/* Center: Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="hidden md:flex relative items-center flex-grow max-w-[240px] mx-4">
          <Search className="absolute left-3 text-[#564145] w-3.5 h-3.5 pointer-events-none" />
          <input
            id="global-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索课程、讲义、导师..."
            className="w-full pl-8 pr-3 py-1 bg-[#F1F2F3] border-none rounded-xl text-xs font-sans focus:ring-2 focus:ring-[#fb7299] text-[#171c22] placeholder:text-[#564145]/70 transition-all outline-none"
          />
        </form>

        {/* Right Side Actions */}
        <div className="flex items-center gap-4">
          {/* Quick AI Tutor Pill button */}
          <Link
            id="header-ai-tutor-pill"
            to="/tutor"
            className="flex items-center gap-1.5 bg-[#fb7299] hover:bg-[#fb7299]/90 text-white font-sans text-xs font-bold px-4 py-2 rounded-full shadow-sm hover:shadow transition-all"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AI 导师</span>
          </Link>

          {/* Bell Icon / Notification Simulator */}
          <button
            id="notification-btn"
            className="p-1.5 rounded-full hover:bg-gray-100 text-[#564145] relative transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#fb7299] rounded-full ring-2 ring-white animate-pulse" />
          </button>

          {/* User Profile Dropdown */}
          {user?.loggedIn ? (
            <div className="relative">
              <button
                id="profile-dropdown-btn"
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-8 h-8 rounded-full overflow-hidden border border-[#ddbfc4] cursor-pointer hover:ring-2 ring-[#fb7299] transition-all focus:outline-none flex"
              >
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              </button>

              {showDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowDropdown(false)}
                  />
                  <div
                    id="profile-menu-container"
                    className="absolute right-0 mt-2 w-48 bg-white border border-[#E3E8EC] rounded-2xl shadow-lg py-2 z-20 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="font-semibold text-xs text-[#171c22] font-mono">ID: {user.id}</p>
                      <p className="font-sans text-sm text-[#564145] truncate font-bold">{user.name}</p>
                    </div>

                    <Link
                      id="profile-dropdown-me"
                      to="/profile"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-[#564145] hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-4 h-4 text-[#fb7299]" />
                      我的自画像
                    </Link>

                    <Link
                      id="profile-dropdown-collection"
                      to="/collection"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-[#564145] hover:bg-gray-50 transition-colors"
                    >
                      <Heart className="w-4 h-4 text-[#fb7299]" />
                      我的收藏
                    </Link>

                    <button
                      id="profile-dropdown-logout"
                      onClick={() => {
                        setShowDropdown(false);
                        onLogout();
                      }}
                      className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-gray-100 mt-1"
                    >
                      <LogOut className="w-4 h-4" />
                      退出登录
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              id="nav-login-btn"
              to="/login"
              className="font-sans text-sm font-semibold text-[#fb7299] hover:bg-[#fb7299]/10 px-4 py-1.5 rounded-full transition-all border border-[#fb7299]"
            >
              登录
            </Link>
          )}
        </div>
      </div>

      {/* Row 2: Sub-navigation Ribbon (Sleek Horizontal Academic Belt) */}
      <div className="hidden md:block border-t border-[#E3E8EC] bg-slate-50/50 py-1.5">
        <div className="max-w-[1280px] mx-auto px-4 md:px-10 flex items-center justify-between">
          <nav className="flex items-center gap-1.5">
            {navItems.map((item) => {
              const isActive = currentPath === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-sans text-xs font-bold transition-all duration-150 cursor-pointer ${
                    isActive
                      ? "bg-[#fb7299] text-white shadow-sm shadow-[#fb7299]/15"
                      : "text-[#564145] hover:bg-[#fb7299]/10 hover:text-[#fb7299]"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (typeof (window as any).retriggerWelcome === "function") {
                  (window as any).retriggerWelcome();
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black text-pink-500 hover:text-pink-600 bg-pink-50 hover:bg-pink-100 rounded-full border border-pink-200 transition-all cursor-pointer shadow-xs"
              title="重新探访双学协同欢迎舱"
            >
              <Award className="w-3 h-3 text-pink-500 animate-spin" style={{ animationDuration: '4s' }} />
              <span>启动双生舱 🪐</span>
            </button>

            <div className="flex items-center gap-2 text-[10px] font-bold text-[#564145]/70 font-mono">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span>智能研学空间活跃中</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
