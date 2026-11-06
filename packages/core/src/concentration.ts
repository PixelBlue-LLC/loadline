import type { PortfolioView } from './types';

export type ConcentrationRule =
  | { type: 'single_max'; label: string; limit: number }
  | { type: 'top_n'; label: string; limit: number; n: number }
  | { type: 'theme_max'; label: string; limit: number }
  | { type: 'sector_max'; label: string; limit: number }
  | { type: 'tech_total'; label: string; limit: number }
  | { type: 'cash_min'; label: string; limit: number };

export interface ConcentrationResult {
  type: ConcentrationRule['type'];
  label: string;
  /** 被衡量的对象，如 NVDA、半导体/AI */
  subject?: string;
  pct: number;
  limit: number;
  /** cash_min 是「低于阈值才算问题」 */
  direction: 'above' | 'below';
  over: boolean;
}

export const DEFAULT_RULES: ConcentrationRule[] = [
  { type: 'single_max', label: '单只最大仓位', limit: 30 },
  { type: 'top_n', label: '前两大持仓', n: 2, limit: 60 },
  { type: 'top_n', label: '前三大持仓', n: 3, limit: 70 },
  { type: 'theme_max', label: '最大主题', limit: 50 },
  { type: 'tech_total', label: '科技相关合计', limit: 80 },
  { type: 'cash_min', label: '现金占比', limit: 5 },
];

const r1 = (v: number) => Math.round(v * 10) / 10;

function maxGroup(view: PortfolioView, key: 'theme' | 'sector'): { name?: string; pct: number } {
  const by = new Map<string, number>();
  for (const p of view.positions) by.set(p[key], (by.get(p[key]) ?? 0) + p.marketValue);
  let best: { name?: string; pct: number } = { pct: 0 };
  for (const [name, mv] of by) {
    const pct = view.totalValue ? (mv / view.totalValue) * 100 : 0;
    if (pct > best.pct) best = { name, pct };
  }
  return best;
}

/** 按规则逐条计算集中度。阈值和条目都由用户配置，默认值见 DEFAULT_RULES。 */
export function computeConcentration(view: PortfolioView, rules: ConcentrationRule[] = DEFAULT_RULES): ConcentrationResult[] {
  const total = view.totalValue;
  const weights = view.positions.map((p) => (total ? (p.marketValue / total) * 100 : 0)).sort((a, b) => b - a);
  const top = view.positions[0];

  return rules.map((rule): ConcentrationResult => {
    const base = { type: rule.type, label: rule.label, limit: rule.limit, direction: 'above' as const };
    switch (rule.type) {
      case 'single_max': {
        const pct = r1(weights[0] ?? 0);
        return { ...base, subject: top?.symbol, pct, over: pct > rule.limit };
      }
      case 'top_n': {
        const pct = r1(weights.slice(0, rule.n).reduce((s, w) => s + w, 0));
        return { ...base, pct, over: pct > rule.limit };
      }
      case 'theme_max':
      case 'sector_max': {
        const g = maxGroup(view, rule.type === 'theme_max' ? 'theme' : 'sector');
        const pct = r1(g.pct);
        return { ...base, subject: g.name, pct, over: pct > rule.limit };
      }
      case 'tech_total': {
        const mv = view.positions.filter((p) => p.isTech).reduce((s, p) => s + p.marketValue, 0);
        const pct = r1(total ? (mv / total) * 100 : 0);
        return { ...base, pct, over: pct > rule.limit };
      }
      case 'cash_min': {
        const pct = r1(total ? (view.cash / total) * 100 : 0);
        return { ...base, direction: 'below', pct, over: pct < rule.limit };
      }
    }
  });
}
