import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

// same stronger yahooName used in /api/stocks
async function yahooName(symbol: string): Promise<string | null> {
  const headers = { "User-Agent": "nfaa-app/1.0", Accept: "application/json" };
  try {
    const rs = await fetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}`,
      { headers, cache: "no-store" }
    );
    if (rs.ok) {
      const js = await rs.json();
      const hit = (js.quotes || []).find(
        (q: any) => (q.symbol || "").toUpperCase() === symbol
      );
      const n = hit?.shortname || hit?.longname || hit?.name;
      if (n && typeof n === "string" && n.trim()) return n.trim();
    }
  } catch {}
  for (const host of ["query1", "query2"]) {
    try {
      const rq = await fetch(
        `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`,
        { headers, cache: "no-store" }
      );
      if (!rq.ok) continue;
      const j = await rq.json();
      const q = j?.quoteResponse?.result?.[0];
      const n = q?.longName ?? q?.shortName ?? q?.displayName;
      if (n && typeof n === "string" && n.trim()) return n.trim();
    } catch {}
  }
  return null;
}

export async function POST() {
  const [rows]: any = await pool.query(
    "SELECT id, ticker FROM stocks WHERE market='US' AND (name IS NULL OR name='')"
  );
  let updated = 0;
  for (const r of rows) {
    const symbol = String(r.ticker || "").toUpperCase().trim();
    const name = (await yahooName(symbol)) ?? null;
    if (name) {
      await pool.execute("UPDATE stocks SET name=? WHERE id=?", [name, r.id]);
      updated++;
    }
  }
  return NextResponse.json({ checked: rows.length, updated });
}
