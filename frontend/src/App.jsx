import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import AnalyticsPage from "./pages/AnalyticsPage";
import DataUploadPage from "./pages/DataUploadPage";
import ViewDataPage from "./pages/ViewDataPage";

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: "flex" }}>
        <Sidebar />
        <div style={{ flex: 1, padding: 20 }}>
          <Routes>
            <Route path="/dashboard" element={<AnalyticsPage />} />
            <Route path="/view-data" element={<ViewDataPage />} />
            <Route path="/upload" element={<DataUploadPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
