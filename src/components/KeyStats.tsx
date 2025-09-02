"use client";

import { useEffect, useState } from "react";

type Stats = {
  prevClose: number | null; open: number | null;
  dayLow: number | null; dayHigh: number | null;
  range52wLow: number | null; range52wHigh: number | null;
  volume: number | null; avgVolume3m: number | null; oneYearChange: number | null;
  marketCap: number | null; sharesOutstanding: number | null;
  revenue: number | null; netIncome: number | null; eps: number | null; peRatio: number | null;
  grossMargins: number | null; returnOnAssets: number | null; returnOnEquity: number | null;
  priceToBook: number | null; ebitda: number | null; evToEbitda: number | null;
  beta: number | null; bookValuePerShare: number | null; dividendRate: number | null; dividendYield: number | null;
  nextEarningsDate: string | null;
};

function fmt(n: number | null, opts: Intl.NumberFormatOptions = {}) {
  if (n == null || !isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, opts).format(n);
}
function abbr(n: number | null) {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n/1e12).toFixed(2)+"T";
  if (abs >= 1e9) return (n/1e9).toFixed(2)+"B";
  if (abs >= 1e6) return (n/1e6).toFixed(2)+"M";
  if (abs >= 1e3) return (n/1e3).toFixed(2)+"K";
  return String(n);
}

export default function KeyStats({ ticker }: { ticker: string }) {
  const [d, setD] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      setErr("");
      try {
        const r = await fetch(`/api/key-stats/${encodeURIComponent(ticker)}`, { cache: "no-store" });
        const j = await r.json();
        if (alive) {
          if (r.ok) setD(j); else setErr(j.error || "Failed");
        }
      } catch (e: any) { if (alive) setErr(e?.message || "Failed"); }
    })();
    return () => { alive = false; };
  }, [ticker]);

  if (err) return <div className="text-xs text-red-600">{err}</div>;
  if (!d) return <div className="text-xs text-gray-500">Loading…</div>;

  const dayRange = `${fmt(d.dayLow, {maximumFractionDigits:2})} - ${fmt(d.dayHigh, {maximumFractionDigits:2})}`;
  const wkRange = `${fmt(d.range52wLow, {maximumFractionDigits:2})} - ${fmt(d.range52wHigh, {maximumFractionDigits:2})}`;

  let rows: Array<{k: string; v: string}> = [
    { k: "Prev. Close", v: fmt(d.prevClose, { maximumFractionDigits: 2 }) },
    { k: "Open", v: fmt(d.open, { maximumFractionDigits: 2 }) },
    { k: "Day Range", v: dayRange },
    { k: "52 wk Range", v: wkRange },
    { k: "Volume", v: abbr(d.volume) },
    { k: "Avg Vol (3m)", v: abbr(d.avgVolume3m) },
    { k: "1-Year Change", v: d.oneYearChange!=null? (d.oneYearChange*100).toFixed(1)+"%":"—" },
    { k: "Market Cap", v: abbr(d.marketCap) },
    { k: "Shares Out", v: abbr(d.sharesOutstanding) },
    { k: "Revenue", v: abbr(d.revenue) },
    { k: "Net Income", v: abbr(d.netIncome) },
    { k: "EPS (TTM)", v: fmt(d.eps, { maximumFractionDigits: 2 }) },
    { k: "P/E", v: fmt(d.peRatio, { maximumFractionDigits: 2 }) },
    { k: "Gross Margin", v: d.grossMargins!=null? (d.grossMargins*100).toFixed(1)+"%":"—" },
    { k: "ROA", v: d.returnOnAssets!=null? (d.returnOnAssets*100).toFixed(1)+"%":"—" },
    { k: "ROE", v: d.returnOnEquity!=null? (d.returnOnEquity*100).toFixed(1)+"%":"—" },
    { k: "Price/Book", v: fmt(d.priceToBook, { maximumFractionDigits: 2 }) },
    { k: "EBITDA", v: abbr(d.ebitda) },
    { k: "EV/EBITDA", v: fmt(d.evToEbitda, { maximumFractionDigits: 1 }) },
    { k: "Beta", v: fmt(d.beta, { maximumFractionDigits: 2 }) },
    { k: "Book Value/Share", v: fmt(d.bookValuePerShare, { maximumFractionDigits: 2 }) },
    { k: "Dividend (Rate)", v: fmt(d.dividendRate, { maximumFractionDigits: 2 }) },
    { k: "Dividend Yield", v: d.dividendYield!=null? (d.dividendYield*100).toFixed(2)+"%":"—" },
    { k: "Next Earnings", v: d.nextEarningsDate ? new Date(d.nextEarningsDate).toISOString().slice(0,10) : "—" },
  ];

  // Drop rows with empty values like "—" or "— - —"
  rows = rows.filter(({ v }) => !/^—(\s*-\s*—)?$/.test(v || ''));

  if (rows.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs">
      {rows.map(({k,v}) => (
        <div key={k} className="flex justify-between gap-2 border-b border-gray-100 py-1">
          <span className="text-gray-600">{k}</span>
          <span className="font-medium">{v}</span>
        </div>
      ))}
    </div>
  );
}
