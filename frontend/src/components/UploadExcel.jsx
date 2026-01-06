import { useRef, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000";

export default function UploadExcel({ onDone }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const upload = async () => {
    if (!file || busy) return;

    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file); // backend expects name="file"

      await axios.post(`${API}/upload-excel`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Excel uploaded successfully (old data replaced)");
      onDone && onDone();
      setFile(null);
    } catch (err) {
      console.error(err.response?.data || err);
      alert(err.response?.data?.detail || "Excel upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="excel-upload">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        hidden
        onChange={(e) => setFile(e.target.files[0])}
      />

      <button className="btn ghost" onClick={pick}>
        Select Excel File
      </button>

      {file && <span style={{ marginLeft: 10 }}>{file.name}</span>}

      <button
        className="btn primary"
        onClick={upload}
        disabled={!file || busy}
        style={{ marginLeft: 10 }}
      >
        {busy ? "Uploading…" : "Upload Excel"}
      </button>
    </div>
  );
}
