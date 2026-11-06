import { attributionPrompt, askPrompt } from 'loadline-core';
import { askClaude } from './data/anthropic';
import { fetchMarket } from './data/finnhub';
import { getState, setState } from './store';

export async function refreshMarket(): Promise<void> {
  const s = getState();
  if (!s.settings.finnhubKey || s.loading) return;
  setState({ loading: true });
  try {
    const r = await fetchMarket(s.holdings.map((h) => h.symbol), s.settings.finnhubKey, s.market.industries ?? {});
    setState({
      market: { quotes: r.quotes, sectors: r.sectors, news: r.news, earnings: r.earnings, industries: { ...s.market.industries, ...r.industries }, errors: r.errors, fetchedAt: new Date().toISOString() },
      attribution: undefined,
    });
  } catch (e) {
    setState((st) => ({ market: { ...st.market, errors: [e instanceof Error ? e.message : String(e)] } }));
  } finally {
    setState({ loading: false });
  }
}

export async function runAttribution(facts: string): Promise<void> {
  const s = getState();
  const r = await askClaude(s.settings.anthropicKey, s.settings.aiModel, [{ role: 'user', content: attributionPrompt(facts) }]);
  setState({ attribution: { text: r.text, at: new Date().toISOString() } });
}

export async function sendChat(question: string, facts: string): Promise<void> {
  const s = getState();
  const history = s.chat.slice(-6);
  const nextChat = [...s.chat, { role: 'user' as const, text: question }];
  setState({ chat: nextChat });
  try {
    const messages = [
      ...history.map((m) => ({ role: m.role, content: m.text })),
      { role: 'user' as const, content: askPrompt(question, facts) },
    ];
    const r = await askClaude(s.settings.anthropicKey, s.settings.aiModel, messages);
    setState({ chat: [...nextChat, { role: 'assistant', text: r.text }] });
  } catch (e) {
    setState({ chat: [...nextChat, { role: 'assistant', text: `出错了：${e instanceof Error ? e.message : String(e)}` }] });
  }
}
