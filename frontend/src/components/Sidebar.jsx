import { NavLink } from "react-router-dom";
import "./Sidebar.css";
import Logo from "../assets/haycarb-logo.png";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src={Logo} alt="Haycarb logo" className="sidebar-logo" />
        <span className="app-name">HayCarb</span>
      </div>

      <nav className="sidebar-menu">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) =>
            `sidebar-item ${isActive ? "active" : ""}`
          }
        >
          <span className="nav-label">Dashboard</span>
        </NavLink>

        <NavLink
          to="/view-data"
          className={({ isActive }) =>
            `sidebar-item ${isActive ? "active" : ""}`
          }
        >
          <span className="nav-label">View Data</span>
        </NavLink>

        <NavLink
          to="/upload"
          className={({ isActive }) =>
            `sidebar-item ${isActive ? "active" : ""}`
          }
        >
          <span className="nav-label">Data Upload</span>
        </NavLink>

        <div className="sidebar-separator" />

        <div className="sidebar-item disabled">
          <span className="nav-label">Settings (soon)</span>
        </div>
      </nav>
    </aside>
  );
}
