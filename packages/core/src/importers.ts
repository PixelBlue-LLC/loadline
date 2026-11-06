/**
 * 持仓导入：券商导出的 CSV，或者每行「代码 数量 成本」的纯文本。
 * 不同券商列名不同，这里按别名找列；成本列分「每股均价」和「总成本」两种，总成本会除以数量。
 */
import type { Holding } from './types';

export interface ImportResult {
  holdings: Holding[];
  /** 识别到的现金行（如 Schwab 的 Cash & Cash Investments） */
  cash?: number;
  skipped: string[];
  /** 从文件格式猜出来的券商名，用来预填账户名 */
  broker?: string;
}

/** 按导出格式猜券商：Schwab 第一行是 "Positions for account ..."，IBKR 用 "Financial Instrument"，Fidelity 有 "Account Name" 列 */
export function detectBroker(text: string): string | undefined {
  const head = text.slice(0, 2000);
  if (/positions for (account|all-accounts)|mkt val \(market value\)/i.test(head)) return 'Schwab';
  if (/financial instrument|interactive brokers/i.test(head)) return 'IBKR';
  if (/account number\s*,\s*account name/i.test(head)) return 'Fidelity';
  if (/robinhood/i.test(head)) return 'Robinhood';
  if (/webull/i.test(head)) return 'Webull';
  return undefined;
}

const SYMBOL_KEYS = ['symbol', 'ticker', 'financial instrument', '代码', '股票代码', 'instrument'];
const QTY_KEYS = ['qty', 'quantity', 'shares', '数量', '持股数', 'position'];
const AVG_COST_KEYS = ['average cost', 'avg cost', 'average price', 'avg price', 'cost per share', 'unit cost', '均价', '成本价', '平均成本'];
const TOTAL_COST_KEYS = ['cost basis', 'total cost', '总成本', '持仓成本'];
const PRICE_KEYS = ['price', 'last price', 'last', 'current price', '现价', '最新价'];
const MV_KEYS = ['market value', 'mkt val', 'value', '市值'];

/** 解析一个金额/数字单元格："$1,234.50"、"(12.3)"、"−5" */
export function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim().replace(/[$,\s%]/g, '').replace(/[−–]/g, '-');
  if (!s || s === '--' || s.toUpperCase() === 'N/A') return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return neg ? -v : v;
}

/** 简单 CSV 拆行：支持引号包裹、引号内逗号、"" 转义；也支持制表符 */
export function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function findCol(headers: string[], keys: string[]): number {
  const norm = headers.map((h) => h.toLowerCase().replace(/\s+/g, ' ').trim());
  // 先精确匹配，再前缀/包含匹配（Schwab 是 "Qty (Quantity)"、"Mkt Val (Market Value)"）
  for (const k of keys) {
    const i = norm.indexOf(k);
    if (i >= 0) return i;
  }
  for (const k of keys) {
    const i = norm.findIndex((h) => h.startsWith(k + ' ') || h.startsWith(k + '(') || h.includes(`(${k})`));
    if (i >= 0) return i;
  }
  return -1;
}

const SYMBOL_RE = /^[A-Z][A-Z0-9.\-/]{0,9}$/;

export function parseHoldingsCsv(text: string): ImportResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const skipped: string[] = [];
  if (!lines.length) return { holdings: [], skipped };
  const delim = (lines.find((l) => l.includes('\t')) ? '\t' : ',') as string;

  // 表头不一定在第一行（Schwab 第一行是账户标题），找第一行同时含代码列和数量列的
  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cells = splitCsvLine(lines[i]!, delim);
    if (findCol(cells, SYMBOL_KEYS) >= 0 && findCol(cells, QTY_KEYS) >= 0) {
      headerIdx = i;
      headers = cells;
      break;
    }
  }
  if (headerIdx < 0) return { holdings: [], skipped: ['没找到包含「代码」和「数量」的表头'] };

  const cSym = findCol(headers, SYMBOL_KEYS);
  const cQty = findCol(headers, QTY_KEYS);
  const cAvg = findCol(headers, AVG_COST_KEYS);
  const cTotal = cAvg >= 0 ? -1 : findCol(headers, TOTAL_COST_KEYS);
  const cPrice = findCol(headers, PRICE_KEYS);
  const cMv = findCol(headers, MV_KEYS);

  const holdings: Holding[] = [];
  let cash: number | undefined;
  for (const line of lines.slice(headerIdx + 1)) {
    const cells = splitCsvLine(line, delim);
    const rawSym = (cells[cSym] ?? '').trim();
    const sym = rawSym.toUpperCase();
    if (/cash/i.test(rawSym)) {
      const mv = parseNumber(cells[cMv]);
      if (mv != null) cash = (cash ?? 0) + mv;
      continue;
    }
    const qty = parseNumber(cells[cQty]);
    if (!SYMBOL_RE.test(sym) || qty == null || qty <= 0) {
      if (rawSym && !/total/i.test(rawSym)) skipped.push(rawSym);
      continue;
    }
    let cost: number | null = null;
    if (cAvg >= 0) cost = parseNumber(cells[cAvg]);
    else if (cTotal >= 0) {
      const t = parseNumber(cells[cTotal]);
      cost = t != null ? t / qty : null;
    }
    const price = cPrice >= 0 ? parseNumber(cells[cPrice]) : null;
    holdings.push({
      symbol: sym,
      qty,
      costBasis: cost != null && cost > 0 ? Math.round(cost * 10000) / 10000 : (price ?? 0),
      ...(price != null && price > 0 ? { manualPrice: price } : {}),
    });
  }
  return { holdings, cash, skipped, broker: detectBroker(text) };
}

/** 每行「代码 数量 [每股成本]」，空格、逗号或制表符分隔 */
export function parseHoldingsText(text: string): ImportResult {
  const holdings: Holding[] = [];
  const skipped: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split(/[\s,\t]+/);
    const sym = (parts[0] ?? '').toUpperCase();
    const qty = parseNumber(parts[1]);
    const cost = parseNumber(parts[2]);
    if (!SYMBOL_RE.test(sym) || qty == null || qty <= 0) {
      skipped.push(t);
      continue;
    }
    holdings.push({ symbol: sym, qty, costBasis: cost ?? 0 });
  }
  return { holdings, skipped };
}

/** 合并：同一账户里的同一代码以新导入的为准，不同账户的同一代码各自保留 */
export function mergeHoldings(existing: Holding[], incoming: Holding[]): Holding[] {
  const k = (h: Holding) => `${h.account?.trim() ?? ''}|${h.symbol.toUpperCase()}`;
  const map = new Map(existing.map((h) => [k(h), h]));
  for (const h of incoming) {
    const sym = h.symbol.toUpperCase();
    map.set(k(h), { ...map.get(k(h)), ...h, symbol: sym });
  }
  return [...map.values()];
}
