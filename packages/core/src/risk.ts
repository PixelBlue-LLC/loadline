import { computeConcentration, DEFAULT_RULES, type ConcentrationRule, type ConcentrationResult } from './concentration';
import { techExposure, themeBreakdown } from './portfolio';
import type { PortfolioView } from './types';

/** 风险评分各分项的权重，合计 100 */
export const RISK_WEIGHTS = {
  single_position: 22,
  sector: 14,
  theme: 16,
  cash: 14,
  margin: 8,
  options: 8,
  earnings: 10,
  tech_beta: 8,
} as const;

export const RISK_LIMITS = { single: 30, sector: 40, theme: 50, cashMin: 5, tech: 80 } as const;

export interface RiskInputs {
  singleMax: number;
  sectorMax: number;
  themeMax: number;
  cashPct: number;
  usesMargin: boolean;
  optionPct: number;
  earningsExposure: boolean;
  techTotal: number;
}

export type RiskBand = '低风险' | '中等风险' | '高风险' | '极高风险';

export interface RiskScore {
  score: number;
  band: RiskBand;
  components: Record<keyof typeof RISK_WEIGHTS, number>;
}

/** 相对阈值的超标程度 → 0–1：达到阈值 = 0.5，1.5 倍阈值 = 1 */
function ratioOver(pct: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.max(0, Math.min(1, pct / limit - 0.5));
}

export function riskBand(score: number): RiskBand {
  if (score <= 25) return '低风险';
  if (score <= 50) return '中等风险';
  if (score <= 75) return '高风险';
  return '极高风险';
}

export function accountScore(i: RiskInputs): RiskScore {
  const parts: Record<keyof typeof RISK_WEIGHTS, number> = {
    single_position: ratioOver(i.singleMax, RISK_LIMITS.single),
    sector: ratioOver(i.sectorMax, RISK_LIMITS.sector),
    theme: ratioOver(i.themeMax, RISK_LIMITS.theme),
    cash: i.cashPct < RISK_LIMITS.cashMin ? Math.max(0, Math.min(1, (RISK_LIMITS.cashMin - i.cashPct) / RISK_LIMITS.cashMin)) : 0,
    margin: i.usesMargin ? 1 : 0,
    options: Math.max(0, Math.min(1, i.optionPct / 30)),
    earnings: i.earningsExposure ? 1 : 0,
    tech_beta: ratioOver(i.techTotal, RISK_LIMITS.tech),
  };
  const components = {} as RiskScore['components'];
  let sum = 0;
  for (const k of Object.keys(RISK_WEIGHTS) as Array<keyof typeof RISK_WEIGHTS>) {
    components[k] = Math.round(parts[k] * RISK_WEIGHTS[k] * 100) / 100;
    sum += components[k];
  }
  const score = Math.max(0, Math.min(100, Math.round(sum)));
  return { score, band: riskBand(score), components };
}

/** 由组合直接算风险评分。earningsWithinDays：持仓里有几只在近期发财报 */
export function portfolioRisk(view: PortfolioView, opts: { earningsSoon?: boolean; usesMargin?: boolean } = {}): RiskScore {
  const top = view.positions[0];
  const themes = themeBreakdown(view);
  const themeMax = themes[0]?.weight ?? 0;
  return accountScore({
    singleMax: top && view.totalValue ? (top.marketValue / view.totalValue) * 100 : 0,
    sectorMax: themeMax,
    themeMax,
    cashPct: view.totalValue ? (view.cash / view.totalValue) * 100 : 0,
    usesMargin: opts.usesMargin ?? false,
    optionPct: 0,
    earningsExposure: opts.earningsSoon ?? false,
    techTotal: techExposure(view),
  });
}

export interface Alert {
  level: '高' | '中' | '低';
  rule: string;
  message: string;
}

export const DAY_MOVE_ALERT_PCT = 5;

/** 风险提醒：集中度超标 + 单日大波动。只陈述事实，不给操作建议。 */
export function riskAlerts(view: PortfolioView, rules: ConcentrationRule[] = DEFAULT_RULES): Alert[] {
  const out: Alert[] = [];
  const conc: ConcentrationResult[] = computeConcentration(view, rules);
  for (const c of conc) {
    if (!c.over) continue;
    const high = c.type === 'single_max' || c.type === 'theme_max' || c.type === 'tech_total';
    const name = c.subject ? `${c.label}（${c.subject}）` : c.label;
    out.push({
      level: high ? '高' : '中',
      rule: name,
      message: `当前 ${c.pct}%，${c.direction === 'below' ? '低于' : '超过'}阈值 ${c.limit}%。`,
    });
  }
  for (const p of view.positions) {
    if (p.dayPct != null && Math.abs(p.dayPct) >= DAY_MOVE_ALERT_PCT) {
      out.push({ level: '中', rule: '单日波动超过 5%', message: `${p.symbol} 今天 ${fmtSigned(p.dayPct)}%。` });
    }
  }
  const order = { 高: 0, 中: 1, 低: 2 } as const;
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

function fmtSigned(v: number): string {
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`;
}
