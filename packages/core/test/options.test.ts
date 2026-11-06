// 从旧版 Python 的 tests/test_analytics.py 移植
import { describe, expect, it } from 'vitest';
import {
  atmIv,
  dealerDelta,
  dealerGamma,
  expectedMove,
  gammaExposure,
  ivPercentile,
  ivRank,
  maxPain,
  MIN_IV_HISTORY,
  pickDte,
  putCallRatio,
  realizedVol,
  volSkew,
  type OptionContract,
} from '../src';

const c = (strike: number, right: 'CALL' | 'PUT', o: Partial<OptionContract> = {}): OptionContract => ({
  underlying: 'XYZ',
  contract: `XYZ ${strike}${right[0]}`,
  expiry: '2026-07-24',
  dte: 20,
  strike,
  right,
  bid: 1,
  ask: 1.1,
  mark: 1.05,
  delta: 0.5,
  gamma: 0.01,
  theta: -0.1,
  iv: 30,
  openInterest: 1000,
  volume: 100,
  ...o,
});

describe('已实现波动率', () => {
  it('价格不变为 0', () => expect(realizedVol(Array(40).fill(100), 20)).toBe(0));
  it('点数不够返回 null', () => expect(realizedVol([100, 101, 102], 20)).toBeNull());
  it('有波动为正', () => {
    const closes = Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 100 * 1.01 ** i : 100 * 1.01 ** i * 0.99));
    expect(realizedVol(closes, 20)!).toBeGreaterThan(0);
  });
});

describe('ATM IV 和预期波动', () => {
  it('锚在约 30 天，不选周期权', () => {
    const chain = [c(100, 'CALL', { dte: 2, iv: 8 }), c(100, 'CALL', { dte: 30, iv: 20 }), c(100, 'CALL', { dte: 90, iv: 25 })];
    expect(pickDte(chain)).toBe(30);
    expect(atmIv(chain, 100)).toBe(20);
  });
  it('取最接近现价的行权价，call/put 平均', () => {
    const chain = [c(95, 'CALL', { iv: 28 }), c(100, 'CALL', { iv: 30 }), c(105, 'CALL', { iv: 32 }), c(100, 'PUT', { iv: 31 })];
    const iv = atmIv(chain, 101);
    expect(iv).toBe(30.5);
    expect(expectedMove(101, iv, 20)!).toBeCloseTo(101 * 0.305 * Math.sqrt(20 / 365), 2);
  });
});

describe('结构指标', () => {
  it('put/call', () => expect(putCallRatio([c(100, 'CALL', { openInterest: 2000 }), c(100, 'PUT', { openInterest: 1000 })])).toBe(0.5));
  it('max pain 落在中间', () => {
    const chain = [
      c(90, 'CALL', { openInterest: 5000 }), c(100, 'CALL', { openInterest: 1000 }), c(110, 'CALL', { openInterest: 100 }),
      c(90, 'PUT', { openInterest: 100 }), c(100, 'PUT', { openInterest: 1000 }), c(110, 'PUT', { openInterest: 5000 }),
    ];
    expect(maxPain(chain)).toBe(100);
  });
  it('GEX 全做多为正，dealer gamma', () => {
    const chain = [c(100, 'CALL', { gamma: 0.02 }), c(100, 'PUT', { gamma: 0.02 })];
    expect(gammaExposure(chain, 100)!).toBeGreaterThan(0);
    expect(dealerGamma(chain)).toBe(Math.round(0.02 * 1000 * 100 * 2));
  });
  it('没有 gamma 时 GEX 为 null', () => expect(gammaExposure([c(100, 'CALL', { gamma: 0 })], 100)).toBeNull());
  it('dealer delta 多空抵消', () => expect(dealerDelta([c(100, 'CALL', { delta: 0.5 }), c(100, 'PUT', { delta: -0.5 })])).toBe(0));
  it('skew：put 更贵为正', () => expect(volSkew([c(110, 'CALL', { delta: 0.25, iv: 28 }), c(90, 'PUT', { delta: -0.25, iv: 34 })])).toBe(6));
});

describe('IV Rank', () => {
  const hist = Array.from({ length: MIN_IV_HISTORY }, (_, i) => 10 + (40 * i) / (MIN_IV_HISTORY - 1));
  it('历史够了才算', () => {
    expect(ivRank(30, hist)).toBe(50);
    expect(ivPercentile(30, hist)).toBe(50);
  });
  it('历史不足返回 null，不显示误导性的 100', () => {
    expect(ivRank(30, [10, 20, 30, 40, 50])).toBeNull();
    expect(ivRank(30, [])).toBeNull();
  });
});
