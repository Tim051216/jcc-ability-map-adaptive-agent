import React from "react";
import { RadarChart, PolarAngleAxis, PolarGrid, ResponsiveContainer, Radar as RadarArea } from "recharts";

type RadarDatum = {
  subject: string;
  score: number;
  fullMark: number;
};

export function CapabilityRadarChart({ data }: { data: RadarDatum[] }) {
  return (
    <div className="h-[400px] w-full rounded-xl bg-surface-variant/20 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" data={data} outerRadius="78%">
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "#6b7280", fontSize: 12, fontWeight: 600 }} />
          <RadarArea dataKey="score" stroke="#00c17b" fill="#00c17b" fillOpacity={0.16} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
