// src/pages/AnalyticsPage.jsx
import AnalyticsChart from "../components/AnalyticsChart";
import "./AnalyticsPage.css";

export default function AnalyticsPage() {
  return (
    <div className="analytics-page">
      <section className="panel">
        <h2 className="panel-title">📈 Market Analytics</h2>
        <p className="panel-sub">Coconut Shell Charcoal — compare markets, filter dates, export.</p>

        {/* Highcharts (historical + optional forecast in a second chart) */}
        <AnalyticsChart />
      </section>
    </div>
  );
}
