// src/app/calls/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/app/AuthContext";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import PriceBadge from "@/components/PriceBadge";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

const PriceSparkline = dynamic(() => import("@/components/PriceSparkline"), { ssr: false });

type Stock = { id: string; ticker: string };

type OpenCall = {
  stock_id?: string | null;
  ticker?: string | null;
  entry?: number | string | null;
  t1?: number | string | null;        // target
  opened_at?: string | null;          // entry date
  opened_by?: string | null;          // analyst email/name
  opened_by_id?: string | null;
};

type ClosedCall = {
  id: string;
  ticker: string;
  stock_id?: string | null;
  type?: string | null;
  entry?: number | string | null;
  entry_price?: number | string | null;
  exit?: number | string | null;
  close?: number | string | null;
  closed_price?: number | string | null;
  exit_price?: number | string | null;
  t1?: number | string | null;
  target?: number | string | null;
  target_price?: number | string | null;
  stop?: number | string | null;
  stop_loss?: number | string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  outcome?: string | null;
  note?: string | null;
  result_pct?: number | string | null;
  opened_by?: string | null;
  opened_by_id?: string | null;
}

type ClosedCallNorm = {
  id: string;
  ticker: string;
  stock_id?: string | null;
  type: string | null;
  entry_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  opened_at: string | null;
  closed_at: string | null;
  outcome: string | null;
  note: string | null;
  result_pct: number | null;
  current_price: number | null;
  opened_by: string | null;
  opened_by_id?: string | null;
};

type OpenRow = {
  id: string; // stock id
  ticker: string;
  entry: number | null;
  target: number | null;
  current: number | null;
  openedAt: string | null;
  openedBy: string | null;
  openedById: string | null;
};

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
};
const fmt = (n: number | null, d = 2) => (n == null ? "—" : n.toFixed(d));
const fnum = (n: number | null, d = 2) => (n == null ? "-" : n.toFixed(d));
const ymd = (s?: string | null) => (!s ? "—" : new Date(s).toISOString().slice(0, 10));
const fdate = (s: string | null) => (!s ? "-" : new Date(s).toISOString().slice(0, 10));

async function fetchPrice(ticker: string): Promise<number | null> {
  try {
    const r = await fetch(`/api/price/${encodeURIComponent(ticker)}`, { cache: "no-store" });
    const j = await r.json();
    return r.ok && typeof j.price === "number" ? j.price : null;
  } catch {
    return null;
  }
}

const Buzz = ({ t }: { t: string }) => (
  <a
    className="brand-link"
    target="_blank"
    rel="noopener noreferrer"
    href={`https://x.com/search?q=%24${encodeURIComponent(t)}%20lang%3Aen%20-filter%3Aretweets%20min_faves%3A10&f=live`}
  >
    X Live — {t}
  </a>
);
const News = ({ t }: { t: string }) => (
  <a
    className="brand-link"
    target="_blank"
    rel="noopener noreferrer"
    href={`https://news.google.com/search?q=${encodeURIComponent(t)}&hl=en-US&gl=US&ceid=US:en`}
  >
    News — {t}
  </a>
);

