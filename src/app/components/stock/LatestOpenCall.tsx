"use client";

type Call = {
  id: string;
  entry?: string | number | null;
  stop?: string | number | null;
  t1?: string | number | null;
  t2?: string | number | null;
  t3?: string | number | null;
  horizon_days?: number | null;
  opened_at?: string | null;
  expires_at?: string | null;
  status?: string | null;
  outcome?: string | null;
  which_target_hit?: number | null;
  close_price?: string | number | null;
  result_pct?: string | number | null;
  notes?: string | null;
  opened_by?: string | null;
  opened_by_id?: string | null;
  is_public?: 0 | 1 | boolean | null;
};

function fmtNum(n: unknown, suffix = "") {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? parseFloat(n) : Number(n);
  return Number.isFinite(v) ? `${v.toFixed(2)}${suffix}` : "—";
}
function fmtDate(s?: string | null) {
  if (!s) return "—";
  // client-only formatting; avoids SSR mismatch since component is client
  try { return new Date(s).toLocaleString(); } catch { return s; }
}
function badge(status?: string | null) {
  const base = "px-2 py-0.5 rounded text-xs font-medium";
  if (!status) return <span className={`${base} bg-gray-100 text-gray-700`}>—</span>;
  const s = status.toLowerCase();
  const cls =
    s === "open" ? "bg-green-100 text-green-700" :
    s === "closed" ? "bg-gray-200 text-gray-800" :
    "bg-gray-100 text-gray-700";
  return <span className={`${base} ${cls}`}>{status}</span>;
}

import { useEffect, useMemo, useState } from "react";

export default function LatestOpenCall({ call, ticker }: { call: Call | null; ticker: string }) {
  const [livePrice, setLivePrice] = useState<number | null>(null);

  // Compute an expires date if missing using opened_at + horizon_days
  const expiresComputed = useMemo(() => {
    if (!call?.opened_at || !call?.horizon_days) return call?.expires_at || null;
    if (call.expires_at) return call.expires_at;
    try {
      const d = new Date(call.opened_at);
      const dd = new Date(d.getTime());
      dd.setDate(dd.getDate() + (call.horizon_days || 0));
      return dd.toISOString();
    } catch {
      return call?.expires_at || null;
    }
  }, [call?.opened_at, call?.horizon_days, call?.expires_at]);

  // Periodically fetch price for live PnL if call is open
  useEffect(() => {
    let timer: any;
    let cancelled = false;
    async function load() {
      if (!ticker || !call || call.status !== "open") return;
      try {
        const r = await fetch(`/api/price/${encodeURIComponent(ticker)}`, { cache: "no-store" });
        const j = await r.json();
        if (r.ok && !cancelled) setLivePrice(typeof j.price === 'number' ? j.price : null);
      } catch {
        if (!cancelled) setLivePrice(null);
      }
    }
    load();
    timer = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [ticker, call?.status, call?.id]);

  const liveResultPct = useMemo(() => {
    const entry = typeof call?.entry === 'string' ? parseFloat(call.entry) : (call?.entry ?? null);
    if (!call || call.status !== 'open' || livePrice == null || entry == null || !Number.isFinite(Number(entry))) return null;
    const pct = ((livePrice - Number(entry)) / Number(entry)) * 100;
    return pct;
  }, [livePrice, call?.entry, call?.status]);

  if (!call) return <p className="text-sm text-gray-500">No open call.</p>;

  return (
    <div className="nf-table-wrap overflow-x-auto rounded">
      <table className="nf-table min-w-[640px] text-sm text-center">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border">Status</th>
            <th className="p-2 border">Entry</th>
            <th className="p-2 border">Stop</th>
            <th className="p-2 border">T1</th>
            <th className="p-2 border">T2</th>
            <th className="p-2 border">T3</th>
            <th className="p-2 border">Horizon (d)</th>
            <th className="p-2 border">Opened</th>
            <th className="p-2 border">Expires</th>
            <th className="p-2 border">Outcome</th>
            <th className="p-2 border">Hit</th>
            <th className="p-2 border">Close Px</th>
            <th className="p-2 border">Result %</th>
          </tr>
        </thead>
        <tbody>
          <tr className="hover:bg-gray-50 align-top">
            <td className="p-2 border">{badge(call.status)}</td>
            <td className="p-2 border">{fmtNum(call.entry)}</td>
            <td className="p-2 border">{fmtNum(call.stop)}</td>
            <td className="p-2 border">{fmtNum(call.t1)}</td>
            <td className="p-2 border">{fmtNum(call.t2)}</td>
            <td className="p-2 border">{fmtNum(call.t3)}</td>
            <td className="p-2 border">{call.horizon_days ?? "—"}</td>
            <td className="p-2 border">{fmtDate(call.opened_at)}</td>
            <td className="p-2 border">{fmtDate(expiresComputed)}</td>
            <td className="p-2 border">{call.outcome ?? "—"}</td>
            <td className="p-2 border">{call.which_target_hit ?? "—"}</td>
            <td className="p-2 border">{fmtNum(call.status === 'open' ? livePrice ?? null : call.close_price)}</td>
            <td className="p-2 border">
              {call.status === 'open'
                ? (liveResultPct == null ? '—' : `${liveResultPct.toFixed(2)}%`)
                : fmtNum(call.result_pct, "%")}
            </td>
          </tr>
        </tbody>
      </table>
      {/* Meta row: opened by, visibility, R multiple, distances */}
      <div className="p-2 text-xs flex flex-wrap gap-3 items-center">
        {call.opened_by && (
          <span className="opacity-80">Opened by: <span className="font-medium">{call.opened_by}</span></span>
        )}
        {typeof call.is_public !== 'undefined' && (
          <span className={`px-2 py-0.5 rounded ${call.is_public ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
            {call.is_public ? 'Public' : 'Private'}
          </span>
        )}
        {/* R multiple and distances */}
        {(() => {
          const entry = typeof call.entry === 'string' ? parseFloat(call.entry) : (call.entry ?? null);
          const stop = typeof call.stop === 'string' ? parseFloat(call.stop) : (call.stop ?? null);
          const t1 = typeof call.t1 === 'string' ? parseFloat(call.t1) : (call.t1 ?? null);
          if (entry == null || stop == null || !Number.isFinite(Number(entry)) || !Number.isFinite(Number(stop))) return null;
          const isLong = stop < entry;
          const risk = Math.abs(Number(entry) - Number(stop));
          const reward = t1 != null ? Math.abs((Number(t1) - Number(entry))) : null;
          const rMult = reward != null && risk > 0 ? (reward / risk) : null;
          const lp = livePrice;
          const toT1 = (lp != null && t1 != null) ? (isLong ? ((t1 - lp) / lp) * 100 : ((lp - t1) / lp) * 100) : null;
          const toStop = (lp != null) ? (isLong ? ((lp - Number(stop)) / lp) * 100 : ((Number(stop) - lp) / lp) * 100) : null;
          return (
            <>
              {rMult != null && <span className="opacity-80">R≈ {rMult.toFixed(2)}</span>}
              {toT1 != null && <span className="opacity-80">To T1: {toT1.toFixed(2)}%</span>}
              {toStop != null && <span className="opacity-80">To Stop: {toStop.toFixed(2)}%</span>}
            </>
          );
        })()}
      </div>
      {call.notes && <p className="px-2 pb-2 text-sm text-gray-700">Notes: {call.notes}</p>}
    </div>
  );
}
