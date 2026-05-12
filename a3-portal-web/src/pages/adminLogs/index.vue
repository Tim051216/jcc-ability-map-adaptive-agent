<template>
  <div class="adminSimplePage">
    <section class="pageCard">
      <div class="pageHead">
        <div>
          <div class="badge purple">审计日志</div>
          <h1>运行日志与审计记录</h1>
          <p>
            汇总关键管理动作、审核轨迹和后台配置变更，支持现场筛选、定位问题和导出留档。
          </p>
        </div>
        <div class="headActions">
          <router-link class="backButton" to="/main/ai-admin">返回管理总览</router-link>
          <el-button :loading="loading" @click="loadLogs">刷新日志</el-button>
        </div>
      </div>

      <div class="toolbar">
        <el-input v-model="sceneFilter" clearable placeholder="筛选场景，例如 content_review" />
        <el-input v-model="actionFilter" clearable placeholder="筛选动作，例如 review_task_created" />
        <el-button :loading="exporting" plain @click="exportLogs">导出 CSV</el-button>
      </div>

      <div class="summaryGrid">
        <div class="summaryCard">
          <span>当前日志数</span>
          <strong>{{ logs.length }}</strong>
        </div>
        <div class="summaryCard accent">
          <span>涉及场景</span>
          <strong>{{ uniqueSceneCount }}</strong>
        </div>
        <div class="summaryCard accent">
          <span>涉及动作</span>
          <strong>{{ uniqueActionCount }}</strong>
        </div>
      </div>

      <div v-if="logs.length" class="tableGrid">
        <div v-for="item in logs" :key="item.log_id" class="rowCard">
          <div class="rowHead">
            <div>
              <strong>{{ formatAction(item.action) }}</strong>
              <p>{{ item.action }}</p>
            </div>
            <div class="tagGroup">
              <span class="sceneTag">{{ formatScene(item.scene) }}</span>
              <span class="idTag">#{{ item.log_id }}</span>
            </div>
          </div>

          <div class="metaGrid">
            <div>发生时间：{{ item.created_at || "--" }}</div>
            <div>更新时间：{{ item.updated_at || "--" }}</div>
            <div>追踪号：{{ item.trace_id || "未记录" }}</div>
          </div>

          <div class="payloadBox">
            {{ formatPayloadSummary(item.payload) }}
          </div>

          <div class="actionRow">
            <el-button size="small" plain @click="openDetail(item)">查看详情</el-button>
            <router-link
              v-if="item.scene === 'content_review'"
              :to="{ path: '/main/ai-admin-review', query: { scene: item.scene } }"
            >
              回到审核任务
            </router-link>
            <router-link
              v-else-if="item.scene === 'system_config'"
              :to="{ path: '/main/ai-admin-configs', query: { action: item.action } }"
            >
              回到配置治理
            </router-link>
          </div>
        </div>
      </div>
      <div v-else class="emptyState">
        {{ errorMessage || "当前条件下没有日志记录，可更换场景或动作后继续查看。" }}
      </div>
    </section>

    <el-drawer
      v-model="detailVisible"
      title="日志详情"
      size="720px"
      destroy-on-close
    >
      <div v-if="detailData" class="detailWrap">
        <div class="detailHero">
          <div>
            <h3>{{ formatAction(detailData.action) }}</h3>
            <p>{{ detailData.action }}</p>
          </div>
          <div class="tagGroup">
            <span class="sceneTag">{{ formatScene(detailData.scene) }}</span>
            <span class="idTag">#{{ detailData.log_id }}</span>
          </div>
        </div>

        <div class="detailSection">
          <div class="detailGrid">
            <div class="detailCard">
              <span>发生时间</span>
              <strong>{{ detailData.created_at || "--" }}</strong>
            </div>
            <div class="detailCard">
              <span>更新时间</span>
              <strong>{{ detailData.updated_at || "--" }}</strong>
            </div>
            <div class="detailCard">
              <span>追踪号</span>
              <strong>{{ detailData.trace_id || "未记录" }}</strong>
            </div>
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
import { exportAiAuditLogs, listAiAuditLogs } from "@/api/ai";
import { useRoute } from "vue-router";

const loading = ref(false);
const exporting = ref(false);
const logs = ref([]);
const errorMessage = ref("");
const sceneFilter = ref("");
const actionFilter = ref("");
const route = useRoute();

const detailVisible = ref(false);
const detailData = ref(null);

const uniqueSceneCount = computed(() => new Set(logs.value.map((item) => item.scene).filter(Boolean)).size);
const uniqueActionCount = computed(() => new Set(logs.value.map((item) => item.action).filter(Boolean)).size);

