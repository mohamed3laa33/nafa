"use client";
import { useEffect, useState } from "react";

type Resp = {
  ticker: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  currency: string | null;
};

const fmt = (n: number | null | undefined, suffix = "") =>
  n == null ? "—" : `${n.toFixed(2)}${suffix}`;

export default function PriceCell({ ticker }: { ticker: string }) {
  const [d, setD] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch(`/api/price/${encodeURIComponent(ticker)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      setD(j);
    } catch (e: any) {
      setErr(e.message || "Fetch failed");
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [ticker]);

  if (err) return <span className="text-red-500 text-xs">—</span>;
  if (!d) return <span className="text-gray-400 text-xs">…</span>;

  const hasDelta = d.change != null && d.changePct != null;
  const up = (d.change ?? 0) > 0;

  return (
    <div className="whitespace-nowrap">
      <span className="font-semibold">{fmt(d.price)}</span>
      {hasDelta ? (
        <span className={`ml-2 text-xs ${up ? "text-green-600" : "text-red-600"}`}>
          {up ? "▲" : "▼"} {fmt(d.change)} ({fmt(d.changePct, "%")})
        </span>
      ) : (
        <span className="ml-2 text-xs text-gray-500">—</span>
      )}
    </div>
  );
}
