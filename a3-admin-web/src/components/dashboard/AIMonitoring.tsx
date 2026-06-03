import { useEffect, useMemo, useState } from 'react';
import { Activity, Boxes, ExternalLink, RefreshCcw, Search, Sparkles } from 'lucide-react';
import {
  AgentRuntimeLog,
  AgentRuntimeSummary,
  AgentStatusItem,
  describeError,
  getAgentLogs,
  getAgentRuntimeSummary,
  getAgentStatus,
  getMCPOverview,
  MCPOverview,
} from '@/src/lib/adminApi';
import { formatDateTime, formatStatusLabel } from '@/src/lib/formatters';
import { ErrorPanel, LoadingPanel } from '@/src/components/shared/AsyncState';
import { ViewType } from '@/src/types';

const levelOptions = ['all', 'error', 'warning', 'info', 'debug'] as const;
const healthyStatuses = new Set(['ok', 'active']);
const warningStatuses = new Set(['degraded', 'warning', 'blocked']);
const dangerStatuses = new Set(['error', 'unavailable']);

function formatLevelLabel(level: string) {
  switch (level.toLowerCase()) {
    case 'error':
      return '异常';
    case 'warning':
      return '告警';
    case 'info':
      return '信息';
    case 'debug':
      return '调试';
    case 'all':
      return '全部';
    default:
      return level;
  }
}

function openAppUrl(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer');
}

function buildLogsUrl(agentName?: string, level?: string) {
  const params = new URLSearchParams();
  if (agentName) {
    params.set('agent_name', agentName);
  }
  if (level && level !== 'all') {
    params.set('level', level);
  }
  const query = params.toString();
  return `/api/v1/admin/agents/logs${query ? `?${query}` : ''}`;
}

function buildSummaryUrl(level?: string) {
  const params = new URLSearchParams();
  if (level && level !== 'all') {
    params.set('level', level);
  }
  const query = params.toString();
  return `/api/v1/admin/agents/logs/summary${query ? `?${query}` : ''}`;
}

function buildExportUrl(agentName?: string, level?: string) {
  const params = new URLSearchParams();
  if (agentName) {
    params.set('agent_name', agentName);
  }
  if (level && level !== 'all') {
    params.set('level', level);
  }
  const query = params.toString();
  return `/api/v1/admin/agents/logs/export${query ? `?${query}` : ''}`;
}

function getStatusTone(status: string) {
  const normalized = status.toLowerCase();
  if (dangerStatuses.has(normalized)) {
    return 'danger';
  }
  if (warningStatuses.has(normalized)) {
    return 'warning';
  }
  if (healthyStatuses.has(normalized)) {
    return 'healthy';
  }
  if (normalized === 'unreported') {
    return 'muted';
  }
  return 'neutral';
}

function getStatusBadgeClass(status: string) {
  switch (getStatusTone(status)) {
    case 'danger':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'healthy':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'muted':
      return 'border-slate-200 bg-slate-100 text-slate-500';
    default:
      return 'border-slate-200 bg-white text-slate-600';
  }
}

function getCategoryLabel(category?: string | null) {
  if (!category || category === 'general' || category === 'runtime' || category === 'core') {
    return '核心智能体';
  }
  return category;
}

function buildDegradedHint(log?: AgentRuntimeLog | null) {
  if (!log || log.status.toLowerCase() !== 'degraded' || !log.payload) {
    return '';
  }

  const fallbackCount = typeof log.payload.fallback_count === 'number' ? log.payload.fallback_count : 0;
  const fallbackPoints = Array.isArray(log.payload.fallback_knowledge_points)
    ? log.payload.fallback_knowledge_points.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
  const timeoutSeconds = typeof log.payload.timeout_seconds === 'number' ? log.payload.timeout_seconds : null;
  const parts: string[] = [];

  if (fallbackCount > 0) {
    parts.push(`本次有 ${fallbackCount} 个知识点走了兜底题模板`);
  }
  if (fallbackPoints.length) {
    parts.push(`涉及 ${fallbackPoints.join('、')}`);
  }
  if (timeoutSeconds) {
    parts.push(`单点超时阈值 ${timeoutSeconds}s`);
  }

  return parts.join('，');
}

function formatPayloadValue(value: unknown) {
  if (value === null || value === undefined) {
    return '暂无';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (!value.length) {
      return '[]';
    }
    return value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('、');
  }
  return JSON.stringify(value);
}

