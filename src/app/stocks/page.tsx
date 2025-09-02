// src/app/stocks/page.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { headers } from "next/headers";

type Stock = { id: string; ticker: string; market?: string; name?: string };

export default async function StocksPage() {
  const h = await headers();                               // await it
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = process.env.NEXT_PUBLIC_BASE_URL || `${proto}://${host}`;

  const r = await fetch(`${base}/api/stocks?limit=200&page=1`, {
    cache: "no-store",
    headers: { cookie: h.get("cookie") ?? "" },            // forward auth cookies
  });

  if (!r.ok) {
    return <div className="p-4 text-red-500">Failed to load stocks ({r.status}).</div>;
  }

  const j = await r.json();
  const rows: Stock[] = Array.isArray(j?.data) ? j.data : [];

  // Get current user to gate actions
  let role: string | null = null;
  try {
    const me = await fetch(`${base}/api/auth/me`, {
      cache: 'no-store',
      headers: { cookie: h.get('cookie') ?? '' },
    });
    if (me.ok) {
      const mj = await me.json();
      role = mj?.user?.role ?? null;
    }
  } catch {}
  const canCreate = role === 'admin' || role === 'analyst';

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Stocks</h1>
        <div className="flex gap-2">
          {canCreate && (
            <Link href="/admin/quick-open-call" className="px-3 py-2 rounded border hover:bg-gray-50">
              ⚡ Quick Call
            </Link>
          )}
          {canCreate && (
            <Link href="/admin/bulk-quick-calls" className="px-3 py-2 rounded border hover:bg-gray-50">
              📥 Bulk Quick Calls
            </Link>
          )}
          {canCreate && (
            <Link href="/stocks/new" className="px-3 py-2 rounded bg-black text-white hover:opacity-90">
              ➕ New Stock
            </Link>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p>No stocks yet.</p>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">Ticker</th>
                <th className="p-2 border">Name</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="p-2 border">
                    <Link href={`/stocks/${s.id}`} className="underline">
                      {s.ticker}
                    </Link>
                  </td>
                  <td className="p-2 border">{s.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
