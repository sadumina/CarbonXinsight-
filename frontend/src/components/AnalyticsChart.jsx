// ✅ CarbonXInsight — Analytics Dashboard
// Country Aggregated + KPI Cards (with Δ and Δ%) + Point Click Popup (Nice)

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
  "Sri Lanka": "#16A34A",
  India: "#DC2626",
  Indonesia: "#2563EB",
};
const MUTED_COLOR = "#475569";

// ---------- helpers ----------
const fmtNum = (v) => (v == null || v === "" ? "—" : Number(v).toFixed(2));

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

  const [kpis, setKpis] = useState([]);
  const [hasDateRange, setHasDateRange] = useState(false);

  // ✅ point click popup
  const [pointDetails, setPointDetails] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  

useEffect(() => {
  axios
    .get(`${API}/meta/data-status`)
    .then((res) => {
      const raw = res.data?.last_updated;
      if (!raw) return;

      const parsed = new Date(raw);
      if (!isNaN(parsed)) {
        setLastUpdated(parsed);
      }
    })
    .catch((err) => {
      console.error("Failed to load data status", err);
    });
}, []);


  // ==========================
  // LOAD COUNTRIES
  // ==========================
  useEffect(() => {
    (async () => {
      const { data = [] } = await axios.get(`${API}/countries`);
      setCountries(data);
      setSelected(data);
    })();
  }, []);

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

      // sort by time
      Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.ts - b.ts));

      // build series for Highcharts
      const series = Object.keys(grouped).map((country) => ({
        id: country,
        name: country,
        data: grouped[country].map((pt) => ({
          x: pt.ts,
          y: pt.price,
          country,
        })),
        color: COUNTRY_COLORS[country] || MUTED_COLOR,
        lineWidth: 3,
      }));

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
  // APPLY DATE RANGE + KPI
  // ==========================
  const applyCalendarRange = async () => {
    if (!chartRef.current || !fromDate || !toDate) return;

    const min = new Date(fromDate).getTime();
    const max = new Date(toDate).getTime();

    if (min > max) {
      alert("From date must be before To date");
      return;
    }

    // zoom chart
    chartRef.current.chart.xAxis[0].setExtremes(min, max);

    // load KPI data
    const res = await axios.get(`${API}/compare/summary`, {
      params: { fromDate, toDate },
    });

    setKpis((res.data || []).filter((r) => selected.includes(r.country)));
    setHasDateRange(true);
  };

  // ==========================
  // KPI CHANGE (Δ, Δ%)
  // Rule: first value -> last value (for that country in loaded series)
  // ==========================
  const computeChange = (country) => {
    const arr = rawSeries[country];
    if (!arr || arr.length < 2) return null;

    const start = Number(arr[0].price);
    const end = Number(arr[arr.length - 1].price);

    if (!isFinite(start) || !isFinite(end) || start === 0) return null;

    const delta = end - start;
    const pct = (delta / start) * 100;

    return { delta, pct };
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

      tooltip: {
        useHTML: true,
        backgroundColor: "#020617",
        borderColor: "#1f2937",
        borderRadius: 10,
        shadow: false,
        padding: 12,
        style: {
          color: "#e5e7eb",
          fontSize: "12px",
        },
      },

      xAxis: { type: "datetime" },

      rangeSelector: {
        selected: 5,
        inputEnabled: false,
        labelStyle: { color: "transparent" },
      },

      navigator: { enabled: false },
      scrollbar: { enabled: false },

      plotOptions: {
        series: {
          cursor: "pointer",
          marker: { enabled: false },
          point: {
            events: {
              click() {
                setPointDetails({
                  country: this.country,
                  price: this.y,
                  date: new Date(this.x),
                });
              },
            },
          },
        },
      },
      exporting: {
        enabled: true,

        // Professional filename
        filename: `CarbonXInsight_Price_Stats_${fromDate || "ALL"}_${
          toDate || "ALL"
        }`,

        // Print-ready resolution
        sourceWidth: 1400,
        sourceHeight: 800,

        chartOptions: {
          title: {
            text: "Coconut Shell Charcoal Pricing",
            style: {
              fontSize: "20px",
              fontWeight: "700",
            },
          },

          subtitle: {
            text: [
              "Unit: USD / MT",
              fromDate && toDate
                ? `Period: ${fromDate} → ${toDate}`
                : "Period: All available data",
            ].join(" • "),
            style: {
              fontSize: "13px",
              color: "#9fb2c8",
            },
          },

          caption: {
            text: `Markets: ${selected.join(", ")}`,
            style: {
              fontSize: "11px",
              color: "#94a3b8",
            },
          },
        },

        buttons: {
          contextButton: {
            menuItems: [
              "viewFullscreen",
              "printChart",
              "separator",

              {
                text: "Download PNG (Report)",
                onclick() {
                  this.exportChart({ type: "image/png" });
                },
              },
              {
                text: "Download JPG (Email)",
                onclick() {
                  this.exportChart({ type: "image/jpeg" });
                },
              },
              {
                text: "Download PDF (Executive)",
                onclick() {
                  this.exportChart({ type: "application/pdf" });
                },
              },
              {
                text: "Download SVG (Design)",
                onclick() {
                  this.exportChart({ type: "image/svg+xml" });
                },
              },

              "separator",

              {
                text: "Download CSV (Data)",
                onclick() {
                  this.downloadCSV();
                },
              },
              {
                text: "Download XLS (Excel)",
                onclick() {
                  this.downloadXLS();
                },
              },
            ],
          },
        },
      },

      series: seriesData,
    }),
    [seriesData]
  );

  // ==========================
  // RENDER
  // ==========================
  return (
    <section className="panel">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <img src={HaycarbLogo} className="header-logo" alt="Haycarb" />
          <div>
            <h1 className="header-title">Coconut Shell Charcoal Pricing</h1>
            <p className="header-subtitle">
              Haycarb • Country-Level Market Analytics
            </p>
            <p className="header-meta">
              Prices shown in <strong>USD / MT</strong> (Metric Ton)
            </p>
          </div>
        </div>

        {lastUpdated && (
          <div className="data-status">
            <span className="status-dot" />
            Data updated until{" "}
            <strong>
              {lastUpdated.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </strong>
          </div>
        )}
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

      {/* KPI Cards */}
      {hasDateRange && kpis.length > 0 && (
        <div className="kpi-row">
          {kpis.map((k) => {
            const change = computeChange(k.country);

            return (
              <div
                key={k.country}
                className="kpi-card"
                style={{
                  borderTop: `4px solid ${
                    COUNTRY_COLORS[k.country] || MUTED_COLOR
                  }`,
                }}
              >
                <div className="kpi-country">{k.country}</div>

                <div className="kpi-values">
                  <div className="kpi-item">
                    <div className="kpi-label">Min</div>
                    <div className="kpi-value">{fmtNum(k.min)}</div>
                  </div>
                  <div className="kpi-item">
                    <div className="kpi-label">Avg</div>
                    <div className="kpi-value">{fmtNum(k.avg)}</div>
                  </div>
                  <div className="kpi-item">
                    <div className="kpi-label">Max</div>
                    <div className="kpi-value">{fmtNum(k.max)}</div>
                  </div>
                </div>

                {change && (
                  <div className="kpi-change">
                    <span
                      className={`kpi-delta ${
                        change.delta >= 0 ? "up" : "down"
                      }`}
                    >
                      {change.delta >= 0 ? "+" : ""}
                      {change.delta.toFixed(2)}
                    </span>

                    <span
                      className={`kpi-pct ${change.pct >= 0 ? "up" : "down"}`}
                    >
                      ({change.pct >= 0 ? "+" : ""}
                      {change.pct.toFixed(2)}%)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
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

      {/* ✅ NICE POPUP MESSAGE (click a point) */}
      {pointDetails && (
        <div
          className="point-pop-overlay"
          onClick={() => setPointDetails(null)}
        >
          <div className="point-pop-card" onClick={(e) => e.stopPropagation()}>
            <div className="point-pop-header">
              <div className="point-pop-title">Price Snapshot</div>
              <div
                className="point-pop-badge"
                style={{
                  background:
                    COUNTRY_COLORS[pointDetails.country] || MUTED_COLOR,
                }}
              >
                {pointDetails.country}
              </div>
            </div>

            <div className="point-pop-body">
              <div className="point-pop-item">
                <span>Date</span>
                <strong>
                  {pointDetails.date.toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </strong>
              </div>

              <div className="point-pop-item">
                <span>Price</span>
                <strong className="point-pop-price">
                  USD/MT {Number(pointDetails.price).toFixed(2)}
                </strong>
              </div>
            </div>

            <div className="point-pop-foot">Click outside to close</div>
          </div>
        </div>
      )}
    </section>
  );
}
