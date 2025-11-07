// src/App.jsx
import UploadAndAnalytics from "./components/UploadAndAnalytics";
import "./App.css";

export default function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <h1>CarbonXInsight Dashboard</h1>
      </header>
      <UploadAndAnalytics />
      <footer className="foot">© {new Date().getFullYear()} CarbonXInsight</footer>
    </main>
  );
}
