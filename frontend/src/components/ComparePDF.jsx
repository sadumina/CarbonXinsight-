// src/components/ComparePDF.jsx
import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000";

// simple helpers
const fmt = (n) => (n == null ? "—" : `$${Number(n).toFixed(2)}`);
const pct = (n) => (n == null ? "—" : `${Number(n).toFixed(2)}%`);

export default function ComparePDF() {
  const [mode, setMode] = useState("pdf"); // "pdf" | "month"
  const [pdfs, setPdfs] = useState([]);
  const [pdf1, setPdf1] = useState("");
  const [pdf2, setPdf2] = useState("");

  const [month1, setMonth1] = useState("");
  const [year1, setYear1] = useState("");
  const [month2, setMonth2] = useState("");
  const [year2, setYear2] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // load available PDFs once
  useEffect(() => {
    axios
      .get(`${API}/pdfs`)
      .then((res) => setPdfs(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPdfs([]));
  }, []);

  const handleCompare = async (e) => {
    if (e) e.preventDefault(); // prevent page reload
    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const params = {};
      if (mode === "pdf") {
        if (!pdf1 || !pdf2) throw new Error("Pick both PDFs");
        params.pdf1 = pdf1;
        params.pdf2 = pdf2;
      } else {
        if (!month1 || !year1 || !month2 || !year2)
          throw new Error("Fill both month/year pairs");
        params.month1 = Number(month1);
        params.year1 = Number(year1);
        params.month2 = Number(month2);
        params.year2 = Number(year2);
      }

      const { data } = await axios.get(`${API}/analytics/compare`, { params });
      setResult(data);
    } catch (err) {
      const msg =
        (err && err.response && err.response.data && err.response.data.detail) ||
        err.message ||
        "Compare failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={wrap}>
      <h2 style={title}>🆚 Compare PDFs / Months</h2>

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => setMode("pdf")}
          style={{ ...tabBtn, ...(mode === "pdf" ? tabActive : {}) }}
        >
          PDF vs PDF
        </button>
        <button
          type="button"
          onClick={() => setMode("month")}
          style={{ ...tabBtn, ...(mode === "month" ? tabActive : {}) }}
        >
          Month vs Month
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleCompare} style={formRow}>
        {mode === "pdf" ? (
          <>
            <select
              value={pdf1}
              onChange={(e) => setPdf1(e.target.value)}
              style={sel}
            >
              <option value="">Select PDF A</option>
              {pdfs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={pdf2}
              onChange={(e) => setPdf2(e.target.value)}
              style={sel}
            >
              <option value="">Select PDF B</option>
              {pdfs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <input
              style={num}
              type="number"
              placeholder="Month A"
              min="1"
              max="12"
              value={month1}
              onChange={(e) => setMonth1(e.target.value)}
            />
            <input
              style={num}
              type="number"
              placeholder="Year A"
              value={year1}
              onChange={(e) => setYear1(e.target.value)}
            />
            <input
              style={num}
              type="number"
              placeholder="Month B"
              min="1"
              max="12"
              value={month2}
              onChange={(e) => setMonth2(e.target.value)}
            />
            <input
              style={num}
              type="number"
              placeholder="Year B"
              value={year2}
              onChange={(e) => setYear2(e.target.value)}
            />
          </>
        )}

        {/* This will not reload the page because we call preventDefault above */}
        <button type="submit" disabled={loading} style={cta}>
          {loading ? "Comparing…" : "Compare"}
        </button>
      </form>

      {error && <p style={{ color: "#ff6b6b", marginTop: 8 }}>{error}</p>}

      {/* Result */}
      {result && (
        <div style={{ marginTop: 18 }}>
          <h3 style={subtitle}>
            Result: {result.label_a} → {result.label_b}
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Min (A)</th>
                  <th>Min (B)</th>
                  <th>Δ Min</th>
                  <th>Δ Min %</th>
                  <th>Avg (A)</th>
                  <th>Avg (B)</th>
                  <th>Δ Avg</th>
                  <th>Δ Avg %</th>
                  <th>Max (A)</th>
                  <th>Max (B)</th>
                  <th>Δ Max</th>
                  <th>Δ Max %</th>
                </tr>
              </thead>
              <tbody>
                {(result.countries || []).map((r) => (
                  <tr key={r.country}>
                    <td>{r.country}</td>
                    <td>{fmt(r.a && r.a.min)}</td>
                    <td>{fmt(r.b && r.b.min)}</td>
                    <td>{fmt(r.delta && r.delta.min)}</td>
                    <td>{pct(r.delta && r.delta.min_pct)}</td>

                    <td>{fmt(r.a && r.a.avg)}</td>
                    <td>{fmt(r.b && r.b.avg)}</td>
                    <td>{fmt(r.delta && r.delta.avg)}</td>
                    <td>{pct(r.delta && r.delta.avg_pct)}</td>

                    <td>{fmt(r.a && r.a.max)}</td>
                    <td>{fmt(r.b && r.b.max)}</td>
                    <td>{fmt(r.delta && r.delta.max)}</td>
                    <td>{pct(r.delta && r.delta.max_pct)}</td>
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

/* styles (plain JS objects) */
const wrap = {
  border: "1px solid rgba(0,255,179,0.18)",
  borderRadius: 12,
  padding: 16,
  marginBottom: 28,
};
const title = { color: "var(--accent)", margin: 0, marginBottom: 12 };
const subtitle = { color: "var(--accent)", margin: 0, marginBottom: 10 };
const formRow = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};
const sel = {
  padding: "8px 10px",
  borderRadius: 8,
  background: "#0d1117",
  color: "#aef9e5",
  border: "1px solid rgba(0,255,179,0.18)",
};
const num = sel;
const cta = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid rgba(0,255,179,0.35)",
  background: "rgba(0,255,179,0.15)",
  color: "#aef9e5",
  cursor: "pointer",
};
const tabBtn = { ...cta, background: "transparent" };
const tabActive = { background: "rgba(0,255,179,0.2)" };
const tbl = {
  width: "100%",
  borderCollapse: "collapse",
  color: "#c8fff0",
  border: "1px solid rgba(0,255,179,0.15)",
};
