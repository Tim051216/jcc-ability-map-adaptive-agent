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

## 3. 获取岗位能力知识目录

```http
GET /api/v1/student-portal/job-learning/knowledge-catalog
GET /api/v1/student-portal/job-learning/knowledge-catalog?ability_dimension=system_design
```

返回仓库内 `software-job-ability-knowledge-catalog.md` 的结构化条目。支持按 `ability_dimension` 筛选；当前首批目录共 50 条，覆盖 `requirement_analysis`、`system_design`、`coding_implementation`、`software_testing`、`project_collaboration` 五类能力。每条还返回 `task_prompt`、`deliverable`、`acceptance_criteria` 和 `estimated_minutes`，可直接用于岗位学习任务提交。接口为只读接口，不写入用户数据。

## 4. 保存岗位学习目标

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

## 4. 保存智能体建议

前端收到星辰或本地智能体的完整回答后，保存一次建议记录：

```http
POST /api/v1/student-portal/job-learning/coaching-records
Content-Type: application/json
```

```json
{
  "user_id": 1001,
  "course_id": 401,
  "source": "xfyun_workflow",
  "user_question": "如何提升系统设计能力？",
  "advice_summary": "先完成模块划分练习，再进行接口设计复盘。",
  "recommended_actions": ["完成模块划分练习", "复盘接口设计"]
}
```

创建成功返回 `201` 和完整记录，初始 `status` 为 `planned`。

## 5. 查询历史建议

```http
GET /api/v1/student-portal/job-learning/coaching-records?user_id=1001&course_id=401&limit=20
```

响应按创建时间倒序返回：

```json
{
  "total": 1,
  "items": [
    {
      "id": 1,
      "status": "planned",
      "helpful": null,
      "rating": null,
      "feedback_note": null
    }
  ]
}
```

实际记录还包含创建请求中的全部字段和 `created_at`、`updated_at`。

## 6. 提交执行反馈

```http
PATCH /api/v1/student-portal/job-learning/coaching-records/1/feedback
Content-Type: application/json
```

```json
{
  "user_id": 1001,
  "status": "completed",
  "helpful": true,
  "rating": 5,
  "feedback_note": "建议可执行，已经完成。"
}
```

`status` 允许值：`planned`、`in_progress`、`completed`、`abandoned`。记录按 `user_id` 校验归属，其他学生不能修改该记录。

## 7. 查询学习效果

前端 B 的岗位胜任度报告使用该接口展示前后测变化和建议执行情况：

```http
GET /api/v1/student-portal/job-learning/outcomes?user_id=1001&course_id=401
```

```json
{
  "user_id": 1001,
  "course_id": 401,
  "status": "comparable",
  "assessment_count": 2,
  "baseline_assessment_id": "assessment-17",
  "latest_assessment_id": "assessment-18",
  "baseline_score": 62.0,
  "latest_score": 78.0,
  "score_change": 16.0,
  "ability_changes": [
    {
      "code": "system_design",
      "label": "系统设计",
      "before_score": 62,
      "after_score": 78,
      "change": 16,
      "assessment_status": "derived"
    }
  ],
  "coaching": {
    "total": 2,
    "planned": 1,
    "in_progress": 0,
    "completed": 1,
    "abandoned": 0,
    "completion_rate": 50.0,
    "helpful_count": 1,
    "rated_count": 1,
    "average_rating": 5.0
  },
  "summary": "前后测总分提升 16 分；已完成 1/2 条智能体建议。"
}
```

`status` 的含义：

- `insufficient_data`：没有测评，不展示变化结论。
- `baseline_only`：只有一次测评，仅展示当前分数并提示完成后测。
- `comparable`：至少两次测评，可展示前后测变化。

总分来自真实测评记录；五项 `ability_changes` 是基于相同规则推导的岗位能力变化，因此明确标记为 `derived`。前端不得将推导分数标记为直接测量结果。

## 8. 收集真实试用反馈

试用者完成比赛主链路后提交反馈：

```http
POST /api/v1/student-portal/job-learning/trial-feedback
Content-Type: application/json
```

```json
{
  "user_id": 1001,
  "course_id": 401,
  "participant_role": "student",
  "identity_description": "软件技术专业二年级学生",
  "trial_task": "完成岗位诊断并执行一条学习建议",
  "strengths": "步骤清晰，能看到薄弱项。",
  "problems": "首次进入时不清楚从哪里开始。",
  "improvement_suggestions": "突出显示开始诊断按钮。",
  "overall_rating": 4,
  "consent_to_quote": true
}
```

`participant_role` 允许值：`student`、`teacher`、`enterprise_mentor`。`consent_to_quote=true` 仅表示允许在脱敏后的比赛材料中引用，不得据此公开姓名、账号或联系方式。

本人查询已提交反馈：

```http
GET /api/v1/student-portal/job-learning/trial-feedback?user_id=1001&course_id=401&limit=20
X-User-Id: 1001
```

提交和查询均要求登录身份与 `user_id` 一致，否则返回 `403`。本地联调通过 `X-User-Id` 传入身份，正式环境使用 Bearer Token 或网关注入身份。明细按 `user_id` 和 `course_id` 隔离。比赛材料需要 2-3 名真实目标用户实际试用后提交，不得用测试数据或团队编写内容冒充真实反馈。

本地联调演示数据：

```powershell
cd a3-ai-python
python scripts/seed_job_trial_feedback_demo.py
```

脚本只写入本地 SQLite，使用演示账号 `9901`、`9902`、`9903`，重复执行不会重复插入，也不会删除真实数据。返回的 `identity_description` 以“演示数据：”开头；这些记录只能用于前端联调，不能写入比赛材料作为真实用户反馈证据。

## 9. 前端联调规则

1. 所有页面使用本契约的能力代码，不自行翻译成新的内部代码。
2. `score=null` 表示尚未测评，不得显示固定雷达图分数。
3. `citations` 为空时显示“暂无可核验来源”，不得生成占位页码。
4. `ai_generated=true` 时显示明显的“AI 生成内容”标识。
5. 路由字段由后端返回相对路径，前端负责站内跳转。
6. 新增或修改字段必须先更新本文件，再同步三个前端负责人。
7. 智能体给出正式建议后调用第 4 节接口；学生执行或放弃后调用第 6 节接口，形成可展示的学习反馈闭环。

## 10. 知识目录字段完整性

`GET /api/v1/student-portal/job-learning/knowledge-catalog` 的每个条目必须同时返回：

```text
id, title, ability_dimension, ability_unit, knowledge_point, skill_point,
applicable_scenario, common_error, learning_advice, safety_notice,
source_path, source_locator, task_prompt, deliverable, acceptance_criteria,
estimated_minutes
```

其中 `skill_point` 是可观察的岗位技能产出，不等同于知识点复述；`source_path` 和 `source_locator` 用于教师复核和比赛材料引用。目录接口不应在缺少来源时生成教材页码或标准编号。
