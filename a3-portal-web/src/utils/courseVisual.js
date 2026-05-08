const palette = [
  {
    gradient: "linear-gradient(135deg, #0f766e 0%, #155e75 45%, #1d4ed8 100%)",
    accent: "#99f6e4",
  },
  {
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #38bdf8 100%)",
    accent: "#bfdbfe",
  },
  {
    gradient: "linear-gradient(135deg, #7c3aed 0%, #9333ea 48%, #ec4899 100%)",
    accent: "#e9d5ff",
  },
  {
    gradient: "linear-gradient(135deg, #14532d 0%, #15803d 50%, #65a30d 100%)",
    accent: "#d9f99d",
  },
  {
    gradient: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 55%, #fb7185 100%)",
    accent: "#fecdd3",
  },
];

const keywords = [
  { match: /(ai|智能|模型|算法|机器学习|深度学习)/i, label: "AI", tag: "智能学习" },
  { match: /(java|spring|后端|微服务|gateway|cloud)/i, label: "JD", tag: "服务架构" },
  { match: /(vue|react|前端|页面|工程化|vite|ui)/i, label: "FE", tag: "前端实战" },
  { match: /(数据|分析|可视化|数仓|统计)/i, label: "DA", tag: "数据分析" },
  { match: /(产品|设计|交互|运营|增长)/i, label: "UX", tag: "产品设计" },
];

const toText = (...values) => values.filter(Boolean).join(" ").trim();

const getHash = (text = "") =>
  Array.from(text).reduce((sum, char) => sum + char.charCodeAt(0), 0);

export const getCourseVisual = (course = {}) => {
  const text = toText(course.name, course.teacher, course.categoryName);
  const hash = getHash(text);
  const theme = palette[hash % palette.length];
  const matched = keywords.find((item) => item.match.test(text));

  return {
    gradient: theme.gradient,
    accent: theme.accent,
    label: matched?.label || "A3",
    tag: matched?.tag || "学习专题",
  };
};
