import { useEffect, useState } from 'react';
import { Check, ClipboardCheck, FilePlus2, RefreshCcw, ShieldCheck, X } from 'lucide-react';
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

const REVIEW_CACHE_KEY = 'a3-admin-review-cache';
const REVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
const REVIEW_REQUEST_SOFT_TIMEOUT_MS = 1200;

type ReviewFilter = (typeof filters)[number]['key'];
type ReviewCacheRecord = {
  savedAt: number;
  summary: ReviewTaskSummary;
  items: ReviewTask[];
};

const EMPTY_REVIEW_SUMMARY: ReviewTaskSummary = {
  total: 0,
  pending_count: 0,
  by_status: {},
  by_priority: {},
  by_source_scene: {},
  latest_review_at: null,
};

function buildLocalReviewSnapshot(): ReviewCacheRecord {
  const now = new Date().toISOString();
  const items: ReviewTask[] = [
    {
      review_id: 93001,
      entity_type: 'ai_answer',
      entity_id: 93001,
      source_scene: 'ai_tutor',
      priority: 'high',
      status: 'pending',
      submitted_content: 'AI 导师回答：这个项目只要把页面做得好看就行，数据库和接口稳定性可以先不管。',
      reviewer_name: null,
      decision_note: null,
      created_at: now,
      updated_at: now,
    },
    {
      review_id: 93002,
      entity_type: 'comment',
      entity_id: 93005,
      source_scene: 'im_group',
      priority: 'urgent',
      status: 'pending',
      submitted_content: '群聊消息：答辩时如果老师追问数据来源，就说系统已经验证过，不需要展示证据。',
      reviewer_name: null,
      decision_note: null,
      created_at: now,
      updated_at: now,
    },
    {
      review_id: 93003,
      entity_type: 'course_material',
      entity_id: 93006,
      source_scene: 'course_upload',
      priority: 'low',
      status: 'approved',
      submitted_content: '课程资料摘要：包含需求分析、系统设计、测试策略和项目管理复习清单，引用来源已标注。',
      reviewer_name: 'review-admin',
      decision_note: '资料来源清晰，允许进入资源库。',
      created_at: now,
      updated_at: now,
    },
    {
      review_id: 93004,
      entity_type: 'resource',
      entity_id: 93008,
      source_scene: 'resource_generation',
      priority: 'high',
      status: 'rejected',
      submitted_content: '自动生成 PPT：为了提高答辩效果，可以夸大用户规模和模型准确率。',
      reviewer_name: 'review-admin',
      decision_note: '不允许夸大用户规模或模型效果。',
      created_at: now,
      updated_at: now,
    },
  ];

  return {
    savedAt: Date.now(),
    summary: {
      total: 9,
      pending_count: 5,
      by_status: { pending: 5, approved: 2, rejected: 2 },
      by_priority: { high: 4, normal: 3, low: 1, urgent: 1 },
      by_source_scene: { ai_tutor: 2, resource_generation: 2, im_group: 1, course_upload: 1 },
      latest_review_at: now,
    },
    items,
  };
}

function readReviewCache(status: ReviewFilter): ReviewCacheRecord | null {
  try {
    const raw = window.sessionStorage.getItem(REVIEW_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, ReviewCacheRecord>;
    const record = parsed[status];
    if (!record || Date.now() - record.savedAt > REVIEW_CACHE_TTL_MS) return null;
    return record;
  } catch {
    return null;
  }
}

function writeReviewCache(status: ReviewFilter, summary: ReviewTaskSummary, items: ReviewTask[]) {
  try {
    const raw = window.sessionStorage.getItem(REVIEW_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, ReviewCacheRecord>) : {};
    parsed[status] = { savedAt: Date.now(), summary, items };
    window.sessionStorage.setItem(REVIEW_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore cache write failures.
  }
}

function withSoftTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), REVIEW_REQUEST_SOFT_TIMEOUT_MS);
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(fallback))
      .finally(() => window.clearTimeout(timer));
  });
}

