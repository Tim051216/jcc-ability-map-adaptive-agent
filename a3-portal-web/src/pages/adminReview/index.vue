<template>
  <div class="adminSimplePage">
    <section class="pageCard">
      <div class="pageHead">
        <div>
          <div class="badge danger">内容审核</div>
          <h1>内容审核工作台</h1>
          <p>
            统一查看 AI 生成内容的待审任务、处理优先级、审核结论与历史轨迹，方便演示平台治理能力和人工复核闭环。
          </p>
        </div>
        <div class="headActions">
          <router-link class="backButton" to="/main/ai-admin">返回管理总览</router-link>
          <el-button class="refreshButton" :loading="loading" @click="loadReviews">刷新任务</el-button>
        </div>
      </div>

      <div class="toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索内容、场景或审核人" />
        <el-select v-model="statusFilter" clearable placeholder="筛选审核状态">
          <el-option label="待审核" value="pending" />
          <el-option label="已通过" value="approved" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
        <el-select v-model="priorityFilter" clearable placeholder="筛选优先级">
          <el-option label="高优先级" value="high" />
          <el-option label="普通优先级" value="normal" />
          <el-option label="低优先级" value="low" />
        </el-select>
        <el-select v-model="sceneFilter" clearable placeholder="筛选来源场景">
          <el-option
            v-for="scene in sceneOptions"
            :key="scene"
            :label="formatScene(scene)"
            :value="scene"
          />
        </el-select>
      </div>

      <div class="summaryGrid">
        <div class="summaryCard">
          <span>当前任务数</span>
          <strong>{{ filteredReviews.length }}</strong>
        </div>
        <div class="summaryCard warning">
          <span>待审核</span>
          <strong>{{ pendingCount }}</strong>
        </div>
        <div class="summaryCard success">
          <span>已通过</span>
          <strong>{{ approvedCount }}</strong>
        </div>
        <div class="summaryCard danger">
          <span>已驳回</span>
          <strong>{{ rejectedCount }}</strong>
        </div>
      </div>

      <div class="batchBar">
        <div class="selectionInfo">
          <el-checkbox
            :model-value="allPendingSelected"
            :indeterminate="pendingSelectionIndeterminate"
            @change="toggleSelectAllPending"
          >
            选中全部待审核任务
          </el-checkbox>
          <span>已选 {{ selectedPendingIds.length }} 项待处理任务</span>
        </div>
        <div class="batchActions">
          <el-input
            v-model="batchNote"
            clearable
            placeholder="批量处理备注，可选"
          />
          <el-button
            type="success"
            :disabled="!selectedPendingIds.length"
            :loading="batchSubmitting"
            @click="submitBatchDecision('approved')"
          >
            批量通过
          </el-button>
          <el-button
            type="danger"
            plain
            :disabled="!selectedPendingIds.length"
            :loading="batchSubmitting"
            @click="submitBatchDecision('rejected')"
          >
            批量驳回
          </el-button>
        </div>
      </div>

      <div v-if="filteredReviews.length" class="tableGrid">
        <div
          v-for="item in filteredReviews"
          :key="item.review_id"
          class="rowCard"
          :class="[`status-${item.status}`, `priority-${item.priority}`]"
        >
          <div class="rowTop">
            <div class="rowTitle">
              <el-checkbox
                v-if="item.status === 'pending'"
                :model-value="selectedReviewIds.includes(item.review_id)"
                @change="toggleReviewSelection(item.review_id, $event)"
              />
              <div>
                <strong>{{ formatEntity(item) }}</strong>
                <p>{{ formatScene(item.source_scene) }} · {{ formatPriority(item.priority) }}</p>
              </div>
            </div>
            <div class="tagGroup">
              <span :class="['priorityTag', item.priority]">{{ formatPriority(item.priority) }}</span>
              <span :class="['statusTag', item.status]">{{ formatStatus(item.status) }}</span>
            </div>
          </div>

          <div class="contentBox">
            {{ item.submitted_content || "暂无提交内容" }}
          </div>

          <div class="metaList">
            <div>审核编号：#{{ item.review_id }}</div>
            <div>提交时间：{{ item.created_at || "--" }}</div>
            <div>最近更新：{{ item.updated_at || "--" }}</div>
            <div>审核人：{{ formatOperatorName(item.reviewer_name) || "待分配" }}</div>
            <div v-if="item.decision_note">审核备注：{{ item.decision_note }}</div>
          </div>

          <div class="actionRow">
            <el-button size="small" plain @click="openHistory(item)">查看历史</el-button>
            <router-link
              :to="{
                path: '/main/ai-admin-logs',
                query: {
                  scene: item.source_scene || 'content_review',
                },
              }"
            >
              查看审计日志
            </router-link>
            <template v-if="item.status === 'pending'">
              <el-button size="small" type="success" @click="submitSingleDecision(item, 'approved')">
                通过
              </el-button>
              <el-button size="small" type="danger" plain @click="submitSingleDecision(item, 'rejected')">
                驳回
              </el-button>
            </template>
          </div>
        </div>
      </div>
      <div v-else class="emptyState">
        {{ errorMessage || "当前筛选条件下没有审核任务，可切换状态或场景继续查看。" }}
      </div>
    </section>

    <el-drawer
      v-model="historyVisible"
      title="审核处理历史"
      size="720px"
      destroy-on-close
    >
      <div v-loading="historyLoading" class="detailWrap">
        <template v-if="historyTask">
          <div class="detailHero">
            <div>
              <h3>{{ formatEntity(historyTask) }}</h3>
              <p>{{ historyTask.submitted_content || "暂无提交内容" }}</p>
            </div>
            <div class="tagGroup">
              <span :class="['priorityTag', historyTask.priority]">{{ formatPriority(historyTask.priority) }}</span>
              <span :class="['statusTag', historyTask.status]">{{ formatStatus(historyTask.status) }}</span>
            </div>
          </div>

          <div class="detailSection">
            <div class="sectionHead">
              <h4>审核记录</h4>
              <span>共 {{ historyItems.length }} 条</span>
            </div>
            <div v-if="historyItems.length" class="timelineList">
              <div v-for="(item, index) in historyItems" :key="`${item.action}-${index}`" class="timelineCard">
                <div class="timelineHead">
                  <strong>{{ formatHistoryAction(item.action) }}</strong>
                  <span>{{ item.created_at || "--" }}</span>
                </div>
                <p>处理人：{{ formatOperatorName(item.reviewer_name) || "系统" }}</p>
                <p>状态：{{ formatStatus(item.status) }}</p>
                <p v-if="item.payload?.updated_count">批量更新：{{ item.payload.updated_count }} 条</p>
              </div>
            </div>
            <div v-else class="emptyInline">暂无审核历史记录。</div>
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  approveAiReviewTask,
  approveAiReviewTasks,
  getAiReviewTaskHistory,
  listAiReviewTasks,
  rejectAiReviewTask,
  rejectAiReviewTasks,
} from "@/api/ai";
import { useRoute } from "vue-router";

