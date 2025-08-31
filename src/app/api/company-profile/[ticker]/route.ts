import { NextResponse } from "next/server";

async function yahooSearchName(symbol: string): Promise<string | null> {
  const r = await fetch(
    `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}`,
    { headers: { "User-Agent": "nfaa-app/1.0", Accept: "application/json" }, cache: "no-store" }
  ).catch(() => null as any);
  if (!r || !r.ok) return null;
  const j = await r.json();
  const hit = (j.quotes || []).find((q: any) => (q.symbol || "").toUpperCase() === symbol);
  const n = hit?.shortname || hit?.longname || hit?.name || null;
  return n && typeof n === "string" ? n.trim() : null;
}

async function yahooQuoteName(symbol: string): Promise<string | null> {
  for (const host of ["query1", "query2"]) {
    const r = await fetch(
      `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`,
      { headers: { "User-Agent": "nfaa-app/1.0", Accept: "application/json" }, cache: "no-store" }
    ).catch(() => null as any);
    if (!r || !r.ok) continue;
    const j = await r.json();
    const q = j?.quoteResponse?.result?.[0];
    const n = q?.longName ?? q?.shortName ?? q?.displayName ?? null;
    if (n && typeof n === "string" && n.trim()) return n.trim();
  }
  return null;
}

async function finnhubName(symbol: string): Promise<string | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  const r = await fetch(
    `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}`,
    { headers: { "X-Finnhub-Token": key }, cache: "no-store" }
  ).catch(() => null as any);
  if (!r || !r.ok) return null;
  const j = await r.json();
  const n = typeof j?.name === "string" ? j.name.trim() : null;
  return n && n.length ? n : null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await ctx.params;
    const symbol = (ticker || "").toUpperCase().trim();
    if (!symbol) return NextResponse.json({ error: "ticker required" }, { status: 400 });

    const name =
      (await yahooSearchName(symbol)) ??
      (await yahooQuoteName(symbol)) ??
      (await finnhubName(symbol)) ??
      null;

    return NextResponse.json({ name }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
