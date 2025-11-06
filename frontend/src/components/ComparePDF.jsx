import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./ComparePDF.css";

const API = "http://localhost:8000";

// formatters
const fmtMoney = (n) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n));
const fmtPct = (n) =>
  n == null ? "—" : `${Number(n).toFixed(2)}%`;
const sign = (n) => (n == null ? 0 : n > 0 ? 1 : n < 0 ? -1 : 0);

// simple CSV exporter
function exportCSV(rows, filename = "comparison.csv") {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => `"${(r[h] ?? "").toString().replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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

  // load PDFs once
  useEffect(() => {
    axios.get(`${API}/pdfs`).then(r => setPdfs(r.data || [])).catch(() => setPdfs([]));
  }, []);

  const label = useMemo(() => {
    if (!result) return "";
    return `${result.label_a}  →  ${result.label_b}`;
  }, [result]);

  const tableCSV = useMemo(() => {
    if (!result?.countries?.length) return [];
    return result.countries.map(r => ({
      Country: r.country,
      "Min A": r.a?.min ?? "",
      "Min B": r.b?.min ?? "",
      "Δ Min": r.delta?.min ?? "",
      "Δ Min %": r.delta?.min_pct ?? "",
      "Avg A": r.a?.avg ?? "",
      "Avg B": r.b?.avg ?? "",
      "Δ Avg": r.delta?.avg ?? "",
      "Δ Avg %": r.delta?.avg_pct ?? "",
      "Max A": r.a?.max ?? "",
      "Max B": r.b?.max ?? "",
      "Δ Max": r.delta?.max ?? "",
      "Δ Max %": r.delta?.max_pct ?? "",
    }));
  }, [result]);

  // submit
  const handleCompare = async (e) => {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const params = {};
      if (mode === "pdf") {
        if (!pdf1 || !pdf2) throw new Error("Pick both PDFs.");
        params.pdf1 = pdf1;
        params.pdf2 = pdf2;
      } else {
        if (!month1 || !year1 || !month2 || !year2) throw new Error("Fill both month/year pairs.");
        params.month1 = Number(month1);
        params.year1 = Number(year1);
        params.month2 = Number(month2);
        params.year2 = Number(year2);
      }
      const { data } = await axios.get(`${API}/analytics/compare`, { params });
      setResult(data);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Compare failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPdf1(""); setPdf2("");
    setMonth1(""); setYear1(""); setMonth2(""); setYear2("");
    setResult(null); setError(null);
  };

  return (
    <section className="cmp-wrap">
      {/* Toolbar */}
      <div className="cmp-toolbar">
        <div className="cmp-tabs">
          <button
            type="button"
            className={`cmp-tab ${mode === "pdf" ? "is-active" : ""}`}
            onClick={() => setMode("pdf")}
          >
            PDF vs PDF
          </button>
          <button
            type="button"
            className={`cmp-tab ${mode === "month" ? "is-active" : ""}`}
            onClick={() => setMode("month")}
          >
            Month vs Month
          </button>
        </div>

        <form className="cmp-controls" onSubmit={handleCompare}>
          {mode === "pdf" ? (
            <>
              <select className="cmp-input" value={pdf1} onChange={(e) => setPdf1(e.target.value)}>
                <option value="">Select PDF A</option>
                {pdfs.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select className="cmp-input" value={pdf2} onChange={(e) => setPdf2(e.target.value)}>
                <option value="">Select PDF B</option>
                {pdfs.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </>
          ) : (
            <>
              <input className="cmp-input" type="number" placeholder="Month A" min="1" max="12"
                     value={month1} onChange={(e) => setMonth1(e.target.value)} />
              <input className="cmp-input" type="number" placeholder="Year A"
                     value={year1} onChange={(e) => setYear1(e.target.value)} />
              <input className="cmp-input" type="number" placeholder="Month B" min="1" max="12"
                     value={month2} onChange={(e) => setMonth2(e.target.value)} />
              <input className="cmp-input" type="number" placeholder="Year B"
                     value={year2} onChange={(e) => setYear2(e.target.value)} />
            </>
          )}

          <button className="cmp-btn" type="submit" disabled={loading}>
            {loading ? "Comparing…" : "Compare"}
          </button>
          <button className="cmp-btn ghost" type="button" onClick={handleReset}>
            Reset
          </button>

          <button
            className="cmp-btn ghost"
            type="button"
            disabled={!tableCSV.length}
            onClick={() => exportCSV(tableCSV, "comparison.csv")}
          >
            Export CSV
          </button>
        </form>
      </div>

      {/* Title / status */}
      <div className="cmp-heading">
        <h2>🆚 Comparison</h2>
        <div className="cmp-sub">{label || "Choose two periods and compare."}</div>
      </div>

      {error && <div className="cmp-error">{error}</div>}

      {/* Table */}
      <div className="cmp-table-wrap">
        <table className="cmp-table">
          <thead>
            <tr>
              <th rowSpan={2} className="sticky-left">Country</th>
              <th colSpan={4}>Min</th>
              <th colSpan={4}>Average</th>
              <th colSpan={4}>Max</th>
            </tr>
            <tr>
              <th>A</th><th>B</th><th>Δ</th><th>Δ%</th>
              <th>A</th><th>B</th><th>Δ</th><th>Δ%</th>
              <th>A</th><th>B</th><th>Δ</th><th>Δ%</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              [...Array(5)].map((_, i) => (
                <tr key={`sk-${i}`} className="skeleton">
                  <td className="sticky-left">Loading…</td>
                  {Array.from({ length: 12 }).map((__, j) => <td key={j}>—</td>)}
                </tr>
              ))
            )}

            {!loading && result?.countries?.length === 0 && (
              <tr><td className="sticky-left" colSpan={13} style={{ textAlign: "center" }}>No data.</td></tr>
            )}

            {!loading && result?.countries?.map((r) => (
              <tr key={r.country}>
                <td className="sticky-left">{r.country}</td>

                {/* Min */}
                <td>{fmtMoney(r.a?.min)}</td>
                <td>{fmtMoney(r.b?.min)}</td>
                <td className={`delta ${sign(r.delta?.min) > 0 ? "up" : sign(r.delta?.min) < 0 ? "down" : ""}`}>
                  {fmtMoney(r.delta?.min)}
                </td>
                <td className={`delta ${sign(r.delta?.min_pct) > 0 ? "up" : sign(r.delta?.min_pct) < 0 ? "down" : ""}`}>
                  {fmtPct(r.delta?.min_pct)}
                </td>

                {/* Avg */}
                <td>{fmtMoney(r.a?.avg)}</td>
                <td>{fmtMoney(r.b?.avg)}</td>
                <td className={`delta ${sign(r.delta?.avg) > 0 ? "up" : sign(r.delta?.avg) < 0 ? "down" : ""}`}>
                  {fmtMoney(r.delta?.avg)}
                </td>
                <td className={`delta ${sign(r.delta?.avg_pct) > 0 ? "up" : sign(r.delta?.avg_pct) < 0 ? "down" : ""}`}>
                  {fmtPct(r.delta?.avg_pct)}
                </td>

                {/* Max */}
                <td>{fmtMoney(r.a?.max)}</td>
                <td>{fmtMoney(r.b?.max)}</td>
                <td className={`delta ${sign(r.delta?.max) > 0 ? "up" : sign(r.delta?.max) < 0 ? "down" : ""}`}>
                  {fmtMoney(r.delta?.max)}
                </td>
                <td className={`delta ${sign(r.delta?.max_pct) > 0 ? "up" : sign(r.delta?.max_pct) < 0 ? "down" : ""}`}>
                  {fmtPct(r.delta?.max_pct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
