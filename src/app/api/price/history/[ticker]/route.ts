import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

async function fromYahoo(symbol: string, days = 120): Promise<Candle[] | null> {
  const headers = { "User-Agent": "nfaa-app/1.0", Accept: "application/json" } as const;
  // Pull up to ~2y of daily candles, then slice locally
  for (const host of ["query1", "query2"]) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2y`;
      const r = await fetch(url, { headers, cache: "no-store" });
      if (!r.ok) continue;
      const j = await r.json();
      const res = j?.chart?.result?.[0];
      const ts: number[] = res?.timestamp ?? [];
      const q = res?.indicators?.quote?.[0];
      if (!ts.length || !q) continue;
      const o: (number | null)[] = q.open ?? [];
      const h: (number | null)[] = q.high ?? [];
      const l: (number | null)[] = q.low ?? [];
      const c: (number | null)[] = q.close ?? [];
      const v: (number | null)[] = q.volume ?? [];
      const out: Candle[] = [];
      for (let i = 0; i < ts.length; i++) {
        const open = Number(o[i]);
        const high = Number(h[i]);
        const low = Number(l[i]);
        const close = Number(c[i]);
        const vol = Number(v[i] ?? 0);
        if (!Number.isFinite(close) || !Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low)) continue;
        out.push({ t: ts[i] * 1000, o: open, h: high, l: low, c: close, v: Number.isFinite(vol) ? vol : 0 });
      }
      if (out.length) return out.slice(-days);
    } catch {}
  }
  return null;
}

async function fromStooq(symbol: string, days = 120): Promise<Candle[] | null> {
  // Stooq expects US tickers as lowercased with .us suffix
  const stq = symbol.toLowerCase() + ".us";
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stq)}&i=d`;
  const r = await fetch(url, { cache: "no-store" }).catch(() => null as any);
  if (!r || !r.ok) return null;
  const csv = await r.text();
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  // Header: Date,Open,High,Low,Close,Volume
  const out: Candle[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const d = cols[0];
    const open = parseFloat(cols[1]);
    const high = parseFloat(cols[2]);
    const low = parseFloat(cols[3]);
    const close = parseFloat(cols[4]);
    const vol = parseFloat(cols[5]);
    if (!Number.isFinite(close) || !Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low)) continue;
    const t = Date.parse(d);
    if (!Number.isFinite(t)) continue;
    out.push({ t, o: open, h: high, l: low, c: close, v: Number.isFinite(vol) ? vol : 0 });
  }
  // keep only last N
  return out.slice(-days);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ ticker?: string }> }
) {
  try {
    const { ticker } = await ctx.params;
    const symbol = (ticker || "").toUpperCase().trim();
    if (!symbol) return NextResponse.json({ error: "Missing ticker" }, { status: 400 });

    // Prefer Yahoo; fallback to Stooq
    const days = 120;
    let candles = (await fromYahoo(symbol, days)) ?? [];
    if (!candles.length) candles = (await fromStooq(symbol, days)) ?? [];
    if (!candles.length) return NextResponse.json({ error: "No data" }, { status: 502 });

    return NextResponse.json({ ticker: symbol, candles });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
