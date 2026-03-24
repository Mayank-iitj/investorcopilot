'use client';

import { useState, useEffect } from 'react';

interface RecommendationPanelProps {
  symbol: string;
  portfolioId?: number;
}

interface Recommendation {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string[];
  active_signals: number;
  backtested_strategies: number;
}

export default function RecommendationPanel({ symbol, portfolioId }: RecommendationPanelProps) {
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchRecommendation() {
    setLoading(true); setError(null);
    try {
      const url = `/api/recommendation/${symbol}${portfolioId ? `?portfolio_id=${portfolioId}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) setError(data.error); else setRec(data);
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }

  useEffect(() => { fetchRecommendation(); }, [symbol, portfolioId]);

  const actionConfig = {
    BUY: { bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.2)', text: '#16a34a', gradient: 'linear-gradient(135deg, #22c55e, #4ade80)', icon: '📈' },
    SELL: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', text: '#dc2626', gradient: 'linear-gradient(135deg, #ef4444, #f87171)', icon: '📉' },
    HOLD: { bg: 'rgba(245, 197, 66, 0.1)', border: 'rgba(245, 197, 66, 0.3)', text: '#b8860b', gradient: 'linear-gradient(135deg, #f5c542, #e6b532)', icon: '⏸️' },
  };

  if (loading) {
    return (
      <div className="glass-card">
        <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>🤖 AI Recommendation</h3>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(245,197,66,0.2)', borderTopColor: '#f5c542' }} />
            <span className="text-sm" style={{ color: '#6b6b6b' }}>Analyzing {symbol.replace('.NS', '')}...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !rec) {
    return (
      <div className="glass-card">
        <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>🤖 AI Recommendation</h3>
        <div className="text-center py-8">
          <p className="text-sm" style={{ color: '#9a9a9a' }}>{error || 'Scan the stock first to generate a recommendation.'}</p>
          <button onClick={fetchRecommendation} className="btn-primary mt-4 text-sm">🔄 Retry</button>
        </div>
      </div>
    );
  }

  const config = actionConfig[rec.action] || actionConfig.HOLD;
  const confidencePct = Math.round(rec.confidence * 100);

  return (
    <div className="glass-card relative overflow-hidden">
      <div className="relative">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold" style={{ color: '#1a1a1a' }}>🤖 AI Recommendation</h3>
          <button onClick={fetchRecommendation} className="text-xs hover:underline" style={{ color: '#9a9a9a' }}>🔄 Refresh</button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
               style={{ background: config.bg, border: `1px solid ${config.border}` }}>
            {config.icon}
          </div>
          <div>
            <p className="text-3xl font-bold" style={{ color: config.text }}>{rec.action}</p>
            <p className="text-xs mt-0.5" style={{ color: '#9a9a9a' }}>
              {rec.active_signals} signals · {rec.backtested_strategies} strategies
            </p>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider" style={{ color: '#9a9a9a' }}>Confidence</span>
            <span className="text-sm font-mono font-bold" style={{ color: config.text }}>{confidencePct}%</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${confidencePct}%`, background: config.gradient }} />
          </div>
        </div>

        {rec.reasoning?.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider mb-3" style={{ color: '#9a9a9a' }}>Reasoning Chain</p>
            <div className="space-y-2">
              {rec.reasoning.map((reason, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                       style={{ background: config.bg, color: config.text, border: `1px solid ${config.border}` }}>
                    {i + 1}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#4a4a4a' }}>{reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
