import { Suspense, lazy, useEffect, useState, type ComponentType } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { AdminPanelDrawer, PanelType } from './components/panels/AdminPanels';
import { ViewType } from './types';
import {
  describeError,
  getAIOpsOverview,
  getAdminPing,
  getAdminSessionState,
  getAgentLogs,
  getAgentRuntimeSummary,
  getAgentStatus,
  getAuditLogSummary,
  getConfigHistorySummary,
  getConfigSummary,
  getDashboardSummary,
  getDeployments,
  getEmbeddingPing,
  getHealth,
  getLlmPing,
  getMCPOverview,
  getNotifications,
  getReviewSummary,
  getReviews,
  getSystemConfigHistory,
  getSystemConfigs,
  getUserStatusHistory,
  getUsers,
  setAdminActor,
} from './lib/adminApi';

const viewImporters = {
  overview: () => import('./components/dashboard/Overview').then((module) => ({ default: module.Overview })),
  governance: () => import('./components/dashboard/UserGovernance').then((module) => ({ default: module.UserGovernance })),
  operations: () => import('./components/dashboard/ServiceOperations').then((module) => ({ default: module.ServiceOperations })),
  compliance: () => import('./components/dashboard/ContentCompliance').then((module) => ({ default: module.ContentCompliance })),
  monitoring: () => import('./components/dashboard/AIMonitoring').then((module) => ({ default: module.AIMonitoring })),
  management: () => import('./components/dashboard/SystemManagement').then((module) => ({ default: module.SystemManagement })),
} satisfies Record<ViewType, () => Promise<{ default: ComponentType<{ onNavigate: (view: ViewType) => void }> }>>;

const Overview = lazy(viewImporters.overview);
const UserGovernance = lazy(viewImporters.governance);
const ServiceOperations = lazy(viewImporters.operations);
const ContentCompliance = lazy(viewImporters.compliance);
const AIMonitoring = lazy(viewImporters.monitoring);
const SystemManagement = lazy(viewImporters.management);

function preloadView(view: ViewType) {
  void viewImporters[view]?.();
}

