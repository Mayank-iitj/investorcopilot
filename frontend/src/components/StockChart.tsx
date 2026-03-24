'use client';

import { useEffect, useRef, useState } from 'react';

interface OHLCVPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StockChartProps {
  symbol: string;
  height?: number;
}

export default function StockChart({ symbol, height = 420 }: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      setLoading(true);
      setError(null);

      try {
        // Dynamically import lightweight-charts
        const { createChart, ColorType, CrosshairMode } = await import('lightweight-charts');

        // Fetch OHLCV data via signal scan (which auto-ingests data)
        const res = await fetch(`/api/signals/scan?symbol=${symbol}`, { method: 'POST' });
        const scan = await res.json();

        // Now fetch stored data - get signals which contain price snapshots  
        const sigRes = await fetch(`/api/signals?symbol=${symbol}`);
        const sigData = await sigRes.json();

        if (cancelled) return;

        // Clear previous chart
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }

        const chart = createChart(containerRef.current, {
          width: containerRef.current.clientWidth,
          height,
          layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: '#94a3b8',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 11,
          },
          grid: {
            vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
            horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: { color: 'rgba(99, 102, 241, 0.3)', width: 1, style: 2 },
            horzLine: { color: 'rgba(99, 102, 241, 0.3)', width: 1, style: 2 },
          },
          rightPriceScale: {
            borderColor: 'rgba(255, 255, 255, 0.06)',
            scaleMargins: { top: 0.1, bottom: 0.2 },
          },
          timeScale: {
            borderColor: 'rgba(255, 255, 255, 0.06)',
            timeVisible: false,
          },
        });

        chartRef.current = chart;

        // Build candlestick data from scan snapshot
        const ohlcvData: any[] = [];
        const volumeData: any[] = [];

        // Parse OHLCV from signal snapshots
        if (scan.signals && scan.signals.length > 0) {
          for (const sig of scan.signals) {
            if (sig.snapshot?.prices) {
              for (const p of sig.snapshot.prices) {
                const time = p.date || p.Date;
                if (time) {
                  ohlcvData.push({
                    time,
                    open: p.open || p.Open,
                    high: p.high || p.High,
                    low: p.low || p.Low,
                    close: p.close || p.Close,
                  });
                  volumeData.push({
                    time,
                    value: p.volume || p.Volume || 0,
                    color: (p.close || p.Close) >= (p.open || p.Open)
                      ? 'rgba(16, 185, 129, 0.3)'
                      : 'rgba(239, 68, 68, 0.3)',
                  });
                }
              }
            }
          }
        }

        if (ohlcvData.length > 0) {
          // Deduplicate and sort by time
          const seen = new Set();
          const uniqueOhlcv = ohlcvData.filter((d) => {
            if (seen.has(d.time)) return false;
            seen.add(d.time);
            return true;
          }).sort((a, b) => (a.time > b.time ? 1 : -1));

          const seenVol = new Set();
          const uniqueVol = volumeData.filter((d) => {
            if (seenVol.has(d.time)) return false;
            seenVol.add(d.time);
            return true;
          }).sort((a, b) => (a.time > b.time ? 1 : -1));

          const candleSeries = chart.addCandlestickSeries({
            upColor: '#10b981',
            downColor: '#ef4444',
            borderDownColor: '#ef4444',
            borderUpColor: '#10b981',
            wickDownColor: '#ef4444',
            wickUpColor: '#10b981',
          });
          candleSeries.setData(uniqueOhlcv);

          const volumeSeries = chart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
          });
          chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
          });
          volumeSeries.setData(uniqueVol);

          // Add signal markers
          const markers: any[] = [];
          if (sigData.signals) {
            for (const sig of sigData.signals) {
              if (sig.created_at) {
                const date = sig.created_at.split('T')[0];
                markers.push({
                  time: date,
                  position: sig.direction === 'BUY' ? 'belowBar' : 'aboveBar',
                  color: sig.direction === 'BUY' ? '#10b981' : '#ef4444',
                  shape: sig.direction === 'BUY' ? 'arrowUp' : 'arrowDown',
                  text: `${sig.direction} (${sig.type})`,
                });
              }
            }
          }
          if (markers.length > 0) {
            const seenMarkers = new Set();
            const uniqueMarkers = markers.filter((m) => {
              const key = `${m.time}-${m.text}`;
              if (seenMarkers.has(key)) return false;
              seenMarkers.add(key);
              return true;
            }).sort((a, b) => (a.time > b.time ? 1 : -1));
            candleSeries.setMarkers(uniqueMarkers);
          }

          chart.timeScale().fitContent();
        } else {
          setError('No chart data available. Try scanning the stock first.');
        }

        // Resize observer
        const ro = new ResizeObserver(() => {
          if (containerRef.current && chartRef.current) {
            chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
          }
        });
        ro.observe(containerRef.current);

        setLoading(false);

        return () => {
          cancelled = true;
          ro.disconnect();
          if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
          }
        };
      } catch (e) {
        if (!cancelled) {
          setError(String(e));
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [symbol, height]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-white/5 bg-white/[0.01]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0a0e1a]/80">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-sm text-slate-400">Loading chart data...</span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      )}
      <div ref={containerRef} style={{ height }} />
    </div>
  );
}
