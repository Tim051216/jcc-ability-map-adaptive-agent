<template>
  <div class="aiPathPage">
    <section class="heroSection">
      <div class="container heroInner">
        <div class="heroContent">
          <div class="heroBadge">AI 学习路径</div>
          <h1>稳定可演示的个性化学习路径闭环</h1>
          <p>
            页面优先读取真实学习路径与进度接口；若接口暂无结果或调用失败，则自动切换到本地演示路径与进度，
            保证“生成路径 - 推进步骤 - 联动报告”的主链路不白屏。
          </p>
          <div class="heroActions">
            <router-link class="reportLink secondary" to="/main/index">返回首页</router-link>
            <el-button type="primary" size="large" :loading="loading" @click="buildPlan">
              {{ loading ? "正在生成..." : "重新生成学习路径" }}
            </el-button>
            <el-button size="large" plain :loading="loadingLatest" @click="loadLatestPlan">
              读取最近结果
            </el-button>
            <router-link class="reportLink tertiary" to="/main/ai-resources">进入资源推荐</router-link>
            <router-link class="reportLink" to="/main/ai-report">查看学习报告</router-link>
          </div>
        </div>

        <div class="heroPanel">
          <div class="summaryCard">
            <span>数据来源</span>
            <strong>{{ sourceLabel }}</strong>
          </div>
          <div class="summaryCard">
            <span>当前阶段</span>
            <strong>{{ currentStageText }}</strong>
          </div>
          <div class="summaryCard">
            <span>完成进度</span>
            <strong>{{ completionRateText }}</strong>
          </div>
          <div class="summaryCard">
            <span>任务数量</span>
            <strong>{{ steps.length }}</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="container contentSection">
      <div class="controlPanel">
        <div class="panelTitle">
          <h2>路径生成参数</h2>
          <p>真实接口可用时直接生成；接口失败时保留本地演示路径与本地进度记录。</p>
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
            <span>每日学习时长</span>
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
            placeholder="例如：3 天内完成模型评估、过拟合和泛化误差专题复习，并准备课堂讲解。"
          />
        </label>

        <div class="hintPanel">
          <strong>演示建议</strong>
          <p>先生成或读取路径，再在右侧逐步执行“完成 / 暂停 / 恢复”，即可稳定演示路径执行闭环。</p>
        </div>

        <div v-if="errorMessage" class="errorPanel">
          <strong>降级提示</strong>
          <p>{{ errorMessage }}</p>
        </div>
      </div>

      <div class="resultPanel">
        <div class="resultHeader">
          <div>
            <h2>学习路径结果</h2>
            <p>{{ planView.summary }}</p>
          </div>
          <div class="statusPill" :class="{ ready: hasRemotePlan, fallback: !hasRemotePlan }">
            {{ hasRemotePlan ? `计划 #${planData.plan_id}` : "本地演示路径" }}
          </div>
        </div>

        <div v-if="currentStep" class="quickActionCard">
          <div class="quickActionHead">
            <div>
              <span>当前聚焦步骤</span>
              <strong>第 {{ currentStep.day }} 天 · {{ currentStep.title }}</strong>
            </div>
            <em>{{ formatStatus(currentStep.status) }}</em>
          </div>
          <p>{{ currentStep.objective }}</p>
          <div class="actionBar compact">
            <el-button
              size="small"
              type="success"
              plain
              :disabled="!canOperateStep(currentStep)"
              :loading="stepActionLoading === `${currentStep.step_id}-complete`"
              @click="handleStepAction(currentStep, 'complete')"
            >
              完成当前步骤
            </el-button>
            <el-button
              size="small"
              type="warning"
              plain
              :disabled="!canOperateStep(currentStep)"
              :loading="stepActionLoading === `${currentStep.step_id}-pause`"
              @click="handleStepAction(currentStep, 'pause')"
            >
              暂停当前步骤
            </el-button>
            <el-button
              size="small"
              type="primary"
              plain
              :disabled="!canOperateStep(currentStep)"
              :loading="stepActionLoading === `${currentStep.step_id}-resume`"
              @click="handleStepAction(currentStep, 'resume')"
            >
              恢复当前步骤
            </el-button>
          </div>
          <div v-if="progressMap[currentStep.step_id]" class="progressNote quick">
            最近动作：{{ formatAction(progressMap[currentStep.step_id].last_action) }}
            <span v-if="progressMap[currentStep.step_id].updated_at">
              · {{ progressMap[currentStep.step_id].updated_at }}
            </span>
          </div>
        </div>

        <div v-if="stages.length" class="stageTimeline">
          <div v-for="stage in stages" :key="`${stage.stage_no}-${stage.stage_name}`" class="stageCard">
            <span>阶段 {{ stage.stage_no }}</span>
            <strong>{{ stage.stage_name }}</strong>
            <p>{{ stage.focus }}</p>
            <em>{{ formatStatus(stage.status) }}</em>
          </div>
        </div>
        <div v-else class="emptyState">当前还没有可展示的阶段数据。</div>

        <div class="resultBlock">
          <div class="flowHintBar">
            <strong>串联演示建议</strong>
            <div class="flowLinkGroup">
              <router-link to="/main/ai-resources">1. 进入资源推荐</router-link>
              <router-link to="/main/ai-tutor">2. 演示智能助教</router-link>
              <router-link to="/main/ai-report">3. 查看学习报告</router-link>
            </div>
          </div>

          <div class="blockTitle">每日行动清单</div>
          <div v-if="steps.length" class="stepList">
            <div v-for="step in steps" :key="step.step_id" class="stepCard">
              <div class="stepHead">
                <div>
                  <span>第 {{ step.day }} 天</span>
                  <strong>{{ step.title }}</strong>
                </div>
                <em>{{ formatStatus(step.status) }}</em>
              </div>

              <p class="stepObjective">{{ step.objective }}</p>

              <div v-if="step.tasks.length" class="taskList">
                <div v-for="task in step.tasks" :key="task" class="taskItem">{{ task }}</div>
              </div>

              <div v-if="step.resource_pushes.length" class="pushList">
                <div v-for="push in step.resource_pushes" :key="`${push.title}-${push.reason}`" class="pushItem">
                  <strong>{{ push.title }}</strong>
                  <p>{{ push.reason }}</p>
                </div>
              </div>

              <div class="actionBar">
                <el-button
                  size="small"
                  type="success"
                  plain
                  :disabled="!canOperateStep(step)"
                  :loading="stepActionLoading === `${step.step_id}-complete`"
                  @click="handleStepAction(step, 'complete')"
                >
                  完成
                </el-button>
                <el-button
                  size="small"
                  type="warning"
                  plain
                  :disabled="!canOperateStep(step)"
                  :loading="stepActionLoading === `${step.step_id}-pause`"
                  @click="handleStepAction(step, 'pause')"
                >
                  暂停
                </el-button>
                <el-button
                  size="small"
                  type="primary"
                  plain
                  :disabled="!canOperateStep(step)"
                  :loading="stepActionLoading === `${step.step_id}-resume`"
                  @click="handleStepAction(step, 'resume')"
                >
                  恢复
                </el-button>
              </div>

              <div v-if="progressMap[step.step_id]" class="progressNote">
                最近动作：{{ formatAction(progressMap[step.step_id].last_action) }}
                <span v-if="progressMap[step.step_id].updated_at">
                  · {{ progressMap[step.step_id].updated_at }}
                </span>
              </div>
            </div>
          </div>
          <div v-else class="emptyState">生成路径后，这里会按天展示学习任务与执行动作。</div>
        </div>

        <div class="resultBlock dualBlock">
          <div class="subBlock">
            <div class="blockTitle">风险提醒</div>
            <div v-if="riskAlerts.length" class="tagList">
              <span v-for="item in riskAlerts" :key="item">{{ item }}</span>
            </div>
            <div v-else class="emptyState">当前没有风险提醒。</div>
          </div>

          <div class="subBlock">
            <div class="blockTitle">动态调整建议</div>
            <div v-if="dynamicAdjustments.length" class="adjustmentList">
              <div v-for="item in dynamicAdjustments" :key="item" class="adjustmentItem">{{ item }}</div>
            </div>
            <div v-else class="emptyState">当前没有新的调整建议。</div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  completeAiLearningPlanStep,
  generateAiLearningPlan,
  getAiLearningPlan,
  getAiLearningPlanProgress,
  getLatestAiLearningPlan,
  pauseAiLearningPlanStep,
  resumeAiLearningPlanStep,
} from "@/api/ai";
import { a3DemoScenario } from "@/mock/a3DemoData";
import { listPlanProgress, savePlanProgressAction } from "@/utils/a3StudentStore";

