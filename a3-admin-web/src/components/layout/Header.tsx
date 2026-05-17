import type { ReactNode } from 'react';
import { Bell, History, UserCircle } from 'lucide-react';

interface HeaderProps {
  onOpenNotifications: () => void;
  onOpenHistory: () => void;
  onOpenProfile: () => void;
  notificationCount?: number;
  historyCount?: number;
  adminLabel?: string;
  environmentLabel?: string;
}

function IconButton({
  label,
  count,
  onClick,
  children,
}: {
  label: string;
  count?: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="relative rounded-md p-1.5 text-slate-400 transition-all hover:bg-white hover:text-slate-900 hover:shadow-sm"
    >
      {children}
      {count && count > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </button>
  );
}

export function Header({
  onOpenNotifications,
  onOpenHistory,
  onOpenProfile,
  notificationCount,
  historyCount,
  adminLabel,
  environmentLabel,
}: HeaderProps) {
  return (
    <header className="fixed right-0 top-0 z-40 flex h-16 w-[calc(100%-88px)] items-center justify-between border-b border-border bg-white/80 px-4 backdrop-blur-md md:w-[calc(100%-220px)] md:px-5 lg:w-[calc(100%-248px)] lg:px-6 xl:w-[calc(100%-280px)] xl:px-8">
      <div className="flex items-center gap-3 lg:gap-6">
        <span className="text-sm font-bold tracking-tight text-slate-900">A3 管理控制台</span>
        <div className="hidden h-4 w-px bg-border lg:block" />
        <div className="hidden items-center gap-6 lg:flex">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-xs font-medium text-slate-500">前端已连接新版 admin 控制台</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">端口</span>
            <span className="text-xs font-bold text-slate-900">3004</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-slate-100 p-1">
          <IconButton label="通知中心" count={notificationCount} onClick={onOpenNotifications}>
            <Bell className="h-4 w-4" />
          </IconButton>
          <IconButton label="最近操作" count={historyCount} onClick={onOpenHistory}>
            <History className="h-4 w-4" />
          </IconButton>
        </div>
        <button
          type="button"
          aria-label="管理员菜单"
          onClick={onOpenProfile}
          className="flex items-center gap-2 rounded-full border border-border py-1 pl-2 pr-1 transition-all hover:bg-slate-50"
        >
          <div className="hidden px-2 text-left md:block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{adminLabel ?? '管理员'}</p>
            <p className="text-[10px] text-slate-400">{environmentLabel ?? '未登录'}</p>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-white">
            <UserCircle className="h-5 w-5" />
          </div>
        </button>
      </div>
    </header>
  );
}
