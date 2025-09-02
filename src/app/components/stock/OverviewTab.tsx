import { StockData } from "@/app/stocks/[id]/page";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const TradingViewChart = dynamic(() => import("@/components/TradingViewChart"), { ssr: false });
const TechnicalAnalysisWidget = dynamic(() => import("@/components/TechnicalAnalysisWidget"), { ssr: false });
const TechnicalSummaryChips = dynamic(() => import("@/components/TechnicalSummaryChips"), { ssr: false });
const KeyStats = dynamic(() => import("@/components/KeyStats"), { ssr: false });

function fmtNum(n: unknown, suffix = "") {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : Number(n);
  return Number.isFinite(v) ? `${v.toFixed(2)}${suffix}` : "—";
}

export default function OverviewTab({ stock }: { stock: StockData }) {
  const c = stock.latestOpenCall || null;
  const [profile, setProfile] = useState<any>(null);
  const [flow, setFlow] = useState<any>(null);
  const [flow1h, setFlow1h] = useState<any>(null);
  const [flow5m, setFlow5m] = useState<any>(null);
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
        const [f, f1, f5] = await Promise.all([
          fetch(`/api/price/flow/${encodeURIComponent(stock.ticker)}`, { cache: 'no-store' }),
          fetch(`/api/price/flow/${encodeURIComponent(stock.ticker)}?window=1h`, { cache: 'no-store' }),
          fetch(`/api/price/flow/${encodeURIComponent(stock.ticker)}?window=5m`, { cache: 'no-store' }),
        ]);
        const [fj, fj1, fj5] = await Promise.all([f.json().catch(()=>({})), f1.json().catch(()=>({})), f5.json().catch(()=>({}))]);
        if (live) {
          if (f.ok) setFlow(fj);
          if (f1.ok) setFlow1h(fj1);
          if (f5.ok) setFlow5m(fj5);
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
              <div className="font-semibold mb-0.5">1 Day</div>
              <div>Buy: {flow?.buyVol ? flow.buyVol.toLocaleString() : '—'}</div>
              <div>Sell: {flow?.sellVol ? flow.sellVol.toLocaleString() : '—'}</div>
              <div className="text-gray-600">Buy %: {flow?.buyPct != null ? flow.buyPct.toFixed(1) + '%' : '—'}</div>
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

        {!c ? (
          <p>No open calls.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="nf-table min-w-[640px]">
              <thead className="bg-gray-50 text-left text-sm">
                <tr>
                  <th className="p-2">Status</th>
                  <th className="p-2">Entry</th>
                  <th className="p-2">Stop</th>
                  <th className="p-2">T1</th>
                  <th className="p-2">T2</th>
                  <th className="p-2">T3</th>
                  <th className="p-2">Horizon (d)</th>
                  <th className="p-2">Opened</th>
                  <th className="p-2">Expires</th>
                  <th className="p-2">Outcome</th>
                  <th className="p-2">Hit</th>
                  <th className="p-2">Close Px</th>
                  <th className="p-2">Result %</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-t">
                  <td className="p-2">{c.status ?? "—"}</td>
                  <td className="p-2">{fmtNum(c.entry)}</td>
                  <td className="p-2">{fmtNum(c.stop)}</td>
                  <td className="p-2">{fmtNum(c.t1)}</td>
                  <td className="p-2">{fmtNum(c.t2)}</td>
                  <td className="p-2">{fmtNum(c.t3)}</td>
                  <td className="p-2">{c.horizon_days ?? "—"}</td>
                  {/* show raw ISO strings to avoid hydration issues */}
                  <td className="p-2">{c.opened_at ?? "—"}</td>
                  <td className="p-2">{c.expires_at ?? "—"}</td>
                  <td className="p-2">{c.outcome ?? "—"}</td>
                  <td className="p-2">{c.which_target_hit ?? "—"}</td>
                  <td className="p-2">{fmtNum(c.close_price)}</td>
                  <td className="p-2">{fmtNum(c.result_pct, "%")}</td>
                </tr>
              </tbody>
            </table>
            {c.notes && <p className="mt-2 text-sm text-gray-700">Notes: {c.notes}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
