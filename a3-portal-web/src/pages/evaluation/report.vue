<template>
  <div class="reportPage">
    <header class="head">
      <div>
        <h1>测评报告</h1>
        <p class="subText">展示真实测评报告详情，并串联返回课程测评、综合学习报告和错题复盘。</p>
      </div>
      <div class="headActions">
        <router-link class="navLink secondary" :to="`/main/ai-evaluation?courseId=${courseId}`">返回测评列表</router-link>
        <router-link class="navLink light" :to="`/main/ai-report?courseId=${courseId}`">综合学习报告</router-link>
        <el-button class="exportBtn" plain :loading="exporting" @click="exportReport">
          {{ exporting ? "导出中..." : "导出 Markdown" }}
        </el-button>
      </div>
    </header>

    <el-alert v-if="errorMessage" :title="errorMessage" type="warning" show-icon class="mb" />
    <el-alert v-if="exportPath" :title="`导出成功：${exportPath}`" type="success" show-icon class="mb" />

    <div class="metaBar">
      <span class="pill">真实接口</span>
      <span class="pill light">报告 ID：{{ reportId }}</span>
      <span class="pill light">课程 ID：{{ courseId }}</span>
    </div>

    <el-skeleton v-if="loading" :rows="8" animated />

    <template v-else-if="reportDetail">
      <section class="heroGrid">
        <el-card class="scoreCard">
          <div class="scoreLabel">综合得分</div>
          <div class="scoreValue">{{ reportScore }}</div>
          <div class="scoreMeta">掌握等级：{{ reportDetail.masteryLevel || "--" }}</div>
        </el-card>

        <el-card class="metaCard">
          <div class="metaItem">
            <span>报告类型</span>
            <strong>{{ reportDetail.reportTypeDesc || reportDetail.reportType || "--" }}</strong>
          </div>
          <div class="metaItem">
            <span>关联测评</span>
            <strong>{{ reportTestText }}</strong>
          </div>
          <div class="metaItem">
            <span>报告编号</span>
            <strong>{{ reportDetail.id || "--" }}</strong>
          </div>
        </el-card>
      </section>

      <el-card class="blockCard">
        <template #header>报告摘要</template>
        <p class="summaryText">{{ reportDetail.reportSummary || "暂无摘要" }}</p>
      </el-card>

      <section class="detailGrid">
        <el-card class="blockCard">
          <template #header>优势</template>
          <pre>{{ reportDetail.strengths || "暂无" }}</pre>
        </el-card>

        <el-card class="blockCard">
          <template #header>薄弱点</template>
          <pre>{{ reportDetail.weaknesses || "暂无" }}</pre>
        </el-card>
      </section>

      <el-card class="blockCard">
        <template #header>改进建议</template>
        <pre>{{ reportDetail.improvementSuggestions || "暂无" }}</pre>
      </el-card>

      <div class="linkRow">
        <router-link class="navLink secondary" :to="`/main/ai-evaluation?courseId=${courseId}`">回到课程测评</router-link>
        <router-link class="navLink light" :to="`/main/ai-report?courseId=${courseId}`">打开综合学习报告</router-link>
        <router-link class="navLink dark" :to="mistakesLink">进入错题复盘</router-link>
      </div>
    </template>

    <p v-else class="empty">当前没有可展示的报告详情。</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { useRoute } from "vue-router";
import request from "@/utils/request";

const route = useRoute();
const reportId = computed(() => route.params.reportId);
const courseId = computed(() => Number(route.query.courseId || 1));

const loading = ref(false);
const exporting = ref(false);
const reportDetail = ref(null);
const errorMessage = ref("");
const exportPath = ref("");

function toErrorMessage(error, fallback) {
  return error?.response?.data?.msg || error?.response?.data?.detail || error?.message || fallback;
}

const reportScore = computed(() => {
  const value = reportDetail.value?.overallScore;
  if (value == null || value === "") return "--";
  const score = Number(value);
  return Number.isFinite(score) ? score.toFixed(1) : String(value);
});

