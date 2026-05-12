<template>
  <div class="answer-display-container">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>AI 解答</span>
          <div class="header-actions">
            <el-tag v-if="streamStatus" type="info">{{ streamStatus }}</el-tag>
            <el-tag v-if="answer.confidence_score" :type="confidenceType">
              置信度: {{ answer.confidence_score }}%
            </el-tag>
            <el-button
              type="primary"
              size="small"
              :icon="Star"
              @click="showFavoriteDialog = true"
            >
              收藏
            </el-button>
          </div>
        </div>
      </template>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-section">
        <el-skeleton :rows="8" animated />
        <div class="loading-text">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>AI 正在分析问题并生成解答...</span>
        </div>
      </div>

      <!-- 解答内容 -->
      <div v-else class="answer-content">
        <!-- 文字解答 -->
        <div class="answer-text">
          <h3>解答</h3>
          <div ref="markdownBodyRef" class="markdown-body" v-html="renderedMarkdown"></div>
        </div>

        <!-- 图解 -->
        <div v-if="answer.diagrams && answer.diagrams.length > 0" class="diagrams-section">
          <h3>逻辑图解</h3>
          <div
            v-for="(diagram, index) in answer.diagrams"
            :key="index"
            class="diagram-item"
          >
            <div class="mermaid" :id="'mermaid-' + index">
              {{ diagram }}
            </div>
          </div>
        </div>

        <!-- 视频推荐 -->
        <div v-if="answer.videos && answer.videos.length > 0" class="videos-section">
          <h3>相关视频推荐</h3>
          <div class="video-list">
            <el-card
              v-for="video in answer.videos"
              :key="video.video_id"
              class="video-card"
              shadow="hover"
            >
              <div class="video-info">
                <img :src="video.thumbnail" class="video-thumbnail" />
                <div class="video-details">
                  <h4>{{ video.title }}</h4>
                  <p class="video-reason">{{ video.recommendation_reason }}</p>
                  <el-button type="primary" size="small" @click="playVideo(video)">
                    <el-icon><VideoPlay /></el-icon>
                    观看视频
                  </el-button>
                </div>
              </div>
            </el-card>
          </div>
        </div>

        <!-- 参考资料 -->
        <div v-if="answer.reference_sources && answer.reference_sources.length > 0" class="references-section">
          <h3>参考资料</h3>
          <el-collapse>
            <el-collapse-item
              v-for="(source, index) in answer.reference_sources"
              :key="index"
              :title="source.title"
            >
              <p>{{ source.excerpt }}</p>
              <el-link v-if="source.url" :href="source.url" type="primary" target="_blank">
                查看原文
              </el-link>
            </el-collapse-item>
          </el-collapse>
        </div>

        <!-- 评价区域 -->
        <div class="evaluation-section">
          <el-divider />
          <div class="evaluation-prompt">
            <span>这个解答对您有帮助吗？</span>
          </div>
          <div class="evaluation-actions">
            <el-button-group>
              <el-button
                :type="evaluation.is_helpful === true ? 'success' : 'default'"
                @click="handleHelpful(true)"
              >
                <el-icon><Check /></el-icon>
                有帮助
              </el-button>
              <el-button
                :type="evaluation.is_helpful === false ? 'danger' : 'default'"
                @click="handleHelpful(false)"
              >
                <el-icon><Close /></el-icon>
                没帮助
              </el-button>
            </el-button-group>

            <el-rate
              v-model="evaluation.user_rating"
              @change="handleRatingChange"
              show-text
              :texts="['很差', '较差', '一般', '较好', '很好']"
            />
          </div>

          <!-- 反馈输入 -->
          <div v-if="evaluation.is_helpful !== null" class="feedback-input">
            <el-input
              v-model="evaluation.user_feedback"
              type="textarea"
              :rows="3"
              placeholder="请提供更多反馈（可选）"
              maxlength="500"
              show-word-limit
            />
            <el-button
              type="primary"
              size="small"
              @click="submitEvaluation"
              style="margin-top: 10px"
            >
              提交评价
            </el-button>
          </div>

          <!-- 升级按钮 -->
          <div class="escalate-section">
            <el-button
              type="warning"
              @click="handleEscalate"
            >
              <el-icon><User /></el-icon>
              升级到人工处理
            </el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 收藏对话框 -->
    <el-dialog
      v-model="showFavoriteDialog"
      title="收藏答疑记录"
      width="500px"
    >
      <el-input
        v-model="favoriteNote"
        type="textarea"
        :rows="3"
        placeholder="添加收藏备注（可选）"
        maxlength="200"
        show-word-limit
      />
      <template #footer>
        <el-button @click="showFavoriteDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmFavorite">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import renderMathInElement from 'katex/dist/contrib/auto-render.mjs'
import 'katex/dist/katex.min.css'
import { marked } from 'marked'
import mermaid from 'mermaid'
import { Star, Loading, Check, Close, VideoPlay, User } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

marked.setOptions({ gfm: true, breaks: true })

