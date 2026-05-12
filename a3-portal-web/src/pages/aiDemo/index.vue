<template>
  <div class="aiDemoPage">
    <section class="heroSection">
      <div class="container heroInner">
        <div class="heroContent">
          <div class="heroBadge">A3 多智能体演示中枢</div>
          <h1>把意图识别、协同路由、学习计划、资源生成与评估结果放到同一页展示</h1>
          <p>
            页面直接对接异步问答任务接口，完整展示 `intent`、`agent_trace`、`generated_plan`、
            `generated_resources`、`generated_evaluation` 等关键结果，适合现场答辩与验收。
          </p>
          <div class="heroQuickNav">
            <router-link class="pathLink secondary" to="/main/index">返回首页</router-link>
            <router-link class="pathLink" to="/main/ai-path">进入正式学习路径页</router-link>
            <router-link class="pathLink ghost" to="/main/ai-admin">查看后台管控页</router-link>
          </div>
          <div class="heroStats">
            <div class="statCard">
              <span>网关入口</span>
              <strong>/aigw/v1/chat/tasks</strong>
            </div>
            <div class="statCard">
              <span>默认课程</span>
              <strong>{{ form.course_code }}</strong>
            </div>
            <div class="statCard">
              <span>支持场景</span>
              <strong>4 类</strong>
            </div>
          </div>
        </div>

        <div class="heroPanel">
          <div class="signalGrid">
            <div class="signalCard mint">
              <span>Intent</span>
              <strong>{{ responseData?.intent || "待触发" }}</strong>
            </div>
            <div class="signalCard blue">
              <span>Trace</span>
              <strong>{{ agentTrace.length }} steps</strong>
            </div>
            <div class="signalCard amber">
              <span>Plan</span>
              <strong>{{ generatedPlanSteps.length }} steps</strong>
            </div>
            <div class="signalCard coral">
              <span>Resources</span>
              <strong>{{ generatedResources.length }} items</strong>
            </div>
          </div>
          <div class="heroFlow">
            <div v-for="node in heroTracePreview" :key="node" class="flowNode">{{ node }}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="container workbenchSection">
      <div class="controlPanel">
        <div class="panelTitle">
          <div>
            <h2>对话控制台</h2>
            <p>切换场景、快速填充问题，然后发起一次真实的多智能体异步任务。</p>
          </div>
        </div>

        <div class="presetGroup">
          <button
            v-for="preset in presets"
            :key="preset.scene"
            class="presetChip"
            :class="{ active: form.scene === preset.scene }"
            @click="applyPreset(preset)"
          >
            {{ preset.label }}
          </button>
        </div>

        <div class="fieldGrid">
          <label class="fieldItem">
            <span>用户 ID</span>
            <el-input-number v-model="form.user_id" :min="1" :max="999999" />
          </label>
          <label class="fieldItem">
            <span>课程编码</span>
            <el-input v-model="form.course_code" placeholder="例如 ml_intro" />
          </label>
          <label class="fieldItem fullRow">
            <span>场景</span>
            <el-select v-model="form.scene" placeholder="请选择场景">
              <el-option v-for="preset in presets" :key="preset.scene" :label="preset.label" :value="preset.scene" />
            </el-select>
          </label>
        </div>

        <label class="messageField">
          <span>用户问题 / 任务目标</span>
          <el-input
            v-model="form.message"
            type="textarea"
            :rows="5"
            resize="none"
            placeholder="请输入你要演示的学习问题、学习计划需求或资源生成任务"
          />
        </label>

        <div class="quickPromptPanel">
          <div
            v-for="prompt in quickPrompts"
            :key="prompt.title"
            class="quickPromptCard"
            @click="fillPrompt(prompt)"
          >
            <strong>{{ prompt.title }}</strong>
            <p>{{ prompt.message }}</p>
          </div>
        </div>

        <div class="actionRow">
          <el-button type="primary" size="large" :loading="loading" @click="submitChat">
            {{ loading ? "正在调用多智能体流程..." : "运行演示链路" }}
          </el-button>
          <el-button size="large" plain @click="resetForm">重置输入</el-button>
        </div>

        <div class="taskCard">
          <span>任务 ID</span>
          <strong>{{ currentTaskId ? `#${currentTaskId}` : "尚未创建" }}</strong>
        </div>

        <div v-if="errorMessage" class="errorPanel">
          <strong>调用失败</strong>
          <p>{{ errorMessage }}</p>
        </div>
      </div>

      <div class="resultPanel">
        <div class="resultHeader">
          <div>
            <h2>智能体协同结果</h2>
            <p>结构化结果适合直接截图放进方案文档、答辩 PPT 或现场展示页面。</p>
          </div>
          <div class="statusPill" :class="{ ready: !!responseData, running: loading }">
            {{ resultStatusText }}
          </div>
        </div>

        <div class="overviewGrid">
          <div class="overviewCard">
            <span>Intent</span>
            <strong>{{ responseData?.intent || "--" }}</strong>
          </div>
          <div class="overviewCard">
            <span>Answer Length</span>
            <strong>{{ answerLength }}</strong>
          </div>
          <div class="overviewCard">
            <span>Citations</span>
            <strong>{{ citations.length }}</strong>
          </div>
          <div class="overviewCard">
            <span>Resources</span>
            <strong>{{ generatedResources.length }}</strong>
          </div>
        </div>

        <div class="resultBlock">
          <div class="blockTitle">学习画像</div>
          <div v-if="profileDimensions.length" class="profilePanel">
            <div class="profileSummary">
              <strong>{{ generatedProfile?.summary || "已生成学习画像摘要" }}</strong>
              <p v-if="profileTags.length">标签：{{ profileTags.join(" / ") }}</p>
            </div>
            <div class="profileGrid">
              <div v-for="item in profileDimensions" :key="item.key" class="profileCard">
                <div class="profileHead">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.current_level || "待分析" }}</strong>
                </div>
                <p>{{ item.analysis || "当前维度已完成初步分析。" }}</p>
                <div v-if="item.evidence?.length" class="profileEvidence">
                  <span v-for="evidence in item.evidence" :key="evidence">{{ evidence }}</span>
                </div>
                <em>{{ item.study_advice || "后续用于资源和路径调度。" }}</em>
              </div>
            </div>
          </div>
          <div v-else class="emptyState">运行后这里会展示学习画像。</div>
        </div>

        <div class="resultBlock">
          <div class="blockTitle">Agent Trace</div>
          <div v-if="agentTrace.length" class="traceTimeline">
            <div v-for="(item, index) in agentTrace" :key="`${item}-${index}`" class="traceItem">
              <span class="traceIndex">{{ index + 1 }}</span>
              <div class="traceBody">
                <strong>{{ parseTraceTitle(item) }}</strong>
                <p>{{ parseTraceDetail(item) }}</p>
              </div>
            </div>
          </div>
          <div v-else class="emptyState">运行后这里会展示各个智能体节点的执行轨迹。</div>
        </div>

        <div class="resultBlock">
          <div class="blockTitle">最终回答</div>
          <div v-if="responseData?.answer" class="answerCard">{{ responseData.answer }}</div>
          <div v-else class="emptyState">这里会展示聚合后的最终回答。</div>
        </div>

        <div class="resultBlock dualBlock">
          <div class="subBlock">
            <div class="blockTitle">生成计划</div>
            <div v-if="generatedPlan" class="planCard">
              <p v-if="generatedPlan.summary" class="planSummary">{{ generatedPlan.summary }}</p>
              <div v-if="planStages.length" class="stageGrid">
                <div v-for="stage in planStages" :key="`${stage.stage_no}-${stage.stage_name}`" class="stageCard">
                  <span>{{ stage.stage_name || `Stage ${stage.stage_no}` }}</span>
                  <strong>{{ stage.focus || "Current focus" }}</strong>
                  <p>{{ stage.objective || "Path stage objective" }}</p>
                  <em>{{ stage.status || "pending" }}</em>
                </div>
              </div>
              <div v-for="(step, index) in generatedPlanSteps" :key="index" class="planStep">
                <span>{{ index + 1 }}</span>
                <div>
                  <strong>{{ getPlanStepTitle(step, index) }}</strong>
                  <p>{{ getPlanStepDescription(step) }}</p>
                </div>
              </div>
              <div v-if="planRiskAlerts.length" class="riskList">
                <span v-for="risk in planRiskAlerts" :key="risk">{{ risk }}</span>
              </div>
            </div>
            <div v-else class="emptyState">当前场景没有生成计划时，这里保持为空。</div>
          </div>

          <div class="subBlock">
            <div class="blockTitle">引用片段</div>
            <div v-if="citations.length" class="citationList">
              <div v-for="citation in citations" :key="`${citation.chunk_id}-${citation.source}`" class="citationCard">
                <strong>{{ citation.source || "未命名片段" }}</strong>
                <p>Chunk #{{ citation.chunk_id ?? "--" }}</p>
                <em>相似度 {{ formatScore(citation.score) }}</em>
              </div>
            </div>
            <div v-else class="emptyState">当前结果未返回引用片段时，这里保持为空。</div>
          </div>
        </div>

        <div class="resultBlock">
          <div class="blockTitle">测评报告</div>
          <div v-if="generatedEvaluation" class="evaluationPanel">
            <div class="evaluationSummary">
              <div class="evaluationScore">
                <span>Score</span>
                <strong>{{ generatedEvaluation.overall_score || "--" }}</strong>
              </div>
              <div class="evaluationMeta">
                <strong>{{ generatedEvaluation.mastery_level || "developing" }}</strong>
                <p>{{ generatedEvaluation.report_summary || "Evaluation summary will be shown here." }}</p>
              </div>
            </div>
            <div v-if="generatedEvaluationLayers.length" class="evaluationGrid">
              <div v-for="layer in generatedEvaluationLayers" :key="layer.level" class="evaluationCard">
                <span>{{ layer.level }}</span>
                <strong>{{ layer.score }}</strong>
                <p>{{ layer.comment }}</p>
              </div>
            </div>
            <div v-if="generatedEvaluationMetrics.length" class="metricList">
              <div v-for="metric in generatedEvaluationMetrics" :key="metric.metric_name" class="metricItem">
                <strong>{{ metric.metric_name }}</strong>
                <span>{{ metric.score }}</span>
                <p>{{ metric.comment }}</p>
              </div>
            </div>
          </div>
          <div v-else class="emptyState">运行学习路径或综合场景后，这里会展示测评闭环结果。</div>
        </div>

        <div class="resultBlock">
          <div class="blockTitle">生成资源</div>
          <div v-if="generatedResources.length" class="resourceGrid">
            <div v-for="(resource, index) in generatedResources" :key="index" class="resourceCard">
              <div class="resourceMeta">
                <span>{{ resource.resource_type || "resource" }}</span>
                <strong>{{ resource.title || `资源 ${index + 1}` }}</strong>
              </div>
              <p class="resourceSummary">{{ resource.summary || "暂无摘要" }}</p>
              <div v-if="resource.source_titles?.length" class="resourceTags">
                <span v-for="title in resource.source_titles" :key="title">{{ title }}</span>
              </div>
              <p v-if="resource.study_suggestion" class="resourceSuggestion">{{ resource.study_suggestion }}</p>
              <details v-if="resource.content_markdown" class="resourceDetail">
                <summary>查看生成内容</summary>
                <pre>{{ resource.content_markdown }}</pre>
              </details>
            </div>
          </div>
          <div v-else class="emptyState">资源生成场景触发后，这里会展示讲义、练习等内容。</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { getAiChatTaskStatus, submitAiChatTask } from "@/api/ai";

