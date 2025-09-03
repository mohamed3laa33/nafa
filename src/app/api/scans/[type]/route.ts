import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ScanRow = {
  ticker: string;
  price?: number | null;
  gapPct?: number | null;
  rvol?: number | null;
  vwapDistPct?: number | null;
  momentum?: 'Buy' | 'Sell' | 'Neutral' | null;
};

function makeBase(req: Request) {
  const h = req.headers;
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

async function fetchJSON(req: Request, url: string) {
  const abs = url.startsWith('http') ? url : `${makeBase(req)}${url}`;
  const r = await fetch(abs, { cache: 'no-store' }).catch(() => null as any);
  if (!r || !r.ok) return null;
  return r.json().catch(() => null);
}

async function getTickers(): Promise<string[]> {
  try {
    const [rows]: any = await pool.query("SELECT ticker FROM stocks WHERE market='US'");
    return Array.isArray(rows) ? rows.map((r) => String(r.ticker)) : [];
  } catch {
    return [];
  }
}

async function computeGap(req: Request, t: string): Promise<{ price: number | null; gapPct: number | null }>{
  const priceJ = await fetchJSON(req, `/api/price/${encodeURIComponent(t)}`);
  const price = priceJ && typeof priceJ.price === 'number' ? priceJ.price : null;
  const daily = await fetchJSON(req, `/api/price/candles/${encodeURIComponent(t)}?res=D&days=2`);
  let prevClose: number | null = null;
  if (daily && Array.isArray(daily.candles) && daily.candles.length >= 2) {
    prevClose = Number(daily.candles[daily.candles.length - 2]?.c);
  }
  const gapPct = price != null && prevClose && prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : null;
  return { price, gapPct };
}

async function computeRVOLVWAP(req: Request, t: string): Promise<{ rvol: number | null; vwapDistPct: number | null }>{
  const daily = await fetchJSON(req, `/api/price/candles/${encodeURIComponent(t)}?res=D&days=21`);
  let rvol: number | null = null;
  if (daily && Array.isArray(daily.candles)) {
    const vols = daily.candles.map((x: any) => Number(x.v || 0)).filter((v: number) => Number.isFinite(v) && v > 0);
    const todayVol = vols.length ? vols[vols.length - 1] : null;
    const avgVol = vols.length > 1 ? vols.slice(-11, -1).reduce((a: number, b: number) => a + b, 0) / Math.max(1, Math.min(10, vols.length - 1)) : null;
    rvol = avgVol && todayVol ? todayVol / avgVol : null;
  }
  const intr = await fetchJSON(req, `/api/price/candles/${encodeURIComponent(t)}?res=1&days=1`);
  let vwapDistPct: number | null = null;
  if (intr && Array.isArray(intr.candles) && intr.candles.length) {
    let volSum = 0, pvSum = 0;
    let last = Number(intr.candles[intr.candles.length - 1]?.c);
    for (const k of intr.candles) {
      const typical = (Number(k.h) + Number(k.l) + Number(k.c)) / 3;
      const v = Number(k.v || 0);
      if (!Number.isFinite(typical) || !Number.isFinite(v)) continue;
      pvSum += typical * v; volSum += v;
    }
    const vwap = volSum > 0 ? pvSum / volSum : null;
    if (vwap && Number.isFinite(last)) vwapDistPct = ((last - vwap) / vwap) * 100;
  }
  return { rvol, vwapDistPct };
}

async function computeMomentum(req: Request, t: string): Promise<'Buy' | 'Sell' | 'Neutral' | null>{
  const flow = await fetchJSON(req, `/api/price/flow/${encodeURIComponent(t)}?window=5m`);
  if (!flow) return null;
  const buy = Number(flow.buyVol || 0);
  const sell = Number(flow.sellVol || 0);
  const total = buy + sell;
  if (total === 0) return null;
  const buyPct = (buy / total) * 100;
  if (buyPct > 55) return 'Buy';
  if (buyPct < 45) return 'Sell';
  return 'Neutral';
}

async function handle(req: Request, type: string) {
  const tickers = await getTickers();
  const out: ScanRow[] = [];
  const batch = 10;
  for (let i = 0; i < tickers.length; i += batch) {
    const slice = tickers.slice(i, i + batch);
    const results = await Promise.all(slice.map(async (t) => {
      const row: ScanRow = { ticker: t };
      // Always compute the full set so the table can show all columns,
      // then filter/sort by scan type below.
      const [g, rv, mom] = await Promise.all([
        computeGap(req, t),
        computeRVOLVWAP(req, t),
        computeMomentum(req, t),
      ]);
      row.price = g.price; row.gapPct = g.gapPct;
      row.rvol = rv.rvol; row.vwapDistPct = rv.vwapDistPct;
      row.momentum = mom;
      return row;
    }));
    out.push(...results);
  }
  // Filter/sort per type
  if (type === 'gappers') {
    return out
      .filter((r) => r.gapPct != null)
      .sort((a, b) => Math.abs(b.gapPct as number) - Math.abs(a.gapPct as number))
      .slice(0, 100);
  }
  if (type === 'momentum') {
    return out
      .filter((r) => (r.momentum === 'Buy' || r.momentum === 'Sell'))
      .sort((a, b) => (Number(b.rvol || 0) - Number(a.rvol || 0)))
      .slice(0, 100);
  }
  if (type === 'unusual') {
    return out
      .filter((r) => (r.rvol != null && (r.rvol as number) >= 2))
      .sort((a, b) => Number(b.rvol || 0) - Number(a.rvol || 0))
      .slice(0, 100);
  }
  return out.slice(0, 200);
}

export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  try {
    const { type } = await params;
    const list = await handle(req, type);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
