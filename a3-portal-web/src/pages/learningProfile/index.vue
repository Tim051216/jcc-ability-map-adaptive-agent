<template>
  <div class="aiProfilePage">
    <section class="heroSection">
      <div class="container heroInner">
        <div class="heroContent">
          <div class="heroBadge">对话式学习画像</div>
          <h1>通过对话采集，生成可演化的学习画像</h1>
          <p>
            学生用自然语言描述自己的学习基础、偏好和节奏，系统逐轮补全六维信息，并生成可被学习路径、
            资源推荐和学习报告复用的统一画像。
          </p>
          <div class="heroActions">
            <router-link class="navLink light" to="/main/index">返回首页</router-link>
            <router-link class="navLink dark" to="/main/ai-path">进入学习路径</router-link>
          </div>
        </div>

        <div class="heroPanel">
          <div class="summaryCard">
            <span>当前完整度</span>
            <strong>{{ profileSummary?.completeness ?? lastCompleteness }}%</strong>
          </div>
          <div class="summaryCard">
            <span>画像标签</span>
            <strong>{{ profileView.tags.length }}</strong>
          </div>
          <div class="summaryCard">
            <span>历史版本</span>
            <strong>{{ historyItems.length }}</strong>
          </div>
          <div class="summaryCard">
            <span>活跃会话</span>
            <strong>{{ sessionId ? "进行中" : "未开始" }}</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="container contentSection">
      <div class="conversationPanel">
        <div class="panelTitle">
          <h2>对话采集</h2>
          <p>从学习目标、理解方式、节奏偏好到兴趣方向，系统会根据缺失维度继续追问。</p>
        </div>

        <div class="identityRow">
          <label class="fieldItem">
            <span>用户 ID</span>
            <el-input-number v-model="userId" :min="1" :max="999999" />
          </label>
          <div class="sessionPill" :class="{ active: !!sessionId }">
            {{ sessionId ? `会话 #${sessionId}` : "尚未开启会话" }}
          </div>
        </div>

        <div class="progressPanel">
          <div class="progressHead">
            <strong>采集进度</strong>
            <span>{{ lastCompleteness }}%</span>
          </div>
          <el-progress :percentage="lastCompleteness" :stroke-width="10" />
          <div v-if="missingDimensions.length" class="dimensionRow">
            <span class="label">待补全</span>
            <div class="chipList">
              <span v-for="dimension in missingDimensions" :key="dimension" class="chip warm">
                {{ dimensionLabel(dimension) }}
              </span>
            </div>
          </div>
          <div v-if="collectedDimensions.length" class="dimensionRow">
            <span class="label">已采集</span>
            <div class="chipList">
              <span v-for="dimension in collectedDimensions" :key="dimension" class="chip cool">
                {{ dimensionLabel(dimension) }}
              </span>
            </div>
          </div>
        </div>

        <div class="actionRow">
          <el-button type="primary" size="large" :loading="starting" @click="startConversation">开始会话</el-button>
          <el-button size="large" plain :loading="sessionLoading" @click="reloadSession">读取会话</el-button>
          <el-button type="success" size="large" :loading="completing" :disabled="!sessionId" @click="completeConversation(false)">
            生成画像
          </el-button>
          <el-button type="warning" size="large" plain :loading="completing" :disabled="!sessionId" @click="completeConversation(true)">
            强制完成
          </el-button>
        </div>

        <div ref="messageListRef" class="messageBoard">
          <div v-if="!chatMessages.length" class="emptyState">
            点击“开始会话”后，系统会先给出引导问题，你可以像聊天一样完成信息采集。
          </div>
          <div
            v-for="(message, index) in chatMessages"
            :key="`${message.role}-${index}-${message.round_number}`"
            :class="['bubble', message.role === 'user' ? 'user' : 'assistant']"
          >
            <div class="bubbleMeta">
              <span>{{ message.role === "user" ? "学生" : "学习助手" }}</span>
              <span>第 {{ message.round_number }} 轮</span>
            </div>
            <div class="bubbleText">{{ message.content }}</div>
          </div>
        </div>

        <div class="composer">
          <el-input
            v-model="draft"
            type="textarea"
            resize="none"
            :rows="4"
            :disabled="!sessionId || sending"
            placeholder="例如：我更喜欢先看结构化讲解，再做分层练习。"
            @keydown.enter.exact.prevent="sendMessage"
          />
          <el-button type="primary" :loading="sending" :disabled="!sessionId || sending" @click="sendMessage">发送</el-button>
        </div>

        <div class="tipsPanel">
          <strong>建议这样描述</strong>
          <p>可以从“我目前掌握到哪里”“我更喜欢哪种学习形式”“我最近的学习安排和困难”开始。</p>
        </div>
      </div>

      <div class="resultPanel">
        <div class="resultHeader">
          <div>
            <h2>画像总览</h2>
            <p>{{ profileView.summary }}</p>
          </div>
          <div class="actionGroup">
            <el-button size="large" plain :loading="profileLoading" @click="loadProfileData(true)">刷新画像</el-button>
          </div>
        </div>

        <div ref="radarRef" class="radarChart" />

        <div class="resultBlock">
          <div class="blockTitle">学习标签</div>
          <div class="chipList">
            <span v-for="tag in profileView.tags" :key="tag" class="chip cool">{{ tag }}</span>
          </div>
        </div>

        <div class="summaryGrid">
          <div class="miniCard">
            <span>推荐学习方式</span>
            <strong>{{ profileView.recommendedLearningStyle }}</strong>
          </div>
          <div class="miniCard">
            <span>当前学习阶段</span>
            <strong>{{ profileView.currentStage }}</strong>
          </div>
          <div class="miniCard wide">
            <span>关键特征</span>
            <strong>{{ profileView.keyFeatures }}</strong>
          </div>
        </div>

        <div class="dimensionGrid">
          <div v-for="dimension in profileView.dimensions" :key="dimension.name" class="dimensionCard">
            <div class="dimensionHead">
              <span>{{ dimension.name }}</span>
              <strong>{{ dimension.completeness }}%</strong>
            </div>
            <div class="dimensionBody">
              <div v-for="entry in dimension.entries" :key="`${dimension.code}-${entry.label}`" class="dimensionEntry">
                <span class="entryLabel">{{ entry.label }}</span>
                <strong class="entryValue">{{ entry.value }}</strong>
              </div>
            </div>
          </div>
        </div>

        <div class="historyBlock">
          <div class="blockTitle">变更历史</div>
          <div v-if="historyItems.length" class="timeline">
            <div v-for="item in historyItems" :key="item.history_id" class="timelineItem">
              <div class="timelineDot" />
              <div class="timelineContent">
                <div class="timelineHead">
                  <strong>{{ changeTypeLabel(item.change_type) }}</strong>
                  <span>{{ formatTime(item.created_at) }}</span>
                </div>
                <p>{{ item.change_description || "暂无描述" }}</p>
                <div v-if="item.changed_dimensions?.length" class="chipList">
                  <span v-for="dimension in item.changed_dimensions" :key="dimension" class="chip muted">
                    {{ dimensionLabel(dimension) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="emptyCard">暂无历史记录。</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import * as echarts from "echarts/core";
import { RadarChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import { LegendComponent, RadarComponent, TooltipComponent } from "echarts/components";
import {
  completeAiProfileConversation,
  getAiConversationProfile,
  getAiConversationProfileHistory,
  getAiConversationProfileSummary,
  getAiProfileConversationSession,
  sendAiProfileConversationMessage,
  startAiProfileConversation,
} from "@/api/ai";
import { a3DemoScenario } from "@/mock/a3DemoData";

echarts.use([RadarChart, CanvasRenderer, LegendComponent, RadarComponent, TooltipComponent]);

const DIMENSION_ORDER = [
  ["knowledge_base", "知识基础"],
  ["cognitive_style", "认知风格"],
  ["learning_progress", "学习进度"],
  ["error_preference", "易错偏好"],
  ["interest_direction", "兴趣方向"],
  ["learning_habit", "学习习惯"],
];

const DIMENSION_MAP = Object.fromEntries(DIMENSION_ORDER);

const fallbackProfile = {
  summary: "该学生更适合先建立结构化框架，再配合练习和复盘推进模型评估与过拟合专题学习。",
  tags: ["结构化学习偏好", "节奏稳定", "适合答辩展示"],
  recommendedLearningStyle: "先讲解后练习",
  currentStage: "基础诊断",
  keyFeatures: "偏好结构化讲解，学习节奏稳定，适合按日推进任务并同步沉淀答辩表达。",
  dimensionCompleteness: {
    knowledge_base: 86,
    cognitive_style: 90,
    learning_progress: 78,
    error_preference: 72,
    interest_direction: 80,
    learning_habit: 84,
  },
  dimensions: [
    {
      name: "知识基础",
      completeness: 86,
      data: {
        level: "中等偏上",
        note: "已掌握模型评估主线，仍需加强泛化误差与易混概念表达。",
      },
    },
    {
      name: "认知风格",
      completeness: 90,
      data: {
        preference: "先看结构化讲解，再做分层练习",
        note: "适合先给整体框架，再安排题目和案例。",
      },
    },
    {
      name: "学习进度",
      completeness: 78,
      data: {
        status: "稳步推进",
        note: "适合按天拆分任务，逐步完成路径、资源和报告链路。",
      },
    },
    {
      name: "易错偏好",
      completeness: 72,
      data: {
        focus: ["过拟合与泛化误差区分", "指标解释口径"],
        note: "适合把易错点与答辩表达一并整理。",
      },
    },
    {
      name: "兴趣方向",
      completeness: 80,
      data: {
        topics: ["机器学习基础", "模型评估", "系统演示闭环"],
        note: "对实践型演示场景接受度较高。",
      },
    },
    {
      name: "学习习惯",
      completeness: 84,
      data: {
        rhythm: "每日 45 分钟左右",
        note: "适合短时高频复习与任务式推进。",
      },
    },
  ],
};

const userId = ref(a3DemoScenario.userId);
const sessionId = ref(null);
const chatMessages = ref([]);
const collectedDimensions = ref([]);
const missingDimensions = ref([]);
const lastCompleteness = ref(0);
const draft = ref("");

const starting = ref(false);
const sessionLoading = ref(false);
const sending = ref(false);
const completing = ref(false);
const profileLoading = ref(false);

const profileDetail = ref(null);
const profileSummary = ref(null);
const historyItems = ref([]);

const messageListRef = ref(null);
const radarRef = ref(null);
let radarChart = null;
let profileRequestId = 0;

function dimensionLabel(code) {
  return DIMENSION_MAP[code] || code;
}

function changeTypeLabel(type) {
  const map = {
    1: "初始创建",
    2: "对话更新",
    3: "行为更新",
    4: "人工调整",
  };
  return map[type] || `类型 ${type}`;
}

function parseError(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg || String(item)).join("；");
  return error?.message || "请求失败";
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatValue(value) {
  if (Array.isArray(value)) return [...new Set(value.filter(Boolean).map((item) => String(item).trim()))].join("、");
  if (value === null || value === undefined || value === "") return "暂无";
  return String(value).replace(/[，。；：、,.!?！？]+$/g, "").trim();
}

function shortenText(value, limit = 28) {
  const text = formatValue(value);
  if (text === "暂无") return text;
  return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
}

function summarizeDimensionEntries(code, data = {}) {
  const map = {
    knowledge_base: [
      ["当前水平", data.level],
      ["知识基础", data.background],
      ["已掌握内容", data.mastered_topics],
      ["薄弱环节", data.weak_areas],
    ],
    cognitive_style: [
      ["偏好形式", data.preferred_format],
      ["学习偏好", data.learning_preference],
      ["理解节奏", data.comprehension_speed],
    ],
    learning_progress: [
      ["当前阶段", data.current_stage],
      ["完成度", data.completion_rate !== undefined ? `${data.completion_rate}%` : null],
      ["学习节奏", data.learning_pace],
      ["每周投入", data.weekly_hours !== undefined ? `${data.weekly_hours} 小时` : null],
    ],
    error_preference: [
      ["高频卡点", data.common_errors],
      ["易混概念", data.confused_concepts],
      ["提醒重点", data.attention_points],
    ],
    interest_direction: [
      ["兴趣方向", data.interested_areas],
      ["学习动机", data.learning_motivation],
      ["目标预期", data.target_level],
    ],
    learning_habit: [
      ["最佳时段", data.best_time],
      ["专注时长", data.focus_duration !== undefined ? `${data.focus_duration} 分钟` : null],
      ["学习频率", data.study_frequency],
      ["学习模式", data.study_pattern],
    ],
  };

  const entries = (map[code] || Object.entries(data).map(([label, value]) => [label, value]))
    .map(([label, value]) => ({
      label,
      value: Array.isArray(value) ? formatValue(value) : shortenText(value),
    }))
    .filter((entry) => entry.value !== "暂无");

  if (entries.length) return entries;

  return [
    {
      label: "详情",
      value: formatValue(data),
    },
  ];
}

function syncCollectedDimensions() {
  const allDimensions = DIMENSION_ORDER.map(([code]) => code);
  collectedDimensions.value = allDimensions.filter((code) => !missingDimensions.value.includes(code));
}

function scrollToBottom() {
  nextTick(() => {
    const element = messageListRef.value;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  });
}

function normalizeMessages(messages = []) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    round_number: message.round_number,
  }));
}

