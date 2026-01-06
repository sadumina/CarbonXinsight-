// ✅ CarbonXInsight — Analytics Dashboard (Country Aggregated + KPI Cards)

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
  else if (mod?.default) mod.default(Highcharts);
}
initHC(Exporting);
initHC(ExportData);
initHC(OfflineExporting);

const API = "http://localhost:8000";

// ==========================
// 🎨 COUNTRY COLOR SYSTEM
// ==========================
const COUNTRY_COLORS = {
  "Sri Lanka": "#16A34A", // Emerald Green
  "India": "#DC2626", // Strong Red
  "Indonesia": "#2563EB", // Royal Blue
};
const MUTED_COLOR = "#475569";

// ---------- helpers ----------
const fmtPct = (v) => (v == null ? "—" : `${Number(v).toFixed(2)}%`);

export default function AnalyticsChart() {
  const chartRef = useRef(null);

  // ==========================
  // STATE
  // ==========================
  const [countries, setCountries] = useState([]);
  const [selected, setSelected] = useState([]);

  const [seriesData, setSeriesData] = useState([]);
  const [rawSeries, setRawSeries] = useState({});

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [rows, setRows] = useState([]);
  const [aggRows, setAggRows] = useState([]);
  const [kpis, setKpis] = useState([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compareAt, setCompareAt] = useState(null);

  // ✅ Progressive disclosure flags (NEW)
  const [hasDateRange, setHasDateRange] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // ==========================
  // LOAD COUNTRIES
  // ==========================

  // ==========================
// CALCULATION EXPLANATION (NEW)
// ==========================
const [showCalc, setShowCalc] = useState(false);
const [calcType, setCalcType] = useState(null);

  useEffect(() => {
    (async () => {
      const { data = [] } = await axios.get(`${API}/countries`);
      setCountries(data);
      setSelected(data);
    })();
  }, []);
// ==========================
// KPI SUMMARY FOR EXPORT (NEW)
// ==========================
const exportKpiSummary = useMemo(() => {
  if (!kpis.length) return null;

  const values = kpis.flatMap((k) => [k.min, k.avg, k.max]);

  return {
    min: Math.min(...values).toFixed(2),
    avg: (
      values.reduce((a, b) => a + b, 0) / values.length
    ).toFixed(2),
    max: Math.max(...values).toFixed(2),
  };
}, [kpis]);

  // ==========================
  // FETCH AGGREGATED SERIES
  // ==========================
  useEffect(() => {
    if (!selected.length) return;

    const url = new URL(`${API}/series/aggregated`);
    selected.forEach((c) => url.searchParams.append("countries", c));

    axios.get(url.toString()).then((res) => {
      const grouped = {};

      (res.data || []).forEach((p) => {
        const ts = new Date(p.date).getTime();
        if (!grouped[p.country]) grouped[p.country] = [];
        grouped[p.country].push({ ts, price: p.price });
      });

      Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.ts - b.ts));

      // ✅ APPLY COLOR + HIGHLIGHT
      const series = Object.keys(grouped).map((country) => {
        const isActive = selected.includes(country);
        return {
          id: country,
          name: country,
          data: grouped[country].map((pt) => [pt.ts, pt.price]),
          color: COUNTRY_COLORS[country] || MUTED_COLOR,
          lineWidth: isActive ? 4 : 2,
          opacity: isActive ? 1 : 0.25,
          zIndex: isActive ? 10 : 1,
        };
      });

      setRawSeries(grouped);
      setSeriesData(series);
    });
  }, [selected]);

  // ==========================
  // RESET ZOOM ON DATA CHANGE
  // ==========================
  useEffect(() => {
    if (!chartRef.current || !seriesData.length) return;
    chartRef.current.chart.xAxis[0].setExtremes(null, null);
  }, [seriesData]);

  // ==========================
  // APPLY DATE RANGE + LOAD KPI
  // ==========================
  const applyCalendarRange = async () => {
    if (!chartRef.current || !fromDate || !toDate) return;

    const min = new Date(fromDate).getTime();
    const max = new Date(toDate).getTime();

    if (min > max) {
      alert("From date must be before To date");
      return;
    }

    // Zoom chart
    chartRef.current.chart.xAxis[0].setExtremes(min, max);

    // Load KPI data
    const res = await axios.get(`${API}/compare/summary`, {
      params: { fromDate, toDate },
    });

    setKpis(res.data.filter((r) => selected.includes(r.country)));

    // ✅ Progressive disclosure: KPIs appear only after Apply
    setHasDateRange(true);
  };

  // ==========================
  // REFRESH VIEW
  // ==========================
  const handleRefreshView = () => {
    setDrawerOpen(false);
    setRows([]);
    setAggRows([]);
    setKpis([]);
    setCompareAt(null);

    // ✅ Reset disclosure flags (NEW)
    setHasDateRange(false);
    setHasInteracted(false);

    if (chartRef.current) {
      chartRef.current.chart.xAxis[0].setExtremes(null, null);
    }
  };

  // ==========================
  // HELPERS
  // ==========================
  const nearest = (arr, ts) => {
    let lo = 0,
      hi = arr.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (arr[mid].ts < ts) lo = mid + 1;
      else hi = mid;
    }
    return arr[Math.max(0, lo - 1)];
  };

  // ==========================
  // BUILD COMPARISON (CLICK)
  // ==========================
  const buildComparison = async (clickedTs) => {
    // ✅ Progressive disclosure: user interaction unlocks advanced drawer
    setHasInteracted(true);

    const minTs = fromDate ? new Date(fromDate).getTime() : null;

    const data = Object.keys(rawSeries)
      .map((country) => {
        const arr = rawSeries[country];
        if (!arr?.length) return null;

        const start = minTs ? nearest(arr, minTs) : arr[0];
        const end = nearest(arr, clickedTs);
        if (!start || !end) return null;

        return {
          country,
          start,
          end,
          delta: end.price - start.price,
          pct: ((end.price - start.price) / start.price) * 100,
        };
      })
      .filter(Boolean);

    setRows(data);
    setCompareAt(clickedTs);
    setDrawerOpen(true);

    if (fromDate && toDate) {
      const res = await axios.get(`${API}/compare/summary`, {
        params: { fromDate, toDate },
      });
      setAggRows(res.data || []);
    }
  };

  // ==========================
  // CHART OPTIONS
  // ==========================
  const chartOptions = useMemo(
    () => ({
      chart: {
        backgroundColor: "#1a2128",
        height: 520,
        zoomType: "x",
      },

      exporting: {
  enabled: true,
  sourceWidth: 1200,
  sourceHeight: 720,

  chartOptions: {
    title: {
      text: "Coconut Shell Charcoal Pricing",
      style: {
        fontSize: "20px",
        fontWeight: "700",
      },
    },

    subtitle: {
      text:
        fromDate && toDate
          ? `Period: ${fromDate} → ${toDate}`
          : "All available data",
      style: {
        fontSize: "13px",
        color: "#9fb2c8",
      },
    },

    caption: {
      text: "Source: CarbonXInsight • Generated automatically",
      style: {
        fontSize: "11px",
        color: "#94a3b8",
      },
    },

    chart: {
      spacingTop: 120,
      spacingBottom: 80,
    },

    annotations: exportKpiSummary
      ? [
          {
            labels: [
              {
                align: "left",
                verticalAlign: "top",
                y: -90,
                x: 0,
                useHTML: true,
                html: `
                  <div style="display:flex;gap:16px">
                    ${["Min", "Avg", "Max"]
                      .map(
                        (k) => `
                      <div style="
                        background:#0f1720;
                        border:1px solid rgba(255,255,255,0.15);
                        border-radius:8px;
                        padding:10px 14px;
                        min-width:120px;
                        text-align:center;
                        color:#f4f7fa;
                        font-family:Inter,system-ui;
                      ">
                        <div style="font-size:11px;color:#9fb2c8">${k}</div>
                        <div style="font-size:18px;font-weight:700">
                          ${exportKpiSummary[k.toLowerCase()]}
                        </div>
                      </div>
                    `
                      )
                      .join("")}
                  </div>
                `,
              },
            ],
          },
        ]
      : [],
  },
},


      tooltip: {
        shared: true,
        useHTML: true,
        backgroundColor: "#0f1720",
        borderColor: "rgba(23,138,51,0.6)",
        borderRadius: 10,
        style: { color: "#f4f7fa", fontSize: "13px", fontWeight: "600" },
        enabled: !drawerOpen,
        formatter() {
          return this.points
            .map(
              (p) => `
              <div style="display:flex;align-items:center;gap:6px">
                <span style="width:10px;height:10px;border-radius:50%;background:${p.color}"></span>
                <b>${p.series.name}</b>: ${p.y}
              </div>
            `
            )
            .join("");
        },
      },

      xAxis: { crosshair: !drawerOpen },
      legend: { enabled: true },

      rangeSelector: {
        selected: 5,
        inputEnabled: false,
        inputStyle: { color: "transparent" },
        labelStyle: { color: "transparent" },
      },

      navigator: { enabled: false },
      scrollbar: { enabled: false },

      plotOptions: {
        series: {
          cursor: "pointer",
          marker: { enabled: false },
          states: {
            inactive: { opacity: 0.2 },
          },
          point: {
            events: {
              click() {
                buildComparison(this.x);
              },
            },
          },
        },
      },

      series: seriesData,
    }),
    [seriesData, drawerOpen, fromDate, toDate]
  );

  // ==========================
  // RENDER
  // ==========================
  return (
    <section className={`panel ${drawerOpen ? "drawer-open" : ""}`}>
      {/* Header */}
      <header className="dashboard-header">
        <img src={HaycarbLogo} className="header-logo" alt="Haycarb" />
        <div>
          <h1 className="header-title">Coconut Shell Charcoal Pricing</h1>
          <p className="header-subtitle">Haycarb • Country-Level Market Analytics</p>
        </div>
      </header>

      {/* Date Range */}
      <div className="date-row">
        <div className="date-field">
          <label>From</label>
          <input
            type="date"
            className="date-input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className="date-field">
          <label>To</label>
          <input
            type="date"
            className="date-input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <button
          className="date-apply-btn"
          onClick={applyCalendarRange}
          disabled={!fromDate || !toDate}
          
        >
          Apply
        </button>
      </div>

      {/* ✅ Progressive disclosure hint (NEW)
      {!hasDateRange && (
        <div className="helper-hint">
          Select a date range and click Apply to unlock KPI insights. Click a point on the chart to open comparison.
        </div>
      )} */}

      {/* KPI CARDS (✅ shown only after Apply) */}
      {hasDateRange && kpis.length > 0 && (
        <div className="kpi-row">
          {kpis.map((k) => (
            <div
              key={k.country}
              className="kpi-card"
              style={{
                borderTop: `4px solid ${COUNTRY_COLORS[k.country] || MUTED_COLOR}`,
              }}
            >
              <div className="kpi-country">{k.country}</div>

              <div className="kpi-values">
                <div className="kpi-item">
                  <div className="kpi-label">Min</div>
                  <div className="kpi-value">{k.min}</div>
                </div>
                <div className="kpi-item">
                  <div className="kpi-label">Avg</div>
                  <div className="kpi-value">{k.avg}</div>
                </div>
                <div className="kpi-item">
                  <div className="kpi-label">Max</div>
                  <div className="kpi-value">{k.max}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="chart-card">
        <HighchartsReact
          ref={chartRef}
          highcharts={Highcharts}
          constructorType="stockChart"
          options={chartOptions}
        />
      </div>

      {/* Comparison Drawer (✅ shown only after interaction) */}
      {hasInteracted && drawerOpen && (
        <div className="compare-drawer">
          <div className="compare-head">
            <div>
              <div className="compare-title">Country Comparison</div>
              <div className="compare-subtitle">
                {fromDate} → {toDate}
              </div>
            </div>

            <button className="btn-ghost" onClick={handleRefreshView}>
              ⟳ Refresh
            </button>
          </div>

          <table className="compare-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Min</th>
                <th>Avg</th>
                <th>Max</th>
                <th>Δ</th>
                <th>Δ%</th>
              </tr>
            </thead>

            <tbody>
              {aggRows.map((a) => {
                const deltaRow = rows.find((r) => r.country === a.country);

                return (
                  <tr key={a.country}>
                    <td>{a.country}</td>
                    <td>{a.min}</td>
                    <td>{a.avg}</td>
                    <td>{a.max}</td>
                    <td>{deltaRow ? deltaRow.delta.toFixed(2) : "—"}</td>
                    <td>{deltaRow ? fmtPct(deltaRow.pct) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
