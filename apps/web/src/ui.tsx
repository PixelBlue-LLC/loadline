import type { ReactNode } from 'react';
import type { ConcentrationResult, SectorPerf } from 'loadline-core';
import { signedPct, signedUsd } from './format';

export function tone(v: number | null | undefined): string {
  if (v == null || v === 0) return '';
  return v > 0 ? 'pos' : 'neg';
}

export function Money({ v, pct, digits = 0 }: { v: number | null; pct?: number | null; digits?: number }) {
  if (v == null) return <span className="muted">—</span>;
  return (
    <span className={tone(v)}>
      {signedUsd(v, digits)}
      {pct != null ? ` · ${signedPct(pct)}` : ''}
    </span>
  );
}

export function Pct({ v, digits = 2 }: { v: number | null | undefined; digits?: number }) {
  if (v == null) return <span className="muted">—</span>;
  return <span className={tone(v)}>{signedPct(v, digits)}</span>;
}

export function Card({ children, tight, className = '' }: { children: ReactNode; tight?: boolean; className?: string }) {
  return <section className={`card ${tight ? 'tight' : ''} ${className}`}>{children}</section>;
}

export function Tile({ label, value, sub, children }: { label: string; value: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <Card tight>
      <span className="label">{label}</span>
      <span className="mid">{value}</span>
      {sub ? <span className="label">{sub}</span> : null}
      {children}
    </Card>
  );
}

/** 一条集中度：数值条 + 阈值竖线 */
export function ConcRow({ c }: { c: ConcentrationResult }) {
  const name = c.subject ? `${c.label}（${c.subject}）` : c.label;
  const okColor = 'var(--ok-bar)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, gap: 8 }}>
        <span className="body">{name}</span>
        <span style={{ fontWeight: 600, color: c.over ? 'var(--warn-text)' : undefined }}>
          {c.pct}%{' '}
          <span className="muted" style={{ fontWeight: 400 }}>
            {c.direction === 'below' ? '≥' : '/'} {c.limit}%
          </span>
        </span>
      </div>
      <div className="bar" role="img" aria-label={`${name} ${c.pct}%，阈值 ${c.limit}%`}>
        <i style={{ width: `${Math.min(100, c.pct)}%`, background: c.over ? undefined : okColor }} />
        <b style={{ left: `${Math.min(100, c.limit)}%` }} />
      </div>
    </div>
  );
}

/** 板块色块：跌越多颜色越深 */
export function HeatGrid({ sectors, limit = 6 }: { sectors: SectorPerf[]; limit?: number }) {
  if (!sectors.length) return <p className="muted" style={{ margin: 0, fontSize: 14 }}>接入行情后显示板块涨跌。</p>;
  const pick = sectors.length > limit ? [...sectors.slice(0, limit / 2), ...sectors.slice(-limit / 2)] : sectors;
  const max = Math.max(...sectors.map((s) => Math.abs(s.changePct)), 1);
  return (
    <div className="heat">
      {pick.map((s) => {
        const a = 0.15 + (Math.abs(s.changePct) / max) * 0.75;
        const base = s.changePct < 0 ? 'var(--down)' : 'var(--up)';
        const strong = a > 0.55;
        return (
          <div key={s.symbol} style={{ background: `color-mix(in srgb, ${base} ${Math.round(a * 100)}%, var(--card))`, color: strong ? '#fff' : 'var(--ink)' }}>
            <span className="n">
              {s.name} {s.symbol}
            </span>
            <span className="v">{signedPct(s.changePct, 1)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card>
      <h2>{title}</h2>
      {children}
    </Card>
  );
}
