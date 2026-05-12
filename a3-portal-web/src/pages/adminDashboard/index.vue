<template>
  <div class="adminPage">
    <section class="heroCard">
      <div>
        <div class="badge">管理总览</div>
        <h1>学习多智能体系统管理台</h1>
        <p>
          聚合内容审核、人工工单、智能体运行和系统配置四类关键治理信号，帮助后台快速判断当前优先级。
        </p>
      </div>
      <div class="heroActions">
        <router-link class="navButton" to="/main/ai-admin-tickets">进入工单处理</router-link>
        <router-link class="ghostButton" to="/main/ai-admin-configs">系统配置管理</router-link>
      </div>
    </section>

    <section class="gridStats">
      <div class="statCard">
        <span>待审核内容</span>
        <strong>{{ pendingReviews }}</strong>
        <p>需要人工确认后再放行的内容条目数。</p>
      </div>
      <div class="statCard">
        <span>处理中工单</span>
        <strong>{{ processingTickets }}</strong>
        <p>学生升级到人工支持且尚未完结的工单数。</p>
      </div>
      <div class="statCard">
        <span>智能体实例</span>
        <strong>{{ agentTotal }}</strong>
        <p>当前被监控的智能体运行实例总数。</p>
      </div>
      <div class="statCard">
        <span>系统配置项</span>
        <strong>{{ configTotal }}</strong>
        <p>已接入后台管理的系统参数数量。</p>
      </div>
    </section>

    <section class="contentGrid">
      <div class="card">
        <div class="cardHead">
          <h2>最近审计日志</h2>
          <router-link class="textLink" to="/main/ai-admin-logs">查看全部</router-link>
        </div>
        <div v-if="recentLogs.length" class="list">
          <router-link
            v-for="item in recentLogs"
            :key="item.log_id"
            class="listItem clickableItem"
            :to="{
              path: '/main/ai-admin-logs',
              query: {
                logId: item.log_id,
                scene: item.scene || undefined,
                action: item.action || undefined,
              },
            }"
          >
            <strong>{{ formatAction(item.action) }}</strong>
            <p>{{ formatScene(item.scene) }} · {{ formatPayload(item.payload) }}</p>
          </router-link>
        </div>
        <div v-else class="emptyState">当前暂无可展示的审计日志。</div>
      </div>

      <div class="card">
        <div class="cardHead">
          <h2>配置治理概览</h2>
          <router-link class="textLink" to="/main/ai-admin-configs">进入配置页</router-link>
        </div>
        <div class="quickStats">
          <div class="miniCard">
            <span>敏感配置</span>
            <strong>{{ sensitiveConfigCount }}</strong>
          </div>
          <div class="miniCard">
            <span>最近变更人</span>
            <strong>{{ latestConfigUpdater }}</strong>
          </div>
          <div class="miniCard">
            <span>最近变更时间</span>
            <strong>{{ latestConfigUpdatedAt }}</strong>
          </div>
        </div>
        <div v-if="recentConfigChanges.length" class="list">
          <router-link
            v-for="item in recentConfigChanges"
            :key="`${item.config_key}-${item.created_at}`"
            class="listItem clickableItem"
            :to="{
              path: '/main/ai-admin-configs',
              query: {
                configKey: item.config_key || undefined,
                historyKey: item.config_key || undefined,
              },
            }"
          >
            <strong>{{ item.config_key }}</strong>
            <p>{{ formatOperatorName(item.updated_by) }} · {{ item.created_at || "--" }}</p>
          </router-link>
        </div>
        <div v-else class="emptyState">当前暂无系统配置变更记录。</div>
      </div>
    </section>

    <section class="quickSection">
      <div class="card">
        <div class="cardHead">
          <h2>快捷入口</h2>
          <router-link class="textLink" to="/main/ai-admin-review">优先处理审核</router-link>
        </div>
        <div class="quickGrid">
          <router-link v-for="item in quickLinks" :key="item.path" :to="item.path" class="quickCard">
            <strong>{{ item.title }}</strong>
            <p>{{ item.desc }}</p>
          </router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  listAiAgentStatus,
  listAiAuditLogs,
  listAiChatTickets,
  listAiReviewTasks,
  listAiSystemConfigHistory,
  listAiSystemConfigs,
} from "@/api/ai";

const ADMIN_DATA_UPDATED_EVENT = "a3-admin-data-updated";

const pendingReviews = ref(0);
const processingTickets = ref(0);
const agentTotal = ref(0);
const configTotal = ref(0);
const recentLogs = ref([]);
const recentConfigChanges = ref([]);
const configs = ref([]);

const quickLinks = [
  {
    title: "人工工单",
    desc: "查看学生升级的人工支持工单，回复并推进状态。",
    path: "/main/ai-admin-tickets",
  },
  {
    title: "用户画像概览",
    desc: "聚合学习进度、风险等级和工单情况，快速定位重点学生。",
    path: "/main/ai-admin-users",
  },
  {
    title: "内容审核",
    desc: "处理待人工确认的资源、评测或生成内容。",
    path: "/main/ai-admin-review",
  },
  {
    title: "智能体监控",
    desc: "查看智能体状态与运行日志，识别异常波动。",
    path: "/main/ai-admin-agents",
  },
  {
    title: "审计日志",
    desc: "回溯配置变更、审批动作和运行事件。",
    path: "/main/ai-admin-logs",
  },
  {
    title: "系统配置",
    desc: "查看配置项、执行更新并回溯关键参数变更历史。",
    path: "/main/ai-admin-configs",
  },
];

