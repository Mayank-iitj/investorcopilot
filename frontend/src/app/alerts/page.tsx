'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AlertPanel from '@/components/AlertPanel';
import { getAuditLogsLimited, hasAuthToken } from '@/lib/api';

export default function AlertsPage() {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');
  const [filterSymbol, setFilterSymbol] = useState<string>('');

  const fetchAuditLogs = useCallback(async () => {
    if (!hasAuthToken()) {
      setAuditLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getAuditLogsLimited(filterType || undefined, filterSymbol || undefined, 100);
      setAuditLogs(data.audit_logs || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterType, filterSymbol]);

  useEffect(() => { fetchAuditLogs(); }, [fetchAuditLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#1a1a1a' }}>Alerts &amp; Audit Trail</h1>
        <p className="mt-1" style={{ color: '#6b6b6b' }}>Real-time signals and complete decision history</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2" style={{ minHeight: 600 }}>
          <AlertPanel maxAlerts={100} showHistorical={false} />
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="glass-card !p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[150px]">
                <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: '#9a9a9a' }}>Action Type</label>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input-field">
                  <option value="">All Types</option>
                  <option value="SIGNAL">Signals</option>
                  <option value="RECOMMENDATION">Recommendations</option>
                  <option value="BACKTEST">Backtests</option>
                  <option value="PORTFOLIO">Portfolio</option>
                </select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: '#9a9a9a' }}>Stock Symbol</label>
                <input value={filterSymbol} onChange={(e) => setFilterSymbol(e.target.value)} placeholder="e.g. RELIANCE.NS" className="input-field" />
              </div>
              <button onClick={fetchAuditLogs} className="btn-secondary">🔍 Filter</button>
            </div>
          </div>

          <div className="glass-card !p-0 overflow-hidden">
            <div className="px-6 pt-5 pb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold" style={{ color: '#1a1a1a' }}>📜 Audit Trail</h3>
              <span className="text-xs" style={{ color: '#9a9a9a' }}>{auditLogs.length} entries</span>
            </div>

            {loading ? (
              <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 w-full" />)}</div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-3xl mb-2">📝</p>
                <p className="text-sm" style={{ color: '#9a9a9a' }}>
                  {hasAuthToken() ? 'No audit logs yet. Scan signals or run backtests.' : 'Please login to view audit logs.'}
                </p>
              </div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="px-6 py-4 hover:bg-amber-50/50 transition-colors" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          log.action === 'SIGNAL' ? 'bg-blue-100 text-blue-700'
                          : log.action === 'RECOMMENDATION' ? 'bg-purple-100 text-purple-700'
                          : log.action === 'BACKTEST' ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>{log.action}</span>
                        {log.stock && <Link href={`/stock/${log.stock}`} className="text-sm font-semibold hover:underline" style={{ color: '#1a1a1a' }}>{log.stock.replace('.NS', '')}</Link>}
                      </div>
                      <span className="text-[10px]" style={{ color: '#9a9a9a' }}>
                        {new Date(log.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {log.output && (
                      <div className="text-sm" style={{ color: '#6b6b6b' }}>
                        {typeof log.output === 'string' ? <p>{log.output}</p> : (
                          <div className="flex flex-wrap gap-3 text-xs">
                            {log.output.direction && <span className={log.output.direction === 'BUY' ? 'badge-buy' : log.output.direction === 'SELL' ? 'badge-sell' : 'badge-hold'}>{log.output.direction}</span>}
                            {log.output.action && <span className={log.output.action === 'BUY' ? 'badge-buy' : log.output.action === 'SELL' ? 'badge-sell' : 'badge-hold'}>{log.output.action}</span>}
                            {log.output.confidence !== undefined && <span style={{ color: '#9a9a9a' }}>Confidence: {(log.output.confidence * 100).toFixed(0)}%</span>}
                          </div>
                        )}
                      </div>
                    )}
                    {log.logic && <p className="text-xs mt-1 truncate" style={{ color: '#9a9a9a' }}>{log.logic}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
