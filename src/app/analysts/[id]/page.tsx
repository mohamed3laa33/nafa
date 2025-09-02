import Link from "next/link";

async function getData(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/analysts/${id}`, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load');
  return data;
}

export default async function AnalystPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { analyst, stats, portfolio, recent_closed } = await getData(id);

  const pct = (n: number | null | undefined) => (n == null ? '—' : `${(n * 100).toFixed(1)}%`);
  const fnum = (n: number | null | undefined, d = 2) => (n == null ? '—' : Number(n).toFixed(d));
  const fdate = (s: string | null | undefined) => (!s ? '—' : new Date(s).toISOString().slice(0,10));

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analyst — {analyst?.name || analyst?.email}</h1>
        <Link href="/calls" className="px-3 py-2 rounded border hover:bg-gray-50">← Back to Calls</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 border rounded">
          <div className="text-gray-500 text-sm">Total Calls</div>
          <div className="text-2xl font-semibold">{stats?.total_calls ?? 0}</div>
        </div>
        <div className="p-4 border rounded">
          <div className="text-gray-500 text-sm">Closed Calls</div>
          <div className="text-2xl font-semibold">{stats?.closed_calls ?? 0}</div>
        </div>
        <div className="p-4 border rounded">
          <div className="text-gray-500 text-sm">Win Rate</div>
          <div className="text-2xl font-semibold">{pct(stats?.win_rate)}</div>
        </div>
        <div className="p-4 border rounded">
          <div className="text-gray-500 text-sm">Average Return (closed)</div>
          <div className="text-2xl font-semibold">{fnum(stats?.avg_return_pct, 1)}%</div>
        </div>
        <div className="p-4 border rounded">
          <div className="text-gray-500 text-sm">Open Calls</div>
          <div className="text-2xl font-semibold">{stats?.open_calls ?? 0}</div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Portfolio</h2>
        {Array.isArray(portfolio) && portfolio.length > 0 ? (
          <div className="overflow-x-auto rounded border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border">Ticker</th>
                  <th className="p-2 border">Name</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.map((s: any) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="p-2 border font-medium"><Link href={`/stocks/${s.id}`} className="underline">{s.ticker}</Link></td>
                    <td className="p-2 border">{s.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-600">No portfolio stocks.</p>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Recent Closed Calls</h2>
        {Array.isArray(recent_closed) && recent_closed.length > 0 ? (
          <div className="overflow-x-auto rounded border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border">Ticker</th>
                  <th className="p-2 border">Entry</th>
                  <th className="p-2 border">Target</th>
                  <th className="p-2 border">Outcome</th>
                  <th className="p-2 border">Result %</th>
                  <th className="p-2 border">Opened</th>
                  <th className="p-2 border">Closed</th>
                </tr>
              </thead>
              <tbody>
                {recent_closed.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="p-2 border">{c.ticker}</td>
                    <td className="p-2 border">{fnum(c.entry)}</td>
                    <td className="p-2 border">{fnum(c.target)}</td>
                    <td className="p-2 border">{c.outcome ?? '—'}</td>
                    <td className="p-2 border">{fnum(c.result_pct, 1)}%</td>
                    <td className="p-2 border">{fdate(c.opened_at)}</td>
                    <td className="p-2 border">{fdate(c.closed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-600">No closed calls yet.</p>
        )}
      </div>
    </div>
  );
}

