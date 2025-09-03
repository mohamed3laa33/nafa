"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

async function mapTickersToIds(tickers: string[]): Promise<Record<string, string>> {
  try {
    const qs = encodeURIComponent(tickers.join(','));
    const r = await fetch(`/api/stocks?tickers=${qs}`, { cache: 'no-store' });
    const j = await r.json();
    if (!r.ok || !Array.isArray(j?.data)) return {};
    const out: Record<string, string> = {};
    for (const row of j.data) {
      if (row?.ticker && row?.id) out[String(row.ticker)] = String(row.id);
    }
    return out;
  } catch { return {}; }
}

type Row = {
  ticker: string;
  price?: number | null;
  gapPct?: number | null;
  rvol?: number | null;
  vwapDistPct?: number | null;
  momentum?: 'Buy' | 'Sell' | 'Neutral' | null;
};

const Section = ({ title, endpoint }: { title: string; endpoint: string }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [idMap, setIdMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr("");
      try {
        const r = await fetch(`/api/scans/${endpoint}`, { cache: 'no-store' });
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) throw new Error(j?.error || 'failed');
        const data = Array.isArray(j) ? j : [];
        setRows(data);
        const ids = await mapTickersToIds(data.map((r: Row) => r.ticker));
        if (alive) setIdMap(ids);
      } catch (e: any) { if (alive) setErr(e?.message || 'failed'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [endpoint]);

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      {loading && <p>Loading…</p>}
      {err && <p className="text-red-600">{err}</p>}
      {!loading && !err && (
        <div className="nf-table-wrap overflow-x-auto rounded">
          <table className="nf-table text-sm">
            <thead>
              <tr>
                <th className="p-2 border">Ticker</th>
                <th className="p-2 border">Price</th>
                <th className="p-2 border">Gap %</th>
                <th className="p-2 border">RVOL</th>
                <th className="p-2 border">VWAP Δ</th>
                <th className="p-2 border">5m Momentum</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ticker} className="hover:bg-gray-50">
                  <td className="p-2 border font-medium"><Link href={idMap[r.ticker] ? `/stocks/${idMap[r.ticker]}` : '/stocks'} className="brand-link underline">{r.ticker}</Link></td>
                  <td className="p-2 border">{r.price == null ? '—' : r.price.toFixed(2)}</td>
                  <td className="p-2 border">{r.gapPct == null ? '—' : r.gapPct.toFixed(2)}</td>
                  <td className="p-2 border">{r.rvol == null ? '—' : r.rvol.toFixed(2) + 'x'}</td>
                  <td className={`p-2 border ${r.vwapDistPct == null ? '' : r.vwapDistPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{r.vwapDistPct == null ? '—' : (r.vwapDistPct >= 0 ? '+' : '') + r.vwapDistPct.toFixed(2) + '%'}</td>
                  <td className="p-2 border">{r.momentum ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default function ScansPage() {
  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Scans</h1>
        <Link href="/calls" className="px-3 py-2 btn-outline-brand">← Back to Calls</Link>
      </div>
      <Section title="Top Gappers" endpoint="gappers" />
      <Section title="Momentum + RVOL" endpoint="momentum" />
      <Section title="Unusual Volume (RVOL ≥ 2x)" endpoint="unusual" />
    </div>
  );
}
