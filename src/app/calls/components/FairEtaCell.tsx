
"use client";

import { useState, useEffect } from "react";

interface FairEtaCellProps {
  t: string;
  entry: number | null;
  target: number | null;
}

export default function FairEtaCell({ t, entry, target }: FairEtaCellProps) {
  const [eta, setEta] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Fetch candles and indicators
        const [cj, ij, tj] = await Promise.all([
          fetch(`/api/price/candles/${encodeURIComponent(t)}?res=D&days=60`, { cache: 'no-store' }).then(r=>r.json()),
          fetch(`/api/ta/indicators/${encodeURIComponent(t)}`, { cache: 'no-store' }).then(r=>r.json()).catch(()=>({})),
          fetch(`/api/ta/${encodeURIComponent(t)}?tf=D`, { cache: 'no-store' }).then(r=>r.json()).catch(()=>({ summary: 'Neutral' })),
        ]);
        const rows: any[] = Array.isArray(cj?.candles) ? cj.candles : [];
        if (!alive || !rows.length) { if (alive) setEta(null); return; }

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
        const lastClose = closes[closes.length - 1];
        let base = entry ?? lastClose;
        if (!Number.isFinite(base as number) || atr == null || !(atr > 0)) { if (alive) setEta(null); return; }

        // Direction from target; default long
        let dir: 1 | -1 = 1;
        if (target != null && Number.isFinite(base as number)) dir = (target as number) >= (base as number) ? 1 : -1;

        // Use the same k as Fair Target cell (based on TA summary)
        const label = String(tj?.summary || 'Neutral');
        let k = 2.0;
        if (label.includes('Strong Buy')) k = 2.8; else if (label.includes('Buy')) k = 2.2; else if (label.includes('Neutral')) k = 1.6; else if (label.includes('Sell')) k = 1.3; else if (label.includes('Strong Sell')) k = 1.0;

        // Compute fair with extremes consistency
        const lookback = 20;
        const recentHigh = Math.max(...highs.slice(-lookback));
        const recentLow = Math.min(...lows.slice(-lookback));
        let fair: number | null = null;
        if (dir === 1) {
          const atrUp = (base as number) + k * atr;
          fair = Math.max(atrUp, Number.isFinite(recentHigh) ? recentHigh : 0) || null;
        } else {
          const atrDn = (base as number) - k * atr;
          fair = Math.min(atrDn, Number.isFinite(recentLow) ? recentLow : Number.POSITIVE_INFINITY);
          if (!Number.isFinite(fair as number)) fair = atrDn;
        }

        if (fair == null) { if (alive) setEta(null); return; }

        // Velocity model: ATR scaled by momentum features and average absolute close move
        const avgAbsMove = (() => {
          let s = 0, n = 0;
          for (let i = 1; i < closes.length; i++) {
            const d = Math.abs(closes[i] - closes[i-1]);
            if (Number.isFinite(d)) { s += d; n++; }
          }
          return n > 0 ? s / n : null;
        })();
        let v = Math.max(atr * 0.6, (avgAbsMove ?? 0)); // base velocity in $/day

        // Momentum multipliers from indicators
        const emaAligned = !!ij?.emaAligned;
        const vwapDistPct = Number.isFinite(ij?.vwapDistPct) ? Number(ij.vwapDistPct) : null;
        const macdSlope3 = Number.isFinite(ij?.macdSlope3) ? Number(ij.macdSlope3) : null;
        let m = 1.0;
        if (emaAligned) m += 0.15; // aligned trend travels faster
        if (macdSlope3 != null) m += (dir === 1 ? macdSlope3 : -macdSlope3) > 0 ? 0.10 : -0.05;
        if (vwapDistPct != null) m += (dir === 1 ? vwapDistPct : -vwapDistPct) > 0 ? 0.05 : -0.05;
        m = Math.min(1.6, Math.max(0.6, m));
        v = v * m;

        const dist = Math.abs((fair as number) - (base as number));
        const days = dist > 0 && v > 0 ? Math.max(1, Math.ceil(dist / v)) : null;
        if (alive) setEta(days);
      } catch { if (alive) setEta(null); }
    })();
    return () => { alive = false; };
  }, [t, entry, target]);

  return <td className="p-2 border">{eta == null ? '—' : eta}</td>;
}
