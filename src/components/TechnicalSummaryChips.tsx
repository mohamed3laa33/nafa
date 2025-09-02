"use client";

import { useEffect, useState } from "react";

type TA = { summary: string } | null;

const TFs = [
  { key: "1m", tf: "1m" },
  { key: "5m", tf: "5m" },
  { key: "15m", tf: "15m" },
  { key: "1h", tf: "1h" },
  { key: "2h", tf: "2h" },
  { key: "1D", tf: "1D" },
];

function color(summary: string | null | undefined) {
  const s = (summary || '').toLowerCase();
  if (s.includes('strong buy')) return 'bg-green-100 text-green-700 border-green-200';
  if (s.includes('buy')) return 'bg-green-50 text-green-700 border-green-200';
  if (s.includes('strong sell')) return 'bg-red-100 text-red-700 border-red-200';
  if (s.includes('sell')) return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
}

export default function TechnicalSummaryChips({ ticker }: { ticker: string }) {
  const [data, setData] = useState<Record<string, TA>>({});

  useEffect(() => {
    let live = true;
    (async () => {
      const entries = await Promise.all(
        TFs.map(async ({ key, tf }) => {
          try {
            const r = await fetch(`/api/ta/${encodeURIComponent(ticker)}?tf=${encodeURIComponent(tf)}`, { cache: 'no-store' });
            const j = await r.json();
            return [key, r.ok ? { summary: j.summary } : null] as const;
          } catch {
            return [key, null] as const;
          }
        })
      );
      if (!live) return;
      const next: Record<string, TA> = {};
      for (const [k, v] of entries) next[k] = v;
      setData(next);
    })();
    return () => { live = false; };
  }, [ticker]);

  return (
    <div className="flex flex-wrap gap-2">
      {TFs.map(({ key }) => {
        const s = data[key]?.summary ?? null;
        return (
          <div key={key} className={`text-xs px-2 py-1 rounded border ${color(s)} whitespace-nowrap`}>{key}: {s ?? '—'}</div>
        );
      })}
    </div>
  );
}

