<template>
  <div class="learning-profile-page">
    <el-card class="header-card">
      <div class="header-content">
        <h2>对话式学习画像</h2>
        <p class="subtitle">通过多轮对话采集学习信息，生成六维度画像并支持行为驱动更新</p>
      </div>
    </el-card>

    <el-card class="toolbar-card">
      <el-form :inline="true" @submit.prevent>
        <el-form-item label="学生用户 ID">
          <el-input-number v-model="userId" :min="1" :step="1" controls-position="right" />
        </el-form-item>
        <el-form-item>
          <el-tag v-if="sessionId" type="success">当前会话 #{{ sessionId }}</el-tag>
          <el-tag v-else type="info">未开始会话</el-tag>
        </el-form-item>
      </el-form>
    </el-card>

    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="对话采集" name="chat">
        <div class="chat-layout">
          <el-card class="progress-card" shadow="never">
            <template #header>采集进度</template>
            <el-progress :percentage="lastCompleteness" :status="lastCompleteness >= 80 ? 'success' : undefined" />
            <p class="hint">完整度：{{ lastCompleteness }}%</p>
            <div v-if="missingDimensions.length" class="missing">
              <span class="label">待补充维度：</span>
              <el-tag
                v-for="d in missingDimensions"
                :key="d"
                size="small"
                class="dim-tag"
              >{{ dimensionLabel(d) }}</el-tag>
            </div>
            <div v-if="collectedDimensions.length" class="collected">
              <span class="label">已采集：</span>
              <el-tag
                v-for="d in collectedDimensions"
                :key="d"
                type="success"
                size="small"
                class="dim-tag"
              >{{ dimensionLabel(d) }}</el-tag>
            </div>
          </el-card>

          <el-card class="chat-card" shadow="never">
            <template #header>
              <div class="chat-header">
                <span>对话</span>
                <div>
                  <el-button type="primary" :disabled="!userId" :loading="starting" @click="handleStart">
                    开始会话
                  </el-button>
                  <el-button
                    type="success"
                    :disabled="!sessionId || sending"
                    :loading="completing"
                    @click="handleComplete(false)"
                  >
                    完成并生成画像
                  </el-button>
                  <el-button
                    type="warning"
                    plain
                    :disabled="!sessionId"
                    :loading="completing"
                    @click="handleComplete(true)"
                  >
                    强制完成
                  </el-button>
                </div>
              </div>
            </template>

            <div ref="scrollRef" class="messages">
              <div
                v-for="(m, idx) in chatMessages"
                :key="idx"
                :class="['bubble', m.role === 'user' ? 'user' : 'assistant']"
              >
                <div class="meta">{{ m.role === 'user' ? '学生' : '助手' }} · 第 {{ m.round_number }} 轮</div>
                <div class="text">{{ m.content }}</div>
              </div>
            </div>

            <div class="composer">
              <el-input
                v-model="draft"
                type="textarea"
                :rows="3"
                placeholder="输入你的回答后发送…"
                :disabled="!sessionId || sending"
                @keydown.enter.exact.prevent="handleSend"
              />
              <el-button type="primary" :disabled="!sessionId || sending" :loading="sending" @click="handleSend">
                发送
              </el-button>
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane label="画像展示" name="profile">
        <div class="profile-layout">
          <el-card shadow="never">
            <template #header>
              <div class="chat-header">
                <span>画像总览</span>
                <el-button type="primary" :disabled="!userId" :loading="profileLoading" @click="loadProfileData">
                  刷新画像
                </el-button>
              </div>
            </template>
            <el-empty v-if="!profileDetail && !profileLoading" description="暂无画像数据，请先完成对话采集" />
            <template v-else>
              <el-descriptions v-if="profileSummary" :column="2" border class="summary-desc">
                <el-descriptions-item label="完整度">{{ profileSummary.completeness }}%</el-descriptions-item>
                <el-descriptions-item label="当前阶段">{{ profileSummary.current_stage || '—' }}</el-descriptions-item>
                <el-descriptions-item label="关键特征" :span="2">{{ profileSummary.key_features || '—' }}</el-descriptions-item>
                <el-descriptions-item label="推荐方式" :span="2">{{ profileSummary.recommended_learning_style || '—' }}</el-descriptions-item>
              </el-descriptions>
              <div ref="radarRef" class="radar-chart" />
              <div v-if="profileDetail?.summary" class="profile-summary-text">
                <h4>画像摘要</h4>
                <p>{{ profileDetail.summary }}</p>
              </div>
              <div v-if="profileDetail?.tags?.length" class="tags-block">
                <h4>学习标签</h4>
                <el-tag v-for="t in profileDetail.tags" :key="t" class="tag-item">{{ t }}</el-tag>
              </div>
              <div v-if="profileDetail?.dimensions?.length" class="dimensions-block">
                <h4>维度详情</h4>
                <el-collapse>
                  <el-collapse-item
                    v-for="dim in profileDetail.dimensions"
                    :key="dim.dimension_code"
                    :title="`${dim.dimension_name}（完整度 ${dim.completeness}%）`"
                  >
                    <pre class="json-block">{{ formatJson(dim.data) }}</pre>
                  </el-collapse-item>
                </el-collapse>
              </div>
            </template>
          </el-card>

          <el-card shadow="never">
            <template #header>变更历史</template>
            <el-timeline v-if="historyItems.length">
              <el-timeline-item
                v-for="h in historyItems"
                :key="h.history_id"
                :timestamp="formatTime(h.created_at)"
              >
                <p class="history-title">{{ changeTypeLabel(h.change_type) }}</p>
                <p class="history-desc">{{ h.change_description || '—' }}</p>
                <el-tag
                  v-for="d in h.changed_dimensions"
                  :key="d"
                  size="small"
                  class="dim-tag"
                >{{ dimensionLabel(d) }}</el-tag>
              </el-timeline-item>
            </el-timeline>
            <el-empty v-else description="暂无历史记录" />
          </el-card>

          <el-card shadow="never">
            <template #header>运维：手动调整与行为上报</template>
            <el-form label-width="120px">
              <el-form-item label="调整维度">
                <el-select v-model="adjustForm.dimension_code" placeholder="选择维度" style="width: 100%">
                  <el-option
                    v-for="[code, name] in DIMENSION_ORDER"
                    :key="code"
                    :label="name"
                    :value="code"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="调整 JSON">
                <el-input v-model="adjustForm.json" type="textarea" :rows="4" placeholder='例如 {"level": "进阶"}' />
              </el-form-item>
              <el-form-item label="原因">
                <el-input v-model="adjustForm.reason" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :disabled="!userId" :loading="adjusting" @click="handleAdjust">保存调整</el-button>
              </el-form-item>
            </el-form>
            <el-divider />
            <el-form label-width="120px">
              <el-form-item label="行为类型">
                <el-select v-model="behaviorForm.behavior_type" style="width: 100%">
                  <el-option :value="1" label="答题" />
                  <el-option :value="2" label="资源浏览" />
                  <el-option :value="3" label="路径完成" />
                  <el-option :value="4" label="学习问答" />
                </el-select>
              </el-form-item>
              <el-form-item label="行为数据 JSON">
                <el-input
                  v-model="behaviorForm.json"
                  type="textarea"
                  :rows="4"
                  placeholder='例如 {"result":"wrong","knowledge_point":"循环"}'
                />
              </el-form-item>
              <el-form-item>
                <el-button type="success" :disabled="!userId" :loading="behaviorSubmitting" @click="handleBehavior">
                  上报行为
                </el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import {
  startProfileConversation,
  sendProfileMessage,
  completeProfileConversation,
  getStudentProfile,
  getStudentProfileSummary,
  getStudentProfileHistory,
  adjustStudentProfile,
  reportLearningBehavior,
} from '@/api/profileConversation'

