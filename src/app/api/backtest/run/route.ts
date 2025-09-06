import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Bar = { t: number; o: number; h: number; l: number; c: number; v?: number };
type Trade = { side: 'long'|'short'; entry: number; exit: number|null; pnl: number|null; rr: number|null; reason: string; entry_t: number; exit_t: number|null; };

// Helper to fetch candles from another internal API route
async function fetchCandles(ticker: string, res: '1' | 'D', days: number): Promise<Bar[]> {
  // This assumes the API is running on the same host. In a real-world scenario,
  // you might need to use an absolute URL from an environment variable.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const r = await fetch(`${baseUrl}/api/price/candles/${encodeURIComponent(ticker)}?res=${res}&days=${days}`, { cache: 'no-store' });
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j?.candles) ? j.candles : [];
}

export async function POST(req: Request) {
  const requestId = uuidv4();
  try {
    const b = await req.json().catch(() => ({}));
    
    // --- 1. Parse Inputs ---
    const ticker: string = String(b?.ticker || '').toUpperCase();
    const res: '1' | 'D' = b?.res === '1' ? '1' : 'D';
    const days: number = Math.max(30, Math.min(730, Number(b?.days || 180)));
    const p = b?.strategy?.params || {};
    const emaPeriod = Number(p.emaPeriod || 20);
    const rsiPeriod = Number(p.rsiPeriod || 7);
    const rsiEnter = Number(p.rsiEnter || 60);
    const rsiExit = Number(p.rsiExit || 50);
    const atrStopMult = Number(p.atrStopMult || 1.2);
    const takeProfitR = p.takeProfitR ? Number(p.takeProfitR) : null;
    const slippagePct = Number(p.slippagePct || 0) / 100;
    const fee = Number(p.fee || 0);
    const includeTrades = Boolean(b?.includeTrades);

    if (!ticker) return NextResponse.json({ error: 'ticker required', requestId }, { status: 400 });

    // --- 2. Fetch Data ---
    const candles: Bar[] = await fetchCandles(ticker, res, days);
    const anomalies: string[] = [];
    if (candles.length < Math.max(emaPeriod, rsiPeriod, 20)) {
      return NextResponse.json({ error: 'Insufficient historical data for the given periods.', requestId }, { status: 400 });
    }

    // --- 3. Calculate Indicators ---
    const closes = candles.map(k => Number(k.c));
    // EMA
    const emaArr: number[] = []; { let e: number | null = null; const k = 2 / (emaPeriod + 1); for (const c of closes) { e = e == null ? c : c * k + e * (1 - k); emaArr.push(e); } }
    // RSI
    const rsiArr: number[] = []; {
      let gains = 0, losses = 0;
      for (let i = 1; i <= rsiPeriod; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) gains += d; else losses -= d; }
      let avgG = gains / rsiPeriod, avgL = losses / rsiPeriod;
      rsiArr[rsiPeriod] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
      for (let i = rsiPeriod + 1; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; const g = d > 0 ? d : 0; const l = d < 0 ? -d : 0; avgG = (avgG * (rsiPeriod - 1) + g) / rsiPeriod; avgL = (avgL * (rsiPeriod - 1) + l) / rsiPeriod; rsiArr[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL); }
    }
    // ATR
    const highs = candles.map(k => Number(k.h)); const lows = candles.map(k => Number(k.l));
    const atrArr: number[] = []; {
      const TR: number[] = []; for (let i = 1; i < candles.length; i++) { const h = highs[i], l = lows[i], pc = closes[i - 1]; TR.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))); }
      if (TR.length >= 14) { for (let i = 13; i < TR.length; i++) { atrArr[i + 1] = TR.slice(i - 13, i + 1).reduce((a, b) => a + b, 0) / 14; } }
    }
    if (atrArr.filter(Boolean).length < 1) anomalies.push("Could not calculate ATR. Stops may be inaccurate.");

    // --- 4. Run Backtest Loop ---
    let cash = 0; let pos = 0; let entryPx = 0; let stop = 0; let takeProfit = 0;
    const curve: { t: number; equity: number }[] = [];
    const trades: Trade[] = [];
    let peakEquity = 0; let troughEquity = 0; let maxDrawdown = 0;

    for (let i = emaPeriod; i < candles.length; i++) {
      const c = closes[i]; const ema = emaArr[i]; const rsi = rsiArr[i]; const atr = atrArr[i] || (atrArr[i-1] || 0);
      
      // Handle exits first
      if (pos === 1) {
        const hitStop = c <= stop;
        const hitTakeProfit = takeProfit > 0 && c >= takeProfit;
        const exitCond = rsi < rsiExit;
        if (hitStop || hitTakeProfit || exitCond) {
          const exitPx = c * (1 - slippagePct);
          const pnl = exitPx - entryPx - 2 * fee;
          cash += pnl;
          const risk = entryPx - stop;
          const rr = risk > 0 ? pnl / risk : 0;
          trades[trades.length-1] = {...trades[trades.length-1], exit: exitPx, exit_t: candles[i].t, pnl, rr, reason: hitStop ? 'stop' : (hitTakeProfit ? 'tp' : 'rsi') };
          pos = 0;
        }
      }

      // Handle entries
      if (pos === 0) {
        if (c > ema && rsi > rsiEnter && atr > 0) {
          pos = 1;
          entryPx = c * (1 + slippagePct);
          stop = entryPx - atrStopMult * atr;
          if (takeProfitR) takeProfit = entryPx + takeProfitR * (entryPx - stop); else takeProfit = 0;
          trades.push({ side: 'long', entry: entryPx, exit: null, pnl: null, rr: null, reason: 'entry', entry_t: candles[i].t, exit_t: null });
        }
      }

      const currentEquity = cash + (pos === 1 ? (closes[i] - entryPx) : 0);
      curve.push({ t: Number(candles[i].t || 0), equity: currentEquity });
      
      // Calculate drawdown
      peakEquity = Math.max(peakEquity, currentEquity);
      troughEquity = currentEquity < peakEquity ? Math.min(troughEquity, currentEquity) : peakEquity;
      const drawdown = peakEquity > 0 ? (peakEquity - currentEquity) / peakEquity : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // --- 5. Calculate Final Metrics ---
    const wins = trades.filter(t => t.pnl != null && t.pnl > 0).length;
    const losses = trades.filter(t => t.pnl != null && t.pnl <= 0).length;
    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const rrSum = trades.reduce((acc, t) => acc + (t.rr || 0), 0);
    const avgRR = totalTrades > 0 ? rrSum / totalTrades : 0;

    const metrics = {
      trades: totalTrades,
      wins,
      losses,
      winRate,
      avgRR,
      totalPnL: cash,
      maxDrawdownPct: maxDrawdown * 100,
      peakEquity,
      troughEquity,
    };

    // --- 6. Persist & Return ---
    try {
      await pool.execute(
        `INSERT INTO backtests (id, strategy, metrics, equity_curve, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [requestId, 'ema_rsi_long', JSON.stringify(metrics), JSON.stringify(curve)]
      );
    } catch (dbError) {
      anomalies.push("Failed to save backtest result to database.");
    }

    const response: any = { id: requestId, metrics, equityCurve: curve, anomalies };
    if (includeTrades) {
      response.trades = trades;
    }

    return NextResponse.json(response);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'An unexpected error occurred.', requestId }, { status: 500 });
  }
}