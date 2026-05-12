<template>
  <div class="tutoring-history-container">
    <!-- 搜索筛选区 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="课程">
          <el-select
            v-model="searchForm.course_id"
            placeholder="选择课程"
            clearable
            style="width: 200px"
          >
            <el-option
              v-for="course in courseList"
              :key="course.id"
              :label="course.name"
              :value="course.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="问题类型">
          <el-select
            v-model="searchForm.question_type"
            placeholder="选择类型"
            clearable
            style="width: 150px"
          >
            <el-option label="概念理解" value="概念理解" />
            <el-option label="解题方法" value="解题方法" />
            <el-option label="代码调试" value="代码调试" />
            <el-option label="知识应用" value="知识应用" />
            <el-option label="综合分析" value="综合分析" />
          </el-select>
        </el-form-item>

        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="搜索问题或解答内容"
            clearable
            style="width: 200px"
          />
        </el-form-item>

        <el-form-item label="时间范围">
          <el-date-picker
            v-model="searchForm.date_range"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            clearable
            style="width: 280px"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 历史记录列表 -->
    <div class="history-list">
      <el-empty v-if="historyList.length === 0 && !loading" description="暂无答疑记录" />

      <el-card
        v-for="item in historyList"
        :key="item.question.id"
        shadow="hover"
        class="history-item"
      >
        <div class="item-header">
          <div class="item-meta">
            <el-tag v-if="item.question.question_type" type="info" size="small">
              {{ item.question.question_type }}
            </el-tag>
            <el-tag
              v-if="item.question.difficulty_level"
              :type="getDifficultyType(item.question.difficulty_level)"
              size="small"
            >
              难度: {{ getDifficultyText(item.question.difficulty_level) }}
            </el-tag>
            <span class="item-time">
              {{ formatTime(item.question.create_time) }}
            </span>
          </div>
          <div class="item-actions">
            <el-button
              v-if="item.is_favorited"
              type="warning"
              size="small"
              :icon="StarFilled"
              @click="handleUnfavorite(item)"
            >
              已收藏
            </el-button>
            <el-button
              v-else
              size="small"
              :icon="Star"
              @click="handleFavorite(item)"
            >
              收藏
            </el-button>
          </div>
        </div>

        <div class="item-content">
          <div class="question-section">
            <h4>问题</h4>
            <p class="question-text">{{ item.question.question_text }}</p>
            <div v-if="item.question.question_images && item.question.question_images.length > 0" class="question-images">
              <el-image
                v-for="(img, index) in item.question.question_images"
                :key="index"
                :src="img"
                :preview-src-list="item.question.question_images"
                fit="cover"
                class="question-image"
              />
            </div>
            <div v-if="item.question.knowledge_points && item.question.knowledge_points.length > 0" class="knowledge-points">
              <el-tag
                v-for="(point, index) in item.question.knowledge_points"
                :key="index"
                size="small"
                effect="plain"
              >
                {{ point }}
              </el-tag>
            </div>
          </div>

          <div v-if="item.answer" class="answer-section">
            <h4>解答摘要</h4>
            <p class="answer-summary">{{ getAnswerSummary(item.answer.answer_text) }}</p>
            <div class="answer-meta">
              <el-tag v-if="item.answer.confidence_score" :type="getConfidenceType(item.answer.confidence_score)" size="small">
                置信度: {{ item.answer.confidence_score }}%
              </el-tag>
              <span v-if="item.answer.answer_diagrams && item.answer.answer_diagrams.length > 0">
                <el-icon><PieChart /></el-icon>
                包含 {{ item.answer.answer_diagrams.length }} 个图解
              </span>
              <span v-if="item.answer.answer_videos && item.answer.answer_videos.length > 0">
                <el-icon><VideoPlay /></el-icon>
                推荐 {{ item.answer.answer_videos.length }} 个视频
              </span>
            </div>
          </div>
          <div v-else class="no-answer">
            <el-tag type="warning">待解答</el-tag>
          </div>
        </div>

        <div class="item-footer">
          <el-button type="primary" size="small" @click="handleViewDetail(item)">
            查看详情
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- 分页 -->
    <div class="pagination-section">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.page_size"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { Search, Star, StarFilled, PieChart, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getTutoringHistory, addFavorite, removeFavorite } from '@/api/tutoring'
