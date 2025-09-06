"use client";

import { useEffect, useState } from "react";

export default function AnalystFairCell({ t }: { t: string }) {
  const [mean, setMean] = useState<number | null>(null);
  const [upside, setUpside] = useState<number | null>(null);
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/valuation/analyst/${encodeURIComponent(t)}`, { cache: 'no-store' });
        const j = await r.json();
        if (!alive) return;
        if (r.ok) { setMean(j?.targetMean ?? null); setUpside(j?.upsidePct ?? null); setN(j?.analysts ?? null); }
        else { setMean(null); setUpside(null); setN(null); }
      } catch { if (alive) { setMean(null); setUpside(null); setN(null); } }
    })();
    return () => { alive = false; };
  }, [t]);
  const fmt = (n: number | null) => (n==null? '—' : n.toFixed(2));
  const upTxt = upside==null? '' : `${upside>=0?'+':''}${upside.toFixed(1)}%`;
  const upCls = upside==null? '' : upside>=0 ? 'text-green-700' : 'text-red-700';
  return (
    <td className="p-2 border" title={n!=null?`${n} analysts`:''}>
      <div className="flex flex-col items-start">
        <div>{fmt(mean)}</div>
        <div className={`text-xs ${upCls}`}>{upTxt}</div>
      </div>
    </td>
  );
}

