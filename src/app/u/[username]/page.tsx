import Link from "next/link";

async function getProfile(username: string) {
  const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/analysts/by-username/${encodeURIComponent(username)}`, { cache: 'no-store' });
  if (!r.ok) return null;
  return r.json();
}

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const data = await getProfile(username);
  if (!data) return <div className="p-4">Profile not found</div>;
  const { analyst, stats, badges, recent_public } = data;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{analyst?.name}</h1>
        <div className="flex gap-2 flex-wrap">
          {(badges || []).map((b: string) => (
            <span key={b} className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded">{b}</span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded border"><div className="text-xs text-gray-500">Win Rate</div><div className="text-lg">{stats?.win_rate != null ? `${(Number(stats.win_rate)*100).toFixed(0)}%` : '—'}</div></div>
        <div className="p-3 rounded border"><div className="text-xs text-gray-500">Avg Return</div><div className="text-lg">{stats?.avg_return_pct != null ? `${Number(stats.avg_return_pct).toFixed(2)}%` : '—'}</div></div>
        <div className="p-3 rounded border"><div className="text-xs text-gray-500">Closed Calls</div><div className="text-lg">{stats?.closed_calls ?? 0}</div></div>
        <div className="p-3 rounded border"><div className="text-xs text-gray-500">Avg Days to Close</div><div className="text-lg">{stats?.avg_days_to_close != null ? Number(stats.avg_days_to_close).toFixed(1) : '—'}</div></div>
      </div>

      <div>
        <h2 className="text-lg font-medium mb-2">Public Calls</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="p-2">Ticker</th>
                <th className="p-2">Status</th>
                <th className="p-2">Entry</th>
                <th className="p-2">Target</th>
                <th className="p-2">Result</th>
                <th className="p-2">Opened</th>
              </tr>
            </thead>
            <tbody>
              {(recent_public || []).map((c: any) => (
                <tr key={c.id} className="border-t">
                  <td className="p-2 font-medium"><Link href={`/stocks/${c.stock_id}`}>{c.ticker}</Link></td>
                  <td className="p-2">{c.status}</td>
                  <td className="p-2">{c.entry ?? '—'}</td>
                  <td className="p-2">{c.target ?? '—'}</td>
                  <td className="p-2">{c.result_pct != null ? `${Number(c.result_pct).toFixed(2)}%` : '—'}</td>
                  <td className="p-2">{c.opened_at ? new Date(c.opened_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
