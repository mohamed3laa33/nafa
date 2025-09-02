import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Candle = { t: number; c: number };

function ema(arr: number[], period: number) {
  const out: number[] = new Array(arr.length).fill(NaN);
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (!Number.isFinite(v)) continue;
    if (i === 0) prev = v; else prev = v * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function sma(arr: number[], period: number) {
  const out: number[] = new Array(arr.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (Number.isFinite(v)) sum += v;
    if (i >= period) sum -= arr[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function rsi(values: number[], period = 14) {
  const out: number[] = new Array(values.length).fill(NaN);
  let gain = 0, loss = 0;
  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const g = Math.max(0, change);
    const l = Math.max(0, -change);
    if (i <= period) {
      gain += g; loss += l;
      if (i === period) {
        const rs = loss === 0 ? 100 : (gain / period) / ((loss / period) || 1);
        out[i] = 100 - 100 / (1 + rs);
      }
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      const rs = loss === 0 ? 100 : gain / loss;
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

async function yahooCandles(symbol: string, interval: string, range: string): Promise<Candle[] | null> {
  const headers = { "User-Agent": "nfaa-app/1.0", Accept: "application/json" } as const;
  for (const host of ["query1", "query2"]) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
      const r = await fetch(url, { headers, cache: "no-store" });
      if (!r.ok) continue;
      const j = await r.json();
      const res = j?.chart?.result?.[0];
      const ts: number[] = res?.timestamp ?? [];
      const q = res?.indicators?.quote?.[0];
      const close: number[] = q?.close ?? [];
      if (!ts.length || !close.length) continue;
      const out: Candle[] = [];
      for (let i = 0; i < ts.length; i++) {
        const c = Number(close[i]);
        if (!Number.isFinite(c)) continue;
        out.push({ t: ts[i] * 1000, c });
      }
      if (out.length) return out;
    } catch {}
  }
  return null;
}

function labelFromScore(score: number) {
  if (score >= 3) return "Strong Buy";
  if (score >= 1) return "Buy";
  if (score <= -3) return "Strong Sell";
  if (score <= -1) return "Sell";
  return "Neutral";
}

export async function GET(req: Request, ctx: { params: Promise<{ ticker?: string }> }) {
  try {
    const { ticker } = await ctx.params;
    const symbol = (ticker || '').toUpperCase().trim();
    if (!symbol) return NextResponse.json({ error: 'Missing ticker' }, { status: 400 });

    const url = new URL(req.url);
    let tf = (url.searchParams.get('tf') || 'D').toUpperCase();
    const normMap: Record<string,string> = { '1M':'1', '5M':'5', '15M':'15', '30M':'30', '1H':'60', '2H':'120' };
    if (normMap[tf]) tf = normMap[tf];

    const map: any = {
      '1': { i: '1m', r: '1d' },
      '5': { i: '5m', r: '5d' },
      '15': { i: '15m', r: '5d' },
      '30': { i: '30m', r: '1mo' },
      '60': { i: '60m', r: '1mo' },
      '120': { i: '120m', r: '2mo' },
      'D': { i: '1d', r: '1y' },
    };
    const cfg = map[tf] || map['D'];

    let candles = await yahooCandles(symbol, cfg.i, cfg.r);
    if ((!candles || candles.length < 60) && tf === '120') {
      candles = await yahooCandles(symbol, '60m', '2mo');
    }
    if (!candles || candles.length < 30) {
      return NextResponse.json({ ticker: symbol, timeframe: tf, last: null, movingAverages: { buy: 0, sell: 0 }, indicators: { buy: 0, sell: 0, rsi: null, macdHist: null }, score: 0, summary: 'Neutral' });
    }

    const closes = candles.map(c => c.c);
    const last = closes[closes.length - 1];

    const maPeriods = [5, 10, 20, 50, 200];
    const maValues = maPeriods.map(p => sma(closes, p)[closes.length - 1]);
    let scoreMA = 0, buyMA = 0, sellMA = 0;
    for (const v of maValues) {
      if (!Number.isFinite(v)) continue;
      if (last >= v) { buyMA++; scoreMA += 1; } else { sellMA++; scoreMA -= 1; }
    }

    let scoreInd = 0, buyInd = 0, sellInd = 0;
    const rsiVals = rsi(closes, 14); const rsiLast = rsiVals[rsiVals.length - 1];
    if (Number.isFinite(rsiLast)) { if (rsiLast >= 60) { buyInd++; scoreInd += 1; } else if (rsiLast <= 40) { sellInd++; scoreInd -= 1; } }
    const ema12 = ema(closes, 12); const ema26 = ema(closes, 26);
    const macd = closes.map((_, i) => (ema12[i] - ema26[i]));
    const signal = ema(macd.map(x => Number.isFinite(x) ? x : 0), 9);
    const hist = macd[macd.length - 1] - signal[signal.length - 1];
    if (Number.isFinite(hist)) { if (hist >= 0) { buyInd++; scoreInd += 1; } else { sellInd++; scoreInd -= 1; } }

    const score = scoreMA + scoreInd;
    const summary = labelFromScore(score);

    return NextResponse.json({
      ticker: symbol,
      timeframe: tf,
      last,
      movingAverages: { buy: buyMA, sell: sellMA },
      indicators: { buy: buyInd, sell: sellInd, rsi: rsiLast, macdHist: hist },
      score,
      summary,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
