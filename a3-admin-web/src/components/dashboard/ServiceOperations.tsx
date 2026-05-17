import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { DatabaseZap, ExternalLink, RefreshCcw, Server, Sparkles } from 'lucide-react';
import { describeError, getAdminPing, getEmbeddingPing, getHealth, getLlmPing, HealthPayload } from '@/src/lib/adminApi';
import { ErrorPanel, LoadingPanel, ReachableBadge } from '@/src/components/shared/AsyncState';
import { ViewType } from '@/src/types';

function openAppUrl(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer');
}

export function ServiceOperations({ onNavigate }: { onNavigate: (view: ViewType) => void }) {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [adminPing, setAdminPing] = useState<HealthPayload | null>(null);
  const [llm, setLlm] = useState<HealthPayload | null>(null);
  const [embedding, setEmbedding] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [healthPayload, adminPayload, llmPayload, embeddingPayload] = await Promise.all([
        getHealth(),
        getAdminPing(),
        getLlmPing(),
        getEmbeddingPing(),
      ]);
      setHealth(healthPayload);
      setAdminPing(adminPayload);
      setLlm(llmPayload);
      setEmbedding(embeddingPayload);
      setError('');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">服务联调</h1>
          <p className="mt-1 text-sm text-slate-500">状态卡和摘要项都可以点击，直接打开接口或继续跳转排查。</p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCcw className="h-4 w-4" />
          刷新
        </button>
      </div>

      {loading ? <LoadingPanel title="检测服务连通性" /> : null}
      {!loading && error ? <ErrorPanel title="基础链路检测失败" detail={error} /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <StatusCard
          icon={<Server className="h-5 w-5" />}
          title="AI 后端"
          description={health?.service ?? 'a3-ai-python'}
          badge={health ? <ReachableBadge label="健康检查" status={health.status} /> : null}
          hint="点击打开 /health"
          onClick={() => openAppUrl('/health')}
        />
        <StatusCard
          icon={<Sparkles className="h-5 w-5" />}
          title="LLM 连通性"
          description={llm?.model ? `${llm.provider} / ${llm.model}` : '等待检测'}
          badge={llm ? <ReachableBadge label="LLM" status={llm.status} /> : null}
          hint="点击打开 /api/v1/admin/llm/ping"
          onClick={() => openAppUrl('/api/v1/admin/llm/ping')}
        />
        <StatusCard
          icon={<DatabaseZap className="h-5 w-5" />}
          title="Embedding 连通性"
          description={embedding?.message ?? '等待检测'}
          badge={embedding ? <ReachableBadge label="Embedding" status={embedding.status} /> : null}
          hint="点击打开 /api/v1/admin/embedding/ping"
          onClick={() => openAppUrl('/api/v1/admin/embedding/ping')}
        />
      </div>

      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">联调结论</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <InfoLine label="Admin ping" value={adminPing?.message ?? '未获取'} hint="打开 admin ping" onClick={() => openAppUrl('/api/v1/admin/ping')} />
          <InfoLine label="健康检查" value={health?.status ?? '未获取'} hint="查看原始 /health" onClick={() => openAppUrl('/health')} />
          <InfoLine label="LLM 状态" value={llm?.message ?? '未获取'} hint="跳转系统管理" onClick={() => onNavigate('management')} />
          <InfoLine label="Embedding 状态" value={embedding?.message ?? '未获取'} hint="跳转 AI 监控" onClick={() => onNavigate('monitoring')} />
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  description,
  badge,
  hint,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  badge: ReactNode;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-border bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">{icon}</div>
        <ExternalLink className="h-4 w-4 text-slate-300" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      <div className="mt-4">{badge}</div>
      <p className="mt-3 text-xs text-slate-400">{hint}</p>
    </button>
  );
}

function InfoLine({ label, value, hint, onClick }: { label: string; value: string; hint: string; onClick: () => void }) {
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
