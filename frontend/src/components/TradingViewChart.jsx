import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

export default function TradingViewChart({
  chartData,
  onPointClick,
  fromDate,
  toDate,
  selectedMarkets,
  onExportReady,    // <-- parent will receive export function
}) {
  const containerRef = useRef(null);
  const chart = useRef(null);

  // ✅ Allow parent to call export()
  useEffect(() => {
    onExportReady(() => exportChart());
  });

  useEffect(() => {
    if (!containerRef.current) return;

    if (chart.current) chart.current.remove();

    chart.current = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 470,
      layout: {
        backgroundColor: "#0d1117",
        textColor: "#e7ecef",
      },
      grid: {
        vertsLines: { color: "rgba(0,255,213,0.08)" },
        horzLines: { color: "rgba(0,255,213,0.08)" },
      },
      timeScale: { borderColor: "#2a2e35" },
      crosshair: { mode: 1 },
    });

    Object.keys(chartData).forEach((country, index) => {
      const series = chart.current.addLineSeries({
        color: ["#00ffd5", "#6CD17A", "#4cc9f0", "#f9c74f", "#ff5ea3"][index % 5],
        lineWidth: 2,
      });

      series.setData(chartData[country]);

      // comparison drawer trigger
      series.subscribeClick((param) => {
        if (param?.time) {
          const point = chartData[country].find((p) => p.time === param.time);
          if (point) onPointClick({ country, date: point.time, price: point.value });
        }
      });
    });

    return () => chart.current.remove();
  }, [chartData]);

  /** ✅ EXPORT WITH DATE RANGE + LEGEND */
  function exportChart() {
    chart.current.takeScreenshot().then((img) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height + 80; // space for header text

      // draw chart screenshot
      ctx.drawImage(img, 0, 80);

      // header
      ctx.fillStyle = "#6CD17A";
      ctx.font = "18px Inter";
      ctx.fillText("CarbonXInsight Export Report", 20, 30);

      ctx.fillStyle = "#9AA4AF";
      ctx.font = "14px Inter";
      ctx.fillText(
        `Period: ${fromDate || "—"} → ${toDate || "—"}`,
        20,
        55
      );

      // legend / selected markets
      ctx.fillStyle = "#E8EEF2";
      ctx.font = "13px Inter";
      ctx.fillText(`Markets: ${selectedMarkets.join(", ")}`, 20, 75);

      const link = document.createElement("a");
      link.download = `CarbonXInsight-${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    });
  }

  return <div ref={containerRef} style={{ width: "100%", height: "470px" }} />;
}
