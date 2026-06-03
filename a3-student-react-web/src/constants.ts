/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Course {
  id: string;
  title: string;
  subtitle?: string;
  category: "Programming" | "Design" | "Data";
  uploader: string;
  uploaderAvatar?: string;
  rating: number;
  views: string;
  comments: string;
  duration: string;
  progress: number;
  playbackUrl?: string;
  image: string;
  lastWatchedEpisode?: string;
  episodesCount?: number;
  description?: string;
}

export interface ResourceFile {
  fileId: string;
  name: string;
  type: "pdf" | "text" | "image" | "video";
  format: string;
  size: string;
  pages?: number;
  uploadedDate: string;
  excerpt?: string;
  previewUrl?: string; // Content for preview box
  studyAdvice?: string;
}

export interface ResourceGroup {
  resourceId: string;
  courseId: string;
  title: string;
  category: string;
  uploader: string;
  updatedAt: string;
  downloads: number;
  files: ResourceFile[];
  summary?: string;
}

export interface PathStep {
  id: string;
  title: string;
  duration: string;
  type: "video" | "code" | "reading" | "quiz";
  completed: boolean;
  status: "locked" | "unlocked" | "current";
  subtitle: string;
  date?: string;
}

export interface PathPhase {
  phaseTitle: string;
  progress: number;
  steps: PathStep[];
}

export interface ActivityLog {
  id: string;
  time: string;
  title: string;
  badge?: string;
  gain: string;
}

// 1. Initial Courses and Series Data aligned with visual layouts
export const COURSES: Course[] = [
  {
    id: "series-1",
    title: "现代 Web 设计系统实战",
    subtitle: "从组件规范到页面协同，系统化搭建设计与前端一体化能力。",
    category: "Design",
    uploader: "TechElite Academy",
    uploaderAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&fit=crop&q=80",
    rating: 4.9,
    views: "124K",
    comments: "1.2K",
    duration: "1:45:20",
    progress: 65,
    lastWatchedEpisode: "学习中：高级界面组件设计",
    image: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&fit=crop&q=80",
    description: "围绕设计规范、组件体系、交互层级和企业级页面协同，建立完整的设计系统落地能力。",
    playbackUrl: "/videos/software-engineering-4th/project-demo.mp4"
  },
  {
    id: "series-2",
    title: "React 高阶模式与性能优化",
    subtitle: "聚焦 Hooks 组合、状态治理与渲染性能调优。",
    category: "Programming",
    uploader: "Design Mastery Lab",
    uploaderAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&fit=crop&q=80",
    rating: 4.8,
    views: "89K",
    comments: "850",
    duration: "42:15",
    progress: 80,
    lastWatchedEpisode: "学习中：Memo 渲染优化",
    image: "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=600&fit=crop&q=80",
    description: "系统拆解复合组件、状态切片、上下文边界和高性能渲染链路，适合直接迁移到真实项目中。",
    playbackUrl: "/videos/software-engineering-4th/visio-flow-demo.mp4"
  },
  {
    id: "series-3",
    title: "微交互与界面动效设计",
    subtitle: "用物理感动效与细节反馈让前端界面真正活起来。",
    category: "Design",
    uploader: "Sarah Jenkins Studio",
    uploaderAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&fit=crop&q=80",
    rating: 4.8,
    views: "52K",
    comments: "310",
    duration: "15:20",
    progress: 15,
    lastWatchedEpisode: "学习中：微反馈动画节奏",
    image: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=600&fit=crop&q=80",
    description: "从弹性、惯性到节奏控制，分步骤讲清动效设计中的物理感表达与可访问性约束。",
    playbackUrl: "/videos/software-engineering-4th/cloud-app-demo.mp4"
  },
  {
    id: "course-4",
    title: "D3.js 数据叙事与可视化表达",
    subtitle: "把动态结构、图表层级与故事表达整合成更高级的数据界面。",
    category: "Data",
    uploader: "DataInsights Research",
    uploaderAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&fit=crop&q=80",
    rating: 4.7,
    views: "210K",
    comments: "3.1K",
    duration: "2:10:05",
    progress: 0,
    image: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=600&fit=crop&q=80",
    description: "通过坐标映射、过渡动画与视觉层次设计，把原始数据整理成有表达力的分析型页面。",
    playbackUrl: "/videos/software-engineering-4th/project-demo.mp4"
  }
];

