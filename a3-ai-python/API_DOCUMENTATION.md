# 多智能体资源生成系统 API 文档

## 概述

本文档描述了多智能体协同资源生成系统的 RESTful API 接口。

**Base URL**: `http://localhost:8000/api/v1`

**认证方式**: Bearer Token (待实现)

## API 分类

### 1. 资源生成 API (任务11)

#### 1.1 创建资源生成任务

**接口**: `POST /resource/generation/tasks`

**描述**: 创建一个新的资源生成任务,系统将异步生成指定类型的学习资源

**请求体**:
```json
{
  "task_name": "Python基础知识资源生成",
  "student_id": 1001,
  "resource_types": [1, 2, 3],
  "knowledge_point_id": 101,
  "course_id": 1,
  "chapter_id": 10,
  "section_id": 100,
  "generation_params": {
    "difficulty_level": 1,
    "programming_language": "Python"
  }
}
```

**参数说明**:
- `task_name`: 任务名称
- `student_id`: 学生ID
- `resource_types`: 资源类型列表
  - 1: 课程讲解文档
  - 2: 知识点思维导图
  - 3: 分层练习题库
  - 4: 教学视频/动画
  - 5: 代码实操案例
- `knowledge_point_id`: 知识点ID
- `course_id`: 课程ID
- `chapter_id`: 章节ID (可选)
- `section_id`: 小节ID (可选)
- `generation_params`: 生成参数 (可选)

**响应**:
```json
{
  "id": 1,
  "task_name": "Python基础知识资源生成",
  "student_id": 1001,
  "resource_types": "1,2,3",
  "knowledge_point_id": 101,
  "course_id": 1,
  "task_status": 1,
  "progress": 0,
  "total_resources": 3,
  "completed_resources": 0,
  "failed_resources": 0,
  "create_time": "2024-01-01T10:00:00",
  "update_time": "2024-01-01T10:00:00"
}
```

**状态码**:
- 200: 成功
- 400: 参数错误
- 500: 服务器错误

---

#### 1.2 查询任务状态

**接口**: `GET /resource/generation/tasks/{task_id}`

**描述**: 查询资源生成任务的状态和进度

**路径参数**:
- `task_id`: 任务ID

**响应**:
```json
{
  "id": 1,
  "task_name": "Python基础知识资源生成",
  "task_status": 2,
  "progress": 65,
  "total_resources": 3,
  "completed_resources": 2,
  "failed_resources": 0,
  "start_time": "2024-01-01T10:00:05",
  "end_time": null,
  "error_message": null
}
```

**任务状态**:
- 1: 待处理
- 2: 处理中
- 3: 已完成
- 4: 部分失败
- 5: 全部失败

---

#### 1.3 查询任务列表

**接口**: `GET /resource/generation/tasks`

**描述**: 查询资源生成任务列表,支持筛选和分页

**查询参数**:
- `student_id`: 学生ID (可选)
- `status`: 任务状态 (可选)
- `page`: 页码 (默认1)
- `page_size`: 每页数量 (默认20,最大100)

**响应**:
```json
{
  "items": [
    {
      "id": 1,
      "task_name": "Python基础知识资源生成",
      "task_status": 3,
      "progress": 100,
      "create_time": "2024-01-01T10:00:00"
    }
  ],
  "total": 10,
  "page": 1,
  "page_size": 20,
  "total_pages": 1
}
```

---

#### 1.4 取消任务

**接口**: `DELETE /resource/generation/tasks/{task_id}`

**描述**: 取消正在进行的资源生成任务

**路径参数**:
- `task_id`: 任务ID

**响应**:
```json
{
  "success": true,
  "message": "任务已取消"
}
```

**注意**: 只能取消待处理或处理中的任务

---

### 2. 资源管理 API (任务12)

#### 2.1 查询资源列表

**接口**: `GET /resource/v2/list`

**描述**: 查询资源列表,支持多维度筛选

