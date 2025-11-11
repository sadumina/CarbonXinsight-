// ✅ src/components/DashboardLayout.jsx
import Sidebar from "./Sidebar";
import "../theme.css";
import { Outlet } from "react-router-dom";

export default function DashboardLayout() {
  return (
    <div className="layout">
      <Sidebar />

      <div className="content">
        {/* Route content here */}
        <Outlet />
      </div>
    </div>
  );
}
