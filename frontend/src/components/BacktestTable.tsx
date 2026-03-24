'use client';

interface BacktestResult {
  strategy: string;
  symbol?: string;
  total_trades: number;
  winning_trades: number;
  win_rate: number;
  avg_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
}

interface BacktestTableProps {
  results: BacktestResult[];
  title?: string;
  compact?: boolean;
}

export default function BacktestTable({ results, title = 'Backtest Results', compact = false }: BacktestTableProps) {
  if (!results || results.length === 0) {
    return (
      <div className="glass-card">
        <h3 className="text-lg font-semibold mb-3" style={{ color: '#1a1a1a' }}>{title}</h3>
        <div className="text-center py-10">
          <p className="text-3xl mb-2">🧪</p>
          <p className="text-sm" style={{ color: '#9a9a9a' }}>No backtest results yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card !p-0 overflow-hidden">
      <div className="px-6 pt-5 pb-3">
        <h3 className="text-lg font-semibold" style={{ color: '#1a1a1a' }}>{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <th className="table-header">Strategy</th>
              {!compact && <th className="table-header">Trades</th>}
              <th className="table-header">Win Rate</th>
              <th className="table-header">Avg Return</th>
              <th className="table-header">Max DD</th>
              <th className="table-header">Sharpe</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} className="hover:bg-amber-50/50 transition-colors">
                <td className="table-cell">
                  <span className="font-medium" style={{ color: '#1a1a1a' }}>{r.strategy.replace(/_/g, ' ')}</span>
                  {r.symbol && <p className="text-xs mt-0.5" style={{ color: '#9a9a9a' }}>{r.symbol.replace('.NS', '')}</p>}
                </td>
                {!compact && (
                  <td className="table-cell font-mono" style={{ color: '#4a4a4a' }}>
                    <span className="text-emerald-600">{r.winning_trades}</span>
                    <span style={{ color: '#d4d4d4' }}> / </span>
                    <span>{r.total_trades}</span>
                  </td>
                )}
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${r.win_rate}%`,
                        background: r.win_rate >= 50 ? 'linear-gradient(90deg, #22c55e, #4ade80)' : 'linear-gradient(90deg, #ef4444, #f87171)',
                      }} />
                    </div>
                    <span className={`font-mono text-sm font-semibold ${r.win_rate >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {r.win_rate.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className={`table-cell font-mono font-semibold ${r.avg_return_pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {r.avg_return_pct > 0 ? '+' : ''}{r.avg_return_pct.toFixed(2)}%
                </td>
                <td className="table-cell font-mono text-red-500">{r.max_drawdown_pct.toFixed(2)}%</td>
                <td className="table-cell">
                  <span className={`font-mono font-semibold ${r.sharpe_ratio >= 1 ? 'text-emerald-600' : r.sharpe_ratio >= 0 ? 'text-amber-600' : 'text-red-500'}`}>
                    {r.sharpe_ratio.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
