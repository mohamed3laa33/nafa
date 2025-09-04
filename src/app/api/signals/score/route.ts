import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function candles(t: string, res: '1'|'D', days: number) {
  const r = await fetch(`/api/price/candles/${encodeURIComponent(t)}?res=${res}&days=${days}`, { cache: 'no-store' });
  const j = await r.json();
  return Array.isArray(j?.candles) ? j.candles as any[] : [];
}

function clamp(x: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, x)); }

export async function POST(req: Request) {
  const requestId = uuidv4();
  try {
    const b = await req.json().catch(()=>({}));
    const ticker = String(b?.ticker || '').trim().toUpperCase();
    const entry = Number(b?.entry);
    const target = Number(b?.target);
    if (!ticker || !Number.isFinite(entry) || !Number.isFinite(target)) {
      return NextResponse.json({ error: 'ticker, entry, target required', requestId }, { status: 400 });
    }
    const isBuy = target >= entry;

    // Daily ATR for ETA + risk sizing
    const daily = await candles(ticker, 'D', 60);
    const highs = daily.map((k:any)=>Number(k.h));
    const lows  = daily.map((k:any)=>Number(k.l));
    const closes= daily.map((k:any)=>Number(k.c));
    let atr: number | null = null;
    if (closes.length >= 15) {
      const TR: number[] = [];
      for (let i=1;i<closes.length;i++){
        const h=highs[i], l=lows[i], pc=closes[i-1];
        if ([h,l,pc].every(Number.isFinite)) TR.push(Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc)));
      }
      atr = TR.length >= 14 ? TR.slice(-14).reduce((a,b)=>a+b,0)/14 : null;
    }
    const lastClose = closes[closes.length-1];
    const base = Number.isFinite(entry) ? entry : Number(lastClose);

    // TA summary for k multiplier
    let k = 2.0; let taLabel = 'Neutral';
    try {
      const r = await fetch(`/api/ta/${encodeURIComponent(ticker)}?tf=D`, { cache: 'no-store' });
      const j = await r.json();
      taLabel = String(j?.summary || 'Neutral');
      if (taLabel.includes('Strong Buy')) k = 2.8; else if (taLabel.includes('Buy')) k = 2.2; else if (taLabel.includes('Neutral')) k = 1.6; else if (taLabel.includes('Sell')) k = 1.3; else if (taLabel.includes('Strong Sell')) k = 1.0;
    } catch {}

    // Fair target
    const lookback = 20;
    const recentHigh = Math.max(...highs.slice(-lookback));
    const recentLow  = Math.min(...lows.slice(-lookback));
    let fair: number | null = null;
    if (atr != null) {
      if (isBuy) fair = Math.max(base + k*atr, Number.isFinite(recentHigh) ? recentHigh : 0);
      else {
        const atrDn = base - k*atr;
        fair = Math.min(atrDn, Number.isFinite(recentLow) ? recentLow : Number.POSITIVE_INFINITY);
        if (!Number.isFinite(fair)) fair = atrDn;
      }
    }

    // ETA (days)
    const eta = atr && fair != null ? Math.max(1, Math.ceil(Math.abs(fair - base) / atr)) : null;

    // Suggested stop (ATR-based with ks from TA)
    let ks = 1.2;
    try {
      const r = await fetch(`/api/ta/${encodeURIComponent(ticker)}?tf=D`, { cache: 'no-store' });
      const j = await r.json();
      const lbl = String(j?.summary || 'Neutral');
      if (lbl.includes('Strong Buy')) ks = 1.6; else if (lbl.includes('Buy')) ks = 1.4; else if (lbl.includes('Neutral')) ks = 1.2; else if (lbl.includes('Sell')) ks = 1.0; else if (lbl.includes('Strong Sell')) ks = 0.8;
    } catch {}
    const stop = atr != null ? (isBuy ? base - ks*atr : base + ks*atr) : (isBuy ? base*0.9 : base*1.1);

    // R multiple for target
    let rr: number | null = null;
    if (atr != null) {
      if (isBuy) { const risk = base - stop; const reward = target - base; rr = risk>0 ? reward/risk : null; }
      else { const risk = stop - base; const reward = base - target; rr = risk>0 ? reward/risk : null; }
    }

    // Momentum/flow and features for probUp
    let buyPct = 50; let rsi7 = 50; let vwapDistPct = 0; let emaAligned = false;
    try {
      const fr = await fetch(`/api/price/flow/${encodeURIComponent(ticker)}?window=5m`, { cache: 'no-store' });
      const fj = await fr.json(); const buy = Number(fj?.buyVol||0), sell = Number(fj?.sellVol||0); const tot = buy+sell; buyPct = tot>0 && fj?.buyPct!=null ? Number(fj.buyPct) : (tot>0 ? (buy/tot)*100 : 50);
    } catch {}
    try {
      const ir = await fetch(`/api/ta/indicators/${encodeURIComponent(ticker)}`, { cache: 'no-store' });
      const ij = await ir.json();
      if (ir.ok) { rsi7 = Number.isFinite(ij?.rsi7)?Number(ij.rsi7):50; vwapDistPct = Number.isFinite(ij?.vwapDistPct)?Number(ij.vwapDistPct):0; emaAligned = !!ij?.emaAligned; }
    } catch {}
    const normRVOL = 50; // placeholder without extra fetch in scoring endpoint
    const normVWAP = ((clamp(vwapDistPct, -2, 2) + 2) / 4) * 100;
    const normRSI = clamp(((rsi7 - 40)/30)*100, 0, 100);
    const probUp = clamp(0.4*buyPct + 0.2*normVWAP + 0.2*normRSI + 0.2*(emaAligned?100:40), 0, 100);

    const reasons: string[] = [];
    reasons.push(`TA ${taLabel} → k ${k.toFixed(2)}`);
    reasons.push(`Flow(5m) ${buyPct.toFixed(0)}%`);
    reasons.push(`VWAP Δ ${vwapDistPct>=0?'+':''}${vwapDistPct.toFixed(2)}%`);
    reasons.push(`RSI7 ${rsi7.toFixed(0)}${emaAligned?' • EMA aligned':''}`);

    return NextResponse.json({ dir: isBuy ? 'buy' : 'sell', probUp, fair, eta, stop, rr, reasons, requestId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed', requestId }, { status: 500 });
  }
}

