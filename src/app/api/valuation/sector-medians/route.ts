import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { unstable_cache } from "next/cache";

export const runtime = "nodejs";

const DEFAULTS: Record<string, number> = {
  'Technology': 6.0,
  'Communication Services': 5.0,
  'Consumer Discretionary': 4.0,
  'Healthcare': 4.5,
  'Industrials': 2.5,
  'Financial Services': 2.0,
  'Energy': 1.5,
  'Materials': 2.0,
  'Real Estate': 3.0,
  'Utilities': 2.5,
};

async function fromDb(): Promise<Record<string, number>> {
  try {
    const [rows]: any = await pool.query("SELECT sector, ev_sales_median FROM sector_medians");
    const out: Record<string, number> = { ...DEFAULTS };
    for (const r of rows || []) out[String(r.sector)] = Number(r.ev_sales_median);
    return out;
  } catch {
    return { ...DEFAULTS };
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sector = (searchParams.get('sector') || '').trim();
    const run = unstable_cache(fromDb, ["sector-medians"], { revalidate: 3600 });
    const map = await run();
    if (sector) return NextResponse.json({ sector, evSales: map[sector] ?? null, source: map[sector] ? 'db/default' : 'none' });
    return NextResponse.json(map);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

