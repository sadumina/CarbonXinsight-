// ✅ TradingView-style Analytics + KPIs + Compare Drawer + Backend Date Filtering
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import "./AnalyticsChart.css";
import HaycarbLogo from "../assets/haycarb-logo.png";

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

// Backend
const API = "http://localhost:8000";

// Helpers
const fmtUsd = (v) => (v == null ? "—" : `$${Number(v).toFixed(2)}`);
const fmtPct = (v) => (v == null ? "—" : `${Number(v).toFixed(2)}%`);

export default function AnalyticsChart() {
  const chartRef = useRef(null);

  const [countries, setCountries] = useState([]);
  const [selected, setSelected] = useState([]);

  const [seriesData, setSeriesData] = useState([]);
  const [rawSeries, setRawSeries] = useState({});

  const [kpis, setKpis] = useState([]);
  const [globalSummary, setGlobalSummary] = useState(null);

  // ✅ NEW: backend date filtering values
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Comparison drawer
  const [compareAt, setCompareAt] = useState(null);
  const [rows, setRows] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Load markets and global summary once
  useEffect(() => {
    (async () => {
      const { data: list = [] } = await axios.get(`${API}/countries`);
      setCountries(list);
      setSelected(list.slice(0, 3));

      axios.get(`${API}/analytics/market-kpis`).then((res) => {
        setGlobalSummary(res.data || null);
      });
    })();
  }, []);

  // Refresh KPI chips
  useEffect(() => {
    if (!selected.length) return;

    axios
      .get(`${API}/analytics/current-kpis`, { params: { countries: selected } })
      .then((res) => setKpis(res.data || []));
  }, [selected]);

  // ✅ Load time series from backend (WITH DATE FILTER)
  useEffect(() => {
    if (!selected.length) return;

    const url = new URL(`${API}/series`);
    url.searchParams.set("countries", selected.join(","));

    if (fromDate) url.searchParams.set("fromDate", fromDate);
    if (toDate) url.searchParams.set("toDate", toDate);

    axios.get(url.toString()).then((res) => {
      const grouped = {}; // country -> [{ts, price}]

      (res.data || []).forEach((p) => {
        const ts = new Date(p.date).getTime();
        if (!grouped[p.country]) grouped[p.country] = [];
        grouped[p.country].push({ ts, price: p.price });
      });

      Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.ts - b.ts));

      const hc = Object.keys(grouped).map((c) => ({
        name: c,
        data: grouped[c].map((pt) => [pt.ts, pt.price]),
        tooltip: { valueDecimals: 2 },
      }));

      setRawSeries(grouped);
      setSeriesData(hc);
    });
  }, [selected, fromDate, toDate]);

  // ───── Comparison Logic ───────────────────────────────
  const nearest = (arr, ts) => {
    if (!arr.length) return null;
    let lo = 0,
      hi = arr.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].ts < ts) lo = mid + 1;
      else hi = mid;
    }
    const a = arr[Math.max(0, lo - 1)];
    const b = arr[Math.min(arr.length - 1, lo)];
    return Math.abs((a?.ts ?? Infinity) - ts) <= Math.abs((b?.ts ?? Infinity) - ts)
      ? a
      : b;
  };

  const betweenStats = (arr, tsStart, tsEnd) => {
    const slice = arr.filter((pt) => pt.ts >= tsStart && pt.ts <= tsEnd);
    if (!slice.length) return { min: null, max: null, avg: null };

    let min = slice[0].price,
      max = slice[0].price,
      sum = 0;

    slice.forEach((pt) => {
      if (pt.price < min) min = pt.price;
      if (pt.price > max) max = pt.price;
      sum += pt.price;
    });

    return { min, max, avg: sum / slice.length };
  };

  const buildComparison = (clickedTs) => {
    const from = new Date(fromDate).getTime();
    const to = clickedTs;

    const data = Object.keys(rawSeries).map((country) => {
      const arr = rawSeries[country] || [];
      if (!arr.length) return null;

      const startPt = nearest(arr, from);
      const endPt = nearest(arr, to);
      const { min, max, avg } = betweenStats(arr, from, to);

      return {
        country,
        start: startPt?.price,
        end: endPt?.price,
        delta: endPt?.price - startPt?.price,
        pct:
          startPt?.price && endPt?.price
            ? ((endPt.price - startPt.price) / startPt.price) * 100
            : null,
        min,
        max,
        avg,
      };
    });

    setRows(data);
    setCompareAt(clickedTs);
    setDrawerOpen(true);
  };

  // ───── HighCharts Config ──────────────────────────────
  const highchartsOptions = useMemo(
    () => ({
      chart: { backgroundColor: "#0d1117", height: 620 },
      rangeSelector: {
        selected: 4,
        inputEnabled: false,
        buttons: [
          { type: "month", count: 1, text: "1M" },
          { type: "month", count: 3, text: "3M" },
          { type: "month", count: 6, text: "6M" },
          { type: "ytd", text: "YTD" },
          { type: "all", text: "ALL" },
        ],
      },
      xAxis: { labels: { style: { color: "#aaa" } } },
      yAxis: {
        title: { text: "USD / MT", style: { color: "#6CD17A" } },
        labels: { style: { color: "#fff" } },
        gridLineColor: "rgba(255,255,255,0.05)",
      },
      legend: { enabled: true, itemStyle: { color: "#6CD17A" } },
      tooltip: {
        shared: true,
        backgroundColor: "#111",
        borderColor: "#6CD17A",
        style: { color: "white" },
      },
      exporting: {
        enabled: true,
        buttons: {
          contextButton: {
            menuItems: [
              "viewFullscreen",
              "downloadPNG",
              "downloadJPEG",
              "downloadPDF",
              "downloadCSV",
            ],
          },
        },
      },
      plotOptions: {
        series: {
          marker: { enabled: false },
          point: {
            events: {
              click: function () {
                buildComparison(this.x);
              },
            },
          },
        },
      },
      series: seriesData,
    }),
    [seriesData]
  );

  // ───── Actions ──────────────────────────────
  const resetFilters = () => {
    setSelected(countries.slice(0, 3));
    setFromDate("");
    setToDate("");
    setDrawerOpen(false);
  };

  const downloadPNG = () => chartRef.current?.chart?.exportChartLocal();
  const downloadCSV = () => chartRef.current?.chart?.downloadCSV();

  // ───── JSX ────────────────────────────────
  return (
    <section className="panel">

      {/* ---------------- Header / Filters ---------------- */}
      <header className="panel-head compact">

        <div className="brand-left">
          <img src={HaycarbLogo} alt="Haycarb Logo" className="brand-logo" />
          <div className="title-wrap">
            <h2>CarbonXInsight — Market Analytics</h2>
            <div className="subtitle">Haycarb • Coconut Shell Charcoal</div>
          </div>
        </div>

        <div className="filters-row">
          {/* Countries multiselect */}
          <label className="filter">
            <span>Markets</span>
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
          </label>

          {/* ✅ NEW: date from */}
          <label className="filter">
            <span>From</span>
            <input
              type="date"
              className="date-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>

          {/* ✅ NEW: date to */}
          <label className="filter">
            <span>To</span>
            <input
              type="date"
              className="date-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>

          <button className="btn-pill" onClick={resetFilters}>
            Reset
          </button>

          <div className="download-bar">
            <button className="btn-ghost" onClick={downloadPNG}>PNG</button>
            <button className="btn-ghost" onClick={downloadCSV}>CSV</button>
          </div>
        </div>
      </header>

      {/* Global Summary Chip */}
      {globalSummary && (
        <div className="kpi-chips" style={{ marginTop: 0 }}>
          <div className="kpi-chip">
            <div className="chip-top">
              <span
                className={`dot ${
                  (globalSummary.overall_change_pct ?? 0) >= 0 ? "up" : "down"
                }`}
              />
              <span className="chip-country">Market Summary</span>
              <span
                className={`chip-delta ${
                  (globalSummary.overall_change_pct ?? 0) >= 0 ? "pos" : "neg"
                }`}
              >
                {(globalSummary.overall_change_pct ?? 0) >= 0 ? "▲" : "▼"}{" "}
                {fmtPct(globalSummary.overall_change_pct)}
              </span>
            </div>
            <div className="chip-row">
              <span className="chip-label">Min</span>
              <span className="chip-value">{fmtUsd(globalSummary.min_price)}</span>
            </div>
            <div className="chip-row">
              <span className="chip-label">Max</span>
              <span className="chip-value">{fmtUsd(globalSummary.max_price)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Country KPI chips */}
      {/* <div className="kpi-chips">
        {kpis.map((k) => {
          const up = (k.change_pct ?? 0) >= 0;
          return (
            <div key={k.country} className="kpi-chip">
              <div className="chip-top">
                <span className={`dot ${up ? "up" : "down"}`} />
                <span className="chip-country">{k.country}</span>
                <span className={`chip-delta ${up ? "pos" : "neg"}`}>
                  {up ? "▲" : "▼"} {fmtPct(k.change_pct)}
                </span>
              </div>
              <div className="chip-row">
                <span className="chip-label">Curr</span>
                <span className="chip-value">{fmtUsd(k.current)}</span>
              </div>
              <div className="chip-row subtle">
                <span className="chip-label">Min</span>
                <span className="chip-value">{fmtUsd(k.min)}</span>
              </div>
              <div className="chip-row subtle">
                <span className="chip-label">Max</span>
                <span className="chip-value">{fmtUsd(k.max)}</span>
              </div>
            </div>
          );
        })}
      </div> */}

      {/* Highcharts */}
      <HighchartsReact
        ref={chartRef}
        highcharts={Highcharts}
        constructorType="stockChart"
        options={highchartsOptions}
      />

      {/* Comparison Drawer */}
      {drawerOpen && (
        <div className="compare-drawer">
          <div className="compare-head">
            <h3>
              Comparison • From <b>{fromDate}</b> to{" "}
              <b>
                {compareAt
                  ? new Date(compareAt).toISOString().slice(0, 10)
                  : "—"}
              </b>
            </h3>
            <button className="close" onClick={() => setDrawerOpen(false)}>
              ×
            </button>
          </div>

          <div className="table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Start</th>
                  <th>At Date</th>
                  <th>Δ</th>
                  <th>Δ%</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Avg</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.country}>
                    <td>{r.country}</td>
                    <td>{fmtUsd(r.start)}</td>
                    <td>{fmtUsd(r.end)}</td>
                    <td className={r.delta >= 0 ? "pos" : "neg"}>
                      {r.delta != null
                        ? `${r.delta >= 0 ? "+" : "-"}$${Math.abs(r.delta).toFixed(
                            2
                          )}`
                        : "—"}
                    </td>
                    <td className={r.pct >= 0 ? "pos" : "neg"}>
                      {r.pct != null
                        ? `${r.pct >= 0 ? "+" : "-"}${Math.abs(r.pct).toFixed(
                            2
                          )}%`
                        : "—"}
                    </td>
                    <td>{fmtUsd(r.min)}</td>
                    <td>{fmtUsd(r.max)}</td>
                    <td>{fmtUsd(r.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
