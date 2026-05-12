<template>
  <div class="tutorPage">
    <section class="heroSection">
      <div class="container heroInner">
        <div class="heroContent">
          <div class="heroBadge">A3 AI Tutor</div>
          <div class="heroKicker">学生提问 · AI 解答 · 人工升级</div>
          <h1>智能辅导工作台</h1>
          <p>
            学生提问后，可以在这里完成 AI 解答、学习计划生成、资源推荐和人工升级工单处理。
            页面同时保留历史问答、知识引用和工单状态，方便直接演示完整辅导闭环。
          </p>
          <div class="heroActions">
            <router-link class="navLink light" to="/main/index">返回首页</router-link>
            <router-link class="navLink dark" to="/main/ai-report">查看学习报告</router-link>
            <router-link class="navLink ghost" to="/main/ai-mistakes">查看错题修复</router-link>
          </div>
        </div>

        <div class="heroPanel">
          <div class="heroPanelIntro">
            <strong>辅导进度看板</strong>
            <p>这里不是提问输入区，而是用来查看本次辅导是否已返回结果，以及历史问答、知识引用和人工升级情况。</p>
          </div>
          <div class="summaryCard">
            <span>本次辅导</span>
            <strong>{{ statusText }}</strong>
            <em>看当前问题是否还在处理中，还是已经返回答案。</em>
          </div>
          <div class="summaryCard">
            <span>历史会话</span>
            <strong>{{ historyList.length }}</strong>
            <em>保留最近几次提问，方便继续追问或回看。</em>
          </div>
          <div class="summaryCard">
            <span>知识引用</span>
            <strong>{{ citations.length }}</strong>
            <em>展示本次回答引用了多少知识片段。</em>
          </div>
          <div class="summaryCard">
            <span>人工工单</span>
            <strong>{{ ticketList.length }}</strong>
            <em>当 AI 回答不够时，可以在这里追踪人工升级。</em>
          </div>
        </div>
      </div>
    </section>

    <section class="container workbenchSection">
      <div class="controlPanel">
        <div class="panelTitle">
          <h2>和智能辅导助手对话</h2>
          <p>这里改成像聊天一样提问：输入你的问题，选择想要的帮助类型，系统会返回答案、学习计划、资源建议，必要时还能升级人工复核。</p>
        </div>

        <div class="chatHintCard">
          <strong>提问方式</strong>
          <p>直接把问题像发消息一样输进去就可以，例如“什么是过拟合”或“帮我做 3 天复习计划”。</p>
        </div>

        <div class="fieldGrid contextGrid">
          <button
            v-for="preset in presets"
            :key="preset.scene"
            class="presetCard"
            :class="{ active: form.scene === preset.scene }"
            @click="applyPreset(preset)"
          >
            <strong>{{ preset.label }}</strong>
            <span>{{ preset.tip }}</span>
          </button>
        </div>

        <div class="fieldGrid">
          <label class="fieldItem">
            <span>当前学员</span>
            <el-input :model-value="selectedStudentLabel" readonly />
          </label>
          <label class="fieldItem">
            <span>所属课程</span>
            <el-select v-model="form.course_code" placeholder="请选择课程">
              <el-option
                v-for="course in courseOptions"
                :key="course.code"
                :label="course.name"
                :value="course.code"
              />
            </el-select>
          </label>
        </div>

        <label class="fieldItem messageField">
          <span>发送你的问题</span>
          <el-input
            v-model="form.message"
            type="textarea"
            :rows="7"
            resize="none"
            placeholder="像和 AI 助手聊天一样输入问题，例如：请解释过拟合，并给我一份适合课后复习的学习计划。"
          />
        </label>

        <div class="quickPromptPanel">
          <div v-for="prompt in quickPrompts" :key="prompt.title" class="quickPromptCard" @click="fillPrompt(prompt)">
            <strong>{{ prompt.title }}</strong>
            <p>{{ prompt.message }}</p>
          </div>
        </div>

        <div class="actionRow">
          <el-button type="primary" size="large" :loading="loading" @click="submitTask">
            {{ loading ? "正在生成回答..." : "发送给智能辅导助手" }}
          </el-button>
          <el-button size="large" plain @click="resetForm">重置输入</el-button>
        </div>

        <div class="taskInfoPanel">
          <span>任务 ID</span>
          <strong>{{ currentTaskId ? `#${currentTaskId}` : "尚未创建" }}</strong>
        </div>

        <div v-if="errorMessage" class="errorPanel">
          <strong>任务提示</strong>
          <p>{{ errorMessage }}</p>
        </div>
      </div>

      <div class="resultPanel">
        <div class="resultHeader">
          <div>
            <h2>辅导结果</h2>
            <p>集中展示最终回答、知识引用、计划资源联动和人工升级入口。</p>
          </div>
          <div class="statusPill" :class="{ ready: !!responseData, running: loading }">
            {{ statusText }}
          </div>
        </div>

        <div class="overviewGrid">
          <div class="overviewCard">
            <span>问题意图</span>
            <strong>{{ responseData?.intent || "--" }}</strong>
          </div>
          <div class="overviewCard">
            <span>回答长度</span>
            <strong>{{ answerLength }}</strong>
          </div>
          <div class="overviewCard">
            <span>生成资源</span>
            <strong>{{ generatedResources.length }}</strong>
          </div>
          <div class="overviewCard">
            <span>计划步骤</span>
            <strong>{{ generatedPlanSteps.length }}</strong>
          </div>
        </div>

        <div class="resultBlock">
          <div class="blockTitle">最终回答</div>
          <div v-if="responseData?.answer" class="answerCard">{{ responseData.answer }}</div>
          <div v-else class="emptyState">任务完成后，这里会展示智能辅导生成的最终回答。</div>
        </div>

        <div class="resultBlock">
          <div class="ticketHeader">
            <div class="blockTitle">人工升级工单</div>
            <el-button type="warning" plain :disabled="!responseData?.answer" :loading="ticketSubmitting" @click="submitTicket">
              升级人工处理
            </el-button>
          </div>
          <div class="ticketTips">
            当 AI 回答仍需进一步解释、补充材料或人工复核时，可直接生成工单并回看处理状态。
          </div>
          <div v-if="ticketList.length" class="ticketList">
            <div v-for="item in ticketList" :key="item.ticket_id" class="ticketCard">
              <div class="ticketMeta">
                <strong>{{ item.title }}</strong>
                <span>{{ item.status }}</span>
              </div>
              <p>{{ item.question_summary }}</p>
              <em>{{ item.created_at || "刚刚创建" }}</em>
            </div>
          </div>
          <div v-else class="emptyState">当前还没有人工升级工单。</div>
        </div>

        <div class="resultBlock dualBlock">
          <div class="subBlock">
            <div class="blockTitle">知识引用</div>
            <div v-if="citations.length" class="citationList">
              <div v-for="citation in citations" :key="`${citation.chunk_id}-${citation.source}`" class="citationCard">
                <strong>{{ citation.source || "未命名片段" }}</strong>
                <p>Chunk #{{ citation.chunk_id ?? "--" }}</p>
                <em>相似度 {{ formatScore(citation.score) }}</em>
              </div>
            </div>
            <div v-else class="emptyState">当前结果没有返回引用片段。</div>
          </div>

          <div class="subBlock">
            <div class="blockTitle">协同轨迹</div>
            <div v-if="agentTrace.length" class="traceTimeline">
              <div v-for="(item, index) in agentTrace" :key="`${item}-${index}`" class="traceItem">
                <span class="traceIndex">{{ index + 1 }}</span>
                <div class="traceBody">
                  <strong>{{ parseTraceTitle(item) }}</strong>
                  <p>{{ parseTraceDetail(item) }}</p>
                </div>
              </div>
            </div>
            <div v-else class="emptyState">当前没有多智能体协同轨迹。</div>
          </div>
        </div>

        <div class="resultBlock dualBlock">
          <div class="subBlock">
            <div class="blockTitle">生成计划</div>
            <div v-if="generatedPlanSteps.length" class="planList">
              <div v-for="(step, index) in generatedPlanSteps" :key="index" class="planStep">
                <span>{{ index + 1 }}</span>
                <div>
                  <strong>{{ getPlanStepTitle(step, index) }}</strong>
                  <p>{{ getPlanStepDescription(step) }}</p>
                </div>
              </div>
            </div>
            <div v-else class="emptyState">当前问答没有附带学习计划。</div>
          </div>

          <div class="subBlock">
            <div class="blockTitle">生成资源</div>
            <div v-if="generatedResources.length" class="resourceList">
              <div v-for="(resource, index) in generatedResources" :key="`${resource.title}-${index}`" class="resourceCard">
                <span>{{ resource.resource_type || "资源" }}</span>
                <strong>{{ resource.title || `资源 ${index + 1}` }}</strong>
                <p>{{ resource.summary || "暂无摘要" }}</p>
              </div>
            </div>
            <div v-else class="emptyState">当前问答没有附带资源生成结果。</div>
          </div>
        </div>

        <div class="resultBlock">
          <div class="blockTitle">最近会话记录</div>
          <div v-if="historyList.length" class="historyList">
            <div v-for="item in historyList" :key="item.id" class="historyCard">
              <div class="historyHead">
                <strong>{{ item.sceneLabel }}</strong>
                <span>{{ item.createdAt }}</span>
              </div>
              <p class="historyQuestion">{{ item.message }}</p>
              <p class="historyAnswer">{{ item.answer }}</p>
            </div>
          </div>
          <div v-else class="emptyState">提交辅导任务后，这里会保留最近会话记录。</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { createAiChatTicket, getAiChatTaskStatus, listAiChatTickets, submitAiChatTask } from "@/api/ai";
