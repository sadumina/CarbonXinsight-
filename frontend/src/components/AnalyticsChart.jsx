// ✅ CarbonXInsight — Market Dashboard
// (Pill Markets + Date Filtering + Forecast Toggle + Insights + PDF/Excel export)

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

// ---------- INSIGHTS HELPERS ----------
const pctChange = (start, end) =>
  start != null && end != null && start !== 0 ? ((end - start) / start) * 100 : null;

const stddev = (arr) => {
  if (!arr.length) return null;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
};

// pick nearest point to timestamp; fallback first/last safely
const nearestPoint = (arr, ts, fallback) => {
  if (!arr || !arr.length) return null;
  if (!ts) return fallback === "first" ? arr[0] : arr[arr.length - 1];
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

  // 🧠 Insights state
  const [insights, setInsights] = useState(null);

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

  // ---------- BUILD INSIGHTS WHEN DATA / FILTERS CHANGE ----------
  useEffect(() => {
    if (!rawSeries || !Object.keys(rawSeries).length || !selected.length) {
      setInsights(null);
      return;
    }

    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(toDate).getTime() : null;

    const perCountry = [];
    let globalMax = { country: null, price: -Infinity, date: null };
    let globalMin = { country: null, price: Infinity, date: null };

    selected.forEach((country) => {
      const arr = rawSeries[country];
      if (!arr || !arr.length) return;

      // filter to range for volatility & local extremes
      const inRange = arr.filter(
        (pt) => (fromTs ? pt.ts >= fromTs : true) && (toTs ? pt.ts <= toTs : true)
      );

      const startPt = fromTs ? nearestPoint(arr, fromTs, "first") : arr[0];
      const endPt = toTs ? nearestPoint(arr, toTs, "last") : arr[arr.length - 1];
      if (!startPt || !endPt) return;

      const changeAbs = endPt.price - startPt.price;
      const changePct = pctChange(startPt.price, endPt.price);
      const vol = inRange.length ? stddev(inRange.map((p) => p.price)) : null;

      const localMax = inRange.length
        ? inRange.reduce((m, p) => (p.price > m.price ? p : m), inRange[0])
        : null;
      const localMin = inRange.length
        ? inRange.reduce((m, p) => (p.price < m.price ? p : m), inRange[0])
        : null;

      if (localMax && localMax.price > globalMax.price) {
        globalMax = { country, price: localMax.price, date: localMax.ts };
      }
      if (localMin && localMin.price < globalMin.price) {
        globalMin = { country, price: localMin.price, date: localMin.ts };
      }

      perCountry.push({
        country,
        startDate: new Date(startPt.ts).toISOString().slice(0, 10),
        endDate: new Date(endPt.ts).toISOString().slice(0, 10),
        start: startPt.price,
        end: endPt.price,
        changeAbs,
        changePct,
        volatility: vol,
      });
    });

    if (!perCountry.length) {
      setInsights(null);
      return;
    }

    const movers = perCountry
      .filter((x) => x.changePct != null)
      .sort((a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity));

    const best = movers[0];
    const worst = movers[movers.length - 1];

    setInsights({
      window: {
        from: fromDate || perCountry[0]?.startDate,
        to: toDate || perCountry[0]?.endDate,
      },
      best,
      worst,
      globalMax,
      globalMin,
      table: perCountry,
    });
  }, [rawSeries, selected, fromDate, toDate]);

  // ---------- EXPORT PDF ----------
  const exportComparisonPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("CarbonXInsight — Market Comparison Report", 14, 15);

    // ✨ Include a short insights summary at the top if available
    if (insights) {
      doc.setFontSize(11);
      doc.text(
        `Window: ${insights.window.from} → ${insights.window.to}`,
        14,
        22
      );
    }

    autoTable(doc, {
      startY: 28,
      head: [
        [
          "Country",
          "Start Date",
          "End Date",
          "Change",
          "Change Percentage",
          "Min",
          "Max",
          "Avg",
        ],
      ],
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
        </div>

        <div className="title-wrap">
          <h2>CarbonXInsight — Market Analytics</h2>
          <div className="subtitle">Haycarb • Coconut Shell Charcoal</div>
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

      {/* ⭐ INSIGHTS CARD */}
      {insights && (
        <div
          className="insights-card"
          style={{
            background: "#0f131a",
            border: "1px solid rgba(108,209,122,0.2)",
            borderRadius: 12,
            padding: "14px 16px",
            margin: "12px 0",
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0,1fr))",
            gap: "12px",
          }}
        >
          <div>
            <div style={{ color: "#9AA4AF", fontSize: 12 }}>Window</div>
            <div style={{ fontWeight: 600 }}>
              {insights.window.from} → {insights.window.to}
            </div>
          </div>

          <div>
            <div style={{ color: "#9AA4AF", fontSize: 12 }}>Top Riser</div>
            {insights.best ? (
              <div style={{ fontWeight: 600 }}>
                {insights.best.country} · {insights.best.changePct?.toFixed(2)}%
                <span style={{ color: "#6CD17A" }}> ↑</span>
              </div>
            ) : (
              <div>—</div>
            )}
          </div>

          <div>
            <div style={{ color: "#9AA4AF", fontSize: 12 }}>Top Faller</div>
            {insights.worst ? (
              <div style={{ fontWeight: 600 }}>
                {insights.worst.country} · {insights.worst.changePct?.toFixed(2)}%
                <span style={{ color: "#ff7b7b" }}> ↓</span>
              </div>
            ) : (
              <div>—</div>
            )}
          </div>

          <div>
            <div style={{ color: "#9AA4AF", fontSize: 12 }}>Extremes (Range)</div>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: "#6CD17A" }}>Max</span>{" "}
              {insights.globalMax.country
                ? `${insights.globalMax.country} ${fmtUsd(insights.globalMax.price)} on ${new Date(
                    insights.globalMax.date
                  )
                    .toISOString()
                    .slice(0, 10)}`
                : "—"}
              <br />
              <span style={{ color: "#ff7b7b" }}>Min</span>{" "}
              {insights.globalMin.country
                ? `${insights.globalMin.country} ${fmtUsd(insights.globalMin.price)} on ${new Date(
                    insights.globalMin.date
                  )
                    .toISOString()
                    .slice(0, 10)}`
                : "—"}
            </div>
          </div>
        </div>
      )}

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
              <button className="btn-ghost" onClick={exportComparisonExcel}>
                📊 Excel
              </button>
              <button className="btn-ghost" onClick={exportComparisonPDF}>
                📄 PDF
              </button>
              <button className="close" onClick={() => setDrawerOpen(false)}>
                ×
              </button>
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
                  <td className={r.delta >= 0 ? "pos" : "neg"}>
                    {r.delta != null ? r.delta.toFixed(2) : "—"}
                  </td>
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
