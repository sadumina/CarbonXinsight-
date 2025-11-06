// components/KpiCard.jsx
import { fmtMoney, fmtPct } from "../utils/format";

export default function KpiCard({ label, value, delta }) {
  const up = delta > 0, dn = delta < 0;
  return (
    <div className="card" style={{padding:16,minWidth:220}}>
      <div style={{color:"var(--muted)",fontSize:13,marginBottom:6}}>{label}</div>
      <div style={{fontSize:26,fontWeight:800,color:"var(--accent)"}}>
        {typeof value === 'number' ? fmtMoney(value) : value}
      </div>
      {delta != null && (
        <div style={{
          display:"inline-block", marginTop:8, padding:"4px 8px", borderRadius:999,
          background: up ? "rgba(25,247,159,.12)" : dn ? "rgba(255,123,123,.12)" : "rgba(255,255,255,.05)",
          color: up ? "#19f79f" : dn ? "#ff7b7b" : "var(--muted)",
          fontWeight:700, fontSize:12
        }}>
          {up ? "▲" : dn ? "▼" : "•"} {fmtPct(delta)}
        </div>
      )}
    </div>
  );
}
