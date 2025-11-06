import "./KpiCards.css";

function KpiCards({ cards }) {
  return (
    <div className="kpi-container">
      {cards.map((card, index) => (
        <div key={index} className="kpi-card">
          <h3>{card.title}</h3>
          <p className="kpi-value">{card.value}</p>
          {card.sub && <span className={`kpi-sub ${card.sub > 0 ? "up" : "down"}`}>
            {card.sub > 0 ? `▲ +${card.sub}%` : `▼ ${card.sub}%`}
          </span>}
        </div>
      ))}
    </div>
  );
}

export default KpiCards;
