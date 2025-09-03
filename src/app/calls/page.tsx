// src/app/calls/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/app/AuthContext";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const [state, setState] = useState<{ rvol?: number | null; vwap?: number | null; distPct?: number | null }>({});
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
      if (m && m.length) {
        let volSum = 0, pvSum = 0;
        for (const k of m) {
          const typical = (Number(k.h) + Number(k.l) + Number(k.c)) / 3;
          const v = Number(k.v || 0);
          if (!Number.isFinite(typical) || !Number.isFinite(v)) continue;
          pvSum += typical * v;
          volSum += v;
        }
        vwap = volSum > 0 ? pvSum / volSum : null;
      }
      let distPct: number | null = null;
      if (vwap != null) {
        const last = m?.[m.length - 1]?.c;
        if (Number.isFinite(last) && vwap > 0) distPct = ((Number(last) - vwap) / vwap) * 100;
      }
      if (alive) setState({ rvol, vwap, distPct });
    })();
    return () => { alive = false; };
  }, [t]);

  const rvolTxt = state.rvol == null ? '—' : state.rvol.toFixed(2) + 'x';
  const distTxt = state.distPct == null ? '—' : (state.distPct >= 0 ? '+' : '') + state.distPct.toFixed(2) + '%';
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div>
        <span className="text-gray-600">RVOL: </span>
        <span className="font-medium">{rvolTxt}</span>
      </div>
      <div>
        <span className="text-gray-600">VWAP Δ: </span>
        <span className={`${state.distPct == null ? '' : state.distPct >= 0 ? 'text-green-600' : 'text-red-600'} font-medium`}>{distTxt}</span>
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
        if (Number.isFinite(base)) {
          if (dir === 1) {
            const atrTargetUp = atr != null ? (base as number) + 2 * atr : null;
            fair = Math.max(atrTargetUp ?? 0, Number.isFinite(recentHigh) ? recentHigh : 0) || null;
          } else {
            const atrTargetDn = atr != null ? (base as number) - 2 * atr : null;
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
      <td className="p-2 border" title={state?.fairEta ? `Fair ETA: ${state.fairEta} days` : ''}>{fairTxt}</td>
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

  // CLOSED
  const [closedRows, setClosedRows] = useState<ClosedCallNorm[]>([]);
  const [closedLoading, setClosedLoading] = useState(true);
  const [closedErr, setClosedErr] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [intervalSec, setIntervalSec] = useState<number>(15);
  const [momentumRefreshKey, setMomentumRefreshKey] = useState(0);

  // ========== OPEN: initial load ==========
  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const url = `/api/calls?status=open${searchTicker ? `&ticker=${encodeURIComponent(searchTicker)}` : ""}`;
        const rs = await fetch(url, { cache: "no-store" });
        const js = await rs.json();
        if (!rs.ok) throw new Error(js.error || "Failed to load stocks");
        const calls: OpenCall[] = Array.isArray(js) ? js : [];

        const items = calls.map((call) => {
          if (!call.ticker) return null;
          return {
            id: call.stock_id as string,
            ticker: call.ticker as string,
            entry: toNum(call.entry),
            target: toNum(call.t1),
            current: null,
            openedAt: call.opened_at ?? null,
            openedBy: call.opened_by ?? null,
            openedById: call.opened_by_id ?? null,
          } as OpenRow;
        });

        // De-duplicate by stock id to avoid duplicate React keys when multiple open calls exist per stock
        const deduped = Array.from(
          new Map((items.filter(Boolean) as OpenRow[]).map((row) => [row.id, row]))
            .values()
        );
        setRows(deduped);
        // Fetch prices in small batches without blocking UI
        (async () => {
          const tickers = deduped.map((r) => r.ticker);
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
  }, [searchTicker]);

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
    let alive = true;
    loadClosed(alive, searchTicker);
    const id = setInterval(() => loadClosed(alive, searchTicker), 60000);
    return () => { alive = false; clearInterval(id); };
  }, [loadClosed, searchTicker]);

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
      await Promise.all([refreshOpenPrices(), refreshClosedPrices()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshOpenPrices, refreshClosedPrices]);

  // Optional auto-refresh timer controlled by UI
  useEffect(() => {
    if (!autoRefresh) return;
    const ms = Math.max(5, Number(intervalSec) || 15) * 1000;
    const id = setInterval(() => {
      handleRefreshPrices();
      setMomentumRefreshKey((k) => k + 1);
    }, ms);
    return () => clearInterval(id);
  }, [autoRefresh, intervalSec, handleRefreshPrices]);

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
                    <th className="p-2 border">Stock Ticker</th>
                    <th className="p-2 border">Analyst</th>
                    <th className="p-2 border">Entry</th>
                    <th className="p-2 border">Target</th>
                    <th className="p-2 border">Fair Target</th>
                    <th className="p-2 border">Target Fit</th>
                    <th className="p-2 border">ETA Days</th>
                    <th className="p-2 border">Target % (vs Entry)</th>
                    <th className="p-2 border">Remaining Gains %</th>
                    <th className="p-2 border">Current Price</th>
                    <th className="p-2 border">5m Momentum</th>
                    <th className="p-2 border">Swing</th>
                    <th className="p-2 border">Earnings %</th>
                    <th className="p-2 border">Flow/RVOL/VWAP</th>
                    <th className="p-2 border">Entry Status</th>
                    <th className="p-2 border">Target Status</th>
                    <th className="p-2 border">Latest Buzz</th>
                    <th className="p-2 border">Latest News</th>
                    <th className="p-2 border">Entry Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ id, ticker, entry, target, current, openedAt, openedBy, openedById }) => {
                    const targetPct =
                      entry != null && entry > 0 && target != null ? ((target - entry) / entry) * 100 : null;
                    const remainingPct =
                      current != null && target != null && target !== 0 ? ((target - current) / target) * 100 : null;
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
                        <td className="p-2 border whitespace-nowrap">
                          {openedById ? (
                            <Link href={`/analysts/${openedById}`} className="underline">{openedBy ?? openedById}</Link>
                          ) : (
                            openedBy ?? '-'
                          )}
                        </td>
                        <td className="p-2 border">{fmt(entry)}</td>
                        <td className="p-2 border">{fmt(target)}</td>
                        <FairTargetCell t={ticker} entry={entry} target={target} />
                        <EtaDaysCell t={ticker} current={current} entry={entry} target={target} />
                        <td className="p-2 border">{fmt(targetPct)}</td>
                        <td className="p-2 border">{fmt(remainingPct)}</td>
                        <td className="p-2 border">{fmt(current)}</td>
                        <td className="p-2 border whitespace-nowrap"><Momentum5m t={ticker} refreshKey={momentumRefreshKey} /></td>
                        <td className="p-2 border whitespace-nowrap"><SwingBadge t={ticker} /></td>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
    </div>
  );
}
