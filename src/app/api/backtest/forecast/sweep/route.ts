import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Candle = { t: number; o: number; h: number; l: number; c: number; v?: number };

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
    const horizonDays = Math.max(1, Number(b?.horizonDays || 10));
    const method = String(b?.method || 'atr_k'); // 'atr_k' | 'fair'
    const k = Number(b?.k ?? 1.5);
    let directionReq = String(b?.direction || 'up').toLowerCase();
    if (!['up','down','auto'].includes(directionReq)) directionReq = 'up';
    const startDaysAgo = Math.max(20, Number(b?.startDaysAgo || 120));
    const endDaysAgo = Math.max(1, Number(b?.endDaysAgo || 20));
    const step = Math.max(1, Number(b?.step || 5));
    if (!ticker) return NextResponse.json({ error: 'ticker required', requestId }, { status: 400 });

    const { origin } = new URL(req.url);
    const needDays = startDaysAgo + horizonDays + 60;
    const r = await fetch(`${origin}/api/price/candles/${encodeURIComponent(ticker)}?res=D&days=${needDays}`, { cache: 'no-store' });
    const j = await r.json();
    const rows: Candle[] = Array.isArray(j?.candles) ? j.candles as Candle[] : [];
    if (rows.length < 60) return NextResponse.json({ error: 'insufficient candles', requestId }, { status: 400 });
    const ts = rows.map(r=>Number(r.t));
    const h = rows.map(r=>Number(r.h));
    const l = rows.map(r=>Number(r.l));
    const c = rows.map(r=>Number(r.c));

    const items: any[] = [];
    const tolerancePct = Math.max(0, Number(b?.tolerancePct ?? 1));
    // Resolve auto direction once (approximation) from current TA
    let directionUsed: 'up'|'down' = directionReq==='down' ? 'down' : 'up';
    if (directionReq==='auto') {
      try {
        const rd = await fetch(`${origin}/api/ta/${encodeURIComponent(ticker)}?tf=D`, { cache: 'no-store' });
        const rw = await fetch(`${origin}/api/ta/${encodeURIComponent(ticker)}?tf=W`, { cache: 'no-store' });
        const jd = await rd.json(); const jw = await rw.json();
        const sD = Number(jd?.score ?? 0); const sW = Number(jw?.score ?? 0);
        const blend = 0.7*sD + 0.3*sW;
        directionUsed = blend >= 1 ? 'up' : (blend <= -1 ? 'down' : 'up');
      } catch {}
    }

    for (let d = startDaysAgo; d >= endDaysAgo; d -= step) {
      const entryIdx = Math.max(1, ts.length - 1 - d);
      const entryDate = new Date(ts[entryIdx]).toISOString().slice(0,10);
      const entryPrice = c[entryIdx];
      let targetPred: number | null = null; let usedMethod = method;
      if (method === 'fair') {
        try {
          const rf = await fetch(`${origin}/api/valuation/fair/${encodeURIComponent(ticker)}`, { cache: 'no-store' });
          const jf = await rf.json(); const fv = Number(jf?.fairValue);
          if (Number.isFinite(fv)) targetPred = fv; else usedMethod = 'atr_k';
        } catch { usedMethod = 'atr_k'; }
      }
      if (targetPred == null) {
        const atr = atr14(h, l, c, entryIdx);
        targetPred = atr != null ? (directionUsed==='up' ? entryPrice + k*atr : entryPrice - k*atr) : (directionUsed==='up' ? entryPrice*1.05 : entryPrice*0.95);
      }
      const endIdx = Math.min(ts.length - 1, entryIdx + horizonDays);
      const actualPrice = c[endIdx];
      const absErr = Math.abs(actualPrice - (targetPred as number));
      const pctErr = Math.abs(absErr / Math.max(1e-9, Math.abs(targetPred as number))) * 100;
      const hi = Math.max(...h.slice(entryIdx + 1, endIdx + 1));
      const lo = Math.min(...l.slice(entryIdx + 1, endIdx + 1));
      const tolUp = (targetPred as number) * (1 - tolerancePct/100);
      const tolDn = (targetPred as number) * (1 + tolerancePct/100);
      const hitWithin = directionUsed==='up' ? (hi >= tolUp) : (lo <= tolDn);
      items.push({ entryDate, horizonDays, entryPrice, targetPred, actualPrice, absErr, pctErr, hitWithin });
    }

    const hits = items.filter(x=>x.hitWithin).length;
    const mae = items.reduce((a,b)=>a + (Number(b.absErr)||0), 0) / items.length;
    const mape = items.reduce((a,b)=>a + (Number(b.pctErr)||0), 0) / items.length;
    return NextResponse.json({ requestId, ticker, method, direction: directionReq==='auto'?`auto→${directionUsed}`:directionUsed, k, horizonDays, window: { startDaysAgo, endDaysAgo, step }, tolerancePct, count: items.length, hitRate: items.length? (hits/items.length*100):0, mae, mape, items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed', requestId }, { status: 500 });
  }
}
