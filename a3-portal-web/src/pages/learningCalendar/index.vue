<template>
  <div class="studentModulePage">
    <section class="heroCard">
      <div>
        <div class="badge">Learning Calendar</div>
        <h1>学习日历</h1>
        <p>
          汇总<strong>正式学习路径</strong>（Java 服务）与 <strong>AI 学习计划</strong>（演示）任务，支持月视图与自定义备忘；数据来自：{{
            dataSourceLabel
          }}。
        </p>
      </div>
      <div class="heroActions">
        <el-radio-group v-model="viewMode" size="default" class="viewToggle">
          <el-radio-button label="list">列表</el-radio-button>
          <el-radio-button label="month">月历</el-radio-button>
        </el-radio-group>
        <el-button class="navButton" :loading="loading" @click="loadCalendar">刷新</el-button>
      </div>
    </section>

    <section class="contentGrid">
      <div class="card mainCard">
        <div class="sectionHead">
          <h2>{{ viewMode === "month" ? "月历视图" : "学习安排" }}</h2>
          <span class="metaText">共 {{ mergedItems.length }} 项</span>
        </div>

        <div v-if="viewMode === 'month'" class="monthWrap">
          <el-calendar v-model="calendarMonth">
            <template #date-cell="{ data }">
              <div class="calCell" :class="{ isToday: isTodayKey(data.day) }">
                <span class="calDay">{{ shortDayLabel(data.day) }}</span>
                <div v-if="countForDay(data.day)" class="calDots">
                  <span class="calCount">{{ countForDay(data.day) }}</span>
                </div>
              </div>
            </template>
          </el-calendar>
          <p class="calHint">数字表示当天任务条数（含自定义）。点击左侧列表可按日期筛选。</p>
        </div>

        <div v-if="mergedItems.length" class="timeline">
          <div
            v-for="item in displayedListItems"
            :key="item._key"
            class="timelineItem"
            :class="{ muted: item.source === 'custom' && item.status === 'completed' }"
          >
            <div class="timelineTop">
              <strong>
                <span v-if="item.dateKey" class="dateBadge">{{ item.dateKey }}</span>
                Day {{ item.day ?? "—" }}
              </strong>
              <span :class="['statusTag', item.status]">{{ formatStatus(item.status) }}</span>
            </div>
            <div class="sourceRow">
              <span class="miniTag" :data-src="item.source">{{ sourceLabel(item.source) }}</span>
            </div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.objective }}</p>
            <div v-if="item.tasks?.length" class="taskList">
              <div v-for="task in item.tasks" :key="task" class="taskItem">{{ task }}</div>
            </div>
            <div v-if="item.source === 'custom'" class="customRow">
              <el-button size="small" text type="primary" @click="toggleCustomDone(item)">
                {{ item.status === "completed" ? "标为未完成" : "标记完成" }}
              </el-button>
              <el-button size="small" text type="danger" @click="removeCustom(item)">删除</el-button>
            </div>
          </div>
        </div>
        <div v-else class="emptyState">当前没有可展示的日历数据，请创建学习路径或生成 AI 计划后再试。</div>
      </div>

      <div class="card sideCard">
        <h2>自定义任务</h2>
        <p class="sideDesc">写入浏览器本地，用于演示「日历 + 自定义提醒」；不经过服务端。</p>
        <el-form label-position="top" class="customForm">
          <el-form-item label="日期">
            <el-date-picker
              v-model="customDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择日期"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="事项">
            <el-input v-model="customTitle" placeholder="例如：复盘错题本" maxlength="120" show-word-limit />
          </el-form-item>
          <el-button type="primary" :disabled="!customDate || !customTitle.trim()" @click="addCustomTask">
            添加到日历
          </el-button>
        </el-form>

        <h2 class="sideH2">提醒</h2>
        <div class="tagList">
          <span v-for="item in reminders" :key="item">{{ item }}</span>
        </div>
        <div v-if="errorMessage" class="errorState">{{ errorMessage }}</div>

        <h2 class="sideH2">本周统计</h2>
        <ul class="weekStats">
          <li>路径 / 计划项：{{ weekPlanCount }}</li>
          <li>自定义未完成：{{ weekCustomOpenCount }}</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { getAiLearningPlanProgress, getLatestAiLearningPlan } from "@/api/ai";
import { getCurrentLearningPath, getLearningPathNodes } from "@/api/learningPath";
import { a3DemoScenario } from "@/mock/a3DemoData";