import { a3DemoScenario } from "@/mock/a3DemoData";

const HISTORY_KEY = "a3_student_tutor_history";

const presets = [
  { label: "知识问答", scene: "study_assistant", tip: "解释概念、拆解知识点、给出学习示例" },
  { label: "学习规划", scene: "study_plan", tip: "生成阶段计划和每日任务安排" },
  { label: "资源生成", scene: "resource_generation", tip: "围绕知识点生成讲义、练习和扩展阅读" },
  { label: "综合辅导", scene: "comprehensive", tip: "同时返回回答、计划、资源与评估建议" },
];

const quickPrompts = [
  {
    title: "概念理解",
    scene: "study_assistant",
    message: "什么是过拟合？请结合生活化例子解释，并告诉我如何避免。",
  },
  {
    title: "三天复习",
    scene: "study_plan",
    message: "请帮我做一个 3 天复习计划，主题是机器学习中的过拟合、泛化误差和模型评估。",
  },
  {
    title: "课堂演示链路",
    scene: "comprehensive",
    message: "请解释过拟合，并给我一份学习计划和推荐资源，适合学生课后巩固与演示复盘。",
  },
];

const initialForm = () => ({
  user_id: a3DemoScenario.userId,
  course_code: a3DemoScenario.courseCode,
  scene: "comprehensive",
  message: "请解释过拟合，并给我一份学习计划和推荐资源，适合学生课后巩固与演示复盘。",
});

