<template>
  <div class="question-input-container">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>提出问题</span>
          <el-tag v-if="courseInfo" type="info" size="small">
            {{ courseInfo.name }}
          </el-tag>
        </div>
      </template>

      <!-- 问题文字输入 -->
      <el-input
        v-model="questionText"
        type="textarea"
        :rows="6"
        placeholder="请输入您的问题，支持详细描述..."
        maxlength="2000"
        show-word-limit
      />

      <!-- 图片上传 -->
      <div class="image-upload-section">
        <el-upload
          v-model:file-list="imageList"
          action="#"
          list-type="picture-card"
          :auto-upload="false"
          :on-change="handleImageChange"
          :on-remove="handleImageRemove"
          :limit="3"
        >
          <el-icon><Plus /></el-icon>
        </el-upload>
        <div class="upload-tip">
          <el-icon><InfoFilled /></el-icon>
          <span>支持上传图片（最多3张，单张小于 2MB）；提交时优先上传 MinIO 得到 URL，失败则自动回退为 Base64</span>
        </div>
        <div class="ocrRow">
          <el-button
            type="default"
            size="small"
            :loading="ocrLoading"
            :disabled="!imageList.length"
            @click="runOcrOnFirstImage"
          >
            识别首张图中文字
          </el-button>
          <span v-if="ocrHint" class="ocrHint">{{ ocrHint }}</span>
        </div>
      </div>

      <!-- 课程和章节选择 -->
      <div class="context-selection">
        <el-form :inline="true">
          <el-form-item label="关联课程">
            <el-select
              v-model="selectedCourse"
              placeholder="选择课程（可选）"
              clearable
              @change="handleCourseChange"
            >
              <el-option
                v-for="course in courseList"
                :key="course.id"
                :label="course.name"
                :value="course.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="关联章节" v-if="selectedCourse">
            <el-select
              v-model="selectedSection"
              placeholder="选择小节（可选）"
              clearable
              filterable
              :loading="catalogueLoading"
            >
              <el-option
                v-for="section in sectionList"
                :key="section.id"
                :label="section.name"
                :value="section.id"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <!-- 提交按钮 -->
      <div class="submit-section">
        <el-button
          type="primary"
          size="large"
          :loading="loading"
          :disabled="!questionText.trim()"
          @click="handleSubmit"
        >
          <el-icon><ChatDotRound /></el-icon>
          <span>提交问题</span>
        </el-button>
        <el-button size="large" @click="handleClear">
          清空
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { Plus, InfoFilled, ChatDotRound } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getCoursesPage, getcoursesListData } from '@/api/curriculum'
import { ocrPreview, uploadTutoringImage } from '@/api/tutoring'

const MAX_IMAGE_BYTES = 2 * 1024 * 1024

function flattenCatalogueSections(catalogueData) {
  const sections = []
  if (!Array.isArray(catalogueData)) return sections
  for (const chapter of catalogueData) {
    const chName = chapter?.name ?? ''
    const secs = chapter?.sections
    if (!Array.isArray(secs)) continue
    for (const sec of secs) {
      if (sec?.id == null) continue
      const label = chName ? `${chName} / ${sec.name ?? ''}` : (sec.name ?? '')
      sections.push({ id: sec.id, name: label.trim() || `小节 ${sec.id}` })
    }
  }
  return sections
}

