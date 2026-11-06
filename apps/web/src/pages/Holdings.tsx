import { useMemo, useRef, useState } from 'react';
import {
  accountNames,
  accountOf,
  applyImport,
  DEFAULT_ACCOUNT,
  mergeHoldings,
  parseHoldingsCsv,
  parseHoldingsText,
  type CashByAccount,
  type Holding,
  type ImportMode,
  type ImportResult,
  type PortfolioView,
  type Position,
} from 'loadline-core';
import { refreshMarket } from '../actions';
import type { Derived } from '../derived';
import { num, signedPct, usd } from '../format';
import { setState, updateSettings, type AppState } from '../store';
import { Card, ConcRow, Money, Pct } from '../ui';

const PALETTE = ['var(--accent)', 'color-mix(in srgb, var(--accent) 65%, var(--card))', 'var(--warn)', 'color-mix(in srgb, var(--muted) 80%, var(--card))', 'color-mix(in srgb, var(--muted) 50%, var(--card))', 'color-mix(in srgb, var(--muted) 30%, var(--card))'];

function allocation(view: PortfolioView) {
  const alloc = [...view.positions.slice(0, 5).map((p) => ({ label: p.symbol, w: p.weight }))];
  const others = view.positions.slice(5).reduce((sum, p) => sum + p.weight, 0);
  if (others > 0) alloc.push({ label: '其他', w: Math.round(others * 10) / 10 });
  if (view.cash > 0) alloc.push({ label: '现金', w: Math.round((view.cash / view.totalValue) * 1000) / 10 });
  return alloc;
}

function priceNote(p: Position): string {
  if (p.priceSource === 'quote') return '';
  return p.priceSource === 'manual' ? '导入时的价格' : '暂用成本价';
}