const sensitiveConfigCount = computed(() => configs.value.filter((item) => item.is_sensitive).length);
const latestConfigUpdater = computed(() => formatOperatorName(recentConfigChanges.value[0]?.updated_by));
const latestConfigUpdatedAt = computed(() => recentConfigChanges.value[0]?.created_at || "--");

const formatOperatorName = (value) => {
  if (!value) {
    return "--";
  }
  if (["admin-demo", "A3 Admin", "运营管理员"].includes(value)) {
    return "运营管理员";
  }
  return value;
};

const sceneLabelMap = {
  content_review: "内容审核",
  system_config: "系统配置",
  admin_user: "用户管理",
};

const actionLabelMap = {
  review_task_created: "创建审核任务",
  review_task_approved: "审核通过",
  review_task_rejected: "审核驳回",
  review_task_batch_approved: "批量审核通过",
  review_task_batch_rejected: "批量审核驳回",
  system_config_updated: "更新系统配置",
  admin_user_status_updated: "更新用户状态",
};

const formatScene = (scene) => sceneLabelMap[scene] || scene || "未命名场景";
const formatAction = (action) => actionLabelMap[action] || action || "未命名动作";

const formatPayload = (payload) => {
  if (!payload || !Object.keys(payload).length) {
    return "无附加载荷";
  }
  return Object.entries(payload)
    .filter(([key]) => key !== "description")
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`)
    .join(" | ");
};

const loadDashboard = async () => {
  const requests = await Promise.allSettled([
    listAiReviewTasks({ status: "pending" }),
    listAiChatTickets({ status: "processing" }),
    listAiAuditLogs(),
    listAiAgentStatus(),
    listAiSystemConfigs(),
    listAiSystemConfigHistory(),
  ]);

  const reviewResult = requests[0].status === "fulfilled" ? requests[0].value : {};
  const ticketResult = requests[1].status === "fulfilled" ? requests[1].value : {};
  const logResult = requests[2].status === "fulfilled" ? requests[2].value : {};
  const agentResult = requests[3].status === "fulfilled" ? requests[3].value : {};
  const configResult = requests[4].status === "fulfilled" ? requests[4].value : {};
  const configHistoryResult = requests[5].status === "fulfilled" ? requests[5].value : {};
  const firstError = requests.find((item) => item.status === "rejected");

  pendingReviews.value = reviewResult.total || 0;
  processingTickets.value = ticketResult.total || 0;
  agentTotal.value = agentResult.total || 0;
  configTotal.value = configResult.total || 0;
  configs.value = configResult.items || [];
  recentLogs.value = (logResult.items || []).slice(0, 4);
  recentConfigChanges.value = (configHistoryResult.items || []).slice(0, 3);

  if (firstError) {
    ElMessage.warning(firstError.reason?.response?.data?.detail || firstError.reason?.message || "部分管理数据加载失败");
  }
};

const handleAdminDataUpdated = () => {
  loadDashboard();
};

onMounted(() => {
  loadDashboard();
  window.addEventListener(ADMIN_DATA_UPDATED_EVENT, handleAdminDataUpdated);
});

onBeforeUnmount(() => {
  window.removeEventListener(ADMIN_DATA_UPDATED_EVENT, handleAdminDataUpdated);
});
</script>

<style scoped lang="scss">
.adminPage {
  min-height: 100vh;
  padding: 32px 24px 48px;
  background: linear-gradient(180deg, #0f172a 0%, #16253f 18%, #eef4fb 18%, #f8fbff 100%);
}

.heroCard,
.card,
.statCard {
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
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

.heroActions,
.cardHead {
  display: flex;
  gap: 12px;
  align-items: center;
}

.badge {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
}

h1 {
  margin-top: 14px;
  font-size: 38px;
  color: #12233b;
}

h2 {
  color: #12233b;
  font-size: 24px;
}

p {
  margin-top: 12px;
  line-height: 1.8;
  color: #5f7186;
}

.navButton,
.ghostButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 164px;
  height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  font-weight: 700;
}

.navButton {
  background: #123b74;
  color: #fff;
}

.ghostButton {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #123b74;
}

.textLink {
  color: #2563eb;
  font-size: 14px;
  font-weight: 600;
}

.gridStats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  max-width: 1180px;
  margin: 0 auto 24px;
}

.statCard {
  padding: 20px;
}

.statCard span,
.miniCard span {
  display: block;
  color: #6c7e95;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.statCard strong,
.miniCard strong {
  display: block;
  margin-top: 12px;
  font-size: 30px;
  color: #0f2036;
}

.contentGrid,
.quickSection {
  max-width: 1180px;
  margin: 0 auto;
}

.contentGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.quickSection {
  margin-top: 24px;
}

.card {
  padding: 26px;
}

.list,
.quickGrid,
.quickStats {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.quickGrid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.quickStats {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.listItem,
.quickCard,
.emptyState,
.miniCard {
  padding: 16px 18px;
  border-radius: 18px;
  background: #f7fafc;
}

.listItem strong,
.quickCard strong {
  color: #12233b;
  font-size: 18px;
}

.quickCard {
  display: block;
}

.clickableItem {
  display: block;
  color: inherit;
  text-decoration: none;
}

.clickableItem:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.06);
}

@media (max-width: 1100px) {
  .gridStats,
  .contentGrid,
  .quickGrid,
  .quickStats {
    grid-template-columns: 1fr;
  }

  .heroCard,
  .heroActions,
  .cardHead {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
