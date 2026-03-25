const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const ENV_AUTH_TOKEN = process.env.NEXT_PUBLIC_AUTH_TOKEN || '';

function getStoredToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || '';
}

export function getAuthToken(): string {
  return getStoredToken() || ENV_AUTH_TOKEN;
}

export function hasAuthToken(): boolean {
  return Boolean(getAuthToken());
}

export function setAuthToken(token: string) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

function buildHeaders(options?: RequestInit): HeadersInit {
  const headers: Record<string, string> = {};
  const token = getStoredToken() || ENV_AUTH_TOKEN;

  if (token && !((options?.headers as Record<string, string> | undefined)?.Authorization)) {
    headers.Authorization = `Bearer ${token}`;
  }

  const hasContentType = Boolean((options?.headers as Record<string, string> | undefined)?.['Content-Type']);
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  if (!hasContentType && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  return { ...headers, ...options?.headers };
}

export async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: buildHeaders(options),
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function login(username: string, password: string) {
  const body = new URLSearchParams({ username, password });
  const result = await apiFetch<{ access_token: string }>('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (result?.access_token) setAuthToken(result.access_token);
  return result;
}

export function logout() {
  setAuthToken('');
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

export const getAuditLogsLimited = (actionType?: string, symbol?: string, limit = 50) => {
  const params = new URLSearchParams();
  if (actionType) params.set('action_type', actionType);
  if (symbol) params.set('symbol', symbol);
  params.set('limit', String(limit));
  return apiFetch(`/api/audit?${params.toString()}`);
};

export const uploadPortfolioCsv = async (file: File, name = 'Default') => {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch(`/api/portfolio/upload-csv?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    body: formData,
  });
};
