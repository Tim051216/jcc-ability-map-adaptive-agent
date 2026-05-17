import { AlertTriangle, LoaderCircle, Wifi } from "lucide-react";

export function LoadingPanel({ title = "加载中" }: { title?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
      <div className="flex items-center gap-3 text-slate-600">
        <LoaderCircle className="h-5 w-5 animate-spin text-accent" />
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">正在请求后端数据...</p>
        </div>
      </div>
    </div>
  );
}

export function ErrorPanel({
  title = "数据暂不可用",
  detail,
}: {
  title?: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-500" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-rose-900">{title}</p>
          <p className="text-sm text-rose-700">{detail}</p>
        </div>
      </div>
    </div>
  );
}

export function ReachableBadge({
  label,
  status,
}: {
  label: string;
  status?: string | null;
}) {
  const normalized = status ?? "checking";
  const healthy = normalized === "ok";
  const checking = normalized === "checking";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
        healthy
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : checking
            ? "border-slate-200 bg-slate-100 text-slate-600"
            : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      <Wifi className={`h-3.5 w-3.5 ${checking ? "animate-pulse" : ""}`} />
      <span>{label}</span>
      <span>{healthy ? "已连通" : checking ? "检测中" : normalized}</span>
    </div>
  );
}