const reportTestText = computed(() => {
  const ids = reportDetail.value?.testIds;
  return Array.isArray(ids) && ids.length ? ids.join("、") : "--";
});

const mistakesLink = computed(() => {
  const query = new URLSearchParams();
  query.set("courseId", String(courseId.value));
  if (reportDetail.value?.id != null) {
    query.set("reportId", String(reportDetail.value.id));
  }
  const firstTestId = reportDetail.value?.testIds?.[0];
  if (firstTestId != null) {
    query.set("testId", String(firstTestId));
  }
  return `/main/ai-mistakes?${query.toString()}`;
});

async function loadReport() {
  if (!reportId.value) {
    reportDetail.value = null;
    errorMessage.value = "缺少报告 ID";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  exportPath.value = "";
  try {
    const res = await request.get(`/api/evaluation/report/${reportId.value}`);
    reportDetail.value = res.data || null;
    if (!reportDetail.value) {
      errorMessage.value = "报告详情为空";
    }
  } catch (error) {
    reportDetail.value = null;
    errorMessage.value = toErrorMessage(error, "报告加载失败");
  } finally {
    loading.value = false;
  }
}

async function exportReport() {
  if (!reportId.value) {
    errorMessage.value = "缺少报告 ID";
    return;
  }

  exporting.value = true;
  exportPath.value = "";
  errorMessage.value = "";
  try {
    const res = await request.get(`/api/evaluation/report/${reportId.value}/export`, {
      params: { format: "markdown" },
    });
    exportPath.value = String(res.data || "");
    ElMessage.success("报告已导出");
  } catch (error) {
    errorMessage.value = toErrorMessage(error, "报告导出失败");
  } finally {
    exporting.value = false;
  }
}

onMounted(loadReport);

watch(
  () => route.params.reportId,
  () => {
    loadReport();
  },
);
</script>

<style scoped>
.reportPage {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.subText {
  margin-top: 8px;
  color: #64748b;
  line-height: 1.7;
}

.headActions,
.linkRow {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.exportBtn {
  border-radius: 999px;
}

.navLink {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 18px;
  border-radius: 999px;
  font-size: 14px;
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.navLink:hover {
  transform: translateY(-1px);
}

.navLink.secondary {
  background: #e2e8f0;
  color: #0f172a;
}

.navLink.light {
  background: #dbeafe;
  color: #1d4ed8;
}

.navLink.dark {
  background: #0f172a;
  color: #fff;
}

.mb {
  margin-bottom: 16px;
}

.metaBar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
}

.pill {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 600;
}

.pill.light {
  background: #f1f5f9;
  color: #475569;
}

.heroGrid,
.detailGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.scoreCard,
.metaCard,
.blockCard {
  border-radius: 24px;
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.08);
}

.scoreCard {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  background: linear-gradient(135deg, #0f172a, #1d4ed8);
  color: #fff;
}

.scoreLabel {
  font-size: 15px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.78;
}

.scoreValue {
  margin-top: 18px;
  font-size: 56px;
  font-weight: 700;
  line-height: 1;
}

.scoreMeta {
  margin-top: 14px;
  font-size: 15px;
  opacity: 0.85;
}

.metaCard {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  padding: 14px;
}

.metaItem {
  padding: 18px 20px;
  border-radius: 18px;
  background: #f8fafc;
}

.metaItem span {
  display: block;
  color: #64748b;
  font-size: 13px;
}

.metaItem strong {
  display: block;
  margin-top: 8px;
  color: #12233b;
  font-size: 20px;
}

.blockCard {
  margin-top: 20px;
}

.summaryText,
pre,
.empty {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.8;
}

.empty {
  margin-top: 24px;
  color: #64748b;
  text-align: center;
}

@media (max-width: 860px) {
  .head {
    flex-direction: column;
  }

  .heroGrid,
  .detailGrid {
    grid-template-columns: 1fr;
  }

  .headActions,
  .linkRow {
    width: 100%;
  }
}
</style>
