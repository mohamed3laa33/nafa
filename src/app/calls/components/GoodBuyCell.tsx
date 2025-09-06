"use client";

import { useEffect, useState } from "react";

export default function GoodBuyCell({ t }: { t: string }) {
  const [good, setGood] = useState<boolean | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/valuation/fair/${encodeURIComponent(t)}`, { cache: 'no-store' });
        const j = await r.json();
        if (!alive) return;
        if (r.ok) { setGood(j?.isGoodBuy ?? null); setReasons(Array.isArray(j?.reasons)? j.reasons: []); }
        else { setGood(null); setReasons([]); }
      } catch { if (alive) { setGood(null); setReasons([]); } }
    })();
    return () => { alive = false; };
  }, [t]);
  const badgeCls = good==null ? 'bg-gray-100 text-gray-700' : good ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800';
  const label = good==null? '—' : good ? 'Good' : 'Wait';
  const title = reasons.join(' • ');
  return (
    <td className="p-2 border text-center" title={title}>
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${badgeCls}`}>{label}</span>
    </td>
  );
}

