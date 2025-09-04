import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  try {
    const b = await req.json().catch(()=>({}));
    const tickers: string[] = Array.isArray(b?.tickers) ? b.tickers.slice(0, 25) : [];
    if (!tickers.length) return NextResponse.json({ error: 'tickers required', requestId }, { status: 400 });

    const rows = await Promise.all(tickers.map(async (t) => {
      try {
        const r = await fetch(`/api/signals/score`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker: t, entry: b?.entry ?? null, target: b?.target ?? null }) });
        const j = await r.json();
        return { ticker: t, ok: r.ok, ...j };
      } catch { return { ticker: t, ok: false }; }
    }));
    const okRows = rows.filter((x:any)=>x.ok);
    okRows.sort((a:any,b:any)=> (b.probUp??0)-(a.probUp??0));
    return NextResponse.json({ items: okRows, requestId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed', requestId }, { status: 500 });
  }
}

