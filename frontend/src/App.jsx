// ✅ src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import AnalyticsPage from "./pages/AnalyticsPage";
import DataUploadPage from "./pages/DataUploadPage";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Wrap all pages inside sidebar layout */}
        <Route element={<DashboardLayout />}>

          {/* Default page → Dashboard */}
          <Route path="/" element={<AnalyticsPage />} />

          {/* Upload Page */}
          <Route path="/upload" element={<DataUploadPage />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}
