// ✅ CarbonXInsight — Analytics Dashboard
// Country Aggregated + KPI Cards (with Δ and Δ%) + Point Click Popup (Nice)

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import "./AnalyticsChart.css";
import HaycarbLogo from "../assets/haycarb-logo.png";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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

const API = import.meta.env.VITE_API_BASE;


// ==========================
// 🎨 COUNTRY COLOR SYSTEM
// ==========================
const COUNTRY_COLORS = {
  "Sri Lanka": "#16A34A",
  India: "#DC2626",
  Indonesia: "#2563EB",
};
const MUTED_COLOR = "#475569";

// // ---------- helpers ----------
// const fmtNum = (v) => (v == null || v === "" ? "—" : Number(v).toFixed(2));

const fmtNum = (v) =>
  v == null || v === "" ? "—" : Math.ceil(Number(v));


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

  const [hasUserInteraction, setHasUserInteraction] = useState(false);
    // ✅ NEW: track real user interaction + visible range
  const [visibleRange, setVisibleRange] = useState({ min: null, max: null });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const reportRef = useRef(null);
  

  

// ==========================
  // LOAD META STATUS
  // ==========================
  useEffect(() => {
    axios
      .get("/meta/data-status")
      .then((res) => {
        const raw = res.data?.last_updated;
        if (!raw) return;

        const parsed = new Date(raw);
        if (!isNaN(parsed)) setLastUpdated(parsed);
      })
      .catch((err) => console.error("Failed to load data status", err));
  }, []);

  // ==========================
  // LOAD COUNTRIES
  // ==========================
  useEffect(() => {
    (async () => {
      const { data = [] } = await axios.get("/countries");
      setCountries(data);
      setSelected(data);
    })();
  }, []);

  // ==========================
  // FETCH AGGREGATED SERIES
  // ==========================
  useEffect(() => {
    if (!selected.length) return;

    const params = new URLSearchParams();
    selected.forEach((c) => params.append("countries", c));

    axios.get(`/series/aggregated?${params.toString()}`).then((res) => {
      const grouped = {};

      (res.data || []).forEach((p) => {
        const ts = new Date(p.date).getTime();
        if (!grouped[p.country]) grouped[p.country] = [];
        grouped[p.country].push({ ts, price: p.price });
      });

      Object.values(grouped).forEach((arr) =>
        arr.sort((a, b) => a.ts - b.ts)
      );

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
  // KPI LOADER
  // ==========================
  const loadKpisForRange = async (from, to) => {
    if (!from || !to) return;

    const res = await axios.get("/compare/summary", {
      params: { fromDate: from, toDate: to },
    });

    setKpis((res.data || []).filter((r) => selected.includes(r.country)));
    setHasDateRange(true);
  };

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

  // Zoom chart
  chartRef.current.chart.xAxis[0].setExtremes(min, max);

  // Load KPI automatically
  await loadKpisForRange(fromDate, toDate);
};


  const refreshDashboard = async () => {
  if (!chartRef.current) return;

  try {
    setIsRefreshing(true);

    // 1) Clear date inputs + KPI state
    setFromDate("");
    setToDate("");
    setKpis([]);
    setHasDateRange(false);

    // 2) Clear interaction state (so KPI delta uses full series again)
    setHasUserInteraction(false);
    setVisibleRange({ min: null, max: null });

    // 3) Close point popup if open
    setPointDetails(null);

    // 4) Reset zoom to ALL
    chartRef.current.chart.xAxis[0].setExtremes(null, null);

    // 5) (Optional but nice) Re-fetch last updated badge
    const res = await axios.get(`${API}/meta/data-status`);
    const raw = res.data?.last_updated;
    if (raw) {
      const parsed = new Date(raw);
      if (!isNaN(parsed)) setLastUpdated(parsed);
    }

    // 6) (Optional) Re-fetch the aggregated series again (fresh data)
    // If your backend data can change while UI is open, keep this.
    const url = new URL(`${API}/series/aggregated`);
    selected.forEach((c) => url.searchParams.append("countries", c));

    const seriesRes = await axios.get(url.toString());

    const grouped = {};
    (seriesRes.data || []).forEach((p) => {
      const ts = new Date(p.date).getTime();
      if (!grouped[p.country]) grouped[p.country] = [];
      grouped[p.country].push({ ts, price: p.price });
    });
    Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.ts - b.ts));

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
  } catch (err) {
    console.error("Refresh failed", err);
  } finally {
    setIsRefreshing(false);
  }
};

  // ==========================
  // KPI CHANGE (Δ, Δ%)
  // Rule: first value -> last value (for that country in loaded series)
  // ==========================
// ==========================
// KPI CHANGE (Δ, Δ%) — RANGE-AWARE
// Uses the selected date range (fromDate/toDate) if available,
// otherwise falls back to full series.
// ==========================
// ==========================
// KPI CHANGE (Δ, Δ%) — USER INTERACTION AWARE
// ==========================
const computeChange = (country) => {
  const arr = rawSeries[country];
  if (!arr || arr.length < 2) return null;

  // If user interacted, use visible chart range
  const useVisible =
    hasUserInteraction &&
    visibleRange.min != null &&
    visibleRange.max != null;

  const points = useVisible
    ? arr.filter(
        (p) => p.ts >= visibleRange.min && p.ts <= visibleRange.max
      )
    : arr;

  if (!points || points.length < 2) return null;

  const start = Number(points[0].price);
  const end = Number(points[points.length - 1].price);

  if (!isFinite(start) || !isFinite(end) || start === 0) return null;

  const delta = end - start;
  const pct = (delta / start) * 100;

  return { delta, pct };
};


const applyPresetRange = async (preset) => {
  if (!chartRef.current) return;

  const now = new Date();
  let from = null;
  let to = new Date();

  if (preset.all) {
    // Reset to ALL
    chartRef.current.chart.xAxis[0].setExtremes(null, null);
    setFromDate("");
    setToDate("");
    setKpis([]);
    setHasDateRange(false);
    return;
  }

  if (preset.ytd) {
    from = new Date(now.getFullYear(), 0, 1);
  } else {
    from = new Date();
    from.setMonth(from.getMonth() - preset.months);
  }

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  // Set UI date inputs
  setFromDate(fromStr);
  setToDate(toStr);

  // Zoom chart
  chartRef.current.chart.xAxis[0].setExtremes(
    from.getTime(),
    to.getTime()
  );

  // 🔥 AUTO LOAD KPI (NO APPLY CLICK NEEDED)
  await loadKpisForRange(fromStr, toStr);
};

  // ==========================
  // CHART OPTIONS
  // ==========================

  const downloadReportPDF = async () => {
  if (!reportRef.current) {
    console.error("Report container not found");
    return;
  }

  try {
    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      backgroundColor: "#0f172a",
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

    pdf.save(
      `CarbonXInsight_Report_${fromDate || "ALL"}_${toDate || "ALL"}.pdf`
    );
  } catch (err) {
    console.error("Failed to generate PDF", err);
  }
};
const downloadReportImage = async () => {
  if (!reportRef.current) {
    console.error("Report container not found");
    return;
  }

  try {
    // ✅ ENTER EXPORT MODE
    document.body.classList.add("export-mode");

    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    const link = document.createElement("a");
    link.download = `CarbonXInsight_Report_${fromDate || "ALL"}_${toDate || "ALL"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.error("Failed to generate image", err);
  } finally {
    // ✅ EXIT EXPORT MODE
    document.body.classList.remove("export-mode");
  }
};

  const chartOptions = useMemo(() => ({
  chart: {
    backgroundColor: "#ffffff", // ✅ force white
    height: 520,
    zoomType: "x",
  },

  title: { text: null },

  tooltip: {
    useHTML: true,
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 10,
    shadow: true,
    padding: 12,
    style: {
      color: "#0f172a",
      fontSize: "12px",
    },
  },

  xAxis: {
    type: "datetime",
    gridLineWidth: 0,
    lineColor: "#e5e7eb",
    tickColor: "#e5e7eb",

    events: {
      afterSetExtremes(e) {
        setVisibleRange({
          min: e.min ?? null,
          max: e.max ?? null,
        });

        if (e?.trigger) {
          setHasUserInteraction(true);
        }
      },
    },
  },

  yAxis: {
    title: { text: null },
    gridLineColor: "rgba(15,23,42,0.08)",
    labels: {
      style: {
        color: "#334155",
        fontSize: "12px",
      },
    },
  },

  rangeSelector: { enabled: false },
  navigator: { enabled: false },
  scrollbar: { enabled: false },

  plotOptions: {
    series: {
      cursor: "pointer",
      marker: { enabled: false },
      lineWidth: 3,

      point: {
        events: {
          click() {
            setHasUserInteraction(true);
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

    filename: `CarbonXInsight_Price_Stats_${fromDate || "ALL"}_${toDate || "ALL"}`,

    sourceWidth: 1400,
    sourceHeight: 800,

    chartOptions: {
      chart: {
        backgroundColor: "#ffffff", // ✅ export stays white
      },

      title: {
        text: "Coconut Shell Charcoal Pricing",
        style: {
          fontSize: "20px",
          fontWeight: "700",
          color: "#0f172a",
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
          color: "#475569",
        },
      },

      caption: {
        text: `Markets: ${selected.join(", ")}`,
        style: {
          fontSize: "11px",
          color: "#64748b",
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
}), [seriesData, fromDate, toDate, selected]);

  // ==========================
  // RENDER
  // ==========================
return (
  <section className="panel">
    {/* =========================
        HEADER (UI ONLY)
    ========================= */}
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

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 12,
            padding: "6px 10px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            fontSize: 12,
            color: "#E5E7EB",
          }}
        >
          <span style={{ opacity: 0.8 }}>Data Source:</span>
          <a
            href="https://coconutcommunity.org/page-statistics/weekly-price-update"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#93C5FD",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Coconut Community – Weekly Price Update
          </a>
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

    {/* =========================
        DATE TOOLBAR
    ========================= */}
    <div className="date-toolbar">
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

        <button
          className="date-refresh-btn"
          onClick={refreshDashboard}
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>

        <button
          className="download-btn secondary"
          onClick={downloadReportImage}
        >
          Download 
        </button>
      </div>

      <div className="preset-row">
        {[
          { label: "3M", months: 3 },
          { label: "6M", months: 6 },
          { label: "1Y", months: 12 },
          { label: "ALL", all: true },
        ].map((p) => (
          <button
            key={p.label}
            className="preset-btn"
            onClick={() => applyPresetRange(p)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>

    {/* =========================
        REPORT CONTAINER
    ========================= */}
    <div ref={reportRef} className="report-container">
      {/* ===== EXPORT HEADER ===== */}
<div className="export-header">
  <div className="export-header-left">
    <img src={HaycarbLogo} alt="Haycarb" className="export-logo" />
    <div>
      <div className="export-title">
        Coconut Shell Charcoal Pricing
      </div>
      <div className="export-subtitle">
        Country-Level Market Analytics
      </div>
    </div>
  </div>

  <div className="export-header-right">
    <div className="export-period">
      <strong>Period:</strong>{" "}
      {fromDate && toDate
        ? `${fromDate} → ${toDate}`
        : "All Available Data"}
    </div>
    <div className="export-meta">
      Unit: USD / MT<br />
      Generated: {new Date().toLocaleDateString("en-GB")}
    </div>
  </div>
</div>


      {/* 🔝 TIME PERIOD BANNER (TOP) */}
      {hasDateRange && (
        <div className="time-period-banner">
          <span className="time-label">Time Period:</span>
          <span className="time-value">
            {fromDate && toDate
              ? `${fromDate} → ${toDate}`
              : "All available data"}
          </span>
        </div>
      )}

      {/* KPI CARDS */}
      {hasDateRange && kpis.length > 0 && (
        <>
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
                      <div className="kpi-change-title">Price Change</div>
                      <div className="kpi-change-values">
                        <span
                          className={`kpi-delta ${
                            change.delta >= 0 ? "up" : "down"
                          }`}
                        >
                          {change.delta >= 0 ? "+" : ""}
                          {Math.round(change.delta)}
                        </span>
                        <span
                          className={`kpi-pct ${
                            change.pct >= 0 ? "up" : "down"
                          }`}
                        >
                          ({change.pct >= 0 ? "+" : ""}
                          {Math.round(change.pct)}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="kpi-explanation">
            <span className="info-icon">ⓘ</span>
            <span>
              <strong>Price Change (Δ)</strong> is calculated as the difference
              between the first and last recorded prices within the selected
              time range. <strong>Δ%</strong> represents the relative change.
            </span>
          </div>
        </>
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
    </div>

    {/* POINT POPUP */}
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
