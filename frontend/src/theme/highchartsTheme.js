
import Highcharts from "highcharts";

export function applyChartTheme(theme) {
  const isDark = theme === "dark";

  Highcharts.setOptions({
    chart: {
      backgroundColor: isDark ? "#0f1720" : "#ffffff"
    },
    xAxis: {
      labels: { style: { color: isDark ? "#b9c3cc" : "#475569" } },
      gridLineColor: isDark ? "#1f2933" : "#e5e7eb"
    },
    yAxis: {
      labels: { style: { color: isDark ? "#b9c3cc" : "#475569" } },
      gridLineColor: isDark ? "#1f2933" : "#e5e7eb"
    },
    legend: {
      itemStyle: { color: isDark ? "#f4f7fa" : "#0f172a" }
    }
  });
}
