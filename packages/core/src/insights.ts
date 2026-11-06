/**
 * 「今天」页的结论、归因和明日关注。全部由当天数据推出来，不写死，不编造原因。
 * 这些是事实陈述和需要留意的信号，不是买卖建议。
 */
import type { ConcentrationResult } from './concentration';
import { IV_RICH_GAP, type OptionMetrics } from './options';
import type { NewsItem, PortfolioView, SectorPerf } from './types';

const money = (v: number) => `${v < 0 ? '−' : '+'}$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const pct = (v: number, d = 2) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(d)}%`;

export function themePnl(view: PortfolioView): Array<{ theme: string; pnl: number }> {
  const by = new Map<string, number>();
  for (const p of view.positions) if (p.dayPnl != null) by.set(p.theme, (by.get(p.theme) ?? 0) + p.dayPnl);
  return [...by.entries()].map(([theme, pnl]) => ({ theme, pnl })).sort((a, b) => a.pnl - b.pnl);
}

export function dayPct(view: PortfolioView): number | null {
  if (view.dayPnl == null) return null;
  const base = view.totalValue - view.dayPnl;
  return base ? (view.dayPnl / base) * 100 : null;
}

export function sortedSectors(sectors: SectorPerf[]): SectorPerf[] {
  return [...sectors].sort((a, b) => b.changePct - a.changePct);
}

/** 全部板块都跌时不叫「强势」，叫「相对抗跌」 */
export function sectorLabels(sectors: SectorPerf[]): { strong: string; weak: string; allDown: boolean; allUp: boolean } {
  const allDown = sectors.length > 0 && sectors.every((s) => s.changePct < 0);
  const allUp = sectors.length > 0 && sectors.every((s) => s.changePct > 0);
  if (allDown) return { strong: '相对抗跌', weak: '领跌', allDown, allUp };
  if (allUp) return { strong: '领涨', weak: '相对落后', allDown, allUp };
  return { strong: '强势', weak: '弱势', allDown, allUp };
}

/** 首页那一句话结论 */
export function headline(view: PortfolioView, sectors: SectorPerf[]): string {
  const d = dayPct(view);
  if (!view.positions.length) return '还没有持仓，先录入持仓再看分析。';
  if (d == null) return `组合总市值 $${Math.round(view.totalValue).toLocaleString('en-US')}，接入行情后可以看当天涨跌。`;
  const s = sortedSectors(sectors);
  const worst = s.at(-1);
  const best = s[0];
  const lead =
    sectors.length && sectorLabels(sectors).allDown && worst
      ? `${worst.name}领跌全市场，`
      : sectors.length && sectorLabels(sectors).allUp && best
        ? `${best.name}领涨全市场，`
        : '';
  return `${lead}组合今天 ${pct(d, 1)}`;
}

/** 首页结论下面的一句补充：亏损/盈利主要来自谁 */
export function subline(view: PortfolioView): string {
  if (view.dayPnl == null || !view.positions.length) return '';
  const losing = view.dayPnl < 0;
  const movers = view.positions
    .filter((p) => p.dayPnl != null && (losing ? p.dayPnl < 0 : p.dayPnl > 0))
    .sort((a, b) => Math.abs(b.dayPnl!) - Math.abs(a.dayPnl!));
  if (!movers.length) return '';
  let acc = 0;
  const names: string[] = [];
  for (const m of movers) {
    acc += Math.abs(m.dayPnl!);
    names.push(m.symbol);
    if (acc / Math.abs(view.dayPnl) >= 0.7 || names.length >= 3) break;
  }
  const share = Math.round((acc / Math.abs(view.dayPnl)) * 100);
  return `${losing ? '亏损' : '盈利'}的 ${share}% 来自 ${names.join('、')}。`;
}

/** 喂给 AI 的事实清单 */
export function attributionFacts(view: PortfolioView, sectors: SectorPerf[], news: NewsItem[] = []): string {
  const lines: string[] = [];
  const d = dayPct(view);
  if (view.dayPnl != null && d != null) lines.push(`账户当日 ${money(view.dayPnl)}（${pct(d)}），总市值 $${Math.round(view.totalValue).toLocaleString('en-US')}`);
  lines.push(
    '持仓当日：' +
      view.positions
        .map((p) => `${p.symbol}${p.dayPct != null ? ' ' + pct(p.dayPct) : ''}（${p.dayPnl != null ? money(p.dayPnl) : '无当日数据'}，仓位 ${p.weight}%，主题 ${p.theme}）`)
        .join('；'),
  );
  const tp = themePnl(view);
  if (tp.length) lines.push('按主题合计：' + tp.map((t) => `${t.theme} ${money(t.pnl)}`).join('；'));
  if (sectors.length) lines.push('板块 ETF 当日：' + sortedSectors(sectors).map((s) => `${s.name} ${s.symbol} ${pct(s.changePct)}`).join('、'));
  const held = new Set(view.positions.map((p) => p.symbol));
  const heads = news.filter((n) => held.has(n.symbol)).slice(0, 6);
  if (heads.length) lines.push('持仓相关新闻标题：' + heads.map((n) => `${n.symbol}: ${n.title}`).join('；'));
  return lines.join('\n');
}

