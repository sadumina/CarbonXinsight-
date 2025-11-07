// ✅ src/components/UploadPDF.jsx
import { useState } from "react";
import axios from "axios";
import "./UploadPDF.css";

const API = "http://localhost:8000";

export default function UploadPDF() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const uploadPDF = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setMsg("");

    const form = new FormData();
    for (const file of files) {
      form.append("pdf", file);
    }

    try {
      const res = await axios.post(`${API}/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMsg(
        `✅ Imported ${res.data.total_rows_imported} rows from ${res.data.files_processed.length} PDFs`
      );
    } catch (err) {
      setMsg("❌ Upload failed. Check console.");
      console.error(err);
    }

    setLoading(false);
  };

  return (
    <div className="upload-panel">
      <h2 className="title">📤 Upload WPU PDF(s)</h2>

      <label className="upload-box">
        <span>
          {loading ? "Uploading…" : "Click or Drop Multiple PDF Files"}
        </span>
        <input type="file" accept=".pdf" multiple onChange={uploadPDF} hidden />
      </label>

      {msg && <p className="result">{msg}</p>}
    </div>
  );
}
