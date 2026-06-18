import React from "react";

type AILoadingLottieProps = {
  className?: string;
  caption?: string;
  subcaption?: string;
};

export default function AILoadingLottie({ className = "", caption, subcaption }: AILoadingLottieProps) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[22px] border border-white/70 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),rgba(248,250,255,0.72))] shadow-[0_16px_34px_rgba(15,23,42,0.10)]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute h-[76%] w-[76%] animate-[spin_4.6s_linear_infinite] rounded-full border-[5px] border-transparent border-t-[#fb7299]/75 border-r-[#fb7299]/18" />
          <div className="absolute h-[52%] w-[52%] animate-[spin_3.4s_linear_infinite_reverse] rounded-full border-[4px] border-transparent border-t-[#18b7a8]/80 border-r-[#18b7a8]/20" />
          <div className="h-5 w-5 animate-[pulse_1.8s_ease-in-out_infinite] rounded-full bg-[#111827] shadow-[0_0_0_6px_rgba(17,24,39,0.06)]" />
        </div>
      </div>
      {caption ? (
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#fb7299]">AI Runtime</div>
          <div className="mt-1 text-sm font-extrabold text-[#171c22]">{caption}</div>
          {subcaption ? <div className="mt-1 text-[12px] leading-5 text-[#667085]">{subcaption}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