// 2. Resource Groups with distinct items for Preview Page
export const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    resourceId: "res-1",
    courseId: "series-1",
    title: "软件工程课程资料 - 第四章课件",
    category: "Lecture Slides",
    uploader: "软件工程课程组",
    updatedAt: "Oct 24, 2026",
    downloads: 1420,
    summary: "本套资料覆盖软件工程课程第四章的核心知识点，包括生命周期模型、需求分析、设计方法与阶段性实践说明。",
    files: [
      {
        fileId: "file-101",
        name: "第四章 软件工程基础与过程模型.pdf",
        type: "pdf",
        format: "PDF Document",
        size: "4.2 MB",
        pages: 42,
        uploadedDate: "Oct 24, 2026",
        previewUrl: `[PPT 课件预览]
=========================
软件工程与实践（第4版）
课程编号：series-1

第四章：软件过程模型与项目组织
--------------------------------
1. 软件生命周期的基本概念
2. 瀑布模型、原型模型与增量模型
3. 螺旋模型的风险驱动思想
4. 团队分工、里程碑与文档规范

课堂提示：
- 重点掌握不同过程模型的适用场景
- 结合案例理解需求变更对项目节奏的影响
- 建议复习第 12-18 页的模型对比表`,
        studyAdvice: "建议重点复习过程模型的适用场景，并结合项目案例理解里程碑、风险与需求变更之间的关系。",
        excerpt: "本章聚焦软件生命周期、过程模型比较以及项目组织管理，是后续需求分析与系统设计学习的基础。"
      },
      {
        fileId: "file-102",
        name: "第五章 需求分析与规格说明.pdf",
        type: "pdf",
        format: "PDF Document",
        size: "5.1 MB",
        pages: 35,
        uploadedDate: "Oct 28, 2026",
        previewUrl: `[PPT 课件预览]
=========================
软件工程与实践（第4版）
课程编号：series-1

第五章：需求分析与软件规格说明
--------------------------------
1. 需求获取与需求澄清
2. 用例图与业务流程建模
3. 数据字典与规格说明书结构
4. 需求评审与需求基线控制`,
        studyAdvice: "本章建议结合实际项目需求说明书阅读，重点掌握功能需求、非功能需求以及需求变更控制。",
        excerpt: "本章围绕需求分析展开，帮助理解从用户问题到软件规格说明书的完整转化过程。"
      },
      {
        fileId: "file-103",
        name: "实验记录与项目进度样例.csv",
        type: "text",
        format: "Comma-Separated Text File",
        size: "1.8 MB",
        uploadedDate: "Oct 25, 2026",
        previewUrl: `周次,任务名称,负责人,开始日期,结束日期,当前状态,备注
1,需求调研,张三,2026-10-01,2026-10-03,已完成,完成用户访谈与资料收集
2,需求分析,李四,2026-10-04,2026-10-08,已完成,输出初版需求说明书
3,概要设计,王五,2026-10-09,2026-10-14,进行中,等待接口评审
4,详细设计,赵六,2026-10-15,2026-10-20,未开始,依赖概要设计确认
5,测试计划,陈晨,2026-10-21,2026-10-24,未开始,待需求冻结后启动`,
        studyAdvice: "可结合课程中的项目管理章节，观察任务拆分、负责人分配和里程碑安排方式。",
        excerpt: "该样例展示了软件工程课程中项目计划与任务分工的基础记录方式，可用于练习过程跟踪。"
      }
    ]
  },
  {
    resourceId: "res-2",
    courseId: "series-1",
    title: "软件工程课堂笔记与案例拆解",
    category: "Notes",
    uploader: "软件工程助教组",
    updatedAt: "Nov 02, 2026",
    downloads: 980,
    summary: "围绕需求分析、概要设计、项目管理和案例复盘整理的一组实践笔记，适合作为课后巩固材料。",
    files: [
      {
        fileId: "file-201",
        name: "需求分析课堂笔记.txt",
        type: "text",
        format: "Plain Text Document",
        size: "128 KB",
        uploadedDate: "Nov 02, 2026",
        previewUrl: `[课堂笔记预览]
=========================
需求分析课堂笔记

1. 需求分析的核心目标是把“用户想要什么”转化成“系统需要做什么”。
2. 功能需求描述系统行为，非功能需求描述质量属性与约束条件。
3. 用例图适合梳理参与者与系统边界，活动图适合表达业务流程。
4. 需求评审时要重点确认歧义项、遗漏项和变更风险。`,
        studyAdvice: "建议结合第五章课件一起复习，把课堂案例中的需求条目重新整理成规范化表达。",
        excerpt: "本笔记聚焦需求分析的核心概念、建模方式和评审重点。"
      },
      {
        fileId: "file-202",
        name: "项目管理案例复盘.png",
        type: "image",
        format: "PNG Graphic",
        size: "1.2 MB",
        uploadedDate: "Nov 03, 2026",
        previewUrl: `https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&fit=crop&q=80`,
        studyAdvice: "可结合项目计划样例观察里程碑、任务拆分与风险控制的对应关系。",
        excerpt: "用于辅助理解软件工程项目管理与进度控制的案例示意图。"
      }
    ]
  },
  {
    resourceId: "res-3",
    courseId: "series-2",
    title: "React 状态架构与性能优化笔记",
    category: "Notes",
    uploader: "前端架构实验室",
    updatedAt: "Nov 02, 2026",
    downloads: 980,
    summary: "围绕 React 状态拆分、上下文隔离、渲染边界和性能优化策略形成的一组课堂笔记与辅助图示。",
    files: [
      {
        fileId: "file-201",
        name: "React Context 架构设计指南.txt",
        type: "text",
        format: "Plain Text Document",
        size: "128 KB",
        uploadedDate: "Nov 02, 2026",
        previewUrl: `[课堂笔记预览]
=========================
复杂 Context 流设计

当 React 页面层级较深时，全局 Context 的频繁更新可能导致无关组件级联重渲染。

1. 不要把所有状态都塞进同一个 Context。
2. 将配置状态与高频交互状态拆分开。
3. 将事件回调保持稳定，减少子组件重复更新。
4. 优先在状态边界上做隔离，而不是在末端被动优化。`,
        studyAdvice: "建议结合实际页面组件树，练习拆分全局状态与高频局部状态。",
        excerpt: "将状态按职责拆分，可以显著降低组件树的无效重渲染。"
      },
      {
        fileId: "file-202",
        name: "性能诊断热力图.png",
        type: "image",
        format: "PNG Graphic",
        size: "1.2 MB",
        uploadedDate: "Nov 03, 2026",
        previewUrl: `https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&fit=crop&q=80`,
        studyAdvice: "重点关注高亮区域对应的渲染热点，结合组件结构定位性能瓶颈。",
        excerpt: "用于展示页面渲染热点和组件更新压力分布的可视化图示。"
      }
    ]
  }
];

