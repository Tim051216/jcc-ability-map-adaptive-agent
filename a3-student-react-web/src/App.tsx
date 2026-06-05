/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import {
  Layers,
  Compass,
  Tv,
  FolderOpen,
  Heart,
  ClipboardCheck,
  BarChart2,
  User,
  Bot
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import Header from "./components/Header";
import WelcomeScreen from "./components/WelcomeScreen";
import Login from "./pages/Login";
import { buildEvaluationRoute, buildLearnRoute, buildPathRoute, buildResourcesRoute, buildTutorRoute } from "./lib/courseContext";

const Overview = lazy(() => import("./pages/Overview"));
const LearningPath = lazy(() => import("./pages/LearningPath"));
const CourseLearning = lazy(() => import("./pages/CourseLearning"));
const ResourceCenter = lazy(() => import("./pages/ResourceCenter"));
import ResourceSourcePreview from "./pages/ResourceSourcePreview";
const CapabilityModel = lazy(() => import("./pages/CapabilityModel"));
const ProfileConversation = lazy(() => import("./pages/ProfileConversation"));
const Evaluation = lazy(() => import("./pages/Evaluation"));
const StudyReport = lazy(() => import("./pages/StudyReport"));
const Collection = lazy(() => import("./pages/Collection"));
import AITutor from "./pages/AITutor";

interface UserSession {
  id: string;
  name: string;
  avatar: string;
  loggedIn: boolean;
}

function RouteFallback() {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-[#E3E8EC] bg-white text-sm font-semibold text-[#564145]">
      正在加载页面内容...
    </div>
  );
}

function MainLayout({
  user,
  onLogout,
  children
}: {
  user: UserSession;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";
  const currentPath = location.pathname;
  const routeCourseId = Number(new URLSearchParams(location.search).get("courseId") || "");
  const activeCourseId = Number.isFinite(routeCourseId) && routeCourseId > 0 ? routeCourseId : undefined;

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

  return (
    <div className="min-h-screen bg-[#F4F7F9] flex flex-col text-[#171c22]">
      {/* Do not render header navbar on login page */}
      {!isLoginPage && <Header user={user} onLogout={onLogout} />}
      
      <div className={`flex-grow flex flex-col ${isLoginPage ? "" : "max-w-[1280px] w-full mx-auto px-4 md:px-10 py-6 md:py-8 pb-24 md:pb-8"}`}>
        {/* Main interactive content page */}
        <main className="flex-grow min-w-0">
          {children}
        </main>
      </div>

      {/* Persistent Bottom Mobile/Preview Indicator Navigation Tab Bar */}
      {!isLoginPage && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#E3E8EC] py-2 px-3 shadow-[0_-4px_16px_rgba(23,28,34,0.06)] flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <Link
                key={item.path}
                to={
                  item.id === "path"
                    ? buildPathRoute(activeCourseId)
                    : item.id === "learn"
                      ? buildLearnRoute(activeCourseId)
                      : item.id === "resources"
                        ? buildResourcesRoute(activeCourseId)
                        : item.id === "evaluation"
                          ? buildEvaluationRoute(activeCourseId)
                          : item.id === "tutor"
                            ? buildTutorRoute(activeCourseId)
                            : item.path
                }
                className={`flex flex-col items-center gap-1 text-[10px] font-extrabold shrink-0 pb-1.5 pt-0.5 px-3 rounded-xl transition-all ${
                  isActive ? "text-[#fb7299] bg-[#fb7299]/5 scale-105" : "text-[#564145]/80 hover:text-[#fb7299]"
                }`}
              >
                <item.icon className={`w-4.5 h-4.5 ${isActive ? "text-[#fb7299]" : "text-[#564145]/60"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export default function App() {
  const SESSION_STORAGE_KEY = "bililearn-user-session";
  // Keep the app entry hot-reload friendly after swapping in the zip frontend.
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    return !sessionStorage.getItem("hasSeenWelcome");
  });

  useEffect(() => {
    (window as any).retriggerWelcome = () => {
      setShowWelcome(true);
    };
    return () => {
      delete (window as any).retriggerWelcome;
    };
  }, []);

  // Pre-initialize with logged-out state for entering login page first
  const [user, setUser] = useState<UserSession>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) {
        return {
          id: "",
          name: "",
          avatar: "",
          loggedIn: false
        };
      }
      const parsed = JSON.parse(raw) as UserSession;
      return parsed?.loggedIn ? parsed : {
        id: "",
        name: "",
        avatar: "",
        loggedIn: false
      };
    } catch {
      return {
        id: "",
        name: "",
        avatar: "",
        loggedIn: false
      };
    }
  });

  useEffect(() => {
    if (user.loggedIn) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      return;
    }
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }, [user]);

  const handleLoginSuccess = (userData: { id: string; name: string; avatar: string }) => {
    setUser({
      ...userData,
      loggedIn: true
    });
  };

  const handleLogout = () => {
    setUser({
      id: "",
      name: "",
      avatar: "",
      loggedIn: false
    });
  };

  // Protected route wrapper
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const location = useLocation();
    if (!user.loggedIn) {
      return <Navigate to="/login" replace state={{ from: location }} />;
    }
    return <>{children}</>;
  };

  return (
    <BrowserRouter>
      {/* Global premium animated anime welcome screen */}
      <AnimatePresence>
        {showWelcome && (
          <WelcomeScreen onDismiss={() => setShowWelcome(false)} />
        )}
      </AnimatePresence>

      <MainLayout user={user} onLogout={handleLogout}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public Auth Portal */}
            <Route
              path="/login"
              element={
                user.loggedIn ? (
                  <Navigate to="/" replace />
                ) : (
                  <Login onLoginSuccess={handleLoginSuccess} />
                )
              }
            />

            {/* Secure Student Dashboards */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Overview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <CapabilityModel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/conversation"
              element={
                <ProtectedRoute>
                  <ProfileConversation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/path"
              element={
                <ProtectedRoute>
                  <LearningPath />
                </ProtectedRoute>
              }
            />
            <Route
              path="/learn"
              element={
                <ProtectedRoute>
                  <CourseLearning />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resources"
              element={
                <ProtectedRoute>
                  <ResourceCenter />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resources/preview"
              element={
                <ProtectedRoute>
                  <ResourceSourcePreview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/collection"
              element={
                <ProtectedRoute>
                  <Collection />
                </ProtectedRoute>
              }
            />
            <Route
              path="/report"
              element={
                <ProtectedRoute>
                  <StudyReport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/evaluation"
              element={
                <ProtectedRoute>
                  <Evaluation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tutor"
              element={
                <ProtectedRoute>
                  <AITutor user={user} />
                </ProtectedRoute>
              }
            />

            {/* Fallback route redirection to overview */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </MainLayout>
    </BrowserRouter>
  );
}
