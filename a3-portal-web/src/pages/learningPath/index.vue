<template>
  <div class="aiPathPage">
    <section class="heroSection">
      <div class="container heroInner">
        <div class="heroContent">
          <div class="heroBadge">AI Learning Path</div>
          <h1>个性化学习路径执行页</h1>
          <p>
            这里把多智能体生成的学习路径落成更正式的学生端页面，突出阶段推进、节点任务、资源推送和风险提醒，
            更贴近你们 PPT 里的“学习路径页 + 闭环执行”。
          </p>
          <div class="heroActions">
            <router-link class="navLink light" to="/main/index">返回首页</router-link>
            <el-button type="primary" size="large" :loading="loading" @click="buildPlan">
              {{ loading ? "生成中..." : "重新生成路径" }}
            </el-button>
            <el-button size="large" plain @click="loadLatestPlan">读取最近一次路径</el-button>
            <router-link class="reportLink" to="/main/ai-report">进入测评报告页</router-link>
          </div>
        </div>
        <div class="heroPanel">
          <div class="summaryCard">
            <span>当前阶段</span>
            <strong>{{ planData?.current_stage || "待生成" }}</strong>
          </div>
          <div class="summaryCard">
            <span>完成率</span>
            <strong>{{ completionRateText }}</strong>
          </div>
          <div class="summaryCard">
            <span>阶段数</span>
            <strong>{{ stages.length }}</strong>
          </div>
          <div class="summaryCard">
            <span>节点数</span>
            <strong>{{ steps.length }}</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="container contentSection">
      <div class="controlPanel">
        <div class="panelTitle">
          <h2>路径参数</h2>
          <p>这里模拟学生端/运营端对学习目标与节奏的配置输入。</p>
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
            <span>可用天数</span>
            <el-input-number v-model="form.available_days" :min="3" :max="14" />
          </label>
          <label class="fieldItem">
            <span>每日时长</span>
            <el-input-number v-model="form.daily_study_minutes" :min="20" :max="180" />
          </label>
        </div>

        <label class="messageField">
          <span>学习目标</span>
          <el-input
            v-model="form.target"
            type="textarea"
            :rows="4"
            resize="none"
            placeholder="请输入学习目标，例如：3 天内完成过拟合专题复习并准备答辩演示"
          />
        </label>

        <div v-if="errorMessage" class="errorPanel">
          <strong>路径加载失败</strong>
          <p>{{ errorMessage }}</p>
        </div>

        <div class="hintPanel">
          <strong>建议演示话术</strong>
          <p>先在 AI 协同演示页生成结果，再切到这里展示学生端如何执行、跟踪和回看路径节点。</p>
        </div>
      </div>

      <div class="resultPanel">
        <div class="resultHeader">
          <div>
            <h2>学习路径总览</h2>
            <p>{{ planData?.summary || "生成后这里会展示学习路径摘要。" }}</p>
          </div>
          <div class="statusPill" :class="{ ready: !!planData }">
            {{ planData ? "路径已生成" : "等待生成" }}
          </div>
        </div>

        <div v-if="stages.length" class="stageTimeline">
          <div v-for="stage in stages" :key="`${stage.stage_no}-${stage.stage_name}`" class="stageCard">
            <span>阶段 {{ stage.stage_no }}</span>
            <strong>{{ stage.stage_name }}</strong>
            <p>{{ stage.focus }}</p>
            <em>{{ stage.status }}</em>
          </div>
        </div>
        <div v-else class="emptyState">暂无阶段数据，点击“重新生成路径”开始演示。</div>

        <div class="resultBlock">
          <div class="blockTitle">节点任务</div>
          <div v-if="steps.length" class="stepList">
            <div v-for="step in steps" :key="`${step.day}-${step.title}`" class="stepCard">
              <div class="stepHead">
                <div>
                  <span>Day {{ step.day }}</span>
                  <strong>{{ step.title }}</strong>
                </div>
                <em>{{ step.status }}</em>
              </div>
              <p class="stepObjective">{{ step.objective }}</p>
              <div class="taskList">
                <div v-for="task in step.tasks || []" :key="task" class="taskItem">{{ task }}</div>
              </div>
              <div v-if="step.resource_pushes?.length" class="pushList">
                <div v-for="push in step.resource_pushes" :key="push.title" class="pushItem">
                  <strong>{{ push.title }}</strong>
                  <p>{{ push.reason }}</p>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="emptyState">生成后这里会按阶段展示每日学习节点和资源推送。</div>
        </div>

        <div class="resultBlock dualBlock">
          <div class="subBlock">
            <div class="blockTitle">风险提醒</div>
            <div v-if="riskAlerts.length" class="tagList">
              <span v-for="item in riskAlerts" :key="item">{{ item }}</span>
            </div>
            <div v-else class="emptyState">暂无风险提醒。</div>
          </div>
          <div class="subBlock">
            <div class="blockTitle">动态调优</div>
            <div v-if="dynamicAdjustments.length" class="adjustmentList">
              <div v-for="item in dynamicAdjustments" :key="item" class="adjustmentItem">{{ item }}</div>
            </div>
            <div v-else class="emptyState">暂无动态调优建议。</div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { generateAiLearningPlan, getLatestAiLearningPlan } from "@/api/ai";

