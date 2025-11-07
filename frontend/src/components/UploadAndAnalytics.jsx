// src/components/UploadAndAnalytics.jsx
import { useState } from "react";
import UploadPDF from "./UploadPDF";           // (updated below)
import AnalyticsChart from "./AnalyticsChart"; // your TradingView version
import "./UploadAndAnalytics.css";

export default function UploadAndAnalytics() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section className="page">
      {/* Upload Panel */}
      <section className="panel upload-panel">
        <h2 className="panel-title">📤 Upload WPU PDF(s)</h2>
        <p className="panel-sub">Drop or select multiple PDFs (e.g., 12 months)</p>
        <UploadPDF onDone={() => setRefreshKey((k) => k + 1)} />
      </section>

      {/* Chart + KPIs Panel */}
      <section className="panel chart-panel">
        <AnalyticsChart key={refreshKey} />
      </section>
    </section>
  );
}
