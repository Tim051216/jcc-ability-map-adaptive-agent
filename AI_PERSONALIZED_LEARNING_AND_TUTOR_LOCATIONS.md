# AI 个性化学习层与 AI Tutor 落点

这批功能已经不只是概念说明，前后端和测试入口都已经落到仓库里。下面按“你要去哪里看”直接列文件。

## 1. AI 个性化学习/追更层

### 前端页面

- `a3-student-react-web/src/pages/CourseLearning.tsx`
  - 学完当前视频后的下一步推荐
  - 目标式学习卡片
  - 小白版 / 进阶版 / 专家版内容分流
  - 复习提醒入口
- `a3-student-react-web/src/pages/LearningPath.tsx`
  - 7 天学会剪辑 / 考公 / 健身入门这类目标式学习路径
  - 每日任务、进度、路径节点
- `a3-student-react-web/src/pages/CapabilityModel.tsx`
  - 成长型主页
  - 能力地图、能力等级、成长轨迹

### 前端接口

- `a3-student-react-web/src/lib/studentApi.ts`
  - 个性化学习路径接口
  - 目标式推荐接口
  - 复习提醒 / 记忆卡片接口
  - 能力地图接口

### 后端接口与服务

- `a3-ai-python/app/api/v1/learning.py`
  - 个性化学习层对外 API 入口
- `a3-ai-python/app/services/learning_service.py`
  - 下一步学习推荐
  - 目标式推荐组装
  - 复习计划生成
  - 水平分层推荐
  - 能力地图聚合
- `a3-ai-python/app/schemas/learning.py`
  - 个性化学习相关请求/响应模型

### 个性化学习状态存储

- `a3-ai-python/app/db/models/personalized_learning_state.py`
- `a3-ai-python/app/db/repositories/personalized_learning_state_repository.py`
- `a3-ai-python/alembic/versions/20260604_0013_personalized_learning_state.py`

这三处负责把学习状态、路径进度、复习计划、能力演化等数据真正持久化下来。

## 2. AI Tutor 上传与附件理解

### 前端页面

- `a3-student-react-web/src/pages/AITutor.tsx`
  - 上传按钮支持图片和文件
  - 附件卡片展示已提取正文 / 已上传状态
  - 支持展开正文、复制正文、插入输入框、直接发送正文

### 前端接口

- `a3-student-react-web/src/lib/studentApi.ts`
  - `uploadTutoringAsset(file)`
  - 返回附件 URL 和 `extracted_text`

### 后端接口与解析能力

- `a3-ai-python/app/api/v1/tutoring.py`
  - AI Tutor 上传接口
- `a3-ai-python/app/schemas/tutoring.py`
  - 上传返回结构
- `a3-ai-python/app/services/tutoring_image_storage.py`
  - 图片上传
  - 文本、PDF、DOCX、XLSX、PPTX 提取正文

## 3. 自动化验证入口

### 前端 smoke

- `a3-student-react-web/scripts/smoke-ai-tutor-upload.ts`
  - 验证上传文本附件、展开正文、复制、插入、发送
- `a3-student-react-web/scripts/smoke-ai-tutor-multiformat.ts`
  - 验证 `txt/docx/xlsx/pptx/pdf` 正文提取
- `a3-student-react-web/scripts/smoke-ai-tutor-capture.ts`
  - 验证截图加入 AI Tutor 对话

统一入口：

- `a3-student-react-web/package.json`
  - `npm run smoke:ai-tutor`

### 后端测试

- `a3-ai-python/app/tests/test_tutoring_attachment_extraction.py`
  - 验证多格式正文提取

### CI

- `.github/workflows/ai-learning-and-tutor-checks.yml`
  - PR 自动跑前端 build
  - PR 自动跑后端附件提取测试
  - 手动触发 AI Tutor smoke

## 4. 你在页面里能直接看到什么

- 首页/学习页可以看到目标式学习路径、学习阶段和下一步推荐
- 能力主页可以看到能力地图，而不是只有观看历史
- AI Tutor 右侧面板上传文件后，会出现附件卡片和“展开正文 / 复制正文 / 插入输入框 / 发送这段正文”

如果你要最快确认，优先看这 4 个文件：

- `a3-student-react-web/src/pages/CourseLearning.tsx`
- `a3-student-react-web/src/pages/LearningPath.tsx`
- `a3-student-react-web/src/pages/CapabilityModel.tsx`
- `a3-student-react-web/src/pages/AITutor.tsx`
