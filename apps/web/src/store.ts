import { useSyncExternalStore } from 'react';
import { DEFAULT_RULES, type ConcentrationRule, type Holding, type NewsItem, type Quote, type SectorPerf } from 'loadline-core';

export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  finnhubKey: string;
  anthropicKey: string;
  aiModel: string;
  theme: ThemePref;
  /** us = 绿涨红跌，cn = 红涨绿跌 */
  colorConvention: 'us' | 'cn';
  rules: ConcentrationRule[];
}

export interface MarketCache {
  quotes: Record<string, Quote>;
  sectors: SectorPerf[];
  news: NewsItem[];
  /** 代码 → YYYY-MM-DD */
  earnings: Record<string, string>;
  fetchedAt?: string;
  errors: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface AppState {
  holdings: Holding[];
  cash: number;
  settings: Settings;
  market: MarketCache;
  checklist: Record<string, string>;
  attribution?: { text: string; at: string };
  chat: ChatMessage[];
  /** 正在刷新行情 */
  loading: boolean;
}

const KEY = 'loadline:v1';

export const DEFAULT_SETTINGS: Settings = {
  finnhubKey: '',
  anthropicKey: '',
  aiModel: 'claude-haiku-4-5',
  theme: 'system',
  colorConvention: 'us',
  rules: DEFAULT_RULES,
};

const EMPTY_MARKET: MarketCache = { quotes: {}, sectors: [], news: [], earnings: {}, errors: [] };

function load(): AppState {
  const base: AppState = { holdings: [], cash: 0, settings: DEFAULT_SETTINGS, market: EMPTY_MARKET, checklist: {}, chat: [], loading: false };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<AppState>;
    return {
      ...base,
      ...saved,
      settings: { ...DEFAULT_SETTINGS, ...saved.settings },
      market: { ...EMPTY_MARKET, ...saved.market },
      loading: false,
    };
  } catch {
    return base;
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    const { loading: _loading, ...rest } = state;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    // 隐私模式或存储已满时不影响使用，只是刷新后不保留
  }
}

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  persist();
  for (const l of listeners) l();
}

export function updateSettings(patch: Partial<Settings>) {
  setState((s) => ({ settings: { ...s.settings, ...patch } }));
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

/** 导出备份：持仓、现金、设置（可选是否带 key） */
export function exportBackup(includeKeys: boolean): string {
  const { holdings, cash, settings, checklist } = state;
  const s = includeKeys ? settings : { ...settings, finnhubKey: '', anthropicKey: '' };
  return JSON.stringify({ app: 'loadline', version: 1, exportedAt: new Date().toISOString(), holdings, cash, settings: s, checklist }, null, 2);
}

export function importBackup(text: string): void {
  const data = JSON.parse(text) as Partial<AppState> & { app?: string };
  if (data.app !== 'loadline' || !Array.isArray(data.holdings)) throw new Error('不是有效的备份文件');
  setState((s) => ({
    holdings: data.holdings ?? [],
    cash: typeof data.cash === 'number' ? data.cash : 0,
    settings: { ...s.settings, ...data.settings, finnhubKey: data.settings?.finnhubKey || s.settings.finnhubKey, anthropicKey: data.settings?.anthropicKey || s.settings.anthropicKey },
    checklist: data.checklist ?? {},
    market: EMPTY_MARKET,
    attribution: undefined,
  }));
}

export function clearAll() {
  localStorage.removeItem(KEY);
  state = load();
  for (const l of listeners) l();
}

/** 示例持仓：虚构数据，方便第一次打开时看效果 */
export const SAMPLE: { holdings: Holding[]; cash: number } = {
  holdings: [
    { symbol: 'NVDA', qty: 30, costBasis: 92, manualPrice: 184 },
    { symbol: 'AAPL', qty: 20, costBasis: 150, manualPrice: 228 },
    { symbol: 'MSFT', qty: 8, costBasis: 320, manualPrice: 415 },
    { symbol: 'VOO', qty: 6, costBasis: 410, manualPrice: 560 },
    { symbol: 'JNJ', qty: 15, costBasis: 158, manualPrice: 151 },
  ],
  cash: 1800,
};
