<template>
  <div class="evalPage">
    <section class="heroCard">
      <div>
        <div class="badge blue">课程测评中心</div>
        <h1>课程测评与错题闭环入口</h1>
        <p>按课程查看真实测评列表，并补齐历史记录、趋势摘要、作答入口与错题复盘。</p>
      </div>
      <div class="heroActions">
        <div class="formRow">
          <span>课程 ID</span>
          <el-input-number v-model="courseId" :min="1" />
        </div>
        <div class="codeHint">课程编码：{{ courseCode }}</div>
        <el-button class="navButton" type="primary" :loading="loading" @click="loadAll">加载测评</el-button>
        <router-link class="subLink" :to="`/main/ai-mistakes?courseId=${courseId}`">查看错题复盘</router-link>
        <router-link class="subLink" :to="`/main/ai-report?courseId=${courseId}`">查看学习报告</router-link>
      </div>
    </section>

    <el-alert v-if="errorMessage" :title="errorMessage" type="warning" show-icon class="alert" />

    <section class="summaryGrid">
      <div class="summaryCard">
        <span>测评数量</span>
        <strong>{{ tests.length }}</strong>
      </div>
      <div class="summaryCard">
        <span>历史记录</span>
        <strong>{{ historyTotalText }}</strong>
      </div>
      <div class="summaryCard">
        <span>最近成绩</span>
        <strong>{{ trendSummary.latestScoreText }}</strong>
      </div>
      <div class="summaryCard">
        <span>掌握等级</span>
        <strong>{{ trendSummary.masteryText }}</strong>
      </div>
    </section>

    <section class="tableCard">
      <div class="sectionHeader">
        <h2>趋势摘要</h2>
        <span class="metaText">来自 Python 评估历史接口的聚合结果</span>
      </div>

      <div class="trendGrid">
        <div class="trendCard">
          <span>平均成绩</span>
          <strong>{{ trendSummary.averageScoreText }}</strong>
        </div>
        <div class="trendCard">
          <span>最佳成绩</span>
          <strong>{{ trendSummary.bestScoreText }}</strong>
        </div>
        <div class="trendCard">
          <span>分数变化</span>
          <strong :class="{ up: trendSummary.improvementValue > 0, down: trendSummary.improvementValue < 0 }">
            {{ trendSummary.improvementText }}
          </strong>
        </div>
      </div>

      <div class="focusBlock">
        <div class="focusTitle">当前聚焦</div>
        <div v-if="trendSummary.focusPoints.length" class="focusTags">
          <span v-for="item in trendSummary.focusPoints" :key="item" class="focusTag">{{ item }}</span>
        </div>
        <div v-else class="emptyInline">当前暂无趋势聚焦项。</div>
      </div>
    </section>

    <section class="tableCard">
      <div class="sectionHeader">
        <h2>历史记录</h2>
        <span class="metaText">最近 {{ historyItems.length }} 条学习测评</span>
      </div>

      <el-table v-if="historyItems.length" :data="historyItems" stripe class="tbl">
        <el-table-column prop="createdAtText" label="时间" min-width="170" />
        <el-table-column prop="evaluationTypeText" label="类型" width="140" />
        <el-table-column prop="overallScoreText" label="成绩" width="110" />
        <el-table-column prop="masteryLevelText" label="掌握等级" width="120" />
        <el-table-column prop="knowledgePointText" label="知识点" min-width="220" />
      </el-table>

      <div v-else class="emptyState">当前课程还没有可展示的历史测评记录。</div>
    </section>

    <section class="tableCard">
      <div class="sectionHeader">
        <h2>测评列表</h2>
        <span class="metaText">当前展示真实测评数据</span>
      </div>

      <el-table v-if="tests.length" :data="tests" stripe class="tbl">
        <el-table-column prop="id" label="测评 ID" width="120" />
        <el-table-column prop="title" label="标题" min-width="240" />
        <el-table-column prop="questionCount" label="题目数" width="100" />
        <el-table-column prop="statusText" label="状态" width="120" />
        <el-table-column label="操作" width="260">
          <template #default="{ row }">
            <div class="actionLinks">
              <router-link :to="`/main/ai-evaluation/exam/${row.id}?courseId=${courseId}`">进入测评</router-link>
              <router-link :to="`/main/ai-mistakes?courseId=${courseId}&testId=${row.id}`">错题复盘</router-link>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-else-if="!loading" class="emptyState">当前课程还没有可展示的测评数据。</div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import request from "@/utils/request";
