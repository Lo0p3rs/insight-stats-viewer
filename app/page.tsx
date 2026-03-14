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
      <div className="card login-card animate-in">
        <h1>Insight</h1>
        <p className="muted">Loading your workspace...</p>
      </div>
    </div>
  );
}
