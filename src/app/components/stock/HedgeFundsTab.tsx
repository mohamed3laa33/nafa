"use client";

import { useEffect, useState } from "react";

type HedgeFundHolding = {
  investorName: string;
  shares?: number | null;
  value?: number | null;
  cusip?: string | null;
  ticker?: string | null;
  filedAt?: string | null;
  filingUrl?: string | null;
};

export default function HedgeFundsTab({ ticker }: { ticker: string }) {
  const [holdings, setHoldings] = useState<HedgeFundHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ticker) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/hedge-fund-activity/${ticker}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const apiError = data?.apiError ? JSON.stringify(data.apiError) : "No details";
          throw new Error(`${data?.error || "Failed to fetch hedge fund data"}. ${apiError}`);
        }
        setHoldings(Array.isArray(data?.holdings) ? data.holdings : []);
      } catch (e: any) {
        setError(e.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    })();
  }, [ticker]);

  const fmtNum = (n?: number | null) => (typeof n === 'number' && isFinite(n) ? n.toLocaleString() : '—');
  const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : '—');

  if (loading) return <p>Loading...</p>;
  if ((!holdings || holdings.length === 0)) {
    return (
      <div className="space-y-4">
        {error && <p className="text-red-500">{error}</p>}
        <p>No direct hedge fund data available. Try these free resources:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <a
              className="brand-link underline"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://www.sec.gov/edgar/search/#/q=13F-HR%20${encodeURIComponent(ticker)}`}
            >
              SEC EDGAR search — 13F filings mentioning {ticker}
            </a>
          </li>
          <li>
            <a
              className="brand-link underline"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://whalewisdom.com/stock/${encodeURIComponent(ticker.toLowerCase())}`}
            >
              WhaleWisdom — holders of {ticker}
            </a>
          </li>
          <li>
            <a
              className="brand-link underline"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://fintel.io/so/us/${encodeURIComponent(ticker.toLowerCase())}`}
            >
              Fintel — institutional ownership of {ticker}
            </a>
          </li>
        </ul>
      </div>
    );
  }

  return (
  <div className="nf-table-wrap overflow-x-auto rounded">
      <table className="nf-table text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border">Investor Name</th>
            <th className="p-2 border">Shares</th>
            <th className="p-2 border">Value (USD)</th>
            <th className="p-2 border">Filed At</th>
            <th className="p-2 border">Filing</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="p-2 border">{h.investorName || '—'}</td>
              <td className="p-2 border">{fmtNum(h.shares)}</td>
              <td className="p-2 border">{fmtNum(h.value)}</td>
              <td className="p-2 border">{fmtDate(h.filedAt)}</td>
              <td className="p-2 border">
                {h.filingUrl ? (
                  <a
                    className="brand-link underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={h.filingUrl}
                  >
                    View
                  </a>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
