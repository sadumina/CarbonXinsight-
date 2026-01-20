import { useState } from "react";
import axios from "axios";

const API = "http://localhost:8000";

/* Month constants */
const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export default function ViewDataPage() {
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const monthLabel = MONTHS.find((m) => m.value === month)?.label;

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/data/monthly`, {
        params: { year, month },
      });

      setRows(res.data.records);
      setSummary(res.data.summary);
    } catch (err) {
      console.error("Failed to load data", err);
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

 return (
  <section className="panel view-data">
    {/* Header */}
    <header className="view-header">
      <h1>Monthly Uploaded Data</h1>
      <p>
        {monthLabel} {year} • Uploaded price records
      </p>
    </header>

    {/* Filters */}
    <div className="view-filters">
      <input
        type="number"
        value={year}
        onChange={(e) => setYear(+e.target.value)}
        className="filter-input"
      />

      <select
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
        className="filter-input"
      >
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      <button
        onClick={loadData}
        disabled={loading}
        className="primary-btn"
      >
        {loading ? "Loading..." : "View Data"}
      </button>
    </div>

    {/* Summary */}
    {summary && (
      <div className="summary-grid">
        {[
          ["Records", summary.count],
          ["Average Price", summary.average_price],
          ["Minimum", summary.min_price],
          ["Maximum", summary.max_price],
        ].map(([label, value]) => (
          <div key={label} className="summary-card">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    )}

    {/* Table */}
    <div className="table-card">
      <table>
        <thead>
          <tr>
            {["Date", "Country", "Market", "Price", "Source"].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="empty-cell">
                No data available for selected month
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                <td>{r.date.slice(0, 10)}</td>
                <td>{r.country}</td>
                <td>{r.market || "-"}</td>
                <td>{r.price}</td>
                <td>{r.source}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </section>
);

}