const scenario = a3DemoScenario;

const form = reactive({
  user_id: scenario.userId,
  course_code: scenario.courseCode,
  target: "3 天内完成模型评估、过拟合和泛化误差专题复习，并准备课堂讲解。",
  available_days: 3,
  daily_study_minutes: 45,
  profile: {
    recommended_resource_types: ["lecture_notes", "mind_map", "practice_set", "extended_reading"],
  },
});

const loading = ref(false);
const loadingLatest = ref(false);
const stepActionLoading = ref("");
const errorMessage = ref("");
const planData = ref(null);
const progressData = ref(null);

const fallbackStages = [
  {
    stage_no: 1,
    stage_name: "基础诊断",
    focus: `确认 ${scenario.currentTopic} 的概念理解、当前掌握程度和主要薄弱点。`,
    status: "in_progress",
  },
  {
    stage_no: 2,
    stage_name: "弱点强化",
    focus: `围绕 ${scenario.currentTopic} 的重点错因和易混概念进行专项训练。`,
    status: "pending",
  },
  {
    stage_no: 3,
    stage_name: "综合巩固",
    focus: `结合 ${scenario.currentTopic} 完成复盘总结、表达训练与结果验收。`,
    status: "pending",
  },
];

const fallbackSteps = [
  {
    step_id: "day-1",
    day: 1,
    title: `${scenario.currentTopic} 基础梳理`,
    objective: `完成 ${scenario.currentTopic} 的概念梳理、基础练习和第一轮薄弱点定位。`,
    tasks: [
      `阅读 ${scenario.currentTopic} 结构化讲义，快速建立知识框架。`,
      "完成 1 组基础练习，标记错题原因和易混点。",
      "输出 3 条可用于课堂讲解的核心结论。",
    ],
    resource_pushes: [
      { title: "第 1 天推荐：课程讲义", reason: "帮助快速建立知识结构并进入当天任务。" },
      { title: "第 1 天推荐：基础练习题", reason: "用于定位当前理解薄弱点并形成后续强化依据。" },
    ],
    status: "in_progress",
  },
  {
    step_id: "day-2",
    day: 2,
    title: `${scenario.currentTopic} 专项强化`,
    objective: `围绕 ${scenario.currentTopic} 的重点问题完成专项训练，并沉淀复用型笔记。`,
    tasks: [
      "针对错题和薄弱点补齐解释链路，重点区分易混概念。",
      "整理 1 份结构化笔记，记录定义、错因和适用场景。",
      "完成 1 组分层练习，为阶段评估和路径调整提供依据。",
    ],
    resource_pushes: [
      { title: "第 2 天推荐：核心概念导图", reason: "帮助梳理知识点之间的关系，适合演示讲解。" },
      { title: "第 2 天推荐：案例拆解", reason: "把抽象概念落到具体任务场景中。" },
    ],
    status: "pending",
  },
  {
    step_id: "day-3",
    day: 3,
    title: `${scenario.currentTopic} 复盘验收`,
    objective: `输出 ${scenario.currentTopic} 的阶段总结，并为学习报告与课堂展示做准备。`,
    tasks: [
      "回顾错题与练习结果，梳理系统化改进建议。",
      "完成 1 轮综合表达训练，确保能讲清规划、执行和反馈闭环。",
      "生成用于学习报告的结果摘要和后续建议。",
    ],
    resource_pushes: [
      { title: "第 3 天推荐：讲解提纲", reason: "用于收尾展示学习成果与平台价值。" },
      { title: "第 3 天推荐：综合测验", reason: "帮助验证当前阶段目标是否完成。" },
    ],
    status: "pending",
  },
];

