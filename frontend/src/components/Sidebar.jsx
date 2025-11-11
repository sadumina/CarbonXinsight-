// src/components/Sidebar.jsx
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <h2>CarbonXInsight</h2>

      <nav>
        <NavLink to="/" className="menu-item">
          📊 Dashboard
        </NavLink>

        <NavLink to="/upload" className="menu-item">
          📁 Data Upload
        </NavLink>

        <div className="menu-item disabled">⚙ Settings (coming soon)</div>
      </nav>
    </aside>
  );
}
