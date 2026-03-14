'use client';

type LoadingListProps = {
  count?: number;
  tall?: boolean;
};

export default function LoadingList({
  count = 6,
  tall = false,
}: LoadingListProps) {
  return (
    <div className="loading-list" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={`loading-card ${tall ? 'tall' : ''}`}
        />
      ))}
    </div>
  );
}
