// ✅ src/components/KPICards.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import "./KPICards.css";

const API = "http://localhost:8000";

export default function KPICards({ selectedCountries = [], dateRange = {} }) {
  const [countryKPIs, setCountryKPIs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedCountries.length === 0) {
      setCountryKPIs([]);
      return;
    }

    setLoading(true);

    // Fetch KPIs for each selected country
    Promise.all(
      selectedCountries.map((country) =>
        axios
          .get(`${API}/analytics/country-kpis`, {
            params: {
              country,
              start_date: dateRange.start,
              end_date: dateRange.end,
            },
          })
          .then((res) => ({
            country,
            ...res.data[0],
          }))
          .catch(() => ({
            country,
            min: null,
            max: null,
            avg: null,
            change_pct: null,
          }))
      )
    )
      .then((results) => {
        setCountryKPIs(results);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [selectedCountries, dateRange]);

  if (selectedCountries.length === 0) {
    return (
      <div className="kpi-cards-wrapper">
        <div className="kpi-empty-state">
          <div className="empty-icon">📊</div>
          <h3>No Markets Selected</h3>
          <p>Select countries from the dropdown to view detailed analytics</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="kpi-cards-wrapper">
        <div className="kpi-loading">
          <div className="spinner"></div>
          <p>Loading market data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kpi-cards-wrapper">
      <div className="kpi-cards-header">
        <h3>
          <span className="icon">📈</span>
          Market Analytics by Country
        </h3>
        <span className="kpi-count">{countryKPIs.length} Markets</span>
      </div>

      <div className="kpi-table-container">
        <table className="kpi-table">
          <thead>
            <tr>
              <th className="col-country">
                <div className="th-content">
                  <span className="th-icon">🌍</span>
                  Country / Market
                </div>
              </th>
              <th className="col-min">
                <div className="th-content">
                  <span className="th-icon">📉</span>
                  Min Price
                </div>
              </th>
              <th className="col-max">
                <div className="th-content">
                  <span className="th-icon">📈</span>
                  Max Price
                </div>
              </th>
              <th className="col-avg">
                <div className="th-content">
                  <span className="th-icon">📊</span>
                  Avg Price
                </div>
              </th>
              <th className="col-change">
                <div className="th-content">
                  <span className="th-icon">🔄</span>
                  Change
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {countryKPIs.map((kpi, index) => (
              <tr key={kpi.country} className="kpi-row">
                <td className="col-country">
                  <div className="country-cell">
                    <span className="country-flag">{getFlagEmoji(kpi.country)}</span>
                    <span className="country-name">{kpi.country}</span>
                  </div>
                </td>
                <td className="col-min">
                  <div className="price-cell min-price">
                    <span className="price-value">
                      ${kpi.min?.toFixed(2) || "—"}
                    </span>
                    <span className="price-label">USD/MT</span>
                  </div>
                </td>
                <td className="col-max">
                  <div className="price-cell max-price">
                    <span className="price-value">
                      ${kpi.max?.toFixed(2) || "—"}
                    </span>
                    <span className="price-label">USD/MT</span>
                  </div>
                </td>
                <td className="col-avg">
                  <div className="price-cell avg-price">
                    <span className="price-value">
                      ${kpi.avg?.toFixed(2) || "—"}
                    </span>
                    <span className="price-label">USD/MT</span>
                  </div>
                </td>
                <td className="col-change">
                  <div
                    className={`change-cell ${
                      kpi.change_pct > 0
                        ? "positive"
                        : kpi.change_pct < 0
                        ? "negative"
                        : "neutral"
                    }`}
                  >
                    <span className="change-icon">
                      {kpi.change_pct > 0 ? "↑" : kpi.change_pct < 0 ? "↓" : "→"}
                    </span>
                    <span className="change-value">
                      {kpi.change_pct !== null && kpi.change_pct !== undefined
                        ? `${kpi.change_pct > 0 ? "+" : ""}${kpi.change_pct.toFixed(2)}%`
                        : "—"}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Stats Footer */}
      <div className="kpi-table-footer">
        <div className="footer-stat">
          <span className="footer-label">Total Markets</span>
          <span className="footer-value">{countryKPIs.length}</span>
        </div>
        <div className="footer-stat">
          <span className="footer-label">Avg Market Range</span>
          <span className="footer-value">
            $
            {countryKPIs.length > 0
              ? (
                  countryKPIs.reduce(
                    (acc, kpi) => acc + (kpi.max - kpi.min || 0),
                    0
                  ) / countryKPIs.length
                ).toFixed(2)
              : "—"}
          </span>
        </div>
        <div className="footer-stat">
          <span className="footer-label">Markets Trending Up</span>
          <span className="footer-value positive">
            {countryKPIs.filter((kpi) => kpi.change_pct > 0).length}
          </span>
        </div>
        <div className="footer-stat">
          <span className="footer-label">Markets Trending Down</span>
          <span className="footer-value negative">
            {countryKPIs.filter((kpi) => kpi.change_pct < 0).length}
          </span>
        </div>
      </div>
    </div>
  );
}

// Helper function to get flag emoji (fallback to globe)
function getFlagEmoji(countryName) {
  const flags = {
    "Sri Lanka": "🇱🇰",
    "India": "🇮🇳",
    "Indonesia": "🇮🇩",
    "Thailand": "🇹🇭",
    "Vietnam": "🇻🇳",
    "Philippines": "🇵🇭",
    "Malaysia": "🇲🇾",
    "China": "🇨🇳",
    "USA": "🇺🇸",
    "UK": "🇬🇧",
  };

  return flags[countryName] || "🌐";
}