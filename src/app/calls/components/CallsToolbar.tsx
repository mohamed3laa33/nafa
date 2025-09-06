
"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";
import { useAuth } from "@/app/AuthContext";

interface CallsToolbarProps {
  tab: "open" | "closed" | "hits";
  setTab: (tab: "open" | "closed" | "hits") => void;
  query: string;
  setQuery: (query: string) => void;
  setSearchTicker: (ticker: string) => void;
  autoRefresh: boolean;
  setAutoRefresh: (autoRefresh: boolean) => void;
  intervalSec: number;
  setIntervalSec: (interval: number) => void;
  searchTicker: string;
  computeIdeaScores: () => void;
  ideaLoading: boolean;
  sortMode: "none" | "idea";
  setSortMode: (mode: "none" | "idea") => void;
  rows: any[];
}

export default function CallsToolbar({
  tab,
  setTab,
  query,
  setQuery,
  setSearchTicker,
  autoRefresh,
  setAutoRefresh,
  intervalSec,
  setIntervalSec,
  searchTicker,
  computeIdeaScores,
  ideaLoading,
  sortMode,
  setSortMode,
  rows,
}: CallsToolbarProps) {
  const { user } = useAuth();

  return (
    <>
      {/* Row 1: Title + Actions (separate layer) */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Calls</h1>
        <div className="flex gap-3">
          <Link href="/stocks" className="px-3 py-2 btn-outline-brand">
            📃 List Stocks
          </Link>
          {(user?.role === "admin" || user?.role === "analyst") && (
            <Link
              href="/admin/quick-open-call"
              className="px-3 py-2 btn-outline-brand"
            >
              ⚡ Quick Call
            </Link>
          )}
          {(user?.role === "admin" || user?.role === "analyst") && (
            <Link
              href="/admin/bulk-quick-calls"
              className="px-3 py-2 btn-outline-brand"
            >
              📥 Bulk Quick Calls
            </Link>
          )}
          {(user?.role === "admin" || user?.role === "analyst") && (
            <Link
              href="/stocks/new"
              className="px-3 py-2 btn-brand hover:opacity-95"
            >
              New Stock
            </Link>
          )}
        </div>
      </div>

      {/* Row 2: Tabs + Search + Auto refresh */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded border overflow-hidden">
            <button
              className={`px-3 py-1 text-sm ${
                tab === "open" ? "tab-active" : "bg-white"
              }`}
              onClick={() => setTab("open")}
            >
              Open
            </button>
            <button
              className={`px-3 py-1 text-sm ${
                tab === "closed" ? "tab-active" : "bg-white"
              }`}
              onClick={() => setTab("closed")}
            >
              Closed
            </button>
            <button
              className={`px-3 py-1 text-sm ${
                tab === "hits" ? "tab-active" : "bg-white"
              }`}
              onClick={() => setTab("hits")}
            >
              Hits
            </button>
          </div>
          <form
            className="ml-2 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchTicker(query.trim().toUpperCase());
            }}
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by ticker (e.g., AAPL)"
              className="w-48"
              inputMode="text"
              autoCorrect="off"
              autoCapitalize="characters"
            />
            <Button type="submit" variant="outline" size="sm">
              Search
            </Button>
            <div className="ml-2 inline-flex items-center gap-2 text-sm">
              <span className="hidden sm:inline">Auto</span>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            </div>
            <div className="inline-flex items-center gap-1 text-sm">
              <span>every</span>
              <Input
                type="number"
                className="w-20"
                min={5}
                value={intervalSec}
                onChange={(e) =>
                  setIntervalSec(Math.max(5, Number(e.target.value) || 15))
                }
                disabled={!autoRefresh}
              />
              <span>sec</span>
            </div>
            {searchTicker && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setSearchTicker("");
                }}
              >
                Clear
              </Button>
            )}
          </form>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={computeIdeaScores}
            disabled={ideaLoading || rows.length === 0}
          >
            {ideaLoading ? "Scoring…" : "Sort: Buy Now"}
          </Button>
          {sortMode === "idea" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortMode("none")}
            >
              Clear Sort
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