import { getAiEvaluationHistory, getAiEvaluationTrend } from "@/api/ai";
import { normalizeCourseAwareText, resolveCourseCode } from "@/utils/courseMapping";

const courseId = ref(1);
const tests = ref([]);
const historyItems = ref([]);
const trend = ref(null);
const loading = ref(false);
const errorMessage = ref("");

const courseCode = computed(() => resolveCourseCode(courseId.value));
const historyTotalText = computed(() => String(historyItems.value.length || trend.value?.total || 0));

const trendSummary = computed(() => {
  const value = trend.value || {};
  return {
    latestScoreText: formatScore(value.latest_score ?? value.latestScore),
    averageScoreText: formatScore(value.average_score ?? value.averageScore),
    bestScoreText: formatScore(value.best_score ?? value.bestScore),
    masteryText: normalizeMastery(value.latest_mastery_level ?? value.latestMasteryLevel),
    improvementValue: Number(value.improvement ?? 0) || 0,
    improvementText: formatSignedNumber(value.improvement),
    focusPoints: Array.isArray(value.focus_knowledge_points ?? value.focusKnowledgePoints)
      ? (value.focus_knowledge_points ?? value.focusKnowledgePoints).map((item) => normalizeText(item)).filter(Boolean)
      : [],
  };
});

function formatScore(value) {
  if (value == null || value === "") return "--";
  const score = Number(value);
  return Number.isFinite(score) ? score.toFixed(1) : String(value);
}

function formatSignedNumber(value) {
  if (value == null || value === "") return "--";
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  if (num > 0) return `+${num.toFixed(1)}`;
  return num.toFixed(1);
}

function normalizeMastery(value) {
  const text = String(value || "").trim();
  const map = {
    stable: "稳定",
    developing: "发展中",
    advanced: "进阶",
    basic: "基础",
    watch: "需关注",
  };
  return map[text] || text || "--";
}

function normalizeType(value) {
  const text = String(value || "").trim();
  const map = {
    path_diagnostic: "路径诊断",
    diagnostic: "诊断测评",
    stage_test: "阶段测评",
    final: "综合测评",
  };
  return map[text] || text || "--";
}

function normalizeStatusText(status) {
  const map = {
    ready: "可开始",
    ongoing: "进行中",
    completed: "已完成",
    review: "建议复盘",
  };
  return map[status] || status || "待处理";
}

function normalizeText(value) {
  return normalizeCourseAwareText(value);
}

function formatCreatedAt(value) {
  if (!value) return "--";
  return String(value).replace("T", " ").replace(/\.\d+.*$/, "");
}

async function loadList() {
  const res = await request.get(`/api/evaluation/test/course/${courseId.value}`);
  const remoteList = Array.isArray(res.data) ? res.data : [];
  tests.value = remoteList.map((item) => ({
    ...item,
    questionCount: item.questionCount ?? item.question_count ?? item.totalQuestions ?? 0,
    statusText: normalizeStatusText(item.status),
  }));
}

