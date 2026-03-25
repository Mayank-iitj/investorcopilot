'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SignalCard from '@/components/SignalCard';
import AlertPanel from '@/components/AlertPanel';
import { getImpactModel, getMarketOverview, getSignals, hasAuthToken, scanSignals } from '@/lib/api';

interface Signal {
  id: number;
  stock: string;
  type: string;
  direction: string;
  strength: number | null;
  rule: string;
  price: number | null;
  snapshot: any;
  created_at: string;
}

interface MarketIndex {
  value: number;
  change_pct?: number;
  direction?: string;
}

const WATCHLIST = [
  'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS',
  'ITC.NS', 'SBIN.NS', 'BHARTIARTL.NS', 'WIPRO.NS', 'BAJFINANCE.NS',
  'TATAMOTORS.NS', 'SUNPHARMA.NS', 'TITAN.NS', 'MARUTI.NS', 'LT.NS',
];

export default function DashboardPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [market, setMarket] = useState<Record<string, MarketIndex>>({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanSymbol, setScanSymbol] = useState('RELIANCE.NS');
  const [scanResult, setScanResult] = useState<any>(null);
  const [impact, setImpact] = useState<any>(null);
  const [trustTimestamp, setTrustTimestamp] = useState('');

  useEffect(() => { fetchDashboard(); }, []);

  async function fetchDashboard() {
    setLoading(true);
    try {
      const [sigRes, mktRes] = await Promise.allSettled([getSignals(), getMarketOverview()]);
      if (sigRes.status === 'fulfilled') setSignals(sigRes.value.signals || []);
      if (mktRes.status === 'fulfilled') setMarket(mktRes.value.market_overview || {});

      const impactRes = await getImpactModel().catch(() => null);
      if (impactRes?.impact_model) setImpact(impactRes.impact_model);
      setTrustTimestamp(new Date().toLocaleString('en-IN'));
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    }
    setLoading(false);
  }

  async function handleScan() {
    if (!scanSymbol.trim()) return;
    if (!hasAuthToken()) {
      setScanResult({ error: 'Please login to run realtime scans.' });
      return;
    }
    setScanning(true);
    setScanResult(null);
    try {
      const data = await scanSignals(scanSymbol);
      setScanResult(data);
      const sigRes = await getSignals();
      setSignals(sigRes.signals || []);
    } catch (e) {
      setScanResult({ error: String(e) });
    }
    setScanning(false);
  }

  async function runJudgeDemo() {
    if (!hasAuthToken()) {
      setScanResult({ error: 'Please login to run the full judge demo actions.' });
      return;
    }
    setScanning(true);
    try {
      const demoSymbols = ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS'];
      let total = 0;
      for (const symbol of demoSymbols) {
        const result = await scanSignals(symbol);
        total += result?.signals_detected || 0;
      }
      setScanResult({ symbol: 'Demo Watchlist', signals_detected: total, signals: [] });
      const sigRes = await getSignals();
      setSignals(sigRes.signals || []);
    } catch (e) {
      setScanResult({ error: String(e) });
    } finally {
      setScanning(false);
    }
  }

  const buyCount = signals.filter((s) => s.direction === 'BUY').length;
  const sellCount = signals.filter((s) => s.direction === 'SELL').length;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#1a1a1a' }}>
            Welcome back 👋
          </h1>
          <p className="mt-1" style={{ color: '#6b6b6b' }}>Real-time signals &amp; market intelligence</p>
        </div>
        <button onClick={fetchDashboard} className="btn-secondary flex items-center gap-2">
          🔄 Refresh
        </button>
      </div>

      {/* Stats Pills Row */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="px-5 py-2 rounded-2xl text-sm font-semibold"
             style={{ background: '#1a1a1a', color: '#fff' }}>
          {signals.length} Signals
        </div>
        <div className="px-5 py-2 rounded-2xl text-sm font-semibold"
             style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#16a34a' }}>
          {buyCount} Buy
        </div>
        <div className="px-5 py-2 rounded-2xl text-sm font-semibold"
             style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}>
          {sellCount} Sell
        </div>

        {/* Right side: Market stat cards */}
        <div className="ml-auto flex gap-6">
          {Object.entries(market).slice(0, 3).map(([name, data]) => (
            <div key={name} className="text-right">
              <p className="text-2xl font-bold tracking-tight" style={{ color: '#1a1a1a' }}>
                {data.value ? (data.value / 1000).toFixed(1) + 'K' : '—'}
              </p>
              <p className="text-xs" style={{ color: '#9a9a9a' }}>
                {data.change_pct !== undefined && (
                  <span className={data.change_pct >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                    {data.change_pct >= 0 ? '↑' : '↓'} {Math.abs(data.change_pct).toFixed(2)}%{' '}
                  </span>
                )}
                {name.replace(/_/g, ' ')}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Market Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(market).length > 0
          ? Object.entries(market).map(([name, data], i) => (
              <div key={name} className={i === 0 ? 'card-warm' : 'glass-card'}>
                <p className="text-xs font-medium mb-1" style={{ color: '#9a9a9a' }}>{name.replace(/_/g, ' ')}</p>
                <p className="text-2xl font-bold tracking-tight" style={{ color: '#1a1a1a' }}>
                  {data.value ? data.value.toLocaleString('en-IN') : '—'}
                </p>
                {data.change_pct !== undefined && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                      data.change_pct >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
                    }`}>
                      {data.change_pct >= 0 ? '▲' : '▼'}
                    </div>
                    <span className={`text-sm font-semibold ${data.change_pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {Math.abs(data.change_pct).toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            ))
          : [1, 2, 3, 4].map((i) => (
              <div key={i} className="glass-card">
                <div className="skeleton h-4 w-20 mb-2" />
                <div className="skeleton h-8 w-28" />
              </div>
            ))}
      </div>

      {/* Signal Scanner */}
      <div className="card-warm">
        <h2 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>
          🔍 Signal Scanner
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium mb-1 block" style={{ color: '#6b6b6b' }}>Stock Symbol</label>
            <select value={scanSymbol} onChange={(e) => setScanSymbol(e.target.value)} className="input-field">
              {WATCHLIST.map((s) => (
                <option key={s} value={s}>{s.replace('.NS', '')}</option>
              ))}
            </select>
          </div>
          <button onClick={handleScan} disabled={scanning} className="btn-primary disabled:opacity-50 flex items-center gap-2">
            {scanning ? (
              <>
                <div className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
                Scanning…
              </>
            ) : (
              '🚀 Scan for Signals'
            )}
          </button>
          <button onClick={runJudgeDemo} disabled={scanning} className="btn-secondary disabled:opacity-50">
            🏁 Run Judge Demo
          </button>
        </div>

        {scanResult && (
          <div className="mt-4 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.06)' }}>
            {scanResult.error ? (
              <p className="text-red-500">{scanResult.error}</p>
            ) : (
              <>
                <p className="text-sm font-medium" style={{ color: '#1a1a1a' }}>
                  Found <span className="font-bold" style={{ color: '#d4a017' }}>{scanResult.signals_detected}</span> signals
                  for {scanResult.symbol?.includes('.NS') ? (
                    <Link href={`/stock/${scanResult.symbol}`} className="font-bold hover:underline" style={{ color: '#d4a017' }}>
                      {scanResult.symbol?.replace('.NS', '')}
                    </Link>
                  ) : (
                    <span className="font-bold" style={{ color: '#d4a017' }}>
                      {scanResult.symbol}
                    </span>
                  )}
                </p>
                {scanResult.signals?.slice(0, 3).map((s: any, i: number) => (
                  <div key={i} className={`mt-2 p-3 rounded-xl ${s.direction === 'BUY' ? 'signal-buy' : 'signal-sell'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={s.direction === 'BUY' ? 'badge-buy' : 'badge-sell'}>{s.direction}</span>
                        <span className="text-xs ml-2" style={{ color: '#9a9a9a' }}>{s.type}</span>
                      </div>
                      <span className="text-xs" style={{ color: '#9a9a9a' }}>{s.date}</span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: '#4a4a4a' }}>{s.rule}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="glass-card">
        <h2 className="text-lg font-semibold mb-3" style={{ color: '#1a1a1a' }}>✅ Data Provenance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)' }}>
            <p style={{ color: '#9a9a9a' }}>Market Source</p>
            <p style={{ color: '#1a1a1a' }}>Yahoo Finance / NSE</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)' }}>
            <p style={{ color: '#9a9a9a' }}>Algorithms</p>
            <p style={{ color: '#1a1a1a' }}>SMA, RSI, MACD, Breakout, Volume</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)' }}>
            <p style={{ color: '#9a9a9a' }}>Last UI Refresh</p>
            <p style={{ color: '#1a1a1a' }}>{trustTimestamp || 'Pending'}</p>
          </div>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Signals */}
        <div className="lg:col-span-2 glass-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: '#1a1a1a' }}>⚡ Recent Signals</h2>
            {signals.length > 0 && (
              <span className="text-xs" style={{ color: '#9a9a9a' }}>{signals.length} signals</span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 w-full" />)}
            </div>
          ) : signals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-2">📡</p>
              <p style={{ color: '#9a9a9a' }}>No signals yet. Use the scanner above to detect signals.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {signals.map((sig) => (
                <SignalCard
                  key={sig.id}
                  id={sig.id}
                  stock={sig.stock}
                  type={sig.type}
                  direction={sig.direction as 'BUY' | 'SELL'}
                  strength={sig.strength}
                  rule={sig.rule}
                  price={sig.price}
                  created_at={sig.created_at}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Impact Model — dark card for contrast */}
          <div className="card-dark">
            <h2 className="text-lg font-semibold mb-4">📊 Impact Model</h2>
            {impact ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-white/50">Total Signals Tested</p>
                  <p className="text-2xl font-bold">{impact.total_signals_tested}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50">Overall Win Rate</p>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${impact.overall_win_rate_pct}%`,
                          background: 'linear-gradient(90deg, #f5c542, #e6b532)',
                        }}
                      />
                    </div>
                    <span className="text-lg font-bold" style={{ color: '#f5c542' }}>
                      {impact.overall_win_rate_pct}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-white/50">Avg Return/Trade</p>
                  <p className={`text-xl font-bold ${impact.avg_return_per_trade_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {impact.avg_return_per_trade_pct > 0 ? '+' : ''}{impact.avg_return_per_trade_pct}%
                  </p>
                </div>
                <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <p className="text-xs text-white/50">If User Followed Signals</p>
                  <p className="text-lg font-bold" style={{ color: '#f5c542' }}>{impact.projected_return_if_followed}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/40">Run backtests to see impact metrics.</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="glass-card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>🚀 Quick Actions</h2>
            <div className="space-y-2">
              <Link href="/portfolio" className="btn-secondary block text-center w-full">
                💼 Manage Portfolio
              </Link>
              <Link href="/alerts" className="btn-secondary block text-center w-full">
                🔔 View Alerts &amp; Audit
              </Link>
              <button onClick={fetchDashboard} className="btn-secondary w-full">
                📡 Refresh Data
              </button>
            </div>
          </div>

          {/* Live Alerts Mini */}
          <AlertPanel maxAlerts={10} showHistorical={false} />
        </div>
      </div>
    </div>
  );
}
