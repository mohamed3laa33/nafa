import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function yahooQuote(symbol: string): Promise<any | null> {
  for (const host of ["query1", "query2"]) {
    try {
      const r = await fetch(
        `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`,
        { headers: { "User-Agent": "nfaa-app/1.0", Accept: "application/json" }, cache: "no-store" }
      );
      if (!r.ok) continue;
      const j = await r.json();
      const q = j?.quoteResponse?.result?.[0];
      if (q) return q;
    } catch {}
  }
  return null;
}

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  try {
    const { ticker } = await ctx.params;
    const symbol = (ticker || '').toUpperCase().trim();
    if (!symbol) return NextResponse.json({ error: 'ticker required' }, { status: 400 });
    return NextResponse.json({ ok: true, usage: {
      evSales: `/api/valuation/growth/${symbol}?model=evsales&industryMultiple=6&forwardRevenue=1.35e9&shares=2.39e8&netCash=1.0e9`,
      peg: `/api/valuation/growth/${symbol}?model=peg&epsFwd=0.9&growth=50&pegBenchmark=1.2`
    }});
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  const requestId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  try {
    const { ticker } = await ctx.params;
    const symbol = (ticker || '').toUpperCase().trim();
    if (!symbol) return NextResponse.json({ error: 'ticker required', requestId }, { status: 400 });

    const b = await req.json().catch(()=>({}));
    const model = String(b?.model || 'evsales').toLowerCase();

    const q = await yahooQuote(symbol);
    // From Yahoo quote when available
    const sharesQ = toNum(q?.sharesOutstanding);
    const cashQ   = toNum(q?.totalCash);
    const debtQ   = toNum(q?.totalDebt);
    const netCashQ = (cashQ != null || debtQ != null) ? ((cashQ || 0) - (debtQ || 0)) : null;
    const epsFwdQ = toNum(q?.epsForward);

    if (model === 'evsales' || model === 'ev/sales' || model === 'ev_sales') {
      const industryMultiple = toNum(b?.industryMultiple) ?? 6; // e.g., sector median or user input
      const forwardRevenue = toNum(b?.forwardRevenue) ?? null;  // user must provide if not available
      const shares = toNum(b?.shares) ?? sharesQ;               // can override
      const netCash = (toNum(b?.netCash) ?? netCashQ) ?? 0;     // positive if cash > debt

      if (!forwardRevenue) {
        return NextResponse.json({ error: 'forwardRevenue required for EV/Sales model', requestId }, { status: 400 });
      }
      if (!shares) {
        return NextResponse.json({ error: 'shares outstanding required', requestId }, { status: 400 });
      }

      const targetEV = industryMultiple * forwardRevenue;
      const equityValue = targetEV + netCash; // EV + net cash = equity value
      const price = equityValue / shares;

      return NextResponse.json({
        requestId,
        model: 'evsales',
        assumptions: { industryMultiple, forwardRevenue, shares, netCash },
        targetEV,
        equityValue,
        targetPrice: price,
        source: { sharesQ, netCashQ }
      });
    }

    if (model === 'peg') {
      const epsFwd = toNum(b?.epsFwd) ?? epsFwdQ;
      let growth = toNum(b?.growth); // if 50 -> 50%, if 0.5 -> 50%
      const pegBenchmark = toNum(b?.pegBenchmark) ?? 1.0;
      if (!epsFwd) return NextResponse.json({ error: 'epsFwd required', requestId }, { status: 400 });
      if (!growth && growth !== 0) return NextResponse.json({ error: 'growth required', requestId }, { status: 400 });
      if ((growth as number) > 2) growth = (growth as number) / 100; // treat as percent if > 2

      const impliedPE = (pegBenchmark as number) * (growth as number) * 100; // PEG*growth% => P/E
      const price = epsFwd * impliedPE;

      return NextResponse.json({
        requestId,
        model: 'peg',
        assumptions: { epsFwd, growth, pegBenchmark },
        impliedPE,
        targetPrice: price,
        source: { epsFwdQ }
      });
    }

    return NextResponse.json({ error: 'unknown model', requestId }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed', requestId }, { status: 500 });
  }
}

