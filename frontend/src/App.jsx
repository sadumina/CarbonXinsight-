import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import UploadPDF from "./components/UploadPDF";
import AnalyticsChart from "./components/AnalyticsChart";
import MonthlyAnalytics from "./components/MonthlyAnalytics";
import ChartsForPDF from "./components/ChartsForPDF";
import ComparePDF from "./components/ComparePDF";
import AverageMarkets from "./components/AverageMarkets"; // ✅ NEW
import "./App.css";

function App() {
  return (
    <Router>
      <div style={{ padding: "40px" }}>
        <h1 style={{ color: "var(--primary)", marginBottom: "20px" }}>
          CarbonXInsight Dashboard
        </h1>

        {/* Navigation */}
        <nav style={{ marginBottom: "28px", display: "flex", gap: 12, flexWrap: "wrap" }}>
          <NavLink to="/" end style={linkStyle}>Upload</NavLink>
          <NavLink to="/analytics" style={linkStyle}>Analytics</NavLink>
          <NavLink to="/averages" style={linkStyle}>Market Averages</NavLink> {/* ✅ NEW */}
          <NavLink to="/monthly" style={linkStyle}>Monthly View</NavLink>
          <NavLink to="/charts" style={linkStyle}>Visual Charts</NavLink>
          <NavLink to="/compare" style={linkStyle}>Compare PDFs</NavLink>
        </nav>

        {/* Routes */}
        <Routes>
          {/* index = "/" */}
          <Route index element={<UploadPDF />} />
          <Route path="/analytics" element={<AnalyticsChart />} />
          <Route path="/averages" element={<AverageMarkets />} /> {/* ✅ NEW */}
          <Route path="/monthly" element={<MonthlyAnalytics />} />
          <Route path="/charts" element={<ChartsForPDF />} />
          <Route path="/compare" element={<ComparePDF />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
}

/* Active-tab styling via NavLink's style function */
const linkStyle = ({ isActive }) => ({
  padding: "10px 14px",
  border: "1px solid rgba(0,255,179,0.25)",
  borderRadius: 8,
  textDecoration: "none",
  color: isActive ? "var(--bg)" : "var(--accent)",
  background: isActive ? "rgba(0,255,179,0.2)" : "transparent",
  transition: "background 160ms ease, color 160ms ease",
});

function NotFound() {
  return (
    <div style={{ color: "var(--accent)" }}>
      <h2>404 — Page not found</h2>
      <p>Use the navigation above to continue.</p>
    </div>
  );
}

export default App;
