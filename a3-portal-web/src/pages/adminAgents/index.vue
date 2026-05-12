<template>
  <div class="adminSimplePage">
    <section class="pageCard">
      <div class="pageHead">
        <div>
          <div class="badge blue">智能体编排</div>
          <h1>智能体编排与运行态</h1>
          <p>
            集中查看各智能体的协同状态、关键运行日志和异常信号，便于演示多智能体分工、降级处理与问题定位链路。
          </p>
        </div>
        <div class="headActions">
          <router-link class="backButton" to="/main/ai-admin">返回管理总览</router-link>
          <el-button :loading="loading" @click="loadData">刷新数据</el-button>
        </div>
      </div>

      <div class="toolbar">
        <el-input v-model="agentNameFilter" clearable placeholder="筛选智能体，例如 planner_agent" />
        <el-select v-model="levelFilter" clearable placeholder="筛选日志等级">
          <el-option label="全部等级" value="" />
          <el-option label="信息" value="info" />
          <el-option label="警告" value="warn" />
          <el-option label="错误" value="error" />
        </el-select>
        <el-button :loading="exporting" plain @click="exportLogs">导出 CSV</el-button>
      </div>

      <div class="summaryGrid">
        <div class="summaryCard">
          <span>智能体总数</span>
          <strong>{{ filteredStatusItems.length }}</strong>
        </div>
        <div class="summaryCard accent">
          <span>正常运行</span>
          <strong>{{ healthyAgentCount }}</strong>
        </div>
        <div class="summaryCard warning">
          <span>需关注实例</span>
          <strong>{{ attentionAgentCount }}</strong>
        </div>
        <div class="summaryCard">
          <span>运行日志数</span>
          <strong>{{ runtimeLogs.length }}</strong>
        </div>
      </div>

      <div class="sectionHead">
        <div>
          <h2>智能体状态卡</h2>
          <p class="sectionDesc">优先呈现最新状态、最近消息和累计异常次数。</p>
        </div>
      </div>

      <div v-if="filteredStatusItems.length" class="agentGrid">
        <div v-for="item in filteredStatusItems" :key="item.agent_name" class="agentCard">
          <div class="rowHead">
            <div>
              <strong>{{ formatAgentName(item.agent_name) }}</strong>
              <p>{{ item.agent_name }}</p>
            </div>
            <span class="statusTag" :class="statusClass(item.latest_status)">
              {{ formatStatus(item.latest_status) }}
            </span>
          </div>
          <div class="messageBox">{{ item.latest_message || "暂无最新运行消息" }}</div>
          <div class="metaGrid">
            <div>累计异常：{{ item.error_count || 0 }}</div>
            <div>更新时间：{{ item.updated_at || "--" }}</div>
          </div>
        </div>
      </div>
      <div v-else class="emptyState">当前没有可展示的智能体状态。</div>

      <div class="sectionHead runtimeHead">
        <div>
          <h2>运行日志</h2>
          <p class="sectionDesc">支持按智能体和日志等级筛选，便于现场展开单条运行上下文。</p>
        </div>
      </div>

      <div v-if="runtimeLogs.length" class="logGrid">
        <div v-for="item in runtimeLogs" :key="item.log_id" class="logCard">
          <div class="rowHead">
            <div>
              <strong>{{ formatAgentName(item.agent_name) }}</strong>
              <p>{{ item.message }}</p>
            </div>
            <div class="tagGroup">
              <span class="levelTag" :class="levelClass(item.level)">{{ formatLevel(item.level) }}</span>
              <span class="statusMini" :class="statusClass(item.status)">{{ formatStatus(item.status) }}</span>
            </div>
          </div>

          <div class="metaGrid">
            <div>日志编号：#{{ item.log_id }}</div>
            <div>发生时间：{{ item.created_at || "--" }}</div>
          </div>

          <div class="payloadBox">{{ formatPayloadSummary(item.payload) }}</div>

          <div class="actionRow">
            <el-button size="small" plain @click="openDetail(item)">查看详情</el-button>
            <router-link :to="{ path: '/main/ai-admin-logs', query: { scene: 'agent_runtime' } }">
              查看审计联动
            </router-link>
          </div>
        </div>
      </div>
      <div v-else class="emptyState">
        {{ errorMessage || "当前筛选条件下没有运行日志，可切换智能体或等级继续查看。" }}
      </div>
    </section>

    <el-drawer v-model="detailVisible" title="运行日志详情" size="720px" destroy-on-close>
      <div v-if="detailData" class="detailWrap">
        <div class="detailHero">
          <div>
            <h3>{{ formatAgentName(detailData.agent_name) }}</h3>
            <p>{{ detailData.message }}</p>
          </div>
          <div class="tagGroup">
            <span class="levelTag" :class="levelClass(detailData.level)">{{ formatLevel(detailData.level) }}</span>
            <span class="statusMini" :class="statusClass(detailData.status)">{{ formatStatus(detailData.status) }}</span>
          </div>
        </div>

        <div class="detailGrid">
          <div class="detailCard">
            <span>日志编号</span>
            <strong>#{{ detailData.log_id }}</strong>
          </div>
          <div class="detailCard">
            <span>发生时间</span>
            <strong>{{ detailData.created_at || "--" }}</strong>
          </div>
          <div class="detailCard">
            <span>更新时间</span>
            <strong>{{ detailData.updated_at || "--" }}</strong>
          </div>
        </div>

        <div class="detailSection">
          <div class="sectionHead">
            <h4>原始载荷</h4>
          </div>
          <pre class="payloadPre">{{ formatPayloadJson(detailData.payload) }}</pre>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { exportAiAgentRuntimeLogs, listAiAgentRuntimeLogs, listAiAgentStatus } from "@/api/ai";
