This is a [Next.js](https://nextjs.org) project.

What’s been added recently

- Trading dashboard upgrades
  - TV‑like chart with candles + volume + AlphaTrend overlay
  - Timeframes: 1m/5m/15m/1h/2h/1D and auto fit
  - Fallback to TradingView widget when a symbol lacks data
- Price data reliability
  - New intraday candles API with provider fallbacks: Finnhub → Yahoo → Stooq (daily)
  - Simple in‑memory caching layer for API responses (TTL)
  - Basic rate limiting middleware on `/api/*`
- UX tweaks
  - Calls tables centered and green/red result coloring
  - Clickable tickers to stock overview
  - All‑Closed‑Calls shows entry/stop across legacy/new shapes
- Starter watchlist page (client‑only) at `/watchlist`

Environment variables

- `FINNHUB_API_KEY` optional (intraday source; Yahoo fallback is used when absent)
- `SESSION_COOKIE_NAME`, DB config, etc. (see `.env.example`)

Key files

- `src/components/TVLikeChart.tsx` – main in‑app chart (Lightweight Charts, client)
- `src/app/api/price/candles/[ticker]/route.ts` – intraday/daily candles API
- `src/lib/cache.ts` – small TTL cache used by price APIs
- `src/middleware.ts` – rate limit for `/api/*`

Next steps (pro plan)

- Add crosshair tooltips, axis labels, and range presets to the chart
- Move cache to Redis, add retries + circuit breaker
- Alerts MVP (entry/stop/target hit) via queue + email
- Plans, billing (Stripe), and server‑side feature flags

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
