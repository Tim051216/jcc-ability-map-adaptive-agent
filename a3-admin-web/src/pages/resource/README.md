# AI 资源生成模块

## 模块概述

本模块实现了基于多智能体协同的个性化学习资源生成功能,支持五类资源的生成、管理和收藏。

## 功能模块

### 1. 资源生成 (`/resource/generation`)

**功能描述**:
- 选择要生成的资源类型(可多选)
- 配置生成参数(学生、课程、知识点、难度等)
- 实时查看生成进度
- 查看生成结果

**支持的资源类型**:
1. **课程讲解文档** - 结构化的 Markdown 文档,支持 LaTeX 公式和代码块
2. **知识点思维导图** - Mermaid 格式的可视化知识结构图
3. **分层练习题库** - 基础/进阶/拔高三层题目,支持6种题型
4. **教学视频推荐** - 精选的教学视频资源列表
5. **代码实操案例** - 可运行的代码示例,包含详细注释和说明

**使用流程**:
1. 选择一种或多种资源类型
2. 填写任务名称
3. 选择学生、课程和知识点
4. 设置难度等级
5. 点击"开始生成"
6. 等待生成完成(可实时查看进度)
7. 点击"查看资源"跳转到资源管理页

### 2. 资源管理 (`/resource/management`)

**功能描述**:
- 查看所有生成的资源
- 按类型、状态、难度筛选
- 关键词搜索
- 查看资源详情
- 收藏/下载/删除资源

**筛选条件**:
- 资源类型: 文档/导图/题库/视频/代码
- 资源状态: 生成中/已完成/生成失败
- 难度等级: 基础/进阶/拔高
- 关键词: 搜索标题和描述

**资源操作**:
- **查看详情**: 查看资源完整内容
- **收藏**: 添加到收藏夹,可设置分类和备注
- **下载**: 下载资源文件
- **删除**: 删除资源(需确认)

### 3. 资源详情 (`/resource/detail/:id`)

**功能描述**:
- 查看资源完整内容
- 根据资源类型渲染不同的展示方式
- 收藏/下载/分享资源

**内容渲染**:
- **文档**: Markdown 渲染,支持公式和代码高亮
- **思维导图**: Mermaid 图表渲染
- **题库**: 分层展示,答案折叠
- **视频**: 视频列表,可直接观看
- **代码**: 代码高亮,包含说明和运行指南

### 4. 收藏夹 (`/resource/favorites`)

**功能描述**:
- 查看所有收藏的资源
- 按分类筛选
- 编辑收藏备注和分类
- 取消收藏

**分类管理**:
- 系统自动统计分类
- 显示每个分类的资源数量
- 支持自定义分类名称

**收藏操作**:
- **查看详情**: 跳转到资源详情页
- **下载**: 下载资源文件
- **编辑备注**: 修改分类和备注
- **取消收藏**: 从收藏夹移除

## 技术实现

### 前端技术栈
- **框架**: Vue 3 (Composition API)
- **UI 库**: Element Plus
- **构建工具**: Vite
- **Markdown 渲染**: Marked.js
- **图表渲染**: Mermaid.js
- **代码高亮**: Prism.js

### API 接口
所有接口都通过 `@/api/resource-generation.js` 调用,主要包括:

**生成相关**:
- `createGenerationTask()` - 创建生成任务
- `getTaskStatus()` - 查询任务状态
- `cancelTask()` - 取消任务

**资源管理**:
- `getResourceList()` - 查询资源列表
- `getResourceDetail()` - 获取资源详情
- `searchResources()` - 搜索资源
- `downloadResource()` - 下载资源
- `deleteResource()` - 删除资源

**收藏管理**:
- `addFavorite()` - 添加收藏
- `removeFavorite()` - 取消收藏
- `getFavoriteList()` - 查询收藏列表
- `getFavoriteCategories()` - 获取收藏分类
- `updateFavorite()` - 更新收藏备注

### 路由配置
路由配置在 `@/router/modules/components.js` 中:

```javascript
{
  path: "/resource",
  component: Layout,
  redirect: "/resource/generation",
  name: "resource",
  meta: { title: "AI资源中心", icon: '&#xe612;' },
  children: [
    {
      path: "generation",
      name: "resourceGeneration",
      component: () => import("@/pages/resource/generation/index.vue"),
      meta: { title: "资源生成工坊" },
    },
    {
      path: "management",
      name: "resourceManagement",
      component: () => import("@/pages/resource/management/index.vue"),
      meta: { title: "资源管理" },
    },
    {
      path: "favorites",
      name: "resourceFavorites",
      component: () => import("@/pages/resource/favorites/index.vue"),
      meta: { title: "收藏夹" },
    },
    {
      path: "detail/:id",
      name: "resourceDetail",
      component: () => import("@/pages/resource/detail/index.vue"),
      meta: { title: "资源详情", hidden: true },
    },
  ],
}
```

## 文件结构

```
src/pages/resource/
├── generation/
│   └── index.vue          # 资源生成页
├── management/
│   └── index.vue          # 资源管理页
├── detail/
│   └── index.vue          # 资源详情页
├── favorites/
│   └── index.vue          # 收藏夹页
└── README.md              # 本文档
```

## 开发说明

### 本地开发
```bash
cd a3-admin-web
npm install
npm run dev
```

### 构建生产版本
```bash
npm run build:prod
```

### 注意事项

1. **依赖安装**: 确保安装了 `marked`、`mermaid` 和 `prismjs` 依赖
   ```bash
   npm install marked mermaid prismjs
   ```

2. **API 配置**: 确保 `@/utils/request.js` 中配置了正确的后端 API 地址

3. **权限控制**: 部分操作(如删除)需要相应的权限,确保用户已登录且有权限

4. **浏览器兼容**: 建议使用现代浏览器(Chrome、Firefox、Edge 最新版)

## 后续优化

### 功能优化
- [ ] 添加资源预览功能
- [ ] 支持批量操作(批量下载、批量删除)
- [ ] 添加资源评价功能
- [ ] 支持资源分享到社交平台
- [ ] 添加资源使用统计图表

### 性能优化
- [ ] 实现虚拟滚动(大量资源时)
- [ ] 添加资源缓存机制
- [ ] 优化图片和视频加载
- [ ] 实现懒加载

### 用户体验优化
- [ ] 添加资源生成进度动画
- [ ] 优化移动端适配
- [ ] 添加快捷键支持
- [ ] 实现拖拽排序

## 相关文档

- [多智能体资源生成系统设计文档](../../../.kiro/specs/multi-agent-resource-generation/design.md)
- [API 文档](../../../a3-ai-python/API_DOCUMENTATION.md)
- [实施日志](../../../.kiro/specs/multi-agent-resource-generation/IMPLEMENTATION_LOG.md)
