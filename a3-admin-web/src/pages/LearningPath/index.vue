<template>
  <div class="learning-path-container">
    <!-- 路径概览 -->
    <div class="path-overview">
      <el-card>
        <template #header>
          <div class="card-header">
            <span>我的学习路径</span>
            <el-button type="primary" @click="handleCreatePath">创建新路径</el-button>
          </div>
        </template>
        
        <!-- 当前路径 -->
        <div v-if="!currentPath" class="current-path-empty">
          <el-empty description="暂无进行中的学习路径，请点击「创建新路径」或通过下方流程开始。" />
        </div>
        <div v-if="currentPath" class="current-path">
          <h3>{{ currentPath.pathName }}</h3>
          <el-progress 
            :percentage="currentPath.progressPercentage" 
            :color="progressColor"
          />
          <div class="path-stats">
            <span>已完成: {{ currentPath.completedNodes }}/{{ currentPath.totalNodes }} 节点</span>
            <span>预估时长: {{ currentPath.estimatedDuration ?? '—' }} 分钟</span>
            <span>实际时长: {{ currentPath.actualDuration ?? '—' }} 分钟</span>
          </div>
          <div v-if="stageProgressSummary.length" class="stage-progress">
            <span class="stage-label">阶段进度</span>
            <div class="stage-bars">
              <div v-for="(s, idx) in stageProgressSummary" :key="idx" class="stage-item">
                <span class="stage-name">{{ s.label }}</span>
                <el-progress
                  :percentage="s.total ? Math.round((s.done / s.total) * 100) : 0"
                  :stroke-width="10"
                  style="width: 140px"
                />
                <span class="stage-count">{{ s.done }}/{{ s.total }}</span>
              </div>
            </div>
          </div>
          <div v-if="weakKnowledgeHints.length" class="weak-kp">
            <span class="weak-label">关注知识点</span>
            <div class="weak-tags">
              <el-tag
                v-for="(kp, i) in weakKnowledgeHints"
                :key="`${kp}-${i}`"
                type="warning"
                effect="plain"
                size="small"
              >
                {{ kp }}
              </el-tag>
            </div>
            <p class="weak-hint">结合目标路径与未完成的练习/测评节点生成提示，便于巩固薄弱环节。</p>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 路径流程图 -->
    <div class="path-flowchart">
      <el-card>
        <template #header>
          <span>学习路径流程</span>
        </template>
        
        <div class="nodes-container">
          <div 
            v-for="node in pathNodes" 
            :key="node.id"
            class="node-item"
            :class="getNodeClass(node)"
            @click="handleNodeClick(node)"
          >
            <div class="node-order">
              {{ node.nodeOrder }}
              <el-tag v-if="isPathCurrentNode(node)" type="primary" size="small" class="current-badge">当前</el-tag>
            </div>
            <div class="node-content">
              <div class="node-name">{{ node.nodeName }}</div>
              <div class="node-type">{{ getNodeTypeName(node.nodeType) }}</div>
              <div class="node-progress">
                <el-progress 
                  :percentage="node.progressPercentage" 
                  :width="50"
                  type="circle"
                />
              </div>
            </div>
            <div class="node-status">
              <el-tag :type="getStatusType(node.status)">
                {{ getStatusName(node.status) }}
              </el-tag>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 节点详情对话框 -->
    <el-dialog 
      v-model="nodeDialogVisible" 
      :title="selectedNode?.nodeName"
      width="60%"
    >
      <div v-if="selectedNode" class="node-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="节点类型">
            {{ getNodeTypeName(selectedNode.nodeType) }}
          </el-descriptions-item>
          <el-descriptions-item label="阶段类型">
            {{ getStageTypeName(selectedNode.stageType) }}
          </el-descriptions-item>
          <el-descriptions-item label="难度等级">
            <el-rate v-model="selectedNode.difficultyLevel" disabled />
          </el-descriptions-item>
          <el-descriptions-item label="预估时长">
            {{ selectedNode.estimatedDuration }} 分钟
          </el-descriptions-item>
          <el-descriptions-item label="节点描述" :span="2">
            {{ selectedNode.nodeDesc }}
          </el-descriptions-item>
          <el-descriptions-item label="关联知识点" :span="2">
            <template v-if="parseKnowledgePointsJson(selectedNode.knowledgePoints).length">
              <el-tag
                v-for="(kp, i) in parseKnowledgePointsJson(selectedNode.knowledgePoints)"
                :key="i"
                size="small"
                class="kp-tag"
              >
                {{ kp }}
              </el-tag>
            </template>
            <span v-else>—</span>
          </el-descriptions-item>
          <el-descriptions-item label="完成条件" :span="2">
            <pre class="completion-pre">{{ formatCompletionCriteria(selectedNode.completionCriteria) }}</pre>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 节点资源 -->
        <div class="node-resources">
          <h4>学习资源</h4>
          <el-table :data="selectedNode.resources || []" style="width: 100%">
            <el-table-column prop="resourceName" label="资源名称" />
            <el-table-column prop="resourceType" label="资源类型" />
            <el-table-column prop="estimatedDuration" label="预估时长(分钟)" />
            <el-table-column label="操作">
              <template #default="scope">
                <el-button size="small" @click="handleStartResource(scope.row)">
                  开始学习
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 节点操作 -->
        <div class="node-actions">
          <el-button 
            v-if="selectedNode.status === 0" 
            type="primary" 
            @click="handleStartNode"
          >
            开始学习
          </el-button>
          <el-button 
            v-if="selectedNode.status === 1" 
            type="success" 
            @click="handleCompleteNode"
          >
            标记完成
          </el-button>
          <el-button 
            v-if="selectedNode.status === 1" 
            @click="handlePauseNode"
          >
            暂缓
          </el-button>
          <el-button 
            v-if="selectedNode.status === 1" 
            @click="handleSkipNode"
          >
            跳过
          </el-button>
          <el-button 
            v-if="selectedNode.status === 2" 
            @click="handleRedoNode"
          >
            重做
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 创建路径 -->
    <el-dialog v-model="createDialogVisible" title="创建学习路径" width="520px" destroy-on-close>
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="路径名称" prop="pathName">
          <el-input v-model="createForm.pathName" placeholder="例如：本学期课程递进计划" maxlength="128" show-word-limit />
        </el-form-item>
        <el-form-item label="目标课程ID" prop="targetCourseId">
          <el-input-number v-model="createForm.targetCourseId" :min="1" :controls="true" style="width: 100%" />
        </el-form-item>
        <el-form-item label="路径描述">
          <el-input v-model="createForm.pathDesc" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
        <el-form-item label="目标知识点">
          <el-input
            v-model="createForm.knowledgePointsRaw"
            type="textarea"
            :rows="2"
            placeholder="可选，逗号分隔，如：梯度下降, 正则化"
          />
        </el-form-item>
        <el-form-item label="生成演示节点">
          <el-switch v-model="createForm.seedDemoNodes" active-text="是" inactive-text="否" />
        </el-form-item>
        <el-form-item label="创建后激活">
          <el-switch v-model="createForm.activateAfterCreate" active-text="是" inactive-text="否" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="createSubmitting" @click="submitCreatePath">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  queryCurrentPath,
  queryPathNodes,
  getNodeDetail,
  startNode,
  completeNode,
  pauseNode,
  skipNode,
  redoNode,
  createLearningPath,
  confirmPath,
  recordLearningProgress,
} from '@/api/learningPath'

