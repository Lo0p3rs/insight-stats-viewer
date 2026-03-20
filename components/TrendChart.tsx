'use client';

import { useEffect, useId, useState } from 'react';

type TrendChartProps = {
  values: number[];
  labels: string[];
  formatValue?: (value: number) => string;
  detailValues?: Array<number | null>;
  formatDetail?: (value: number) => string;
  averageDetailValue?: number | null;
};

type Point = {
  x: number;
  y: number;
  label: string;
  value: number;
  detailValue: number | null;
};

function buildSmoothPath(points: Point[]) {
  if (points.length <= 1) {
    return points.length === 1 ? `M ${points[0].x} ${points[0].y}` : '';
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = (current.x + next.x) / 2;

    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }

  return path;
}

export default function TrendChart({
  values,
  labels,
  formatValue = (value) => value.toFixed(1),
  detailValues = [],
  formatDetail,
  averageDetailValue = null,
}: TrendChartProps) {
  const gradientId = useId().replace(/:/g, '');
  const width = 820;
  const height = 320;
  const padding = {
    left: 56,
    right: 22,
    top: 28,
    bottom: 44,
  };
  const [activeIndex, setActiveIndex] = useState(values.length - 1);

  useEffect(() => {
    setActiveIndex(values.length > 0 ? values.length - 1 : 0);
  }, [values]);

  if (!values.length) {
    return (
      <div className="chart-empty">
        <strong>No scouting trend data yet.</strong>
        <span>Match-by-match data will appear here once reports are available.</span>
      </div>
    );
  }

  const minValue = 0;
  const peakValue = Math.max(...values);
  const maxValue = peakValue > 0 ? peakValue * 1.15 : 1;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const average =
    values.reduce((sum, value) => sum + value, 0) / values.length;

  const points = values.map((value, index) => {
    const x =
      padding.left +
      (index / Math.max(1, values.length - 1)) * plotWidth;
    const y =
      height -
      padding.bottom -
      ((value - minValue) / (maxValue - minValue || 1)) * plotHeight;

    return {
      x,
      y,
      label: labels[index] ?? `M${index + 1}`,
      value,
      detailValue: detailValues[index] ?? null,
    };
  });

  const activePoint = points[Math.min(activeIndex, points.length - 1)];
  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${
    height - padding.bottom
  } L ${points[0].x} ${height - padding.bottom} Z`;
  const averageY =
    height -
    padding.bottom -
    ((average - minValue) / (maxValue - minValue || 1)) * plotHeight;

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = maxValue - ratio * (maxValue - minValue);
    const y = padding.top + ratio * plotHeight;
    return {
      value,
      y,
    };
  });

  const labelIndexes = new Set([
    0,
    Math.floor((points.length - 1) / 2),
    points.length - 1,
  ]);
  const showDetail = Boolean(formatDetail);
  const detailFormatter = formatDetail ?? ((value: number) => value.toFixed(0));
  const activeDetail =
    showDetail && activePoint.detailValue !== null
      ? detailFormatter(activePoint.detailValue)
      : null;
  const averageDetail =
    showDetail && averageDetailValue !== null
      ? detailFormatter(averageDetailValue)
      : null;
  const calloutHeight = activeDetail ? 64 : 48;

  return (
    <div className="chart-shell">
      <div className="chart-summary">
        <div>
          <span className="chart-summary-label">Selected match</span>
          <strong>{activePoint.label}</strong>
        </div>
        <div>
          <span className="chart-summary-label">{showDetail ? 'Score' : 'Value'}</span>
          <strong>{formatValue(activePoint.value)}</strong>
        </div>
        {showDetail ? (
          <div>
            <span className="chart-summary-label">Cycles</span>
            <strong>{activeDetail ?? '-'}</strong>
            {averageDetail ? <small>Avg {averageDetail}</small> : null}
          </div>
        ) : null}
        <div>
          <span className="chart-summary-label">{showDetail ? 'Avg score' : 'Average'}</span>
          <strong>{formatValue(average)}</strong>
        </div>
      </div>

      <svg
        className="chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Performance trend chart"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255, 94, 0, 0.28)" />
            <stop offset="100%" stopColor="rgba(255, 94, 0, 0.03)" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line
              className="chart-grid-line"
              x1={padding.left}
              x2={width - padding.right}
              y1={tick.y}
              y2={tick.y}
            />
            <text
              className="chart-axis-label chart-axis-label-y"
              x={padding.left - 10}
              y={tick.y + 4}
              textAnchor="end"
            >
              {formatValue(tick.value)}
            </text>
          </g>
        ))}

        <line
          className="chart-average-line"
          x1={padding.left}
          x2={width - padding.right}
          y1={averageY}
          y2={averageY}
        />

        <path className="chart-area" d={areaPath} fill={`url(#${gradientId})`} />
        <path className="chart-line" d={linePath} />

        {points.map((point, index) => {
          const isActive = index === activeIndex;
          return (
            <g key={`${point.label}-${point.value}`}>
              <circle
                className={`chart-point ${isActive ? 'active' : ''}`}
                cx={point.x}
                cy={point.y}
                r={isActive ? 7 : 5}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
              />
              {labelIndexes.has(index) ? (
                <text
                  className="chart-axis-label chart-axis-label-x"
                  x={point.x}
                  y={height - 14}
                  textAnchor={
                    index === 0
                      ? 'start'
                      : index === points.length - 1
                        ? 'end'
                        : 'middle'
                  }
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}

        <g className="chart-callout">
          <line
            className="chart-callout-line"
            x1={activePoint.x}
            x2={activePoint.x}
            y1={padding.top}
            y2={height - padding.bottom}
          />
          <rect
            className="chart-callout-card"
            x={Math.min(width - 170, Math.max(padding.left, activePoint.x - 72))}
            y={padding.top - 8}
            rx={12}
            ry={12}
            width={144}
            height={calloutHeight}
          />
          <text
            className="chart-callout-match"
            x={Math.min(width - 158, Math.max(padding.left + 12, activePoint.x - 60))}
            y={padding.top + 10}
          >
            {activePoint.label}
          </text>
          <text
            className="chart-callout-value"
            x={Math.min(width - 158, Math.max(padding.left + 12, activePoint.x - 60))}
            y={padding.top + 30}
          >
            {formatValue(activePoint.value)}
          </text>
          {activeDetail ? (
            <text
              className="chart-callout-detail"
              x={Math.min(width - 158, Math.max(padding.left + 12, activePoint.x - 60))}
              y={padding.top + 46}
            >
              {activeDetail}
            </text>
          ) : null}
        </g>
      </svg>
    </div>
  );
}
