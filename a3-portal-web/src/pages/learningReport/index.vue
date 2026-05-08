<template>
  <div class="aiReportPage">
    <section class="heroSection">
      <div class="container heroInner">
        <div class="heroContent">
          <div class="heroBadge">AI Evaluation Report</div>
          <h1>学习测评与报告页</h1>
          <p>
            这里把多智能体给出的评估结果落成正式学生端报告，突出分层测评、指标量化、薄弱点分析和回流建议，
            对应题目里的“学习效果评估 + 个性化报告 + 闭环反馈”。
          </p>
          <div class="heroActions">
            <router-link class="navLink light" to="/main/index">返回首页</router-link>
            <router-link class="navLink dark" to="/main/ai-path">返回学习专区</router-link>
            <el-button type="primary" size="large" :loading="loading" @click="runEvaluation">
              {{ loading ? "评估中..." : "重新生成评估" }}
            </el-button>
            <el-button size="large" plain @click="loadLatestEvaluation">读取最近一次评估</el-button>
          </div>
        </div>
        <div class="heroPanel">
          <div class="summaryCard">
            <span>总分</span>
            <strong>{{ evaluationData?.overall_score || "--" }}</strong>
          </div>
          <div class="summaryCard">
            <span>掌握等级</span>
            <strong>{{ evaluationData?.mastery_level || "待评估" }}</strong>
          </div>
          <div class="summaryCard">
            <span>分层结果</span>
            <strong>{{ layeredResults.length }}</strong>
          </div>
          <div class="summaryCard">
            <span>指标项</span>
            <strong>{{ metrics.length }}</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="container contentSection">
      <div class="controlPanel">
        <div class="panelTitle">
          <h2>评估参数</h2>
          <p>模拟学生端提交阶段学习结果后的评估与报告生成。</p>
        </div>

        <div class="fieldGrid">
          <label class="fieldItem">
            <span>用户 ID</span>
            <el-input-number v-model="form.user_id" :min="1" :max="999999" />
          </label>
          <label class="fieldItem">
            <span>课程编码</span>
            <el-input v-model="form.course_code" />
          </label>
          <label class="fieldItem">
            <span>学习时长</span>
            <el-input-number v-model="form.learning_duration_minutes" :min="30" :max="300" />
          </label>
          <label class="fieldItem">
            <span>资源使用数</span>
            <el-input-number v-model="form.resource_usage_count" :min="1" :max="20" />
          </label>
        </div>

        <div v-if="errorMessage" class="errorPanel">
          <strong>评估加载失败</strong>
          <p>{{ errorMessage }}</p>
        </div>

        <div class="hintPanel">
          <strong>建议演示话术</strong>
          <p>在路径执行页展示完节点任务后，切到这里讲“系统如何量化掌握度、输出报告，并反向调整画像与路径”。</p>
        </div>
      </div>

      <div class="resultPanel">
        <div class="resultHeader">
          <div>
            <h2>测评报告总览</h2>
            <p>{{ evaluationData?.report_summary || "生成后这里会展示测评报告摘要。" }}</p>
          </div>
          <div class="statusPill" :class="{ ready: !!evaluationData }">
            {{ evaluationData ? "报告已生成" : "等待生成" }}
          </div>
        </div>

        <div v-if="layeredResults.length" class="layerGrid">
          <div v-for="layer in layeredResults" :key="layer.level" class="layerCard">
            <span>{{ layer.level }}</span>
            <strong>{{ layer.score }}</strong>
            <p>{{ layer.comment }}</p>
            <em>{{ layer.status }}</em>
          </div>
        </div>
        <div v-else class="emptyState">暂无分层测评结果，点击“重新生成评估”开始演示。</div>

        <div class="resultBlock">
          <div class="blockTitle">指标量化</div>
          <div v-if="metrics.length" class="metricList">
            <div v-for="metric in metrics" :key="metric.metric_name" class="metricCard">
              <div class="metricHead">
                <strong>{{ metric.metric_name }}</strong>
                <span>{{ metric.score }}</span>
              </div>
              <p>{{ metric.comment }}</p>
            </div>
          </div>
          <div v-else class="emptyState">生成后这里会展示知识掌握度、投入度、资源效率等指标。</div>
        </div>

        <div class="resultBlock dualBlock">
          <div class="subBlock">
            <div class="blockTitle">薄弱点与建议</div>
            <div v-if="weakPoints.length || suggestions.length" class="adviceList">
              <div v-for="item in weakPoints" :key="item" class="tagItem warn">{{ item }}</div>
              <div v-for="item in suggestions" :key="item" class="adviceItem">{{ item }}</div>
            </div>
            <div v-else class="emptyState">暂无薄弱点与建议。</div>
          </div>
          <div class="subBlock">
            <div class="blockTitle">回流方向</div>
            <div v-if="feedbackItems.length" class="adviceList">
              <div v-for="item in feedbackItems" :key="item" class="adviceItem">{{ item }}</div>
            </div>
            <div v-else class="emptyState">暂无闭环反馈方向。</div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { evaluateAiLearning, getLatestAiEvaluation, getLatestAiLearningPlan } from "@/api/ai";