const presets = [
  {
    label: "学习问答",
    scene: "study_assistant",
    message: "请解释什么是过拟合，并告诉我为什么模型会在训练集表现很好但泛化很差。",
  },
  {
    label: "学习计划",
    scene: "study_plan",
    message: "帮我做一个 3 天复习计划，主题是机器学习中的过拟合与泛化。",
  },
  {
    label: "资源生成",
    scene: "resource_generation",
    message: "请围绕过拟合生成讲义提纲、关键概念卡片和一组练习题。",
  },
  {
    label: "综合场景",
    scene: "comprehensive",
    message: "请解释过拟合，并给我一个学习计划和推荐资源。",
  },
];

const quickPrompts = [
  {
    title: "答辩演示版",
    scene: "comprehensive",
    message: "请解释过拟合，并给我一个学习计划和推荐资源。",
  },
  {
    title: "教学助手版",
    scene: "study_assistant",
    message: "什么是过拟合？请给出一个生活化例子帮助理解。",
  },
  {
    title: "教师备课版",
    scene: "resource_generation",
    message: "请为机器学习导论课程生成一份关于过拟合的讲义和课堂练习。",
  },
];

const initialForm = () => ({
  user_id: 1,
  course_code: "ml_intro",
  scene: "comprehensive",
  message: "请解释过拟合，并给我一个学习计划和推荐资源。",
});

