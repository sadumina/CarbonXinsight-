// App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import AnalyticsPage from "./pages/AnalyticsPage";
import DataUploadPage from "./pages/DataUploadPage";
import ViewDataPage from "./pages/ViewDataPage";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<AnalyticsPage />} />
            <Route path="/view-data" element={<ViewDataPage />} />
            <Route path="/upload" element={<DataUploadPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
