<template>
  <div class="resource-management-container">
    <!-- 顶部操作栏 -->
    <el-card class="header-card">
      <div class="header-actions">
        <el-button type="primary" @click="$router.push('/resource/generation')">
          <el-icon><Plus /></el-icon>
          生成新资源
        </el-button>
        <el-button @click="$router.push('/resource/favorites')">
          <el-icon><Star /></el-icon>
          收藏夹
        </el-button>
      </div>
    </el-card>

    <!-- 筛选器 -->
    <el-card class="filter-card">
      <el-form :model="filterForm" inline>
        <el-form-item label="资源类型">
          <el-select
            v-model="filterForm.resourceType"
            placeholder="全部类型"
            clearable
            style="width: 150px"
          >
            <el-option
              v-for="type in resourceTypes"
              :key="type.value"
              :label="type.label"
              :value="type.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="资源状态">
          <el-select
            v-model="filterForm.status"
            placeholder="全部状态"
            clearable
            style="width: 150px"
          >
            <el-option label="生成中" :value="1" />
            <el-option label="已完成" :value="2" />
            <el-option label="生成失败" :value="3" />
          </el-select>
        </el-form-item>

        <el-form-item label="难度等级">
          <el-select
            v-model="filterForm.difficultyLevel"
            placeholder="全部难度"
            clearable
            style="width: 150px"
          >
            <el-option label="基础" :value="1" />
            <el-option label="进阶" :value="2" />
            <el-option label="拔高" :value="3" />
          </el-select>
        </el-form-item>

        <el-form-item label="关键词">
          <el-input
            v-model="filterForm.keyword"
            placeholder="搜索资源"
            clearable
            style="width: 200px"
            @keyup.enter="handleSearch"
          >
            <template #append>
              <el-button :icon="Search" @click="handleSearch" />
            </template>
          </el-input>
        </el-form-item>

        <el-form-item>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 资源列表 -->
    <el-card class="list-card">
      <div v-loading="loading" class="resource-list">
        <div
          v-for="resource in resourceList"
          :key="resource.id"
          class="resource-card"
        >
          <div class="resource-header">
            <div class="resource-type-badge" :class="`type-${resource.resource_type}`">
              {{ getResourceTypeLabel(resource.resource_type) }}
            </div>
            <div class="resource-status">
              <el-tag
                :type="getStatusTagType(resource.status)"
                size="small"
              >
                {{ getStatusText(resource.status) }}
              </el-tag>
            </div>
          </div>

          <div class="resource-content">
            <h3 class="resource-title" @click="handleViewDetail(resource.id)">
              {{ resource.title }}
            </h3>
            <p class="resource-description">{{ resource.description }}</p>

            <div class="resource-meta">
              <span><el-icon><User /></el-icon> {{ resource.student_name }}</span>
              <span><el-icon><Document /></el-icon> {{ resource.knowledge_point_name }}</span>
              <span><el-icon><Clock /></el-icon> {{ formatDate(resource.created_at) }}</span>
            </div>

            <div class="resource-stats">
              <span><el-icon><View /></el-icon> {{ resource.view_count }}</span>
              <span><el-icon><Download /></el-icon> {{ resource.download_count }}</span>
              <span><el-icon><Star /></el-icon> {{ resource.favorite_count }}</span>
              <span v-if="resource.quality_score">
                评分: {{ (resource.quality_score * 100).toFixed(0) }}
              </span>
            </div>
          </div>

          <div class="resource-actions">
            <el-button
              size="small"
              type="primary"
              @click="handleViewDetail(resource.id)"
            >
              查看详情
            </el-button>
            <el-button
              size="small"
              :icon="resource.is_favorited ? StarFilled : Star"
              @click="handleToggleFavorite(resource)"
            >
              {{ resource.is_favorited ? '取消收藏' : '收藏' }}
            </el-button>
            <el-button
              size="small"
              :icon="Download"
              @click="handleDownload(resource.id)"
            >
              下载
            </el-button>
            <el-button
              size="small"
              type="danger"
              :icon="Delete"
              @click="handleDelete(resource.id)"
            >
              删除
            </el-button>
          </div>
        </div>

        <el-empty v-if="!loading && resourceList.length === 0" description="暂无资源" />
      </div>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 收藏对话框 -->
    <el-dialog
      v-model="favoriteDialogVisible"
      title="添加到收藏夹"
      width="400px"
    >
      <el-form :model="favoriteForm" label-width="80px">
        <el-form-item label="收藏分类">
          <el-select
            v-model="favoriteForm.category"
            placeholder="请选择分类"
            style="width: 100%"
            allow-create
            filterable
          >
            <el-option
              v-for="cat in favoriteCategories"
              :key="cat"
              :label="cat"
              :value="cat"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="favoriteForm.notes"
            type="textarea"
            :rows="3"
            placeholder="添加备注(可选)"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="favoriteDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmFavorite">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Star,
  StarFilled,
  Search,
  User,
  Document,
  Clock,
  View,
  Download,
  Delete
} from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import {
  getResourceList,
  addFavorite,
  removeFavorite,
  downloadResource,
  deleteResource,
  getFavoriteCategories
} from '@/api/resource-generation'

const router = useRouter()

// 资源类型定义
const resourceTypes = [
  { value: 1, label: '课程讲解文档' },
  { value: 2, label: '知识点思维导图' },
  { value: 3, label: '分层练习题库' },
  { value: 4, label: '教学视频推荐' },
  { value: 5, label: '代码实操案例' }
]

