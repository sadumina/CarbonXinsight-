// ✅ CarbonXInsight — Market Dashboard (Pill Markets + PDF/Excel Export + Date Filtering + Forecast Toggle)
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import "./AnalyticsChart.css";
import HaycarbLogo from "../assets/haycarb-logo.png";

// 🔥 Export libs
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// Highcharts modules
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
  const chartRef = useRef(null);

  const [countries, setCountries] = useState([]);
  const [selected, setSelected] = useState([]);
  const [seriesData, setSeriesData] = useState([]);
  const [rawSeries, setRawSeries] = useState({});
  const [rows, setRows] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compareAt, setCompareAt] = useState(null);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // 🔮 Forecast toggle
  const [showForecast, setShowForecast] = useState(true);
  const FUTURE_POINTS = 6; // weeks forward (change to 12 for 12 weeks, etc.)

  // ✅ Load Countries
  useEffect(() => {
    (async () => {
      const { data: list = [] } = await axios.get(`${API}/countries`);
      setCountries(list);
      setSelected(list.slice(0, 3)); // default: first 3
    })();
  }, []);

  // ⭐ Linear Regression Forecast (Predict future N points)
  const computeForecast = (arr, futurePoints = 6) => {
    if (!arr || arr.length < 2) return [];

    // X = 0..n-1
    const xs = arr.map((_, i) => i);
    const ys = arr.map((pt) => pt.price);

    const n = xs.length;
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((sum, x, i) => sum + x * ys[i], 0);
    const sumX2 = xs.reduce((sum, x) => sum + x * x, 0);

    // y = a + b x
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);
    const intercept = (sumY - slope * sumX) / n;

    const forecasts = [];
    const lastTimestamp = arr[arr.length - 1].ts;

    // step = 1 week (ms)
    const stepMs = 1000 * 60 * 60 * 24 * 7;

    for (let i = 1; i <= futurePoints; i++) {
      const nextX = xs.length + i;
      const predictedY = intercept + slope * nextX;
      forecasts.push({
        ts: lastTimestamp + stepMs * i,
        price: predictedY,
      });
    }
    return forecasts;
  };

  // ✅ Fetch Data from Backend
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

      // Build series: original + optional forecast
      const allSeries = [];
      Object.keys(grouped).forEach((country) => {
        const baseId = `series-${country}`;
        const baseSeries = {
          id: baseId,
          name: country,
          data: grouped[country].map((pt) => [pt.ts, pt.price]),
          tooltip: { valueDecimals: 2 },
        };
        allSeries.push(baseSeries);

        if (showForecast) {
          const future = computeForecast(grouped[country], FUTURE_POINTS);
          if (future.length) {
            allSeries.push({
              name: `${country} (Forecast)`,
              linkedTo: baseId, // inherit color from main series
              data: future.map((pt) => [pt.ts, pt.price]),
              dashStyle: "Dash",
              enableMouseTracking: false,
              opacity: 0.65,
              tooltip: { valueDecimals: 2 },
              zIndex: 1,
            });
          }
        }
      });

      setRawSeries(grouped);
      setSeriesData(allSeries);
    });
  }, [selected, fromDate, toDate, showForecast]);

  // 🔥 Toggle Pill
  const toggleCountry = (c) => {
    setSelected(
      selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c]
    );
  };

  // ---------- Comparison Logic ----------
  const nearest = (arr, ts) => {
    if (!arr.length) return null;
    let lo = 0,
      hi = arr.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (arr[mid].ts < ts) lo = mid + 1;
      else hi = mid;
    }
    const a = arr[Math.max(0, lo - 1)];
    const b = arr[Math.min(arr.length - 1, lo)];
    return Math.abs((a?.ts ?? Infinity) - ts) <= Math.abs((b?.ts ?? Infinity) - ts) ? a : b;
  };

  // ✅ Min/Max/Avg using selected nearest points
  const betweenStats = (arr, startPt, endPt) => {
    if (!startPt || !endPt) return { min: null, max: null, avg: null };
    const slice = arr.filter((pt) => pt.ts >= startPt.ts && pt.ts <= endPt.ts);
    if (!slice.length) return { min: null, max: null, avg: null };
    let min = slice[0].price, max = slice[0].price, sum = 0;
    slice.forEach((pt) => {
      if (pt.price < min) min = pt.price;
      if (pt.price > max) max = pt.price;
      sum += pt.price;
    });
    return { min, max, avg: sum / slice.length };
  };

  const buildComparison = (clickedTs) => {
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;

    const data = Object.keys(rawSeries)
      .map((country) => {
        const arr = rawSeries[country];
        if (!arr || !arr.length) return null;

        const start = fromTs ? nearest(arr, fromTs) : arr[0];
        const end = nearest(arr, clickedTs);
        if (!start || !end) return null;

        const { min, max, avg } = betweenStats(arr, start, end);

        return {
          country,
          startDate: new Date(start.ts).toISOString().slice(0, 10),
          endDate: new Date(end.ts).toISOString().slice(0, 10),
          delta: end.price - start.price,
          pct: start.price ? ((end.price - start.price) / start.price) * 100 : null,
          min,
          max,
          avg,
        };
      })
      .filter(Boolean);

    setRows(data);
    setCompareAt(clickedTs);
    setDrawerOpen(true);
  };

  // ---------- EXPORT PDF ----------
  const exportComparisonPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("CarbonXInsight — Market Comparison Report", 14, 15);
    autoTable(doc, {
      startY: 25,
      head: [["Country", "Start Date", "End Date", "Change", "Change Percentage", "Min", "Max", "Avg"]],
      body: rows.map((r) => [
        r.country,
        r.startDate,
        r.endDate,
        r.delta,
        r.pct != null ? `${r.pct.toFixed(2)}%` : "—",
        fmtUsd(r.min),
        fmtUsd(r.max),
        fmtUsd(r.avg),
      ]),
      theme: "grid",
    });
    doc.save("CarbonXInsight_Comparison.pdf");
  };

  // ---------- EXPORT EXCEL ----------
  const exportComparisonExcel = () => {
    const sheetData = rows.map((r) => ({
      Country: r.country,
      Start_Date: r.startDate,
      End_Date: r.endDate,
      Change: r.delta,
      Change_Percentage: r.pct,
      Min: r.min,
      Max: r.max,
      Avg: r.avg,
    }));
    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Comparison");
    XLSX.writeFile(workbook, "CarbonXInsight_Comparison.xlsx");
  };

  // ---------- CHART CONFIG ----------
  const chartOptions = useMemo(
    () => ({
      chart: { backgroundColor: "#0d1117", height: 680 },
      title: { text: "" },
      legend: { enabled: true },
      tooltip: { shared: true, backgroundColor: "#111" },
      plotOptions: {
        series: {
          marker: { enabled: false },
          point: { events: { click: function () { buildComparison(this.x); } } },
        },
      },
      rangeSelector: { selected: 4, inputEnabled: false },
      series: seriesData,
    }),
    [seriesData]
  );

  return (
    <section className="panel">

      {/* HEADER */}
      <header className="panel-head compact">
        <div className="brand-left">
          <img src={HaycarbLogo} className="brand-logo" alt="Haycarb Logo" />
          <div>
            <h2>CarbonXInsight — Market Analytics</h2>
            <div className="subtitle">Haycarb • Coconut Shell Charcoal</div>
          </div>
        </div>

        <div className="filters-row">

          {/* ✅ Market Pill Selector */}
          <div className="pill-container">
            {countries.map((country) => (
              <span
                key={country}
                className={`pill ${selected.includes(country) ? "pill-active" : ""}`}
                onClick={() => toggleCountry(country)}
              >
                {country}
              </span>
            ))}
          </div>

          {/* ✅ Date Pickers */}
          <label className="filter">
            <span>From</span>
            <input
              type="date"
              className="date-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>

          <label className="filter">
            <span>To</span>
            <input
              type="date"
              className="date-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>

          {/* 🔮 Forecast toggle */}
          <label className="filter" title="Toggle linear regression forecast">
            <span>Forecast</span>
            <input
              type="checkbox"
              checked={showForecast}
              onChange={() => setShowForecast(!showForecast)}
              style={{ width: 18, height: 18 }}
            />
          </label>
        </div>
      </header>

      {/* CHART */}
      <HighchartsReact
        ref={chartRef}
        highcharts={Highcharts}
        constructorType="stockChart"
        options={chartOptions}
      />

      {/* DRAWER TABLE */}
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
                <th>Country</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Δ (Price Change)</th>
                <th>Δ% (Change)</th>
                <th>Min</th>
                <th>Max</th>
                <th>Avg</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.country}>
                  <td>{r.country}</td>
                  <td>{r.startDate ?? "—"}</td>
                  <td>{r.endDate ?? "—"}</td>
                  <td className={r.delta >= 0 ? "pos" : "neg"}>{r.delta ?? "—"}</td>
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
