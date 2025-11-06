// components/Toolbar.jsx
export default function Toolbar({ children, onApply, onReset }) {
  return (
    <div style={{
      position:"sticky", top:0, zIndex:9, padding:"10px 12px",
      backdropFilter:"blur(4px)", background:"rgba(11,15,20,.7)",
      borderBottom:"1px solid var(--border)", display:"flex",
      gap:10, alignItems:"center"
    }}>
      {children}
      <div style={{marginLeft:"auto", display:"flex", gap:8}}>
        <button className="btn" onClick={onApply}>Apply</button>
        <button className="btn" onClick={onReset}>Reset</button>
      </div>
    </div>
  );
}
