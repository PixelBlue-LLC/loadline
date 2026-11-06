import { useMemo } from 'react';
import {
  accountNames,
  aggregateBySymbol,
  attributionFacts,
  buildPortfolio,
  computeConcentration,
  headline,
  portfolioRisk,
  riskAlerts,
  sectorLabels,
  sortedSectors,
  subline,
  tomorrowWatch,
  totalCash,
  accountOf,
} from 'loadline-core';
import type { AppState } from './store';

/** 从状态算出各页要用的数据。全部来自 core 的纯函数。 */
export function useDerived(s: AppState) {
  return useMemo(() => {
    const ind = s.market.industries ?? {};
    // 风险和集中度永远按跨账户合并后的真实仓位算
    const view = buildPortfolio(aggregateBySymbol(s.holdings), s.market.quotes, totalCash(s.cashByAccount), ind);
    const accounts = accountNames(s.holdings, s.cashByAccount);
    const byAccount = accounts.map((name) => ({
      name,
      view: buildPortfolio(s.holdings.filter((h) => accountOf(h) === name), s.market.quotes, s.cashByAccount[name] ?? 0, ind),
    }));
    const concentration = computeConcentration(view, s.settings.rules);
    const held = new Set(view.positions.map((p) => p.symbol));
    const today = new Date();
    const earningsSoon = Object.entries(s.market.earnings).some(([sym, d]) => held.has(sym) && Date.parse(d) - today.getTime() < 14 * 864e5);
    const risk = portfolioRisk(view, { earningsSoon });
    const sectors = sortedSectors(s.market.sectors);
    return {
      view,
      accounts,
      byAccount,
      concentration,
      over: concentration.filter((c) => c.over),
      risk,
      alerts: riskAlerts(view, s.settings.rules),
      sectors,
      labels: sectorLabels(sectors),
      headline: headline(view, sectors),
      subline: subline(view),
      watch: tomorrowWatch({ view, sectors, concentration, earnings: s.market.earnings }),
      facts: attributionFacts(view, sectors, s.market.news),
      newsHeld: s.market.news.filter((n) => held.has(n.symbol)),
      hasQuotes: view.positions.some((p) => p.priceSource === 'quote'),
    };
  }, [s.holdings, s.cashByAccount, s.market, s.settings.rules]);
}

export type Derived = ReturnType<typeof useDerived>;
