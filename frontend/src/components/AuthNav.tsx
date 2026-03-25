'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { hasAuthToken, logout } from '@/lib/api';

export default function AuthNav() {
  const [authenticated, setAuthenticated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setAuthenticated(hasAuthToken());
  }, [pathname]);

  const handleLogout = () => {
    logout();
    setAuthenticated(false);
    router.push('/login');
  };

  if (authenticated) {
    return (
      <button
        onClick={handleLogout}
        className="px-4 py-2 rounded-xl text-sm font-medium"
        style={{ background: 'rgba(0,0,0,0.04)', color: '#4a4a4a' }}
      >
        Logout
      </button>
    );
  }

  return (
    <Link
      href="/login"
      className="px-4 py-2 rounded-xl text-sm font-medium"
      style={{ background: '#1a1a1a', color: '#fff' }}
    >
      Login
    </Link>
  );
}
