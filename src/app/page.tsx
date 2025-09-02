"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-[80vh]">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-gray-50 to-white" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              Nafaa Calls Dashboard
            </h1>
            <p className="mt-4 text-base sm:text-lg text-gray-600 max-w-3xl mx-auto">
              Track open and closed stock calls with live prices, targets and risk, plus notes and references.
              Sign up as a viewer to follow analysts — or sign up as an analyst to publish and manage your calls.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-md btn-brand hover:opacity-95"
              >
                Sign up — Viewer
              </Link>
              <Link
                href="/signup?role=analyst"
                className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-md border hover:bg-gray-50"
              >
                Sign up — Analyst
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-md border hover:bg-gray-50"
              >
                Log in
              </Link>
            </div>

            <div className="mt-3 text-xs text-gray-500">
              Already have access? Go to {" "}
              <Link href="/calls" className="underline">Calls</Link> after logging in.
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="p-5 sm:p-6 rounded-xl border bg-white/60">
            <div className="text-2xl">💹</div>
            <h3 className="mt-2 font-semibold">Live Prices</h3>
            <p className="mt-1 text-sm text-gray-600">Multiple providers (Finnhub / Yahoo / Stooq) for resilient prices and candles.</p>
          </div>
          <div className="p-5 sm:p-6 rounded-xl border bg-white/60">
            <div className="text-2xl">🎯</div>
            <h3 className="mt-2 font-semibold">Calls with Targets & Risk</h3>
            <p className="mt-1 text-sm text-gray-600">Open calls with entry, target, and stop loss; close with outcomes and results.</p>
          </div>
          <div className="p-5 sm:p-6 rounded-xl border bg-white/60">
            <div className="text-2xl">🔗</div>
            <h3 className="mt-2 font-semibold">References & Notes</h3>
            <p className="mt-1 text-sm text-gray-600">Attach research links and notes to each stock for quick recall.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
        <h2 className="text-xl sm:text-2xl font-bold mb-4">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="rounded-xl border p-5 sm:p-6 bg-white/60">
            <div className="text-sm font-semibold text-gray-500">1. Create an account</div>
            <p className="mt-2 text-sm text-gray-700">Choose Viewer to follow analysts or Analyst to publish your own calls.</p>
          </div>
          <div className="rounded-xl border p-5 sm:p-6 bg-white/60">
            <div className="text-sm font-semibold text-gray-500">2. Follow or Publish</div>
            <p className="mt-2 text-sm text-gray-700">Viewers follow analysts to see their open/closed calls. Analysts open calls and update outcomes.</p>
          </div>
          <div className="rounded-xl border p-5 sm:p-6 bg-white/60">
            <div className="text-sm font-semibold text-gray-500">3. Track and Review</div>
            <p className="mt-2 text-sm text-gray-700">Track price, targets, and results. Add references and key stats to each stock.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
