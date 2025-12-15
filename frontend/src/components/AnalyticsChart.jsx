// ✅ CarbonXInsight — Market Dashboard (FINAL with Calculation Popup)

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
const fmtUsd = (v) => (v == null ? "—" : `$${Number(v).toFixed(2)}`);
const fmtPct = (v) => (v == null ? "—" : `${Number(v).toFixed(2)}%`);
const fmtDate = (ts) => new Date(ts).toISOString().slice(0, 10);

export default function AnalyticsChart() {
  const chartRef = useRef(null);

  const [countries, setCountries] = useState([]);
  const [selected, setSelected] = useState([]);
  const [seriesData, setSeriesData] = useState([]);
  const [rawSeries, setRawSeries] = useState({});

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
  // Force ALL range
  // ======================================================
  useEffect(() => {
    if (!chartRef.current || !seriesData.length) return;
    chartRef.current.chart.xAxis[0].setExtremes(null, null);
  }, [seriesData]);

  // ======================================================
  // Comparison helpers
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

  const buildComparison = (clickedTs) => {
    const data = Object.keys(rawSeries).map((country) => {
      const arr = rawSeries[country];
      const start = arr[0];
      const end = nearest(arr, clickedTs);

      const slice = arr.filter(
        (p) => p.ts >= start.ts && p.ts <= end.ts
      );
      const prices = slice.map((p) => p.price);
      const avg =
        prices.reduce((a, b) => a + b, 0) / prices.length;

      return {
        country,
        start,
        end,
        delta: end.price - start.price,
        pct:
          ((end.price - start.price) / start.price) * 100,
        avg,
      };
    });

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
  inputEnabled: false, // ✅ REQUIRED
  inputBoxBorderColor: "transparent",
  inputStyle: {
    color: "transparent",
  },
  labelStyle: {
    color: "transparent",
  },
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
    [seriesData, drawerOpen]
  );

  // ======================================================
  // Render
  // ======================================================
  return (
    <section className={`panel ${drawerOpen ? "drawer-open" : ""}`}>
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

      <div className="chart-card">
        <HighchartsReact
          ref={chartRef}
          highcharts={Highcharts}
          constructorType="stockChart"
          options={chartOptions}
        />
      </div>

      {/* ================= COMPARISON ================= */}
      {drawerOpen && (
        <div className="compare-drawer">
          <div className="compare-head">
            <div className="compare-title">Market Comparison</div>
            <div className="compare-subtitle">
              Time period: {fmtDate(compareAt)}
            </div>
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

                  {/* Δ */}
                  <td className="calc-cell">
                    <span className="calc-value">
                      {r.delta.toFixed(2)}
                    </span>
                    <span
                      className="calc-icon"
                      onClick={() =>
                        setEquation({
                          title: "Change (Δ)",
                          formula: "Δ = End Price − Start Price",
                          steps: [
                            `End Price = ${r.end.price}`,
                            `Start Price = ${r.start.price}`,
                            `Δ = ${r.end.price} − ${r.start.price} = ${r.delta.toFixed(
                              2
                            )}`,
                          ],
                        })
                      }
                    >
                      ⓘ
                    </span>
                  </td>

                  {/* Δ% */}
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
                            `End Price = ${r.end.price}`,
                            `Start Price = ${r.start.price}`,
                            `Δ% = (${r.end.price} − ${r.start.price}) / ${r.start.price} × 100`,
                            `Δ% = ${r.pct.toFixed(2)}%`,
                          ],
                        })
                      }
                    >
                      ⓘ
                    </span>
                  </td>

                  {/* Avg */}
                  <td>{r.avg.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= CALCULATION POPUP ================= */}
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
