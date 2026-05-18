import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  Bell,
  CircleAlert,
  FileText,
  HelpCircle,
  History,
  Plus,
  Shield,
  UserCircle,
  X,
} from 'lucide-react';
import {
  AdminNotificationItem,
  AdminSessionEnvironment,
  AdminSessionHistoryItem,
  AdminSessionState,
  AdminUserStatusHistoryItem,
  AgentRuntimeSummary,
  AuditLogItem,
  AuditLogSummary,
  HealthPayload,
  SystemConfigHistorySummary,
  createReviewTask,
  describeError,
  getAdminPing,
  getAdminSessionState,
  getAgentRuntimeSummary,
  getAuditLogs,
  getAuditLogSummary,
  getConfigHistorySummary,
  getEmbeddingPing,
  getHealth,
  getLlmPing,
  getNotifications,
  getReviewSummary,
  getUserStatusHistory,
  ingestKnowledge,
  loginAdminSession,
  markNotificationRead,
  logoutAdminSession,
  reopenNotification,
  resolveNotification,
  setAdminActor,
  switchAdminEnvironment,
} from '@/src/lib/adminApi';
import { formatDateTime, formatStatusLabel } from '@/src/lib/formatters';
import { ViewType } from '@/src/types';
import { ErrorPanel, LoadingPanel, ReachableBadge } from '@/src/components/shared/AsyncState';

export type PanelType = 'flow-builder' | 'integration-guide' | 'support' | 'notifications' | 'history' | 'profile';

const panelConfig: Record<PanelType, { title: string; description: string; icon: typeof Plus }> = {
  'flow-builder': {
    title: '快捷发起',
    description: '用来直接发起后台动作，比如创建审核任务或触发知识入库，不是流程设计器。',
    icon: Plus,
  },
  'integration-guide': {
    title: '联调说明',
    description: '结合当前环境的真实服务状态，给出能直接点开的检查链路和排障入口。',
    icon: FileText,
  },
  support: {
    title: '支持信息',
    description: '汇总当前环境的关键支撑链路、导出入口和排障位置，减少来回找服务的成本。',
    icon: HelpCircle,
  },
  notifications: {
    title: '通知中心',
    description: '根据真实告警、审核、代理与配置状态生成当前需要优先关注的管理提示。',
    icon: Bell,
  },
  history: {
    title: '最近操作',
    description: '展示真实审计日志和用户状态变更，帮助回看最近有哪些写操作已经落库。',
    icon: History,
  },
  profile: {
    title: '管理员信息',
    description: '把头像按钮升级成账户菜单，提供环境概况、最近写入和常用管理动作。',
    icon: UserCircle,
  },
};

function openApiUrl(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer');
}

