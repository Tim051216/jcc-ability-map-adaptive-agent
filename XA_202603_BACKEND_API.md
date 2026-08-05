# XA-202603 岗位自适应学习后端接口契约

> 状态：第一版冻结
> 负责人：后端 D
> 基础路径：`/api/v1/student-portal`

## 1. 固定领域口径

- 专业群：软件技术专业群
- 岗位：软件开发工程师
- 课程默认值：`course_id=401`
- 用户默认值：`user_id=1001`

能力维度代码在前后端、星辰 Agent、知识库和测试中保持一致：

| code | 名称 |
| --- | --- |
| `requirement_analysis` | 需求理解与分析 |
| `system_design` | 系统设计 |
| `coding_implementation` | 编码实现 |
| `software_testing` | 软件测试 |
| `project_collaboration` | 项目协作与交付 |

## 2. 获取岗位学习聚合数据

```http
GET /api/v1/student-portal/job-learning?user_id=1001&course_id=401
```

响应示例：

```json
{
  "user_id": 1001,
  "course_id": 401,
  "course_code": "software-engineering",
  "course_name": "软件工程与实践（第4版）",
  "professional_group": "软件技术专业群",
  "job_name": "软件开发工程师",
  "student_goal": "完成软件开发岗位实习准备",
  "goal_scene": "internship",
  "assessment_id": "assessment-18",
  "assessment_updated_at": "2026-08-05T09:00:00",
  "ability_dimensions": [
    {
      "code": "requirement_analysis",
      "label": "需求理解与分析",
      "score": 72,
      "benchmark": 70,
      "assessment_status": "derived",
      "evidence": ["最近测评总分 78", "薄弱点命中：需求分析"]
    }
  ],
  "weak_abilities": [],
  "recommended_path": [],
  "recommended_resources": [],
  "citations": [],
  "safety_notices": [],
  "ai_generated": true,
  "next_action": {
    "action_type": "continue_plan",
    "label": "继续岗位能力提升路径",
    "route": "/path?courseId=401",
    "reason": "已有诊断和学习路径，继续完成当前阶段任务。"
  }
}
```

`assessment_status` 说明：

- `measured`：来自按岗位能力维度计分的真实诊断。
- `derived`：根据真实测评总分和薄弱知识点按公开规则推导。
- `not_assessed`：缺少足够数据，`score` 必须为 `null`。

前端不得把 `not_assessed` 替换成固定百分比。

## 3. 保存岗位学习目标

```http
PUT /api/v1/student-portal/job-learning/goal
Content-Type: application/json
```

请求示例：

```json
{
  "user_id": 1001,
  "course_id": 401,
  "student_goal": "两周内完成软件开发岗位实习准备",
  "goal_scene": "internship"
}
```

`goal_scene` 允许值：

- `course`：课程达标
- `training`：综合实训
- `competition`：技能竞赛
- `internship`：岗位实习

目标保存在 `personalized_learning_state`，刷新页面后再次获取聚合数据应返回最新目标。

## 4. 前端联调规则

1. 所有页面使用本契约的能力代码，不自行翻译成新的内部代码。
2. `score=null` 表示尚未测评，不得显示固定雷达图分数。
3. `citations` 为空时显示“暂无可核验来源”，不得生成占位页码。
4. `ai_generated=true` 时显示明显的“AI 生成内容”标识。
5. 路由字段由后端返回相对路径，前端负责站内跳转。
6. 新增或修改字段必须先更新本文件，再同步三个前端负责人。