const CUSTOM_STORAGE_KEY = "a3_portal_learning_calendar_custom_v1";

const latestPlan = ref(null);
const progress = ref(null);
const javaPath = ref(null);
const javaNodes = ref([]);
const loading = ref(false);
const errorMessage = ref("");
const viewMode = ref("list");
const calendarMonth = ref(new Date());

const customTasks = ref([]);
const customDate = ref("");
const customTitle = ref("");

const fallbackSteps = [
  {
    day: 1,
    title: "过拟合与模型评估基础理解",
    objective: "梳理过拟合、泛化误差与模型评估指标，建立演示主线。",
    tasks: ["阅读讲义", "完成基础练习", "整理 3 条讲解要点"],
    status: "in_progress",
  },
  {
    day: 2,
    title: "专项强化与问答联动",
    objective: "串联资源推荐与智能助教，强化关键知识点。",
    tasks: ["选择推荐资源", "完成一轮问答", "记录阶段总结"],
    status: "pending",
  },
];

const progressMap = computed(() =>
  Object.fromEntries((progress.value?.items || []).map((item) => [item.step_id, item])),
);

const dataSourceLabel = computed(() => {
  if (javaPath.value?.id && javaNodes.value.length) return "正式学习路径（优先）";
  if (latestPlan.value?.steps?.length) return "AI 学习计划";
  return "本地演示数据";
});

function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base, n) {
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  return x;
}

function parsePathStart(path) {
  if (!path) return startOfToday();
  const raw = path.startTime || path.activateTime || path.createTime;
  if (!raw) return startOfToday();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return startOfToday();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const NODE_TYPE_LABEL = { 1: "学习", 2: "练习", 3: "测评", 4: "复习" };

function mapNodeStatus(node, currentNodeId) {
  if (node.status === 2 || node.status === 3) return "completed";
  if (node.status === 4) return "paused";
  if (node.status === 1) return "in_progress";
  if (currentNodeId != null && node.id === currentNodeId) return "in_progress";
  return "pending";
}

function buildPathCalendarItems(path, nodes) {
  if (!path || !nodes?.length) return [];
  const start = parsePathStart(path);
  return nodes.map((n, i) => {
    const d = addDays(start, i);
    const tasks = [
      NODE_TYPE_LABEL[n.nodeType] || "任务",
      n.estimatedDuration ? `约 ${n.estimatedDuration} 分钟` : null,
    ].filter(Boolean);
    return {
      source: "path",
      step_id: n.id,
      day: i + 1,
      dateKey: formatDateKey(d),
      title: n.nodeName || `节点 ${i + 1}`,
      objective: n.nodeDesc || "完成本节点学习任务。",
      tasks,
      status: mapNodeStatus(n, path.currentNodeId),
      _key: `path-${n.id}`,
    };
  });
}

function buildAiCalendarItems() {
  const steps = latestPlan.value?.steps;
  if (!Array.isArray(steps) || !steps.length) return [];
  const start = startOfToday();
  return steps.map((step, index) => {
    const d = addDays(start, index);
    return {
      source: "ai",
      step_id: step.step_id,
      day: step.day ?? index + 1,
      dateKey: formatDateKey(d),
      title: step.title || `第 ${index + 1} 天学习任务`,
      objective: step.objective || "完成当天学习目标。",
      tasks: step.tasks || [],
      status: progressMap.value[step.step_id]?.status || step.status || "pending",
      _key: `ai-${step.step_id ?? index}`,
    };
  });
}

function buildFallbackItems() {
  const start = startOfToday();
  return fallbackSteps.map((step, index) => {
    const d = addDays(start, index);
    return {
      source: "fallback",
      step_id: `fb-${index}`,
      day: step.day,
      dateKey: formatDateKey(d),
      title: step.title,
      objective: step.objective,
      tasks: step.tasks || [],
      status: step.status,
      _key: `fb-${index}`,
    };
  });
}

const planItems = computed(() => {
  if (javaPath.value?.id && javaNodes.value.length) {
    return buildPathCalendarItems(javaPath.value, javaNodes.value);
  }
  const ai = buildAiCalendarItems();
  if (ai.length) return ai;
  return buildFallbackItems();
});

const mergedItems = computed(() => {
  const custom = (customTasks.value || []).map((t) => ({
    source: "custom",
    step_id: t.id,
    day: null,
    dateKey: t.dateKey,
    title: t.title,
    objective: "自定义备忘",
    tasks: [],
    status: t.done ? "completed" : "pending",
    _key: `c-${t.id}`,
  }));
  return [...planItems.value, ...custom];
});

const displayedListItems = computed(() => mergedItems.value);

function countForDay(dayStr) {
  return mergedItems.value.filter((i) => i.dateKey === dayStr && i.status !== "completed").length;
}

function shortDayLabel(dayStr) {
  const parts = dayStr.split("-");
  return parts.length === 3 ? `${parts[1]}-${parts[2]}` : dayStr;
}

function isTodayKey(dayStr) {
  return dayStr === formatDateKey(startOfToday());
}

const reminders = computed(() => {
  const items = ["每日学习前可在此查看本周安排"];
  if (mergedItems.value.some((item) => item.status === "paused")) {
    items.push("存在已暂缓任务，建议择机恢复");
  }
  if (mergedItems.value.some((item) => item.status === "in_progress")) {
    items.push("当前有进行中项，优先保证连续性");
  }
  if (javaPath.value?.id) {
    items.push("已与后端学习路径同步（需登录且存在进行中路径）");
  }
  return items;
});

function startOfWeek(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeek(d) {
  const s = startOfWeek(d);
  const e = addDays(s, 7);
  return e;
}

const weekPlanCount = computed(() => {
  const s = startOfWeek(new Date());
  const e = endOfWeek(new Date());
  return planItems.value.filter((item) => {
    if (!item.dateKey) return false;
    const t = new Date(item.dateKey + "T12:00:00");
    return t >= s && t < e;
  }).length;
});

const weekCustomOpenCount = computed(() => {
  const s = startOfWeek(new Date());
  const e = endOfWeek(new Date());
  return (customTasks.value || []).filter((t) => {
    if (t.done) return false;
    const x = new Date(t.dateKey + "T12:00:00");
    return x >= s && x < e;
  }).length;
});

function loadCustomFromStorage() {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    customTasks.value = raw ? JSON.parse(raw) : [];
  } catch {
    customTasks.value = [];
  }
}

function persistCustom() {
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(customTasks.value));
}

