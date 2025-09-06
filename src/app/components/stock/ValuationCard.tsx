"use client";

import { useEffect, useMemo, useState } from "react";

type GrowthEvSalesReq = { model: 'evsales'; industryMultiple: number; forwardRevenue: number; shares: number; netCash: number };
type GrowthPegReq = { model: 'peg'; epsFwd: number; growth: number; pegBenchmark: number };

export default function ValuationCard({ ticker, sector }: { ticker: string; sector?: string | null }) {
  const [evSales, setEvSales] = useState<number | null>(null);
  const [evAssump, setEvAssump] = useState<GrowthEvSalesReq>({ model: 'evsales', industryMultiple: 4, forwardRevenue: 1e9, shares: 1e8, netCash: 0 });
  const [pegPrice, setPegPrice] = useState<number | null>(null);
  const [pegAssump, setPegAssump] = useState<GrowthPegReq>({ model: 'peg', epsFwd: 1, growth: 30, pegBenchmark: 1 });
  const [dcfPrice, setDcfPrice] = useState<{ base?: number; bull?: number; bear?: number }>({});
  const [dcfAssump, setDcfAssump] = useState<any>({ base: { years: 7, rev0: 1e9, cagr: 0.3, fcfMarginStart: 0.02, fcfMarginEnd: 0.12, discount: 0.10, terminalMethod: 'gordon', terminalG: 0.03, shares: 1e8, netCash: 0 } });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Prefill sector EV/Sales multiple
        if (sector) {
          const r = await fetch(`/api/valuation/sector-medians?sector=${encodeURIComponent(sector)}`, { cache: 'no-store' });
          const j = await r.json();
          if (alive && r.ok && j?.evSales) setEvAssump((s)=>({ ...s, industryMultiple: Number(j.evSales) }));
        }
      } catch {}
      try {
        // Pull Yahoo quick info for defaults
        const r = await fetch(`/api/company-profile/${encodeURIComponent(ticker)}`, { cache: 'no-store' });
        const j = await r.json();
        // No direct shares/revenue here; keep manual entries
        // We could also read current price from /api/price if needed
      } catch {}
    })();
    return () => { alive = false; };
  }, [ticker, sector]);

  async function runEvSales() {
    try {
      const r = await fetch(`/api/valuation/growth/${encodeURIComponent(ticker)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evAssump) });
      const j = await r.json();
      if (r.ok) setEvSales(Number(j?.targetPrice ?? null));
    } catch {}
  }
  async function runPeg() {
    try {
      const r = await fetch(`/api/valuation/growth/${encodeURIComponent(ticker)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pegAssump) });
      const j = await r.json();
      if (r.ok) setPegPrice(Number(j?.targetPrice ?? null));
    } catch {}
  }
  async function runDcf() {
    try {
      const r = await fetch(`/api/valuation/dcf/${encodeURIComponent(ticker)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dcfAssump) });
      const j = await r.json();
      if (r.ok) setDcfPrice({ base: Number(j?.base?.price ?? null), bull: Number(j?.bull?.price ?? null), bear: Number(j?.bear?.price ?? null) });
    } catch {}
  }

  const fmt = (n?: number | null) => (n==null || !Number.isFinite(n) ? '—' : `$${n.toFixed(2)}`);

  return (
    <div className="mt-4">
      <h3 className="text-lg font-bold mb-2">Valuation (EV/Sales • PEG • DCF)</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* EV/Sales */}
        <div className="border rounded p-3">
          <div className="font-semibold mb-2">Forward EV/Sales</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label>Sector Multiple</label>
            <input className="border rounded px-2 py-1" type="number" step="0.1" value={evAssump.industryMultiple} onChange={(e)=>setEvAssump({...evAssump, industryMultiple: Number(e.target.value||0)})} />
            <label>Forward Revenue</label>
            <input className="border rounded px-2 py-1" type="number" value={evAssump.forwardRevenue} onChange={(e)=>setEvAssump({...evAssump, forwardRevenue: Number(e.target.value||0)})} />
            <label>Shares</label>
            <input className="border rounded px-2 py-1" type="number" value={evAssump.shares} onChange={(e)=>setEvAssump({...evAssump, shares: Number(e.target.value||0)})} />
            <label>Net Cash</label>
            <input className="border rounded px-2 py-1" type="number" value={evAssump.netCash} onChange={(e)=>setEvAssump({...evAssump, netCash: Number(e.target.value||0)})} />
          </div>
          <button onClick={runEvSales} className="mt-2 px-3 py-1 rounded bg-blue-600 text-white">Calculate</button>
          <div className="mt-2 text-sm">Target: <span className="font-semibold">{fmt(evSales)}</span></div>
          <div className="text-[11px] text-gray-500 mt-1">Price = (EV + NetCash) / Shares; EV = SectorMultiple × FwdRevenue</div>
        </div>

        {/* PEG */}
        <div className="border rounded p-3">
          <div className="font-semibold mb-2">PEG (P/E to Growth)</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label>EPS (Fwd)</label>
            <input className="border rounded px-2 py-1" type="number" step="0.01" value={pegAssump.epsFwd} onChange={(e)=>setPegAssump({...pegAssump, epsFwd: Number(e.target.value||0)})} />
            <label>Growth %</label>
            <input className="border rounded px-2 py-1" type="number" step="0.1" value={pegAssump.growth} onChange={(e)=>setPegAssump({...pegAssump, growth: Number(e.target.value||0)})} />
            <label>PEG Benchmark</label>
            <input className="border rounded px-2 py-1" type="number" step="0.1" value={pegAssump.pegBenchmark} onChange={(e)=>setPegAssump({...pegAssump, pegBenchmark: Number(e.target.value||0)})} />
          </div>
          <button onClick={runPeg} className="mt-2 px-3 py-1 rounded bg-blue-600 text-white">Calculate</button>
          <div className="mt-2 text-sm">Target: <span className="font-semibold">{fmt(pegPrice)}</span></div>
          <div className="text-[11px] text-gray-500 mt-1">Price = EPS × (PEG × Growth%)</div>
        </div>

        {/* DCF */}
        <div className="border rounded p-3">
          <div className="font-semibold mb-2">DCF</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label>Years</label>
            <input type="number" className="border rounded px-2 py-1" min={5} max={10} value={dcfAssump.base.years} onChange={(e)=>setDcfAssump({ ...dcfAssump, base: { ...dcfAssump.base, years: Number(e.target.value||0) } })} />
            <label>Rev (t0)</label>
            <input type="number" className="border rounded px-2 py-1" value={dcfAssump.base.rev0} onChange={(e)=>setDcfAssump({ ...dcfAssump, base: { ...dcfAssump.base, rev0: Number(e.target.value||0) } })} />
            <label>CAGR</label>
            <input type="number" step="0.01" className="border rounded px-2 py-1" value={dcfAssump.base.cagr} onChange={(e)=>setDcfAssump({ ...dcfAssump, base: { ...dcfAssump.base, cagr: Number(e.target.value||0) } })} />
            <label>FCF % start</label>
            <input type="number" step="0.01" className="border rounded px-2 py-1" value={dcfAssump.base.fcfMarginStart} onChange={(e)=>setDcfAssump({ ...dcfAssump, base: { ...dcfAssump.base, fcfMarginStart: Number(e.target.value||0) } })} />
            <label>FCF % end</label>
            <input type="number" step="0.01" className="border rounded px-2 py-1" value={dcfAssump.base.fcfMarginEnd} onChange={(e)=>setDcfAssump({ ...dcfAssump, base: { ...dcfAssump.base, fcfMarginEnd: Number(e.target.value||0) } })} />
            <label>Discount</label>
            <input type="number" step="0.01" className="border rounded px-2 py-1" value={dcfAssump.base.discount} onChange={(e)=>setDcfAssump({ ...dcfAssump, base: { ...dcfAssump.base, discount: Number(e.target.value||0) } })} />
            <label>Terminal</label>
            <select className="border rounded px-2 py-1" value={dcfAssump.base.terminalMethod} onChange={(e)=>setDcfAssump({ ...dcfAssump, base: { ...dcfAssump.base, terminalMethod: e.target.value } })}>
              <option value="gordon">Gordon</option>
              <option value="exit">Exit Multiple</option>
            </select>
            <label>g/Exit Mult</label>
            <input type="number" step="0.01" className="border rounded px-2 py-1" value={dcfAssump.base.terminalMethod==='gordon'? dcfAssump.base.terminalG : (dcfAssump.base.exitMultiple || 15)} onChange={(e)=>setDcfAssump({ ...dcfAssump, base: { ...dcfAssump.base, ...(dcfAssump.base.terminalMethod==='gordon'? { terminalG: Number(e.target.value||0) } : { exitMultiple: Number(e.target.value||0) }) } })} />
            <label>Shares</label>
            <input type="number" className="border rounded px-2 py-1" value={dcfAssump.base.shares} onChange={(e)=>setDcfAssump({ ...dcfAssump, base: { ...dcfAssump.base, shares: Number(e.target.value||0) } })} />
            <label>Net Cash</label>
            <input type="number" className="border rounded px-2 py-1" value={dcfAssump.base.netCash} onChange={(e)=>setDcfAssump({ ...dcfAssump, base: { ...dcfAssump.base, netCash: Number(e.target.value||0) } })} />
          </div>
          <button onClick={runDcf} className="mt-2 px-3 py-1 rounded bg-blue-600 text-white">Run DCF</button>
          <div className="mt-2 text-sm">Base: <span className="font-semibold">{fmt(dcfPrice.base)}</span> • Bull: <span className="font-semibold">{fmt(dcfPrice.bull)}</span> • Bear: <span className="font-semibold">{fmt(dcfPrice.bear)}</span></div>
          <div className="text-[11px] text-gray-500 mt-1">Simplified FCF ramp + terminal; scenario tweaks applied if bull/bear not provided.</div>
        </div>
      </div>
    </div>
  );
}

