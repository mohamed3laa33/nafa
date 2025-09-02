import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Num = number | null;

function getN(obj: any, path: string[]): Num {
  try {
    let cur = obj;
    for (const k of path) cur = cur?.[k];
    if (cur == null) return null;
    if (typeof cur === "object" && "raw" in cur) return Number(cur.raw);
    return Number(cur);
  } catch { return null; }
}

function getS(obj: any, path: string[]): string | null {
  try {
    let cur = obj;
    for (const k of path) cur = cur?.[k];
    if (cur == null) return null;
    if (typeof cur === "object" && "fmt" in cur) return String(cur.fmt);
    return String(cur);
  } catch { return null; }
}

async function yahoo(symbol: string) {
  const headers = { "User-Agent": "nfaa-app/1.0", Accept: "application/json" } as const;
  const modules = [
    "price",
    "summaryDetail",
    "defaultKeyStatistics",
    "financialData",
    "calendarEvents",
  ].join(",");
  for (const host of ["query1", "query2"]) {
    const url = `https://${host}.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
    const r = await fetch(url, { headers, cache: "no-store" }).catch(() => null as any);
    if (!r || !r.ok) continue;
    const j = await r.json();
    const res = j?.quoteSummary?.result?.[0];
    if (res) return res;
  }
  return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ ticker?: string }> }) {
  try {
    const { ticker } = await ctx.params;
    const symbol = (ticker || "").toUpperCase().trim();
    if (!symbol) return NextResponse.json({ error: "Missing ticker" }, { status: 400 });

    let data = await yahoo(symbol);
    if (!data) {
      const headers = { "User-Agent": "nfaa-app/1.0", Accept: "application/json" } as const;
      for (const host of ["query1", "query2"]) {
        const url = `https://${host}.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price,summaryDetail`;
        const r = await fetch(url, { headers, cache: "no-store" }).catch(() => null as any);
        if (!r || !r.ok) continue;
        const j = await r.json();
        const res = j?.quoteSummary?.result?.[0];
        if (res) { data = res; break; }
      }
    }
    if (!data) {
      return NextResponse.json({
        prevClose: null, open: null,
        dayLow: null, dayHigh: null,
        range52wLow: null, range52wHigh: null,
        volume: null, avgVolume3m: null, oneYearChange: null,
        marketCap: null, sharesOutstanding: null,
        revenue: null, netIncome: null, eps: null, peRatio: null,
        grossMargins: null, returnOnAssets: null, returnOnEquity: null,
        priceToBook: null, ebitda: null, evToEbitda: null,
        beta: null, bookValuePerShare: null, dividendRate: null, dividendYield: null,
        nextEarningsDate: null,
      });
    }

    const p = data.price || {};
    const sd = data.summaryDetail || {};
    const ks = data.defaultKeyStatistics || {};
    const fd = data.financialData || {};
    const ce = data.calendarEvents || {};

    // Prefer raw numbers when available; fall back to formatted strings
    const out = {
      prevClose: getN(sd, ["previousClose"]) ?? getN(p, ["regularMarketPreviousClose"]),
      open: getN(sd, ["open"]) ?? getN(p, ["regularMarketOpen"]),
      dayLow: getN(p, ["regularMarketDayLow"]) ?? getN(sd, ["dayLow"]) ,
      dayHigh: getN(p, ["regularMarketDayHigh"]) ?? getN(sd, ["dayHigh"]) ,
      range52wLow: getN(sd, ["fiftyTwoWeekLow"]) ,
      range52wHigh: getN(sd, ["fiftyTwoWeekHigh"]) ,
      volume: getN(p, ["regularMarketVolume"]) ?? getN(sd, ["volume"]) ,
      avgVolume3m: getN(p, ["averageDailyVolume3Month"]) ?? getN(sd, ["averageVolume"]) ,
      oneYearChange: (ks?.["52WeekChange"]?.raw ?? null) as number | null,
      marketCap: getN(p, ["marketCap"]) ?? getN(sd, ["marketCap"]) ,
      sharesOutstanding: getN(ks, ["sharesOutstanding"]) ,
      revenue: getN(fd, ["totalRevenue"]) ,
      netIncome: getN(ks, ["netIncomeToCommon"]) ,
      eps: getN(fd, ["epsTrailingTwelveMonths"]) ?? getN(ks, ["trailingEps"]) ,
      peRatio: getN(sd, ["trailingPE"]) ?? getN(fd, ["trailingPE"]) ,
      grossMargins: getN(fd, ["grossMargins"]) ,
      returnOnAssets: getN(fd, ["returnOnAssets"]) ,
      returnOnEquity: getN(fd, ["returnOnEquity"]) ,
      priceToBook: getN(ks, ["priceToBook"]) ,
      ebitda: getN(fd, ["ebitda"]) ,
      evToEbitda: getN(ks, ["enterpriseToEbitda"]) ,
      beta: getN(ks, ["beta"]) ,
      bookValuePerShare: getN(ks, ["bookValue"]) ,
      dividendRate: getN(sd, ["dividendRate"]) ,
      dividendYield: getN(sd, ["dividendYield"]) ,
      nextEarningsDate: (() => {
        const d = ce?.earnings?.earningsDate?.[0]?.raw ?? null;
        return typeof d === "number" ? new Date(d * 1000).toISOString() : null;
      })(),
    };

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