function resetConversationState() {
  sessionId.value = null;
  chatMessages.value = [];
  collectedDimensions.value = [];
  missingDimensions.value = [];
  lastCompleteness.value = 0;
  draft.value = "";
}

function applySessionPayload(payload) {
  sessionId.value = payload.session_id;
  lastCompleteness.value = payload.completeness ?? 0;
  collectedDimensions.value = payload.collected_dimensions || [];
  chatMessages.value = normalizeMessages(payload.messages || []);
  scrollToBottom();
}

async function startConversation() {
  starting.value = true;
  try {
    resetConversationState();
    const payload = await startAiProfileConversation({
      user_id: userId.value,
      session_type: 1,
    });
    applySessionPayload(payload);
    ElMessage.success("会话已开始");
  } catch (error) {
    ElMessage.error(parseError(error));
  } finally {
    starting.value = false;
  }
}

async function reloadSession() {
  if (!sessionId.value) {
    ElMessage.warning("当前没有活跃会话");
    return;
  }
  sessionLoading.value = true;
  try {
    const payload = await getAiProfileConversationSession(sessionId.value);
    applySessionPayload(payload);
    ElMessage.success("会话已刷新");
  } catch (error) {
    ElMessage.error(parseError(error));
  } finally {
    sessionLoading.value = false;
  }
}

