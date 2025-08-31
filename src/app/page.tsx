"use client";

import { useEffect, useState } from "react";

type Stock = { id: string; ticker: string };
type OpenCall = {
  entry?: number | string | null;
  t1?: number | string | null;        // target price
  opened_at?: string | null;
};

function n(x: unknown): number | null {
  if (x === null || x === undefined || x === "") return null;
  const v = typeof x === "string" ? Number(x) : (x as number);
  return Number.isFinite(v) ? v : null;
}
const fmt = (v: number | null, d = 2) => (v == null ? "—" : v.toFixed(d));
const ymd = (s?: string | null) => (!s ? "—" : new Date(s).toISOString().slice(0, 10));

async function price(t: string): Promise<number | null> {
  try {
    const r = await fetch(`/api/price/${encodeURIComponent(t)}`, { cache: "no-store" });
    const j = await r.json();
    return r.ok && typeof j.price === "number" ? j.price : null;
  } catch {
    return null;
  }
}

const Buzz = ({ t }: { t: string }) => (
  <a
    className="text-blue-600"
    target="_blank"
    rel="noopener noreferrer"
    href={`https://x.com/search?q=%24${encodeURIComponent(t)}%20lang%3Aen%20-filter%3Aretweets%20min_faves%3A10&f=live`}
  >
    X Live - {t}
  </a>
);
const News = ({ t }: { t: string }) => (
  <a
    className="text-blue-600"
    target="_blank"
    rel="noopener noreferrer"
    href={`https://news.google.com/search?q=${encodeURIComponent(t)}&hl=en-US&gl=US&ceid=US:en`}
  >
    News - {t}
  </a>
);

export default function OpenCallsPage() {
  const [rows, setRows] = useState<
    Array<{ ticker: string; call: OpenCall; current: number | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // 1) get stocks
        const rs = await fetch(`/api/stocks?limit=200&page=1`, { cache: "no-store" });
        const js = await rs.json();
        if (!rs.ok) throw new Error(js.error || "Failed to load stocks");
        const stocks: Stock[] = Array.isArray(js?.data) ? js.data : [];

        // 2) for each, load latest open call + price
        const items = await Promise.all(
          stocks.map(async (s) => {
            const r = await fetch(`/api/stocks/${s.id}`, { cache: "no-store" });
            const j = await r.json();
            const call: OpenCall | null = r.ok ? j?.latestOpenCall ?? null : null;
            if (!call) return null;
            const px = await price(s.ticker);
            return { ticker: s.ticker, call, current: px };
          })
        );

        setRows(items.filter(Boolean) as any[]);
      } catch (e: any) {
        setErr(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p>Loading…</p>;
  if (err) return <p className="text-red-500">{err}</p>;
  if (rows.length === 0) return <p>No open calls.</p>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Open Calls</h1>

      <div className="overflow-x-auto rounded border">
        <table className="w-full border-collapse text-sm text-center">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border text-left">Stock Ticker</th>
              <th className="p-2 border">Entry</th>
              <th className="p-2 border">Target (Price)</th>
              <th className="p-2 border">Target % (of Target)</th>
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
            {rows.map(({ ticker, call, current }) => {
              const entry = n(call.entry);
              const target = n(call.t1);
              const cur = current;

              // Your requested formula: (((entry/target)*100) - 100) * -1  === ((target - entry)/target)*100
              const targetPct =
                entry != null && target != null && target !== 0
                  ? ((target - entry) / target) * 100
                  : null;

              const remainingPct =
                cur != null && target != null && target !== 0
                  ? ((target - cur) / target) * 100
                  : null;

              const earningsPct =
                entry != null && entry > 0 && cur != null
                  ? ((cur - entry) / entry) * 100
                  : null;

              const entryStatus =
                entry != null && cur != null
                  ? cur >= entry
                    ? "✅ Above Entry"
                    : "❌ Below Entry"
                  : "—";

              const targetStatus =
                target != null && cur != null
                  ? cur >= target
                    ? "🌟 At/Above Target"
                    : "🌟 Below Target"
                  : "—";

              return (
                <tr key={ticker} className="hover:bg-gray-50">
                  <td className="p-2 border font-medium text-left">{ticker}</td>
                  <td className="p-2 border">{fmt(entry)}</td>
                  <td className="p-2 border">{fmt(target)}</td>
                  <td className="p-2 border">{fmt(targetPct)}</td>
                  <td className="p-2 border">{fmt(remainingPct)}</td>
                  <td className="p-2 border">{fmt(cur)}</td>
                  <td className="p-2 border">{fmt(earningsPct)}</td>
                  <td className="p-2 border whitespace-nowrap">{entryStatus}</td>
                  <td className="p-2 border whitespace-nowrap">{targetStatus}</td>
                  <td className="p-2 border"><Buzz t={ticker} /></td>
                  <td className="p-2 border"><News t={ticker} /></td>
                  <td className="p-2 border">{ymd(call.opened_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
