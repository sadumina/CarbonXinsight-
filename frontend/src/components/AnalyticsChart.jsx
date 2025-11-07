// ✅ TradingView-style Analytics + KPIs + Compare Drawer + Downloads
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import "./AnalyticsChart.css";

// ── Highcharts modules (robust init across ESM/CJS) ──────────────────────────
import Exporting from "highcharts/modules/exporting";
import ExportData from "highcharts/modules/export-data";
import OfflineExporting from "highcharts/modules/offline-exporting";
// import Accessibility from "highcharts/modules/accessibility";

function initHC(mod) {
  if (typeof mod === "function") mod(Highcharts);
  else if (mod && typeof mod.default === "function") mod.default(Highcharts);
}
initHC(Exporting);
initHC(ExportData);
initHC(OfflineExporting);
// initHC(Accessibility);

const API = "http://localhost:8000"; // FastAPI backend

// Tiny format helpers for the chips
const fmtUsd = (v) => (v == null ? "—" : `$${Number(v).toFixed(2)}`);
const fmtPct = (v) => (v == null ? "—" : `${Number(v).toFixed(2)}%`);

export default function AnalyticsChart() {
  const chartRef = useRef(null);

  const [countries, setCountries] = useState([]);
  const [selected, setSelected] = useState([]);
  const [seriesData, setSeriesData] = useState([]);   // Highcharts series
  const [rawSeries, setRawSeries] = useState({});     // { country: [{ts, price}, ...] }

  // KPI chips
  const [kpis, setKpis] = useState([]);
  const [globalSummary, setGlobalSummary] = useState(null); // market min/max/+change%

  // Comparison drawer
  const [startDate, setStartDate] = useState(""); // yyyy-mm-dd
  const [compareAt, setCompareAt] = useState(null);
  const [rows, setRows] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ───────────────────────────────────────────────────────────
  // Boot: load markets + global summary
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: list = [] } = await axios.get(`${API}/countries`);
      setCountries(list);
      setSelected(list.slice(0, 3));
      axios.get(`${API}/analytics/market-kpis`)
        .then((res) => setGlobalSummary(res.data || null))
        .catch(() => setGlobalSummary(null));
    })();
  }, []);

  // Refresh KPI chips whenever selection changes
  useEffect(() => {
    if (!selected.length) return;
    axios
      .get(`${API}/analytics/current-kpis`, { params: { countries: selected } })
      .then((res) => setKpis(res.data || []))
      .catch(() => setKpis([]));
  }, [selected]);

  // ───────────────────────────────────────────────────────────
  // Fetch time series from PDF DB
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selected.length) return;

    axios.get(`${API}/series`, { params: { countries: selected } }).then((res) => {
      const grouped = {}; // country -> [{ts, price}]
      (res.data || []).forEach((p) => {
        const ts = new Date(p.date).getTime();
        if (!grouped[p.country]) grouped[p.country] = [];
        grouped[p.country].push({ ts, price: p.price });
      });

      // sort each array by timestamp
      Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.ts - b.ts));

      // Highcharts format
      const hc = Object.keys(grouped).map((c) => ({
        name: c,
        data: grouped[c].map((pt) => [pt.ts, pt.price]),
        tooltip: { valueDecimals: 2 },
      }));

      setRawSeries(grouped);
      setSeriesData(hc);

      // Default Start Date to earliest data point
      if (!startDate) {
        const all = Object.values(grouped).flat();
        if (all.length) {
          const minTs = Math.min(...all.map((pt) => pt.ts));
          setStartDate(new Date(minTs).toISOString().slice(0, 10));
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // ───────────────────────────────────────────────────────────
  // Helpers for comparison logic
  // ───────────────────────────────────────────────────────────
  const nearest = (arr, ts) => {
    if (!arr.length) return null;
    let lo = 0, hi = arr.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].ts < ts) lo = mid + 1;
      else hi = mid;
    }
    const a = arr[Math.max(0, lo - 1)];
    const b = arr[Math.min(arr.length - 1, lo)];
    return Math.abs((a?.ts ?? Infinity) - ts) <= Math.abs((b?.ts ?? Infinity) - ts) ? a : b;
  };

  const betweenStats = (arr, tsStart, tsEnd) => {
    const slice = arr.filter((pt) => pt.ts >= tsStart && pt.ts <= tsEnd);
    if (!slice.length) return { min: null, max: null, avg: null };
    let min = slice[0].price, max = slice[0].price, sum = 0;
    slice.forEach((pt) => {
      if (pt.price < min) min = pt.price;
      if (pt.price > max) max = pt.price;
      sum += pt.price;
    });
    return { min, max, avg: sum / slice.length };
  };

  // Build comparison rows when the user clicks a point
  const buildComparison = (clickedTs) => {
    if (!startDate) return;
    const startTs = new Date(startDate).getTime();
    const from = Math.min(startTs, clickedTs);
    const to = Math.max(startTs, clickedTs);

    const data = Object.keys(rawSeries)
      .map((country) => {
        const arr = rawSeries[country] || [];
        if (!arr.length) return null;

        const startPt = nearest(arr, startTs);
        const endPt = nearest(arr, clickedTs);
        const { min, max, avg } = betweenStats(arr, from, to);

        const start = startPt?.price ?? null;
        const end = endPt?.price ?? null;
        const delta = start != null && end != null ? end - start : null;
        const pct =
          start != null && end != null && start !== 0 ? ((end - start) / start) * 100 : null;

        return { country, start, end, delta, pct, min, max, avg };
      })
      .filter(Boolean);

    setRows(data);
    setCompareAt(clickedTs);
    setDrawerOpen(true);
  };

  // ───────────────────────────────────────────────────────────
  // Highcharts (TradingView-like)
  // ───────────────────────────────────────────────────────────
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
        buttonTheme: {
          fill: "none",
          style: { color: "#00ffd5" },
          states: { select: { fill: "#00ffd5", style: { color: "#000" } } },
        },
      },
      xAxis: { labels: { style: { color: "#aaa" } } },
      yAxis: {
        title: { text: "USD / MT", style: { color: "#00ffd5" } },
        labels: { style: { color: "#fff" } },
        gridLineColor: "rgba(0,255,213,0.06)",
      },
      legend: { enabled: true, itemStyle: { color: "#00ffd5", fontWeight: "bold" } },
      tooltip: {
        shared: true,
        backgroundColor: "#111",
        borderColor: "#00ffd5",
        style: { color: "white" },
      },
      exporting: {
        enabled: true,
        // You still get the default context menu on the chart
        buttons: {
          contextButton: {
            menuItems: [
              "viewFullscreen",
              "separator",
              "downloadPNG",
              "downloadJPEG",
              "downloadPDF",
              "downloadSVG",
              "separator",
              "downloadCSV",
              "downloadXLS",
              "viewData",
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
                buildComparison(this.x); // this.x is timestamp
              },
            },
          },
        },
      },
      series: seriesData,
    }),
    [seriesData, startDate, rawSeries]
  );

  // ───────────────────────────────────────────────────────────
  // UI actions
  // ───────────────────────────────────────────────────────────
  const resetFilters = () => {
    const defaults = countries.slice(0, 3);
    setSelected(defaults);
    setStartDate("");
    setDrawerOpen(false);
  };

  const downloadPNG = () => {
    const chart = chartRef.current?.chart;
    if (chart?.exportChartLocal) {
      chart.exportChartLocal({ type: "image/png", filename: "carbonxinsight-chart" });
    } else if (chart?.exportChart) {
      chart.exportChart({ type: "image/png", filename: "carbonxinsight-chart" });
    }
  };

  const downloadCSV = () => {
    const chart = chartRef.current?.chart;
    if (chart?.downloadCSV) chart.downloadCSV();
  };

  return (
    <section className="panel">
      {/* Header / Filters */}
      <header className="panel-head compact">
        <div className="title-wrap">
          <span className="title-badge">📈</span>
          <h2>TradingView — Coconut Shell Charcoal Market</h2>
        </div>

        <div className="filters-row">
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

          <label className="filter">
            <span>Start Date</span>
            <input
              type="date"
              className="date-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <button className="btn-pill" onClick={resetFilters}>
            Reset
          </button>

          <div className="download-bar">
            <button className="btn-ghost" onClick={downloadPNG}>Download PNG</button>
            <button className="btn-ghost" onClick={downloadCSV}>Download CSV</button>
          </div>
        </div>
      </header>

      {/* KPI: Market Summary */}
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

      {/* KPI: Country chips */}
      <div className="kpi-chips">
        {kpis.map((k) => {
          const up = (k.change_pct ?? 0) >= 0;
          return (
            <div key={k.country} className="kpi-chip" title={k.country}>
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
      </div>

      {/* TradingView Graph */}
      <HighchartsReact
        ref={chartRef}
        highcharts={Highcharts}
        constructorType="stockChart"
        options={highchartsOptions}
      />

      {/* Comparison Drawer / Table */}
      {drawerOpen && (
        <div className="compare-drawer">
          <div className="compare-head">
            <h3>
              Comparison • From <b>{startDate || "—"}</b> to{" "}
              <b>{compareAt ? new Date(compareAt).toISOString().slice(0, 10) : "—"}</b>
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
                    <td>{r.start != null ? `$${r.start.toFixed(2)}` : "—"}</td>
                    <td>{r.end != null ? `$${r.end.toFixed(2)}` : "—"}</td>
                    <td className={r.delta >= 0 ? "pos" : "neg"}>
                      {r.delta != null
                        ? `${r.delta >= 0 ? "+" : "-"}$${Math.abs(r.delta).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className={r.pct >= 0 ? "pos" : "neg"}>
                      {r.pct != null
                        ? `${r.pct >= 0 ? "+" : "-"}${Math.abs(r.pct).toFixed(2)}%`
                        : "—"}
                    </td>
                    <td>{r.min != null ? `$${r.min.toFixed(2)}` : "—"}</td>
                    <td>{r.max != null ? `$${r.max.toFixed(2)}` : "—"}</td>
                    <td>{r.avg != null ? `$${r.avg.toFixed(2)}` : "—"}</td>
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
