"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = { t: string };

export default function WatchlistPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [ticker, setTicker] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("watchlist") || "[]";
    try { setItems(JSON.parse(raw)); } catch { setItems([]); }
  }, []);

  const save = (next: Item[]) => {
    setItems(next);
    localStorage.setItem("watchlist", JSON.stringify(next));
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="AAPL" className="border rounded px-2 py-1" />
        <button className="px-3 py-1 btn-brand" onClick={() => {
          const t = ticker.trim().toUpperCase(); if (!t) return;
          if (items.some(i => i.t === t)) return;
          save([...items, { t }]); setTicker("");
        }}>Add</button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-600">No items yet. Add a ticker above.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.t} className="flex items-center justify-between border rounded px-3 py-2">
              <Link href={`/stocks`} className="font-mono">{i.t}</Link>
              <button className="text-sm text-red-600" onClick={() => save(items.filter(x => x.t !== i.t))}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
