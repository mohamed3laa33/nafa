"use client";

// TradingView-like interactive chart using Lightweight Charts (CDN)
// Includes AlphaTrend overlay and timeframe toolbar.

import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    LightweightCharts?: any;
  }
}

type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

function loadLW(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.LightweightCharts && typeof window.LightweightCharts.createChart === "function")
      return resolve();
    const id = "lwcharts-cdn";
    if (document.getElementById(id)) {
      (document.getElementById(id) as HTMLScriptElement).addEventListener("load", () => resolve());
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.src =
      "https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("lwcharts load failed"));
    document.head.appendChild(s);
  });
}

// --- Indicator helpers (AlphaTrend) ---
function rsi(values: number[], period: number) {
  const out: number[] = new Array(values.length).fill(NaN);
  let gain = 0,
    loss = 0;
  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const g = Math.max(0, change);
    const l = Math.max(0, -change);
    if (i <= period) {
      gain += g;
      loss += l;
      if (i === period) {
        const rs = loss === 0 ? 100 : (100 * (gain / period)) / ((loss / period) || 1);
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
  let posFlow = 0,
    negFlow = 0;
  const tp = candles.map((r) => (r.h + r.l + r.c) / 3);
  const rf = tp.map((p, i) => p * (candles[i].v || 0));
  for (let i = 1; i < candles.length; i++) {
    const flow = tp[i] > tp[i - 1] ? rf[i] : tp[i] < tp[i - 1] ? -rf[i] : 0;
    if (i <= period) {
      if (flow >= 0) posFlow += Math.abs(flow);
      else negFlow += Math.abs(flow);
      if (i === period) {
        const mfr = negFlow === 0 ? 100 : posFlow / negFlow;
        out[i] = 100 - 100 / (1 + mfr);
      }
    } else {
      if (flow >= 0) posFlow = (posFlow * (period - 1) + Math.abs(flow)) / period;
      else negFlow = (negFlow * (period - 1) + Math.abs(flow)) / period;
      const mfr = negFlow === 0 ? 100 : posFlow / negFlow;
      out[i] = 100 - 100 / (1 + mfr);
    }
  }
  return out;
}

function sma(arr: number[], period: number, idx: number) {
  if (idx + 1 < period) return NaN;
  let sum = 0;
  for (let i = idx - period + 1; i <= idx; i++) sum += arr[i];
  return sum / period;
}

function computeAlphaTrend(rows: Candle[], coeff = 1, period = 14) {
  const closes = rows.map((r) => r.c);
  const highs = rows.map((r) => r.h);
  const lows = rows.map((r) => r.l);
  const tr = rows.map((r, i) =>
    i === 0
      ? r.h - r.l
      : Math.max(r.h - r.l, Math.abs(r.h - rows[i - 1].c), Math.abs(r.l - rows[i - 1].c))
  );
  const atr = tr.map((_, i) => sma(tr, period, i));
  const hasVol = rows.some((r) => r.v && r.v > 0);
  const mfiVals = hasVol ? mfi(rows, period) : [];
  const rsiVals = !hasVol ? rsi(closes, period) : [];
  const alpha: number[] = new Array(rows.length).fill(NaN);
  for (let i = 0; i < rows.length; i++) {
    const cond = hasVol ? mfiVals[i] >= 50 : rsiVals[i] >= 50;
    const upT = lows[i] - (atr[i] || 0) * coeff;
    const dnT = highs[i] + (atr[i] || 0) * coeff;
    const prev = i > 0 && Number.isFinite(alpha[i - 1]) ? alpha[i - 1] : closes[i];
    alpha[i] = cond ? Math.max(upT, prev) : Math.min(dnT, prev);
  }
  const alpha2 = alpha.map((_, i) => (i >= 2 ? alpha[i - 2] : NaN));
  return { alpha, alpha2 };
}

export default function TVLikeChart({ ticker }: { ticker: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volSeriesRef = useRef<any>(null);
  const alphaSeriesRef = useRef<any>(null);
  const alpha2SeriesRef = useRef<any>(null);
  const [res, setRes] = useState<"1" | "5" | "15" | "60" | "120" | "D">("D");
  const [days, setDays] = useState(180);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [width, setWidth] = useState<number>(800);
  const [exchange, setExchange] = useState<string | null>(null);

  const loadCandles = async () => {
    if (!ticker) return;
    setLoading(true);
    setErr("");
    try {
      const url = `/api/price/candles/${encodeURIComponent(ticker)}?res=${res}&days=${days}`;
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load candles");
      const rows: Candle[] = Array.isArray(j.candles) ? j.candles : [];
      const data = rows.map((d) => ({
        time: Math.floor(d.t / 1000) as any,
        open: d.o,
        high: d.h,
        low: d.l,
        close: d.c,
      }));
      const vol = rows.map((d) => ({
        time: Math.floor(d.t / 1000) as any,
        value: d.v,
        color: d.c >= d.o ? "#16a34a" : "#dc2626",
      }));
      const { alpha, alpha2 } = computeAlphaTrend(rows, atCoeff, atPeriod);
      const at = rows.map((d, i) => ({
        time: Math.floor(d.t / 1000) as any,
        value: Number.isFinite(alpha[i]) ? alpha[i] : null,
      }));
      const at2 = rows.map((d, i) => ({
        time: Math.floor(d.t / 1000) as any,
        value: Number.isFinite(alpha2[i]) ? alpha2[i] : null,
      }));

      if (candleSeriesRef.current) candleSeriesRef.current.setData(data);
      if (volSeriesRef.current) volSeriesRef.current.setData(vol);
      if (alphaSeriesRef.current) alphaSeriesRef.current.setData(at);
      if (alpha2SeriesRef.current) alpha2SeriesRef.current.setData(at2);
      try {
        chartRef.current?.timeScale().fitContent();
      } catch {}
    } catch (e: any) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // also fetch exchange to help fallback widget resolve the symbol
    (async () => {
      try {
        const r = await fetch(`/api/company-profile/${encodeURIComponent(ticker)}`, { cache: 'no-store' });
        const j = await r.json();
        if (r.ok && j?.exchange) {
          // Normalize common values to TV prefixes
          const ex = String(j.exchange).toUpperCase();
          if (ex.includes('NASDAQ')) setExchange('NASDAQ');
          else if (ex.includes('NYSE')) setExchange('NYSE');
          else if (ex.includes('AMEX') || ex.includes('AMERICAN')) setExchange('AMEX');
          else setExchange(null);
        }
      } catch {}
    })();
    let dispose = () => {};
    (async () => {
      await loadLW();
      if (
        !wrapRef.current ||
        !window.LightweightCharts ||
        typeof window.LightweightCharts.createChart !== "function"
      ) {
        setErr("Chart library failed to load");
        return;
      }
      const initialWidth = wrapRef.current.getBoundingClientRect().width || 800;
      setWidth(initialWidth);
      const lw = window.LightweightCharts;
      const chart = lw.createChart(wrapRef.current, {
        width: initialWidth,
        height: 520,
        layout: { background: { color: "#ffffff" }, textColor: "#4b5563" },
        rightPriceScale: { borderVisible: false },
        leftPriceScale: { visible: false },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: res !== "D" },
        grid: { horzLines: { color: "#f1f5f9" }, vertLines: { color: "#f1f5f9" } },
        crosshair: { mode: 0 },
      });
      chartRef.current = chart;
      const addCandle = (chart as any).addCandlestickSeries;
      if (typeof addCandle !== "function") {
        setErr("Chart API not ready");
        return;
      }
      const series = addCandle.call(chart, {
        upColor: "#16a34a",
        downColor: "#dc2626",
        borderVisible: false,
        wickUpColor: "#16a34a",
        wickDownColor: "#dc2626",
      });
      candleSeriesRef.current = series;
      volSeriesRef.current = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "left",
        color: "#94a3b8",
      });
      try {
        series.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.25 } });
      } catch {}
      alpha2SeriesRef.current = chart.addLineSeries({ color: "#ef4444", lineWidth: 2 });
      alphaSeriesRef.current = chart.addLineSeries({ color: "#2563eb", lineWidth: 2 });

      const obs = new ResizeObserver((entries) => {
        const w =
          entries[0]?.contentRect?.width || wrapRef.current?.clientWidth || initialWidth;
        setWidth(w);
        chart.applyOptions({ width: w, height: 520 });
      });
      obs.observe(wrapRef.current);
      dispose = () => {
        obs.disconnect();
        chart.remove();
      };
      await loadCandles();
      try {
        chart.timeScale().fitContent();
      } catch {}
    })();
    return () => dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  useEffect(() => {
    loadCandles();
    if (chartRef.current)
      chartRef.current.applyOptions({ timeScale: { secondsVisible: res !== "D" } });
  }, [res, days]);

  const tfButtons = useMemo(
    () =>
      [
        { label: "1m", res: "1", days: 2 },
        { label: "5m", res: "5", days: 3 },
        { label: "15m", res: "15", days: 7 },
        { label: "1h", res: "60", days: 10 },
        { label: "2h", res: "120", days: 20 },
        { label: "1D", res: "D", days: 365 },
      ] as Array<{ label: string; res: any; days: number }>,
    []
  );

  // AlphaTrend controls
  const [atCoeff, setAtCoeff] = useState(1);
  const [atPeriod, setAtPeriod] = useState(14);
  const [showAT, setShowAT] = useState(true);

  useEffect(() => {
    loadCandles();
    if (alphaSeriesRef.current) alphaSeriesRef.current.applyOptions({ visible: showAT });
    if (alpha2SeriesRef.current) alpha2SeriesRef.current.applyOptions({ visible: showAT });
  }, [atCoeff, atPeriod, showAT]);

  // If we have a hard error, fall back to TradingView widget for a clean UI
  if (err && !loading) {
    const TradingViewChart = require("@/components/TradingViewChart").default;
    return (
      <div>
        <TradingViewChart symbol={ticker} exchange={exchange ?? undefined} height={520} showIntervalBar />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2 text-xs items-center">
        {tfButtons.map((b) => (
          <button
            key={b.label}
            onClick={() => {
              setRes(b.res as any);
              setDays(b.days);
            }}
            className={`px-2 py-1 rounded border ${
              res === b.res ? "bg-black text-white" : "bg-white hover:bg-gray-50"
            }`}
          >
            {b.label}
          </button>
        ))}
        <span className="mx-2 h-5 w-px bg-gray-300" />
        <label className="inline-flex items-center gap-1">
          <input type="checkbox" checked={showAT} onChange={(e) => setShowAT(e.target.checked)} />
          AlphaTrend
        </label>
        <label className="inline-flex items-center gap-1">
          Multiplier
          <input type="number" step="0.1" min="0.1" value={atCoeff}
            onChange={(e) => setAtCoeff(parseFloat(e.target.value) || 1)}
            className="w-16 border rounded px-1 py-0.5" />
        </label>
        <label className="inline-flex items-center gap-1">
          Period
          <input type="number" min="2" value={atPeriod}
            onChange={(e) => setAtPeriod(parseInt(e.target.value) || 14)}
            className="w-14 border rounded px-1 py-0.5" />
        </label>
      </div>
      <div className="relative">
        <div
          ref={wrapRef}
          style={{ width: "100%", height: 520, position: "relative" }}
          className="rounded-md border overflow-hidden box-content"
        />
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-white/60 text-gray-700 text-sm">
            Loading…
          </div>
        )}
        {err && !loading && (
          <div className="absolute inset-0 grid place-items-center text-red-600 text-sm">
            {err}
          </div>
        )}
      </div>
    </div>
  );
}
