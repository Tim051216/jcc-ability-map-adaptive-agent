<template>
  <div class="studentModulePage">
    <section class="heroCard">
      <div>
        <div class="badge amber">错题修复中心</div>
        <h1>错题复盘与修复建议</h1>
        <p>优先读取真实测评记录、报告与错题明细，不再回退到 demo/mock 数据。</p>
      </div>
      <div class="heroActions">
        <el-button class="navButton" :loading="loading" @click="loadWrongQuestions">刷新错题</el-button>
        <router-link
          v-if="route.query.courseId"
          class="subLink"
          :to="`/main/ai-evaluation?courseId=${route.query.courseId}`"
        >
          返回课程测评
        </router-link>
        <router-link class="subLink" to="/main/ai-resources">进入资源推荐</router-link>
        <router-link
          class="subLink"
          :to="route.query.courseId ? `/main/ai-report?courseId=${route.query.courseId}` : '/main/ai-report'"
        >
          查看学习报告
        </router-link>
      </div>
    </section>

    <section class="contentGrid">
      <div class="card">
        <div class="sectionHeader">
          <h2>错题清单</h2>
          <span class="metaText">共 {{ wrongQuestions.length }} 题</span>
        </div>
        <div v-if="wrongQuestions.length" class="problemList">
          <div v-for="item in wrongQuestions" :key="item.question_id || item.prompt" class="problemCard">
            <strong>{{ item.prompt }}</strong>
            <p>知识点：{{ item.knowledge_point || "未标注" }}</p>
            <div class="answerBlock">
              <div class="answerItem">
                <span>你的答案</span>
                <p>{{ item.user_answer || "暂无" }}</p>
              </div>
              <div class="answerItem correct">
                <span>正确答案</span>
                <p>{{ item.correct_answer || "暂无" }}</p>
              </div>
            </div>
            <div class="explanationBox">
              <span>讲解</span>
              <p>{{ item.explanation || "暂无解析" }}</p>
            </div>
          </div>
        </div>
        <div v-else class="emptyState">当前没有可展示的错题数据。若只传了课程 ID，请从具体测评进入本页查看错题。</div>
      </div>

      <div class="card">
        <h2>修复建议</h2>
        <div class="summaryPanel">
          <div class="summaryItem">
            <span>最近测评分数</span>
            <strong>{{ scoreText }}</strong>
          </div>
          <div class="summaryItem">
            <span>掌握等级</span>
            <strong>{{ evaluationData?.mastery_level || "暂无" }}</strong>
          </div>
        </div>

        <div v-if="weakPoints.length" class="adviceList">
          <div v-for="item in weakPoints" :key="item" class="adviceItem warning">{{ item }}</div>
        </div>
        <div v-if="suggestions.length" class="adviceList">
          <div v-for="item in suggestions" :key="item" class="adviceItem">{{ item }}</div>
        </div>
        <div v-if="errorMessage" class="errorState">{{ errorMessage }}</div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import request from "@/utils/request";

const route = useRoute();

const loading = ref(false);
const errorMessage = ref("");
const evaluationData = ref(null);
const wrongQuestionsResponse = ref([]);

const weakPoints = computed(() => {
  const points = evaluationData.value?.weak_points;
  return Array.isArray(points) ? points : [];
});

const suggestions = computed(() => {
  const items = evaluationData.value?.suggestions;
  return Array.isArray(items) ? items : [];
});

const wrongQuestions = computed(() => wrongQuestionsResponse.value);

const scoreText = computed(() => {
  if (typeof evaluationData.value?.overall_score === "number") {
    return `${evaluationData.value.overall_score.toFixed(1)} 分`;
  }
  return "暂无";
});

