export const a3DemoScenario = {
  userId: 1,
  studentName: "A3 演示学员",
  courseCode: "ml_intro",
  courseName: "A3 智能学习助手实战",
  currentTopic: "模型评估与过拟合",
  currentStage: "基础诊断",
  todayTasks: 3,
  resourceTypes: 5,
  completionRate: 68,
  masteryLevel: "稳步提升",
  activeStudents: 268,
  pendingReviews: 14,
  agentHealth: 97,
  alerts: 3,
};

export const a3StudentEntries = [
  {
    index: "01",
    title: "学习画像",
    desc: "从行为数据、测评结果和学习目标生成学生画像，帮助系统识别薄弱点、偏好和合适的推进节奏。",
    path: "/main/ai-profile",
  },
  {
    index: "02",
    title: "资源推荐",
    desc: "按知识点难度、学习进度和资源类型组合讲义、题库、案例与延伸阅读，形成可执行学习包。",
    path: "/main/ai-resources",
  },
  {
    index: "03",
    title: "学习日历",
    desc: "把阶段目标拆成每日任务，清晰展示学习安排、练习节奏和验收节点，便于演示连续学习闭环。",
    path: "/main/ai-calendar",
  },
  {
    index: "04",
    title: "错题复盘",
    desc: "围绕错因分类、关联知识点和补救建议形成复习闭环，让学习改进路径更具体。",
    path: "/main/ai-mistakes",
  },
  {
    index: "05",
    title: "智能助教",
    desc: "支持围绕课程内容的多轮问答、重点追问和学习建议输出，用于展示智能学习助手的交互能力。",
    path: "/main/ai-tutor",
  },
  {
    index: "06",
    title: "学习报告",
    desc: "汇总学习进度、阶段成果、能力变化和风险提醒，形成适合赛题验收展示的结果页。",
    path: "/main/ai-report",
  },
  {
    index: "07",
    title: "课程测评",
    desc: "覆盖测评列表、在线作答、自动批改与评估报告，串联 Java 业务库与 Python 智能体服务。",
    path: "/main/ai-evaluation",
  },
];

export const a3AdminEntries = [
  {
    title: "运维总览",
    desc: "集中查看演示环境整体运行状态、活跃用户、服务告警和关键链路健康度。",
    path: "/main/ai-admin",
  },
  {
    title: "用户管理",
    desc: "查看学习用户、测试账号和演示账号的基础信息与使用情况，方便现场切换演示角色。",
    path: "/main/ai-admin-users",
  },
  {
    title: "人工工单",
    desc: "查看学生升级到人工支持的问题单，跟进回复、处理状态和服务闭环。",
    path: "/main/ai-admin-tickets",
  },
  {
    title: "内容审核",
    desc: "展示 AI 生成内容的审核流程、风险提示和人工复核入口，补足平台治理能力。",
    path: "/main/ai-admin-review",
  },
  {
    title: "智能体编排",
    desc: "查看不同智能体的分工、调用链和协同状态，用于体现系统架构与多智能体能力。",
    path: "/main/ai-admin-agents",
  },
  {
    title: "运行日志",
    desc: "沉淀关键操作、生成请求和异常记录，为赛题演示和问题排查提供支撑。",
    path: "/main/ai-admin-logs",
  },
];

export const a3TodoItems = [
  {
    title: "补齐阶段二练习集与实战案例",
    desc: "把学习路径中的专题练习、案例拆解和阶段测验补齐，方便首页与学习报告联动演示。",
  },
  {
    title: "完善 5 条核心演示链路",
    desc: "覆盖首页推荐、搜索选课、学习路径生成、智能助教问答和学习报告查看等关键环节。",
  },
  {
    title: "继续优化资源封面与展示素材",
    desc: "统一课程卡片封面、轮播视觉和资源中心素材，让整套前台界面更完整、更适合验收展示。",
  },
];
