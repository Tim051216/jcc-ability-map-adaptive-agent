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
  getSystemConfigHistory,
  getSystemConfigs,
  HealthPayload,
  rollbackDeployment,
  SystemConfigHistoryItem,
  SystemConfigHistorySummary,
  SystemConfigItem,
  SystemConfigSummary,
  triggerDeployment,
  updateSystemConfig,
} from '@/src/lib/adminApi';
import { ErrorPanel, LoadingPanel, ReachableBadge } from '@/src/components/shared/AsyncState';
import { formatDateTime } from '@/src/lib/formatters';
import { ViewType } from '@/src/types';

function openAppUrl(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer');
}

function getConfigMeta(configKey: string) {
  switch (configKey) {
    case 'planner_daily_task_limit':
      return {
        title: '每日任务拆分上限',
        summary: '控制学习规划智能体在一天内最多拆分出多少个学习任务。',
        impact: '数值越大，规划更细但链路更长；数值越小，任务更粗但响应更快。',
        example: '当前值为 5，表示一天内最多拆分出 5 个学习任务。',
      };
    case 'rag_top_k':
      return {
        title: '知识检索候选数',
        summary: '控制 RAG 检索时最多返回多少个候选知识片段。',
        impact: '数值越大，召回更充分但噪声更高；数值越小，更聚焦但可能漏信息。',
        example: '当前值为 8，表示每次检索最多返回 8 个候选片段。',
      };
    default:
      return {
        title: configKey,
        summary: '这是一个系统运行参数。',
        impact: '修改后会影响对应模块的运行行为。',
        example: '如果暂时不确定，建议先查看历史记录再修改。',
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

function getStatusLabel(status: string) {
  switch (status) {
    case 'success':
      return '成功';
    case 'failed':
      return '失败';
    case 'warning':
      return '告警';
    case 'degraded':
      return '已降级';
    case 'ok':
      return '正常';
    default:
      return status;
  }
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
  const [deployVersion, setDeployVersion] = useState('v2026.05.18-1');
  const [deployNote, setDeployNote] = useState('???????????');
  const [deploying, setDeploying] = useState(false);
  const [rollingBackId, setRollingBackId] = useState('');
  const [rollbackNote, setRollbackNote] = useState('??????????');

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
      setActionError('请先填写新的配置值。');
      setActionSuccess('');
      return;
    }

    setSaving(true);
    setActionError('');
    setActionSuccess('');
    try {
      const updated = await updateSystemConfig(selectedConfig.config_key, draftValue, draftDescription || null);
      setActionSuccess(`已更新“${getConfigMeta(updated.config_key).title}”，页面数据已同步刷新。`);
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
    const confirmed = window.confirm(`确认部署 ${deployTarget}，版本 ${deployVersion} 吗？`);
    if (!confirmed) {
      return;
    }

    setDeploying(true);
    setActionError('');
    setActionSuccess('');
    try {
      const result = await triggerDeployment(deployTarget, deployVersion, deployNote);
      setActionSuccess(`已发起部署：${result.target} -> ${result.version}，当前状态为 ${getStatusLabel(result.status)}。`);
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
      const result = await rollbackDeployment(deployment.deployment_id, rollbackNote || `从 ${deployment.version} 回滚`);
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
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">System Console</p>
          <h1 className="mt-2 text-3xl font-bold">系统管理</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            这一页负责把配置管理、AI 运维、部署与回滚放到同一个工作台里。先判断哪里有风险，再决定改参数、发版本还是回滚。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleToggleSensitive()}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              sensitiveOnly ? 'bg-amber-300 text-slate-900' : 'border border-white/20 bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            {sensitiveOnly ? '当前仅看敏感配置' : '只看敏感配置'}
          </button>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/15"
          >
            <RefreshCcw className="h-4 w-4" />
            刷新数据
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {health ? <ReachableBadge label="AI 后端" status={health.status} /> : null}
        {llm ? <ReachableBadge label="LLM 网关" status={llm.status} /> : null}
      </div>

      {loading ? <LoadingPanel title="正在加载系统管理数据" /> : null}
      {!loading && error ? <ErrorPanel title="系统管理数据加载失败" detail={error} /> : null}

      {!loading && !error ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <MetricCard label="配置总数" value={String(configSummary?.total ?? 0)} hint="当前系统内可管理的配置项数量" />
            <MetricCard label="敏感配置" value={String(configSummary?.sensitive_count ?? 0)} hint="涉及密钥、令牌或重要运行参数的配置" tone="warning" />
            <MetricCard label="异常核心智能体" value={String(aiOps?.abnormal_agents.length ?? 0)} hint="处于告警、降级或异常状态的核心智能体数量" />
            <MetricCard label="慢链路" value={String(aiOps?.slow_chains.length ?? 0)} hint="当前需要重点盯防的链路数量" />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <TimerReset className="h-5 w-5 text-sky-600" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">AI 运维总览</h2>
                  <p className="mt-1 text-xs text-slate-500">先判断是核心智能体异常，还是链路性能退化，再决定后续动作。</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {(aiOps?.abnormal_agents ?? []).map((agent) => (
                  <div key={agent.agent_name} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                    <p className="text-sm font-semibold text-rose-900">{agent.display_name ?? agent.agent_name}</p>
                    <p className="mt-1 text-xs text-rose-700">{agent.latest_message ?? '暂无异常说明。'}</p>
                  </div>
                ))}
                {!(aiOps?.abnormal_agents.length ?? 0) ? <EmptyState label="当前没有异常核心智能体。" /> : null}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">慢链路与耗时</h2>
                  <p className="mt-1 text-xs text-slate-500">这里回答两个问题：哪条链路慢，以及慢在哪个核心智能体组。</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('monitoring')}
                  className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                >
                  前往 AI 监控
                </button>
              </div>
              <div className="mt-5 grid gap-3">
                {(aiOps?.slow_chains ?? []).map((chain) => (
                  <div key={chain.chain_id} className={`rounded-xl border px-4 py-4 ${getChainTone(chain.status)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{chain.label}</p>
                        <p className="mt-1 text-xs text-slate-600">涉及核心智能体：{chain.related_agents.join(' / ')}</p>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">{getStatusLabel(chain.status)}</span>
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
                  <KeyRound className="h-5 w-5 text-sky-600" />
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">配置列表</h2>
                    <p className="mt-1 text-xs text-slate-500">先看参数中文解释，再决定是否编辑，避免只盯英文配置名。</p>
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
                {!configs.length ? <EmptyState label="当前筛选下没有可编辑的配置项。" /> : null}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <ServerCrash className="h-5 w-5 text-slate-700" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">配置编辑</h2>
                  <p className="mt-1 text-xs text-slate-500">不只改值，也解释改大改小分别会影响什么。</p>
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
                      placeholder="说明为什么修改，方便后续回看"
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
                      查看该配置的历史
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <EmptyState label="先从左侧选择一个配置项，再查看解释和编辑入口。" />
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
                  <h2 className="text-lg font-semibold text-slate-900">部署控制台</h2>
                  <p className="mt-1 text-xs text-slate-500">参数确认后，可以直接发起部署，并预设回滚原因。</p>
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
                <label className="grid gap-2 text-sm">
                  <span className="text-slate-500">回滚原因预设</span>
                  <input
                    value={rollbackNote}
                    onChange={(event) => setRollbackNote(event.target.value)}
                    placeholder="如果需要回滚，这里先写好原因"
                    className="h-11 rounded-xl border border-border bg-white px-3 text-sm text-slate-900"
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
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">最近一次部署</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {aiOps.latest_deployment.target} {'->'} {aiOps.latest_deployment.version}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getDeploymentTone(aiOps.latest_deployment.status)}`}>
                        {getStatusLabel(aiOps.latest_deployment.status)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{aiOps.latest_deployment.summary ?? '暂无部署说明。'}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(aiOps.latest_deployment.linked_config_keys ?? []).map((key) => (
                        <span key={key} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                          关联参数：{key}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-2">
                      {(aiOps.latest_deployment.health_checks ?? []).map((check) => (
                        <div key={check.name}>
                          <HealthCheckCard name={check.name} status={check.status} detail={check.detail} />
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
                  <p className="mt-1 text-xs text-slate-500">用来判断最近都在改哪一类配置，适合做整体巡检。</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('operations')}
                  className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                >
                  前往服务联调
                </button>
              </div>
              <div className="mt-5 space-y-3">
                <InfoRow label="历史记录总数" value={String(historySummary?.total ?? 0)} />
                <InfoRow label="最近变更时间" value={formatDateTime(historySummary?.latest_created_at)} />
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">按配置前缀分布</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {prefixEntries.map(([key, value]) => (
                      <span key={key} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {key} {value}
                      </span>
                    ))}
                    {!prefixEntries.length ? <span className="text-sm text-slate-500">暂无摘要。</span> : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">部署记录</h2>
                  <p className="mt-1 text-xs text-slate-500">保留每次发布的版本、结果、健康检查和回滚入口。</p>
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
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">部署时间线</p>
                  <div className="mt-4 space-y-4">
                    {deployments.slice(0, 5).map((item, index) => (
                      <div key={`timeline-${item.deployment_id}`} className="grid grid-cols-[18px_1fr] gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`h-3 w-3 rounded-full ${item.status === 'failed' ? 'bg-rose-500' : item.rolled_back_from ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          {index < Math.min(deployments.length, 5) - 1 ? <span className="mt-1 h-full w-px bg-slate-300" /> : null}
                        </div>
                        <div className="pb-2">
                          <p className="text-sm font-medium text-slate-900">{item.version}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDateTime(item.created_at)} · {getStatusLabel(item.status)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{item.summary ?? item.note ?? '暂无说明。'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

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
                        {getStatusLabel(item.status)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{item.summary ?? item.note ?? '暂无说明。'}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(item.linked_config_keys ?? []).map((key) => (
                        <span key={key} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                          {key}
                        </span>
                      ))}
                    </div>
                    {item.rolled_back_from ? <p className="mt-2 text-xs text-amber-600">回滚来源版本：{item.rolled_back_from}</p> : null}
                    <div className="mt-3 grid gap-2">
                      {(item.health_checks ?? []).slice(0, 2).map((check) => (
                        <div key={check.name}>
                          <HealthCheckCard name={check.name} status={check.status} detail={check.detail} compact />
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
                <p className="mt-1 text-xs text-slate-500">展示真实的配置历史，方便回看这个参数之前怎么改过。</p>
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
                  <p className="mt-3 text-sm text-slate-600">{item.value ?? '该记录没有直接值，可以继续查看 payload。'}</p>
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
      <span className="text-right text-sm font-semibold text-slate-900">{value}</span>
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
  const barClass = tone === 'good' ? 'bg-emerald-500' : tone === 'bad' ? 'bg-rose-500' : 'bg-slate-400';

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

function HealthCheckCard({
  name,
  status,
  detail,
  compact = false,
}: {
  name: string;
  status: string;
  detail: string;
  compact?: boolean;
}) {
  const palette =
    status === 'failed'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : status === 'ok'
        ? 'border-slate-200 bg-white text-slate-700'
        : 'border-amber-200 bg-amber-50 text-amber-700';

  return (
    <div className={`rounded-lg border px-3 py-3 ${palette}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`}>{name}</span>
        <span className={`font-semibold ${compact ? 'text-[11px]' : 'text-xs'}`}>{getStatusLabel(status)}</span>
      </div>
      <p className={`mt-1 ${compact ? 'text-[11px]' : 'text-xs'}`}>{detail}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{label}</div>;
}
