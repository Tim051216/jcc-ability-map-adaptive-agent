# 智能辅导前端界面

## 功能概述

智能辅导模块提供了完整的 AI 驱动的学习辅导功能，包括：

- **问题提交**：支持文字和图片问题输入
- **智能解答**：AI 生成的详细解答（Markdown 格式）
- **图解展示**：自动生成的逻辑图解（Mermaid 格式）
- **视频推荐**：相关视频讲解推荐
- **答疑历史**：完整的历史记录查询和管理
- **评价反馈**：用户评价和反馈收集
- **人工兜底**：疑难问题升级到专家处理

## 组件结构

```
tutoring/
├── index.vue                    # 主页面（标签页容器）
├── components/
│   ├── QuestionInput.vue        # 问题输入组件
│   ├── AnswerDisplay.vue        # 解答展示组件
│   └── TutoringHistory.vue      # 答疑历史组件
└── README.md                    # 本文档
```

## 依赖安装

### 必需依赖

```bash
npm install marked mermaid date-fns katex
```

- **marked**: Markdown 渲染
- **mermaid**: 图表渲染
- **date-fns**: 时间格式化
- **katex**: LaTeX 公式渲染（可选）

### Element Plus 图标

确保已安装 Element Plus 图标：

```bash
npm install @element-plus/icons-vue
```

## 使用说明

### 1. 路由配置

在 `router/index.js` 中添加路由：

```javascript
{
  path: '/tutoring',
  name: 'Tutoring',
  component: () => import('@/pages/tutoring/index.vue'),
  meta: {
    title: '智能辅导',
    icon: 'ChatDotRound'
  }
}
```

### 2. API 配置

确保 API 基础路径配置正确（`src/api/api.js`）：

```javascript
const AI_BASE_URL = process.env.VUE_APP_AI_API_BASE_URL || 'http://localhost:8000'
```

### 3. 样式配置

#### Markdown 样式

在 `src/style/` 目录下创建 `markdown.css`：

```css
.markdown-body {
  font-size: 16px;
  line-height: 1.8;
  color: #333;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-body code {
  padding: 2px 6px;
  background: #f6f8fa;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}

.markdown-body pre {
  padding: 16px;
  background: #f6f8fa;
  border-radius: 6px;
  overflow-x: auto;
}

.markdown-body blockquote {
  padding: 0 1em;
  color: #6a737d;
  border-left: 4px solid #dfe2e5;
}
```

在 `main.js` 中引入：

```javascript
import '@/style/markdown.css'
```

#### Mermaid 样式

Mermaid 图表会自动应用主题，可以在组件中自定义：

```javascript
mermaid.initialize({
  startOnLoad: true,
  theme: 'default', // 可选: default, forest, dark, neutral
  themeVariables: {
    primaryColor: '#409eff',
    primaryTextColor: '#fff',
    primaryBorderColor: '#409eff'
  }
})
```

### 4. 图片上传配置

在 `QuestionInput.vue` 中实现图片上传逻辑：

```javascript
const handleImageChange = async (file, fileList) => {
  // 上传到对象存储（OSS/MinIO）
  const formData = new FormData()
  formData.append('file', file.raw)
  
  try {
    const response = await uploadImage(formData)
    file.url = response.url
  } catch (error) {
    ElMessage.error('图片上传失败')
    fileList.splice(fileList.indexOf(file), 1)
  }
}
```

## 功能特性

### 1. 问题提交

- **文字输入**：支持最多 2000 字符
- **图片上传**：支持最多 3 张图片（公式、代码、图表等）
- **课程关联**：可选择关联的课程和章节
- **实时验证**：输入验证和错误提示

### 2. 解答展示

- **Markdown 渲染**：支持标题、列表、代码块、引用等
- **LaTeX 公式**：支持行内公式（`$...$`）和块级公式（`$$...$$`）
- **Mermaid 图表**：自动渲染流程图、思维导图、关系图
- **视频推荐**：展示相关视频，支持直接播放
- **参考资料**：展示知识来源和参考链接
- **置信度显示**：AI 解答的置信度评分

### 3. 评价反馈

- **有帮助/没帮助**：快速反馈
- **星级评分**：1-5 星评分
- **文字反馈**：详细的反馈意见
- **升级到人工**：一键升级到专家处理

### 4. 答疑历史

- **多条件搜索**：按课程、类型、关键词搜索
- **时间排序**：按创建时间倒序
- **收藏管理**：收藏重要的答疑记录
- **详情查看**：查看完整的问题和解答

## 待实现功能

### 1. WebSocket 实时推送

实现流式输出，逐步展示 AI 生成的内容：

```javascript
// 在 AnswerDisplay.vue 中
const connectWebSocket = (questionId) => {
  const ws = new WebSocket(`ws://localhost:8000/ws/tutoring/${questionId}`)
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    
    if (data.chunk_type === 'text') {
      // 逐步追加文字内容
      currentAnswer.value.answer_text += data.content
    } else if (data.chunk_type === 'diagram') {
      // 添加图解
      currentAnswer.value.diagrams.push(data.content)
    } else if (data.chunk_type === 'video') {
      // 添加视频推荐
      currentAnswer.value.videos.push(data.content)
    }
  }
}
```

### 2. LaTeX 公式渲染

安装并配置 KaTeX：

```bash
npm install katex
```

在 `AnswerDisplay.vue` 中：

```javascript
import katex from 'katex'
import 'katex/dist/katex.min.css'

// 渲染公式
const renderMath = (text) => {
  // 行内公式
  text = text.replace(/\$([^\$]+)\$/g, (match, formula) => {
    return katex.renderToString(formula, { throwOnError: false })
  })
  
  // 块级公式
  text = text.replace(/\$\$([^\$]+)\$\$/g, (match, formula) => {
    return katex.renderToString(formula, { 
      displayMode: true,
      throwOnError: false 
    })
  })
  
  return text
}
```

### 3. 代码高亮

使用 highlight.js：

```bash
npm install highlight.js
```

配置 marked：

```javascript
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  }
})
```

### 4. 图片 OCR

集成 OCR 功能，识别图片中的文字：

```javascript
const recognizeImage = async (imageUrl) => {
  const response = await fetch('/api/ocr', {
    method: 'POST',
    body: JSON.stringify({ image_url: imageUrl })
  })
  
  const result = await response.json()
  return result.text
}
```

## 性能优化

### 1. 懒加载

对大型依赖使用懒加载：

```javascript
// 动态导入 Mermaid
const mermaid = await import('mermaid')
```

### 2. 虚拟滚动

对历史记录列表使用虚拟滚动（大量数据时）：

```bash
npm install vue-virtual-scroller
```

### 3. 缓存策略

缓存已加载的解答，避免重复请求：

```javascript
const answerCache = new Map()

const getAnswer = async (questionId) => {
  if (answerCache.has(questionId)) {
    return answerCache.get(questionId)
  }
  
  const answer = await fetchAnswer(questionId)
  answerCache.set(questionId, answer)
  return answer
}
```

## 测试

### 单元测试

```bash
npm run test:unit
```

### E2E 测试

```bash
npm run test:e2e
```

## 故障排查

### 1. Mermaid 图表不显示

- 检查 Mermaid 是否正确初始化
- 确保图表代码语法正确
- 查看浏览器控制台错误信息

### 2. Markdown 渲染异常

- 检查 marked 版本兼容性
- 确保 Markdown 语法正确
- 检查 CSS 样式是否加载

### 3. 图片上传失败

- 检查文件大小限制
- 确认对象存储配置正确
- 查看网络请求错误信息

## 浏览器兼容性

- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

## 许可证

MIT