async function sendMessage() {
  const content = draft.value.trim();
  if (!content || !sessionId.value) return;

  sending.value = true;
  try {
    chatMessages.value.push({
      role: "user",
      content,
      round_number: chatMessages.value.filter((message) => message.role === "user").length + 1,
    });
    draft.value = "";
    scrollToBottom();

    const payload = await sendAiProfileConversationMessage({
      session_id: sessionId.value,
      content,
    });

    if (payload.assistant_message) {
      chatMessages.value.push({
        role: payload.assistant_message.role,
        content: payload.assistant_message.content,
        round_number: payload.assistant_message.round_number,
      });
    }

    if (payload.extraction_result) {
      missingDimensions.value = payload.extraction_result.missing_dimensions || [];
      lastCompleteness.value = payload.extraction_result.completeness ?? lastCompleteness.value;
      syncCollectedDimensions();
    }

    scrollToBottom();
  } catch (error) {
    ElMessage.error(parseError(error));
  } finally {
    sending.value = false;
  }
}

async function completeConversation(forceComplete) {
  if (!sessionId.value) return;

  completing.value = true;
  try {
    await completeAiProfileConversation({
      session_id: sessionId.value,
      force_complete: forceComplete,
    });
    ElMessage.success("学习画像已生成");
    await loadProfileData(true);
  } catch (error) {
    ElMessage.error(parseError(error));
  } finally {
    completing.value = false;
  }
}

