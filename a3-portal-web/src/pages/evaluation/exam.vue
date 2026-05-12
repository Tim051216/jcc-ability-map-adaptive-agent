<template>
  <div class="examPage">
    <header class="head">
      <div>
        <h1>测评作答</h1>
        <p class="subText">只读取真实测评题目，提交后生成真实批改结果与学习报告。</p>
      </div>
      <router-link class="back" :to="`/main/ai-evaluation?courseId=${courseId}`">返回列表</router-link>
    </header>

    <el-alert v-if="err" :title="err" type="warning" show-icon class="mb" />

    <div class="metaBar">
      <span class="pill">真实接口</span>
      <span class="pill light">测评 ID：{{ testId }}</span>
      <span class="pill light">课程 ID：{{ courseId }}</span>
    </div>

    <el-skeleton v-if="loading" :rows="6" animated />

    <div v-else-if="questions.length" class="paper">
      <div v-for="q in questions" :key="q.id" class="qblock">
        <div class="qtitle">
          <span class="tag">#{{ q.orderNum }}</span>
          {{ q.questionContent }}
        </div>
        <div v-if="q.questionOptions && q.questionOptions.length" class="opts">
          <label v-for="(opt, idx) in q.questionOptions" :key="idx" class="opt">
            <input v-model="answers[q.id]" type="radio" :name="'q' + q.id" :value="optionValue(opt)" />
            {{ formatOption(opt) }}
          </label>
        </div>
        <el-input v-else v-model="answers[q.id]" type="textarea" :rows="2" placeholder="请输入答案" />
      </div>

      <div class="actions">
        <el-button type="primary" :loading="submitting" @click="submit">提交并批改</el-button>
        <el-button :loading="reporting" :disabled="!canReport" @click="genReport">生成学习报告</el-button>
        <el-button v-if="reportId" type="success" plain @click="openReport">查看报告页</el-button>
        <router-link
          v-if="gradingSummary && gradingSummary.wrong > 0"
          class="mistakesBtn"
          :to="`/main/ai-mistakes?testId=${testId}&courseId=${courseId}${reportId ? `&reportId=${reportId}` : ''}`"
        >
          本场错题巩固
        </router-link>
      </div>

      <el-card v-if="grading" class="result">
        <template #header>批改结果</template>
        <div v-if="gradingSummary" class="gradeSummary">
          <div class="stat">
            <span class="lbl">总题</span>
            <strong>{{ gradingSummary.total }}</strong>
          </div>
          <div class="stat ok">
            <span class="lbl">正确</span>
            <strong>{{ gradingSummary.correct }}</strong>
          </div>
          <div class="stat bad">
            <span class="lbl">错误</span>
            <strong>{{ gradingSummary.wrong }}</strong>
          </div>
          <div class="stat">
            <span class="lbl">正确率</span>
            <strong>{{ gradingSummary.accuracy_rate }}%</strong>
          </div>
          <div class="stat highlight">
            <span class="lbl">得分</span>
            <strong>{{ gradingTotalScore }}</strong>
          </div>
        </div>
        <el-collapse class="rawCollapse">
          <el-collapse-item title="查看原始 JSON" name="raw">
            <pre>{{ gradingText }}</pre>
          </el-collapse-item>
        </el-collapse>
      </el-card>

      <el-card v-if="report" class="result">
        <template #header>报告摘要</template>
        <p><strong>综合得分</strong>：{{ report.overallScore ?? "--" }}</p>
        <p><strong>掌握等级</strong>：{{ report.masteryLevel || "--" }}</p>
        <p><strong>优势</strong></p>
        <pre>{{ report.strengths || "--" }}</pre>
        <p><strong>薄弱点</strong></p>
        <pre>{{ report.weaknesses || "--" }}</pre>
        <p><strong>改进建议</strong></p>
        <pre>{{ report.improvementSuggestions || "--" }}</pre>
      </el-card>
    </div>

    <p v-else class="empty">当前测评没有可作答题目，请返回测评列表重新选择。</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import request from "@/utils/request";

const route = useRoute();
const router = useRouter();
const testId = computed(() => route.params.testId);
const courseId = computed(() => route.query.courseId || 1);

const questions = ref([]);
const answers = ref({});
const loading = ref(false);
const submitting = ref(false);
const reporting = ref(false);
const grading = ref(null);
const report = ref(null);
const reportId = ref(null);
const err = ref("");