function readRawAsDataUrl(raw) {
  return new Promise((resolve, reject) => {
    if (!raw) {
      resolve(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(raw)
  })
}

function pickUploadedImageUrl(res) {
  if (!res) return null
  if (res.url) return res.url
  if (res.data && typeof res.data === 'object' && res.data.url) return res.data.url
  return null
}

export default {
  name: 'QuestionInput',
  components: {
    Plus,
    InfoFilled,
    ChatDotRound
  },
  props: {
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['submit'],
  setup(props, { emit }) {
    const questionText = ref('')
    const imageList = ref([])
    const selectedCourse = ref(null)
    const selectedSection = ref(null)
    const courseList = ref([])
    const sectionList = ref([])
    const catalogueLoading = ref(false)
    const ocrLoading = ref(false)
    const ocrHint = ref('')

    const courseInfo = computed(() => {
      if (!selectedCourse.value) return null
      return courseList.value.find(c => c.id === selectedCourse.value)
    })

    // 处理图片变化（校验大小；正式 URL 在提交时用 FileReader 生成 Base64）
    const handleImageChange = (uploadFile) => {
      const raw = uploadFile?.raw
      if (raw && raw.size > MAX_IMAGE_BYTES) {
        ElMessage.warning('单张图片请小于 2MB')
        const list = imageList.value.filter((f) => f.uid !== uploadFile.uid)
        imageList.value = list
      }
    }

    // 处理图片移除
    const handleImageRemove = () => {}

    const runOcrOnFirstImage = async () => {
      ocrHint.value = ''
      const first = imageList.value[0]
      if (!first) {
        ElMessage.warning('请先上传图片')
        return
      }
      let b64 = ''
      try {
        if (first.url && String(first.url).startsWith('data:')) {
          b64 = first.url
        } else if (first.raw) {
          b64 = await readRawAsDataUrl(first.raw)
        }
      } catch (e) {
        ElMessage.error('读取图片失败')
        return
      }
      if (!b64) {
        ElMessage.warning('无法读取图片数据')
        return
      }
      ocrLoading.value = true
      try {
        const res = await ocrPreview({ image_base64: b64 })
        if (res.code !== 200) {
          ElMessage.error(res.msg || res.message || 'OCR 请求失败')
          return
        }
        const data = res.data || {}
        if (data.hint) ocrHint.value = data.hint
        const t = (data.text || '').trim()
        if (t) {
          const prefix = questionText.value.trim() ? '\n\n' : ''
          questionText.value = `${questionText.value.trim()}${prefix}[图内文字]\n${t}`
          ElMessage.success('已追加识别结果到问题描述')
        } else {
          ElMessage.info(data.hint || '未识别到文字（可安装服务端 OCR 依赖）')
        }
      } catch (e) {
        console.error(e)
        ElMessage.error(e?.message || 'OCR 失败')
      } finally {
        ocrLoading.value = false
      }
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
        ElMessage.error('加载课程列表失败')
      }
    }

    // 处理课程变化：拉取目录小节
    const handleCourseChange = async (courseId) => {
      selectedSection.value = null
      sectionList.value = []
      if (!courseId) return
      catalogueLoading.value = true
      try {
        const res = await getcoursesListData(courseId)
        if (res.code === 200 && res.data) {
          sectionList.value = flattenCatalogueSections(res.data)
          if (sectionList.value.length === 0) {
            ElMessage.warning('该课程暂无小节目录')
          }
        } else {
          ElMessage.error(res.msg || res.message || '加载课程目录失败')
        }
      } catch (e) {
        console.error(e)
        ElMessage.error('加载章节失败')
      } finally {
        catalogueLoading.value = false
      }
    }

    // 提交问题
    const handleSubmit = async () => {
      if (!questionText.value.trim()) {
        ElMessage.warning('请输入问题内容')
        return
      }

      const urls = []
      try {
        for (const img of imageList.value) {
          const href = img.url && String(img.url)
          if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
            urls.push(href)
            continue
          }
          if (href && href.startsWith('data:')) {
            urls.push(href)
            continue
          }
          if (img.raw) {
            let pushed = false
            try {
              const up = await uploadTutoringImage(img.raw)
              const u = pickUploadedImageUrl(up)
              if (u) {
                urls.push(u)
                pushed = true
              }
            } catch (e) {
              console.warn('tutoring image upload fallback to base64', e)
            }
            if (!pushed) {
              const dataUrl = await readRawAsDataUrl(img.raw)
              if (dataUrl) urls.push(dataUrl)
            }
          }
        }
      } catch (e) {
        ElMessage.error('处理图片失败，请重试')
        return
      }

      const questionData = {
        question_text: questionText.value.trim(),
        question_images: urls.length ? urls : null,
        course_id: selectedCourse.value,
        section_id: selectedSection.value
      }

      emit('submit', questionData)
    }

    // 清空表单
    const handleClear = () => {
      questionText.value = ''
      imageList.value = []
      selectedCourse.value = null
      selectedSection.value = null
      sectionList.value = []
    }

    onMounted(() => {
      loadCourses()
    })

    return {
      questionText,
      imageList,
      selectedCourse,
      selectedSection,
      courseList,
      sectionList,
      catalogueLoading,
      courseInfo,
      handleImageChange,
      handleImageRemove,
      handleCourseChange,
      handleSubmit,
      handleClear,
      ocrLoading,
      ocrHint,
      runOcrOnFirstImage
    }
  }
}
</script>

<style scoped>
.question-input-container {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.image-upload-section {
  margin-top: 20px;
}

.upload-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  color: #909399;
  font-size: 14px;
}

.ocrRow {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.ocrHint {
  font-size: 12px;
  color: #909399;
  max-width: 480px;
  line-height: 1.4;
}

.context-selection {
  margin-top: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
}

.submit-section {
  margin-top: 20px;
  text-align: center;
}

.submit-section .el-button {
  min-width: 150px;
}
</style>