// 数据
const currentPath = ref(null)
const pathNodes = ref([])
const selectedNode = ref(null)
const nodeDialogVisible = ref(false)

const createDialogVisible = ref(false)
const createSubmitting = ref(false)
const createFormRef = ref(null)
const createForm = reactive({
  pathName: '',
  targetCourseId: null,
  pathDesc: '',
  knowledgePointsRaw: '',
  seedDemoNodes: true,
  activateAfterCreate: true,
})
const createRules = {
  pathName: [{ required: true, message: '请输入路径名称', trigger: 'blur' }],
  targetCourseId: [{ required: true, message: '请输入目标课程 ID', trigger: 'change' }],
}

// 计算属性
const progressColor = computed(() => {
  const percentage = currentPath.value?.progressPercentage || 0
  if (percentage < 30) return '#f56c6c'
  if (percentage < 70) return '#e6a23c'
  return '#67c23a'
})

const STAGE_NAMES = { 1: '基础阶段', 2: '进阶阶段', 3: '高级阶段', 4: '综合阶段' }

const stageProgressSummary = computed(() => {
  const nodes = pathNodes.value || []
  const m = new Map()
  for (const n of nodes) {
    const st = n.stageType || 1
    if (!m.has(st)) {
      m.set(st, { done: 0, total: 0, label: STAGE_NAMES[st] || `阶段 ${st}` })
    }
    const o = m.get(st)
    o.total += 1
    if (n.status === 2 || n.status === 3) o.done += 1
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
})

const parseKnowledgePointsJson = (raw) => {
  if (!raw || !String(raw).trim()) return []
  try {
    const a = JSON.parse(raw)
    return Array.isArray(a) ? a.map((x) => String(x)) : [String(a)]
  } catch {
    return [String(raw)]
  }
}

const weakKnowledgeHints = computed(() => {
  const out = []
  const seen = new Set()
  const push = (s) => {
    const t = String(s).trim()
    if (t && !seen.has(t)) {
      seen.add(t)
      out.push(t)
    }
  }
  ;(currentPath.value?.targetKnowledgePoints || []).forEach(push)
  for (const n of pathNodes.value || []) {
    if (![0, 1, 4].includes(n.status)) continue
    if (n.nodeType !== 2 && n.nodeType !== 3) continue
    parseKnowledgePointsJson(n.knowledgePoints).forEach(push)
  }
  return out.slice(0, 12)
})

const formatCompletionCriteria = (raw) => {
  if (!raw || !String(raw).trim()) return '—'
  try {
    const o = JSON.parse(raw)
    return JSON.stringify(o, null, 2)
  } catch {
    return String(raw)
  }
}

const isPathCurrentNode = (node) => {
  const cid = currentPath.value?.currentNodeId
  return cid != null && node?.id === cid
}

// 方法
const loadCurrentPath = async () => {
  try {
    const res = await queryCurrentPath()
    if (res.code === 200) {
      currentPath.value = res.data
      if (res.data?.id) {
        await loadPathNodes(res.data.id)
      } else {
        pathNodes.value = []
      }
    }
  } catch (error) {
    console.error('加载路径失败:', error)
  }
}

const loadPathNodes = async (pathId) => {
  try {
    const res = await queryPathNodes(pathId)
    if (res.code === 200) {
      pathNodes.value = res.data
    }
  } catch (error) {
    console.error('加载节点失败:', error)
  }
}

const handleNodeClick = async (node) => {
  try {
    const res = await getNodeDetail(node.id)
    if (res.code === 200) {
      selectedNode.value = res.data
      nodeDialogVisible.value = true
    }
  } catch (error) {
    console.error('加载节点详情失败:', error)
  }
}

const handleStartNode = async () => {
  const pathId = selectedNode.value.pathId
  const nodeId = selectedNode.value.id
  try {
    const res = await startNode(nodeId)
    if (res.code === 200) {
      await recordProgressSilent(pathId, nodeId, 1)
      ElMessage.success('开始学习')
      nodeDialogVisible.value = false
      await loadCurrentPath()
    }
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const handleCompleteNode = async () => {
  const pathId = selectedNode.value.pathId
  const nodeId = selectedNode.value.id
  try {
    const res = await completeNode(nodeId)
    if (res.code === 200) {
      await recordProgressSilent(pathId, nodeId, 3)
      ElMessage.success('节点已完成')
      nodeDialogVisible.value = false
      await loadCurrentPath()
    }
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const handlePauseNode = async () => {
  const pathId = selectedNode.value.pathId
  const nodeId = selectedNode.value.id
  try {
    const res = await pauseNode(nodeId, '暂时暂缓')
    if (res.code === 200) {
      await recordProgressSilent(pathId, nodeId, 4)
      ElMessage.success('节点已暂缓')
      nodeDialogVisible.value = false
      await loadCurrentPath()
    }
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const handleSkipNode = async () => {
  const pathId = selectedNode.value.pathId
  const nodeId = selectedNode.value.id
  try {
    const res = await skipNode(nodeId, '跳过此节点')
    if (res.code === 200) {
      await recordProgressSilent(pathId, nodeId, 5)
      ElMessage.success('节点已跳过')
      nodeDialogVisible.value = false
      await loadCurrentPath()
    }
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const handleRedoNode = async () => {
  try {
    const res = await redoNode(selectedNode.value.id)
    if (res.code === 200) {
      ElMessage.success('节点已重置')
      nodeDialogVisible.value = false
      await loadCurrentPath()
    }
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const parseKnowledgePoints = (raw) => {
  if (!raw || !String(raw).trim()) return undefined
  return String(raw)
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const recordProgressSilent = async (pathId, nodeId, progressType, progressData = null) => {
  if (!pathId || !nodeId) return
  try {
    await recordLearningProgress({
      pathId,
      nodeId,
      progressType,
      progressData,
    })
  } catch (_) {
    /* 流水失败不阻断主流程 */
  }
}

const handleCreatePath = () => {
  createForm.pathName = ''
  createForm.targetCourseId = null
  createForm.pathDesc = ''
  createForm.knowledgePointsRaw = ''
  createForm.seedDemoNodes = true
  createForm.activateAfterCreate = true
  createDialogVisible.value = true
}

const submitCreatePath = async () => {
  if (!createFormRef.value) return
  try {
    await createFormRef.value.validate()
  } catch {
    return
  }
  createSubmitting.value = true
  try {
    const payload = {
      pathName: createForm.pathName.trim(),
      targetCourseId: createForm.targetCourseId,
      pathDesc: createForm.pathDesc?.trim() || undefined,
      targetKnowledgePoints: parseKnowledgePoints(createForm.knowledgePointsRaw),
      seedDemoNodes: createForm.seedDemoNodes,
      pathType: 1,
    }
    const res = await createLearningPath(payload)
    if (res.code !== 200) {
      ElMessage.error(res.msg || '创建失败')
      return
    }
    const pathId = res.data
    if (createForm.activateAfterCreate && pathId) {
      await confirmPath(pathId)
    }
    ElMessage.success('创建成功')
    createDialogVisible.value = false
    await loadCurrentPath()
  } catch (error) {
    ElMessage.error('创建路径失败')
  } finally {
    createSubmitting.value = false
  }
}

const handleStartResource = (resource) => {
  ElMessage.info(`开始学习: ${resource.resourceName}`)
}

// 辅助方法
const getNodeClass = (node) => {
  return {
    'node-locked': node.isLocked,
    'node-current': node.status === 1,
    'node-completed': node.status === 2,
    'node-skipped': node.status === 3,
    'node-path-focus': isPathCurrentNode(node),
  }
}

const getNodeTypeName = (type) => {
  const types = {
    1: '学习节点',
    2: '练习节点',
    3: '测评节点',
    4: '复习节点'
  }
  return types[type] || '未知'
}

const getStageTypeName = (type) => {
  const stages = {
    1: '基础阶段',
    2: '进阶阶段',
    3: '高级阶段',
    4: '综合阶段'
  }
  return stages[type] || '未知'
}

const getStatusName = (status) => {
  const statuses = {
    0: '未开始',
    1: '进行中',
    2: '已完成',
    3: '已跳过',
    4: '已暂缓'
  }
  return statuses[status] || '未知'
}

const getStatusType = (status) => {
  const types = {
    0: 'info',
    1: 'warning',
    2: 'success',
    3: 'info',
    4: 'warning'
  }
  return types[status] || 'info'
}

// 生命周期
onMounted(() => {
  loadCurrentPath()
})
</script>

<style scoped lang="scss">
.learning-path-container {
  padding: 20px;

  .path-overview {
    margin-bottom: 20px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .current-path-empty {
      padding: 8px 0;
    }

    .current-path {
      h3 {
        margin-bottom: 15px;
      }

      .path-stats {
        display: flex;
        justify-content: space-around;
        margin-top: 15px;
        
        span {
          color: #606266;
        }
      }

      .stage-progress {
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid #ebeef5;

        .stage-label {
          display: block;
          font-size: 13px;
          color: #909399;
          margin-bottom: 8px;
        }

        .stage-bars {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 20px;
        }

        .stage-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #606266;

          .stage-name {
            min-width: 72px;
          }

          .stage-count {
            min-width: 36px;
            text-align: right;
          }
        }
      }

      .weak-kp {
        margin-top: 12px;

        .weak-label {
          display: block;
          font-size: 13px;
          color: #909399;
          margin-bottom: 6px;
        }

        .weak-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .weak-hint {
          margin: 8px 0 0;
          font-size: 12px;
          color: #909399;
          line-height: 1.5;
        }
      }
    }
  }

  .path-flowchart {
    .nodes-container {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;

      .node-item {
        width: 200px;
        padding: 15px;
        border: 2px solid #dcdfe6;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s;

        &:hover {
          border-color: #409eff;
          box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
        }

        &.node-locked {
          opacity: 0.5;
          cursor: not-allowed;
        }

        &.node-current {
          border-color: #e6a23c;
          background-color: #fdf6ec;
        }

        &.node-completed {
          border-color: #67c23a;
          background-color: #f0f9ff;
        }

        &.node-skipped {
          border-style: dashed;
          opacity: 0.85;
        }

        &.node-path-focus {
          box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.35);
        }

        .node-order {
          font-size: 24px;
          font-weight: bold;
          color: #409eff;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;

          .current-badge {
            font-size: 11px;
          }
        }

        .node-content {
          .node-name {
            font-size: 16px;
            font-weight: 500;
            margin-bottom: 5px;
          }

          .node-type {
            font-size: 12px;
            color: #909399;
            margin-bottom: 10px;
          }

          .node-progress {
            display: flex;
            justify-content: center;
          }
        }

        .node-status {
          margin-top: 10px;
          text-align: center;
        }
      }
    }
  }

  .node-detail {
    .node-resources {
      margin-top: 20px;

      h4 {
        margin-bottom: 10px;
      }
    }

    .node-actions {
      margin-top: 20px;
      text-align: right;
    }

    .kp-tag {
      margin-right: 6px;
      margin-bottom: 4px;
    }

    .completion-pre {
      margin: 0;
      padding: 8px 10px;
      background: #f5f7fa;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }
  }
}
</style>
