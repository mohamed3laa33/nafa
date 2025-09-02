"use client";

import { useEffect, useMemo, useState } from "react";

type Candle = { t: number; c: number };

export default function PriceSparkline({ ticker, height = 36, width = 120 }: { ticker: string; height?: number; width?: number }) {
  const [data, setData] = useState<Candle[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setErr("");
      try {
        const r = await fetch(`/api/price/history/${encodeURIComponent(ticker)}`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load history");
        if (alive) setData(Array.isArray(j.candles) ? j.candles : []);
      } catch (e: any) {
        if (alive) setErr(e.message || "Failed to load history");
      }
    })();
    return () => {
      alive = false;
    };
  }, [ticker]);

  const path = useMemo(() => {
    if (!data.length) return "";
    const values = data.map(d => d.c);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const w = width;
    const h = height;
    const step = w / Math.max(1, data.length - 1);
    return data
      .map((d, i) => {
        const x = i * step;
        const y = h - ((d.c - min) / span) * h; // invert y
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [data, width, height]);

  const positive = useMemo(() => {
    if (data.length < 2) return true;
    return data[data.length - 1].c >= data[0].c;
  }, [data]);

  if (err) return <span className="text-xs text-red-600">—</span>;
  if (!data.length) return <span className="text-xs text-gray-400">—</span>;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={path} fill="none" stroke={positive ? "#16a34a" : "#dc2626"} strokeWidth={2} />
    </svg>
  );
}

