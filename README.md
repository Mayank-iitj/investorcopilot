# AI Investor Copilot 📊

Production-grade AI platform for Indian stock markets (NSE/BSE) with **real data**, **verifiable signals**, **backtested strategies**, and **portfolio analytics**.

> Built with FastAPI + Next.js — no mocked data, no fake components.

---

## ✨ Features

| Module | What it does |
|--------|-------------|
| **Signal Detection** | 5 strategies (MA Crossover, RSI, MACD, Breakout, Volume Spike) computed from real OHLCV data via yfinance |
| **Backtesting Engine** | Historical backtest per strategy — win rate, avg return, max drawdown, Sharpe ratio |
| **Portfolio Analyzer** | Sector allocation, risk concentration, XIRR, volatility, beta, correlation matrix |
| **Decision Engine** | Combines signals + backtest + portfolio → BUY/SELL/HOLD with confidence score + reasoning chain |
| **Audit Trail** | Every decision logged with full data snapshot, rules triggered, and logic used |
| **Real-time Alerts** | WebSocket push notifications + optional Telegram bot |
| **Market Overview** | Live NIFTY 50, SENSEX, Bank NIFTY, NIFTY IT from yfinance |
| **Security** | JWT auth for sensitive actions (scan, backtest run, portfolio write, audit view) |
| **Observability** | Prometheus metrics, structured JSON logs, optional Sentry error tracking |
| **Safety Guards** | API rate limits + external data timeouts to prevent abuse/hangs |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                        │
│  Dashboard │ Stock Detail │ Portfolio │ Alerts & Audit Trail │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP + WebSocket
┌────────────────────────┴─────────────────────────────────────┐
│                      FastAPI Backend                          │
│ ┌──────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐ │
│ │Signal│ │Backtester│ │Portfolio │ │Decision│ │  Alerts  │ │
│ │Engine│ │  Engine  │ │ Analyzer │ │ Engine │ │  System  │ │
│ └──┬───┘ └────┬─────┘ └────┬─────┘ └───┬────┘ └─────┬────┘ │
│    │          │             │            │            │       │
│    └──────────┴─────────────┴────────────┴────────────┘       │
│                          SQLite / PostgreSQL                  │
└──────────────────────────────────────────────────────────────┘
     ↑ Real data from yfinance, Google News RSS, NSE filings
```

---

## 🚀 Quick Start (Local)

### 0) Configure environment files
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp .env.example .env
```

Set real values for secrets and production URLs before deployment.

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Visit **http://localhost:8000/docs** for Swagger UI.

### Database migrations (Alembic)
```bash
cd backend
alembic -c alembic.ini upgrade head
```

For new schema changes:
```bash
alembic -c alembic.ini revision --autogenerate -m "describe_change"
alembic -c alembic.ini upgrade head
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Visit **http://localhost:3000**.

For local realtime alerts, frontend uses `ws://localhost:3000/ws/alerts` through Next rewrites.
If you host frontend and backend on different domains, set `NEXT_PUBLIC_WS_URL` to your backend websocket URL.

---

## 🐳 Docker

```bash
docker-compose up --build
```
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Swagger: http://localhost:8000/docs

This compose setup is production-oriented:
- Backend uses PostgreSQL via `postgresql+asyncpg`
- Frontend proxies `/api` and `/ws` using `NEXT_SERVER_API_URL`
- Browser API base remains empty so requests stay same-origin (`/api/...`)
- App fails fast in production if JWT secret or admin password hash is missing

Before first compose run, create root `.env` from `.env.example` and set:
- `JWT_SECRET_KEY` to a long random value
- `ADMIN_PASSWORD_HASH` to a bcrypt hash

Example hash generation:
```bash
docker compose run --rm backend python -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('YourStrongPassword'))"
```

---

