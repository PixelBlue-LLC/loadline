# 投资雷达 (working title)

An open-source, local-first portfolio risk dashboard. Enter your holdings by hand or import a broker CSV; everything stays in your browser.

开源的个人持仓风险看板：手动录入或导入券商 CSV，数据只存在你的浏览器里。

> **Not investment advice.** This is a research tool. It does not connect to brokers, place orders, or give buy/sell recommendations or signals.
>
> **不是投资建议。** 这是研究工具，不连接券商、不下单，也不给买卖建议或信号。

## What it does

- **Today**: one-line summary of the day, where gains/losses came from, risk score, concentration breaches, what to watch tomorrow.
- **Holdings**: allocation, cost vs. price, P&L, 52-week range, concentration rules with thresholds you set.
- **Market**: sector ETF moves and news for your holdings (last 4 days).
- **Options**: pre-trade checklist. Option chain analytics (IV, expected move, max pain, GEX, skew) are implemented in `packages/core` and will light up once an option data source is connected.
- **Ask AI**: questions about your portfolio, answered from the day's data. The AI explains facts only; responses containing buy/sell language are blocked.

Works with **no API keys** (manual prices). Optional keys, stored only in your browser and sent directly to the provider:

| Provider | Used for | Free tier |
| --- | --- | --- |
| [Finnhub](https://finnhub.io) | Quotes, 52-week range, company news, earnings calendar | 60 calls/min, personal non-commercial use |
| [Anthropic](https://console.anthropic.com) | AI summary and Q&A | Pay as you go |

Both allow direct browser calls (CORS), so there is no server.

## Develop

```bash
npm install
npm run dev        # web app at http://localhost:5173
npm test           # core calculations (Vitest)
npm run typecheck
npm run build      # static site in apps/web/dist
```

## Layout

```
packages/core   Pure calculation library: portfolio, concentration, risk score,
                option analytics and screening, daily insights, CSV import, AI policy.
apps/web        React + Vite static web app (GitHub Pages).
```

Planned: `packages/adapters` (more data sources) and `apps/server` (optional self-hosted edition with scheduled reports and broker connections).

## Privacy

Holdings, settings and API keys live in your browser's local storage. Nothing is sent to us. Export a backup from Settings before clearing your browser data.

## License

[MIT](LICENSE) © 2026 PixelBlue LLC. See [docs/TERMS.md](docs/TERMS.md) and [docs/PRIVACY.md](docs/PRIVACY.md).
