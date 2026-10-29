"use client";

import type { StatsRange } from "@/lib/types";

type Point = { bucket: string; clicks: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function bucketLabel(iso: string, range: StatsRange): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (range === "24h") return `${String(date.getUTCHours()).padStart(2, "0")}h`;
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

type Props = {
  series: Point[];
  range: StatsRange;
  total: number;
};

export default function ClickChart({ series, range, total }: Props) {
  const width = 600;
  const height = 190;
  const pad = 24;
  const plotBottom = height - 30;
  const plotHeight = height - 44;
  const count = Math.max(series.length, 1);
  const max = Math.max(4, ...series.map((point) => point.clicks));
  const barWidth = (width - pad * 2) / count;
  const labelEvery = series.length <= 7 ? 1 : Math.ceil(series.length / 8);

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Bar chart of clicks over the selected range, ${total} clicks in this range.`}
    >
      {[0, 1, 2, 3].map((step) => {
        const y = 14 + plotHeight * (step / 3);
        return (
          <g key={step}>
            <line
              x1={pad}
              x2={width - pad}
              y1={y}
              y2={y}
              stroke="var(--line)"
              strokeOpacity="0.18"
            />
            <text x={0} y={y + 3}>
              {Math.round(max * (1 - step / 3))}
            </text>
          </g>
        );
      })}

      {series.map((point, index) => {
        const barHeight = plotHeight * (point.clicks / max);
        const x = pad + index * barWidth + barWidth * 0.15;
        const y = plotBottom - barHeight;
        const label = bucketLabel(point.bucket, range);

        return (
          <g key={point.bucket}>
            {point.clicks > 0 ? (
              <rect
                className="bar"
                x={x}
                y={y}
                width={barWidth * 0.7}
                height={Math.max(barHeight, 2)}
                rx={3}
                fill="var(--blue)"
                style={{ animationDelay: `${Math.min(index * 24, 480)}ms` }}
              >
                <title>{`${label}: ${point.clicks} click${point.clicks === 1 ? "" : "s"}`}</title>
              </rect>
            ) : null}
            {index % labelEvery === 0 ? (
              <text x={x + barWidth * 0.35} y={height - 12} textAnchor="middle">
                {label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
