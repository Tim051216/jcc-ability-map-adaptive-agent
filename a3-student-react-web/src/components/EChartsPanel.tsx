import React, { useEffect, useRef } from "react";
import { BarChart, HeatmapChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { init, use, type ECharts, type EChartsCoreOption } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

use([LineChart, BarChart, HeatmapChart, GridComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);

export default function EChartsPanel({
  option,
  height = 320,
  className = "",
}: {
  option: EChartsCoreOption;
  height?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = init(containerRef.current);
    chartRef.current = chart;
    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={containerRef} className={className} style={{ height }} />;
}
