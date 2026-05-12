import request from '@/utils/request'

/**
 * 学习路径管理API
 */

// 创建学习路径
export function createLearningPath(data) {
  return request({
    url: '/learning/path/create',
    method: 'post',
    data
  })
}

// 获取路径详情
export function getPathDetail(pathId) {
  return request({
    url: `/learning/path/${pathId}`,
    method: 'get'
  })
}

// 激活学习路径
export function activatePath(pathId) {
  return request({
    url: `/learning/path/${pathId}/activate`,
    method: 'post'
  })
}

// 确认规划并激活（与 activate 等价）
export function confirmPath(pathId) {
  return request({
    url: `/learning/path/${pathId}/confirm`,
    method: 'post'
  })
}

// 查询我的学习路径
export function queryMyPaths() {
  return request({
    url: '/learning/path/my',
    method: 'get'
  })
}

// 查询当前进行中的路径
export function queryCurrentPath() {
  return request({
    url: '/learning/path/current',
    method: 'get'
  })
}

// 查询路径进度
export function queryPathProgress(pathId) {
  return request({
    url: `/learning/path/${pathId}/progress`,
    method: 'get'
  })
}

// 暂停学习路径
export function pausePath(pathId) {
  return request({
    url: `/learning/path/${pathId}/pause`,
    method: 'post'
  })
}

// 恢复学习路径
export function resumePath(pathId) {
  return request({
    url: `/learning/path/${pathId}/resume`,
    method: 'post'
  })
}

// 完成学习路径
export function completePath(pathId) {
  return request({
    url: `/learning/path/${pathId}/complete`,
    method: 'post'
  })
}

// 查询路径的所有节点
export function queryPathNodes(pathId) {
  return request({
    url: `/learning/node/path/${pathId}`,
    method: 'get'
  })
}

// 获取节点详情
export function getNodeDetail(nodeId) {
  return request({
    url: `/learning/node/${nodeId}`,
    method: 'get'
  })
}

// 开始学习节点
export function startNode(nodeId) {
  return request({
    url: `/learning/node/${nodeId}/start`,
    method: 'post'
  })
}

// 完成节点
export function completeNode(nodeId) {
  return request({
    url: `/learning/node/${nodeId}/complete`,
    method: 'post'
  })
}

// 暂缓节点
export function pauseNode(nodeId, reason) {
  return request({
    url: `/learning/node/${nodeId}/pause`,
    method: 'post',
    params: { reason }
  })
}

// 跳过节点
export function skipNode(nodeId, reason) {
  return request({
    url: `/learning/node/${nodeId}/skip`,
    method: 'post',
    params: { reason }
  })
}

// 重做节点
export function redoNode(nodeId) {
  return request({
    url: `/learning/node/${nodeId}/redo`,
    method: 'post'
  })
}

// 查询下一个节点
export function getNextNode(nodeId) {
  return request({
    url: `/learning/node/${nodeId}/next`,
    method: 'get'
  })
}

// 上报节点学习进度流水
export function recordLearningProgress(data) {
  return request({
    url: '/learning/progress/record',
    method: 'post',
    data
  })
}

// 路径维度进度流水
export function listProgressByPath(pathId) {
  return request({
    url: `/learning/progress/path/${pathId}`,
    method: 'get'
  })
}

// 节点维度进度流水
export function listProgressByNode(nodeId) {
  return request({
    url: `/learning/progress/node/${nodeId}`,
    method: 'get'
  })
}