function addCustomTask() {
  const title = customTitle.value.trim();
  if (!customDate.value || !title) return;
  customTasks.value.push({
    id: `ct-${Date.now()}`,
    dateKey: customDate.value,
    title,
    done: false,
  });
  persistCustom();
  customTitle.value = "";
}

function toggleCustomDone(item) {
  const id = item.step_id;
  const row = customTasks.value.find((t) => t.id === id);
  if (!row) return;
  row.done = !row.done;
  item.status = row.done ? "completed" : "pending";
  persistCustom();
}

function removeCustom(item) {
  const id = item.step_id;
  customTasks.value = customTasks.value.filter((t) => t.id !== id);
  persistCustom();
}

function sourceLabel(src) {
  const m = { path: "学习路径", ai: "AI 计划", fallback: "演示", custom: "自定义" };
  return m[src] || src;
}

const loadCalendar = async () => {
  loading.value = true;
  errorMessage.value = "";
  javaPath.value = null;
  javaNodes.value = [];
  try {
    const [planRes, pathRes] = await Promise.all([
      getLatestAiLearningPlan({
        user_id: a3DemoScenario.userId,
        course_code: a3DemoScenario.courseCode,
      }).catch(() => null),
      getCurrentLearningPath().catch(() => ({ code: -1 })),
    ]);

    latestPlan.value = planRes;
    if (planRes?.plan_id) {
      progress.value = await getAiLearningPlanProgress(planRes.plan_id, {
        user_id: a3DemoScenario.userId,
      }).catch(() => null);
    } else {
      progress.value = null;
    }

    if (pathRes && pathRes.code === 200 && pathRes.data?.id) {
      javaPath.value = pathRes.data;
      const nodesRes = await getLearningPathNodes(pathRes.data.id).catch(() => ({ code: -1 }));
      if (nodesRes?.code === 200 && Array.isArray(nodesRes.data)) {
        javaNodes.value = nodesRes.data;
      }
    }
  } catch (error) {
    latestPlan.value = null;
    progress.value = null;
    errorMessage.value = error?.response?.data?.msg || error?.message || "日历数据加载失败";
  } finally {
    loading.value = false;
  }
};

const formatStatus = (status) => {
  const map = {
    pending: "待开始",
    in_progress: "进行中",
    paused: "已暂停",
    completed: "已完成",
  };
  return map[status] || status || "待开始";
};

