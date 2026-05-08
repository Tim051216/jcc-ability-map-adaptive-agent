<template>
  <div class="aiOpsPage">
    <section class="heroSection">
      <div class="container heroInner">
        <div class="heroContent">
          <div class="heroBadge">AI Ops Center</div>
          <h1>智能体运维与后台总览</h1>
          <p>
            这里对应题目与 PPT 里的后台端视角，集中展示服务状态、任务规模、画像/路径/评估沉淀，以及待关注事项，
            方便你答辩时讲“系统不只有学生端，也有后台管控能力”。
          </p>
          <div class="heroActions">
            <router-link class="navLink light" to="/main/index">返回首页</router-link>
            <router-link class="navLink dark" to="/main/ai-path">返回学习专区</router-link>
            <el-button type="primary" size="large" :loading="loading" @click="loadOverview">
              {{ loading ? "刷新中..." : "刷新总览" }}
            </el-button>
          </div>
        </div>
        <div class="heroPanel">
          <div class="summaryCard">
            <span>API 状态</span>
            <strong>{{ overview?.service_status?.api || "--" }}</strong>
          </div>
          <div class="summaryCard">
            <span>Embedding</span>
            <strong>{{ overview?.service_status?.embedding || "--" }}</strong>
          </div>
          <div class="summaryCard">
            <span>运行任务</span>
            <strong>{{ metrics.running_task_count ?? "--" }}</strong>
          </div>
          <div class="summaryCard">
            <span>失败任务</span>
            <strong>{{ metrics.failed_task_count ?? "--" }}</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="container contentSection">
      <div class="resultPanel fullPanel">
        <div class="resultHeader">
          <div>
            <h2>运行指标</h2>
            <p>聚合当前 AI 服务在画像、路径、评估和任务执行层面的核心规模指标。</p>
          </div>
          <div class="statusPill" :class="{ ready: !!overview }">
            {{ overview ? "数据已同步" : "等待加载" }}
          </div>
        </div>

        <div class="metricGrid">
          <div class="metricCard">
            <span>画像快照</span>
            <strong>{{ metrics.profile_count ?? 0 }}</strong>
          </div>
          <div class="metricCard">
            <span>学习路径</span>
            <strong>{{ metrics.plan_count ?? 0 }}</strong>
          </div>
          <div class="metricCard">
            <span>评估报告</span>
            <strong>{{ metrics.evaluation_count ?? 0 }}</strong>
          </div>
          <div class="metricCard">
            <span>生成任务</span>
            <strong>{{ metrics.task_count ?? 0 }}</strong>
          </div>
        </div>

        <div class="resultBlock dualBlock">
          <div class="subBlock">
            <div class="blockTitle">最新沉淀</div>
            <div class="infoList">
              <div class="infoItem">
                <strong>最新画像版本</strong>
                <p>{{ latest.profile_version || "--" }}</p>
              </div>
              <div class="infoItem">
                <strong>最近路径摘要</strong>
                <p>{{ latest.latest_plan_summary || "暂无" }}</p>
              </div>
              <div class="infoItem">
                <strong>最近评估结果</strong>
                <p>
                  {{ latest.latest_evaluation_type || "暂无" }}
                  <span v-if="latest.latest_evaluation_score"> / {{ latest.latest_evaluation_score }} 分</span>
                </p>
              </div>
            </div>
          </div>

          <div class="subBlock">
            <div class="blockTitle">待关注事项</div>
            <div v-if="alerts.length" class="alertList">
              <div v-for="item in alerts" :key="item" class="alertItem">{{ item }}</div>
            </div>
            <div v-else class="emptyState">暂无告警。</div>
          </div>
        </div>

        <div class="resultBlock">
          <div class="blockTitle">后台处理建议</div>
          <div v-if="pendingReviews.length" class="reviewList">
            <div v-for="item in pendingReviews" :key="item" class="reviewItem">{{ item }}</div>
          </div>
          <div v-else class="emptyState">暂无待处理事项。</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { getAiAdminOverview } from "@/api/ai";

const loading = ref(false);
const overview = ref(null);

