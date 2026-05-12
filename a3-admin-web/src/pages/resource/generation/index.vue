<template>
  <div class="resource-generation-container">
    <el-card class="header-card">
      <div class="header-content">
        <h2>AI 资源生成</h2>
        <p class="subtitle">基于多智能体协同技术,为学生生成个性化学习资源</p>
      </div>
    </el-card>

    <!-- 资源类型选择 -->
    <el-card class="resource-types-card">
      <template #header>
        <div class="card-header">
          <span>选择资源类型</span>
          <el-tag type="info" size="small">可多选</el-tag>
        </div>
      </template>
      
      <div class="resource-types-grid">
        <div
          v-for="type in resourceTypes"
          :key="type.value"
          class="resource-type-card"
          :class="{ active: selectedTypes.includes(type.value) }"
          @click="toggleResourceType(type.value)"
        >
          <div class="type-icon">
            <i :class="type.icon"></i>
          </div>
          <div class="type-info">
            <h3>{{ type.label }}</h3>
            <p>{{ type.description }}</p>
          </div>
          <div class="type-check">
            <el-icon v-if="selectedTypes.includes(type.value)" color="#67C23A">
              <Check />
            </el-icon>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 生成参数配置 -->
    <el-card class="params-card">
      <template #header>
        <span>生成参数配置</span>
      </template>
      
      <el-form :model="formData" :rules="rules" ref="formRef" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="任务名称" prop="taskName">
              <el-input
                v-model="formData.taskName"
                placeholder="请输入任务名称"
                clearable
              />
            </el-form-item>
          </el-col>
          
          <el-col :span="12">
            <el-form-item label="学生" prop="studentId">
              <el-select
                v-model="formData.studentId"
                placeholder="请选择学生"
                filterable
                style="width: 100%"
              >
                <el-option
                  v-for="student in students"
                  :key="student.id"
                  :label="student.name"
                  :value="student.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="课程" prop="courseId">
              <el-select
                v-model="formData.courseId"
                placeholder="请选择课程"
                filterable
                style="width: 100%"
                @change="handleCourseChange"
              >
                <el-option
                  v-for="course in courses"
                  :key="course.id"
                  :label="course.name"
                  :value="course.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          
          <el-col :span="12">
            <el-form-item label="知识点" prop="knowledgePointId">
              <el-select
                v-model="formData.knowledgePointId"
                placeholder="请先选择课程，再选小节（知识点）"
                filterable
                style="width: 100%"
                :loading="catalogueLoading"
                :disabled="!formData.courseId"
              >
                <el-option
                  v-for="point in knowledgePoints"
                  :key="point.id"
                  :label="point.name"
                  :value="point.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="难度等级">
              <el-radio-group v-model="formData.difficultyLevel">
                <el-radio :label="1">基础</el-radio>
                <el-radio :label="2">进阶</el-radio>
                <el-radio :label="3">拔高</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          
          <el-col :span="12" v-if="selectedTypes.includes(5)">
            <el-form-item label="编程语言">
              <el-select v-model="formData.programmingLanguage" style="width: 100%">
                <el-option label="Python" value="Python" />
                <el-option label="Java" value="Java" />
                <el-option label="JavaScript" value="JavaScript" />
                <el-option label="C++" value="C++" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <!-- 操作按钮 -->
    <div class="action-buttons">
      <el-button @click="handleReset">重置</el-button>
      <el-button
        type="primary"
        :loading="generating"
        :disabled="selectedTypes.length === 0"
        @click="handleGenerate"
      >
        <el-icon v-if="!generating"><MagicStick /></el-icon>
        {{ generating ? '生成中...' : '开始生成' }}
      </el-button>
    </div>

    <!-- 生成进度对话框 -->
    <el-dialog
      v-model="progressDialogVisible"
      title="资源生成进度"
      width="600px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <div class="progress-content">
        <el-progress
          :percentage="taskProgress"
          :status="taskStatus === 3 ? 'success' : taskStatus === 5 ? 'exception' : undefined"
        />
        
        <div class="progress-info">
          <p>任务状态: {{ getTaskStatusText(taskStatus) }}</p>
          <p>已完成: {{ completedResources }} / {{ totalResources }}</p>
          <p v-if="failedResources > 0" class="error-text">失败: {{ failedResources }}</p>
        </div>

        <div v-if="taskStatus === 3" class="success-message">
          <el-icon color="#67C23A" :size="48"><SuccessFilled /></el-icon>
          <p>资源生成完成!</p>
        </div>

        <div v-if="errorMessage" class="error-message">
          <el-alert type="error" :title="errorMessage" :closable="false" />
        </div>
      </div>

      <template #footer>
        <el-button v-if="taskStatus === 3" type="primary" @click="handleViewResources">
          查看资源
        </el-button>
        <el-button v-else-if="taskStatus === 2" @click="handleCancelTask">
          取消任务
        </el-button>
        <el-button @click="progressDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, MagicStick, SuccessFilled } from '@element-plus/icons-vue'
