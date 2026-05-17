import { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  History,
  KeyRound,
  RefreshCcw,
  Rocket,
  Save,
  ServerCrash,
  ShieldAlert,
  TimerReset,
} from 'lucide-react';
import {
  AIOpsOverview,
  DeploymentRecord,
  describeError,
  getAIOpsOverview,
  getConfigHistorySummary,
  getConfigSummary,
  getDeployments,
  getHealth,
  getLlmPing,
  rollbackDeployment,
  getSystemConfigHistory,
  getSystemConfigs,
  HealthPayload,
  SystemConfigHistoryItem,
  SystemConfigHistorySummary,
  SystemConfigItem,
  SystemConfigSummary,
  triggerDeployment,
  updateSystemConfig,
} from '@/src/lib/adminApi';
import { formatDateTime } from '@/src/lib/formatters';
import { ErrorPanel, LoadingPanel, ReachableBadge } from '@/src/components/shared/AsyncState';
import { ViewType } from '@/src/types';

function openAppUrl(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer');
}

function getConfigMeta(configKey: string) {
  switch (configKey) {
    case 'planner_daily_task_limit':
      return {
        title: '每日任务拆分上限',
        summary: '控制学习规划器一天最多拆出多少个任务。',
        impact: '改大后任务会更细、更多；改小后任务会更少、更粗。',
        example: '现在是 5，表示一天最多拆成 5 个学习任务。',
      };
    case 'rag_top_k':
      return {
        title: '知识检索候选数',
        summary: '控制 RAG 检索时最多给模型多少个知识片段。',
        impact: '改大后召回更多但噪声也更高；改小后更聚焦，但可能漏信息。',
        example: '现在是 8，表示每次检索最多取 8 个候选知识片段。',
      };
    default:
      return {
        title: configKey,
        summary: '这是一个系统运行参数。',
        impact: '修改后会影响对应模块的运行行为。',
        example: '如果不确定，建议先查看历史记录再修改。',
      };
  }
}

function getChainTone(status: string) {
  if (status === 'warning' || status === 'degraded') {
    return 'border-amber-200 bg-amber-50';
  }
  if (status === 'error') {
    return 'border-rose-200 bg-rose-50';
  }
  return 'border-emerald-200 bg-emerald-50';
}