const courseOptions = [
  { code: a3DemoScenario.courseCode, name: a3DemoScenario.courseName },
  { code: "ml_foundation", name: "机器学习基础导论" },
  { code: "data_mining_case", name: "数据挖掘案例分析" },
];

const form = reactive(initialForm());
const loading = ref(false);
const ticketSubmitting = ref(false);
const errorMessage = ref("");
const currentTaskId = ref(null);
const responseData = ref(null);
const pollingTimer = ref(null);
const historyList = ref(readHistory());
const ticketList = ref([]);

function normalizeHistoryText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(/适合课堂现场演示/g, "适合学生课后巩固与演示复盘")
    .replace(/请解释过拟合，并给我一个学习计划和推荐资源/g, "请解释过拟合，并给我一份学习计划和推荐资源")
    .trim();
}

function readHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map((item) => ({
          ...item,
          message: normalizeHistoryText(item?.message),
          answer: normalizeHistoryText(item?.answer),
        }))
      : [];
  } catch {
    return [];
  }
}

function saveHistory(item) {
  const normalizedItem = {
    ...item,
    message: normalizeHistoryText(item?.message),
    answer: normalizeHistoryText(item?.answer),
  };
  const next = [normalizedItem, ...historyList.value].slice(0, 8);
  historyList.value = next;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Ignore local history write failures in demo mode.
  }
}

