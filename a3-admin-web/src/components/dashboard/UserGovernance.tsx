import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCcw, Search, ShieldAlert, UserCheck } from 'lucide-react';
import { AdminUserOverview, describeError, getUsers, updateUserStatus } from '@/src/lib/adminApi';
import { formatDateTime, formatPercent, formatRiskLabel, formatStatusLabel } from '@/src/lib/formatters';
import { ErrorPanel, LoadingPanel } from '@/src/components/shared/AsyncState';
import { ViewType } from '@/src/types';

function openAppUrl(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer');
}

export function UserGovernance({ onNavigate }: { onNavigate: (view: ViewType) => void }) {
  const [users, setUsers] = useState<AdminUserOverview[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const items = await getUsers();
      setUsers(items);
      setError('');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return users;
    }

    return users.filter((item) =>
      [String(item.user_id), item.course_code ?? '', item.mastery_level ?? ''].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [keyword, users]);

  const handleStatusUpdate = async (userId: number, nextStatus: string) => {
    setUpdatingId(userId);
    try {
      await updateUserStatus(userId, nextStatus, `Switched to ${nextStatus} from admin console`);
      await loadUsers();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">用户治理</h1>
          <p className="mt-1 text-sm text-slate-500">用户卡片、字段卡和辅助入口都支持点击，既能操作也能继续查看原始数据。</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索用户 ID、课程代码、掌握度"
              className="h-11 w-72 rounded-xl border border-border bg-white pl-10 pr-4 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" />
            刷新
          </button>
        </div>
      </div>

      {loading ? <LoadingPanel title="加载用户总览" /> : null}
      {!loading && error ? <ErrorPanel title="用户接口返回失败" detail={error} /> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {filteredUsers.map((user) => (
          <article key={user.user_id} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openAppUrl(`/api/v1/admin/users/${user.user_id}`)}
                    className="flex items-center gap-2 text-xl font-semibold text-slate-900 transition hover:text-accent"
                  >
                    用户 {user.user_id}
                    <ExternalLink className="h-4 w-4" />
                  </button>
                  <RiskBadge risk={user.risk_level} />
                </div>
                <p className="mt-1 text-sm text-slate-500">课程 {user.course_code ?? '暂无'} | 状态 {formatStatusLabel(user.user_status)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={updatingId === user.user_id}
                  onClick={() => void handleStatusUpdate(user.user_id, 'active')}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                >
                  <UserCheck className="h-4 w-4" />
                  设为正常
                </button>
                <button
                  type="button"
                  disabled={updatingId === user.user_id}
                  onClick={() => void handleStatusUpdate(user.user_id, 'suspended')}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                >
                  <ShieldAlert className="h-4 w-4" />
                  暂停
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <InlineAction label="查看用户详情接口" onClick={() => openAppUrl(`/api/v1/admin/users/${user.user_id}`)} />
              <InlineAction label="查看状态历史" onClick={() => openAppUrl(`/api/v1/admin/users/status-history?user_id=${user.user_id}`)} />
              <InlineAction label="去系统管理页" onClick={() => onNavigate('management')} />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <InfoCell label="完成率" value={formatPercent(user.completion_rate)} onClick={() => openAppUrl(`/api/v1/admin/users/${user.user_id}`)} />
              <InfoCell label="最新分数" value={user.latest_score?.toFixed(1) ?? '暂无'} onClick={() => openAppUrl(`/api/v1/admin/users/${user.user_id}`)} />
              <InfoCell label="掌握度" value={user.mastery_level ?? '暂无'} onClick={() => openAppUrl(`/api/v1/admin/users/${user.user_id}`)} />
              <InfoCell label="开放工单" value={String(user.open_ticket_count)} onClick={() => onNavigate('operations')} />
              <InfoCell label="计划状态" value={user.latest_plan_status ? formatStatusLabel(user.latest_plan_status) : '暂无'} onClick={() => openAppUrl(`/api/v1/admin/users/${user.user_id}`)} />
              <InfoCell label="最近活跃" value={formatDateTime(user.last_activity_at)} onClick={() => openAppUrl(`/api/v1/admin/users/${user.user_id}`)} />
            </div>
          </article>
        ))}
      </div>

      {!loading && !error && filteredUsers.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white p-8 text-sm text-slate-500 shadow-sm">没有匹配的用户。</div>
      ) : null}
    </div>
  );
}

function InfoCell({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-100"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
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

function RiskBadge({ risk }: { risk: string }) {
  const styles =
    risk === 'high'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : risk === 'medium'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${styles}`}>{formatRiskLabel(risk)}</span>;
}
