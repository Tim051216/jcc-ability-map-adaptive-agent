import { Suspense, lazy, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { AdminPanelDrawer, PanelType } from './components/panels/AdminPanels';
import { ViewType } from './types';
import { describeError, getAdminSessionState, getAgentRuntimeSummary, getAuditLogSummary, getDashboardSummary, getNotifications, getReviewSummary, setAdminActor } from './lib/adminApi';

const Overview = lazy(() => import('./components/dashboard/Overview').then((module) => ({ default: module.Overview })));
const UserGovernance = lazy(() => import('./components/dashboard/UserGovernance').then((module) => ({ default: module.UserGovernance })));
const ServiceOperations = lazy(() => import('./components/dashboard/ServiceOperations').then((module) => ({ default: module.ServiceOperations })));
const ContentCompliance = lazy(() => import('./components/dashboard/ContentCompliance').then((module) => ({ default: module.ContentCompliance })));
const AIMonitoring = lazy(() => import('./components/dashboard/AIMonitoring').then((module) => ({ default: module.AIMonitoring })));
const SystemManagement = lazy(() => import('./components/dashboard/SystemManagement').then((module) => ({ default: module.SystemManagement })));

function ViewFallback() {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-slate-200 bg-white text-sm font-semibold text-slate-500">
      正在加载管理视图...
    </div>
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
