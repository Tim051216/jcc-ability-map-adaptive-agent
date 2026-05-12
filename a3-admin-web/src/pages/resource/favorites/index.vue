<template>
  <div class="favorites-container">
    <!-- 头部 -->
    <el-card class="header-card">
      <div class="header-content">
        <h2>收藏夹</h2>
        <el-button @click="$router.push('/resource/management')">
          <el-icon><ArrowLeft /></el-icon>
          返回资源列表
        </el-button>
      </div>
    </el-card>

    <!-- 分类筛选 -->
    <el-card class="category-card">
      <div class="category-tabs">
        <div
          v-for="cat in categories"
          :key="cat.name"
          class="category-tab"
          :class="{ active: selectedCategory === cat.name }"
          @click="handleCategoryChange(cat.name)"
        >
          <span class="category-name">{{ cat.name }}</span>
          <el-badge :value="cat.count" class="category-badge" />
        </div>
      </div>
    </el-card>

    <!-- 收藏列表 -->
    <el-card class="list-card">
      <div v-loading="loading" class="favorites-list">
        <div
          v-for="favorite in favoriteList"
          :key="favorite.id"
          class="favorite-card"
        >
          <div class="favorite-header">
            <div class="resource-type-badge" :class="`type-${favorite.resource_type}`">
              {{ getResourceTypeLabel(favorite.resource_type) }}
            </div>
            <div class="favorite-time">
              收藏于 {{ formatDate(favorite.favorited_at) }}
            </div>
          </div>

          <div class="favorite-content">
            <h3 class="resource-title" @click="handleViewDetail(favorite.resource_id)">
              {{ favorite.resource_title }}
            </h3>
            <p class="resource-description">{{ favorite.resource_description }}</p>

            <div v-if="favorite.notes" class="favorite-notes">
              <el-icon><Document /></el-icon>
              <span>{{ favorite.notes }}</span>
            </div>

            <div class="resource-meta">
              <span><el-icon><User /></el-icon> {{ favorite.student_name }}</span>
              <span><el-icon><Document /></el-icon> {{ favorite.knowledge_point_name }}</span>
              <span><el-icon><Clock /></el-icon> {{ formatDate(favorite.resource_created_at) }}</span>
            </div>
          </div>

          <div class="favorite-actions">
            <el-button
              size="small"
              type="primary"
              @click="handleViewDetail(favorite.resource_id)"
            >
              查看详情
            </el-button>
            <el-button
              size="small"
              :icon="Download"
              @click="handleDownload(favorite.resource_id)"
            >
              下载
            </el-button>
            <el-button
              size="small"
              :icon="Edit"
              @click="handleEditNotes(favorite)"
            >
              编辑备注
            </el-button>
            <el-button
              size="small"
              type="danger"
              :icon="Delete"
              @click="handleRemoveFavorite(favorite.id)"
            >
              取消收藏
            </el-button>
          </div>
        </div>

        <el-empty v-if="!loading && favoriteList.length === 0" description="暂无收藏" />
      </div>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 编辑备注对话框 -->
    <el-dialog
      v-model="editNotesDialogVisible"
      title="编辑收藏备注"
      width="500px"
    >
      <el-form :model="editNotesForm" label-width="80px">
        <el-form-item label="分类">
          <el-select
            v-model="editNotesForm.category"
            placeholder="请选择分类"
            style="width: 100%"
            allow-create
            filterable
          >
            <el-option
              v-for="cat in categories"
              :key="cat.name"
              :label="cat.name"
              :value="cat.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="editNotesForm.notes"
            type="textarea"
            :rows="4"
            placeholder="添加备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editNotesDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveNotes">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  User,
  Document,
  Clock,
  Download,
  Edit,
  Delete
} from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import {
  getFavoriteList,
  getFavoriteCategories,
  updateFavorite,
  removeFavorite,
  downloadResource
} from '@/api/resource-generation'

const router = useRouter()

// 资源类型映射
const resourceTypeMap = {
  1: '课程讲解文档',
  2: '知识点思维导图',
  3: '分层练习题库',
  4: '教学视频推荐',
  5: '代码实操案例'
}

// 分类列表
const categories = ref([
  { name: '全部', count: 0 }
])
const selectedCategory = ref('全部')

// 收藏列表
const favoriteList = ref([])
const loading = ref(false)

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 编辑备注
const editNotesDialogVisible = ref(false)
const currentEditFavorite = ref(null)
const editNotesForm = reactive({
  category: '',
  notes: ''
})

