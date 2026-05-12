<template>
  <div class="aiWorkbench">
    <div class="workbenchHeader">
      <div>
        <div class="eyebrow">Student Workbench</div>
        <h2>AI 个性化学习工作台</h2>
        <p>聚合画像、路径、评估和执行入口，模拟学生端首页对当日学习任务与学情的总览。</p>
      </div>
      <el-button type="primary" plain :loading="loading" @click="refreshWorkbench">刷新 AI 数据</el-button>
    </div>

    <div class="overviewGrid">
      <div class="overviewCard">
        <span>画像标签</span>
        <strong>{{ profileTagsText }}</strong>
        <p>{{ profileSummaryText }}</p>
      </div>
      <div class="overviewCard">
        <span>当前路径</span>
        <strong>{{ currentStageText }}</strong>
        <p>{{ planSummaryText }}</p>
      </div>
      <div class="overviewCard">
        <span>最近评估</span>
        <strong>{{ evaluationScoreText }}</strong>
        <p>{{ evaluationSummaryText }}</p>
      </div>
    </div>

    <div class="entryGrid">
      <router-link class="entryCard" to="/main/ai-demo">
        <span>01</span>
        <strong>AI 协同演示页</strong>
        <p>演示多智能体如何协同生成画像、路径、资源和评估。</p>
      </router-link>
      <router-link class="entryCard" to="/main/ai-path">
        <span>02</span>
        <strong>学习路径页</strong>
        <p>展示阶段推进、节点任务、资源推送与动态调优。</p>
      </router-link>
      <router-link class="entryCard" to="/main/ai-report">
        <span>03</span>
        <strong>测评报告页</strong>
        <p>展示分层测评、量化指标、薄弱点与回流建议。</p>
      </router-link>
      <router-link class="entryCard" to="/main/ai-ops">
        <span>04</span>
        <strong>运维总览页</strong>
        <p>展示服务状态、任务规模、后台告警和处理建议。</p>
      </router-link>
    </div>

    <div class="taskPanel">
      <div class="panelTitle">今日学习提醒</div>
      <div class="taskList">
        <div class="taskItem">
          <strong>优先阶段</strong>
          <p>{{ currentStageText }}</p>
        </div>
        <div class="taskItem">
          <strong>待关注薄弱点</strong>
          <p>{{ weakPointText }}</p>
        </div>
        <div class="taskItem">
          <strong>建议动作</strong>
          <p>{{ recommendedActionText }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { getLatestAiEvaluation, getLatestAiLearningPlan, getLatestAiProfile } from "@/api/ai";

const loading = ref(false);
const profile = ref(null);
const plan = ref(null);
const evaluation = ref(null);

const profileTagsText = computed(() => (profile.value?.profile_tags || []).slice(0, 4).join(" / ") || "待生成画像");
const profileSummaryText = computed(() => profile.value?.summary || "画像生成后这里会展示学习者摘要。");
const currentStageText = computed(() => plan.value?.current_stage || "待生成学习路径");
const planSummaryText = computed(() => plan.value?.summary || "路径生成后这里会展示学习阶段摘要。");
const evaluationScoreText = computed(() =>
  typeof evaluation.value?.overall_score === "number" ? `${evaluation.value.overall_score} 分` : "待生成评估",
);
const evaluationSummaryText = computed(() => evaluation.value?.report_summary || "评估生成后这里会展示报告摘要。");
const weakPointText = computed(() => (evaluation.value?.weak_points || []).slice(0, 1)[0] || "待识别");
const recommendedActionText = computed(() => (evaluation.value?.recommended_actions || []).slice(0, 1)[0] || "先生成路径和评估");

const refreshWorkbench = async () => {
  loading.value = true;
  try {
    const [profileRes, planRes, evaluationRes] = await Promise.allSettled([
      getLatestAiProfile({ user_id: 1 }),
      getLatestAiLearningPlan({ user_id: 1, course_code: "ml_intro" }),
      getLatestAiEvaluation({ user_id: 1, course_code: "ml_intro" }),
    ]);
    profile.value = profileRes.status === "fulfilled" ? profileRes.value : null;
    plan.value = planRes.status === "fulfilled" ? planRes.value : null;
    evaluation.value = evaluationRes.status === "fulfilled" ? evaluationRes.value : null;
  } catch (error) {
    ElMessage.warning("AI 工作台数据刷新失败");
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await refreshWorkbench();
});
</script>

<style scoped lang="scss">
.aiWorkbench {
  margin-top: 26px;
  padding: 30px;
  border-radius: 32px;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.16), transparent 26%),
    linear-gradient(135deg, #0f2f5b 0%, #145a92 46%, #18896f 100%);
  box-shadow: 0 28px 54px rgba(18, 66, 112, 0.2);
  color: #fff;
}

.workbenchHeader {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
}

.eyebrow {
  display: inline-flex;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 12px;
  letter-spacing: 0.08em;
}

h2 {
  margin-top: 16px;
  font-size: 36px;
  line-height: 1.2;
}

.workbenchHeader p {
  margin-top: 12px;
  max-width: 760px;
  line-height: 1.9;
  color: rgba(255, 255, 255, 0.86);
}

.overviewGrid,
.entryGrid,
.taskList {
  display: grid;
  gap: 16px;
}

.overviewGrid,
.entryGrid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 24px;
}

.entryGrid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.overviewCard,
.entryCard,
.taskItem {
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
}

.overviewCard,
.taskItem {
  padding: 20px;
}

.overviewCard span,
.entryCard span {
  display: block;
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.overviewCard strong,
.entryCard strong,
.taskItem strong {
  display: block;
  margin-top: 10px;
}

.overviewCard strong {
  font-size: 24px;
}

.overviewCard p,
.entryCard p,
.taskItem p {
  margin-top: 10px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.84);
}

.entryCard {
  padding: 22px;
  color: #fff;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  strong {
    font-size: 24px;
  }

  &:hover {
    color: #fff;
    transform: translateY(-3px);
    box-shadow: 0 20px 34px rgba(10, 31, 58, 0.18);
  }
}

.taskPanel {
  margin-top: 24px;
}

.panelTitle {
  font-size: 18px;
  font-weight: 700;
}

.taskList {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 16px;
}

@media screen and (max-width: 1280px) {
  .workbenchHeader,
  .overviewGrid,
  .entryGrid,
  .taskList {
    grid-template-columns: 1fr;
  }
}
</style>
