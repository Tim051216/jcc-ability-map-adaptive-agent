import type { ProfileSummaryResponse } from "./studentApi";

export type ResourceGenerationProfileContext = {
  sbti_code?: string | null;
  completeness?: number | null;
  current_stage?: string | null;
  recommended_learning_style?: string | null;
  tags?: string[];
  key_features?: string | null;
};

type BuildProfileAwareKnowledgePointsOptions = {
  profile: ProfileSummaryResponse | null;
  courseTitle: string;
  sectionTitle?: string | null;
  resourceTitle?: string | null;
  resourceSummary?: string | null;
  generationLabel?: string | null;
  searchQuery?: string | null;
  extraHints?: string[];
};

function pushUnique(target: string[], value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return;
  if (!target.includes(normalized)) target.push(normalized);
}

function buildProfileBehaviorHint(profile: ProfileSummaryResponse | null) {
  const sbtiCode = String(profile?.sbti_code || "").trim().toUpperCase();
  const learningStyle = String(profile?.recommended_learning_style || "").trim();
  const stage = String(profile?.current_stage || "").trim();
  const tags = (profile?.tags || []).slice(0, 4).join("、");
  const parts: string[] = [];

  if (sbtiCode) parts.push(`画像编码：${sbtiCode}`);
  if (stage) parts.push(`当前阶段：${stage}`);
  if (learningStyle) parts.push(`学习风格：${learningStyle}`);
  if (tags) parts.push(`画像标签：${tags}`);
  if (profile?.key_features) parts.push(`关键特征：${profile.key_features}`);

  return parts;
}

export function buildResourceGenerationProfileContext(
  profile: ProfileSummaryResponse | null,
): ResourceGenerationProfileContext | null {
  if (!profile) return null;
  return {
    sbti_code: profile.sbti_code ?? null,
    completeness: profile.completeness ?? null,
    current_stage: profile.current_stage ?? null,
    recommended_learning_style: profile.recommended_learning_style ?? null,
    tags: profile.tags || [],
    key_features: profile.key_features ?? null,
  };
}

export function buildProfileAwareKnowledgePoints(options: BuildProfileAwareKnowledgePointsOptions) {
  const points: string[] = [];
  const profile = options.profile;

  pushUnique(points, options.searchQuery);
  pushUnique(points, options.courseTitle);
  pushUnique(points, options.sectionTitle);
  pushUnique(points, options.resourceTitle);
  pushUnique(points, options.resourceSummary);
  pushUnique(points, options.generationLabel ? `生成目标：${options.generationLabel}` : null);

  for (const item of buildProfileBehaviorHint(profile)) {
    pushUnique(points, item);
  }

  const stage = String(profile?.current_stage || "").trim().toLowerCase();
  const style = String(profile?.recommended_learning_style || "").trim();
  const sbtiCode = String(profile?.sbti_code || "").trim().toUpperCase();

  if (sbtiCode.startsWith("SPT")) {
    pushUnique(points, "输出更偏任务拆解、实操步骤、案例验证和可执行结论");
  }
  if (style.includes("图") || style.includes("结构") || style.includes("框架")) {
    pushUnique(points, "输出更偏结构化提纲、层级关系和知识图示");
  }
  if (style.includes("实战") || style.includes("实践") || sbtiCode.includes("P")) {
    pushUnique(points, "输出更偏练习题、动手任务和项目化应用");
  }
  if (stage.includes("起步") || stage.includes("入门") || stage.includes("begin")) {
    pushUnique(points, "从基础概念开始，减少省略，避免默认读者已经掌握前置知识");
  }
  if (stage.includes("深化") || stage.includes("advanced") || stage.includes("提升")) {
    pushUnique(points, "补充进阶对照、易错点和延伸思考");
  }

  if (options.extraHints?.length) {
    for (const hint of options.extraHints) {
      pushUnique(points, hint);
    }
  }

  return points;
}
