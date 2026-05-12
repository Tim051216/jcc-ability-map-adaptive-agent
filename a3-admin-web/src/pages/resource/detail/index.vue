<template>
  <div class="resource-detail-container">
    <div v-loading="loading">
      <!-- 返回按钮 -->
      <el-button class="back-button" @click="$router.back()">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>

      <!-- 资源头部信息 -->
      <el-card class="header-card">
        <div class="resource-header">
          <div class="header-left">
            <div class="type-badge" :class="`type-${resource.resource_type}`">
              {{ getResourceTypeLabel(resource.resource_type) }}
            </div>
            <h1 class="resource-title">{{ resource.title }}</h1>
            <p class="resource-description">{{ resource.description }}</p>
          </div>
          <div class="header-right">
            <el-tag :type="getStatusTagType(resource.status)">
              {{ getStatusText(resource.status) }}
            </el-tag>
          </div>
        </div>

        <div class="resource-meta">
          <div class="meta-item">
            <span class="label">学生:</span>
            <span class="value">{{ resource.student_name }}</span>
          </div>
          <div class="meta-item">
            <span class="label">课程:</span>
            <span class="value">{{ resource.course_name }}</span>
          </div>
          <div class="meta-item">
            <span class="label">知识点:</span>
            <span class="value">{{ resource.knowledge_point_name }}</span>
          </div>
          <div class="meta-item">
            <span class="label">难度:</span>
            <span class="value">{{ getDifficultyText(resource.difficulty_level) }}</span>
          </div>
          <div class="meta-item">
            <span class="label">生成时间:</span>
            <span class="value">{{ formatDate(resource.created_at) }}</span>
          </div>
          <div class="meta-item" v-if="resource.quality_score">
            <span class="label">质量评分:</span>
            <span class="value">{{ (resource.quality_score * 100).toFixed(0) }} 分</span>
          </div>
        </div>

        <div class="resource-stats">
          <div class="stat-item">
            <el-icon><View /></el-icon>
            <span>{{ resource.view_count }} 次查看</span>
          </div>
          <div class="stat-item">
            <el-icon><Download /></el-icon>
            <span>{{ resource.download_count }} 次下载</span>
          </div>
          <div class="stat-item">
            <el-icon><Star /></el-icon>
            <span>{{ resource.favorite_count }} 次收藏</span>
          </div>
        </div>

        <div class="resource-actions">
          <el-button
            type="primary"
            :icon="resource.is_favorited ? StarFilled : Star"
            @click="handleToggleFavorite"
          >
            {{ resource.is_favorited ? '取消收藏' : '收藏' }}
          </el-button>
          <el-button :icon="Download" @click="handleDownload">
            下载资源
          </el-button>
          <el-button :icon="Share" @click="handleShare">
            分享
          </el-button>
        </div>
      </el-card>

      <!-- 资源内容 -->
      <el-card class="content-card">
        <template #header>
          <span>资源内容</span>
        </template>

        <!-- 文档类型 -->
        <div v-if="resource.resource_type === 1" class="document-content">
          <div class="markdown-body" v-html="renderedMarkdown"></div>
        </div>

        <!-- 思维导图类型 -->
        <div v-else-if="resource.resource_type === 2" class="mindmap-content">
          <div ref="mermaidContainer" class="mermaid-container">
            {{ resource.content }}
          </div>
        </div>

        <!-- 题库类型 -->
        <div v-else-if="resource.resource_type === 3" class="question-bank-content">
          <el-tabs v-model="activeQuestionTab">
            <el-tab-pane
              v-for="(layer, index) in questionLayers"
              :key="index"
              :label="layer.label"
              :name="String(index)"
            >
              <div class="question-list">
                <div
                  v-for="(question, qIndex) in layer.questions"
                  :key="qIndex"
                  class="question-item"
                >
                  <div class="question-header">
                    <span class="question-number">{{ qIndex + 1 }}.</span>
                    <el-tag size="small">{{ getQuestionTypeText(question.question_type) }}</el-tag>
                    <el-tag size="small" type="warning">难度: {{ question.difficulty }}</el-tag>
                  </div>
                  <div class="question-content">
                    <p class="question-text">{{ question.question }}</p>
                    
                    <!-- 选择题选项 -->
                    <div v-if="question.options" class="question-options">
                      <div
                        v-for="(option, optIndex) in question.options"
                        :key="optIndex"
                        class="option-item"
                      >
                        {{ String.fromCharCode(65 + optIndex) }}. {{ option }}
                      </div>
                    </div>
                    
                    <!-- 答案 -->
                    <div class="question-answer">
                      <el-collapse>
                        <el-collapse-item title="查看答案" name="answer">
                          <p><strong>答案:</strong> {{ question.answer }}</p>
                          <p v-if="question.explanation">
                            <strong>解析:</strong> {{ question.explanation }}
                          </p>
                        </el-collapse-item>
                      </el-collapse>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>

        <!-- 视频类型 -->
        <div v-else-if="resource.resource_type === 4" class="video-content">
          <div class="video-list">
            <div
              v-for="(video, index) in videoList"
              :key="index"
              class="video-item"
            >
              <div class="video-info">
                <h3>{{ video.title }}</h3>
                <p class="video-meta">
                  <span>平台: {{ video.platform }}</span>
                  <span>时长: {{ video.duration }}</span>
                  <span>难度: {{ getDifficultyText(video.difficulty_level) }}</span>
                </p>
                <p class="video-description">{{ video.description }}</p>
                <div class="video-tags">
                  <el-tag
                    v-for="tag in video.tags"
                    :key="tag"
                    size="small"
                    style="margin-right: 8px"
                  >
                    {{ tag }}
                  </el-tag>
                </div>
              </div>
              <div class="video-actions">
                <el-button type="primary" @click="openVideo(video.url)">
                  观看视频
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 代码案例类型 -->
        <div v-else-if="resource.resource_type === 5" class="code-content">
          <div class="code-header">
            <h3>{{ codeExample.title }}</h3>
            <p>{{ codeExample.description }}</p>
            <div class="code-meta">
              <el-tag>{{ codeExample.language }}</el-tag>
              <span>难度: {{ getDifficultyText(codeExample.difficulty_level) }}</span>
            </div>
          </div>

          <div class="code-block">
            <pre><code :class="`language-${codeExample.language?.toLowerCase()}`">{{ codeExample.code }}</code></pre>
          </div>

          <div v-if="codeExample.explanation" class="code-explanation">
            <h4>代码说明</h4>
            <div v-html="renderedExplanation"></div>
          </div>

          <div v-if="codeExample.run_instructions" class="run-instructions">
            <h4>运行说明</h4>
            <p>{{ codeExample.run_instructions }}</p>
          </div>

          <div v-if="codeExample.expected_output" class="expected-output">
            <h4>预期输出</h4>
            <pre>{{ codeExample.expected_output }}</pre>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  View,
  Download,
  Star,
  StarFilled,
  Share
} from '@element-plus/icons-vue'
import {
  getResourceDetail,
  addFavorite,
  removeFavorite,
  downloadResource
} from '@/api/resource-generation'
import { marked } from 'marked'
import mermaid from 'mermaid'
import Prism from 'prismjs'
import 'prismjs/themes/prism.css'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const resource = ref({})
const activeQuestionTab = ref('0')

