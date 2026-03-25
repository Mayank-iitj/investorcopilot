'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface Alert {
  id: string;
  stock: string;
  type: string;
  direction: string;
  rule: string;
  price?: number;
  timestamp: string;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || '';
const ENABLE_POLL_FALLBACK = (process.env.NEXT_PUBLIC_ENABLE_ALERT_POLLING || 'true') === 'true';

interface AlertPanelProps {
  maxAlerts?: number;
  showHistorical?: boolean;
}

export default function AlertPanel({ maxAlerts = 50, showHistorical = true }: AlertPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<any>(null);
  const pollInterval = useRef<any>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const addAlerts = useCallback((incoming: Alert[]) => {
    setAlerts((prev) => {
      const merged = [...incoming, ...prev];
      const unique: Alert[] = [];
      for (const item of merged) {
        if (seenIds.current.has(item.id)) continue;
        seenIds.current.add(item.id);
        unique.push(item);
        if (unique.length >= maxAlerts) break;
      }
      return unique;
    });
  }, [maxAlerts]);

  const toAlert = useCallback((raw: any): Alert | null => {
    const payload = raw?.data ?? raw;
    const stock = payload?.stock || payload?.symbol || 'Unknown';
    const direction = payload?.direction || payload?.action || 'INFO';
    const rule = payload?.rule || payload?.message || '';
    const timestamp = payload?.timestamp || new Date().toISOString();
    const id = payload?.id || `${stock}-${direction}-${rule}-${timestamp}`;

    if (!rule && !payload?.type && !payload?.signal_type) return null;

    return {
      id,
      stock,
      type: payload?.type || payload?.signal_type || 'signal',
      direction,
      rule,
      price: payload?.price,
      timestamp,
    };
  }, []);

  const pollLatest = useCallback(async () => {
    if (!ENABLE_POLL_FALLBACK) return;
    try {
      const res = await fetch('/api/audit?action_type=SIGNAL&limit=15', { cache: 'no-store' });
      const data = await res.json();
      const incoming: Alert[] = (data.audit_logs || [])
        .map((log: any) => {
          const output = log.output || {};
          return {
            id: `audit-${log.id}`,
            stock: log.stock || output.stock || 'Unknown',
            type: output.type || output.signal_type || 'signal',
            direction: output.direction || 'INFO',
            rule: output.rule || log.logic || '',
            price: output.price,
            timestamp: log.timestamp,
          } as Alert;
        });
      addAlerts(incoming);
    } catch {}
  }, [addAlerts]);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = window.location.host;
      const target = WS_URL || `${protocol}://${host}/ws/alerts`;
      const ws = new WebSocket(target);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const alert = toAlert(data);
          if (alert) addAlerts([alert]);
        } catch {}
      };
      ws.onclose = () => {
        setConnected(false);
        reconnectTimeout.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      wsRef.current = ws;
    } catch {
      setConnected(false);
      reconnectTimeout.current = setTimeout(connect, 3000);
    }
  }, [addAlerts, toAlert]);

  useEffect(() => {
    connect();
    if (ENABLE_POLL_FALLBACK) {
      pollLatest();
      pollInterval.current = setInterval(pollLatest, 15000);
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [connect, pollLatest]);

  useEffect(() => {
    if (!showHistorical) return;
    async function loadHistorical() {
      try {
        const res = await fetch('/api/audit?action_type=SIGNAL&limit=30', { cache: 'no-store' });
        const data = await res.json();
        if (data.audit_logs) {
          const historical: Alert[] = data.audit_logs.map((log: any) => ({
            id: `audit-${log.id}`,
            stock: log.stock || 'Unknown',
            type: log.output?.type || log.output?.signal_type || 'signal',
            direction: log.output?.direction || 'INFO',
            rule: log.output?.rule || log.logic || '',
            price: log.output?.price, timestamp: log.timestamp,
          }));
          addAlerts(historical);
        }
      } catch {}
    }
    loadHistorical();
  }, [showHistorical, addAlerts]);

  const filtered = filter === 'ALL' ? alerts : alerts.filter((a) => a.direction === filter);

  return (
    <div className="glass-card h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold" style={{ color: '#1a1a1a' }}>🔔 Live Alerts</h3>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse-glow' : 'bg-red-400'}`} />
            <span className="text-[10px] uppercase tracking-wider" style={{ color: '#9a9a9a' }}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          {(['ALL', 'BUY', 'SELL'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                filter === f
                  ? 'text-white'
                  : ''
              }`}
              style={filter === f ? { background: '#1a1a1a', color: '#fff' } : { color: '#6b6b6b' }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">📡</p>
            <p className="text-sm" style={{ color: '#9a9a9a' }}>
              {connected ? 'Waiting for alerts...' : 'Connecting...'}
            </p>
          </div>
        ) : (
          filtered.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 rounded-xl border transition-all hover:shadow-sm ${
                alert.direction === 'BUY' ? 'border-l-2 border-l-emerald-400' :
                alert.direction === 'SELL' ? 'border-l-2 border-l-red-400' : ''
              }`}
              style={{ borderColor: 'rgba(0,0,0,0.06)', background: 'rgba(0,0,0,0.01)' }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Link href={`/stock/${alert.stock}`} className="text-sm font-semibold hover:underline" style={{ color: '#1a1a1a' }}>
                    {alert.stock.replace('.NS', '')}
                  </Link>
                  {alert.direction === 'BUY' && <span className="badge-buy text-[10px]">BUY</span>}
                  {alert.direction === 'SELL' && <span className="badge-sell text-[10px]">SELL</span>}
                </div>
                <span className="text-[10px]" style={{ color: '#9a9a9a' }}>
                  {new Date(alert.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#6b6b6b' }}>{alert.rule}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
