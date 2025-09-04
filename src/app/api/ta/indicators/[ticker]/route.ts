import { NextResponse } from "next/server";
import { rsi, ema, macd, wilderATR, vwapFromIntraday } from "@/lib/indicators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getCandles(ticker: string, res: '1' | 'D', days: number) {
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/price/candles/${encodeURIComponent(ticker)}?res=${res}&days=${days}`, { cache: 'no-store' });
    // If BASE_URL not set, fall back to relative fetch
    if (!r.ok) {
      const rr = await fetch(`/api/price/candles/${encodeURIComponent(ticker)}?res=${res}&days=${days}`, { cache: 'no-store' });
      const j2 = await rr.json();
      return Array.isArray(j2?.candles) ? j2.candles : [];
    }
    const j = await r.json();
    return Array.isArray(j?.candles) ? j.candles : [];
  } catch {
    try {
      const rr = await fetch(`/api/price/candles/${encodeURIComponent(ticker)}?res=${res}&days=${days}`, { cache: 'no-store' });
      const j2 = await rr.json();
      return Array.isArray(j2?.candles) ? j2.candles : [];
    } catch { return []; }
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ ticker: string }> | { ticker: string } }) {
  try {
    const p = 'then' in (ctx.params as any) ? await (ctx.params as Promise<{ ticker: string }>) : (ctx.params as { ticker: string });
    const t = decodeURIComponent(p.ticker).toUpperCase().trim();
    if (!t) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

    const [min1, daily] = await Promise.all([
      getCandles(t, '1', 120),
      getCandles(t, 'D', 60),
    ]);

    const close1 = min1.map((k: any) => Number(k.c || 0)).filter(Number.isFinite);
    const high1 = min1.map((k: any) => Number(k.h || 0)).filter(Number.isFinite);
    const low1  = min1.map((k: any) => Number(k.l || 0)).filter(Number.isFinite);

    const closeD = daily.map((k: any) => Number(k.c || 0)).filter(Number.isFinite);
    const highD  = daily.map((k: any) => Number(k.h || 0)).filter(Number.isFinite);
    const lowD   = daily.map((k: any) => Number(k.l || 0)).filter(Number.isFinite);

    const last = close1[close1.length - 1] ?? null;
    const rsi7 = rsi(close1, 7);
    const rsi14 = rsi(close1, 14);
    const ema20 = ema(close1, 20);
    const ema50 = ema(close1, 50);
    const { hist } = macd(close1, 12, 26, 9);
    // MACD hist slope over last ~3 bars
    const macdSlope3 = (() => {
      // recompute macd series roughly for last 5 points to estimate slope
      const arr = [] as number[];
      for (let i = Math.max(0, close1.length - 50); i < close1.length; i++) arr.push(close1[i]);
      const series: number[] = [];
      let eF: number | null = null, eS: number | null = null;
      const kF = 2 / (12 + 1), kS = 2 / (26 + 1);
      for (const x of arr) {
        eF = eF == null ? x : x * kF + eF * (1 - kF);
        eS = eS == null ? x : x * kS + eS * (1 - kS);
        series.push((eF as number) - (eS as number));
      }
      const sig = ema(series, 9);
      const h = sig != null ? (series[series.length - 1] - sig) : null;
      const hPrev = sig != null && series.length >= 4 ? (series[series.length - 4] - sig) : null;
      if (h == null || hPrev == null) return null;
      return h - hPrev;
    })();

    const atr = wilderATR(highD, lowD, closeD, 14);
    const atrPct = atr != null && closeD.length ? (atr / closeD[closeD.length - 1]) * 100 : null;

    const vwap = vwapFromIntraday(min1 as any);
    const vwapDistPct = vwap != null && last != null ? ((last - vwap) / vwap) * 100 : null;

    const result = {
      rsi7, rsi14,
      ema20, ema50, last,
      macdHist: hist,
      macdSlope3,
      atrPct,
      vwapDistPct,
      aboveEma20: last != null && ema20 != null ? last >= ema20 : null,
      emaAligned: ema20 != null && ema50 != null ? ema20 >= ema50 : null,
    };

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
