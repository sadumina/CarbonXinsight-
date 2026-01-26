// ✅ src/components/UploadAndAnalytics.jsx
import { useState } from "react";
import axios from "axios";
import UploadPDF from "./UploadPDF";              // keep your existing file
import AnalyticsChart from "./AnalyticsChart";    // TradingView/Highcharts chart
import "./UploadAndAnalytics.css";

         // backend FastAPI

export default function UploadAndAnalytics() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await axios.post(`${API}/upload-excel`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("✅ Excel uploaded successfully!");
      console.log(res.data);

      // Refresh graph without reloading page
      setRefreshKey((k) => k + 1);

    } catch (err) {
      console.error(err);
      alert("❌ Excel upload failed. Check console.");
    }
  };

  return (
    <section className="page">

      {/* --------------- PDF UPLOAD --------------- */}
      <section className="panel upload-panel">
        <h2 className="panel-title">📤 Upload Monthly PDFs</h2>
        <p className="panel-sub">Drop or select multiple WPU PDFs (e.g., 12 months)</p>

        <UploadPDF onDone={() => setRefreshKey((k) => k + 1)} />
      </section>

      {/* --------------- EXCEL UPLOAD --------------- */}
      <section className="panel upload-panel">
        <h2 className="panel-title">📊 Upload Excel Price Data</h2>
        <p className="panel-sub">
          Upload Excel file (.xlsx / .xls) containing market prices for:
          <b> Sri Lanka • Indonesia • India • Thailand </b>
        </p>

        <label className="excel-upload">
          <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} />
          📁 Select Excel File
        </label>

        <a
          href="http://localhost:8000/download-template"
          className="download-template-btn"
        >
          ⬇ Download Excel Template
        </a>
      </section>

      {/* --------------- ANALYTICS + CHART --------------- */}
      <section className="panel chart-panel">
        <AnalyticsChart key={refreshKey} />
      </section>
    </section>
  );
}
