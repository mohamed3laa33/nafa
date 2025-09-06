"use client";

import { useMemo, useState } from "react";

type Metrics = {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgRR: number;
  totalPnL: number;
  maxDrawdownPct: number;
  peakEquity: number;
  troughEquity: number;
};

type CurvePt = { t: number; equity: number };

function Sparkline({ data, width = 640, height = 140 }: { data: CurvePt[]; width?: number; height?: number }) {
  const path = useMemo(() => {
    if (!data?.length) return "";
    const n = data.length;
    const step = Math.max(1, Math.ceil(n / 400));
    const sampled = [] as CurvePt[];
    for (let i = 0; i < n; i += step) sampled.push(data[i]);
    const min = Math.min(...sampled.map(p => p.equity));
    const max = Math.max(...sampled.map(p => p.equity));
    const range = max - min || 1;
    const w = width - 8, h = height - 8;
    const dx = w / Math.max(1, sampled.length - 1);
    const pts = sampled.map((p, i) => {
      const x = 4 + i * dx;
      const y = 4 + (h - ((p.equity - min) / range) * h);
      return `${x},${y}`;
    });
    return `M${pts[0]} L` + pts.slice(1).join(" ");
  }, [data, width, height]);
  const last = data?.[data.length - 1]?.equity ?? 0;
  const first = data?.[0]?.equity ?? 0;
  const color = last >= first ? "#10b981" : "#ef4444"; // green/red
  return (
    <svg width={width} height={height} className="block">
      <rect x="0" y="0" width={width} height={height} rx="6" className="fill-white" />
      <path d={path} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
}

export default function BacktestPage() {
  const [ticker, setTicker] = useState("AAPL");
  const [res, setRes] = useState<'D'|'1'>('D');
  const [days, setDays] = useState(180);
  const [emaPeriod, setEmaPeriod] = useState(20);
  const [rsiPeriod, setRsiPeriod] = useState(7);
  const [rsiEnter, setRsiEnter] = useState(60);
  const [rsiExit, setRsiExit] = useState(50);
  const [atrStopMult, setAtrStopMult] = useState(1.2);
  const [takeProfitR, setTakeProfitR] = useState<string>("");
  const [slippagePct, setSlippagePct] = useState(0);
  const [fee, setFee] = useState(0);
  const [includeTrades, setIncludeTrades] = useState(false);
  const [retMode, setRetMode] = useState<'summary'|'curve'|'full'>('summary');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|undefined>();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [curve, setCurve] = useState<CurvePt[] | null>(null);
  const [trades, setTrades] = useState<any[] | null>(null);
  const [anomalies, setAnomalies] = useState<string[] | null>(null);

  // Forecast tester state
  const [ftTicker, setFtTicker] = useState("AAPL");
  const [ftEntryDaysAgo, setFtEntryDaysAgo] = useState(20);
  const [ftEntryDate, setFtEntryDate] = useState<string>("");
  const [ftEndDate, setFtEndDate] = useState<string>("");
  const [ftMethod, setFtMethod] = useState<'atr_k'|'fair'>('atr_k');
  const [ftK, setFtK] = useState(1.5);
  const [ftDir, setFtDir] = useState<'up'|'down'|'auto'>('up');
  const [ftRes, setFtRes] = useState<any>(null);
  const [ftErr, setFtErr] = useState<string|undefined>();

  // Rolling evaluation
  const [swStart, setSwStart] = useState(120);
  const [swEnd, setSwEnd] = useState(20);
  const [swStep, setSwStep] = useState(5);
  const [swRes, setSwRes] = useState<any>(null);
  const [swErr, setSwErr] = useState<string|undefined>();

  async function runBacktest() {
    setLoading(true); setError(undefined);
    setMetrics(null); setCurve(null); setTrades(null); setAnomalies(null);
    try {
      const body: any = {
        ticker: ticker.trim().toUpperCase(),
        res,
        days,
        strategy: {
          name: 'ema_rsi',
          params: {
            emaPeriod, rsiPeriod, rsiEnter, rsiExit, atrStopMult,
            slippagePct, fee,
          },
        },
        return: retMode,
        includeTrades,
      };
      if (takeProfitR) body.strategy.params.takeProfitR = Number(takeProfitR);
      const r = await fetch('/api/backtest/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), cache: 'no-store'
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Backtest failed');
      setMetrics(j.metrics || null);
      setCurve(j.equityCurve || null);
      setTrades(j.trades || null);
      setAnomalies(Array.isArray(j.anomalies)? j.anomalies : null);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Backtest</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-3 p-4 border rounded">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">Ticker</label>
            <input className="border rounded px-2 py-1" value={ticker} onChange={e=>setTicker(e.target.value)} />
            <label className="text-sm">Resolution</label>
            <select className="border rounded px-2 py-1" value={res} onChange={e=>setRes(e.target.value as any)}>
              <option value="D">Daily</option>
              <option value="1">1-minute</option>
            </select>
            <label className="text-sm">Days</label>
            <input type="number" min={30} max={365} className="border rounded px-2 py-1" value={days} onChange={e=>setDays(Number(e.target.value||0))} />
          </div>
          <hr className="my-2" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">EMA Period</label>
            <input type="number" min={2} max={200} className="border rounded px-2 py-1" value={emaPeriod} onChange={e=>setEmaPeriod(Number(e.target.value||0))} />
            <label className="text-sm">RSI Period</label>
            <input type="number" min={2} max={50} className="border rounded px-2 py-1" value={rsiPeriod} onChange={e=>setRsiPeriod(Number(e.target.value||0))} />
            <label className="text-sm">RSI Enter</label>
            <input type="number" className="border rounded px-2 py-1" value={rsiEnter} onChange={e=>setRsiEnter(Number(e.target.value||0))} />
            <label className="text-sm">RSI Exit</label>
            <input type="number" className="border rounded px-2 py-1" value={rsiExit} onChange={e=>setRsiExit(Number(e.target.value||0))} />
            <label className="text-sm">ATR Stop Mult</label>
            <input type="number" step="0.1" className="border rounded px-2 py-1" value={atrStopMult} onChange={e=>setAtrStopMult(Number(e.target.value||0))} />
            <label className="text-sm">Take Profit (R)</label>
            <input type="number" step="0.1" className="border rounded px-2 py-1" value={takeProfitR} onChange={e=>setTakeProfitR(e.target.value)} placeholder="optional" />
            <label className="text-sm">Slippage (%)</label>
            <input type="number" step="0.01" className="border rounded px-2 py-1" value={slippagePct} onChange={e=>setSlippagePct(Number(e.target.value||0))} />
            <label className="text-sm">Fee (per trade)</label>
            <input type="number" step="0.01" className="border rounded px-2 py-1" value={fee} onChange={e=>setFee(Number(e.target.value||0))} />
            <label className="text-sm">Return</label>
            <select className="border rounded px-2 py-1" value={retMode} onChange={e=>setRetMode(e.target.value as any)}>
              <option value="summary">Summary</option>
              <option value="curve">Curve</option>
              <option value="full">Full</option>
            </select>
            <label className="text-sm">Include Trades</label>
            <input type="checkbox" className="w-4 h-4 mt-2" checked={includeTrades} onChange={e=>setIncludeTrades(e.target.checked)} />
          </div>
          <button onClick={runBacktest} disabled={loading || !ticker.trim()} className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50">
            {loading ? 'Running…' : 'Run Backtest'}
          </button>
          {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
          {anomalies?.length ? (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              <div className="font-medium">Anomalies</div>
              <ul className="list-disc ml-4">
                {anomalies.map((a,i)=>(<li key={i}>{a}</li>))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="md:col-span-2 space-y-4">
          {metrics && (
            <div className="p-4 border rounded">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div><div className="text-gray-500">Trades</div><div className="text-lg">{metrics.trades}</div></div>
                <div><div className="text-gray-500">Win Rate</div><div className="text-lg">{metrics.winRate.toFixed(1)}%</div></div>
                <div><div className="text-gray-500">Avg R/R</div><div className="text-lg">{metrics.avgRR.toFixed(2)}</div></div>
                <div><div className="text-gray-500">PnL</div><div className="text-lg">{metrics.totalPnL.toFixed(2)}</div></div>
                <div><div className="text-gray-500">Max DD</div><div className="text-lg">{metrics.maxDrawdownPct.toFixed(1)}%</div></div>
              </div>
            </div>
          )}

          {curve && curve.length > 1 && (
            <div className="p-4 border rounded">
              <div className="mb-2 text-sm text-gray-600">Equity Curve</div>
              <Sparkline data={curve} />
            </div>
          )}

          {includeTrades && trades && trades.length > 0 && (
            <div className="p-4 border rounded">
              <div className="mb-2 text-sm text-gray-600">Trades</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="p-2">Side</th>
                      <th className="p-2">Entry</th>
                      <th className="p-2">Exit</th>
                      <th className="p-2">PnL</th>
                      <th className="p-2">R/R</th>
                      <th className="p-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t:any, i:number)=> (
                      <tr key={i} className="border-t">
                        <td className="p-2">{t.side}</td>
                        <td className="p-2">{Number(t.entry).toFixed(2)}</td>
                        <td className="p-2">{t.exit != null ? Number(t.exit).toFixed(2) : '—'}</td>
                        <td className="p-2">{t.pnl != null ? Number(t.pnl).toFixed(2) : '—'}</td>
                        <td className="p-2">{t.rr != null ? Number(t.rr).toFixed(2) : '—'}</td>
                        <td className="p-2">{t.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Forecast Tester */}
      <div className="p-4 border rounded">
        <div className="mb-2 text-lg font-medium">Forecast Tester</div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm items-end">
          <div>
            <label className="block text-xs mb-1">Ticker</label>
            <input className="border rounded px-2 py-1 w-full" value={ftTicker} onChange={(e)=>setFtTicker(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1">Entry Days Ago</label>
            <input type="number" min={1} className="border rounded px-2 py-1 w-full" value={ftEntryDaysAgo} onChange={(e)=>setFtEntryDaysAgo(Number(e.target.value||0))} disabled={!!ftEntryDate} />
          </div>
          <div>
            <label className="block text-xs mb-1">Entry Date (calendar)</label>
            <input type="date" className="border rounded px-2 py-1 w-full" value={ftEntryDate} onChange={(e)=>setFtEntryDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1">End Date (calendar)</label>
            <input type="date" className="border rounded px-2 py-1 w-full" value={ftEndDate} onChange={(e)=>setFtEndDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1">Method</label>
            <select className="border rounded px-2 py-1 w-full" value={ftMethod} onChange={(e)=>setFtMethod(e.target.value as any)}>
              <option value="atr_k">ATR × k</option>
              <option value="fair">Fair Value</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1">k / Direction</label>
            <div className="flex gap-2">
              <input type="number" step="0.1" className="border rounded px-2 py-1 w-full" value={ftK} onChange={(e)=>setFtK(Number(e.target.value||0))} />
              <select className="border rounded px-2 py-1" value={ftDir} onChange={(e)=>setFtDir(e.target.value as any)}>
                <option value="up">Up</option>
                <option value="down">Down</option>
                <option value="auto">Auto (TA)</option>
              </select>
            </div>
          </div>
          <div>
            <button
              className="px-3 py-2 rounded bg-emerald-600 text-white w-full"
              onClick={async ()=>{
                setFtErr(undefined); setFtRes(null);
                try {
                  const payload: any = { ticker: ftTicker.trim().toUpperCase(), method: ftMethod, k: ftK, direction: ftDir };
                  if (ftEntryDate) payload.entryDate = ftEntryDate; else payload.entryDaysAgo = ftEntryDaysAgo;
                  if (ftEndDate) payload.endDate = ftEndDate;
                  const r = await fetch('/api/backtest/forecast', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
                  const j = await r.json();
                  if (!r.ok) throw new Error(j?.error || 'failed');
                  setFtRes(j);
                } catch (e:any) { setFtErr(e?.message || 'failed'); }
              }}
            >
              Evaluate
            </button>
          </div>
        </div>
        {ftErr && <div className="text-red-600 text-sm mt-2">{ftErr}</div>}
        {ftRes && (
          <div className="mt-3 text-sm">
            <div className="flex flex-wrap gap-4">
              <div>Entry ({ftRes.entryDate}): <span className="font-semibold">${Number(ftRes.entryPrice).toFixed(2)}</span></div>
              <div>Target: <span className="font-semibold">${Number(ftRes.targetPred).toFixed(2)}</span></div>
              <div>Actual ({ftRes.endDate}): <span className="font-semibold">${Number(ftRes.actualPrice).toFixed(2)}</span></div>
              <div>Error: <span className="font-semibold">{ftRes.pctErr!=null? ftRes.pctErr.toFixed(2)+'%':'—'}</span></div>
              <div>Hit (within): <span className={`font-semibold ${(ftRes.hitWithin??ftRes.hit)? 'text-green-600' : 'text-red-600'}`}>{(ftRes.hitWithin??ftRes.hit)? 'Yes' : 'No'}</span></div>
            </div>
            <div className="text-xs text-gray-500 mt-1">Method: {ftRes.method} • Direction: {ftRes.direction} • k: {ftRes.k} • MFE: {ftRes.mfe!=null? ftRes.mfe.toFixed(2):'—'} • MAE: {ftRes.mae!=null? ftRes.mae.toFixed(2):'—'}</div>
          </div>
        )}
      </div>

      {/* Rolling Evaluation */}
      <div className="p-4 border rounded">
        <div className="mb-2 text-lg font-medium">Rolling Evaluation</div>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-sm items-end">
          <div>
            <label className="block text-xs mb-1">Ticker</label>
            <input className="border rounded px-2 py-1 w-full" value={ftTicker} onChange={(e)=>setFtTicker(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1">Start Days Ago</label>
            <input type="number" min={20} className="border rounded px-2 py-1 w-full" value={swStart} onChange={(e)=>setSwStart(Number(e.target.value||0))} />
          </div>
          <div>
            <label className="block text-xs mb-1">End Days Ago</label>
            <input type="number" min={1} className="border rounded px-2 py-1 w-full" value={swEnd} onChange={(e)=>setSwEnd(Number(e.target.value||0))} />
          </div>
          <div>
            <label className="block text-xs mb-1">Step</label>
            <input type="number" min={1} className="border rounded px-2 py-1 w-full" value={swStep} onChange={(e)=>setSwStep(Number(e.target.value||0))} />
          </div>
          
          <div>
            <label className="block text-xs mb-1">Method</label>
            <select className="border rounded px-2 py-1 w-full" value={ftMethod} onChange={(e)=>setFtMethod(e.target.value as any)}>
              <option value="atr_k">ATR × k</option>
              <option value="fair">Fair Value</option>
            </select>
          </div>
          <div>
            <button
              className="px-3 py-2 rounded bg-indigo-600 text-white w-full"
              onClick={async ()=>{
                setSwErr(undefined); setSwRes(null);
                try {
                  const r = await fetch('/api/backtest/forecast/sweep', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ticker: ftTicker.trim().toUpperCase(), horizonDays: 10, method: ftMethod, k: ftK, direction: ftDir, startDaysAgo: swStart, endDaysAgo: swEnd, step: swStep })});
                  const j = await r.json();
                  if (!r.ok) throw new Error(j?.error || 'failed');
                  setSwRes(j);
                } catch (e:any) { setSwErr(e?.message || 'failed'); }
              }}
            >
              Run Sweep
            </button>
          </div>
        </div>
        {swErr && <div className="text-red-600 text-sm mt-2">{swErr}</div>}
        {swRes && (
          <div className="mt-3 text-sm">
            <div className="flex flex-wrap gap-4">
              <div>Entries: <span className="font-semibold">{swRes.count}</span></div>
              <div>Hit Rate (within): <span className="font-semibold">{swRes.hitRate.toFixed(1)}%</span></div>
              <div>MAE: <span className="font-semibold">{Number(swRes.mae).toFixed(2)}</span></div>
              <div>MAPE: <span className="font-semibold">{Number(swRes.mape).toFixed(2)}%</span></div>
            </div>
            <div className="overflow-x-auto mt-2 max-h-64">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="p-1">Entry</th>
                    <th className="p-1">Entry Px</th>
                    <th className="p-1">Target</th>
                    <th className="p-1">Actual</th>
                    <th className="p-1">Err%</th>
                    <th className="p-1">Hit (within)</th>
                  </tr>
                </thead>
                <tbody>
                  {(swRes.items||[]).map((it:any, i:number)=> (
                    <tr key={i} className="border-t">
                      <td className="p-1">{it.entryDate}</td>
                      <td className="p-1">{Number(it.entryPrice).toFixed(2)}</td>
                      <td className="p-1">{Number(it.targetPred).toFixed(2)}</td>
                      <td className="p-1">{Number(it.actualPrice).toFixed(2)}</td>
                      <td className="p-1">{Number(it.pctErr).toFixed(2)}%</td>
                      <td className={`p-1 ${(it.hitWithin??it.hit)? 'text-green-600' : 'text-red-600'}`}>{(it.hitWithin??it.hit)? 'Yes':'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
