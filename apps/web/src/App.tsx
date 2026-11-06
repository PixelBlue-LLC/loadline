import { useEffect, useState } from 'react';
import { APP_NAME } from './brand';
import { useDerived } from './derived';
import { timeLabel } from './format';
import { Ask } from './pages/Ask';
import { Holdings, HoldingsEditor } from './pages/Holdings';
import { Market } from './pages/Market';
import { Options } from './pages/Options';
import { Settings } from './pages/Settings';
import { Today } from './pages/Today';
import { exitSample, useAppState } from './store';

const TABS = [
  { path: '/', label: '今天' },
  { path: '/holdings', label: '持仓' },
  { path: '/market', label: '市场' },
  { path: '/options', label: '期权' },
  { path: '/ask', label: '问 AI' },
] as const;

function useRoute(): string {
  const read = () => location.hash.replace(/^#/, '') || '/';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function App() {
  const s = useAppState();
  const d = useDerived(s);
  const route = useRoute();

  useEffect(() => {
    const root = document.documentElement;
    if (s.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', s.settings.theme);
    root.setAttribute('data-colors', s.settings.colorConvention);
  }, [s.settings.theme, s.settings.colorConvention]);

  const active = (p: string) => (p === '/' ? route === '/' : route.startsWith(p));

  let page;
  if (route === '/holdings/edit') page = <HoldingsEditor s={s} />;
  else if (route.startsWith('/holdings')) page = <Holdings s={s} d={d} />;
  else if (route.startsWith('/market')) page = <Market s={s} d={d} />;
  else if (route.startsWith('/options')) page = <Options s={s} />;
  else if (route.startsWith('/ask')) page = <Ask s={s} d={d} />;
  else if (route.startsWith('/settings')) page = <Settings s={s} />;
  else page = <Today s={s} d={d} />;

  return (
    <div className="shell">
      <nav className="side" aria-label="主导航">
        <span className="brand">{APP_NAME}</span>
        {TABS.map((t) => (
          <a key={t.path} href={`#${t.path}`} className={`navlink ${active(t.path) ? 'active' : ''}`}>
            {t.label}
          </a>
        ))}
        <a href="#/settings" className={`navlink ${active('/settings') ? 'active' : ''}`}>
          设置
        </a>
        <span className="foot">
          {s.market.fetchedAt ? `行情 ${timeLabel(s.market.fetchedAt)}` : '未接入行情'}
          <br />
          数据只存在这个浏览器里
        </span>
      </nav>
      <main className="main">
        {s.isSample && route !== '/holdings/edit' ? (
          <div className="sample-bar" role="status">
            <span>正在看示例数据（虚构持仓）</span>
            <span className="row" style={{ flexWrap: 'nowrap' }}>
              <button
                className="btn small primary"
                onClick={() => {
                  exitSample();
                  location.hash = '#/holdings/edit';
                }}
              >
                录入我的持仓
              </button>
              <button
                className="btn small"
                onClick={() => {
                  exitSample();
                  location.hash = '#/';
                }}
              >
                退出示例
              </button>
            </span>
          </div>
        ) : null}
        {page}
      </main>
      <nav className="tabbar" aria-label="主导航">
        {TABS.map((t) => (
          <a key={t.path} href={`#${t.path}`} className={active(t.path) ? 'active' : ''}>
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
