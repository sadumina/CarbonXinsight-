// src/components/Sidebar.jsx
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

export default function Sidebar() {
  return (
    <nav className="side">
      <div className="side-brand">CarbonXInsight</div>

      <ul className="side-nav">
        <li>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => "side-link" + (isActive ? " active" : "")}
          >
            📊 Dashboard
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/upload"
            className={({ isActive }) => "side-link" + (isActive ? " active" : "")}
          >
            ⬆ Data Upload
          </NavLink>
        </li>
        <li>
          <span className="side-link disabled">⚙ Settings (soon)</span>
        </li>
      </ul>
    </nav>
  );
}