**查询参数**:
- `student_id`: 学生ID (可选)
- `course_id`: 课程ID (可选)
- `resource_type`: 资源类型 (可选)
- `knowledge_point_id`: 知识点ID (可选)
- `status`: 资源状态 (可选)
- `difficulty_level`: 难度等级 (可选)
- `page`: 页码 (默认1)
- `page_size`: 每页数量 (默认20)

**响应**:
```json
{
  "items": [
    {
      "id": 101,
      "resource_name": "Python变量与数据类型",
      "resource_type": 1,
      "knowledge_point_id": 101,
      "course_id": 1,
      "student_id": 1001,
      "difficulty_level": 1,
      "status": 2,
      "file_url": "https://storage.example.com/resources/101.md",
      "quality_score": 0.85,
      "view_count": 10,
      "download_count": 5,
      "favorite_count": 2,
      "create_time": "2024-01-01T10:00:00"
    }
  ],
  "total": 50,
  "page": 1,
  "page_size": 20,
  "total_pages": 3
}
```

---

#### 2.2 获取资源详情

**接口**: `GET /resource/v2/{resource_id}/detail`

**描述**: 获取资源的完整详情信息

**路径参数**:
- `resource_id`: 资源ID

**响应**:
```json
{
  "id": 101,
  "resource_name": "Python变量与数据类型",
  "resource_type": 1,
  "file_url": "https://storage.example.com/resources/101.md",
  "quality_score": 0.85,
  "view_count": 11,
  "download_count": 5,
  "favorite_count": 2,
  "create_time": "2024-01-01T10:00:00"
}
```

**注意**: 每次调用会增加查看次数

---

#### 2.3 全文检索资源

**接口**: `GET /resource/v2/search`

**描述**: 在资源名称和内容中搜索关键词

**查询参数**:
- `keyword`: 搜索关键词 (必填)
- `student_id`: 学生ID (可选)
- `page`: 页码 (默认1)
- `page_size`: 每页数量 (默认20)

**示例**: `GET /resource/v2/search?keyword=Python&student_id=1001&page=1`

**响应**: 同资源列表格式

---

#### 2.4 添加收藏

**接口**: `POST /resource/v2/favorites`

**描述**: 将资源添加到收藏夹

**请求体**:
```json
{
  "user_id": 1001,
  "resource_id": 101,
  "category": "重点复习",
  "notes": "考试重点"
}
```

**响应**:
```json
{
  "id": 1,
  "user_id": 1001,
  "resource_id": 101,
  "category": "重点复习",
  "notes": "考试重点",
  "create_time": "2024-01-01T10:00:00"
}
```

---

#### 2.5 取消收藏

**接口**: `DELETE /resource/v2/favorites`

**描述**: 从收藏夹中移除资源

**查询参数**:
- `user_id`: 用户ID
- `resource_id`: 资源ID

**响应**:
```json
{
  "success": true,
  "message": "已取消收藏"
}
```

---

#### 2.6 查询收藏列表

**接口**: `GET /resource/v2/favorites/list`

**描述**: 查询用户的收藏资源列表

**查询参数**:
- `user_id`: 用户ID (必填)
- `category`: 收藏分类 (可选)
- `page`: 页码 (默认1)
- `page_size`: 每页数量 (默认20)

**响应**: 同资源列表格式

---

#### 2.7 获取收藏分类

**接口**: `GET /resource/v2/favorites/categories`

**描述**: 获取用户的收藏分类列表及每个分类的资源数量

**查询参数**:
- `user_id`: 用户ID

**响应**:
```json
[
  {
    "category": "重点复习",
    "count": 5
  },
  {
    "category": "默认分类",
    "count": 3
  }
]
```

---

#### 2.8 生成下载链接

**接口**: `GET /resource/v2/{resource_id}/download`

**描述**: 生成资源的临时下载链接

**路径参数**:
- `resource_id`: 资源ID

**查询参数**:
- `user_id`: 用户ID
- `format`: 下载格式 (markdown, pdf, html)

