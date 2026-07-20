import assetAnimeClassroom from "../assets/images/anime_perfect_dual_1779718037085.webp";
import assetHaibaraAcademic from "../assets/images/haibara_academic_1779716437995.webp";
import assetUsagiStudy from "../assets/images/usagi_perfect_1779717893221.webp";

export type DemoUserIdentity = {
  id: string;
  name: string;
  subtitle: string;
  avatar: string;
};

const DEMO_USER_IDENTITIES: DemoUserIdentity[] = [
  { id: "demo2024", name: "原始 Demo", subtitle: "演示账号 · 原始入口", avatar: assetAnimeClassroom },
  { id: "1001", name: "陈星遥", subtitle: "全栈方向 · 偏项目实战", avatar: assetHaibaraAcademic },
  { id: "1002", name: "林澈", subtitle: "前端方向 · 偏结构化复盘", avatar: assetUsagiStudy },
  { id: "1003", name: "林知夏", subtitle: "交互设计方向 · 偏资料整理", avatar: assetAnimeClassroom },
  { id: "1004", name: "宋知远", subtitle: "数据分析方向 · 偏图表梳理", avatar: assetUsagiStudy },
  { id: "1005", name: "许嘉禾", subtitle: "产品方向 · 偏体验表达", avatar: assetHaibaraAcademic },
  { id: "1006", name: "罗以安", subtitle: "AI 工程方向 · 偏智能体联动", avatar: assetAnimeClassroom },
  { id: "1007", name: "周予安", subtitle: "后端方向 · 偏微服务联调", avatar: assetHaibaraAcademic },
  { id: "1008", name: "沈砚舟", subtitle: "课程运营方向 · 偏资源编排", avatar: assetUsagiStudy },
  { id: "1009", name: "顾言川", subtitle: "测评方向 · 偏错因归纳", avatar: assetAnimeClassroom },
  { id: "1010", name: "程启航", subtitle: "平台工程方向 · 偏架构治理", avatar: assetHaibaraAcademic },
];

const demoUserIdentityMap = new Map(DEMO_USER_IDENTITIES.map((item) => [item.id, item]));

export function getDemoUserIdentity(userId?: string | null) {
  if (!userId) return undefined;
  return demoUserIdentityMap.get(String(userId));
}

export { DEMO_USER_IDENTITIES };
