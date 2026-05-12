<template>
  <div class="adminSimplePage">
    <section class="pageCard">
      <div class="pageHead">
        <div>
          <div class="badge">用户管理</div>
          <h1>学生运行概览</h1>
          <p>
            汇总学习画像、计划进度、最近评测和人工工单信息，帮助后台快速筛出高风险或需要重点跟进的学生。
          </p>
        </div>
        <el-button class="refreshButton" :loading="loading" @click="loadUsers">刷新数据</el-button>
      </div>

      <div class="toolbar">
        <el-input v-model="keyword" placeholder="搜索用户 ID 或课程编码" clearable />
        <el-select v-model="riskFilter" placeholder="筛选风险等级" clearable>
          <el-option label="高风险" value="high" />
          <el-option label="中风险" value="medium" />
          <el-option label="正常" value="normal" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="筛选账号状态" clearable>
          <el-option label="正常" value="active" />
          <el-option label="暂停" value="suspended" />
          <el-option label="停用" value="disabled" />
        </el-select>
      </div>

      <div class="summaryGrid">
        <div class="summaryCard">
          <span>学生记录数</span>
          <strong>{{ filteredUsers.length }}</strong>
        </div>
        <div class="summaryCard">
          <span>高风险学生</span>
          <strong>{{ highRiskCount }}</strong>
        </div>
        <div class="summaryCard">
          <span>开放工单数</span>
          <strong>{{ openTicketCount }}</strong>
        </div>
        <div class="summaryCard">
          <span>非活跃账号</span>
          <strong>{{ inactiveCount }}</strong>
        </div>
      </div>

      <div v-if="filteredUsers.length" class="tableGrid">
        <div v-for="item in filteredUsers" :key="`${item.user_id}-${item.course_code}`" class="rowCard">
          <div class="rowTop">
            <div>
              <strong>学生 #{{ item.user_id }}</strong>
              <p class="courseText">{{ item.course_code || "未绑定课程" }}</p>
            </div>
            <div class="tagGroup">
              <span :class="['statusTag', item.risk_level]">{{ formatRisk(item.risk_level) }}</span>
              <span :class="['userTag', item.user_status]">{{ formatUserStatus(item.user_status) }}</span>
            </div>
          </div>

          <div class="metricRow">
            <div class="metricItem">
              <span>画像版本</span>
              <strong>{{ item.profile_version || "--" }}</strong>
            </div>
            <div class="metricItem">
              <span>计划完成率</span>
              <strong>{{ formatPercent(item.completion_rate) }}</strong>
            </div>
            <div class="metricItem">
              <span>最近得分</span>
              <strong>{{ formatScore(item.latest_score) }}</strong>
            </div>
            <div class="metricItem">
              <span>开放工单</span>
              <strong>{{ item.open_ticket_count || 0 }}</strong>
            </div>
          </div>

          <div class="descList">
            <div>掌握水平：{{ item.mastery_level || "暂无" }}</div>
            <div>
              最新学习计划：{{ item.latest_plan_id ? `#${item.latest_plan_id}` : "暂无" }} /
              {{ item.latest_plan_status || "未开始" }}
            </div>
            <div>最近活跃时间：{{ item.last_activity_at || "暂无记录" }}</div>
            <div v-if="item.status_reason">状态说明：{{ item.status_reason }}</div>
          </div>

          <div class="actionRow">
            <el-button size="small" plain @click="openDetail(item)">查看详情</el-button>
            <router-link
              :to="{
                path: '/main/ai-admin-tickets',
                query: {
                  userId: item.user_id,
                  ticketStatus: item.open_ticket_count ? 'processing' : undefined,
                },
              }"
            >
              查看工单
            </router-link>
          </div>
        </div>
      </div>
      <div v-else class="emptyState">
        {{ errorMessage || "没有匹配的学生记录。" }}
      </div>
    </section>

    <el-drawer
      v-model="detailVisible"
      title="学生详情"
      size="720px"
      destroy-on-close
      :with-header="true"
    >
      <div v-loading="detailLoading" class="detailWrap">
        <template v-if="detailData">
          <div class="detailHero">
            <div>
              <h3>学生 #{{ detailData.user_id }}</h3>
              <p>{{ detailData.course_code || "未绑定课程" }}</p>
            </div>
            <div class="tagGroup">
              <span :class="['statusTag', detailData.risk_level]">{{ formatRisk(detailData.risk_level) }}</span>
              <span :class="['userTag', detailData.user_status]">{{ formatUserStatus(detailData.user_status) }}</span>
            </div>
          </div>

          <div class="detailGrid">
            <div class="detailCard">
              <span>计划完成率</span>
              <strong>{{ formatPercent(detailData.completion_rate) }}</strong>
            </div>
            <div class="detailCard">
              <span>最近得分</span>
              <strong>{{ formatScore(detailData.latest_score) }}</strong>
            </div>
            <div class="detailCard">
              <span>开放工单</span>
              <strong>{{ detailData.open_ticket_count || 0 }}</strong>
            </div>
            <div class="detailCard">
              <span>最近活跃</span>
              <strong>{{ detailData.last_activity_at || "--" }}</strong>
            </div>
          </div>

          <div class="detailSection">
            <div class="sectionHead">
              <h4>账号状态</h4>
            </div>
            <div class="statusPanel">
              <el-select v-model="statusForm.status" placeholder="选择状态">
                <el-option label="正常" value="active" />
                <el-option label="暂停" value="suspended" />
                <el-option label="停用" value="disabled" />
              </el-select>
              <el-input v-model="statusForm.reason" placeholder="填写状态说明，便于后台追踪" clearable />
              <el-button type="primary" :loading="statusSubmitting" @click="submitStatus">更新状态</el-button>
            </div>
            <div class="metaText">
              最近更新：{{ formatOperatorName(detailData.status_updated_by) || "系统默认" }} / {{ detailData.status_updated_at || "--" }}
            </div>
          </div>

          <div class="detailSection">
            <div class="sectionHead">
              <h4>计划进度</h4>
            </div>
            <div v-if="detailData.progress_items?.length" class="timelineList">
              <div v-for="item in detailData.progress_items" :key="item.step_id" class="timelineCard">
                <strong>{{ item.title }}</strong>
                <p>状态：{{ item.status }}</p>
                <em>{{ item.updated_at || item.completed_at || item.started_at || "--" }}</em>
              </div>
            </div>
            <div v-else class="emptyInline">暂无计划进度记录。</div>
          </div>

          <div class="detailSection">
            <div class="sectionHead">
              <h4>关联工单</h4>
            </div>
            <div v-if="detailData.tickets?.length" class="timelineList">
              <div v-for="item in detailData.tickets" :key="item.ticket_id" class="timelineCard">
                <strong>工单 #{{ item.ticket_id }}</strong>
                <p>状态：{{ item.status }}</p>
                <p>{{ item.question }}</p>
                <em>{{ item.updated_at || "--" }}</em>
                <router-link :to="{ path: '/main/ai-admin-tickets', query: { ticketId: item.ticket_id, userId: detailData.user_id } }">
                  进入工单处理
                </router-link>
              </div>
            </div>
            <div v-else class="emptyInline">暂无关联工单。</div>
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { getAiAdminUserDetail, listAiAdminUsers, updateAiAdminUserStatus } from "@/api/ai";
import { useRoute } from "vue-router";

