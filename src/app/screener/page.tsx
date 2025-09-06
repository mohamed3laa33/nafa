"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import Link from "next/link";

type Item = {
  ticker: string;
  score: number;
  summary?: string;
  last?: number | null;
  fair?: number | null;
  fairEtaDays?: number | null;
  est10d?: number | null;
  macroAdj?: string | null;
  // diagnostics
  dailyScore?: number | null;
  weeklyScore?: number | null;
  movingAverages?: { buy: number; sell: number };
  zScore?: number | null;
  adv10?: number | null;
  atrPct?: number | null;
  est10dLo1?: number | null;
  est10dHi1?: number | null;
  est10dLo2?: number | null;
  est10dHi2?: number | null;
  flow1hBuyPct?: number | null;
  flow1dBuyPct?: number | null;
  rvol1d?: number | null;
  rvol1w?: number | null;
};

export default function ScreenerPage() {
  const [sector, setSector] = useState<string>("");
  const [sectors, setSectors] = useState<string[]>([]);
  const [limit, setLimit] = useState(500);
  const [top, setTop] = useState(200);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|undefined>();
  const [map, setMap] = useState<Record<string, string>>({}); // ticker -> stockId
  const [openWhy, setOpenWhy] = useState<string | null>(null);
  // Backtest panel
  const [btLoading, setBtLoading] = useState(false);
  const [btRes, setBtRes] = useState<{ summary?: any } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/valuation/sector-medians', { cache: 'no-store' });
        const j = await r.json();
        if (!alive || !r.ok) return;
        const keys = Object.keys(j || {}).sort();
        setSectors(keys);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  async function run() {
    setLoading(true); setErr(undefined); setItems([]);
    try {
      const url = `/api/screener/buy-now?limit=${encodeURIComponent(String(limit))}&top=${encodeURIComponent(String(top))}${sector?`&sector=${encodeURIComponent(sector)}`:''}`;
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Failed');
      const arr: Item[] = Array.isArray(j?.items) ? j.items : [];
      setItems(arr);
      // map tickers to ids for deep links
      if (arr.length) {
        const tickers = arr.map(x=>x.ticker).slice(0,200);
        const rr = await fetch(`/api/stocks?tickers=${encodeURIComponent(tickers.join(','))}`, { cache: 'no-store' });
        const jj = await rr.json();
        if (rr.ok && Array.isArray(jj?.data)) {
          const m: Record<string, string> = {};
          for (const row of jj.data) m[String(row.ticker).toUpperCase()] = String(row.id);
          setMap(m);
        }
      }
    } catch (e: any) { setErr(e?.message || 'Failed'); }
    finally { setLoading(false); }
  }

  useEffect(() => { run(); }, []);

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-2xl font-semibold">Screener – Buy Now</h1>
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs mb-1">Sector</label>
          <select className="border rounded px-2 py-1" value={sector} onChange={(e)=>setSector(e.target.value)}>
            <option value="">All</option>
            {sectors.map((s)=> (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Limit</label>
          <input type="number" className="border rounded px-2 py-1 w-24" value={limit} onChange={(e)=>setLimit(Number(e.target.value||0))} />
        </div>
        <div>
          <label className="block text-xs mb-1">Top</label>
          <input type="number" className="border rounded px-2 py-1 w-24" value={top} onChange={(e)=>setTop(Number(e.target.value||0))} />
        </div>
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={run} disabled={loading}>{loading? 'Loading…' : 'Run'}</button>
      </div>

      {/* Model notes (kept in sync with the current engine) */}
      <div className="text-[13px] text-gray-700 bg-white border rounded p-3 max-w-4xl">
        <div className="font-semibold mb-1">How candidates are scored and estimated</div>
        <ul className="list-disc ml-5 space-y-1">
          <li><span className="font-medium">Score (blended)</span>: 0.7 × Daily + 0.3 × Weekly TA score. Each score sums signals from MAs (5/10/20/50/200 vs price) and oscillators (RSI, MACD histogram). Weak setups are gated: if breadth &lt; 3 and |score| &lt; 2 → score = 0.</li>
          <li><span className="font-medium">Sector ranking</span>: names are sorted by sector <em>z‑score</em> (score normalized within sector). If sector is missing, we normalize in the ALL bucket.</li>
          <li><span className="font-medium">Liquidity</span>: requires ≥ $5M average daily dollar volume over the last 10 sessions; illiquid names are skipped.</li>
          <li><span className="font-medium">Fair value</span>: from <code>/api/valuation/fair/&lt;ticker&gt;</code> (VWAP‑20D, EMA‑20D, Donchian midpoint blend). Shown in the <em>Fair</em> column.</li>
          <li><span className="font-medium">ETA→Fair (adaptive)</span>: trading‑day estimate <code>|fair − last| / ATR(14)</code>, scaled by the current volatility regime (ATR% vs median) so volatile weeks yield longer ETAs.</li>
          <li><span className="font-medium">10‑day estimate (data‑driven)</span>: direction from TA bias (score ≥ 1 → up, ≤ −1 → down). Magnitude = sector base<sub>k</sub> × volatility factor (ATR% percentile) × score factor × ATR(14). Macro dampeners: −10% if FOMC within 10 days; −15% if earnings within 10 days (tooltip shows the note).</li>
          <li><span className="font-medium">Sector filter</span>: uses <code>stocks.sector</code> if present; otherwise it falls back to ALL (you’ll still get results).</li>
          <li><span className="font-medium">Scan budget</span>: we scan up to <em>Limit</em> names with conservative concurrency to stay fast and memory‑friendly, then return the top <em>Top</em> by sector‑normalized score.</li>
        </ul>
      </div>

      {/* Backtest this view */}
      <div className="text-[13px] text-gray-700 bg-white border rounded p-3 max-w-4xl">
        <div className="font-semibold mb-1">Backtest this sector (rolling)</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded bg-indigo-600 text-white" disabled={btLoading} onClick={async()=>{
            setBtLoading(true); setBtRes(null);
            try {
              const r = await fetch('/api/backtest/screener/run', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sector, limit: Math.min(limit,200), horizonDays: 10, startDaysAgo: 120, endDaysAgo: 20, step: 5 })});
              const j = await r.json(); if (r.ok) setBtRes({ summary: j?.summary });
            } catch {}
            setBtLoading(false);
          }}>{btLoading? 'Running…':'Run Backtest'}</button>
          {btRes?.summary && (
            <div className="text-sm text-gray-800">Hit Rate: <span className="font-semibold">{Number(btRes.summary.hitRate||0).toFixed(1)}%</span> • MAE: <span className="font-semibold">{Number(btRes.summary.mae||0).toFixed(2)}</span> • MAPE: <span className="font-semibold">{Number(btRes.summary.mape||0).toFixed(2)}%</span></div>
          )}
        </div>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}
      {(!items || items.length===0) && !err && (
        <div className="text-sm text-gray-600">No candidates found. Try raising Limit, removing Sector, or widening Top.</div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="p-2" title="Ticker symbol">Ticker</th>
              <th className="p-2" title="Blended score: 0.7×Daily + 0.3×Weekly with breadth gating">Score</th>
              <th className="p-2" title="Label from TA score">Summary</th>
              <th className="p-2" title="Last close">Last</th>
              <th className="p-2" title="Technical fair (VWAP20, EMA20, Donchian mid)">Fair</th>
              <th className="p-2" title="Trading‑days to reach fair using ATR(14), volatility‑adaptive">ETA→Fair</th>
              <th className="p-2" title="10‑day ATR‑based projection with TA bias and macro/earnings dampening">Est (10d)</th>
              <th className="p-2" title="Buy% over last hour (intraday flow)">Flow 1h</th>
              <th className="p-2" title="Buy% today (intraday flow)">Flow 1d</th>
              <th className="p-2" title="Relative volume vs 10d median">RVOL 1d</th>
              <th className="p-2">Link</th>
              <th className="p-2">Why?</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx)=> (
              <Fragment key={it.ticker+idx}>
              <tr className="border-t">
                <td className="p-2 font-medium">{it.ticker}</td>
                <td className="p-2">{Number(it.score).toFixed(0)}</td>
                <td className="p-2">{it.summary ?? '—'}</td>
                <td className="p-2">{it.last==null? '—' : Number(it.last).toFixed(2)}</td>
                <td className="p-2">{it.fair==null? '—' : Number(it.fair).toFixed(2)}</td>
                <td className="p-2">{it.fairEtaDays==null? '—' : `${it.fairEtaDays}d`}</td>
                <td className="p-2" title={it.macroAdj || ''}>{it.est10d==null? '—' : Number(it.est10d).toFixed(2)}</td>
                <td className="p-2">
                  {map[it.ticker] ? (
                    <Link href={`/stocks/${map[it.ticker]}`} className="underline text-blue-600">Open</Link>
                  ) : <span className="text-gray-500">—</span>}
                </td>
                <td className="p-2">{it.flow1hBuyPct==null? '—' : `${it.flow1hBuyPct.toFixed(0)}%`}</td>
                <td className="p-2">{it.flow1dBuyPct==null? '—' : `${it.flow1dBuyPct.toFixed(0)}%`}</td>
                <td className="p-2">{it.rvol1d==null? '—' : `${it.rvol1d.toFixed(2)}×`}</td>
                <td className="p-2">
                  <button type="button" className="underline text-gray-700 cursor-pointer" aria-expanded={openWhy===it.ticker} onClick={()=>setOpenWhy(openWhy===it.ticker? null : it.ticker)}>Why?</button>
                </td>
              </tr>
              {openWhy===it.ticker && (
                <tr className="border-t bg-gray-50">
                  <td className="p-2 text-xs" colSpan={9}>
                    <div className="flex flex-wrap gap-4">
                      <div>Daily: <span className="font-semibold">{it.dailyScore??'—'}</span></div>
                      <div>Weekly: <span className="font-semibold">{it.weeklyScore??'—'}</span></div>
                      <div>Breadth/MAs: <span className="font-semibold">{it.movingAverages? `${it.movingAverages.buy}/${it.movingAverages.sell}`:'—'}</span></div>
                      <div>ATR%: <span className="font-semibold">{it.atrPct!=null? (100*it.atrPct).toFixed(2)+'%':'—'}</span></div>
                      <div>Liquidity (med $vol 10d): <span className="font-semibold">{it.adv10!=null? Math.round(it.adv10).toLocaleString():'—'}</span></div>
                      <div>Sector z: <span className="font-semibold">{it.zScore!=null? it.zScore.toFixed(2):'—'}</span></div>
                      <div>Bands ±1σ: <span className="font-semibold">{it.est10dLo1!=null? it.est10dLo1.toFixed(2):'—'} / {it.est10dHi1!=null? it.est10dHi1.toFixed(2):'—'}</span></div>
                      <div>Bands ±2σ: <span className="font-semibold">{it.est10dLo2!=null? it.est10dLo2.toFixed(2):'—'} / {it.est10dHi2!=null? it.est10dHi2.toFixed(2):'—'}</span></div>
                      {it.macroAdj && <div>Events: <span className="font-semibold">{it.macroAdj}</span></div>}
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
