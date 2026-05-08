<template>
  <div class="aiDemoPage">
    <section class="heroSection">
      <div class="container heroInner">
        <div class="heroContent">
          <div class="heroBadge">A3 多智能体演示中枢</div>
          <h1>把意图识别、Agent 路径、学习计划与生成资源放到同一张答辩画布里</h1>
          <p>
            这个页面直接串联网关 `/ai/v1/chat`，把题目更关心的
            `intent`、`agent_trace`、`generated_plan`、`generated_resources`
            结构化展示出来，方便你讲“检索增强 + 多智能体协作 + 教学资源生成”的完整闭环。
          </p>
          <div class="heroStats">
            <div class="statCard">
              <span>网关入口</span>
              <strong>/ai/v1/chat</strong>
            </div>
            <div class="statCard">
              <span>默认课程</span>
              <strong>ml_intro</strong>
            </div>
            <div class="statCard">
              <span>演示模式</span>
              <strong>4 类场景</strong>
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
              <strong>{{ responseData?.agent_trace?.length || 0 }} steps</strong>
            </div>
            <div class="signalCard amber">
              <span>Plan</span>
              <strong>{{ planStepCount }} steps</strong>
            </div>
            <div class="signalCard coral">
              <span>Resources</span>
              <strong>{{ resourceCount }} items</strong>
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
          <h2>对话控制台</h2>
          <p>切换场景、快速填充提示词，然后直接发起一次多智能体调用。</p>
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
          <label class="fieldItem">
            <span>场景</span>
            <el-select v-model="form.scene" placeholder="请选择场景">
              <el-option
                v-for="preset in presets"
                :key="preset.scene"
                :label="preset.label"
                :value="preset.scene"
              />
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

        <div v-if="fallbackNotice" class="fallbackPanel">
          <strong>已切换为演示快照</strong>
          <p>{{ fallbackNotice }}</p>
        </div>

        <div v-if="errorMessage && !fallbackNotice" class="errorPanel">
          <strong>调用失败</strong>
          <p>{{ errorMessage }}</p>
        </div>
      </div>

      <div class="resultPanel">
        <div class="resultHeader">
          <div>
            <h2>智能体协同结果</h2>
            <p>结构化输出适合直接截图到方案文档或现场答辩页面。</p>
          </div>
          <div class="statusPill" :class="{ ready: !!responseData, demo: resultMode === 'demo' }">
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
            <strong>{{ citationCount }}</strong>
          </div>
          <div class="overviewCard">
            <span>Resources</span>
            <strong>{{ resourceCount }}</strong>
          </div>
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
          <div v-else class="emptyState">运行后会展示路由决策和各 Agent 的执行痕迹。</div>
        </div>

        <div class="resultBlock">
          <div class="blockTitle">Answer</div>
          <div v-if="responseData?.answer" class="answerCard">{{ responseData.answer }}</div>
          <div v-else class="emptyState">这里会展示整合后的最终回答。</div>
        </div>

        <div class="resultBlock dualBlock">
          <div class="subBlock">
            <div class="blockTitle">Generated Plan</div>
            <div v-if="planSummary || generatedPlanSteps.length" class="planCard">
              <p v-if="planSummary" class="planSummary">{{ planSummary }}</p>
              <div v-for="(step, index) in generatedPlanSteps" :key="index" class="planStep">
                <span>{{ index + 1 }}</span>
                <div>
                  <strong>{{ getPlanStepTitle(step, index) }}</strong>
                  <p>{{ getPlanStepDescription(step) }}</p>
                </div>
              </div>
            </div>
            <div v-else class="emptyState">当前场景没有生成学习计划时，这里会保持为空。</div>
          </div>

          <div class="subBlock">
            <div class="blockTitle">Citations</div>
            <div v-if="citations.length" class="citationList">
              <div v-for="citation in citations" :key="`${citation.chunk_id}-${citation.source}`" class="citationCard">
                <strong>{{ citation.source || "未命名片段" }}</strong>
                <p>Chunk #{{ citation.chunk_id ?? "--" }}</p>
                <em>相似度 {{ formatScore(citation.score) }}</em>
              </div>
            </div>
            <div v-else class="emptyState">当前回答未返回引用片段时，这里会保持为空。</div>
          </div>
        </div>

        <div class="resultBlock">
          <div class="blockTitle">Generated Resources</div>
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
const fallbackNotice = ref("");
const resultMode = ref("idle");
const currentTaskId = ref(null);