const citations = computed(() => responseData.value?.citations || []);
const agentTrace = computed(() => responseData.value?.agent_trace || []);
const generatedResources = computed(() => responseData.value?.generated_resources || []);
const generatedPlanSteps = computed(() => responseData.value?.generated_plan?.steps || []);
const answerLength = computed(() => responseData.value?.answer?.length || 0);
const selectedStudentLabel = computed(() => `${a3DemoScenario.studentName}（演示账号）`);
const statusText = computed(() => {
  if (loading.value && currentTaskId.value) {
    return `任务执行中 #${currentTaskId.value}`;
  }
  if (responseData.value) {
    return "结果已返回";
  }
  return "等待提交";
});

const sceneLabelMap = Object.fromEntries(presets.map((item) => [item.scene, item.label]));

const applyPreset = (preset) => {
  form.scene = preset.scene;
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
    pollingTimer.value = window.setTimeout(resolve, ms);
  });

const clearPollingTimer = () => {
  if (pollingTimer.value) {
    window.clearTimeout(pollingTimer.value);
    pollingTimer.value = null;
  }
};

const pollTaskUntilDone = async (taskId, timeoutMs = 120000, intervalMs = 2000) => {
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
  throw new Error("辅导任务超时，请稍后重试");
};

const loadTickets = async () => {
  try {
    const result = await listAiChatTickets({
      user_id: form.user_id,
      course_code: form.course_code,
    });
    ticketList.value = result.items || [];
  } catch {
    ticketList.value = [];
  }
};

