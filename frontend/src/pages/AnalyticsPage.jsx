// src/pages/AnalyticsPage.jsx

import AnalyticsChart from "../components/AnalyticsChart";
import "./AnalyticsPage.css"; // ✅ correct path

export default function AnalyticsPage() {
  return (
    <div className="analytics-page">
      <AnalyticsChart />
    </div>
  );
}