const applyRouteFilters = () => {
  const query = route.query || {};
  sceneFilter.value = query.scene ? String(query.scene) : "";
  actionFilter.value = query.action ? String(query.action) : "";
};

const syncRouteSelection = () => {
  const logId = route.query.logId ? String(route.query.logId) : "";
  if (!logId) {
    return;
  }
  const matched = logs.value.find((item) => String(item.log_id) === logId);
  if (matched) {
    openDetail(matched);
  }
};

const loadLogs = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    const result = await listAiAuditLogs({
      scene: sceneFilter.value || undefined,
      action: actionFilter.value || undefined,
    });
    logs.value = result.items || [];
  } catch (error) {
    logs.value = [];
    errorMessage.value = error?.response?.data?.detail || error?.message || "日志加载失败";
  } finally {
    loading.value = false;
  }
  syncRouteSelection();
};

const exportLogs = async () => {
  exporting.value = true;
  try {
    const response = await exportAiAuditLogs({
      scene: sceneFilter.value || undefined,
      action: actionFilter.value || undefined,
    });
    const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audit-logs.csv";
    link.click();
    window.URL.revokeObjectURL(url);
    ElMessage.success("审计日志已导出");
  } catch (error) {
    ElMessage.error(error?.response?.data?.detail || error?.message || "日志导出失败");
  } finally {
    exporting.value = false;
  }
};

const openDetail = (item) => {
  detailData.value = item;
  detailVisible.value = true;
};

const formatScene = (value) => {
  const map = {
    content_review: "内容审核",
    admin_user: "用户管理",
    system_config: "系统配置",
  };
  return map[value] || value || "未知场景";
};

const formatAction = (value) => {
  const map = {
    review_task_created: "创建审核任务",
    review_task_approved: "单条通过",
    review_task_rejected: "单条驳回",
    review_task_batch_approved: "批量通过",
    review_task_batch_rejected: "批量驳回",
    admin_user_status_updated: "更新用户状态",
    system_config_updated: "更新系统配置",
  };
  return map[value] || value || "后台动作";
};

const formatPayloadSummary = (payload) => {
  if (!payload || !Object.keys(payload).length) {
    return "该条日志没有附加载荷。";
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
    await loadLogs();
  }
);

onMounted(async () => {
  applyRouteFilters();
  await loadLogs();
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

.badge {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.badge.purple {
  background: #ede9fe;
  color: #6d28d9;
}

.headActions {
  display: flex;
  gap: 12px;
  align-items: center;
}

h1 {
  margin-top: 14px;
  font-size: 36px;
  color: #12233b;
}

h3,
h4 {
  color: #12233b;
}

p {
  margin-top: 12px;
  color: #5f7186;
  line-height: 1.8;
}

.backButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 132px;
  height: 42px;
  padding: 0 18px;
  border-radius: 999px;
  background: #123b74;
  color: #fff;
  font-weight: 700;
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(260px, 1fr) auto;
  gap: 12px;
  margin-top: 24px;
}

.summaryGrid,
.detailGrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 22px;
}

.summaryCard,
.rowCard,
.detailCard {
  padding: 18px;
  border-radius: 20px;
  background: #f8fbff;
}

.summaryCard.accent {
  background: #f5f3ff;
}

.summaryCard span,
.detailCard span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.summaryCard strong,
.detailCard strong {
  display: block;
  margin-top: 10px;
  color: #12233b;
  font-size: 24px;
}

.tableGrid {
  display: grid;
  gap: 14px;
  margin-top: 22px;
}

.rowCard strong {
  color: #12233b;
  font-size: 18px;
}

.rowCard p {
  margin-top: 4px;
}

.tagGroup {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sceneTag,
.idTag {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.sceneTag {
  background: #ede9fe;
  color: #6d28d9;
}

.idTag {
  background: #e0f2fe;
  color: #0369a1;
}

.metaGrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
  color: #64748b;
  font-size: 13px;
}

.payloadBox,
.payloadPre {
  margin-top: 16px;
  padding: 16px;
  border-radius: 18px;
  background: #fff;
  color: #334155;
  line-height: 1.8;
}

.payloadPre {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: Consolas, Monaco, monospace;
}

.actionRow {
  margin-top: 18px;
  justify-content: flex-end;
}

.detailWrap {
  min-height: 240px;
}

.detailSection {
  margin-top: 22px;
}

.emptyState {
  margin-top: 22px;
  padding: 20px;
  border-radius: 20px;
  background: #f8fbff;
  color: #64748b;
}

@media (max-width: 1100px) {
  .pageHead,
  .headActions,
  .toolbar,
  .summaryGrid,
  .detailGrid,
  .metaGrid {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}
</style>
