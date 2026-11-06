import { useState } from 'react';
import { attributionFallback } from 'loadline-core';
import { refreshMarket, runAttribution } from '../actions';
import type { Derived } from '../derived';
import { ageMinutes, signedPct, signedUsd, timeLabel, usd } from '../format';
import { loadSample, type AppState } from '../store';
import { Card, ConcRow, HeatGrid, Money, Pct, Tile, tone } from '../ui';

export function Today({ s, d }: { s: AppState; d: Derived }) {
  const { view } = d;
  if (!view.positions.length) return <Welcome />;

  const losing = (view.dayPnl ?? 0) < 0;
  const movers = view.positions
    .filter((p) => p.dayPnl != null && (losing ? p.dayPnl < 0 : p.dayPnl > 0))
    .sort((a, b) => Math.abs(b.dayPnl!) - Math.abs(a.dayPnl!));
  const top3 = movers.slice(0, 3);
  const rest = movers.slice(3).reduce((sum, p) => sum + Math.abs(p.dayPnl!), 0);
  const stale = (ageMinutes(s.market.fetchedAt) ?? 0) > 24 * 60;

  return (
    <>
      <header className="page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="title">今天</span>
          <span className="label">
            {s.market.fetchedAt ? `行情 ${timeLabel(s.market.fetchedAt)} 更新` : '还没有接入行情，价格为手动填写'}
          </span>
        </div>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          {s.settings.finnhubKey ? (
            <button className="btn" onClick={() => void refreshMarket()} disabled={s.loading}>
              {s.loading ? '刷新中…' : '刷新'}
            </button>
          ) : (
            <a className="btn" href="#/settings">
              接入行情
            </a>
          )}
          <a className="btn mobile-only" href="#/settings">
            设置
          </a>
        </div>
      </header>

      {stale ? <div className="banner bad">行情是 {timeLabel(s.market.fetchedAt)} 的，已经超过一天没更新。</div> : null}
      {s.market.errors.length ? <div className="banner bad">{s.market.errors.join('；')}</div> : null}

      <section className="sec">
        <h1 className="headline">{d.headline}</h1>
        {d.subline ? <p className="lead">{d.subline}</p> : null}
      </section>

      <Card>
        <span className="label">总市值</span>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span className="big">{usd(view.totalValue, 2)}</span>
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {view.dayPnl != null ? (
              <span className={tone(view.dayPnl)}>
                今日 {signedUsd(view.dayPnl, 2)} · {signedPct((view.dayPnl / (view.totalValue - view.dayPnl)) * 100)}
              </span>
            ) : (
              <span className="muted">今日涨跌需要行情</span>
            )}
          </span>
        </div>
        {top3.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="label">今天的{losing ? '亏损' : '盈利'}来自</span>
            <div className="stack" aria-hidden="true">
              {top3.map((p, i) => (
                <div key={p.symbol} style={{ flex: Math.abs(p.dayPnl!), background: losing ? 'var(--down)' : 'var(--up)', opacity: 1 - i * 0.22 }} />
              ))}
              {rest > 0 ? <div style={{ flex: rest, background: 'var(--track)' }} /> : null}
            </div>
            <div className="legend">
              {top3.map((p) => (
                <span key={p.symbol}>
                  {p.symbol} {signedUsd(p.dayPnl!)}
                </span>
              ))}
              {rest > 0 ? <span>其他 {signedUsd(losing ? -rest : rest)}</span> : null}
            </div>
          </div>
        ) : null}
      </Card>

      <div className="tiles">
        <Tile label="风险评分" value={<>{d.risk.score}<span className="label" style={{ fontWeight: 400 }}> / 100 {d.risk.band}</span></>}>
          <div className="bar">
            <i style={{ width: `${d.risk.score}%` }} />
          </div>
        </Tile>
        <Tile label="现金" value={`${view.totalValue ? ((view.cash / view.totalValue) * 100).toFixed(1) : '0'}%`} sub={usd(view.cash)} />
        <Tile label="累计盈亏" value={<Money v={view.totalPnl} />} sub={`${view.positions.length} 只持仓`} />
        <Tile label="集中度超标" value={`${d.over.length} 项`} sub={`共 ${d.concentration.length} 条规则`} />
      </div>

      <div className="grid2">
        <div className="col">
          <Card>
            <div className="card-head">
              <h2>先看风险</h2>
              <span className="label" style={{ color: d.over.length ? 'var(--warn-text)' : undefined, fontWeight: 600 }}>
                {d.over.length ? `${d.over.length} 项超标` : '全部在阈值内'}
              </span>
            </div>
            {(d.over.length ? d.over : d.concentration.slice(0, 3)).map((c) => (
              <ConcRow key={c.type + c.label} c={c} />
            ))}
            <a href="#/holdings" style={{ fontSize: 14 }}>
              看全部持仓和规则 →
            </a>
          </Card>

          <Card>
            <div className="table">
              <div className="tr head">
                <span>持仓</span>
                <span>仓位</span>
                <span>当日</span>
                <span>今日 $</span>
              </div>
              {view.positions.map((p) => (
                <div className="tr" key={p.symbol}>
                  <span className="sym">{p.symbol}</span>
                  <span className="body">{p.weight}%</span>
                  <span style={{ fontWeight: 600 }}>
                    <Pct v={p.dayPct} />
                  </span>
                  <span>
                    <Money v={p.dayPnl} />
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="col">
          <Card>
            <h2>今天发生了什么</h2>
            <Attribution s={s} d={d} />
          </Card>

          <Card>
            <h2>明天看什么</h2>
            {d.watch.length ? (
              <ol className="list">
                {d.watch.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ol>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>接入行情后，这里会列出需要留意的变化。</p>
            )}
          </Card>

          <Card>
            <div className="card-head">
              <h2>板块{d.labels.allDown ? ' · 全部下跌' : d.labels.allUp ? ' · 全部上涨' : ''}</h2>
              <a href="#/market" style={{ fontSize: 13 }}>
                {d.newsHeld.length ? `新闻 ${d.newsHeld.length} 条 →` : '市场 →'}
              </a>
            </div>
            <HeatGrid sectors={d.sectors} />
          </Card>
        </div>
      </div>
    </>
  );
}

function Attribution({ s, d }: { s: AppState; d: Derived }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fallback = attributionFallback(d.view, d.sectors);
  if (!d.hasQuotes) return <p className="muted" style={{ margin: 0, fontSize: 14 }}>接入行情后，这里会说明今天的涨跌来自哪里。</p>;
  return (
    <>
      {s.attribution ? (
        <p className="body" style={{ margin: 0, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {s.attribution.text}
        </p>
      ) : (
        <ul className="list" style={{ fontSize: 14 }}>
          {fallback.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      {s.settings.anthropicKey ? (
        <div className="row">
          <button
            className="btn small"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr('');
              try {
                await runAttribution(d.facts);
              } catch (e) {
                setErr(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'AI 解读中…' : s.attribution ? '重新解读' : '用 AI 解读'}
          </button>
          {err ? <span className="neg" style={{ fontSize: 13 }}>{err}</span> : null}
        </div>
      ) : (
        <span className="label">
          填写 Anthropic key 后可以用 AI 解读（<a href="#/settings">设置</a>）。只解释数据，不给买卖建议。
        </span>
      )}
    </>
  );
}

function Welcome() {
  return (
    <>
      <section className="sec" style={{ paddingTop: 24 }}>
        <h1 className="headline">先录入你的持仓</h1>
        <p className="lead">
          数据只存在这个浏览器里，不会上传。录入后可以看到仓位分布、集中度和风险评分；填了行情 key 还能看当天涨跌、板块和新闻。
        </p>
      </section>
      <div className="row" style={{ padding: '0 6px' }}>
        <a className="btn primary" href="#/holdings/edit">
          录入持仓
        </a>
        <button
          className="btn"
          onClick={loadSample}
        >
          用示例数据看看
        </button>
      </div>
      <div className="notice" style={{ margin: '8px 6px 0' }}>
        这是研究工具，不是投资建议，不连接券商、不下单。示例数据是虚构的。
      </div>
    </>
  );
}
