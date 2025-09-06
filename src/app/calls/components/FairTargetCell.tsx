
"use client";

import { useState, useEffect } from "react";
import { fetchCandles } from "../utils";

interface FairTargetCellProps {
  t: string;
  entry: number | null;
  target: number | null;
}

export default function FairTargetCell({ t, entry, target }: FairTargetCellProps) {
  const [state, setState] = useState<{ fair?: number | null; fit?: 'Conservative' | 'Fair' | 'Stretch' | 'Aggressive' | '-'; fairEta?: number | null } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await fetchCandles(t, 'D', 60);
        if (!alive) return;
        if (!rows.length) {
          setState({ fair: null, fit: '-' });
          return;
        }

        const highs = rows.map((k: any) => Number(k.h));
        const lows = rows.map((k: any) => Number(k.l));
        const closes = rows.map((k: any) => Number(k.c));
        const TR: number[] = [];
        for (let i = 1; i < rows.length; i++) {
          const h = highs[i], l = lows[i], pc = closes[i - 1];
          if ([h, l, pc].every(Number.isFinite)) {
            TR.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
          }
        }
        const period = 14;
        const atr = TR.length >= period ? TR.slice(-period).reduce((a, b) => a + b, 0) / period : null;
        const lastClose = closes[closes.length - 1];
        const lookback = 20;
        const recentHigh = Math.max(...highs.slice(-lookback));
        const recentLow = Math.min(...lows.slice(-lookback));
        let base = entry ?? lastClose;
        if (!Number.isFinite(base) || base == null) base = lastClose;
        let fair = null as number | null;
        let dir: 1 | -1 = 1;
        if (target != null && Number.isFinite(base as number)) {
          dir = (target as number) >= (base as number) ? 1 : -1;
        }
        let k = 2.0;
        try {
          const taR = await fetch(`/api/ta/${encodeURIComponent(t)}?tf=D`, { cache: 'no-store' });
          const taJ = await taR.json();
          const label = String(taJ?.summary || 'Neutral');
          if (label.includes('Strong Buy')) k = 2.8;
          else if (label.includes('Buy')) k = 2.2;
          else if (label.includes('Neutral')) k = 1.6;
          else if (label.includes('Sell')) k = 1.3;
          else if (label.includes('Strong Sell')) k = 1.0;
        } catch {}
        if (Number.isFinite(base)) {
          if (dir === 1) {
            const atrTargetUp = atr != null ? (base as number) + k * atr : null;
            fair = Math.max(atrTargetUp ?? 0, Number.isFinite(recentHigh) ? recentHigh : 0) || null;
          } else {
            const atrTargetDn = atr != null ? (base as number) - k * atr : null;
            fair = Math.min(atrTargetDn ?? Number.POSITIVE_INFINITY, Number.isFinite(recentLow) ? recentLow : Number.POSITIVE_INFINITY);
            if (!Number.isFinite(fair as number)) fair = atrTargetDn;
          }
        }
        let fit: 'Conservative' | 'Fair' | 'Stretch' | 'Aggressive' | '-' = '-';
        if (target != null && fair != null && Number.isFinite(base as number)) {
          const distT = Math.abs((target as number) - (base as number));
          const distF = Math.abs((fair as number) - (base as number));
          if (distF > 0) {
            const ratio = distT / distF;
            if (ratio <= 0.8) fit = 'Conservative';
            else if (ratio < 1.2) fit = 'Fair';
            else if (ratio < 1.5) fit = 'Stretch';
            else fit = 'Aggressive';
          }
        }
        let fairEta: number | null = null;
        if (atr && Number.isFinite(base as number) && fair != null) {
          const distFair = Math.abs((fair as number) - (base as number));
          fairEta = distFair > 0 && atr > 0 ? Math.max(1, Math.ceil(distFair / atr)) : null;
        }
        setState({ fair, fit, fairEta });
      } catch { if (alive) setState({ fair: null, fit: '-' }); }
    })();
    return () => { alive = false; };
  }, [t, entry, target]);

  const fairTxt = state?.fair == null ? '—' : state.fair.toFixed(2);
  const fit = state?.fit ?? '-';
  const color = fit === 'Fair' ? 'text-green-700' : fit === 'Conservative' ? 'text-gray-600' : fit === 'Stretch' ? 'text-amber-600' : fit === 'Aggressive' ? 'text-red-600' : '';

  return (
    <>
      <td className="p-2 border bg-brand-soft" title={state?.fairEta ? `Fair ETA: ${state.fairEta} days` : ''}>{fairTxt}</td>
      <td className={`p-2 border whitespace-nowrap ${color}`}>{fit}</td>
    </>
  );
}
