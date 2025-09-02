"use client";

import { useState } from "react";
import { useAuth } from "@/app/AuthContext";

export default function BulkQuickCallsPage() {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  if (!user || (user.role !== "admin" && user.role !== "analyst")) return <div className="p-4 text-sm">You are not authorized to view this page.</div>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setOut(null); setLoading(true);
    try {
      const rows = text.split(/\r?\n/).filter(Boolean).map((l)=>l.trim());
      const r = await fetch('/api/admin/quick-open-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rows.map((line) => {
          const parts = line.includes(',') ? line.split(',') : line.split(/\s+/);
          return { ticker: String(parts[0]||'').toUpperCase(), entry: Number(parts[1]), target: Number(parts[2]) };
        }), is_public: isPublic }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setOut(j);
    } catch (e: any) { setErr(e?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-3">Bulk Quick Calls</h1>
      <p className="text-xs text-gray-600 mb-2">Paste rows: ticker, entry, target — one per line. CSV or whitespace.</p>
      {err && <div className="text-sm text-red-600 mb-2">{err}</div>}
      <form onSubmit={submit} className="space-y-3">
        <textarea value={text} onChange={(e)=>setText(e.target.value)} rows={10} className="w-full border rounded p-2 text-xs font-mono" placeholder={`ABCL, 4.55, 5.5\nAPLD 16.5 19\nHIMS, 44, 77`} />
        <label className="inline-flex items-center gap-2 text-xs">
          <input type="checkbox" checked={isPublic} onChange={(e)=>setIsPublic(e.target.checked)} />
          Public
        </label>
        <button disabled={loading} className="px-3 py-2 rounded btn-brand disabled:opacity-60">{loading?'Submitting…':'Open Calls'}</button>
      </form>
      {out && (
        <div className="mt-4 text-xs">
          <div className="font-semibold mb-1">Result</div>
          <pre className="bg-gray-50 border rounded p-2 overflow-auto">{JSON.stringify(out, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
