
"use client";

import { useState, useEffect } from "react";

interface EtaDaysCellProps {
  t: string;
  current: number | null;
  entry: number | null;
  target: number | null;
}

export default function EtaDaysCell({ t, current, entry, target }: EtaDaysCellProps) {
  const [eta, setEta] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (target == null) {
          if (alive) setEta(null);
          return;
        }
        const cj = await fetch(`/api/price/candles/${encodeURIComponent(t)}?res=D&days=60`, { cache: 'no-store' }).then(r=>r.json());
        const rows = Array.isArray(cj?.candles) ? cj.candles : [];
        if (!rows.length) {
          if (alive) setEta(null);
          return;
        }
        const highs = rows.map((k: any) => Number(k.h));
        const lows = rows.map((k: any) => Number(k.l));
        const closes = rows.map((k: any) => Number(k.c));
        const TR: number[] = [];
        for (let i = 1; i < rows.length; i++) {
          const h = highs[i], l = lows[i], pc = closes[i - 1];
          if ([h, l, pc].every(Number.isFinite)) TR.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
        }
        const period = 14;
        const atr = TR.length >= period ? TR.slice(-period).reduce((a, b) => a + b, 0) / period : null;
        const base = (current != null ? current : (entry != null ? entry : closes[closes.length - 1])) as number | null;
        if (atr == null || !Number.isFinite(atr) || !Number.isFinite(base as number)) {
          if (alive) setEta(null);
          return;
        }
        // Use avg absolute close move as base velocity, blended with ATR
        let avgAbsMove = 0, n = 0;
        for (let i=1;i<closes.length;i++){ const d = Math.abs(closes[i]-closes[i-1]); if (Number.isFinite(d)) { avgAbsMove += d; n++; } }
        avgAbsMove = n>0 ? (avgAbsMove/n) : 0;
        let v = Math.max(atr * 0.6, avgAbsMove);
        const dist = Math.abs((target as number) - (base as number));
        const days = dist > 0 && v > 0 ? Math.max(1, Math.ceil(dist / v)) : null;
        if (alive) setEta(days);
      } catch { if (alive) setEta(null); }
    })();
    return () => { alive = false; };
  }, [t, current, entry, target]);

  return <td className="p-2 border">{eta == null ? '—' : eta}</td>;
}
