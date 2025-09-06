import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function yahooQuote(symbol: string) {
  const headers = { "User-Agent": "nfaa-app/1.0", Accept: "application/json" } as const;
  for (const host of ["query1", "query2"]) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`, { headers, cache: "no-store" });
      if (!r.ok) continue;
      const j = await r.json();
      const q = j?.quoteResponse?.result?.[0];
      if (q) return q;
    } catch {}
  }
  return null;
}

async function finnhubPriceTarget(symbol: string) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  try {
    const url = `https://finnhub.io/api/v1/stock/price-target?symbol=${encodeURIComponent(symbol)}`;
    const r = await fetch(url, { headers: { 'X-Finnhub-Token': key }, cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    // Fields: targetMean, targetHigh, targetLow, lastUpdatedTime
    if (!j) return null;
    const mean = typeof j.targetMean === 'number' ? j.targetMean : null;
    const high = typeof j.targetHigh === 'number' ? j.targetHigh : null;
    const low  = typeof j.targetLow === 'number' ? j.targetLow : null;
    return { mean, high, low };
  } catch { return null; }
}

async function fmpPriceTarget(symbol: string) {
  const key = process.env.FMP_API_KEY || process.env.FINANCIAL_MODELING_PREP_API_KEY || process.env.FMP_KEY;
  if (!key) return null;
  try {
    const url = `https://financialmodelingprep.com/api/v4/price-target?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j) || j.length === 0) return null;
    // Take the latest record; fields vary by plan, use average/median/mean if present
    const rec = j[0] || {};
    const mean = typeof rec?.targetMean === 'number' ? rec.targetMean
               : typeof rec?.average === 'number' ? rec.average
               : typeof rec?.targetMedian === 'number' ? rec.targetMedian
               : null;
    const high = typeof rec?.targetHigh === 'number' ? rec.targetHigh : null;
    const low  = typeof rec?.targetLow === 'number' ? rec.targetLow : null;
    return { mean, high, low };
  } catch { return null; }
}

async function yahooQuoteSummary(symbol: string) {
  const headers = { "User-Agent": "nfaa-app/1.0", Accept: "application/json" } as const;
  for (const host of ["query1", "query2"]) {
    try {
      const url = `https://${host}.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=financialData,defaultKeyStatistics`;
      const r = await fetch(url, { headers, cache: 'no-store' });
      if (!r.ok) continue;
      const j = await r.json();
      const res = j?.quoteSummary?.result?.[0];
      if (res) return res;
    } catch {}
  }
  return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ ticker: string }> | { ticker: string } }) {
  try {
    const p = 'then' in (ctx.params as any) ? await (ctx.params as Promise<{ ticker: string }>) : (ctx.params as { ticker: string });
    const t = decodeURIComponent(p.ticker).toUpperCase().trim();
    if (!t) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

    // Try quoteSummary first (often more reliable for targets), then v7 quote
    let price: number | null = null;
    let mean: number | null = null;
    let high: number | null = null;
    let low: number | null = null;
    let n: number | null = null;

    const sum = await yahooQuoteSummary(t);
    const num = (x: any): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : (typeof x?.raw === 'number' ? x.raw : null));
    if (sum) {
      price = num(sum?.financialData?.currentPrice) ?? price;
      mean  = num(sum?.financialData?.targetMeanPrice) ?? mean;
      high  = num(sum?.financialData?.targetHighPrice) ?? high;
      low   = num(sum?.financialData?.targetLowPrice) ?? low;
    }
    if (mean == null || price == null) {
      const q = await yahooQuote(t);
      if (q) {
        price = (typeof q.regularMarketPrice === 'number') ? q.regularMarketPrice : price;
        mean  = (typeof q.targetMeanPrice === 'number') ? q.targetMeanPrice : mean;
        high  = (typeof q.targetHighPrice === 'number') ? q.targetHighPrice : high;
        low   = (typeof q.targetLowPrice === 'number') ? q.targetLowPrice : low;
        n     = (typeof q.numberOfAnalystOpinions === 'number') ? q.numberOfAnalystOpinions : n;
      }
    }

    // Fallbacks: Finnhub and FMP if Yahoo lacked targets
    if (mean == null) {
      const fh = await finnhubPriceTarget(t);
      if (fh) { mean = mean ?? fh.mean; high = high ?? fh.high; low = low ?? fh.low; }
    }
    if (mean == null) {
      const fmp = await fmpPriceTarget(t);
      if (fmp) { mean = mean ?? fmp.mean; high = high ?? fmp.high; low = low ?? fmp.low; }
    }

    const upsidePct = price != null && mean != null && price > 0 ? ((mean - price) / price) * 100 : null;

    // Always return 200 with whatever we could get to avoid blanking the UI
    return NextResponse.json({ ticker: t, price, targetMean: mean, targetHigh: high, targetLow: low, analysts: n, upsidePct });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
