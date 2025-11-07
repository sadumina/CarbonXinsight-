// ✅ src/components/AnalyticsChart.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Highcharts from "highcharts/highstock";
import HighchartsReact from "highcharts-react-official";
import "./AnalyticsChart.css";

const API = "http://localhost:8000";

export default function AnalyticsChart() {
  const [countries, setCountries] = useState([]);
  const [selected, setSelected] = useState([]);
  const [seriesData, setSeriesData] = useState([]);     // Highcharts format
  const [rawSeries, setRawSeries] = useState({});       // { country: [{ts, price}, ...] }
  const [kpis, setKpis] = useState([]);

  // comparison drawer states
  const [startDate, setStartDate] = useState("");       // yyyy-mm-dd
  const [compareAt, setCompareAt] = useState(null);     // timestamp (ms)
  const [rows, setRows] = useState([]);                 // computed table rows
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ───────────────────────────────────────────────────────────
  // Load dropdown + KPI
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/countries`).then((res) => {
      const list = res.data || [];
      setCountries(list);
      setSelected(list.slice(0, 3));
    });
    axios.get(`${API}/analytics/current-kpis`).then((res) => setKpis(res.data || []));
  }, []);

  // ───────────────────────────────────────────────────────────
  // Fetch series (PDF backend: /series)
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
      // sort points
      Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.ts - b.ts));

      // Highcharts series
      const hc = Object.keys(grouped).map((c) => ({
        name: c,
        data: grouped[c].map((pt) => [pt.ts, pt.price]),
        tooltip: { valueDecimals: 2 },
      }));

      setRawSeries(grouped);
      setSeriesData(hc);

      // if user hasn't chosen a start date, default to earliest timestamp
      if (!startDate) {
        const minTs = Math.min(
          ...Object.values(grouped).flat().map((pt) => pt.ts)
        );
        setStartDate(new Date(minTs).toISOString().slice(0, 10));
      }
    });
  }, [selected]);

  // ───────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────
  const nearest = (arr, ts) => {
    // binary search for closest by ts; arr sorted
    let lo = 0, hi = arr.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].ts < ts) lo = mid + 1;
      else hi = mid;
    }
    // lo is first >= ts; compare with previous to pick closer
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

  // Build comparison rows when user clicks a point
  const buildComparison = (clickedTs) => {
    if (!startDate) return;
    const startTs = new Date(startDate).getTime();
    const from = Math.min(startTs, clickedTs);
    const to = Math.max(startTs, clickedTs);

    const data = Object.keys(rawSeries).map((country) => {
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

      return {
        country,
        start,
        end,
        delta,
        pct,
        min,
        max,
        avg,
      };
    }).filter(Boolean);

    setRows(data);
    setCompareAt(clickedTs);
    setDrawerOpen(true);
  };

  // ───────────────────────────────────────────────────────────
  // Highcharts options (TradingView style)
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
      }},
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
      plotOptions: {
        series: {
          marker: { enabled: false },
          point: {
            events: {
              click: function () {
                // this.x is timestamp (ms)
                buildComparison(this.x);
              },
            },
          },
        },
      },
      series: seriesData,
    }),
    [seriesData, startDate, rawSeries]
  );

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>📈 TradingView — Coconut Shell Charcoal Market</h2>

        {/* Filters */}
        <div className="filters">
          <label className="filter-block">
            <span>Start Date</span>
            <input
   type="date"
   className="date-input"
   value={startDate}
   onChange={(e) => setStartDate(e.target.value)}
/>

          </label>

          <label className="filter-block">
            <span>Markets</span>
            <select
              multiple
              className="country-select"
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
        </div>
      </header>

      {/* KPI Summary Row */}
      <div className="kpi-section">
        {kpis.map((k, idx) => (
          <div key={idx} className="kpi-card">
            <h4>{k.country}</h4>
            <div className="kpi-row-item"><span>Min</span><b>${k.min.toFixed(2)}</b></div>
            <div className="kpi-row-item"><span>Max</span><b>${k.max.toFixed(2)}</b></div>
            <div className="kpi-row-item"><span>Current</span><b>${k.current.toFixed(2)}</b></div>
            <div className={`kpi-change ${k.change_pct >= 0 ? "positive" : "negative"}`}>
              {k.change_pct >= 0 ? "▲" : "▼"} {k.change_pct.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>

      {/* TradingView Graph */}
      <HighchartsReact
        highcharts={Highcharts}
        constructorType="stockChart"
        options={highchartsOptions}
      />

      {/* ─────────────────────────────
          Comparison Drawer / Table
         ───────────────────────────── */}
      {drawerOpen && (
        <div className="compare-drawer">
          <div className="compare-head">
            <h3>
              Comparison • From <b>{startDate}</b> to{" "}
              <b>{new Date(compareAt).toISOString().slice(0, 10)}</b>
            </h3>
            <button className="close" onClick={() => setDrawerOpen(false)}>×</button>
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
                      {r.delta != null ? `${r.delta >= 0 ? "+" : ""}$${Math.abs(r.delta).toFixed(2)}` : "—"}
                    </td>
                    <td className={r.pct >= 0 ? "pos" : "neg"}>
                      {r.pct != null ? `${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(2)}%` : "—"}
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