const defaultSummary = `围绕 ${scenario.currentTopic}，系统会结合学习目标和可用时间，生成可执行的个性化学习路径。`;

const demoPlanId = computed(() => planData.value?.plan_id || `demo-plan-${form.user_id}-${form.course_code}`);
const progressMap = computed(() =>
  Object.fromEntries((progressData.value?.items || []).map((item) => [item.step_id, item])),
);
const allStepIds = computed(() => planView.value.steps.map((step) => step.step_id).filter(Boolean));
const hasRemotePlan = computed(() => Boolean(planData.value?.plan_id));
const sourceLabel = computed(() => (hasRemotePlan.value ? "真实接口" : "本地兜底"));

const normalizeText = (value, fallback = "") => {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim();
  return cleaned || fallback;
};

const isPromptLikeText = (value) =>
  typeof value === "string" &&
  /给我一[份个]学习计划|推荐资源|适合学生课后巩固与演示复盘|适合课堂现场演示|请解释过拟合/u.test(value);

const toSentence = (value, fallback) => {
  const normalized = normalizeText(value, fallback);
  const safeValue = isPromptLikeText(normalized) ? fallback : normalized;
  const base = safeValue.replace(/[。！？，,!?]+$/u, "");
  return `${base}。`;
};

const toLabel = (value, fallback) => {
  const normalized = normalizeText(value, fallback);
  const safeValue = isPromptLikeText(normalized) ? fallback : normalized;
  return safeValue.replace(/[。！？，,!?]+$/u, "");
};

