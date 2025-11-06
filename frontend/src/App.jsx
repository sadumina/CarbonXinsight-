import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import UploadPDF from "./components/UploadPDF";
import AnalyticsChart from "./components/AnalyticsChart";
import MonthlyAnalytics from "./components/MonthlyAnalytics";
import ChartsForPDF from "./components/ChartsForPDF";  // ✅ new page

import "./App.css"; // if you have global styling

function App() {
  return (
    <Router>
      <div style={{ padding: "40px" }}>
        <h1 style={{ color: "var(--primary)", marginBottom: "20px" }}>
          🚀 NexPulse Dashboard
        </h1>

        {/* ✅ Navigation Tabs */}
        <nav style={{ marginBottom: "30px" }}>
          <Link to="/" className="nav-btn">Upload</Link>
          <Link to="/analytics" className="nav-btn">Analytics</Link>
          <Link to="/monthly" className="nav-btn">Monthly View</Link>
          <Link to="/charts" className="nav-btn">Visual Charts</Link>
        </nav>

        {/* ✅ Routing */}
        <Routes>
          <Route path="/" element={<UploadPDF />} />
          <Route path="/analytics" element={<AnalyticsChart />} />
          <Route path="/monthly" element={<MonthlyAnalytics />} />
          <Route path="/charts" element={<ChartsForPDF />} /> {/* ✅ new charts page */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