const DIMENSION_ORDER = [
  ['knowledge_base', '知识基础'],
  ['cognitive_style', '认知风格'],
  ['learning_progress', '学习进度'],
  ['error_preference', '易错点偏好'],
  ['interest_direction', '兴趣方向'],
  ['learning_habit', '学习习惯'],
]

const DIMENSION_MAP = Object.fromEntries(DIMENSION_ORDER)

function dimensionLabel(code) {
  return DIMENSION_MAP[code] || code
}

function changeTypeLabel(t) {
  const m = { 1: '初始创建', 2: '对话更新', 3: '行为更新', 4: '手动调整' }
  return m[t] || `类型 ${t}`
}

function formatJson(obj) {
  try {
    return JSON.stringify(obj ?? {}, null, 2)
  } catch {
    return String(obj)
  }
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

const userId = ref(1)
const activeTab = ref('chat')
const sessionId = ref(null)
const chatMessages = ref([])
const draft = ref('')
const starting = ref(false)
const sending = ref(false)
const completing = ref(false)
const lastCompleteness = ref(0)
const missingDimensions = ref([])
const collectedDimensions = ref([])

const scrollRef = ref(null)
const radarRef = ref(null)
let radarChart = null

const profileLoading = ref(false)
const profileDetail = ref(null)
const profileSummary = ref(null)
const historyItems = ref([])

const adjusting = ref(false)
const behaviorSubmitting = ref(false)
const adjustForm = reactive({
  dimension_code: 'knowledge_base',
  json: '{"level":"进阶"}',
  reason: '管理员校正',
})
const behaviorForm = reactive({
  behavior_type: 1,
  json: '{"result":"correct","knowledge_point":"Python 基础"}',
})

function scrollToBottom() {
  nextTick(() => {
    const el = scrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function applySessionResponse(sess) {
  collectedDimensions.value = sess.collected_dimensions || []
  lastCompleteness.value = sess.completeness ?? 0
  chatMessages.value = (sess.messages || []).map((m) => ({
    role: m.role,
    content: m.content,
    round_number: m.round_number,
  }))
  scrollToBottom()
}

async function handleStart() {
  starting.value = true
  try {
    const res = await startProfileConversation({
      user_id: userId.value,
      session_type: 1,
    })
    sessionId.value = res.session_id
    applySessionResponse(res)
    missingDimensions.value = []
    ElMessage.success('会话已开始')
  } catch (e) {
    ElMessage.error(parseError(e))
  } finally {
    starting.value = false
  }
}

function parseError(e) {
  const d = e?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x) => x.msg || x).join('; ')
  return e?.message || '请求失败'
}

async function handleSend() {
  const text = (draft.value || '').trim()
  if (!text || !sessionId.value) return
  sending.value = true
  try {
    chatMessages.value.push({
      role: 'user',
      content: text,
      round_number: (chatMessages.value.filter((m) => m.role === 'user').length || 0) + 1,
    })
    draft.value = ''
    scrollToBottom()

    const flow = await sendProfileMessage({
      session_id: sessionId.value,
      content: text,
    })

    const am = flow.assistant_message
    chatMessages.value.push({
      role: am.role,
      content: am.content,
      round_number: am.round_number,
    })
    lastCompleteness.value = flow.completeness ?? lastCompleteness.value
    if (flow.extraction_result) {
      missingDimensions.value = flow.extraction_result.missing_dimensions || []
      lastCompleteness.value = flow.extraction_result.completeness ?? lastCompleteness.value
      const allDims = DIMENSION_ORDER.map(([c]) => c)
      collectedDimensions.value = allDims.filter((c) => !missingDimensions.value.includes(c))
    }
    scrollToBottom()
  } catch (e) {
    ElMessage.error(parseError(e))
  } finally {
    sending.value = false
  }
}

async function handleComplete(force) {
  if (!sessionId.value) return
  completing.value = true
  try {
    await completeProfileConversation({
      session_id: sessionId.value,
      force_complete: force,
    })
    ElMessage.success('画像已生成，可在「画像展示」页查看')
    activeTab.value = 'profile'
    await loadProfileData()
  } catch (e) {
    ElMessage.error(parseError(e))
  } finally {
    completing.value = false
  }
}

function buildRadarOption(summary) {
  const comp = summary?.dimension_completeness || {}
  const values = DIMENSION_ORDER.map(([code]) => Number(comp[code] ?? 0))
  return {
    tooltip: {},
    radar: {
      indicator: DIMENSION_ORDER.map(([, name]) => ({ name, max: 100 })),
    },
    series: [
      {
        type: 'radar',
        data: [{ value: values, name: '维度完整度' }],
      },
    ],
  }
}

function renderRadar() {
  if (!radarRef.value || !profileSummary.value) return
  if (!radarChart) {
    radarChart = echarts.init(radarRef.value)
  }
  radarChart.setOption(buildRadarOption(profileSummary.value), true)
}

async function loadProfileData() {
  if (!userId.value) return
  profileLoading.value = true
  try {
    const [detail, summary, hist] = await Promise.all([
      getStudentProfile(userId.value),
      getStudentProfileSummary(userId.value),
      getStudentProfileHistory(userId.value, 30),
    ])
    profileDetail.value = detail
    profileSummary.value = summary
    historyItems.value = hist.history || []
    await nextTick()
    renderRadar()
  } catch (e) {
    profileDetail.value = null
    profileSummary.value = null
    historyItems.value = []
    ElMessage.error(parseError(e))
  } finally {
    profileLoading.value = false
  }
}

async function handleAdjust() {
  let data
  try {
    data = JSON.parse(adjustForm.json || '{}')
  } catch {
    ElMessage.error('调整 JSON 格式不正确')
    return
  }
  adjusting.value = true
  try {
    await adjustStudentProfile(userId.value, {
      dimension_code: adjustForm.dimension_code,
      adjust_data: data,
      reason: adjustForm.reason,
    })
    ElMessage.success('已保存')
    await loadProfileData()
  } catch (e) {
    ElMessage.error(parseError(e))
  } finally {
    adjusting.value = false
  }
}

async function handleBehavior() {
  let data
  try {
    data = JSON.parse(behaviorForm.json || '{}')
  } catch {
    ElMessage.error('行为数据 JSON 格式不正确')
    return
  }
  behaviorSubmitting.value = true
  try {
    await reportLearningBehavior({
      user_id: userId.value,
      behavior_type: behaviorForm.behavior_type,
      behavior_data: data,
    })
    ElMessage.success('行为已上报')
    await loadProfileData()
  } catch (e) {
    ElMessage.error(parseError(e))
  } finally {
    behaviorSubmitting.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'profile') {
    nextTick(() => renderRadar())
  }
})

onMounted(() => {
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (radarChart) {
    radarChart.dispose()
    radarChart = null
  }
})

function onResize() {
  radarChart?.resize()
}
</script>

<style scoped>
.learning-profile-page {
  padding: 16px;
  max-width: 1280px;
  margin: 0 auto;
}
.header-card {
  margin-bottom: 16px;
}
.header-content h2 {
  margin: 0 0 8px;
  font-size: 22px;
}
.subtitle {
  margin: 0;
  color: #909399;
  font-size: 14px;
}
.toolbar-card {
  margin-bottom: 16px;
}
.chat-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 16px;
}
@media (max-width: 900px) {
  .chat-layout {
    grid-template-columns: 1fr;
  }
}
.progress-card .hint {
  margin: 8px 0;
  font-size: 13px;
}
.missing,
.collected {
  margin-top: 8px;
  font-size: 13px;
}
.label {
  color: #606266;
}
.dim-tag {
  margin: 2px 4px 2px 0;
}
.chat-card {
  min-height: 480px;
  display: flex;
  flex-direction: column;
}
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.messages {
  flex: 1;
  overflow-y: auto;
  max-height: 420px;
  padding: 8px 4px;
  background: #f5f7fa;
  border-radius: 8px;
}
.bubble {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  max-width: 92%;
}
.bubble.user {
  margin-left: auto;
  background: #409eff;
  color: #fff;
}
.bubble.assistant {
  background: #fff;
  border: 1px solid #e4e7ed;
}
.bubble .meta {
  font-size: 12px;
  opacity: 0.85;
  margin-bottom: 6px;
}
.bubble .text {
  white-space: pre-wrap;
  line-height: 1.5;
}
.composer {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-top: 12px;
}
.composer .el-button {
  flex-shrink: 0;
}
.profile-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.radar-chart {
  width: 100%;
  height: 360px;
  margin-top: 16px;
}
.summary-desc {
  margin-top: 8px;
}
.profile-summary-text h4,
.tags-block h4,
.dimensions-block h4 {
  margin: 16px 0 8px;
  font-size: 15px;
}
.tag-item {
  margin: 0 8px 8px 0;
}
.json-block {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 6px;
  font-size: 12px;
  overflow: auto;
  max-height: 240px;
}
.history-title {
  font-weight: 600;
  margin: 0 0 4px;
}
.history-desc {
  margin: 0 0 8px;
  color: #606266;
  font-size: 13px;
}
</style>
