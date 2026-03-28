'use client';

import { useEffect, useState } from 'react';

type MarketData = {
  [indexName: string]: {
    value?: number;
    change_pct?: number;
    direction?: 'up' | 'down';
    error?: string;
  };
};

export default function MarketPage() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const res = await fetch('/api/market-overview');
        if (!res.ok) throw new Error('Failed to fetch market data');
        const json = await res.json();
        setData(json.market_overview);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMarket();
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Market Pulse</h1>
          <p className="text-gray-500 mt-1 font-medium text-sm tracking-wide">Live Snapshot of NSE / BSE Major Indices</p>
        </div>
        <div className="glass-card px-4 py-2 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Live Sync</span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass-card h-32 skeleton"></div>
          ))}
        </div>
      ) : error ? (
        <div className="glass-card border-red-200 bg-red-50 text-red-600 p-6">
          ⚠️ Unable to load market live data: {error}. Check backend connection.
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(data).map(([name, info]) => {
            const isUp = info.direction === 'up';
            const displayTitle = name.replace('_', ' ');

            return (
              <div key={name} className="glass-card border border-amber-100 hover:border-amber-300 group">
                <h3 className="text-xs font-extrabold text-amber-900/40 uppercase tracking-[0.2em] mb-3">{displayTitle}</h3>
                {info.error ? (
                  <p className="text-sm text-gray-400 font-medium tracking-wide">Wait for Sync...</p>
                ) : (
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-black text-gray-800 tracking-tighter">
                      ₹{info.value?.toLocaleString('en-IN')}
                    </span>
                    {info.change_pct !== undefined && (
                      <span className={`text-sm font-bold flex items-center gap-1 ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>
                        {isUp ? '▲' : '▼'} {Math.abs(info.change_pct).toFixed(2)}%
                      </span>
                    )}
                  </div>
                )}
                {/* Subtle chart placeholder visually */}
                <div className="h-10 mt-4 w-full opacity-30 flex items-end gap-1 overflow-hidden" style={{ background: 'linear-gradient(to top, rgba(251,191,36,0.1) 0%, transparent 100%)' }}>
                   {[...Array(10)].map((_, i) => (
                     <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${20 + Math.random() * 80}%`, background: isUp ? '#34d399' : '#f87171' }}></div>
                   ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-12">
        <div className="glass-card" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-center">
               <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 mx-auto" style={{ background: 'linear-gradient(135deg, #fceb9f, #e8c046)' }}>
                 📊
               </div>
               <h3 className="text-xl font-bold text-gray-800 mb-2">Advanced Screener Loading</h3>
               <p className="text-gray-500 text-sm">Top gainers, volume shockers, and sectoral heatmaps will appear here.</p>
            </div>
        </div>
      </div>
    </div>
  );
}
