<template>
  <div class="adminSimplePage">
    <section class="pageCard">
      <div class="pageHead">
        <div>
          <div class="badge warning">人工工单</div>
          <h1>人工工单处理中心</h1>
          <p>查看学生升级的人工支持工单，按状态筛选、查看详情、回复处理意见并推动工单流转。</p>
        </div>
        <router-link class="backButton" to="/main/ai-admin">返回管理台</router-link>
      </div>

      <div class="toolbar">
        <el-input v-model="keyword" placeholder="搜索工单标题、课程或用户 ID" clearable />
        <el-select v-model="statusFilter" placeholder="筛选工单状态" clearable>
          <el-option label="待处理" value="open" />
          <el-option label="处理中" value="processing" />
          <el-option label="已解决" value="resolved" />
          <el-option label="已关闭" value="closed" />
        </el-select>
        <el-button :loading="loading" @click="loadTickets">刷新列表</el-button>
      </div>

      <div class="summaryGrid">
        <div class="summaryCard">
          <span>工单总数</span>
          <strong>{{ filteredTickets.length }}</strong>
        </div>
        <div class="summaryCard">
          <span>待处理</span>
          <strong>{{ countByStatus('open') }}</strong>
        </div>
        <div class="summaryCard">
          <span>处理中</span>
          <strong>{{ countByStatus('processing') }}</strong>
        </div>
        <div class="summaryCard">
          <span>已完结</span>
          <strong>{{ countByStatus('resolved') + countByStatus('closed') }}</strong>
        </div>
      </div>

      <div class="contentGrid">
        <div class="ticketList">
          <div v-if="filteredTickets.length" class="listGrid">
            <button
              v-for="item in filteredTickets"
              :key="item.ticket_id"
              type="button"
              class="ticketCard"
              :class="{ active: activeTicket?.ticket_id === item.ticket_id }"
              @click="selectTicket(item)"
            >
              <div class="ticketTop">
                <strong>#{{ item.ticket_id }} {{ item.title }}</strong>
                <span :class="['statusTag', item.status]">{{ statusTextMap[item.status] || item.status }}</span>
              </div>
              <p>{{ item.question_summary }}</p>
              <div class="ticketMeta">
                <em>用户 {{ item.user_id }}</em>
                <em>{{ item.course_code || "未绑定课程" }}</em>
                <em>优先级 {{ formatPriority(item.priority) }}</em>
              </div>
            </button>
          </div>
          <div v-else class="emptyState">{{ errorMessage || "当前没有匹配的工单。" }}</div>
        </div>

        <div class="detailCard">
          <template v-if="activeTicket">
            <div class="detailHead">
              <div>
                <h2>#{{ activeTicket.ticket_id }} {{ activeTicket.title }}</h2>
                <p>用户 {{ activeTicket.user_id }} · {{ activeTicket.course_code || "未绑定课程" }}</p>
              </div>
              <el-select v-model="nextStatus" placeholder="更新状态" class="statusSelect">
                <el-option label="待处理" value="open" />
                <el-option label="处理中" value="processing" />
                <el-option label="已解决" value="resolved" />
                <el-option label="已关闭" value="closed" />
              </el-select>
            </div>

            <div class="questionBlock">
              <div class="blockTitle">问题摘要</div>
              <div class="panel">{{ activeTicket.question_summary }}</div>
            </div>

            <div class="questionBlock">
              <div class="blockTitle">最近 AI 回答</div>
              <div class="panel">{{ activeTicket.latest_answer || "暂无 AI 回答记录" }}</div>
            </div>

            <div class="questionBlock">
              <div class="blockTitle">处理回复</div>
              <div v-if="activeTicket.replies?.length" class="replyList">
                <div v-for="reply in activeTicket.replies" :key="reply.reply_id" class="replyCard">
                  <strong>{{ formatOperatorName(reply.replier_name) }} · {{ reply.replier_role }}</strong>
                  <p>{{ reply.content }}</p>
                  <em>{{ reply.created_at || "--" }}</em>
                </div>
              </div>
              <div v-else class="emptyInline">暂无人工回复记录。</div>
            </div>

            <div class="editorBlock">
              <el-input
                v-model="replyContent"
                type="textarea"
                :rows="5"
                maxlength="500"
                show-word-limit
                placeholder="输入处理意见、补充说明或给学生的回复"
              />
              <div class="actionRow">
                <el-button :loading="replySubmitting" type="primary" @click="submitReply">发送回复</el-button>
                <el-button :loading="statusSubmitting" plain @click="submitStatus">更新状态</el-button>
                <router-link :to="{ path: '/main/ai-admin-users', query: { userId: activeTicket.user_id } }">
                  查看学生画像
                </router-link>
              </div>
            </div>
          </template>
          <div v-else class="emptyState">请选择左侧工单查看详情。</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  getAiChatTicket,
  listAiChatTickets,
  replyAiChatTicket,
  updateAiChatTicketStatus,
} from "@/api/ai";
import { useRoute } from "vue-router";

