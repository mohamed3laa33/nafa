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

