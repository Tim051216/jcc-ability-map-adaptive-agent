<template>
  <div class="aiReportPage">
    <section class="heroSection">
      <div class="container heroInner">
        <div class="heroContent">
          <div class="heroBadge">A3 学习报告</div>
          <h1>真实测评报告与学习进度统一查看</h1>
          <p>这里直接读取真实测评报告，并联动本地记录的学习路径进度，不再回退到 demo 或 mock 报告。</p>
          <div class="heroActions">
            <router-link class="navLink secondary" to="/main/index">返回首页</router-link>
            <router-link class="navLink light" :to="`/main/ai-evaluation?courseId=${courseId}`">课程测评</router-link>
            <router-link class="navLink dark" :to="`/main/ai-mistakes?courseId=${courseId}`">错题复盘</router-link>
            <el-button type="primary" size="large" :loading="loading" @click="generateLatestReport">
              {{ loading ? "正在生成..." : "生成综合学习报告" }}
            </el-button>
            <el-button size="large" plain :loading="loading" @click="loadLatestReport(true)">读取最近报告</el-button>
          </div>
        </div>

        <div class="heroPanel">
          <div class="summaryCard">
            <span>数据来源</span>
            <strong>{{ reportDetail ? "真实报告" : "暂无报告" }}</strong>
          </div>
          <div class="summaryCard">
            <span>课程 ID</span>
            <strong>#{{ courseId }}</strong>
          </div>
          <div class="summaryCard">
            <span>综合得分</span>
            <strong>{{ reportScore }}</strong>
          </div>
          <div class="summaryCard">
            <span>掌握等级</span>
            <strong>{{ reportDetail?.masteryLevel || "--" }}</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="container contentSection">
      <div class="controlPanel">
        <div class="panelTitle">
          <h2>报告范围</h2>
          <p>按课程读取你当前账号下的最近真实报告，也可以现场重新生成一份综合报告。</p>
        </div>

        <div class="fieldGrid">
          <label class="fieldItem">
            <span>课程 ID</span>
            <el-input-number v-model="courseId" :min="1" />
          </label>
        </div>

        <div class="hintPanel">
          <strong>联动说明</strong>
          <p>学习路径页推进步骤后，这里会同步展示最近一条本地学习进度记录；报告内容本身仍以真实后端结果为准。</p>
        </div>

        <div v-if="errorMessage" class="errorPanel">
          <strong>提示</strong>
          <p>{{ errorMessage }}</p>
        </div>
      </div>

      <div class="resultPanel">
        <div class="resultHeader">
          <div>
            <h2>结果总览</h2>
            <p>{{ reportSummary }}</p>
          </div>
          <div class="statusPill" :class="{ ready: !!reportDetail }">
            {{ reportDetail ? "已接入真实报告" : "当前没有可展示的报告" }}
          </div>
        </div>

        <div class="pathSyncCard">
          <div>
            <span>路径执行进度</span>
            <strong>{{ planProgressSummary.rateText }}</strong>
          </div>
          <div>
            <span>已完成步骤</span>
            <strong>{{ planProgressSummary.completedText }}</strong>
          </div>
          <div>
            <span>最近动作</span>
            <strong>{{ planProgressSummary.currentStepTitle }}</strong>
          </div>
          <p>{{ planProgressSummary.hint }}</p>
        </div>

        <template v-if="reportDetail">
          <div class="baseGrid">
            <div class="baseCard">
              <span>报告 ID</span>
              <strong>{{ reportDetail.id }}</strong>
            </div>
            <div class="baseCard">
              <span>报告类型</span>
              <strong>{{ reportDetail.reportTypeDesc || reportDetail.reportType || "--" }}</strong>
            </div>
            <div class="baseCard">
              <span>关联测评</span>
              <strong>{{ reportTestText }}</strong>
            </div>
          </div>

          <div class="resultBlock">
            <div class="blockTitle">优势</div>
            <div class="textCard">{{ reportDetail.strengths || "暂无" }}</div>
          </div>

          <div class="resultBlock dualBlock">
            <div class="subBlock">
              <div class="blockTitle">薄弱点</div>
              <div class="textCard">{{ reportDetail.weaknesses || "暂无" }}</div>
            </div>
            <div class="subBlock">
              <div class="blockTitle">改进建议</div>
              <div class="textCard">{{ reportDetail.improvementSuggestions || "暂无" }}</div>
            </div>
          </div>

          <div class="resultBlock">
            <div class="blockTitle">跳转联动</div>
            <div class="linkRow">
              <router-link class="flowLink" :to="`/main/ai-evaluation?courseId=${courseId}`">查看课程测评</router-link>
              <router-link class="flowLink" :to="reportLink">打开报告详情</router-link>
              <router-link class="flowLink" :to="mistakesLink">进入错题复盘</router-link>
            </div>
          </div>
        </template>

        <div v-else class="emptyState">
          当前课程还没有真实学习报告。可以先完成一次测评并生成报告，或者直接点击“生成综合学习报告”。
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { useRoute } from "vue-router";
import request from "@/utils/request";
import { getRecentPlanProgress } from "@/utils/a3StudentStore";

