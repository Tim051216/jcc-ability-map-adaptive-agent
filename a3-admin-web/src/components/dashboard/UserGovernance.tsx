import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCcw, Search, ShieldAlert, UserCheck, Users } from 'lucide-react';
import {
  type AdminUserOverview,
  type AdminUserStatusHistoryItem,
  describeError,
  getUserStatusHistory,
  getUsers,
  updateUserStatus,
} from '@/src/lib/adminApi';
import { formatDateTime, formatPercent, formatRiskLabel, formatStatusLabel } from '@/src/lib/formatters';
import { ErrorPanel, LoadingPanel } from '@/src/components/shared/AsyncState';
import { ViewType } from '@/src/types';

function openAppUrl(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer');
}

type UserStatusFilter = 'all' | 'active' | 'suspended';
type UserRiskFilter = 'all' | 'high' | 'medium' | 'low';

export function UserGovernance({ onNavigate }: { onNavigate: (view: ViewType) => void }) {
  const [users, setUsers] = useState<AdminUserOverview[]>([]);
  const [statusHistory, setStatusHistory] = useState<AdminUserStatusHistoryItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');
  const [riskFilter, setRiskFilter] = useState<UserRiskFilter>('all');
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const items = await getUsers();
      setUsers(items);
      setSelectedUserId((current) => current ?? items[0]?.user_id ?? null);
      setError('');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadStatusHistory = async () => {
    setHistoryLoading(true);
    try {
      const items = await getUserStatusHistory();
      setStatusHistory(items);
      setHistoryError('');
    } catch (err) {
      setHistoryError(describeError(err));
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadUsers(), loadStatusHistory()]);
  }, []);

  const filteredUsers = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return users.filter((item) => {
      const matchesKeyword =
        !normalized ||
        [
          String(item.user_id),
          item.course_code ?? '',
          item.mastery_level ?? '',
          item.status_reason ?? '',
          item.status_updated_by ?? '',
        ].some((value) => value.toLowerCase().includes(normalized));

      const matchesStatus = statusFilter === 'all' || item.user_status === statusFilter;
      const matchesRisk =
        riskFilter === 'all' ||
        (riskFilter === 'low' ? ['low', 'normal'].includes(item.risk_level) : item.risk_level === riskFilter);

      return matchesKeyword && matchesStatus && matchesRisk;
    });
  }, [keyword, riskFilter, statusFilter, users]);

  const selectedUser = useMemo(
    () => filteredUsers.find((item) => item.user_id === selectedUserId) ?? filteredUsers[0] ?? null,
    [filteredUsers, selectedUserId],
  );

  const selectedUserHistory = useMemo(() => {
    if (!selectedUser) return [];
    return statusHistory.filter((item) => item.user_id === selectedUser.user_id).slice(0, 8);
  }, [selectedUser, statusHistory]);

  const summary = useMemo(() => {
    const total = users.length;
    const active = users.filter((item) => item.user_status === 'active').length;
    const suspended = users.filter((item) => item.user_status === 'suspended').length;
    const highRisk = users.filter((item) => item.risk_level === 'high').length;
    return { total, active, suspended, highRisk };
  }, [users]);

  const handleStatusUpdate = async (userId: number, nextStatus: string) => {
    setUpdatingId(userId);
    try {
      await updateUserStatus(userId, nextStatus, `Updated to ${nextStatus} in admin console`);
      await Promise.all([loadUsers(), loadStatusHistory()]);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
            <Users className="h-3.5 w-3.5" />
            USER GOVERNANCE
          </div>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">用户管理</h1>
          <p className="mt-1 text-sm text-slate-500">筛查风险、切换状态、查看最近活跃和状态变更，形成一页内可完成的治理闭环。</p>
        </div>

        <div className="flex flex-col gap-3 xl:min-w-[760px]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="用户总数" value={String(summary.total)} tone="slate" />
            <SummaryCard label="正常用户" value={String(summary.active)} tone="emerald" />
            <SummaryCard label="暂停用户" value={String(summary.suspended)} tone="amber" />
            <SummaryCard label="高风险用户" value={String(summary.highRisk)} tone="rose" />
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索用户 ID、课程代码、掌握度、状态原因"
                className="h-11 w-full rounded-xl border border-border bg-slate-50 pl-10 pr-4 text-sm focus:border-accent focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <FilterSelect
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as UserStatusFilter)}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'active', label: '仅正常' },
                  { value: 'suspended', label: '仅暂停' },
                ]}
              />
              <FilterSelect
                value={riskFilter}
                onChange={(value) => setRiskFilter(value as UserRiskFilter)}
                options={[
                  { value: 'all', label: '全部风险' },
                  { value: 'high', label: '高风险' },
                  { value: 'medium', label: '中风险' },
                  { value: 'low', label: '低风险' },
                ]}
              />
              <button
                type="button"
                onClick={() => void Promise.all([loadUsers(), loadStatusHistory()])}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCcw className="h-4 w-4" />
                刷新
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? <LoadingPanel title="加载用户列表" /> : null}
      {!loading && error ? <ErrorPanel title="用户接口返回失败" detail={error} /> : null}

      {!loading && !error ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_420px]">
          <section className="space-y-4">
            {filteredUsers.length === 0 ? (
              <div className="rounded-2xl border border-border bg-white p-8 text-sm text-slate-500 shadow-sm">没有匹配的用户。</div>
            ) : null}

            {filteredUsers.map((user) => {
              const selected = selectedUser?.user_id === user.user_id;
              return (
                <article
                  key={user.user_id}
                  className={`rounded-2xl border bg-white p-6 shadow-sm transition ${
                    selected ? 'border-accent shadow-[0_10px_30px_rgba(251,114,153,0.12)]' : 'border-border'
                  }`}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <button type="button" onClick={() => setSelectedUserId(user.user_id)} className="text-left">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-semibold text-slate-900">用户 {user.user_id}</span>
                        <RiskBadge risk={user.risk_level} />
                        <StatusBadge status={user.user_status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        课程 {user.course_code ?? '暂无'} · 计划 {user.latest_plan_status ? formatStatusLabel(user.latest_plan_status) : '暂无'}
                      </p>
                    </button>

                    <div className="flex flex-wrap gap-2">
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
                        暂停账号
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <InfoCell label="完成率" value={formatPercent(user.completion_rate)} onClick={() => setSelectedUserId(user.user_id)} />
                    <InfoCell label="最新分数" value={user.latest_score?.toFixed(1) ?? '暂无'} onClick={() => setSelectedUserId(user.user_id)} />
                    <InfoCell label="掌握度" value={user.mastery_level ?? '暂无'} onClick={() => setSelectedUserId(user.user_id)} />
                    <InfoCell label="开放工单" value={String(user.open_ticket_count)} onClick={() => onNavigate('operations')} />
                    <InfoCell label="最近活跃" value={formatDateTime(user.last_activity_at)} onClick={() => setSelectedUserId(user.user_id)} />
                    <InfoCell label="状态更新时间" value={formatDateTime(user.status_updated_at)} onClick={() => setSelectedUserId(user.user_id)} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <InlineAction label="查看用户详情接口" onClick={() => openAppUrl(`/api/v1/admin/users/${user.user_id}`)} />
                    <InlineAction label="查看状态历史接口" onClick={() => openAppUrl(`/api/v1/admin/users/status-history?user_id=${user.user_id}`)} />
                    <InlineAction label="查看系统管理页" onClick={() => onNavigate('management')} />
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Selected User</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    {selectedUser ? `用户 ${selectedUser.user_id}` : '未选中用户'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedUser ? `课程 ${selectedUser.course_code ?? '暂无'} · 风险 ${formatRiskLabel(selectedUser.risk_level)}` : '从左侧选择一位用户查看详情。'}
                  </p>
                </div>
                {selectedUser ? <RiskBadge risk={selectedUser.risk_level} /> : null}
              </div>

              {selectedUser ? (
                <>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <DetailRow label="状态" value={formatStatusLabel(selectedUser.user_status)} />
                    <DetailRow label="状态原因" value={selectedUser.status_reason || '暂无'} />
                    <DetailRow label="更新人" value={selectedUser.status_updated_by || '暂无'} />
                    <DetailRow label="最近活跃" value={formatDateTime(selectedUser.last_activity_at)} />
                    <DetailRow label="计划 ID" value={selectedUser.latest_plan_id ? String(selectedUser.latest_plan_id) : '暂无'} />
                    <DetailRow label="画像版本" value={selectedUser.profile_version ? String(selectedUser.profile_version) : '暂无'} />
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">最近状态变更</h3>
                      <button
                        type="button"
                        onClick={() => openAppUrl(`/api/v1/admin/users/status-history?user_id=${selectedUser.user_id}`)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:opacity-80"
                      >
                        打开接口
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {historyLoading ? <div className="mt-3 text-sm text-slate-500">状态历史加载中...</div> : null}
                    {!historyLoading && historyError ? (
                      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">{historyError}</div>
                    ) : null}
                    {!historyLoading && !historyError && selectedUserHistory.length === 0 ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">最近没有状态变更记录。</div>
                    ) : null}

                    <div className="mt-3 space-y-3">
                      {selectedUserHistory.map((item) => (
                        <div key={`${item.user_id}-${item.created_at}-${item.status}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-slate-900">{formatStatusLabel(item.status)}</span>
                            <span className="text-xs text-slate-500">{formatDateTime(item.created_at)}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">操作人：{item.updated_by || '系统'}</p>
                          <p className="mt-2 text-sm text-slate-700">{item.reason || '未填写原因'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'slate' | 'emerald' | 'amber' | 'rose' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
  };

  return (
    <div className={`rounded-2xl border px-4 py-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 rounded-xl border border-border bg-white px-3 text-sm text-slate-700 focus:border-accent focus:outline-none"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
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

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === 'suspended'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${styles}`}>{formatStatusLabel(status)}</span>;
}
