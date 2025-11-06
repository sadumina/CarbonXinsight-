import { useEffect, useState } from "react";
import axios from "axios";

const MARKETS = ["Sri Lanka", "India (FOB)", "Indonesia (FOB)", "Thailand"]; // pick your set

const fmtMoney = (v) =>
  (Number.isFinite(Number(v)) ? `$${Number(v).toFixed(2)}` : "—");

const MoMPill = ({ value }) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return <span style={pill("neutral")}>—</span>;
  const tone = n > 0 ? "up" : n < 0 ? "down" : "neutral";
  const sign = n > 0 ? "+" : "";
  return <span style={pill(tone)}>{sign}{n.toFixed(2)}%</span>;
};

const pill = (tone) => ({
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 13,
  background:
    tone === "up" ? "rgba(0,255,179,.12)" :
    tone === "down" ? "rgba(255,0,106,.12)" :
    "rgba(255,255,255,.08)",
  color:
    tone === "up" ? "#10f2b3" :
    tone === "down" ? "#ff4d7a" :
    "#b8c1c6",
  border:
    tone === "up" ? "1px solid rgba(0,255,179,.4)" :
    tone === "down" ? "1px solid rgba(255,0,106,.35)" :
    "1px solid rgba(255,255,255,.12)",
});

const box = {
  background: "rgba(255,255,255,.03)",
  border: "1px solid rgba(255,255,255,.07)",
  borderRadius: 12,
  padding: "12px",
};

const label = { color: "#9aa0a6", fontSize: 12, marginBottom: 6, letterSpacing: .2 };
const val = { color: "#eafffb", fontSize: 20, fontWeight: 800, lineHeight: 1 };

export default function CountryKpiWall() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qs = MARKETS.map(c => `countries=${encodeURIComponent(c)}`).join("&");
    axios.get(`http://localhost:8000/analytics/country-kpis?${qs}`)
      .then(res => setRows(res.data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p style={{ color: "#0ff", textAlign: "center", marginTop: 16 }}>Loading country KPIs…</p>;
  }
  if (!rows.length) {
    return <p style={{ color: "#0ff", textAlign: "center", marginTop: 16 }}>No data for selected countries.</p>;
  }

  return (
    <div style={{ marginTop: 20 }}>
      <h2 style={{ color: "var(--primary)", marginBottom: 12 }}>
        🌍 Country KPIs — Coconut Shell Charcoal
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {rows.map((r) => (
          <div
            key={r.country}
            style={{
              background: "rgba(0,255,179,.05)",
              border: "1px solid rgba(0,255,179,.2)",
              borderRadius: 16,
              padding: 16,
            }}
          >
            <div style={{ color: "#00f7d2", fontWeight: 800, fontSize: 16, marginBottom: 10 }}>
              {r.country}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={box}>
                <div style={label}>Average</div>
                <div style={val}>{fmtMoney(r.avg_price)}</div>
              </div>
              <div style={box}>
                <div style={label}>Min</div>
                <div style={val}>{fmtMoney(r.min_price)}</div>
              </div>
              <div style={box}>
                <div style={label}>Max</div>
                <div style={val}>{fmtMoney(r.max_price)}</div>
              </div>
              <div style={box}>
                <div style={label}>MoM</div>
                <div><MoMPill value={r.mom_change_percent} /></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
