'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    router.replace(token ? '/overview' : '/login');
  }, [router]);

  return (
    <div className="page-center">
      <div className="card loading-panel animate-in">
        <div className="hero-kicker">Insight</div>
        <h1>Loading your workspace...</h1>
        <p className="muted">Checking your session and opening the latest view.</p>
      </div>
    </div>
  );
}
