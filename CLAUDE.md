# Loadline · 开源版

> 进度、卡点、下一步只看 Google Sheets「PixelBlue 排期表」的 Market Compass 页。本文件只写怎么干活。
> 旧的私有版在 `~/PixelBlue-LLC/MarketCompass`（Python + Schwab，自己用），这里是从零重写的开源版。计划见 Claude Docs「Market Compass 开源重写计划」。

## 产品硬约束

- **不给买卖建议或信号。** 只按用户自己设的规则计算和展示；AI 只解释已发生的事实。`packages/core/src/ai.ts` 里的 `violatesAdvicePolicy` 拦截指令性措辞，改 AI 功能时保留这层检查，并在 `insights.test.ts` 里加用例。
- **不碰用户数据。** 持仓、设置、key 只存在浏览器 localStorage；请求从浏览器直接发给用户自己选的服务商。不加任何分析、追踪、cookie。
- **不提供、不转发行情数据。** 用户用自己的 key 自己拉。
- 产品名 Loadline（2026-11-06 定，不设中文名）。显示名只在 `apps/web/src/brand.ts` 和 `index.html` 的 `<title>` 里改。npm 上 `@loadline` scope 已被别人占用，内部包名用 `loadline-core` / `loadline-web`，且保持 `private: true`，不要发布到 npm。

- **多账户**（2026-11-06）：持仓带 `account`，现金按账户存（`cashByAccount`）。风险和集中度永远按 `aggregateBySymbol` 跨账户合并后算；持仓页可切「合并账户 / 按账户分开」。导入走 `applyImport`：示例数据直接丢弃；已有持仓时让用户选「加进来 / 清除全部」，同名账户重新导入 CSV = 更新该账户。
- **不用用户填现价和主题**：价格来自行情（没 key 时用导入时的价格或成本价兜底），行业用 Finnhub `profile2` 的 `finnhubIndustry`（中文映射在 `classify.ts`），ETF 退回内置表。
- 测试和示例里只用虚构持仓，不要放真实账户的数字（公开仓库）。

## 结构

- `packages/core`：纯函数（持仓估值、集中度、风险评分、期权指标和筛选、今日结论/归因/明日关注、CSV 导入、AI 提示词和检查）。所有数字都在这里算，带 Vitest 单测。从旧版 Python 移植，测试用例和旧版对照。
- `apps/web`：React + Vite 静态站，hash 路由，`base: './'`，打包到 `apps/web/dist`，CI 在 main 分支自动部署到 GitHub Pages。
- 数据源适配器在 `apps/web/src/data/`（Finnhub、Anthropic）。两家都已实测允许浏览器直连（返回 `Access-Control-Allow-Origin: *`）。

## 常用命令

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

## 规则

- 改了 `core` 的函数要同步测试。测试里别用真实「今天」，固定日期。
- 界面跟随系统深浅色（CSS 变量在 `styles.css`），涨跌颜色可切换（`.pos` / `.neg`）。
- 界面文字目前是中文；README 中英双语。要不要做多语言还没定。
- 提交作者：`Jianxiao Cai <93627186+ShawnCai223@users.noreply.github.com>`（以后是公开仓库）。
- 条款和隐私是模板草稿（`docs/TERMS.md`、`docs/PRIVACY.md`），开始收费前请律师看一遍。
