/**
 * 多券商账户：每条持仓带 account，现金按账户存。
 * - 风险和集中度永远按「同一只股票跨账户合并」算（aggregateBySymbol），这才是真实仓位。
 * - 显示可以合并，也可以按账户分开（界面决定）。
 * - 导入时：示例数据直接丢掉；已有真实持仓时由用户选「加进来」或「替换全部」，
 *   加进来时同名账户视为更新（重新导出同一个券商的 CSV），不同名账户并存。
 */
import type { Holding } from './types';

export const DEFAULT_ACCOUNT = '我的账户';

export type CashByAccount = Record<string, number>;

export function accountOf(h: Holding): string {
  return h.account?.trim() || DEFAULT_ACCOUNT;
}

/** 出现过的账户名，按首次出现顺序；包括只有现金的账户 */
export function accountNames(holdings: Holding[], cash: CashByAccount = {}): string[] {
  const out: string[] = [];
  for (const h of holdings) {
    const a = accountOf(h);
    if (!out.includes(a)) out.push(a);
  }
  for (const [a, v] of Object.entries(cash)) if (v > 0 && !out.includes(a)) out.push(a);
  return out;
}

export function totalCash(cash: CashByAccount): number {
  return Object.values(cash).reduce((s, v) => s + (v > 0 ? v : 0), 0);
}

/** 同一只股票跨账户合并成一条：数量相加，成本按数量加权，记下来自哪些账户 */
export function aggregateBySymbol(holdings: Holding[]): Holding[] {
  const map = new Map<string, Holding & { accounts: string[] }>();
  for (const h of holdings) {
    if (!h.symbol || !(h.qty > 0)) continue;
    const sym = h.symbol.toUpperCase();
    const acct = accountOf(h);
    const cur = map.get(sym);
    if (!cur) {
      map.set(sym, { ...h, symbol: sym, account: undefined, accounts: [acct] });
      continue;
    }
    const qty = cur.qty + h.qty;
    cur.costBasis = qty > 0 ? (cur.costBasis * cur.qty + h.costBasis * h.qty) / qty : 0;
    cur.qty = qty;
    cur.manualPrice = cur.manualPrice ?? h.manualPrice;
    cur.theme = cur.theme ?? h.theme;
    cur.name = cur.name ?? h.name;
    if (!cur.accounts.includes(acct)) cur.accounts.push(acct);
  }
  return [...map.values()];
}

export type ImportMode = 'add' | 'replace';

export interface ImportApplied {
  holdings: Holding[];
  cash: CashByAccount;
}

/** 把一次导入并进现有持仓。wasSample=true 时现有的是示例数据，一律丢掉。 */
export function applyImport(
  current: { holdings: Holding[]; cash: CashByAccount },
  incoming: { holdings: Holding[]; cash?: number },
  opts: { mode: ImportMode; account: string; wasSample?: boolean },
): ImportApplied {
  const account = opts.account.trim() || DEFAULT_ACCOUNT;
  const fresh = opts.wasSample || opts.mode === 'replace';
  const keep = fresh ? [] : current.holdings.filter((h) => accountOf(h) !== account);
  const cash: CashByAccount = fresh ? {} : { ...current.cash };
  if (incoming.cash != null) cash[account] = incoming.cash;
  else if (fresh) delete cash[account];
  const added = incoming.holdings.map((h) => ({ ...h, symbol: h.symbol.toUpperCase(), account }));
  return { holdings: [...keep, ...added], cash };
}
