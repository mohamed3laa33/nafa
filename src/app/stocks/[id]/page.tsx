"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/AuthContext";
import OverviewTab from "@/app/components/stock/OverviewTab";
import CallsTab from "@/app/components/stock/CallsTab";
import dynamic from "next/dynamic";

// ✅ render price on client only (safer vs hydration)
const PriceBadge = dynamic(() => import("@/components/PriceBadge"), { ssr: false });

export interface StockData {
  id: string;
  ticker: string;
  name: string | null;
  status: string;
  sentiment: string | null;
  score_total: number | null;
  latestOpenCall: any | null;
  owner_analyst_user_id: string | null;
}

export default function StockDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const id = params.id as string;

  const [stock, setStock] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "calls">("overview");

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch stock data");
        const data = await res.json();
        if (alive) setStock(data);
      } catch (e: any) {
        if (alive) setError(e?.message || "An unexpected error occurred.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!stock) return <p>Stock not found.</p>;

  const isOwner = user?.role === "admin" || user?.id === stock.owner_analyst_user_id;

  return (
    <div className="p-4">
      {/* Header: title + actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-bold">
          {stock.ticker}: {stock.name && stock.name.trim() ? stock.name : "—"}
        </h1>

        <div className="flex items-center gap-3">
          <PriceBadge ticker={stock.ticker} />
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              stock.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
            }`}
            title="Status"
          >
            {stock.status}
          </span>

          {/* Action: view closed calls */}
          <Link
            href={`/stocks/${id}/closed-calls`}
            className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
          >
            View Closed Calls
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-4 px-1 border-b-2 ${
              activeTab === "overview" ? "border-blue-500" : "border-transparent"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("calls")}
            className={`py-4 px-1 border-b-2 ${
              activeTab === "calls" ? "border-blue-500" : "border-transparent"
            }`}
          >
            Calls
          </button>
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === "overview" && <OverviewTab stock={stock} />}
        {activeTab === "calls" && <CallsTab stockId={stock.id} isOwner={isOwner} />}
      </div>
    </div>
  );
}
