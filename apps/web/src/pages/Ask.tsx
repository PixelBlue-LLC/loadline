import { useState } from 'react';
import { sendChat } from '../actions';
import type { Derived } from '../derived';
import { setState, type AppState } from '../store';
import { Empty } from '../ui';

const SUGGESTIONS = ['今天为什么跌（涨）这么多？', '我的风险主要集中在哪？', '哪只持仓离 52 周高点最远？'];

export function Ask({ s, d }: { s: AppState; d: Derived }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  if (!s.settings.anthropicKey)
    return (
      <>
      <header className="page-head">
        <span className="title">问 AI</span>
      </header>
      <Empty title="填写 Anthropic key 后可用">
        <p className="body" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
          AI 会根据你的持仓和当天数据回答问题。key 只存在这个浏览器里，请求直接发给 Anthropic，不经过其他服务器。AI 只解释数据，不给买卖建议。
        </p>
        <a className="btn" href="#/settings" style={{ alignSelf: 'flex-start' }}>
          去设置
        </a>
      </Empty>
      </>
    );

  const send = async (q: string) => {
    if (!q.trim() || busy) return;
    setBusy(true);
    setText('');
    await sendChat(q.trim(), d.facts);
    setBusy(false);
  };

  return (
    <>
      <header className="page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="title">问 AI</span>
          <span className="label">基于你的持仓和当天数据 · 只解释，不给买卖建议</span>
        </div>
        {s.chat.length ? (
          <button className="btn small" onClick={() => setState({ chat: [] })}>
            清空
          </button>
        ) : null}
      </header>

      <div className="row" style={{ padding: '0 2px' }}>
        {SUGGESTIONS.map((q) => (
          <button key={q} className="btn small" style={{ borderRadius: 22 }} onClick={() => void send(q)} disabled={busy}>
            {q}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
        {s.chat.map((m, i) => (
          <div key={i} className={`bubble ${m.role === 'user' ? 'me' : 'ai'}`}>
            {m.text}
          </div>
        ))}
        {busy ? <div className="bubble ai muted">思考中…</div> : null}
      </div>

      <form
        className="row"
        style={{ marginTop: 'auto', flexWrap: 'nowrap' }}
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <label htmlFor="ask" className="sr">
          问一个关于你的持仓的问题
        </label>
        <input id="ask" className="input" style={{ borderRadius: 22 }} value={text} placeholder="问你的持仓、板块、风险…" onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn primary" disabled={busy || !text.trim()} style={{ borderRadius: 22 }}>
          发送
        </button>
      </form>
    </>
  );
}
