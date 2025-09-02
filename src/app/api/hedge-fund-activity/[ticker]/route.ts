import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/rbac";

export const runtime = "nodejs";

async function getHedgeFundActivity(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const apiKey = process.env.SEC_API_KEY;

  const url = apiKey ? `https://api.sec-api.io/form-13f/holdings?token=${apiKey}` : null;

  const query = {
    query: {
      query_string: {
        query: `ticker:${ticker}`,
      },
    },
    from: "0",
    size: "50",
    sort: [{ filedAt: { order: "desc" } }],
  };

  try {
    if (!ticker || !ticker.trim()) {
      return NextResponse.json({ error: "ticker required" }, { status: 400 });
    }
    if (url) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query),
      });
      if (!response.ok) {
        const errorData = await response.json();
        return NextResponse.json({ error: "Failed to fetch data from sec-api.io", apiError: errorData }, { status: response.status });
      }
      const data = await response.json();
      const holdingsRaw = Array.isArray((data as any)?.holdings) ? (data as any).holdings : [];
      const holdings = holdingsRaw.map((h: any) => ({
        investorName: h.investorName ?? h.investor ?? "Unknown",
        shares: Number(h.shares ?? h.position ?? 0),
        value: Number(h.value ?? h.marketValue ?? 0),
        cusip: h.cusip ?? "",
        ticker: h.ticker ?? ticker,
        filedAt: h.filedAt ?? h.filed_at ?? h.periodOfReport ?? null,
        filingUrl: h.linkToHtml ?? null,
      }));
      return NextResponse.json({ holdings });
    }

    // Free fallback via SEC EDGAR search API (best-effort)
    try {
      const secUrl = "https://efts.sec.gov/LATEST/search-index";
      const searchBody = {
        keys: `${ticker} AND formType:13F-HR`,
        category: "custom",
        start: 0,
        from: 0,
        size: 50,
        sort: [{ filedAt: { order: "desc" } }],
      } as any;
      const secRes = await fetch(secUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "nfaa-app/1.0",
          Accept: "application/json",
        },
        body: JSON.stringify(searchBody),
      });
      if (secRes.ok) {
        const js = await secRes.json();
        const hits = Array.isArray(js?.hits?.hits) ? js.hits.hits : [];
        const holdings = hits.map((hit: any) => {
          const src = hit?._source || {};
          const display = Array.isArray(src.display_names) ? src.display_names[0] : null;
          const name = display || src.companyName || src.filerName || "Unknown";
          const filedAt = src.filedAt || src.acceptedDate || null;
          const filingUrl = src.linkToHtml || src.linkToFilingDetails || null;
          return { investorName: name, shares: null, value: null, cusip: null, ticker, filedAt, filingUrl };
        });
        return NextResponse.json({ holdings });
      }
    } catch {
      // ignore and fall through to no-data response
    }

    return NextResponse.json({ holdings: [] });
  } catch (error: any) {
    return NextResponse.json({ error: `An error occurred: ${error.message}` }, { status: 500 });
  }
}

export const GET = withAuth(getHedgeFundActivity);
