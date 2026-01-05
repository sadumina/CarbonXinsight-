import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import AnalyticsPage from "./pages/AnalyticsPage";
import DataUploadPage from "./pages/DataUploadPage";
import ViewDataPage from "./pages/ViewDataPage";

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <div style={{ flex: 1, padding: 20 }}>
          <Routes>
            {/* Default route */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            <Route path="/dashboard" element={<AnalyticsPage />} />
            <Route path="/view-data" element={<ViewDataPage />} />
            <Route path="/upload" element={<DataUploadPage />} />

            {/* Optional: catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
