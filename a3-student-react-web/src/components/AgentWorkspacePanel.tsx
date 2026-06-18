import React from "react";
import { Link } from "react-router-dom";

type AgentMetric = {
  label: string;
  value: string;
};

type AgentAction = {
  label: string;
  title: string;
  detail: string;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  ctaLabel?: string;
};

interface AgentWorkspacePanelProps {
  badge: string;
  title: string;
  description: string;
  metrics: AgentMetric[];
  actions: AgentAction[];
  icon: React.ReactNode;
  statusLabel?: string;
  statusValue?: string;
  footnote?: string;
  compact?: boolean;
  className?: string;
}

export default function AgentWorkspacePanel({
  badge,
  title,
  description,
  metrics,
  actions,
  icon,
  statusLabel = "Agent Status",
  statusValue = "已进入持续协作状态",
  footnote = "页面上下文、推荐动作与当前任务已保持同步。",
  compact = false,
  className = "",
}: AgentWorkspacePanelProps) {
  const shouldShowBadge = badge.trim().length > 0;
  const shouldShowStatus = Boolean(statusLabel?.trim() || statusValue?.trim());

  return (
    <section
      className={`group relative overflow-hidden border border-[#d8e6f5] bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(245,250,255,0.96)_44%,rgba(236,245,255,0.94)_100%)] shadow-[0_18px_44px_rgba(15,23,42,0.06)] ${
        compact ? "rounded-[26px] p-4 lg:p-5" : "rounded-[30px] p-5 lg:p-6"
      } ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.18),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(251,114,153,0.10),transparent_24%)]" />
      <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.28),transparent)]" />
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(14,165,233,0.45),rgba(251,113,133,0.38),transparent)]" />

      <div
        className={`relative flex flex-col lg:flex-row lg:justify-between ${
          compact ? "gap-4 lg:items-center" : "gap-5 lg:items-end"
        }`}
      >
        <div className="relative max-w-3xl">
          {shouldShowBadge ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/92 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--project-primary)] shadow-[0_8px_18px_rgba(148,163,184,0.10)]">
              {icon}
              {badge}
            </div>
          ) : null}
          <h2 className={`font-black tracking-[-0.05em] text-[#111827] ${compact ? "mt-2.5 text-[22px] lg:text-[24px]" : "mt-3 text-[26px] lg:text-[30px]"}`}>{title}</h2>
          <p className={`max-w-2xl text-[#4b5563] ${compact ? "mt-2 text-[13px] leading-6" : "mt-3 text-sm leading-7"}`}>{description}</p>
          {shouldShowStatus ? (
            <div className={`inline-flex items-center gap-2 rounded-full bg-[#0f172a] text-[11px] font-black text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)] ${compact ? "mt-3 px-3 py-1.5" : "mt-4 px-3 py-1.5"}`}>
              <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              {statusLabel?.trim() ? (
                <span className="uppercase tracking-[0.16em] text-white/72">{statusLabel}</span>
              ) : null}
              {statusValue?.trim() ? <span className="text-white">{statusValue}</span> : null}
            </div>
          ) : null}
        </div>

        <div className={`relative grid gap-3 ${compact ? "sm:grid-cols-3 lg:w-[460px]" : "sm:grid-cols-3 lg:w-[520px]"}`}>
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={`border border-white/80 bg-white/90 shadow-[0_10px_24px_rgba(15,23,42,0.05)] backdrop-blur ${
                compact ? "rounded-[18px] px-3.5 py-2.5" : "rounded-[22px] px-4 py-3"
              }`}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a94a3]">{metric.label}</div>
              <div className={`font-black text-[#111827] ${compact ? "mt-1.5 text-[12px] leading-5" : "mt-2 text-[13px] leading-6"}`}>{metric.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={`relative grid gap-3 ${compact ? "mt-4 md:grid-cols-2" : "mt-5"}`}>
        {actions.map((action, index) => {
          const className =
            index === 0
              ? `border border-[#d9e7f5] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,249,255,0.96))] text-left shadow-[0_12px_28px_rgba(15,23,42,0.05)] backdrop-blur transition-all hover:-translate-y-1 hover:border-[#bfd8ee] hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)] ${
                  compact ? "rounded-[20px] p-3.5" : "rounded-[24px] p-4"
                }`
              : `border border-[#e5ebf1] bg-white/94 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] backdrop-blur transition-all hover:-translate-y-1 hover:border-[#c9d9ea] hover:shadow-[0_16px_32px_rgba(15,23,42,0.07)] ${
                  compact ? "rounded-[18px] p-3.5" : "rounded-[22px] p-4"
                }`;

          const content = (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--project-primary)]">
                    {compact ? action.label : index === 0 ? "Top Action" : `Action 0${index + 1}`}
                  </span>
                  <span className="rounded-full bg-[var(--project-primary-soft)] px-2 py-0.5 text-[10px] font-black text-[var(--project-primary)]">
                    {index === 0 ? "推荐" : "可立即做"}
                  </span>
                </div>
                <div className="text-[11px] font-black text-[var(--project-primary)]">
                  {compact ? "现在做" : index === 0 ? "优先" : "Go"}
                </div>
              </div>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3
                    className={`font-black ui-tracking-tight text-[#111827] ${
                      compact ? "text-[17px]" : index === 0 ? "text-[22px]" : "text-[18px]"
                    }`}
                  >
                    {action.title}
                  </h3>
                  <p
                    className={`text-[#4b5563] ${
                      compact
                        ? "mt-1.5 text-[12px] leading-5"
                        : index === 0
                          ? "mt-2 text-[14px] leading-7"
                          : "mt-2 text-sm leading-6"
                    }`}
                  >
                    {action.detail}
                  </p>
                </div>
                <div
                  className={`shrink-0 rounded-full bg-[#111827] text-[11px] font-black text-white shadow-[0_10px_22px_rgba(15,23,42,0.14)] ${
                    compact ? "px-2.5 py-1" : "px-3 py-1.5"
                  }`}
                >
                  {action.ctaLabel ?? (compact ? "进入" : index === 0 ? "立即开始" : "去执行")}
                </div>
              </div>
            </>
          );

          if (action.to) {
            return (
              <Link key={action.title} to={action.to} className={className}>
                {content}
              </Link>
            );
          }

          return (
            <button
              key={action.title}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {content}
            </button>
          );
        })}
      </div>

      <div
        className={`relative rounded-[20px] border border-white/80 bg-white/70 text-[12px] font-semibold text-[#56626d] shadow-[0_8px_20px_rgba(15,23,42,0.04)] ${
          compact ? "mt-3 px-3.5 py-2.5" : "mt-4 px-4 py-3"
        }`}
      >
        {footnote}
      </div>
    </section>
  );
}