// Lightweight 5m momentum indicator using /api/price/flow
function Momentum5m({ t, refreshKey, buyThreshold = 55, sellThreshold = 45 }: { t: string; refreshKey?: number; buyThreshold?: number; sellThreshold?: number }) {
  const [state, setState] = useState<{ label: 'Buy' | 'Sell' | 'Neutral' | null; pct?: number | null; buy?: number; sell?: number; total?: number }>({ label: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/price/flow/${encodeURIComponent(t)}?window=5m`, { cache: 'no-store' });
        const j = await r.json();
        if (!alive) return;
        if (r.ok) {
          const buy = Number(j?.buyVol || 0);
          const sell = Number(j?.sellVol || 0);
          const total = buy + sell;
          const buyPct = total > 0 && j?.buyPct != null ? Number(j.buyPct) : (total>0 ? (buy/total)*100 : null);
          let label: 'Buy' | 'Sell' | 'Neutral' | null = null;
          if (buyPct == null) label = null;
          else if (buyPct >= buyThreshold) label = 'Buy';
          else if (buyPct <= sellThreshold) label = 'Sell';
          else label = 'Neutral';
          setState({ label, pct: buyPct, buy, sell, total });
        } else {
          setState({ label: null });
        }
      } catch { setState({ label: null }); }
    })();
    return () => { alive = false; };
  }, [t, refreshKey, buyThreshold, sellThreshold]);
  if (!state.label) return <span className="text-xs text-gray-500">—</span>;
  const variant = state.label === 'Buy' ? 'success' : state.label === 'Sell' ? 'destructive' : 'muted';
  const text = state.pct != null ? `${state.label} • ${state.pct.toFixed(0)}%` : state.label;
  const tip = `Buy: ${state.buy ?? '-'}  Sell: ${state.sell ?? '-'}  Total: ${state.total ?? '-'}  Window: 5m`;
  return <span title={tip}><Badge variant={variant}>{text}</Badge></span>;
}

// RVOL and VWAP helpers
type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };
async function fetchCandles(ticker: string, res: '1' | 'D', days: number): Promise<Candle[]> {
  try {
    const r = await fetch(`/api/price/candles/${encodeURIComponent(ticker)}?res=${res}&days=${days}`, { cache: 'no-store' });
    const j = await r.json();
    return r.ok && Array.isArray(j?.candles) ? (j.candles as Candle[]) : [];
  } catch { return []; }
}

function RVOLVWAP({ t }: { t: string }) {
  const [state, setState] = useState<{ rvol?: number | null; vwap?: number | null; distPct?: number | null; regVwap?: number | null; regDistPct?: number | null }>({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const d = await fetchCandles(t, 'D', 21);
      const vols = d.map((x) => Number(x.v || 0)).filter((x) => Number.isFinite(x) && x > 0);
      const todayVol = vols.length ? vols[vols.length - 1] : null;
      const avgVol = vols.length > 1 ? vols.slice(-11, -1).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(10, vols.length - 1)) : null;
      const rvol = avgVol && todayVol ? (todayVol / avgVol) : null;

      const m = await fetchCandles(t, '1', 1);
      let vwap: number | null = null;
      let regVwap: number | null = null;
      if (m && m.length) {
        let volSum = 0, pvSum = 0;
        let regVolSum = 0, regPvSum = 0;
        for (const k of m) {
          const typical = (Number(k.h) + Number(k.l) + Number(k.c)) / 3;
          const v = Number(k.v || 0);
          if (!Number.isFinite(typical) || !Number.isFinite(v)) continue;
          pvSum += typical * v;
          volSum += v;
          const dt = new Date(Number(k.t));
          const hh = dt.getHours(); const mm = dt.getMinutes();
          const mins = hh * 60 + mm;
          // Regular session approx 9:30–16:00 ET; allow local offset approximation
          if (mins >= 9 * 60 + 30 && mins <= 16 * 60) {
            regPvSum += typical * v; regVolSum += v;
          }
        }
        vwap = volSum > 0 ? pvSum / volSum : null;
        regVwap = regVolSum > 0 ? regPvSum / regVolSum : null;
      }
      let distPct: number | null = null;
      let regDistPct: number | null = null;
      if (vwap != null) {
        const last = m?.[m.length - 1]?.c;
        if (Number.isFinite(last) && vwap > 0) distPct = ((Number(last) - vwap) / vwap) * 100;
      }
      if (regVwap != null) {
        const last = m?.[m.length - 1]?.c;
        if (Number.isFinite(last) && regVwap > 0) regDistPct = ((Number(last) - regVwap) / regVwap) * 100;
      }
      if (alive) setState({ rvol, vwap, distPct, regVwap, regDistPct });
    })();
    return () => { alive = false; };
  }, [t]);

  const rvolTxt = state.rvol == null ? '—' : state.rvol.toFixed(2) + 'x';
  const distTxt = state.distPct == null ? '—' : (state.distPct >= 0 ? '+' : '') + state.distPct.toFixed(2) + '%';
  const regTxt = state.regDistPct == null ? '' : `  •  R-VWAP Δ: ${(state.regDistPct >= 0 ? '+' : '') + state.regDistPct.toFixed(2)}%`;
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div>
        <span className="text-gray-600">RVOL: </span>
        <span className="font-medium">{rvolTxt}</span>
      </div>
      <div>
        <span className="text-gray-600">VWAP Δ: </span>
        <span className={`${state.distPct == null ? '' : state.distPct >= 0 ? 'text-green-600' : 'text-red-600'} font-medium`}>{distTxt}</span>
        <span className="text-gray-500">{regTxt}</span>
      </div>
    </div>
  );
}

// -------- Fair Target cell (daily ATR + 20D high heuristic) --------
function FairTargetCell({ t, entry, target }: { t: string; entry: number | null; target: number | null }) {
  const [state, setState] = useState<{ fair?: number | null; fit?: 'Conservative' | 'Fair' | 'Stretch' | 'Aggressive' | '-'; fairEta?: number | null } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const j = await fetch(`/api/price/candles/${encodeURIComponent(t)}?res=D&days=60`, { cache: 'no-store' }).then(r=>r.json());
        if (!alive) return;
        const rows = Array.isArray(j?.candles) ? j.candles : [];
        if (!rows.length) { setState({ fair: null, fit: '-' }); return; }
        // ATR(14)
        const highs = rows.map((k:any)=>Number(k.h));
        const lows  = rows.map((k:any)=>Number(k.l));
        const closes= rows.map((k:any)=>Number(k.c));
        const TR: number[] = [];
        for (let i=1;i<rows.length;i++){
          const h=highs[i], l=lows[i], pc=closes[i-1];
          if ([h,l,pc].every(Number.isFinite)) {
            TR.push(Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc)));
          }
        }
        const period = 14;
        const atr = TR.length >= period ? TR.slice(-period).reduce((a,b)=>a+b,0)/period : null;
        const lastClose = closes[closes.length-1];
        // 20D swing extremes
        const lookback = 20;
        const recentHigh = Math.max(...highs.slice(-lookback));
        const recentLow  = Math.min(...lows.slice(-lookback));
        let base = entry ?? lastClose;
        if (!Number.isFinite(base) || base == null) base = lastClose;
        let fair = null as number | null;
        // Decide direction: use target vs base if available, else assume long
        let dir: 1 | -1 = 1;
        if (target != null && Number.isFinite(base as number)) {
          dir = (target as number) >= (base as number) ? 1 : -1;
        }
        // Dynamic ATR multiplier from daily TA bias (Strong Buy/Buy/Neutral/Sell)
        let k = 2.0;
        try {
          const taR = await fetch(`/api/ta/${encodeURIComponent(t)}?tf=D`, { cache: 'no-store' });
          const taJ = await taR.json();
          const label = String(taJ?.summary || 'Neutral');
          if (label.includes('Strong Buy')) k = 2.8;
          else if (label.includes('Buy')) k = 2.2;
          else if (label.includes('Neutral')) k = 1.6;
          else if (label.includes('Sell')) k = 1.3;
          else if (label.includes('Strong Sell')) k = 1.0;
        } catch {}
        if (Number.isFinite(base)) {
          if (dir === 1) {
            const atrTargetUp = atr != null ? (base as number) + k * atr : null;
            fair = Math.max(atrTargetUp ?? 0, Number.isFinite(recentHigh) ? recentHigh : 0) || null;
          } else {
            const atrTargetDn = atr != null ? (base as number) - k * atr : null;
            fair = Math.min(atrTargetDn ?? Number.POSITIVE_INFINITY, Number.isFinite(recentLow) ? recentLow : Number.POSITIVE_INFINITY);
            if (!Number.isFinite(fair as number)) fair = atrTargetDn; // fallback
          }
        }
        // Fit evaluation if user target provided (compare distances from base)
        let fit: 'Conservative' | 'Fair' | 'Stretch' | 'Aggressive' | '-' = '-';
        if (target != null && fair != null && Number.isFinite(base as number)) {
          const distT = Math.abs((target as number) - (base as number));
          const distF = Math.abs((fair as number) - (base as number));
          if (distF > 0) {
            const ratio = distT / distF;
            if (ratio <= 0.8) fit = 'Conservative';
            else if (ratio < 1.2) fit = 'Fair';
            else if (ratio < 1.5) fit = 'Stretch';
            else fit = 'Aggressive';
          }
        }
        // Fair ETA
        let fairEta: number | null = null;
        if (atr && Number.isFinite(base as number) && fair != null) {
          const distFair = Math.abs((fair as number) - (base as number));
          fairEta = distFair > 0 && atr > 0 ? Math.max(1, Math.ceil(distFair / atr)) : null;
        }
        setState({ fair, fit, fairEta });
      } catch { if (alive) setState({ fair: null, fit: '-' }); }
    })();
    return () => { alive = false; };
  }, [t, entry, target]);

  const fairTxt = state?.fair == null ? '—' : state.fair.toFixed(2);
  const fit = state?.fit ?? '-';
  const color = fit === 'Fair' ? 'text-green-700' : fit === 'Conservative' ? 'text-gray-600' : fit === 'Stretch' ? 'text-amber-600' : fit === 'Aggressive' ? 'text-red-600' : '';
  return (
    <>
      <td className="p-2 border bg-brand-soft" title={state?.fairEta ? `Fair ETA: ${state.fairEta} days` : ''}>{fairTxt}</td>
      <td className={`p-2 border whitespace-nowrap ${color}`}>{fit}</td>
    </>
  );
}

// -------- ETA (trading days) to reach user target using ATR(14) --------
function EtaDaysCell({ t, current, entry, target }: { t: string; current: number | null; entry: number | null; target: number | null }) {
  const [eta, setEta] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (target == null) { if (alive) setEta(null); return; }
        const j = await fetch(`/api/price/candles/${encodeURIComponent(t)}?res=D&days=60`, { cache: 'no-store' }).then(r=>r.json());
        const rows = Array.isArray(j?.candles) ? j.candles : [];
        if (!rows.length) { if (alive) setEta(null); return; }
        const highs = rows.map((k:any)=>Number(k.h));
        const lows  = rows.map((k:any)=>Number(k.l));
        const closes= rows.map((k:any)=>Number(k.c));
        const TR: number[] = [];
        for (let i=1;i<rows.length;i++){
          const h=highs[i], l=lows[i], pc=closes[i-1];
          if ([h,l,pc].every(Number.isFinite)) TR.push(Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc)));
        }
        const period = 14;
        const atr = TR.length >= period ? TR.slice(-period).reduce((a,b)=>a+b,0)/period : null;
        const base = (current != null ? current : (entry != null ? entry : closes[closes.length-1])) as number | null;
        if (atr == null || !Number.isFinite(atr) || !Number.isFinite(base as number)) { if (alive) setEta(null); return; }
        const dist = Math.abs((target as number) - (base as number));
        const days = dist > 0 && atr > 0 ? Math.max(1, Math.ceil(dist / atr)) : null;
        if (alive) setEta(days);
      } catch { if (alive) setEta(null); }
    })();
    return () => { alive = false; };
  }, [t, current, entry, target]);

  return <td className="p-2 border">{eta == null ? '—' : eta}</td>;
}

// Fair ETA (days) based on fair target computation
function FairEtaCell({ t, entry, target }: { t: string; entry: number | null; target: number | null }) {
  const [eta, setEta] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const j = await fetch(`/api/price/candles/${encodeURIComponent(t)}?res=D&days=60`, { cache: 'no-store' }).then(r=>r.json());
        const rows = Array.isArray(j?.candles) ? j.candles : [];
        if (!rows.length) { if (alive) setEta(null); return; }
        const highs = rows.map((k:any)=>Number(k.h));
        const lows  = rows.map((k:any)=>Number(k.l));
        const closes= rows.map((k:any)=>Number(k.c));
        const TR: number[] = [];
        for (let i=1;i<rows.length;i++){
          const h=highs[i], l=lows[i], pc=closes[i-1];
          if ([h,l,pc].every(Number.isFinite)) TR.push(Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc)));
        }
        const period = 14;
        const atr = TR.length >= period ? TR.slice(-period).reduce((a,b)=>a+b,0)/period : null;
        const lastClose = closes[closes.length-1];
        let base = entry ?? lastClose;
        if (!Number.isFinite(base as number)) { if (alive) setEta(null); return; }
        // direction from target if provided
        let dir: 1 | -1 = 1;
        if (target != null && Number.isFinite(base as number)) dir = (target as number) >= (base as number) ? 1 : -1;
        const lookback = 20;
        const recentHigh = Math.max(...highs.slice(-lookback));
        const recentLow  = Math.min(...lows.slice(-lookback));
        let fair: number | null = null;
        if (dir === 1) {
          const atrTargetUp = atr != null ? (base as number) + 2 * atr : null;
          fair = Math.max(atrTargetUp ?? 0, Number.isFinite(recentHigh) ? recentHigh : 0) || null;
        } else {
          const atrTargetDn = atr != null ? (base as number) - 2 * atr : null;
          fair = Math.min(atrTargetDn ?? Number.POSITIVE_INFINITY, Number.isFinite(recentLow) ? recentLow : Number.POSITIVE_INFINITY);
          if (!Number.isFinite(fair as number)) fair = atrTargetDn;
        }
        if (atr && fair != null) {
          const dist = Math.abs((fair as number) - (base as number));
          const days = dist > 0 && atr > 0 ? Math.max(1, Math.ceil(dist / atr)) : null;
          if (alive) setEta(days);
        } else if (alive) setEta(null);
      } catch { if (alive) setEta(null); }
    })();
    return () => { alive = false; };
  }, [t, entry, target]);
  return <td className="p-2 border">{eta == null ? '—' : eta}</td>;
}

// Suggested Stop and R-to-Target (R multiple), direction-aware
function RiskCell({ t, entry, target }: { t: string; entry: number | null; target: number | null }) {
  const [state, setState] = useState<{ stop?: number | null; rMultiple?: number | null } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const j = await fetch(`/api/price/candles/${encodeURIComponent(t)}?res=D&days=60`, { cache: 'no-store' }).then(r=>r.json());
        const rows = Array.isArray(j?.candles) ? j.candles : [];
        if (!rows.length) { if (alive) setState({ stop: null, rMultiple: null }); return; }
        const highs = rows.map((k:any)=>Number(k.h));
        const lows  = rows.map((k:any)=>Number(k.l));
        const closes= rows.map((k:any)=>Number(k.c));
        const TR: number[] = [];
        for (let i=1;i<rows.length;i++){
          const h=highs[i], l=lows[i], pc=closes[i-1];
          if ([h,l,pc].every(Number.isFinite)) TR.push(Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc)));
        }
        const period = 14;
        const atr = TR.length >= period ? TR.slice(-period).reduce((a,b)=>a+b,0)/period : null;
        let base = entry ?? closes[closes.length-1];
        if (!Number.isFinite(base as number) || atr == null || !(atr > 0)) { if (alive) setState({ stop: null, rMultiple: null }); return; }
        // Direction from target if provided; default long
        let dir: 1 | -1 = 1;
        if (target != null) dir = (target as number) >= (base as number) ? 1 : -1;
        // Dynamic stop multiplier from TA summary
        let ks = 1.2; // default
        try {
          const taR = await fetch(`/api/ta/${encodeURIComponent(t)}?tf=D`, { cache: 'no-store' });
          const taJ = await taR.json();
          const label = String(taJ?.summary || 'Neutral');
          if (label.includes('Strong Buy')) ks = 1.6;
          else if (label.includes('Buy')) ks = 1.4;
          else if (label.includes('Neutral')) ks = 1.2;
          else if (label.includes('Sell')) ks = 1.0;
          else if (label.includes('Strong Sell')) ks = 0.8;
        } catch {}
        let stop: number | null = null;
        if (dir === 1) stop = (base as number) - ks * atr; else stop = (base as number) + ks * atr;
        // R multiple to user target if provided
        let rMultiple: number | null = null;
        if (target != null && Number.isFinite(stop)) {
          if (dir === 1) {
            const risk = (base as number) - (stop as number);
            const reward = (target as number) - (base as number);
            if (risk > 0) rMultiple = reward / risk;
          } else {
            const risk = (stop as number) - (base as number);
            const reward = (base as number) - (target as number);
            if (risk > 0) rMultiple = reward / risk;
          }
        }
        if (alive) setState({ stop, rMultiple });
      } catch { if (alive) setState({ stop: null, rMultiple: null }); }
    })();
    return () => { alive = false; };
  }, [t, entry, target]);

  return (
    <>
      <td className="p-2 border">{state?.stop == null ? '—' : state.stop.toFixed(2)}</td>
      <td className="p-2 border">{state?.rMultiple == null ? '—' : state.rMultiple.toFixed(2)}x</td>
    </>
  );
}

// Swing snapshot: TA summary + RS vs SPY + ATR%
function SwingBadge({ t }: { t: string }) {
  const [state, setState] = useState<{ summary?: string; score?: number; rsPct?: number | null; atrPct?: number | null } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // TA summary
        const taR = await fetch(`/api/ta/${encodeURIComponent(t)}?tf=D`, { cache: 'no-store' });
        const taJ = await taR.json();
        // RS and ATR from candles
        const [cd, spy] = await Promise.all([
          fetch(`/api/price/candles/${encodeURIComponent(t)}?res=D&days=60`, { cache: 'no-store' }).then(r=>r.json()).catch(()=>({})),
          fetch(`/api/price/candles/SPY?res=D&days=60`, { cache: 'no-store' }).then(r=>r.json()).catch(()=>({})),
        ]);
        let rsPct: number | null = null; let atrPct: number | null = null;
        if (Array.isArray(cd?.candles) && cd.candles.length >= 20 && Array.isArray(spy?.candles) && spy.candles.length >= 20) {
          const cT = cd.candles.map((k: any)=>Number(k.c)).filter((x:number)=>Number.isFinite(x));
          const cS = spy.candles.map((k: any)=>Number(k.c)).filter((x:number)=>Number.isFinite(x));
          const lastT = cT[cT.length-1]; const lastS = cS[cS.length-1];
          const t20 = cT[cT.length-21]; const s20 = cS[cS.length-21];
          if (Number.isFinite(lastT) && Number.isFinite(lastS) && Number.isFinite(t20) && Number.isFinite(s20) && t20>0 && s20>0) {
            const pctT = (lastT - t20)/t20*100; const pctS = (lastS - s20)/s20*100; rsPct = pctT - pctS;
          }
          // ATR(14)
          let atr = 0; const period = 14;
          const highs = cd.candles.map((k:any)=>Number(k.h));
          const lows = cd.candles.map((k:any)=>Number(k.l));
          const closes = cT;
          const TR: number[] = [];
          for (let i=1;i<highs.length;i++){
            const h=highs[i], l=lows[i], pc=closes[i-1];
            if ([h,l,pc].every(Number.isFinite)) {
              const tr = Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc));
              TR.push(tr);
            }
          }
          if (TR.length >= period) {
            const last14 = TR.slice(-period);
            atr = last14.reduce((a,b)=>a+b,0)/period;
            atrPct = lastT>0 ? (atr/lastT)*100 : null;
          }
        }
        if (alive) setState({ summary: taJ?.summary, score: taJ?.score, rsPct, atrPct });
      } catch { if (alive) setState(null); }
    })();
    return () => { alive = false; };
  }, [t]);

  if (!state) return <span className="text-xs text-gray-500">—</span>;
  const label = state.summary || 'Neutral';
  const color = label.includes('Buy') ? 'success' : label.includes('Sell') ? 'destructive' : 'muted';
  const parts: string[] = [];
  if (state.rsPct != null) parts.push(`RS20 ${state.rsPct>=0?'+':''}${state.rsPct.toFixed(1)}%`);
  if (state.atrPct != null) parts.push(`ATR ${state.atrPct.toFixed(1)}%`);
  const tip = `${label}  |  ${parts.join('  •  ')}`;
  return <span title={tip}><Badge variant={color as any}>{label}</Badge></span>;
}


export default function CallsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"open" | "closed" | "hits">("open");

  // OPEN
  const [rows, setRows] = useState<OpenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  // Pagination for OPEN
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 5;
  // Column widths (resizable headers)
  const defaultColW: Record<string, number> = {
    ticker: 120, entry: 90, target: 90, fairTarget: 110, targetFit: 110,
    fairEta: 90, etaDays: 90, stop: 110, rToTgt: 100, targetPct: 130,
    remainPct: 150, current: 120, momentum: 120, swing: 110, tech: 140, newsSent: 140, earningsPct: 110,
    flow: 170, entryStatus: 130, targetStatus: 130, buzz: 120, news: 120,
    openedAt: 140, analyst: 150
  };
  const [colW, setColW] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try { const s = localStorage.getItem('callsColW'); if (s) return { ...defaultColW, ...JSON.parse(s) }; } catch {}
    }
    return defaultColW;
  });
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('callsColW', JSON.stringify(colW)); }, [colW]);
  const startResize = (col: string, startX: number) => {
    const startWidth = colW[col] || 100;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      setColW((prev) => ({ ...prev, [col]: Math.max(60, startWidth + dx) }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // -------- Per-row chips (with client-side cache) --------
  const indicatorsCache = (globalThis as any).__nf_ind_cache || ((globalThis as any).__nf_ind_cache = new Map<string, { t: number; d: any }>());
  const newsCache = (globalThis as any).__nf_news_cache || ((globalThis as any).__nf_news_cache = new Map<string, { t: number; d: any }>());

  function TechChip({ t }: { t: string }) {
    const [d, setD] = useState<any | null>(null);
    const [err, setErr] = useState<string | null>(null);
    useEffect(() => {
      let alive = true;
      const key = t.toUpperCase();
      const now = Date.now();
      const hit = indicatorsCache.get(key);
      const ttl = 15_000; // 15s cache
      if (hit && now - hit.t < ttl) { setD(hit.d); return; }
      (async () => {
        try {
          const r = await fetch(`/api/ta/indicators/${encodeURIComponent(t)}`, { cache: 'no-store' });
          const j = await r.json();
          if (!alive) return;
          if (r.ok) { indicatorsCache.set(key, { t: now, d: j }); setD(j); }
          else setErr(j?.error || 'failed');
        } catch (e: any) { if (alive) setErr(e?.message || 'failed'); }
      })();
      return () => { alive = false; };
    }, [t]);
    if (err) return <span className="text-xs text-gray-500">—</span>;
    if (!d) return <span className="text-xs text-gray-400">…</span>;
    const rsi = d.rsi7 != null ? Number(d.rsi7).toFixed(0) : '—';
    const macdUp = d.macdSlope3 != null ? Number(d.macdSlope3) > 0 : (d.macdHist != null ? Number(d.macdHist) > 0 : false);
    const macd = macdUp ? '↑' : '↓';
    const emaAlign = d.emaAligned ? '20>50' : '20<50';
    const tip = `RSI7: ${d.rsi7?.toFixed?.(1) ?? '-'}  |  MACD slope3: ${d.macdSlope3?.toFixed?.(4) ?? '-'}  |  EMA align: ${emaAlign}`;
    return <span className="text-xs" title={tip}>RSI {rsi} • MACD {macd} • {emaAlign}</span>;
  }

  function NewsChip({ t }: { t: string }) {
    const [d, setD] = useState<any | null>(null);
    const [err, setErr] = useState<string | null>(null);
    useEffect(() => {
      let alive = true;
      const key = t.toUpperCase();
      const now = Date.now();
      const hit = newsCache.get(key);
      const ttl = 300_000; // 5m cache for news
      if (hit && now - hit.t < ttl) { setD(hit.d); return; }
      (async () => {
        try {
          const r = await fetch(`/api/news-sentiment/${encodeURIComponent(t)}`, { cache: 'no-store' });
          const j = await r.json();
          if (!alive) return;
          if (r.ok) { newsCache.set(key, { t: now, d: j }); setD(j); }
          else setErr(j?.error || 'failed');
        } catch (e: any) { if (alive) setErr(e?.message || 'failed'); }
      })();
      return () => { alive = false; };
    }, [t]);
    if (err) return <span className="text-xs text-gray-500">—</span>;
    if (!d) return <span className="text-xs text-gray-400">…</span>;
    const agg = Number(d.aggregate ?? 0);
    const label = agg > 0.2 ? 'Bullish' : agg < -0.2 ? 'Bearish' : 'Neutral';
    const color = label === 'Bullish' ? 'text-green-600' : label === 'Bearish' ? 'text-red-600' : 'text-gray-700';
    const items = Array.isArray(d.items) ? d.items.slice(0,3) : [];
    const tip = items.map((k:any)=>`${k.score>=0?'+':''}${(k.score||0).toFixed(2)}  ${k.title}`).join('\n');
    return <span className={`text-xs ${color}`} title={tip}>{label}</span>;
  }
  // SEARCH
  const [query, setQuery] = useState("");
  const [searchTicker, setSearchTicker] = useState<string>("");
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Debounce ticker search input
  useEffect(() => {
    const handler = setTimeout(() => {
      const q = query.trim().toUpperCase();
      setSearchTicker(q);
    }, 400);
    return () => clearTimeout(handler);
  }, [query]);

  // Reset to first page when search filter changes
  useEffect(() => { setPage(1); }, [searchTicker]);

  // CLOSED
  const [closedRows, setClosedRows] = useState<ClosedCallNorm[]>([]);
  const [closedLoading, setClosedLoading] = useState(true);
  const [closedErr, setClosedErr] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [intervalSec, setIntervalSec] = useState<number>(15);
  const [momentumRefreshKey, setMomentumRefreshKey] = useState(0);
  // HITS (recent target hits)
  const [hitsRows, setHitsRows] = useState<ClosedCallNorm[]>([]);
  const [hitsLoading, setHitsLoading] = useState(false);
  const [hitsErr, setHitsErr] = useState("");
  // Trade-ideas sorting (per current 5 rows only)
  const [sortMode, setSortMode] = useState<'none' | 'idea'>('none');
  const [ideaScores, setIdeaScores] = useState<Record<string, number>>({});
  const [ideaLoading, setIdeaLoading] = useState(false);

  // ========== OPEN: initial load ==========
  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // Use unique-open-calls endpoint with pagination (5 per page)
        const url = `/api/open-calls/unique?limit=${pageSize}&page=${page}${searchTicker ? `&ticker=${encodeURIComponent(searchTicker)}` : ""}`;
        const rs = await fetch(url, { cache: "no-store" });
        const js = await rs.json();
        if (!rs.ok) throw new Error(js.error || "Failed to load open calls");
        const itemsArr: OpenCall[] = Array.isArray(js?.items) ? js.items : [];
        const mapped = itemsArr.map((call) => ({
          id: String(call.stock_id ?? ""),
          ticker: String(call.ticker ?? ""),
          entry: toNum(call.entry),
          target: toNum(call.t1),
          current: null,
          openedAt: call.opened_at ?? null,
          openedBy: call.opened_by ?? null,
          openedById: call.opened_by_id ?? null,
        } as OpenRow)).filter((r) => r.id && r.ticker);
        setRows(mapped);
        setHasMore(Boolean(js?.hasMore));
        setSortMode('none'); // reset sort on new page/filter
        // Fetch prices in small batches without blocking UI
        (async () => {
          const tickers = mapped.map((r) => r.ticker);
          const batchSize = 6;
          for (let i = 0; i < tickers.length; i += batchSize) {
            if (canceled) break;
            const batch = tickers.slice(i, i + batchSize);
            const prices = await Promise.all(batch.map((t) => fetchPrice(t)));
            if (canceled) break;
            setRows((prev) => prev.map((row) => {
              const idx = batch.indexOf(row.ticker);
              return idx >= 0 ? { ...row, current: prices[idx] ?? row.current } : row;
            }));
            await sleep(0);
          }
        })();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to load";
        setErr(message);
      } finally {
        setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [searchTicker, page]);

  // Manual/On-demand price refreshers
  const refreshOpenPrices = useCallback(async () => {
    if (rows.length === 0) return;
    const tickers = rows.map((r) => r.ticker);
    const batchSize = 8;
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      const updates = await Promise.all(batch.map((t) => fetchPrice(t)));
      setRows((prev) => prev.map((row) => {
        const idx = batch.indexOf(row.ticker);
        return idx >= 0 ? { ...row, current: updates[idx] ?? row.current } : row;
      }));
      await sleep(0);
    }
  }, [rows]);

  // Compute "Buy Now" idea scores for current 5 rows only
  const computeIdeaScores = useCallback(async () => {
    if (!rows.length) return;
    setIdeaLoading(true);
    try {
      const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
      const normRVOL = (rv: number | null) => {
        if (rv == null || !Number.isFinite(rv)) return 0;
        return clamp(rv, 0, 5) / 5 * 100; // 0..5x -> 0..100
      };
      const normVWAP = (distPct: number | null) => {
        if (distPct == null || !Number.isFinite(distPct)) return 50; // neutral
        const cl = clamp(distPct, -2, 2); // −2%..+2%
        return ((cl + 2) / 4) * 100; // map to 0..100 with 50 neutral
      };

      const calcRVOL = async (t: string) => {
        const d = await fetchCandles(t, 'D', 21);
        const vols = d.map((x:any)=>Number(x.v || 0)).filter((x:number)=>Number.isFinite(x) && x>0);
        if (!vols.length) return null;
        const todayVol = vols[vols.length - 1];
        const avgVol = vols.length > 1 ? vols.slice(-11, -1).reduce((a:number,b:number)=>a+b,0) / Math.max(1, Math.min(10, vols.length-1)) : null;
        return avgVol && todayVol ? (todayVol / avgVol) : null;
      };
      const calcVWAPDist = async (t: string) => {
        const m = await fetchCandles(t, '1', 1);
        if (!m || !m.length) return null;
        let volSum=0, pvSum=0;
        for (const k of m) {
          const typical = (Number(k.h)+Number(k.l)+Number(k.c))/3;
          const v = Number(k.v || 0);
          if (!Number.isFinite(typical) || !Number.isFinite(v)) continue;
          pvSum += typical * v; volSum += v;
        }
        const vwap = volSum>0 ? pvSum/volSum : null;
        const last = m[m.length-1]?.c;
        if (vwap == null || !Number.isFinite(last)) return null;
        return ((Number(last) - vwap) / vwap) * 100;
      };
      const calcBuyPct = async (t: string) => {
        try {
          const r = await fetch(`/api/price/flow/${encodeURIComponent(t)}?window=5m`, { cache: 'no-store' });
          const j = await r.json();
          const buy = Number(j?.buyVol || 0);
          const sell = Number(j?.sellVol || 0);
          const total = buy + sell;
          return total>0 ? (buy/total)*100 : 0;
        } catch { return 0; }
      };

      // Parallel per-ticker fetches for current 5
      const tickers = rows.map(r=>r.ticker);
      const [buyPcts, rvols, vwapDists, techs] = await Promise.all([
        Promise.all(tickers.map(calcBuyPct)),
        Promise.all(tickers.map(calcRVOL)),
        Promise.all(tickers.map(calcVWAPDist)),
        Promise.all(tickers.map(async (t)=>{
          try {
            const r = await fetch(`/api/ta/indicators/${encodeURIComponent(t)}`, { cache: 'no-store' });
            const j = await r.json();
            return r.ok ? j : null;
          } catch { return null; }
        })),
      ]);

      const scores: Record<string, number> = {};
      rows.forEach((row, i) => {
        const buy = buyPcts[i] ?? 0;            // 0..100
        const rvn = normRVOL(rvols[i] ?? null); // 0..100
        const vwn = normVWAP(vwapDists[i] ?? null); // 0..100
        const remainingPct = row.current != null && row.current > 0 && row.target != null ? ((row.target - row.current) / row.current) * 100 : null;
        const upside = remainingPct != null ? clamp(remainingPct, 0, 10) : 0; // 0..10
        const aboveEntry = row.entry != null && row.current != null && row.current >= row.entry ? 5 : 0; // small boost
        const tech = techs[i] || {};
        const rsi7 = Number(tech?.rsi7 ?? NaN);
        const macdSlope3 = Number(tech?.macdSlope3 ?? NaN);
        const emaAligned = tech?.emaAligned ? 1 : 0;
        const aboveEma20 = tech?.aboveEma20 ? 1 : 0;
        const normRSI7 = Number.isFinite(rsi7) ? clamp(((rsi7 - 40) / 30) * 100, 0, 100) : 50;
        const macdBonus = Number.isFinite(macdSlope3) && macdSlope3 > 0 ? 5 : 0;
        const emaBonus = emaAligned && aboveEma20 ? 5 : 0;
        const score = 0.4*buy + 0.25*rvn + 0.2*vwn + 0.1*normRSI7 + macdBonus + emaBonus + upside + aboveEntry;
        scores[row.id] = score;
      });
      setIdeaScores(scores);
      setSortMode('idea');
    } finally { setIdeaLoading(false); }
  }, [rows]);

  // No row expansion; columns are resizable instead

  // ========== CLOSED: load + normalize (mount + 60s)
  const loadClosed = useCallback(async (alive: boolean, tickerFilter: string) => {
    setClosedLoading(true);
    setClosedErr('');
    try {
      const url = `/api/calls?status=closed${tickerFilter ? `&ticker=${encodeURIComponent(tickerFilter)}` : ''}`;
      const rs = await fetch(url, { cache: 'no-store' });
      const js = await rs.json();
      if (!rs.ok) throw new Error('Failed to load closed calls');
      const calls: ClosedCall[] = Array.isArray(js) ? js : [];
      const normalizedRows: ClosedCallNorm[] = await Promise.all(calls.map(async (c) => {
        const entry = toNum(c.entry ?? c.entry_price);
        const exit = toNum(c.exit ?? c.close ?? c.closed_price ?? c.exit_price);
        const target = toNum(c.t1 ?? c.target ?? c.target_price);
        const stop = toNum(c.stop ?? c.stop_loss);
        const current_price = null;
        const result_pct =
          c.result_pct != null
            ? toNum(c.result_pct)
            : entry != null && entry > 0 && exit != null
            ? ((exit - entry) / entry) * 100
            : null;
        return {
          id: String(c.id),
          ticker: c.ticker,
          stock_id: c.stock_id ?? null,
          type: c.type ?? null,
          entry_price: entry,
          target_price: target,
          stop_loss: stop,
          opened_at: c.opened_at ?? null,
          closed_at: c.closed_at ?? null,
          outcome: c.outcome ?? null,
          note: c.note ?? null,
          result_pct,
          current_price: current_price,
          opened_by: c.opened_by ?? null,
        };
      }));
      normalizedRows.sort((a, b) => (b.closed_at ?? '').localeCompare(a.closed_at ?? ''));
      if (alive) setClosedRows(normalizedRows);
      // fetch prices in background batches
      if (alive) {
        let canceled = false;
        (async () => {
          const tickers = normalizedRows.map((r) => r.ticker);
          const batchSize = 6;
          for (let i = 0; i < tickers.length; i += batchSize) {
            if (!alive || canceled) break;
            const batch = tickers.slice(i, i + batchSize);
            const prices = await Promise.all(batch.map((t) => fetchPrice(t)));
            if (!alive || canceled) break;
            setClosedRows((prev) => prev.map((row) => {
              const idx = batch.indexOf(row.ticker);
              return idx >= 0 ? { ...row, current_price: prices[idx] ?? row.current_price } : row;
            }));
            await sleep(0);
          }
        })();
        // no separate cleanup needed; alive is captured from outer scope
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load closed calls";
      if (alive) setClosedErr(message);
    } finally {
      if (alive) setClosedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== 'closed') return;
    let alive = true;
    loadClosed(alive, searchTicker);
    const id = setInterval(() => loadClosed(alive, searchTicker), 60000);
    return () => { alive = false; clearInterval(id); };
  }, [loadClosed, searchTicker, tab]);

  // ========== HITS: load when tab active ==========
  useEffect(() => {
    if (tab !== 'hits') return;
    let alive = true;
    (async () => {
      setHitsLoading(true); setHitsErr("");
      try {
        const url = `/api/calls?status=closed&outcome=target_hit&limit=50&page=1${searchTicker ? `&ticker=${encodeURIComponent(searchTicker)}` : ''}`;
        const rs = await fetch(url, { cache: 'no-store' });
        const js = await rs.json();
        if (!rs.ok) throw new Error(js?.error || 'Failed to load hits');
        const calls: ClosedCall[] = Array.isArray(js) ? js : [];
        const normalized: ClosedCallNorm[] = calls.map((c) => ({
          id: String(c.id),
          ticker: c.ticker,
          stock_id: c.stock_id ?? null,
          type: c.type ?? null,
          entry_price: toNum(c.entry ?? c.entry_price),
          target_price: toNum(c.t1 ?? c.target ?? c.target_price),
          stop_loss: toNum(c.stop ?? c.stop_loss),
          opened_at: c.opened_at ?? null,
          closed_at: c.closed_at ?? null,
          outcome: c.outcome ?? null,
          note: c.note ?? null,
          result_pct: toNum(c.result_pct),
          current_price: null,
          opened_by: c.opened_by ?? null,
          opened_by_id: c.opened_by_id ?? null,
        }));
        // Sort by closed_at desc
        normalized.sort((a,b)=> (b.closed_at||'').localeCompare(a.closed_at||''));
        if (alive) setHitsRows(normalized);
      } catch (e: any) { if (alive) setHitsErr(e?.message || 'Failed to load hits'); }
      finally { if (alive) setHitsLoading(false); }
    })();
    return () => { alive = false; };
  }, [tab, searchTicker]);

  const refreshClosedPrices = useCallback(async () => {
    if (closedRows.length === 0) return;
    const tickers = closedRows.map((r) => r.ticker);
    const updates = await Promise.all(tickers.map((t) => fetchPrice(t)));
    setClosedRows((prev) => prev.map((row, i) => ({ ...row, current_price: updates[i] ?? row.current_price })));
  }, [closedRows]);

  // Single button to refresh prices on demand
  const handleRefreshPrices = useCallback(async () => {
    setRefreshing(true);
    try {
      if (tab === 'open') {
        await refreshOpenPrices();
      } else if (tab === 'closed') {
        await refreshClosedPrices();
      }
    } finally {
      setRefreshing(false);
    }
  }, [refreshOpenPrices, refreshClosedPrices, tab]);

  // Optional auto-refresh timer controlled by UI
  useEffect(() => {
    if (!autoRefresh) return;
    const ms = Math.max(5, Number(intervalSec) || 15) * 1000;
    const id = setInterval(() => {
      handleRefreshPrices();
      if (tab === 'open') setMomentumRefreshKey((k) => k + 1);
    }, ms);
    return () => clearInterval(id);
  }, [autoRefresh, intervalSec, handleRefreshPrices, tab]);

  // ========== UI ==========
  const openEmpty = !loading && !err && rows.length === 0;
  const closedEmpty = !closedLoading && !closedErr && closedRows.length === 0;

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Toolbar */}
      {/* Row 1: Title + Actions (separate layer) */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Calls</h1>
        <div className="flex gap-3">
          <Link href="/stocks" className="px-3 py-2 btn-outline-brand">📃 List Stocks</Link>
          {(user?.role === 'admin' || user?.role === 'analyst') && (
            <Link href="/admin/quick-open-call" className="px-3 py-2 btn-outline-brand">⚡ Quick Call</Link>
          )}
          {(user?.role === 'admin' || user?.role === 'analyst') && (
            <Link href="/admin/bulk-quick-calls" className="px-3 py-2 btn-outline-brand">📥 Bulk Quick Calls</Link>
          )}
          {(user?.role === 'admin' || user?.role === 'analyst') && (
            <Link href="/stocks/new" className="px-3 py-2 btn-brand hover:opacity-95">New Stock</Link>
          )}
        </div>
      </div>

      {/* Row 2: Tabs + Search + Auto refresh */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded border overflow-hidden">
            <button
              className={`px-3 py-1 text-sm ${tab === "open" ? "tab-active" : "bg-white"}`}
              onClick={() => setTab("open")}
            >
              Open
            </button>
            <button
              className={`px-3 py-1 text-sm ${tab === "closed" ? "tab-active" : "bg-white"}`}
              onClick={() => setTab("closed")}
            >
              Closed
            </button>
            <button
              className={`px-3 py-1 text-sm ${tab === "hits" ? "tab-active" : "bg-white"}`}
              onClick={() => setTab("hits")}
            >
              Hits
            </button>
          </div>
          <form
            className="ml-2 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchTicker(query.trim().toUpperCase());
            }}
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by ticker (e.g., AAPL)"
              className="w-48"
              inputMode="text"
              autoCorrect="off"
              autoCapitalize="characters"
            />
            <Button type="submit" variant="outline" size="sm">Search</Button>
            <div className="ml-2 inline-flex items-center gap-2 text-sm">
              <span className="hidden sm:inline">Auto</span>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            </div>
            <div className="inline-flex items-center gap-1 text-sm">
              <span>every</span>
              <Input
                type="number"
                className="w-20"
                min={5}
                value={intervalSec}
                onChange={(e) => setIntervalSec(Math.max(5, Number(e.target.value) || 15))}
                disabled={!autoRefresh}
              />
              <span>sec</span>
            </div>
            {searchTicker && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setQuery(""); setSearchTicker(""); }}
              >
                Clear
              </Button>
            )}
          </form>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={computeIdeaScores} disabled={ideaLoading || rows.length === 0}>
            {ideaLoading ? 'Scoring…' : 'Sort: Buy Now'}
          </Button>
          {sortMode === 'idea' && (
            <Button variant="outline" size="sm" onClick={() => setSortMode('none')}>Clear Sort</Button>
          )}
        </div>
      </div>

      {/* OPEN TAB */}
      {tab === "open" && (
        <>
          {loading && <p className="p-2">Loading…</p>}
          {err && <p className="p-2 text-red-500">{err}</p>}
          {openEmpty && <p className="p-2">No open calls.</p>}
          {!loading && !err && rows.length > 0 && (
            <div className="nf-table-wrap overflow-x-auto rounded">
              <table className="nf-table text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border relative" style={{ width: colW.ticker }}>
                      Stock Ticker
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('ticker', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.entry }}>
                      Entry
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('entry', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.target }}>
                      Target
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('target', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.fairTarget }}>
                      Fair Target
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('fairTarget', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.targetFit }}>
                      Target Fit
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('targetFit', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.fairEta }}>
                      Fair ETA
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('fairEta', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.etaDays }}>
                      ETA Days
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('etaDays', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.stop }}>
                      Sugg Stop
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('stop', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.rToTgt }}>
                      R to Tgt
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('rToTgt', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.targetPct }}>
                      Target % (vs Entry)
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('targetPct', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.remainPct }} title="(target - current) / current * 100">
                      Remain % (vs Current)
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('remainPct', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.current }}>
                      Current Price
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('current', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.momentum }}>
                      5m Momentum
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('momentum', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.swing }}>
                      Swing
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('swing', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.tech }}>
                      Tech
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('tech', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.newsSent }}>
                      News Sent.
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('newsSent', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.earningsPct }}>
                      Earnings %
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('earningsPct', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.flow }}>
                      Flow/RVOL/VWAP
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('flow', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.entryStatus }}>
                      Entry Status
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('entryStatus', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.targetStatus }}>
                      Target Status
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('targetStatus', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.buzz }}>
                      Latest Buzz
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('buzz', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.news }}>
                      Latest News
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('news', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.openedAt }}>
                      Entry Date
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('openedAt', e.clientX)} />
                    </th>
                    <th className="p-2 border relative" style={{ width: colW.analyst }}>
                      Analyst
                      <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e)=>startResize('analyst', e.clientX)} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(sortMode === 'idea' ? [...rows].sort((a,b) => (ideaScores[b.id] ?? -1) - (ideaScores[a.id] ?? -1)) : rows)
                    .map(({ id, ticker, entry, target, current, openedAt, openedBy, openedById }) => {
                    const targetPct =
                      entry != null && entry > 0 && target != null ? ((target - entry) / entry) * 100 : null;
                    // Remaining upside from CURRENT price (more intuitive for entry/hold decisions)
                    const remainingPct =
                      current != null && current > 0 && target != null ? ((target - current) / current) * 100 : null;
                    const earningsPct =
                      entry != null && entry > 0 && current != null ? ((current - entry) / entry) * 100 : null;

                    const entryStatus =
                      entry != null && current != null ? (current >= entry ? "✅ Above Entry" : "❌ Below Entry") : "—";
                    const targetStatus = (() => {
                      if (target == null || current == null) return "—";
                      if (target === 0) return "—";
                      const diffPct = ((current - target) / target) * 100;
                      if (Math.abs(diffPct) < 0.5) return "✅ Near Target";
                      return diffPct >= 0 ? "✅ At/Above Target" : "⬇️ Below Target";
                    })();
                    const targetClass = (() => {
                      if (target == null || current == null || target === 0) return "";
                      if (current >= target) return "text-green-600 font-medium";
                      // Below target
                      return "text-amber-600 font-medium";
                    })();

                    return (
                        <tr key={id} className="hover:bg-gray-50">
                          <td className="p-2 border font-medium"><Link href={`/stocks/${id}`} className="brand-link underline">{ticker}</Link></td>
                          <td className="p-2 border">{fmt(entry)}</td>
                          <td className="p-2 border">{fmt(target)}</td>
                          <FairTargetCell t={ticker} entry={entry} target={target} />
                          <FairEtaCell t={ticker} entry={entry} target={target} />
                          <EtaDaysCell t={ticker} current={current} entry={entry} target={target} />
                          <RiskCell t={ticker} entry={entry} target={target} />
                          <td className="p-2 border">{fmt(targetPct)}</td>
                          <td
                            className="p-2 border"
                            title={current != null && current > 0 && target != null ? `(( ${fmt(target)} - ${fmt(current)} ) / ${fmt(current)} ) * 100` : ''}
                          >
                            {fmt(remainingPct)}
                          </td>
                          <td className="p-2 border bg-brand-soft">{fmt(current)}</td>
                          <td className="p-2 border whitespace-nowrap"><Momentum5m t={ticker} refreshKey={momentumRefreshKey} /></td>
                          <td className="p-2 border whitespace-nowrap"><SwingBadge t={ticker} /></td>
                          <td className="p-2 border whitespace-nowrap"><TechChip t={ticker} /></td>
                          <td className="p-2 border whitespace-nowrap"><NewsChip t={ticker} /></td>
                          <td className={`p-2 border ${
                            earningsPct == null
                              ? ''
                              : earningsPct >= 0
                              ? 'bg-green-100 font-medium'
                              : 'bg-red-100 font-medium'
                          }`}>{fmt(earningsPct)}</td>
                          <td className="p-2 border"><RVOLVWAP t={ticker} /></td>
                          <td className="p-2 border whitespace-nowrap">{entryStatus}</td>
                          <td className={`p-2 border whitespace-nowrap ${targetClass}`}>{targetStatus}</td>
                          <td className="p-2 border">
                            <Buzz t={ticker} />
                          </td>
                          <td className="p-2 border">
                            <News t={ticker} />
                          </td>
                          <td className="p-2 border">{ymd(openedAt)}</td>
                          <td className="p-2 border whitespace-nowrap">
                            {openedById ? (
                              <Link href={`/analysts/${openedById}`} className="underline">{(openedBy ?? openedById).split('@')[0]}</Link>
                            ) : (
                              (openedBy ?? '-').split('@')[0]
                            )}
                          </td>
                        </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {/* Pagination controls */}
          {!loading && !err && rows.length > 0 && (
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-gray-600">Page {page}</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* CLOSED TAB */}
      {tab === "closed" && (
        <>
          {closedLoading && <p className="p-2">Loading…</p>}
          {closedErr && <p className="p-2 text-red-500">{closedErr}</p>}
          {closedEmpty && <p className="p-2">No closed calls.</p>}
          {!closedLoading && !closedErr && closedRows.length > 0 && (
            <div className="nf-table-wrap overflow-x-auto rounded">
              <table className="nf-table text-sm text-center">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border">Stock Ticker</th>
                    <th className="p-2 border">Analyst</th>
                    <th className="p-2 border">Entry</th>
                    <th className="p-2 border">Target</th>
                    <th className="p-2 border">Stop Loss</th>
                    <th className="p-2 border">Opened</th>
                    <th className="p-2 border">Closed</th>
                    <th className="p-2 border">Outcome</th>
                    <th className="p-2 border">Result %</th>
                    <th className="p-2 border">Current Price</th>
                    <th className="p-2 border">Trend</th>
                    <th className="p-2 border">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {closedRows.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="p-2 border font-medium">
                        <Link href={c.stock_id ? `/stocks/${c.stock_id}` : '#'} className="brand-link underline">{c.ticker}</Link>
                      </td>
                      <td className="p-2 border whitespace-nowrap">
                        {c.opened_by_id ? (
                          <Link href={`/analysts/${c.opened_by_id}`} className="underline">{c.opened_by ?? c.opened_by_id}</Link>
                        ) : (
                          c.opened_by ?? '-'
                        )}
                      </td>
                      <td className="p-2 border">{fnum(c.entry_price)}</td>
                      <td className="p-2 border">{fnum(c.target_price)}</td>
                      <td className="p-2 border">{fnum(c.stop_loss)}</td>
                      <td className="p-2 border">{fdate(c.opened_at)}</td>
                      <td className="p-2 border">{fdate(c.closed_at)}</td>
                      <td className="p-2 border">{c.outcome ?? "-"}</td>
                      <td className={`p-2 border ${
                        c.result_pct == null
                          ? ''
                          : (c.result_pct as number) >= 0
                          ? 'text-green-600 font-medium'
                          : 'text-red-600 font-medium'
                      }`}>{fnum(c.result_pct)}</td>
                      <td className="p-2 border">{fnum(c.current_price)}</td>
                      <td className="p-2 border">
                        <PriceSparkline ticker={c.ticker} width={120} height={36} />
                      </td>
                      <td className="p-2 border">{c.note ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* HITS TAB */}
      {tab === "hits" && (
        <>
          {hitsLoading && <p className="p-2">Loading…</p>}
          {hitsErr && <p className="p-2 text-red-500">{hitsErr}</p>}
          {!hitsLoading && !hitsErr && hitsRows.length === 0 && <p className="p-2">No hits found.</p>}
          {!hitsLoading && !hitsErr && hitsRows.length > 0 && (
            <div className="nf-table-wrap overflow-x-auto rounded">
              <table className="nf-table text-sm text-center">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border">Stock Ticker</th>
                    <th className="p-2 border">Analyst</th>
                    <th className="p-2 border">Entry</th>
                    <th className="p-2 border">Target</th>
                    <th className="p-2 border">Opened</th>
                    <th className="p-2 border">Closed</th>
                    <th className="p-2 border">Result %</th>
                    <th className="p-2 border">Hit</th>
                    <th className="p-2 border">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {hitsRows.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="p-2 border font-medium">
                        <Link href={c.stock_id ? `/stocks/${c.stock_id}` : '#'} className="brand-link underline">{c.ticker}</Link>
                      </td>
                      <td className="p-2 border whitespace-nowrap">{c.opened_by ?? '-'}</td>
                      <td className="p-2 border">{fnum(c.entry_price)}</td>
                      <td className="p-2 border">{fnum(c.target_price)}</td>
                      <td className="p-2 border">{fdate(c.opened_at)}</td>
                      <td className="p-2 border">{fdate(c.closed_at)}</td>
                      <td className={`p-2 border ${
                        c.result_pct == null ? '' : (c.result_pct as number) >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'
                      }`}>{fnum(c.result_pct)}</td>
                      <td className="p-2 border">Target</td>
                      <td className="p-2 border">{c.note ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