const form = reactive(initialForm());
const loading = ref(false);
const errorMessage = ref("");
const responseData = ref(null);
const currentTaskId = ref(null);

const agentTrace = computed(() => responseData.value?.agent_trace || []);
const citations = computed(() => responseData.value?.citations || []);
const generatedResources = computed(() => responseData.value?.generated_resources || []);
const generatedPlan = computed(() => responseData.value?.generated_plan || null);
const generatedProfile = computed(() => responseData.value?.profile || null);
const generatedEvaluation = computed(() => responseData.value?.generated_evaluation || null);
const generatedPlanSteps = computed(() => generatedPlan.value?.steps || []);
const planStages = computed(() => generatedPlan.value?.stages || []);
const planRiskAlerts = computed(() => generatedPlan.value?.risk_alerts || []);
const answerLength = computed(() => responseData.value?.answer?.length || 0);
const profileTags = computed(() => generatedProfile.value?.profile_tags || []);
const generatedEvaluationMetrics = computed(() => generatedEvaluation.value?.metrics || []);
const generatedEvaluationLayers = computed(() => generatedEvaluation.value?.layered_results || []);
const profileDimensions = computed(() => {
  const dimensions = generatedProfile.value?.dimensions || {};
  const order = generatedProfile.value?.dimension_order || Object.keys(dimensions);
  return order.filter((key) => dimensions[key]).map((key) => ({ key, ...dimensions[key] }));
});
const heroTracePreview = computed(() => {
  if (agentTrace.value.length) {
    return agentTrace.value.slice(0, 5);
  }
  return ["profile", "router", "retriever", "planner", "assessment"];
});
const resultStatusText = computed(() => {
  if (loading.value && currentTaskId.value) {
    return `任务执行中 #${currentTaskId.value}`;
  }
  if (responseData.value) {
    return "实时结果";
  }
  return "等待调用";
});

