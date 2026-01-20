import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "./styles/theme-haycarb-white.css";
import App from './App.jsx'

import { ThemeProvider } from "./context/ThemeContext";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider> 
      <App />
    </ThemeProvider>
   
  </StrictMode>,
)
