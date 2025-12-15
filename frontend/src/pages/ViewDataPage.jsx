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
    <div
      style={{
        padding: "28px 32px",
        color: "#d5e0e8",
        fontFamily:
          "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      {/* Title */}
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          marginBottom: 18,
          color: "#ffffff",
        }}
      >
        📅 Monthly Uploaded Data
      </h2>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "center",
          marginBottom: 22,
        }}
      >
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(+e.target.value)}
          placeholder="Year"
          style={{
            background: "#0d1117",
            border: "1px solid rgba(0,255,157,0.35)",
            color: "#d5e0e8",
            padding: "8px 10px",
            borderRadius: 8,
            width: 110,
          }}
        />

        <input
          type="number"
          min="1"
          max="12"
          value={month}
          onChange={(e) => setMonth(+e.target.value)}
          placeholder="Month"
          style={{
            background: "#0d1117",
            border: "1px solid rgba(0,255,157,0.35)",
            color: "#d5e0e8",
            padding: "8px 10px",
            borderRadius: 8,
            width: 110,
          }}
        />

        <button
          onClick={loadData}
          style={{
            background: "linear-gradient(135deg, #00ff9d, #00d084)",
            color: "#001a12",
            fontWeight: 600,
            border: "none",
            padding: "9px 18px",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          View Data
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(140px, 1fr))",
            gap: 14,
            marginBottom: 24,
          }}
        >
          {[
            ["Records", summary.count],
            ["Average Price", summary.average_price],
            ["Minimum", summary.min_price],
            ["Maximum", summary.max_price],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                background: "#0b141a",
                border: "1px solid rgba(0,255,157,0.18)",
                borderRadius: 14,
                padding: "14px 16px",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#00ff9d",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div
        style={{
          background: "#0b141a",
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <table
          width="100%"
          cellPadding="8"
          style={{
            borderCollapse: "collapse",
            fontSize: 14,
          }}
        >
          <thead
            style={{
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <tr>
              {["Date", "Country", "Market", "Price", "Source"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "12px 14px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#ffffff",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: 22,
                    textAlign: "center",
                    opacity: 0.7,
                  }}
                >
                  No data available for selected month
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={i}
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <td style={{ padding: "12px 14px" }}>
                    {r.date.slice(0, 10)}
                  </td>
                  <td style={{ padding: "12px 14px" }}>{r.country}</td>
                  <td style={{ padding: "12px 14px" }}>
                    {r.market || "-"}
                  </td>
                  <td style={{ padding: "12px 14px" }}>{r.price}</td>
                  <td style={{ padding: "12px 14px" }}>{r.source}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
