import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACCOUNT,
  accountNames,
  aggregateBySymbol,
  applyImport,
  buildPortfolio,
  classify,
  computeConcentration,
  detectBroker,
  mergeHoldings,
  totalCash,
  type Holding,
} from '../src';

const schwab: Holding[] = [
  { symbol: 'NVDA', qty: 10, costBasis: 100, account: 'Schwab' },
  { symbol: 'MU', qty: 3, costBasis: 300, account: 'Schwab' },
];
const ibkr: Holding[] = [
  { symbol: 'NVDA', qty: 40, costBasis: 150, account: 'IBKR' },
  { symbol: 'MU', qty: 4, costBasis: 800, account: 'IBKR' },
];

describe('aggregateBySymbol', () => {
  it('同一代码跨账户合并，成本按数量加权', () => {
    const agg = aggregateBySymbol([...schwab, ...ibkr]);
    const nvda = agg.find((h) => h.symbol === 'NVDA')!;
    expect(nvda.qty).toBe(50);
    expect(nvda.costBasis).toBeCloseTo((10 * 100 + 40 * 150) / 50, 6);
    expect(nvda.accounts).toEqual(['Schwab', 'IBKR']);
    expect(agg).toHaveLength(2);
  });

  it('集中度按合并后的真实仓位算', () => {
    const quotes = { NVDA: { symbol: 'NVDA', price: 180, changePct: 1, asOf: '' }, MU: { symbol: 'MU', price: 600, changePct: 1, asOf: '' } };
    const view = buildPortfolio(aggregateBySymbol([...schwab, ...ibkr]), quotes, 2500);
    const single = computeConcentration(view).find((c) => c.type === 'single_max')!;
    expect(single.subject).toBe('NVDA');
    expect(single.pct).toBeCloseTo((50 * 180) / (50 * 180 + 7 * 600 + 2500) * 100, 0);
  });
});

describe('applyImport', () => {
  const sample = { holdings: [{ symbol: 'AAPL', qty: 20, costBasis: 150 }], cash: { [DEFAULT_ACCOUNT]: 1800 } };

  it('示例数据一律丢掉', () => {
    const r = applyImport(sample, { holdings: schwab.map(({ account, ...h }) => h), cash: 500 }, { mode: 'add', account: 'Schwab', wasSample: true });
    expect(r.holdings.map((h) => h.symbol)).toEqual(['NVDA', 'MU']);
    expect(r.holdings.every((h) => h.account === 'Schwab')).toBe(true);
    expect(r.cash).toEqual({ Schwab: 500 });
  });

  it('加进来：不同账户并存，现金各算各的', () => {
    const cur = { holdings: schwab, cash: { Schwab: 500 } };
    const r = applyImport(cur, { holdings: ibkr.map(({ account, ...h }) => h), cash: 2000 }, { mode: 'add', account: 'IBKR' });
    expect(r.holdings).toHaveLength(4);
    expect(totalCash(r.cash)).toBeCloseTo(2500, 2);
    expect(accountNames(r.holdings, r.cash)).toEqual(['Schwab', 'IBKR']);
  });

  it('加进来：同名账户视为更新这个账户', () => {
    const cur = { holdings: [...schwab, ...ibkr], cash: { Schwab: 500, IBKR: 2000 } };
    const r = applyImport(cur, { holdings: [{ symbol: 'nvda', qty: 20, costBasis: 150 }], cash: 3000 }, { mode: 'add', account: 'IBKR' });
    const ib = r.holdings.filter((h) => h.account === 'IBKR');
    expect(ib).toEqual([{ symbol: 'NVDA', qty: 20, costBasis: 150, account: 'IBKR' }]);
    expect(r.holdings.filter((h) => h.account === 'Schwab')).toHaveLength(2);
    expect(r.cash).toEqual({ Schwab: 500, IBKR: 3000 });
  });

  it('替换全部', () => {
    const cur = { holdings: [...schwab, ...ibkr], cash: { Schwab: 500, IBKR: 2000 } };
    const r = applyImport(cur, { holdings: [{ symbol: 'VOO', qty: 3, costBasis: 500 }] }, { mode: 'replace', account: 'Fidelity' });
    expect(r.holdings).toEqual([{ symbol: 'VOO', qty: 3, costBasis: 500, account: 'Fidelity' }]);
    expect(r.cash).toEqual({});
  });
});

describe('mergeHoldings', () => {
  it('不同账户的同一代码不互相覆盖', () => {
    const r = mergeHoldings(schwab, [{ symbol: 'NVDA', qty: 40, costBasis: 150, account: 'IBKR' }]);
    expect(r.filter((h) => h.symbol === 'NVDA')).toHaveLength(2);
  });
  it('同一账户同一代码以新的为准', () => {
    const r = mergeHoldings(schwab, [{ symbol: 'NVDA', qty: 20, costBasis: 130, account: 'Schwab' }]);
    expect(r.find((h) => h.symbol === 'NVDA')!.qty).toBe(20);
  });
});

describe('classify（Finnhub 行业优先）', () => {
  it('有 Finnhub 行业时用它，并翻成中文', () => {
    expect(classify('JPM', undefined, 'Banking').theme).toBe('银行');
    expect(classify('NVDA', undefined, 'Semiconductors')).toEqual({ sector: '半导体', theme: '半导体', isTech: true });
  });
  it('没翻译的行业原样显示', () => {
    expect(classify('XYZ', undefined, 'Space Exploration').theme).toBe('Space Exploration');
  });
  it('Finnhub 没给（ETF）时退回内置表', () => {
    expect(classify('VOO', undefined, '').theme).toBe('宽基指数');
    expect(classify('ZZZZ').theme).toBe('其他');
  });
  it('大型科技在 Finnhub 里是 Media/Retail，也算科技', () => {
    expect(classify('META', undefined, 'Media').isTech).toBe(true);
    expect(classify('AMZN', undefined, 'Retail').isTech).toBe(true);
    expect(classify('WMT', undefined, 'Retail').isTech).toBe(false);
  });
});

describe('detectBroker', () => {
  it('认出常见券商导出格式', () => {
    expect(detectBroker('"Positions for account Individual ...123 as of 10:00 AM ET, 2026/11/06"\n"Symbol","Qty (Quantity)"')).toBe('Schwab');
    expect(detectBroker('Financial Instrument,Position,Avg Price')).toBe('IBKR');
    expect(detectBroker('Account Number,Account Name,Symbol,Quantity')).toBe('Fidelity');
    expect(detectBroker('symbol,qty,cost')).toBeUndefined();
  });
});

import { parseHoldingsCsv } from '../src';

describe('IBKR 导出 CSV', () => {
  it('Financial Instrument 列 + 现金行', () => {
    const r = parseHoldingsCsv('Financial Instrument,Position,Avg Price,Market Value\nNVDA,40,150.00,7200\nMU,4,800.00,2400\nCash,,,2000\n');
    expect(r.holdings.map((h) => [h.symbol, h.qty, h.costBasis])).toEqual([['NVDA', 40, 150], ['MU', 4, 800]]);
    expect(r.cash).toBeCloseTo(2000, 2);
    expect(r.broker).toBe('IBKR');
  });
});
