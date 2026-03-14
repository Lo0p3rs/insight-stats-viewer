'use client';

import { mapErrorToMessage } from '@/lib/errors';

type RetryErrorProps = {
  error: unknown;
  onRetry: () => void;
  compact?: boolean;
};

export default function RetryError({
  error,
  onRetry,
  compact = false,
}: RetryErrorProps) {
  return (
    <div className={`retry-error ${compact ? 'compact' : ''}`} role="alert">
      <div className="retry-error-copy">
        <strong className="retry-error-title">
          {compact ? 'Unable to load data' : 'Something went wrong'}
        </strong>
        <p>{mapErrorToMessage(error)}</p>
      </div>
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
