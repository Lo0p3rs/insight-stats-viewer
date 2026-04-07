"use client"

import { useEffect, useId, useState } from "react"

import { Card, CardContent } from "@/components/ui/card"

type TrendChartProps = {
  values: number[]
  labels: string[]
  formatValue?: (value: number) => string
}

type Point = {
  x: number
  y: number
  label: string
  value: number
}

function buildSmoothPath(points: Point[]) {
  if (points.length <= 1) {
    return points.length === 1 ? `M ${points[0].x} ${points[0].y}` : ""
  }

  let path = `M ${points[0].x} ${points[0].y}`

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const controlX = (current.x + next.x) / 2

    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`
  }

  return path
}

export default function TrendChart({
  values,
  labels,
  formatValue = (value) => value.toFixed(1),
}: TrendChartProps) {
  const gradientId = useId().replace(/:/g, "")
  const width = 900
  const height = 300
  const padding = { left: 48, right: 16, top: 20, bottom: 34 }
  const [activeIndex, setActiveIndex] = useState(values.length - 1)

  useEffect(() => {
    setActiveIndex(values.length > 0 ? values.length - 1 : 0)
  }, [values])

  if (!values.length) {
    return (
      <Card className="border-dashed border-border/80 bg-muted/20">
        <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-sm font-medium">No trend data available yet.</p>
          <p className="text-sm text-muted-foreground">
            Match-by-match values will appear once more results are available.
          </p>
        </CardContent>
      </Card>
    )
  }

  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const maxValue = Math.max(1, ...values) * 1.15
  const averageValue = values.reduce((sum, value) => sum + value, 0) / values.length

  const points = values.map((value, index) => {
    const x = padding.left + (index / Math.max(1, values.length - 1)) * plotWidth
    const y =
      height -
      padding.bottom -
      (value / Math.max(1, maxValue)) * plotHeight

    return {
      x,
      y,
      label: labels[index] ?? `M${index + 1}`,
      value,
    }
  })

  const linePath = buildSmoothPath(points)
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${
    height - padding.bottom
  } L ${points[0].x} ${height - padding.bottom} Z`
  const activePoint = points[Math.min(activeIndex, points.length - 1)]
  const averageY =
    height -
    padding.bottom -
    (averageValue / Math.max(1, maxValue)) * plotHeight

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4
    const tickValue = maxValue - ratio * maxValue
    return {
      value: tickValue,
      y: padding.top + ratio * plotHeight,
    }
  })

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Selected match
          </p>
          <p className="mt-2 text-sm font-medium">{activePoint.label}</p>
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Value
          </p>
          <p className="mt-2 font-mono text-base font-semibold">
            {formatValue(activePoint.value)}
          </p>
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Average
          </p>
          <p className="mt-2 font-mono text-base font-semibold">
            {formatValue(averageValue)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          className="min-w-[760px]"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Performance trend chart"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="hsla(var(--primary), 0.28)" />
              <stop offset="100%" stopColor="hsla(var(--primary), 0.02)" />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => (
            <g key={tick.y}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={tick.y}
                y2={tick.y}
                stroke="hsl(var(--border))"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={tick.y + 4}
                textAnchor="end"
                fill="hsl(var(--muted-foreground))"
                fontSize="11"
              >
                {formatValue(tick.value)}
              </text>
            </g>
          ))}

          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={averageY}
            y2={averageY}
            stroke="hsla(var(--primary), 0.45)"
            strokeWidth="1.5"
            strokeDasharray="5 5"
          />

          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path
            d={linePath}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point, index) => (
            <g key={`${point.label}-${point.value}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={index === activeIndex ? 6 : 4.5}
                fill="hsl(var(--primary))"
                stroke="hsl(var(--background))"
                strokeWidth="2"
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
              />
              {index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2) ? (
                <text
                  x={point.x}
                  y={height - 10}
                  textAnchor={
                    index === 0
                      ? "start"
                      : index === points.length - 1
                        ? "end"
                        : "middle"
                  }
                  fill="hsl(var(--muted-foreground))"
                  fontSize="11"
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          ))}

          <line
            x1={activePoint.x}
            x2={activePoint.x}
            y1={padding.top}
            y2={height - padding.bottom}
            stroke="hsl(var(--border))"
            strokeDasharray="5 5"
          />

          <rect
            x={Math.min(width - 150, Math.max(padding.left, activePoint.x - 65))}
            y={padding.top - 4}
            width="132"
            height="46"
            rx="10"
            fill="hsl(var(--card))"
            stroke="hsl(var(--border))"
          />
          <text
            x={Math.min(width - 138, Math.max(padding.left + 12, activePoint.x - 53))}
            y={padding.top + 13}
            fill="hsl(var(--muted-foreground))"
            fontSize="11"
          >
            {activePoint.label}
          </text>
          <text
            x={Math.min(width - 138, Math.max(padding.left + 12, activePoint.x - 53))}
            y={padding.top + 31}
            fill="hsl(var(--foreground))"
            fontSize="14"
            fontWeight="600"
          >
            {formatValue(activePoint.value)}
          </text>
        </svg>
      </div>
    </div>
  )
}
