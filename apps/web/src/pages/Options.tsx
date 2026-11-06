import { useState } from 'react';
import { setState, type AppState } from '../store';
import { Card } from '../ui';

/** 交易前检查清单：用户自己写下理由和计划，工具不替你回答 */
const QUESTIONS = [
  '看涨还是看跌，理由是什么',
  '个股、行业、大盘各自的逻辑',
  '到期前有没有财报或重大事件',
  '是做趋势，还是在赌财报',
  '为什么选这个到期日',
  '为什么选这个行权价',
  'Delta 是否符合预期',
  'IV 是否偏高',
  'Theta 每天的损耗能否接受',
  '未平仓量和买卖价差是否足够好',
  '最大理论亏损',
  '自己实际能接受的亏损',
  '止损条件',
  '止盈条件',
  '是否使用保证金',
  '会不会加重已有的集中度',
];

export function Options({ s }: { s: AppState }) {
  const [open, setOpen] = useState(false);
  const filled = QUESTIONS.filter((_, i) => (s.checklist[`q${i}`] ?? '').trim()).length;
  const missing = ['q10', 'q12', 'q13', 'q0'].filter((k) => !(s.checklist[k] ?? '').trim());

  return (
    <>
      <header className="page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="title">期权</span>
          <span className="label">研究用 · 只读 · 不下单</span>
        </div>
      </header>

      <div className="grid2">
        <Card>
          <span className="label" style={{ fontWeight: 600 }}>期权数据</span>
          <h2 style={{ fontSize: 20, lineHeight: 1.35 }}>网页版暂时没有期权链</h2>
          <p className="body" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            免费、实时、又允许浏览器直接调用的期权数据源目前还没有。量化面板（隐含波动率、预期波动、Max Pain、GEX、Skew）和候选筛选已经写好，等数据源接上就能用：
          </p>
          <ul className="list" style={{ fontSize: 14 }}>
            <li>自部署版：Alpaca（免费）或 Schwab（已有账户）</li>
            <li>网页版：正在测试哪些数据源允许浏览器直连</li>
          </ul>
          <a href="#/settings" style={{ fontSize: 14 }}>
            数据源设置 →
          </a>
        </Card>

        <Card>
          <div className="card-head">
            <h2>交易前检查清单</h2>
            <span className="label">
              {filled} / {QUESTIONS.length}
            </span>
          </div>
          <p className="body" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            下单前自己逐条写下来。理由、最大亏损、止损和止盈任何一项没写，就还不算一个完整的交易计划。
          </p>
          {missing.length && filled ? <div className="banner bad">还没写：{missing.map((k) => QUESTIONS[Number(k.slice(1))]).join('、')}</div> : null}
          {open ? (
            <>
              {QUESTIONS.map((q, i) => (
                <label className="field" key={q}>
                  <span>
                    {i + 1}. {q}
                  </span>
                  <textarea
                    className="input"
                    style={{ minHeight: 56 }}
                    value={s.checklist[`q${i}`] ?? ''}
                    onChange={(e) => setState((st) => ({ checklist: { ...st.checklist, [`q${i}`]: e.target.value } }))}
                  />
                </label>
              ))}
              <div className="row">
                <button className="btn small" onClick={() => setOpen(false)}>
                  收起
                </button>
                <button className="btn small" onClick={() => setState({ checklist: {} })}>
                  清空
                </button>
              </div>
            </>
          ) : (
            <button className="btn" onClick={() => setOpen(true)} style={{ alignSelf: 'flex-start' }}>
              {filled ? '继续填写' : '开始填写'}
            </button>
          )}
        </Card>
      </div>
    </>
  );
}
