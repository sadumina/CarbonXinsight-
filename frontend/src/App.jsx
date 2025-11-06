import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import UploadPDF from "./components/UploadPDF";
import AnalyticsChart from "./components/AnalyticsChart";
import MonthlyAnalytics from "./components/MonthlyAnalytics";
import ChartsForPDF from "./components/ChartsForPDF";
import ComparePDF from "./components/ComparePDF";
import "./App.css";

function App() {
  return (
    <Router>
      <div style={{ padding: "40px" }}>
        <h1 style={{ color: "var(--primary)", marginBottom: "20px" }}>
          🚀 NexPulse Dashboard
        </h1>

        {/* Navigation */}
        <nav style={{ marginBottom: "28px", display: "flex", gap: 12, flexWrap: "wrap" }}>
          <NavLink to="/" end className="nav-btn" style={linkStyle}>
            Upload
          </NavLink>
          <NavLink to="/analytics" className="nav-btn" style={linkStyle}>
            Analytics
          </NavLink>
          <NavLink to="/monthly" className="nav-btn" style={linkStyle}>
            Monthly View
          </NavLink>
          <NavLink to="/charts" className="nav-btn" style={linkStyle}>
            Visual Charts
          </NavLink>
          <NavLink to="/compare" className="nav-btn" style={linkStyle}>
            Compare PDFs
          </NavLink>
        </nav>

        {/* Routes */}
        <Routes>
          {/* index = "/" */}
          <Route index element={<UploadPDF />} />
          <Route path="/analytics" element={<AnalyticsChart />} />
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

/* Small inline style so it looks good even without App.css */
const linkStyle = ({ isActive }) => ({
  padding: "10px 14px",
  border: "1px solid rgba(0,255,179,0.25)",
  borderRadius: 8,
  textDecoration: "none",
  color: isActive ? "var(--bg)" : "var(--accent)",
  background: isActive ? "rgba(0,255,179,0.2)" : "transparent",
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
