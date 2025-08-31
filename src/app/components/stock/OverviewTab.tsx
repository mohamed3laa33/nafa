import { StockData } from "@/app/stocks/[id]/page";

function fmtNum(n: unknown, suffix = "") {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : Number(n);
  return Number.isFinite(v) ? `${v.toFixed(2)}${suffix}` : "—";
}

export default function OverviewTab({ stock }: { stock: StockData }) {
  const c = stock.latestOpenCall || null;

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Overview</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-bold">Sentiment</p>
          <p>{stock.sentiment || "N/A"}</p>
        </div>
        <div>
          <p className="font-bold">Score</p>
          <p>{stock.score_total ?? "N/A"}</p>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-lg font-bold mb-2">Latest Open Call</h3>

        {!c ? (
          <p>No open calls.</p>
        ) : (
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
                  <td className="p-2">{c.status ?? "—"}</td>
                  <td className="p-2">{fmtNum(c.entry)}</td>
                  <td className="p-2">{fmtNum(c.stop)}</td>
                  <td className="p-2">{fmtNum(c.t1)}</td>
                  <td className="p-2">{fmtNum(c.t2)}</td>
                  <td className="p-2">{fmtNum(c.t3)}</td>
                  <td className="p-2">{c.horizon_days ?? "—"}</td>
                  {/* show raw ISO strings to avoid hydration issues */}
                  <td className="p-2">{c.opened_at ?? "—"}</td>
                  <td className="p-2">{c.expires_at ?? "—"}</td>
                  <td className="p-2">{c.outcome ?? "—"}</td>
                  <td className="p-2">{c.which_target_hit ?? "—"}</td>
                  <td className="p-2">{fmtNum(c.close_price)}</td>
                  <td className="p-2">{fmtNum(c.result_pct, "%")}</td>
                </tr>
              </tbody>
            </table>
            {c.notes && <p className="mt-2 text-sm text-gray-700">Notes: {c.notes}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
