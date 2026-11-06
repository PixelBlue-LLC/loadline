import { useMemo } from 'react';
import {
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
} from '@compass/core';
import type { AppState } from './store';

/** 从状态算出各页要用的数据。全部来自 core 的纯函数。 */
export function useDerived(s: AppState) {
  return useMemo(() => {
    const view = buildPortfolio(s.holdings, s.market.quotes, s.cash);
    const concentration = computeConcentration(view, s.settings.rules);
    const held = new Set(view.positions.map((p) => p.symbol));
    const today = new Date();
    const earningsSoon = Object.entries(s.market.earnings).some(([sym, d]) => held.has(sym) && Date.parse(d) - today.getTime() < 14 * 864e5);
    const risk = portfolioRisk(view, { earningsSoon });
    const sectors = sortedSectors(s.market.sectors);
    return {
      view,
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
  }, [s.holdings, s.cash, s.market, s.settings.rules]);
}

export type Derived = ReturnType<typeof useDerived>;
