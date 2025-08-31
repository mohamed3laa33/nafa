"use client";
import { useEffect, useState } from "react";

type Resp = {
  ticker: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  currency: string | null;
  marketState?: string | null;
};

const fmt = (n: number | null | undefined, suffix = "") =>
  n == null ? "—" : `${n.toFixed(2)}${suffix}`;

export default function PriceBadge({ ticker }: { ticker: string }) {
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
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [ticker]);

  if (err) return <span className="text-red-500 text-xs">—</span>;
  if (!d) return <span className="text-gray-400 text-xs">…</span>;

  const hasDelta = d.change != null && d.changePct != null;
  const up = (d.change ?? 0) > 0;

  return (
    <div className="flex items-center gap-2">
      <span className="font-bold">
        {fmt(d.price)} {d.currency ?? ""}
      </span>

      {hasDelta ? (
        <span className={up ? "text-green-600" : "text-red-600"}>
          {up ? "▲" : "▼"} {fmt(d.change)} ({fmt(d.changePct, "%")})
        </span>
      ) : (
        <span className="text-gray-500">—</span>
      )}

      <span className="text-xs text-gray-500">{d.marketState ?? ""}</span>
    </div>
  );
}
