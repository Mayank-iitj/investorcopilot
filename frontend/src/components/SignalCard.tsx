'use client';

import Link from 'next/link';

interface SignalProps {
  id?: number;
  stock: string;
  type: string;
  direction: 'BUY' | 'SELL';
  strength: number | null;
  rule: string;
  price: number | null;
  created_at: string;
  compact?: boolean;
}

export default function SignalCard({
  stock, type, direction, strength, rule, price, created_at, compact = false,
}: SignalProps) {
  const isBuy = direction === 'BUY';

  return (
    <div
      className={`group relative p-4 rounded-2xl border transition-all duration-300 hover:shadow-md ${
        isBuy ? 'signal-buy' : 'signal-sell'
      } ${compact ? '!p-3' : ''}`}
      style={{ borderColor: 'rgba(0,0,0,0.06)', background: isBuy ? 'rgba(34, 197, 94, 0.03)' : 'rgba(239, 68, 68, 0.03)' }}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <Link
            href={`/stock/${stock}`}
            className="font-semibold hover:underline transition-colors"
            style={{ color: '#1a1a1a' }}
          >
            {stock.replace('.NS', '')}
          </Link>
          <span className={isBuy ? 'badge-buy' : 'badge-sell'}>{direction}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.04)', color: '#6b6b6b' }}>
            {type.replace(/_/g, ' ')}
          </span>
        </div>
        <span className="text-xs" style={{ color: '#9a9a9a' }}>
          {new Date(created_at).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
        </span>
      </div>

      {strength !== null && strength !== undefined && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider w-14" style={{ color: '#9a9a9a' }}>Strength</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(Math.abs(strength) * 100, 100)}%`,
                background: isBuy
                  ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                  : 'linear-gradient(90deg, #ef4444, #f87171)',
              }}
            />
          </div>
          <span className="text-xs font-mono w-10 text-right" style={{ color: '#6b6b6b' }}>
            {(strength * 100).toFixed(0)}%
          </span>
        </div>
      )}

      <p className="text-sm mt-2 leading-relaxed" style={{ color: '#6b6b6b' }}>{rule}</p>

      {price && (
        <p className="text-xs font-mono mt-1.5" style={{ color: '#9a9a9a' }}>
          Price: ₹{price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </p>
      )}
    </div>
  );
}
