import { describe, expect, it } from 'vitest';
import { mergeHoldings, parseHoldingsCsv, parseHoldingsText, parseNumber } from '../src';

describe('数字解析', () => {
  it.each([
    ['$1,234.50', 1234.5],
    ['(12.3)', -12.3],
    ['−5', -5],
    ['--', null],
    ['', null],
    ['43.1%', 43.1],
  ] as const)('%s → %s', (raw, v) => expect(parseNumber(raw)).toBe(v));
});

describe('CSV 导入', () => {
  it('Schwab 风格：标题行在前、总成本列、现金行', () => {
    const csv = [
      '"Positions for account Individual ...123 as of 06:00 PM ET, 2026/11/05"',
      '',
      '"Symbol","Description","Qty (Quantity)","Price","Mkt Val (Market Value)","Cost Basis","Gain $ (Gain/Loss $)"',
      '"NVDA","NVIDIA CORP","12.5","$183.88","$2,298.50","$2,500.00","-$201.50"',
      '"MU","MICRON TECHNOLOGY","2","$683.41","$1,366.82","$1,800.00","-$433.18"',
      '"Cash & Cash Investments","--","--","--","$1,000.00","--","--"',
      '"Account Total","--","--","--","$4,665.32","--","--"',
    ].join('\n');
    const r = parseHoldingsCsv(csv);
    expect(r.holdings.map((h) => h.symbol)).toEqual(['NVDA', 'MU']);
    expect(r.holdings[0]!.costBasis).toBeCloseTo(200, 2);
    expect(r.holdings[0]!.manualPrice).toBe(183.88);
    expect(r.cash).toBe(1000);
    expect(r.skipped).toEqual([]);
  });

  it('通用格式：均价列 + 制表符', () => {
    const r = parseHoldingsCsv('Ticker\tShares\tAverage Cost\nAAPL\t10\t150.5\nmsft\t2\t300');
    expect(r.holdings).toEqual([
      { symbol: 'AAPL', qty: 10, costBasis: 150.5 },
      { symbol: 'MSFT', qty: 2, costBasis: 300 },
    ]);
  });

  it('找不到表头时给出原因', () => {
    expect(parseHoldingsCsv('a,b\n1,2').skipped[0]).toContain('表头');
  });
});

describe('文本导入与合并', () => {
  it('每行 代码 数量 成本', () => {
    const r = parseHoldingsText('NVDA 12.5 200\nqqq, 0.5, 600\n这一行不对');
    expect(r.holdings).toHaveLength(2);
    expect(r.holdings[1]).toEqual({ symbol: 'QQQ', qty: 0.5, costBasis: 600 });
    expect(r.skipped).toEqual(['这一行不对']);
  });
  it('同代码以新导入为准', () => {
    const m = mergeHoldings([{ symbol: 'NVDA', qty: 1, costBasis: 100, theme: '自定义' }], [{ symbol: 'nvda', qty: 2, costBasis: 110 }]);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ qty: 2, costBasis: 110, theme: '自定义' });
  });
});
