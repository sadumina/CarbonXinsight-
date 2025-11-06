import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./AnalyticsChart.css";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

const API = "http://localhost:8000";

export default function AnalyticsChart() {
  const [countries, setCountries] = useState([]);
  const [selected, setSelected] = useState([]); // multi select
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [series, setSeries] = useState([]); // [{country, points:[{date,...}]}]
  const [loading, setLoading] = useState(false);

  // load list of countries from excel data
  useEffect(() => {
    axios.get(`${API}/countries-series`).then((res) => {
      setCountries(res.data || []);
      // pick first 2 by default
      setSelected((res.data || []).slice(0, 2));
    });
  }, []);

  // fetch time series when filters change
  useEffect(() => {
    const fetchSeries = async () => {
      setLoading(true);
      try {
        const params = {};
        selected.forEach((c) => (params.countries = [...(params.countries || []), c]));
        if (start) params.start = start;
        if (end) params.end = end;
        const { data } = await axios.get(`${API}/series-excel`, { params });
        setSeries(data.series || []);
      } finally {
        setLoading(false);
      }
    };
    fetchSeries();
  }, [selected, start, end]);

  // Build one merged array per country for Recharts
  const merged = useMemo(() => {
    // flatten to [{country, date, price, ...stats}]
    const flat = [];
    for (const s of series) {
      for (const p of s.points) {
        flat.push({
          country: s.country,
          date: new Date(p.date),
          price: p.price,
          min: p.min_to_date,
          max: p.max_to_date,
          avg: p.avg_to_date,
          change: p.change_pct_from_start,
        });
      }
    }
    return flat;
  }, [series]);

  // For X axis as string
  const allDates = useMemo(() => {
    const set = new Set(merged.map((d) => d.date.toISOString().slice(0, 10)));
    return [...set].sort();
  }, [merged]);

  // Build chart data rows: one row per date, fields price_<country>
  const chartRows = useMemo(() => {
    const map = new Map();
    for (const d of allDates) {
      map.set(d, { date: d });
    }
    for (const r of merged) {
      const key = r.date.toISOString().slice(0, 10);
      const row = map.get(key);
      row[`price_${r.country}`] = r.price;
      // keep latest stats per country for tooltip enrichment
      row[`stats_${r.country}`] = {
        min: r.min,
        max: r.max,
        avg: r.avg,
        change: r.change,
      };
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [merged, allDates]);

  // Colors (no hard-coded brand colors)
  const colorAt = (i) => ["#00ffd5", "#ffaa00", "#ff5ea3", "#9fff00", "#00a2ff"][i % 5];

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>📈 Time Series — Excel (2023–2025)</h2>
        <div className="filters">
          {/* multi select (simple) */}
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

          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder="Start"
          />
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            placeholder="End"
          />
          <button className="clear-btn" onClick={() => { setStart(""); setEnd(""); }}>
            Clear Range
          </button>
        </div>
      </header>

      <div className="chart-wrap">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : chartRows.length === 0 ? (
          <p className="muted">No data. Upload an Excel or widen your filters.</p>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={chartRows}>
              <CartesianGrid stroke="rgba(0,255,179,0.08)" />
              <XAxis dataKey="date" stroke="var(--accent)" />
              <YAxis stroke="var(--accent)" />
              <Tooltip
                content={({ payload, label }) => {
                  if (!payload || payload.length === 0) return null;
                  return (
                    <div className="tooltip-card">
                      <div className="tip-title">{label}</div>
                      {selected.map((c, i) => {
                        const row = payload.find((p) => p.dataKey === `price_${c}`);
                        const stats = chartRows.find((r) => r.date === label)?.[`stats_${c}`];
                        if (!row) return null;
                        return (
                          <div key={c} className="tip-block">
                            <div className="tip-country" style={{ borderColor: colorAt(i) }}>
                              {c}
                            </div>
                            <div className="tip-line">Price: <b>${row.value?.toFixed(2)}</b></div>
                            {stats && (
                              <>
                                <div className="tip-line">Min: <b>${stats.min.toFixed(2)}</b></div>
                                <div className="tip-line">Max: <b>${stats.max.toFixed(2)}</b></div>
                                <div className="tip-line">Avg: <b>${stats.avg.toFixed(2)}</b></div>
                                <div className="tip-line">
                                  Change from start:{" "}
                                  <b>{(stats.change ?? 0).toFixed(2)}%</b>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
              <Legend />
              {selected.map((c, i) => (
                <Line
                  key={c}
                  type="monotone"
                  dataKey={`price_${c}`}
                  stroke={colorAt(i)}
                  dot={false}
                  strokeWidth={2.5}
                  name={c}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