const gradingText = computed(() => (grading.value ? JSON.stringify(grading.value, null, 2) : ""));
const gradingSummary = computed(() => grading.value?.summary || null);
const gradingTotalScore = computed(() => {
  const value = grading.value?.totalScore;
  if (value == null || value === "") return "--";
  const score = Number(value);
  return Number.isFinite(score) ? score.toFixed(2) : String(value);
});
const canReport = computed(() => !!grading.value);
const unansweredCount = computed(() =>
  questions.value.filter((question) => {
    const value = answers.value[question.id];
    return typeof value !== "string" || !value.trim();
  }).length,
);

function toErrorMessage(error, fallback) {
  const raw = error?.response?.data?.msg || error?.response?.data?.detail || error?.message || fallback;
  if (/Connection refused|评估 AI 服务暂时不可用|请稍后重试/i.test(String(raw))) {
    return "评估 AI 服务当前不可用，请先启动 dev 联调所需的 AI 评估服务。";
  }
  return raw;
}

function initAnswers(list) {
  const next = {};
  for (const question of list) {
    next[question.id] = "";
  }
  answers.value = next;
}

function formatOption(opt) {
  if (typeof opt === "string") return opt;
  if (opt.label != null) return String(opt.label);
  if (opt.text != null) return String(opt.text);
  return JSON.stringify(opt);
}

function optionValue(opt) {
  if (typeof opt === "string") return opt;
  if (opt.value != null) return String(opt.value);
  if (opt.key != null) return String(opt.key);
  return formatOption(opt);
}

async function fetchQuestions() {
  loading.value = true;
  err.value = "";
  questions.value = [];
  grading.value = null;
  report.value = null;
  reportId.value = null;
  try {
    const res = await request.get(`/api/evaluation/question/test/${testId.value}`);
    const list = Array.isArray(res.data) ? res.data : [];
    questions.value = list;
    initAnswers(list);
    if (!list.length) {
      err.value = "当前测评暂无题目。";
    }
  } catch (error) {
    err.value = toErrorMessage(error, "题目加载失败");
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (unansweredCount.value > 0) {
    ElMessage.warning(`Please answer the remaining ${unansweredCount.value} question(s) before submitting.`);
    return;
  }

  submitting.value = true;
  err.value = "";
  report.value = null;
  reportId.value = null;
  try {
    const payload = {
      testId: Number(testId.value),
      answers: {},
    };
    for (const key of Object.keys(answers.value)) {
      payload.answers[key] = answers.value[key] || "";
    }
    const res = await request.post("/api/evaluation/answer/submit", payload);
    grading.value = res.data || {};
  } catch (error) {
    grading.value = null;
    err.value = toErrorMessage(error, "提交失败");
  } finally {
    submitting.value = false;
  }
}

async function genReport() {
  reporting.value = true;
  err.value = "";
  try {
    const res = await request.post(`/api/evaluation/report/generate/${testId.value}`);
    reportId.value = res.data;
    const detail = await request.get(`/api/evaluation/report/${reportId.value}`);
    report.value = detail.data || null;
  } catch (error) {
    reportId.value = null;
    report.value = null;
    err.value = toErrorMessage(error, "生成报告失败");
  } finally {
    reporting.value = false;
  }
}

function openReport() {
  if (!reportId.value) return;
  router.push({
    name: "aiEvaluationReport",
    params: { reportId: reportId.value },
    query: { courseId: courseId.value },
  });
}

onMounted(fetchQuestions);
</script>

<style scoped>
.examPage {
  max-width: 860px;
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

.back {
  color: var(--el-color-primary);
}

.mb {
  margin-bottom: 16px;
}

.metaBar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
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

.qblock {
  margin-bottom: 20px;
  padding: 18px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.qtitle {
  font-weight: 600;
  margin-bottom: 8px;
  line-height: 1.6;
}

.tag {
  color: #909399;
  margin-right: 8px;
}

.opts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.opt {
  display: flex;
  align-items: center;
  gap: 8px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 24px 0;
}

.mistakesBtn {
  display: inline-flex;
  align-items: center;
  padding: 8px 15px;
  border-radius: 999px;
  font-size: 14px;
  color: var(--el-color-warning);
  border: 1px solid var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
  text-decoration: none;
}

.result {
  margin-top: 16px;
}

.result pre {
  white-space: pre-wrap;
  font-size: 13px;
}

.empty {
  color: #999;
}

.gradeSummary {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 12px;
}

.stat {
  min-width: 72px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #f5f7fa;
}

.stat .lbl {
  display: block;
  font-size: 12px;
  color: #909399;
}

.stat strong {
  display: block;
  margin-top: 6px;
}

.stat.ok {
  background: #f0fdf4;
}

.stat.bad {
  background: #fef2f2;
}

.stat.highlight {
  background: #eff6ff;
}
</style>
