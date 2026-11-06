import { useRef, useState } from 'react';
import { mergeHoldings, parseHoldingsCsv, parseHoldingsText, type Holding } from 'loadline-core';
import type { Derived } from '../derived';
import { num, signedPct, usd } from '../format';
import { setState, type AppState } from '../store';
import { Card, ConcRow, Money, Pct } from '../ui';

const PALETTE = ['var(--accent)', 'color-mix(in srgb, var(--accent) 65%, var(--card))', 'var(--warn)', 'color-mix(in srgb, var(--muted) 80%, var(--card))', 'color-mix(in srgb, var(--muted) 50%, var(--card))', 'color-mix(in srgb, var(--muted) 30%, var(--card))'];

export function Holdings({ s, d }: { s: AppState; d: Derived }) {
  const { view } = d;
  if (!view.positions.length) return <HoldingsEditor s={s} />;
  const alloc = [...view.positions.slice(0, 5).map((p) => ({ label: p.symbol, w: p.weight }))];
  const others = view.positions.slice(5).reduce((sum, p) => sum + p.weight, 0);
  if (others > 0) alloc.push({ label: '其他', w: Math.round(others * 10) / 10 });
  if (view.cash > 0) alloc.push({ label: '现金', w: Math.round((view.cash / view.totalValue) * 1000) / 10 });
  const overN = d.over.length;

  return (
    <>
      <header className="page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="title">持仓</span>
          <span className="label">{view.positions.length} 只 · 价格来源：{d.hasQuotes ? '行情' : '手动填写'}</span>
        </div>
        <a className="btn" href="#/holdings/edit">
          编辑
        </a>
      </header>

      <Card>
        <div className="tiles" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="label">总市值</span>
            <span className="mid" style={{ fontSize: 19 }}>{usd(view.totalValue)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="label">今日</span>
            <span className="mid" style={{ fontSize: 19 }}><Money v={view.dayPnl} /></span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="label">累计</span>
            <span className="mid" style={{ fontSize: 19 }}><Money v={view.totalPnl} /></span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="label">仓位分布</span>
          <div className="stack" style={{ height: 12 }} aria-hidden="true">
            {alloc.map((a, i) => (
              <div key={a.label} style={{ flex: a.w, background: PALETTE[i % PALETTE.length] }} />
            ))}
          </div>
          <div className="legend">
            {alloc.map((a, i) => (
              <span key={a.label}>
                <i style={{ background: PALETTE[i % PALETTE.length] }} />
                {a.label} {a.w}%
              </span>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid2">
        <div className="col">
          {view.positions.map((p) => {
            const range = p.high52 && p.low52 && p.high52 > p.low52 ? ((p.price - p.low52) / (p.high52 - p.low52)) * 100 : null;
            return (
              <Card key={p.symbol}>
                <div className="card-head" style={{ alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 17, fontWeight: 700 }}>{p.symbol}</span>
                    <span className="label">
                      {p.theme} · 仓位 {p.weight}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 17, fontWeight: 700 }}>${num(p.price)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {p.dayPct != null ? <>今日 <Pct v={p.dayPct} /></> : <span className="muted">{p.priceSource === 'manual' ? '手动价格' : '暂用成本价'}</span>}
                    </span>
                  </div>
                </div>
                <div className="tiles" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', fontSize: 13 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="label">成本</span>
                    <span>${num(p.costBasis)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="label">市值</span>
                    <span>{usd(p.marketValue)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="label">累计</span>
                    <span style={{ fontWeight: 600 }}>
                      <Money v={p.totalPnl} />
                      {p.totalPct != null ? <span className={p.totalPnl < 0 ? 'neg' : 'pos'}> · {signedPct(p.totalPct, 1)}</span> : null}
                    </span>
                  </div>
                </div>
                {range != null ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div className="bar" style={{ height: 4 }} role="img" aria-label={`52 周区间位置 ${Math.round(range)}%`}>
                      <b style={{ left: `calc(${Math.max(0, Math.min(100, range))}% - 6px)`, top: -4, width: 12, height: 12, borderRadius: 6 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }} className="muted">
                      <span>52 周低 {num(p.low52!)}</span>
                      <span>高 {num(p.high52!)}</span>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
        <div className="col">
          <Card>
            <div className="card-head">
              <h2>集中度</h2>
              <span className="label" style={{ color: overN ? 'var(--warn-text)' : undefined, fontWeight: 600 }}>
                {overN} 项超标 · {d.concentration.length - overN} 项正常
              </span>
            </div>
            {d.concentration.map((c) => (
              <ConcRow key={c.type + c.label} c={c} />
            ))}
            <span className="label">阈值可以在设置里改。</span>
          </Card>
        </div>
      </div>
    </>
  );
}

type Row = { symbol: string; qty: string; cost: string; price: string; theme: string };
const toRow = (h: Holding): Row => ({ symbol: h.symbol, qty: String(h.qty), cost: String(h.costBasis || ''), price: h.manualPrice ? String(h.manualPrice) : '', theme: h.theme ?? '' });

export function HoldingsEditor({ s }: { s: AppState }) {
  const [rows, setRows] = useState<Row[]>(() => (s.holdings.length ? s.holdings.map(toRow) : [{ symbol: '', qty: '', cost: '', price: '', theme: '' }]));
  const [cash, setCash] = useState(s.cash ? String(s.cash) : '');
  const [paste, setPaste] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const setCell = (i: number, k: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const rowsToHoldings = (rs: Row[]): Holding[] =>
    rs
      .filter((r) => r.symbol.trim() && Number(r.qty) > 0)
      .map((r) => ({
        symbol: r.symbol.trim().toUpperCase(),
        qty: Number(r.qty),
        costBasis: Number(r.cost) || 0,
        ...(Number(r.price) > 0 ? { manualPrice: Number(r.price) } : {}),
        ...(r.theme.trim() ? { theme: r.theme.trim() } : {}),
      }));

  const applyImport = (incoming: Holding[], importedCash?: number, skipped: string[] = []) => {
    const merged = mergeHoldings(rowsToHoldings(rows), incoming);
    setRows(merged.map(toRow));
    if (importedCash != null) setCash(String(importedCash));
    setMsg(`导入 ${incoming.length} 条${skipped.length ? `，跳过 ${skipped.length} 行：${skipped.slice(0, 3).join('、')}${skipped.length > 3 ? '…' : ''}` : ''}。确认无误后点「保存」。`);
  };

  const save = () => {
    setState({ holdings: rowsToHoldings(rows), cash: Number(cash) || 0, attribution: undefined });
    location.hash = '#/';
  };

  return (
    <>
      <header className="page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="title">录入持仓</span>
          <span className="label">只存在这个浏览器里。成本填每股均价。</span>
        </div>
        <button className="btn primary" onClick={save}>
          保存
        </button>
      </header>

      <Card>
        <div className="edit-list">
          <div className="edit-row edit-head">
            <span>代码</span>
            <span>数量</span>
            <span>每股成本</span>
            <span>现价（可选）</span>
            <span>主题（可选）</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div className="edit-row" key={i}>
              <label className="cell"><span className="cell-label">代码</span><input className="input" value={r.symbol} placeholder="AAPL" onChange={(e) => setCell(i, 'symbol', e.target.value)} /></label>
              <label className="cell"><span className="cell-label">数量</span><input className="input" inputMode="decimal" value={r.qty} placeholder="10" onChange={(e) => setCell(i, 'qty', e.target.value)} /></label>
              <label className="cell"><span className="cell-label">每股成本</span><input className="input" inputMode="decimal" value={r.cost} placeholder="150" onChange={(e) => setCell(i, 'cost', e.target.value)} /></label>
              <label className="cell"><span className="cell-label">现价（可选）</span><input className="input" inputMode="decimal" value={r.price} placeholder="有行情可不填" onChange={(e) => setCell(i, 'price', e.target.value)} /></label>
              <label className="cell"><span className="cell-label">主题（可选）</span><input className="input" value={r.theme} placeholder="自动分类" onChange={(e) => setCell(i, 'theme', e.target.value)} /></label>
              <button className="btn icon small del" aria-label={`删除 ${r.symbol || '这一行'}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="row">
          <button className="btn small" onClick={() => setRows((rs) => [...rs, { symbol: '', qty: '', cost: '', price: '', theme: '' }])}>
            加一行
          </button>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <span>现金 $</span>
            <input className="input" style={{ width: 140 }} inputMode="decimal" value={cash} placeholder="0" onChange={(e) => setCash(e.target.value)} />
          </label>
        </div>
      </Card>

      <div className="grid2">
        <Card>
          <h2>从券商导入 CSV</h2>
          <p className="body" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            在券商网站导出持仓（Positions）CSV。会自动识别代码、数量、成本和现金行，同一代码以导入的为准。
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const r = parseHoldingsCsv(await f.text());
              if (!r.holdings.length) setMsg(r.skipped[0] ?? '没有识别到持仓');
              else applyImport(r.holdings, r.cash, r.skipped);
              e.target.value = '';
            }}
          />
          <button className="btn" onClick={() => fileRef.current?.click()}>
            选择 CSV 文件
          </button>
        </Card>
        <Card>
          <h2>粘贴文本</h2>
          <label className="field">
            <span>每行：代码 数量 每股成本</span>
            <textarea className="input" value={paste} placeholder={'NVDA 30 92\nAAPL 20 150'} onChange={(e) => setPaste(e.target.value)} />
          </label>
          <button
            className="btn"
            disabled={!paste.trim()}
            onClick={() => {
              const r = parseHoldingsText(paste);
              applyImport(r.holdings, undefined, r.skipped);
              setPaste('');
            }}
          >
            识别并加入
          </button>
        </Card>
      </div>
      {msg ? <div className="banner">{msg}</div> : null}
    </>
  );
}