function ActionButton({
  label,
  onClick,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'primary';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        tone === 'primary'
          ? 'rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800'
          : 'rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50'
      }
    >
      {label}
    </button>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-slate-50/70 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function StatusLine({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
      >
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-sm font-semibold text-slate-900">{value}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function NotificationCard({
  item,
  busy,
  onNavigate,
  onMarkRead,
  onResolve,
  onReopen,
}: {
  item: AdminNotificationItem;
  busy: boolean;
  onNavigate?: (view: ViewType) => void;
  onMarkRead: (notificationId: string) => void;
  onResolve: (notificationId: string) => void;
  onReopen: (notificationId: string) => void;
}) {
  const toneMap = {
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
  const tone = item.tone === 'danger' ? 'danger' : item.tone === 'success' ? 'success' : 'warning';

  return (
    <article className={`rounded-2xl border p-4 ${toneMap[tone]}`}>
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{item.title}</h3>
            {item.unread ? <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold">未读</span> : null}
            {item.status === 'resolved' ? <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold">已处理</span> : null}
          </div>
          <p className="mt-1 text-sm leading-6">{item.detail}</p>
          <p className="mt-2 text-xs opacity-80">
            数量 {item.count} · 生成于 {formatDateTime(item.generated_at)}{item.updated_at ? ` · 更新于 ${formatDateTime(item.updated_at)}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.target_view && onNavigate ? (
              <button
                type="button"
                onClick={() => onNavigate(item.target_view as ViewType)}
                className="text-sm font-semibold underline underline-offset-4"
              >
                {item.target_label ?? '打开详情'}
              </button>
            ) : null}
            {item.status !== 'resolved' ? (
              <>
                {item.unread ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onMarkRead(item.notification_id)}
                    className="rounded-full border border-current px-3 py-1 text-xs font-semibold disabled:opacity-50"
                  >
                    标记已读
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onResolve(item.notification_id)}
                  className="rounded-full border border-current px-3 py-1 text-xs font-semibold disabled:opacity-50"
                >
                  标记已处理
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => onReopen(item.notification_id)}
                className="rounded-full border border-current px-3 py-1 text-xs font-semibold disabled:opacity-50"
              >
                重新打开
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function FlowBuilderPanel({
  onNavigate,
  onDataChanged,
}: {
  onNavigate: (view: ViewType) => void;
  onDataChanged?: () => void;
}) {
  const [draft, setDraft] = useState({
    entityType: 'resource',
    entityId: '1001',
    sourceScene: 'manual_submit',
    priority: 'normal',
    submittedContent: '',
  });
  const [courseCode, setCourseCode] = useState('ml_intro');
  const [submitting, setSubmitting] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const templates = [
    {
      label: '资源发布审核',
      draft: {
        entityType: 'resource',
        entityId: '1201',
        sourceScene: 'resource_publish',
        priority: 'high',
        submittedContent: '新课程资料发布，需要进入审核队列验证内容完整性与敏感词策略。',
      },
    },
    {
      label: '助教答复复核',
      draft: {
        entityType: 'answer',
        entityId: '3301',
        sourceScene: 'tutor_reply',
        priority: 'normal',
        submittedContent: '智能助教针对模型评估问题给出新答复，需要人工复核是否存在误导性结论。',
      },
    },
    {
      label: '学习报告复核',
      draft: {
        entityType: 'report',
        entityId: '2208',
        sourceScene: 'report_publish',
        priority: 'normal',
        submittedContent: '学习报告新增错题复盘建议，提交给审核流确认措辞和干预建议。',
      },
    },
  ];

  const handleCreateReview = async () => {
    setSubmitting(true);
    setSuccess('');
    setError('');
    try {
      const item = await createReviewTask({
        entity_type: draft.entityType,
        entity_id: Number(draft.entityId),
        source_scene: draft.sourceScene,
        priority: draft.priority,
        submitted_content: draft.submittedContent,
      });
      setSuccess(`已创建审核任务 #${item.review_id}，可以直接去内容审核查看。`);
      setDraft((current) => ({ ...current, submittedContent: '' }));
      onDataChanged?.();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleIngest = async () => {
    setIngesting(true);
    setSuccess('');
    setError('');
    try {
      await ingestKnowledge(courseCode);
      setSuccess(`已触发课程 ${courseCode} 的知识入库流程。`);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Section title="实际创建页" description="直接创建后台审核任务，替代之前只有说明的占位入口。">
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {templates.map((template) => (
              <button
                key={template.label}
                type="button"
                onClick={() => setDraft(template.draft)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                {template.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-500">
              实体类型
              <input
                value={draft.entityType}
                onChange={(event) => setDraft((current) => ({ ...current, entityType: event.target.value }))}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-slate-900"
              />
            </label>
            <label className="text-xs font-medium text-slate-500">
              实体 ID
              <input
                value={draft.entityId}
                onChange={(event) => setDraft((current) => ({ ...current, entityId: event.target.value }))}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-slate-900"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-500">
              来源场景
              <input
                value={draft.sourceScene}
                onChange={(event) => setDraft((current) => ({ ...current, sourceScene: event.target.value }))}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-slate-900"
              />
            </label>
            <label className="text-xs font-medium text-slate-500">
              优先级
              <select
                value={draft.priority}
                onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-slate-900"
              >
                <option value="normal">normal</option>
                <option value="high">high</option>
              </select>
            </label>
          </div>
          <label className="text-xs font-medium text-slate-500">
            提交内容
            <textarea
              value={draft.submittedContent}
              onChange={(event) => setDraft((current) => ({ ...current, submittedContent: event.target.value }))}
              rows={4}
              className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-3 text-sm text-slate-900"
              placeholder="输入需要进入内容审核的真实内容"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <ActionButton label={submitting ? '创建中...' : '创建审核任务'} onClick={() => void handleCreateReview()} tone="primary" />
            <ActionButton label="前往内容审核" onClick={() => onNavigate('compliance')} />
          </div>
        </div>
      </Section>

      <Section title="知识入库" description="直接触发课程知识入库，适合联调后快速验证 AI 服务处理链路。">
        <div className="flex flex-col gap-3">
          <label className="text-xs font-medium text-slate-500">
            课程编码
            <input
              value={courseCode}
              onChange={(event) => setCourseCode(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-slate-900"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <ActionButton label={ingesting ? '提交中...' : '触发知识入库'} onClick={() => void handleIngest()} tone="primary" />
            <ActionButton label="前往 AI 监控" onClick={() => onNavigate('monitoring')} />
          </div>
        </div>
      </Section>

      <Section title="常用流程入口">
        <div className="grid gap-3">
          <ActionButton label="打开用户治理联调" onClick={() => onNavigate('governance')} />
          <ActionButton label="打开服务联调看板" onClick={() => onNavigate('operations')} />
          <ActionButton label="打开系统管理检查配置" onClick={() => onNavigate('management')} />
        </div>
      </Section>

      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}
      {error ? <ErrorPanel title="流程提交失败" detail={error} /> : null}
    </div>
  );
}

function IntegrationGuidePanel({ onNavigate }: { onNavigate: (view: ViewType) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [adminPing, setAdminPing] = useState<HealthPayload | null>(null);
  const [llm, setLlm] = useState<HealthPayload | null>(null);
  const [embedding, setEmbedding] = useState<HealthPayload | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [healthResult, adminResult, llmResult, embeddingResult] = await Promise.all([
          getHealth(),
          getAdminPing(),
          getLlmPing(),
          getEmbeddingPing(),
        ]);
        if (!active) {
          return;
        }
        setHealth(healthResult);
        setAdminPing(adminResult);
        setLlm(llmResult);
        setEmbedding(embeddingResult);
        setError('');
      } catch (err) {
        if (active) {
          setError(describeError(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <LoadingPanel title="加载联调说明" />;
  }

  if (error) {
    return <ErrorPanel title="联调说明加载失败" detail={error} />;
  }

  return (
    <div className="space-y-4">
      <Section title="实时检查结果" description="这些状态来自当前本地环境，不是静态文案。">
        <div className="flex flex-wrap gap-3">
          <ReachableBadge label="AI 后端" status={health?.status} />
          <ReachableBadge label="Admin ping" status={adminPing ? 'ok' : 'checking'} />
          <ReachableBadge label="LLM" status={llm?.status} />
          <ReachableBadge label="Embedding" status={embedding?.status} />
        </div>
        <div className="mt-4 grid gap-3">
          <StatusLine label="/health" value={health?.service ? `${health.service} / ${health.status}` : '未返回'} />
          <StatusLine label="/api/v1/admin/ping" value={adminPing?.message ?? '未返回'} />
          <StatusLine label="LLM 探活" value={llm?.message ?? llm?.status ?? '未返回'} />
          <StatusLine label="Embedding 探活" value={embedding?.message ?? embedding?.status ?? '未返回'} />
        </div>
      </Section>

      <Section title="直接检查入口">
        <div className="grid gap-3">
          <ActionButton label="打开原始 /health" onClick={() => openApiUrl('/health')} />
          <ActionButton label="打开原始 /api/v1/admin/ping" onClick={() => openApiUrl('/api/v1/admin/ping')} />
          <ActionButton label="查看服务联调看板" onClick={() => onNavigate('operations')} tone="primary" />
          <ActionButton label="查看系统管理页" onClick={() => onNavigate('management')} />
        </div>
      </Section>
    </div>
  );
}

function SupportPanel({ onNavigate }: { onNavigate: (view: ViewType) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [agentSummary, setAgentSummary] = useState<AgentRuntimeSummary | null>(null);
  const [auditSummary, setAuditSummary] = useState<AuditLogSummary | null>(null);
  const [configSummary, setConfigSummary] = useState<SystemConfigHistorySummary | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [healthResult, agentResult, auditResult, configResult] = await Promise.all([
          getHealth(),
          getAgentRuntimeSummary(),
          getAuditLogSummary(),
          getConfigHistorySummary(),
        ]);
        if (!active) {
          return;
        }
        setHealth(healthResult);
        setAgentSummary(agentResult);
        setAuditSummary(auditResult);
        setConfigSummary(configResult);
        setError('');
      } catch (err) {
        if (active) {
          setError(describeError(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <LoadingPanel title="加载支持信息" />;
  }

  if (error) {
    return <ErrorPanel title="支持信息加载失败" detail={error} />;
  }

  return (
    <div className="space-y-4">
      <Section title="当前支撑链路">
        <div className="grid gap-3">
          <StatusLine label="前端管理台" value="http://127.0.0.1:3004" />
          <StatusLine label="AI 后端" value={health?.service ? `127.0.0.1:18080 / ${health.status}` : '未返回'} />
          <StatusLine label="运行日志" value={`${agentSummary?.total ?? 0} 条`} />
          <StatusLine label="审计日志" value={`${auditSummary?.total ?? 0} 条`} />
          <StatusLine label="配置历史" value={`${configSummary?.total ?? 0} 次`} />
        </div>
      </Section>

      <Section title="真实导出与排障入口">
        <div className="grid gap-3">
          <ActionButton label="导出审计日志 CSV" onClick={() => openApiUrl('/api/v1/admin/logs/export')} tone="primary" />
          <ActionButton label="导出 Agent 日志 CSV" onClick={() => openApiUrl('/api/v1/admin/agents/logs/export')} />
          <ActionButton label="打开 AI 监控页" onClick={() => onNavigate('monitoring')} />
          <ActionButton label="打开系统管理页" onClick={() => onNavigate('management')} />
        </div>
      </Section>
    </div>
  );
}

function NotificationsPanel({
  onNavigate,
  onDataChanged,
}: {
  onNavigate: (view: ViewType) => void;
  onDataChanged?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [summary, setSummary] = useState({ unread_count: 0, open_count: 0, resolved_count: 0 });
  const [filter, setFilter] = useState<'all' | 'open' | 'unread' | 'resolved'>('all');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const payload = await getNotifications();
      setItems(payload.items);
      setSummary({
        unread_count: payload.unread_count,
        open_count: payload.open_count,
        resolved_count: payload.resolved_count,
      });
      setError('');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleAction = async (notificationId: string, action: 'read' | 'resolve' | 'reopen') => {
    setBusyId(notificationId);
    try {
      if (action === 'read') {
        await markNotificationRead(notificationId);
      } else if (action === 'resolve') {
        await resolveNotification(notificationId);
      } else {
        await reopenNotification(notificationId);
      }
      await load();
      onDataChanged?.();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusyId('');
    }
  };

  const filteredItems = items.filter((item) => {
    if (filter === 'all') {
      return true;
    }
    if (filter === 'unread') {
      return item.unread && item.status !== 'resolved';
    }
    if (filter === 'open') {
      return item.status !== 'resolved';
    }
    return item.status === 'resolved';
  });

  if (loading) {
    return <LoadingPanel title="加载通知中心" />;
  }

  if (error) {
    return <ErrorPanel title="通知中心加载失败" detail={error} />;
  }

  return (
    <div className="space-y-4">
      <Section title="通知概况" description="这些状态由后端生成并持久化，可跨刷新保留已读和已处理结果。">
        <div className="grid grid-cols-3 gap-3">
          <StatusLine label="未读" value={String(summary.unread_count)} />
          <StatusLine label="未处理" value={String(summary.open_count)} />
          <StatusLine label="已处理" value={String(summary.resolved_count)} />
        </div>
      </Section>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: '全部' },
          { key: 'unread', label: '未读' },
          { key: 'open', label: '未处理' },
          { key: 'resolved', label: '已处理' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key as 'all' | 'open' | 'unread' | 'resolved')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              filter === item.key ? 'bg-slate-900 text-white' : 'border border-border bg-white text-slate-600'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {filteredItems.map((item) => (
          <div key={item.notification_id}>
            <NotificationCard
              item={item}
              busy={busyId === item.notification_id}
              onNavigate={onNavigate}
              onMarkRead={(notificationId) => void handleAction(notificationId, 'read')}
              onResolve={(notificationId) => void handleAction(notificationId, 'resolve')}
              onReopen={(notificationId) => void handleAction(notificationId, 'reopen')}
            />
          </div>
        ))}
      </div>

      {!filteredItems.length ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          当前筛选条件下没有通知项，所有事项都已处理完成。
        </div>
      ) : null}
    </div>
  );
}

function HistoryPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [statusHistory, setStatusHistory] = useState<AdminUserStatusHistoryItem[]>([]);
  const [summary, setSummary] = useState<AuditLogSummary | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [logsResult, statusResult, summaryResult] = await Promise.all([
          getAuditLogs(),
          getUserStatusHistory(),
          getAuditLogSummary(),
        ]);
        if (!active) {
          return;
        }
        setLogs(logsResult.slice(0, 6));
        setStatusHistory(statusResult.slice(0, 6));
        setSummary(summaryResult);
        setError('');
      } catch (err) {
        if (active) {
          setError(describeError(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <LoadingPanel title="加载最近操作" />;
  }

  if (error) {
    return <ErrorPanel title="最近操作加载失败" detail={error} />;
  }

  return (
    <div className="space-y-4">
      <Section title="审计日志概况">
        <div className="grid gap-3">
          <StatusLine label="日志总数" value={String(summary?.total ?? 0)} />
          <StatusLine label="最近写入" value={formatDateTime(summary?.latest_log_at)} />
        </div>
      </Section>

      <Section title="最近审计日志">
        <div className="space-y-3">
          {logs.map((item) => (
            <div key={item.log_id} className="rounded-xl border border-border bg-white px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">
                {item.scene} / {item.action}
              </p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.created_at)}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="最近用户状态变更">
        <div className="space-y-3">
          {statusHistory.map((item) => (
            <div key={`${item.user_id}-${item.created_at}-${item.status}`} className="rounded-xl border border-border bg-white px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">
                用户 {item.user_id} 切换为 {formatStatusLabel(item.status)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {item.updated_by ?? '未知操作人'} · {formatDateTime(item.created_at)}
              </p>
              {item.reason ? <p className="mt-2 text-sm text-slate-600">{item.reason}</p> : null}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function ProfilePanel({ onNavigate }: { onNavigate: (view: ViewType) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminPing, setAdminPing] = useState<HealthPayload | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [statusHistory, setStatusHistory] = useState<AdminUserStatusHistoryItem[]>([]);
  const [configHistory, setConfigHistory] = useState<SystemConfigHistorySummary | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [adminResult, healthResult, statusResult, configResult] = await Promise.all([
          getAdminPing(),
          getHealth(),
          getUserStatusHistory(undefined, undefined, 'codex-admin'),
          getConfigHistorySummary(undefined, 'codex-admin'),
        ]);
        if (!active) {
          return;
        }
        setAdminPing(adminResult);
        setHealth(healthResult);
        setStatusHistory(statusResult.slice(0, 4));
        setConfigHistory(configResult);
        setError('');
      } catch (err) {
        if (active) {
          setError(describeError(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <LoadingPanel title="加载管理员菜单" />;
  }

  if (error) {
    return <ErrorPanel title="管理员菜单加载失败" detail={error} />;
  }

  return (
    <div className="space-y-4">
      <Section title="当前账户">
        <div className="rounded-2xl border border-border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">codex-admin</p>
              <p className="text-xs text-slate-500">本地联调管理员</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <ReachableBadge label="Admin ping" status={adminPing ? 'ok' : 'checking'} />
            <ReachableBadge label="AI 后端" status={health?.status} />
          </div>
        </div>
      </Section>

      <Section title="账户动作">
        <div className="grid gap-3">
          <ActionButton label="打开系统管理" onClick={() => onNavigate('management')} tone="primary" />
          <ActionButton label="打开通知中心" onClick={() => onNavigate('overview')} />
          <ActionButton label="导出审计日志" onClick={() => openApiUrl('/api/v1/admin/logs/export')} />
        </div>
      </Section>

      <Section title="最近由当前管理员触发的写入">
        <div className="grid gap-3">
          <StatusLine label="配置改动次数" value={String(configHistory?.total ?? 0)} />
          <StatusLine label="最近配置改动" value={formatDateTime(configHistory?.latest_created_at)} />
        </div>
        <div className="mt-4 space-y-3">
              {statusHistory.map((item) => (
              <div key={`${item.user_id}-${item.created_at}`} className="rounded-xl border border-border bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">
                用户 {item.user_id} {'->'} {formatStatusLabel(item.status)}
                </p>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.created_at)}</p>
              </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function ProfileSessionPanel({
  onNavigate,
  onDataChanged,
}: {
  onNavigate: (view: ViewType) => void;
  onDataChanged?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adminPing, setAdminPing] = useState<HealthPayload | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [sessionState, setSessionState] = useState<AdminSessionState | null>(null);
  const [statusHistory, setStatusHistory] = useState<AdminUserStatusHistoryItem[]>([]);
  const [configHistory, setConfigHistory] = useState<SystemConfigHistorySummary | null>(null);
  const [credentials, setCredentials] = useState({
    username: 'codex-admin',
    password: 'codex-local',
    environmentId: 'local-live',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [adminResult, healthResult, sessionResult] = await Promise.all([
        getAdminPing(),
        getHealth(),
        getAdminSessionState(),
      ]);
      const actor = sessionResult.session?.username ?? 'codex-admin';
      const [statusResult, configResult] = await Promise.all([
        getUserStatusHistory(undefined, undefined, actor),
        getConfigHistorySummary(undefined, actor),
      ]);
      setAdminPing(adminResult);
      setHealth(healthResult);
      setSessionState(sessionResult);
      setStatusHistory(statusResult.slice(0, 4));
      setConfigHistory(configResult);
      setCredentials((current) => ({
        ...current,
        environmentId: sessionResult.session?.active_environment_id ?? current.environmentId,
      }));
      setAdminActor(actor);
      setError('');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const activeSession = sessionState?.session ?? null;
  const environments = sessionState?.environments ?? [];
  const sessionHistory = sessionState?.history ?? [];

  const handleLogin = async () => {
    setBusy(true);
    setActionError('');
    try {
      const nextState = await loginAdminSession(credentials.username, credentials.password, credentials.environmentId);
      setSessionState(nextState);
      setAdminActor(nextState.session?.username ?? credentials.username);
      onDataChanged?.();
      await load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setActionError('');
    try {
      const nextState = await logoutAdminSession();
      setSessionState(nextState);
      setAdminActor(nextState.session?.username ?? 'codex-admin');
      onDataChanged?.();
      await load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchEnvironment = async (environmentId: string) => {
    setBusy(true);
    setActionError('');
    try {
      const nextState = await switchAdminEnvironment(environmentId);
      setSessionState(nextState);
      setCredentials((current) => ({ ...current, environmentId }));
      setAdminActor(nextState.session?.username ?? 'codex-admin');
      onDataChanged?.();
      await load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <LoadingPanel title="加载管理员菜单" />;
  }

  if (error) {
    return <ErrorPanel title="管理员菜单加载失败" detail={error} />;
  }

  return (
    <div className="space-y-4">
      <Section title="当前账户">
        <div className="rounded-2xl border border-border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{activeSession?.display_name ?? '未登录管理员'}</p>
              <p className="text-xs text-slate-500">
                {activeSession ? `${activeSession.username} · ${activeSession.active_environment_label}` : '请先登录后再执行管理员写操作'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <ReachableBadge label="Admin ping" status={adminPing ? 'ok' : 'checking'} />
            <ReachableBadge label="AI 后端" status={health?.status} />
          </div>
          {activeSession ? (
            <div className="mt-4 grid gap-3">
              <StatusLine label="角色" value={activeSession.role} />
              <StatusLine label="登录时间" value={formatDateTime(activeSession.logged_in_at)} />
              <StatusLine label="最近活动" value={formatDateTime(activeSession.last_seen_at)} />
            </div>
          ) : null}
          {actionError ? <p className="mt-4 text-sm text-rose-600">{actionError}</p> : null}
        </div>
      </Section>

      {!activeSession ? (
        <Section title="管理员登录" description="登录后会话和环境 profile 会由后端持久化保存。">
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-500">用户名</span>
              <select
                value={credentials.username}
                onChange={(event) => setCredentials((current) => ({ ...current, username: event.target.value }))}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="codex-admin">codex-admin</option>
                <option value="ops-admin">ops-admin</option>
                <option value="review-admin">review-admin</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-500">密码</span>
              <input
                type="password"
                value={credentials.password}
                onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-500">登录环境</span>
              <select
                value={credentials.environmentId}
                onChange={(event) => setCredentials((current) => ({ ...current, environmentId: event.target.value }))}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm text-slate-900"
              >
                {environments.map((environment: AdminSessionEnvironment) => (
                  <option key={environment.environment_id} value={environment.environment_id}>
                    {environment.label}
                  </option>
                ))}
              </select>
            </label>
            <ActionButton label={busy ? '登录中...' : '登录管理员会话'} onClick={() => void handleLogin()} tone="primary" />
          </div>
          <p className="mt-3 text-xs text-slate-500">测试账号：codex-admin / codex-local、ops-admin / ops-local、review-admin / review-local。</p>
        </Section>
      ) : null}

      {activeSession ? (
        <Section title="环境切换" description="切换当前管理员的环境 profile，并保留最近切换历史。">
          <div className="grid gap-3">
            {environments.map((environment: AdminSessionEnvironment) => (
              <div key={environment.environment_id} className="rounded-xl border border-border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{environment.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{environment.description}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                      environment.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {environment.is_active ? '当前环境' : environment.risk_level}
                  </span>
                </div>
                <div className="mt-3 grid gap-2">
                  <StatusLine label="APP_ENV" value={environment.app_env} />
                  <StatusLine label="LLM 模式" value={environment.llm_mode} />
                  <StatusLine label="Embedding 模式" value={environment.embedding_mode} />
                </div>
                {!environment.is_active ? (
                  <div className="mt-3">
                    <ActionButton label={busy ? '切换中...' : '切换到此环境'} onClick={() => void handleSwitchEnvironment(environment.environment_id)} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="账户动作">
        <div className="grid gap-3">
          <ActionButton label="打开系统管理" onClick={() => onNavigate('management')} tone="primary" />
          <ActionButton label="打开通知中心" onClick={() => onNavigate('overview')} />
          <ActionButton label="导出审计日志" onClick={() => openApiUrl('/api/v1/admin/logs/export')} />
          {activeSession ? <ActionButton label={busy ? '退出中...' : '退出当前会话'} onClick={() => void handleLogout()} /> : null}
        </div>
      </Section>

      <Section title="最近由当前管理员触发的写入">
        <div className="grid gap-3">
          <StatusLine label="配置改动次数" value={String(configHistory?.total ?? 0)} />
          <StatusLine label="最近配置改动" value={formatDateTime(configHistory?.latest_created_at)} />
        </div>
        <div className="mt-4 space-y-3">
          {statusHistory.map((item) => (
            <div key={`${item.user_id}-${item.created_at}`} className="rounded-xl border border-border bg-white px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">
                用户 {item.user_id} {'->'} {formatStatusLabel(item.status)}
              </p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.created_at)}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="会话历史" description="记录最近一次登录、退出和环境切换。">
        <div className="space-y-3">
          {sessionHistory.length ? (
            sessionHistory.map((item: AdminSessionHistoryItem) => (
              <div key={`${item.action}-${item.created_at}-${item.actor}`} className="rounded-xl border border-border bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">
                  {item.actor} · {item.action}
                </p>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.created_at)}</p>
                {item.detail ? <p className="mt-2 text-sm text-slate-600">{item.detail}</p> : null}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-border bg-white px-4 py-3 text-sm text-slate-500">当前还没有管理员会话历史。</div>
          )}
        </div>
      </Section>
    </div>
  );
}

function PanelBody({
  panel,
  onNavigate,
  onDataChanged,
}: {
  panel: PanelType;
  onNavigate: (view: ViewType) => void;
  onDataChanged?: () => void;
}) {
  switch (panel) {
    case 'flow-builder':
      return <FlowBuilderPanel onNavigate={onNavigate} onDataChanged={onDataChanged} />;
    case 'integration-guide':
      return <IntegrationGuidePanel onNavigate={onNavigate} />;
    case 'support':
      return <SupportPanel onNavigate={onNavigate} />;
    case 'notifications':
      return <NotificationsPanel onNavigate={onNavigate} onDataChanged={onDataChanged} />;
    case 'history':
      return <HistoryPanel />;
    case 'profile':
      return <ProfileSessionPanel onNavigate={onNavigate} onDataChanged={onDataChanged} />;
    default:
      return null;
  }
}

export function AdminPanelDrawer({
  panel,
  onClose,
  onNavigate,
  onDataChanged,
}: {
  panel: PanelType;
  onClose: () => void;
  onNavigate: (view: ViewType) => void;
  onDataChanged?: () => void;
}) {
  const config = panelConfig[panel];
  const Icon = config.icon;

  return (
    <>
      <button
        type="button"
        aria-label="关闭面板"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-950/25 backdrop-blur-[1px]"
      />
      <aside
        className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[480px] flex-col border-l border-border bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={config.title}
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div className="space-y-3 pr-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-accent">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{config.title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{config.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <PanelBody panel={panel} onNavigate={onNavigate} onDataChanged={onDataChanged} />
        </div>
      </aside>
    </>
  );
}