const loading = ref(false);
const batchSubmitting = ref(false);
const errorMessage = ref("");
const reviews = ref([]);

const keyword = ref("");
const statusFilter = ref("");
const priorityFilter = ref("");
const sceneFilter = ref("");

const batchNote = ref("");
const selectedReviewIds = ref([]);

const historyVisible = ref(false);
const historyLoading = ref(false);
const historyTask = ref(null);
const historyItems = ref([]);
const route = useRoute();

const filteredReviews = computed(() =>
  reviews.value.filter((item) => {
    const searchText = [item.submitted_content, item.source_scene, item.reviewer_name, item.entity_type]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesKeyword = !keyword.value || searchText.includes(keyword.value.toLowerCase());
    const matchesStatus = !statusFilter.value || item.status === statusFilter.value;
    const matchesPriority = !priorityFilter.value || item.priority === priorityFilter.value;
    const matchesScene = !sceneFilter.value || item.source_scene === sceneFilter.value;
    return matchesKeyword && matchesStatus && matchesPriority && matchesScene;
  })
);

const pendingReviews = computed(() => filteredReviews.value.filter((item) => item.status === "pending"));
const selectedPendingIds = computed(() =>
  selectedReviewIds.value.filter((reviewId) => pendingReviews.value.some((item) => item.review_id === reviewId))
);
const pendingCount = computed(() => filteredReviews.value.filter((item) => item.status === "pending").length);
const approvedCount = computed(() => filteredReviews.value.filter((item) => item.status === "approved").length);
const rejectedCount = computed(() => filteredReviews.value.filter((item) => item.status === "rejected").length);
const allPendingSelected = computed(
  () => !!pendingReviews.value.length && selectedPendingIds.value.length === pendingReviews.value.length
);
const pendingSelectionIndeterminate = computed(
  () => selectedPendingIds.value.length > 0 && selectedPendingIds.value.length < pendingReviews.value.length
);
const sceneOptions = computed(() => [...new Set(reviews.value.map((item) => item.source_scene).filter(Boolean))]);

const applyRouteFilters = () => {
  const query = route.query || {};
  keyword.value = query.keyword ? String(query.keyword) : "";
  statusFilter.value = query.status ? String(query.status) : "";
  priorityFilter.value = query.priority ? String(query.priority) : "";
  sceneFilter.value = query.scene ? String(query.scene) : "";
};

