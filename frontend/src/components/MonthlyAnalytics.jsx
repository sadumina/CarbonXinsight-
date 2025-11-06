import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";
import "./MonthlyAnalytics.css";

const API = "http://localhost:8000";
const money = (n) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2
  }).format(Number(n));

const MONTHS = [
  "1","2","3","4","5","6","7","8","9","10","11","12"
];

function MonthYearPicker({ month, year, setMonth, setYear }) {
  return (
    <>
      <label className="mv-label">Month</label>
      <select
        className="mv-input"
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
      >
        {MONTHS.map(m => <option key={m} value={m}>{m.padStart(2,"0")}</option>)}
      </select>

      <label className="mv-label">Year</label>
      <input
        className="mv-input"
        type="number"
        value={year}
        onChange={(e) => setYear(Number(e.target.value || new Date().getFullYear()))}
      />
    </>
  );
}

const NeonTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="mv-tip">
      <div className="mv-tip-label">{label}</div>
      {payload.map((p, i) => (
        <div className="mv-tip-row" key={i}>
          <span className="dot" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="val">{money(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function MonthlyAnalytics() {
  const now = new Date();
  const [pdfs, setPdfs] = useState([]);
  const [pdf, setPdf] = useState("");       // empty = all PDFs
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [data, setData] = useState([]);     // [{country, avg_price, min_price, max_price}]
  const [loading, setLoading] = useState(false);

  // initial PDFs
  useEffect(() => {
    axios.get(`${API}/pdfs`).then(r => setPdfs(r.data || []));
  }, []);

  // fetch monthly analytics
  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API}/analytics/month`, {
        params: { month, year, ...(pdf ? { pdf } : {}) }
      })
      .then((r) => setData(r.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [month, year, pdf]);

  const chartData = useMemo(() => data.map(d => ({
    country: d.country,
    avg: d.avg_price,
    min: d.min_price,
    max: d.max_price
  })), [data]);

  return (
    <section className="mv-wrap">
      {/* Controls */}
      <div className="mv-toolbar">
        <div className="mv-controls">
          <MonthYearPicker
            month={month}
            year={year}
            setMonth={setMonth}
            setYear={setYear}
          />

          <label className="mv-label">PDF</label>
          <select className="mv-input" value={pdf} onChange={(e) => setPdf(e.target.value)}>
            <option value="">All PDFs</option>
            {pdfs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <button
            className="mv-cta"
            type="button"
            onClick={() => {
              // manual refresh (optional)
              setLoading(true);
              axios.get(`${API}/analytics/month`, {
                params: { month, year, ...(pdf ? { pdf } : {}) }
              }).then(r => setData(r.data || []))
                .finally(() => setLoading(false));
            }}
          >
            {loading ? "Loading…" : "Get Data"}
          </button>
        </div>

        <div className="mv-sub">
          {pdf ? `Source: ${pdf}` : "Source: All uploaded PDFs"} • {`Month ${month}, ${year}`}
        </div>
      </div>

      {/* Chart */}
      <div className="mv-card">
        <div className="mv-card-head">
          <h3>Per-Country Comparison (Avg / Min / Max)</h3>
        </div>
        <div className="mv-chart">
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d1ff" stopOpacity={0.95}/>
                  <stop offset="100%" stopColor="#00d1ff" stopOpacity={0.25}/>
                </linearGradient>
                <linearGradient id="minGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff6b9a" stopOpacity={0.95}/>
                  <stop offset="100%" stopColor="#ff6b9a" stopOpacity={0.25}/>
                </linearGradient>
                <linearGradient id="maxGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f7a7" stopOpacity={0.95}/>
                  <stop offset="100%" stopColor="#00f7a7" stopOpacity={0.25}/>
                </linearGradient>
              </defs>

              <CartesianGrid stroke="rgba(0,255,179,.08)" vertical={false} />
              <XAxis dataKey="country" stroke="var(--mv-accent)" height={60} interval={0} tick={{ fontSize: 12 }}/>
              <YAxis stroke="var(--mv-accent)" tickFormatter={money}/>
              <Tooltip content={<NeonTooltip />} />
              <Legend />
              <Bar dataKey="avg" name="Average" fill="url(#avgGrad)" radius={[8,8,0,0]} />
              <Bar dataKey="min" name="Min"     fill="url(#minGrad)" radius={[8,8,0,0]} />
              <Bar dataKey="max" name="Max"     fill="url(#maxGrad)" radius={[8,8,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Country KPI grid */}
      <div className="mv-grid">
        {data.map((c) => (
          <div className="mv-kpi-card" key={c.country}>
            <div className="mv-kpi-head">{c.country}</div>
            <div className="mv-kpi-row">
              <div className="mv-pill">
                <div className="lbl">Average</div>
                <div className="val">{money(c.avg_price)}</div>
              </div>
              <div className="mv-pill">
                <div className="lbl">Min</div>
                <div className="val">{money(c.min_price)}</div>
              </div>
              <div className="mv-pill">
                <div className="lbl">Max</div>
                <div className="val">{money(c.max_price)}</div>
              </div>
            </div>
          </div>
        ))}
        {!data.length && (
          <div className="mv-empty">No data for this month. Try another month/year or PDF.</div>
        )}
      </div>
    </section>
  );
}