function splitLines(text) {
  if (!text || typeof text !== "string") return [];
  return text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeJavaWrongRow(row) {
  return {
    question_id: row.question_id ?? String(row.questionId ?? ""),
    prompt: row.prompt ?? row.questionContent ?? "",
    knowledge_point: row.knowledge_point ?? row.knowledgePoint ?? "",
    user_answer: row.user_answer ?? row.userAnswer ?? "",
    correct_answer: row.correct_answer ?? row.correctAnswer ?? "",
    explanation: row.explanation ?? row.gradingFeedback ?? "",
  };
}

async function applyReportToSummary(reportPayload) {
  if (!reportPayload) return;
  evaluationData.value = {
    overall_score: reportPayload.overallScore != null ? Number(reportPayload.overallScore) : undefined,
    mastery_level: reportPayload.masteryLevel || undefined,
    weak_points: splitLines(reportPayload.weaknesses),
    suggestions: splitLines(reportPayload.improvementSuggestions),
  };
}

async function loadWrongQuestions() {
  loading.value = true;
  errorMessage.value = "";
  wrongQuestionsResponse.value = [];
  evaluationData.value = null;

  const qTestId = route.query.testId;
  const qCourseId = route.query.courseId;
  const qReportId = route.query.reportId;

  try {
    if (qReportId) {
      const reportRes = await request.get(`/api/evaluation/report/${qReportId}`);
      await applyReportToSummary(reportRes.data);
    } else if (qCourseId) {
      const listRes = await request.get("/api/evaluation/report/list", {
        params: { courseId: qCourseId },
      });
      const list = listRes.data || [];
      if (list.length > 0 && list[0].id) {
        const reportRes = await request.get(`/api/evaluation/report/${list[0].id}`);
        await applyReportToSummary(reportRes.data);
      }
    }

    if (qTestId) {
      const wrongRes = await request.get("/api/evaluation/answer/wrong", {
        params: { testId: qTestId },
      });
      wrongQuestionsResponse.value = (wrongRes.data || []).map(normalizeJavaWrongRow);
    }
  } catch (error) {
    errorMessage.value =
      error?.response?.data?.msg ||
      error?.response?.data?.detail ||
      error?.message ||
      "错题数据加载失败";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadWrongQuestions();
});

watch(
  () => [route.query.testId, route.query.courseId, route.query.reportId],
  () => {
    loadWrongQuestions();
  },
);
</script>

<style scoped lang="scss">
.studentModulePage {
  min-height: 100vh;
  padding: 32px 24px 48px;
  background: linear-gradient(180deg, #fffaf5 0%, #f8fbfd 100%);
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

.badge {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.badge.amber {
  background: #ffedd5;
  color: #c2410c;
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

.subLink {
  font-size: 14px;
  color: #0c63d6;
  text-decoration: none;
}

.contentGrid {
  max-width: 1180px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 24px;
}

.card {
  padding: 26px;
}

.sectionHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}

.metaText {
  color: #64748b;
  font-size: 13px;
}

.problemList {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.problemCard {
  padding: 18px;
  border-radius: 18px;
  background: #f8fafc;
}

.answerBlock {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.answerItem {
  padding: 12px 14px;
  border-radius: 14px;
  background: #fff;
}

.answerItem.correct {
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
}

.answerItem span,
.explanationBox span {
  display: block;
  margin-bottom: 8px;
  color: #64748b;
  font-size: 12px;
}

.answerItem p,
.explanationBox p {
  margin: 0;
  color: #12233b;
}

.explanationBox {
  margin-top: 14px;
  padding: 14px;
  border-radius: 14px;
  background: #fff;
}

.summaryPanel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.summaryItem {
  padding: 16px;
  border-radius: 16px;
  background: #f8fafc;
}

.summaryItem span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.summaryItem strong {
  display: block;
  margin-top: 8px;
  color: #12233b;
  font-size: 24px;
}

.adviceList {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}

.adviceItem {
  padding: 14px 16px;
  border-radius: 14px;
  background: #f8fafc;
  color: #334155;
}

.adviceItem.warning {
  background: #fff7ed;
  color: #9a3412;
}

.errorState {
  margin-top: 16px;
  color: #dc2626;
}

.emptyState {
  padding: 36px 0 12px;
  color: #64748b;
  text-align: center;
}

@media (max-width: 900px) {
  .heroCard,
  .contentGrid,
  .answerBlock,
  .summaryPanel {
    grid-template-columns: 1fr;
  }

  .heroCard {
    flex-direction: column;
  }

  .heroActions {
    align-items: flex-start;
  }
}
</style>