// 资源类型映射
const resourceTypeMap = {
  1: '课程讲解文档',
  2: '知识点思维导图',
  3: '分层练习题库',
  4: '教学视频推荐',
  5: '代码实操案例'
}

// 获取资源类型标签
const getResourceTypeLabel = (type) => {
  return resourceTypeMap[type] || '未知类型'
}

// 获取状态标签类型
const getStatusTagType = (status) => {
  const typeMap = { 1: 'warning', 2: 'success', 3: 'danger' }
  return typeMap[status] || 'info'
}

// 获取状态文本
const getStatusText = (status) => {
  const textMap = { 1: '生成中', 2: '已完成', 3: '生成失败' }
  return textMap[status] || '未知'
}

// 获取难度文本
const getDifficultyText = (level) => {
  const textMap = { 1: '基础', 2: '进阶', 3: '拔高' }
  return textMap[level] || '未知'
}

// 获取题型文本
const getQuestionTypeText = (type) => {
  const typeMap = {
    1: '单选题',
    2: '多选题',
    3: '判断题',
    4: '填空题',
    5: '简答题',
    6: '编程题'
  }
  return typeMap[type] || '未知'
}

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

// Markdown 渲染
const renderedMarkdown = computed(() => {
  if (resource.value.content) {
    return marked(resource.value.content)
  }
  return ''
})