async function loadHistory() {
  const res = await getAiEvaluationHistory({
    user_id: 1,
    course_code: courseCode.value,
    limit: 10,
  });
  const items = Array.isArray(res?.items) ? res.items : [];
  historyItems.value = items.map((item) => ({
    ...item,
    createdAtText: formatCreatedAt(item.created_at ?? item.createdAt),
    evaluationTypeText: normalizeType(item.evaluation_type ?? item.evaluationType),
    overallScoreText: formatScore(item.overall_score ?? item.overallScore),
    masteryLevelText: normalizeMastery(item.mastery_level ?? item.masteryLevel),
    knowledgePointText: Array.isArray(item.knowledge_points ?? item.knowledgePoints)
      ? (item.knowledge_points ?? item.knowledgePoints).map((point) => normalizeText(point)).join("、") || "--"
      : "--",
  }));
}

async function loadTrend() {
  const res = await getAiEvaluationTrend({
    user_id: 1,
    course_code: courseCode.value,
    limit: 10,
  });
  trend.value = res || null;
}

async function loadAll() {
  loading.value = true;
  errorMessage.value = "";
  try {
    await Promise.all([loadList(), loadHistory(), loadTrend()]);
  } catch (error) {
    tests.value = [];
    historyItems.value = [];
    trend.value = null;
    errorMessage.value = error?.response?.data?.msg || error?.message || "测评数据加载失败";
  } finally {
    loading.value = false;
  }
}

loadAll();
</script>

<style scoped lang="scss">
.evalPage {
  max-width: 1180px;
  margin: 0 auto;
  padding: 28px 20px 48px;
  background: linear-gradient(180deg, #f7fbff 0%, #f9fcfe 100%);
}

.heroCard,
.tableCard,
.summaryCard,
.trendCard {
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24px 60px rgba(31, 58, 94, 0.1);
}

.heroCard {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
  padding: 28px 30px;
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
  color: #12233b;
  font-size: 38px;
}

p {
  margin-top: 12px;
  color: #5f7186;
  line-height: 1.8;
}

.heroActions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  min-width: 220px;
}

.formRow {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #475569;
  font-size: 14px;
}

.codeHint {
  font-size: 13px;
  color: #64748b;
}

.navButton {
  min-width: 150px;
  height: 44px;
  border-radius: 999px;
}

.subLink {
  color: #0c63d6;
  text-decoration: none;
  font-size: 14px;
}

.alert {
  margin-top: 20px;
}

.summaryGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
  margin-top: 24px;
}

.summaryCard {
  padding: 18px 20px;

  span {
    display: block;
    color: #64748b;
    font-size: 12px;
  }

  strong {
    display: block;
    margin-top: 10px;
    color: #12233b;
    font-size: 24px;
  }
}

.tableCard {
  margin-top: 24px;
  padding: 26px;
}

.sectionHeader {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  margin-bottom: 20px;
}

.metaText {
  color: #64748b;
  font-size: 13px;
}

.trendGrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.trendCard {
  padding: 18px 20px;

  span {
    display: block;
    color: #64748b;
    font-size: 12px;
  }

  strong {
    display: block;
    margin-top: 10px;
    color: #12233b;
    font-size: 22px;
  }

  strong.up {
    color: #0f9d58;
  }

  strong.down {
    color: #dc2626;
  }
}

.focusBlock {
  margin-top: 18px;
  border-top: 1px solid #e2e8f0;
  padding-top: 18px;
}

.focusTitle {
  font-size: 14px;
  font-weight: 700;
  color: #12233b;
}

.focusTags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.focusTag {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 13px;
}

.emptyInline,
.emptyState {
  color: #64748b;
}

.emptyInline {
  margin-top: 12px;
}

.actionLinks {
  display: flex;
  gap: 12px;
}

.actionLinks a {
  color: #2563eb;
  text-decoration: none;
}

.emptyState {
  padding: 40px 0 24px;
  text-align: center;
}

@media (max-width: 960px) {
  .summaryGrid,
  .trendGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .heroCard {
    flex-direction: column;
  }

  .heroActions {
    width: 100%;
    align-items: stretch;
  }

  .summaryGrid,
  .trendGrid {
    grid-template-columns: 1fr;
  }
}
</style>
