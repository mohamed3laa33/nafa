"use client";

import { useState } from "react";
import { useAuth } from "@/app/AuthContext";
import { useRouter } from "next/navigation";

export default function QuickOpenCallPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [entry, setEntry] = useState("");
  const [target, setTarget] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  if (!user || (user.role !== "admin" && user.role !== "analyst")) {
    return <div className="p-4 text-sm">You are not authorized to view this page.</div>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setOk(""); setLoading(true);
    try {
      const r = await fetch('/api/admin/quick-open-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: ticker.trim().toUpperCase(),
          entry_price: Number(entry),
          target_price: Number(target),
          is_public: isPublic,
        }),
      });
      const j = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(j.error || 'Failed');
      setOk('Call opened');
      if (j.stockId) router.push(`/stocks/${j.stockId}`);
    } catch (e: any) {
      setErr(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-3">Quick Open Call</h1>
      {err && <div className="text-sm text-red-600 mb-2">{err}</div>}
      {ok && <div className="text-sm text-green-600 mb-2">{ok}</div>}
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="text-xs block mb-1">Ticker</label>
          <input value={ticker} onChange={(e)=>setTicker(e.target.value.toUpperCase())} className="w-full border rounded px-2 py-1" placeholder="AAPL" maxLength={8} required />
        </div>
        <div>
          <label className="text-xs block mb-1">Entry</label>
          <input value={entry} onChange={(e)=>setEntry(e.target.value)} className="w-full border rounded px-2 py-1" type="number" step="0.0001" required />
        </div>
        <div>
          <label className="text-xs block mb-1">Target</label>
          <input value={target} onChange={(e)=>setTarget(e.target.value)} className="w-full border rounded px-2 py-1" type="number" step="0.0001" required />
        </div>
        <label className="inline-flex items-center gap-2 text-xs">
          <input type="checkbox" checked={isPublic} onChange={(e)=>setIsPublic(e.target.checked)} />
          Public
        </label>
        <button disabled={loading} className="w-full bg-black text-white rounded py-2 disabled:opacity-60">{loading?'Submitting…':'Open Call'}</button>
      </form>
    </div>
  );
}
