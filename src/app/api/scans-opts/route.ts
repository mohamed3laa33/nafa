
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { unstable_cache } from 'next/cache';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const getGappers = unstable_cache(
  async () => {
    try {
      const [rows] = await pool.query(
      `
      SELECT
        s.ticker,
        p.price,
        (p.price - p.prev_close) / p.prev_close * 100 AS gapPct
      FROM stocks s
      JOIN prices p ON s.ticker = p.ticker
      WHERE s.market = 'US'
      ORDER BY gapPct DESC
      LIMIT 100;
      `
      );
      return rows as any[];
    } catch (e: any) {
      // Gracefully degrade if prices table is missing
      if (String(e?.message || '').includes("doesn't exist")) return [];
      throw e;
    }
  },
  ['gappers'],
  { revalidate: 60 }
);

const getMomentum = unstable_cache(
  async () => {
    try {
      const [rows] = await pool.query(
      `
      SELECT
        s.ticker,
        p.price,
        p.rvol,
        p.vwap_dist_pct AS vwapDistPct,
        p.momentum_5m AS momentum
      FROM stocks s
      JOIN prices p ON s.ticker = p.ticker
      WHERE s.market = 'US' AND p.momentum_5m IN ('Buy', 'Sell')
      ORDER BY p.rvol DESC
      LIMIT 100;
      `
      );
      return rows as any[];
    } catch (e: any) {
      if (String(e?.message || '').includes("doesn't exist")) return [];
      throw e;
    }
  },
  ['momentum'],
  { revalidate: 60 }
);

const getUnusualVolume = unstable_cache(
  async () => {
    try {
      const [rows] = await pool.query(
      `
      SELECT
        s.ticker,
        p.price,
        p.rvol
      FROM stocks s
      JOIN prices p ON s.ticker = p.ticker
      WHERE s.market = 'US' AND p.rvol >= 2
      ORDER BY p.rvol DESC
      LIMIT 100;
      `
      );
      return rows as any[];
    } catch (e: any) {
      if (String(e?.message || '').includes("doesn't exist")) return [];
      throw e;
    }
  },
  ['unusual-volume'],
  { revalidate: 60 }
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    let data;
    if (type === 'gappers') {
      data = await getGappers();
    } else if (type === 'momentum') {
      data = await getMomentum();
    } else if (type === 'unusual') {
      data = await getUnusualVolume();
    } else {
      return NextResponse.json({ error: 'Invalid scan type' }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
