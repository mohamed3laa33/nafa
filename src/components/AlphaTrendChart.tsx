"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

function useContainerWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        if (e.contentRect) setW(e.contentRect.width);
      }
    });
    ro.observe(ref.current);
    setW(ref.current.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return { ref, width: w } as const;
}

function sma(arr: number[], period: number, idx: number) {
  if (idx + 1 < period) return NaN;
  let sum = 0;
  for (let i = idx - period + 1; i <= idx; i++) sum += arr[i];
  return sum / period;
}

function rsi(values: number[], period: number) {
  const out: number[] = new Array(values.length).fill(NaN);
  let gain = 0, loss = 0;
  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const g = Math.max(0, change);
    const l = Math.max(0, -change);
    if (i <= period) {
      gain += g;
      loss += l;
      if (i === period) {
        const rs = loss === 0 ? 100 : 100 * (gain / period) / ((loss / period) || 1);
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

function mfi(candles: Candle[], period: number) {
  const out: number[] = new Array(candles.length).fill(NaN);
  let posFlow = 0, negFlow = 0;
  const tp: number[] = candles.map(c => (c.h + c.l + c.c) / 3);
  const rawFlow: number[] = tp.map((p, i) => p * (candles[i].v || 0));
  for (let i = 1; i < candles.length; i++) {
    const flow = tp[i] > tp[i - 1] ? rawFlow[i] : tp[i] < tp[i - 1] ? -rawFlow[i] : 0;
    if (i <= period) {
      if (flow >= 0) posFlow += Math.abs(flow); else negFlow += Math.abs(flow);
      if (i === period) {
        const mfr = negFlow === 0 ? 100 : posFlow / negFlow;
        out[i] = 100 - 100 / (1 + mfr);
      }
    } else {
      // approximate rolling window by decay; acceptable for display
      if (flow >= 0) posFlow = (posFlow * (period - 1) + Math.abs(flow)) / period;
      else negFlow = (negFlow * (period - 1) + Math.abs(flow)) / period;
      const mfr = negFlow === 0 ? 100 : posFlow / negFlow;
      out[i] = 100 - 100 / (1 + mfr);
    }
  }
  return out;
}

export default function AlphaTrendChart({ ticker, height = 420, coeff = 1, period = 14, showSignals = true }: { ticker: string; height?: number; coeff?: number; period?: number; showSignals?: boolean }) {
  const { ref, width } = useContainerWidth();
  const [rows, setRows] = useState<Candle[]>([]);
  const [err, setErr] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [signals, setSignals] = useState(showSignals);
  const [windowDays, setWindowDays] = useState<number | "all">(180);

  useEffect(() => {
    let alive = true;
    (async () => {
      setErr("");
      try {
        const r = await fetch(`/api/price/history/${encodeURIComponent(ticker)}`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load history");
        if (alive) setRows(Array.isArray(j.candles) ? j.candles : []);
      } catch (e: any) {
        if (alive) setErr(e.message || "Failed to load history");
      }
    })();
    return () => { alive = false; };
  }, [ticker]);

  const view = useMemo(() => {
    if (!rows.length) return { slice: [] as Candle[] };
    if (windowDays === "all") return { slice: rows };
    return { slice: rows.slice(-windowDays) };
  }, [rows, windowDays]);

  const { alpha, alpha2, buys, sells, minY, maxY } = useMemo(() => {
    const data = view.slice;
    if (!data.length) return { alpha: [], alpha2: [], buys: [], sells: [], minY: 0, maxY: 1 } as any;
    const closes = data.map(r => r.c);
    const highs = data.map(r => r.h);
    const lows = data.map(r => r.l);
    // True Range
    const tr: number[] = data.map((r, i) => {
      if (i === 0) return r.h - r.l;
      const prevC = data[i - 1].c;
      return Math.max(r.h - r.l, Math.abs(r.h - prevC), Math.abs(r.l - prevC));
    });
    // ATR via SMA
    const atr: number[] = tr.map((_, i) => sma(tr, period, i));
    // MFI or RSI
    const hasVolume = data.some(r => r.v && r.v > 0);
    const mfiVals = hasVolume ? mfi(data, period) : [];
    const rsiVals = !hasVolume ? rsi(closes, period) : [];

    const alphaArr: number[] = new Array(data.length).fill(NaN);
    for (let i = 0; i < data.length; i++) {
      const cond = hasVolume ? (mfiVals[i] >= 50) : (rsiVals[i] >= 50);
      const upT = lows[i] - (atr[i] || 0) * coeff;
      const downT = highs[i] + (atr[i] || 0) * coeff;
      const prev = i > 0 && Number.isFinite(alphaArr[i - 1]) ? alphaArr[i - 1] : closes[i];
      alphaArr[i] = cond ? Math.max(upT, prev) : Math.min(downT, prev);
    }

    const alpha2Arr = alphaArr.map((_, i) => (i >= 2 ? alphaArr[i - 2] : NaN));

    const buysIdx: number[] = [];
    const sellsIdx: number[] = [];
    for (let i = 3; i < data.length; i++) {
      const crossUp = alphaArr[i] > alpha2Arr[i] && alphaArr[i - 1] <= alpha2Arr[i - 1];
      const crossDn = alphaArr[i] < alpha2Arr[i] && alphaArr[i - 1] >= alpha2Arr[i - 1];
      if (crossUp) buysIdx.push(i);
      if (crossDn) sellsIdx.push(i);
    }

    const minY = Math.min(
      ...data.map(r => r.l),
      ...alphaArr.filter(Number.isFinite) as number[],
      ...alpha2Arr.filter(Number.isFinite) as number[]
    );
    const maxY = Math.max(
      ...data.map(r => r.h),
      ...alphaArr.filter(Number.isFinite) as number[],
      ...alpha2Arr.filter(Number.isFinite) as number[]
    );

    return { alpha: alphaArr, alpha2: alpha2Arr, buys: buysIdx, sells: sellsIdx, minY, maxY };
  }, [view, coeff, period]);

  if (err) return <div className="text-red-600 text-sm">{err}</div>;
  if (!rows.length) return <div className="text-gray-500 text-sm">No history.</div>;

  const pad = 8;
  const w = Math.max(320, width);
  const h = height;
  const spanY = (maxY - minY) || 1;
  const xStep = (w - pad * 2) / Math.max(1, rows.length - 1);
  const yScale = (v: number) => h - pad - ((v - minY) / spanY) * (h - pad * 2);

  const bodyW = Math.max(1, Math.floor(xStep * 0.6));

  const alphaPath = alpha
    .map((v, i) => (Number.isFinite(v) ? `${i === 0 ? "M" : "L"}${pad + i * xStep},${yScale(v)}` : null))
    .filter(Boolean)
    .join(" ");
  const alpha2Path = alpha2
    .map((v, i) => (Number.isFinite(v) ? `${i === 0 ? "M" : "L"}${pad + i * xStep},${yScale(v)}` : null))
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className="w-full">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
        {/* Candles */}
        {rows.map((r, i) => {
          const x = pad + i * xStep;
          const isUp = r.c >= r.o;
          const yOpen = yScale(r.o);
          const yClose = yScale(r.c);
          const yHigh = yScale(r.h);
          const yLow = yScale(r.l);
          const bodyX = x - bodyW / 2;
          const bodyY = Math.min(yOpen, yClose);
          const bodyH = Math.max(1, Math.abs(yClose - yOpen));
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke="#64748b" strokeWidth={1} />
              <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} fill={isUp ? "#16a34a" : "#dc2626"} />
            </g>
          );
        })}

        {/* AlphaTrend lines */}
        {enabled && (
          <>
            <path d={alpha2Path} fill="none" stroke="#ef4444" strokeWidth={2} />
            <path d={alphaPath} fill="none" stroke="#2563eb" strokeWidth={2} />
          </>
        )}

        {/* Signals */}
        {enabled && signals && buys.map((i, k) => {
          const x = pad + i * xStep;
          const y = yScale(alpha2[i]) - 6;
          return (
            <g key={`b${k}`}>
              <polygon points={`${x-5},${y} ${x+5},${y} ${x},${y-8}`} fill="#2563eb" />
              <text x={x} y={y-12} textAnchor="middle" fontSize="10" fill="#2563eb">BUY</text>
            </g>
          );
        })}
        {enabled && signals && sells.map((i, k) => {
          const x = pad + i * xStep;
          const y = yScale(alpha2[i]) + 6;
          return (
            <g key={`s${k}`}>
              <polygon points={`${x-5},${y} ${x+5},${y} ${x},${y+8}`} fill="#b91c1c" />
              <text x={x} y={y+18} textAnchor="middle" fontSize="10" fill="#b91c1c">SELL</text>
            </g>
          );
        })}
      </svg>
      {/* Controls */}
      <div className="mt-2 flex items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-1">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>AlphaTrend</span>
        </label>
        <label className="inline-flex items-center gap-1">
          <input type="checkbox" checked={signals} onChange={(e) => setSignals(e.target.checked)} />
          <span>Signals</span>
        </label>
        <label className="inline-flex items-center gap-1">
          <span>Window:</span>
          <select className="border rounded px-1 py-0.5" value={windowDays === "all" ? "all" : String(windowDays)} onChange={(e) => setWindowDays(e.target.value === "all" ? "all" : Number(e.target.value))}>
            <option value="90">90d</option>
            <option value="180">180d</option>
            <option value="365">1y</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>
    </div>
  );
}
