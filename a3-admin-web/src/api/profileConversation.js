/**
 * 对话式学习画像 API（Python AI 服务）
 */
import request from '@/utils/request'

const BASE = '/ai/api/v1/profile/conversation'

export function startProfileConversation(data) {
  return request({
    url: `${BASE}/start`,
    method: 'post',
    data,
  })
}

export function sendProfileMessage(data) {
  return request({
    url: `${BASE}/message`,
    method: 'post',
    data,
  })
}

export function completeProfileConversation(data) {
  return request({
    url: `${BASE}/complete`,
    method: 'post',
    data,
  })
}

export function getProfileConversationSession(sessionId) {
  return request({
    url: `${BASE}/session/${sessionId}`,
    method: 'get',
  })
}

export function getStudentProfile(userId) {
  return request({
    url: `${BASE}/profile/${userId}`,
    method: 'get',
  })
}

export function getStudentProfileSummary(userId) {
  return request({
    url: `${BASE}/profile/${userId}/summary`,
    method: 'get',
  })
}

export function getStudentProfileHistory(userId, limit = 20) {
  return request({
    url: `${BASE}/profile/${userId}/history`,
    method: 'get',
    params: { limit },
  })
}

export function adjustStudentProfile(userId, data) {
  return request({
    url: `${BASE}/profile/${userId}/adjust`,
    method: 'put',
    data: { ...data, user_id: userId },
  })
}

export function reportLearningBehavior(data) {
  return request({
    url: `${BASE}/behavior`,
    method: 'post',
    data,
  })
}