const toArray = (value, fallback = []) => (Array.isArray(value) && value.length ? value : fallback);

const planView = computed(() => {
  const raw = planData.value || {};
  const stageSource = toArray(raw.stages, fallbackStages);
  const stepSource = toArray(raw.steps, fallbackSteps);

  const stages = stageSource.map((stage, index) => {
    const fallback = fallbackStages[index] || fallbackStages[fallbackStages.length - 1];
    return {
      stage_no: stage?.stage_no ?? fallback.stage_no,
      stage_name: toLabel(stage?.stage_name, fallback.stage_name),
      focus: toSentence(stage?.focus, fallback.focus),
      status: stage?.status || fallback.status,
    };
  });

  const steps = stepSource.map((step, index) => {
    const fallback = fallbackSteps[index] || fallbackSteps[fallbackSteps.length - 1];
    const stepId = step?.step_id || fallback.step_id || `day-${index + 1}`;
    return {
      step_id: stepId,
      day: step?.day ?? fallback.day ?? index + 1,
      title: toLabel(step?.title, fallback.title || `${scenario.currentTopic} 学习任务`),
      objective: toSentence(step?.objective, fallback.objective || `完成 ${scenario.currentTopic} 相关学习任务。`),
      tasks: toArray(step?.tasks, fallback.tasks || []).map((task, taskIndex) =>
        toSentence(task, fallback.tasks?.[taskIndex] || fallback.objective || "完成学习任务"),
      ),
      resource_pushes: toArray(step?.resource_pushes, fallback.resource_pushes || []).map((push, pushIndex) => ({
        title: toLabel(push?.title, fallback.resource_pushes?.[pushIndex]?.title || "推荐学习资源"),
        reason: toSentence(
          push?.reason,
          fallback.resource_pushes?.[pushIndex]?.reason || `帮助完成 ${scenario.currentTopic} 当前阶段学习目标。`,
        ),
      })),
      status: progressMap.value[stepId]?.status || step?.status || fallback.status || "pending",
    };
  });

  const riskAlerts = toArray(raw.risk_alerts, [
    "可用天数较少，建议优先完成高频考点与基础题。",
    "请关注学习节奏与任务完成情况，避免在结项前集中堆积。",
  ]).map((item, index) =>
    toSentence(item, index === 0 ? "可用天数较少，建议优先完成高频考点与基础题。" : "请关注学习节奏与任务完成情况。"),
  );

  const dynamicAdjustments = toArray(raw.dynamic_adjustments, [
    "若阶段测评低于 70 分，则提高薄弱知识点练习占比，并延后综合训练。",
    "若连续两次练习正确率高于 85%，则提升后续任务难度并加入综合应用任务。",
  ]).map((item, index) =>
    toSentence(
      item,
      index === 0
        ? "若阶段测评低于 70 分，则提高薄弱知识点练习占比，并延后综合训练。"
        : "若连续两次练习正确率高于 85%，则提升后续任务难度并加入综合应用任务。",
    ),
  );

  return {
    summary: toSentence(raw.summary, defaultSummary),
    current_stage: toLabel(raw.current_stage, stages[0]?.stage_name || scenario.currentStage || "基础诊断"),
    stages,
    steps,
    risk_alerts: riskAlerts,
    dynamic_adjustments: dynamicAdjustments,
  };
});