const agentTrace = computed(() => responseData.value?.agent_trace || []);
const citations = computed(() => responseData.value?.citations || []);
const generatedResources = computed(() => responseData.value?.generated_resources || []);
const generatedPlan = computed(() => responseData.value?.generated_plan || null);
const generatedPlanSteps = computed(() => generatedPlan.value?.steps || []);
const planSummary = computed(() => generatedPlan.value?.summary || "");
const citationCount = computed(() => citations.value.length);
const resourceCount = computed(() => generatedResources.value.length);
const answerLength = computed(() => responseData.value?.answer?.length || 0);
const planStepCount = computed(() => generatedPlanSteps.value.length);
const heroTracePreview = computed(() => {
  if (agentTrace.value.length) {
    return agentTrace.value.slice(0, 5);
  }
  return ["profile", "router", "retriever", "planner", "resource"];
});
const resultStatusText = computed(() => {
  if (loading.value && currentTaskId.value) {
    return `任务执行中 #${currentTaskId.value}`;
  }
  if (resultMode.value === "live") {
    return "实时结果";
  }
  if (resultMode.value === "demo") {
    return "演示快照";
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
  fallbackNotice.value = "";
  currentTaskId.value = null;
};

const sleep = (ms) => new Promise((resolve) => {
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
  throw new Error(`demo_ui_timeout_${timeoutMs}`);
};

const submitChat = async () => {
  if (!form.message.trim()) {
    ElMessage.warning("请先输入演示问题或任务目标");
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  fallbackNotice.value = "";
  resultMode.value = "idle";
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
    responseData.value = await pollChatTaskUntilDone(
      task.task_id,
      120000,
      task.poll_interval_ms || 2000,
    );
    resultMode.value = "live";
    ElMessage.success("多智能体演示结果已生成");
  } catch (error) {
    errorMessage.value =
      error?.response?.data?.detail || error?.message || "AI 服务暂时不可用，请检查网关和 Python 服务";
    fallbackNotice.value = "本地开发代理对长响应不稳定，页面已自动切换为同结构演示快照，便于继续展示多智能体结果。";
    responseData.value = buildDemoResponse({
      userId: form.user_id,
      courseCode: form.course_code.trim(),
      scene: form.scene,
      message: form.message.trim(),
    });
    resultMode.value = "demo";
    ElMessage.warning("实时链路未完成，已切换为演示快照");
  } finally {
    loading.value = false;
  }
};

const parseTraceTitle = (trace) => {
  if (!trace?.includes(":")) {
    return trace || "unknown";
  }
  return trace.split(":")[0];
};

const parseTraceDetail = (trace) => {
  if (!trace?.includes(":")) {
    return "已执行该智能体节点";
  }
  const detail = trace.split(":").slice(1).join(":");
  return `输出标记：${detail}`;
};

const getPlanStepTitle = (step, index) => step?.title || step?.name || `阶段 ${index + 1}`;

const getPlanStepDescription = (step) =>
  step?.description || step?.objective || step?.content || step?.goal || "该阶段用于推进当前主题学习。";

const formatScore = (score) => {
  if (typeof score !== "number") {
    return "--";
  }
  return score.toFixed(3);
};

const buildDemoResponse = ({ userId, courseCode, scene, message }) => {
  const intentMap = {
    study_assistant: "qa",
    study_plan: "study_plan",
    resource_generation: "resource_generation",
    comprehensive: "comprehensive",
  };
  const normalizedIntent = intentMap[scene] || "comprehensive";
  const baseTrace = ["profile", `router:${normalizedIntent}`];
  const traceByIntent = {
    qa: [...baseTrace, "retriever:4", "evaluator", "safety"],
    study_plan: [...baseTrace, "planner:3", "evaluator", "safety"],
    resource_generation: [...baseTrace, "resource:2", "evaluator", "safety"],
    comprehensive: [...baseTrace, "retriever:4", "planner:3", "resource:2", "evaluator", "safety"],
  };

  const citationsData = [
    { source: "监督学习基础", chunk_id: 22, score: 0.218 },
    { source: "特征工程与实践建议", chunk_id: 24, score: 0.205 },
    { source: "模型评估与过拟合", chunk_id: 23, score: 0.179 },
    { source: "机器学习导论-课程概览", chunk_id: 21, score: 0.153 },
  ];

  const planData = {
    user_id: userId,
    course_code: courseCode,
    course_name: "机器学习导论",
    summary: `围绕“${message}”生成的 3 天学习路径，适合答辩中展示“检索增强 + 计划生成”的组合能力。`,
    progress_hint: "当前进度按首次学习估计，可在后续接入真实用户画像后细化。",
    next_action: "优先完成第 1 天的概念理解与笔记整理，再进入练习和资源吸收阶段。",
    risk_alerts: ["当前为演示快照，后续可进一步接入真实学情与历史行为。"],
    steps: [
      {
        day: 1,
        title: "监督学习基础",
        objective: "理解过拟合、泛化误差与训练/验证/测试集的关系。",
        tasks: ["阅读概念讲义", "整理 3 条核心定义", "完成 1 组基础判断题"],
        checkpoint: "能够用自己的话解释“训练好不等于泛化好”。",
      },
      {
        day: 2,
        title: "特征工程与实践建议",
        objective: "掌握特征处理对模型效果与过拟合风险的影响。",
        tasks: ["复习特征处理流程", "比较基线模型与优化模型", "完成 1 个案例分析"],
        checkpoint: "能指出至少 2 种降低噪声和过拟合风险的做法。",
      },
      {
        day: 3,
        title: "模型评估与过拟合",
        objective: "结合指标和学习曲线判断模型是否过拟合。",
        tasks: ["复习准确率、召回率、F1", "观察学习曲线示例", "完成 1 组综合题"],
        checkpoint: "能够根据训练/验证表现提出合理改进建议。",
      },
    ],
  };

  const resourcesData = [
    {
      resource_type: "lecture_note",
      title: "课程讲义",
      summary: "围绕过拟合主题整理的讲义摘要，可用于课堂展示和课后复习。",
      content_markdown:
        "# 过拟合讲义提纲\n\n## 核心概念\n- 训练误差与泛化误差\n- 欠拟合 / 过拟合\n- 验证集与交叉验证\n\n## 典型现象\n- 训练集表现很好，测试集表现下降\n- 模型复杂度过高\n\n## 常见缓解方式\n- 增加数据\n- 正则化\n- 降低模型复杂度\n- 更合理的特征工程",
      source_titles: ["监督学习基础", "模型评估与过拟合"],
      study_suggestion: "先通读讲义，再把关键术语整理成自己的思维导图。",
    },
    {
      resource_type: "quiz_set",
      title: "分层练习题",
      summary: "包含基础题、案例题和综合题，适合答辩演示“资源生成”能力。",
      content_markdown:
        "# 练习建议\n\n- 基础题：区分训练误差与测试误差\n- 提升题：分析一个过拟合案例\n- 综合题：设计一个降低过拟合风险的实验方案",
      source_titles: ["特征工程与实践建议", "模型评估与过拟合"],
      study_suggestion: "先做基础题，再做综合题，最后回看错误原因。",
    },
  ];

  const answerByIntent = {
    qa: "过拟合是指模型在训练集上学得过于细致，连噪声也记住了，所以训练表现很好，但到了新数据上泛化能力下降。",
    study_plan: "我已经为你生成了一个 3 天学习计划，先补概念基础，再进入特征工程与模型评估，最后做综合练习。",
    resource_generation: "我已经为你准备了讲义提纲和分层练习题，方便你直接展示课程资源自动生成效果。",
    comprehensive:
      "过拟合是模型对训练样本记忆过强、对新样本泛化不足的现象。我已经同时整理了学习计划和推荐资源，方便从概念理解一路推进到练习与复盘。",
  };

  return {
    session_id: null,
    answer: answerByIntent[normalizedIntent] || answerByIntent.comprehensive,
    citations: normalizedIntent === "resource_generation" ? citationsData.slice(0, 2) : citationsData,
    intent: normalizedIntent,
    agent_trace: traceByIntent[normalizedIntent] || traceByIntent.comprehensive,
    generated_plan: normalizedIntent === "qa" ? null : planData,
    generated_resources: normalizedIntent === "study_plan" ? [] : resourcesData,
  };
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
  box-shadow: 0 24px 60px rgba(31, 58, 94, 0.10);
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
  position: relative;
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
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;

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
  transition: 0.2s ease;

  &:hover,
  &.active {
    transform: translateY(-2px);
    background: linear-gradient(135deg, #0d67dc 0%, #1f9b83 100%);
    color: #fff;
    box-shadow: 0 16px 28px rgba(15, 89, 166, 0.22);
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

.fieldItem:last-child {
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
  transition: 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 30px rgba(22, 72, 132, 0.12);
  }

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

.fallbackPanel {
  margin-top: 18px;
  padding: 16px 18px;
  border-radius: 18px;
  background: #fff8e8;
  color: #8a5a08;

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

.statusPill.demo {
  background: rgba(243, 162, 34, 0.16);
  color: #9a6105;
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
  .overviewGrid {
    grid-template-columns: 1fr;
  }

  .fieldGrid,
  .presetGroup {
    grid-template-columns: 1fr;
  }
}
</style>