const route = useRoute();
const courseId = ref(Number(route.query.courseId || 1));

const loading = ref(false);
const reportDetail = ref(null);
const errorMessage = ref("");
const localPlanProgress = ref({ plan_id: null, items: [], completion_rate: 0 });

function toErrorMessage(error, fallback) {
  const raw = error?.response?.data?.msg || error?.response?.data?.detail || error?.message || fallback;
  if (/Connection refused|评估 AI 服务暂时不可用|请稍后重试/i.test(String(raw))) {
    return "综合学习报告依赖 dev 联调中的 AI 评估服务，当前该服务未启动或不可用。";
  }
  return raw;
}

const reportScore = computed(() => {
  const value = reportDetail.value?.overallScore;
  if (value == null || value === "") return "--";
  const score = Number(value);
  return Number.isFinite(score) ? score.toFixed(1) : String(value);
});

const reportSummary = computed(() => reportDetail.value?.reportSummary || "当前展示最新真实学习报告与路径进度联动。");
const reportTestText = computed(() => {
  const ids = reportDetail.value?.testIds;
  return Array.isArray(ids) && ids.length ? ids.join("、") : "--";
});
const reportLink = computed(() =>
  reportDetail.value?.id ? `/main/ai-evaluation/report/${reportDetail.value.id}?courseId=${courseId.value}` : `/main/ai-evaluation?courseId=${courseId.value}`,
);
const mistakesLink = computed(() => {
  if (!reportDetail.value?.id) {
    return `/main/ai-mistakes?courseId=${courseId.value}`;
  }
  const query = new URLSearchParams();
  query.set("courseId", String(courseId.value));
  query.set("reportId", String(reportDetail.value.id));
  const firstTestId = reportDetail.value?.testIds?.[0];
  if (firstTestId != null) {
    query.set("testId", String(firstTestId));
  }
  return `/main/ai-mistakes?${query.toString()}`;
});

const syncLocalPlanProgress = () => {
  localPlanProgress.value = getRecentPlanProgress();
};

const planProgressSummary = computed(() => {
  const progressItems = Array.isArray(localPlanProgress.value?.items) ? localPlanProgress.value.items : [];
  const completedCount = progressItems.filter((item) => item.status === "completed").length;
  const latestItem = [...progressItems].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))[0];
  const currentItem =
    progressItems.find((item) => item.status === "in_progress") ||
    progressItems.find((item) => item.status === "paused") ||
    latestItem;

  return {
    rateText: `${localPlanProgress.value?.completion_rate || 0}%`,
    completedText: progressItems.length ? `${completedCount} / ${progressItems.length}` : "--",
    currentStepTitle: currentItem?.step_id || "暂无记录",
    hint: latestItem?.last_action
      ? `最近动作：${latestItem.last_action}，更新时间：${latestItem.updated_at || "--"}`
      : "本地还没有学习路径推进记录，可先到“学习路径”页面操作后再回来查看。",
  };
});

async function loadLatestReport(showMessage = false) {
  loading.value = true;
  errorMessage.value = "";
  reportDetail.value = null;
  syncLocalPlanProgress();
  try {
    const listRes = await request.get("/api/evaluation/report/list", {
      params: { courseId: courseId.value },
    });
    const list = Array.isArray(listRes.data) ? listRes.data : [];
    const latest = list[0];
    if (!latest?.id) {
      errorMessage.value = "当前课程还没有真实报告。";
      return;
    }
    const detailRes = await request.get(`/api/evaluation/report/${latest.id}`);
    reportDetail.value = detailRes.data || null;
    if (showMessage) {
      ElMessage.success("已读取最近报告");
    }
  } catch (error) {
    errorMessage.value = toErrorMessage(error, "报告加载失败");
  } finally {
    loading.value = false;
  }
}

async function generateLatestReport() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const res = await request.post("/api/evaluation/report/generate/comprehensive", null, {
      params: { courseId: courseId.value },
    });
    const generatedId = res.data;
    if (!generatedId) {
      throw new Error("生成报告失败");
    }
    const detailRes = await request.get(`/api/evaluation/report/${generatedId}`);
    reportDetail.value = detailRes.data || null;
    syncLocalPlanProgress();
    ElMessage.success("综合学习报告已生成");
  } catch (error) {
    errorMessage.value = toErrorMessage(error, "综合学习报告生成失败");
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  syncLocalPlanProgress();
  loadLatestReport(false);
});

watch(courseId, () => {
  loadLatestReport(false);
});
</script>

