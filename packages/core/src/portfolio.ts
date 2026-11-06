import { classify } from './classify';
import type { Holding, PortfolioView, Position, Quote } from './types';

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** 持仓 + 行情 → 每行市值、盈亏、权重。价格优先用行情，其次手动价，最后用成本价兜底。 */
export function buildPortfolio(
  holdings: Holding[],
  quotes: Record<string, Quote>,
  cash: number,
  /** 代码 → Finnhub 行业 */
  industries: Record<string, string> = {},
): PortfolioView {
  const rows = holdings
    .filter((h) => h.symbol && h.qty > 0)
    .map((h) => {
      const sym = h.symbol.toUpperCase();
      const q = quotes[sym];
      let price: number;
      let priceSource: Position['priceSource'];
      if (q && q.price > 0) {
        price = q.price;
        priceSource = 'quote';
      } else if (h.manualPrice && h.manualPrice > 0) {
        price = h.manualPrice;
        priceSource = 'manual';
      } else {
        price = h.costBasis;
        priceSource = 'cost';
      }
      const marketValue = h.qty * price;
      const cost = h.qty * h.costBasis;
      const dayPct = priceSource === 'quote' && q && q.changePct != null ? q.changePct : null;
      // 由当日涨跌幅反推昨收市值：mv / (1 + pct) 再求差
      const dayPnl = dayPct != null ? marketValue - marketValue / (1 + dayPct / 100) : null;
      const { sector, theme, isTech } = classify(sym, h.theme, industries[sym]);
      return {
        symbol: sym,
        name: h.name,
        qty: h.qty,
        costBasis: h.costBasis,
        price,
        priceSource,
        marketValue,
        dayPnl,
        dayPct,
        totalPnl: marketValue - cost,
        totalPct: cost > 0 ? ((marketValue - cost) / cost) * 100 : null,
        theme,
        sector,
        isTech,
        weight: 0,
        ...(h.accounts ? { accounts: h.accounts } : {}),
        high52: q?.high52,
        low52: q?.low52,
      } satisfies Position;
    });

  const invested = rows.reduce((s, r) => s + r.marketValue, 0);
  const totalValue = invested + Math.max(0, cash);
  for (const r of rows) r.weight = totalValue > 0 ? round((r.marketValue / totalValue) * 100, 1) : 0;
  rows.sort((a, b) => b.marketValue - a.marketValue);

  const allDay = rows.length > 0 && rows.every((r) => r.dayPnl != null);
  return {
    positions: rows,
    cash: Math.max(0, cash),
    totalValue,
    dayPnl: allDay ? rows.reduce((s, r) => s + (r.dayPnl ?? 0), 0) : null,
    totalPnl: rows.reduce((s, r) => s + r.totalPnl, 0),
  };
}

/** 按主题合计权重（%），从大到小 */
export function themeBreakdown(view: PortfolioView): Array<{ theme: string; weight: number }> {
  const by = new Map<string, number>();
  for (const p of view.positions) by.set(p.theme, (by.get(p.theme) ?? 0) + p.marketValue);
  return [...by.entries()]
    .map(([theme, mv]) => ({ theme, weight: view.totalValue ? round((mv / view.totalValue) * 100, 1) : 0 }))
    .sort((a, b) => b.weight - a.weight);
}

export function techExposure(view: PortfolioView): number {
  if (!view.totalValue) return 0;
  const mv = view.positions.filter((p) => p.isTech).reduce((s, p) => s + p.marketValue, 0);
  return round((mv / view.totalValue) * 100, 1);
}
