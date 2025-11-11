import "./Sidebar.css";
import { NavLink } from "react-router-dom";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">CarbonXInsight</div>

      <nav className="sidebar-nav">
        <NavLink to="/" end className="nav-item">
          📊 Dashboard
        </NavLink>

        <NavLink to="/upload" className="nav-item">
          ⬆️ Data Upload
        </NavLink>

        <NavLink to="/settings" className="nav-item disabled">
          ⚙️ Settings (coming soon)
        </NavLink>
      </nav>
    </aside>
  );
}
