<template>
  <div class="tutoring-container">
    <el-tabs v-model="activeTab" type="card">
      <!-- 问答标签页 -->
      <el-tab-pane label="智能答疑" name="qa">
        <div class="qa-section">
          <!-- 问题输入区 -->
          <QuestionInput
            @submit="handleQuestionSubmit"
            :loading="submitting"
          />

          <!-- 解答展示区 -->
          <AnswerDisplay
            v-if="currentAnswer"
            :answer="currentAnswer"
            :loading="generating && !currentAnswer.answer_text"
            :stream-status="streamStatus"
            @evaluate="handleEvaluate"
            @escalate="handleEscalate"
            @favorite="handleFavorite"
          />
        </div>
      </el-tab-pane>

      <!-- 历史记录标签页 -->
      <el-tab-pane label="答疑历史" name="history">
        <TutoringHistory
          @view-detail="handleViewDetail"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import QuestionInput from './components/QuestionInput.vue'
import AnswerDisplay from './components/AnswerDisplay.vue'
import TutoringHistory from './components/TutoringHistory.vue'
import { submitQuestion, getAnswer, evaluateAnswer, escalateQuestion, addFavorite, getTutoringStreamUrl } from '@/api/tutoring'
import { USER_KEY } from '@/config/global'

function getCurrentUserId() {
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    if (!raw) return 1
    const u = JSON.parse(raw)
    return u.userId ?? u.id ?? 1
  } catch {
    return 1
  }
}

export default {
  name: 'TutoringPage',
  components: {
    QuestionInput,
    AnswerDisplay,
    TutoringHistory
  },
  setup() {
    const activeTab = ref('qa')
    const submitting = ref(false)
    const generating = ref(false)
    const currentAnswer = ref(null)
    const currentQuestionId = ref(null)
    const streamStatus = ref('')

    const runTutoringStream = (questionId) => {
      return new Promise((resolve, reject) => {
        const wsUrl = getTutoringStreamUrl(questionId, getCurrentUserId())
        const ws = new WebSocket(wsUrl)
        let settled = false
        const finish = (fn, arg) => {
          if (settled) return
          settled = true
          fn(arg)
        }
        ws.onmessage = (ev) => {
          let msg
          try {
            msg = JSON.parse(ev.data)
          } catch {
            return
          }
          if (msg.chunk_type === 'step' && msg.metadata && msg.metadata.label) {
            streamStatus.value = msg.metadata.label
          }
          if (msg.chunk_type === 'complete' && msg.content) {
            currentAnswer.value = { ...currentAnswer.value, ...msg.content }
          }
          if (msg.chunk_type === 'saved' && msg.content) {
            currentAnswer.value = { ...currentAnswer.value, ...msg.content }
            streamStatus.value = ''
            ws.close()
            finish(resolve, msg.content)
          }
          if (msg.chunk_type === 'error') {
            streamStatus.value = ''
            ws.close()
            finish(reject, new Error(msg.content || '生成失败'))
          }
        }
        ws.onerror = () => {
          streamStatus.value = ''
          finish(reject, new Error('WebSocket 连接失败'))
        }
        ws.onclose = () => {
          if (settled) return
          streamStatus.value = ''
          finish(reject, new Error('连接已断开'))
        }
      })
    }

    // 提交问题
    const handleQuestionSubmit = async (questionData) => {
      submitting.value = true
      streamStatus.value = ''
      try {
        const submitResult = await submitQuestion(questionData)
        currentQuestionId.value = submitResult.question_id

        ElMessage.success('问题提交成功，正在生成解答...')

        generating.value = true
        currentAnswer.value = {
          answer_id: null,
          answer_text: '',
          diagrams: [],
          videos: [],
          reference_sources: [],
          confidence_score: null
        }

        try {
          await runTutoringStream(submitResult.question_id)
          if (currentAnswer.value.should_escalate) {
            ElMessage.warning('AI 解答置信度较低，建议升级到人工处理')
          } else {
            ElMessage.success('解答生成完成')
          }
        } catch (streamErr) {
          ElMessage.warning('实时通道不可用，已改为同步拉取：' + streamErr.message)
          const answerResult = await getAnswer(submitResult.question_id)
          currentAnswer.value = answerResult
          if (answerResult.should_escalate) {
            ElMessage.warning('AI 解答置信度较低，建议升级到人工处理')
          } else {
            ElMessage.success('解答生成完成')
          }
        }
      } catch (error) {
        ElMessage.error('问题提交失败: ' + error.message)
        currentAnswer.value = null
      } finally {
        generating.value = false
        submitting.value = false
        streamStatus.value = ''
      }
    }

    // 评价解答
    const handleEvaluate = async (evaluation) => {
      try {
        await evaluateAnswer(evaluation)
        ElMessage.success('评价提交成功')
      } catch (error) {
        ElMessage.error('评价提交失败: ' + error.message)
      }
    }

    // 升级到人工
    const handleEscalate = async () => {
      try {
        await escalateQuestion({
          question_id: currentQuestionId.value,
          escalation_reason: 3 // 用户主动请求
        })
        ElMessage.success('已升级到人工处理，预计2小时内回复')
      } catch (error) {
        ElMessage.error('升级失败: ' + error.message)
      }
    }

    // 收藏
    const handleFavorite = async (note) => {
      try {
        await addFavorite(
          currentQuestionId.value,
          currentAnswer.value.answer_id,
          note
        )
        ElMessage.success('收藏成功')
      } catch (error) {
        ElMessage.error('收藏失败: ' + error.message)
      }
    }

    // 查看历史详情
    const handleViewDetail = (item) => {
      currentQuestionId.value = item.question.id
      currentAnswer.value = {
        answer_id: item.answer?.id,
        answer_text: item.answer?.answer_text,
        diagrams: item.answer?.answer_diagrams,
        videos: item.answer?.answer_videos,
        reference_sources: item.answer?.reference_sources,
        confidence_score: item.answer?.confidence_score
      }
      activeTab.value = 'qa'
    }

    return {
      activeTab,
      submitting,
      generating,
      currentAnswer,
      streamStatus,
      handleQuestionSubmit,
      handleEvaluate,
      handleEscalate,
      handleFavorite,
      handleViewDetail
    }
  }
}
</script>

<style scoped>
.tutoring-container {
  padding: 20px;
  background: #fff;
  min-height: calc(100vh - 100px);
}

.qa-section {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
