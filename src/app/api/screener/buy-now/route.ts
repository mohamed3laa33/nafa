import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { unstable_cache } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Item = {
  ticker: string;
  score: number;
  summary: string;
  last: number | null;
  fair?: number | null;
  fairEtaDays?: number | null;
  est10d?: number | null;
  macroAdj?: string | null;
  sector?: string | null;
  zScore?: number | null;
  // Diagnostics / confidence
  est10dLo1?: number | null;
  est10dHi1?: number | null;
  est10dLo2?: number | null;
  est10dHi2?: number | null;
  adv10?: number | null;
  daysTraded10?: number | null;
  atrPct?: number | null;
  dailyScore?: number | null;
  weeklyScore?: number | null;
  flow1hBuyPct?: number | null;
  flow1dBuyPct?: number | null;
  rvol1d?: number | null;
  rvol1w?: number | null;
  movingAverages?: { buy: number; sell: number };
  indicators?: { buy: number; sell: number; rsi: number | null; macdHist: number | null };
};

async function listTickers(sector: string | null, limit: number): Promise<Array<{ticker:string; sector:string|null}>> {
  const lim = Math.max(1, Math.floor(Number(limit) || 50));
  const base = "WHERE market='US'";
  const wantsSector = !!(sector && sector.trim());
  const sql = `SELECT ticker, ${wantsSector? 'sector' : 'NULL as sector'} FROM stocks ${wantsSector ? `${base} AND sector = ?` : base} ORDER BY updated_at DESC, ticker ASC LIMIT ${lim}`;
  const params: any[] = wantsSector ? [sector] : [];
  try {
    const [rows]: any = await pool.execute(sql, params);
    return rows.map((r: any) => ({ ticker: String(r.ticker).toUpperCase(), sector: r.sector ?? null }));
  } catch (e: any) {
    const msg = String(e?.message || e?.code || '');
    // Fallback if 'sector' column is missing (migration not applied yet)
    if (wantsSector && (msg.includes("Unknown column 'sector'") || msg.includes('ER_BAD_FIELD_ERROR'))) {
      try {
        const [rows]: any = await pool.execute(`SELECT ticker, NULL as sector FROM stocks ${base} ORDER BY updated_at DESC, ticker ASC LIMIT ${lim}`);
        return rows.map((r: any) => ({ ticker: String(r.ticker).toUpperCase(), sector: null }));
      } catch {
        const [rows]: any = await pool.execute(`SELECT ticker, NULL as sector FROM stocks ${base} ORDER BY ticker ASC LIMIT ${lim}`);
        return rows.map((r: any) => ({ ticker: String(r.ticker).toUpperCase(), sector: null }));
      }
    }
    throw e;
  }
}

// Basic macro calendar: upcoming FOMC dates (UTC) — extend as needed
const FOMC_2025 = [
  '2025-01-29', '2025-03-19', '2025-04-30', '2025-06-18', '2025-07-30', '2025-09-17', '2025-11-05', '2025-12-17'
];
function macroAdjForHorizon(days: number): { mult: number; note: string | null } {
  try {
    const now = new Date();
    const target = new Date(now.getTime() + days*86400000);
    const within = FOMC_2025.find(d => {
      const dt = new Date(d + 'T18:00:00Z');
      return dt >= now && dt <= target;
    });
    if (within) return { mult: 0.9, note: `FOMC near ${within}` };
  } catch {}
  return { mult: 1.0, note: null };
}

