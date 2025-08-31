// src/app/calls/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Stock = { id: string; ticker: string };

type OpenCall = {
  entry?: number | string | null;
  t1?: number | string | null;        // target
  opened_at?: string | null;          // entry date
};

type ClosedFromAPI = {
  type?: string | null;
  entry?: number | string | null;
  exit?: number | string | null;
  t1?: number | string | null;
  stop?: number | string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  outcome?: "target_hit" | "stop_hit" | "cancelled" | string | null;
  note?: string | null;
  result_pct?: number | string | null; // if your API returns it
};

type OpenRow = {
  ticker: string;
  entry: number | null;
  target: number | null;
  current: number | null;
  openedAt: string | null;
};

type ClosedRow = {
  ticker: string;
  type: string | null;
  entry: number | null;
  exit: number | null;
  target: number | null;
  stop: number | null;
  openedAt: string | null;
  closedAt: string | null;
  outcome: string | null;
  note: string | null;
  resultPct: number | null;
};

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
};
const fmt = (n: number | null, d = 2) => (n == null ? "—" : n.toFixed(d));
const ymd = (s?: string | null) => (!s ? "—" : new Date(s).toISOString().slice(0, 10));

async function fetchPrice(ticker: string): Promise<number | null> {
  try {
    const r = await fetch(`/api/price/${encodeURIComponent(ticker)}`, { cache: "no-store" });
    const j = await r.json();
    return r.ok && typeof j.price === "number" ? j.price : null;
  } catch { return null; }
}

const Buzz = ({ t }: { t: string }) => (
  <a
    className="text-blue-600"
    target="_blank"
    rel="noopener noreferrer"
    href={`https://x.com/search?q=%24${encodeURIComponent(t)}%20lang%3Aen%20-filter%3Aretweets%20min_faves%3A10&f=live`}
  >
    X Live — {t}
  </a>
);
const News = ({ t }: { t: string }) => (
  <a
    className="text-blue-600"
    target="_blank"
    rel="noopener noreferrer"
    href={`https://news.google.com/search?q=${encodeURIComponent(t)}&hl=en-US&gl=US&ceid=US:en`}
  >
    News — {t}
  </a>
);

