import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request, ctx: { params: Promise<{ ticker?: string }> }) {
  try {
    const { ticker } = await ctx.params;
    const symbol = (ticker || '').toUpperCase().trim();
    if (!symbol) return NextResponse.json({ error: 'Missing ticker' }, { status: 400 });

    // Use Yahoo chart (1m, 1d) as a free source to approximate buy/sell volume
    const headers = { 'User-Agent': 'nfaa-app/1.0', Accept: 'application/json' } as const;
    const urlIn = new URL(req.url);
    const minsParam = urlIn.searchParams.get('mins') || urlIn.searchParams.get('minutes');
    const windowParam = (urlIn.searchParams.get('window') || '').toLowerCase();
    const windowMins = minsParam
      ? Math.max(1, Number(minsParam))
      : windowParam === '1h' || windowParam === '60m'
      ? 60
      : windowParam === '5m'
      ? 5
      : windowParam === '2h' || windowParam === '120m'
      ? 120
      : windowParam === '4h' || windowParam === '240m'
      ? 240
      : windowParam === '1d' || windowParam === 'day' || windowParam === 'd'
      ? null
      : null; // null -> full day
    let ok = false, data: any = null;
    for (const host of ['query1','query2']) {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
      const r = await fetch(url, { headers, cache: 'no-store' }).catch(() => null as any);
      if (r && r.ok) { data = await r.json(); ok = true; break; }
    }
    if (!ok) return NextResponse.json({ error: 'No data' }, { status: 502 });
    const res0 = data?.chart?.result?.[0];
    const q = res0?.indicators?.quote?.[0];
    if (!q) return NextResponse.json({ error: 'No quote data' }, { status: 502 });

    let o = q.open || [], c = q.close || [], v = q.volume || [];
    // If a minute window was requested, slice the last N points
    if (windowMins && Array.isArray(v) && v.length > windowMins) {
      const start = v.length - windowMins;
      o = o.slice(start);
      c = c.slice(start);
      v = v.slice(start);
    }
    let buy = 0, sell = 0, total = 0;
    for (let i = 0; i < v.length; i++) {
      const vol = Number(v[i] || 0);
      if (!Number.isFinite(vol) || vol <= 0) continue;
      total += vol;
      const open = Number(o[i]);
      const close = Number(c[i]);
      if (Number.isFinite(open) && Number.isFinite(close)) {
        if (close >= open) buy += vol; else sell += vol;
      }
    }
    const buyPct = total > 0 ? (buy / total) * 100 : null;
    return NextResponse.json({ ticker: symbol, buyVol: buy, sellVol: sell, totalVol: total, buyPct, windowMins });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
