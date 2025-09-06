import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Candle = { t: number; o: number; h: number; l: number; c: number; v?: number };

async function candles(t: string, days: number): Promise<Candle[]> {
  const r = await fetch(`/api/price/candles/${encodeURIComponent(t)}?res=D&days=${days}`, { cache: 'no-store' });
  const j = await r.json();
  return Array.isArray(j?.candles) ? j.candles as Candle[] : [];
}

function atr14(h: number[], l: number[], c: number[], endIdx: number): number | null {
  const end = Math.min(endIdx, h.length - 1);
  const start = end - 14;
  if (start < 1) return null;
  let sum = 0; let cnt = 0;
  for (let i = start; i <= end; i++) {
    const tr = Math.max(h[i] - l[i], Math.abs(h[i] - c[i-1]), Math.abs(l[i] - c[i-1]));
    if (Number.isFinite(tr)) { sum += tr; cnt++; }
  }
  return cnt === 14 ? sum / 14 : null;
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  try {
    const b = await req.json().catch(()=>({}));
    const ticker = String(b?.ticker || '').trim().toUpperCase();
    const entryDateStr = b?.entryDate ? String(b.entryDate) : null;
    const entryDaysAgo = entryDateStr ? null : Math.max(1, Number(b?.entryDaysAgo || 20));
    const endDateStr = b?.endDate ? String(b.endDate) : null;
    const horizonDaysInput = Math.max(1, Number(b?.horizonDays || 10));
    const method = String(b?.method || 'atr_k'); // 'atr_k' | 'fair'
    const k = Number(b?.k ?? 1.5);
    let directionReq = String(b?.direction || 'up').toLowerCase();
    if (!['up','down','auto'].includes(directionReq)) directionReq = 'up';
    if (!ticker) return NextResponse.json({ error: 'ticker required', requestId }, { status: 400 });

    const needDays = endDateStr ? 400 : (entryDaysAgo ?? 0) + horizonDaysInput + 40;
    // Use absolute URL to avoid Node fetch URL parse issues
    const { origin } = new URL(req.url);
    const r = await fetch(`${origin}/api/price/candles/${encodeURIComponent(ticker)}?res=D&days=${Math.max(60, needDays)}`, { cache: 'no-store' });
    const j = await r.json();
    const rows: Candle[] = Array.isArray(j?.candles) ? j.candles as Candle[] : [];
    if (rows.length < 40) return NextResponse.json({ error: 'insufficient candles', requestId }, { status: 400 });
    const ts = rows.map(r=>Number(r.t));
    const o = rows.map(r=>Number(r.o));
    const h = rows.map(r=>Number(r.h));
    const l = rows.map(r=>Number(r.l));
    const c = rows.map(r=>Number(r.c));

    // Resolve entry index
    let entryIdx: number | null = null; let entryDateResolved: string | null = null;
    if (entryDateStr) {
      const tsTarget = new Date(entryDateStr).getTime();
      if (Number.isFinite(tsTarget)) {
        for (let i = 0; i < ts.length; i++) {
          if (ts[i] >= tsTarget) { entryIdx = i; break; }
        }
      }
    } else if (entryDaysAgo != null) {
      entryIdx = Math.max(0, ts.length - 1 - entryDaysAgo);
    }
    if (entryIdx == null || entryIdx < 1 || entryIdx >= ts.length) return NextResponse.json({ error: 'unable to resolve entry index', requestId }, { status: 400 });
    entryDateResolved = new Date(ts[entryIdx]).toISOString().slice(0,10);
    const entryPrice = c[entryIdx];

    // Predicted target
    let targetPred: number | null = null; let model = method;
    if (method === 'fair') {
      try {
        const rf = await fetch(`${origin}/api/valuation/fair/${encodeURIComponent(ticker)}`, { cache: 'no-store' });
        const jf = await rf.json();
        const fv = Number(jf?.fairValue);
        if (Number.isFinite(fv)) targetPred = fv;
      } catch {}
    }
    // Resolve direction if auto
    let directionUsed: 'up'|'down' = directionReq === 'down' ? 'down' : 'up';
    if (directionReq === 'auto') {
      try {
        const rd = await fetch(`${origin}/api/ta/${encodeURIComponent(ticker)}?tf=D`, { cache: 'no-store' });
        const rw = await fetch(`${origin}/api/ta/${encodeURIComponent(ticker)}?tf=W`, { cache: 'no-store' });
        const jd = await rd.json(); const jw = await rw.json();
        const sD = Number(jd?.score ?? 0); const sW = Number(jw?.score ?? 0);
        const blend = 0.7*sD + 0.3*sW;
        directionUsed = blend >= 1 ? 'up' : (blend <= -1 ? 'down' : 'up');
      } catch {}
    }

    if (targetPred == null) {
      model = 'atr_k';
      const atr = atr14(h, l, c, entryIdx);
      if (atr != null) targetPred = directionUsed === 'up' ? entryPrice + k*atr : entryPrice - k*atr;
      else targetPred = directionUsed === 'up' ? entryPrice * 1.05 : entryPrice * 0.95;
    }

    // Actual outcome after horizon
    let endIdx: number = Math.min(ts.length - 1, entryIdx + horizonDaysInput);
    if (endDateStr) {
      const tsEnd = new Date(endDateStr).getTime();
      if (Number.isFinite(tsEnd)) {
        for (let i = entryIdx; i < ts.length; i++) { if (ts[i] >= tsEnd) { endIdx = i; break; } }
      }
    }
    const actualPrice = c[endIdx];
    const absErr = targetPred != null ? Math.abs(actualPrice - targetPred) : null;
    const pctErr = targetPred != null && targetPred !== 0 ? (absErr as number)/Math.abs(targetPred) * 100 : null;

    // Within-horizon hit logic using path highs/lows (not just end close)
    const hi = Math.max(...h.slice(entryIdx + 1, endIdx + 1));
    const lo = Math.min(...l.slice(entryIdx + 1, endIdx + 1));
    const tolerancePct = Math.max(0, Number(b?.tolerancePct ?? 1)); // default 1%
    const tolUp = targetPred != null ? (targetPred as number) * (1 - tolerancePct/100) : Number.POSITIVE_INFINITY;
    const tolDn = targetPred != null ? (targetPred as number) * (1 + tolerancePct/100) : Number.NEGATIVE_INFINITY;
    const hitWithin = directionUsed === 'up'
      ? (targetPred != null ? hi >= tolUp : false)
      : (targetPred != null ? lo <= tolDn : false);

    // Max favorable/adverse excursion
    const mfe = directionUsed === 'up' ? (hi - entryPrice) : (entryPrice - lo);
    const mae = directionUsed === 'up' ? Math.max(0, entryPrice - lo) : Math.max(0, hi - entryPrice);

    const horizonTradingDays = endIdx - entryIdx;
    return NextResponse.json({ requestId, ticker, entryDate: entryDateResolved, entryIdx, horizonDays: horizonTradingDays, method: model, k, direction: directionReq==='auto'?`auto→${directionUsed}`:directionUsed, entryPrice, targetPred, actualPrice, absErr, pctErr, endDate: new Date(ts[endIdx]).toISOString().slice(0,10), hitWithin, mfe, mae, candlesUsed: rows.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed', requestId }, { status: 500 });
  }
}
