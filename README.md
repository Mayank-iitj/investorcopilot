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

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Visit **http://localhost:8000/docs** for Swagger UI.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Visit **http://localhost:3000**.

---

## 🐳 Docker

```bash
docker-compose up --build
```
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Swagger: http://localhost:8000/docs

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

**Frontend:** Next.js 14, React 18, TypeScript, TailwindCSS, Recharts, TradingView Lightweight Charts

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
