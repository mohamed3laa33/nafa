"use client";

import { useEffect, useRef } from "react";

declare global { interface Window { TradingView?: any } }

export default function TechnicalAnalysisWidget({ symbol, exchange, interval = "1m", height = 220, showTabs = false }: { symbol: string; exchange?: string; interval?: string; height?: number; showTabs?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const container = ref.current;
    const t = document.createElement("script");
    t.type = "text/javascript";
    t.async = true;
    t.src = "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js";
    const fullSymbol = exchange ? `${exchange}:${symbol}` : symbol;
    t.innerHTML = JSON.stringify({
      interval,
      width: "100%",
      isTransparent: false,
      height,
      symbol: fullSymbol,
      showIntervalTabs: showTabs,
      displayMode: "regular",
      locale: "en",
    });
    container.innerHTML = "";
    container.appendChild(t);
    return () => { container.innerHTML = ""; };
  }, [symbol, exchange]);
  return <div className="w-full"><div className="tradingview-widget-container" ref={ref} /></div>;
}
