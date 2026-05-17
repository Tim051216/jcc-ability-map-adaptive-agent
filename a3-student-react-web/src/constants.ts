export interface NavItem {
  name: string;
  path: string;
}

export const navItems: NavItem[] = [
  { name: "学习总览", path: "/" },
  { name: "能力画像", path: "/profile" },
  { name: "学习路径", path: "/path" },
  { name: "资源中心", path: "/resources" },
  { name: "我的收藏", path: "/collection" },
  { name: "学习报告", path: "/report" },
  { name: "学习测评", path: "/evaluation" },
  { name: "AI 辅导", path: "/tutor" },
];
