// src/app/calls/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/app/AuthContext";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const PriceSparkline = dynamic(() => import("@/components/PriceSparkline"), { ssr: false });

type Stock = { id: string; ticker: string };

type OpenCall = {
  stock_id?: string | null;
  ticker?: string | null;
  entry?: number | string | null;
  t1?: number | string | null;        // target
  opened_at?: string | null;          // entry date
  opened_by?: string | null;          // analyst email/name
  opened_by_id?: string | null;
};

type ClosedCall = {
  id: string;
  ticker: string;
  stock_id?: string | null;
  type?: string | null;
  entry?: number | string | null;
  entry_price?: number | string | null;
  exit?: number | string | null;
  close?: number | string | null;
  closed_price?: number | string | null;
  exit_price?: number | string | null;
  t1?: number | string | null;
  target?: number | string | null;
  target_price?: number | string | null;
  stop?: number | string | null;
  stop_loss?: number | string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  outcome?: string | null;
  note?: string | null;
  result_pct?: number | string | null;
  opened_by?: string | null;
  opened_by_id?: string | null;
}

type ClosedCallNorm = {
  id: string;
  ticker: string;
  stock_id?: string | null;
  type: string | null;
  entry_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  opened_at: string | null;
  closed_at: string | null;
  outcome: string | null;
  note: string | null;
  result_pct: number | null;
  current_price: number | null;
  opened_by: string | null;
  opened_by_id?: string | null;
};

type OpenRow = {
  id: string; // stock id
  ticker: string;
  entry: number | null;
  target: number | null;
  current: number | null;
  openedAt: string | null;
  openedBy: string | null;
  openedById: string | null;
};

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
};
const fmt = (n: number | null, d = 2) => (n == null ? "—" : n.toFixed(d));
const fnum = (n: number | null, d = 2) => (n == null ? "-" : n.toFixed(d));
const ymd = (s?: string | null) => (!s ? "—" : new Date(s).toISOString().slice(0, 10));
const fdate = (s: string | null) => (!s ? "-" : new Date(s).toISOString().slice(0, 10));

async function fetchPrice(ticker: string): Promise<number | null> {
  try {
    const r = await fetch(`/api/price/${encodeURIComponent(ticker)}`, { cache: "no-store" });
    const j = await r.json();
    return r.ok && typeof j.price === "number" ? j.price : null;
  } catch {
    return null;
  }
}

const Buzz = ({ t }: { t: string }) => (
  <a
    className="brand-link"
    target="_blank"
    rel="noopener noreferrer"
    href={`https://x.com/search?q=%24${encodeURIComponent(t)}%20lang%3Aen%20-filter%3Aretweets%20min_faves%3A10&f=live`}
  >
    X Live — {t}
  </a>
);
const News = ({ t }: { t: string }) => (
  <a
    className="brand-link"
    target="_blank"
    rel="noopener noreferrer"
    href={`https://news.google.com/search?q=${encodeURIComponent(t)}&hl=en-US&gl=US&ceid=US:en`}
  >
    News — {t}
  </a>
);

