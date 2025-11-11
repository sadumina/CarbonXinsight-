// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AnalyticsPage from "./pages/AnalyticsPage";
import DataUploadPage from "./pages/DataUploadPage";
import Sidebar from "./components/Sidebar"; // small nav

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className="app-sidebar"><Sidebar /></aside>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<AnalyticsPage />} />
            <Route path="/upload" element={<DataUploadPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
