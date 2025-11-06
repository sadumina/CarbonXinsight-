// utils/format.js
export const fmtMoney = (n, currency='USD') =>
  n == null ? '—' : new Intl.NumberFormat('en-US',{
    style:'currency', currency, maximumFractionDigits:2
  }).format(Number(n));

export const fmtPct = (n) => (n == null ? '—' : `${Number(n).toFixed(2)}%`);
