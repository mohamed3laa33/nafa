import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

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

export async function POST() {
  const [rows]: any = await pool.query(
    "SELECT id, ticker FROM stocks WHERE market='US' AND (sector IS NULL OR sector='') LIMIT 200"
  );
  let updated = 0;
  for (const r of rows) {
    const symbol = String(r.ticker || "").toUpperCase().trim();
    const q = await yahooQuote(symbol);
    const sector = typeof q?.sector === 'string' && q.sector.trim() ? q.sector.trim() : null;
    if (sector) {
      await pool.execute("UPDATE stocks SET sector=? WHERE id=?", [sector, r.id]);
      updated++;
    }
  }
  return NextResponse.json({ checked: rows.length, updated });
}