import { useRoute } from "vue-router";

const loading = ref(false);
const exporting = ref(false);
const errorMessage = ref("");
const agentNameFilter = ref("");
const levelFilter = ref("");
const statusItems = ref([]);
const runtimeLogs = ref([]);
const detailVisible = ref(false);
const detailData = ref(null);
const route = useRoute();

const filteredStatusItems = computed(() => {
  const keyword = agentNameFilter.value.trim().toLowerCase();
  if (!keyword) {
    return statusItems.value;
  }
  return statusItems.value.filter((item) => item.agent_name?.toLowerCase().includes(keyword));
});

const healthyAgentCount = computed(() => filteredStatusItems.value.filter((item) => item.latest_status === "ok").length);
const attentionAgentCount = computed(() => filteredStatusItems.value.filter((item) => item.latest_status !== "ok").length);

const applyRouteFilters = () => {
  const query = route.query || {};
  agentNameFilter.value = query.agentName ? String(query.agentName) : "";
  levelFilter.value = query.level ? String(query.level) : "";
};

const syncRouteSelection = () => {
  const logId = route.query.logId ? String(route.query.logId) : "";
  if (!logId) {
    return;
  }
  const matched = runtimeLogs.value.find((item) => String(item.log_id) === logId);
  if (matched) {
    openDetail(matched);
  }
};

const loadData = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    const [statusResult, logResult] = await Promise.all([
      listAiAgentStatus(),
      listAiAgentRuntimeLogs({
        agent_name: agentNameFilter.value || undefined,
        level: levelFilter.value || undefined,
      }),
    ]);
    statusItems.value = statusResult.items || [];
    runtimeLogs.value = logResult.items || [];
  } catch (error) {
    statusItems.value = [];
    runtimeLogs.value = [];
    errorMessage.value = error?.response?.data?.detail || error?.message || "智能体数据加载失败";
  } finally {
    loading.value = false;
  }
  syncRouteSelection();
};

const exportLogs = async () => {
  exporting.value = true;
  try {
    const response = await exportAiAgentRuntimeLogs({
      agent_name: agentNameFilter.value || undefined,
      level: levelFilter.value || undefined,
    });
    const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "agent-runtime-logs.csv";
    link.click();
    window.URL.revokeObjectURL(url);
    ElMessage.success("智能体运行日志已导出");
  } catch (error) {
    ElMessage.error(error?.response?.data?.detail || error?.message || "导出失败");
  } finally {
    exporting.value = false;
  }
};

const openDetail = (item) => {
  detailData.value = item;
  detailVisible.value = true;
};

const formatAgentName = (value) => {
  const map = {
    profile_agent: "画像智能体",
    resource_agent: "资源智能体",
    planner_agent: "路径规划智能体",
    evaluator_agent: "评测智能体",
  };
  return map[value] || value || "未命名智能体";
};

const formatStatus = (value) => {
  const map = {
    ok: "正常",
    degraded: "降级运行",
    error: "异常",
  };
  return map[value] || value || "未知";
};

