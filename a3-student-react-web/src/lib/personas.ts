export type PersonaRole = "student" | "teacher" | "assistant";

export type Persona = {
  id: string;
  name: string;
  title: string;
  role: PersonaRole;
  tagline: string;
  color: string;
};

export const PERSONAS: Persona[] = [
  {
    id: "teacher-li",
    name: "李闻川",
    title: "前端架构讲师",
    role: "teacher",
    tagline: "擅长 React 架构、状态边界和复杂业务拆解。",
    color: "#fb7299",
  },
  {
    id: "teacher-sun",
    name: "孙以澄",
    title: "设计系统讲师",
    role: "teacher",
    tagline: "长期负责企业级设计系统、协作规范和界面审美训练。",
    color: "#0ea5e9",
  },
  {
    id: "teacher-qiao",
    name: "乔知远",
    title: "数据表达讲师",
    role: "teacher",
    tagline: "专注数据叙事、图表表达与分析型页面设计。",
    color: "#8b5cf6",
  },
  {
    id: "teacher-he",
    name: "何青岚",
    title: "软件工程讲师",
    role: "teacher",
    tagline: "偏重工程规范、课程项目推进和真实交付复盘。",
    color: "#14b8a6",
  },
  {
    id: "teacher-jiang",
    name: "蒋牧川",
    title: "AI 应用讲师",
    role: "teacher",
    tagline: "负责多智能体编排、RAG 接入和学习场景落地。",
    color: "#6366f1",
  },
  {
    id: "assistant-zhou",
    name: "周知行",
    title: "课程助教",
    role: "assistant",
    tagline: "负责课后答疑、作业回看和阶段复盘。",
    color: "#10b981",
  },
  {
    id: "assistant-lin",
    name: "林若渝",
    title: "陪学助教",
    role: "assistant",
    tagline: "会把资料、练习和课堂进度一起串联起来。",
    color: "#f59e0b",
  },
  {
    id: "assistant-shen",
    name: "沈序安",
    title: "资源策展助教",
    role: "assistant",
    tagline: "擅长整理讲义、扩展阅读和练习资源包。",
    color: "#7c3aed",
  },
  {
    id: "assistant-gu",
    name: "顾言辞",
    title: "测评反馈助教",
    role: "assistant",
    tagline: "会把随堂测评、错题和画像变化关联起来。",
    color: "#ef4444",
  },
  {
    id: "student-zack",
    name: "Zack Dev",
    title: "软件工程方向学生",
    role: "student",
    tagline: "习惯把复杂问题拆成可执行的小步骤。",
    color: "#2563eb",
  },
  {
    id: "student-emily",
    name: "Emily UI",
    title: "交互设计方向学生",
    role: "student",
    tagline: "偏好结构化笔记、高密度复盘和视觉拆解。",
    color: "#ec4899",
  },
  {
    id: "student-chen",
    name: "陈星宇",
    title: "全栈方向学生",
    role: "student",
    tagline: "经常负责把课堂内容迁移回真实项目里。",
    color: "#14b8a6",
  },
  {
    id: "student-lin",
    name: "林澈",
    title: "前端方向学生",
    role: "student",
    tagline: "擅长整理复盘模板和课程资料包。",
    color: "#6366f1",
  },
  {
    id: "student-song",
    name: "宋知夏",
    title: "数据分析方向学生",
    role: "student",
    tagline: "喜欢把知识点转成图表、脑图和对照清单。",
    color: "#f97316",
  },
  {
    id: "student-xu",
    name: "许嘉禾",
    title: "产品方向学生",
    role: "student",
    tagline: "关注用户体验、产品表达和功能落地细节。",
    color: "#22c55e",
  },
  {
    id: "student-luo",
    name: "罗亦凡",
    title: "AI 工程方向学生",
    role: "student",
    tagline: "喜欢把联网检索、知识库和智能体串成闭环。",
    color: "#06b6d4",
  },
];

export function getPersonaById(id: string) {
  return PERSONAS.find((item) => item.id === id);
}
