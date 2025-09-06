
"use client";

import { useState, useEffect } from "react";
import HitsCallsTable from "./HitsCallsTable";
import { toNum } from "../utils";
import { ClosedCall, ClosedCallNorm } from "../types";

interface HitsCallsTabProps {
  searchTicker: string;
}

export default function HitsCallsTab({ searchTicker }: HitsCallsTabProps) {
  const [hitsRows, setHitsRows] = useState<ClosedCallNorm[]>([]);
  const [hitsLoading, setHitsLoading] = useState(false);
  const [hitsErr, setHitsErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setHitsLoading(true);
      setHitsErr("");
      try {
        const url = `/api/calls?status=closed&outcome=target_hit&limit=50&page=1${searchTicker ? `&ticker=${encodeURIComponent(searchTicker)}` : ""}`;
        const rs = await fetch(url, { cache: "no-store" });
        const js = await rs.json();
        if (!rs.ok) throw new Error(js?.error || "Failed to load hits");
        const calls: ClosedCall[] = Array.isArray(js) ? js : [];
        const normalized: ClosedCallNorm[] = calls.map((c) => ({
          id: String(c.id),
          ticker: c.ticker,
          stock_id: c.stock_id ?? null,
          type: c.type ?? null,
          entry_price: toNum(c.entry ?? c.entry_price),
          target_price: toNum(c.t1 ?? c.target ?? c.target_price),
          stop_loss: toNum(c.stop ?? c.stop_loss),
          opened_at: c.opened_at ?? null,
          closed_at: c.closed_at ?? null,
          outcome: c.outcome ?? null,
          note: c.note ?? null,
          result_pct: toNum(c.result_pct),
          current_price: null,
          opened_by: c.opened_by ?? null,
          opened_by_id: c.opened_by_id ?? null,
        }));
        normalized.sort((a, b) => (b.closed_at || "").localeCompare(a.closed_at || ""));
        if (alive) setHitsRows(normalized);
      } catch (e: any) {
        if (alive) setHitsErr(e?.message || "Failed to load hits");
      } finally {
        if (alive) setHitsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [searchTicker]);

  return (
    <>
      {hitsLoading && <p className="p-2">Loading…</p>}
      {hitsErr && <p className="p-2 text-red-500">{hitsErr}</p>}
      {!hitsLoading && !hitsErr && hitsRows.length === 0 && (
        <p className="p-2">No hits found.</p>
      )}
      {!hitsLoading && !hitsErr && hitsRows.length > 0 && (
        <HitsCallsTable rows={hitsRows} />
      )}
    </>
  );
}