const form = reactive({
  user_id: 1,
  course_code: "ml_intro",
  target: "3 天内完成过拟合专题复习并准备答辩演示",
  available_days: 3,
  daily_study_minutes: 45,
  profile: {
    recommended_resource_types: ["lecture_note", "mind_map", "quiz_set"],
    dimensions: {
      weak_point_preference: {
        evidence: ["过拟合与泛化", "模型评估"],
      },
    },
  },
});

const loading = ref(false);
const planData = ref(null);
const errorMessage = ref("");

const stages = computed(() => planData.value?.stages || []);
const steps = computed(() => planData.value?.steps || []);
const riskAlerts = computed(() => planData.value?.risk_alerts || []);
const dynamicAdjustments = computed(() => planData.value?.dynamic_adjustments || []);
const completionRateText = computed(() => {
  const rate = planData.value?.completion_rate;
  return typeof rate === "number" ? `${rate.toFixed(0)}%` : "--";
});

const buildPlan = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    planData.value = await generateAiLearningPlan({
      user_id: form.user_id,
      course_code: form.course_code,
      target: form.target,
      available_days: form.available_days,
      daily_study_minutes: form.daily_study_minutes,
      profile: form.profile,
    });
    ElMessage.success("学习路径已生成");
  } catch (error) {
    errorMessage.value = error?.response?.data?.detail || error?.message || "学习路径生成失败";
  } finally {
    loading.value = false;
  }
};

const loadLatestPlan = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    planData.value = await getLatestAiLearningPlan({
      user_id: form.user_id,
      course_code: form.course_code,
    });
    ElMessage.success("已加载最近一次学习路径");
  } catch (error) {
    errorMessage.value = error?.response?.data?.detail || error?.message || "暂无历史学习路径";
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await loadLatestPlan();
});
</script>

<style scoped lang="scss">
.aiPathPage {
  min-height: 100vh;
  padding-bottom: 60px;
  background:
    radial-gradient(circle at top left, rgba(29, 151, 108, 0.14), transparent 28%),
    radial-gradient(circle at right 18%, rgba(25, 92, 189, 0.14), transparent 24%),
    linear-gradient(180deg, #f5f9fc 0%, #edf3f8 46%, #f8fafc 100%);
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
  background: linear-gradient(135deg, #0c63d6 0%, #1ea57f 100%);
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
  background: #eef5fb;
  color: #16304f;
  font-weight: 700;

  &:hover {
    color: #16304f;
    background: #e2edf8;
  }
}

.reportLink {
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

  &:hover {
    color: #fff;
    background: #10243c;
  }
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

.fieldItem,
.messageField {
  display: flex;
  flex-direction: column;
  gap: 8px;

  span {
    font-size: 13px;
    font-weight: 600;
    color: #51657d;
  }
}

.messageField {
  margin-top: 18px;
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

.stageTimeline,
.stepList,
.tagList,
.adjustmentList {
  display: grid;
  gap: 14px;
}

.stageTimeline {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 24px;
}

.stageCard,
.stepCard,
.subBlock,
.emptyState {
  border-radius: 22px;
  background: #fff;
}

.stageCard {
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
    font-size: 20px;
  }

  p {
    margin-top: 8px;
    color: #607286;
    line-height: 1.7;
  }

  em {
    display: inline-flex;
    margin-top: 10px;
    color: #145db8;
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

.stepCard {
  padding: 18px;
}

.stepHead {
  display: flex;
  justify-content: space-between;
  gap: 16px;

  span {
    color: #68809d;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  strong {
    display: block;
    margin-top: 8px;
    font-size: 20px;
    color: #14243b;
  }

  em {
    color: #1767c3;
    font-style: normal;
  }
}

.stepObjective {
  margin-top: 12px;
  color: #5f7186;
  line-height: 1.8;
}

.taskList,
.pushList {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.taskItem,
.pushItem,
.adjustmentItem {
  padding: 14px 16px;
  border-radius: 18px;
  background: #f6f9fc;
  color: #4f6277;
  line-height: 1.7;
}

.pushItem {
  strong {
    color: #15304f;
  }

  p {
    margin-top: 6px;
  }
}

.dualBlock {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.subBlock {
  padding: 18px;
}

.tagList {
  margin-top: 14px;

  span {
    padding: 10px 12px;
    border-radius: 999px;
    background: #fff3dd;
    color: #8a5a08;
    font-size: 12px;
  }
}

.adjustmentList {
  margin-top: 14px;
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
  .stageTimeline,
  .dualBlock,
  .fieldGrid,
  .heroPanel {
    grid-template-columns: 1fr;
  }
}
</style>