function PositionCard({ p, weightLabel, showAccounts }: { p: Position; weightLabel: string; showAccounts: boolean }) {
  const range = p.high52 && p.low52 && p.high52 > p.low52 ? ((p.price - p.low52) / (p.high52 - p.low52)) * 100 : null;
  return (
    <Card>
      <div className="card-head" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>{p.symbol}</span>
          <span className="label">
            {p.theme} · {weightLabel} {p.weight}%
            {showAccounts && p.accounts?.length ? ` · ${p.accounts.join(' + ')}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>${num(p.price)}</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {p.dayPct != null ? <>今日 <Pct v={p.dayPct} /></> : <span className="muted">{priceNote(p)}</span>}
          </span>
        </div>
      </div>
      <div className="tiles" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', fontSize: 13 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="label">数量 · 成本</span>
          <span>{num(p.qty)} 股 · ${num(p.costBasis)}</span>
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
}

export function Holdings({ s, d }: { s: AppState; d: Derived }) {
  const { view } = d;
  if (!view.positions.length && !view.cash) return <HoldingsEditor s={s} />;
  const alloc = allocation(view);
  const overN = d.over.length;
  const multi = d.accounts.length > 1;
  const split = multi && s.settings.accountView === 'split';

  return (
    <>
      <header className="page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="title">持仓</span>
          <span className="label">
            {view.positions.length} 只{multi ? ` · ${d.accounts.length} 个账户` : ''} · 价格来源：{d.hasQuotes ? '行情' : '未接入行情'}
          </span>
        </div>
        <a className="btn" href="#/holdings/edit">
          编辑
        </a>
      </header>

      {multi ? (
        <div className="seg" role="group" aria-label="账户显示方式" style={{ margin: '0 6px' }}>
          <button className={!split ? 'on' : ''} aria-pressed={!split} onClick={() => updateSettings({ accountView: 'merged' })}>
            合并账户
          </button>
          <button className={split ? 'on' : ''} aria-pressed={split} onClick={() => updateSettings({ accountView: 'split' })}>
            按账户分开
          </button>
        </div>
      ) : null}

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
          <span className="label">仓位分布{multi ? '（所有账户合并）' : ''}</span>
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
          {split
            ? d.byAccount.map(({ name, view: av }) => (
                <div key={name} className="col">
                  <div className="acct-head">
                    <span style={{ fontWeight: 700 }}>{name}</span>
                    <span className="label">
                      {usd(av.totalValue)} · 占总资产 {view.totalValue ? ((av.totalValue / view.totalValue) * 100).toFixed(1) : '0'}% · 现金 {usd(av.cash)}
                    </span>
                  </div>
                  {av.positions.map((p) => (
                    <PositionCard key={name + p.symbol} p={p} weightLabel="占该账户" showAccounts={false} />
                  ))}
                </div>
              ))
            : view.positions.map((p) => <PositionCard key={p.symbol} p={p} weightLabel="仓位" showAccounts={multi} />)}
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
            <span className="label">{multi ? '按所有账户合并计算（同一只股票在不同账户算一个仓位）。' : ''}阈值可以在设置里改。</span>
          </Card>
        </div>
      </div>
    </>
  );
}

// ---------------- 录入 / 导入 ----------------

/**
 * 一行持仓。成本可以按每股填，也可以按总成本填（券商导出的 Cost Basis 一般是总成本）；
 * basis 记住用户最后改的是哪一个，保存时以它为准，避免来回换算丢精度。
 */
type Row = { symbol: string; qty: string; cost: string; total: string; basis: 'cost' | 'total'; account: string; manualPrice?: number; name?: string };
const fmt2 = (v: number) => (Number.isFinite(v) && v ? String(Math.round(v * 100) / 100) : '');
const toRow = (h: Holding): Row => ({
  symbol: h.symbol,
  qty: String(h.qty),
  cost: fmt2(h.costBasis),
  total: fmt2(h.costBasis * h.qty),
  basis: 'total',
  account: accountOf(h),
  ...(h.manualPrice ? { manualPrice: h.manualPrice } : {}),
  ...(h.name ? { name: h.name } : {}),
});
const blank = (account: string): Row => ({ symbol: '', qty: '', cost: '', total: '', basis: 'cost', account });

function rowCostPerShare(r: Row): number {
  const qty = Number(r.qty);
  if (r.basis === 'total') return qty > 0 ? (Number(r.total) || 0) / qty : 0;
  return Number(r.cost) || 0;
}

function rowsToHoldings(rs: Row[]): Holding[] {
  return rs
    .filter((r) => r.symbol.trim() && Number(r.qty) > 0)
    .map((r) => ({
      symbol: r.symbol.trim().toUpperCase(),
      qty: Number(r.qty),
      costBasis: rowCostPerShare(r),
      account: r.account,
      ...(r.manualPrice ? { manualPrice: r.manualPrice } : {}),
      ...(r.name ? { name: r.name } : {}),
    }));
}

type Pending = ImportResult & { source: 'csv' | 'paste' };

export function HoldingsEditor({ s }: { s: AppState }) {
  // 示例数据不带进录入页：用户录的是自己的持仓
  const startHoldings = s.isSample ? [] : s.holdings;
  const startCash = s.isSample ? {} : s.cashByAccount;
  const startAccounts = accountNames(startHoldings, startCash);
  const [rows, setRows] = useState<Row[]>(() => startHoldings.map(toRow));
  const [cash, setCash] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(startCash).map(([a, v]) => [a, String(v)])));
  const [extraAccounts, setExtraAccounts] = useState<string[]>([]);
  const [acct, setAcct] = useState(startAccounts[0] ?? DEFAULT_ACCOUNT);
  const [paste, setPaste] = useState('');
  const [msg, setMsg] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [wasSample, setWasSample] = useState(!!s.isSample);
  const fileRef = useRef<HTMLInputElement>(null);

  const workingHoldings = rowsToHoldings(rows);
  const workingCash: CashByAccount = Object.fromEntries(Object.entries(cash).filter(([, v]) => Number(v) > 0).map(([a, v]) => [a, Number(v)]));
  const accounts = useMemo(() => {
    const names = accountNames(workingHoldings, workingCash);
    for (const a of [...extraAccounts, acct]) if (!names.includes(a)) names.push(a);
    return names;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cash, extraAccounts, acct]);

  const visible = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.account === acct);
  const setCell = (i: number, k: 'symbol' | 'qty' | 'cost' | 'total', v: string) =>
    setRows((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, [k]: v };
        const qty = Number(next.qty);
        // 改每股就算总成本，改总成本就算每股；改数量时保持用户上次填的那一个不变
        if (k === 'cost') return { ...next, basis: 'cost', total: qty > 0 ? fmt2(Number(v) * qty) : next.total };
        if (k === 'total') return { ...next, basis: 'total', cost: qty > 0 ? fmt2(Number(v) / qty) : next.cost };
        if (k === 'qty') return next.basis === 'total' ? { ...next, cost: qty > 0 ? fmt2(Number(next.total) / qty) : next.cost } : { ...next, total: fmt2(Number(next.cost) * qty) };
        return next;
      }),
    );
  const priceOf = (r: Row) => s.market.quotes[r.symbol.trim().toUpperCase()]?.price ?? r.manualPrice;
  const acctTotals = visible.reduce(
    (t, { r }) => {
      const qty = Number(r.qty) || 0;
      const p = priceOf(r);
      return { cost: t.cost + rowCostPerShare(r) * qty, mv: t.mv + (p ? p * qty : 0), missing: t.missing || (!p && qty > 0) };
    },
    { cost: 0, mv: 0, missing: false },
  );

  const addAccount = () => {
    const name = prompt('账户名（比如 Schwab、IBKR、Fidelity）')?.trim();
    if (!name) return;
    if (!accounts.includes(name)) setExtraAccounts((xs) => [...xs, name]);
    setAcct(name);
  };
  const removeAccount = () => {
    if (!confirm(`删除「${acct}」这个账户里的全部持仓和现金？`)) return;
    setRows((rs) => rs.filter((r) => r.account !== acct));
    setCash((c) => {
      const { [acct]: _gone, ...rest } = c;
      return rest;
    });
    setExtraAccounts((xs) => xs.filter((x) => x !== acct));
    const left = accounts.filter((a) => a !== acct);
    setAcct(left[0] ?? DEFAULT_ACCOUNT);
  };

  const startImport = (r: ImportResult, source: Pending['source']) => {
    if (!r.holdings.length) {
      setMsg(r.skipped[0] ?? '没有识别到持仓');
      return;
    }
    setMsg('');
    setPending({ ...r, source });
  };

  const save = () => {
    setState({ holdings: workingHoldings, cashByAccount: workingCash, attribution: undefined, isSample: false });
    location.hash = '#/';
    if (s.settings.finnhubKey) void refreshMarket();
  };

  return (
    <>
      <header className="page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="title">录入持仓</span>
          <span className="label">只存在这个浏览器里。现价和行业分类会从行情自动获取，不用填。</span>
        </div>
        <button className="btn primary" onClick={save}>
          保存
        </button>
      </header>

      {pending ? (
        <ImportDialog
          pending={pending}
          current={{ holdings: workingHoldings, cash: workingCash }}
          wasSample={wasSample}
          defaultAccount={pending.broker ?? (pending.source === 'paste' ? acct : accounts.length === 1 && !workingHoldings.length ? accounts[0]! : '')}
          accountView={s.settings.accountView}
          onCancel={() => setPending(null)}
          onConfirm={(applied, account, view) => {
            setRows(applied.holdings.map(toRow));
            setCash(Object.fromEntries(Object.entries(applied.cash).map(([a, v]) => [a, String(v)])));
            setExtraAccounts([]);
            setAcct(account);
            setWasSample(false);
            if (view) updateSettings({ accountView: view });
            const sk = pending.skipped;
            setMsg(`已导入 ${pending.holdings.length} 条到「${account}」${sk.length ? `，跳过 ${sk.length} 行：${sk.slice(0, 3).join('、')}${sk.length > 3 ? '…' : ''}` : ''}。确认无误后点「保存」。`);
            setPending(null);
          }}
        />
      ) : null}

      <Card>
        <div className="card-head">
          <div className="chips-row" role="tablist" aria-label="账户">
            {accounts.map((a) => (
              <button key={a} role="tab" aria-selected={a === acct} className={`acct-chip ${a === acct ? 'on' : ''}`} onClick={() => setAcct(a)}>
                {a}
              </button>
            ))}
            <button className="acct-chip add" onClick={addAccount}>
              + 账户
            </button>
          </div>
          {accounts.length > 1 ? (
            <button className="btn small" onClick={removeAccount}>
              删除这个账户
            </button>
          ) : null}
        </div>
        <div className="edit-list">
          <div className="edit-row edit-head">
            <span>代码</span>
            <span>数量</span>
            <span>每股成本</span>
            <span>总成本</span>
            <span>市值</span>
            <span />
          </div>
          {visible.map(({ r, i }) => (
            <div className="edit-row" key={i}>
              <label className="cell"><span className="cell-label">代码</span><input className="input" value={r.symbol} placeholder="AAPL" onChange={(e) => setCell(i, 'symbol', e.target.value)} /></label>
              <label className="cell"><span className="cell-label">数量</span><input className="input" inputMode="decimal" value={r.qty} placeholder="10" onChange={(e) => setCell(i, 'qty', e.target.value)} /></label>
              <label className="cell"><span className="cell-label">每股成本</span><input className="input" inputMode="decimal" value={r.cost} placeholder="150" onChange={(e) => setCell(i, 'cost', e.target.value)} /></label>
              <label className="cell"><span className="cell-label">总成本</span><input className="input" inputMode="decimal" value={r.total} placeholder="1500" onChange={(e) => setCell(i, 'total', e.target.value)} /></label>
              <span className="cell mv" title={r.name}>
                <span className="cell-label">市值</span>
                <span>{priceOf(r) && Number(r.qty) > 0 ? usd(priceOf(r)! * Number(r.qty), 2) : '—'}</span>
                {r.name ? <span className="cell-name">{r.name}</span> : null}
              </span>
              <button className="btn icon small del" aria-label={`删除 ${r.symbol || '这一行'}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
          {!visible.length ? <span className="label">「{acct}」还没有持仓。可以手动加，也可以在下面导入。</span> : null}
          {visible.length ? (
            <div className="edit-total">
              「{acct}」合计：总成本 {usd(acctTotals.cost, 2)} · 市值 {acctTotals.mv ? usd(acctTotals.mv, 2) : '—'}
              {acctTotals.mv ? <> · 浮动盈亏 <Money v={acctTotals.mv - acctTotals.cost} digits={2} /></> : null}
              {Number(cash[acct]) > 0 ? <> · 加现金共 {usd(acctTotals.mv + Number(cash[acct]), 2)}</> : null}
              {acctTotals.missing ? <span className="label">（部分没有价格，接入行情后补上）</span> : null}
            </div>
          ) : null}
        </div>
        <div className="row">
          <button className="btn small" onClick={() => setRows((rs) => [...rs, blank(acct)])}>
            加一行
          </button>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <span>「{acct}」现金 $</span>
            <input className="input" style={{ width: 140 }} inputMode="decimal" value={cash[acct] ?? ''} placeholder="0" onChange={(e) => setCash((c) => ({ ...c, [acct]: e.target.value }))} />
          </label>
        </div>
      </Card>

      <div className="grid2">
        <Card>
          <h2>从券商导入 CSV</h2>
          <p className="body" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            在券商网站导出持仓（Positions）CSV。会识别代码、数量、成本和现金；导入前会问你放进哪个账户、要不要保留现有持仓。
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              startImport(parseHoldingsCsv(await f.text()), 'csv');
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
              startImport(parseHoldingsText(paste), 'paste');
              setPaste('');
            }}
          >
            识别
          </button>
        </Card>
      </div>
      {msg ? <div className="banner">{msg}</div> : null}
    </>
  );
}

