// ✅ src/components/UploadPDF.jsx
import { useState } from "react";
import axios from "axios";
import "./UploadPDF.css";

const API = "http://localhost:8000";

export default function UploadPDF() {
  const [excelMsg, setExcelMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const uploadExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      alert("Upload a valid Excel file (.xlsx / .xls)");
      return;
    }

    setLoading(true);
    setExcelMsg("");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await axios.post(`${API}/upload-excel`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setExcelMsg(`✅ Uploaded: ${file.name} (${res.data.rows} rows stored)`);
    } catch (err) {
      console.error(err);
      setExcelMsg("❌ Upload failed — Check console");
    }

    setLoading(false);
  };

  return (
    <div className="upload-panel">
      <h2 className="title">📤 Upload Excel Data</h2>

      <label className="upload-box">
        <span className="upload-text">Click or Drop your Excel file</span>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={uploadExcel}
          hidden
        />
      </label>

      {loading && <p className="loading">Uploading…</p>}
      {excelMsg && <p className="success">{excelMsg}</p>}
    </div>
  );
}
