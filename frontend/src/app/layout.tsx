import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import AuthNav from '@/components/AuthNav';

export const metadata: Metadata = {
  title: 'AI Investor Copilot — Indian Stock Market Intelligence',
  description: 'Production-grade AI platform for NSE/BSE with real signals, backtested strategies, and portfolio analytics.',
};

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/alerts', label: 'Alerts' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50"
             style={{ background: 'rgba(250, 247, 242, 0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                   style={{ background: 'linear-gradient(135deg, #f5c542, #e6b532)' }}>
                📊
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight group-hover:text-amber-700 transition-colors"
                    style={{ color: '#1a1a1a' }}>
                  AI Investor Copilot
                </h1>
                <p className="text-[10px] -mt-0.5" style={{ color: '#9a9a9a' }}>NSE / BSE Intelligence</p>
              </div>
            </Link>

            <div className="flex items-center gap-1 rounded-2xl p-1"
                 style={{ background: 'rgba(0,0,0,0.04)' }}>
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                  style={{ color: '#4a4a4a' }}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <AuthNav />
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                   style={{ background: 'linear-gradient(135deg, #f5c542, #d4a017)' }}>
                N
              </div>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="pt-20 pb-12 hero-gradient min-h-screen">
          <div className="max-w-7xl mx-auto px-6">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
