import type { Derived } from '../derived';
import { signedPct, timeLabel } from '../format';
import type { AppState } from '../store';
import { Card, Empty } from '../ui';

export function Market({ s, d }: { s: AppState; d: Derived }) {
  if (!s.settings.finnhubKey)
    return (
      <Empty title="接入行情后可用">
        <p className="body" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
          板块涨跌和持仓新闻需要一个行情 key。Finnhub 免费档就够用（每分钟 60 次，限个人非商业使用）。
        </p>
        <a className="btn" href="#/settings" style={{ alignSelf: 'flex-start' }}>
          去设置
        </a>
      </Empty>
    );

  const sectors = d.sectors;
  const max = Math.max(...sectors.map((x) => Math.abs(x.changePct)), 1);
  const best = sectors[0];
  const worst = sectors.at(-1);
  const summary = d.labels.allDown
    ? `${sectors.length} 个板块和指数全部下跌`
    : d.labels.allUp
      ? `${sectors.length} 个板块和指数全部上涨`
      : `${sectors.filter((x) => x.changePct > 0).length} 个上涨，${sectors.filter((x) => x.changePct < 0).length} 个下跌`;

  return (
    <>
      <header className="page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="title">市场</span>
          <span className="label">{s.market.fetchedAt ? `板块 ETF 当日涨跌 · ${timeLabel(s.market.fetchedAt)}` : '还没刷新过行情'}</span>
        </div>
      </header>

      {sectors.length && best && worst ? (
        <section className="sec">
          <h1 className="headline" style={{ fontSize: 22 }}>{summary}</h1>
          <p className="lead" style={{ fontSize: 14 }}>
            最强 {best.name} {signedPct(best.changePct)}，最弱 {worst.name} {signedPct(worst.changePct)}，相差 {(best.changePct - worst.changePct).toFixed(1)} 个百分点。
          </p>
        </section>
      ) : null}

      <div className="grid2">
        <Card>
          <div className="card-head label">
            <span>{d.labels.strong}</span>
            <span>{d.labels.weak}</span>
          </div>
          {sectors.map((x) => (
            <div key={x.symbol} style={{ display: 'grid', gridTemplateColumns: '104px minmax(0, 1fr) 64px', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span className="body">
                {x.name} <span className="muted" style={{ fontSize: 11 }}>{x.symbol}</span>
              </span>
              <div className="bar" style={{ height: 8 }}>
                <i style={{ height: 8, width: `${(Math.abs(x.changePct) / max) * 100}%`, background: x.changePct < 0 ? 'var(--down)' : 'var(--up)', opacity: Math.abs(x.changePct) >= 5 ? 1 : 0.55 }} />
              </div>
              <span style={{ textAlign: 'right', fontWeight: 600 }} className={x.changePct < 0 ? 'neg' : 'pos'}>
                {signedPct(x.changePct)}
              </span>
            </div>
          ))}
          {!sectors.length ? <span className="muted" style={{ fontSize: 14 }}>点「今天」页的刷新拉取板块数据。</span> : null}
        </Card>

        <div className="col">
          <div className="card-head" style={{ padding: '0 6px' }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>持仓相关新闻</h2>
            <span className="label">最近 4 天 · 新的在前</span>
          </div>
          {d.newsHeld.length ? (
            d.newsHeld.slice(0, 20).map((n) => (
              <a key={n.url + n.symbol} href={n.url} target="_blank" rel="noreferrer" className="card tight" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="row" style={{ gap: 6, fontSize: 11 }}>
                  <span className="chip" style={{ fontWeight: 700, fontSize: 11 }}>{n.symbol}</span>
                  <span className="muted">
                    {n.source} · {timeLabel(n.publishedAt)}
                  </span>
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45 }}>{n.title}</span>
              </a>
            ))
          ) : (
            <div className="notice">最近 4 天没有持仓相关新闻，或者还没刷新过。</div>
          )}
        </div>
      </div>
    </>
  );
}