/** 没有 AI 时的归因：只陈述数据 */
export function attributionFallback(view: PortfolioView, sectors: SectorPerf[]): string[] {
  const rows = view.positions.filter((p) => p.dayPnl != null).sort((a, b) => a.dayPnl! - b.dayPnl!);
  if (!rows.length) return [];
  const fmt = (p: (typeof rows)[number]) => `${p.symbol} ${pct(p.dayPct!)}（${money(p.dayPnl!)}）`;
  const losers = rows.filter((p) => p.dayPnl! < 0).slice(0, 3);
  const winners = rows.filter((p) => p.dayPnl! > 0).reverse().slice(0, 3);
  const out: string[] = [];
  if (losers.length) out.push(`主要拖累：${losers.map(fmt).join('、')}`);
  if (winners.length) out.push(`主要贡献：${winners.map(fmt).join('、')}`);
  const tp = themePnl(view);
  if (tp.length && view.dayPnl) {
    const t = view.dayPnl < 0 ? tp[0]! : tp.at(-1)!;
    out.push(`${t.theme} 主题合计 ${money(t.pnl)}，占当日盈亏的 ${Math.round(Math.abs(t.pnl / view.dayPnl) * 100)}%`);
  }
  const s = sortedSectors(sectors);
  if (s.length >= 2) out.push(`板块里 ${s.at(-1)!.name} ${pct(s.at(-1)!.changePct)} 最弱，${s[0]!.name} ${pct(s[0]!.changePct)} 最强`);
  return out;
}

/** 明日关注：只由当天数据派生，没有就少写 */
export function tomorrowWatch(input: {
  view: PortfolioView;
  sectors: SectorPerf[];
  concentration: ConcentrationResult[];
  earnings?: Record<string, string>;
  options?: OptionMetrics[];
  today?: Date;
  limit?: number;
}): string[] {
  const { view, sectors, concentration, earnings = {}, options = [], limit = 5 } = input;
  const today = input.today ?? new Date();
  const out: string[] = [];

  const moved = view.positions.filter((p) => p.dayPct != null);
  if (moved.length) {
    const big = moved.reduce((b, p) => (Math.abs(p.dayPct!) > Math.abs(b.dayPct!) ? p : b), moved[0]!);
    if (Math.abs(big.dayPct!) >= 3) out.push(`${big.symbol} 今天${big.dayPct! < 0 ? '大跌' : '大涨'} ${pct(big.dayPct!)}（仓位 ${big.weight}%），看明天是延续还是反转`);
  }

  const s = sortedSectors(sectors);
  if (s.length >= 2) {
    const top = s[0]!;
    const bot = s.at(-1)!;
    out.push(`板块分化 ${(top.changePct - bot.changePct).toFixed(1)} 个百分点：${bot.name} ${pct(bot.changePct)} 能否企稳`);
  }

  const held = new Set(view.positions.map((p) => p.symbol));
  const day0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const soon = Object.entries(earnings)
    .filter(([sym]) => held.has(sym))
    .map(([sym, d]) => ({ sym, d, days: Math.round((Date.parse(d) - day0) / 864e5) }))
    .filter((e) => e.days >= 0 && e.days <= 14)
    .sort((a, b) => a.days - b.days);
  for (const e of soon.slice(0, 2)) out.push(`${e.sym} 财报 ${e.d.slice(5)}（${e.days} 天后），跨过财报的期权会受 IV 回落影响`);

  const over = concentration.filter((c) => c.over && c.direction === 'above');
  if (over.length) {
    const w = over.reduce((b, c) => (c.pct - c.limit > b.pct - b.limit ? c : b), over[0]!);
    out.push(`${w.label}${w.subject ? `（${w.subject}）` : ''} ${w.pct}%，超过阈值 ${w.limit}%`);
  }

  const rich = options.filter((m) => held.has(m.symbol) && m.atmIv != null && m.rv30 != null && m.atmIv - m.rv30 >= IV_RICH_GAP);
  if (rich.length) {
    const m = rich.reduce((b, x) => (x.atmIv! - x.rv30! > b.atmIv! - b.rv30! ? x : b), rich[0]!);
    out.push(`${m.symbol} 隐含波动率 ${m.atmIv}% 比 30 日实际波动 ${m.rv30}% 高 ${Math.round(m.atmIv! - m.rv30!)} 个百分点，期权偏贵`);
  }

  const spy = options.find((m) => m.symbol === 'SPY');
  if (spy?.expectedMove && spy.spot) out.push(`SPY 期权隐含约 ${spy.ivDte} 天内波动 ±${((spy.expectedMove / spy.spot) * 100).toFixed(1)}%`);

  return out.slice(0, limit);
}
