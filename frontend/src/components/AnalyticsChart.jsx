import { useEffect, useState } from "react";
import axios from "axios";
import KpiCards from "./KpiCards";
import "./AnalyticsChart.css";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

function AnalyticsChart() {
  const [products, setProducts] = useState([]);
  const [product, setProduct] = useState("");
  const [data, setData] = useState([]);
  const [global, setGlobal] = useState(null);
  const [error, setError] = useState("");

  // Load product list once
  useEffect(() => {
    axios.get("http://localhost:8000/products")
      .then(res => {
        const list = res.data || [];
        setProducts(list);

        // Prefer "Coconut Shell Charcoal" if available, else first
        const preferred = list.find(p => p.toLowerCase().includes("charcoal")) || list[0];
        setProduct(preferred || "");
      })
      .catch(err => setError("Failed to load product list: " + err));
  }, []);

  // Load analytics when product changes
  useEffect(() => {
    if (!product) return;

    // Reset UI state for a clean refresh
    setGlobal(null);
    setData([]);
    setError("");

    // Country comparison (avg/min/max)
    axios.get("http://localhost:8000/analytics", { params: { product } })
      .then(res => {
        // Expecting flat shape: [{ country, avg_price, min_price, max_price }]
        const payload = Array.isArray(res.data) ? res.data : [];
        console.log("✅ /analytics payload:", payload);
        setData(payload);
      })
      .catch(err => {
        console.error("❌ /analytics error:", err);
        setError("Analytics fetch failed");
      });

    // Global KPI
    axios.get("http://localhost:8000/analytics/global", { params: { product } })
      .then(res => {
        console.log("✅ /analytics/global payload:", res.data);
        setGlobal(res.data);
      })
      .catch(err => {
        console.error("❌ /analytics/global error:", err);
        setError("Global KPI fetch failed");
      });

  }, [product]);

  if (!product || !products.length) {
    return <p style={{ textAlign: "center", marginTop: "2rem", color: "#0ff" }}>Loading products…</p>;
  }

  if (!global) {
    return <p style={{ textAlign: "center", marginTop: "2rem", color: "#0ff" }}>Loading analytics…</p>;
  }

  const kpiCards = [
    { title: "Average Price", value: `$${Number(global.avg_price).toFixed(2)}` },
    { title: "Min Price", value: `$${Number(global.min_price)}` },
    { title: "Max Price", value: `$${Number(global.max_price)}` },
    {
      title: "MoM Change",
      value: `${Number(global.mom_change_percent || 0).toFixed(2)}%`,
      sub: Number(global.mom_change_percent || 0).toFixed(2),
    },
  ];

  return (
    <>
      {/* Product selector */}
      <div style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}>
        <select
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          style={{
            background: "#0b1b1b",
            color: "#0ff",
            border: "1px solid #05f2b2",
            padding: "8px 12px",
            borderRadius: 8,
            outline: "none",
            fontSize: 14
          }}
        >
          {products.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <KpiCards cards={kpiCards} />

      {error && (
        <p style={{ textAlign: "center", color: "#f55", marginTop: 8 }}>{error}</p>
      )}

      {/* Country comparison line chart */}
      <div className="chart-container">
        <h2 className="chart-title">📊 {product} — Country Comparison (Avg / Min / Max)</h2>

        <LineChart width={850} height={400} data={data}>
          <CartesianGrid stroke="rgba(0, 255, 179, 0.1)" />
          <XAxis dataKey="country" stroke="var(--accent)" />
          <YAxis stroke="var(--accent)" />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="avg_price" stroke="var(--primary)" name="Average" />
          <Line type="monotone" dataKey="min_price" stroke="#ff006a" name="Min" />
          <Line type="monotone" dataKey="max_price" stroke="#ffaa00" name="Max" />
        </LineChart>
      </div>
    </>
  );
}

export default AnalyticsChart;
