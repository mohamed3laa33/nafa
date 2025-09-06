import { StockData } from "@/app/stocks/[id]/page";
import dynamic from "next/dynamic";
import LatestOpenCall from "@/app/components/stock/LatestOpenCall";
import { useEffect, useMemo, useState } from "react";
import dynamic2 from "next/dynamic";

const TradingViewChart = dynamic(() => import("@/components/TradingViewChart"), { ssr: false });
const TechnicalAnalysisWidget = dynamic(() => import("@/components/TechnicalAnalysisWidget"), { ssr: false });
const TechnicalSummaryChips = dynamic(() => import("@/components/TechnicalSummaryChips"), { ssr: false });
const KeyStats = dynamic(() => import("@/components/KeyStats"), { ssr: false });
const ValuationCard = dynamic2(() => import("@/app/components/stock/ValuationCard"), { ssr: false });

function fmtNum(n: unknown, suffix = "") {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : Number(n);
  return Number.isFinite(v) ? `${v.toFixed(2)}${suffix}` : "—";
}

export default function OverviewTab({ stock }: { stock: StockData }) {
  const c = stock.latestOpenCall || null;
  const [profile, setProfile] = useState<any>(null);
  const [flow, setFlow] = useState<any>(null);    // 1d
  const [flow1h, setFlow1h] = useState<any>(null);
  const [flow2h, setFlow2h] = useState<any>(null);
  const [flow4h, setFlow4h] = useState<any>(null);
  const [flow5m, setFlow5m] = useState<any>(null);
  const [flowDecision, setFlowDecision] = useState<{ label: 'Buy' | 'Neutral' | 'Sell'; avg?: number; reasons?: string[] } | null>(null);
  const [ta1d, setTa1d] = useState<{ summary: string; score: number } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const p = await fetch(`/api/company-profile/${encodeURIComponent(stock.ticker)}`, { cache: 'no-store' });
        const pj = await p.json();
        if (p.ok && live) setProfile(pj);
      } catch {}
      // pull 1D TA for sentiment/score
      try {
        const t = await fetch(`/api/ta/${encodeURIComponent(stock.ticker)}?tf=1D`, { cache: 'no-store' });
        const tj = await t.json();
        if (t.ok && live) setTa1d({ summary: tj.summary, score: tj.score });
      } catch {}
      try {
        const [f, f1, f2, f4, f5] = await Promise.all([
          fetch(`/api/price/flow/${encodeURIComponent(stock.ticker)}`, { cache: 'no-store' }),
          fetch(`/api/price/flow/${encodeURIComponent(stock.ticker)}?window=1h`, { cache: 'no-store' }),
          fetch(`/api/price/flow/${encodeURIComponent(stock.ticker)}?window=2h`, { cache: 'no-store' }),
          fetch(`/api/price/flow/${encodeURIComponent(stock.ticker)}?window=4h`, { cache: 'no-store' }),
          fetch(`/api/price/flow/${encodeURIComponent(stock.ticker)}?window=5m`, { cache: 'no-store' }),
        ]);
        const [fj, fj1, fj2, fj4, fj5] = await Promise.all([
          f.json().catch(()=>({})), f1.json().catch(()=>({})), f2.json().catch(()=>({})), f4.json().catch(()=>({})), f5.json().catch(()=>({}))
        ]);
        if (live) {
          if (f.ok) setFlow(fj);
          if (f1.ok) setFlow1h(fj1);
          if (f2.ok) setFlow2h(fj2);
          if (f4.ok) setFlow4h(fj4);
          if (f5.ok) setFlow5m(fj5);
          // Build a weighted decision across windows
          const parts: Array<{ pct: number; w: number; lbl: string }> = [];
          const add = (js: any, w: number, lbl: string) => {
            if (js && typeof js.buyPct === 'number') parts.push({ pct: js.buyPct, w, lbl });
          };
          add(fj5, 1, '5m'); add(fj1, 2, '1h'); add(fj2, 2, '2h'); add(fj4, 3, '4h'); add(fj, 4, '1d');
          if (parts.length) {
            const wsum = parts.reduce((a,b)=>a+b.w,0);
            const avg = parts.reduce((a,b)=>a+b.pct*b.w,0)/wsum;
            let label: 'Buy' | 'Neutral' | 'Sell' = 'Neutral';
            if (avg >= 58) label = 'Buy'; else if (avg <= 42) label = 'Sell';
            const reasons = parts.map(p => `${p.lbl}: ${p.pct.toFixed(0)}%`);
            setFlowDecision({ label, avg, reasons });
          } else setFlowDecision(null);
        }
      } catch {}
    })();
    return () => { live = false; };
  }, [stock.ticker]);

  const tvExchange = useMemo(() => {
    const ex = String(profile?.exchange || "").toUpperCase();
    if (!ex) return undefined as string | undefined;
    if (ex.includes("NASDAQ")) return "NASDAQ";
    if (ex.includes("NYSE")) return "NYSE";
    if (ex.includes("AMEX") || ex.includes("AMERICAN")) return "AMEX";
    return undefined as string | undefined;
  }, [profile?.exchange]);

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-3">
      <h2 className="text-xl font-bold mb-2">Overview</h2>

      {/* Sentiment + Flow (compact) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="border rounded p-2">
          <p className="font-bold mb-1">Sentiment (1D)</p>
          <p className="text-sm">{ta1d?.summary ?? stock.sentiment ?? '—'}</p>
          <p className="font-bold mt-2 mb-1">Score</p>
          <p className="text-sm">{ta1d?.score ?? stock.score_total ?? '—'}</p>
        </div>
        <div className="border rounded p-2">
          <p className="font-bold mb-1">Buy/Sell Volume</p>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <div className="font-semibold mb-0.5">Last 5m</div>
              <div>Buy: {flow5m?.buyVol ? flow5m.buyVol.toLocaleString() : '—'}</div>
              <div>Sell: {flow5m?.sellVol ? flow5m.sellVol.toLocaleString() : '—'}</div>
              <div className="text-gray-600">Buy %: {flow5m?.buyPct != null ? flow5m.buyPct.toFixed(1) + '%' : '—'}</div>
            </div>
            <div>
              <div className="font-semibold mb-0.5">Last 1h</div>
              <div>Buy: {flow1h?.buyVol ? flow1h.buyVol.toLocaleString() : '—'}</div>
              <div>Sell: {flow1h?.sellVol ? flow1h.sellVol.toLocaleString() : '—'}</div>
              <div className="text-gray-600">Buy %: {flow1h?.buyPct != null ? flow1h.buyPct.toFixed(1) + '%' : '—'}</div>
            </div>
            <div>
              <div className="font-semibold mb-0.5">Last 2h</div>
              <div>Buy: {flow2h?.buyVol ? flow2h.buyVol.toLocaleString() : '—'}</div>
              <div>Sell: {flow2h?.sellVol ? flow2h.sellVol.toLocaleString() : '—'}</div>
              <div className="text-gray-600">Buy %: {flow2h?.buyPct != null ? flow2h.buyPct.toFixed(1) + '%' : '—'}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px] mt-2">
            <div>
              <div className="font-semibold mb-0.5">Last 4h</div>
              <div>Buy: {flow4h?.buyVol ? flow4h.buyVol.toLocaleString() : '—'}</div>
              <div>Sell: {flow4h?.sellVol ? flow4h.sellVol.toLocaleString() : '—'}</div>
              <div className="text-gray-600">Buy %: {flow4h?.buyPct != null ? flow4h.buyPct.toFixed(1) + '%' : '—'}</div>
            </div>
            <div>
              <div className="font-semibold mb-0.5">1 Day</div>
              <div>Buy: {flow?.buyVol ? flow.buyVol.toLocaleString() : '—'}</div>
              <div>Sell: {flow?.sellVol ? flow.sellVol.toLocaleString() : '—'}</div>
              <div className="text-gray-600">Buy %: {flow?.buyPct != null ? flow.buyPct.toFixed(1) + '%' : '—'}</div>
            </div>
            <div className="flex items-end">
              {flowDecision && (
                <div className="text-[11px]">
                  <div className="font-semibold mb-0.5">Flow Decision</div>
                  <div>
                    <span className={`px-2 py-0.5 rounded font-medium ${flowDecision.label==='Buy'?'bg-green-100 text-green-700':flowDecision.label==='Sell'?'bg-red-100 text-red-700':'bg-gray-100 text-gray-700'}`}>
                      {flowDecision.label}
                    </span>
                    {flowDecision.avg!=null && <span className="ml-2 text-gray-600">Avg Buy%: {flowDecision.avg.toFixed(1)}%</span>}
                  </div>
                  {flowDecision.reasons && (
                    <div className="text-gray-600 mt-0.5">{flowDecision.reasons.join(' • ')}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Compact TA summary chips (Investing.com-like) */}
      <div className="mt-4">
        <TechnicalSummaryChips ticker={stock.ticker} />
      </div>

      {/* Key Statistics (small) */}
      <div className="mt-3">
        <KeyStats ticker={stock.ticker} />
      </div>

      {/* Valuation */}
      <ValuationCard ticker={stock.ticker} sector={(profile?.sector as string) || undefined} />

      {/* Technical Analysis summary (smaller cards) */}
      <div className="mt-4">
        <h3 className="text-lg font-bold mb-2">Technical Analysis</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { lbl: '1m', v: '1m' },
            { lbl: '5m', v: '5m' },
            { lbl: '15m', v: '15m' },
            { lbl: '1h', v: '1h' },
            { lbl: '2h', v: '2h' },
            { lbl: '1D', v: '1D' },
          ].map((tf) => (
            <div key={tf.lbl} className="border rounded p-1">
              <div className="text-[10px] mb-1 opacity-70">{tf.lbl}</div>
              <TechnicalAnalysisWidget symbol={stock.ticker} interval={tf.v} height={120} />
            </div>
          ))}
        </div>
      </div>

      {/* Simple daily chart (no indicators) */}
      <div className="mt-4">
        <h3 className="text-lg font-bold mb-2">Chart</h3>
        <div className="border rounded p-1">
          <TradingViewChart symbol={stock.ticker} exchange={tvExchange} interval="D" height={260} showIntervalBar={false} />
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-lg font-bold mb-2">Latest Open Call</h3>
        <LatestOpenCall call={c} ticker={stock.ticker} />
      </div>
    </div>
  );
}
