import { DEMO_USER_IDENTITIES } from "./demoUserIdentity";

export type DemoUserProfile = {
  id: string;
  name: string;
  subtitle: string;
  avatar: string;
};

export type DemoUserExperienceConfig = {
  tutorFocus: string;
  tutorWelcome: string;
  tutorPlaceholder: string;
  tutorPrompts: string[];
  primaryCourseId: string;
  recommendedCourseIds: string[];
  recommendationReasons: string[];
  recommendationBadges: string[];
  episodeLabels: string[];
};

export const DEMO_USER_PROFILES: DemoUserProfile[] = DEMO_USER_IDENTITIES;

const demoUserProfileMap = new Map(DEMO_USER_PROFILES.map((item) => [item.id, item]));
export const DISPLAY_DEMO_USER_PROFILES: DemoUserProfile[] = DEMO_USER_PROFILES;
const CLEAN_DEMO_PROFILE_OVERRIDES: Partial<Record<string, Partial<DemoUserProfile>>> = {};

const DEMO_USER_EXPERIENCE_CONFIGS: Record<string, DemoUserExperienceConfig> = {
  "1001": {
    tutorFocus: "软件工程主线、课堂资料串联和答辩表达",
    tutorWelcome: "我会优先帮你把课程重点、项目主线和答辩表达串起来，先解决现在最影响推进的卡点。",
    tutorPlaceholder: "直接问当前实现、资料重点或答辩讲法",
    tutorPrompts: ["帮我梳理这节课重点", "把当前页面改成更产品化", "给我一版答辩表达提纲"],
    primaryCourseId: "series-2",
    recommendedCourseIds: ["series-2", "course-4", "series-3"],
    recommendationReasons: [
      "这门课最适合先打通当前项目的工程主线，再回到资料和答辩表达里补细节。",
      "适合作为项目推进补充课，能把范围拆解、任务排布和验收讲法串起来。",
      "这门课更适合作为界面表达补强，用来提升首页和课堂页的呈现完成度。",
    ],
    recommendationBadges: ["当前主线", "项目推进", "表现补强"],
    episodeLabels: ["15/16", "3/4", "9/12"],
  },
  "1002": {
    tutorFocus: "前端工程化、页面结构收束和设计系统表达",
    tutorWelcome: "我会更关注页面结构、组件职责和视觉秩序，尽量把方案收得更像成熟产品。",
    tutorPlaceholder: "直接问页面结构、组件边界或设计系统表达",
    tutorPrompts: ["这块布局怎么收得更高级", "帮我拆组件边界", "给我一版更像产品页的改法"],
    primaryCourseId: "series-1",
    recommendedCourseIds: ["series-1", "series-2", "series-3"],
    recommendationReasons: [
      "你当前更适合先做页面结构和设计系统表达，这门课能直接影响首页和资源页质量。",
      "React 这门课适合作为工程实现补充，把状态边界和组件职责继续做实。",
      "动效课适合作为第三步补强，用来提升活动页感和信息层次。",
    ],
    recommendationBadges: ["设计主线", "工程补强", "动效表达"],
    episodeLabels: ["15/16", "15/16", "9/12"],
  },
  "1003": {
    tutorFocus: "交互表现、视觉拆解和高密度资料编排",
    tutorWelcome: "我会优先从视觉层次、动效节奏和信息编排上给你建议，让页面更有完成度。",
    tutorPlaceholder: "直接问视觉拆解、动效节奏或资料排布",
    tutorPrompts: ["这块视觉为什么不高级", "给首屏加活动页感", "帮我重排信息密度"],
    primaryCourseId: "series-3",
    recommendedCourseIds: ["series-3", "series-1", "series-2"],
    recommendationReasons: [
      "先把交互动效和视觉节奏做好，更符合你当前偏视觉拆解的学习方式。",
      "设计系统课能帮你把页面组织和信息密度收得更产品化。",
      "React 工程课更适合作为实现侧补充，放在第三步推进更顺。",
    ],
    recommendationBadges: ["视觉主线", "信息组织", "实现补充"],
    episodeLabels: ["9/12", "15/16", "15/16"],
  },
  "1004": {
    tutorFocus: "数据表达、页面信息结构和图表叙事",
    tutorWelcome: "我会优先帮你把信息结构和图表叙事讲清楚，让结果更容易看懂和汇报。",
    tutorPlaceholder: "直接问信息结构、图表表达或汇报逻辑",
    tutorPrompts: ["这个图怎么画得更高级", "帮我压缩成一屏重点", "把数据讲成汇报故事"],
    primaryCourseId: "series-1",
    recommendedCourseIds: ["series-1", "course-4", "series-3"],
    recommendationReasons: [
      "设计系统课最适合先帮你建立信息结构和版面秩序。",
      "项目实训课适合第二步进入，把数据分析结果变成能汇报的故事线。",
      "动效课用于最后补表现层，让信息展示更有节奏感。",
    ],
    recommendationBadges: ["结构优先", "汇报转化", "表现细化"],
    episodeLabels: ["15/16", "3/4", "9/12"],
  },
  "1005": {
    tutorFocus: "产品表达、项目叙事和关键页面体验",
    tutorWelcome: "我会从产品视角帮你收束页面叙事、关键动作和体验优先级，让结果更像真实上线产品。",
    tutorPlaceholder: "直接问产品叙事、页面体验或关键动作设计",
    tutorPrompts: ["这页最该保留什么", "帮我把文案改得更产品化", "给我一个更顺的用户路径"],
    primaryCourseId: "course-4",
    recommendedCourseIds: ["course-4", "series-1", "series-2"],
    recommendationReasons: [
      "项目实训课最适合你当前的产品表达方向，先把故事线和验收讲法收清楚。",
      "设计系统课适合第二步补界面秩序和用户友好度。",
      "React 工程课最后补实现边界，避免表达和实现脱节。",
    ],
    recommendationBadges: ["产品主线", "体验补强", "实现补位"],
    episodeLabels: ["3/4", "15/16", "15/16"],
  },
  "1006": {
    tutorFocus: "多智能体联动、联网补资料和课堂内资源生成",
    tutorWelcome: "我会优先围绕多智能体协作、联网补资料、讲义/PPT/练习生成来帮你推进实现。",
    tutorPlaceholder: "直接问多智能体联动、联网检索或资料生成",
    tutorPrompts: ["帮我设计多智能体协同链路", "这次要不要联网补资料", "按当前课堂生成讲义和 PPT"],
    primaryCourseId: "series-3",
    recommendedCourseIds: ["series-3", "series-2", "course-4"],
    recommendationReasons: [
      "这门课最适合你当前的 AI 工程方向，先打通多智能体和工具调用认知。",
      "React 工程课适合作为第二步补前端落地，把智能体入口真正接进页面。",
      "项目实训课最后补答辩与汇报，把功能讲成完整产品故事。",
    ],
    recommendationBadges: ["AI 主线", "前端落地", "答辩转化"],
    episodeLabels: ["4/4", "15/16", "3/4"],
  },
  "1007": {
    tutorFocus: "微服务联调、网关治理和跨模块协作",
    tutorWelcome: "我会更偏向服务协作、接口链路和模块联调，先帮你把端到端链路打通。",
    tutorPlaceholder: "直接问接口链路、模块协作或联调问题",
    tutorPrompts: ["帮我排这个联调问题", "这条接口链路怎么串", "给我一个跨模块排查顺序"],
    primaryCourseId: "series-3",
    recommendedCourseIds: ["series-3", "course-4", "series-2"],
    recommendationReasons: [
      "大模型与系统协同课更适合先帮你建立服务协作和工具调用视角。",
      "项目实训课适合第二步承接，转到真实交付和协作拆分上。",
      "React 工程课用于最后补前台联动，帮助你看清端到端链路。",
    ],
    recommendationBadges: ["协作主线", "交付联调", "前台补链"],
    episodeLabels: ["4/4", "3/4", "15/16"],
  },
  "1008": {
    tutorFocus: "课程运营、资源编排和连续学习工作台",
    tutorWelcome: "我会优先帮你整理资源顺序、学习工作台和连续复习节奏，让页面更像真实学习产品。",
    tutorPlaceholder: "直接问资源编排、学习工作台或复习顺序",
    tutorPrompts: ["这页资源顺序怎么排", "帮我缩短页面但保留重点", "给我一个连续学习工作台方案"],
    primaryCourseId: "course-4",
    recommendedCourseIds: ["course-4", "series-1", "series-3"],
    recommendationReasons: [
      "项目实训课最适合你当前的资源编排方向，先把连续工作台和叙事顺序理清。",
      "设计系统课适合第二步优化呈现层，让资源页和收藏页更产品化。",
      "AI 课最后补智能体协作，让资料生成逻辑更完整。",
    ],
    recommendationBadges: ["运营主线", "界面整理", "智能补链"],
    episodeLabels: ["3/4", "15/16", "4/4"],
  },
  "1009": {
    tutorFocus: "测评反馈、错因归纳和学习报告解释",
    tutorWelcome: "我会优先解释测评结果、错因归纳和下一步补救动作，让反馈更可执行。",
    tutorPlaceholder: "直接问错因、测评反馈或下一步补强动作",
    tutorPrompts: ["帮我解释这次测评结果", "总结我的薄弱点", "给我一版下一步补强顺序"],
    primaryCourseId: "series-2",
    recommendedCourseIds: ["series-2", "course-4", "series-3"],
    recommendationReasons: [
      "React 工程课最适合作为当前主线，便于你围绕实现细节做错因归纳。",
      "项目实训课可以把结果转成可汇报的结论和下一步动作。",
      "AI 课最后补智能反馈链路，让测评和导师回答更连贯。",
    ],
    recommendationBadges: ["测评主线", "结论转化", "反馈补强"],
    episodeLabels: ["15/16", "3/4", "4/4"],
  },
  "1010": {
    tutorFocus: "平台架构、模块治理和多页面联动",
    tutorWelcome: "我会优先站在平台架构和模块治理视角，帮你把多页面联动和状态边界收清楚。",
    tutorPlaceholder: "直接问平台架构、模块治理或页面联动",
    tutorPrompts: ["帮我梳理模块边界", "这几个页面怎么联动", "给我一个状态治理方案"],
    primaryCourseId: "series-3",
    recommendedCourseIds: ["series-3", "series-2", "course-4"],
    recommendationReasons: [
      "AI 系统课最适合先建立平台协作与模块治理视角。",
      "React 工程课第二步补前端模块边界和交互联动实现。",
      "项目实训课最后回到交付和验收视角，把平台能力讲成成果。",
    ],
    recommendationBadges: ["平台主线", "模块治理", "交付落点"],
    episodeLabels: ["4/4", "15/16", "3/4"],
  },
};

export function getDemoUserProfile(userId?: string | number | null) {
  if (userId === undefined || userId === null) return null;
  const base = demoUserProfileMap.get(String(userId));
  if (!base) return null;
  return {
    ...base,
    ...CLEAN_DEMO_PROFILE_OVERRIDES[String(userId)],
  };
}

export function getDemoUserExperienceConfig(userId?: string | number | null) {
  if (userId === undefined || userId === null) return DEMO_USER_EXPERIENCE_CONFIGS["1001"];
  return DEMO_USER_EXPERIENCE_CONFIGS[String(userId)] || DEMO_USER_EXPERIENCE_CONFIGS["1001"];
}
