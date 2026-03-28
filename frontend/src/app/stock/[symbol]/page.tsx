'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import StockChart from '@/components/StockChart';
import SignalCard from '@/components/SignalCard';
import BacktestTable from '@/components/BacktestTable';
import RecommendationPanel from '@/components/RecommendationPanel';
import GroqInsightsPanel from '@/components/GroqInsightsPanel';
import { getSignals, runBacktest, scanSignals } from '@/lib/api';

const STRATEGIES = ['ma_crossover', 'rsi', 'macd', 'breakout', 'volume_spike'];

export default function StockDetailPage() {
  const params = useParams();
  const symbol = decodeURIComponent(params.symbol as string);
  const displayName = symbol.replace('.NS', '');

  const [signals, setSignals] = useState<any[]>([]);
  const [backtestResults, setBacktestResults] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [backtesting, setBacktesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'signals' | 'backtest' | 'recommendation' | 'groq'>('signals');

  const fetchSignals = useCallback(async () => {
    try {
      const data = await getSignals(symbol);
      setSignals(data.signals || []);
    } catch (e) { console.error(e); }
  }, [symbol]);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  async function handleScan() {
    setScanning(true);
    try { await scanSignals(symbol); await fetchSignals(); } catch (e) { console.error(e); }
    setScanning(false);
  }

  async function handleBacktest() {
    setBacktesting(true);
    const results: any[] = [];
    try {
      for (const strategy of STRATEGIES) {
        const data = await runBacktest(strategy, symbol, 2, 10);
        if (data.strategy_name) {
          results.push({ strategy: data.strategy_name, symbol: data.symbol, total_trades: data.total_trades, winning_trades: data.winning_trades, win_rate: data.win_rate_pct, avg_return_pct: data.avg_return_pct, max_drawdown_pct: data.max_drawdown_pct, sharpe_ratio: data.sharpe_ratio });
        }
      }
      setBacktestResults(results); setActiveTab('backtest');
    } catch (e) { console.error(e); }
    setBacktesting(false);
  }

  const tabs = [
    { key: 'signals', label: '⚡ Signals', count: signals.length },
    { key: 'backtest', label: '🧪 Backtest', count: backtestResults.length },
    { key: 'recommendation', label: '🤖 AI Verdict' },
    { key: 'groq', label: '✨ Groq Insights' },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/" className="text-sm hover:underline" style={{ color: '#9a9a9a' }}>Dashboard</Link>
            <span style={{ color: '#d4d4d4' }}>/</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#1a1a1a' }}>{displayName}</h1>
          <p className="text-sm font-mono mt-0.5" style={{ color: '#9a9a9a' }}>{symbol}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleScan} disabled={scanning} className="btn-primary disabled:opacity-50 flex items-center gap-2">
            {scanning ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" /> Scanning...</> : '🔍 Scan Signals'}
          </button>
          <button onClick={handleBacktest} disabled={backtesting} className="btn-secondary disabled:opacity-50 flex items-center gap-2">
            {backtesting ? <><div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(245,197,66,0.2)', borderTopColor: '#f5c542' }} /> Running...</> : '🧪 Run All Backtests'}
          </button>
        </div>
      </div>

      <div className="glass-card !p-2">
        <StockChart symbol={symbol} height={440} />
      </div>

      <div className="flex gap-1 pb-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-5 py-2.5 text-sm font-medium rounded-t-2xl transition-all border-b-2"
            style={activeTab === tab.key ? { color: '#1a1a1a', borderColor: '#f5c542', background: 'rgba(245,197,66,0.08)' } : { color: '#9a9a9a', borderColor: 'transparent' }}>
            {tab.label}
            {'count' in tab && tab.count > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded-full" style={{ background: 'rgba(245,197,66,0.15)', color: '#b8860b' }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'signals' && (
          signals.length === 0 ? (
            <div className="glass-card text-center py-12">
              <p className="text-3xl mb-2">📡</p>
              <p style={{ color: '#9a9a9a' }}>No signals detected yet. Click &quot;Scan Signals&quot; to analyze.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {signals.map((sig) => (
                <SignalCard key={sig.id} stock={sig.stock} type={sig.type} direction={sig.direction} strength={sig.strength} rule={sig.rule} price={sig.price} created_at={sig.created_at} />
              ))}
            </div>
          )
        )}
        {activeTab === 'backtest' && <BacktestTable results={backtestResults} title={`Backtest Results — ${displayName}`} />}
        {activeTab === 'recommendation' && <RecommendationPanel symbol={symbol} />}
        {activeTab === 'groq' && <GroqInsightsPanel symbol={symbol} />}
      </div>
    </div>
  );
}
