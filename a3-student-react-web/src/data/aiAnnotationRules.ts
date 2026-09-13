/**
 * AI 数据标注实训规则库（候选版）。
 *
 * 这 3 条是当前微任务的确定性执行规则；更广的岗位知识目录位于
 * `aiAnnotationKnowledge.ts`，两者分开维护，避免把“核心分支数”与“知识条目数”混为一谈。
 * 规则中的职业标准用于说明任务范围和质量能力，不直接替代学校标注平台 schema。
 */
export type AnnotationIntent = "occlusion" | "truncation" | "instances";
export type AnnotationSourceId = "S1" | "S2" | "S3" | "S4";
export type AnnotationRuleReviewStatus = "candidate" | "verified";

export type AnnotationRule = {
  id: string;
  intent: AnnotationIntent;
  title: string;
  text: string;
  source: string;
  sourceId: AnnotationSourceId;
  sourceLocator: string;
  reviewStatus: AnnotationRuleReviewStatus;
  keywords: string[];
};

export const AI_ANNOTATION_RULES: readonly AnnotationRule[] = [
  {
    id: "ANN-OCC-01",
    intent: "occlusion",
    title: "遮挡判定",
    text: "目标仍可辨认且可见区域达到标注规范要求时，沿可见目标轮廓标注；被完全遮挡且无法确认类别不强行补框。occluded 字段名称须以学校平台 schema/教师核验版为准。",
    source:
      "候选依据：《数据标注职业技能等级标准（2021 年 1.0 版）》p.8、p.11；可见区域与 occluded 规则待教师按平台指南核验",
    sourceId: "S1",
    sourceLocator: "PDF p.8、p.11（图像 2D 拉框/质检相关条目）",
    reviewStatus: "candidate",
    keywords: ["挡", "遮挡", "被车", "看不全"],
  },
  {
    id: "ANN-TRU-01",
    intent: "truncation",
    title: "截断判定",
    text: "目标超出图像边界时，框贴合图像边缘并保留可见部分；是否填写 truncated 以及字段名称须以学校平台 schema/教师核验版为准。",
    source:
      "候选依据：Microsoft COCO Dataset Data Format 仅说明 bbox=[x,y,width,height]、area、iscrowd；不定义 occluded/truncated，边界校验按学校平台规则",
    sourceId: "S3",
    sourceLocator: "COCO Data Format：annotation.bbox、area、iscrowd（官方格式页）",
    reviewStatus: "candidate",
    keywords: ["截断", "出画面", "边缘", "切出"],
  },
  {
    id: "ANN-INS-01",
    intent: "instances",
    title: "同类目标",
    text: "两个可独立辨认的实例必须分别标框；相互遮挡也不能把多个实例合并为一个框。具体质检阈值按课程实训手册执行。",
    source:
      "候选依据：《人工智能训练师国家职业技能标准（2021 年版）》p.5、p.10、p.12；实例拆分规则待教师核验",
    sourceId: "S2",
    sourceLocator: "PDF p.5、p.10、p.12（数据标注工种与准确性/完整性审核）",
    reviewStatus: "candidate",
    keywords: ["同类", "粘连", "挨", "几个框", "两个目标"],
  },
];

export const AI_ANNOTATION_RULE_COUNT = AI_ANNOTATION_RULES.length;
