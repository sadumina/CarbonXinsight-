import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import "./AnalyticsChart.css";
import HaycarbLogo from "../assets/haycarb-logo.png";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import Exporting from "highcharts/modules/exporting";
import ExportData from "highcharts/modules/export-data";
import OfflineExporting from "highcharts/modules/offline-exporting";
function initHC(mod) {
  if (typeof mod === "function") mod(Highcharts);
  else if (mod && typeof mod.default === "function") mod.default(Highcharts);
}
initHC(Exporting);
initHC(ExportData);
initHC(OfflineExporting);

const API = "http://localhost:8000";
const fmtUsd = (v) => (v == null ? "—" : `$${Number(v).toFixed(2)}`);
const fmtPct = (v) => (v == null ? "—" : `${Number(v).toFixed(2)}%`);

export default function AnalyticsChart() {
  const chartRef = useRef(null);        // main
  const forecastRef = useRef(null);     // bottom (forecast)

  const [countries, setCountries] = useState([]);
  const [selected, setSelected] = useState([]);
  const [seriesData, setSeriesData] = useState([]);        // main
  const [forecastSeries, setForecastSeries] = useState([]); // bottom (only forecast)
  const [rawSeries, setRawSeries] = useState({});
  const [rows, setRows] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compareAt, setCompareAt] = useState(null);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Toggle forecast visibility
  const [showForecast, setShowForecast] = useState(true);
  const FUTURE_POINTS = 6;

  useEffect(() => {
    (async () => {
      const { data: list = [] } = await axios.get(`${API}/countries`);
      setCountries(list);
      setSelected(list.slice(0, 3));
    })();
  }, []);

  // Time-aware linear regression forecast (robust)
  const computeForecast = (arr, futurePoints = 6) => {
    if (!arr || arr.length < 3) return [];
    const dayMs = 24 * 60 * 60 * 1000;
    const t0 = arr[0].ts;
    const xs = arr.map((pt) => (pt.ts - t0) / dayMs); // days
    const ys = arr.map((pt) => pt.price);

    const n = xs.length;
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
    const sumX2 = xs.reduce((s, x) => s + x * x, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return [];

    const slope = (n * sumXY - sumX * sumY) / denom; // $/day
    const intercept = (sumY - slope * sumX) / n;

    // median step (days)
    const gaps = [];
    for (let i = 1; i < arr.length; i++) gaps.push((arr[i].ts - arr[i - 1].ts) / dayMs);
    gaps.sort((a, b) => a - b);
    const med = gaps.length
      ? (gaps[Math.floor((gaps.length - 1) / 2)] + gaps[Math.ceil((gaps.length - 1) / 2)]) / 2
      : 7;

    const lastTs = arr[arr.length - 1].ts;
    const lastX = (lastTs - t0) / dayMs;
    const out = [];
    for (let i = 1; i <= futurePoints; i++) {
      const x = lastX + med * i;
      const y = intercept + slope * x;
      out.push({ ts: lastTs + med * i * dayMs, price: y });
    }
    return out;
  };

  // Fetch & build two charts' series
  useEffect(() => {
    if (!selected.length) return;

    const url = new URL(`${API}/series`);
    selected.forEach((c) => url.searchParams.append("countries", c));
    if (fromDate) url.searchParams.set("fromDate", fromDate);
    if (toDate) url.searchParams.set("toDate", toDate);

    axios.get(url.toString()).then((res) => {
      const grouped = {};
      (res.data || []).forEach((p) => {
        const ts = new Date(p.date).getTime();
        if (!grouped[p.country]) grouped[p.country] = [];
        grouped[p.country].push({ ts, price: p.price });
      });
      Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.ts - b.ts));

      // Main (historical only)
      const main = Object.keys(grouped).map((country) => ({
        id: `series-${country}`,
        name: country,
        data: grouped[country].map((pt) => [pt.ts, pt.price]),
        tooltip: { valueDecimals: 2 },
      }));

      // Forecast-only bottom chart (dashed)
      const preds = [];
      if (showForecast) {
        Object.keys(grouped).forEach((country) => {
          const fut = computeForecast(grouped[country], FUTURE_POINTS);
          if (fut.length) {
            preds.push({
              name: `${country} (Forecast)`,
              data: fut.map((pt) => [pt.ts, pt.price]),
              dashStyle: "Dash",
              enableMouseTracking: true,
              opacity: 0.8,
              tooltip: { valueDecimals: 2 },
              zIndex: 1,
            });
          }
        });
      }

      setRawSeries(grouped);
      setSeriesData(main);
      setForecastSeries(preds);
    });
  }, [selected, fromDate, toDate, showForecast]);

  const toggleCountry = (c) => {
    setSelected(selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c]);
  };

  // ---- compare drawer helpers ----
  const nearest = (arr, ts) => {
    if (!arr.length) return null;
    let lo = 0, hi = arr.length - 1;
    while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (arr[mid].ts < ts) lo = mid + 1; else hi = mid; }
    const a = arr[Math.max(0, lo - 1)], b = arr[Math.min(arr.length - 1, lo)];
    return Math.abs((a?.ts ?? Infinity) - ts) <= Math.abs((b?.ts ?? Infinity) - ts) ? a : b;
  };
  const betweenStats = (arr, startPt, endPt) => {
    if (!startPt || !endPt) return { min: null, max: null, avg: null };
    const slice = arr.filter((pt) => pt.ts >= startPt.ts && pt.ts <= endPt.ts);
    if (!slice.length) return { min: null, max: null, avg: null };
    let min = slice[0].price, max = slice[0].price, sum = 0;
    slice.forEach((pt) => { if (pt.price < min) min = pt.price; if (pt.price > max) max = pt.price; sum += pt.price; });
    return { min, max, avg: sum / slice.length };
  };
  const buildComparison = (clickedTs) => {
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const data = Object.keys(rawSeries).map((country) => {
      const arr = rawSeries[country]; if (!arr || !arr.length) return null;
      const start = fromTs ? nearest(arr, fromTs) : arr[0];
      const end = nearest(arr, clickedTs); if (!start || !end) return null;
      const { min, max, avg } = betweenStats(arr, start, end);
      return {
        country,
        startDate: new Date(start.ts).toISOString().slice(0, 10),
        endDate: new Date(end.ts).toISOString().slice(0, 10),
        delta: end.price - start.price,
        pct: start.price ? ((end.price - start.price) / start.price) * 100 : null,
        min, max, avg,
      };
    }).filter(Boolean);
    setRows(data);
    setCompareAt(clickedTs);
    setDrawerOpen(true);
  };

  // ---- sync x-axes between charts ----
  const syncExtremes = (e, target) => {
    const other = target === "main" ? forecastRef.current?.chart : chartRef.current?.chart;
    if (!other || !e.trigger) return; // avoid initial set
    const xAxis = other.xAxis && other.xAxis[0];
    if (xAxis) xAxis.setExtremes(e.min, e.max, true, false);
  };

  // MAIN chart options
  const chartOptionsMain = useMemo(
    () => ({
      chart: { backgroundColor: "#0d1117", height: 520 },
      title: { text: "" },
      legend: { enabled: true },
      tooltip: { shared: true, backgroundColor: "#111" },
      rangeSelector: { selected: 4, inputEnabled: false },
      plotOptions: {
        series: {
          marker: { enabled: false },
          point: { events: { click: function () { buildComparison(this.x); } } },
        },
      },
      xAxis: { events: { setExtremes: (e) => syncExtremes(e, "main") } },
      series: seriesData,
    }),
    [seriesData]
  );

  // FORECAST chart options (bottom)
  const chartOptionsForecast = useMemo(
    () => ({
      chart: { backgroundColor: "#0b1116", height: 260, spacingTop: 6 },
      title: { text: "Forecast (dashed) — experimental", style: { color: "#9AA4AF", fontSize: "12px" } },
      legend: { enabled: true },
      tooltip: { shared: true, backgroundColor: "#111" },
      rangeSelector: { enabled: false },
      navigator: { enabled: false },
      scrollbar: { enabled: false },
      plotOptions: { series: { marker: { enabled: false } } },
      xAxis: { events: { setExtremes: (e) => syncExtremes(e, "forecast") } },
      yAxis: { title: { text: "" }, gridLineColor: "rgba(255,255,255,0.06)" },
      series: forecastSeries,
    }),
    [forecastSeries]
  );

  // EXPORTS
  const exportComparisonPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("CarbonXInsight — Market Comparison Report", 14, 15);
    autoTable(doc, {
      startY: 25,
      head: [["Country","Start Date","End Date","Change","Change Percentage","Min","Max","Avg"]],
      body: rows.map((r) => [
        r.country, r.startDate, r.endDate, r.delta,
        r.pct != null ? `${r.pct.toFixed(2)}%` : "—",
        fmtUsd(r.min), fmtUsd(r.max), fmtUsd(r.avg),
      ]),
      theme: "grid",
    });
    doc.save("CarbonXInsight_Comparison.pdf");
  };
  const exportComparisonExcel = () => {
    const sheetData = rows.map((r) => ({
      Country: r.country, Start_Date: r.startDate, End_Date: r.endDate,
      Change: r.delta, Change_Percentage: r.pct, Min: r.min, Max: r.max, Avg: r.avg,
    }));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparison");
    XLSX.writeFile(wb, "CarbonXInsight_Comparison.xlsx");
  };

  return (
    <section className="panel">
      <header className="panel-head compact">
        <div className="brand-left">
          <img src={HaycarbLogo} className="brand-logo" alt="Haycarb Logo" />
        </div>
        <div className="title-wrap">
          <h2>CarbonXInsight — Market Analytics</h2>
          <div className="subtitle">Haycarb • Coconut Shell Charcoal</div>
        </div>

        <div className="filters-row">
          <div className="pill-container">
            {countries.map((c) => (
              <span
                key={c}
                className={`pill ${selected.includes(c) ? "pill-active" : ""}`}
                onClick={() => toggleCountry(c)}
              >
                {c}
              </span>
            ))}
          </div>

          <label className="filter">
            <span>From</span>
            <input type="date" className="date-input" value={fromDate} onChange={(e)=>setFromDate(e.target.value)} />
          </label>
          <label className="filter">
            <span>To</span>
            <input type="date" className="date-input" value={toDate} onChange={(e)=>setToDate(e.target.value)} />
          </label>

          <label className="filter" title="Toggle linear regression forecast">
            <span>Forecast</span>
            <input type="checkbox" checked={showForecast} onChange={() => setShowForecast(!showForecast)} style={{width:18,height:18}}/>
          </label>
        </div>
      </header>

      {/* Main chart (historical) */}
      <HighchartsReact
        ref={chartRef}
        highcharts={Highcharts}
        constructorType="stockChart"
        options={chartOptionsMain}
      />

      {/* Bottom forecast chart */}
      {showForecast && forecastSeries.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <HighchartsReact
            ref={forecastRef}
            highcharts={Highcharts}
            constructorType="stockChart"
            options={chartOptionsForecast}
          />
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <div className="compare-drawer">
          <div className="compare-head">
            <h3>
              From <b>{fromDate || "start"}</b> →{" "}
              <b>{compareAt ? new Date(compareAt).toISOString().slice(0, 10) : "—"}</b>
            </h3>
            <div className="drawer-actions">
              <button className="btn-ghost" onClick={exportComparisonExcel}>📊 Excel</button>
              <button className="btn-ghost" onClick={exportComparisonPDF}>📄 PDF</button>
              <button className="close" onClick={() => setDrawerOpen(false)}>×</button>
            </div>
          </div>

          <table className="compare-table">
            <thead>
              <tr>
                <th>Country</th><th>Start Date</th><th>End Date</th>
                <th>Δ (Price Change)</th><th>Δ% (Change)</th>
                <th>Min</th><th>Max</th><th>Avg</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.country}>
                  <td>{r.country}</td>
                  <td>{r.startDate ?? "—"}</td>
                  <td>{r.endDate ?? "—"}</td>
                  <td className={r.delta >= 0 ? "pos" : "neg"}>{r.delta != null ? r.delta.toFixed(2) : "—"}</td>
                  <td className={r.pct >= 0 ? "pos" : "neg"}>{fmtPct(r.pct)}</td>
                  <td>{fmtUsd(r.min)}</td>
                  <td>{fmtUsd(r.max)}</td>
                  <td>{fmtUsd(r.avg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
