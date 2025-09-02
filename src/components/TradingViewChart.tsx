"use client";

import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    TradingView?: any;
  }
}

type Props = {
  symbol: string; // e.g., AAPL or NASDAQ:AAPL
  exchange?: string; // e.g., NASDAQ, NYSE
  interval?: "1" | "3" | "5" | "15" | "30" | "60" | "120" | "180" | "240" | "D" | "W" | "M";
  theme?: "light" | "dark";
  studies?: string[]; // e.g., ["RSI@tv-basicstudies"]
  height?: number;
  showIntervalBar?: boolean;
};

function loadTvScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TradingView) return resolve();
    const existing = document.querySelector<HTMLScriptElement>("script[data-tv-widget]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("tv.js failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/tv.js";
    s.async = true;
    s.defer = true;
    s.setAttribute("data-tv-widget", "true");
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("tv.js failed to load"));
    document.head.appendChild(s);
  });
}

export default function TradingViewChart({ symbol, exchange, interval = "D", theme, studies, height = 500, showIntervalBar = true }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerIdRef = useRef<string>(`tv_container_${Math.random().toString(36).slice(2)}`);
  const [ready, setReady] = useState(false);
  const widgetRef = useRef<any>(null);

  const resolvedTheme = theme ?? (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  // Build full symbol if exchange is provided and not already prefixed
  const tvSymbol = useMemo(() => {
    if (!symbol) return "";
    return symbol.includes(":") ? symbol : exchange ? `${exchange}:${symbol}` : symbol;
  }, [symbol, exchange]);

  useEffect(() => {
    let cancelled = false;
    loadTvScript()
      .then(() => {
        if (cancelled) return;
        setReady(true);
      })
      .catch(() => setReady(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || !window.TradingView || !tvSymbol) return;

    // Clear previous widget if any
    containerRef.current.innerHTML = "";

    try {
      // TradingView requires a string id for container_id
      const w = new window.TradingView.widget({
        autosize: true,
        symbol: tvSymbol,
        interval,
        timezone: "Etc/UTC",
        theme: resolvedTheme,
        style: "1",
        locale: "en",
        toolbar_bg: "rgba(0, 0, 0, 0)",
        enable_publishing: false,
        allow_symbol_change: true,
        hide_top_toolbar: false,
        hide_side_toolbar: false,
        withdateranges: true,
        studies: studies && studies.length ? studies : undefined,
        container_id: containerIdRef.current,
      });
      widgetRef.current = w;
    } catch {
      // ignore
    }
  }, [ready, tvSymbol, interval, resolvedTheme, studies]);

  const setRes = (res: string) => {
    const w = widgetRef.current;
    if (!w || !w.chart) return;
    try { w.chart().setResolution(res, () => {}); } catch {}
  };

  return (
    <div className="w-full" style={{ height }}>
      {showIntervalBar && (
        <div className="flex gap-1 pb-2 text-xs">
          {[
            { label: "1m", v: "1" },
            { label: "1h", v: "60" },
            { label: "2h", v: "120" },
            { label: "1D", v: "D" },
          ].map((b) => (
            <button
              key={b.v}
              onClick={() => setRes(b.v)}
              className="px-2 py-1 border rounded hover:bg-gray-50"
              type="button"
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
      <div id={containerIdRef.current} ref={containerRef} style={{ width: "100%", height: showIntervalBar ? `calc(${height}px - 28px)` : `${height}px` }} />
    </div>
  );
}
