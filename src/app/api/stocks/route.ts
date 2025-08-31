// src/app/api/stocks/route.ts
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";
import { pool } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

// ---------------- helpers ----------------
async function yahooName(symbol: string): Promise<string | null> {
  const headers = { "User-Agent": "nfaa-app/1.0", Accept: "application/json" };

  // 1) Yahoo SEARCH: exact symbol match
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
  } catch {
    // ignore and try quote
  }

  // 2) Yahoo QUOTE fallback
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
    } catch {
      // continue to next host or finnhub
    }
  }

  return null;
}

async function finnhubName(symbol: string): Promise<string | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  const r = await fetch(
    `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}`,
    { headers: { "X-Finnhub-Token": key }, cache: "no-store" }
  ).catch(() => null as any);
  if (!r || !r.ok) return null;
  const j = await r.json();
  const n = typeof j?.name === "string" ? j.name.trim() : null;
  return n && n.length ? n : null;
}
// -----------------------------------------

// GET /api/stocks
async function listStocks(req: AuthenticatedRequest) {
  const { searchParams } = new URL(req.url);

  const limitNum  = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
  const pageNum   = Math.max(1, Number(searchParams.get("page") || 1));
  const offsetNum = (pageNum - 1) * limitNum;

  const sql = `
    SELECT id, ticker, market, name, status, created_at, updated_at
    FROM stocks
    ORDER BY updated_at DESC
    LIMIT ${limitNum} OFFSET ${offsetNum}
  `;

  const [rows] = await pool.query(sql);
  // @ts-ignore
  return NextResponse.json({ data: rows, page: pageNum, limit: limitNum });
}

// POST /api/stocks  (ticker-only, market forced to US, name auto-fetched)
async function createStock(req: AuthenticatedRequest) {
  const { id: userId } = req.user;

  const body = await req.json().catch(() => ({}));
  const ticker = String(body?.ticker || "").toUpperCase().trim();
  const ownerAnalystUserId = body?.ownerAnalystUserId || null;

  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }

  const market = "US";
  const name = (await yahooName(ticker)) ?? (await finnhubName(ticker)) ?? null;

  const stockId = uuidv4();

  try {
    await pool.execute(
      `INSERT INTO stocks
        (id, ticker, market, name, created_by_user_id, owner_analyst_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [stockId, ticker, market, name, userId, ownerAnalystUserId]
    );

    return NextResponse.json({ id: stockId }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "Ticker already exists for this market" },
        { status: 409 }
      );
    }
    console.error("Error creating stock:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withAuth(listStocks);
export const POST = withAuth(createStock, ["admin", "analyst"]);
