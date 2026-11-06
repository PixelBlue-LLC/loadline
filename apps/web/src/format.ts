const MINUS = '−';

export function usd(v: number, digits = 0): string {
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${v < 0 ? MINUS : ''}$${s}`;
}

export function signedUsd(v: number, digits = 0): string {
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${v < 0 ? MINUS : '+'}$${s}`;
}

export function signedPct(v: number, digits = 2): string {
  return `${v < 0 ? MINUS : '+'}${Math.abs(v).toFixed(digits)}%`;
}

export function num(v: number, digits = 2): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function timeLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ageMinutes(iso?: string): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 60000;
}