const applyPreset = (preset) => {
  form.scene = preset.scene;
  form.message = preset.message;
};

const fillPrompt = (prompt) => {
  form.scene = prompt.scene;
  form.message = prompt.message;
};

const resetForm = () => {
  Object.assign(form, initialForm());
  errorMessage.value = "";
  currentTaskId.value = null;
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const pollChatTaskUntilDone = async (taskId, timeoutMs = 120000, intervalMs = 2000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const status = await getAiChatTaskStatus(taskId);
    if (status.status === "completed" && status.result) {
      return status.result;
    }
    if (status.status === "failed") {
      throw new Error(status.error_message || "chat task failed");
    }
    await sleep(intervalMs);
  }
  throw new Error(`任务超时，等待超过 ${timeoutMs / 1000} 秒`);
};

const submitChat = async () => {
  if (!form.message.trim()) {
    ElMessage.warning("请先输入演示问题或任务目标");
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  responseData.value = null;
  currentTaskId.value = null;

  try {
    const task = await submitAiChatTask({
      user_id: form.user_id,
      course_code: form.course_code.trim(),
      scene: form.scene,
      message: form.message.trim(),
    });
    currentTaskId.value = task.task_id;
    responseData.value = await pollChatTaskUntilDone(task.task_id, 120000, task.poll_interval_ms || 2000);
    ElMessage.success("多智能体演示结果已生成");
  } catch (error) {
    errorMessage.value =
      error?.response?.data?.detail || error?.message || "AI 服务暂时不可用，请检查网关和 Python 服务";
  } finally {
    loading.value = false;
  }
};

const parseTraceTitle = (trace) => {
  const parts = String(trace).split(":");
  return parts[0] || "agent";
};

const parseTraceDetail = (trace) => {
  const parts = String(trace).split(":");
  return parts.slice(1).join(":").trim() || "执行完成";
};

const getPlanStepTitle = (step, index) =>
  step?.title || step?.step_name || step?.focus || `计划步骤 ${index + 1}`;

const getPlanStepDescription = (step) =>
  step?.description || step?.task || step?.objective || step?.content || "该阶段已生成默认执行说明。";

const formatScore = (score) => {
  if (score === undefined || score === null || Number.isNaN(Number(score))) {
    return "--";
  }
  return Number(score).toFixed(3);
};
</script>

<style lang="scss" scoped>
.aiDemoPage {
  min-height: 100vh;
  padding-bottom: 60px;
  background:
    radial-gradient(circle at top right, rgba(44, 170, 120, 0.18), transparent 24%),
    radial-gradient(circle at left 20%, rgba(19, 105, 230, 0.18), transparent 22%),
    linear-gradient(180deg, #f5f9ff 0%, #eef4f8 42%, #f7f8fb 100%);
}

.heroSection {
  position: relative;
  overflow: hidden;
  padding: 40px 0 24px;
}

.heroInner {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 24px;
}

.heroContent,
.heroPanel,
.controlPanel,
.resultPanel {
  border: 1px solid rgba(133, 158, 187, 0.22);
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 24px 60px rgba(31, 58, 94, 0.1);
  backdrop-filter: blur(18px);
}

.heroContent {
  padding: 36px;
  border-radius: 28px;

  h1 {
    margin-top: 16px;
    font-size: 42px;
    line-height: 1.18;
    color: #14213d;
  }

  p {
    margin-top: 18px;
    max-width: 720px;
    line-height: 1.9;
    color: #55657d;
  }
}

.heroBadge {
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;
  border-radius: 999px;
  background: linear-gradient(135deg, #0c63d6 0%, #1ea57f 100%);
  color: #fff;
  font-size: 12px;
  letter-spacing: 0.12em;
}

.heroStats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 28px;
}

.heroQuickNav {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}

.pathLink {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 210px;
  height: 46px;
  padding: 0 20px;
  border-radius: 999px;
  background: #132c4d;
  color: #fff;
  font-weight: 700;
}

.pathLink.secondary {
  background: #e0f2fe;
  color: #123b74;
}

.pathLink.ghost {
  background: rgba(255, 255, 255, 0.86);
  color: #123b74;
  border: 1px solid rgba(18, 59, 116, 0.12);
}

.statCard {
  padding: 18px 20px;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(244, 248, 253, 0.98), rgba(230, 240, 247, 0.92));

  span {
    display: block;
    font-size: 12px;
    color: #6c7e95;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  strong {
    display: block;
    margin-top: 10px;
    font-size: 24px;
    color: #132238;
  }
}

.heroPanel {
  border-radius: 28px;
  padding: 28px;
}

.signalGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.signalCard {
  min-height: 120px;
  padding: 20px;
  border-radius: 22px;
  color: #0f172a;

  span {
    display: block;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.8;
  }

  strong {
    display: block;
    margin-top: 18px;
    font-size: 24px;
    line-height: 1.2;
  }
}

.signalCard.mint {
  background: linear-gradient(135deg, #dff9ef 0%, #b7efd4 100%);
}

.signalCard.blue {
  background: linear-gradient(135deg, #dfeefe 0%, #bdd8ff 100%);
}

.signalCard.amber {
  background: linear-gradient(135deg, #fff1d4 0%, #ffdca2 100%);
}

.signalCard.coral {
  background: linear-gradient(135deg, #ffe1d6 0%, #ffc0ae 100%);
}

.heroFlow {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.flowNode {
  padding: 10px 14px;
  border-radius: 999px;
  background: #eff5fa;
  color: #25405f;
  font-weight: 600;
}

.workbenchSection {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 24px;
  align-items: start;
}

.controlPanel,
.resultPanel {
  border-radius: 28px;
  padding: 28px;
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

.presetGroup,
.quickPromptPanel,
.fieldGrid,
.overviewGrid,
.resourceGrid {
  display: grid;
  gap: 14px;
}

.presetGroup {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 24px;
}

.presetChip {
  height: 52px;
  border: none;
  border-radius: 18px;
  background: #eef4fa;
  color: #35506f;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;

  &:hover,
  &.active {
    background: linear-gradient(135deg, #0d67dc 0%, #1f9b83 100%);
    color: #fff;
  }
}

.fieldGrid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

.fullRow {
  grid-column: 1 / -1;
}

.messageField {
  margin-top: 20px;
}

.quickPromptPanel {
  margin-top: 20px;
}

.quickPromptCard {
  padding: 18px 20px;
  border-radius: 20px;
  background: linear-gradient(180deg, #f7fbff 0%, #eef5fb 100%);
  cursor: pointer;

  strong {
    color: #15304f;
  }

  p {
    margin-top: 8px;
    color: #63738b;
    line-height: 1.7;
  }
}

.actionRow {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.taskCard {
  margin-top: 18px;
  padding: 16px 18px;
  border-radius: 18px;
  background: #f4f8fb;

  span {
    display: block;
    color: #6c7e95;
    font-size: 12px;
  }

  strong {
    display: block;
    margin-top: 10px;
    color: #132238;
    font-size: 20px;
  }
}

.errorPanel {
  margin-top: 18px;
  padding: 16px 18px;
  border-radius: 18px;
  background: #fff1f0;
  color: #8f2d28;

  p {
    margin-top: 8px;
    line-height: 1.7;
  }
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

.statusPill.running {
  background: #dbeafe;
  color: #1d4ed8;
}

.overviewGrid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 24px;
}

.overviewCard {
  padding: 18px;
  border-radius: 18px;
  background: #f4f8fb;

  span {
    display: block;
    color: #6c7e95;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  strong {
    display: block;
    margin-top: 12px;
    color: #0f2036;
    font-size: 24px;
  }
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

.blockTitle {
  font-size: 18px;
  font-weight: 700;
  color: #12233b;
}

.traceTimeline {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 18px;
}

.profilePanel {
  margin-top: 16px;
}

.profileSummary {
  padding: 18px;
  border-radius: 20px;
  background: #fff;

  strong {
    color: #152942;
    font-size: 18px;
  }

  p {
    margin-top: 10px;
    color: #607286;
    line-height: 1.7;
  }
}

.profileGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.profileCard {
  padding: 18px;
  border-radius: 20px;
  background: #fff;

  p {
    margin-top: 10px;
    color: #607286;
    line-height: 1.7;
  }

  em {
    display: block;
    margin-top: 12px;
    color: #1559b3;
    font-style: normal;
    line-height: 1.7;
  }
}

.profileHead {
  span {
    display: block;
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
}

.profileEvidence {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;

  span {
    padding: 6px 10px;
    border-radius: 999px;
    background: #eef5fb;
    color: #4f6277;
    font-size: 12px;
  }
}

.traceItem {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.traceIndex {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0c63d6 0%, #22b07d 100%);
  color: #fff;
  font-weight: 700;
  flex-shrink: 0;
}

.traceBody {
  flex: 1;
  padding: 14px 16px;
  border-radius: 18px;
  background: #fff;

  strong {
    color: #13253f;
  }

  p {
    margin-top: 6px;
    color: #64748b;
    line-height: 1.7;
  }
}

.answerCard,
.planCard {
  margin-top: 16px;
  padding: 18px;
  border-radius: 20px;
  background: #fff;
  color: #344256;
  line-height: 1.9;
  white-space: pre-wrap;
}

.planSummary {
  margin-bottom: 16px;
  color: #44566f;
}

.stageGrid,
.evaluationGrid,
.metricList {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.stageGrid,
.evaluationGrid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.stageCard,
.evaluationCard,
.metricItem {
  padding: 16px;
  border-radius: 18px;
  background: #f8fbff;
}

.stageCard,
.evaluationCard {
  span {
    display: block;
    color: #68809d;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  strong {
    display: block;
    margin-top: 10px;
    color: #13253f;
    font-size: 18px;
  }

  p {
    margin-top: 8px;
    color: #607286;
    line-height: 1.7;
  }

  em {
    display: inline-flex;
    margin-top: 10px;
    color: #1767c3;
    font-style: normal;
  }
}

.riskList {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;

  span {
    padding: 8px 12px;
    border-radius: 999px;
    background: #fff3dd;
    color: #8a5a08;
    font-size: 12px;
  }
}

.evaluationPanel {
  margin-top: 16px;
}

.evaluationSummary {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 14px;
  margin-bottom: 16px;
}

.evaluationScore,
.evaluationMeta {
  padding: 18px;
  border-radius: 20px;
  background: #fff;
}

.evaluationScore {
  span {
    display: block;
    color: #68809d;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  strong {
    display: block;
    margin-top: 12px;
    color: #12233b;
    font-size: 34px;
  }
}

.evaluationMeta {
  strong {
    color: #13253f;
    font-size: 20px;
  }

  p {
    margin-top: 10px;
    color: #607286;
    line-height: 1.8;
  }
}

.metricItem {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px 14px;
  align-items: start;

  strong {
    color: #15304f;
  }

  span {
    color: #0c63d6;
    font-weight: 700;
  }

  p {
    grid-column: 1 / -1;
    margin: 0;
    color: #67788d;
    line-height: 1.7;
  }
}

.planStep {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 0;
  border-top: 1px solid #edf2f7;

  &:first-of-type {
    border-top: none;
    padding-top: 0;
  }

  span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 10px;
    background: #e6f0fb;
    color: #0c63d6;
    font-weight: 700;
    flex-shrink: 0;
  }

  p {
    margin-top: 6px;
    color: #617186;
    line-height: 1.7;
  }
}

.citationList {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.citationCard {
  padding: 16px;
  border-radius: 18px;
  background: #fff;

  strong {
    color: #15304f;
  }

  p,
  em {
    display: block;
    margin-top: 6px;
    color: #67788d;
    font-style: normal;
  }
}

.resourceGrid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 16px;
}

.resourceCard {
  padding: 20px;
  border-radius: 22px;
  background: #fff;
}

.resourceMeta {
  span {
    display: inline-flex;
    padding: 6px 10px;
    border-radius: 999px;
    background: #e8f2ff;
    color: #1257b0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  strong {
    display: block;
    margin-top: 12px;
    color: #152942;
    font-size: 20px;
  }
}

.resourceSummary,
.resourceSuggestion {
  margin-top: 12px;
  color: #5d7087;
  line-height: 1.8;
}

.resourceTags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;

  span {
    padding: 6px 10px;
    border-radius: 999px;
    background: #f0f5f9;
    color: #4d627a;
    font-size: 12px;
  }
}

.resourceDetail {
  margin-top: 16px;

  summary {
    cursor: pointer;
    font-weight: 600;
    color: #1559b3;
  }

  pre {
    margin-top: 12px;
    padding: 14px;
    border-radius: 16px;
    background: #0f172a;
    color: #d9e6ff;
    font-size: 12px;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.emptyState {
  margin-top: 16px;
  padding: 20px;
  border: 1px dashed #cad8e6;
  border-radius: 18px;
  color: #6b7d92;
  background: rgba(255, 255, 255, 0.55);
}

@media screen and (max-width: 1280px) {
  .heroInner,
  .workbenchSection,
  .dualBlock,
  .resourceGrid,
  .heroStats,
  .overviewGrid,
  .fieldGrid,
  .presetGroup,
  .profileGrid,
  .stageGrid,
  .evaluationGrid {
    grid-template-columns: 1fr;
  }

  .evaluationSummary {
    grid-template-columns: 1fr;
  }
}
</style>
