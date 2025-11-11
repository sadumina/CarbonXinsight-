import "./InsightsPanel.css";

export default function InsightsPanel({ periodLabel, insights = [] }) {
  if (!insights.length) return null;

  return (
    <div className="insights">
      <div className="insights-head">
        <span className="dot" /> Market Insights
        {periodLabel && <span className="period">({periodLabel})</span>}
      </div>
      <ul className="insights-list">
        {insights.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