const metrics = computed(() => overview.value?.metrics || {});
const latest = computed(() => overview.value?.latest_snapshot || {});
const alerts = computed(() => overview.value?.alerts || []);
const pendingReviews = computed(() => overview.value?.pending_reviews || []);

const loadOverview = async () => {
  loading.value = true;
  try {
    overview.value = await getAiAdminOverview();
  } catch (error) {
    ElMessage.warning(error?.response?.data?.detail || error?.message || "后台总览加载失败");
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await loadOverview();
});
</script>

<style scoped lang="scss">
.aiOpsPage {
  min-height: 100vh;
  padding-bottom: 60px;
  background:
    radial-gradient(circle at top left, rgba(17, 87, 180, 0.12), transparent 26%),
    radial-gradient(circle at right 18%, rgba(27, 166, 113, 0.12), transparent 22%),
    linear-gradient(180deg, #f7fafc 0%, #edf3f8 48%, #f9fbfd 100%);
}

.heroSection {
  padding: 36px 0 22px;
}

.heroInner {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 24px;
}

.heroContent,
.heroPanel,
.resultPanel {
  border: 1px solid rgba(133, 158, 187, 0.22);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 24px 60px rgba(31, 58, 94, 0.1);
  backdrop-filter: blur(18px);
  border-radius: 28px;
}

.heroContent,
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
  background: linear-gradient(135deg, #0c63d6 0%, #1ea57f 100%);
  color: #fff;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.heroContent h1 {
  margin-top: 16px;
  color: #14213d;
  font-size: 40px;
  line-height: 1.16;
}

.heroContent p {
  margin-top: 18px;
  line-height: 1.9;
  color: #55657d;
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
  min-width: 128px;
  height: 40px;
  padding: 0 18px;
  border-radius: 999px;
  font-weight: 700;
  transition: 0.2s ease;
}

.navLink.light {
  background: #eef5fb;
  color: #16304f;
}

.navLink.light:hover {
  color: #16304f;
  background: #e2edf8;
}

.navLink.dark {
  background: #15304f;
  color: #fff;
}

.navLink.dark:hover {
  color: #fff;
  background: #10243c;
}

.summaryCard,
.metricCard,
.infoItem,
.alertItem,
.reviewItem,
.subBlock,
.emptyState {
  border-radius: 22px;
  background: #fff;
}

.summaryCard,
.metricCard {
  padding: 18px;
  background: linear-gradient(180deg, rgba(244, 248, 253, 0.98), rgba(230, 240, 247, 0.92));
}

.summaryCard span,
.metricCard span {
  display: block;
  font-size: 12px;
  color: #6c7e95;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.summaryCard strong,
.metricCard strong {
  display: block;
  margin-top: 10px;
  font-size: 24px;
  color: #132238;
}

.contentSection {
  display: block;
}

.fullPanel {
  width: 100%;
}

.resultHeader {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.resultHeader h2 {
  font-size: 24px;
  color: #172033;
}

.resultHeader p {
  margin-top: 8px;
  color: #66778e;
  line-height: 1.7;
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

.metricGrid,
.infoList,
.alertList,
.reviewList {
  display: grid;
  gap: 14px;
}

.metricGrid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 24px;
}

.resultBlock {
  margin-top: 22px;
  padding: 22px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(249, 251, 254, 0.98), rgba(239, 245, 250, 0.94));
}

.dualBlock {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.subBlock {
  padding: 18px;
}

.blockTitle {
  font-size: 18px;
  font-weight: 700;
  color: #12233b;
}

.infoList,
.alertList,
.reviewList {
  margin-top: 14px;
}

.infoItem,
.alertItem,
.reviewItem {
  padding: 16px;
}

.infoItem strong {
  color: #15304f;
}

.infoItem p,
.alertItem,
.reviewItem {
  margin-top: 8px;
  color: #5f7186;
  line-height: 1.8;
}

.emptyState {
  margin-top: 16px;
  padding: 20px;
  border: 1px dashed #cad8e6;
  color: #6b7d92;
  background: rgba(255, 255, 255, 0.55);
}

@media screen and (max-width: 1280px) {
  .heroInner,
  .heroPanel,
  .metricGrid,
  .dualBlock {
    grid-template-columns: 1fr;
  }
}
</style>
