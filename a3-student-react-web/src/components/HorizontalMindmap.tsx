import type { StoredMindmapNode } from "../lib/courseResourceWorkspace";

type HorizontalMindmapProps = {
  nodes: StoredMindmapNode[];
  title?: string;
  subtitle?: string;
  variant?: "compact" | "full";
};

type MindmapPalette = {
  rail: string;
  border: string;
  bg: string;
  text: string;
  chip: string;
};

const BRANCH_PALETTES: MindmapPalette[] = [
  {
    rail: "bg-[#fb7185]",
    border: "border-[#fecdd3]",
    bg: "bg-[#fff5f7]",
    text: "text-[#9f1239]",
    chip: "bg-[#ffe4ea]",
  },
  {
    rail: "bg-[#38bdf8]",
    border: "border-[#bae6fd]",
    bg: "bg-[#f0f9ff]",
    text: "text-[#0c4a6e]",
    chip: "bg-[#dff4ff]",
  },
  {
    rail: "bg-[#34d399]",
    border: "border-[#bbf7d0]",
    bg: "bg-[#f0fdf4]",
    text: "text-[#166534]",
    chip: "bg-[#dcfce7]",
  },
  {
    rail: "bg-[#f59e0b]",
    border: "border-[#fde68a]",
    bg: "bg-[#fffbeb]",
    text: "text-[#92400e]",
    chip: "bg-[#fef3c7]",
  },
  {
    rail: "bg-[#a78bfa]",
    border: "border-[#ddd6fe]",
    bg: "bg-[#f5f3ff]",
    text: "text-[#5b21b6]",
    chip: "bg-[#ede9fe]",
  },
];

function MindmapLeaf({
  label,
  tone,
  compact = false,
}: {
  label: string;
  tone: MindmapPalette;
  compact?: boolean;
  key?: string;
}) {
  return (
    <div
      className={`rounded-2xl border ${tone.border} ${tone.bg} ${
        compact ? "px-3 py-2 text-[12px] leading-5" : "px-3.5 py-2.5 text-[13px] leading-5"
      } ${tone.text} relative shadow-[0_10px_24px_rgba(15,23,42,0.05)]`}
    >
      <span className={`absolute left-0 top-3 h-2.5 w-1 rounded-r-full ${tone.rail}`} />
      {label}
    </div>
  );
}

function MindmapBranch({
  node,
  tone,
  index,
}: {
  node: StoredMindmapNode;
  tone: MindmapPalette;
  index: number;
  key?: string;
}) {
  return (
    <section className="relative min-w-[260px] max-w-[300px] flex-1 pl-7">
      <div className="absolute left-0 top-7 h-[calc(100%-2rem)] w-px bg-[#E2E8F0]" />
      <div className={`absolute left-0 top-7 h-1 w-8 rounded-full ${tone.rail}`} />
      <div className={`rounded-[24px] border ${tone.border} ${tone.bg} p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]`}>
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full ${tone.chip} px-2 text-[10px] font-black ${tone.text}`}
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${tone.text} opacity-70`}>Branch</div>
            <h4 className={`mt-1 text-sm font-black leading-5 ${tone.text}`}>{node.label}</h4>
          </div>
        </div>

        {node.children.length ? (
          <div className="mt-3.5 space-y-3">
            {node.children.map((child) => (
              <div key={child.id} className="relative space-y-2 pl-3">
                <div className="absolute left-0 top-4 h-px w-2 rounded-full bg-[#D0D5DD]" />
                <MindmapLeaf label={child.label} tone={tone} />
                {child.children.length ? (
                  <div className="ml-3 space-y-2 border-l border-dashed border-[#DDE3EA] pl-3">
                    {child.children.map((grandChild) => (
                      <MindmapLeaf key={grandChild.id} label={grandChild.label} tone={tone} compact />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3">
            <MindmapLeaf label="等待补充分支内容" tone={tone} compact />
          </div>
        )}
      </div>
    </section>
  );
}

export default function HorizontalMindmap({
  nodes,
  title = "Knowledge Mindmap",
  subtitle = "按核心主线横向展开，快速看清概念层级、分支关系和复习路径。",
  variant = "full",
}: HorizontalMindmapProps) {
  const [root, ...branches] = nodes;
  const branchNodes = root?.children?.length ? root.children : nodes;
  const compact = variant === "compact";

  return (
    <div
      className={`rounded-[28px] border border-[#E2E8F0] bg-[radial-gradient(circle_at_top_left,#fff7fb,transparent_28%),linear-gradient(180deg,#f8fbff,#f8fafc)] shadow-[0_14px_36px_rgba(15,23,42,0.08)] ${
        compact ? "p-3.5" : "p-4"
      }`}
    >
      <div className={`flex items-start justify-between gap-3 ${compact ? "mb-3" : "mb-4"}`}>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#667085]">{title}</div>
          <p className={`mt-1 text-[#344054] ${compact ? "text-[13px] leading-5" : "text-sm"}`}>{subtitle}</p>
        </div>
      </div>

      <div className={`overflow-x-auto rounded-[28px] bg-white/95 ${compact ? "p-4" : "p-5"}`}>
        <div className={`flex items-start ${compact ? "min-w-[940px] gap-4" : "min-w-[1120px] gap-6"}`}>
          <section
            className={`sticky left-0 top-0 z-[1] shrink-0 rounded-[28px] border border-[#F3D8E2] bg-[linear-gradient(180deg,#fff7fa,#fffefe)] shadow-[0_16px_40px_rgba(251,113,133,0.14)] ${
              compact ? "w-[220px] p-4" : "w-[250px] p-5"
            }`}
          >
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#d94f7d]">Core Topic</div>
            <h3 className={`mt-3 font-black text-[#171c22] ${compact ? "text-[17px] leading-6" : "text-lg leading-7"}`}>{root?.label || "当前章节导图"}</h3>
            <div
              className={`mt-4 rounded-2xl bg-[#fff1f5] text-[#6b3143] ${
                compact ? "px-3 py-2 text-[11px] leading-5" : "px-3 py-2 text-[12px] leading-5"
              }`}
            >
              当前共整理 {branchNodes.length} 个主分支，建议先顺着主干看结构，再按分支逐个展开复习。
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#fff5f7] px-2.5 py-1 text-[11px] font-semibold text-[#b4235a]">主线先行</span>
              <span className="rounded-full bg-[#f5faff] px-2.5 py-1 text-[11px] font-semibold text-[#175cd3]">层级展开</span>
              <span className="rounded-full bg-[#f2fbf7] px-2.5 py-1 text-[11px] font-semibold text-[#067647]">复习友好</span>
            </div>
          </section>

          <div className={`flex min-w-0 flex-1 items-start ${compact ? "gap-4" : "gap-5"}`}>
            {branchNodes.map((node, index) => (
              <MindmapBranch
                key={node.id}
                node={node}
                index={index}
                tone={BRANCH_PALETTES[index % BRANCH_PALETTES.length]}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