## 📡 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/signals` | List recent signals |
| `POST` | `/api/signals/scan?symbol=RELIANCE.NS` | Scan a stock for signals |
| `GET` | `/api/signals/strategies` | List available strategies |
| `POST` | `/api/backtest/run?strategy=ma_crossover&symbol=RELIANCE.NS` | Run backtest |
| `GET` | `/api/backtest/{strategy}` | Get backtest results |
| `GET` | `/api/backtest/impact-model` | Overall impact model |
| `POST` | `/api/portfolio` | Create/update portfolio |
| `POST` | `/api/portfolio/upload-csv` | Upload portfolio CSV |
| `GET` | `/api/portfolio-analysis` | Full portfolio analysis |
| `GET` | `/api/recommendation/{stock}` | AI recommendation |
| `GET` | `/api/market-overview` | Live market indices |
| `GET` | `/api/audit` | Decision audit trail |
| `WS` | `/ws/alerts` | Real-time signal alerts |

---

## 🛠️ Tech Stack

**Backend:** Python 3.11, FastAPI, SQLAlchemy (async), yfinance, pandas, numpy, scipy, feedparser, BeautifulSoup4

**Frontend:** Next.js 15, React 18, TypeScript, TailwindCSS, Recharts, TradingView Lightweight Charts

**Infrastructure:** Docker, PostgreSQL (optional, SQLite default), Redis (optional)

---

## 📂 Project Structure

```
ai-investor-copilot/
├── backend/
│   ├── app/
│   │   ├── api/           # REST + WebSocket endpoints
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── services/      # Business logic engines
│   │   ├── main.py        # FastAPI app entry
│   │   ├── config.py      # Environment-based config
│   │   └── database.py    # Async DB setup
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/           # Next.js pages
│   │   ├── components/    # Reusable UI components
│   │   └── lib/           # API client
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## ⚠️ Notes

- **Database**: SQLite by default — switch to PostgreSQL by changing `DATABASE_URL` env var.
- **yfinance**: Works without API keys but has rate limits. The system handles this gracefully.
- **News**: Google News RSS (no key needed). NewsAPI supported if `NEWS_API_KEY` is set.
- **All data is real** — fetched from Yahoo Finance and NSE. No mock/fake numbers anywhere.

## ⚡ Realtime Scanning

Backend can continuously ingest and scan the watchlist with real OHLCV updates.

Environment knobs in `backend/.env`:
- `REALTIME_SCAN_ENABLED=true`
- `REALTIME_SCAN_INTERVAL_SECONDS=120`
- `REALTIME_SCAN_DAYS_BACK=5`

When enabled, the backend runs a background loop that:
1. refreshes market data,
2. scans all strategies,
3. broadcasts live alerts over websocket.

## ▲ Vercel Ready Deployment

Recommended production topology:
- Frontend on Vercel (Next.js)
- Backend on a long-running ASGI host (Render/Railway/Fly.io/Azure App Service)
- PostgreSQL managed database

### Frontend (Vercel)
`frontend/vercel.json` is included so Vercel always uses deterministic install/build commands.

Set these Vercel environment variables in the `frontend` project:
- `NEXT_SERVER_API_URL=https://<your-backend-domain>`
- `NEXT_PUBLIC_API_URL=` (keep empty to use `/api` rewrites)
- `NEXT_PUBLIC_WS_URL=wss://<your-backend-domain>/ws/alerts`
- `NEXT_PUBLIC_ENABLE_ALERT_POLLING=true`

Important for monorepo setup in Vercel:
- Root Directory: `frontend`
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: leave empty (Next.js default)

### Backend (production host)
Set these minimum variables:
- `ENVIRONMENT=production`
- `DATABASE_URL=postgresql+asyncpg://...`
- `AUTH_ENABLED=true`
- `JWT_SECRET_KEY=<strong-random-secret>`
- `ADMIN_PASSWORD_HASH=<bcrypt-hash>`
- `CORS_ORIGINS=https://<your-vercel-app-domain>`
- `TRUSTED_HOSTS=<your-backend-domain>`

Deploy health checks to verify immediately after release:
- `GET https://<your-backend-domain>/api/health`
- `GET https://<your-backend-domain>/metrics`

### Important
- Vercel serverless functions are not ideal for persistent websocket backends.
- Keep websocket on the backend host and point frontend via `NEXT_PUBLIC_WS_URL`.
- Polling fallback is enabled to keep alerts live even if websocket is temporarily unavailable.

