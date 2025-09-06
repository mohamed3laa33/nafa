"use client";

import { useEffect, useState } from "react";

export default function FairValueCell({ t }: { t: string }) {
  const [fair, setFair] = useState<number | null>(null);
  const [disc, setDisc] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/valuation/fair/${encodeURIComponent(t)}`, { cache: 'no-store' });
        const j = await r.json();
        if (!alive) return;
        if (r.ok) {
          setFair(typeof j?.fairValue === 'number' ? j.fairValue : null);
          setDisc(typeof j?.discountPct === 'number' ? j.discountPct : (j?.fairValue!=null && j?.last!=null ? ((j.fairValue - j.last)/j.fairValue)*100 : null));
        } else { setFair(null); setDisc(null); }
      } catch { if (alive) { setFair(null); setDisc(null); } }
    })();
    return () => { alive = false; };
  }, [t]);
  const fmt = (n: number | null) => (n==null? '—' : n.toFixed(2));
  const discTxt = disc==null? '—' : `${disc>=0?'+':''}${disc.toFixed(2)}%`;
  const discCls = disc==null? '' : disc>=2 ? 'text-green-700 font-medium' : disc<=-2 ? 'text-red-700 font-medium' : 'text-gray-700';
  return (
    <td className="p-2 border" title="Blended 20D VWAP/EMA20/Channel Mid">
      <div className="flex flex-col items-start">
        <div>{fmt(fair)}</div>
        <div className={`text-xs ${discCls}`}>Disc: {discTxt}</div>
      </div>
    </td>
  );
}

