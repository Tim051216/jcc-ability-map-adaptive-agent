import { useEffect, useState } from 'react';
import { Check, ExternalLink, RefreshCcw, X } from 'lucide-react';
import { approveReview, describeError, getReviews, getReviewSummary, rejectReview, ReviewTask, ReviewTaskSummary } from '@/src/lib/adminApi';
import { formatDateTime, formatStatusLabel } from '@/src/lib/formatters';
import { ErrorPanel, LoadingPanel } from '@/src/components/shared/AsyncState';
import { ViewType } from '@/src/types';

const filters = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已驳回' },
] as const;

function openAppUrl(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer');
}

export function ContentCompliance({ onNavigate }: { onNavigate: (view: ViewType) => void }) {
  const [filter, setFilter] = useState<(typeof filters)[number]['key']>('all');
  const [items, setItems] = useState<ReviewTask[]>([]);
  const [summary, setSummary] = useState<ReviewTaskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);

  const loadData = async (status = filter) => {
    setLoading(true);
    try {
      const [summaryPayload, reviewItems] = await Promise.all([getReviewSummary(), getReviews(status === 'all' ? undefined : status)]);
      setSummary(summaryPayload);
      setItems(reviewItems);
      setError('');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [filter]);

  const handleDecision = async (reviewId: number, type: 'approve' | 'reject') => {
    setProcessingId(reviewId);
    try {
      if (type === 'approve') {
        await approveReview(reviewId);
      } else {
        await rejectReview(reviewId);
      }
      await loadData();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">内容审核</h1>
          <p className="mt-1 text-sm text-slate-500">筛选、摘要卡、审核单和辅助入口都可以点。</p>
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

      <div className="flex flex-wrap gap-3">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              filter === item.key ? 'bg-slate-900 text-white' : 'border border-border bg-white text-slate-600'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {summary ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCell label="总任务数" value={String(summary.total)} hint="打开审核列表接口" onClick={() => openAppUrl('/api/v1/admin/reviews')} />
          <SummaryCell label="待处理" value={String(summary.pending_count)} hint="继续停留在待处理筛选" onClick={() => setFilter('pending')} />
          <SummaryCell label="最近审核时间" value={formatDateTime(summary.latest_review_at)} hint="打开审核摘要接口" onClick={() => openAppUrl('/api/v1/admin/reviews/summary')} />
        </div>
      ) : null}

      {loading ? <LoadingPanel title="加载审核任务" /> : null}
      {!loading && error ? <ErrorPanel title="审核接口返回失败" detail={error} /> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {items.map((item) => (
          <article key={item.review_id} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openAppUrl(`/api/v1/admin/reviews/${item.review_id}`)}
                    className="flex items-center gap-2 text-lg font-semibold text-slate-900 transition hover:text-accent"
                  >
                    审核单 #{item.review_id}
                    <ExternalLink className="h-4 w-4" />
                  </button>
                  <StatusPill status={item.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">类型 {item.entity_type} | 优先级 {item.priority} | 来源 {item.source_scene}</p>
              </div>
              <p className="text-xs text-slate-400">{formatDateTime(item.updated_at ?? item.created_at)}</p>
            </div>
            <button
              type="button"
              onClick={() => openAppUrl(`/api/v1/admin/reviews/${item.review_id}/history`)}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-sm leading-6 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              {item.submitted_content}
            </button>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <InlineAction label={`审核人 ${item.reviewer_name ?? '未分配'}`} onClick={() => openAppUrl(`/api/v1/admin/reviews/${item.review_id}`)} />
                <InlineAction label="查看审核历史" onClick={() => openAppUrl(`/api/v1/admin/reviews/${item.review_id}/history`)} />
                <InlineAction label="去 AI 监控" onClick={() => onNavigate('monitoring')} />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={processingId === item.review_id}
                  onClick={() => void handleDecision(item.review_id, 'reject')}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  驳回
                </button>
                <button
                  type="button"
                  disabled={processingId === item.review_id}
                  onClick={() => void handleDecision(item.review_id, 'approve')}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  通过
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function SummaryCell({ label, value, hint, onClick }: { label: string; value: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-3 text-xs text-slate-400">{hint}</p>
    </button>
  );
}

function InlineAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
    >
      {label}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const style =
    status === 'approved'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'rejected'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-amber-200 bg-amber-50 text-amber-700';

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}>{formatStatusLabel(status)}</span>;
}