const loading = ref(false);
const replySubmitting = ref(false);
const statusSubmitting = ref(false);
const tickets = ref([]);
const activeTicket = ref(null);
const errorMessage = ref("");
const keyword = ref("");
const statusFilter = ref("");
const replyContent = ref("");
const nextStatus = ref("processing");
const route = useRoute();

const statusTextMap = {
  open: "待处理",
  processing: "处理中",
  resolved: "已解决",
  closed: "已关闭",
};

const formatOperatorName = (value) => {
  if (!value) {
    return "未记录";
  }
  if (["admin-demo", "A3 Admin", "运营管理员"].includes(value)) {
    return "运营管理员";
  }
  return value;
};

const filteredTickets = computed(() => {
  return tickets.value.filter((item) => {
    const lowerKeyword = keyword.value.toLowerCase();
    const matchesKeyword =
      !keyword.value ||
      String(item.ticket_id).includes(keyword.value) ||
      String(item.user_id).includes(keyword.value) ||
      (item.title || "").toLowerCase().includes(lowerKeyword) ||
      (item.course_code || "").toLowerCase().includes(lowerKeyword);
    const matchesStatus = !statusFilter.value || item.status === statusFilter.value;
    return matchesKeyword && matchesStatus;
  });
});

const applyRouteFilters = () => {
  const query = route.query || {};
  keyword.value = query.keyword ? String(query.keyword) : query.userId ? String(query.userId) : "";
  statusFilter.value = query.ticketStatus ? String(query.ticketStatus) : query.status ? String(query.status) : "";
};

const syncRouteSelection = async () => {
  const ticketId = route.query.ticketId ? String(route.query.ticketId) : "";
  if (!ticketId || !filteredTickets.value.length) {
    return;
  }
  const matched = filteredTickets.value.find((item) => String(item.ticket_id) === ticketId);
  if (matched && activeTicket.value?.ticket_id !== matched.ticket_id) {
    await selectTicket(matched);
  }
};

const countByStatus = (status) => filteredTickets.value.filter((item) => item.status === status).length;

const formatPriority = (priority) => {
  const map = {
    high: "高",
    normal: "中",
    low: "低",
  };
  return map[priority] || priority || "中";
};

const selectTicket = async (item) => {
  try {
    const detail = await getAiChatTicket(item.ticket_id);
    activeTicket.value = detail;
    nextStatus.value = detail.status || "processing";
    replyContent.value = "";
  } catch (error) {
    ElMessage.error("工单详情加载失败");
  }
};

const loadTickets = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    const result = await listAiChatTickets({
      status: statusFilter.value || undefined,
    });
    tickets.value = result.items || [];

    const stillExists =
      activeTicket.value && tickets.value.some((item) => item.ticket_id === activeTicket.value.ticket_id);
    if (stillExists) {
      await selectTicket(tickets.value.find((item) => item.ticket_id === activeTicket.value.ticket_id));
    } else if (tickets.value.length) {
      await selectTicket(tickets.value[0]);
    } else {
      activeTicket.value = null;
    }
  } catch (error) {
    tickets.value = [];
    activeTicket.value = null;
    errorMessage.value = error?.response?.data?.detail || error?.message || "工单列表加载失败";
    ElMessage.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
  await syncRouteSelection();
};