const stages = computed(() => planView.value.stages);
const steps = computed(() => planView.value.steps);
const riskAlerts = computed(() => planView.value.risk_alerts);
const dynamicAdjustments = computed(() => planView.value.dynamic_adjustments);
const currentStep = computed(
  () => steps.value.find((step) => step.status === "in_progress") || steps.value.find((step) => step.status !== "completed") || steps.value[0],
);
const currentStageText = computed(() => planView.value.current_stage || "待生成");
const completionRateText = computed(() => {
  const rate = progressData.value?.completion_rate ?? planData.value?.completion_rate;
  return typeof rate === "number" ? `${rate.toFixed(0)}%` : "0%";
});

const formatStatus = (status) => {
  const map = {
    pending: "待开始",
    in_progress: "进行中",
    paused: "已暂停",
    completed: "已完成",
  };
  return map[status] || status || "待开始";
};

const formatAction = (action) => {
  const map = {
    initialize: "初始化",
    complete: "完成",
    pause: "暂停",
    resume: "恢复",
  };
  return map[action] || action || "初始化";
};

const mergeProgressPayload = (remotePayload, planId) => {
  const localPayload = listPlanProgress(planId);
  const itemsByStep = new Map();
  [...(remotePayload?.items || []), ...(localPayload.items || [])].forEach((item) => {
    if (item?.step_id) {
      itemsByStep.set(item.step_id, item);
    }
  });

  return {
    plan_id: remotePayload?.plan_id || localPayload.plan_id || planId,
    items: [...itemsByStep.values()],
    completion_rate: Math.max(localPayload.completion_rate ?? 0, remotePayload?.completion_rate ?? 0),
  };
};

const loadPlanProgress = async (planId) => {
  if (!planId) {
    progressData.value = null;
    return;
  }
  try {
    const remotePayload = await getAiLearningPlanProgress(planId, { user_id: form.user_id });
    progressData.value = mergeProgressPayload(remotePayload, planId);
  } catch {
    progressData.value = listPlanProgress(planId);
  }
};

const loadPlanById = async (planId) => {
  const result = await getAiLearningPlan(planId);
  planData.value = result;
  await loadPlanProgress(result.plan_id);
};

const buildPlan = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    const result = await generateAiLearningPlan({
      user_id: form.user_id,
      course_code: form.course_code.trim(),
      target: form.target.trim(),
      available_days: form.available_days,
      daily_study_minutes: form.daily_study_minutes,
      profile: form.profile,
    });
    planData.value = result;
    await loadPlanProgress(result.plan_id);
    ElMessage.success("学习路径已生成");
  } catch (error) {
    errorMessage.value = error?.response?.data?.detail || error?.message || "学习路径生成失败，当前仍可展示本地兜底路径";
    planData.value = null;
    progressData.value = listPlanProgress(demoPlanId.value);
  } finally {
    loading.value = false;
  }
};