const submitTask = async () => {
  if (!form.message.trim()) {
    ElMessage.warning("请先输入学生问题");
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  responseData.value = null;
  currentTaskId.value = null;
  clearPollingTimer();

  try {
    const task = await submitAiChatTask({
      user_id: form.user_id,
      course_code: form.course_code.trim(),
      scene: form.scene,
      message: form.message.trim(),
    });

    currentTaskId.value = task.task_id;
    const result = await pollTaskUntilDone(task.task_id);
    responseData.value = result;

    saveHistory({
      id: `${task.task_id}-${Date.now()}`,
      scene: form.scene,
      sceneLabel: sceneLabelMap[form.scene] || form.scene,
      message: form.message.trim(),
      answer: result.answer || "暂无回答",
      createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    });

    ElMessage.success("智能辅导结果已返回");
  } catch (error) {
    errorMessage.value = error?.response?.data?.detail || error?.message || "智能辅导任务执行失败，请稍后重试";
  } finally {
    clearPollingTimer();
    loading.value = false;
  }
};

const submitTicket = async () => {
  if (!responseData.value?.answer) {
    ElMessage.warning("请先完成一次问答再升级人工处理");
    return;
  }

  ticketSubmitting.value = true;
  try {
    await createAiChatTicket({
      user_id: form.user_id,
      session_id: responseData.value?.session_id || null,
      course_code: form.course_code.trim(),
      title: `${sceneLabelMap[form.scene] || "智能辅导"}人工复核`,
      question_summary: form.message.trim(),
      latest_answer: responseData.value.answer,
      priority: "normal",
    });
    ElMessage.success("人工工单已创建");
    await loadTickets();
  } catch (error) {
    ElMessage.error(error?.response?.data?.detail || error?.message || "人工工单创建失败");
  } finally {
    ticketSubmitting.value = false;
  }
};

const formatScore = (score) => {
  if (score === undefined || score === null || Number.isNaN(Number(score))) {
    return "--";
  }
  return Number(score).toFixed(3);
};

const parseTraceTitle = (trace) => {
  const parts = String(trace).split(":");
  return parts[0] || "agent";
};

const parseTraceDetail = (trace) => {
  const parts = String(trace).split(":");
  return parts.slice(1).join(":").trim() || "执行完成";
};

const getPlanStepTitle = (step, index) => step?.title || step?.step_name || step?.focus || `计划步骤 ${index + 1}`;
const getPlanStepDescription = (step) => step?.description || step?.task || step?.objective || step?.content || "该阶段已生成默认执行说明。";

onMounted(() => {
  loadTickets();
});

onBeforeUnmount(() => {
  clearPollingTimer();
});
</script>

<style scoped lang="scss">
.tutorPage {
  min-height: 100vh;
  padding-bottom: 48px;
  background:
    radial-gradient(circle at top left, rgba(37, 99, 235, 0.12), transparent 26%),
    radial-gradient(circle at top right, rgba(14, 165, 233, 0.14), transparent 24%),
    linear-gradient(180deg, #f4f8ff 0%, #eef4fb 52%, #f8fafc 100%);
}

.heroSection {
  padding: 32px 0 24px;
}

.heroInner {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) 340px;
  gap: 24px;
}

.heroContent,
.heroPanel,
.controlPanel,
.resultPanel {
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
}

.heroContent {
  padding: 32px;

  h1 {
    margin-top: 10px;
    color: #0f172a;
    font-size: 54px;
    font-weight: 800;
    line-height: 1.14;
    letter-spacing: -0.04em;
  }

  p {
    margin-top: 14px;
    color: #475569;
    font-size: 16px;
    line-height: 1.9;
  }
}

.heroBadge {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.heroKicker {
  margin-top: 16px;
  color: #0f766e;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.heroActions,
.actionRow {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 24px;
}

.navLink {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 148px;
  height: 46px;
  padding: 0 20px;
  border-radius: 999px;
  font-weight: 700;
}

.navLink.light {
  background: #e0ecff;
  color: #1d4ed8;
}

.navLink.dark {
  background: linear-gradient(135deg, #2563eb 0%, #0f766e 100%);
  color: #fff;
}

.navLink.ghost {
  border: 1px solid rgba(37, 99, 235, 0.18);
  background: #fff;
  color: #1e3a8a;
}

.heroPanel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 22px;
  align-content: start;
}

.heroPanelIntro {
  grid-column: 1 / -1;
  padding: 4px 2px 2px;

  strong {
    color: #0f172a;
    font-size: 22px;
  }

  p {
    margin-top: 10px;
    color: #64748b;
    line-height: 1.8;
  }
}

.summaryCard,
.overviewCard,
.taskInfoPanel,
.resourceCard,
.historyCard,
.citationCard,
.traceBody,
.answerCard,
.emptyState,
.ticketCard {
  border-radius: 20px;
  background: #f8fbff;
}

.summaryCard,
.overviewCard {
  padding: 18px;

  span {
    display: block;
    color: #64748b;
    font-size: 12px;
  }

  strong {
    display: block;
    margin-top: 10px;
    color: #0f172a;
    font-size: 24px;
  }

  em {
    display: block;
    margin-top: 10px;
    color: #64748b;
    font-style: normal;
    line-height: 1.7;
  }
}

.workbenchSection {
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr);
  gap: 24px;
}

.controlPanel,
.resultPanel {
  padding: 28px;
}

.panelTitle h2,
.resultHeader h2 {
  color: #0f172a;
  font-size: 28px;
}

.panelTitle p,
.resultHeader p {
  margin-top: 10px;
  color: #64748b;
  line-height: 1.8;
}

.presetGroup,
.quickPromptPanel,
.overviewGrid,
.ticketList {
  display: grid;
  gap: 14px;
}

.presetGroup {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 24px;
}

.chatHintCard {
  margin-top: 22px;
  padding: 18px 20px;
  border-radius: 20px;
  background: linear-gradient(135deg, #e8f1ff 0%, #edfdf5 100%);

  strong {
    color: #0f172a;
    font-size: 16px;
  }

  p {
    margin-top: 8px;
    color: #475569;
    line-height: 1.8;
  }
}

.contextGrid {
  margin-top: 20px;
}

.presetCard {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px;
  border: none;
  border-radius: 20px;
  background: #eef4fb;
  text-align: left;
  cursor: pointer;
  transition: 0.2s ease;

  strong {
    color: #0f172a;
  }

  span {
    color: #64748b;
    font-size: 13px;
    line-height: 1.6;
  }
}

.presetCard.active,
.presetCard:hover {
  transform: translateY(-2px);
  background: linear-gradient(135deg, #dbeafe 0%, #dcfce7 100%);
}

.fieldGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 22px;
}

.fieldItem {
  display: flex;
  flex-direction: column;
  gap: 10px;

  span {
    color: #0f172a;
    font-weight: 700;
  }
}

.messageField {
  margin-top: 18px;

  :deep(.el-textarea__inner) {
    border-radius: 20px;
    padding: 18px 18px 20px;
    line-height: 1.8;
    box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18);
  }
}

.quickPromptPanel {
  margin-top: 20px;
}

.quickPromptCard {
  padding: 18px;
  border-radius: 20px;
  background: linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%);
  cursor: pointer;

  strong {
    color: #0f172a;
  }

  p {
    margin-top: 8px;
    color: #64748b;
    line-height: 1.7;
  }
}

.taskInfoPanel {
  margin-top: 18px;
  padding: 16px 18px;

  span {
    display: block;
    color: #64748b;
    font-size: 12px;
  }

  strong {
    display: block;
    margin-top: 8px;
    color: #0f172a;
  }
}

.errorPanel {
  margin-top: 18px;
  padding: 16px 18px;
  border-radius: 18px;
  background: #fff1f2;
  color: #be123c;

  p {
    margin-top: 8px;
    line-height: 1.7;
  }
}

.resultHeader,
.ticketHeader,
.historyHead,
.ticketMeta {
  display: flex;
  justify-content: space-between;
  gap: 20px;
}

.statusPill {
  height: fit-content;
  padding: 8px 14px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #475569;
  font-weight: 700;
}

.statusPill.ready {
  background: #dcfce7;
  color: #15803d;
}

.statusPill.running {
  background: #dbeafe;
  color: #1d4ed8;
}

.overviewGrid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 22px;
}

