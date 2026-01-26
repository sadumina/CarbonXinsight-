import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from "axios";

import "./styles/theme-haycarb-white.css";
import App from './App.jsx'
import { ThemeProvider } from "./context/ThemeContext";

// ✅ GLOBAL BACKEND CONFIG (ONE PLACE ONLY)
axios.defaults.baseURL = import.meta.env.VITE_API_BASE;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider> 
      <App />
    </ThemeProvider>
  </StrictMode>,
)
