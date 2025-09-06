"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/AuthContext";
import { useRouter } from "next/navigation";

export default function QuickOpenCallPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [entry, setEntry] = useState("");
  const [target, setTarget] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [hintPrice, setHintPrice] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [fairTarget, setFairTarget] = useState<number | null>(null);
  const [fairEta, setFairEta] = useState<number | null>(null);
  const [targetFit, setTargetFit] = useState<'Conservative' | 'Fair' | 'Stretch' | 'Aggressive' | '-' >('-');
  const [momentum, setMomentum] = useState<{ label: 'Buy' | 'Sell' | 'Neutral' | null; pct?: number | null }>({ label: null });
  const [taLabel, setTaLabel] = useState<string>('Neutral');
  const [atrVal, setAtrVal] = useState<number | null>(null);
  const [baseUsed, setBaseUsed] = useState<number | null>(null);
  const [kMult, setKMult] = useState<number>(2.0);
  const [dirLabel, setDirLabel] = useState<'Long' | 'Short'>('Long');
  const [attachReason, setAttachReason] = useState(true);
  const [lastResp, setLastResp] = useState<any|null>(null);
  const [fairValue, setFairValue] = useState<number | null>(null);
  const [goodBuy, setGoodBuy] = useState<boolean | null>(null);
  const [goodReasons, setGoodReasons] = useState<string[]>([]);
  const [analystFair, setAnalystFair] = useState<{ mean: number | null; high: number | null; low: number | null; analysts: number | null; upsidePct: number | null } | null>(null);
  const [fundFair, setFundFair] = useState<{ fair: number | null; reasons: string[] } | null>(null);

  if (!user || (user.role !== "admin" && user.role !== "analyst")) {
    return <div className="p-4 text-sm">You are not authorized to view this page.</div>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setOk(""); setLoading(true);
    try {
      const r = await fetch('/api/admin/quick-open-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: ticker.trim().toUpperCase(),
          entry_price: Number(entry),
          target_price: Number(target),
          is_public: isPublic,
          note: attachReason ? buildReason() : undefined,
        }),
      });
      const j = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(j.error || 'Failed');
      setOk('Call opened');
      setLastResp(j);
    } catch (e: any) {
      setErr(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const buildReason = () => {
    const t = ticker.trim().toUpperCase();
    const parts: string[] = [];
    if (t) parts.push(`[${t}] ${dirLabel}`);
    if (momentum.label) parts.push(`Flow(5m): ${momentum.label}${momentum.pct!=null?` ${momentum.pct.toFixed(0)}%`:''}`);
    if (baseUsed != null) parts.push(`Base ${baseUsed.toFixed(2)}`);
    if (atrVal != null) parts.push(`ATR14 ${atrVal.toFixed(2)}`);
    parts.push(`k ${kMult.toFixed(2)} (${taLabel})`);
    if (fairTarget != null) parts.push(`Fair ${fairTarget.toFixed(2)}${fairEta!=null?` • ETA ~ ${fairEta}d`:''}`);
    if (target) parts.push(`T1 ${target}`);
    return parts.join(' | ');
  };

  // Auto-fetch current price when ticker changes; offer quick-fill for Entry
  useEffect(() => {
    let alive = true;
    const t = ticker.trim().toUpperCase();
    if (!t) { setHintPrice(null); return; }
    setLoadingPrice(true);
    (async () => {
      try {
        const r = await fetch(`/api/price/${encodeURIComponent(t)}`, { cache: 'no-store' });
        const j = await r.json();
        if (!alive) return;
        if (r.ok && typeof j?.price === 'number') {
          setHintPrice(j.price);
          // If entry is empty, prefill with current price
          setEntry((prev) => (prev ? prev : String(j.price)));
        } else {
          setHintPrice(null);
        }
      } catch {
        if (alive) setHintPrice(null);
      } finally {
        if (alive) setLoadingPrice(false);
      }
    })();
    return () => { alive = false; };
  }, [ticker]);

  // Blended fair value + good-to-buy check for context
  useEffect(() => {
    let alive = true;
    const t = ticker.trim().toUpperCase();
    if (!t) { setFairValue(null); setGoodBuy(null); setGoodReasons([]); return; }
    (async () => {
      try {
        const r = await fetch(`/api/valuation/fair/${encodeURIComponent(t)}`, { cache: 'no-store' });
        const j = await r.json();
        if (!alive) return;
        if (r.ok) {
          setFairValue(typeof j?.fairValue === 'number' ? j.fairValue : null);
          setGoodBuy(j?.isGoodBuy ?? null);
          setGoodReasons(Array.isArray(j?.reasons) ? j.reasons : []);
        } else { setFairValue(null); setGoodBuy(null); setGoodReasons([]); }
      } catch { if (alive) { setFairValue(null); setGoodBuy(null); setGoodReasons([]); } }
    })();
    return () => { alive = false; };
  }, [ticker]);

  // Analyst fair (Yahoo target mean) and Fundamental fair (multiples heuristic)
  useEffect(() => {
    let alive = true;
    const t = ticker.trim().toUpperCase();
    if (!t) { setAnalystFair(null); setFundFair(null); return; }
    (async () => {
      try {
        const [a, f] = await Promise.all([
          fetch(`/api/valuation/analyst/${encodeURIComponent(t)}`, { cache: 'no-store' }).then(r=>r.json()).catch(()=>null),
          fetch(`/api/valuation/fundamental/${encodeURIComponent(t)}`, { cache: 'no-store' }).then(r=>r.json()).catch(()=>null),
        ]);
        if (!alive) return;
        if (a && !a.error) setAnalystFair({ mean: a.targetMean ?? null, high: a.targetHigh ?? null, low: a.targetLow ?? null, analysts: a.analysts ?? null, upsidePct: a.upsidePct ?? null }); else setAnalystFair(null);
        if (f && !f.error) setFundFair({ fair: f.fairFundamental ?? null, reasons: Array.isArray(f.reasons)? f.reasons: [] }); else setFundFair(null);
      } catch { if (alive) { setAnalystFair(null); setFundFair(null); } }
    })();
    return () => { alive = false; };
  }, [ticker]);

  // Compute fair target (ATR + 20D high/low heuristic) whenever ticker/entry/target change
  useEffect(() => {
    let alive = true;
    const t = ticker.trim().toUpperCase();
    if (!t) { setFairTarget(null); setFairEta(null); setTargetFit('-'); return; }
    (async () => {
      try {
        const j = await fetch(`/api/price/candles/${encodeURIComponent(t)}?res=D&days=60`, { cache: 'no-store' }).then(r=>r.json());
        const rows = Array.isArray(j?.candles) ? j.candles : [];
        if (!rows.length) { if (alive) { setFairTarget(null); setTargetFit('-'); } return; }
        const highs = rows.map((k:any)=>Number(k.h));
        const lows  = rows.map((k:any)=>Number(k.l));
        const closes= rows.map((k:any)=>Number(k.c));
        const TR: number[] = [];
        for (let i=1;i<rows.length;i++){
          const h=highs[i], l=lows[i], pc=closes[i-1];
          if ([h,l,pc].every(Number.isFinite)) TR.push(Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc)));
        }
        const period = 14;
        const atr = TR.length >= period ? TR.slice(-period).reduce((a,b)=>a+b,0)/period : null;
        let base = entry ? Number(entry) : closes[closes.length-1];
        if (!Number.isFinite(base as number)) { if (alive) { setFairTarget(null); setTargetFit('-'); } return; }
        // direction from target if provided; default long
        let dir: 1 | -1 = 1;
        if (target) dir = Number(target) >= (base as number) ? 1 : -1;
        const lookback = 20;
        const recentHigh = Math.max(...highs.slice(-lookback));
        const recentLow  = Math.min(...lows.slice(-lookback));
        // Dynamic ATR multiplier from TA summary
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
          if (alive) setTaLabel(label);
        } catch {}
        let fair: number | null = null;
        if (atr != null) {
          if (dir === 1) {
            const atrUp = (base as number) + k * atr;
            fair = Math.max(atrUp, Number.isFinite(recentHigh) ? recentHigh : 0) || null;
          } else {
            const atrDn = (base as number) - k * atr;
            fair = Math.min(atrDn, Number.isFinite(recentLow) ? recentLow : Number.POSITIVE_INFINITY);
            if (!Number.isFinite(fair as number)) fair = atrDn;
          }
        }
        if (alive) {
          setAtrVal(atr);
          setBaseUsed(base as number);
          setKMult(k);
          setDirLabel(dir===1?'Long':'Short');
          setFairTarget(fair);
        }
        // Fit if user provided target
        let fit: typeof targetFit = '-';
        if (target && fair != null && Number.isFinite(base as number)) {
          const tnum = Number(target);
          const distT = Math.abs(tnum - (base as number));
          const distF = Math.abs((fair as number) - (base as number));
          if (distF > 0) {
            const ratio = distT / distF;
            if (ratio <= 0.8) fit = 'Conservative';
            else if (ratio < 1.2) fit = 'Fair';
            else if (ratio < 1.5) fit = 'Stretch';
            else fit = 'Aggressive';
          }
        }
        if (alive) setTargetFit(fit);
        // Fair ETA in trading days using velocity model (ATR blended with recent close-to-close move and momentum)
        if (alive) {
          let avgAbsMove = 0, nAbs = 0;
          for (let i=1;i<closes.length;i++){ const d = Math.abs(closes[i]-closes[i-1]); if (Number.isFinite(d)) { avgAbsMove += d; nAbs++; } }
          avgAbsMove = nAbs>0 ? (avgAbsMove/nAbs) : 0;
          let v = (atr != null ? Math.max(atr*0.6, avgAbsMove) : avgAbsMove);
          try {
            const ind = await fetch(`/api/ta/indicators/${encodeURIComponent(t)}`, { cache: 'no-store' }).then(r=>r.json()).catch(()=>({}));
            const emaAligned = !!ind?.emaAligned;
            const vwapDistPct = Number.isFinite(ind?.vwapDistPct) ? Number(ind.vwapDistPct) : null;
            const macdSlope3 = Number.isFinite(ind?.macdSlope3) ? Number(ind.macdSlope3) : null;
            let m = 1.0;
            if (emaAligned) m += 0.15;
            if (macdSlope3 != null) m += (dir === 1 ? macdSlope3 : -macdSlope3) > 0 ? 0.10 : -0.05;
            if (vwapDistPct != null) m += (dir === 1 ? vwapDistPct : -vwapDistPct) > 0 ? 0.05 : -0.05;
            m = Math.min(1.6, Math.max(0.6, m));
            v = v * m;
          } catch {}
          const dist = fair != null ? Math.abs((fair as number) - (base as number)) : null;
          const days = (dist != null && v > 0) ? Math.max(1, Math.ceil(dist / v)) : null;
          setFairEta(days);
        }
      } catch { if (alive) { setFairTarget(null); setFairEta(null); setTargetFit('-'); } }
    })();
    return () => { alive = false; };
  }, [ticker, entry, target]);

  // Lightweight 5m momentum fetch
  useEffect(() => {
    let alive = true;
    const t = ticker.trim().toUpperCase();
    if (!t) { setMomentum({ label: null }); return; }
    (async () => {
      try {
        const r = await fetch(`/api/price/flow/${encodeURIComponent(t)}?window=5m`, { cache: 'no-store' });
        const j = await r.json();
        if (!alive) return;
        const buy = Number(j?.buyVol || 0), sell = Number(j?.sellVol || 0);
        const total = buy + sell;
        const buyPct = total>0 && j?.buyPct!=null ? Number(j.buyPct) : (total>0 ? (buy/total)*100 : null);
        let label: 'Buy' | 'Sell' | 'Neutral' | null = null;
        if (buyPct == null) label = null; else if (buyPct >= 55) label = 'Buy'; else if (buyPct <= 45) label = 'Sell'; else label = 'Neutral';
        setMomentum({ label, pct: buyPct });
      } catch { if (alive) setMomentum({ label: null }); }
    })();
    return () => { alive = false; };
  }, [ticker]);

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-3">Quick Open Call</h1>
      {err && <div className="text-sm text-red-600 mb-2">{err}</div>}
      {ok && (
        <div className="text-sm text-green-600 mb-2">
          {ok}
          {lastResp && (
            <div className="mt-2 text-xs text-gray-800 bg-green-50 border rounded p-2">
              <div><span className="font-medium">Type:</span> {lastResp.type ?? (Number(target) >= Number(entry) ? 'buy' : 'sell')}</div>
              <div><span className="font-medium">Default Stop:</span> {typeof lastResp.stop==='number' ? lastResp.stop.toFixed(4) : '—'}</div>
              {fairTarget != null && (
                <div><span className="font-medium">Fair/ETA:</span> {fairTarget.toFixed(2)}{fairEta!=null?` • ~${fairEta}d`:''}</div>
              )}
              <div className="mt-1">
                <a className="brand-link underline" href={lastResp.stockId ? `/stocks/${lastResp.stockId}` : '#'}>View stock »</a>
              </div>
            </div>
          )}
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="text-xs block mb-1">Ticker</label>
          <input value={ticker} onChange={(e)=>setTicker(e.target.value.toUpperCase())} className="w-full border rounded px-2 py-1" placeholder="AAPL" maxLength={8} required />
          <div className="text-xs text-gray-600 mt-1">
            {loadingPrice ? 'Fetching current price…' : hintPrice != null ? `Current: ${hintPrice.toFixed(2)}` : ''}
          </div>
        </div>
        {/* Fair value and Good-to-Buy context */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="border rounded p-2">
            <div className="text-gray-600">Fair Value</div>
            <div className="font-medium">{fairValue==null? '—' : fairValue.toFixed(2)}</div>
          </div>
          <div className="border rounded p-2">
            <div className="text-gray-600">Good To Buy</div>
            <div className="mt-0.5">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${goodBuy==null? 'bg-gray-100 text-gray-700' : goodBuy? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>{goodBuy==null? '—' : goodBuy? 'Good' : 'Wait'}</span>
            </div>
            {goodReasons.length>0 && <div className="mt-1 text-[11px] text-gray-600">{goodReasons.join(' • ')}</div>}
          </div>
          <div className="border rounded p-2">
            <div className="text-gray-600">Analyst Fair (Yahoo)</div>
            <div className="font-medium">{analystFair?.mean==null? '—' : analystFair.mean.toFixed(2)}</div>
            <div className="text-[11px] text-gray-600 mt-0.5">
              {analystFair?.upsidePct!=null ? `Upside ${analystFair.upsidePct.toFixed(1)}%` : ''}
              {analystFair?.analysts!=null ? ` • ${analystFair.analysts} analysts` : ''}
            </div>
          </div>
          <div className="border rounded p-2">
            <div className="text-gray-600">Fundamental Fair</div>
            <div className="font-medium">{fundFair?.fair==null? '—' : fundFair.fair.toFixed(2)}</div>
            {fundFair?.reasons?.length ? <div className="text-[11px] text-gray-600 mt-0.5">{fundFair.reasons.join(' • ')}</div> : null}
          </div>
        </div>
        <div>
          <label className="text-xs block mb-1">Entry</label>
          <div className="flex items-center gap-2">
            <input value={entry} onChange={(e)=>setEntry(e.target.value)} className="w-full border rounded px-2 py-1" type="number" step="0.0001" required />
            <button type="button" className="text-xs underline" disabled={hintPrice==null} onClick={() => {
              if (hintPrice != null) setEntry(String(hintPrice));
            }}>Use current</button>
          </div>
        </div>
        <div>
          <label className="text-xs block mb-1">Target</label>
          <input value={target} onChange={(e)=>setTarget(e.target.value)} className="w-full border rounded px-2 py-1" type="number" step="0.0001" required />
          <div className="text-xs text-gray-600 mt-1">
            {fairTarget != null && (
              <>
                Fair: <span className="font-medium">{fairTarget.toFixed(2)}</span>
                {fairEta != null && <span className="ml-2">ETA ~ {fairEta}d</span>}
                {target && targetFit !== '-' && (
                  <span className={`ml-2 ${targetFit==='Fair'?'text-green-700':targetFit==='Conservative'?'text-gray-600':targetFit==='Stretch'?'text-amber-600':'text-red-600'}`}>({targetFit})</span>
                )}
                <button type="button" className="ml-2 text-xs underline" onClick={()=>setTarget(String(fairTarget))}>Use fair</button>
              </>
            )}
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-xs">
          <input type="checkbox" checked={isPublic} onChange={(e)=>setIsPublic(e.target.checked)} />
          Public
        </label>
        <div className="text-xs text-gray-700">
          Momentum 5m: {momentum.label ? (
            <span className={`${momentum.label==='Buy'?'text-green-600':momentum.label==='Sell'?'text-red-600':'text-gray-700'} font-medium`}>
              {momentum.label}{momentum.pct!=null?` • ${momentum.pct.toFixed(0)}%`:''}
            </span>
          ) : '—'}
        </div>
        <div>
          <label className="text-xs block mb-1">Reason (auto)</label>
          <textarea readOnly className="w-full border rounded p-2 text-xs" rows={2} value={buildReason()} />
          <div className="flex items-center justify-between mt-1">
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={attachReason} onChange={(e)=>setAttachReason(e.target.checked)} />
              Attach as note
            </label>
            <button type="button" className="text-xs underline" onClick={() => { navigator.clipboard?.writeText(buildReason()).catch(()=>{}); }}>Copy</button>
          </div>
        </div>
        <button disabled={loading} className="w-full btn-brand rounded py-2 disabled:opacity-60">{loading?'Submitting…':'Open Call'}</button>
      </form>
    </div>
  );
}
