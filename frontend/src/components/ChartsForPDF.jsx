import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
  LineChart, Line,
} from "recharts";
import "./ChartsForPDF.css";

const API = "http://localhost:8000";
const METRICS = [
  { key: "avg_price", label: "Average" },
  { key: "min_price", label: "Min" },
  { key: "max_price", label: "Max" },
];
// neon palette
const COLORS = ["#00f7a7", "#00d1ff", "#ffbc42", "#ff6b9a", "#a274ff", "#69ff97", "#54b9ff", "#ffc857", "#ff8fab", "#caa3ff"];

const money = (n) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n));

function MetricToggle({ metric, setMetric }) {
  return (
    <div className="vf-toggle">
      {METRICS.map((m) => (
        <button
          key={m.key}
          className={`vf-chip ${metric === m.key ? "is-active" : ""}`}
          onClick={() => setMetric(m.key)}
          type="button"
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

function CountryChips({ countries, selected, setSelected }) {
  const toggle = (c) =>
    setSelected((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]
    );

  return (
    <div className="vf-chips">
      {countries.map((c, i) => (
        <button
          key={`${c}-${i}`}
          type="button"
          className={`vf-chip sm ${selected.includes(c) ? "is-active" : ""}`}
          onClick={() => toggle(c)}
          title={c}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

// prettier tooltip for dark bg
const NeonTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="vf-tip">
      <div className="vf-tip-label">{label}</div>
      {payload.map((p, i) => (
        <div className="vf-tip-row" key={i}>
          <span className="dot" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="val">{money(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function ChartsForPDF() {
  const [pdfs, setPdfs] = useState([]);
  const [pdf, setPdf] = useState("");
  const [metric, setMetric] = useState("avg_price");

  // per-PDF country stats (avg/min/max)
  const [stats, setStats] = useState([]);
  // selected countries for line chart
  const [selectedCountries, setSelectedCountries] = useState([]);
  // time series data: { country: string, points: [{date, price}] }
  const [series, setSeries] = useState([]);
  const [loadingSeries, setLoadingSeries] = useState(false);

  // load PDFs once
  useEffect(() => {
    axios.get(`${API}/pdfs`).then(r => {
      setPdfs(r.data || []);
      if ((r.data || []).length && !pdf) setPdf(r.data[0]);
    });
  }, []);

  // load per-PDF country metrics
  useEffect(() => {
    if (!pdf) return;
    axios
      .get(`${API}/analytics/by-pdf`, { params: { source_pdf: pdf } })
      .then((r) => {
        setStats(r.data || []);
        setSelectedCountries((r.data || []).slice(0, 3).map(d => d.country)); // pick a few by default
      })
      .catch(() => setStats([]));
  }, [pdf]);

  // load series for selected countries (global time series)
  useEffect(() => {
    if (!selectedCountries.length) { setSeries([]); return; }
    let isCancelled = false;
    setLoadingSeries(true);

    Promise.all(
      selectedCountries.map((c) =>
        axios.get(`${API}/series`, { params: { country: c } }).then(r => ({
          country: c,
          points: (r.data || []).map(d => ({ date: new Date(d.date).toISOString().slice(0, 10), price: d.price })),
        }))
      )
    ).then((arr) => {
      if (!isCancelled) setSeries(arr);
    }).finally(() => {
      if (!isCancelled) setLoadingSeries(false);
    });

    return () => { isCancelled = true; };
  }, [selectedCountries]);

  const barData = useMemo(() => stats.map(s => ({ country: s.country, ...s })), [stats]);

  const pieData = useMemo(() => {
    const total = stats.reduce((acc, s) => acc + (s[metric] ?? 0), 0);
    return stats.map((s) => ({
      name: s.country,
      value: s[metric] ?? 0,
      pct: total ? ((s[metric] / total) * 100) : 0,
    }));
  }, [stats, metric]);

  // normalize series dates for multi-line chart
  const lineData = useMemo(() => {
    const allDates = Array.from(new Set(series.flatMap(s => s.points.map(p => p.date)))).sort();
    return allDates.map(d => {
      const obj = { date: d };
      series.forEach(s => {
        const found = s.points.find(p => p.date === d);
        obj[s.country] = found ? found.price : null;
      });
      return obj;
    });
  }, [series]);

  return (
    <section className="vf-wrap">
      {/* Controls */}
      <div className="vf-toolbar">
        <div className="vf-controls">
          <label className="vf-label">PDF</label>
          <select className="vf-input" value={pdf} onChange={(e) => setPdf(e.target.value)}>
            {pdfs.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <label className="vf-label">Metric</label>
          <MetricToggle metric={metric} setMetric={setMetric} />
        </div>

        <div className="vf-controls">
          <label className="vf-label">Countries (for time series)</label>
          <CountryChips
            countries={stats.map(s => s.country)}
            selected={selectedCountries}
            setSelected={setSelectedCountries}
          />
        </div>
      </div>

      {/* BAR: per-country metric for selected PDF */}
      <div className="vf-card">
        <div className="vf-card-head">
          <h3>Per-Country — {METRICS.find(m => m.key === metric)?.label} ( {pdf} )</h3>
        </div>
        <div className="vf-chart">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={barData} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f7a7" stopOpacity={0.95}/>
                  <stop offset="100%" stopColor="#00f7a7" stopOpacity={0.25}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(0,255,179,0.08)" vertical={false}/>
              <XAxis dataKey="country" stroke="var(--accent)" tick={{ fontSize: 12 }} interval={0} height={64} />
              <YAxis stroke="var(--accent)" tickFormatter={money}/>
              <Tooltip content={<NeonTooltip/>}/>
              <Legend />
              <Bar dataKey={metric} name={METRICS.find(m => m.key === metric)?.label} fill="url(#barGrad)" radius={[8,8,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PIE: share by metric */}
      <div className="vf-grid">
        <div className="vf-card">
          <div className="vf-card-head">
            <h3>Share by {METRICS.find(m => m.key === metric)?.label}</h3>
          </div>
          <div className="vf-chart">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0];
                  return (
                    <div className="vf-tip">
                      <div className="vf-tip-label">{p?.name}</div>
                      <div className="vf-tip-row"><span>Value</span><span className="val">{money(p?.value)}</span></div>
                      <div className="vf-tip-row"><span>Share</span><span className="val">{(p?.payload?.pct || 0).toFixed(2)}%</span></div>
                    </div>
                  );
                }}/>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={75}
                  outerRadius={120}
                  paddingAngle={2}
                >
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend layout="vertical" align="right" verticalAlign="middle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LINE: time series (global) for selected countries */}
        <div className="vf-card">
          <div className="vf-card-head">
            <h3>Time Series — Selected Countries</h3>
            <span className="vf-sub">{loadingSeries ? "Loading…" : ""}</span>
          </div>
          <div className="vf-chart">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={lineData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(0,255,179,0.08)" />
                <XAxis dataKey="date" stroke="var(--accent)" />
                <YAxis stroke="var(--accent)" tickFormatter={money} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="vf-tip">
                      <div className="vf-tip-label">{label}</div>
                      {payload.map((p, i) => (
                        <div className="vf-tip-row" key={i}>
                          <span className="dot" style={{ background: p.color }} />
                          <span>{p.name}</span>
                          <span className="val">{money(p.value)}</span>
                        </div>
                      ))}
                    </div>
                  );
                }} />
                <Legend />
                {selectedCountries.map((c, i) => (
                  <Line
                    key={c}
                    type="monotone"
                    dataKey={c}
                    name={c}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
