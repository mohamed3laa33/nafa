"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/AuthContext";

export default function NewStockPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loadingName, setLoadingName] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (user?.role !== "admin" && user?.role !== "analyst") {
    return <p>You are not authorized to view this page.</p>;
  }

  // Debounced, normalized ticker
  const normTicker = useMemo(() => ticker.trim().toUpperCase(), [ticker]);

  // Auto-fill name when ticker changes
  useEffect(() => {
    if (!normTicker) { setName(""); return; }

    const id = setTimeout(async () => {
      setLoadingName(true);
      try {
        const r = await fetch(`/api/company-profile/${encodeURIComponent(normTicker)}`, { cache: "no-store" });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j?.name) {
          setName(j.name);
        } else {
          setName(""); // clear if not found/500
        }
      } catch {
        setName("");
      } finally {
        setLoadingName(false);
      }
    }, 400);

    return () => clearTimeout(id);
  }, [normTicker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: normTicker }), // only ticker
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Failed to create stock");

      const id = j.data?.id ?? j.id;
      if (!id) throw new Error("Create response missing id");
      router.push(`/stocks/${id}`);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">New Stock</h1>
      <form onSubmit={handleSubmit} className="p-8 border rounded-lg shadow-md w-full max-w-lg">
        {error && <p className="text-red-500 mb-4">{error}</p>}

        <div className="mb-4">
          <label className="block mb-1">Ticker</label>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            className="w-full p-2 border rounded"
            required
            maxLength={5}
            placeholder="AAPL"
            autoFocus
          />
        </div>

        <div className="mb-6">
          <label className="block mb-1">Name (auto)</label>
          <input
            type="text"
            value={loadingName ? "Fetching…" : name}
            readOnly
            className="w-full p-2 border rounded bg-gray-50 text-gray-700"
            placeholder="Fetched automatically"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded disabled:opacity-60"
          disabled={!normTicker || submitting}
        >
          {submitting ? "Creating…" : "Create Stock"}
        </button>
      </form>
    </div>
  );
}
