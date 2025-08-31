import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Out = {
  ticker: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  currency: string | null;
  marketState: string | null;
  time: number;
  source: string;
};

async function fromFinnhub(symbol: string): Promise<Out | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  const resp = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}`,
    { headers: { "X-Finnhub-Token": key }, cache: "no-store" }
  );
  if (!resp.ok) return null;
  const j = await resp.json();
  if (typeof j.c !== "number") return null;
  // j.c current, j.pc previous close
  const change = j.c - (j.pc ?? j.c);
  const changePct = j.pc ? (change / j.pc) * 100 : 0;
  return {
    ticker: symbol,
    price: j.c,
    change,
    changePct,
    currency: "USD",
    marketState: "REALTIME",
    time: Date.now(),
    source: "Finnhub",
  };
}

async function fromStooq(symbol: string): Promise<Out | null> {
  // Stooq expects US tickers as lowercased with .us suffix
  const stq = symbol.toLowerCase() + ".us";
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(
    stq
  )}&f=sd2t2ohlcv&h&e=csv`;
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) return null;
  const csv = await resp.text();
  // CSV header: Symbol,Date,Time,Open,High,Low,Close,Volume
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const cols = lines[1].split(",");
  const close = parseFloat(cols[6]);
  if (Number.isNaN(close)) return null;
  return {
    ticker: symbol,
    price: close,
    change: null,
    changePct: null,
    currency: "USD",
    marketState: "DELAYED",
    time: Date.now(),
    source: "Stooq",
  };
}

async function fromYahoo(symbol: string): Promise<Out | null> {
  const headers = { "User-Agent": "nfaa-app/1.0", Accept: "application/json" };
  for (const host of ["query1", "query2"]) {
    const r = await fetch(
      `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
        symbol
      )}`,
      { headers, cache: "no-store" }
    );
    if (!r.ok) continue;
    const json = await r.json();
    const q = json?.quoteResponse?.result?.[0];
    if (!q) return null;
    return {
      ticker: symbol,
      price: q.regularMarketPrice ?? null,
      change: q.regularMarketChange ?? null,
      changePct: q.regularMarketChangePercent ?? null,
      currency: q.currency ?? "USD",
      marketState: q.marketState ?? "UNKNOWN",
      time: q.regularMarketTime ? q.regularMarketTime * 1000 : Date.now(),
      source: "Yahoo",
    };
  }
  return null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ ticker?: string }> }
) {
  try {
    const { ticker } = await ctx.params;
    const symbol = (ticker || "").toUpperCase().trim();
    if (!symbol) {
      return NextResponse.json({ error: "Missing ticker" }, { status: 400 });
    }

    // Try providers in order
    const providers = [fromFinnhub, fromYahoo, fromStooq];

    for (const p of providers) {
      try {
        const out = await p(symbol);
        if (out) return NextResponse.json(out);
      } catch {
        // try next
      }
    }

    return NextResponse.json(
      { error: "No provider returned data" },
      { status: 502 }
    );
  } catch (e: any) {
    console.error("[/api/price] error:", e?.message || e);
    return NextResponse.json(
      { error: e?.message || "Fetch failed" },
      { status: 502 }
    );
  }
}
