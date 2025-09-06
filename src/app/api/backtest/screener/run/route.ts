import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SweepSummary = { ticker: string; count: number; hitRate: number; mae: number; mape: number };

async function listSector(origin: string, sector: string | null, limit: number): Promise<string[]> {
  try {
    const u = new URL(`${origin}/api/screener/buy-now?limit=${limit}&top=${limit}${sector?`&sector=${encodeURIComponent(sector)}`:''}`);
    const r = await fetch(u.toString(), { cache: 'no-store' });
    const j = await r.json();
    if (r.ok) return (Array.isArray(j?.items)? j.items: []).map((x:any)=>x.ticker);
  } catch {}
  return [];
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  try {
    const { origin, searchParams } = new URL(req.url);
    const b = await req.json().catch(()=>({}));
    const sector = (b?.sector || '').trim() || null;
    const tickers: string[] = Array.isArray(b?.tickers) ? b.tickers : [];
    const limit = Math.min(200, Math.max(10, Number(b?.limit || 50)));
    const horizonDays = Math.max(1, Number(b?.horizonDays || 10));
    const startDaysAgo = Math.max(20, Number(b?.startDaysAgo || 120));
    const endDaysAgo = Math.max(1, Number(b?.endDaysAgo || 20));
    const step = Math.max(1, Number(b?.step || 5));
    const method = String(b?.method || 'atr_k');
    const k = Number(b?.k ?? 1.5);
    const direction = (String(b?.direction || 'up').toLowerCase()==='down')? 'down':'up';
    const tolerancePct = Math.max(0, Number(b?.tolerancePct ?? 1));

    let list = tickers;
    if (!list.length) list = await listSector(origin, sector, limit);
    if (!list.length) return NextResponse.json({ requestId, items: [], summary: { count: 0, hitRate: 0, mae: 0, mape: 0 } });

    const out: SweepSummary[] = [];
    for (const t of list) {
      try {
        const r = await fetch(`${origin}/api/backtest/forecast/sweep`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ticker: t, horizonDays, startDaysAgo, endDaysAgo, step, method, k, direction, tolerancePct }) });
        const j = await r.json();
        if (r.ok) out.push({ ticker: t, count: Number(j?.count||0), hitRate: Number(j?.hitRate||0), mae: Number(j?.mae||0), mape: Number(j?.mape||0) });
      } catch {}
    }
    const total = out.reduce((a,b)=>a+b.count,0) || 1;
    const summary = {
      count: total,
      hitRate: out.reduce((a,b)=>a + (b.hitRate*b.count/100),0) / (out.length? out.length:1) * 100 / 100, // rough average
      mae: out.reduce((a,b)=>a + b.mae,0) / Math.max(1,out.length),
      mape: out.reduce((a,b)=>a + b.mape,0) / Math.max(1,out.length),
    };
    return NextResponse.json({ requestId, items: out, summary });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed', requestId }, { status: 500 });
  }
}