export default {
  name: 'AnswerDisplay',
  components: {
    Star,
    Loading,
    Check,
    Close,
    VideoPlay,
    User
  },
  props: {
    answer: {
      type: Object,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    },
    streamStatus: {
      type: String,
      default: ''
    }
  },
  emits: ['evaluate', 'escalate', 'favorite'],
  setup(props, { emit }) {
    const evaluation = ref({
      answer_id: null,
      is_helpful: null,
      user_rating: 0,
      user_feedback: ''
    })

    const showFavoriteDialog = ref(false)
    const favoriteNote = ref('')
    const markdownBodyRef = ref(null)

    // 置信度类型
    const confidenceType = computed(() => {
      const score = props.answer.confidence_score
      if (score >= 80) return 'success'
      if (score >= 60) return 'warning'
      return 'danger'
    })

    const renderedMarkdown = computed(() => {
      if (!props.answer.answer_text) return ''
      const raw = marked.parse(props.answer.answer_text)
      return DOMPurify.sanitize(raw)
    })

    const applyHighlightAndMath = async () => {
      await nextTick()
      const el = markdownBodyRef.value
      if (!el) return
      el.querySelectorAll('pre code').forEach((block) => {
        try {
          hljs.highlightElement(block)
        } catch {
          /* 忽略无法高亮的代码块 */
        }
      })
      try {
        renderMathInElement(el, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        })
      } catch {
        /* KaTeX 渲染失败时保持原文 */
      }
    }

    // 初始化 Mermaid
    onMounted(() => {
      mermaid.initialize({
        startOnLoad: true,
        theme: 'default'
      })
    })

    watch(
      () => props.answer.answer_text,
      () => {
        applyHighlightAndMath()
      },
      { flush: 'post', immediate: true }
    )

    // 监听图解变化，重新渲染
    watch(() => props.answer.diagrams, () => {
      if (props.answer.diagrams && props.answer.diagrams.length > 0) {
        setTimeout(() => {
          mermaid.init(undefined, '.mermaid')
        }, 100)
      }
    }, { immediate: true })

    // 处理有帮助/没帮助
    const handleHelpful = (helpful) => {
      evaluation.value.is_helpful = helpful
      evaluation.value.answer_id = props.answer.answer_id
    }

    // 处理评分变化
    const handleRatingChange = (rating) => {
      evaluation.value.answer_id = props.answer.answer_id
    }

    // 提交评价
    const submitEvaluation = () => {
      if (!evaluation.value.answer_id) {
        ElMessage.warning('请先选择是否有帮助')
        return
      }

      emit('evaluate', { ...evaluation.value })

      // 重置评价
      evaluation.value = {
        answer_id: null,
        is_helpful: null,
        user_rating: 0,
        user_feedback: ''
      }
    }

    // 升级到人工
    const handleEscalate = () => {
      emit('escalate')
    }

    // 确认收藏
    const confirmFavorite = () => {
      emit('favorite', favoriteNote.value)
      showFavoriteDialog.value = false
      favoriteNote.value = ''
    }

    // 播放视频
    const playVideo = (video) => {
      // TODO: 打开视频播放器
      window.open(video.url, '_blank')
    }

    return {
      evaluation,
      showFavoriteDialog,
      favoriteNote,
      markdownBodyRef,
      confidenceType,
      renderedMarkdown,
      handleHelpful,
      handleRatingChange,
      submitEvaluation,
      handleEscalate,
      confirmFavorite,
      playVideo
    }
  }
}
</script>

<style scoped>
.answer-display-container {
  margin-top: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.loading-section {
  padding: 20px;
}

.loading-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
  color: #409eff;
  font-size: 16px;
}

.answer-content {
  padding: 20px;
}

.answer-text h3,
.diagrams-section h3,
.videos-section h3,
.references-section h3 {
  margin-bottom: 15px;
  color: #303133;
  font-size: 18px;
  font-weight: 600;
}

.markdown-body {
  line-height: 1.8;
  color: #606266;
}

.markdown-body >>> pre {
  background: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
  overflow-x: auto;
}

.markdown-body >>> code {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}

.diagrams-section {
  margin-top: 30px;
}

.diagram-item {
  margin-bottom: 20px;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 4px;
}

.videos-section {
  margin-top: 30px;
}

.video-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
}

.video-card {
  cursor: pointer;
}

.video-info {
  display: flex;
  gap: 15px;
}

.video-thumbnail {
  width: 120px;
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
}

.video-details h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #303133;
}

.video-reason {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #909399;
}

.references-section {
  margin-top: 30px;
}

.evaluation-section {
  margin-top: 30px;
}

.evaluation-prompt {
  text-align: center;
  margin-bottom: 15px;
  font-size: 16px;
  color: #606266;
}

.evaluation-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 30px;
  margin-bottom: 20px;
}

.feedback-input {
  max-width: 600px;
  margin: 20px auto;
}

.escalate-section {
  text-align: center;
  margin-top: 20px;
}
</style>
