import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Bar = { t: number; o: number; h: number; l: number; c: number; v?: number };

export async function POST(req: Request) {
  const requestId = uuidv4();
  try {
    const b = await req.json().catch(()=>({}));
    const ticker: string = String(b?.ticker || '').toUpperCase();
    const res: '1'|'D' = (b?.res === '1' ? '1' : 'D');
    const days: number = Math.max(30, Math.min(365, Number(b?.days || 180)));
    if (!ticker) return NextResponse.json({ error: 'ticker required', requestId }, { status: 400 });
    // Fetch candles
    const r = await fetch(`/api/price/candles/${encodeURIComponent(ticker)}?res=${res}&days=${days}`, { cache: 'no-store' });
    const j = await r.json();
    const candles: Bar[] = Array.isArray(j?.candles) ? j.candles : [];
    if (candles.length < 50) return NextResponse.json({ error: 'insufficient data', requestId }, { status: 400 });

    // Simple rules: enter long if close>EMA20 and RSI7>60; exit when RSI7<50 or stop/target hit (ATR-based)
    const closes = candles.map(k=>Number(k.c));
    // EMA20
    const emaArr: number[] = []; { let e: number | null = null; const k = 2/(20+1); for (const c of closes){ e = e==null? c : c*k + e*(1-k); emaArr.push(e); } }
    // RSI7
    const rsiArr: number[] = []; {
      let gains=0, losses=0; for (let i=1;i<=7;i++){ const d=closes[i]-closes[i-1]; if (d>=0) gains+=d; else losses-=d; }
      let avgG=gains/7, avgL=losses/7; rsiArr[7]= avgL===0?100: 100-100/(1+avgG/avgL);
      for (let i=8;i<closes.length;i++){ const d=closes[i]-closes[i-1]; const g=d>0?d:0; const l=d<0?-d:0; avgG=(avgG*6+g)/7; avgL=(avgL*6+l)/7; rsiArr[i]= avgL===0?100: 100-100/(1+avgG/avgL); }
    }
    // ATR14 (simple)
    const highs = candles.map(k=>Number(k.h)); const lows = candles.map(k=>Number(k.l));
    const atrArr: number[] = []; {
      const TR: number[] = []; for (let i=1;i<candles.length;i++){ const h=highs[i], l=lows[i], pc=closes[i-1]; TR.push(Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc))); }
      for (let i=13;i<TR.length;i++){ atrArr[i+1] = TR.slice(i-13,i+1).reduce((a,b)=>a+b,0)/14; }
    }

    let cash = 0; let pos = 0; let entryPx = 0; let stop = 0; const curve: { t: number; equity: number }[] = [];
    let wins=0, losses=0; let rrSum=0; let trades=0;
    for (let i=20;i<candles.length;i++){
      const c = closes[i]; const ema20 = emaArr[i]; const rsi7 = rsiArr[i]; const atr = atrArr[i];
      if (!pos) {
        if (c>ema20 && rsi7>60 && atr>0){ pos=1; entryPx=c; stop=entryPx-1.2*atr; trades++; }
      } else {
        const hitStop = c<=stop; const exitCond = rsi7<50;
        if (hitStop || exitCond){ const pnl = c-entryPx; cash += pnl; const risk = entryPx-stop; const rr = risk>0? pnl/risk : 0; rrSum+=rr; if (pnl>=0) wins++; else losses++; pos=0; }
      }
      curve.push({ t: Number(candles[i].t||0), equity: cash + (pos? (closes[i]-entryPx):0) });
    }
    const metrics = { trades, wins, losses, winRate: trades? (wins/trades*100):0, avgRR: trades? rrSum/trades:0, totalPnL: cash };

    // Try to persist
    try {
      await pool.execute(
        `INSERT INTO backtests (id, strategy, metrics, equity_curve, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [requestId, 'ema20_rsi7_long', JSON.stringify(metrics), JSON.stringify(curve)]
      );
    } catch {}

    return NextResponse.json({ id: requestId, metrics, equityCurve: curve });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed', requestId }, { status: 500 });
  }
}

