export function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

export function formatFixed(value: number, digits = 1) {
  return value.toFixed(digits);
}

export function formatEventDate(date: string | null | undefined) {
  if (!date) return 'Schedule pending';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}