const syncRouteSelection = async () => {
  const reviewId = route.query.reviewId ? String(route.query.reviewId) : "";
  if (!reviewId || !reviews.value.length) {
    return;
  }
  const matched = reviews.value.find((item) => String(item.review_id) === reviewId);
  if (matched && historyTask.value?.review_id !== matched.review_id) {
    await openHistory(matched);
  }
};

const loadReviews = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    const result = await listAiReviewTasks();
    reviews.value = result.items || [];
    const validIds = new Set(reviews.value.filter((item) => item.status === "pending").map((item) => item.review_id));
    selectedReviewIds.value = selectedReviewIds.value.filter((id) => validIds.has(id));
  } catch (error) {
    reviews.value = [];
    selectedReviewIds.value = [];
    errorMessage.value = error?.response?.data?.detail || error?.message || "审核任务加载失败";
  } finally {
    loading.value = false;
  }
  await syncRouteSelection();
};

const toggleReviewSelection = (reviewId, checked) => {
  if (!checked) {
    selectedReviewIds.value = selectedReviewIds.value.filter((id) => id !== reviewId);
    return;
  }
  if (!selectedReviewIds.value.includes(reviewId)) {
    selectedReviewIds.value = [...selectedReviewIds.value, reviewId];
  }
};

const toggleSelectAllPending = (checked) => {
  if (!checked) {
    selectedReviewIds.value = selectedReviewIds.value.filter(
      (id) => !pendingReviews.value.some((item) => item.review_id === id)
    );
    return;
  }
  selectedReviewIds.value = [...new Set([...selectedReviewIds.value, ...pendingReviews.value.map((item) => item.review_id)])];
};

const submitSingleDecision = async (item, decision) => {
  const isApprove = decision === "approved";
  try {
    const { value } = await ElMessageBox.prompt(
      `${isApprove ? "通过" : "驳回"}任务 #${item.review_id}，可填写本次审核说明`,
      `${isApprove ? "通过" : "驳回"}审核任务`,
      {
        confirmButtonText: "确认提交",
        cancelButtonText: "取消",
        inputPlaceholder: isApprove ? "例如：内容符合规范，可直接上线" : "例如：措辞不准确，需要人工修订",
        inputValue: item.decision_note || "",
      }
    );

    const payload = {
      reviewer_name: "运营管理员",
      decision_note: value || undefined,
    };

    if (isApprove) {
      await approveAiReviewTask(item.review_id, payload);
    } else {
      await rejectAiReviewTask(item.review_id, payload);
    }

    ElMessage.success(`任务 #${item.review_id} 已${isApprove ? "通过" : "驳回"}`);
    await loadReviews();
  } catch (error) {
    if (error === "cancel") {
      return;
    }
    ElMessage.error(error?.response?.data?.detail || error?.message || "审核提交失败");
  }
};

const submitBatchDecision = async (decision) => {
  const isApprove = decision === "approved";
  try {
    await ElMessageBox.confirm(
      `确认${isApprove ? "批量通过" : "批量驳回"}已选的 ${selectedPendingIds.value.length} 条待审核任务吗？`,
      "批量审核确认",
      {
        type: isApprove ? "success" : "warning",
        confirmButtonText: "确认处理",
        cancelButtonText: "取消",
      }
    );

    batchSubmitting.value = true;
    const payload = {
      review_ids: selectedPendingIds.value,
      reviewer_name: "运营管理员",
      decision_note: batchNote.value || undefined,
    };

    if (isApprove) {
      await approveAiReviewTasks(payload);
    } else {
      await rejectAiReviewTasks(payload);
    }

    ElMessage.success(`已批量${isApprove ? "通过" : "驳回"} ${selectedPendingIds.value.length} 条任务`);
    selectedReviewIds.value = [];
    batchNote.value = "";
    await loadReviews();
  } catch (error) {
    if (error === "cancel") {
      return;
    }
    ElMessage.error(error?.response?.data?.detail || error?.message || "批量审核失败");
  } finally {
    batchSubmitting.value = false;
  }
};

const openHistory = async (item) => {
  historyTask.value = item;
  historyVisible.value = true;
  historyLoading.value = true;
  historyItems.value = [];
  try {
    const result = await getAiReviewTaskHistory(item.review_id);
    historyItems.value = result.items || [];
  } catch (error) {
    ElMessage.error(error?.response?.data?.detail || error?.message || "审核历史加载失败");
  } finally {
    historyLoading.value = false;
  }
};

const formatEntity = (item) => `${formatEntityType(item.entity_type)} #${item.entity_id}`;

