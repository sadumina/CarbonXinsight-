// src/components/AverageMarkets.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./AverageMarkets.css";

const API = "http://localhost:8000";

export default function AverageMarkets() {
  const [data, setData] = useState([]);
  const [pdfs, setPdfs] = useState([]);
  const [filters, setFilters] = useState({ pdf: "", month: "", year: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API}/pdfs`).then(res => setPdfs(res.data || []));
    load();
    // eslint-disable-next-line
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.pdf) params.pdf = filters.pdf;
      if (filters.month) params.month = Number(filters.month);
      if (filters.year) params.year = Number(filters.year);

      const { data } = await axios.get(`${API}/analytics/avg`, { params });
      setData(data || []);
    } finally {
      setLoading(false);
    }
  };

  const maxAvg = useMemo(() => (data.length ? Math.max(...data.map(d => d.avg_price || 0)) : 0), [data]);

  return (
    <section className="avg-wrap">
      <div className="avg-toolbar">
        <div className="filters">
          <select value={filters.pdf} onChange={(e)=>setFilters(f=>({...f, pdf: e.target.value}))}>
            <option value="">All PDFs</option>
            {pdfs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input placeholder="Month" type="number" min="1" max="12"
                 value={filters.month}
                 onChange={(e)=>setFilters(f=>({...f, month: e.target.value}))}/>
          <input placeholder="Year" type="number"
                 value={filters.year}
                 onChange={(e)=>setFilters(f=>({...f, year: e.target.value}))}/>
          <button onClick={load} disabled={loading}>{loading? "Loading…" : "Apply"}</button>
        </div>
        <h2>📈 Average Price — Market Comparison</h2>
      </div>

      {/* Bars (simple, readable without extra libs) */}
      <div className="bars">
        {data.map((row) => {
          const w = maxAvg ? (row.avg_price / maxAvg) * 100 : 0;
          return (
            <div className="bar-row" key={row.country}>
              <div className="bar-label" title={row.country}>{row.country}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${w}%` }} />
              </div>
              <div className="bar-value">${row.avg_price?.toFixed(2)}</div>
            </div>
          );
        })}
        {!data.length && <p className="muted">No data for selected filter.</p>}
      </div>

      {/* Comparison table mirroring the four KPI cards */}
      <h3 className="table-title">🧭 Quick Comparison (Averages Only)</h3>
      <div className="table-scroller">
        <table className="avg-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Market</th>
              <th>Average</th>
              <th className="muted">Note</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.country}>
                <td>{i + 1}</td>
                <td>{r.country}</td>
                <td><b>${r.avg_price?.toFixed(2)}</b></td>
                <td className="muted">{r.avg_price === maxAvg ? "⬆ Highest" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
