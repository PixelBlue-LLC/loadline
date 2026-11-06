/**
 * Finnhub 适配器：行情、52 周高低、公司新闻、财报日历。
 * 用户自己的 key，直接从浏览器调用；免费档每分钟 60 次，所以并发限制为 4 并顺序排队。
 */
import { SECTOR_ETFS, type NewsItem, type Quote, type SectorPerf } from 'loadline-core';

const BASE = 'https://finnhub.io/api/v1';

export class SourceError extends Error {}

async function get<T>(path: string, params: Record<string, string>, key: string): Promise<T> {
  const qs = new URLSearchParams({ ...params, token: key }).toString();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}?${qs}`);
  } catch {
    throw new SourceError('连不上 Finnhub（网络问题，或浏览器拦截了跨域请求）');
  }
  if (res.status === 401 || res.status === 403) throw new SourceError('Finnhub key 无效，或这个接口不在免费档里');
  if (res.status === 429) throw new SourceError('Finnhub 免费额度用完了（每分钟 60 次），稍后再刷新');
  if (!res.ok) throw new SourceError(`Finnhub 返回 ${res.status}`);
  return (await res.json()) as T;
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<Array<R | Error>> {
  const out: Array<R | Error> = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = await fn(items[idx]!);
      } catch (e) {
        out[idx] = e instanceof Error ? e : new Error(String(e));
      }
    }
  });
  await Promise.all(workers);
  return out;
}

interface FhQuote { c: number; dp: number | null; pc: number; t: number }
interface FhMetric { metric?: { '52WeekHigh'?: number; '52WeekLow'?: number } }
interface FhNews { headline: string; source: string; url: string; datetime: number; summary?: string }
interface FhEarnings { earningsCalendar?: Array<{ date: string; symbol: string }> }

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export interface MarketFetch {
  quotes: Record<string, Quote>;
  sectors: SectorPerf[];
  news: NewsItem[];
  earnings: Record<string, string>;
  errors: string[];
}

export async function fetchMarket(symbols: string[], key: string): Promise<MarketFetch> {
  const errors = new Set<string>();
  const note = (r: unknown) => {
    if (r instanceof Error) errors.add(r.message);
  };
  const uniq = [...new Set(symbols.map((s) => s.toUpperCase()))];
  const sectorSyms = Object.keys(SECTOR_ETFS);
  const allQuoteSyms = [...new Set([...uniq, ...sectorSyms])];

  const quoteRes = await pool(allQuoteSyms, 4, (s) => get<FhQuote>('/quote', { symbol: s }, key));
  const quotes: Record<string, Quote> = {};
  allQuoteSyms.forEach((s, i) => {
    const r = quoteRes[i];
    note(r);
    if (r && !(r instanceof Error) && r.c > 0) {
      quotes[s] = { symbol: s, price: r.c, changePct: r.dp, prevClose: r.pc, asOf: new Date((r.t || Date.now() / 1000) * 1000).toISOString() };
    }
  });

  const metricRes = await pool(uniq, 4, (s) => get<FhMetric>('/stock/metric', { symbol: s, metric: 'all' }, key));
  uniq.forEach((s, i) => {
    const r = metricRes[i];
    if (r && !(r instanceof Error) && quotes[s]) {
      quotes[s] = { ...quotes[s]!, high52: r.metric?.['52WeekHigh'], low52: r.metric?.['52WeekLow'] };
    }
  });

  const sectors: SectorPerf[] = sectorSyms
    .filter((s) => quotes[s]?.changePct != null)
    .map((s) => ({ symbol: s, name: SECTOR_ETFS[s]!, changePct: quotes[s]!.changePct! }));

  const to = new Date();
  const from = new Date(to.getTime() - 4 * 864e5);
  const newsRes = await pool(uniq, 4, (s) => get<FhNews[]>('/company-news', { symbol: s, from: ymd(from), to: ymd(to) }, key));
  const cutoff = from.getTime();
  const news: NewsItem[] = [];
  uniq.forEach((s, i) => {
    const r = newsRes[i];
    note(r);
    if (!r || r instanceof Error) return;
    for (const n of r.slice(0, 5)) {
      if (n.datetime * 1000 < cutoff) continue;
      news.push({ symbol: s, title: n.headline, source: n.source, url: n.url, publishedAt: new Date(n.datetime * 1000).toISOString(), summary: n.summary });
    }
  });
  news.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const earnings: Record<string, string> = {};
  try {
    const ahead = new Date(to.getTime() + 30 * 864e5);
    const r = await get<FhEarnings>('/calendar/earnings', { from: ymd(to), to: ymd(ahead) }, key);
    const held = new Set(uniq);
    for (const e of r.earningsCalendar ?? []) if (held.has(e.symbol) && !earnings[e.symbol]) earnings[e.symbol] = e.date;
  } catch (e) {
    note(e);
  }

  return { quotes, sectors, news, earnings, errors: [...errors] };
}