const form = reactive({
  user_id: 1,
  course_code: "ml_intro",
  learning_duration_minutes: 120,
  resource_usage_count: 3,
});

const loading = ref(false);
const evaluationData = ref(null);
const latestPlan = ref(null);
const errorMessage = ref("");

const layeredResults = computed(() => evaluationData.value?.layered_results || []);
const metrics = computed(() => evaluationData.value?.metrics || []);
const weakPoints = computed(() => evaluationData.value?.weak_points || []);
const suggestions = computed(() => evaluationData.value?.suggestions || []);
const feedbackItems = computed(() => {
  const items = [];
  const pathFeedback = evaluationData.value?.path_feedback || {};
  const profileFeedback = evaluationData.value?.profile_feedback || {};
  if (pathFeedback.next_focus) {
    items.push(`路径侧建议优先强化：${pathFeedback.next_focus}`);
  }
  for (const item of pathFeedback.recommended_changes || []) {
    items.push(`路径调整：${item}`);
  }
  if (profileFeedback.summary) {
    items.push(`画像回流：${profileFeedback.summary}`);
  }
  return items;
});

const loadLatestPlan = async () => {
  latestPlan.value = await getLatestAiLearningPlan({
    user_id: form.user_id,
    course_code: form.course_code,
  });
};

const runEvaluation = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    await loadLatestPlan();
    evaluationData.value = await evaluateAiLearning({
      user_id: form.user_id,
      course_code: form.course_code,
      scene: "comprehensive",
      plan: latestPlan.value,
      profile: {
        dimensions: {
          weak_point_preference: {
            evidence: ["过拟合与泛化", "模型评估"],
          },
        },
      },
      resources: (latestPlan.value?.steps || []).flatMap((step) => step.resource_pushes || []),
      learning_duration_minutes: form.learning_duration_minutes,
      resource_usage_count: form.resource_usage_count,
      answers: [],
    });
    ElMessage.success("学习评估报告已生成");
  } catch (error) {
    errorMessage.value = error?.response?.data?.detail || error?.message || "学习评估生成失败";
  } finally {
    loading.value = false;
  }
};

const loadLatestEvaluation = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    evaluationData.value = await getLatestAiEvaluation({
      user_id: form.user_id,
      course_code: form.course_code,
    });
    ElMessage.success("已加载最近一次学习评估");
  } catch (error) {
    errorMessage.value = error?.response?.data?.detail || error?.message || "暂无历史学习评估";
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await loadLatestEvaluation();
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
  min-width: 128px;
  height: 40px;
  padding: 0 18px;
  border-radius: 999px;
  font-weight: 700;
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

.summaryCard {
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

  p {
    margin-top: 8px;
    line-height: 1.7;
  }
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

.layerGrid,
.metricList,
.adviceList {
  display: grid;
  gap: 14px;
}

.layerGrid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 24px;
}

.layerCard,
.metricCard,
.subBlock,
.emptyState {
  border-radius: 22px;
  background: #fff;
}

.layerCard {
  padding: 18px;

  span {
    color: #6c7e95;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  strong {
    display: block;
    margin-top: 10px;
    color: #13253f;
    font-size: 28px;
  }

  p {
    margin-top: 8px;
    color: #607286;
    line-height: 1.7;
  }

  em {
    display: inline-flex;
    margin-top: 10px;
    color: #d46d0b;
    font-style: normal;
  }
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

.metricCard {
  padding: 18px;
}

.metricHead {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: baseline;

  strong {
    color: #15304f;
    font-size: 18px;
  }

  span {
    color: #0c63d6;
    font-weight: 700;
    font-size: 20px;
  }
}

.metricCard p {
  margin-top: 10px;
  color: #5f7186;
  line-height: 1.8;
}

.dualBlock {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.subBlock {
  padding: 18px;
}

.adviceList {
  margin-top: 14px;
}

.adviceItem,
.tagItem {
  padding: 14px 16px;
  border-radius: 18px;
  background: #f6f9fc;
  color: #4f6277;
  line-height: 1.7;
}

.tagItem.warn {
  background: #fff3dd;
  color: #8a5a08;
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
  .contentSection,
  .layerGrid,
  .dualBlock,
  .fieldGrid,
  .heroPanel {
    grid-template-columns: 1fr;
  }
}
</style>
