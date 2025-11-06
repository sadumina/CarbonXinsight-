import { useState, useEffect } from "react";
import axios from "axios";
import "./MonthlyAnalytics.css";

function MonthlyAnalytics() {
  const [month, setMonth] = useState(5);
  const [year, setYear] = useState(2025);
  const [pdfList, setPdfList] = useState([]);
  const [selectedPdf, setSelectedPdf] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:8000/pdfs")
      .then(res => setPdfList(res.data))
      .catch(err => console.error("PDF fetch error:", err));
  }, []);

  const getData = () => {
    axios.get(`http://localhost:8000/analytics/month`, {
      params: { month, year, pdf: selectedPdf }
    })
    .then(res => setResults(res.data))
    .catch(err => console.error("Monthly API Error:", err));
  };

  return (
    <div className="monthly-container">
      <h2>📅 Monthly Analytics</h2>

      <div className="inputs-row">
        <select value={selectedPdf} onChange={e => setSelectedPdf(e.target.value)}>
          <option value="">Select PDF</option>
          {pdfList.map((pdf, i) => (
            <option key={i} value={pdf}>{pdf}</option>
          ))}
        </select>

        <select value={month} onChange={e => setMonth(e.target.value)}>
          {[...Array(12).keys()].map(m => (
            <option key={m+1} value={m+1}>{m+1}</option>
          ))}
        </select>

        <input type="number" value={year} onChange={e => setYear(e.target.value)} />

        <button onClick={getData}>Get Data</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Country</th>
            <th>Min</th>
            <th>Max</th>
            <th>Avg</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i}>
              <td>{r.product}</td>
              <td>{r.country}</td>
              <td>${r.min_price}</td>
              <td>${r.max_price}</td>
              <td>${r.avg_price.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default MonthlyAnalytics;