const loading = ref(false);
const errorMessage = ref("");
const users = ref([]);
const keyword = ref("");
const riskFilter = ref("");
const statusFilter = ref("");
const route = useRoute();

const detailVisible = ref(false);
const detailLoading = ref(false);
const detailData = ref(null);
const statusSubmitting = ref(false);
const statusForm = reactive({
  status: "active",
  reason: "",
});

const filteredUsers = computed(() => {
  return users.value.filter((item) => {
    const matchesKeyword =
      !keyword.value ||
      String(item.user_id).includes(keyword.value) ||
      (item.course_code || "").toLowerCase().includes(keyword.value.toLowerCase());
    const matchesRisk = !riskFilter.value || item.risk_level === riskFilter.value;
    const matchesStatus = !statusFilter.value || item.user_status === statusFilter.value;
    return matchesKeyword && matchesRisk && matchesStatus;
  });
});

const highRiskCount = computed(() => filteredUsers.value.filter((item) => item.risk_level === "high").length);
const openTicketCount = computed(() =>
  filteredUsers.value.reduce((sum, item) => sum + (item.open_ticket_count || 0), 0)
);
const inactiveCount = computed(() => filteredUsers.value.filter((item) => item.user_status !== "active").length);

const applyRouteFilters = () => {
  const query = route.query || {};
  keyword.value = query.keyword ? String(query.keyword) : query.userId ? String(query.userId) : "";
  riskFilter.value = query.risk ? String(query.risk) : "";
  statusFilter.value = query.status ? String(query.status) : "";
};

const syncRouteSelection = async () => {
  const queryUserId = route.query.userId ? String(route.query.userId) : "";
  if (!queryUserId || !users.value.length) {
    return;
  }
  const matchedUser = users.value.find((item) => String(item.user_id) === queryUserId);
  if (matchedUser && detailData.value?.user_id !== matchedUser.user_id) {
    await openDetail(matchedUser);
  }
};

const loadUsers = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    const result = await listAiAdminUsers();
    users.value = result.items || [];
  } catch (error) {
    users.value = [];
    errorMessage.value = error?.response?.data?.detail || error?.message || "学生概览加载失败";
  } finally {
    loading.value = false;
  }
  await syncRouteSelection();
};

