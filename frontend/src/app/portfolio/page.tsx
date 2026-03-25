'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import PortfolioPie from '@/components/PortfolioPie';
import { createPortfolio, getPortfolio, getPortfolioAnalysis, hasAuthToken, uploadPortfolioCsv } from '@/lib/api';

interface Holding { symbol: string; quantity: number; avg_buy_price: number; buy_date: string; sector?: string; }

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [portfolioId, setPortfolioId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [formSymbol, setFormSymbol] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDate, setFormDate] = useState('');

  useEffect(() => { loadPortfolio(); }, []);

  async function loadPortfolio() {
    if (!hasAuthToken()) return;
    try {
      const data = await getPortfolio(1);
      if (data.holdings?.length > 0) {
        setHoldings(data.holdings);
        setPortfolioId(data.id);
      }
    } catch {}
  }

  async function savePortfolio(h: Holding[]) {
    if (!hasAuthToken()) {
      alert('Please login to update portfolio.');
      return;
    }
    setLoading(true);
    try {
      const data = await createPortfolio(h);
      setPortfolioId(data.portfolio_id);
      setHoldings(h);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function runAnalysis() {
    if (!hasAuthToken()) {
      alert('Please login to run portfolio analytics.');
      return;
    }
    if (!portfolioId) return; setAnalyzing(true);
    try { setAnalysis(await getPortfolioAnalysis(portfolioId)); } catch (e) { console.error(e); }
    setAnalyzing(false);
  }

  function addHolding() {
    if (!hasAuthToken()) {
      alert('Please login to add holdings.');
      return;
    }
    if (!formSymbol || !formQty || !formPrice) return;
    const sym = formSymbol.toUpperCase().includes('.NS') ? formSymbol.toUpperCase() : `${formSymbol.toUpperCase()}.NS`;
    const newH = [...holdings, { symbol: sym, quantity: parseInt(formQty), avg_buy_price: parseFloat(formPrice), buy_date: formDate || new Date().toISOString().split('T')[0] }];
    setHoldings(newH); setFormSymbol(''); setFormQty(''); setFormPrice(''); setFormDate(''); setShowForm(false); savePortfolio(newH);
  }

  function removeHolding(idx: number) {
    const u = holdings.filter((_, i) => i !== idx);
    setHoldings(u);
    savePortfolio(u);
  }

  function openAddHoldingForm() {
    if (!hasAuthToken()) {
      alert('Please login to add holdings.');
      return;
    }
    setShowForm(!showForm);
  }

  function openCsvUpload() {
    if (!hasAuthToken()) {
      alert('Please login to upload portfolio data.');
      return;
    }
    fileRef.current?.click();
  }

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!hasAuthToken()) {
      alert('Please login to upload portfolio data.');
      return;
    }
    const file = e.target.files?.[0]; if (!file) return; setLoading(true);
    try {
      const data = await uploadPortfolioCsv(file, 'Default');
      if (data.holdings) { setHoldings(data.holdings); setPortfolioId(data.portfolio_id); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const totalInvested = holdings.reduce((sum, h) => sum + h.quantity * h.avg_buy_price, 0);
  const sectorMap: Record<string, number> = {};
  for (const h of holdings) { const s = h.sector || 'Unknown'; sectorMap[s] = (sectorMap[s] || 0) + h.quantity * h.avg_buy_price; }
  const sectorData = Object.entries(sectorMap).map(([name, val]) => ({ name, value: totalInvested > 0 ? (val / totalInvested) * 100 : 0 }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#1a1a1a' }}>Portfolio</h1>
          <p className="mt-1" style={{ color: '#6b6b6b' }}>Manage holdings, track allocation, and measure risk</p>
        </div>
        <div className="flex gap-3">
          <button onClick={openAddHoldingForm} className="btn-primary">➕ Add Holding</button>
          <button onClick={openCsvUpload} className="btn-secondary">📄 Upload CSV</button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
        </div>
      </div>

      {showForm && (
        <div className="card-warm">
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#4a4a4a' }}>Add Holding</h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: '#9a9a9a' }}>Symbol</label>
              <input value={formSymbol} onChange={(e) => setFormSymbol(e.target.value)} placeholder="RELIANCE" className="input-field" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: '#9a9a9a' }}>Quantity</label>
              <input type="number" value={formQty} onChange={(e) => setFormQty(e.target.value)} placeholder="10" className="input-field" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: '#9a9a9a' }}>Avg Buy Price (₹)</label>
              <input type="number" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="2500" className="input-field" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: '#9a9a9a' }}>Buy Date</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="input-field" />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={addHolding} className="btn-primary flex-1">Add</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">✕</button>
            </div>
          </div>
        </div>
      )}

      {holdings.length > 0 && (
        <div className="glass-card !p-0 overflow-hidden">
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold" style={{ color: '#1a1a1a' }}>
              Holdings <span className="text-sm font-normal ml-2" style={{ color: '#9a9a9a' }}>{holdings.length} stocks</span>
            </h3>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: '#9a9a9a' }}>Total Invested</p>
              <p className="text-lg font-bold font-mono" style={{ color: '#1a1a1a' }}>₹{totalInvested.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <th className="table-header">Stock</th><th className="table-header">Qty</th><th className="table-header">Avg Price</th><th className="table-header">Invested</th><th className="table-header">Buy Date</th><th className="table-header">Sector</th><th className="table-header w-10"></th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h, i) => (
                  <tr key={i} className="hover:bg-amber-50/50 transition-colors group">
                    <td className="table-cell"><Link href={`/stock/${h.symbol}`} className="font-semibold hover:underline" style={{ color: '#1a1a1a' }}>{h.symbol.replace('.NS', '')}</Link></td>
                    <td className="table-cell font-mono" style={{ color: '#4a4a4a' }}>{h.quantity}</td>
                    <td className="table-cell font-mono" style={{ color: '#4a4a4a' }}>₹{h.avg_buy_price.toLocaleString('en-IN')}</td>
                    <td className="table-cell font-mono font-medium" style={{ color: '#1a1a1a' }}>₹{(h.quantity * h.avg_buy_price).toLocaleString('en-IN')}</td>
                    <td className="table-cell text-xs" style={{ color: '#9a9a9a' }}>{h.buy_date || '—'}</td>
                    <td className="table-cell"><span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(245,197,66,0.1)', color: '#b8860b' }}>{h.sector || 'Unknown'}</span></td>
                    <td className="table-cell"><button onClick={() => removeHolding(i)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-all text-sm">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {holdings.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>📊 Portfolio Analytics</h2>
            <button onClick={runAnalysis} disabled={analyzing || !portfolioId} className="btn-primary disabled:opacity-50 flex items-center gap-2">
              {analyzing ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" /> Analyzing...</> : '🔬 Run Full Analysis'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PortfolioPie data={sectorData} />
            <div className="glass-card">
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#1a1a1a' }}>⚠️ Risk Metrics</h3>
              {analysis ? (
                <div className="grid grid-cols-2 gap-4">
                  {analysis.xirr !== undefined && (
                    <div className="p-4 rounded-2xl" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)' }}>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#9a9a9a' }}>XIRR</p>
                      <p className={`text-2xl font-bold font-mono ${analysis.xirr >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{(analysis.xirr * 100).toFixed(2)}%</p>
                    </div>
                  )}
                  {analysis.portfolio_volatility !== undefined && (
                    <div className="p-4 rounded-2xl" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)' }}>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#9a9a9a' }}>Volatility</p>
                      <p className="text-2xl font-bold font-mono text-amber-600">{(analysis.portfolio_volatility * 100).toFixed(2)}%</p>
                    </div>
                  )}
                  {analysis.portfolio_beta !== undefined && (
                    <div className="p-4 rounded-2xl" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)' }}>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#9a9a9a' }}>Beta</p>
                      <p className={`text-2xl font-bold font-mono ${analysis.portfolio_beta > 1 ? 'text-red-500' : 'text-emerald-600'}`}>{analysis.portfolio_beta.toFixed(3)}</p>
                    </div>
                  )}
                  {analysis.risk_concentration && (
                    <div className="p-4 rounded-2xl" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)' }}>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#9a9a9a' }}>Concentration</p>
                      <p className={`text-2xl font-bold font-mono ${analysis.risk_concentration === 'HIGH' ? 'text-red-500' : analysis.risk_concentration === 'MEDIUM' ? 'text-amber-600' : 'text-emerald-600'}`}>{analysis.risk_concentration}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10"><p className="text-sm" style={{ color: '#9a9a9a' }}>Click &quot;Run Full Analysis&quot; to compute risk metrics.</p></div>
              )}
            </div>
          </div>
        </>
      )}

      {holdings.length === 0 && !loading && (
        <div className="card-warm text-center py-16">
          <p className="text-5xl mb-4">💼</p>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#1a1a1a' }}>No Portfolio Yet</h2>
          <p className="mb-6 max-w-md mx-auto" style={{ color: '#6b6b6b' }}>Add real holdings manually or upload your broker export CSV.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={openAddHoldingForm} className="btn-primary">➕ Add Holdings</button>
            <button onClick={openCsvUpload} className="btn-secondary">📄 Upload CSV</button>
          </div>
        </div>
      )}
    </div>
  );
}
