const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ── Signal APIs ─────────────────────────────────────────
export const getSignals = (symbol?: string) =>
  apiFetch(`/api/signals${symbol ? `?symbol=${symbol}` : ''}`);

export const scanSignals = (symbol: string) =>
  apiFetch(`/api/signals/scan?symbol=${symbol}`, { method: 'POST' });

export const getStrategies = () => apiFetch('/api/signals/strategies');

// ── Backtest APIs ───────────────────────────────────────
export const runBacktest = (strategy: string, symbol: string, years = 2, holdDays = 10) =>
  apiFetch(`/api/backtest/run?strategy=${strategy}&symbol=${symbol}&years=${years}&hold_days=${holdDays}`, { method: 'POST' });

export const getBacktestResults = (strategy: string, symbol?: string) =>
  apiFetch(`/api/backtest/${strategy}${symbol ? `?symbol=${symbol}` : ''}`);

export const getImpactModel = () => apiFetch('/api/backtest/impact-model');

// ── Portfolio APIs ──────────────────────────────────────
export const createPortfolio = (holdings: any[]) =>
  apiFetch('/api/portfolio', { method: 'POST', body: JSON.stringify(holdings) });

export const getPortfolioAnalysis = (portfolioId = 1) =>
  apiFetch(`/api/portfolio-analysis?portfolio_id=${portfolioId}`);

export const getPortfolio = (portfolioId = 1) =>
  apiFetch(`/api/portfolio/${portfolioId}`);

// ── Recommendation APIs ─────────────────────────────────
export const getRecommendation = (stock: string, portfolioId?: number) =>
  apiFetch(`/api/recommendation/${stock}${portfolioId ? `?portfolio_id=${portfolioId}` : ''}`);

// ── Market Overview ─────────────────────────────────────
export const getMarketOverview = () => apiFetch('/api/market-overview');

// ── Audit ───────────────────────────────────────────────
export const getAuditLogs = (actionType?: string, symbol?: string) => {
  const params = new URLSearchParams();
  if (actionType) params.set('action_type', actionType);
  if (symbol) params.set('symbol', symbol);
  return apiFetch(`/api/audit?${params.toString()}`);
};