function buildRadarOption(view) {
  return {
    tooltip: {},
    legend: {
      bottom: 0,
      data: ["六维完整度"],
    },
    radar: {
      radius: "62%",
      indicator: DIMENSION_ORDER.map(([, label]) => ({ name: label, max: 100 })),
      splitArea: {
        areaStyle: {
          color: ["rgba(37,99,235,0.03)", "rgba(15,118,110,0.06)"],
        },
      },
    },
    series: [
      {
        name: "六维完整度",
        type: "radar",
        data: [
          {
            value: DIMENSION_ORDER.map(([code]) => Number(view.dimensionCompleteness[code] ?? 0)),
            name: "六维完整度",
            areaStyle: { color: "rgba(37,99,235,0.2)" },
            lineStyle: { width: 2, color: "#2563eb" },
            itemStyle: { color: "#0f766e" },
          },
        ],
      },
    ],
  };
}

function renderRadar() {
  if (!radarRef.value) return;
  if (!radarChart) {
    radarChart = echarts.init(radarRef.value);
  }
  radarChart.setOption(buildRadarOption(profileView.value), true);
}

const profileView = computed(() => {
  const summary = profileSummary.value || {};
  const detail = profileDetail.value || {};
  const remoteDimensions = Array.isArray(detail.dimensions)
    ? detail.dimensions.map((item) => ({
        code: item.dimension_code || item.dimension_name || "dimension",
        name: item.dimension_name || item.dimension_code || "维度",
        completeness: Number(item.completeness ?? 0),
        data: item.data ?? {},
        entries: summarizeDimensionEntries(item.dimension_code, item.data ?? {}),
      }))
    : [];

  return {
    summary: detail.summary || fallbackProfile.summary,
    tags: Array.isArray(detail.tags) && detail.tags.length ? detail.tags : fallbackProfile.tags,
    recommendedLearningStyle: summary.recommended_learning_style || fallbackProfile.recommendedLearningStyle,
    currentStage: summary.current_stage || fallbackProfile.currentStage,
    keyFeatures: summary.key_features || fallbackProfile.keyFeatures,
    dimensionCompleteness: summary.dimension_completeness || fallbackProfile.dimensionCompleteness,
    dimensions: remoteDimensions.length ? remoteDimensions : fallbackProfile.dimensions,
  };
});