const openDetail = async (item) => {
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    const result = await getAiAdminUserDetail(item.user_id);
    detailData.value = result;
    statusForm.status = result.user_status || "active";
    statusForm.reason = result.status_reason || "";
  } catch (error) {
    detailData.value = null;
    ElMessage.error(error?.response?.data?.detail || error?.message || "学生详情加载失败");
  } finally {
    detailLoading.value = false;
  }
};

const submitStatus = async () => {
  if (!detailData.value) {
    return;
  }
  statusSubmitting.value = true;
  try {
    await updateAiAdminUserStatus(detailData.value.user_id, {
      status: statusForm.status,
      updated_by: "运营管理员",
      reason: statusForm.reason || undefined,
    });
    ElMessage.success("账号状态已更新");
    await Promise.all([openDetail(detailData.value), loadUsers()]);
  } catch (error) {
    ElMessage.error(error?.response?.data?.detail || error?.message || "状态更新失败");
  } finally {
    statusSubmitting.value = false;
  }
};

const formatRisk = (riskLevel) => {
  const map = {
    high: "高风险",
    medium: "中风险",
    normal: "正常",
  };
  return map[riskLevel] || riskLevel || "正常";
};

const formatUserStatus = (status) => {
  const map = {
    active: "正常",
    suspended: "暂停",
    disabled: "停用",
  };
  return map[status] || status || "正常";
};

const formatOperatorName = (value) => {
  if (!value) {
    return "";
  }
  if (["admin-demo", "A3 Admin", "运营管理员"].includes(value)) {
    return "运营管理员";
  }
  return value;
};

const formatPercent = (value) => `${Number(value || 0).toFixed(0)}%`;
const formatScore = (value) => (typeof value === "number" ? `${value.toFixed(1)} 分` : "--");

watch(
  () => route.query,
  async () => {
    applyRouteFilters();
    if (users.value.length) {
      await syncRouteSelection();
    }
  }
);

onMounted(async () => {
  applyRouteFilters();
  await loadUsers();
});
</script>

<style scoped lang="scss">
.adminSimplePage {
  min-height: 100vh;
  padding: 32px 24px 48px;
  background: linear-gradient(180deg, #eef4fb 0%, #f8fbff 100%);
}

.pageCard {
  max-width: 1180px;
  margin: 0 auto;
  padding: 28px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.1);
}

.pageHead,
.rowTop,
.actionRow,
.detailHero,
.sectionHead,
.statusPanel {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
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

.refreshButton {
  min-width: 140px;
  height: 42px;
  border-radius: 999px;
}

.toolbar {
  display: grid;
  grid-template-columns: 1fr 220px 220px;
  gap: 12px;
  margin-top: 22px;
}

.summaryGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 22px;
}

.summaryCard,
.rowCard,
.detailCard,
.timelineCard {
  padding: 18px;
  border-radius: 20px;
  background: #f8fbff;
}

.summaryCard span,
.metricItem span,
.detailCard span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.summaryCard strong,
.metricItem strong,
.detailCard strong {
  display: block;
  margin-top: 10px;
  color: #12233b;
  font-size: 24px;
}

.tableGrid,
.timelineList {
  display: grid;
  gap: 14px;
  margin-top: 22px;
}

.courseText,
.metaText {
  margin-top: 6px;
}

.tagGroup {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.statusTag,
.userTag {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.statusTag.normal,
.userTag.active {
  background: #dcfce7;
  color: #15803d;
}

.statusTag.medium,
.userTag.suspended {
  background: #fff7ed;
  color: #c2410c;
}

.statusTag.high,
.userTag.disabled {
  background: #fff1f2;
  color: #be123c;
}

.metricRow {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-top: 18px;
  flex-wrap: wrap;
}

.metricItem {
  min-width: 120px;
}

.descList {
  display: grid;
  gap: 8px;
  margin-top: 18px;
  color: #475569;
}

.actionRow {
  margin-top: 18px;
  justify-content: flex-end;
}

.emptyState,
.emptyInline {
  margin-top: 22px;
  padding: 20px;
  border-radius: 20px;
  background: #f8fbff;
  color: #64748b;
}

.detailWrap {
  min-height: 200px;
}

.detailGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.detailSection {
  margin-top: 22px;
}

.statusPanel {
  margin-top: 12px;
}

.statusPanel :deep(.el-select) {
  width: 140px;
}

.statusPanel :deep(.el-input) {
  flex: 1;
}

.timelineCard p {
  margin-top: 8px;
}

.timelineCard em {
  display: block;
  margin-top: 10px;
  color: #94a3b8;
  font-size: 12px;
}

@media (max-width: 1100px) {
  .pageHead,
  .toolbar,
  .summaryGrid,
  .detailGrid,
  .statusPanel {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}
</style>
