"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Call = {
  id: string;
  ticker: string;
  stock_id?: string | null;
  status?: string | null;
  entry_price?: number | string | null;
  stop_loss?: number | string | null;
  // legacy field names from /api/calls (no aliases)
  entry?: number | string | null;
  stop?: number | string | null;
  target_price?: number | string | null;
  t2?: number | string | null;
  t3?: number | string | null;
  horizon_days?: number | null;
  opened_at?: string | null;
  expires_at?: string | null;
  closed_at?: string | null;
  close_price?: number | string | null;
  result_pct?: number | string | null;
  which_target_hit?: number | null;
  outcome?: string | null;
  note?: string | null;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}
const fmtNum = (v: unknown, d = 2) => {
  const n = num(v);
  return n === null ? "—" : n.toFixed(d);
};
const iso = (s?: string | null) => (!s ? "—" : s); // print iso to avoid SSR/locale mismatch

export default function AllClosedCallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch(`/api/calls?status=closed`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load calls");
        const all: Call[] = Array.isArray(j) ? j : [];
        setCalls(all);
      } catch (e: any) {
        setErr(e.message || "Failed to load calls");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // newest first by closed_at then opened_at
  const closed = useMemo(() => {
    return calls.sort((a, b) => {
      const ca = a.closed_at ? Date.parse(a.closed_at) : 0;
      const cb = b.closed_at ? Date.parse(b.closed_at) : 0;
      if (cb !== ca) return cb - ca;
      const oa = a.opened_at ? Date.parse(a.opened_at) : 0;
      const ob = b.opened_at ? Date.parse(b.opened_at) : 0;
      return ob - oa;
    });
  }, [calls]);

  if (loading) return <p className="p-4">Loading…</p>;
  if (err) return <p className="p-4 text-red-500">{err}</p>;

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">All Closed Calls</h1>
      </div>

      {closed.length === 0 ? (
        <p>No closed calls.</p>
      ) : (
        <div className="nf-table-wrap overflow-x-auto rounded">
          <table className="nf-table text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">Ticker</th>
                <th className="p-2 border">Status</th>
                <th className="p-2 border">Entry</th>
                <th className="p-2 border">Stop</th>
                <th className="p-2 border">T1</th>
                <th className="p-2 border">T2</th>
                <th className="p-2 border">T3</th>
                <th className="p-2 border">Horizon (d)</th>
                <th className="p-2 border">Opened</th>
                <th className="p-2 border">Closed</th>
                <th className="p-2 border">Close Px</th>
                <th className="p-2 border">Result %</th>
                <th className="p-2 border">Hit</th>
                <th className="p-2 border">Outcome</th>
                <th className="p-2 border">Notes</th>
              </tr>
            </thead>
            <tbody>
              {closed.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 align-top">
                  <td className="p-2 border font-mono">
                    <Link href={`/stocks/${c.stock_id || c.id}`}>{c.ticker}</Link>
                  </td>
                  <td className="p-2 border">{c.status ?? "—"}</td>
                  <td className="p-2 border">{fmtNum(c.entry_price ?? c.entry)}</td>
                  <td className="p-2 border">{fmtNum(c.stop_loss ?? c.stop)}</td>
                  <td className="p-2 border">{fmtNum(c.target_price)}</td>
                  <td className="p-2 border">{fmtNum(c.t2)}</td>
                  <td className="p-2 border">{fmtNum(c.t3)}</td>
                  <td className="p-2 border">{c.horizon_days ?? "—"}</td>
                  <td className="p-2 border">{iso(c.opened_at)}</td>
                  <td className="p-2 border">{iso(c.closed_at)}</td>
                  <td className="p-2 border">{fmtNum(c.close_price)}</td>
                  <td className="p-2 border">{fmtNum(c.result_pct)}</td>
                  <td className="p-2 border">{c.which_target_hit ?? "—"}</td>
                  <td className="p-2 border">{c.outcome ?? "—"}</td>
                  <td className="p-2 border whitespace-pre-wrap max-w-[24rem]">
                    {c.note ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
