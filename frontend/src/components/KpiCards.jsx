import "./KpiCards.css";

export default function KpiCards({ summary }) {
  if (!summary) return null;

  const { highest, topGainer, topLoser, selectedCount } = summary;

  const Card = ({ title, value, sub, tone = "neutral" }) => (
    <div className={`kpi-card ${tone}`}>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );

  return (
    <div className="kpi-row">
      <Card
        title="Highest Price"
        value={highest ? `$${highest.price.toFixed(2)}` : "—"}
        sub={highest ? `${highest.country}` : ""}
        tone="highlight"
      />
      <Card
        title="Top Gainer"
        value={topGainer ? `${topGainer.pct.toFixed(2)}%` : "—"}
        sub={topGainer ? `${topGainer.country}` : ""}
        tone="positive"
      />
      <Card
        title="Top Loser"
        value={topLoser ? `${topLoser.pct.toFixed(2)}%` : "—"}
        sub={topLoser ? `${topLoser.country}` : ""}
        tone="negative"
      />
      <Card
        title="Markets Selected"
        value={selectedCount ?? 0}
        sub="Visible on chart"
      />
    </div>
  );
}
