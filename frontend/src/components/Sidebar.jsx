// src/components/Sidebar.jsx
import { NavLink } from "react-router-dom";
import "./Sidebar.css";
import Logo from "../assets/haycarb-logo.png"; // optional

export default function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <img src={Logo} alt="logo" className="sidebar-logo" />
        <span className="app-name">CarbonXInsight</span>
      </div>

      {/* NOTE: no <ul>/<li>; just links */}
      <nav className="sidebar-menu">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) => `sidebar-item ${isActive ? "active" : ""}`}
        >
          📊 Dashboard
        </NavLink>

        <NavLink
          to="/upload"
          className={({ isActive }) => `sidebar-item ${isActive ? "active" : ""}`}
        >
          ⬆ Data Upload
        </NavLink>

        <div className="sidebar-item disabled">⚙ Settings (soon)</div>
      </nav>
    </div>
  );
}
