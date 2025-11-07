// ✅ src/components/AnalyticsChart.jsx
import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import "./AnalyticsChart.css";

const API = "http://localhost:8000";   // backend URL

export default function AnalyticsChart() {
  const [countries, setCountries] = useState([]);
  const [selected, setSelected] = useState([]);
  const [seriesData, setSeriesData] = useState([]);
  const [kpis, setKpis] = useState([]);

  // ✅ Load dropdown countries
  useEffect(() => {
    axios.get(`${API}/countries`).then((res) => {
      setCountries(res.data || []);
      setSelected(res.data.slice(0, 3)); // auto-select 3 on load
    });
  }, []);

  // ✅ Fetch KPI summary
  useEffect(() => {
    axios.get(`${API}/analytics/current-kpis`).then((res) => setKpis(res.data));
  }, []);

  // ✅ Fetch time-series data
  useEffect(() => {
    if (!selected.length) return;

    axios
      .get(`${API}/series`, { params: { countries: selected } })
      .then((res) => {
        const grouped = {};

        res.data.forEach((p) => {
          if (!grouped[p.country]) grouped[p.country] = [];
          grouped[p.country].push([new Date(p.date).getTime(), p.price]);
        });

        setSeriesData(
          Object.keys(grouped).map((c) => ({
            name: c,
            data: grouped[c],
            tooltip: { valueDecimals: 2 },
          }))
        );
      });
  }, [selected]);

  const highchartsOptions = useMemo(
    () => ({
      chart: { backgroundColor: "#0d1117", height: 620 },

      rangeSelector: {
        selected: 5,
        inputEnabled: false,
        buttons: [
          { type: "month", count: 1, text: "1M" },
          { type: "month", count: 3, text: "3M" },
          { type: "month", count: 6, text: "6M" },
          { type: "ytd", text: "YTD" },
          { type: "all", text: "ALL" },
        ],
        buttonTheme: {
          fill: "none",
          style: { color: "#00ffd5" },
          states: {
            select: {
              fill: "#00ffd5",
              style: { color: "#000" },
            },
          },
        },
      },

      yAxis: {
        title: { text: "USD / MT", style: { color: "#00ffd5" } },
        labels: { style: { color: "#fff" } },
        gridLineColor: "rgba(0,255,213,0.05)",
      },

      xAxis: { labels: { style: { color: "#aaa" } } },
      legend: { enabled: true, itemStyle: { color: "#00ffd5" } },

      tooltip: {
        shared: true,
        backgroundColor: "#111",
        borderColor: "#00ffd5",
        style: { color: "white" },
      },

      plotOptions: {
        series: { marker: { enabled: false } },
      },

      series: seriesData,
    }),
    [seriesData]
  );

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>📈 TradingView — Coconut Shell Charcoal Market</h2>
        </div>

        <select
          multiple
          value={selected}
          onChange={(e) =>
            setSelected(Array.from(e.target.selectedOptions, (o) => o.value))
          }
        >
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </header>

      {/* ✅ KPI Summary Row */}
      <div className="kpi-row">
        {kpis.map((k, i) => (
          <div key={i} className="kpi-card">
            <h4>{k.country}</h4>
            <p>Min: <b>${k.min.toFixed(2)}</b></p>
            <p>Max: <b>${k.max.toFixed(2)}</b></p>
            <p>Current: <b>${k.current.toFixed(2)}</b></p>
            <p className={k.change_pct >= 0 ? "pos" : "neg"}>
              {k.change_pct >= 0 ? "↑" : "↓"} {k.change_pct.toFixed(2)}%
            </p>
          </div>
        ))}
      </div>

      {/* ✅ HIGHCHARTS / TRADINGVIEW GRAPH */}
      <HighchartsReact
        highcharts={Highcharts}
        constructorType="stockChart"
        options={highchartsOptions}
      />
    </section>
  );
}
