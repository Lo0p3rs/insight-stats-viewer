'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithCode } from '@/lib/api';
import { getToken, setToken } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getToken()) {
      router.replace('/overview');
    }
  }, [router]);

  const handleChange = (value: string) => {
    setError(null);
    setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) {
      setError('Enter your 6-character access code.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const token = await loginWithCode(code);
      setToken(token);
      router.replace('/overview');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Login failed. Try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-center">
      <form className="card login-card animate-in" onSubmit={handleSubmit}>
        <div>
          <h1>Insight</h1>
          <p>Enter the six-character access code for the event.</p>
        </div>
        <label>
          <div className="helper-text">Access code</div>
          <input
            value={code}
            onChange={(event) => handleChange(event.target.value)}
            maxLength={6}
            autoComplete="one-time-code"
            placeholder="ABC123"
          />
        </label>
        {error ? <div className="error">{error}</div> : null}
        <div className="login-actions">
          <button className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Verifying...' : 'Enter Dashboard'}
          </button>
          <span className="helper-text">Code auto-capitalizes.</span>
        </div>
      </form>
    </div>
  );
}