export default function CallsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"open" | "closed" | "hits">("open");

  // OPEN
  const [rows, setRows] = useState<OpenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  // SEARCH
  const [query, setQuery] = useState("");
  const [searchTicker, setSearchTicker] = useState<string>("");
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Debounce ticker search input
  useEffect(() => {
    const handler = setTimeout(() => {
      const q = query.trim().toUpperCase();
      setSearchTicker(q);
    }, 400);
    return () => clearTimeout(handler);
  }, [query]);

  // CLOSED
  const [closedRows, setClosedRows] = useState<ClosedCallNorm[]>([]);
  const [closedLoading, setClosedLoading] = useState(true);
  const [closedErr, setClosedErr] = useState("");

  // ========== OPEN: initial load ==========
  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const url = `/api/calls?status=open${searchTicker ? `&ticker=${encodeURIComponent(searchTicker)}` : ""}`;
        const rs = await fetch(url, { cache: "no-store" });
        const js = await rs.json();
        if (!rs.ok) throw new Error(js.error || "Failed to load stocks");
        const calls: OpenCall[] = Array.isArray(js) ? js : [];

        const items = calls.map((call) => {
          if (!call.ticker) return null;
          return {
            id: call.stock_id as string,
            ticker: call.ticker as string,
            entry: toNum(call.entry),
            target: toNum(call.t1),
            current: null,
            openedAt: call.opened_at ?? null,
            openedBy: call.opened_by ?? null,
            openedById: call.opened_by_id ?? null,
          } as OpenRow;
        });

        // De-duplicate by stock id to avoid duplicate React keys when multiple open calls exist per stock
        const deduped = Array.from(
          new Map((items.filter(Boolean) as OpenRow[]).map((row) => [row.id, row]))
            .values()
        );
        setRows(deduped);
        // Fetch prices in small batches without blocking UI
        (async () => {
          const tickers = deduped.map((r) => r.ticker);
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
  }, [searchTicker]);

  // OPEN: 60s price refresher (batched)
  useEffect(() => {
    if (rows.length === 0) return;
    const tickers = rows.map((r) => r.ticker);
    const id = setInterval(async () => {
      const batchSize = 8;
      for (let i = 0; i < tickers.length; i += batchSize) {
        const batch = tickers.slice(i, i + batchSize);
        const updates = await Promise.all(batch.map((t) => fetchPrice(t)));
        setRows((prev) => prev.map((row) => {
          const idx = batch.indexOf(row.ticker);
          return idx >= 0 ? { ...row, current: updates[idx] ?? row.current } : row;
        }));
        await sleep(0);
      }
    }, 60000);
    return () => clearInterval(id);
  }, [rows]);

  // ========== CLOSED: load + normalize (mount + 60s)
  const loadClosed = useCallback(async (alive: boolean, tickerFilter: string) => {
    setClosedLoading(true);
    setClosedErr('');
    try {
      const url = `/api/calls?status=closed${tickerFilter ? `&ticker=${encodeURIComponent(tickerFilter)}` : ''}`;
      const rs = await fetch(url, { cache: 'no-store' });
      const js = await rs.json();
      if (!rs.ok) throw new Error('Failed to load closed calls');
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
      normalizedRows.sort((a, b) => (b.closed_at ?? '').localeCompare(a.closed_at ?? ''));
      if (alive) setClosedRows(normalizedRows);
      // fetch prices in background batches
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
        // no separate cleanup needed; alive is captured from outer scope
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

  // CLOSED: 60s price refresher
  useEffect(() => {
    if (closedRows.length === 0) return;
    const tickers = closedRows.map((r) => r.ticker);
    const id = setInterval(async () => {
      const updates = await Promise.all(tickers.map((t) => fetchPrice(t)));
      setClosedRows((prev) => prev.map((row, i) => ({ ...row, current_price: updates[i] ?? row.current_price })));
    }, 60000);
    return () => clearInterval(id);
  }, [closedRows, closedRows.length]);

  // ========== UI ==========
  const openEmpty = !loading && !err && rows.length === 0;
  const closedEmpty = !closedLoading && !closedErr && closedRows.length === 0;

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Calls</h1>
          <div className="inline-flex rounded border overflow-hidden">
            <button
              className={`px-3 py-1 text-sm ${tab === "open" ? "tab-active" : "bg-white"}`}
              onClick={() => setTab("open")}
            >
              Open
            </button>
            <button
              className={`px-3 py-1 text-sm ${tab === "closed" ? "tab-active" : "bg-white"}`}
              onClick={() => setTab("closed")}
            >
              Closed
            </button>
            <button
              className={`px-3 py-1 text-sm ${tab === "hits" ? "tab-active" : "bg-white"}`}
              onClick={() => setTab("hits")}
            >
              Hits
            </button>
          </div>
          <form
            className="ml-2 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchTicker(query.trim().toUpperCase());
            }}
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by ticker (e.g., AAPL)"
              className="w-48"
              inputMode="text"
              autoCorrect="off"
              autoCapitalize="characters"
            />
            <Button type="submit" variant="outline" size="sm">Search</Button>
            {searchTicker && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setQuery(""); setSearchTicker(""); }}
              >
                Clear
              </Button>
            )}
          </form>
        </div>
        <div className="flex gap-2">
          <Link href="/stocks" className="px-3 py-2 rounded border hover:bg-gray-50">
            📃 List Stocks
          </Link>
          {(user?.role === 'admin' || user?.role === 'analyst') && (
            <Link href="/admin/quick-open-call" className="px-3 py-2 rounded border hover:bg-gray-50">
              ⚡ Quick Call
            </Link>
          )}
          {(user?.role === 'admin' || user?.role === 'analyst') && (
            <Link href="/admin/bulk-quick-calls" className="px-3 py-2 rounded border hover:bg-gray-50">
              📥 Bulk Quick Calls
            </Link>
          )}
          {(user?.role === 'admin' || user?.role === 'analyst') && (
            <Link href="/stocks/new" className="px-3 py-2 rounded btn-brand hover:opacity-95">
              ➕ New Stock
            </Link>
          )}
        </div>
      </div>

      {/* OPEN TAB */}
      {tab === "open" && (
        <>
          {loading && <p className="p-2">Loading…</p>}
          {err && <p className="p-2 text-red-500">{err}</p>}
          {openEmpty && <p className="p-2">No open calls.</p>}
          {!loading && !err && rows.length > 0 && (
            <div className="overflow-x-auto rounded border">
              <table className="nf-table text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border">Stock Ticker</th>
                    <th className="p-2 border">Analyst</th>
                    <th className="p-2 border">Entry</th>
                    <th className="p-2 border">Target</th>
                    <th className="p-2 border">Target % (vs Entry)</th>
                    <th className="p-2 border">Remaining Gains %</th>
                    <th className="p-2 border">Current Price</th>
                    <th className="p-2 border">Earnings %</th>
                    <th className="p-2 border">Entry Status</th>
                    <th className="p-2 border">Target Status</th>
                    <th className="p-2 border">Latest Buzz</th>
                    <th className="p-2 border">Latest News</th>
                    <th className="p-2 border">Entry Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ id, ticker, entry, target, current, openedAt, openedBy, openedById }) => {
                    const targetPct =
                      entry != null && entry > 0 && target != null ? ((target - entry) / entry) * 100 : null;
                    const remainingPct =
                      current != null && target != null && target !== 0 ? ((target - current) / target) * 100 : null;
                    const earningsPct =
                      entry != null && entry > 0 && current != null ? ((current - entry) / entry) * 100 : null;

                    const entryStatus =
                      entry != null && current != null ? (current >= entry ? "✅ Above Entry" : "❌ Below Entry") : "—";
                    const targetStatus = (() => {
                      if (target == null || current == null) return "—";
                      if (target === 0) return "—";
                      const diffPct = ((current - target) / target) * 100;
                      if (Math.abs(diffPct) < 0.5) return "✅ Near Target";
                      return diffPct >= 0 ? "✅ At/Above Target" : "⬇️ Below Target";
                    })();
                    const targetClass = (() => {
                      if (target == null || current == null || target === 0) return "";
                      if (current >= target) return "text-green-600 font-medium";
                      // Below target
                      return "text-amber-600 font-medium";
                    })();

                    return (
                      <tr key={id} className="hover:bg-gray-50">
                        <td className="p-2 border font-medium"><Link href={`/stocks/${id}`} className="underline">{ticker}</Link></td>
                        <td className="p-2 border whitespace-nowrap">
                          {openedById ? (
                            <Link href={`/analysts/${openedById}`} className="underline">{openedBy ?? openedById}</Link>
                          ) : (
                            openedBy ?? '-'
                          )}
                        </td>
                        <td className="p-2 border">{fmt(entry)}</td>
                        <td className="p-2 border">{fmt(target)}</td>
                        <td className="p-2 border">{fmt(targetPct)}</td>
                        <td className="p-2 border">{fmt(remainingPct)}</td>
                        <td className="p-2 border">{fmt(current)}</td>
                        <td className={`p-2 border ${
                          earningsPct == null
                            ? ''
                            : earningsPct >= 0
                            ? 'bg-green-100 font-medium'
                            : 'bg-red-100 font-medium'
                        }`}>{fmt(earningsPct)}</td>
                        <td className="p-2 border whitespace-nowrap">{entryStatus}</td>
                        <td className={`p-2 border whitespace-nowrap ${targetClass}`}>{targetStatus}</td>
                        <td className="p-2 border">
                          <Buzz t={ticker} />
                        </td>
                        <td className="p-2 border">
                          <News t={ticker} />
                        </td>
                        <td className="p-2 border">{ymd(openedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* CLOSED TAB */}
      {tab === "closed" && (
        <>
          {closedLoading && <p className="p-2">Loading…</p>}
          {closedErr && <p className="p-2 text-red-500">{closedErr}</p>}
          {closedEmpty && <p className="p-2">No closed calls.</p>}
          {!closedLoading && !closedErr && closedRows.length > 0 && (
            <div className="overflow-x-auto rounded border">
              <table className="nf-table text-sm text-center">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border">Stock Ticker</th>
                    <th className="p-2 border">Analyst</th>
                    <th className="p-2 border">Entry</th>
                    <th className="p-2 border">Target</th>
                    <th className="p-2 border">Stop Loss</th>
                    <th className="p-2 border">Opened</th>
                    <th className="p-2 border">Closed</th>
                    <th className="p-2 border">Outcome</th>
                    <th className="p-2 border">Result %</th>
                    <th className="p-2 border">Current Price</th>
                    <th className="p-2 border">Trend</th>
                    <th className="p-2 border">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {closedRows.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="p-2 border font-medium">
                        <Link href={c.stock_id ? `/stocks/${c.stock_id}` : '#'} className="underline">{c.ticker}</Link>
                      </td>
                      <td className="p-2 border whitespace-nowrap">
                        {c.opened_by_id ? (
                          <Link href={`/analysts/${c.opened_by_id}`} className="underline">{c.opened_by ?? c.opened_by_id}</Link>
                        ) : (
                          c.opened_by ?? '-'
                        )}
                      </td>
                      <td className="p-2 border">{fnum(c.entry_price)}</td>
                      <td className="p-2 border">{fnum(c.target_price)}</td>
                      <td className="p-2 border">{fnum(c.stop_loss)}</td>
                      <td className="p-2 border">{fdate(c.opened_at)}</td>
                      <td className="p-2 border">{fdate(c.closed_at)}</td>
                      <td className="p-2 border">{c.outcome ?? "-"}</td>
                      <td className={`p-2 border ${
                        c.result_pct == null
                          ? ''
                          : (c.result_pct as number) >= 0
                          ? 'text-green-600 font-medium'
                          : 'text-red-600 font-medium'
                      }`}>{fnum(c.result_pct)}</td>
                      <td className="p-2 border">{fnum(c.current_price)}</td>
                      <td className="p-2 border">
                        <PriceSparkline ticker={c.ticker} width={120} height={36} />
                      </td>
                      <td className="p-2 border">{c.note ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