async function loadProfileData(showSuccessMessage = false, targetUserId = userId.value) {
  const requestId = ++profileRequestId;
  profileLoading.value = true;
  try {
    const [detail, summary, history] = await Promise.all([
      getAiConversationProfile(targetUserId),
      getAiConversationProfileSummary(targetUserId),
      getAiConversationProfileHistory(targetUserId, { limit: 20 }),
    ]);

    if (requestId !== profileRequestId) return;

    profileDetail.value = detail;
    profileSummary.value = summary;
    historyItems.value = history.history || [];
    lastCompleteness.value = summary?.completeness ?? lastCompleteness.value;

    await nextTick();
    renderRadar();

    if (showSuccessMessage) {
      ElMessage.success("画像已刷新");
    }
  } catch (error) {
    if (requestId !== profileRequestId) return;
    if (error?.response?.status === 404) {
      profileDetail.value = null;
      profileSummary.value = null;
      historyItems.value = [];
      lastCompleteness.value = 0;
      await nextTick();
      renderRadar();
      return;
    }
    ElMessage.error(parseError(error));
  } finally {
    if (requestId === profileRequestId) {
      profileLoading.value = false;
    }
  }
}

const onResize = () => {
  radarChart?.resize();
};

onMounted(async () => {
  await loadProfileData();
  if (!profileDetail.value) {
    await nextTick();
    renderRadar();
  }
  window.addEventListener("resize", onResize);
});

watch(userId, async (nextUserId, previousUserId) => {
  if (nextUserId === previousUserId) return;
  resetConversationState();
  await loadProfileData(false, nextUserId);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
  if (radarChart) {
    radarChart.dispose();
    radarChart = null;
  }
});
</script>

<style lang="scss" scoped>
.aiProfilePage {
  padding-bottom: 48px;
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.18), transparent 32%),
    radial-gradient(circle at top right, rgba(15, 118, 110, 0.14), transparent 28%),
    linear-gradient(180deg, #f6fbff 0%, #edf4fb 100%);
}

.heroSection {
  padding: 32px 0 24px;
}

.heroInner {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) 360px;
  gap: 24px;
}

.heroContent,
.heroPanel,
.conversationPanel,
.resultPanel {
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(12px);
}

.heroContent,
.conversationPanel,
.resultPanel {
  padding: 30px;
}

.heroPanel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 22px;
}

.heroBadge {
  display: inline-flex;
  align-items: center;
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.12);
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin-top: 18px;
  color: #0f172a;
  font-size: 42px;
  line-height: 1.15;
}

.heroContent p,
.panelTitle p,
.resultHeader p,
.tipsPanel p,
.timelineContent p {
  margin-top: 14px;
  color: #475569;
  line-height: 1.8;
}

.heroActions,
.actionRow,
.actionGroup {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 24px;
}

