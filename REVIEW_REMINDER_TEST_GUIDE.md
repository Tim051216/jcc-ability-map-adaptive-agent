# 智能复习提醒最小闭环联调说明

当前已打通的链路：

1. `a3-learning` 生成复习提醒任务
2. `a3-scheduler-demo` 扫描到期任务
3. `a3-message` 写入站内收件箱

当前真实可用渠道：

- `IN_APP`

已预留但未接通第三方发送器：

- `WECHAT`
- `WECOM`
- `QQ`

## 1. 建表

执行：

```sql
source sql/review_reminder_init.sql;
```

## 2. 启动服务

至少启动这三个：

```powershell
# learning
mvn -pl a3-learning -am spring-boot:run -Dspring-boot.run.profiles=local

# message
mvn -f a3-message/pom.xml -pl a3-message-service -am spring-boot:run -Dspring-boot.run.profiles=local

# scheduler
mvn -f a3-scheduler-demo/pom.xml spring-boot:run -Dspring-boot.run.profiles=local
```

默认本地地址按现有配置：

- `a3-learning`: `http://127.0.0.1:8086`
- `a3-message`: `http://127.0.0.1:8089`
- `a3-scheduler-demo`: 以实际本地端口为准

## 3. 手动生成一条到期提醒任务

```http
POST /learning/review-reminders/generate
Host: 127.0.0.1:8086
Content-Type: application/json

{
  "userId": 1001,
  "courseId": 401,
  "lessonId": 1,
  "resourceId": 1,
  "triggerType": "REVIEW_DUE",
  "title": "12 小时后适合回顾 Hooks 组合设计",
  "content": "你上次卡住的是 Context 切片，这次建议先回顾视频中的 Hooks 组合设计片段。",
  "sourceVideo": "Hooks 组合设计与 Context 切片",
  "remindAt": "2026-06-08T15:00:00",
  "channelStrategy": "IN_APP"
}
```

## 4. 查看待发送任务

```http
GET /learning/review-reminders/pending?before=2026-06-08%2016:00:00&limit=20
Host: 127.0.0.1:8086
```

## 5. 手动触发一次分发

```http
POST /scheduler/review-reminders/dispatch-once
Host: 127.0.0.1:<scheduler-port>
```

成功返回类似：

```text
success=1,failed=0
```

## 6. 验证结果

### learning 库

```sql
SELECT id, user_id, title, status, remind_at, fail_reason
FROM review_reminder_task
ORDER BY create_time DESC;
```

预期：

- 任务状态从 `PENDING` 变成 `SENT`

### message 库

```sql
SELECT id, user_id, title, content, type, push_time
FROM user_inbox
ORDER BY push_time DESC;
```

预期：

- 新增一条站内复习提醒
- `title` 与 `content` 为你生成任务时传入的内容

## 7. 当前局限

- `UserInboxServiceImpl.sentMessageToUser()` 仍依赖当前登录用户上下文作为 publisher，所以如果调度服务没有登录上下文，`publisher` 可能为空或取不到。若本地运行报这个问题，建议下一步改成允许系统发送人兜底。
- 微信 / 企业微信 / QQ 目前只保留渠道策略字段，尚未真正发送。
- 还没有做失败重试表和发送日志落库。

## 8. 下一步建议

优先继续做：

1. `a3-message` 中增加系统发送人兜底
2. `notification_send_log` 真正写库
3. 企业微信 `WECOM` 发送器
4. 前端“提醒设置”和“提醒记录”页
