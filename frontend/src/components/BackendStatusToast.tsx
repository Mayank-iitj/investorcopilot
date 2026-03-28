'use client';

import { useState, useEffect } from 'react';

export default function BackendStatusToast() {
  const [isAwake, setIsAwake] = useState(true); // Default true to avoid flickers
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    let currentAwakeState = true;

    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (res.ok) {
          setIsAwake(true);
          currentAwakeState = true;
        } else {
          setIsAwake(false);
          currentAwakeState = false;
        }
      } catch (err) {
        setIsAwake(false);
        currentAwakeState = false;
      } finally {
        setHasChecked(true);
      }
    };

    checkHealth();

    const interval = setInterval(() => {
      // Only keep polling if it isn't awake yet
      if (!currentAwakeState) {
        checkHealth();
      }
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  if (!hasChecked || isAwake) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-fade-in shadow-xl rounded-2xl">
      <div className="glass-card shadow-lg border border-amber-200/50 flex items-center gap-4 px-5 py-4 rounded-2xl" 
           style={{ background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(12px)' }}>
        
        <div className="relative flex items-center justify-center w-8 h-8">
          <div className="absolute w-full h-full border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin"></div>
          <span className="text-sm">⚡</span>
        </div>
        
        <div>
          <h4 className="text-sm font-bold text-gray-900 tracking-tight">Backend is Waking Up</h4>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mt-0.5">
            Render spin-up takes 15-30s...
          </p>
        </div>
      </div>
    </div>
  );
}
