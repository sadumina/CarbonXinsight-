import { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell
} from "recharts";

function ChartsForPDF() {
  const [pdfs, setPdfs] = useState([]);
  const [selectedPdf, setSelectedPdf] = useState("");
  const [analytics, setAnalytics] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:8000/pdfs")
      .then(res => {
        setPdfs(res.data);
        setSelectedPdf(res.data[0]);
      });
  }, []);

  useEffect(() => {
    if (!selectedPdf) return;

    axios.get("http://localhost:8000/analytics/by-pdf", {
      params: { source_pdf: selectedPdf }
    }).then(res => setAnalytics(res.data));
  }, [selectedPdf]);

  const colors = ["#00FFF2", "#FFB800", "#FC0067", "#2BFF00", "#0095FF"];

  return (
    <div style={{ padding: "20px" }}>

      {/* ✅ PDF dropdown */}
      <select
        value={selectedPdf}
        onChange={(e) => setSelectedPdf(e.target.value)}
        style={{ padding: "8px", borderRadius: "8px", marginBottom: "20px" }}
      >
        {pdfs.map(pdf => (
          <option key={pdf} value={pdf}>{pdf}</option>
        ))}
      </select>


      {/* ✅ Bar Chart */}
      <h2 style={{ color: "#00fff7" }}>📊 Min / Max Price Comparison</h2>
      <BarChart width={900} height={350} data={analytics}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="product" />
        <YAxis />
        <Tooltip />
        <Legend />

        <Bar dataKey="min_price" fill="#00FFF2" name="Min Price" />
        <Bar dataKey="max_price" fill="#FF0080" name="Max Price" />
      </BarChart>


      {/* ✅ Pie Chart for Avg */}
      <h2 style={{ color: "#00fff7" }}>🥧 Average Price Distribution</h2>
      <PieChart width={900} height={350}>
        <Pie
          data={analytics}
          dataKey="avg_price"
          nameKey="product"
          cx="50%"
          cy="50%"
          outerRadius={130}
          fill="#00fff7"
          label
        >
          {analytics.map((_, index) => (
            <Cell key={index} fill={colors[index % colors.length]} />
          ))}
        </Pie>
      </PieChart>

    </div>
  );
}

export default ChartsForPDF;