// 获取资源类型标签
const getResourceTypeLabel = (type) => {
  return resourceTypeMap[type] || '未知类型'
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

// 加载收藏分类
const loadCategories = async () => {
  try {
    const response = await getFavoriteCategories()
    
    // 构建分类列表
    const allCount = response.reduce((sum, cat) => sum + cat.count, 0)
    categories.value = [
      { name: '全部', count: allCount },
      ...response.map(cat => ({ name: cat.category, count: cat.count }))
    ]
  } catch (error) {
    console.error('加载分类失败:', error)
  }
}

// 加载收藏列表
const loadFavoriteList = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      page_size: pagination.pageSize,
      category: selectedCategory.value === '全部' ? undefined : selectedCategory.value
    }

    const response = await getFavoriteList(params)
    favoriteList.value = response.items
    pagination.total = response.total
  } catch (error) {
    console.error('加载收藏列表失败:', error)
    ElMessage.error('加载收藏列表失败')
  } finally {
    loading.value = false
  }
}

// 分类变化
const handleCategoryChange = (category) => {
  selectedCategory.value = category
  pagination.page = 1
  loadFavoriteList()
}

// 分页变化
const handlePageChange = (page) => {
  pagination.page = page
  loadFavoriteList()
}

const handleSizeChange = (size) => {
  pagination.pageSize = size
  pagination.page = 1
  loadFavoriteList()
}

// 查看详情
const handleViewDetail = (resourceId) => {
  router.push(`/resource/detail/${resourceId}`)
}

// 下载资源
const handleDownload = async (resourceId) => {
  try {
    const response = await downloadResource(resourceId)
    window.open(response.download_url, '_blank')
    ElMessage.success('开始下载')
  } catch (error) {
    console.error('下载失败:', error)
    ElMessage.error('下载失败')
  }
}

// 编辑备注
const handleEditNotes = (favorite) => {
  currentEditFavorite.value = favorite
  editNotesForm.category = favorite.category || '默认分类'
  editNotesForm.notes = favorite.notes || ''
  editNotesDialogVisible.value = true
}

// 保存备注
const handleSaveNotes = async () => {
  try {
    await updateFavorite(currentEditFavorite.value.id, {
      category: editNotesForm.category,
      notes: editNotesForm.notes
    })
    
    ElMessage.success('保存成功')
    editNotesDialogVisible.value = false
    
    // 更新列表中的数据
    const index = favoriteList.value.findIndex(
      f => f.id === currentEditFavorite.value.id
    )
    if (index !== -1) {
      favoriteList.value[index].category = editNotesForm.category
      favoriteList.value[index].notes = editNotesForm.notes
    }
    
    // 重新加载分类
    loadCategories()
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  }
}

// 取消收藏
const handleRemoveFavorite = async (favoriteId) => {
  try {
    await ElMessageBox.confirm('确定要取消收藏吗?', '提示', {
      type: 'warning'
    })
    
    await removeFavorite(favoriteId)
    ElMessage.success('已取消收藏')
    
    // 重新加载列表和分类
    loadFavoriteList()
    loadCategories()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('取消收藏失败:', error)
      ElMessage.error('取消收藏失败')
    }
  }
}

onMounted(() => {
  loadCategories()
  loadFavoriteList()
})
</script>

<style scoped lang="scss">
.favorites-container {
  padding: 20px;
}

.header-card {
  margin-bottom: 20px;
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    h2 {
      margin: 0;
      font-size: 24px;
      color: #303133;
    }
  }
}

.category-card {
  margin-bottom: 20px;
  
  .category-tabs {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    
    .category-tab {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border: 1px solid #DCDFE6;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.3s;
      
      &:hover {
        border-color: #409EFF;
        background-color: #ECF5FF;
      }
      
      &.active {
        border-color: #409EFF;
        background-color: #409EFF;
        color: white;
        
        .category-name {
          color: white;
        }
        
        :deep(.el-badge__content) {
          background-color: white;
          color: #409EFF;
        }
      }
      
      .category-name {
        font-size: 14px;
        color: #606266;
      }
    }
  }
}

.list-card {
  .favorites-list {
    min-height: 400px;
  }
}

.favorite-card {
  padding: 20px;
  border: 1px solid #EBEEF5;
  border-radius: 8px;
  margin-bottom: 16px;
  transition: all 0.3s;
  
  &:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  }
  
  .favorite-header {
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
      &.type-2 { background-color: #D9ECFF; color: #409EFF; }
      &.type-3 { background-color: #FDE2E2; color: #F56C6C; }
      &.type-4 { background-color: #F4E8FF; color: #9C27B0; }
      &.type-5 { background-color: #FFF4E5; color: #FF9800; }
    }
    
    .favorite-time {
      font-size: 13px;
      color: #909399;
    }
  }
  
  .favorite-content {
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
    
    .favorite-notes {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background-color: #FFF7E6;
      border-left: 3px solid #FF9800;
      border-radius: 4px;
      margin-bottom: 12px;
      font-size: 13px;
      color: #606266;
    }
    
    .resource-meta {
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
  
  .favorite-actions {
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
