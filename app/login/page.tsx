'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithCode } from '@/lib/api';
import { getToken, setToken } from '@/lib/auth';
import { mapErrorToMessage } from '@/lib/errors';

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<unknown | null>(null);

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
      setError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-center">
      <div className="auth-stage auth-stage-compact">
        <form
          className="card login-panel login-form-panel animate-in"
          onSubmit={handleSubmit}
        >
          <div>
            <div className="hero-kicker">Insight</div>
            <h2>Enter code</h2>
          </div>
          <label>
            <div className="field-label">6-character code</div>
            <input
              value={code}
              onChange={(event) => handleChange(event.target.value)}
              maxLength={6}
              autoComplete="one-time-code"
              inputMode="text"
              placeholder="ABC123"
            />
          </label>
          <div className="code-slots" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => {
              const character = code[index] ?? '';
              return (
                <span
                  key={index}
                  className={`code-slot ${character ? 'filled' : ''}`}
                >
                  {character || ' '}
                </span>
              );
            })}
          </div>
          {error ? (
            <div className="error" role="alert">
              <strong>Unable to sign in</strong>
              <span>{mapErrorToMessage(error)}</span>
            </div>
          ) : null}
          <div className="login-actions">
            <button className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Verifying...' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