.navLink {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 146px;
  height: 46px;
  padding: 0 20px;
  border-radius: 999px;
  font-weight: 700;
}

.navLink.light {
  background: #eff6ff;
  color: #2563eb;
}

.navLink.dark {
  background: linear-gradient(135deg, #2563eb 0%, #0f766e 100%);
  color: #fff;
}

.summaryCard,
.miniCard {
  padding: 18px;
  border-radius: 20px;
  background: #f8fbff;
}

.summaryCard span,
.miniCard span {
  display: block;
  color: #64748b;
  font-size: 13px;
}

.summaryCard strong,
.miniCard strong {
  display: block;
  margin-top: 10px;
  color: #0f172a;
  font-size: 28px;
}

.contentSection {
  display: grid;
  grid-template-columns: 430px minmax(0, 1fr);
  gap: 24px;
}

.panelTitle h2,
.resultHeader h2 {
  color: #0f172a;
  font-size: 28px;
}

.identityRow {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  margin-top: 24px;
}

.fieldItem {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fieldItem span {
  font-weight: 700;
  color: #0f172a;
}

.sessionPill {
  padding: 10px 14px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #475569;
  font-weight: 700;
}

.sessionPill.active {
  background: #dcfce7;
  color: #15803d;
}

.progressPanel,
.tipsPanel,
.emptyCard {
  margin-top: 20px;
  padding: 18px;
  border-radius: 22px;
  background: #f8fbff;
}

.progressHead,
.dimensionHead,
.timelineHead,
.resultHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.dimensionRow {
  margin-top: 14px;
}

.label,
.blockTitle {
  color: #0f172a;
  font-weight: 700;
}

.chipList {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.chip {
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 13px;
}

.chip.cool {
  background: #dbeafe;
  color: #1d4ed8;
}

.chip.warm {
  background: #fff7ed;
  color: #c2410c;
}

.chip.muted {
  background: #eef2ff;
  color: #475569;
}

.messageBoard {
  margin-top: 20px;
  min-height: 420px;
  max-height: 560px;
  padding: 16px;
  overflow-y: auto;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.85) 0%, rgba(255, 255, 255, 0.95) 100%);
}

.emptyState {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  color: #64748b;
  line-height: 1.8;
  text-align: center;
}

.bubble {
  max-width: 88%;
  margin-bottom: 14px;
  padding: 14px 16px;
  border-radius: 18px;
}

.bubble.assistant {
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.bubble.user {
  margin-left: auto;
  background: linear-gradient(135deg, #2563eb 0%, #0f766e 100%);
  color: #fff;
}

.bubbleMeta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  opacity: 0.82;
}

.bubbleText {
  margin-top: 8px;
  line-height: 1.75;
  white-space: pre-wrap;
}

.composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  margin-top: 18px;
  align-items: end;
}

.radarChart {
  width: 100%;
  height: 360px;
  margin-top: 18px;
}

.resultBlock {
  margin-top: 8px;
}

.summaryGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.miniCard.wide {
  grid-column: 1 / -1;
}

.dimensionGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-top: 22px;
}

.dimensionCard {
  padding: 20px;
  border-radius: 24px;
  background: #f8fbff;
}

.dimensionCard strong {
  color: #0f766e;
}

.dimensionBody {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.dimensionEntry {
  padding: 12px 14px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.entryLabel {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.entryValue {
  display: block;
  margin-top: 8px;
  color: #0f172a;
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
}

.historyBlock {
  margin-top: 26px;
}

.timeline {
  margin-top: 18px;
}

.timelineItem {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.timelineDot {
  width: 12px;
  height: 12px;
  margin-top: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2563eb 0%, #0f766e 100%);
  box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.08);
}

.timelineContent {
  padding: 18px;
  border-radius: 20px;
  background: #f8fbff;
}

@media (max-width: 1100px) {
  .heroInner,
  .contentSection,
  .dimensionGrid,
  .summaryGrid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .heroContent,
  .heroPanel,
  .conversationPanel,
  .resultPanel {
    padding: 20px;
  }

  h1 {
    font-size: 32px;
  }

  .heroPanel {
    grid-template-columns: 1fr;
  }

  .identityRow,
  .composer {
    display: grid;
    grid-template-columns: 1fr;
  }

  .bubble {
    max-width: 100%;
  }
}
</style>
