// src/components/UploadPDF.jsx
import { useRef, useState } from "react";
import axios from "axios";
import "./UploadPDF.css";

const API = "http://localhost:8000";

export default function UploadPDF({ onDone }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState([]); // {name, status: 'ready'|'ok'|'err', msg?}
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const addFiles = (files) => {
    const pdfs = [...files].filter((f) => /\.pdf$/i.test(f.name));
    if (!pdfs.length) return;
    setQueue((q) => [
      ...q,
      ...pdfs.map((f) => ({ file: f, name: f.name, status: "ready" })),
    ]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const onChange = (e) => addFiles(e.target.files);

  const uploadAll = async () => {
    if (!queue.length || busy) return;
    setBusy(true);
    try {
      const form = new FormData();
      queue.forEach((item) => form.append("pdf", item.file)); // backend expects List[UploadFile] name=pdf
      const { data } = await axios.post(`${API}/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Mark all as ok
      setQueue((q) => q.map((it) => ({ ...it, status: "ok" })));
      onDone && onDone();
    } catch (err) {
      setQueue((q) => q.map((it) => ({ ...it, status: "err", msg: "Failed" })));
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className={`drop ${dragOver ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={pick}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={onChange}
        />
        <div className="drop-inner">
          <div className="drop-icon">⬆</div>
          <div className="drop-title">
            Click or Drop <b>Multiple PDF Files</b>
          </div>
          <div className="drop-hint">We’ll parse only Coconut Shell Charcoal</div>
        </div>
      </div>

      {queue.length > 0 && (
        <>
          <div className="queue">
            {queue.map((it, i) => (
              <div className="queue-item" key={i}>
                <span className="q-name">{it.name}</span>
                <span
                  className={`q-badge ${
                    it.status === "ok" ? "ok" : it.status === "err" ? "err" : ""
                  }`}
                >
                  {it.status === "ready" ? "READY" : it.status === "ok" ? "DONE" : "ERROR"}
                </span>
              </div>
            ))}
          </div>

          <div className="actions">
            <button className="btn ghost" onClick={() => setQueue([])} disabled={busy}>
              Clear
            </button>
            <button className="btn primary" onClick={uploadAll} disabled={busy}>
              {busy ? "Uploading…" : `Upload ${queue.length} PDF(s)`}
            </button>
          </div>
        </>
      )}
    </>
  );
}
