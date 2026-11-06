import { useRef, useState } from 'react';
import { DEFAULT_RULES } from 'loadline-core';
import { refreshMarket } from '../actions';
import { APP_NAME, REPO_URL } from '../brand';
import { clearAll, exportBackup, importBackup, updateSettings, type AppState, type ThemePref } from '../store';
import { Card } from '../ui';

export function Settings({ s }: { s: AppState }) {
  const st = s.settings;
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const download = (includeKeys: boolean) => {
    const blob = new Blob([exportBackup(includeKeys)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `loadline-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <header className="page-head">
        <span className="title">设置</span>
      </header>

      <div className="grid2">
        <div className="col">
          <Card>
            <h2>数据源</h2>
            <p className="body" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              key 只存在这个浏览器里，请求从浏览器直接发给对应服务商。建议给 key 设用量上限。
            </p>
            <label className="field">
              <span>
                Finnhub key（行情、新闻、财报日历）·{' '}
                <a href="https://finnhub.io/register" target="_blank" rel="noreferrer">
                  免费注册
                </a>
              </span>
              <input className="input" type="password" autoComplete="off" value={st.finnhubKey} onChange={(e) => updateSettings({ finnhubKey: e.target.value.trim() })} />
            </label>
            <label className="field">
              <span>
                Anthropic key（AI 解读和问答）·{' '}
                <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">
                  获取
                </a>
              </span>
              <input className="input" type="password" autoComplete="off" value={st.anthropicKey} onChange={(e) => updateSettings({ anthropicKey: e.target.value.trim() })} />
            </label>
            <label className="field">
              <span>AI 模型</span>
              <input className="input" value={st.aiModel} onChange={(e) => updateSettings({ aiModel: e.target.value.trim() })} />
            </label>
            <button className="btn" disabled={!st.finnhubKey || s.loading} onClick={() => void refreshMarket().then(() => setMsg('已刷新行情'))} style={{ alignSelf: 'flex-start' }}>
              {s.loading ? '刷新中…' : '测试并刷新行情'}
            </button>
            {s.market.errors.length ? <div className="banner bad">{s.market.errors.join('；')}</div> : null}
          </Card>

          <Card>
            <h2>显示</h2>
            <label className="field">
              <span>深浅色</span>
              <select className="input" value={st.theme} onChange={(e) => updateSettings({ theme: e.target.value as ThemePref })}>
                <option value="system">跟随系统</option>
                <option value="light">浅色</option>
                <option value="dark">深色</option>
              </select>
            </label>
            <label className="field">
              <span>涨跌颜色</span>
              <select className="input" value={st.colorConvention} onChange={(e) => updateSettings({ colorConvention: e.target.value as 'us' | 'cn' })}>
                <option value="us">绿涨红跌</option>
                <option value="cn">红涨绿跌</option>
              </select>
            </label>
          </Card>
        </div>

        <div className="col">
          <Card>
            <div className="card-head">
              <h2>集中度阈值</h2>
              <button className="linkbtn" onClick={() => updateSettings({ rules: DEFAULT_RULES })}>
                恢复默认
              </button>
            </div>
            {st.rules.map((r, i) => (
              <label key={r.type + r.label} className="field" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>
                  {r.label}
                  {r.type === 'cash_min' ? '（下限）' : ''}
                </span>
                <span className="row" style={{ flexWrap: 'nowrap' }}>
                  <input
                    className="input"
                    style={{ width: 88, textAlign: 'right' }}
                    inputMode="decimal"
                    value={r.limit}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isFinite(v)) return;
                      updateSettings({ rules: st.rules.map((x, j) => (j === i ? { ...x, limit: v } : x)) });
                    }}
                  />
                  <span className="muted">%</span>
                </span>
              </label>
            ))}
          </Card>

          <Card>
            <h2>数据</h2>
            <p className="body" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              持仓和设置都在这个浏览器的本地存储里。换浏览器或清理缓存前先导出备份。
            </p>
            <div className="row">
              <button className="btn small" onClick={() => download(false)}>
                导出备份（不含 key）
              </button>
              <button className="btn small" onClick={() => fileRef.current?.click()}>
                导入备份
              </button>
              <button
                className="btn small"
                onClick={() => {
                  if (confirm('清除这个浏览器里的全部持仓、设置和 key？')) clearAll();
                }}
              >
                清除全部
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  importBackup(await f.text());
                  setMsg('已导入备份');
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : '导入失败');
                }
                e.target.value = '';
              }}
            />
            {msg ? <div className="banner">{msg}</div> : null}
          </Card>

          <div className="notice">
            {APP_NAME} 是开源的研究工具，不是投资建议，不连接券商、不下单，也不收集你的数据。源代码在{' '}
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
            。
          </div>
        </div>
      </div>
    </>
  );
}
