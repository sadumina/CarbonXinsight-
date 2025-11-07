import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

export default function TradingViewChart({ chartData, onPointClick }) {
  const containerRef = useRef(null);
  const chart = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // destroy old chart before creating new one
    if (chart.current) chart.current.remove();

    chart.current = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 470,
      layout: {
        backgroundColor: "#0d1117",
        textColor: "#e7ecef",
      },
      grid: {
        vertLines: { color: "rgba(0,255,213,0.08)" },
        horzLines: { color: "rgba(0,255,213,0.08)" },
      },
      crosshair: { mode: 1 },
      timeScale: { borderColor: "#2a2e35" },
    });

    // multiple markets → multiple line series
    Object.keys(chartData).forEach((country, index) => {
      const series = chart.current.addLineSeries({
        color: ["#00ffd5", "#f9c74f", "#ff5ea3", "#4cc9f0", "#c6ff00"][index % 5],
        lineWidth: 2,
      });

      series.setData(chartData[country]);

      series.subscribeClick((param) => {
        if (param?.time) {
          const point = chartData[country].find((p) => p.time === param.time);
          if (point) {
            onPointClick({
              country,
              date: point.time,
              price: point.value,
            });
          }
        }
      });
    });

    return () => chart.current.remove();
  }, [chartData]);

  return <div ref={containerRef} style={{ width: "100%", height: "470px" }} />;
}