// 3. Learning Paths
export const LEARNING_PATHS: PathPhase[] = [
  {
    phaseTitle: "Phase 1: Hooks Deep Dive",
    progress: 100,
    steps: [
      {
        id: "step-1",
        title: "Understanding useEffect Lifecycle",
        duration: "45 mins",
        type: "reading",
        completed: true,
        status: "unlocked",
        subtitle: "Learn standard dependency comparisons, safe cleanup routines, and network stream subscriptions.",
        date: "Day 1"
      }
    ]
  },
  {
    phaseTitle: "Phase 2: Custom Hooks & Composition",
    progress: 50,
    steps: [
      {
        id: "step-2",
        title: "Building useFetch Hook",
        duration: "32 mins",
        type: "video",
        completed: false,
        status: "current",
        subtitle: "Create a robust custom hook for secure data fetching, handling loading wrappers, client exceptions, and local states.",
        date: "Today"
      }
    ]
  },
  {
    phaseTitle: "Phase 3: Performance & Memoization",
    progress: 0,
    steps: [
      {
        id: "step-3",
        title: "State Machines with XState",
        duration: "1 hr 15 mins",
        type: "reading",
        completed: false,
        status: "locked",
        subtitle: "Unlock by finishing 'Building useFetch'. Transition manual boolean loaders into comprehensive state machines."
      }
    ]
  }
];

// 4. Activity dynamics
export const RECENT_ACTIVITIES: ActivityLog[] = [
  {
    id: "act-1",
    time: "2 hours ago",
    title: "Completed Module: Advanced React Patterns",
    badge: "Execution +5",
    gain: "+5 Execution"
  },
  {
    id: "act-2",
    time: "Yesterday",
    title: "Submitted Project: E-commerce Dashboard",
    badge: "Output +10",
    gain: "+10 Output"
  },
  {
    id: "act-3",
    time: "3 days ago",
    title: "Started Course: UI/UX Principles",
    badge: "Breadth +2",
    gain: "+2 Breadth"
  }
];

// 5. Evaluation Data
export const METRIC_SCORE = {
  overallScore: 92,
  completedCount: 8,
  totalCount: 10,
  studyTime: 124,
  studyTimeChange: "+12% this week"
};

export const EVALUATIONS = [
  {
    id: "eval-1",
    title: "React Re-rendering Core Diagnostics",
    type: "Diagnostic Quiz",
    status: "Completed",
    score: "85%",
    date: "2026-05-18",
    feedback: "Exceptional mastery of simple hooks. Watch out for nested child states, which trigger top-level refreshes."
  },
  {
    id: "eval-2",
    title: "Advanced Tailwind CSS Sizing & Flex",
    type: "Skill Exam",
    status: "Pending",
    score: "N/A",
    date: "Deadline in 2 days",
    feedback: "Get ready to complete direct sandbox styles."
  }
];
