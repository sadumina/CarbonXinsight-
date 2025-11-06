import { useState } from "react";
import axios from "axios";
import "./UploadPDF.css"; // ✅ import styling

function UploadPDF() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return alert("⚠️ Please select a PDF file");

    setLoading(true);
    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const response = await axios.post("http://localhost:8000/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMessage(response.data.message);
     } catch (error) {
    console.error(error);   // ✅ now error is used
    setMessage("❌ Upload failed. Check backend.");
}
finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container">
      <h2 className="section-title">📄 Upload PDF</h2>

      <div className="upload-box">
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0])}
        />

        <button onClick={handleUpload} className="neon-button">
          {loading ? "Uploading..." : "Upload PDF"}
        </button>
      </div>

      {message && <p className="upload-msg">{message}</p>}
    </div>
  );
}

export default UploadPDF;
