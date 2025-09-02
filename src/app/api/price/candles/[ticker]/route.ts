import { NextResponse } from "next/server";
import { cacheWrap } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

async function fromFinnhub(symbol: string, res: string, fromSec: number, toSec: number): Promise<Candle[] | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  const url = new URL("https://finnhub.io/api/v1/stock/candle");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("resolution", res);
  url.searchParams.set("from", String(fromSec));
  url.searchParams.set("to", String(toSec));
  const r = await fetch(url.toString(), { headers: { "X-Finnhub-Token": key }, cache: "no-store" }).catch(() => null as any);
  if (!r || !r.ok) return null;
  const j = await r.json();
  if (!j || j.s !== "ok" || !Array.isArray(j.t)) return null;
  const out: Candle[] = [];
  for (let i = 0; i < j.t.length; i++) {
    const t = Number(j.t[i]) * 1000;
    out.push({ t, o: Number(j.o[i]), h: Number(j.h[i]), l: Number(j.l[i]), c: Number(j.c[i]), v: Number(j.v[i] ?? 0) });
  }
  return out;
}

async function fromStooqDaily(symbol: string, days = 365): Promise<Candle[] | null> {
  const stq = symbol.toLowerCase() + ".us";
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stq)}&i=d`;
  const r = await fetch(url, { cache: "no-store" }).catch(() => null as any);
  if (!r || !r.ok) return null;
  const csv = await r.text();
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const out: Candle[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const t = Date.parse(cols[0]);
    const o = parseFloat(cols[1]);
    const h = parseFloat(cols[2]);
    const l = parseFloat(cols[3]);
    const c = parseFloat(cols[4]);
    const v = parseFloat(cols[5]);
    if (!Number.isFinite(t) || !Number.isFinite(c)) continue;
    out.push({ t, o, h, l, c, v: Number.isFinite(v) ? v : 0 });
  }
  return out.slice(-days);
}

async function fromYahoo(symbol: string, res: string, days: number): Promise<Candle[] | null> {
  // Map our res to Yahoo intervals
  const interval = res === '1' ? '1m'
                  : res === '60' ? '60m'
                  : res === '120' ? '120m'
                  : '1d';
  // Choose a reasonable range based on days
  // Yahoo limits: 1m up to 7d, 60m/120m up to 60d typically, 1d supports years
  let range = '1y';
  if (interval === '1m') range = days <= 1 ? '1d' : days <= 5 ? '5d' : '7d';
  else if (interval === '60m' || interval === '120m') range = days <= 5 ? '5d' : days <= 30 ? '1mo' : '2mo';
  else range = days <= 30 ? '1mo' : days <= 90 ? '3mo' : days <= 180 ? '6mo' : days <= 365 ? '1y' : '2y';

  for (const host of ['query1', 'query2']) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
      const r = await fetch(url, { headers: { 'User-Agent': 'nfaa-app/1.0', Accept: 'application/json' }, cache: 'no-store' });
      if (!r.ok) continue;
      const j = await r.json();
      const res0 = j?.chart?.result?.[0];
      const ts = res0?.timestamp;
      const q = res0?.indicators?.quote?.[0];
      if (!Array.isArray(ts) || !q) continue;
      const out: Candle[] = [];
      for (let i = 0; i < ts.length; i++) {
        const t = Number(ts[i]) * 1000;
        const o = Number(q.open?.[i]);
        const h = Number(q.high?.[i]);
        const l = Number(q.low?.[i]);
        const c = Number(q.close?.[i]);
        const v = Number(q.volume?.[i] ?? 0);
        if (!Number.isFinite(c)) continue;
        out.push({ t, o: Number.isFinite(o) ? o : c, h: Number.isFinite(h) ? h : c, l: Number.isFinite(l) ? l : c, c, v });
      }
      if (out.length) return out;
    } catch {}
  }
  return null;
}

export async function GET(req: Request, ctx: { params: Promise<{ ticker?: string }> }) {
  try {
    const { ticker } = await ctx.params;
    const symbol = (ticker || "").toUpperCase().trim();
    if (!symbol) return NextResponse.json({ error: "Missing ticker" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const res = (searchParams.get("res") || "D").toUpperCase(); // '1','60','120','D'
    const days = Math.min(1000, Math.max(1, Number(searchParams.get("days") || (res === "D" ? 365 : 5))));

    const nowSec = Math.floor(Date.now() / 1000);
    const fromSec = res === "D" ? nowSec - days * 86400 : nowSec - days * 86400; // for intraday: days window default

    const key = `candles:${symbol}:${res}:${days}`;
    const candles = await cacheWrap(key, 30_000, async () => {
      // Prefer Finnhub for any res if key exists
      let out = await fromFinnhub(symbol, res, fromSec, nowSec);
      if (!out || out.length === 0) out = await fromYahoo(symbol, res, days);
      if ((!out || out.length === 0) && res === 'D') out = await fromStooqDaily(symbol, days);
      return out || [];
    });

    if (!candles || candles.length === 0) {
      return NextResponse.json({ error: 'No data' }, { status: 502 });
    }

    return NextResponse.json({ ticker: symbol, candles });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
