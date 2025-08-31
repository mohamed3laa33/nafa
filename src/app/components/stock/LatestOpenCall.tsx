"use client";

type Call = {
  id: string;
  entry?: string | number | null;
  stop?: string | number | null;
  t1?: string | number | null;
  t2?: string | number | null;
  t3?: string | number | null;
  horizon_days?: number | null;
  opened_at?: string | null;
  expires_at?: string | null;
  status?: string | null;
  outcome?: string | null;
  which_target_hit?: number | null;
  close_price?: string | number | null;
  result_pct?: string | number | null;
  notes?: string | null;
};

function fmtNum(n: unknown, suffix = "") {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? parseFloat(n) : Number(n);
  return Number.isFinite(v) ? `${v.toFixed(2)}${suffix}` : "—";
}
function fmtDate(s?: string | null) {
  if (!s) return "—";
  // client-only formatting; avoids SSR mismatch since component is client
  try { return new Date(s).toLocaleString(); } catch { return s; }
}
function badge(status?: string | null) {
  const base = "px-2 py-0.5 rounded text-xs font-medium";
  if (!status) return <span className={`${base} bg-gray-100 text-gray-700`}>—</span>;
  const s = status.toLowerCase();
  const cls =
    s === "open" ? "bg-green-100 text-green-700" :
    s === "closed" ? "bg-gray-200 text-gray-800" :
    "bg-gray-100 text-gray-700";
  return <span className={`${base} ${cls}`}>{status}</span>;
}

export default function LatestOpenCall({ call }: { call: Call | null }) {
  if (!call) return <p className="text-sm text-gray-500">No open call.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[640px] w-full border rounded">
        <thead className="bg-gray-50 text-left text-sm">
          <tr>
            <th className="p-2">Status</th>
            <th className="p-2">Entry</th>
            <th className="p-2">Stop</th>
            <th className="p-2">T1</th>
            <th className="p-2">T2</th>
            <th className="p-2">T3</th>
            <th className="p-2">Horizon (d)</th>
            <th className="p-2">Opened</th>
            <th className="p-2">Expires</th>
            <th className="p-2">Outcome</th>
            <th className="p-2">Hit</th>
            <th className="p-2">Close Px</th>
            <th className="p-2">Result %</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          <tr className="border-t">
            <td className="p-2">{badge(call.status)}</td>
            <td className="p-2">{fmtNum(call.entry)}</td>
            <td className="p-2">{fmtNum(call.stop)}</td>
            <td className="p-2">{fmtNum(call.t1)}</td>
            <td className="p-2">{fmtNum(call.t2)}</td>
            <td className="p-2">{fmtNum(call.t3)}</td>
            <td className="p-2">{call.horizon_days ?? "—"}</td>
            <td className="p-2">{fmtDate(call.opened_at)}</td>
            <td className="p-2">{fmtDate(call.expires_at)}</td>
            <td className="p-2">{call.outcome ?? "—"}</td>
            <td className="p-2">{call.which_target_hit ?? "—"}</td>
            <td className="p-2">{fmtNum(call.close_price)}</td>
            <td className="p-2">{fmtNum(call.result_pct, "%")}</td>
          </tr>
        </tbody>
      </table>
      {call.notes && <p className="mt-2 text-sm text-gray-700">Notes: {call.notes}</p>}
    </div>
  );
}
