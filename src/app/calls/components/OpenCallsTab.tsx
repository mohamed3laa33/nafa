
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import OpenCallsTable from "./OpenCallsTable";
import { fetchPrice, toNum } from "../utils";
import { OpenCall, OpenRow } from "../types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface OpenCallsTabProps {
  searchTicker: string;
}

export default function OpenCallsTab({ searchTicker }: OpenCallsTabProps) {
  const [rows, setRows] = useState<OpenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 5;

  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const url = `/api/open-calls/unique?limit=${pageSize}&page=${page}${searchTicker ? `&ticker=${encodeURIComponent(searchTicker)}` : ""}`;
        const rs = await fetch(url, { cache: "no-store" });
        const js = await rs.json();
        if (!rs.ok) throw new Error(js.error || "Failed to load open calls");
        const itemsArr: OpenCall[] = Array.isArray(js?.items) ? js.items : [];
        const mapped = itemsArr.map((call) => ({
          id: String(call.stock_id ?? ""),
          ticker: String(call.ticker ?? ""),
          entry: toNum(call.entry),
          target: toNum(call.t1),
          current: null,
          openedAt: call.opened_at ?? null,
          openedBy: call.opened_by ?? null,
          openedById: call.opened_by_id ?? null,
        } as OpenRow)).filter((r) => r.id && r.ticker);
        setRows(mapped);
        setHasMore(Boolean(js?.hasMore));
        (async () => {
          const tickers = mapped.map((r) => r.ticker);
          const batchSize = 6;
          for (let i = 0; i < tickers.length; i += batchSize) {
            if (canceled) break;
            const batch = tickers.slice(i, i + batchSize);
            const prices = await Promise.all(batch.map((t) => fetchPrice(t)));
            if (canceled) break;
            setRows((prev) => prev.map((row) => {
              const idx = batch.indexOf(row.ticker);
              return idx >= 0 ? { ...row, current: prices[idx] ?? row.current } : row;
            }));
            await sleep(0);
          }
        })();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to load";
        setErr(message);
      } finally {
        setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [searchTicker, page]);

  const openEmpty = !loading && !err && rows.length === 0;

  return (
    <>
      {loading && <p className="p-2">Loading…</p>}
      {err && <p className="p-2 text-red-500">{err}</p>}
      {openEmpty && <p className="p-2">No open calls.</p>}
      {!loading && !err && rows.length > 0 && (
        <OpenCallsTable rows={rows} />
      )}
      {!loading && !err && rows.length > 0 && (
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-gray-600">Page {page}</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
            <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </>
  );
}
