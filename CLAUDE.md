# 投资雷达（工作名）· 开源版

> 进度、卡点、下一步只看 Google Sheets「PixelBlue 排期表」的 Market Compass 页。本文件只写怎么干活。
> 旧的私有版在 `~/PixelBlue-LLC/MarketCompass`（Python + Schwab，自己用），这里是从零重写的开源版。计划见 Claude Docs「Market Compass 开源重写计划」。

## 产品硬约束

- **不给买卖建议或信号。** 只按用户自己设的规则计算和展示；AI 只解释已发生的事实。`packages/core/src/ai.ts` 里的 `violatesAdvicePolicy` 拦截指令性措辞，改 AI 功能时保留这层检查，并在 `insights.test.ts` 里加用例。
- **不碰用户数据。** 持仓、设置、key 只存在浏览器 localStorage；请求从浏览器直接发给用户自己选的服务商。不加任何分析、追踪、cookie。
- **不提供、不转发行情数据。** 用户用自己的 key 自己拉。
- 名字没定（Market Compass 与一款 iOS 应用重名），只在 `apps/web/src/brand.ts` 和 `index.html` 的 `<title>` 里改。

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
