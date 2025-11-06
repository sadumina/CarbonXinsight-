// src/components/AnalyticsChart.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import KpiCards from "./KpiCards";
import "./AnalyticsChart.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";

const API = "http://localhost:8000";
const fmt = (n) => (n == null ? "—" : `$${Number(n).toFixed(2)}`);

export default function AnalyticsChart() {
  const [pdfs, setPdfs] = useState([]);
  const [selectedPdf, setSelectedPdf] = useState(""); // "" => all PDFs

  const [chartData, setChartData] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [countryCards, setCountryCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // load PDFs once
  useEffect(() => {
    axios
      .get(`${API}/pdfs`)
      .then((res) => setPdfs(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPdfs([]));
  }, []);

  // (re)load analytics whenever selectedPdf changes
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const params = {};
        if (selectedPdf) params.pdf = selectedPdf;

        // parallel calls
        const [chartRes, kpiRes, cardsRes] = await Promise.all([
          axios.get(`${API}/analytics`, { params }),           // country avg/min/max
          axios.get(`${API}/analytics/global`, { params }),    // global KPI (scoped to pdf)
          axios.get(`${API}/analytics/country-kpis`, { params }) // per-country KPI cards
        ]);

        setChartData(chartRes.data || []);
        setKpis(kpiRes.data || null);
        setCountryCards(cardsRes.data || []);
      } catch (e) {
        const msg =
          (e && e.response && e.response.data && e.response.data.detail) ||
          e.message ||
          "Failed to load analytics";
        setErr(msg);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [selectedPdf]);

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    return [
      { title: "Average Price", value: fmt(kpis.avg_price) },
      { title: "Min Price", value: fmt(kpis.min_price) },
      { title: "Max Price", value: fmt(kpis.max_price) },
      {
        title: "MoM Change",
        value:
          kpis.mom_change_percent == null
            ? "—"
            : `${Number(kpis.mom_change_percent).toFixed(2)}%`,
        sub:
          kpis.mom_change_percent == null
            ? undefined
            : Number(kpis.mom_change_percent).toFixed(2),
      },
    ];
  }, [kpis]);

  return (
    <>
      {/* PDF Filter */}
      <div style={filterBar}>
        <label style={labelStyle}>Filter by PDF:</label>
        <select
          style={selectStyle}
          value={selectedPdf}
          onChange={(e) => setSelectedPdf(e.target.value)}
        >
          <option value="">All PDFs</option>
          {pdfs.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      {kpis && <KpiCards cards={kpiCards} />}

      {err && (
        <p style={{ color: "#ff6b6b", marginTop: 10, marginBottom: 0 }}>{err}</p>
      )}

      {/* Line Chart */}
      <div className="chart-container">
        <h2 className="chart-title">
          📊 Country Comparison (Avg / Min / Max)
          {selectedPdf ? ` — ${selectedPdf}` : ""}
        </h2>

        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="rgba(0, 255, 179, 0.08)" />
            <XAxis dataKey="_id" stroke="var(--accent)" />
            <YAxis stroke="var(--accent)" />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="avg_price"
              stroke="var(--primary)"
              name="Average"
              dot
            />
            <Line
              type="monotone"
              dataKey="max_price"
              stroke="#ffaa00"
              name="Max"
              dot
            />
            <Line
              type="monotone"
              dataKey="min_price"
              stroke="#ff006a"
              name="Min"
              dot
            />
          </LineChart>
        </ResponsiveContainer>

        {loading && (
          <p style={{ color: "var(--accent)", marginTop: 10 }}>Loading…</p>
        )}
      </div>

      {/* Country KPI Cards Grid */}
      {countryCards?.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 className="chart-title">
            🌍 Country KPIs — Coconut Shell Charcoal
            {selectedPdf ? ` — ${selectedPdf}` : ""}
          </h2>

          <div style={grid}>
            {countryCards.map((c) => (
              <div key={c.country} style={card}>
                <h3 style={cardTitle}>{c.country}</h3>

                <div style={row}>
                  <div style={tile}>
                    <div style={tileLabel}>Average</div>
                    <div style={tileValue}>{fmt(c.avg_price)}</div>
                  </div>
                  <div style={tile}>
                    <div style={tileLabel}>Min</div>
                    <div style={tileValue}>{fmt(c.min_price)}</div>
                  </div>
                </div>

                <div style={row}>
                  <div style={tile}>
                    <div style={tileLabel}>Max</div>
                    <div style={tileValue}>{fmt(c.max_price)}</div>
                  </div>
                  {/* MoM may be null if only one week in pdf */}
                  <div style={tile}>
                    <div style={tileLabel}>MoM</div>
                    <div style={badge(c.mom_change_percent)}>
                      {c.mom_change_percent == null
                        ? "—"
                        : `${Number(c.mom_change_percent).toFixed(2)}%`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* tiny styles */
const filterBar = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  margin: "10px 0 20px",
};
const labelStyle = { color: "var(--accent)", fontWeight: 600 };
const selectStyle = {
  padding: "8px 12px",
  borderRadius: 10,
  background: "#0d1117",
  color: "#aef9e5",
  border: "1px solid rgba(0,255,179,0.2)",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 16,
};
const card = {
  border: "1px solid rgba(0,255,179,0.18)",
  borderRadius: 16,
  padding: 14,
  background: "rgba(0, 255, 179, 0.03)",
};
const cardTitle = { color: "var(--primary)", margin: 0, marginBottom: 10 };
const row = { display: "flex", gap: 12, marginBottom: 8 };
const tile = {
  flex: 1,
  border: "1px solid rgba(0,255,179,0.15)",
  borderRadius: 12,
  padding: "10px 12px",
};
const tileLabel = { fontSize: 12, color: "#9be6d3", marginBottom: 4 };
const tileValue = { fontSize: 20, fontWeight: 700, color: "#c8fff0" };
const badge = (val) => ({
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 700,
  color: val == null ? "#c8fff0" : val >= 0 ? "#19f79f" : "#ff7b7b",
  background:
    val == null
      ? "rgba(255,255,255,0.06)"
      : val >= 0
      ? "rgba(25, 247, 159, 0.12)"
      : "rgba(255, 123, 123, 0.12)",
});
