import { Activity, Bell, Bot, Cpu, FileText, HelpCircle, History, LayoutDashboard, Plus, Scale, Settings, UserCircle, Users } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { ViewType } from '@/src/types';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onOpenFlowBuilder: () => void;
  onOpenGuide: () => void;
  onOpenSupport: () => void;
  onOpenNotifications: () => void;
  onOpenHistory: () => void;
  onOpenProfile: () => void;
  onPreloadView?: (view: ViewType) => void;
  navBadges?: Partial<Record<ViewType, number>>;
  notificationCount?: number;
  historyCount?: number;
}

const navItems: Array<{ id: ViewType; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: '总览', icon: LayoutDashboard },
  { id: 'governance', label: '用户治理', icon: Users },
  { id: 'operations', label: '服务联调', icon: Cpu },
  { id: 'compliance', label: '内容审核', icon: Scale },
  { id: 'monitoring', label: 'AI 监控', icon: Activity },
  { id: 'management', label: '系统管理', icon: Settings },
];

export function Sidebar({
  currentView,
  onViewChange,
  onOpenFlowBuilder,
  onOpenGuide,
  onOpenSupport,
  onOpenNotifications,
  onOpenHistory,
  onOpenProfile,
  onPreloadView,
  navBadges,
  notificationCount,
  historyCount,
}: SidebarProps) {
  return (
    <nav className="fixed left-0 top-0 z-50 flex h-screen w-[88px] flex-col border-r border-border bg-white md:w-[220px] lg:w-[248px] xl:w-[280px]">
      <div className="flex flex-col gap-1 px-4 py-6 md:px-5 md:py-7 lg:p-8">
        <div className="flex items-center justify-center gap-3 md:justify-start">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <h1 className="hidden text-xl font-bold tracking-tight text-slate-900 md:block">A3 Admin</h1>
        </div>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">统一管理端</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-3 md:px-4 md:pb-4">
        <div className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const badgeCount = navBadges?.[item.id] ?? 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                onMouseEnter={() => onPreloadView?.(item.id)}
                onFocus={() => onPreloadView?.(item.id)}
                onPointerDown={() => onPreloadView?.(item.id)}
                className={cn(
                  'group flex w-full items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-200 md:justify-start md:px-4',
                  isActive ? 'bg-blue-50 font-semibold text-accent' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                <Icon className={cn('h-4 w-4', isActive ? 'text-accent' : 'text-slate-400 group-hover:text-slate-600')} />
                <span className="hidden md:block">{item.label}</span>
                {badgeCount > 0 ? (
                  <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-rose-100 px-1.5 text-[10px] font-bold text-rose-700">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                ) : null}
                {isActive ? <div className={cn('hidden h-1.5 w-1.5 rounded-full bg-accent md:block', badgeCount > 0 ? '' : 'ml-auto')} /> : null}
              </button>
            );
          })}
        </div>

        <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 md:block">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">快捷入口</p>
          <div className="grid gap-2">
            <QuickTile icon={Bell} label="通知中心" meta={notificationCount ? String(notificationCount) : undefined} onClick={onOpenNotifications} />
            <QuickTile icon={History} label="最近操作" meta={historyCount ? String(historyCount) : undefined} onClick={onOpenHistory} />
            <QuickTile icon={UserCircle} label="管理员菜单" meta="会话" onClick={onOpenProfile} />
          </div>
        </div>
      </div>

      <div className="mt-auto hidden border-t border-border bg-slate-50/50 p-5 md:block lg:p-6">
        <button
          type="button"
          onClick={onOpenFlowBuilder}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-400/20 bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" />
          快捷发起
        </button>
        <div className="mt-4 grid gap-2">
          <QuickFooter icon={FileText} label="联调说明" onClick={onOpenGuide} />
          <QuickFooter icon={HelpCircle} label="支持信息" onClick={onOpenSupport} />
        </div>
      </div>
    </nav>
  );
}

function QuickTile({
  icon: Icon,
  label,
  meta,
  onClick,
}: {
  icon: typeof Bell;
  label: string;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between rounded-xl border border-white bg-white px-3 py-3 text-left transition hover:border-slate-200 hover:bg-slate-100"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium text-slate-800">{label}</span>
      </div>
      {meta ? <span className="text-xs font-semibold text-slate-400">{meta}</span> : null}
    </button>
  );
}

function QuickFooter({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl border border-transparent px-3 py-2 text-xs font-medium text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-900"
    >
      <Icon className="h-3.5 w-3.5 opacity-70" />
      {label}
    </button>
  );
}