export default function CallsPage() {
  const [tab, setTab] = useState<"open" | "closed">("open");

  // OPEN
  const [rows, setRows] = useState<OpenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // CLOSED
  const [closed, setClosed] = useState<ClosedRow[]>([]);
  const [closedLoading, setClosedLoading] = useState(true);
  const [closedErr, setClosedErr] = useState("");

  // ========== OPEN: initial load ==========
  useEffect(() => {
    (async () => {
      setLoading(true); setErr("");
      try {
        const rs = await fetch(`/api/stocks?limit=200&page=1`, { cache: "no-store" });
        const js = await rs.json();
        if (!rs.ok) throw new Error(js.error || "Failed to load stocks");
        const stocks: Stock[] = Array.isArray(js?.data) ? js.data : [];

        const items = await Promise.all(
          stocks.map(async (s) => {
            const r = await fetch(`/api/stocks/${s.id}`, { cache: "no-store" });
            const j = await r.json();
            if (!r.ok) return null;
            const call: OpenCall | null = j?.latestOpenCall ?? null;
            if (!call) return null;
            const px = await fetchPrice(s.ticker);
            return {
              ticker: s.ticker,
              entry: toNum(call.entry),
              target: toNum(call.t1),
              current: px,
              openedAt: call.opened_at ?? null,
            } as OpenRow;
          })
        );

        setRows(items.filter(Boolean) as OpenRow[]);
      } catch (e: any) {
        setErr(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // OPEN: 2s price refresher
  useEffect(() => {
    if (rows.length === 0) return;
    const tickers = rows.map((r) => r.ticker);
    const id = setInterval(async () => {
      const updates = await Promise.all(tickers.map((t) => fetchPrice(t)));
      setRows((prev) => prev.map((row, i) => ({ ...row, current: updates[i] ?? row.current })));
    }, 2000);
    return () => clearInterval(id);
  }, [rows.length]);

  // ========== CLOSED: aggregate per-stock history ==========
useEffect(() => {
  (async () => {
    setClosedLoading(true); setClosedErr("");
    try {
      const rs = await fetch(`/api/stocks?limit=200&page=1`, { cache: "no-store" });
      const js = await rs.json();
      if (!rs.ok) throw new Error(js.error || "Failed to load stocks");
      const stocks: Stock[] = Array.isArray(js?.data) ? js.data : [];

      const allClosed: ClosedRow[] = [];

      await Promise.all(
        stocks.map(async (s) => {
          const r = await fetch(`/api/stocks/${s.id}`, { cache: "no-store" });
          const j = await r.json();
          if (!r.ok) return;

          // Accept multiple possible keys for history
          const listRaw =
            (Array.isArray(j?.callHistory) && j.callHistory) ||
            (Array.isArray(j?.history) && j.history) ||
            (Array.isArray(j?.calls) && j.calls) ||
            (Array.isArray(j?.data?.callHistory) && j.data.callHistory) ||
            (Array.isArray(j?.data?.history) && j.data.history) ||
            (Array.isArray(j?.data?.calls) && j.data.calls) ||
            [];

          // Normalize and keep only CLOSED items
          for (const c of listRaw) {
            const closedAt = c.closed_at ?? c.closedAt ?? c.closed ?? null;
            const outcome  = c.outcome ?? null;
            const isClosed = !!closedAt || (outcome && outcome !== "open");
            if (!isClosed) continue;

            const entry  = toNum(c.entry);
            const exit   = toNum(c.exit ?? c.close ?? c.closed_price);
            const target = toNum(c.t1 ?? c.target);
            const stop   = toNum(c.stop);

            const resultPct =
              c.result_pct != null
                ? toNum(c.result_pct)
                : (entry != null && entry > 0 && exit != null)
                ? ((exit - entry) / entry) * 100
                : null;

            allClosed.push({
              ticker: s.ticker,
              type: c.type ?? null,
              entry,
              exit,
              target,
              stop,
              openedAt: c.opened_at ?? c.openedAt ?? c.opened ?? null,
              closedAt,
              outcome,
              note: c.note ?? null,
              resultPct,
            });
          }
        })
      );

      // newest first
      allClosed.sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""));
      setClosed(allClosed);
    } catch (e: any) {
      setClosedErr(e.message || "Failed to load closed calls");
    } finally {
      setClosedLoading(false);
    }
  })();
}, []);
  // ========== UI ==========
  const openEmpty = !loading && !err && rows.length === 0;
  const closedEmpty = !closedLoading && !closedErr && closed.length === 0;

  return (
    <div className="p-4">
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Calls</h1>
          <div className="inline-flex rounded border overflow-hidden">
            <button
              className={`px-3 py-1 text-sm ${tab === "open" ? "bg-black text-white" : "bg-white"}`}
              onClick={() => setTab("open")}
            >
              Open
            </button>
            <button
              className={`px-3 py-1 text-sm ${tab === "closed" ? "bg-black text-white" : "bg-white"}`}
              onClick={() => setTab("closed")}
            >
              Closed
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/stocks" className="px-3 py-2 rounded border hover:bg-gray-50">📃 List Stocks</Link>
          <Link href="/stocks/new" className="px-3 py-2 rounded bg-black text-white hover:opacity-90">➕ New Stock</Link>
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
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border">Stock Ticker</th>
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
                  {rows.map(({ ticker, entry, target, current, openedAt }) => {
                    const targetPct =
                      entry != null && entry > 0 && target != null
                        ? ((target - entry) / entry) * 100
                        : null;
                    const remainingPct =
                      current != null && target != null && target !== 0
                        ? ((target - current) / target) * 100
                        : null;
                    const earningsPct =
                      entry != null && entry > 0 && current != null
                        ? ((current - entry) / entry) * 100
                        : null;

                    const entryStatus =
                      entry != null && current != null
                        ? current >= entry
                          ? "✅ Above Entry"
                          : "❌ Below Entry"
                        : "—";
                    const targetStatus =
                      target != null && current != null
                        ? current >= target
                          ? "🌟 At/Above Target"
                          : "🌟 Below Target"
                        : "—";

                    return (
                      <tr key={ticker} className="hover:bg-gray-50">
                        <td className="p-2 border font-medium">{ticker}</td>
                        <td className="p-2 border">{fmt(entry)}</td>
                        <td className="p-2 border">{fmt(target)}</td>
                        <td className="p-2 border">{fmt(targetPct)}</td>
                        <td className="p-2 border">{fmt(remainingPct)}</td>
                        <td className="p-2 border">{fmt(current)}</td>
                        <td className="p-2 border">{fmt(earningsPct)}</td>
                        <td className="p-2 border whitespace-nowrap">{entryStatus}</td>
                        <td className="p-2 border whitespace-nowrap">{targetStatus}</td>
                        <td className="p-2 border"><Buzz t={ticker} /></td>
                        <td className="p-2 border"><News t={ticker} /></td>
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
          {!closedLoading && !closedErr && closed.length > 0 && (
            <div className="overflow-x-auto rounded border">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border">Stock Ticker</th>
                    <th className="p-2 border">Type</th>
                    <th className="p-2 border">Entry</th>
                    <th className="p-2 border">Exit</th>
                    <th className="p-2 border">Result %</th>
                    <th className="p-2 border">Target</th>
                    <th className="p-2 border">Stop</th>
                    <th className="p-2 border">Outcome</th>
                    <th className="p-2 border">Opened</th>
                    <th className="p-2 border">Closed</th>
                    <th className="p-2 border">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {closed.map((r) => (
                    <tr key={`${r.ticker}-${r.openedAt}-${r.closedAt}`} className="hover:bg-gray-50">
                      <td className="p-2 border font-medium">{r.ticker}</td>
                      <td className="p-2 border">{r.type ?? "—"}</td>
                      <td className="p-2 border">{fmt(r.entry)}</td>
                      <td className="p-2 border">{fmt(r.exit)}</td>
                      <td className="p-2 border">{fmt(r.resultPct)}</td>
                      <td className="p-2 border">{fmt(r.target)}</td>
                      <td className="p-2 border">{fmt(r.stop)}</td>
                      <td className="p-2 border">{r.outcome ?? "—"}</td>
                      <td className="p-2 border">{ymd(r.openedAt)}</td>
                      <td className="p-2 border">{ymd(r.closedAt)}</td>
                      <td className="p-2 border">{r.note ?? "—"}</td>
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