## 🆓 Best Free Deployment (Recommended)

Best free stack for this project:
- Frontend + Backend: Render free web services
- Database: Neon free PostgreSQL

Why this is best for this app:
- Supports long-running backend process needed for websocket alerts.
- Keeps frontend and backend on the same provider for simpler CORS and env setup.
- Free tier is enough for demos/judge rounds (with cold-start tradeoff).

### Deploy via Blueprint

This repo includes `render.yaml` for one-click deployment of both services.

1. Push repo to GitHub.
2. In Render: New + Blueprint, select this repo.
3. Set secrets during setup:
     - `DATABASE_URL` from Neon
     - `ADMIN_PASSWORD_HASH` (bcrypt hash)
     - `CORS_ORIGINS=https://<your-frontend-domain>`
     - `TRUSTED_HOSTS=<your-backend-domain>`
     - `NEXT_SERVER_API_URL=https://<your-backend-domain>`
     - `NEXT_PUBLIC_WS_URL=wss://<your-backend-domain>/ws/alerts`
4. After deploy, update in backend env:
     - `CORS_ORIGINS` to your real frontend URL
     - `TRUSTED_HOSTS` to your real backend host

Tip: Keep `NEXT_PUBLIC_ENABLE_ALERT_POLLING=true` for resilience during free-tier cold starts.

Strict post-deploy smoke test:
```bash
# frontend should render
curl -I https://<your-frontend-domain>

# backend should be healthy
curl https://<your-backend-domain>/api/health

# websocket endpoint should be reachable (HTTP upgrade expected)
curl -I https://<your-backend-domain>/ws/alerts
```

## 📦 Dependency Reliability

Use deterministic installs in all environments:

```bash
# frontend
cd frontend
npm ci
npx eslint .
npm run build

# backend
cd ../backend
pip install -r requirements.txt
pip check
pytest -q
```

If Windows reports `EPERM` while reinstalling frontend packages, close running Node/Next processes and remove `frontend/node_modules` before running `npm ci` again.

## 🏆 Judge Demo Flow

Use this exact sequence during evaluation:

1. Login at `/login` with configured admin credentials.
2. Open dashboard and click `Run Judge Demo`.
3. Show live signal cards + realtime alerts panel updates.
4. Open one stock page and run all backtests.
5. Open portfolio page, upload real CSV, run full analysis.
6. Open alerts/audit and show full traceability records.

What this proves:
- Real data ingestion from live market sources.
- Deterministic technical strategies and backtesting.
- Auth-protected production operations.
- Realtime delivery via websocket with polling fallback.

## 🔐 Auth Setup (JWT)

Sensitive endpoints are protected when `AUTH_ENABLED=true`.

1. Generate password hash:
```bash
python -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt']).hash('YourStrongPassword'))"
```
2. Set `ADMIN_PASSWORD_HASH` and a strong `JWT_SECRET_KEY` in backend env.
3. Get token:
```bash
curl -X POST http://localhost:8000/api/auth/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "username=admin&password=YourStrongPassword"
```
4. Use `Authorization: Bearer <token>` for protected APIs.

## 📈 Observability

- Metrics endpoint: `GET /metrics` (Prometheus format)
- Structured logs: set `LOG_JSON=true`
- Sentry: set `ENABLE_SENTRY=true` and `SENTRY_DSN`

## 🧪 CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml` includes:
- Backend lint + tests
- Frontend lint + build
- Docker image build verification for backend and frontend

## ✅ Production Readiness Checklist

- Configure `ENVIRONMENT=production`, strict `CORS_ORIGINS`, and `TRUSTED_HOSTS`
- Disable docs in production using `ENABLE_DOCS=false`
- Use PostgreSQL in production (`postgresql+asyncpg://...`)
- Run behind HTTPS reverse proxy (Nginx/Traefik/Cloud LB)
- Set real Telegram/API credentials only via environment variables
- Add centralized logging and alerting in your deployment platform
