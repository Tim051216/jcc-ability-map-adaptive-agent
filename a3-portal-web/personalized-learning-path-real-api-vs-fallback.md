# Personalized Learning Path: 真实接口 vs Fallback 说明

本文档用于说明当前学生端 AI 演示闭环中，各页面优先调用的真实接口，以及在接口不可用、返回空数据或联调不完整时采用的 fallback 策略。

## 适用范围

- 学习画像：`src/pages/learningProfile/index.vue`
- 学习路径：`src/pages/learningPath/index.vue`
- 资源推荐：`src/pages/resourceCenter/index.vue`
- 资源收藏：`src/pages/resourceFavorites/index.vue`
- 学习报告：`src/pages/learningReport/index.vue`
- 智能助教：`src/pages/intelligentTutor/index.vue`
- 本地兜底存储：`src/utils/a3StudentStore.js`

## 总体原则

1. 页面优先走真实接口，尽量复用后端返回的数据结构。
2. 如果接口失败、返回空数组、404，或当前联调链路未准备好，则页面继续使用本地 fallback 数据保证可演示。
3. 对“可持续操作”的链路，例如学习路径进度、资源收藏、助教历史记录，优先落本地存储，保证刷新后仍可继续演示。
4. 对后端返回的旧 prompt、课程编码、英文残留文案，会在前端做一层文本归一化，避免直接暴露到页面。

## 1. 学习画像

页面：`src/pages/learningProfile/index.vue`

真实接口：

- `getAiConversationProfile`
- `getAiConversationProfileSummary`
- `getAiConversationProfileHistory`
- `getAiProfileConversationSession`
- `completeAiProfileConversation`
- 以及同页会话相关的 `startAiProfileConversation`、`sendAiProfileConversationMessage`

fallback 策略：

- 页面内置 `fallbackProfile` 作为画像摘要、标签、阶段、维度的兜底数据。
- 当远端详情、摘要、历史任一部分缺失时，优先保住页面结构，缺项回填 fallbackProfile。
- 默认用户取自 `a3DemoScenario`，便于固定演示主题。

演示效果：

- 即使画像会话接口暂不可用，页面仍可展示完整画像卡片、标签和维度分析，不会空白。

## 2. 学习路径

页面：`src/pages/learningPath/index.vue`

真实接口：

- `generateAiLearningPlan`
- `getLatestAiLearningPlan`
- `getAiLearningPlan`
- `getAiLearningPlanProgress`
- `completeAiLearningPlanStep`
- `pauseAiLearningPlanStep`
- `resumeAiLearningPlanStep`

fallback 策略：

- 页面内置 `fallbackStages`、`fallbackSteps`、`defaultSummary`，用于兜底学习计划主视图。
- 当无法读取远端计划时，仍可按固定三天路径展示“基础诊断 -> 弱点强化 -> 综合巩固”。
- 进度操作优先尝试真实接口；如果失败，则回落到 `a3StudentStore` 的本地进度存储。
- 本地进度通过 `listPlanProgress`、`savePlanProgressAction` 保存，支持暂停、恢复、完成后的刷新复现。
- 对后端返回的异常 prompt 文案，前端会做 `isPromptLikeText` 过滤，避免旧演示提示词直接显示为阶段名。

演示效果：

- 即使计划服务或进度服务不稳定，页面仍能演示路径生成结果、步骤推进和报告联动。

## 3. 资源推荐

页面：`src/pages/resourceCenter/index.vue`

真实接口：

- `generateAiResources`
- `listAiFavoriteResources`
- `favoriteAiResource`
- `unfavoriteAiResource`

fallback 策略：

- 页面内置 `buildFallbackResources(...)`，按知识点和资源类型自动生成演示资源。
- 如果远端未返回资源、返回空数组或生成失败，则使用 fallback 资源列表和推荐顺序。
- 本地缓存使用 `RESOURCE_CACHE_KEY` 保存最近一次资源生成结果，避免刷新后列表消失。
- 收藏态优先合并远端收藏和本地收藏；资源文本会做中文归一化处理。

依赖的本地能力：

- `normalizeResource`
- `dedupeResources`
- `listFavoriteResources`
- `saveFavoriteResource`
- `removeFavoriteResource`

演示效果：

- 资源页始终能看到可收藏、可取消收藏、可跳转下一页的资源卡片。

## 4. 资源收藏

页面：`src/pages/resourceFavorites/index.vue`

真实接口：

- `listAiFavoriteResources`
- `unfavoriteAiResource`

fallback 策略：

- 优先读取远端收藏列表。
- 如果接口返回 404、失败，或当前无可用后端，则回退到 `listFavoriteResources()` 本地收藏。
- 取消收藏时，不论远端调用是否成功，都会同步执行 `removeFavoriteResource(item)`，保证页面状态可继续演示。

演示效果：

- 收藏页可独立工作，不依赖后端实时可用。

## 5. 学习报告

页面：`src/pages/learningReport/index.vue`

真实接口：

- `getLatestAiLearningPlan`
- `getLatestAiEvaluation`
- `evaluateAiLearning`

fallback 策略：

- 页面内置 `fallbackEvaluation`，兜底总分、掌握等级、分层评估、指标、薄弱点和建议。
- 路径进度不完全依赖远端，而是结合 `getRecentPlanProgress(planId)` 读取本地最近一次学习路径进度。
- 当远端测评尚未生成时，仍可以根据本地路径执行情况展示“路径执行进度 / 已完成步骤 / 当前聚焦”等关键信息。
- 报告页还会对课程编码和旧反馈文案做规范化替换，避免直接显示 `ml_intro` 之类演示内部值。

演示效果：

- 报告页既可展示真实评估结果，也可在仅有本地学习路径进度时完成闭环演示。

## 6. 智能助教

页面：`src/pages/intelligentTutor/index.vue`

真实接口：

- `submitAiChatTask`
- `getAiChatTaskStatus`
- `listAiChatTickets`
- `createAiChatTicket`

fallback / 容错策略：

- 助教主回答仍以真实异步任务为主，不伪造一整份远端回答。
- 但页面会对历史记录做本地保存，`HISTORY_KEY = a3_student_tutor_history`。
- 即使工单列表接口失败，页面也不会白屏，而是展示空态。
- 历史消息和回答会在读写时做一次归一化，清除旧 prompt 文案，例如“适合课堂现场演示”等过时话术。

演示效果：

- 助教页在后端正常时展示真实问答；后端异常时至少还能保留历史记录和工单入口，不影响页面呈现。

## 7. 本地存储职责

文件：`src/utils/a3StudentStore.js`

主要职责：

- 安全读写 `localStorage`
- 归一化资源标题、摘要、建议、来源文案
- 本地收藏资源去重和维护
- 学习路径进度保存与读取
- 从最近一次本地路径进度中提取报告页可用信息

当前本地存储主要承接的演示能力：

- 路径步骤进度
- 资源收藏
- 最近资源缓存
- 助教历史记录

## 8. 当前建议

如果后续继续联调，建议按下面顺序逐步“去 fallback 化”：

1. 优先稳定学习路径与进度接口，因为它直接影响报告页联动。
2. 再稳定资源生成与收藏接口，因为它是最直观的可见交互链路。
3. 最后再补强学习画像和助教工单等扩展链路。

如果后续主要面向答辩或现场演示，当前这套策略已经足够支持：

- 首页入口
- 学习画像
- 学习路径
- 资源推荐
- 资源收藏
- 学习报告
- 智能助教

这条学生端闭环在接口不稳定时仍可持续演示，不会因单点后端异常直接中断。
