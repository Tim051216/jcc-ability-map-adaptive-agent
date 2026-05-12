/**
 * 智能辅导 API
 */
import { USER_KEY } from '@/config/global'
import request from '@/utils/request.js'

function tutoringHeaders() {
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    if (!raw) return {}
    const u = JSON.parse(raw)
    const id = u.userId ?? u.id
    if (id == null || id === '') return {}
    return { 'X-User-Id': String(id) }
  } catch {
    return {}
  }
}

/**
 * 提交问题
 * @param {Object} data - 问题数据
 * @param {string} data.question_text - 问题文字
 * @param {Array<string>} data.question_images - 问题图片URL列表
 * @param {number} data.course_id - 课程ID
 * @param {number} data.section_id - 章节ID
 * @param {number} data.session_id - 会话ID（可选）
 */
/**
 * 图片 OCR 预览（可选依赖服务端 Pillow+Tesseract）
 * @param {{ image_base64: string }} data
 */
export function ocrPreview(data) {
  return request({
    url: '/ai/api/v1/tutoring/ocr-preview',
    method: 'post',
    data,
    headers: { ...tutoringHeaders() },
  })
}

/**
 * 辅导配图上传至 AI 侧 MinIO，返回 URL 写入 question_images
 * @param {File|Blob} file
 */
export function uploadTutoringImage(file) {
  const fd = new FormData()
  fd.append('file', file)
  return request({
    url: '/ai/api/v1/tutoring/upload-image',
    method: 'post',
    data: fd,
    headers: { ...tutoringHeaders() },
  })
}

export function submitQuestion(data) {
  return request({
    url: '/ai/api/v1/tutoring/question',
    method: 'post',
    data,
    headers: { ...tutoringHeaders() },
  })
}

/**
 * 获取解答
 * @param {number} questionId - 问题ID
 */
export function getAnswer(questionId) {
  return request({
    url: `/ai/api/v1/tutoring/answer/${questionId}`,
    method: 'get',
    headers: { ...tutoringHeaders() },
  })
}

/**
 * 查询答疑历史
 * @param {Object} params - 查询参数
 * @param {number} params.course_id - 课程ID
 * @param {number} params.section_id - 章节ID
 * @param {string} params.question_type - 问题类型
 * @param {string} params.keyword - 关键词（问题或解答正文）
 * @param {string} [params.start_date] - 创建时间起 ISO8601，如 2026-05-01T00:00:00
 * @param {string} [params.end_date] - 创建时间止；仅日期 00:00:00 时服务端按含当日处理
 * @param {number} params.page - 页码
 * @param {number} params.page_size - 每页数量
 */
export function getTutoringHistory(params) {
  return request({
    url: '/ai/api/v1/tutoring/history',
    method: 'get',
    params,
    headers: { ...tutoringHeaders() },
  })
}

/**
 * 评价解答
 * @param {Object} data - 评价数据
 * @param {number} data.answer_id - 解答ID
 * @param {boolean} data.is_helpful - 是否有帮助
 * @param {number} data.user_rating - 用户评分（1-5星）
 * @param {string} data.user_feedback - 用户反馈
 */
export function evaluateAnswer(data) {
  return request({
    url: '/ai/api/v1/tutoring/evaluate',
    method: 'post',
    data,
    headers: { ...tutoringHeaders() },
  })
}

/**
 * 升级问题到人工
 * @param {Object} data - 升级数据
 * @param {number} data.question_id - 问题ID
 * @param {number} data.escalation_reason - 升级原因
 */
export function escalateQuestion(data) {
  return request({
    url: '/ai/api/v1/tutoring/escalate',
    method: 'post',
    data,
    headers: { ...tutoringHeaders() },
  })
}

/**
 * 收藏答疑记录
 * @param {number} questionId - 问题ID
 * @param {number} answerId - 解答ID
 * @param {string} note - 收藏备注
 */
export function addFavorite(questionId, answerId, note) {
  return request({
    url: '/ai/api/v1/tutoring/favorite',
    method: 'post',
    params: {
      question_id: questionId,
      answer_id: answerId,
      note
    },
    headers: { ...tutoringHeaders() },
  })
}

/**
 * 取消收藏
 * @param {number} questionId - 问题ID
 */
export function removeFavorite(questionId) {
  return request({
    url: `/ai/api/v1/tutoring/favorite/${questionId}`,
    method: 'delete',
    headers: { ...tutoringHeaders() },
  })
}

/**
 * 辅导生成 WebSocket URL（与 REST 相同网关前缀 /api/ai）
 * @param {number} questionId
 * @param {number|string} userId
 */
export function getTutoringStreamUrl(questionId, userId) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  const q = encodeURIComponent(String(userId))
  return `${proto}//${host}/api/ai/api/v1/tutoring/stream/${questionId}?user_id=${q}`
}
