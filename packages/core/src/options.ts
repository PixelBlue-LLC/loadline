/**
 * 期权量化指标和两阶段筛选，全部是纯函数。
 *
 * 口径：
 *   Realized Vol   年化 = std(日对数收益) × √252
 *   Expected Move  1σ 到期 = S × ATM_IV × √(DTE/365)
 *   Put/Call       Σput OI / Σcall OI（另有成交量版）
 *   Max Pain       使 ITM 期权总内在价值最小的行权价（某一到期）
 *   GEX (per 1%)   Σ gamma × OI × 100 × S² × 0.01，约定「全部做多 gamma」，所以为正
 *   Vol Skew       25Δ put IV − 25Δ call IV（~30 天到期）
 *   IV Rank        (IV − min) / (max − min) × 100
 */

export interface OptionContract {
  underlying: string;
  contract: string;
  /** YYYY-MM-DD */
  expiry: string;
  dte: number;
  strike: number;
  right: 'CALL' | 'PUT';
  bid: number;
  ask: number;
  mark: number;
  delta: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  /** 百分比数值，如 32.9 */
  iv: number;
  openInterest: number;
  volume: number;
  crossesEarnings?: boolean;
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// ---------- 历史价 ----------
export function realizedVol(closes: number[], window: number): number | null {
  if (closes.length < window + 1) return null;
  const rets: number[] = [];
  for (let i = closes.length - window; i < closes.length; i++) {
    const prev = closes[i - 1]!;
    const cur = closes[i]!;
    if (prev > 0 && cur > 0) rets.push(Math.log(cur / prev));
  }
  if (rets.length < 2) return null;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  return round(Math.sqrt(variance) * Math.sqrt(252) * 100);
}

// ---------- ATM / IV ----------
export const TARGET_DTE = 30;

function nearExpiry(chain: OptionContract[]): number | null {
  const dtes = chain.map((c) => c.dte).filter((d) => d >= 0);
  return dtes.length ? Math.min(...dtes) : null;
}

/** 选最接近 target 天的到期，保证跨日可比，避开周期权噪音 */
export function pickDte(chain: OptionContract[], target = TARGET_DTE): number | null {
  const dtes = [...new Set(chain.map((c) => c.dte).filter((d) => d >= 0))].sort((a, b) => a - b);
  if (!dtes.length) return null;
  return dtes.reduce((best, d) => (Math.abs(d - target) < Math.abs(best - target) ? d : best), dtes[0]!);
}

export function atmIv(chain: OptionContract[], spot: number, target = TARGET_DTE): number | null {
  const exp = pickDte(chain, target);
  if (exp == null || spot <= 0) return null;
  const near = chain.filter((c) => c.dte === exp);
  if (!near.length) return null;
  const atm = near.reduce((b, c) => (Math.abs(c.strike - spot) < Math.abs(b.strike - spot) ? c : b), near[0]!).strike;
  const ivs = near.filter((c) => c.strike === atm && c.iv).map((c) => c.iv);
  return ivs.length ? round(ivs.reduce((s, v) => s + v, 0) / ivs.length) : null;
}

export function expectedMove(spot: number, atmIvPct: number | null, dte: number): number | null {
  if (!atmIvPct || spot <= 0 || dte <= 0) return null;
  return round(spot * (atmIvPct / 100) * Math.sqrt(dte / 365));
}

// ---------- 结构 ----------
export function putCallRatio(chain: OptionContract[], by: 'oi' | 'volume' = 'oi'): number | null {
  const pick = (c: OptionContract) => (by === 'volume' ? c.volume : c.openInterest);
  const cs = chain.filter((c) => c.right === 'CALL').reduce((s, c) => s + pick(c), 0);
  const ps = chain.filter((c) => c.right === 'PUT').reduce((s, c) => s + pick(c), 0);
  return cs ? round(ps / cs, 3) : null;
}

export function maxPain(chain: OptionContract[], expiryDte?: number): number | null {
  const exp = expiryDte ?? nearExpiry(chain);
  if (exp == null) return null;
  const sub = chain.filter((c) => c.dte === exp);
  const strikes = [...new Set(sub.map((c) => c.strike))].sort((a, b) => a - b);
  if (!strikes.length) return null;
  const callOi = new Map<number, number>();
  const putOi = new Map<number, number>();
  for (const c of sub) {
    const m = c.right === 'CALL' ? callOi : putOi;
    m.set(c.strike, (m.get(c.strike) ?? 0) + c.openInterest);
  }
  let bestK: number | null = null;
  let bestVal = Infinity;
  for (const k of strikes) {
    let total = 0;
    for (const ks of strikes) {
      if (ks < k) total += (callOi.get(ks) ?? 0) * (k - ks);
      else if (ks > k) total += (putOi.get(ks) ?? 0) * (ks - k);
    }
    if (total < bestVal) {
      bestVal = total;
      bestK = k;
    }
  }
  return bestK;
}

/** 没有有效 gamma（盘后、周末）时返回 null，界面显示 —，不显示误导性的 0 */
export function gammaExposure(chain: OptionContract[], spot: number): number | null {
  if (spot <= 0 || !chain.some((c) => c.gamma)) return null;
  return Math.round(chain.reduce((s, c) => s + (c.gamma ?? 0) * c.openInterest * 100 * spot * spot * 0.01, 0));
}

export function dealerGamma(chain: OptionContract[]): number {
  return Math.round(chain.reduce((s, c) => s + (c.gamma ?? 0) * c.openInterest * 100, 0));
}

export function dealerDelta(chain: OptionContract[]): number {
  return Math.round(chain.reduce((s, c) => s + (c.delta ?? 0) * c.openInterest * 100, 0)) + 0;
}

export function volSkew(chain: OptionContract[], expiryDte?: number): number | null {
  const exp = expiryDte ?? pickDte(chain);
  if (exp == null) return null;
  const sub = chain.filter((c) => c.dte === exp && c.iv);
  const calls = sub.filter((c) => c.right === 'CALL' && c.delta);
  const puts = sub.filter((c) => c.right === 'PUT' && c.delta);
  if (!calls.length || !puts.length) return null;
  const c25 = calls.reduce((b, c) => (Math.abs(c.delta - 0.25) < Math.abs(b.delta - 0.25) ? c : b), calls[0]!);
  const p25 = puts.reduce((b, c) => (Math.abs(c.delta + 0.25) < Math.abs(b.delta + 0.25) ? c : b), puts[0]!);
  return round(p25.iv - c25.iv);
}

// ---------- IV Rank / Percentile ----------
/** 历史少于这么多天不给 IV Rank：样本太少时当天值几乎总是 0 或 100 */
export const MIN_IV_HISTORY = 30;

export function ivRank(current: number, history: number[]): number | null {
  if (history.length < MIN_IV_HISTORY) return null;
  const lo = Math.min(...history);
  const hi = Math.max(...history);
  if (hi === lo) return null;
  return round(((current - lo) / (hi - lo)) * 100, 1);
}

export function ivPercentile(current: number, history: number[]): number | null {
  if (history.length < MIN_IV_HISTORY) return null;
  return round((history.filter((v) => v < current).length / history.length) * 100, 1);
}

/** IV 比 30 日实际波动高出这么多个百分点，算「期权偏贵」 */
export const IV_RICH_GAP = 10;

// ---------- 两阶段筛选：先流动性，后 Delta ----------
export const OPTION_RULES = {
  dteMin: 21,
  dteMax: 60,
  oiMin: 500,
  oiMinCore: 1000,
  spreadMaxPct: 8,
  volumeMin: 1,
  callDelta: [0.5, 0.7] as const,
  putDelta: [-0.7, -0.5] as const,
  coreSymbols: new Set(['AAPL', 'AMZN', 'MSFT', 'META', 'GOOGL', 'SPY', 'QQQ', 'NVDA', 'V']),
};

export type Strategy = 'A' | 'B' | 'C' | 'D';
export const STRATEGY_NAMES: Record<Strategy, string> = {
  A: '财报前趋势',
  B: '跨财报（波动大）',
  C: '回调后看涨',
  D: '保护性 Put',
};

export function spreadPct(c: OptionContract): number {
  if (c.mark <= 0) return 999;
  return round(((c.ask - c.bid) / c.mark) * 100);
}

export function stage1Liquidity(c: OptionContract): { passed: boolean; reason: string } {
  const R = OPTION_RULES;
  const oiMin = R.coreSymbols.has(c.underlying) ? R.oiMinCore : R.oiMin;
  if (c.dte < R.dteMin || c.dte > R.dteMax) return { passed: false, reason: `到期 ${c.dte} 天，不在 ${R.dteMin}–${R.dteMax} 天` };
  if (c.openInterest < oiMin) return { passed: false, reason: `未平仓量 ${c.openInterest} < ${oiMin}` };
  const sp = spreadPct(c);
  if (sp > R.spreadMaxPct) return { passed: false, reason: `点差 ${sp}% > ${R.spreadMaxPct}%` };
  if (c.volume < R.volumeMin) return { passed: false, reason: '当日无成交' };
  return { passed: true, reason: '' };
}

export function deltaOk(c: OptionContract): boolean {
  const [lo, hi] = c.right === 'CALL' ? OPTION_RULES.callDelta : OPTION_RULES.putDelta;
  return c.delta >= lo && c.delta <= hi;
}

export function classifyStrategy(c: OptionContract, underlyingPrice?: number, ma50?: number): Strategy {
  if (c.right === 'PUT') return 'D';
  if (c.crossesEarnings) return 'B';
  if (underlyingPrice != null && ma50 && underlyingPrice < ma50 * 0.97) return 'C';
  return 'A';
}

export type Liquidity = '高' | '中' | '低';

export interface ScreenedOption extends OptionContract {
  spreadPct: number;
  liquidity: Liquidity;
  breakeven: number;
  /** 买一张的最大亏损（权利金 × 100） */
  maxLoss: number;
  strategy: Strategy;
  passedLiquidity: boolean;
  rejectReason: string;
}

export function enrichOption(c: OptionContract, underlyingPrice?: number, ma50?: number): ScreenedOption {
  const R = OPTION_RULES;
  const oiMin = R.coreSymbols.has(c.underlying) ? R.oiMinCore : R.oiMin;
  const sp = spreadPct(c);
  const { passed, reason } = stage1Liquidity(c);
  let liquidity: Liquidity = '低';
  if (c.openInterest >= Math.max(oiMin * 5, 5000) && sp <= 2.5 && c.volume >= 100) liquidity = '高';
  else if (c.openInterest >= oiMin && sp <= R.spreadMaxPct && c.volume >= R.volumeMin) liquidity = '中';
  return {
    ...c,
    spreadPct: sp,
    liquidity,
    breakeven: round(c.right === 'CALL' ? c.strike + c.mark : c.strike - c.mark),
    maxLoss: round(c.mark * 100),
    strategy: classifyStrategy(c, underlyingPrice, ma50),
    passedLiquidity: passed,
    rejectReason: reason,
  };
}

/** 过流动性门槛、且 Delta 在目标带内的候选 */
export function screenOptions(chain: OptionContract[], underlyingPrice?: number, ma50?: number): ScreenedOption[] {
  return chain.map((c) => enrichOption(c, underlyingPrice, ma50)).filter((e) => e.passedLiquidity && deltaOk(e));
}

export interface OptionMetrics {
  symbol: string;
  spot: number;
  atmIv: number | null;
  ivDte: number | null;
  expectedMove: number | null;
  rv30: number | null;
  putCallOi: number | null;
  maxPain: number | null;
  gex: number | null;
  volSkew: number | null;
  ivRank: number | null;
  ivHistoryDays: number;
}

export function analyzeChain(symbol: string, chain: OptionContract[], spot: number, closes: number[] = [], ivHistory: number[] = []): OptionMetrics {
  const iv = atmIv(chain, spot);
  const ivDte = pickDte(chain);
  return {
    symbol,
    spot,
    atmIv: iv,
    ivDte,
    expectedMove: ivDte != null ? expectedMove(spot, iv, ivDte) : null,
    rv30: realizedVol(closes, 30),
    putCallOi: putCallRatio(chain, 'oi'),
    maxPain: maxPain(chain),
    gex: gammaExposure(chain, spot),
    volSkew: volSkew(chain),
    ivRank: iv != null ? ivRank(iv, ivHistory) : null,
    ivHistoryDays: ivHistory.length,
  };
}
