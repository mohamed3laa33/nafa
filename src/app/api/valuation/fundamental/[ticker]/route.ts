import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function yahooQuoteSummary(symbol: string) {
  const headers = { "User-Agent": "nfaa-app/1.0", Accept: "application/json" } as const;
  for (const host of ["query1", "query2"]) {
    try {
      const url = `https://${host}.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=financialData,defaultKeyStatistics,summaryDetail`;
      const r = await fetch(url, { headers, cache: 'no-store' });
      if (!r.ok) continue;
      const j = await r.json();
      const res = j?.quoteSummary?.result?.[0];
      if (res) return res;
    } catch {}
  }
  return null;
}

async function yahooQuote(symbol: string) {
  const headers = { "User-Agent": "nfaa-app/1.0", Accept: "application/json" } as const;
  for (const host of ["query1", "query2"]) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`, { headers, cache: 'no-store' });
      if (!r.ok) continue;
      const j = await r.json();
      const q = j?.quoteResponse?.result?.[0];
      if (q) return q;
    } catch {}
  }
  return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ ticker: string }> | { ticker: string } }) {
  try {
    const p = 'then' in (ctx.params as any) ? await (ctx.params as Promise<{ ticker: string }>) : (ctx.params as { ticker: string });
    const t = decodeURIComponent(p.ticker).toUpperCase().trim();
    if (!t) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

    const s = await yahooQuoteSummary(t);
    if (!s) {
      // Graceful degrade: return 200 with nulls so UI shows dashes rather than treating as error
      return NextResponse.json({ ticker: t, price: null, fairFundamental: null, components: {}, reasons: [] });
    }

    // Extract metrics with safe number parsing
    const num = (x: any): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : (typeof x?.raw === 'number' ? x.raw : null));
    const price = num(s?.financialData?.currentPrice) ?? null;
    const fwdPE = num(s?.summaryDetail?.forwardPE) ?? num(s?.financialData?.forwardPE) ?? null;
    const trPE  = num(s?.summaryDetail?.trailingPE) ?? null;
    const ps    = num(s?.defaultKeyStatistics?.priceToSalesTrailing12Months) ?? num(s?.summaryDetail?.priceToSalesTrailing12Months) ?? null;
    const pb    = num(s?.defaultKeyStatistics?.priceToBook) ?? num(s?.summaryDetail?.priceToBook) ?? null;

    // Heuristic anchors (market medians). These are configurable if we later add sector medians
    const anchorPE = 15;     // market fair P/E
    const anchorPS = 3;      // rule-of-thumb P/S
    const anchorPB = 1.5;    // rule-of-thumb P/B

    const candidates: Array<{ name: string; value: number | null; weight: number; detail: string }>= [];
    if (price != null && fwdPE && fwdPE > 0) candidates.push({ name: 'FwdPE', value: price * (anchorPE / fwdPE), weight: 0.4, detail: `anchor ${anchorPE}/fwdPE ${fwdPE.toFixed(2)}` });
    if (price != null && trPE && trPE > 0)   candidates.push({ name: 'PE',    value: price * (anchorPE / trPE),  weight: 0.2, detail: `anchor ${anchorPE}/PE ${trPE.toFixed(2)}` });
    if (price != null && ps && ps > 0)       candidates.push({ name: 'P/S',   value: price * (anchorPS / ps),    weight: 0.2, detail: `anchor ${anchorPS}/P/S ${ps.toFixed(2)}` });
    if (price != null && pb && pb > 0)       candidates.push({ name: 'P/B',   value: price * (anchorPB / pb),    weight: 0.2, detail: `anchor ${anchorPB}/P/B ${pb.toFixed(2)}` });

    // Normalize weights for available candidates
    let wsum = candidates.reduce((a,b)=> a + (b.value != null ? b.weight : 0), 0);
    let fair = wsum > 0 ? candidates.reduce((a,b)=> a + ((b.value ?? 0) * (b.value != null ? b.weight/wsum : 0)), 0) : null;

    // Fallback: try v7 quote for trailingPE/forwardPE if we couldn't build any candidate
    if (fair == null) {
      const q = await yahooQuote(t);
      const qPrice = typeof q?.regularMarketPrice === 'number' ? q.regularMarketPrice : null;
      const qFwdPE = typeof q?.forwardPE === 'number' ? q.forwardPE : null;
      const qTrPE  = typeof q?.trailingPE === 'number' ? q.trailingPE : null;
      const price2 = price ?? qPrice;
      const extra: Array<{ name:string; value:number|null; weight:number; detail:string }>= [];
      if (price2 != null && qFwdPE && qFwdPE > 0) extra.push({ name:'FwdPE(q)', value: price2 * (anchorPE/qFwdPE), weight: 0.6, detail:`anchor ${anchorPE}/fwdPE ${qFwdPE.toFixed(2)}` });
      if (price2 != null && qTrPE && qTrPE > 0)  extra.push({ name:'PE(q)',    value: price2 * (anchorPE/qTrPE),  weight: 0.4, detail:`anchor ${anchorPE}/PE ${qTrPE.toFixed(2)}` });
      if (extra.length) {
        const sumW = extra.reduce((a,b)=> a + (b.value!=null? b.weight: 0), 0);
        fair = sumW>0 ? extra.reduce((a,b)=> a + ((b.value??0) * (b.value!=null? b.weight/sumW:0)), 0) : null;
        reasons.push(...extra.filter(e=>e.value!=null).map(e=> `${e.name}: ${e.detail}`));
      }
    }
    const reasons = candidates.filter(c=>c.value!=null).map(c=> `${c.name}: ${c.detail}`);

    return NextResponse.json({ ticker: t, price, fairFundamental: fair, components: { fwdPE, trPE, ps, pb, anchorPE, anchorPS, anchorPB }, reasons });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