// 代码说明渲染
const renderedExplanation = computed(() => {
  if (codeExample.value.explanation) {
    return marked(codeExample.value.explanation)
  }
  return ''
})

// 题库分层
const questionLayers = computed(() => {
  if (!resource.value.questions) return []
  
  const layers = [
    { label: '基础层', questions: [] },
    { label: '进阶层', questions: [] },
    { label: '拔高层', questions: [] }
  ]
  
  resource.value.questions.forEach(q => {
    if (q.difficulty <= 0.4) {
      layers[0].questions.push(q)
    } else if (q.difficulty <= 0.7) {
      layers[1].questions.push(q)
    } else {
      layers[2].questions.push(q)
    }
  })
  
  return layers
})

// 视频列表
const videoList = computed(() => {
  return resource.value.videos || []
})

// 代码案例
const codeExample = computed(() => {
  return resource.value.code_example || {}
})

// 加载资源详情
const loadResourceDetail = async () => {
  loading.value = true
  try {
    const resourceId = route.params.id
    const response = await getResourceDetail(resourceId)
    resource.value = response
    
    // 如果是思维导图,渲染 Mermaid
    if (response.resource_type === 2) {
      setTimeout(() => {
        mermaid.init(undefined, '.mermaid-container')
      }, 100)
    }
    
    // 如果是代码,高亮显示
    if (response.resource_type === 5) {
      setTimeout(() => {
        Prism.highlightAll()
      }, 100)
    }
  } catch (error) {
    console.error('加载资源详情失败:', error)
    ElMessage.error('加载资源详情失败')
  } finally {
    loading.value = false
  }
}

// 切换收藏
const handleToggleFavorite = async () => {
  if (resource.value.is_favorited) {
    try {
      await ElMessageBox.confirm('确定要取消收藏吗?', '提示', {
        type: 'warning'
      })
      
      await removeFavorite(resource.value.id)
      ElMessage.success('已取消收藏')
      resource.value.is_favorited = false
      resource.value.favorite_count--
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error('取消收藏失败')
      }
    }
  } else {
    try {
      await addFavorite({
        resource_id: resource.value.id,
        category: '默认分类',
        notes: ''
      })
      
      ElMessage.success('收藏成功')
      resource.value.is_favorited = true
      resource.value.favorite_count++
    } catch (error) {
      ElMessage.error('收藏失败')
    }
  }
}

// 下载资源
const handleDownload = async () => {
  try {
    const response = await downloadResource(resource.value.id)
    window.open(response.download_url, '_blank')
    ElMessage.success('开始下载')
  } catch (error) {
    ElMessage.error('下载失败')
  }
}

// 分享
const handleShare = () => {
  const url = window.location.href
  navigator.clipboard.writeText(url)
  ElMessage.success('链接已复制到剪贴板')
}

// 打开视频
const openVideo = (url) => {
  window.open(url, '_blank')
}

onMounted(() => {
  loadResourceDetail()
  
  // 初始化 Mermaid
  mermaid.initialize({ startOnLoad: false, theme: 'default' })
})
</script>

<style scoped lang="scss">
.resource-detail-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.back-button {
  margin-bottom: 20px;
}

