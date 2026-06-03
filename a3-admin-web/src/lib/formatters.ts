export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "暂无";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "暂无";
  }

  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

export function formatRiskLabel(risk: string) {
  switch (risk) {
    case "high":
      return "高风险";
    case "medium":
      return "中风险";
    case "low":
    case "normal":
      return "低风险";
    default:
      return risk || "未标注";
  }
}

export function formatStatusLabel(status: string) {
  switch (status) {
    case "active":
    case "ok":
      return "正常";
    case "suspended":
      return "已暂停";
    case "pending":
      return "待处理";
    case "approved":
      return "已通过";
    case "rejected":
      return "已驳回";
    case "degraded":
      return "已降级";
    case "warning":
      return "预警";
    case "error":
      return "异常";
    case "unavailable":
      return "不可用";
    case "in_progress":
      return "进行中";
    case "blocked":
      return "已阻塞";
    case "unreported":
      return "未上报";
    case "checking":
      return "检测中";
    default:
      return status || "未知";
  }
}