const formatEntityType = (value) => {
  const map = {
    resource: "学习资源",
    answer: "问答内容",
    report: "学习报告",
    plan: "学习计划",
  };
  return map[value] || value || "内容对象";
};

const formatScene = (value) => {
  const map = {
    manual_submit: "人工提交",
    resource_generate: "资源生成",
    tutor_reply: "智能助教回复",
    report_publish: "报告发布",
  };
  return map[value] || value || "未知场景";
};

const formatPriority = (value) => {
  const map = {
    high: "高优先级",
    normal: "普通优先级",
    low: "低优先级",
  };
  return map[value] || value || "普通优先级";
};

const formatStatus = (value) => {
  const map = {
    pending: "待审核",
    approved: "已通过",
    rejected: "已驳回",
  };
  return map[value] || value || "未知状态";
};

const formatHistoryAction = (value) => {
  const map = {
    review_task_created: "创建审核任务",
    review_task_approved: "单条通过",
    review_task_rejected: "单条驳回",
    review_task_batch_approved: "批量通过",
    review_task_batch_rejected: "批量驳回",
  };
  return map[value] || value || "审核动作";
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

watch(
  () => route.query,
  async () => {
    applyRouteFilters();
    if (reviews.value.length) {
      await syncRouteSelection();
    }
  }
);

onMounted(async () => {
  applyRouteFilters();
  await loadReviews();
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
.rowTop,
.actionRow,
.detailHero,
.sectionHead,
.timelineHead {
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

.badge.danger {
  background: #fee2e2;
  color: #b91c1c;
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

.backButton,
.refreshButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 132px;
  height: 42px;
  padding: 0 18px;
  border-radius: 999px;
  font-weight: 700;
}

.backButton {
  background: #123b74;
  color: #fff;
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) repeat(3, 180px);
  gap: 12px;
  margin-top: 24px;
}

.summaryGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 22px;
}

.summaryCard {
  padding: 18px;
  border-radius: 20px;
  background: #f8fbff;
}

.summaryCard.warning {
  background: #fff7ed;
}

.summaryCard.success {
  background: #ecfdf5;
}

.summaryCard.danger {
  background: #fff1f2;
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

.batchBar {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  margin-top: 22px;
  padding: 16px 18px;
  border-radius: 20px;
  background: #f8fbff;
}

.selectionInfo,
.batchActions,
.rowTitle,
.tagGroup {
  display: flex;
  gap: 12px;
  align-items: center;
}

.selectionInfo span {
  color: #64748b;
  font-size: 13px;
}

.batchActions {
  flex: 1;
  justify-content: flex-end;
}

.batchActions :deep(.el-input) {
  max-width: 320px;
}

.tableGrid,
.timelineList {
  display: grid;
  gap: 14px;
  margin-top: 22px;
}

.rowCard,
.timelineCard {
  padding: 18px;
  border-radius: 22px;
  background: #f8fbff;
  border: 1px solid transparent;
}

.rowCard.status-pending {
  border-color: #fde68a;
}

.rowCard.status-approved {
  border-color: #bbf7d0;
}

.rowCard.status-rejected {
  border-color: #fecdd3;
}

.rowTitle strong {
  color: #12233b;
  font-size: 18px;
}

.rowTitle p {
  margin-top: 4px;
}

.priorityTag,
.statusTag {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.priorityTag.high {
  background: #fff1f2;
  color: #be123c;
}

.priorityTag.normal {
  background: #eff6ff;
  color: #1d4ed8;
}

.priorityTag.low {
  background: #f1f5f9;
  color: #475569;
}

.statusTag.pending {
  background: #fff7ed;
  color: #c2410c;
}

.statusTag.approved {
  background: #dcfce7;
  color: #15803d;
}

.statusTag.rejected {
  background: #ffe4e6;
  color: #be123c;
}

.contentBox {
  margin-top: 16px;
  padding: 16px;
  border-radius: 18px;
  background: #fff;
  color: #334155;
  line-height: 1.8;
}

.metaList {
  display: grid;
  gap: 8px;
  margin-top: 16px;
  color: #64748b;
  font-size: 13px;
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
  min-height: 220px;
}

.detailSection {
  margin-top: 24px;
}

.sectionHead span,
.timelineHead span {
  color: #94a3b8;
  font-size: 12px;
}

.timelineCard p {
  margin-top: 8px;
}

@media (max-width: 1100px) {
  .pageHead,
  .headActions,
  .batchBar,
  .batchActions {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar,
  .summaryGrid {
    grid-template-columns: 1fr;
  }

  .tagGroup,
  .actionRow,
  .selectionInfo {
    flex-wrap: wrap;
  }
}
</style>
