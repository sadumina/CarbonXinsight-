// src/pages/DataUploadPage.jsx
import { useState } from "react";
import axios from "axios";
import UploadPDF from "../components/UploadPDF";
import "../components/UploadAndAnalytics.css";

const API = "http://localhost:8000";

export default function DataUploadPage() {
  const [refreshNote, setRefreshNote] = useState("");

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);

    try {
      await axios.post(`${API}/upload-excel`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRefreshNote("✅ Excel uploaded. Go to Dashboard to see the new data.");
    } catch (err) {
      console.error(err);
      setRefreshNote("❌ Upload failed. Check the console.");
    }
  };

  return (
    <div className="page">
      {/* PDF upload */}
      <section className="panel upload-panel">
        <h2 className="panel-title">📤 Upload Monthly PDFs</h2>
        <p className="panel-sub">Drop or select multiple WPU PDFs (12 months, etc.).</p>
        <UploadPDF onDone={() => setRefreshNote("✅ PDFs uploaded. Visit Dashboard to view.")} />
      </section>

      {/* Excel upload */}
      <section className="panel upload-panel">
        <h2 className="panel-title">📊 Upload Excel Price Data</h2>
        <p className="panel-sub">
          Upload .xlsx/.xls containing prices for Sri Lanka • Indonesia • India • Thailand.
        </p>

        <label className="excel-upload">
          <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} />
          📁 Select Excel File
        </label>

        <a href="http://localhost:8000/download-template" className="download-template-btn">
          ⬇ Download Excel Template
        </a>

        {refreshNote && <p style={{ marginTop: 12 }}>{refreshNote}</p>}
      </section>
    </div>
  );
}