**响应**:
```json
{
  "resource_id": 101,
  "download_url": "https://storage.example.com/resources/101.md?token=xxx",
  "format": "markdown",
  "expires_in": 3600,
  "file_name": "Python变量与数据类型.md"
}
```

**注意**: 下载链接1小时后过期

---

#### 2.9 批量下载

**接口**: `POST /resource/v2/batch-download`

**描述**: 批量下载多个资源,打包为zip文件

**请求体**:
```json
{
  "resource_ids": [101, 102, 103],
  "user_id": 1001,
  "format": "zip"
}
```

**响应**:
```json
{
  "download_url": "https://storage.example.com/batch/1001_1234567890.zip",
  "format": "zip",
  "resource_count": 3,
  "expires_in": 3600,
  "file_name": "resources_20240101_100000.zip"
}
```

---

#### 2.10 删除资源

**接口**: `DELETE /resource/v2/{resource_id}`

**描述**: 删除资源(支持软删除和硬删除)

**路径参数**:
- `resource_id`: 资源ID

**查询参数**:
- `user_id`: 用户ID
- `hard_delete`: 是否硬删除 (默认false)

**响应**:
```json
{
  "success": true,
  "message": "删除成功"
}
```

**删除类型**:
- 软删除 (hard_delete=false): 标记为已删除,可恢复
- 硬删除 (hard_delete=true): 物理删除,不可恢复

---

#### 2.11 资源统计

**接口**: `GET /resource/v2/statistics`

**描述**: 获取学生的资源统计信息

**查询参数**:
- `student_id`: 学生ID

**响应**:
```json
{
  "total_resources": 50,
  "by_type": {
    "1": 15,
    "2": 10,
    "3": 12,
    "4": 8,
    "5": 5
  },
  "by_status": {
    "1": 2,
    "2": 45,
    "3": 3
  },
  "total_favorites": 10,
  "total_views": 150,
  "total_downloads": 80
}
```

---

## 错误码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 错误响应格式

```json
{
  "detail": "错误描述信息"
}
```

## 使用示例

### Python 示例

```python
import requests

# 创建资源生成任务
response = requests.post(
    "http://localhost:8000/api/v1/resource/generation/tasks",
    json={
        "task_name": "Python基础资源生成",
        "student_id": 1001,
        "resource_types": [1, 2, 3],
        "knowledge_point_id": 101,
        "course_id": 1
    }
)
task = response.json()
task_id = task["id"]

# 查询任务状态
response = requests.get(
    f"http://localhost:8000/api/v1/resource/generation/tasks/{task_id}"
)
status = response.json()
print(f"进度: {status['progress']}%")

# 查询资源列表
response = requests.get(
    "http://localhost:8000/api/v1/resource/v2/list",
    params={
        "student_id": 1001,
        "resource_type": 1,
        "page": 1,
        "page_size": 20
    }
)
resources = response.json()
```

### JavaScript 示例

```javascript
// 创建资源生成任务
const response = await fetch('http://localhost:8000/api/v1/resource/generation/tasks', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    task_name: 'Python基础资源生成',
    student_id: 1001,
    resource_types: [1, 2, 3],
    knowledge_point_id: 101,
    course_id: 1
  })
});
const task = await response.json();

// 查询任务状态
const statusResponse = await fetch(
  `http://localhost:8000/api/v1/resource/generation/tasks/${task.id}`
);
const status = await statusResponse.json();
console.log(`进度: ${status.progress}%`);
```

## 注意事项

1. **异步处理**: 资源生成是异步的,创建任务后需要轮询查询状态
2. **权限验证**: 用户只能访问自己的资源
3. **下载链接**: 临时下载链接1小时后过期
4. **软删除**: 默认使用软删除,可恢复
5. **分页查询**: 建议使用分页,避免一次查询过多数据

## 更新日志

- 2024-01-01: 初始版本,实现资源生成和管理API