async function taSummary(ticker: string, origin: string): Promise<Item | null> {
  try {
    const r = await fetch(`${origin}/api/ta/${encodeURIComponent(ticker)}?tf=D`, { cache: 'no-store' });
    if (!r.ok) return null;
  const j = await r.json();
  const out: Item = {
    ticker,
    score: Number(j?.score ?? 0),
    dailyScore: Number(j?.score ?? 0),
    summary: String(j?.summary || 'Neutral'),
    last: Number.isFinite(j?.last) ? Number(j.last) : null,
    movingAverages: j?.movingAverages,
    indicators: j?.indicators,
  };
    // Weekly blend
    try {
      const rw = await fetch(`${origin}/api/ta/${encodeURIComponent(ticker)}?tf=W`, { cache: 'no-store' });
      if (rw.ok) {
        const jw = await rw.json();
        const scoreW = Number(jw?.score ?? 0); out.weeklyScore = scoreW;
        const scoreD = out.score;
        out.score = Math.round(0.7*scoreD + 0.3*scoreW);
        const breadth = Number(j?.breadth ?? 0);
        if (breadth < 3 && Math.abs(out.score) < 2) out.score = 0; // breadth gating guards weak signals
      }
    } catch {}

    // Fair value + 10d estimate with simple ATR-based projection and macro adjustment
    try {
      const vf = await fetch(`${origin}/api/valuation/fair/${encodeURIComponent(ticker)}`, { cache: 'no-store' });
      const vj = await vf.json();
      const fair = Number(vj?.fairValue);
      if (Number.isFinite(fair)) out.fair = fair;
    } catch {}
    try {
      const cd = await fetch(`${origin}/api/price/candles/${encodeURIComponent(ticker)}?res=D&days=60`, { cache: 'no-store' });
      const cj = await cd.json();
      const rows: any[] = Array.isArray(cj?.candles) ? cj.candles : [];
      if (rows.length >= 20) {
        const h = rows.map((k:any)=>Number(k.h));
        const l = rows.map((k:any)=>Number(k.l));
        const c = rows.map((k:any)=>Number(k.c));
        const v = rows.map((k:any)=>Number(k.v||0));
        // ATR14 simple
        const TR: number[] = []; for (let i=1;i<c.length;i++){ const tr = Math.max(h[i]-l[i], Math.abs(h[i]-c[i-1]), Math.abs(l[i]-c[i-1])); if (Number.isFinite(tr)) TR.push(tr); }
        const atr = TR.length>=14 ? TR.slice(-14).reduce((a,b)=>a+b,0)/14 : null;
        const last = out.last ?? (c.length? c[c.length-1]: null);
        if (atr != null && last != null) {
          out.atrPct = atr / Math.max(1e-9, last);
          if (out.fair != null) {
            const dist = Math.abs(out.fair - last);
            // volatility-adaptive: scale ETA by ATR% vs median ATR%
            const atrPct: number[] = []; for (let i=1;i<c.length;i++){ const v = TR[i-1] / Math.max(1e-9, c[i]); if (Number.isFinite(v)) atrPct.push(v); }
            const sorted = [...atrPct].sort((a,b)=>a-b);
            const median = sorted[Math.floor(sorted.length/2)] || 0.02;
            const curr = TR.length? TR[TR.length-1]/Math.max(1e-9,c[c.length-1]) : median;
            const scale = median>0 ? Math.min(1.5, Math.max(0.7, curr/median)) : 1.0;
            out.fairEtaDays = atr>0 ? Math.max(1, Math.ceil((dist / atr) * scale)) : null;
          }
          // 10d estimate: move k*atr with TA bias and macro adj
          const label = out.summary || '';
          const sectorBase: Record<string, number> = { 'Technology':1.8, 'Communication Services':1.7, 'Consumer Discretionary':1.6, 'Healthcare':1.5, 'Industrials':1.4, 'Financial Services':1.3, 'Energy':1.6, 'Materials':1.4, 'Real Estate':1.3, 'Utilities':1.2 };
          let baseK = 1.4; // default
          // sector injected later by caller via listTickers return; will adjust after we attach sector
          let k = baseK;
          const lastAtrPct = TR.length? TR[TR.length-1]/Math.max(1e-9,c[c.length-1]) : 0.02;
          const scoreFactor = label.includes('Strong Buy')?1.6: label.includes('Buy')?1.3: label.includes('Neutral')?1.0: label.includes('Sell')?0.8:0.6;
          const volFactor = Math.min(1.8, Math.max(0.8, lastAtrPct / (0.02)));
          k = baseK * scoreFactor * volFactor;
          const macro = macroAdjForHorizon(10);
          const dir = out.score >= 1 ? 1 : (out.score <= -1 ? -1 : 0);
          out.est10d = dir === 0 ? last : last + dir * k * atr * macro.mult;
          out.macroAdj = macro.note;
          const sigma = atr;
          out.est10dLo1 = out.est10d != null ? out.est10d - sigma : null;
          out.est10dHi1 = out.est10d != null ? out.est10d + sigma : null;
          out.est10dLo2 = out.est10d != null ? out.est10d - 2*sigma : null;
          out.est10dHi2 = out.est10d != null ? out.est10d + 2*sigma : null;
          // Earnings dampener
          try {
            const rq = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`, { cache: 'no-store', headers: { 'User-Agent':'nfaa-app/1.0', Accept:'application/json' } });
            if (rq.ok) {
              const qj = await rq.json(); const q = qj?.quoteResponse?.result?.[0];
              const et = Number(q?.earningsTimestamp || q?.earningsTimestampStart || 0) * 1000;
              if (Number.isFinite(et) && et>0) { const now=Date.now(); const in10 = now+10*86400000; if (et>=now && et<=in10) { out.est10d = out.est10d!=null? (out.est10d*0.85) : out.est10d; out.macroAdj = (out.macroAdj? out.macroAdj+'; ' : '')+`Earnings near ${new Date(et).toISOString().slice(0,10)}`; } }
            }
          } catch {}
        }

        // RVOL 1d & 1w
        try {
          if (v.length > 12) {
            const todayVol = v[v.length-1];
            const baseWindow = v.slice(-11, -1).filter(Number.isFinite);
            const sorted = [...baseWindow].sort((a,b)=>a-b);
            const med = sorted[Math.floor(sorted.length/2)] || 0;
            out.rvol1d = med>0 ? todayVol/med : null;
            // 1w sum vs rolling weekly med
            const last5 = v.slice(-5).reduce((a,b)=>a+(Number.isFinite(b)?b:0),0);
            const weeklySums: number[] = [];
            for (let i=10;i>=5;i-=5) { const sum = v.slice(-(i+5), -i).reduce((a,b)=>a+(Number.isFinite(b)?b:0),0); if (sum>0) weeklySums.push(sum); }
            const wSorted = weeklySums.sort((a,b)=>a-b);
            const wMed = wSorted[Math.floor(wSorted.length/2)] || 0;
            out.rvol1w = wMed>0 ? last5/wMed : null;
          }
        } catch {}
      }
    } catch {}

    // Flow snapshots (1h, 1d)
    try {
      const [f1, fD] = await Promise.all([
        fetch(`${origin}/api/price/flow/${encodeURIComponent(ticker)}?window=1h`, { cache: 'no-store' }),
        fetch(`${origin}/api/price/flow/${encodeURIComponent(ticker)}?window=1d`, { cache: 'no-store' }),
      ]);
      const j1 = await f1.json().catch(()=>({}));
      const jD = await fD.json().catch(()=>({}));
      if (f1.ok && typeof j1?.buyPct === 'number') out.flow1hBuyPct = Number(j1.buyPct);
      if (fD.ok && typeof jD?.buyPct === 'number') out.flow1dBuyPct = Number(jD.buyPct);
    } catch {}

    return out;
  } catch { return null; }
}

function limitConcurrency<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length) as any;
  let i = 0; let active = 0;
  return new Promise((resolve) => {
    const next = () => {
      if (i >= items.length && active === 0) return resolve(results);
      while (active < limit && i < items.length) {
        const idx = i++; active++;
        fn(items[idx]).then((res) => { results[idx] = res; }).catch(()=>{}).finally(()=>{ active--; next(); });
      }
    };
    next();
  });
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const sector = (searchParams.get('sector') || '').trim() || null;
  const limit = Math.min(200, Math.max(10, Number(searchParams.get('limit') || 100)));
  const top = Math.min(100, Math.max(5, Number(searchParams.get('top') || 25)));

  const cacheKey = JSON.stringify({ sector, limit, top });
  const run = unstable_cache(
    async () => {
      const pairs = await listTickers(sector, limit);
      if (!pairs.length) return [] as Item[];
      const rows = await limitConcurrency(pairs, 4, (p) => taSummary(p.ticker, origin));
      // Attach sector, liquidity filter, and sector z-score
      const enriched: Item[] = [];
      for (let i=0;i<rows.length;i++) {
        const it = rows[i] as Item | null; const sec = pairs[i]?.sector ?? null;
        if (!it) continue; it.sector = sec;
        // Liquidity filter: min avg $ volume over 10d
        try {
          const rc = await fetch(`${origin}/api/price/candles/${encodeURIComponent(it.ticker)}?res=D&days=15`, { cache: 'no-store' });
          const cj = await rc.json(); const cds = Array.isArray(cj?.candles)? cj.candles: [];
          if (cds.length>=11) {
            const dollars: number[] = [];
            for (let k=cds.length-11;k<cds.length-1;k++){
              const c=Number(cds[k].c), v=Number(cds[k].v||0);
              if (Number.isFinite(c)&&Number.isFinite(v)) dollars.push(c*v);
            }
            const daysTraded = dollars.length; if (daysTraded < 8) continue;
            dollars.sort((a,b)=>a-b); const adv = dollars[Math.floor(dollars.length/2)] || 0;
            it.adv10 = adv; it.daysTraded10 = daysTraded;
            if (adv < 5_000_000) continue; // skip illiquid
          }
        } catch {}
        // Flow/RVOL scoring bump (bounded)
        try {
          const flow1h = Number(it.flow1hBuyPct ?? NaN);
          const flow1d = Number(it.flow1dBuyPct ?? NaN);
          const rvol = Number(it.rvol1d ?? NaN);
          const weekly = Number(it.weeklyScore ?? 0);
          if (Number.isFinite(flow1h) && Number.isFinite(flow1d)) {
            let bias = ((flow1h - 50) + (flow1d - 50)) / 100; // −1..+1 approx
            bias = Math.max(-1, Math.min(1, bias));
            const volWeight = Number.isFinite(rvol) ? (rvol >= 2 ? 1.0 : rvol >= 1.2 ? 0.7 : 0.4) : 0.4;
            // guard with weekly trend
            if (bias > 0 && weekly < 0) bias = 0; if (bias < 0 && weekly > 0) bias = 0;
            it.score = Math.round(it.score + volWeight * bias);
          }
          if (Number.isFinite(rvol)) {
            if (rvol >= 2.0) it.score += 1; else if (rvol >= 1.5) it.score += 0.5; else if (rvol <= 0.7) it.score -= 0.5;
          }
        } catch {}
        enriched.push(it);
      }
      if (!enriched.length) return [] as Item[];
      // Z-score within sector (fallback ALL)
      const bySec: Record<string, Item[]> = {};
      for (const it of enriched) { const key = it.sector || 'ALL'; (bySec[key] ||= []).push(it); }
      for (const key of Object.keys(bySec)) {
        const arr = bySec[key];
        if (arr.length < 8) { for (const it of arr) it.zScore = it.score ?? 0; continue; }
        const vals = arr.map(x=>x.score||0).sort((a,b)=>a-b);
        const med = vals[Math.floor(vals.length/2)];
        const devs = vals.map(v=>Math.abs(v-med)).sort((a,b)=>a-b);
        const mad = devs[Math.floor(devs.length/2)] || 1e-6;
        const sigma = 1.4826 * mad || 1;
        for (const it of arr) {
          const z = ((it.score||0) - med) / sigma; it.zScore = Math.max(-3.5, Math.min(3.5, z));
        }
      }
      // Deterministic tie-break: z desc, liquidity desc, ticker asc
      enriched.sort((a,b)=> (b.zScore ?? 0) - (a.zScore ?? 0) || (b.adv10 ?? 0) - (a.adv10 ?? 0) || a.ticker.localeCompare(b.ticker));
      return enriched.slice(0, top);
    },
    ["screener:buy-now", cacheKey],
    { revalidate: 60 }
  );

  try {
    const items = await run();
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
