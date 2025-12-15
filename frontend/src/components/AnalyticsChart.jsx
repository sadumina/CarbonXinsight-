// ✅ CarbonXInsight — Market Dashboard (FINAL, STABLE)

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import "./AnalyticsChart.css";
import HaycarbLogo from "../assets/haycarb-logo.png";

// Export tools
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

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

  // --------------------------------------------------
  // Load countries → DEFAULT SELECT ALL
  // --------------------------------------------------
  useEffect(() => {
    (async () => {
      const { data = [] } = await axios.get(`${API}/countries`);
      setCountries(data);
      setSelected(data); // ✅ ALL SELECTED BY DEFAULT
    })();
  }, []);

  // --------------------------------------------------
  // Fetch time series
  // --------------------------------------------------
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

      Object.values(grouped).forEach((arr) =>
        arr.sort((a, b) => a.ts - b.ts)
      );

      const series = Object.keys(grouped).map((country) => ({
        id: `series-${country}`,
        name: country,
        data: grouped[country].map((pt) => [pt.ts, pt.price]),
        tooltip: { valueDecimals: 2 },
      }));

      setRawSeries(grouped);
      setSeriesData(series);
    });
  }, [selected, fromDate, toDate]);

  // --------------------------------------------------
  // Force FULL RANGE (same as clicking "All")
  // --------------------------------------------------
  useEffect(() => {
    if (!chartRef.current || seriesData.length === 0) return;
    chartRef.current.chart.xAxis[0].setExtremes(null, null);
  }, [seriesData]);

  // --------------------------------------------------
  // Country toggle
  // --------------------------------------------------
  const toggleCountry = (c) => {
    setSelected(
      selected.includes(c)
        ? selected.filter((x) => x !== c)
        : [...selected, c]
    );
  };

  // --------------------------------------------------
  // Comparison helpers
  // --------------------------------------------------
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
    return Math.abs((a?.ts ?? Infinity) - ts) <=
      Math.abs((b?.ts ?? Infinity) - ts)
      ? a
      : b;
  };

  const betweenStats = (arr, start, end) => {
    const slice = arr.filter(
      (p) => p.ts >= start.ts && p.ts <= end.ts
    );
    if (!slice.length) return {};
    const prices = slice.map((p) => p.price);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
    };
  };

  const buildComparison = (clickedTs) => {
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;

    const data = Object.keys(rawSeries)
      .map((country) => {
        const arr = rawSeries[country];
        if (!arr?.length) return null;

        const start = fromTs ? nearest(arr, fromTs) : arr[0];
        const end = nearest(arr, clickedTs);
        if (!start || !end) return null;

        const stats = betweenStats(arr, start, end);

        return {
          country,
          startDate: new Date(start.ts).toISOString().slice(0, 10),
          endDate: new Date(end.ts).toISOString().slice(0, 10),
          delta: end.price - start.price,
          pct: start.price
            ? ((end.price - start.price) / start.price) * 100
            : null,
          ...stats,
        };
      })
      .filter(Boolean);

    setRows(data);
    setCompareAt(clickedTs);
    setDrawerOpen(true);
  };

  // --------------------------------------------------
  // Chart options
  // --------------------------------------------------
  const chartOptions = useMemo(
    () => ({
      chart: {
        backgroundColor: "#1a2128",
        height: 520,
        zoomType: "x",
      },
      title: { text: "" },
      subtitle: { text: "" },

      legend: { enabled: true },
      tooltip: { shared: true, backgroundColor: "#1b242c" },

      rangeSelector: {
        selected: 5, // ✅ DEFAULT = ALL
        inputEnabled: false,
      },

      navigator: { enabled: false },
      scrollbar: { enabled: false },

      plotOptions: {
        series: {
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
    [seriesData]
  );

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <section className="panel">
      <header className="panel-head compact">
        <img
          src={HaycarbLogo}
          className="brand-logo"
          alt="Haycarb Logo"
        />

        <div className="title-wrap center">
          <h2>Coconut Shell Charcoal Pricing</h2>
          <div className="subtitle">
            Haycarb • Coconut Shell Charcoal
          </div>
        </div>
      </header>

      {/* Country pills */}
      <div className="filters-row">
        <div className="pill-container">
          {countries.map((c) => (
            <span
              key={c}
              className={`pill ${
                selected.includes(c) ? "pill-active" : ""
              }`}
              onClick={() => toggleCountry(c)}
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* Chart */}
      <HighchartsReact
        ref={chartRef}
        highcharts={Highcharts}
        constructorType="stockChart"
        options={chartOptions}
      />

      {/* Comparison Drawer (unchanged, already styled in CSS) */}
      {drawerOpen && (
        <div className="compare-drawer">
          <div className="compare-head">
            <h3>
              Comparison until{" "}
              <b>
                {compareAt
                  ? new Date(compareAt)
                      .toISOString()
                      .slice(0, 10)
                  : "—"}
              </b>
            </h3>
            <button
              className="close"
              onClick={() => setDrawerOpen(false)}
            >
              ×
            </button>
          </div>

          <table className="compare-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Start</th>
                <th>End</th>
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
                  <td>{r.startDate}</td>
                  <td>{r.endDate}</td>
                  <td className={r.delta >= 0 ? "pos" : "neg"}>
                    {r.delta?.toFixed(2) ?? "—"}
                  </td>
                  <td className={r.pct >= 0 ? "pos" : "neg"}>
                    {fmtPct(r.pct)}
                  </td>
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