<style scoped lang="scss">
.aiReportPage {
  min-height: 100vh;
  padding-bottom: 60px;
  background:
    radial-gradient(circle at top right, rgba(255, 167, 38, 0.12), transparent 26%),
    radial-gradient(circle at left 20%, rgba(12, 99, 214, 0.12), transparent 24%),
    linear-gradient(180deg, #f9fbfd 0%, #eff5f8 44%, #f8fafc 100%);
}

.heroSection {
  padding: 36px 0 22px;
}

.heroInner,
.contentSection {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 24px;
}

.heroContent,
.heroPanel,
.controlPanel,
.resultPanel {
  border: 1px solid rgba(133, 158, 187, 0.22);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 24px 60px rgba(31, 58, 94, 0.1);
  backdrop-filter: blur(18px);
  border-radius: 28px;
}

.heroContent,
.controlPanel,
.resultPanel {
  padding: 28px;
}

.heroPanel {
  padding: 22px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.heroBadge {
  display: inline-flex;
  padding: 8px 14px;
  border-radius: 999px;
  background: linear-gradient(135deg, #e87b16 0%, #0c63d6 100%);
  color: #fff;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.heroContent {
  h1 {
    margin-top: 16px;
    color: #14213d;
    font-size: 40px;
    line-height: 1.16;
  }

  p {
    margin-top: 18px;
    line-height: 1.9;
    color: #55657d;
  }
}

.heroActions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  flex-wrap: wrap;
}

.navLink {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 180px;
  height: 40px;
  padding: 0 18px;
  border-radius: 999px;
  background: #15304f;
  color: #fff;
  font-weight: 700;
}

.navLink.secondary {
  background: #e0f2fe;
  color: #123b74;
}

.navLink.light {
  background: #eef6ff;
  color: #1f4f8f;
}

.summaryCard,
.baseCard {
  padding: 18px;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(244, 248, 253, 0.98), rgba(230, 240, 247, 0.92));

  span {
    display: block;
    font-size: 12px;
    color: #6c7e95;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  strong {
    display: block;
    margin-top: 10px;
    font-size: 24px;
    color: #132238;
  }
}

.panelTitle,
.resultHeader {
  h2 {
    font-size: 24px;
    color: #172033;
  }

  p {
    margin-top: 8px;
    color: #66778e;
    line-height: 1.7;
  }
}

.fieldGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 20px;
}

.fieldItem {
  display: flex;
  flex-direction: column;
  gap: 8px;

  span {
    font-size: 13px;
    font-weight: 600;
    color: #51657d;
  }
}

.hintPanel,
.errorPanel {
  margin-top: 18px;
  padding: 16px 18px;
  border-radius: 18px;
}

.hintPanel {
  background: #eef6ff;
  color: #1f4f8f;
}

.errorPanel {
  background: #fff1f0;
  color: #8f2d28;
}

.statusPill {
  padding: 10px 14px;
  border-radius: 999px;
  background: #eef3f8;
  color: #5d7087;
  font-weight: 600;
}

.statusPill.ready {
  background: rgba(33, 163, 113, 0.12);
  color: #19724f;
}

.pathSyncCard {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 22px;
  padding: 18px 20px;
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(12, 99, 214, 0.08), rgba(232, 123, 22, 0.12));

  span {
    display: block;
    font-size: 12px;
    color: #5f7390;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  strong {
    display: block;
    margin-top: 8px;
    font-size: 20px;
    color: #132238;
  }

  p {
    grid-column: 1 / -1;
    margin: 2px 0 0;
    color: #55657d;
    line-height: 1.7;
  }
}

.baseGrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 24px;
}

.resultBlock {
  margin-top: 22px;
  padding: 22px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(249, 251, 254, 0.98), rgba(239, 245, 250, 0.94));
}

.blockTitle {
  font-size: 18px;
  font-weight: 700;
  color: #12233b;
}

.dualBlock {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.subBlock {
  border-radius: 22px;
  background: #fff;
  padding: 18px;
}

.textCard {
  margin-top: 14px;
  padding: 16px 18px;
  border-radius: 18px;
  background: #fff;
  color: #4f6277;
  line-height: 1.8;
  white-space: pre-wrap;
}

.linkRow {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 14px;
}

.flowLink {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 160px;
  padding: 10px 16px;
  border-radius: 999px;
  background: #eef6ff;
  color: #0c63d6;
  font-weight: 600;
}

.emptyState {
  margin-top: 22px;
  padding: 22px;
  border-radius: 24px;
  background: #fff7ed;
  color: #9a3412;
  line-height: 1.8;
}

@media screen and (max-width: 1280px) {
  .heroInner,
  .contentSection,
  .pathSyncCard,
  .baseGrid,
  .dualBlock,
  .fieldGrid,
  .heroPanel {
    grid-template-columns: 1fr;
  }
}
</style>
