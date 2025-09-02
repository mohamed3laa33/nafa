"use client";
import { useEffect, useState } from "react";

type Resp = {
  ticker: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  currency: string | null;
  marketState?: string | null;
  prePrice?: number | null;
  preChange?: number | null;
  preChangePct?: number | null;
  postPrice?: number | null;
  postChange?: number | null;
  postChangePct?: number | null;
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

  const Pre = () => {
    if (d.prePrice == null) return null;
    const up = (d.preChange ?? 0) >= 0;
    return (
      <div className="text-xs">
        <span className="opacity-60 mr-1">Pre:</span>
        <span className="mr-1">{fmt(d.prePrice)} {d.currency ?? ''}</span>
        <span className={up ? 'text-green-600' : 'text-red-600'}>
          {up ? '▲' : '▼'} {fmt(d.preChange)} ({fmt(d.preChangePct, '%')})
        </span>
      </div>
    );
  };
  const Post = () => {
    if (d.postPrice == null) return null;
    const up = (d.postChange ?? 0) >= 0;
    return (
      <div className="text-xs">
        <span className="opacity-60 mr-1">Post:</span>
        <span className="mr-1">{fmt(d.postPrice)} {d.currency ?? ''}</span>
        <span className={up ? 'text-green-600' : 'text-red-600'}>
          {up ? '▲' : '▼'} {fmt(d.postChange)} ({fmt(d.postChangePct, '%')})
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col">
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
      <Pre />
      <Post />
    </div>
  );
}