const loadLatestPlan = async (showFailure = true) => {
  loadingLatest.value = true;
  if (showFailure) {
    errorMessage.value = "";
  }
  try {
    const latestPlan = await getLatestAiLearningPlan({
      user_id: form.user_id,
      course_code: form.course_code.trim(),
    });
    planData.value = latestPlan;
    if (latestPlan?.plan_id) {
      await loadPlanById(latestPlan.plan_id);
    } else {
      progressData.value = listPlanProgress(demoPlanId.value);
    }
    ElMessage.success("已加载最近一次学习路径");
  } catch (error) {
    if (showFailure) {
      errorMessage.value = error?.response?.data?.detail || error?.message || "暂时没有可用的学习路径，当前展示本地演示进度";
    }
    planData.value = null;
    progressData.value = listPlanProgress(demoPlanId.value);
  } finally {
    loadingLatest.value = false;
  }
};

const canOperateStep = (step) => Boolean(demoPlanId.value && step?.step_id);

const actionRequestMap = {
  complete: completeAiLearningPlanStep,
  pause: pauseAiLearningPlanStep,
  resume: resumeAiLearningPlanStep,
};

const actionTextMap = {
  complete: "完成",
  pause: "暂停",
  resume: "恢复",
};

const applyLocalProgress = (stepId, action) => {
  progressData.value = savePlanProgressAction({
    planId: demoPlanId.value,
    stepId,
    action,
    stepIds: allStepIds.value,
  });
};

const handleStepAction = async (step, action) => {
  if (!canOperateStep(step)) {
    ElMessage.warning("当前步骤缺少 step_id，无法执行进度动作");
    return;
  }

  stepActionLoading.value = `${step.step_id}-${action}`;
  try {
    if (planData.value?.plan_id) {
      await actionRequestMap[action](planData.value.plan_id, step.step_id, { user_id: form.user_id });
      await loadPlanProgress(planData.value.plan_id);
      ElMessage.success(`步骤已${actionTextMap[action]}`);
    } else {
      applyLocalProgress(step.step_id, action);
      ElMessage.success(`步骤已${actionTextMap[action]}，当前为本地兜底进度`);
    }
  } catch {
    applyLocalProgress(step.step_id, action);
    ElMessage.success(`步骤已${actionTextMap[action]}，当前为本地兜底进度`);
  } finally {
    stepActionLoading.value = "";
  }
};

onMounted(() => {
  loadLatestPlan(false);
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
}

.reportLink.secondary {
  background: #e0f2fe;
  color: #123b74;
}

.reportLink.tertiary {
  background: #e8fff6;
  color: #17624a;
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

.statusPill.fallback {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
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

.quickActionCard,
.stageCard,
.stepCard,
.subBlock,
.emptyState {
  border-radius: 22px;
  background: #fff;
}

.quickActionCard {
  margin-top: 20px;
  padding: 20px;
  border: 1px solid rgba(12, 99, 214, 0.12);
  background: linear-gradient(135deg, rgba(224, 242, 254, 0.92), rgba(232, 255, 246, 0.9));

  p {
    margin-top: 10px;
    color: #49627d;
    line-height: 1.8;
  }
}

.quickActionHead {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;

  span {
    color: #68809d;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  strong {
    display: block;
    margin-top: 8px;
    color: #15304f;
    font-size: 22px;
  }

  em {
    color: #1767c3;
    font-style: normal;
    white-space: nowrap;
  }
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

.flowHintBar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  padding: 16px 18px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(224, 242, 254, 0.92), rgba(220, 252, 231, 0.85));

  strong {
    color: #123b74;
  }
}

.flowLinkGroup {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.92);
    color: #123b74;
    font-weight: 700;
  }
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

.actionBar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.actionBar.compact {
  margin-top: 14px;
}

.progressNote {
  margin-top: 12px;
  color: #64748b;
  font-size: 13px;
}

.progressNote.quick {
  margin-top: 14px;
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

  .flowHintBar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