function getPayloadHighlights(log: AgentRuntimeLog) {
  if (!log.payload) {
    return [];
  }

  const highlightKeys = [
    'fallback_count',
    'fallback_knowledge_points',
    'timeout_seconds',
    'generated_count',
    'question_count',
    'knowledge_points',
    'difficulty_level',
    'question_type',
    'error',
  ] as const;

  return highlightKeys
    .filter((key) => key in log.payload!)
    .map((key) => ({
      key,
      label:
        key === 'fallback_count'
          ? '兜底知识点数'
          : key === 'fallback_knowledge_points'
            ? '兜底知识点'
            : key === 'timeout_seconds'
              ? '超时阈值'
              : key === 'generated_count'
                ? '生成题数'
                : key === 'question_count'
                  ? '请求题数'
                  : key === 'knowledge_points'
                    ? '知识点'
                    : key === 'difficulty_level'
                      ? '难度级别'
                      : key === 'question_type'
                        ? '题型'
                        : '错误原因',
      value: formatPayloadValue(log.payload[key]),
    }));
}

export function AIMonitoring({ onNavigate }: { onNavigate: (view: ViewType) => void }) {
  const [statusItems, setStatusItems] = useState<AgentStatusItem[]>([]);
  const [logs, setLogs] = useState<AgentRuntimeLog[]>([]);
  const [summary, setSummary] = useState<AgentRuntimeSummary | null>(null);
  const [mcpOverview, setMcpOverview] = useState<MCPOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [levelFilter, setLevelFilter] = useState<(typeof levelOptions)[number]>('all');
  const [keyword, setKeyword] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statusPayload, logPayload, summaryPayload, mcpPayload] = await Promise.all([
        getAgentStatus(),
        getAgentLogs(selectedAgent || undefined, levelFilter === 'all' ? undefined : levelFilter),
        getAgentRuntimeSummary(undefined, levelFilter === 'all' ? undefined : levelFilter),
        getMCPOverview(),
      ]);
      setStatusItems(statusPayload);
      setLogs(logPayload);
      setSummary(summaryPayload);
      setMcpOverview(mcpPayload);
      setError('');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [selectedAgent, levelFilter]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadData();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, selectedAgent, levelFilter]);

  const normalizedKeyword = keyword.trim().toLowerCase();

  const filteredStatusItems = useMemo(() => {
    if (!normalizedKeyword) {
      return statusItems;
    }
    return statusItems.filter((item) =>
      [
        item.agent_name,
        item.display_name ?? '',
        item.latest_status,
        item.latest_message ?? '',
        item.category ?? '',
        item.source_path ?? '',
      ].some((value) => value.toLowerCase().includes(normalizedKeyword)),
    );
  }, [normalizedKeyword, statusItems]);

  const groupedItems = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        items: AgentStatusItem[];
        healthy: number;
        warning: number;
        danger: number;
        unreported: number;
      }
    >();

    filteredStatusItems.forEach((item) => {
      const key = getCategoryLabel(item.category);
      const existing = groups.get(key) ?? {
        key,
        items: [],
        healthy: 0,
        warning: 0,
        danger: 0,
        unreported: 0,
      };
      existing.items.push(item);
      const tone = getStatusTone(item.latest_status);
      if (tone === 'healthy') {
        existing.healthy += 1;
      } else if (tone === 'warning') {
        existing.warning += 1;
      } else if (tone === 'danger') {
        existing.danger += 1;
      } else if (item.latest_status.toLowerCase() === 'unreported') {
        existing.unreported += 1;
      }
      groups.set(key, existing);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        items: [...group.items].sort((a, b) => (a.display_name ?? a.agent_name).localeCompare(b.display_name ?? b.agent_name)),
      }))
      .sort((a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key));
  }, [filteredStatusItems]);

  const selectedItem = useMemo(() => statusItems.find((item) => item.agent_name === selectedAgent) ?? null, [selectedAgent, statusItems]);
  const selectedLatestLog = useMemo(
    () => (selectedItem ? logs.find((item) => item.agent_name === selectedItem.agent_name) ?? null : null),
    [logs, selectedItem],
  );
  const degradedHint = useMemo(() => buildDegradedHint(selectedLatestLog), [selectedLatestLog]);

  const filteredLogs = useMemo(() => {
    if (!normalizedKeyword) {
      return logs;
    }
    return logs.filter((item) =>
      [item.agent_name, item.level, item.status, item.message].some((value) => value.toLowerCase().includes(normalizedKeyword)),
    );
  }, [normalizedKeyword, logs]);

  const overview = useMemo(() => {
    const healthy = filteredStatusItems.filter((item) => getStatusTone(item.latest_status) === 'healthy').length;
    const warning = filteredStatusItems.filter((item) => getStatusTone(item.latest_status) === 'warning').length;
    const danger = filteredStatusItems.filter((item) => getStatusTone(item.latest_status) === 'danger').length;
    const unreported = filteredStatusItems.filter((item) => item.latest_status.toLowerCase() === 'unreported').length;
    const reported = filteredStatusItems.filter((item) => item.status_source === 'runtime').length;
    return {
      healthy,
      warning,
      danger,
      unreported,
      reported,
      total: filteredStatusItems.length,
    };
  }, [filteredStatusItems]);

  const visibleErrorLogs = filteredLogs.filter((item) => item.level.toLowerCase() === 'error').length;

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">五个核心智能体监控</h1>
          <p className="mt-1 text-sm text-slate-500">当前页面按 5 个核心智能体固定排布，点击单个智能体只更新下方详情和日志，不再打乱整个页面。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setAutoRefresh((current) => !current)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              autoRefresh ? 'bg-emerald-100 text-emerald-700' : 'border border-border bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {autoRefresh ? '自动刷新中' : '开启自动刷新'}
          </button>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" />
            刷新
          </button>
        </div>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(248,250,252,0.98),_rgba(241,245,249,0.92))] p-6 shadow-sm">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold tracking-wide text-sky-700">
              <Sparkles className="h-3.5 w-3.5" />
              分组总览
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-slate-900">先看整体，再按组逐个查看</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              页面只保留一套核心智能体看板。每个组的位置固定，不会因为点击某个智能体而重排；组内可以逐个点选，下面再看详情和日志。
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <OverviewStat label="核心智能体总数" value={String(overview.total)} tone="neutral" />
              <OverviewStat label="已上报状态" value={String(overview.reported)} tone="healthy" />
              <OverviewStat label="正常" value={String(overview.healthy)} tone="healthy" />
              <OverviewStat label="告警/异常" value={String(overview.warning + overview.danger)} tone="danger" />
              <OverviewStat label="未上报" value={String(overview.unreported)} tone="muted" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Boxes className="h-4 w-4 text-sky-600" />
              当前选中
            </div>
            {selectedItem ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{selectedItem.display_name ?? selectedItem.agent_name}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedItem.agent_name} | {getCategoryLabel(selectedItem.category)}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusBadgeClass(selectedItem.latest_status)}`}>
                    {formatStatusLabel(selectedItem.latest_status)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{selectedItem.latest_message ?? '暂无状态消息。'}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MiniInfo label="错误数" value={String(selectedItem.error_count)} />
                  <MiniInfo label="更新时间" value={formatDateTime(selectedItem.updated_at)} />
                  <MiniInfo label="状态来源" value={selectedItem.status_source === 'runtime' ? '运行时上报' : '仅代码注册'} />
                  <MiniInfo label="代码位置" value={selectedItem.source_path ?? '暂无'} />
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                先在下面的看板里点一个核心智能体，这里就会显示它的详情。
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr_auto]">
          <label className="grid gap-2 text-sm">
            <span className="text-slate-500">关键字搜索</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索智能体、分组、状态或消息"
                className="h-11 w-full rounded-xl border border-border bg-white pl-10 pr-4 text-sm text-slate-900"
              />
            </div>
          </label>
          <div className="grid gap-2 text-sm">
            <span className="text-slate-500">日志级别</span>
            <div className="flex flex-wrap gap-2">
              {levelOptions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLevelFilter(item)}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                    levelFilter === item ? 'bg-slate-900 text-white' : 'border border-border bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {formatLevelLabel(item)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 text-sm">
            <span className="text-slate-500">快捷动作</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedAgent('');
                  setKeyword('');
                  setLevelFilter('all');
                }}
                className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                清空筛选
              </button>
              <button
                type="button"
                onClick={() => openAppUrl(buildExportUrl(selectedAgent || undefined, levelFilter))}
                className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                导出结果表格
              </button>
            </div>
          </div>
        </div>
      </section>

      {summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="当前日志数" value={String(summary.total)} hint="导出当前筛选结果表格" onClick={() => openAppUrl(buildExportUrl(selectedAgent || undefined, levelFilter))} />
          <Metric label="错误日志" value={String(summary.error_count)} hint="打开当前筛选日志接口" onClick={() => openAppUrl(buildLogsUrl(selectedAgent || undefined, levelFilter))} />
          <Metric label="降级智能体" value={String(summary.degraded_agent_count)} hint="优先排查成功但已降级的核心链路" onClick={() => onNavigate('operations')} />
          <Metric label="最近时间" value={formatDateTime(summary.latest_log_at)} hint="打开日志摘要接口" onClick={() => openAppUrl(buildSummaryUrl(levelFilter))} />
        </div>
      ) : null}

      {mcpOverview ? (
        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">MCP 接入监控</h2>
              <p className="mt-1 text-xs text-slate-400">这里专门看 MCP server、工具调用、会话状态和延迟，方便把 AI 工具接入也纳入统一运维视角。</p>
            </div>
            <span className="text-xs font-medium text-slate-400">最近更新 {formatDateTime(mcpOverview.latest_updated_at)}</span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewStat label="MCP Server 总数" value={String(mcpOverview.total_servers)} tone="neutral" />
            <OverviewStat label="健康 Server" value={String(mcpOverview.healthy_servers)} tone="healthy" />
            <OverviewStat label="告警 / 异常 Server" value={String(mcpOverview.warning_servers + mcpOverview.error_servers)} tone="danger" />
            <OverviewStat label="平均延迟" value={`${mcpOverview.avg_latency_ms} ms`} tone="muted" />
          </div>
          <div className="mt-5 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-3">
              {mcpOverview.servers.map((server) => (
                <div key={server.server_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{server.display_name}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {server.server_id} | {server.transport.toUpperCase()} | {server.endpoint ?? '暂无 endpoint'}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusBadgeClass(server.status)}`}>
                      {formatStatusLabel(server.status)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <MiniInfo label="连接客户端" value={String(server.connected_clients)} />
                    <MiniInfo label="错误率" value={`${server.error_rate}%`} />
                    <MiniInfo label="平均延迟" value={`${server.avg_latency_ms} ms`} />
                  </div>
                  {server.latest_error ? (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-700">{server.latest_error}</p>
                  ) : null}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {server.tools.map((tool) => (
                      <div key={`${server.server_id}-${tool.tool_name}`} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                        <p className="text-xs font-semibold text-slate-900">{tool.display_name}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{tool.tool_name}</p>
                        <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                          <p>调用 {tool.call_count}</p>
                          <p>异常 {tool.error_count}</p>
                          <p>平均 {tool.avg_latency_ms} ms</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">MCP 会话与工具调用</h3>
              <p className="mt-1 text-xs text-slate-500">看当前哪些页面或模块正在通过 MCP 调工具，以及有没有重试、失败或超时。</p>
              <div className="mt-4 space-y-3">
                {mcpOverview.sessions.map((session) => (
                  <div key={session.session_id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{session.client_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {session.server_id} | {session.tool_name ?? '未指定工具'}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusBadgeClass(session.status)}`}>
                        {formatStatusLabel(session.status)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <MiniInfo label="会话时长" value={`${session.duration_ms} ms`} />
                      <MiniInfo label="最近更新时间" value={formatDateTime(session.updated_at)} />
                    </div>
                  </div>
                ))}
                {!mcpOverview.sessions.length ? <EmptyState label="当前没有活跃的 MCP 会话。" /> : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {loading ? <LoadingPanel title="加载 AI 监控数据" /> : null}
      {!loading && error ? <ErrorPanel title="AI 监控接口返回失败" detail={error} /> : null}

      <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-sky-600" />
            <h2 className="text-lg font-semibold text-slate-900">核心智能体看板</h2>
          </div>
          <span className="text-xs font-medium text-slate-400">{groupedItems.length} 个分组</span>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {groupedItems.map((group) => (
            <section key={group.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{group.key}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {group.items.length} 个核心智能体 | 正常 {group.healthy} | 告警 {group.warning} | 异常 {group.danger} | 未上报 {group.unreported}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <TinyPill label={`正常 ${group.healthy}`} tone="healthy" />
                  <TinyPill label={`异常 ${group.danger + group.warning}`} tone="danger" />
                  <TinyPill label={`未上报 ${group.unreported}`} tone="muted" />
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {group.items.map((item) => {
                  const active = selectedAgent === item.agent_name;
                  return (
                    <button
                      key={item.agent_name}
                      type="button"
                      onClick={() => setSelectedAgent(item.agent_name)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        active ? 'border-sky-300 bg-sky-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">{item.display_name ?? item.agent_name}</h4>
                          <p className="mt-1 text-xs text-slate-400">{item.agent_name}</p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusBadgeClass(item.latest_status)}`}>
                          {formatStatusLabel(item.latest_status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.latest_message ?? '暂无状态消息。'}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        {!groupedItems.length ? <EmptyState label="没有匹配的核心智能体分组。" /> : null}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-sky-600" />
              <h2 className="text-lg font-semibold text-slate-900">选中核心智能体详情</h2>
            </div>
            {selectedItem ? <span className="text-xs font-medium text-slate-400">{selectedItem.agent_name}</span> : null}
          </div>
          {selectedItem ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{selectedItem.display_name ?? selectedItem.agent_name}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {getCategoryLabel(selectedItem.category)} | 错误数 {selectedItem.error_count}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusBadgeClass(selectedItem.latest_status)}`}>
                    {formatStatusLabel(selectedItem.latest_status)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{selectedItem.latest_message ?? '暂无状态消息。'}</p>
              </div>
              {selectedItem.latest_status.toLowerCase() === 'degraded' ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-800">本次运行已降级</p>
                  <p className="mt-2 text-sm leading-6 text-amber-700">
                    {degradedHint || '当前链路已成功返回，但最近一次运行使用了兜底或降级策略。'}
                  </p>
                </div>
              ) : null}
              <div className="grid gap-3">
                <MiniInfo label="更新时间" value={formatDateTime(selectedItem.updated_at)} />
                <MiniInfo label="状态来源" value={selectedItem.status_source === 'runtime' ? '运行时已上报' : '仅代码注册'} />
                <MiniInfo label="代码位置" value={selectedItem.source_path ?? '暂无'} />
              </div>
            </div>
          ) : (
            <EmptyState label="还没有选中核心智能体。先从上面的看板点一个。" />
          )}
        </section>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">运行日志</h2>
              <p className="mt-1 text-xs text-slate-400">当前异常日志 {visibleErrorLogs} 条</p>
            </div>
            <button
              type="button"
              onClick={() => openAppUrl(buildExportUrl(selectedAgent || undefined, levelFilter))}
              className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
            >
              导出表格
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {filteredLogs.map((item) => (
              <button
                key={item.log_id}
                type="button"
                onClick={() => openAppUrl(buildLogsUrl(selectedAgent || undefined, levelFilter))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-xs text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-slate-900">[{item.agent_name}] {formatLevelLabel(item.level)}</span>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span>{formatDateTime(item.created_at)}</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="mt-2 leading-6 text-slate-600">{item.message}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-slate-400">
                  <span>状态 {formatStatusLabel(item.status)}</span>
                  {item.payload ? <span>附带运行参数</span> : null}
                </div>
                {item.payload ? (
                  <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white/80 p-3">
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {getPayloadHighlights(item).map((entry) => (
                        <div key={`${item.log_id}-${entry.key}`} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                          <p className="text-[11px] font-medium text-slate-400">{entry.label}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-700">{entry.value}</p>
                        </div>
                      ))}
                    </div>
                    <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] leading-6 text-slate-600">
                      {JSON.stringify(item.payload, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </button>
            ))}
            {!filteredLogs.length ? <EmptyState label="没有匹配的日志结果。" /> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function OverviewStat({ label, value, tone }: { label: string; value: string; tone: 'healthy' | 'danger' | 'muted' | 'neutral' }) {
  const className =
    tone === 'healthy'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'danger'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : tone === 'muted'
          ? 'border-slate-200 bg-slate-100 text-slate-500'
          : 'border-sky-200 bg-sky-50 text-sky-700';

  return (
    <div className={`rounded-2xl border px-4 py-4 ${className}`}>
      <p className="text-xs font-semibold tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function TinyPill({ label, tone }: { label: string; tone: 'healthy' | 'danger' | 'muted' }) {
  const className =
    tone === 'healthy'
      ? 'bg-emerald-100 text-emerald-700'
      : tone === 'danger'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-slate-100 text-slate-500';
  return <span className={`rounded-full px-2 py-1 ${className}`}>{label}</span>;
}

function Metric({ label, value, hint, onClick }: { label: string; value: string; hint: string; onClick: () => void }) {
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

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{label}</div>;
}
