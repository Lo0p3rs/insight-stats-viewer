'use client';

type TrendChartProps = {
  values: number[];
  labels: string[];
};

export default function TrendChart({ values, labels }: TrendChartProps) {
  const width = 640;
  const height = 240;
  const padding = 28;
  const length = values.length;

  if (length === 0) {
    return <div className="muted">No scouting data yet.</div>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values.map((value, index) => {
    const x =
      padding + (index / Math.max(1, length - 1)) * (width - padding * 2);
    const y =
      height -
      padding -
      ((value - min) / span) * (height - padding * 2);
    return { x, y, value, label: labels[index] ?? `#${index + 1}` };
  });

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const gridLines = Array.from({ length: 4 }, (_, index) => {
    const y = padding + (index / 3) * (height - padding * 2);
    return (
      <line
        key={`grid-${index}`}
        x1={padding}
        x2={width - padding}
        y1={y}
        y2={y}
      />
    );
  });

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Trend chart"
    >
      <g className="chart-grid">{gridLines}</g>
      <path className="line" d={path} />
      {points.map((point, index) => (
        <g key={`${point.x}-${point.y}`}>
          <circle cx={point.x} cy={point.y} r={4} />
          {index === points.length - 1 ? (
            <text
              x={point.x}
              y={point.y - 10}
              fontSize="12"
              textAnchor="end"
              fill="var(--muted)"
            >
              {point.label}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