const submitReply = async () => {
  if (!activeTicket.value || !replyContent.value.trim()) {
    ElMessage.warning("请先输入回复内容");
    return;
  }

  replySubmitting.value = true;
  try {
    await replyAiChatTicket(activeTicket.value.ticket_id, {
      replier_name: "运营管理员",
      replier_role: "staff",
      content: replyContent.value.trim(),
    });
    ElMessage.success("工单回复已发送");
    await loadTickets();
  } catch (error) {
    ElMessage.error(error?.response?.data?.detail || error?.message || "发送回复失败");
  } finally {
    replySubmitting.value = false;
  }
};

const submitStatus = async () => {
  if (!activeTicket.value) {
    return;
  }

  statusSubmitting.value = true;
  try {
    await updateAiChatTicketStatus(activeTicket.value.ticket_id, {
      status: nextStatus.value,
    });
    ElMessage.success("工单状态已更新");
    await loadTickets();
  } catch (error) {
    ElMessage.error(error?.response?.data?.detail || error?.message || "更新状态失败");
  } finally {
    statusSubmitting.value = false;
  }
};

watch(
  () => route.query,
  async () => {
    applyRouteFilters();
    await loadTickets();
  }
);

onMounted(async () => {
  applyRouteFilters();
  await loadTickets();
});
</script>

<style scoped lang="scss">
.adminSimplePage {
  min-height: 100vh;
  padding: 32px 24px 48px;
  background: linear-gradient(180deg, #eef4fb 0%, #f8fbff 100%);
}

.pageCard {
  max-width: 1280px;
  margin: 0 auto;
  padding: 28px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.1);
}

.pageHead {
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

.badge.warning {
  background: #fef3c7;
  color: #b45309;
}

h1 {
  margin-top: 14px;
  font-size: 36px;
  color: #12233b;
}

h2 {
  font-size: 24px;
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
  grid-template-columns: 1fr 220px auto;
  gap: 12px;
  margin-top: 24px;
}

.summaryGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 22px;
}

.summaryCard,
.detailCard,
.ticketCard {
  border-radius: 20px;
  background: #f8fbff;
}

.summaryCard {
  padding: 18px;
}

.summaryCard span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.summaryCard strong {
  display: block;
  margin-top: 10px;
  color: #12233b;
  font-size: 24px;
}

.contentGrid {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 18px;
  margin-top: 22px;
}

.listGrid {
  display: grid;
  gap: 12px;
}

.ticketCard {
  width: 100%;
  padding: 16px;
  border: 1px solid transparent;
  text-align: left;
  cursor: pointer;
}

.ticketCard.active {
  border-color: #60a5fa;
  box-shadow: 0 12px 30px rgba(59, 130, 246, 0.12);
}

.ticketTop,
.detailHead,
.actionRow {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.ticketTop strong {
  color: #12233b;
}

.statusTag {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.statusTag.open {
  background: #fee2e2;
  color: #b91c1c;
}

.statusTag.processing {
  background: #dbeafe;
  color: #1d4ed8;
}

.statusTag.resolved {
  background: #dcfce7;
  color: #15803d;
}

.statusTag.closed {
  background: #e2e8f0;
  color: #475569;
}

.ticketMeta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
  color: #64748b;
  font-size: 12px;
}

.detailCard {
  padding: 20px;
}

.statusSelect {
  width: 160px;
}

.questionBlock,
.editorBlock {
  margin-top: 20px;
}

.blockTitle {
  color: #12233b;
  font-size: 16px;
  font-weight: 700;
}

.panel,
.replyCard,
.emptyInline {
  margin-top: 10px;
  padding: 14px;
  border-radius: 16px;
  background: #fff;
  color: #475569;
}

.replyList {
  display: grid;
  gap: 10px;
}

.replyCard strong {
  color: #12233b;
}

.replyCard em {
  display: block;
  margin-top: 10px;
  color: #94a3b8;
  font-size: 12px;
}

.actionRow {
  margin-top: 14px;
  justify-content: flex-end;
}

.emptyState {
  padding: 20px;
  border-radius: 20px;
  background: #f8fbff;
  color: #64748b;
}

@media (max-width: 1180px) {
  .toolbar,
  .summaryGrid,
  .contentGrid {
    grid-template-columns: 1fr;
  }

  .pageHead,
  .detailHead,
  .actionRow {
    flex-direction: column;
  }

  .statusSelect {
    width: 100%;
  }
}
</style>