.resultBlock {
  margin-top: 22px;
  padding: 22px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(249, 251, 254, 0.98), rgba(239, 245, 250, 0.94));
}

.ticketTips {
  margin-top: 12px;
  color: #64748b;
  line-height: 1.8;
}

.ticketCard {
  padding: 16px 18px;

  p,
  em,
  span {
    color: #64748b;
    line-height: 1.7;
    font-style: normal;
  }
}

.dualBlock {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.blockTitle {
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
}

.answerCard,
.emptyState {
  margin-top: 16px;
  padding: 18px;
  color: #475569;
  line-height: 1.8;
  white-space: pre-wrap;
}

.citationList,
.historyList,
.resourceList,
.planList,
.traceTimeline {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.citationCard,
.resourceCard,
.historyCard {
  padding: 16px 18px;

  strong {
    color: #0f172a;
  }

  p,
  em,
  span {
    color: #64748b;
    line-height: 1.7;
    font-style: normal;
  }
}

.traceItem,
.planStep {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.traceIndex,
.planStep span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 700;
  flex-shrink: 0;
}

.traceBody {
  flex: 1;
  padding: 14px 16px;

  p {
    margin-top: 6px;
    color: #64748b;
    line-height: 1.7;
  }
}

.planStep {
  padding: 14px 0;
  border-top: 1px solid #e2e8f0;

  &:first-child {
    padding-top: 0;
    border-top: none;
  }

  strong {
    color: #0f172a;
  }

  p {
    margin-top: 6px;
    color: #64748b;
    line-height: 1.7;
  }
}

.historyQuestion {
  margin-top: 10px;
}

.historyAnswer {
  margin-top: 8px;
}

@media (max-width: 1100px) {
  .heroInner,
  .workbenchSection,
  .dualBlock,
  .overviewGrid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .heroContent,
  .heroPanel,
  .controlPanel,
  .resultPanel {
    padding: 20px;
  }

  .heroContent h1 {
    font-size: 42px;
    line-height: 1.16;
  }

  .heroContent p {
    font-size: 16px;
    line-height: 1.8;
  }

  .fieldGrid,
  .presetGroup,
  .heroPanel {
    grid-template-columns: 1fr;
  }
}
</style>