// 筛选表单
const filterForm = reactive({
  resourceType: null,
  status: null,
  difficultyLevel: null,
  keyword: ''
})

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 资源列表
const resourceList = ref([])
const loading = ref(false)

// 收藏相关
const favoriteDialogVisible = ref(false)
const currentFavoriteResource = ref(null)
const favoriteForm = reactive({
  category: '',
  notes: ''
})
const favoriteCategories = ref([])

// 获取资源类型标签
const getResourceTypeLabel = (type) => {
  const found = resourceTypes.find(t => t.value === type)
  return found ? found.label : '未知类型'
}

// 获取状态标签类型
const getStatusTagType = (status) => {
  const typeMap = {
    1: 'warning',
    2: 'success',
    3: 'danger'
  }
  return typeMap[status] || 'info'
}

// 获取状态文本
const getStatusText = (status) => {
  const textMap = {
    1: '生成中',
    2: '已完成',
    3: '生成失败'
  }
  return textMap[status] || '未知'
}

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 加载资源列表
const loadResourceList = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      page_size: pagination.pageSize,
      resource_type: filterForm.resourceType,
      status: filterForm.status,
      difficulty_level: filterForm.difficultyLevel,
      keyword: filterForm.keyword
    }

    const response = await getResourceList(params)
    resourceList.value = response.items
    pagination.total = response.total
  } catch (error) {
    console.error('加载资源列表失败:', error)
    ElMessage.error('加载资源列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadResourceList()
}

// 重置筛选
const handleReset = () => {
  filterForm.resourceType = null
  filterForm.status = null
  filterForm.difficultyLevel = null
  filterForm.keyword = ''
  pagination.page = 1
  loadResourceList()
}

// 分页变化
const handlePageChange = (page) => {
  pagination.page = page
  loadResourceList()
}

const handleSizeChange = (size) => {
  pagination.pageSize = size
  pagination.page = 1
  loadResourceList()
}

// 查看详情
const handleViewDetail = (resourceId) => {
  router.push(`/resource/detail/${resourceId}`)
}

// 切换收藏
const handleToggleFavorite = async (resource) => {
  if (resource.is_favorited) {
    // 取消收藏
    try {
      await ElMessageBox.confirm('确定要取消收藏吗?', '提示', {
        type: 'warning'
      })
      
      await removeFavorite(resource.id)
      ElMessage.success('已取消收藏')
      resource.is_favorited = false
      resource.favorite_count--
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error('取消收藏失败')
      }
    }
  } else {
    // 添加收藏
    currentFavoriteResource.value = resource
    favoriteForm.category = ''
    favoriteForm.notes = ''
    
    // 加载收藏分类
    try {
      const categories = await getFavoriteCategories()
      favoriteCategories.value = categories
    } catch (error) {
      console.error('加载收藏分类失败:', error)
    }
    
    favoriteDialogVisible.value = true
  }
}

// 确认收藏
const handleConfirmFavorite = async () => {
  try {
    await addFavorite({
      resource_id: currentFavoriteResource.value.id,
      category: favoriteForm.category,
      notes: favoriteForm.notes
    })
    
    ElMessage.success('收藏成功')
    currentFavoriteResource.value.is_favorited = true
    currentFavoriteResource.value.favorite_count++
    favoriteDialogVisible.value = false
  } catch (error) {
    console.error('收藏失败:', error)
    ElMessage.error('收藏失败')
  }
}

// 下载资源
const handleDownload = async (resourceId) => {
  try {
    const response = await downloadResource(resourceId)
    
    // 打开下载链接
    window.open(response.download_url, '_blank')
    ElMessage.success('开始下载')
  } catch (error) {
    console.error('下载失败:', error)
    ElMessage.error('下载失败')
  }
}

// 删除资源
const handleDelete = async (resourceId) => {
  try {
    await ElMessageBox.confirm('确定要删除这个资源吗?删除后无法恢复。', '警告', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消'
    })
    
    await deleteResource(resourceId)
    ElMessage.success('删除成功')
    loadResourceList()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

onMounted(() => {
  loadResourceList()
})
</script>

<style scoped lang="scss">
.resource-management-container {
  padding: 20px;
}

.header-card {
  margin-bottom: 20px;
  
  .header-actions {
    display: flex;
    gap: 12px;
  }
}

.filter-card {
  margin-bottom: 20px;
}

.list-card {
  .resource-list {
    min-height: 400px;
  }
}

.resource-card {
  padding: 20px;
  border: 1px solid #EBEEF5;
  border-radius: 8px;
  margin-bottom: 16px;
  transition: all 0.3s;
  
  &:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  }
  
  .resource-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    
    .resource-type-badge {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      
      &.type-1 { background-color: #E1F3D8; color: #67C23A; }
      &.type-2 { background-color: #D9ECF F; color: #409EFF; }
      &.type-3 { background-color: #FDE2E2; color: #F56C6C; }
      &.type-4 { background-color: #F4E8FF; color: #9C27B0; }
      &.type-5 { background-color: #FFF4E5; color: #FF9800; }
    }
  }
  
  .resource-content {
    .resource-title {
      margin: 0 0 8px 0;
      font-size: 18px;
      color: #303133;
      cursor: pointer;
      
      &:hover {
        color: #409EFF;
      }
    }
    
    .resource-description {
      margin: 0 0 12px 0;
      color: #606266;
      font-size: 14px;
      line-height: 1.6;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    
    .resource-meta {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
      font-size: 13px;
      color: #909399;
      
      span {
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }
    
    .resource-stats {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: #909399;
      
      span {
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }
  }
  
  .resource-actions {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #EBEEF5;
    display: flex;
    gap: 8px;
  }
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
</style>
