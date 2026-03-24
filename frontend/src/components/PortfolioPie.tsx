'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface SectorData { name: string; value: number; }
interface PortfolioPieProps { data: SectorData[]; title?: string; }

const COLORS = [
  '#f5c542', '#e6b532', '#d4a017', '#22c55e', '#4ade80',
  '#3b82f6', '#60a5fa', '#f59e0b', '#ef4444', '#ec4899',
  '#14b8a6', '#06b6d4', '#8b5cf6', '#64748b', '#d946ef',
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="px-3 py-2 rounded-xl border text-sm"
         style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <p className="font-semibold" style={{ color: '#1a1a1a' }}>{d.name}</p>
      <p style={{ color: '#6b6b6b' }}>{d.value.toFixed(1)}%</p>
    </div>
  );
}

export default function PortfolioPie({ data, title = 'Sector Allocation' }: PortfolioPieProps) {
  if (!data || data.length === 0) {
    return (
      <div className="glass-card flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: '#9a9a9a' }}>No allocation data</p>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>{title}</h3>
      <div className="flex flex-col lg:flex-row items-center gap-6">
        <div className="w-full lg:w-1/2" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={65} outerRadius={110} paddingAngle={2} dataKey="value" stroke="none" animationDuration={800}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full lg:w-1/2 space-y-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-3 group">
              <div className="w-3 h-3 rounded-full shrink-0 transition-transform group-hover:scale-125" style={{ background: COLORS[i % COLORS.length] }} />
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm" style={{ color: '#4a4a4a' }}>{d.name}</span>
                <span className="text-sm font-mono" style={{ color: '#6b6b6b' }}>{d.value.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
