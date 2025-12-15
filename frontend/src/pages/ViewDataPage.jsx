import { useState } from "react";
import axios from "axios";

const API = "http://localhost:8000";

export default function ViewDataPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);

  const loadData = async () => {
    const res = await axios.get(`${API}/data/monthly`, {
      params: { year, month },
    });
    setRows(res.data.records);
    setSummary(res.data.summary);
  };

  return (
    <div className="page">
      <h2>📅 Monthly Uploaded Data</h2>

      <div style={{ display: "flex", gap: 12, margin: "16px 0" }}>
        <input type="number" value={year} onChange={(e) => setYear(+e.target.value)} />
        <input type="number" min="1" max="12" value={month} onChange={(e) => setMonth(+e.target.value)} />
        <button onClick={loadData}>View</button>
      </div>

      {summary && (
        <div style={{ marginBottom: 16 }}>
          <b>Summary</b>
          <div>Records: {summary.count}</div>
          <div>Avg: {summary.average_price}</div>
          <div>Min: {summary.min_price}</div>
          <div>Max: {summary.max_price}</div>
        </div>
      )}

      <table width="100%" cellPadding="8">
        <thead>
          <tr>
            <th>Date</th>
            <th>Country</th>
            <th>Market</th>
            <th>Price</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.date.slice(0, 10)}</td>
              <td>{r.country}</td>
              <td>{r.market || "-"}</td>
              <td>{r.price}</td>
              <td>{r.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
