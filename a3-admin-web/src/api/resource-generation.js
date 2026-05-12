import request from '@/utils/request'
import { USER_KEY } from '@/config/global'

function getCurrentUserId() {
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    const user = raw ? JSON.parse(raw) : null
    return user?.id || user?.userId || user?.adminUserId || undefined
  } catch (_error) {
    return undefined
  }
}

function withUserId(payload = {}, key = 'user_id') {
  const userId = getCurrentUserId()
  if (payload[key] || !userId) {
    return payload
  }
  return {
    ...payload,
    [key]: userId
  }
}

function normalizeResource(resource = {}) {
  const title = resource.title || resource.resource_name || ''
  const content =
    resource.content ||
    resource.document?.content_markdown ||
    resource.mindmap?.mermaid_code ||
    resource.code_example?.code ||
    ''

  return {
    ...resource,
    resource_id: resource.resource_id || resource.id,
    title,
    resource_title: resource.resource_title || title,
    description: resource.description || resource.summary || resource.resource_description || title,
    resource_description: resource.resource_description || resource.description || resource.summary || '',
    created_at: resource.created_at || resource.create_time,
    resource_created_at: resource.resource_created_at || resource.create_time,
    student_name: resource.student_name || `学生${resource.student_id || ''}`,
    course_name: resource.course_name || `课程${resource.course_id || ''}`,
    knowledge_point_name: resource.knowledge_point_name || `知识点${resource.knowledge_point_id || ''}`,
    is_favorited: resource.is_favorited ?? resource.favorite_count > 0,
    content
  }
}

function normalizeResourceList(response = {}) {
  return {
    ...response,
    items: (response.items || []).map(normalizeResource)
  }
}

function normalizeFavoriteItem(item = {}) {
  const normalized = normalizeResource(item)
  return {
    ...normalized,
    favorited_at: item.favorited_at || item.create_time,
    category: item.category || '默认分类',
    notes: item.notes || ''
  }
}

function normalizeFavoriteList(response = {}) {
  return {
    ...response,
    items: (response.items || []).map(normalizeFavoriteItem)
  }
}

export function createGenerationTask(data) {
  return request({
    url: '/resource/generation/tasks',
    method: 'post',
    data
  })
}

export function getTaskStatus(taskId) {
  return request({
    url: `/resource/generation/tasks/${taskId}`,
    method: 'get'
  })
}

export function listTasks(params) {
  return request({
    url: '/resource/generation/tasks',
    method: 'get',
    params
  })
}

export function cancelTask(taskId) {
  return request({
    url: `/resource/generation/tasks/${taskId}`,
    method: 'delete'
  })
}

export async function queryResources(params = {}) {
  const response = await request({
    url: '/resource/v2/list',
    method: 'get',
    params: withUserId(params, 'student_id')
  })
  return normalizeResourceList(response)
}

export function getResourceList(params) {
  return queryResources(params)
}

export async function getResourceDetail(resourceId) {
  const response = await request({
    url: `/resource/v2/${resourceId}/detail`,
    method: 'get'
  })
  return normalizeResource(response)
}

export async function searchResources(params = {}) {
  const response = await request({
    url: '/resource/v2/search',
    method: 'get',
    params: withUserId(params, 'student_id')
  })
  return normalizeResourceList(response)
}

export function addFavorite(data = {}) {
  return request({
    url: '/resource/v2/favorites',
    method: 'post',
    data: withUserId(data)
  })
}

export function removeFavorite(payload) {
  const normalized =
    typeof payload === 'object' && payload !== null
      ? payload
      : { resource_id: payload }

  return request({
    url: '/resource/v2/favorites',
    method: 'delete',
    params: withUserId(normalized)
  })
}

export async function listFavorites(params = {}) {
  const response = await request({
    url: '/resource/v2/favorites/list',
    method: 'get',
    params: withUserId(params)
  })
  return normalizeFavoriteList(response)
}

export function getFavoriteList(params) {
  return listFavorites(params)
}

export function updateFavorite(resourceId, data = {}) {
  return request({
    url: `/resource/v2/favorites/${resourceId}`,
    method: 'put',
    data: withUserId(data)
  })
}

export async function getFavoriteCategories(userId) {
  return request({
    url: '/resource/v2/favorites/categories',
    method: 'get',
    params: { user_id: userId || getCurrentUserId() }
  })
}

export function generateDownloadUrl(resourceId, params = {}) {
  return request({
    url: `/resource/v2/${resourceId}/download`,
    method: 'get',
    params: withUserId(params)
  })
}

export function downloadResource(resourceId, params) {
  return generateDownloadUrl(resourceId, params)
}

export function batchDownload(data = {}) {
  return request({
    url: '/resource/v2/batch-download',
    method: 'post',
    data: withUserId(data)
  })
}

export function deleteResource(resourceId, params = {}) {
  return request({
    url: `/resource/v2/${resourceId}`,
    method: 'delete',
    params: withUserId(params)
  })
}

export function getResourceStatistics(studentId) {
  return request({
    url: '/resource/v2/statistics',
    method: 'get',
    params: { student_id: studentId || getCurrentUserId() }
  })
}
