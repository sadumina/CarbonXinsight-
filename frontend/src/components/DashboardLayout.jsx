import Sidebar from "./Sidebar";
import "./DashboardLayout.css";

export default function DashboardLayout({ children }) {
  return (
    <div className="layout-container">
      <Sidebar />

      <main className="layout-content">
        {children}
      </main>
    </div>
  );
}