onMounted(() => {
  loadCustomFromStorage();
  loadCalendar();
});
</script>

<style scoped lang="scss">
.studentModulePage {
  min-height: 100vh;
  padding: 32px 24px 48px;
  background: linear-gradient(180deg, #f6f9fd 0%, #edf3f8 100%);
}

.heroCard,
.card {
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24px 60px rgba(31, 58, 94, 0.1);
}

.heroCard {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  max-width: 1180px;
  margin: 0 auto 24px;
  padding: 28px 30px;
}

.heroActions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

.viewToggle {
  flex-shrink: 0;
}

.badge {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 700;
  font-size: 12px;
}

h1 {
  margin-top: 14px;
  color: #12233b;
  font-size: 38px;
}

p {
  margin-top: 12px;
  color: #5f7186;
  line-height: 1.8;
}

.navButton {
  min-width: 150px;
  height: 44px;
  border-radius: 999px;
}

.contentGrid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 24px;
  max-width: 1180px;
  margin: 0 auto;
}

.card {
  padding: 26px;
}

.sectionHead,
.timelineTop {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
}

h2 {
  color: #12233b;
  font-size: 24px;
}

.sideH2 {
  margin-top: 22px;
}

.metaText {
  color: #64748b;
  font-size: 13px;
}

.monthWrap {
  margin-bottom: 20px;

  :deep(.el-calendar__body) {
    padding: 0;
  }

  :deep(.el-calendar-day) {
    height: 72px;
    padding: 4px;
  }
}

.calCell {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;

  &.isToday .calDay {
    color: #1d4ed8;
    font-weight: 800;
  }
}

.calDay {
  font-size: 12px;
  color: #64748b;
}

.calDots {
  display: flex;
  align-items: center;
}

.calCount {
  display: inline-flex;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #c7d2fe;
  color: #312e81;
  font-size: 11px;
  font-weight: 700;
  justify-content: center;
  align-items: center;
}

.calHint {
  margin-top: 8px;
  font-size: 12px;
  color: #94a3b8;
}

.timeline {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.timelineItem {
  padding: 16px 18px;
  border-radius: 18px;
  background: #f7fafc;

  &.muted {
    opacity: 0.65;
  }
}

.timelineItem strong {
  color: #1d4ed8;
}

.dateBadge {
  display: inline-block;
  margin-right: 8px;
  padding: 2px 8px;
  border-radius: 8px;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 12px;
  font-weight: 700;
}

.sourceRow {
  margin-top: 6px;
}

.miniTag {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  background: #f1f5f9;
  color: #475569;
}

.miniTag[data-src="path"] {
  background: #dbeafe;
  color: #1e40af;
}

.miniTag[data-src="ai"] {
  background: #fef3c7;
  color: #92400e;
}

.miniTag[data-src="custom"] {
  background: #e9d5ff;
  color: #6b21a8;
}

.timelineItem h3 {
  margin-top: 10px;
  color: #12233b;
  font-size: 20px;
}

.statusTag {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.statusTag.pending {
  background: #e2e8f0;
  color: #475569;
}

.statusTag.in_progress {
  background: #dbeafe;
  color: #1d4ed8;
}

.statusTag.paused {
  background: #fff7ed;
  color: #c2410c;
}

.statusTag.completed {
  background: #dcfce7;
  color: #15803d;
}

.taskList,
.tagList {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.taskItem,
.tagList span {
  padding: 8px 12px;
  border-radius: 999px;
  background: #eef2ff;
  color: #334155;
}

.customRow {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.emptyState,
.errorState {
  margin-top: 18px;
  padding: 16px 18px;
  border-radius: 18px;
  color: #475569;
  line-height: 1.8;
}

.emptyState {
  background: #f7fafc;
}

.errorState {
  background: #fff1f2;
  color: #be123c;
}

.sideDesc {
  font-size: 13px;
  color: #64748b;
  margin-top: 8px;
  line-height: 1.6;
}

.customForm {
  margin-top: 16px;
}

.weekStats {
  margin: 12px 0 0;
  padding-left: 18px;
  color: #475569;
  line-height: 1.8;
}

@media (max-width: 1100px) {
  .contentGrid {
    grid-template-columns: 1fr;
  }

  .heroCard {
    flex-direction: column;
  }

  .heroActions {
    align-items: stretch;
    width: 100%;
  }

  .viewToggle {
    width: 100%;
    display: flex;
    justify-content: stretch;
  }
}
</style>
