'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/cn';

export interface WheelDomain {
  key: string;
  label: string;
  outerResult: number;
  innerExperience: number;
  importance: number;
  desiredExperience: number;
}

/**
 * The Life Map.
 *
 * Two overlaid polygons — what is happening (outer result) and what it feels like
 * (inner experience). The gap between them is the product's central insight, so the
 * chart is built to make that gap the most visible thing on the page rather than a
 * derived statistic.
 *
 * Accessibility: fully keyboard-navigable spoke by spoke, and accompanied by an
 * equivalent table so the data is never colour-only.
 */
export function LifeWheel({
  domains,
  size = 460,
  onSelect,
  selectedKey,
}: {
  domains: WheelDomain[];
  size?: number;
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
}) {
  const titleId = useId();
  const [hovered, setHovered] = useState<string | null>(null);

  if (domains.length < 3) {
    return (
      <p className="type-small text-ink-muted">
        The wheel needs at least three domains to draw. Add a couple more and it will appear.
      </p>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 58;
  const step = (Math.PI * 2) / domains.length;

  const pointAt = (index: number, value: number) => {
    // Start at 12 o'clock and go clockwise, which reads as a dial rather than a graph.
    const angle = index * step - Math.PI / 2;
    const r = (Math.max(0, Math.min(10, value)) / 10) * radius;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  };

  const polygon = (accessor: (d: WheelDomain) => number) =>
    domains
      .map((d, i) => {
        const p = pointAt(i, accessor(d));
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ');

  const active = hovered ?? selectedKey ?? null;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="max-w-full"
        style={{ width: size, height: size }}
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>
          Life map showing outer results and inner experience across {domains.length} domains
        </title>

        {/* Rings */}
        {[2, 4, 6, 8, 10].map((level) => (
          <circle
            key={level}
            cx={cx}
            cy={cy}
            r={(level / 10) * radius}
            fill="none"
            stroke="var(--line)"
            strokeWidth={level === 10 ? 1.5 : 1}
          />
        ))}

        {/* Spokes, weighted by how much the domain matters */}
        {domains.map((domain, i) => {
          const end = pointAt(i, 10);
          return (
            <line
              key={domain.key}
              x1={cx}
              y1={cy}
              x2={end.x}
              y2={end.y}
              stroke="var(--line)"
              strokeWidth={0.75 + (domain.importance / 10) * 1.75}
              opacity={active && active !== domain.key ? 0.3 : 1}
            />
          );
        })}

        {/* Desired level — the target the other two are measured against */}
        <polygon
          points={polygon((d) => d.desiredExperience)}
          fill="none"
          stroke="var(--ink-faint)"
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.6}
        />

        {/* Outer result */}
        <polygon
          points={polygon((d) => d.outerResult)}
          fill="var(--primary)"
          fillOpacity={0.14}
          stroke="var(--primary)"
          strokeWidth={2}
          className="transition-all duration-320"
        />

        {/* Inner experience */}
        <polygon
          points={polygon((d) => d.innerExperience)}
          fill="var(--protect)"
          fillOpacity={0.16}
          stroke="var(--protect)"
          strokeWidth={2}
          strokeDasharray="6 3"
          className="transition-all duration-320"
        />

        {/* Interactive vertices + labels */}
        {domains.map((domain, i) => {
          const outer = pointAt(i, domain.outerResult);
          const inner = pointAt(i, domain.innerExperience);
          const label = pointAt(i, 12.4);
          const isActive = active === domain.key;
          const divergent = domain.outerResult - domain.innerExperience >= 2;

          return (
            <g key={domain.key}>
              <circle cx={outer.x} cy={outer.y} r={isActive ? 5 : 3.5} fill="var(--primary)" />
              <circle cx={inner.x} cy={inner.y} r={isActive ? 5 : 3.5} fill="var(--protect)" />

              {/* The divergence itself, drawn as a connector */}
              {divergent && (
                <line
                  x1={outer.x}
                  y1={outer.y}
                  x2={inner.x}
                  y2={inner.y}
                  stroke="var(--watch)"
                  strokeWidth={2}
                  opacity={0.75}
                />
              )}

              <text
                x={label.x}
                y={label.y}
                textAnchor={anchorFor(label.x, cx)}
                dominantBaseline="middle"
                className={cn(
                  'text-[11px] transition-colors',
                  isActive ? 'fill-[var(--ink)] font-semibold' : 'fill-[var(--ink-muted)]',
                )}
              >
                {domain.label}
              </text>

              {/* Generous invisible hit area so the spoke is easy to target */}
              <circle
                cx={pointAt(i, 5).x}
                cy={pointAt(i, 5).y}
                r={radius / 2.4}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${domain.label}: outer result ${domain.outerResult.toFixed(1)}, inner experience ${domain.innerExperience.toFixed(1)}`}
                className="cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                onMouseEnter={() => setHovered(domain.key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(domain.key)}
                onBlur={() => setHovered(null)}
                onClick={() => onSelect?.(domain.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect?.(domain.key);
                  }
                }}
              />
            </g>
          );
        })}
      </svg>

      <Legend />

      {/* Equivalent accessible table — the data is never colour-only. */}
      <table className="sr-only">
        <caption>Life map values</caption>
        <thead>
          <tr>
            <th scope="col">Domain</th>
            <th scope="col">Outer result</th>
            <th scope="col">Inner experience</th>
            <th scope="col">Desired</th>
            <th scope="col">Importance</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>{d.outerResult.toFixed(1)}</td>
              <td>{d.innerExperience.toFixed(1)}</td>
              <td>{d.desiredExperience.toFixed(1)}</td>
              <td>{d.importance.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
      <LegendItem colour="var(--primary)" label="Outer result — what is happening" />
      <LegendItem colour="var(--protect)" label="Inner experience — what it feels like" dashed />
      <LegendItem colour="var(--watch)" label="Divergence" />
      <LegendItem colour="var(--ink-faint)" label="Desired" dashed />
    </ul>
  );
}

function LegendItem({
  colour,
  label,
  dashed,
}: {
  colour: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <li className="type-small flex items-center gap-2 text-ink-muted">
      <span
        aria-hidden="true"
        className="inline-block h-0.5 w-5 rounded-full"
        style={
          dashed
            ? { backgroundImage: `repeating-linear-gradient(90deg, ${colour} 0 4px, transparent 4px 7px)` }
            : { background: colour }
        }
      />
      {label}
    </li>
  );
}

function anchorFor(x: number, cx: number): 'start' | 'middle' | 'end' {
  if (Math.abs(x - cx) < 12) return 'middle';
  return x > cx ? 'start' : 'end';
}