import { createGenerationTask, getTaskStatus, cancelTask } from '@/api/resource-generation'
import { getCoursesPage, getcoursesListData } from '@/api/curriculum'
import { getStudents } from '@/api/students.js'
import { useRouter } from 'vue-router'

const router = useRouter()

/** 将课程目录章节与小节扁平化为下拉选项（小节 id 作为 knowledge_point_id） */
function flattenCatalogueToKnowledgePoints(catalogueData) {
  const points = []
  if (!Array.isArray(catalogueData)) {
    return points
  }
  for (const chapter of catalogueData) {
    const chName = chapter?.name ?? ''
    const sections = chapter?.sections
    if (!Array.isArray(sections)) {
      continue
    }
    for (const sec of sections) {
      if (sec?.id == null) {
        continue
      }
      const label = chName ? `${chName} / ${sec.name ?? ''}` : (sec.name ?? '')
      points.push({ id: sec.id, name: label.trim() || `小节 ${sec.id}` })
    }
  }
  return points
}

// 资源类型定义
const resourceTypes = [
  {
    value: 1,
    label: '课程讲解文档',
    description: '结构化的课程讲解,支持公式和代码',
    icon: 'el-icon-document'
  },
  {
    value: 2,
    label: '知识点思维导图',
    description: '可视化的知识结构图',
    icon: 'el-icon-share'
  },
  {
    value: 3,
    label: '分层练习题库',
    description: '基础、进阶、拔高三层题目',
    icon: 'el-icon-edit'
  },
  {
    value: 4,
    label: '教学视频推荐',
    description: '精选的教学视频资源',
    icon: 'el-icon-video-camera'
  },
  {
    value: 5,
    label: '代码实操案例',
    description: '可运行的代码示例',
    icon: 'el-icon-cpu'
  }
]

// 选中的资源类型
const selectedTypes = ref([])

// 表单数据
const formData = reactive({
  taskName: '',
  studentId: null,
  courseId: null,
  knowledgePointId: null,
  difficultyLevel: 1,
  programmingLanguage: 'Python'
})

// 表单验证规则
const rules = {
  taskName: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  studentId: [{ required: true, message: '请选择学生', trigger: 'change' }],
  courseId: [{ required: true, message: '请选择课程', trigger: 'change' }],
  knowledgePointId: [{ required: true, message: '请选择知识点', trigger: 'change' }]
}

const formRef = ref(null)
const generating = ref(false)
const progressDialogVisible = ref(false)

// 任务进度相关
const currentTaskId = ref(null)
const taskProgress = ref(0)
const taskStatus = ref(1)
const totalResources = ref(0)
const completedResources = ref(0)
const failedResources = ref(0)
const errorMessage = ref('')

const students = ref([])
const courses = ref([])
const knowledgePoints = ref([])
const catalogueLoading = ref(false)

// 切换资源类型
const toggleResourceType = (value) => {
  const index = selectedTypes.value.indexOf(value)
  if (index > -1) {
    selectedTypes.value.splice(index, 1)
  } else {
    selectedTypes.value.push(value)
  }
}

// 课程变化时从目录接口加载小节作为知识点选项
const handleCourseChange = async (courseId) => {
  formData.knowledgePointId = null
  knowledgePoints.value = []
  if (!courseId) {
    return
  }
  catalogueLoading.value = true
  try {
    const res = await getcoursesListData(courseId)
    if (res.code === 200 && res.data) {
      knowledgePoints.value = flattenCatalogueToKnowledgePoints(res.data)
      if (knowledgePoints.value.length === 0) {
        ElMessage.warning('该课程暂无小节目录，请先在课程列表中维护目录')
      }
    } else {
      ElMessage.error(res.msg || res.message || '加载课程目录失败')
    }
  } catch (e) {
    console.error(e)
    ElMessage.error('加载知识点失败')
  } finally {
    catalogueLoading.value = false
  }
}

async function loadStudentsAndCourses() {
  try {
    const [stuRes, courseRes] = await Promise.all([
      getStudents({ pageNo: 1, pageSize: 500 }),
      getCoursesPage({ pageNo: 1, pageSize: 500 })
    ])
    if (stuRes.code === 200 && stuRes.data?.list) {
      students.value = stuRes.data.list.map((row) => ({
        id: row.id,
        name: row.name ?? `学员${row.id}`
      }))
    }
    if (courseRes.code === 200 && courseRes.data?.list) {
      courses.value = courseRes.data.list.map((row) => ({
        id: row.id,
        name: row.name ?? `课程${row.id}`
      }))
    }
  } catch (e) {
    console.error(e)
    ElMessage.error('加载学生或课程列表失败')
  }
}

