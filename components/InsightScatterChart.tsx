'use client';

import { useEffect, useState } from 'react';

export type InsightScatterDatum = {
  id: string;
  label: string;
  x: number;
  y: number;
  meta?: string;
};

type InsightScatterChartProps = {
  data: InsightScatterDatum[];
  xLabel: string;
  yLabel: string;
  formatX?: (value: number) => string;
  formatY?: (value: number) => string;
  invertX?: boolean;
  invertY?: boolean;
};

function roundDomain(min: number, max: number) {
  if (min === max) {
    return {
      min: Math.max(0, min - 1),
      max: max + 1,
    };
  }

  const span = max - min;
  const padding = span * 0.12;
  return {
    min: Math.max(0, min - padding),
    max: max + padding,
  };
}

export default function InsightScatterChart({
  data,
  xLabel,
  yLabel,
  formatX = (value) => value.toFixed(1),
  formatY = (value) => value.toFixed(1),
  invertX = false,
  invertY = false,
}: InsightScatterChartProps) {
  const width = 820;
  const height = 340;
  const padding = {
    left: 60,
    right: 24,
    top: 26,
    bottom: 46,
  };
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="chart-empty">
        <strong>No comparison data yet.</strong>
      </div>
    );
  }

  const xValues = data.map((datum) => datum.x);
  const yValues = data.map((datum) => datum.y);
  const xDomain = roundDomain(Math.min(...xValues), Math.max(...xValues));
  const yDomain = roundDomain(Math.min(...yValues), Math.max(...yValues));
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const points = data.map((datum) => {
    const xRatio = (datum.x - xDomain.min) / (xDomain.max - xDomain.min || 1);
    const yRatio = (datum.y - yDomain.min) / (yDomain.max - yDomain.min || 1);

    return {
      ...datum,
      px:
        padding.left +
        (invertX ? 1 - xRatio : xRatio) * plotWidth,
      py:
        padding.top +
        (invertY ? yRatio : 1 - yRatio) * plotHeight,
    };
  });

  const activePoint = points[Math.min(activeIndex, points.length - 1)];
  const xTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = xDomain.min + ratio * (xDomain.max - xDomain.min);
    const x =
      padding.left +
      (invertX ? 1 - ratio : ratio) * plotWidth;
    return { value, x };
  });
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = yDomain.min + ratio * (yDomain.max - yDomain.min);
    const y =
      padding.top +
      (invertY ? ratio : 1 - ratio) * plotHeight;
    return { value, y };
  });

  return (
    <div className="scatter-shell">
      <div className="scatter-summary">
        <div>
          <span className="chart-summary-label">Team</span>
          <strong>{activePoint.label}</strong>
          {activePoint.meta ? <small>{activePoint.meta}</small> : null}
        </div>
        <div>
          <span className="chart-summary-label">{xLabel}</span>
          <strong>{formatX(activePoint.x)}</strong>
        </div>
        <div>
          <span className="chart-summary-label">{yLabel}</span>
          <strong>{formatY(activePoint.y)}</strong>
        </div>
      </div>

      <svg
        className="scatter-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${xLabel} versus ${yLabel}`}
      >
        {yTicks.map((tick) => (
          <g key={`y-${tick.value}`}>
            <line
              className="scatter-grid-line"
              x1={padding.left}
              x2={width - padding.right}
              y1={tick.y}
              y2={tick.y}
            />
            <text
              className="scatter-axis-label"
              x={padding.left - 10}
              y={tick.y + 4}
              textAnchor="end"
            >
              {formatY(tick.value)}
            </text>
          </g>
        ))}

        {xTicks.map((tick) => (
          <g key={`x-${tick.value}`}>
            <line
              className="scatter-grid-line"
              x1={tick.x}
              x2={tick.x}
              y1={padding.top}
              y2={height - padding.bottom}
            />
            <text
              className="scatter-axis-label"
              x={tick.x}
              y={height - 14}
              textAnchor="middle"
            >
              {formatX(tick.value)}
            </text>
          </g>
        ))}

        {points.map((point, index) => (
          <circle
            key={point.id}
            className={`scatter-point ${index === activeIndex ? 'active' : ''}`}
            cx={point.px}
            cy={point.py}
            r={index === activeIndex ? 7 : 5}
            onMouseEnter={() => setActiveIndex(index)}
            onFocus={() => setActiveIndex(index)}
          >
            <title>
              {point.label}: {xLabel} {formatX(point.x)}, {yLabel} {formatY(point.y)}
            </title>
          </circle>
        ))}

        <g>
          <line
            className="scatter-callout-line"
            x1={activePoint.px}
            x2={activePoint.px}
            y1={padding.top}
            y2={height - padding.bottom}
          />
          <line
            className="scatter-callout-line"
            x1={padding.left}
            x2={width - padding.right}
            y1={activePoint.py}
            y2={activePoint.py}
          />
          <rect
            className="scatter-callout-card"
            x={Math.min(width - 176, Math.max(padding.left, activePoint.px - 82))}
            y={padding.top - 6}
            rx={12}
            ry={12}
            width={160}
            height={54}
          />
          <text
            className="scatter-callout-label"
            x={Math.min(width - 162, Math.max(padding.left + 12, activePoint.px - 68))}
            y={padding.top + 11}
          >
            {activePoint.label}
          </text>
          <text
            className="scatter-callout-value"
            x={Math.min(width - 162, Math.max(padding.left + 12, activePoint.px - 68))}
            y={padding.top + 31}
          >
            {formatX(activePoint.x)} / {formatY(activePoint.y)}
          </text>
        </g>

        <text
          className="scatter-axis-title"
          x={width / 2}
          y={height - 2}
          textAnchor="middle"
        >
          {xLabel}
        </text>
        <text
          className="scatter-axis-title"
          x={18}
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90 18 ${height / 2})`}
        >
          {yLabel}
        </text>
      </svg>
    </div>
  );
}