const statusClass = (value) => {
  if (value === "ok") {
    return "is-ok";
  }
  if (value === "error") {
    return "is-error";
  }
  return "is-warn";
};

const formatLevel = (value) => {
  const map = {
    info: "信息",
    warn: "警告",
    error: "错误",
  };
  return map[value] || value || "未知";
};

const levelClass = (value) => {
  if (value === "error") {
    return "is-error";
  }
  if (value === "warn") {
    return "is-warn";
  }
  return "is-info";
};

const formatPayloadSummary = (payload) => {
  if (!payload || !Object.keys(payload).length) {
    return "该条日志没有附加运行载荷。";
  }
  return Object.entries(payload)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`)
    .join(" | ");
};

const formatPayloadJson = (payload) => {
  if (!payload || !Object.keys(payload).length) {
    return "暂无载荷";
  }
  return JSON.stringify(payload, null, 2);
};

watch(
  () => route.query,
  async () => {
    applyRouteFilters();
    await loadData();
  }
);

onMounted(async () => {
  applyRouteFilters();
  await loadData();
});
</script>

<style scoped lang="scss">
.adminSimplePage {
  min-height: 100vh;
  padding: 32px 24px 48px;
  background: linear-gradient(180deg, #eef4fb 0%, #f8fbff 100%);
}

.pageCard {
  max-width: 1220px;
  margin: 0 auto;
  padding: 28px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.1);
}

.pageHead,
.rowHead,
.actionRow,
.detailHero,
.sectionHead {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
}

.headActions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.badge {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.badge.blue {
  background: #dbeafe;
  color: #1d4ed8;
}

h1 {
  margin-top: 14px;
  font-size: 36px;
  color: #12233b;
}

h2,
h3,
h4 {
  color: #12233b;
}

p {
  margin-top: 12px;
  color: #5f7186;
  line-height: 1.8;
}

.sectionDesc {
  margin-top: 8px;
}

.backButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 140px;
  height: 42px;
  padding: 0 18px;
  border-radius: 999px;
  background: #123b74;
  color: #fff;
  font-weight: 700;
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px auto;
  gap: 12px;
  margin-top: 24px;
}

.summaryGrid,
.agentGrid,
.logGrid,
.detailGrid {
  display: grid;
  gap: 16px;
}

.summaryGrid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 24px;
}

.summaryCard,
.agentCard,
.logCard,
.detailCard {
  border-radius: 22px;
  background: #f8fbff;
}

.summaryCard {
  padding: 18px 20px;
}

.summaryCard span,
.detailCard span {
  display: block;
  color: #6b7b90;
  font-size: 13px;
}

.summaryCard strong,
.detailCard strong {
  display: block;
  margin-top: 10px;
  color: #12233b;
  font-size: 28px;
}

.summaryCard.accent {
  background: #ecfeff;
}

.summaryCard.warning {
  background: #fff7ed;
}

.agentGrid,
.logGrid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 18px;
}

.agentCard,
.logCard {
  padding: 18px;
}

.agentCard strong,
.logCard strong {
  font-size: 18px;
  color: #12233b;
}

.messageBox,
.payloadBox,
.payloadPre {
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  background: #f1f5f9;
  color: #42556d;
  line-height: 1.7;
}

.metaGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
  color: #6b7b90;
  font-size: 13px;
}

.tagGroup {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.statusTag,
.levelTag,
.statusMini {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.is-ok {
  background: #dcfce7;
  color: #15803d;
}

.is-info {
  background: #dbeafe;
  color: #1d4ed8;
}

.is-warn {
  background: #fef3c7;
  color: #b45309;
}

.is-error {
  background: #fee2e2;
  color: #b91c1c;
}

.runtimeHead {
  margin-top: 30px;
}

.actionRow {
  margin-top: 16px;
}

.emptyState {
  margin-top: 18px;
  padding: 18px;
  border-radius: 18px;
  background: #f8fafc;
  color: #64748b;
}

.detailWrap {
  display: grid;
  gap: 18px;
}

.detailCard {
  padding: 16px;
}

.detailSection {
  margin-top: 6px;
}

.payloadPre {
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 1100px) {
  .pageHead,
  .headActions,
  .sectionHead,
  .detailHero {
    flex-direction: column;
  }

  .toolbar,
  .summaryGrid,
  .agentGrid,
  .logGrid,
  .detailGrid,
  .metaGrid {
    grid-template-columns: 1fr;
  }
}
</style>
