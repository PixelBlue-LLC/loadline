import { describe, expect, it } from 'vitest';
import {
  attributionFacts,
  attributionFallback,
  attributionPrompt,
  buildPortfolio,
  computeConcentration,
  headline,
  sectorLabels,
  subline,
  tomorrowWatch,
  violatesAdvicePolicy,
  type Quote,
  type SectorPerf,
} from '../src';

// 一个全跌日的虚构组合（只用来测结论措辞）
const q = (symbol: string, price: number, changePct: number): Quote => ({ symbol, price, changePct, asOf: '2026-11-05T21:00:00Z' });
const view = buildPortfolio(
  [
    { symbol: 'NVDA', qty: 25, costBasis: 150 },
    { symbol: 'MU', qty: 3, costBasis: 900 },
    { symbol: 'SPCX', qty: 8, costBasis: 120 },
  ],
  { NVDA: q('NVDA', 183.88, -8.12), MU: q('MU', 683.41, -14.06), SPCX: q('SPCX', 126.7, -6.78) },
  1000,
);
const sectors: SectorPerf[] = [
  { symbol: 'XLP', name: '必需消费', changePct: -1.1 },
  { symbol: 'SOXX', name: '半导体', changePct: -10.76 },
  { symbol: 'XLK', name: '科技', changePct: -7.26 },
];

describe('今天页的结论', () => {
  it('全跌日的结论和标签', () => {
    expect(headline(view, sectors)).toMatch(/^半导体领跌全市场，组合今天 −/);
    expect(sectorLabels(sectors)).toMatchObject({ strong: '相对抗跌', weak: '领跌' });
    expect(sectorLabels([{ symbol: 'A', name: 'a', changePct: 1 }, { symbol: 'B', name: 'b', changePct: -2 }]).strong).toBe('强势');
  });
  it('补充句说清亏损来自谁', () => {
    expect(subline(view)).toMatch(/^亏损的 \d+% 来自 NVDA、MU/);
  });
  it('没有持仓时提示录入', () => {
    expect(headline(buildPortfolio([], {}, 0), [])).toContain('录入持仓');
  });
});

describe('归因', () => {
  it('喂给 AI 的事实包含每只持仓', () => {
    const facts = attributionFacts(view, sectors);
    for (const p of view.positions) expect(facts).toContain(p.symbol);
    expect(attributionPrompt(facts)).toContain('不要让用户补充数据');
  });
  it('无 AI 的兜底只陈述数据', () => {
    const lines = attributionFallback(view, sectors);
    expect(lines[0]).toMatch(/^主要拖累：/);
    expect(lines.join()).not.toMatch(/财报超预期/);
  });
});

describe('明日关注', () => {
  it('由当天数据派生，包含近期财报', () => {
    const items = tomorrowWatch({
      view,
      sectors,
      concentration: computeConcentration(view),
      earnings: { MU: '2026-11-08', ZZZZ: '2026-11-06' },
      today: new Date('2026-11-05T12:00:00Z'),
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(items.some((t) => t.startsWith('MU 财报 11-08（3 天后）'))).toBe(true);
    expect(items.some((t) => t.includes('ZZZZ'))).toBe(false);
  });
});

describe('AI 输出检查', () => {
  it.each(['建议买入 NVDA', '这是一个买入信号', '可以考虑减仓 MU', '目标价 250', 'strong buy signal'])('拦截：%s', (t) => {
    expect(violatesAdvicePolicy(t)).toBe(true);
  });
  it.each(['半导体主题亏损占 80%', 'NVDA 今天下跌 8.12%', '新闻里没有明确原因'])('放行：%s', (t) => {
    expect(violatesAdvicePolicy(t)).toBe(false);
  });
});