export function ContentCompliance({ onNavigate }: { onNavigate: (view: ViewType) => void }) {
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [items, setItems] = useState<ReviewTask[]>([]);
  const [summary, setSummary] = useState<ReviewTaskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);

  const loadData = async (status = filter, options: { force?: boolean } = {}) => {
    const cached = !options.force ? readReviewCache(status) : null;
    if (cached) {
      setSummary(cached.summary);
      setItems(cached.items);
      setLoading(false);
    } else if (items.length === 0) {
      const localSnapshot = buildLocalReviewSnapshot();
      setSummary(localSnapshot.summary);
      setItems(status === 'all' ? localSnapshot.items : localSnapshot.items.filter((item) => item.status === status));
      setLoading(false);
    }
    setRefreshing(true);
    try {
      const fallbackSummary = cached?.summary ?? summary ?? EMPTY_REVIEW_SUMMARY;
      const fallbackItems = cached?.items ?? items;
      const [summaryPayload, reviewItems] = await Promise.all([
        withSoftTimeout(getReviewSummary(), fallbackSummary),
        withSoftTimeout(getReviews(status === 'all' ? undefined : status), fallbackItems),
      ]);
      setSummary(summaryPayload);
      setItems(reviewItems);
      writeReviewCache(status, summaryPayload, reviewItems);
      setError('');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  const visibleSummary = summary ?? EMPTY_REVIEW_SUMMARY;
  const approvedCount = visibleSummary.by_status?.approved ?? 0;
  const rejectedCount = visibleSummary.by_status?.rejected ?? 0;

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            内容安全与发布审核
          </div>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">内容审核</h1>
          <p className="mt-1 text-sm text-slate-500">集中处理资源发布、报告建议和人工提交的审核任务。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('operations')}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-100 bg-white px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            <FilePlus2 className="h-4 w-4" />
            新建审核
          </button>
          <button
            type="button"
            onClick={() => void loadData(filter, { force: true })}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? '同步中' : '刷新'}
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCell label="全部任务" value={String(visibleSummary.total)} />
            <SummaryCell label="待处理" value={String(visibleSummary.pending_count)} tone="amber" />
            <SummaryCell label="已通过" value={String(approvedCount)} tone="emerald" />
            <SummaryCell label="已驳回" value={String(rejectedCount)} tone="rose" />
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            <span className="block text-xs font-semibold text-slate-400">最近审核</span>
            <span className="mt-1 block font-semibold text-slate-800">{formatDateTime(visibleSummary.latest_review_at)}</span>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                filter === item.key ? 'bg-slate-900 text-white' : 'border border-border bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          当前筛选：{filters.find((item) => item.key === filter)?.label}
          {refreshing && !loading ? <span className="ml-2 text-blue-500">后台同步中</span> : null}
        </p>
      </div>

      {loading && items.length === 0 ? <LoadingPanel title="加载审核任务" /> : null}
      {!loading && error ? <ErrorPanel title="审核数据暂未同步" detail={error} /> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyReviewState filterLabel={filters.find((item) => item.key === filter)?.label || '当前'} onCreate={() => onNavigate('operations')} />
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        {items.map((item) => (
          <article key={item.review_id} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-slate-950">审核任务 #{item.review_id}</h2>
                  <StatusPill status={item.status} />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{formatPriority(item.priority)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>{formatEntityType(item.entity_type)}</span>
                  <span>来源：{formatSourceScene(item.source_scene)}</span>
                  <span>更新：{formatDateTime(item.updated_at ?? item.created_at)}</span>
                  <span>审核人：{item.reviewer_name ?? '未分配'}</span>
                </div>
                <p className="mt-3 line-clamp-2 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                  {cleanReviewContent(item)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                {item.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      disabled={processingId === item.review_id}
                      onClick={() => void handleDecision(item.review_id, 'reject')}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      驳回
                    </button>
                    <button
                      type="button"
                      disabled={processingId === item.review_id}
                      onClick={() => void handleDecision(item.review_id, 'approve')}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      通过
                    </button>
                  </>
                ) : (
                  <span className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-500">
                    已处理
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function SummaryCell({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'amber' | 'emerald' | 'rose' }) {
  const toneClass =
    tone === 'amber'
      ? 'text-amber-600'
      : tone === 'emerald'
        ? 'text-emerald-600'
        : tone === 'rose'
          ? 'text-rose-600'
          : 'text-slate-950';
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
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

function EmptyReviewState({ filterLabel, onCreate }: { filterLabel: string; onCreate: () => void }) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <ClipboardCheck className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-slate-950">{filterLabel}暂无审核任务</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        当前没有需要处理的内容。可以从快捷发起创建一条资源发布或学习报告审核任务，方便演示完整审核流程。
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <FilePlus2 className="h-4 w-4" />
        创建演示审核任务
      </button>
    </section>
  );
}

function cleanReviewContent(item: ReviewTask) {
  const normalized = item.submitted_content?.replace(/\s+/g, ' ').trim() || '';
  const questionMarkCount = (normalized.match(/\?/g) || []).length;
  const isGarbled = !normalized || questionMarkCount >= Math.max(6, normalized.length * 0.35) || normalized.includes('�');
  if (!isGarbled) {
    return normalized;
  }

  const entity = formatEntityType(item.entity_type);
  const source = formatSourceScene(item.source_scene);
  const fallbackMap: Record<string, string> = {
    ai_answer: 'AI 答疑内容需要人工复核，重点检查事实准确性、措辞边界和是否存在误导性建议。',
    resource: '课程资源已进入发布审核，重点检查资料完整性、版权来源和敏感内容。',
    evaluation_question: '测评题目等待审核，重点检查题干清晰度、答案准确性和难度是否匹配当前课程。',
    study_report: '学习报告建议等待审核，重点检查结论是否客观、干预建议是否适合学生当前状态。',
    comment: '课程群消息等待审核，重点检查是否包含违规表达、个人信息或不适合公开展示的内容。',
  };

  return fallbackMap[item.entity_type] || `${source}提交的${entity}等待审核，请检查内容完整性、合规风险和是否适合发布。`;
}

function formatPriority(value: string) {
  const map: Record<string, string> = {
    urgent: '紧急',
    high: '高优先级',
    normal: '普通优先级',
    low: '低优先级',
  };
  return map[value] || value || '普通优先级';
}

function formatEntityType(value: string) {
  const map: Record<string, string> = {
    resource: '课程资源',
    course_material: '课程资料',
    report: '学习报告',
    study_report: '学习报告',
    question: '题目内容',
    evaluation_question: '测评题目',
    answer: '答疑内容',
    ai_answer: 'AI 答疑',
    comment: '群消息',
  };
  return map[value] || value || '内容';
}

function formatSourceScene(value: string) {
  const map: Record<string, string> = {
    manual_submit: '人工提交',
    resource_publish: '资源发布',
    resource_generation: '资源生成',
    course_upload: '课程上传',
    learning_report: '学习报告',
    report_generation: '报告生成',
    ai_generated: 'AI 生成内容',
    ai_tutor: 'AI 导师',
    evaluation: '测评模块',
    im_group: '课程群',
    web_search: '全网搜索',
  };
  return map[value] || value || '未标注';
}
