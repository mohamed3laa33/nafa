"use client";

import { useEffect, useState } from "react";

export default function FundamentalFairCell({ t }: { t: string }) {
  const [fair, setFair] = useState<number | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/valuation/fundamental/${encodeURIComponent(t)}`, { cache: 'no-store' });
        const j = await r.json();
        if (!alive) return;
        if (r.ok) { setFair(j?.fairFundamental ?? null); setReasons(Array.isArray(j?.reasons)? j.reasons: []); }
        else { setFair(null); setReasons([]); }
      } catch { if (alive) { setFair(null); setReasons([]); } }
    })();
    return () => { alive = false; };
  }, [t]);
  const fmt = (n: number | null) => (n==null? '—' : n.toFixed(2));
  return (
    <td className="p-2 border" title={reasons.join(' • ')}>
      {fmt(fair)}
    </td>
  );
}

