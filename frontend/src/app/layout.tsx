import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import BackendStatusToast from '@/components/BackendStatusToast';

export const metadata: Metadata = {
  title: 'AI Investor Copilot — Indian Stock Market Intelligence',
  description: 'Production-grade AI platform for NSE/BSE with real signals, backtested strategies, and portfolio analytics.',
};

const NAV_ITEMS = [
  { href: '/', label: 'Overview' },
  { href: '/market', label: 'Market' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/chat', label: 'Copilot Chat' },
  { href: '/alerts', label: 'Alerts' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
             style={{ background: 'rgba(253, 251, 247, 0.85)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm transition-transform group-hover:scale-105"
                   style={{ background: 'linear-gradient(135deg, #fceb9f, #e8c046)' }}>
                ✨
              </div>
              <div>
                <h1 className="text-[17px] font-bold tracking-tight group-hover:text-amber-700 transition-colors"
                    style={{ color: '#2d2d2d' }}>
                  AI Investor Copilot
                </h1>
                <p className="text-[11px] font-medium -mt-0.5 tracking-wide" style={{ color: '#8a8a8a', textTransform: 'uppercase' }}>NSE / BSE Intelligence</p>
              </div>
            </Link>

            <div className="flex items-center gap-1 xl:gap-2 rounded-2xl p-1.5 shadow-sm border border-black/5"
                 style={{ background: 'rgba(255,255,255,0.6)' }}>
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-5 py-2 rounded-xl text-[14px] font-semibold transition-all duration-200 hover:bg-black/5"
                  style={{ color: item.href === '/chat' ? '#b45309' : '#5a5a5a' }}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-green-500/20"
                    style={{ background: 'rgba(34,197,94,0.08)', color: '#15803d' }}>
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-[11px] font-bold uppercase tracking-wider">Live</span>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm border border-amber-200 cursor-pointer hover:shadow-md transition-shadow"
                   style={{ background: '#fff', color: '#b45309' }}>
                MC
              </div>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="pt-[88px] pb-16 min-h-screen relative overflow-hidden" style={{ background: '#fdfbf7' }}>
          {/* Subtle background glow */}
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-amber-200/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-yellow-100/30 rounded-full blur-[150px] -z-10 pointer-events-none"></div>
          
          <div className="max-w-7xl mx-auto px-6 relative z-10 animate-fade-in">
            {children}
          </div>
          <BackendStatusToast />
        </main>
      </body>
    </html>
  );
}
