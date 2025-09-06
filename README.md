# NAFAA – Local Development Guide

This guide helps you spin up the app locally on a fresh machine, including the database, migrations, and handy endpoints for bootstrapping data.

## 1) Prerequisites

- Node.js 20+ (LTS)
- npm 10+ (or pnpm/yarn if you prefer)
- MySQL 8.x (or compatible MariaDB)
- Git

## 2) Clone + Install

```bash
git clone https://github.com/mohamed3laa33/nafa.git
cd nafa
npm install
```

## 3) Environment Variables

Create `.env.local` in the project root:

```bash
# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NODE_ENV=development

# Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=nafa
DB_PASSWORD=secret
DB_NAME=nafa

# Optional providers (improve free data quality if available)
FINNHUB_API_KEY=
```

The app expects a MySQL database reachable via these env vars. The connection helper reads from the above.

## 4) Create Database

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS nafa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
# Create user if you want
mysql -u root -p -e "CREATE USER IF NOT EXISTS 'nafa'@'%' IDENTIFIED BY 'secret'; GRANT ALL ON nafa.* TO 'nafa'@'%'; FLUSH PRIVILEGES;"
```

## 5) Apply Migrations

Migrations are plain SQL files in `migrations/` and are safe to run sequentially. On a fresh DB run:

```bash
# From the repo root
for f in migrations/*.sql; do echo "Applying $f"; mysql -u nafa -psecret nafa < "$f"; done
```

Notable migrations:
- `2025-09-02_add_is_public.sql` – adds `stock_calls.is_public` for public calls.
- `2025-09-02_add_username_to_users.sql` – adds `users.username` for nicer analyst display names.

If you already have an existing schema, apply only the migrations you need.

## 6) Start the App

```bash
npm run dev
# App on http://localhost:3000
```

## 7) Bootstrap Users

There is a `/signup` page for viewer/analyst creation, and an admin-only API for adding analysts.

- Sign up a viewer/analyst: http://localhost:3000/signup
- Promote a user to admin (SQL):

```sql
UPDATE users SET role='admin' WHERE email='you@example.com' LIMIT 1;
```

- Admin add analyst (username/email/password):

```bash
curl -X POST http://localhost:3000/api/analysts \
  -H 'Content-Type: application/json' \
  --cookie "session=<your_session_cookie>" \
  -d '{"username":"jdoe","email":"jdoe@example.com","password":"Passw0rd!"}'
```

## 8) Useful Endpoints (dev)

- Calls lists (role-aware):
  - Open: `GET /api/calls?status=open`
  - Closed: `GET /api/calls?status=closed`
  - Filters: `&ticker=XXX`, `&limit=10&page=1`
- Price helpers (free sources):
  - `GET /api/price/:ticker` – latest price (Yahoo proxy)
  - `GET /api/price/candles/:ticker?res=D&days=60` – OHLCV candles (Yahoo/Stooq fallback)
  - `GET /api/price/flow/:ticker?window=5m` – simple buy/sell flow proxy from 1‑minute bars
- Technical snapshot:
  - `GET /api/ta/:ticker?tf=D` – MA/RSI/MACD summary (Strong Buy…Strong Sell)
- Scans:
  - `GET /api/scans/gappers` – gap leaders
  - `GET /api/scans/momentum` – 5m momentum + RVOL
  - `GET /api/scans/unusual` – RVOL ≥ 2x

## 9) UI Pages

- Calls board: `/calls`
- Scans: `/scans`
- Stocks list: `/stocks`
- Stock details: `/stocks/:id`
- Admin quick calls: `/admin/quick-open-call`, `/admin/bulk-quick-calls`

## 10) Notes on Data Quality

This stack uses free data sources for development and prototyping:
- Yahoo Finance chart APIs (minute/day) – suitable for scanning and display, not for execution-grade timestamps.
- Optional Finnhub key (daily candles/name lookup) – improves coverage.

For production accuracy, consider upgrading to a paid consolidated feed (Polygon, Intrinio, Nasdaq Basic, etc.) and swap the price/candles providers.

## 11) Troubleshooting

- 500 on `/api/scans/*`: ensure `NEXT_PUBLIC_BASE_URL` is set and accessible, or the app is run on localhost:3000 so internal fetches resolve.
- Missing columns:
  - Run the migrations (see step 5).
- Analyst name shows email:
  - `users.username` is NULL – add a username or re-create the analyst via admin POST.

## 12) Contributing Flow (local)

- Create a branch, run dev server, and verify changes.
- Keep migrations self‑contained and idempotent where possible.
- Open a PR with a short summary and test notes.

---

If you want, I can add a simple SQL bootstrap (minimal schema + seed) for a totally clean start on brand‑new DBs.


# Stock Analysis and Trading Signal Platform

This is a comprehensive Next.js application designed for stock analysis, signal generation, and trade call management. It provides a rich set of features for analysts and viewers, including real-time price data, technical and fundamental analysis, backtesting, and social-following functionalities.

## Core Features

### 1. Authentication & User Management
- **System:** JWT-based sessions managed via HTTP-only cookies.
- **Roles:**
    - `admin`: Full access to all features, including user management.
    - `analyst`: Can create and manage their own stocks and trade calls.
    - `viewer`: Can view public calls and follow analysts to see their private calls.
- **Endpoints:**
    - `POST /api/auth/signup`: Creates a new user (viewer or analyst).
    - `POST /api/auth/login`: Authenticates a user and returns a session cookie.
    - `POST /api/auth/logout`: Clears the session.
    - `GET /api/auth/me`: Returns the currently authenticated user.
    - `POST /api/auth/update-password`: Updates the user's password.
- **Calculations:**
    - Passwords are hashed using `bcrypt` with a salt of 10 rounds.
    - Sessions are created with a UUIDv4 and have a configurable TTL.

### 2. Stock & Call Management
- **"Calls"** are trade ideas or signals created by analysts. They can be for a "buy" (long) or "sell" (short) trade.
- **Lifecycle:** A call starts as `open` and is eventually `closed` with an outcome (`target_hit`, `stop_hit`, `expired`, `cancelled`).
- **Endpoints:**
    - `POST /api/stocks`: Creates a new stock entry, automatically fetching its name from Yahoo Finance or Finnhub.
    - `POST /api/stocks/{stockId}/calls`: Opens a new trade call for a stock.
    - `PATCH /api/calls/{callId}/close`: Closes an open call, calculating the result.
    - `GET /api/calls`: Retrieves a list of calls with powerful filtering (status, outcome, ticker, analyst, date).
    - `GET /api/open-calls/unique`: Gets the latest open call for each unique stock, useful for a dashboard view.
- **Calculations:**
    - **Stop-Loss:** When opening a "quick call", a default stop-loss is calculated automatically:
        - For a `buy` call: `entry_price * 0.9`
        - For a `sell` call: `entry_price * 1.1`
    - **Result Pct:** When a call is closed, the percentage gain/loss is calculated: `((close_price - entry_price) / entry_price) * 100`.

### 3. Data Fetching & Financial Analysis
The platform integrates with multiple external APIs (Yahoo Finance, Finnhub, Stooq, SEC API) to provide a rich dataset for analysis.

#### a. Price Data
- **Endpoints:**
    - `GET /api/price/{ticker}`: Fetches the latest real-time or delayed price from multiple providers (Finnhub, Yahoo, Stooq) for redundancy.
    - `GET /api/price/candles/{ticker}`: Provides historical OHLCV (Open, High, Low, Close, Volume) data for different resolutions (`1m`, `1D`, etc.).
    - `GET /api/price/flow/{ticker}`: Approximates intraday buy/sell volume by analyzing 1-minute candle data from Yahoo Finance.
- **Calculations:**
    - **Buy/Sell Volume:** For each 1-minute candle, if `close >= open`, its volume is added to `buyVol`; otherwise, it's added to `sellVol`.

#### b. Technical Analysis (TA)
- **Core Logic:** `src/lib/indicators.ts` contains from-scratch implementations of common TA indicators, avoiding heavy dependencies.
- **Endpoints:**
    - `GET /api/ta/indicators/{ticker}`: Returns a suite of calculated indicators.
    - `GET /api/ta/{ticker}`: Provides a summary recommendation (`Strong Buy`, `Buy`, `Neutral`, `Sell`, `Strong Sell`) based on an aggregate of TA indicators.
- **Calculations:**
    - `EMA` (Exponential Moving Average)
    - `RSI` (Relative Strength Index)
    - `MACD` (Moving Average Convergence Divergence), including histogram and signal line.
    - `ATR` (Average True Range) using Wilder's smoothing.
    - `VWAP` (Volume-Weighted Average Price) from intraday candles.
    - **TA Summary Score:** A score is computed by summing signals from moving averages and oscillators (RSI, MACD). For example, if the price is above the SMA(20), the score increments. If RSI is below 40, it decrements. The final label is derived from this score.

#### c. Valuation Models
- **Endpoints:**
    - `GET /api/valuation/analyst/{ticker}`: Aggregates analyst price targets from Yahoo Finance, Finnhub, and FMP.
    - `GET /api/valuation/fundamental/{ticker}`: Calculates a fair value based on standard valuation multiples (P/E, P/S, P/B) compared against market anchors.
    - `GET /api/valuation/fair/{ticker}`: Calculates a proprietary "Fair Value" by blending technical anchors.
- **Calculations:**
    - **Fundamental Fair Value:**
        - `Fair Value = WeightedAverage(PE_Value, PS_Value, PB_Value)`
        - Where `PE_Value = current_price * (anchor_PE / forward_PE)` (and similarly for P/S, P/B).
        - Anchors are set to market medians (e.g., `anchor_PE = 15`).
    - **Technical "Fair Value":**
        - `Fair Value = WeightedAverage(VWAP_20D, EMA_20D, Donchian_Midpoint_20D)`
        - Weights are `0.5`, `0.3`, and `0.2` respectively.
    - **Good-to-Buy Heuristic:** A stock is considered a "good buy" if its price is at a discount to the technical fair value, RSI is in a neutral range (35-65), and the trend is not broken (price above key EMAs).

### 4. Signal Generation & Backtesting
- **Signal Scoring:** The platform can score a potential trade idea.
    - `POST /api/signals/score`: Takes a ticker, entry, and target price and returns a probability score, an estimated time to achieve the target (ETA), a suggested stop-loss, and the risk/reward ratio.
    - **ETA Calculation:** `ETA (days) = |fair_value - entry_price| / ATR`
    - **Probability (`probUp`):** A weighted score combining intraday buy pressure (`buyPct`), VWAP distance, RSI, and EMA alignment.
- **Backtesting:** A simple backtesting engine is available.
    - `POST /api/backtest/run`: Runs a strategy (e.g., "enter if close > EMA(20) and RSI(7) > 60") on historical data and returns the equity curve and performance metrics (win rate, P/L, etc.).

### 5. Admin & Analyst Tools
- **Bulk Operations:**
    - `POST /api/admin/quick-open-calls`: Allows an analyst to open multiple trade calls at once by pasting a list of tickers and prices.
- **Data Health:**
    - `POST /api/admin/backfill-names`: A utility to find and fill missing names for stocks in the database.
    - `POST /api/calls/auto-close`: A cron-job-ready endpoint to automatically close any open calls where the price has hit the primary target (`t1`).

## Project Structure
- `src/app/api/`: All backend API routes. The folder structure directly maps to the URL path.
- `src/lib/`: Core application logic, including authentication (`auth.ts`), database connection (`db.ts`), caching (`cache.ts`), and TA calculations (`indicators.ts`).
- `src/app/(pages)/`: Frontend pages built with React/Next.js.
- `src/components/`: Reusable React components.
- `migrations/`: SQL files for database schema changes.

## Getting Started
1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Set up environment variables:** Create a `.env.local` file and populate it with database credentials and API keys based on `src/lib/env.ts`.
3.  **Run the development server:**
    ```bash
    npm run dev
    ```
The application will be available at `http://localhost:3000`.