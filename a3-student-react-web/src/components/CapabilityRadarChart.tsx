import React from "react";

type RadarDatum = {
  subject: string;
  score: number;
  fullMark: number;
};

export function CapabilityRadarChart({ data }: { data: RadarDatum[] }) {
  const maxScore = Math.max(...data.map((item) => item.fullMark || 100), 1);
  const axes = data.map((_, index) => -90 + (360 / Math.max(data.length, 1)) * index);

  const toPoint = (score: number, angle: number, radius = 38) => {
    const ratio = score / maxScore;
    const radians = (angle * Math.PI) / 180;
    return {
      x: 50 + radius * ratio * Math.cos(radians),
      y: 50 + radius * ratio * Math.sin(radians),
    };
  };

  const polygonPoints = data
    .map((item, index) => {
      const point = toPoint(item.score, axes[index] || 0);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="h-[400px] w-full rounded-xl bg-surface-variant/20 p-4">
      <div className="flex h-full items-center justify-center">
        <svg viewBox="0 0 100 100" className="h-full w-full max-w-[420px]">
          <circle cx="50" cy="50" r="38" fill="none" stroke="#e5e7eb" strokeDasharray="2 2" />
          <circle cx="50" cy="50" r="26" fill="none" stroke="#e5e7eb" strokeDasharray="2 2" />
          <circle cx="50" cy="50" r="14" fill="none" stroke="#e5e7eb" strokeDasharray="2 2" />
          {axes.map((angle, index) => {
            const endpoint = toPoint(maxScore, angle, 38);
            return (
              <line
                key={`axis-${data[index]?.subject || index}`}
                x1="50"
                y1="50"
                x2={endpoint.x}
                y2={endpoint.y}
                stroke="#d1d5db"
                strokeWidth="0.8"
              />
            );
          })}
          <polygon points={polygonPoints} fill="rgba(0,193,123,0.16)" stroke="#00c17b" strokeWidth="1.8" />
          {data.map((item, index) => {
            const point = toPoint(item.score, axes[index] || 0);
            const label = toPoint(maxScore, axes[index] || 0, 48);
            return (
              <g key={item.subject}>
                <circle cx={point.x} cy={point.y} r="2.2" fill="#00c17b" />
                <text
                  x={label.x}
                  y={label.y}
                  fontSize="4"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#6b7280"
                  fontWeight="600"
                >
                  {item.subject}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
