import {
  AI_ANNOTATION_RULES,
  type AnnotationIntent,
  type AnnotationRule,
} from "../data/aiAnnotationRules";

export type AnnotationLearningTask = {
  id: string;
  sourceWorkOrder: string;
  taskName: string;
  taskDescription: string;
  workContext: string;
  steps: string[];
  knowledgePoints: string[];
  skillPoints: string[];
  safetyPoints: string[];
  deliverables: string[];
  acceptanceCriteria: string[];
  citations: string[];
  ruleId: string;
  reviewStatus: AnnotationRule["reviewStatus"];
};

export type LearningTaskGenerationResult =
  | { status: "ready"; task: AnnotationLearningTask }
  | { status: "clarify"; message: string };

const intentLabels: Record<AnnotationIntent, string> = {
  occlusion: "遮挡目标",
  truncation: "截断目标",
  instances: "同类实例",
};

const taskDetails: Record<
  AnnotationIntent,
  Pick<AnnotationLearningTask, "steps" | "knowledgePoints" | "skillPoints" | "acceptanceCriteria">
> = {
  occlusion: {
    steps: [
      "读取工单中的目标类别、任务类型和本批次标注规则。",
      "逐个判断目标是否仍可辨认，并区分目标、遮挡物和背景。",
      "沿可见目标轮廓绘制紧致 bbox；不凭想象补全被遮挡区域。",
      "按学校平台规则填写遮挡属性，完成实例数量、边界与类别复核。",
    ],
    knowledgePoints: ["目标检测 bbox", "遮挡与截断的区别", "标注一致性与质量审核"],
    skillPoints: ["可辨认性判断", "可见轮廓框选", "遮挡属性核对", "批次一致性复核"],
    acceptanceCriteria: [
      "任务记录中逐项列出目标类别、实例数量和遮挡判断。",
      "每个可辨认实例均有独立 bbox，且框内不包含大块无关背景或完整遮挡物。",
      "属性字段名称、取值和必填性均能对应教师核验后的平台 schema。",
      "提交一份含问题样本编号、修改前后结论和复核结果的质检记录。",
    ],
  },
  truncation: {
    steps: [
      "读取工单并确认任务类型、目标类别、图像尺寸和坐标格式。",
      "判断目标是否确实越出画面，避免把完整贴边目标误判为截断。",
      "对可辨认目标绘制贴合图像边缘的 bbox，不补画画外区域。",
      "按学校平台规则核对截断属性及 x、y、width、height 后提交质检。",
    ],
    knowledgePoints: ["图像边界与截断", "COCO bbox 坐标结构", "贴边目标与截断目标的区别"],
    skillPoints: ["边界截断判定", "贴边 bbox 绘制", "坐标范围检查", "截断属性核对"],
    acceptanceCriteria: [
      "能够给每个样本标明完整贴边或真实截断，并写出可观察依据。",
      "bbox 坐标顺序正确、宽高为正，几何范围不超出当前图像画布。",
      "不把 COCO 格式说明冒充学校 truncated 字段规范。",
      "提交一份包含图像尺寸、bbox 和异常处理结论的质检记录。",
    ],
  },
  instances: {
    steps: [
      "读取工单中的类别表和独立实例定义。",
      "利用可见轮廓、位置和遮挡关系判断同类目标是否可分别辨认。",
      "为每个可辨认实例分别绘制 bbox，不用一个大框合并多个实例。",
      "检查漏标、重复框、实例 ID 与 category_id 映射后提交质检。",
    ],
    knowledgePoints: ["实例与类别", "同类目标分界", "iscrowd 的格式边界", "完整性审核"],
    skillPoints: ["独立实例计数", "粘连目标拆分", "重复框检查", "实例标识核对"],
    acceptanceCriteria: [
      "工单中的可辨认同类实例分别计数并分别关联类别。",
      "不存在用一个大框替代多个独立实例框的情况。",
      "无法可靠分界的样本保留编号、疑点和升级质检记录，不强行猜测。",
      "提交一份实例数量、重复框和漏标检查清单。",
    ],
  },
};

function matchRules(input: string): AnnotationRule[] {
  const normalized = input.toLowerCase();
  return AI_ANNOTATION_RULES.filter((rule) =>
    rule.keywords.some((keyword) => normalized.includes(keyword)),
  );
}

export function generateAnnotationLearningTask(input: string): LearningTaskGenerationResult {
  const sourceWorkOrder = input.trim();
  if (!sourceWorkOrder) {
    return { status: "clarify", message: "请先粘贴真实或脱敏后的数据标注工单，再生成学习任务卡。" };
  }

  const matched = matchRules(sourceWorkOrder);
  const intents = [...new Set(matched.map((rule) => rule.intent))];
  if (intents.length !== 1) {
    return {
      status: "clarify",
      message: intents.length > 1
        ? "工单同时包含多类现象。请先选定遮挡、截断或同类实例中的一个微任务。"
        : "尚未识别工单中的微任务。请补充遮挡、目标出画面（截断）或同类目标粘连等可观察现象。",
    };
  }

  const intent = intents[0];
  const rule = AI_ANNOTATION_RULES.find((item) => item.intent === intent);
  if (!rule) {
    return { status: "clarify", message: "未找到对应候选规则，请交由教师确认任务范围。" };
  }

  const details = taskDetails[intent];
  return {
    status: "ready",
    task: {
      id: `LT-${rule.id}`,
      sourceWorkOrder,
      taskName: `${intentLabels[intent]}标注与质检学习任务`,
      taskDescription: `将企业或实训工单中的“${intentLabels[intent]}”处理要求转化为可执行、可验收的目标检测标注训练。`,
      workContext: "AI 数据标注工程师在目标检测数据生产或校内仿真实训中，依据批次规则完成框选、属性核对和提交前质检。",
      steps: details.steps,
      knowledgePoints: details.knowledgePoints,
      skillPoints: details.skillPoints,
      safetyPoints: [
        "只使用已授权或脱敏的训练图像与工单，不上传人脸、车牌、账号等未授权敏感信息。",
        "学校平台字段、阈值与异常处理必须以教师核验后的 schema/实训手册为准。",
        "无法确认类别或边界时保留样本编号并升级质检，不用猜测替代证据。",
      ],
      deliverables: [
        "完成后的目标检测标注文件或平台任务记录",
        "一份逐项质检检查表",
        "一份争议样本与处理依据记录",
      ],
      acceptanceCriteria: details.acceptanceCriteria,
      citations: [`${rule.sourceId} · ${rule.sourceLocator}`, rule.source],
      ruleId: rule.id,
      reviewStatus: rule.reviewStatus,
    },
  };
}