// 获取任务状态文本
const getTaskStatusText = (status) => {
  const statusMap = {
    1: '待处理',
    2: '处理中',
    3: '已完成',
    4: '部分失败',
    5: '全部失败'
  }
  return statusMap[status] || '未知'
}

// 开始生成
const handleGenerate = async () => {
  if (selectedTypes.value.length === 0) {
    ElMessage.warning('请至少选择一种资源类型')
    return
  }

  try {
    await formRef.value.validate()
    
    generating.value = true
    
    const taskData = {
      task_name: formData.taskName,
      student_id: formData.studentId,
      resource_types: selectedTypes.value,
      knowledge_point_id: formData.knowledgePointId,
      course_id: formData.courseId,
      generation_params: {
        difficulty_level: formData.difficultyLevel,
        programming_language: formData.programmingLanguage
      }
    }
    
    const response = await createGenerationTask(taskData)
    currentTaskId.value = response.id
    totalResources.value = response.total_resources
    
    // 显示进度对话框
    progressDialogVisible.value = true
    
    // 开始轮询任务状态
    pollTaskStatus()
    
    ElMessage.success('任务创建成功,正在生成资源...')
  } catch (error) {
    console.error('创建任务失败:', error)
    ElMessage.error('创建任务失败: ' + (error.message || '未知错误'))
  } finally {
    generating.value = false
  }
}

// 轮询任务状态
const pollTaskStatus = async () => {
  if (!currentTaskId.value) return
  
  try {
    const response = await getTaskStatus(currentTaskId.value)
    
    taskProgress.value = response.progress
    taskStatus.value = response.task_status
    completedResources.value = response.completed_resources
    failedResources.value = response.failed_resources
    errorMessage.value = response.error_message || ''
    
    // 如果任务还在进行中,继续轮询
    if (response.task_status === 1 || response.task_status === 2) {
      setTimeout(pollTaskStatus, 2000) // 每2秒查询一次
    }
  } catch (error) {
    console.error('查询任务状态失败:', error)
  }
}

// 取消任务
const handleCancelTask = async () => {
  try {
    await ElMessageBox.confirm('确定要取消当前任务吗?', '提示', {
      type: 'warning'
    })
    
    await cancelTask(currentTaskId.value)
    ElMessage.success('任务已取消')
    progressDialogVisible.value = false
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('取消任务失败')
    }
  }
}

// 查看资源
const handleViewResources = () => {
  progressDialogVisible.value = false
  router.push('/resource/management')
}

// 重置表单
const handleReset = () => {
  formRef.value.resetFields()
  selectedTypes.value = []
}

onMounted(() => {
  loadStudentsAndCourses()
})
</script>

<style scoped lang="scss">
.resource-generation-container {
  padding: 20px;
}

.header-card {
  margin-bottom: 20px;
  
  .header-content {
    h2 {
      margin: 0 0 10px 0;
      font-size: 24px;
      color: #303133;
    }
    
    .subtitle {
      margin: 0;
      color: #909399;
      font-size: 14px;
    }
  }
}

.resource-types-card {
  margin-bottom: 20px;
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.resource-types-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.resource-type-card {
  position: relative;
  padding: 20px;
  border: 2px solid #DCDFE6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    border-color: #409EFF;
    box-shadow: 0 2px 12px rgba(64, 158, 255, 0.2);
  }
  
  &.active {
    border-color: #67C23A;
    background-color: #f0f9ff;
  }
  
  .type-icon {
    font-size: 32px;
    color: #409EFF;
    margin-bottom: 12px;
  }
  
  .type-info {
    h3 {
      margin: 0 0 8px 0;
      font-size: 16px;
      color: #303133;
    }
    
    p {
      margin: 0;
      font-size: 13px;
      color: #909399;
      line-height: 1.5;
    }
  }
  
  .type-check {
    position: absolute;
    top: 10px;
    right: 10px;
    font-size: 24px;
  }
}

.params-card {
  margin-bottom: 20px;
}

.action-buttons {
  text-align: center;
  padding: 20px 0;
}

.progress-content {
  padding: 20px 0;
  
  .progress-info {
    margin-top: 20px;
    
    p {
      margin: 8px 0;
      font-size: 14px;
      color: #606266;
    }
    
    .error-text {
      color: #F56C6C;
    }
  }
  
  .success-message {
    text-align: center;
    margin-top: 30px;
    
    p {
      margin-top: 16px;
      font-size: 18px;
      color: #67C23A;
      font-weight: 500;
    }
  }
  
  .error-message {
    margin-top: 20px;
  }
}
</style>