function getDeploymentTone(status: string) {
  if (status === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (status === 'failed') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export function SystemManagement({ onNavigate }: { onNavigate: (view: ViewType) => void }) {
  const [configSummary, setConfigSummary] = useState<SystemConfigSummary | null>(null);
  const [historySummary, setHistorySummary] = useState<SystemConfigHistorySummary | null>(null);
  const [configs, setConfigs] = useState<SystemConfigItem[]>([]);
  const [historyItems, setHistoryItems] = useState<SystemConfigHistoryItem[]>([]);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [llm, setLlm] = useState<HealthPayload | null>(null);
  const [aiOps, setAiOps] = useState<AIOpsOverview | null>(null);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [sensitiveOnly, setSensitiveOnly] = useState(false);
  const [selectedKey, setSelectedKey] = useState('');
  const [draftValue, setDraftValue] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deployTarget, setDeployTarget] = useState('ai-runtime');
  const [deployVersion, setDeployVersion] = useState('v2026.05.17-1');
  const [deployNote, setDeployNote] = useState('发布新的检索与规划参数');
  const [deploying, setDeploying] = useState(false);
  const [rollingBackId, setRollingBackId] = useState('');

  const loadData = async (nextSensitiveOnly = sensitiveOnly) => {
    setLoading(true);
    setError('');
    try {
      const [
        configSummaryValue,
        historySummaryValue,
        configsValue,
        historyValue,
        healthValue,
        llmValue,
        aiOpsValue,
        deploymentValues,
      ] = await Promise.all([
        getConfigSummary(),
        getConfigHistorySummary(),
        getSystemConfigs(nextSensitiveOnly),
        getSystemConfigHistory(),
        getHealth(),
        getLlmPing().catch(() => null),
        getAIOpsOverview(),
        getDeployments(),
      ]);

      setConfigSummary(configSummaryValue);
      setHistorySummary(historySummaryValue);
      setConfigs(configsValue);
      setHistoryItems(historyValue);
      setHealth(healthValue);
      setLlm(llmValue);
      setAiOps(aiOpsValue);
      setDeployments(deploymentValues);

      setSelectedKey((current) => {
        if (current && configsValue.some((item) => item.config_key === current)) {
          return current;
        }
        return configsValue[0]?.config_key ?? '';
      });
    } catch (err) {
      setError(describeError(err));
      setConfigSummary(null);
      setHistorySummary(null);
      setConfigs([]);
      setHistoryItems([]);
      setAiOps(null);
      setDeployments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectedConfig = useMemo(() => configs.find((item) => item.config_key === selectedKey) ?? null, [configs, selectedKey]);
  const selectedMeta = useMemo(() => getConfigMeta(selectedConfig?.config_key ?? ''), [selectedConfig]);

  useEffect(() => {
    if (!selectedConfig) {
      setDraftValue('');
      setDraftDescription('');
      return;
    }
    setDraftValue(selectedConfig.is_sensitive ? '' : selectedConfig.config_value);
    setDraftDescription(selectedConfig.description ?? '');
  }, [selectedConfig]);

  const filteredHistory = useMemo(() => {
    if (!selectedKey) {
      return historyItems;
    }
    return historyItems.filter((item) => item.config_key === selectedKey);
  }, [historyItems, selectedKey]);

  const prefixEntries = useMemo(
    () => Object.entries(configSummary?.by_prefix ?? {}).sort((a, b) => Number(b[1]) - Number(a[1])),
    [configSummary],
  );

  const handleToggleSensitive = async () => {
    const nextValue = !sensitiveOnly;
    setSensitiveOnly(nextValue);
    await loadData(nextValue);
  };

  const handleSave = async () => {
    if (!selectedConfig) {
      return;
    }
    if (!draftValue.trim()) {
      setActionError('请输入新的配置值后再保存。');
      setActionSuccess('');
      return;
    }

    setSaving(true);
    setActionError('');
    setActionSuccess('');
    try {
      const updated = await updateSystemConfig(selectedConfig.config_key, draftValue, draftDescription || null);
      setActionSuccess(`已更新“${getConfigMeta(updated.config_key).title}”，页面数据也已经同步刷新。`);
      await loadData(sensitiveOnly);
      setSelectedKey(updated.config_key);
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeploy = async () => {
    if (!deployTarget.trim() || !deployVersion.trim()) {
      setActionError('请先填写部署目标和版本号。');
      setActionSuccess('');
      return;
    }
    const confirmed = window.confirm(`确认要部署到 ${deployTarget}，版本 ${deployVersion} 吗？`);
    if (!confirmed) {
      return;
    }
    setDeploying(true);
    setActionError('');
    setActionSuccess('');
    try {
      const result = await triggerDeployment(deployTarget, deployVersion, deployNote);
      setActionSuccess(`已发起部署：${result.target} -> ${result.version}，当前状态 ${result.status}。`);
      await loadData(sensitiveOnly);
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setDeploying(false);
    }
  };

  const handleRollback = async (deployment: DeploymentRecord) => {
    const confirmed = window.confirm(`确认回滚 ${deployment.target} 的版本 ${deployment.version} 吗？`);
    if (!confirmed) {
      return;
    }
    setRollingBackId(deployment.deployment_id);
    setActionError('');
    setActionSuccess('');
    try {
      const result = await rollbackDeployment(deployment.deployment_id, `从 ${deployment.version} 回滚`);
      setActionSuccess(`已完成回滚：${deployment.version} -> ${result.version}。`);
      await loadData(sensitiveOnly);
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setRollingBackId('');
    }
  };

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">系统管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            这里不只管配置，还开始承担 AI 运维：看异常智能体、看慢链路、看参数效果，以及发起部署。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleToggleSensitive()}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              sensitiveOnly ? 'bg-amber-100 text-amber-700' : 'border border-border bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {sensitiveOnly ? '当前只看敏感配置' : '只看敏感配置'}
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

      <div className="flex flex-wrap gap-3">
        {health ? <ReachableBadge label="AI 后端" status={health.status} /> : null}
        {llm ? <ReachableBadge label="LLM" status={llm.status} /> : null}
      </div>

      {loading ? <LoadingPanel title="加载系统管理数据" /> : null}
      {!loading && error ? <ErrorPanel title="系统管理数据加载失败" detail={error} /> : null}

      {!loading && !error ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <MetricCard label="配置总数" value={String(configSummary?.total ?? 0)} hint="当前系统里有多少个可管理配置" />
            <MetricCard label="敏感配置" value={String(configSummary?.sensitive_count ?? 0)} hint="这类配置改动前建议先确认环境和权限" tone="warning" />
            <MetricCard label="异常智能体" value={String(aiOps?.abnormal_agents.length ?? 0)} hint="当前处于告警、降级或异常状态的智能体数量" />
            <MetricCard label="慢链路" value={String(aiOps?.slow_chains.length ?? 0)} hint="当前需要重点盯的模型链路数量" />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <TimerReset className="h-5 w-5 text-sky-600" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">AI 运维总览</h2>
                  <p className="mt-1 text-xs text-slate-500">先判断哪里有问题：是智能体异常，还是某条链路明显变慢。</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {(aiOps?.abnormal_agents ?? []).map((agent) => (
                  <div key={agent.agent_name} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                    <p className="text-sm font-semibold text-rose-900">{agent.display_name ?? agent.agent_name}</p>
                    <p className="mt-1 text-xs text-rose-700">{agent.latest_message ?? '暂无异常说明'}</p>
                  </div>
                ))}
                {!(aiOps?.abnormal_agents.length ?? 0) ? <EmptyState label="当前没有异常智能体。" /> : null}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">慢链路与耗时</h2>
                  <p className="mt-1 text-xs text-slate-500">这里回答两个问题：哪条链路慢，慢在哪一组智能体。</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('monitoring')}
                  className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                >
                  去 AI 监控
                </button>
              </div>
              <div className="mt-5 grid gap-3">
                {(aiOps?.slow_chains ?? []).map((chain) => (
                  <div key={chain.chain_id} className={`rounded-xl border px-4 py-4 ${getChainTone(chain.status)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{chain.label}</p>
                        <p className="mt-1 text-xs text-slate-600">涉及智能体：{chain.related_agents.join(' / ')}</p>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">{chain.status}</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <MiniMetric label="平均耗时" value={`${chain.avg_latency_ms} ms`} />
                      <MiniMetric label="P95 耗时" value={`${chain.p95_latency_ms} ms`} />
                      <MiniMetric label="错误率" value={`${chain.error_rate}%`} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <KeyRound className="h-5 w-5 text-accent" />
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">配置列表</h2>
                    <p className="mt-1 text-xs text-slate-500">左边先看中文解释，右边再编辑。参数改动会影响检索、规划等 AI 链路。</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openAppUrl('/api/v1/admin/configs')}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                >
                  打开接口
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 grid gap-3">
                {configs.map((item) => {
                  const active = item.config_key === selectedKey;
                  const meta = getConfigMeta(item.config_key);
                  return (
                    <button
                      key={item.config_key}
                      type="button"
                      onClick={() => setSelectedKey(item.config_key)}
                      className={`rounded-xl border px-4 py-3 text-left transition ${
                        active ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{meta.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{meta.summary}</p>
                        </div>
                        {item.is_sensitive ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            敏感
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 grid gap-1 text-xs text-slate-400">
                        <span>配置键：{item.config_key}</span>
                        <span>当前值：{item.config_value}</span>
                      </div>
                    </button>
                  );
                })}
                {!configs.length ? <EmptyState label="当前筛选下没有配置项。" /> : null}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <ServerCrash className="h-5 w-5 text-slate-700" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">配置编辑</h2>
                  <p className="mt-1 text-xs text-slate-500">不只改值，还告诉你“改大/改小会影响什么”，避免盲改。</p>
                </div>
              </div>

              {selectedConfig ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-base font-semibold text-slate-900">{selectedMeta.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{selectedMeta.summary}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">影响：{selectedMeta.impact}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">示例：{selectedMeta.example}</p>
                  </div>

                  <InfoRow label="配置键" value={selectedConfig.config_key} />
                  <InfoRow label="最近修改人" value={selectedConfig.updated_by ?? '暂无'} />
                  <InfoRow label="最近更新时间" value={formatDateTime(selectedConfig.updated_at)} />

                  <label className="grid gap-2 text-sm">
                    <span className="text-slate-500">新的配置值</span>
                    <textarea
                      value={draftValue}
                      onChange={(event) => setDraftValue(event.target.value)}
                      rows={selectedConfig.is_sensitive ? 4 : 3}
                      placeholder={selectedConfig.is_sensitive ? '敏感配置不会回显原值，请输入新的完整值。' : '直接输入新的数字或文本配置值'}
                      className="w-full rounded-xl border border-border bg-white px-3 py-3 text-sm text-slate-900"
                    />
                  </label>

                  <label className="grid gap-2 text-sm">
                    <span className="text-slate-500">备注说明</span>
                    <input
                      value={draftDescription}
                      onChange={(event) => setDraftDescription(event.target.value)}
                      placeholder="这次为什么要改，留给后面的人看"
                      className="h-11 rounded-xl border border-border bg-white px-3 text-sm text-slate-900"
                    />
                  </label>

                  {actionSuccess ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{actionSuccess}</div>
                  ) : null}
                  {actionError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{actionError}</div>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? '保存中...' : '保存配置'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openAppUrl(`/api/v1/admin/configs/history?config_key=${encodeURIComponent(selectedConfig.config_key)}`)}
                      className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      查看这个配置的历史
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <EmptyState label="先从左边选一个配置项，这里再看它的解释和编辑入口。" />
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <History className="h-5 w-5 text-slate-700" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">参数效果观察</h2>
                  <p className="mt-1 text-xs text-slate-500">这里专门回答“参数改完以后效果有没有变好”。</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {(aiOps?.experiments ?? []).map((item) => (
                  <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.baseline_label} {'->'} {item.current_label}
                    </p>
                    <div className="mt-3 grid gap-3">
                      <CompareBar
                        label={item.baseline_label}
                        value={item.baseline_value}
                        maxValue={Math.max(item.baseline_value, item.current_value)}
                        tone="muted"
                      />
                      <CompareBar
                        label={item.current_label}
                        value={item.current_value}
                        maxValue={Math.max(item.baseline_value, item.current_value)}
                        tone={item.change_percent >= 0 ? 'good' : 'bad'}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-600">{item.metric}</span>
                      <span className={`text-sm font-semibold ${item.change_percent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {item.change_percent >= 0 ? '+' : ''}
                        {item.change_percent}%
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{item.summary}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Rocket className="h-5 w-5 text-slate-700" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">部署功能</h2>
                  <p className="mt-1 text-xs text-slate-500">改完参数后，可以直接从 admin 端发起一次部署，并查看部署记录。</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <label className="grid gap-2 text-sm">
                  <span className="text-slate-500">部署目标</span>
                  <input
                    value={deployTarget}
                    onChange={(event) => setDeployTarget(event.target.value)}
                    className="h-11 rounded-xl border border-border bg-white px-3 text-sm text-slate-900"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="text-slate-500">版本号</span>
                  <input
                    value={deployVersion}
                    onChange={(event) => setDeployVersion(event.target.value)}
                    className="h-11 rounded-xl border border-border bg-white px-3 text-sm text-slate-900"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="text-slate-500">发布说明</span>
                  <textarea
                    value={deployNote}
                    onChange={(event) => setDeployNote(event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-border bg-white px-3 py-3 text-sm text-slate-900"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleDeploy()}
                  disabled={deploying}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  <Rocket className="h-4 w-4" />
                  {deploying ? '部署中...' : '发起部署'}
                </button>

                {aiOps?.latest_deployment ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">最近一次部署</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {aiOps.latest_deployment.target} {'->'} {aiOps.latest_deployment.version}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getDeploymentTone(aiOps.latest_deployment.status)}`}>
                        {aiOps.latest_deployment.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{aiOps.latest_deployment.summary ?? '暂无部署说明。'}</p>
                    <div className="mt-3 grid gap-2">
                      {aiOps.latest_deployment.health_checks.map((check) => (
                        <div key={check.name} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-slate-900">{check.name}</span>
                            <span className={`text-xs font-semibold ${check.status === 'ok' ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {check.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{check.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">历史摘要</h2>
                  <p className="mt-1 text-xs text-slate-500">用来快速判断最近都在改哪类配置，适合先做整体巡检。</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('operations')}
                  className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                >
                  去服务联调
                </button>
              </div>
              <div className="mt-5 space-y-3">
                <InfoRow label="历史记录总数" value={String(historySummary?.total ?? 0)} />
                <InfoRow label="最近变更时间" value={formatDateTime(historySummary?.latest_created_at)} />
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">按配置前缀看分布</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {prefixEntries.map(([key, value]) => (
                      <span key={key} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {key} {value}
                      </span>
                    ))}
                    {!prefixEntries.length ? <span className="text-sm text-slate-500">暂无摘要</span> : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">部署记录</h2>
                  <p className="mt-1 text-xs text-slate-500">这里保存每次发布的目标、版本和结果，便于回看“什么时候发了什么”。</p>
                </div>
                <button
                  type="button"
                  onClick={() => openAppUrl('/api/v1/admin/deployments')}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                >
                  打开接口
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-5 space-y-3">
                {deployments.slice(0, 6).map((item) => (
                  <div key={item.deployment_id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.target}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          版本 {item.version} · 操作人 {item.operator}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getDeploymentTone(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{item.summary ?? item.note ?? '暂无说明。'}</p>
                    {item.rolled_back_from ? (
                      <p className="mt-2 text-xs text-amber-600">回滚来源版本：{item.rolled_back_from}</p>
                    ) : null}
                    <div className="mt-3 grid gap-2">
                      {item.health_checks.slice(0, 2).map((check) => (
                        <div key={check.name} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-slate-800">{check.name}</span>
                            <span className={`text-[11px] font-semibold ${check.status === 'ok' ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {check.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRollback(item)}
                        disabled={rollingBackId === item.deployment_id}
                        className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        {rollingBackId === item.deployment_id ? '回滚中...' : '回滚到上一版'}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{formatDateTime(item.created_at)}</p>
                  </div>
                ))}
                {!deployments.length ? <EmptyState label="当前还没有部署记录。" /> : null}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">配置变更记录</h2>
                <p className="mt-1 text-xs text-slate-500">这里展示后端返回的真实历史。你可以把它理解成“这个参数之前都怎么改过”。</p>
              </div>
              <button
                type="button"
                onClick={() => openAppUrl(selectedKey ? `/api/v1/admin/configs/history?config_key=${encodeURIComponent(selectedKey)}` : '/api/v1/admin/configs/history')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
              >
                打开接口
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {filteredHistory.slice(0, 10).map((item, index) => (
                <div key={`${item.config_key}-${item.created_at ?? index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{getConfigMeta(item.config_key).title}</p>
                      <p className="mt-1 text-xs text-slate-500">配置键：{item.config_key}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.updated_by ?? '未知操作者'} · {item.action}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">{formatDateTime(item.created_at)}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{item.value ?? '这条记录没有直接值，可以往下看 payload。'}</p>
                  {item.payload ? (
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900/95 p-3 text-xs text-slate-100">
                      {JSON.stringify(item.payload, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}
              {!filteredHistory.length ? <EmptyState label="当前没有可展示的配置历史。" /> : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tone === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-border bg-white'}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-3 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white bg-white px-3 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function CompareBar({
  label,
  value,
  maxValue,
  tone,
}: {
  label: string;
  value: number;
  maxValue: number;
  tone: 'muted' | 'good' | 'bad';
}) {
  const width = maxValue > 0 ? `${Math.max(12, Math.round((value / maxValue) * 100))}%` : '12%';
  const barClass =
    tone === 'good' ? 'bg-emerald-500' : tone === 'bad' ? 'bg-rose-500' : 'bg-slate-400';

  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200">
        <div className={`h-2 rounded-full ${barClass}`} style={{ width }} />
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{label}</div>;
}
