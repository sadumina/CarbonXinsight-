// ✅ CarbonXInsight — Market Dashboard (v1 Enhanced: Centered Layout + Refresh + Export Headers)
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import "./AnalyticsChart.css";
import HaycarbLogo from "../assets/haycarb-logo.png";

// Exports
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

  const FORECAST_ENABLED = false;

  // Simple full refresh (kept for now; can be changed to soft refresh later)
  const handleRefresh = () => {
    window.location.reload();
  };

  // Load countries
  useEffect(() => {
    (async () => {
      const { data: list = [] } = await axios.get(`${API}/countries`);
      setCountries(list);
      setSelected([]);
    })();
  }, []);

  // Fetch time-series
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

      const mainSeries = Object.keys(grouped).map((country) => ({
        id: `series-${country}`,
        name: country,
        data: grouped[country].map((pt) => [pt.ts, pt.price]),
        tooltip: { valueDecimals: 2 },
      }));

      setRawSeries(grouped);
      setSeriesData(mainSeries);
    });
  }, [selected, fromDate, toDate]);

  const toggleCountry = (c) => {
    setSelected(
      selected.includes(c)
        ? selected.filter((x) => x !== c)
        : [...selected, c]
    );
  };

  // ===== Comparison helpers =====
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

  const betweenStats = (arr, startPt, endPt) => {
    if (!startPt || !endPt)
      return { min: null, max: null, avg: null };
    const slice = arr.filter(
      (pt) => pt.ts >= startPt.ts && pt.ts <= endPt.ts
    );
    if (!slice.length)
      return { min: null, max: null, avg: null };
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
          pct:
            start.price &&
            ((end.price - start.price) / start.price) * 100,
          min: stats.min,
          max: stats.max,
          avg: stats.avg,
        };
      })
      .filter(Boolean);

    setRows(data);
    setCompareAt(clickedTs);
    setDrawerOpen(true);
  };

  // ===== Chart options =====
  const chartOptions = useMemo(() => {
    const selectedMarketNames = selected.length
      ? selected.join(", ")
      : "No markets selected";
    const dateRangeText = `${fromDate || "Start"} → ${
      toDate || "Latest"
    }`;

    return {
      chart: {
        backgroundColor: "#1a2128",
        height: 520,
      },
      title: { text: "" },
      subtitle: { text: "" },

      exporting: {
        enabled: true,
        filename: `CarbonXInsight_${dateRangeText.replace(
          /[^0-9A-Za-z]/g,
          "_"
        )}`,
        chartOptions: {
          title: {
            text: "Coconut Shell Charcoal Pricing",
            style: { fontSize: "18px", fontWeight: "bold" },
          },
          subtitle: {
            text: `${selectedMarketNames} • ${dateRangeText}`,
            style: { fontSize: "13px", color: "#333" },
          },
        },
      },

      legend: { enabled: true },
      tooltip: { shared: true, backgroundColor: "#1b242c" },
      rangeSelector: { selected: 4, inputEnabled: false },
      navigator: { enabled: false },
      scrollbar: { enabled: false },

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
    };
  }, [seriesData, selected, fromDate, toDate]);

  // ===== Export comparison =====
  const exportComparisonPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(
      "CarbonXInsight — Market Comparison Report",
      14,
      15
    );
    autoTable(doc, {
      startY: 25,
      head: [
        [
          "Country",
          "Start Date",
          "End Date",
          "Change",
          "Change %",
          "Min",
          "Max",
          "Avg",
        ],
      ],
      body: rows.map((r) => [
        r.country,
        r.startDate,
        r.endDate,
        r.delta?.toFixed(2) || "—",
        r.pct ? `${r.pct.toFixed(2)}%` : "—",
        fmtUsd(r.min),
        fmtUsd(r.max),
        fmtUsd(r.avg),
      ]),
      theme: "grid",
    });
    doc.save("CarbonXInsight_Comparison.pdf");
  };

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
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparison");
    XLSX.writeFile(
      wb,
      "CarbonXInsight_Comparison.xlsx"
    );
  };

  return (
    <section className="panel">
      {/* HEADER */}
      <header className="panel-head compact">
        <div className="brand-left">
          <img
            src={HaycarbLogo}
            className="brand-logo"
            alt="Haycarb Logo"
          />
        </div>

        <div className="title-wrap center">
          <h2>Coconut Shell Charcoal Pricing</h2>
          <div className="subtitle">
            Haycarb • Coconut Shell Charcoal
          </div>
        </div>

        <button
          className="refresh-btn"
          onClick={handleRefresh}
          title="Refresh Dashboard"
        >
          ⟳
        </button>
      </header>

      {/* FILTERS – separate block under title for clean layout */}
      <div className="filters-row">
        <div className="pill-container">
          {countries.map((c) => (
            <span
              key={c}
              className={`pill ${
                selected.includes(c)
                  ? "pill-active"
                  : ""
              }`}
              onClick={() => toggleCountry(c)}
            >
              {c}
            </span>
          ))}
        </div>

        <div className="date-row">
          <label className="filter">
            <span>From</span>
            <input
              type="date"
              className="date-input"
              value={fromDate}
              onChange={(e) =>
                setFromDate(e.target.value)
              }
            />
          </label>

          <label className="filter">
            <span>To</span>
            <input
              type="date"
              className="date-input"
              value={toDate}
              onChange={(e) =>
                setToDate(e.target.value)
              }
            />
          </label>
        </div>
      </div>

      {/* CHART */}
      <HighchartsReact
        ref={chartRef}
        highcharts={Highcharts}
        constructorType="stockChart"
        options={chartOptions}
      />

      {/* COMPARISON DRAWER */}
      {drawerOpen && (
        <div className="compare-drawer">
          <div className="compare-head">
            <h3>
              From <b>{fromDate || "start"}</b> →{" "}
              <b>
                {compareAt
                  ? new Date(
                      compareAt
                    )
                      .toISOString()
                      .slice(0, 10)
                  : "—"}
              </b>
            </h3>

            <div className="drawer-actions">
              <button
                className="btn-ghost"
                onClick={exportComparisonExcel}
              >
                Excel
              </button>
              <button
                className="btn-ghost"
                onClick={exportComparisonPDF}
              >
                PDF
              </button>
              <button
                className="close"
                onClick={() => setDrawerOpen(false)}
              >
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
                  <td
                    className={
                      r.delta >= 0 ? "pos" : "neg"
                    }
                  >
                    {r.delta?.toFixed(2) || "—"}
                  </td>
                  <td
                    className={
                      r.pct >= 0 ? "pos" : "neg"
                    }
                  >
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
