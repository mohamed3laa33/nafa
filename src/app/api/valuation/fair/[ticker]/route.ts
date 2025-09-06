import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getCandles(ticker: string) {
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/price/candles/${encodeURIComponent(ticker)}?res=D&days=60`, { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); return Array.isArray(j?.candles) ? j.candles as any[] : []; }
  } catch {}
  try {
    const rr = await fetch(`/api/price/candles/${encodeURIComponent(ticker)}?res=D&days=60`, { cache: 'no-store' });
    const j2 = await rr.json();
    return Array.isArray(j2?.candles) ? j2.candles as any[] : [];
  } catch { return [] as any[]; }
}

async function getIndicators(ticker: string) {
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/ta/indicators/${encodeURIComponent(ticker)}`, { cache: 'no-store' });
    if (r.ok) return await r.json();
  } catch {}
  try {
    const rr = await fetch(`/api/ta/indicators/${encodeURIComponent(ticker)}`, { cache: 'no-store' });
    const jj = await rr.json();
    return rr.ok ? jj : {};
  } catch { return {}; }
}

function weightedAverage(parts: Array<{ v: number | null; w: number }>): number | null {
  let num = 0, den = 0;
  for (const p of parts) {
    if (p.v != null && Number.isFinite(p.v)) { num += p.v * p.w; den += p.w; }
  }
  return den > 0 ? num / den : null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ ticker: string }> | { ticker: string } }) {
  try {
    const p = 'then' in (ctx.params as any) ? await (ctx.params as Promise<{ ticker: string }>) : (ctx.params as { ticker: string });
    const t = decodeURIComponent(p.ticker).toUpperCase().trim();
    if (!t) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

    // Derive absolute origin from the incoming request to avoid relative fetch issues
    const origin = (() => {
      try { return new URL(_req.url).origin; } catch { return ''; }
    })();

    // Prefer absolute self-calls using the current origin
    const fetchCandles = async () => {
      try {
        const r = await fetch(`${origin}/api/price/candles/${encodeURIComponent(t)}?res=D&days=60`, { cache: 'no-store' });
        if (r.ok) { const j = await r.json(); return Array.isArray(j?.candles) ? j.candles as any[] : []; }
      } catch {}
      return await getCandles(t);
    };
    const fetchIndicators = async () => {
      try {
        const r = await fetch(`${origin}/api/ta/indicators/${encodeURIComponent(t)}`, { cache: 'no-store' });
        if (r.ok) return await r.json();
      } catch {}
      return await getIndicators(t);
    };

    const [candles, ind] = await Promise.all([fetchCandles(), fetchIndicators()]);
    if (!candles.length) return NextResponse.json({ error: 'no candles' }, { status: 502 });

    const lastN = candles.slice(-20);
    const c = lastN.map((k:any)=>Number(k.c)).filter(Number.isFinite);
    const v = lastN.map((k:any)=>Number(k.v || 0)).filter((x:number)=>Number.isFinite(x) && x>=0);
    const h = lastN.map((k:any)=>Number(k.h)).filter(Number.isFinite);
    const l = lastN.map((k:any)=>Number(k.l)).filter(Number.isFinite);

    // 20D VWAP (daily closes weighted by volume)
    let vwap20: number | null = null;
    if (c.length === v.length && c.length > 0) {
      const pv = c.reduce((sum, x, i) => sum + x * v[i], 0);
      const vv = v.reduce((sum, x) => sum + x, 0);
      vwap20 = vv > 0 ? pv / vv : null;
    }

    // Donchian 20 midpoint
    const hi = h.length ? Math.max(...h) : null;
    const lo = l.length ? Math.min(...l) : null;
    const donchMid = (hi != null && lo != null) ? (hi + lo) / 2 : null;

    // EMA20 from indicators endpoint if available, else compute simple EMA20 from closes
    let ema20: number | null = Number.isFinite(ind?.ema20) ? Number(ind.ema20) : null;
    const last = c.length ? c[c.length-1] : null;
    if (ema20 == null && c.length >= 20) {
      const k = 2 / (20 + 1);
      let ema: number | null = null;
      for (let i = 0; i < c.length; i++) {
        const x = c[i];
        ema = ema == null ? x : x * k + (ema as number) * (1 - k);
      }
      ema20 = ema;
    }

    // Fair value as blended anchor of VWAP(20), EMA20 and 20D mid channel
    const fair = weightedAverage([
      { v: vwap20, w: 0.5 },
      { v: ema20,  w: 0.3 },
      { v: donchMid, w: 0.2 },
    ]);

    // Good-to-buy heuristic (conservative, direction-agnostic)
    // Criteria: price at discount to fair, not overbought, and trend not broken
    const rsi7 = Number.isFinite(ind?.rsi7) ? Number(ind.rsi7) : null;
    const aboveEma20 = ind?.aboveEma20 === true || ind?.aboveEma20 === false ? Boolean(ind.aboveEma20) : null;
    const emaAligned = ind?.emaAligned === true || ind?.emaAligned === false ? Boolean(ind.emaAligned) : null;
    const vwapDistPct = Number.isFinite(ind?.vwapDistPct) ? Number(ind.vwapDistPct) : null;

    let isGoodBuy: boolean | null = null;
    const reasons: string[] = [];

    if (fair != null && last != null) {
      const discountPct = ((fair - last) / fair) * 100; // positive means below fair
      const rsiOk = rsi7 == null ? true : (rsi7 >= 35 && rsi7 <= 65);
      const trendOk = emaAligned === null && aboveEma20 === null ? true : (emaAligned || aboveEma20 || false);
      const vwapOk = vwapDistPct == null ? true : (vwapDistPct >= -5); // not too extended below VWAP
      isGoodBuy = discountPct >= 2 && rsiOk && trendOk && vwapOk;
      reasons.push(`Disc ${(discountPct).toFixed(2)}%`);
      if (rsi7 != null) reasons.push(`RSI7 ${rsi7.toFixed(0)}`);
      if (emaAligned != null) reasons.push(emaAligned ? 'EMA aligned' : 'EMA not aligned');
      if (vwapDistPct != null) reasons.push(`VWAP Δ ${(vwapDistPct>=0?'+':'')}${vwapDistPct.toFixed(2)}%`);
      return NextResponse.json({ ticker: t, fairValue: fair, last, vwap20, ema20, donchMid, isGoodBuy, reasons, discountPct });
    }

    return NextResponse.json({ ticker: t, fairValue: fair, last, vwap20, ema20, donchMid, isGoodBuy: null, reasons: [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