function scheduleViewWarmup() {
  const views: ViewType[] = ['overview', 'governance', 'operations', 'compliance', 'monitoring', 'management'];
  const warm = () => {
    views.forEach((view, index) => {
      window.setTimeout(() => preloadView(view), index * 120);
    });
  };

  if ('requestIdleCallback' in window) {
    const idleId = (window as Window & {
      requestIdleCallback: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback: (id: number) => void;
    }).requestIdleCallback(warm, { timeout: 1200 });
    return () => (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
  }

  const timer = window.setTimeout(warm, 600);
  return () => window.clearTimeout(timer);
}

function scheduleDataWarmup() {
  const batches: Array<Array<() => Promise<unknown>>> = [
    [getDashboardSummary, getNotifications, getAdminSessionState],
    [getUsers, getUserStatusHistory],
    [getHealth, getAdminPing, getLlmPing, getEmbeddingPing],
    [getReviewSummary, () => getReviews()],
    [getAgentStatus, () => getAgentLogs(), () => getAgentRuntimeSummary(), getMCPOverview],
    [getConfigSummary, getConfigHistorySummary, () => getSystemConfigs(false), getSystemConfigHistory, getAIOpsOverview, getDeployments],
  ];

  batches.forEach((batch, batchIndex) => {
    window.setTimeout(() => {
      batch.forEach((task, taskIndex) => {
        window.setTimeout(() => {
          void task().catch(() => undefined);
        }, taskIndex * 140);
      });
    }, 500 + batchIndex * 420);
  });
}

function ViewFallback() {
  return (
    <div className="min-h-[120px] rounded-3xl border border-slate-200 bg-white/60" aria-hidden="true" />
  );
}

function resolveInitialView(): ViewType {
  const value = new URLSearchParams(window.location.search).get('view');
  const views: ViewType[] = ['overview', 'governance', 'operations', 'compliance', 'monitoring', 'management'];
  return views.includes(value as ViewType) ? (value as ViewType) : 'overview';
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>(resolveInitialView);
  const [activePanel, setActivePanel] = useState<PanelType | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [navBadges, setNavBadges] = useState<Partial<Record<ViewType, number>>>({});
  const [adminLabel, setAdminLabel] = useState('管理员');
  const [environmentLabel, setEnvironmentLabel] = useState('未登录');

  const loadShellState = async () => {
    const [dashboard, reviewSummary, agentSummary, auditSummary, notifications, sessionState] = await Promise.all([
      getDashboardSummary(),
      getReviewSummary(),
      getAgentRuntimeSummary(),
      getAuditLogSummary(),
      getNotifications(),
      getAdminSessionState(),
    ]);

    setNotificationCount(notifications.unread_count);
    setHistoryCount(Math.min(auditSummary.total, 99));
    setAdminLabel(sessionState.session?.display_name ?? '管理员');
    setEnvironmentLabel(sessionState.session?.active_environment_label ?? '未登录');
    setAdminActor(sessionState.session?.username ?? 'codex-admin');
    setNavBadges({
      governance: dashboard.high_risk_users,
      compliance: reviewSummary.pending_count,
      monitoring: agentSummary.error_count + agentSummary.degraded_agent_count,
      management: dashboard.sensitive_config_count,
    });
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', currentView);
    window.history.replaceState({}, '', url);
  }, [currentView]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        await loadShellState();
      } catch (error) {
        if (active) {
          console.error(describeError(error));
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => scheduleViewWarmup(), []);

  useEffect(() => {
    const timer = window.setTimeout(scheduleDataWarmup, 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!activePanel) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePanel(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePanel]);

  const handleNavigateFromPanel = (view: ViewType) => {
    setCurrentView(view);
    setActivePanel(null);
  };

  const renderView = () => {
    switch (currentView) {
      case 'overview':
        return <Overview onNavigate={setCurrentView} />;
      case 'governance':
        return <UserGovernance onNavigate={setCurrentView} />;
      case 'operations':
        return <ServiceOperations onNavigate={setCurrentView} />;
      case 'compliance':
        return <ContentCompliance onNavigate={setCurrentView} />;
      case 'monitoring':
        return <AIMonitoring onNavigate={setCurrentView} />;
      case 'management':
        return <SystemManagement onNavigate={setCurrentView} />;
      default:
        return <Overview onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen bg-bg font-sans text-primary selection:bg-ink/20 selection:text-ink">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenFlowBuilder={() => setActivePanel('flow-builder')}
        onOpenGuide={() => setActivePanel('integration-guide')}
        onOpenSupport={() => setActivePanel('support')}
        onOpenNotifications={() => setActivePanel('notifications')}
        onOpenHistory={() => setActivePanel('history')}
        onOpenProfile={() => setActivePanel('profile')}
        navBadges={navBadges}
        notificationCount={notificationCount}
        historyCount={historyCount}
        onPreloadView={preloadView}
      />
      <div className="ml-[88px] flex min-h-screen flex-col md:ml-[220px] lg:ml-[248px] xl:ml-[280px]">
        <Header
          onOpenNotifications={() => setActivePanel('notifications')}
          onOpenHistory={() => setActivePanel('history')}
          onOpenProfile={() => setActivePanel('profile')}
          notificationCount={notificationCount}
          historyCount={historyCount}
          adminLabel={adminLabel}
          environmentLabel={environmentLabel}
        />
        <main className="mt-16 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-4 md:p-6 xl:p-8"
            >
              <Suspense fallback={<ViewFallback />}>{renderView()}</Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {activePanel ? (
        <AdminPanelDrawer
          panel={activePanel}
          onClose={() => setActivePanel(null)}
          onNavigate={handleNavigateFromPanel}
          onDataChanged={() => void loadShellState().catch((error) => console.error(describeError(error)))}
        />
      ) : null}
    </div>
  );
}