.header-card {
  margin-bottom: 20px;
  
  .resource-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
    
    .header-left {
      flex: 1;
      
      .type-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        margin-bottom: 12px;
        
        &.type-1 { background-color: #E1F3D8; color: #67C23A; }
        &.type-2 { background-color: #D9ECFF; color: #409EFF; }
        &.type-3 { background-color: #FDE2E2; color: #F56C6C; }
        &.type-4 { background-color: #F4E8FF; color: #9C27B0; }
        &.type-5 { background-color: #FFF4E5; color: #FF9800; }
      }
      
      .resource-title {
        margin: 0 0 12px 0;
        font-size: 28px;
        color: #303133;
      }
      
      .resource-description {
        margin: 0;
        color: #606266;
        font-size: 16px;
        line-height: 1.6;
      }
    }
  }
  
  .resource-meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 20px;
    padding: 16px;
    background-color: #F5F7FA;
    border-radius: 8px;
    
    .meta-item {
      .label {
        color: #909399;
        margin-right: 8px;
      }
      
      .value {
        color: #303133;
        font-weight: 500;
      }
    }
  }
  
  .resource-stats {
    display: flex;
    gap: 24px;
    margin-bottom: 20px;
    
    .stat-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #606266;
      font-size: 14px;
    }
  }
  
  .resource-actions {
    display: flex;
    gap: 12px;
  }
}

.content-card {
  .markdown-body {
    padding: 20px;
    line-height: 1.8;
    
    :deep(h1), :deep(h2), :deep(h3) {
      margin-top: 24px;
      margin-bottom: 16px;
    }
    
    :deep(p) {
      margin-bottom: 16px;
    }
    
    :deep(code) {
      background-color: #F5F7FA;
      padding: 2px 6px;
      border-radius: 4px;
    }
    
    :deep(pre) {
      background-color: #F5F7FA;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
  }
  
  .mermaid-container {
    padding: 20px;
    text-align: center;
  }
  
  .question-list {
    .question-item {
      padding: 20px;
      border: 1px solid #EBEEF5;
      border-radius: 8px;
      margin-bottom: 16px;
      
      .question-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        
        .question-number {
          font-weight: 600;
          font-size: 16px;
        }
      }
      
      .question-content {
        .question-text {
          font-size: 15px;
          line-height: 1.8;
          margin-bottom: 16px;
        }
        
        .question-options {
          margin-bottom: 16px;
          
          .option-item {
            padding: 8px 12px;
            margin-bottom: 8px;
            background-color: #F5F7FA;
            border-radius: 4px;
          }
        }
      }
    }
  }
  
  .video-list {
    .video-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border: 1px solid #EBEEF5;
      border-radius: 8px;
      margin-bottom: 16px;
      
      .video-info {
        flex: 1;
        
        h3 {
          margin: 0 0 8px 0;
          font-size: 18px;
        }
        
        .video-meta {
          margin: 8px 0;
          color: #909399;
          font-size: 13px;
          
          span {
            margin-right: 16px;
          }
        }
        
        .video-description {
          margin: 8px 0;
          color: #606266;
        }
        
        .video-tags {
          margin-top: 12px;
        }
      }
    }
  }
  
  .code-content {
    .code-header {
      margin-bottom: 20px;
      
      h3 {
        margin: 0 0 8px 0;
      }
      
      .code-meta {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 12px;
      }
    }
    
    .code-block {
      margin-bottom: 20px;
      
      pre {
        background-color: #282C34;
        color: #ABB2BF;
        padding: 20px;
        border-radius: 8px;
        overflow-x: auto;
        
        code {
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 14px;
          line-height: 1.6;
        }
      }
    }
    
    .code-explanation,
    .run-instructions,
    .expected-output {
      margin-bottom: 20px;
      
      h4 {
        margin: 0 0 12px 0;
        font-size: 16px;
      }
      
      pre {
        background-color: #F5F7FA;
        padding: 16px;
        border-radius: 8px;
        overflow-x: auto;
      }
    }
  }
}
</style>
