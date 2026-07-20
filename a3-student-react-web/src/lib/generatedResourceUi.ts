import type { LucideIcon } from "lucide-react";
import { FileText, Network, Presentation, Sparkles } from "lucide-react";

export type GeneratedResourceUiKind = "handout" | "mindmap" | "practice" | "ppt";

export type GeneratedResourceUiMeta = {
  label: string;
  actionLabel: string;
  resultLabel: string;
  description: string;
  pillClass: string;
  cardClass: string;
  borderClass: string;
  bgClass: string;
  iconClass: string;
  buttonClass: string;
  iconKey: "file" | "mindmap" | "practice" | "ppt";
};

const GENERATED_RESOURCE_META: Record<GeneratedResourceUiKind, GeneratedResourceUiMeta> = {
  handout: {
    label: "讲义资料",
    actionLabel: "查看资料",
    resultLabel: "讲义结果",
    description: "课堂讲义 / 重点梳理",
    pillClass: "bg-[#fff3f6] text-[#d64d7b]",
    cardClass: "border-[#f4d8e2] bg-[linear-gradient(180deg,#ffffff_0%,#fff9fb_100%)]",
    borderClass: "border-[#F4C9D8]",
    bgClass: "bg-[linear-gradient(135deg,#fff6fa_0%,#ffffff_70%)]",
    iconClass: "bg-[#fb7299]/10 text-[#fb7299]",
    buttonClass: "bg-[#FFF2F7] text-[#d64d82] hover:bg-[#FFE7F0]",
    iconKey: "file",
  },
  mindmap: {
    label: "导图资料",
    actionLabel: "查看资料",
    resultLabel: "导图结果",
    description: "知识结构 / 概念关系",
    pillClass: "bg-[#eefaf4] text-[#1f8f63]",
    cardClass: "border-[#d7eee3] bg-[linear-gradient(180deg,#ffffff_0%,#f7fdf9_100%)]",
    borderClass: "border-[#BFE8D8]",
    bgClass: "bg-[linear-gradient(135deg,#f4fffb_0%,#ffffff_70%)]",
    iconClass: "bg-[#10b981]/10 text-[#10b981]",
    buttonClass: "bg-[#ECFDF5] text-[#047857] hover:bg-[#D1FAE5]",
    iconKey: "mindmap",
  },
  practice: {
    label: "练习资料",
    actionLabel: "查看资料",
    resultLabel: "练习结果",
    description: "随堂测评 / 掌握检查",
    pillClass: "bg-[#fff8ed] text-[#c77b12]",
    cardClass: "border-[#f4e2bf] bg-[linear-gradient(180deg,#ffffff_0%,#fffdf8_100%)]",
    borderClass: "border-[#F4D99D]",
    bgClass: "bg-[linear-gradient(135deg,#fffaf0_0%,#ffffff_70%)]",
    iconClass: "bg-[#f59e0b]/12 text-[#d97706]",
    buttonClass: "bg-[#FFFBEB] text-[#b45309] hover:bg-[#FEF3C7]",
    iconKey: "practice",
  },
  ppt: {
    label: "PPT 课件",
    actionLabel: "导出 PPT",
    resultLabel: "PPT 结果",
    description: "课件草稿 / 分页汇报",
    pillClass: "bg-[#eef4ff] text-[#2563eb]",
    cardClass: "border-[#d9e5ff] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]",
    borderClass: "border-[#BED5F7]",
    bgClass: "bg-[linear-gradient(135deg,#f5f9ff_0%,#ffffff_70%)]",
    iconClass: "bg-[#2563eb]/10 text-[#2563eb]",
    buttonClass: "bg-[#EFF6FF] text-[#2563eb] hover:bg-[#DBEAFE]",
    iconKey: "ppt",
  },
};

const GENERATED_RESOURCE_ICONS: Record<GeneratedResourceUiMeta["iconKey"], LucideIcon> = {
  file: FileText,
  mindmap: Network,
  practice: Sparkles,
  ppt: Presentation,
};

export function getGeneratedResourceUiMeta(kind: GeneratedResourceUiKind) {
  return GENERATED_RESOURCE_META[kind];
}

export function getGeneratedResourceIcon(kind: GeneratedResourceUiKind) {
  return GENERATED_RESOURCE_ICONS[GENERATED_RESOURCE_META[kind].iconKey];
}
