// src/pages/DataUploadPage.jsx
import { useState } from "react";
import axios from "axios";
import UploadPDF from "../components/UploadPDF";
import "../components/UploadAndAnalytics.css";

const API = "http://localhost:8000";

export default function DataUploadPage() {
  const [refreshNote, setRefreshNote] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);

    setUploading(true);
    setRefreshNote("");

    try {
      const res = await axios.post(`${API}/upload-excel`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setRefreshNote(`✅ ${res.data.message}`);
    } catch (err) {
      console.error(err.response?.data || err);
      setRefreshNote(
        err.response?.data?.detail || "❌ Excel upload failed"
      );
    } finally {
      setUploading(false);
      e.target.value = ""; // reset input
    }
  };

  return (
    <div className="page">
      {/* PDF upload */}
      <section className="panel upload-panel">
        <h2 className="panel-title">📤 Upload Monthly PDFs</h2>
        <p className="panel-sub">
          Drop or select multiple WPU PDFs (12 months, etc.).
        </p>

        <UploadPDF
          onDone={() =>
            setRefreshNote("✅ PDFs uploaded. Visit Dashboard to view.")
          }
        />
      </section>

      {/* Excel upload */}
      <section className="panel upload-panel">
        <h2 className="panel-title">📊 Upload Excel Price Data</h2>
        <p className="panel-sub">
          Upload .xlsx / .xls with Country, Product, Date, Price columns.
        </p>

        <label className="excel-upload">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelUpload}
            disabled={uploading}
          />
          📁 {uploading ? "Uploading..." : "Select Excel File"}
        </label>

        <a
          href={`${API}/download-template`}
          className="download-template-btn"
          target="_blank"
          rel="noreferrer"
        >
          ⬇ Download Excel Template
        </a>

        {refreshNote && <p style={{ marginTop: 12 }}>{refreshNote}</p>}
      </section>
    </div>
  );
}
