// ✅ CarbonXInsight — Market Dashboard (FINAL)

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

// ---------- helpers ----------
const fmtPct = (v) => (v == null ? "—" : `${Number(v).toFixed(2)}%`);
const fmtDate = (ts) => new Date(ts).toISOString().slice(0, 10);

export default function AnalyticsChart() {
  const chartRef = useRef(null);

  // data
  const [countries, setCountries] = useState([]);
  const [selected, setSelected] = useState([]);
  const [seriesData, setSeriesData] = useState([]);
  const [rawSeries, setRawSeries] = useState({});

  // calendar
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // comparison
  const [rows, setRows] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compareAt, setCompareAt] = useState(null);

  // calculation popup
  const [equation, setEquation] = useState(null);

  // ======================================================
  // Load countries (DEFAULT: ALL)
  // ======================================================
  useEffect(() => {
    (async () => {
      const { data = [] } = await axios.get(`${API}/countries`);
      setCountries(data);
      setSelected(data);
    })();
  }, []);

  // ======================================================
  // Fetch series data
  // ======================================================
  useEffect(() => {
    if (!selected.length) return;

    const url = new URL(`${API}/series`);
    selected.forEach((c) => url.searchParams.append("countries", c));

    axios.get(url.toString()).then((res) => {
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
        data: grouped[country].map((pt) => [pt.ts, pt.price]),
      }));

      setRawSeries(grouped);
      setSeriesData(series);
    });
  }, [selected]);

  // ======================================================
  // Reset zoom initially
  // ======================================================
  useEffect(() => {
    if (!chartRef.current || !seriesData.length) return;
    chartRef.current.chart.xAxis[0].setExtremes(null, null);
  }, [seriesData]);

  // ======================================================
  // Apply calendar range
  // ======================================================
  const applyCalendarRange = () => {
    if (!chartRef.current || !fromDate || !toDate) return;

    const min = new Date(fromDate).getTime();
    const max = new Date(toDate).getTime();

    if (min > max) {
      alert("From date must be before To date");
      return;
    }

    chartRef.current.chart.xAxis[0].setExtremes(min, max);
  };

  // ======================================================
  // Reset view after comparison
  // ======================================================
  const handleRefreshView = () => {
    setDrawerOpen(false);
    setRows([]);
    setCompareAt(null);
    setEquation(null);

    if (chartRef.current) {
      chartRef.current.chart.xAxis[0].setExtremes(null, null);
    }
  };

  // ======================================================
  // Helpers
  // ======================================================
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

  // ======================================================
  // Build comparison (respects calendar)
  // ======================================================
  const buildComparison = (clickedTs) => {
    const minTs = fromDate ? new Date(fromDate).getTime() : null;

    const data = Object.keys(rawSeries)
      .map((country) => {
        const arr = rawSeries[country];
        if (!arr?.length) return null;

        const start = minTs ? nearest(arr, minTs) : arr[0];
        const end = nearest(arr, clickedTs);
        if (!start || !end) return null;

        const slice = arr.filter(
          (p) => p.ts >= start.ts && p.ts <= end.ts
        );
        const avg =
          slice.reduce((s, p) => s + p.price, 0) /
          slice.length;

        return {
          country,
          start,
          end,
          delta: end.price - start.price,
          pct:
            ((end.price - start.price) / start.price) *
            100,
          avg,
        };
      })
      .filter(Boolean);

    setRows(data);
    setCompareAt(clickedTs);
    setDrawerOpen(true);
  };

  // ======================================================
  // Chart options
  // ======================================================
  const chartOptions = useMemo(
    () => ({
      chart: {
        backgroundColor: "#1a2128",
        height: 520,
        zoomType: "x",
      },

      tooltip: {
        shared: true,
        useHTML: true,
        backgroundColor: "#0f1720",
        borderColor: "rgba(23,138,51,0.6)",
        borderRadius: 10,
        style: {
          color: "#f4f7fa",
          fontSize: "13px",
          fontWeight: "600",
        },
        enabled: !drawerOpen,
      },

      xAxis: {
        crosshair: !drawerOpen,
      },

      legend: { enabled: true },

      rangeSelector: {
        selected: 5,
        inputEnabled: false,
        inputBoxBorderColor: "transparent",
        inputStyle: { color: "transparent" },
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

  // ======================================================
  // Render
  // ======================================================
  return (
    <section className={`panel ${drawerOpen ? "drawer-open" : ""}`}>
      {/* Header */}
      <header className="dashboard-header">
        <img src={HaycarbLogo} className="header-logo" alt="Haycarb" />
        <div>
          <h1 className="header-title">
            Coconut Shell Charcoal Pricing
          </h1>
          <p className="header-subtitle">
            Haycarb • Coconut Shell Charcoal Market Analytics
          </p>
        </div>
      </header>

      {/* Calendar */}
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

      {/* Chart */}
      <div className="chart-card">
        <HighchartsReact
          ref={chartRef}
          highcharts={Highcharts}
          constructorType="stockChart"
          options={chartOptions}
        />
      </div>

      {/* Comparison */}
      {drawerOpen && (
        <div className="compare-drawer">
          <div className="compare-head">
            <div>
              <div className="compare-title">Market Comparison</div>
              <div className="compare-subtitle">
                Up to {fmtDate(compareAt)}
              </div>
            </div>

            <button
              className="compare-refresh-btn"
              onClick={handleRefreshView}
            >
              ⟳ Refresh
            </button>
          </div>

          <table className="compare-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Δ</th>
                <th>Δ%</th>
                <th>Avg</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.country}>
                  <td>{r.country}</td>

                  <td className="calc-cell">
                    <span className="calc-value">
                      {r.delta.toFixed(2)}
                    </span>
                    <span
                      className="calc-icon"
                      onClick={() =>
                        setEquation({
                          title: "Change (Δ)",
                          formula: "Δ = End − Start",
                          steps: [
                            `End = ${r.end.price}`,
                            `Start = ${r.start.price}`,
                            `Δ = ${r.delta.toFixed(2)}`,
                          ],
                        })
                      }
                    >
                      ⓘ
                    </span>
                  </td>

                  <td className="calc-cell">
                    <span className="calc-value">
                      {fmtPct(r.pct)}
                    </span>
                    <span
                      className="calc-icon"
                      onClick={() =>
                        setEquation({
                          title: "Percentage Change (Δ%)",
                          formula:
                            "(End − Start) / Start × 100",
                          steps: [
                            `End = ${r.end.price}`,
                            `Start = ${r.start.price}`,
                            `Δ% = ${r.pct.toFixed(2)}%`,
                          ],
                        })
                      }
                    >
                      ⓘ
                    </span>
                  </td>

                  <td>{r.avg.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Calculation Popup */}
      {equation && (
        <div className="equation-modal">
          <div className="equation-box">
            <h4>{equation.title}</h4>
            <div className="equation-formula">
              {equation.formula}
            </div>
            <ul className="equation-steps">
              {equation.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <button
              className="btn-ghost"
              onClick={() => setEquation(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
