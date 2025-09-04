// Lightweight TA helpers without external deps

export function ema(values: number[], period: number): number | null {
  const v = values.filter((x) => Number.isFinite(x)) as number[];
  if (v.length < period || period <= 0) return null;
  const k = 2 / (period + 1);
  let e = v.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < v.length; i++) e = v[i] * k + e * (1 - k);
  return e;
}

export function rsi(values: number[], period = 14): number | null {
  const v = values.filter((x) => Number.isFinite(x)) as number[];
  if (v.length < period + 1) return null;
  let gains = 0; let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = v[i] - v[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < v.length; i++) {
    const diff = v[i] - v[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9): { macd: number | null; signal: number | null; hist: number | null } {
  const v = values.filter((x) => Number.isFinite(x)) as number[];
  if (v.length < slow + signal) return { macd: null, signal: null, hist: null };
  const emaFast = ema(v, fast);
  const emaSlow = ema(v, slow);
  if (emaFast == null || emaSlow == null) return { macd: null, signal: null, hist: null };
  const macdLineArr: number[] = [];
  // Build macd series for signal calculation
  // For simplicity, we approximate using last N points by sliding window
  const seed = Math.max(slow + signal, 40);
  const series = v.slice(-seed);
  let eFast: number | null = null; let eSlow: number | null = null;
  const kF = 2 / (fast + 1); const kS = 2 / (slow + 1);
  for (let i = 0; i < series.length; i++) {
    const x = series[i];
    if (eFast == null) eFast = x; else eFast = x * kF + eFast * (1 - kF);
    if (eSlow == null) eSlow = x; else eSlow = x * kS + eSlow * (1 - kS);
    macdLineArr.push((eFast as number) - (eSlow as number));
  }
  const sig = ema(macdLineArr, signal);
  const macdVal = macdLineArr[macdLineArr.length - 1] ?? null;
  const hist = sig != null && macdVal != null ? macdVal - sig : null;
  return { macd: macdVal, signal: sig, hist };
}

export function wilderATR(high: number[], low: number[], close: number[], period = 14): number | null {
  const n = Math.min(high.length, low.length, close.length);
  if (n < period + 1) return null;
  const H = high.slice(n - (period + 1));
  const L = low.slice(n - (period + 1));
  const C = close.slice(n - (period + 1));
  const TR: number[] = [];
  for (let i = 1; i < H.length; i++) {
    const h = H[i], l = L[i], pc = C[i - 1];
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    TR.push(tr);
  }
  // Wilder smoothing
  let atr = TR.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < TR.length; i++) atr = (atr * (period - 1) + TR[i]) / period;
  return atr;
}

export function vwapFromIntraday(candles: { h: number; l: number; c: number; v: number }[]): number | null {
  let vol = 0, pv = 0;
  for (const k of candles) {
    const typical = (Number(k.h) + Number(k.l) + Number(k.c)) / 3;
    const v = Number(k.v || 0);
    if (!Number.isFinite(typical) || !Number.isFinite(v)) continue;
    pv += typical * v; vol += v;
  }
  return vol > 0 ? pv / vol : null;
}

