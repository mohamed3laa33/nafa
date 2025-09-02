"use client";

import { useState, useEffect, useCallback } from "react";

type CallStatus = "open" | "closed";
type CallType = "buy" | "sell";

interface Call {
  id: string;                 // UUID
  stock_id: string;           // UUID
  type: CallType;
  entry_price: number;
  target_price: number | null;
  stop_loss: number | null;
  note?: string | null;
  status: CallStatus;
  outcome?: string | null;
  result_pct?: number | null;
  opened_at: string;
  closed_at?: string | null;
  is_public?: 0 | 1 | boolean;
}

interface CallsTabProps {
  stockId: string;            // UUID string
  isOwner: boolean;
}

export default function CallsTab({ stockId, isOwner }: CallsTabProps) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [type, setType] = useState<CallType>("buy");
  const [entryPrice, setEntryPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [note, setNote] = useState("");
  const [isFundamental, setIsFundamental] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  // stable date formatter (UTC, en-GB to avoid hydration mismatch)
  const fmt = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
    timeZone: "UTC",
  });
  const fdate = (s: string | null | undefined) =>
    s ? fmt.format(new Date(s)) : "-";

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/stocks/${stockId}/calls`, { cache: "no-store" });
      if (!res.ok) {
        setError("Failed to fetch calls");
        setCalls([]);
        setLoading(false);
        return;
      }
      const json = await res.json();
      const data = Array.isArray(json?.data) ? (json.data as Call[]) : [];
      setCalls(data);
    } catch {
      setError("An unexpected error occurred.");
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [stockId]);

  useEffect(() => {
    if (stockId) fetchCalls();
  }, [stockId, fetchCalls]);

  const handleOpenCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    let payload: any;
    if (isFundamental) {
      payload = {
        type,
        is_public: isPublic,
        note: note.trim() || undefined,
      };
    } else {
      payload = {
        type,
        entry_price: parseFloat(entryPrice),
        target_price: targetPrice ? parseFloat(targetPrice) : null,
        stop_loss: stopLoss ? parseFloat(stopLoss) : null,
        is_public: isPublic,
        note: note.trim() || undefined,
      };
      if (!payload.entry_price || Number.isNaN(payload.entry_price)) {
        setError("Entry price is required and must be a number.");
        return;
      }
    }

    try {
      const res = await fetch(`/api/stocks/${stockId}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        setError(errText || "Failed to open call");
        return;
      }

      // Reset form and refresh
      setType("buy");
      setEntryPrice("");
      setTargetPrice("");
      setStopLoss("");
      setNote("");
      setIsFundamental(false);
      setIsPublic(false);
      await fetchCalls();
    } catch {
      setError("An unexpected error occurred while opening the call.");
    }
  };

  const handleCloseCall = async (
    callId: string,
    outcome: "target_hit" | "stop_hit" | "cancelled" | "expired",
    which_target_hit?: number
  ) => {
    if (!confirm(`Are you sure you want to close this call as ${outcome}?`)) return;
    setError("");

    try {
      const res = await fetch(`/api/calls/${callId}/close`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, which_target_hit }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        setError(errText || "Failed to close call");
        return;
      }

      await fetchCalls();
    } catch {
      setError("An unexpected error occurred while closing the call.");
    }
  };

  const openCalls = Array.isArray(calls) ? calls.filter((c) => c.status === "open") : [];
  const closedCalls = Array.isArray(calls) ? calls.filter((c) => c.status === "closed") : [];

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div>
      {isOwner && (
        <form onSubmit={handleOpenCall} className="mb-8 p-4 border rounded-lg space-y-4">
          <h3 className="text-xl font-bold">Open New Call</h3>
          <div className="flex items-center gap-6 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={isFundamental} onChange={(e) => setIsFundamental(e.target.checked)} />
              Fundamental (no entry/target)
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              Public
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-sm mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CallType)}
                className="w-full p-2 border rounded"
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">Entry</label>
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="e.g. 10.50"
                className="w-full p-2 border rounded disabled:opacity-60"
                required={!isFundamental}
                disabled={isFundamental}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Target</label>
              <input
                type="number"
                step="any"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="e.g. 11.20"
                className="w-full p-2 border rounded disabled:opacity-60"
                disabled={isFundamental}
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Stop</label>
              <input
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="e.g. 9.80"
                className="w-full p-2 border rounded disabled:opacity-60"
                disabled={isFundamental}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Note</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note"
                className="w-full p-2 border rounded"
              />
            </div>
          </div>

          <button type="submit" className="bg-blue-500 text-white py-2 px-4 rounded">
            Open Call
          </button>
        </form>
      )}

      <h3 className="text-xl font-bold mb-2">Open Calls</h3>
      <div className="overflow-x-auto mb-8">
        <table className="nf-table text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Entry</th>
              <th className="py-2 pr-4">Target</th>
              <th className="py-2 pr-4">Stop</th>
              <th className="py-2 pr-4">Opened</th>
              <th className="py-2 pr-4">Note</th>
              {isOwner && <th className="py-2 pr-4">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {openCalls.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="py-2 pr-4 capitalize">{c.type}</td>
                <td className="py-2 pr-4">{!c.entry_price || c.entry_price === 0 ? '-' : c.entry_price}</td>
                <td className="py-2 pr-4">{!c.target_price || c.target_price === 0 ? '-' : c.target_price}</td>
                <td className="py-2 pr-4">{!c.stop_loss || c.stop_loss === 0 ? '-' : c.stop_loss}</td>
                <td className="py-2 pr-4">{fdate(c.opened_at)}</td>
                <td className="py-2 pr-4">{c.note ?? "-"}</td>
                {isOwner && (
                  <td className="py-2 pr-4 space-x-2">
                    <button
                      onClick={async () => {
                        try {
                          await fetch(`/api/calls/${c.id}/public`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_public: !(c.is_public ? true : false) }) });
                          await fetchCalls();
                        } catch {}
                      }}
                      className="text-purple-700"
                    >
                      {c.is_public ? 'Make Private' : 'Make Public'}
                    </button>
                    <button
                      onClick={() => handleCloseCall(c.id, "target_hit", 1)}
                      className="text-green-600"
                    >
                      Close: Target
                    </button>
                    <button
                      onClick={() => handleCloseCall(c.id, "stop_hit")}
                      className="text-red-600"
                    >
                      Close: Stopped
                    </button>
                    <button
                      onClick={() => handleCloseCall(c.id, "cancelled")}
                      className="text-gray-600"
                    >
                      Close: Cancel
                    </button>
                    <button
                      onClick={() => handleCloseCall(c.id, "expired")}
                      className="text-yellow-600"
                    >
                      Close: Expired
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {openCalls.length === 0 && (
              <tr>
                <td colSpan={isOwner ? 7 : 6} className="py-3 text-gray-500">
                  No open calls.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-bold mb-2">Call History</h3>
      <div className="overflow-x-auto">
        <table className="nf-table text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Entry</th>
              <th className="py-2 pr-4">Target</th>
              <th className="py-2 pr-4">Stop</th>
              <th className="py-2 pr-4">Opened</th>
              <th className="py-2 pr-4">Outcome</th>
              <th className="py-2 pr-4">Result %</th>
              <th className="py-2 pr-4">Closed</th>
              <th className="py-2 pr-4">Note</th>
            </tr>
          </thead>
          <tbody>
            {closedCalls.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="py-2 pr-4 capitalize">{c.type}</td>
                <td className="py-2 pr-4">{!c.entry_price || c.entry_price === 0 ? '-' : c.entry_price}</td>
                <td className="py-2 pr-4">{!c.target_price || c.target_price === 0 ? '-' : c.target_price}</td>
                <td className="py-2 pr-4">{!c.stop_loss || c.stop_loss === 0 ? '-' : c.stop_loss}</td>
                <td className="py-2 pr-4">{fdate(c.opened_at)}</td>
                <td className="py-2 pr-4">{c.outcome ?? "-"}</td>
                <td className="py-2 pr-4">{c.result_pct ?? "-"}</td>
                <td className="py-2 pr-4">{fdate(c.closed_at || null)}</td>
                <td className="py-2 pr-4">{c.note ?? "-"}</td>
              </tr>
            ))}
            {closedCalls.length === 0 && (
              <tr>
                <td colSpan={9} className="py-3 text-gray-500">
                  No closed calls yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