import { getCoursesPage } from '@/api/curriculum'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export default {
  name: 'TutoringHistory',
  components: {
    Search,
    Star,
    StarFilled,
    PieChart,
    VideoPlay
  },
  emits: ['view-detail'],
  setup(props, { emit }) {
    const loading = ref(false)
    const historyList = ref([])
    const courseList = ref([])

    const searchForm = reactive({
      course_id: null,
      question_type: null,
      keyword: '',
      date_range: null
    })

    const pagination = reactive({
      page: 1,
      page_size: 20,
      total: 0
    })

    // 加载历史记录
    const loadHistory = async () => {
      loading.value = true
      try {
        const params = {
          course_id: searchForm.course_id,
          question_type: searchForm.question_type,
          keyword: searchForm.keyword || undefined,
          page: pagination.page,
          page_size: pagination.page_size
        }
        if (searchForm.date_range && searchForm.date_range.length === 2) {
          params.start_date = `${searchForm.date_range[0]}T00:00:00`
          params.end_date = `${searchForm.date_range[1]}T00:00:00`
        }

        const result = await getTutoringHistory(params)
        historyList.value = result.items
        pagination.total = result.total

      } catch (error) {
        ElMessage.error('加载历史记录失败: ' + error.message)
      } finally {
        loading.value = false
      }
    }

    // 搜索
    const handleSearch = () => {
      pagination.page = 1
      loadHistory()
    }

    // 重置
    const handleReset = () => {
      searchForm.course_id = null
      searchForm.question_type = null
      searchForm.keyword = ''
      searchForm.date_range = null
      pagination.page = 1
      loadHistory()
    }

    // 分页变化
    const handlePageChange = (page) => {
      pagination.page = page
      loadHistory()
    }

    const handleSizeChange = (size) => {
      pagination.page_size = size
      pagination.page = 1
      loadHistory()
    }

    // 查看详情
    const handleViewDetail = (item) => {
      emit('view-detail', item)
    }

    // 收藏
    const handleFavorite = async (item) => {
      try {
        await addFavorite(item.question.id, item.answer.id, '')
        ElMessage.success('收藏成功')
        item.is_favorited = true
      } catch (error) {
        ElMessage.error('收藏失败: ' + error.message)
      }
    }

    // 取消收藏
    const handleUnfavorite = async (item) => {
      try {
        await ElMessageBox.confirm('确定取消收藏吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })

        await removeFavorite(item.question.id)
        ElMessage.success('已取消收藏')
        item.is_favorited = false
      } catch (error) {
        if (error !== 'cancel') {
          ElMessage.error('取消收藏失败: ' + error.message)
        }
      }
    }

    // 格式化时间
    const formatTime = (time) => {
      if (!time) return ''
      return formatDistanceToNow(new Date(time), { addSuffix: true, locale: zhCN })
    }

    // 获取难度类型
    const getDifficultyType = (level) => {
      const types = { 1: 'success', 2: 'warning', 3: 'danger' }
      return types[level] || 'info'
    }

    // 获取难度文字
    const getDifficultyText = (level) => {
      const texts = { 1: '简单', 2: '中等', 3: '困难' }
      return texts[level] || '未知'
    }

    // 获取置信度类型
    const getConfidenceType = (score) => {
      if (score >= 80) return 'success'
      if (score >= 60) return 'warning'
      return 'danger'
    }

    // 获取解答摘要
    const getAnswerSummary = (text) => {
      if (!text) return ''
      // 移除 Markdown 标记，取前200字符
      const plainText = text.replace(/[#*`\[\]]/g, '').trim()
      return plainText.length > 200 ? plainText.substring(0, 200) + '...' : plainText
    }

    const loadCourses = async () => {
      try {
        const res = await getCoursesPage({ pageNo: 1, pageSize: 500 })
        if (res.code === 200 && res.data?.list) {
          courseList.value = res.data.list.map((row) => ({
            id: row.id,
            name: row.name ?? `课程${row.id}`
          }))
        }
      } catch (e) {
        console.error(e)
      }
    }

    onMounted(() => {
      loadCourses()
      loadHistory()
    })

    return {
      loading,
      historyList,
      courseList,
      searchForm,
      pagination,
      handleSearch,
      handleReset,
      handlePageChange,
      handleSizeChange,
      handleViewDetail,
      handleFavorite,
      handleUnfavorite,
      formatTime,
      getDifficultyType,
      getDifficultyText,
      getConfidenceType,
      getAnswerSummary
    }
  }
}
</script>

<style scoped>
.tutoring-history-container {
  padding: 20px;
}

.search-card {
  margin-bottom: 20px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.history-item {
  transition: all 0.3s;
}

.history-item:hover {
  transform: translateY(-2px);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.item-time {
  color: #909399;
  font-size: 14px;
}

.item-content {
  margin-bottom: 15px;
}

.question-section,
.answer-section {
  margin-bottom: 15px;
}

.question-section h4,
.answer-section h4 {
  margin: 0 0 10px 0;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
}

.question-text {
  margin: 0 0 10px 0;
  color: #606266;
  line-height: 1.6;
}

.question-images {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.question-image {
  width: 100px;
  height: 100px;
  border-radius: 4px;
  cursor: pointer;
}

.knowledge-points {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.answer-summary {
  margin: 0 0 10px 0;
  color: #606266;
  line-height: 1.6;
}

.answer-meta {
  display: flex;
  align-items: center;
  gap: 15px;
  color: #909399;
  font-size: 14px;
}

.answer-meta span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.no-answer {
  padding: 20px;
  text-align: center;
  background: #f5f7fa;
  border-radius: 4px;
}

.item-footer {
  text-align: right;
}

.pagination-section {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
</style>