function ImportDialog({
  pending,
  current,
  wasSample,
  defaultAccount,
  accountView,
  onCancel,
  onConfirm,
}: {
  pending: Pending;
  current: { holdings: Holding[]; cash: CashByAccount };
  wasSample: boolean;
  defaultAccount: string;
  accountView: 'merged' | 'split';
  onCancel: () => void;
  onConfirm: (applied: { holdings: Holding[]; cash: CashByAccount }, account: string, view?: 'merged' | 'split') => void;
}) {
  const existing = accountNames(current.holdings, current.cash);
  const hasReal = !wasSample && current.holdings.length > 0;
  const [mode, setMode] = useState<ImportMode>('add');
  const [account, setAccount] = useState(defaultAccount);
  const [view, setView] = useState(accountView);
  const name = account.trim();

  const preview = name ? applyImport(current, pending, { mode, account: name, wasSample }) : null;
  const resultAccounts = preview ? accountNames(preview.holdings, preview.cash) : [];
  const updatesExisting = hasReal && mode === 'add' && existing.includes(name) && current.holdings.some((h) => accountOf(h) === name);
  // 只有粘贴进当前账户时才按代码合并；CSV 是整个账户的快照，直接替换这个账户
  const applied = preview && pending.source === 'paste' && hasReal && mode === 'add' && updatesExisting
    ? { holdings: mergeHoldings(current.holdings, pending.holdings.map((h) => ({ ...h, account: name }))), cash: preview.cash }
    : preview;

  return (
    <div className="card import-dialog" role="dialog" aria-label="确认导入">
      <h2>
        识别到 {pending.holdings.length} 条持仓{pending.cash != null ? `，现金 ${usd(pending.cash)}` : ''}
      </h2>
      {wasSample ? <span className="label">示例数据会被删掉，换成你导入的持仓。</span> : null}

      <label className="field">
        <span>放进哪个账户？</span>
        <input className="input" list="acct-list" value={account} placeholder="比如 Schwab、IBKR" onChange={(e) => setAccount(e.target.value)} />
        <datalist id="acct-list">
          {existing.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        {pending.broker && pending.broker === name ? <span className="label">从文件格式认出是 {pending.broker}。</span> : null}
      </label>

      {hasReal ? (
        <fieldset className="choice">
          <legend>你已经有 {current.holdings.length} 条持仓（{existing.join('、')}），怎么处理？</legend>
          <label>
            <input type="radio" name="mode" checked={mode === 'add'} onChange={() => setMode('add')} />
            <span>
              加进来，保留现有持仓
              {updatesExisting ? (
                <em>「{name}」已经有持仓，{pending.source === 'csv' ? '这个账户会换成这次导入的内容' : '同代码以这次的为准'}，其他账户不动</em>
              ) : (
                <em>作为新账户「{name || '…'}」</em>
              )}
            </span>
          </label>
          <label>
            <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
            <span>
              清除现有全部持仓，只留这次导入的
            </span>
          </label>
        </fieldset>
      ) : null}

      {resultAccounts.length > 1 ? (
        <fieldset className="choice">
          <legend>导入后有 {resultAccounts.length} 个账户，持仓页怎么显示？</legend>
          <label>
            <input type="radio" name="view" checked={view === 'merged'} onChange={() => setView('merged')} />
            <span>
              合并账户<em>同一只股票合成一条，看整体仓位</em>
            </span>
          </label>
          <label>
            <input type="radio" name="view" checked={view === 'split'} onChange={() => setView('split')} />
            <span>
              按账户分开<em>每个券商单独列出（以后在持仓页也能切换）</em>
            </span>
          </label>
          <span className="label">风险和集中度始终按所有账户合并计算。</span>
        </fieldset>
      ) : null}

      <div className="row">
        <button className="btn primary" disabled={!applied} onClick={() => applied && onConfirm(applied, name, resultAccounts.length > 1 ? view : undefined)}>
          确认导入
        </button>
        <button className="btn" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}
