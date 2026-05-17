import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { AlertTriangle, Database, ExternalLink, Server, ShieldCheck, Ticket, Users } from 'lucide-react';
import { DashboardSummary, describeError, getDashboardSummary, getHealth, getLlmPing, HealthPayload } from '@/src/lib/adminApi';
import { formatDateTime } from '@/src/lib/formatters';
import { ErrorPanel, LoadingPanel, ReachableBadge } from '@/src/components/shared/AsyncState';
import { ViewType } from '@/src/types';

function openAppUrl(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer');
}

export function Overview({ onNavigate }: { onNavigate: (view: ViewType) => void }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [llm, setLlm] = useState<HealthPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setLlm(null);
      try {
        const [summaryResult, healthResult] = await Promise.allSettled([getDashboardSummary(), getHealth()]);

        if (!active) {
          return;
        }

        if (summaryResult.status === 'fulfilled') {
          setSummary(summaryResult.value);
          setError('');
        } else {
          setSummary(null);
          setError(describeError(summaryResult.reason));
        }

        if (healthResult.status === 'fulfilled') {
          setHealth(healthResult.value);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }

      getLlmPing()
        .then((value) => {
          if (active) {
            setLlm(value);
          }
        })
        .catch(() => {
          if (active) {
            setLlm({ status: 'unavailable', message: 'LLM 探活失败' });
          }
        });
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">联调总览</h1>
          <p className="mt-1 text-sm text-slate-500">每一块摘要都可以继续点进对应页面或原始接口，不再只是静态展示。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ReachableBadge label="AI 后端" status={health?.status} />
          <ReachableBadge label="LLM" status={llm?.status} />
        </div>
      </div>

      {loading ? <LoadingPanel title="加载总览数据" /> : null}
      {!loading && error ? <ErrorPanel title="总览接口返回失败" detail={error} /> : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="用户总数" value={summary?.total_users} icon={<Users className="h-5 w-5" />} tone="blue" hint="点击进入用户治理" onClick={() => onNavigate('governance')} />
        <MetricCard title="高风险用户" value={summary?.high_risk_users} icon={<AlertTriangle className="h-5 w-5" />} tone="rose" hint="点击筛查高风险用户" onClick={() => onNavigate('governance')} />
        <MetricCard title="待审核内容" value={summary?.pending_review_count} icon={<ShieldCheck className="h-5 w-5" />} tone="amber" hint="点击进入内容审核" onClick={() => onNavigate('compliance')} />
        <MetricCard title="开放工单" value={summary?.open_ticket_count} icon={<Ticket className="h-5 w-5" />} tone="emerald" hint="点击查看运行与支持链路" onClick={() => onNavigate('operations')} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">当前联调判断</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <StatusRow label="前端页面" value="已接入仓库 a3-admin-web" hint="点击打开当前站点" onClick={() => openAppUrl(window.location.origin)} />
            <StatusRow label="Vite 服务" value="http://127.0.0.1:3004" hint="点击打开本地站点" onClick={() => openAppUrl('http://127.0.0.1:3004')} />
            <StatusRow label="AI 后端" value={health?.service ? `${health.service} / ${health.status}` : '检测中'} hint="点击查看服务联调页" onClick={() => onNavigate('operations')} />
            <StatusRow label="模型连通" value={llm?.model ? `${llm.model} / ${llm.status}` : '检测中'} hint="点击查看系统管理页" onClick={() => onNavigate('management')} />
            <StatusRow label="数据库状态" value={error ? '连接失败，阻塞 admin 查询接口' : '正常'} hint="点击查看系统管理页" onClick={() => onNavigate('management')} />
            <StatusRow label="最后活跃时间" value={formatDateTime(summary?.latest_activity_at)} hint="点击进入用户治理" onClick={() => onNavigate('governance')} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">主要阻塞点</h2>
              <p className="text-sm text-slate-500">这些说明项也都可以点击。</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <QuickLink title="/api/v1/admin/ping 与 /health" description="点击打开健康检查接口" onClick={() => openAppUrl('/api/v1/admin/ping')} />
            <QuickLink title="/api/v1/admin/llm/ping" description="点击打开 LLM 探活接口" onClick={() => openAppUrl('/api/v1/admin/llm/ping')} />
            <QuickLink title="dashboard / users / reviews / agents / configs" description="点击进入系统管理页继续检查" onClick={() => onNavigate('management')} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-accent">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">后续接线范围</h2>
            <p className="text-sm text-slate-500">整块卡片可点击，直接跳到目标工作区。</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <NavTile label="总览摘要" target="overview" onNavigate={onNavigate} />
          <NavTile label="用户治理" target="governance" onNavigate={onNavigate} />
          <NavTile label="内容审核" target="compliance" onNavigate={onNavigate} />
          <NavTile label="AI 监控" target="monitoring" onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  tone,
  hint,
  onClick,
}: {
  title: string;
  value: number | null | undefined;
  icon: ReactNode;
  tone: 'blue' | 'rose' | 'amber' | 'emerald';
  hint: string;
  onClick: () => void;
}) {
  const toneMap = {
    blue: 'bg-blue-50 text-blue-600',
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-border bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className={`rounded-xl p-3 ${toneMap[tone]}`}>{icon}</div>
        <ExternalLink className="h-4 w-4 text-slate-300" />
      </div>
      <p className="mt-6 text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value ?? '--'}</p>
      <p className="mt-3 text-xs text-slate-400">{hint}</p>
    </button>
  );
}

function StatusRow({ label, value, hint, onClick }: { label: string; value: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-100"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{hint}</p>
    </button>
  );
}

function QuickLink({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-100"
    >
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      <ExternalLink className="mt-0.5 h-4 w-4 text-slate-300" />
    </button>
  );
}

function NavTile({ label, target, onNavigate }: { label: string; target: ViewType; onNavigate: (view: ViewType) => void }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(target)}
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
    >
      {label}
    </button>
  );
}
