// 从旧版 Python 的 tests/test_rules.py 移植，数字保持一致
import { describe, expect, it } from 'vitest';
import {
  accountScore,
  buildPortfolio,
  classifyStrategy,
  computeConcentration,
  deltaOk,
  enrichOption,
  riskAlerts,
  riskBand,
  screenOptions,
  stage1Liquidity,
  type Holding,
  type OptionContract,
} from '../src';

const h = (symbol: string, mv: number, theme?: string): Holding => ({ symbol, qty: 1, costBasis: mv, manualPrice: mv, theme });

describe('集中度', () => {
  it('超过阈值的项被标出', () => {
    const view = buildPortfolio(
      [h('NVDA', 9711.52), h('MU', 6336.2), h('QQQ', 3367.44), h('TSM', 2572.32), h('AMZN', 2284.4), h('V', 1805.4), h('LLY', 1637.84)],
      {},
      886.2,
    );
    expect(view.totalValue).toBeCloseTo(28601.32, 2);
    const res = Object.fromEntries(computeConcentration(view).map((c) => [c.type + (c.type === 'top_n' ? c.label : ''), c]));
    expect(res.single_max!.pct).toBeCloseTo(34.0, 0);
    expect(res.single_max!.subject).toBe('NVDA');
    expect(res.single_max!.over).toBe(true);
    expect(res.cash_min!.pct).toBe(3.1);
    expect(res.cash_min!.over).toBe(true);
    expect(res.tech_total!.pct).toBeGreaterThan(50);
    expect(res.theme_max!.subject).toBe('半导体/AI');
  });

  it('现金高于下限不算问题', () => {
    const view = buildPortfolio([h('AAA', 9000)], {}, 1000);
    const cash = computeConcentration(view).find((c) => c.type === 'cash_min')!;
    expect(cash.pct).toBe(10);
    expect(cash.over).toBe(false);
  });

  it('风险提醒按级别排序，只陈述事实', () => {
    const view = buildPortfolio([h('NVDA', 8000), h('MU', 1500)], { NVDA: { symbol: 'NVDA', price: 8000, changePct: -8.12, asOf: '' } }, 100);
    const alerts = riskAlerts(view);
    expect(alerts[0]!.level).toBe('高');
    expect(alerts.some((a) => a.message.includes('−8.12%'))).toBe(true);
  });
});

const opt = (kw: Partial<OptionContract> = {}): OptionContract => ({
  underlying: 'AMZN',
  contract: 'AMZN 07/24 240C',
  expiry: '2026-07-24',
  dte: 22,
  strike: 240,
  right: 'CALL',
  bid: 9.7,
  ask: 9.9,
  mark: 9.8,
  delta: 0.568,
  theta: -0.174,
  iv: 32.9,
  openInterest: 3220,
  volume: 861,
  crossesEarnings: false,
  ...kw,
});

describe('期权两阶段筛选', () => {
  it.each([
    [{}, true],
    [{ dte: 15 }, false],
    [{ dte: 70 }, false],
    [{ openInterest: 300 }, false],
    [{ bid: 8.0, ask: 9.6, mark: 8.8 }, false],
    [{ volume: 0 }, false],
  ] as const)('流动性门槛 %o → %s', (kw, ok) => {
    expect(stage1Liquidity(opt(kw)).passed).toBe(ok);
  });

  it('Delta 目标带', () => {
    expect(deltaOk(opt({ delta: 0.568 }))).toBe(true);
    expect(deltaOk(opt({ delta: 0.4 }))).toBe(false);
    expect(deltaOk(opt({ delta: 0.8 }))).toBe(false);
    expect(deltaOk(opt({ right: 'PUT', delta: -0.52 }))).toBe(true);
  });

  it('策略分类', () => {
    expect(classifyStrategy(opt())).toBe('A');
    expect(classifyStrategy(opt({ crossesEarnings: true }))).toBe('B');
    expect(classifyStrategy(opt({ right: 'PUT', delta: -0.5 }))).toBe('D');
    expect(classifyStrategy(opt(), 220, 240)).toBe('C');
  });

  it('派生字段', () => {
    const e = enrichOption(opt());
    expect(e.spreadPct).toBeCloseTo(2.04, 1);
    expect(e.breakeven).toBeCloseTo(249.8, 1);
    expect(e.maxLoss).toBeCloseTo(980, 0);
    expect(e.strategy).toBe('A');
    expect(e.passedLiquidity).toBe(true);
  });

  it('完整筛选去掉低流动性', () => {
    const out = screenOptions([
      opt(),
      opt({ contract: 'META 750C', underlying: 'META', dte: 29, crossesEarnings: true, delta: 0.545, openInterest: 1860, bid: 34.2, ask: 35.1, mark: 34.65, volume: 642 }),
      opt({ contract: 'LOWOI', openInterest: 100, volume: 0 }),
    ]);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((c) => c.strategy))).toEqual(new Set(['A', 'B']));
  });
});

describe('风险评分', () => {
  it('高集中、低现金 → 偏高', () => {
    const { score } = accountScore({ singleMax: 33.9, sectorMax: 65, themeMax: 65, cashPct: 3.1, usesMargin: false, optionPct: 0, earningsExposure: true, techTotal: 84.8 });
    expect(score).toBeGreaterThanOrEqual(45);
    expect(score).toBeLessThanOrEqual(85);
    expect(['中等风险', '高风险', '极高风险']).toContain(riskBand(score));
  });

  it('分散 → 低风险', () => {
    const { score } = accountScore({ singleMax: 8, sectorMax: 15, themeMax: 20, cashPct: 25, usesMargin: false, optionPct: 0, earningsExposure: false, techTotal: 30 });
    expect(score).toBeLessThanOrEqual(25);
    expect(riskBand(score)).toBe('低风险');
  });
});
