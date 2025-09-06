
"use client";

import { useState, useEffect, useCallback } from "react";
import ClosedCallsTable from "./ClosedCallsTable";
import { fetchPrice, toNum } from "../utils";
import { ClosedCall, ClosedCallNorm } from "../types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ClosedCallsTabProps {
  searchTicker: string;
}

export default function ClosedCallsTab({ searchTicker }: ClosedCallsTabProps) {
  const [closedRows, setClosedRows] = useState<ClosedCallNorm[]>([]);
  const [closedLoading, setClosedLoading] = useState(true);
  const [closedErr, setClosedErr] = useState("");

  const loadClosed = useCallback(async (alive: boolean, tickerFilter: string) => {
    setClosedLoading(true);
    setClosedErr("");
    try {
      const url = `/api/calls?status=closed${tickerFilter ? `&ticker=${encodeURIComponent(tickerFilter)}` : ""}`;
      const rs = await fetch(url, { cache: "no-store" });
      const js = await rs.json();
      if (!rs.ok) throw new Error("Failed to load closed calls");
      const calls: ClosedCall[] = Array.isArray(js) ? js : [];
      const normalizedRows: ClosedCallNorm[] = await Promise.all(calls.map(async (c) => {
        const entry = toNum(c.entry ?? c.entry_price);
        const exit = toNum(c.exit ?? c.close ?? c.closed_price ?? c.exit_price);
        const target = toNum(c.t1 ?? c.target ?? c.target_price);
        const stop = toNum(c.stop ?? c.stop_loss);
        const current_price = null;
        const result_pct =
          c.result_pct != null
            ? toNum(c.result_pct)
            : entry != null && entry > 0 && exit != null
            ? ((exit - entry) / entry) * 100
            : null;
        return {
          id: String(c.id),
          ticker: c.ticker,
          stock_id: c.stock_id ?? null,
          type: c.type ?? null,
          entry_price: entry,
          target_price: target,
          stop_loss: stop,
          opened_at: c.opened_at ?? null,
          closed_at: c.closed_at ?? null,
          outcome: c.outcome ?? null,
          note: c.note ?? null,
          result_pct,
          current_price: current_price,
          opened_by: c.opened_by ?? null,
        };
      }));
      normalizedRows.sort((a, b) => (b.closed_at ?? "").localeCompare(a.closed_at ?? ""));
      if (alive) setClosedRows(normalizedRows);
      if (alive) {
        let canceled = false;
        (async () => {
          const tickers = normalizedRows.map((r) => r.ticker);
          const batchSize = 6;
          for (let i = 0; i < tickers.length; i += batchSize) {
            if (!alive || canceled) break;
            const batch = tickers.slice(i, i + batchSize);
            const prices = await Promise.all(batch.map((t) => fetchPrice(t)));
            if (!alive || canceled) break;
            setClosedRows((prev) => prev.map((row) => {
              const idx = batch.indexOf(row.ticker);
              return idx >= 0 ? { ...row, current_price: prices[idx] ?? row.current_price } : row;
            }));
            await sleep(0);
          }
        })();
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load closed calls";
      if (alive) setClosedErr(message);
    } finally {
      if (alive) setClosedLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadClosed(alive, searchTicker);
    const id = setInterval(() => loadClosed(alive, searchTicker), 60000);
    return () => { alive = false; clearInterval(id); };
  }, [loadClosed, searchTicker]);

  const closedEmpty = !closedLoading && !closedErr && closedRows.length === 0;

  return (
    <>
      {closedLoading && <p className="p-2">Loading…</p>}
      {closedErr && <p className="p-2 text-red-500">{closedErr}</p>}
      {closedEmpty && <p className="p-2">No closed calls.</p>}
      {!closedLoading && !closedErr && closedRows.length > 0 && (
        <ClosedCallsTable rows={closedRows} />
      )}
    </>
  );
}
