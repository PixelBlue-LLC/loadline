/** 标的 → (行业, 主题)。没列出的归「其他」，用户可以在持仓里手动指定主题。 */
const SYMBOL_META: Record<string, [sector: string, theme: string]> = {
  NVDA: ['半导体/AI', '半导体/AI'], MU: ['半导体/AI', '半导体/AI'], TSM: ['半导体/AI', '半导体/AI'],
  AVGO: ['半导体/AI', '半导体/AI'], ASML: ['半导体/AI', '半导体/AI'], AMAT: ['半导体/AI', '半导体/AI'],
  LRCX: ['半导体/AI', '半导体/AI'], KLAC: ['半导体/AI', '半导体/AI'], AMD: ['半导体/AI', '半导体/AI'],
  INTC: ['半导体/AI', '半导体/AI'], QCOM: ['半导体/AI', '半导体/AI'], ARM: ['半导体/AI', '半导体/AI'],
  SOXX: ['半导体/AI', '半导体/AI'], SMH: ['半导体/AI', '半导体/AI'],
  AAPL: ['大型科技', '大型科技'], MSFT: ['大型科技', '大型科技'], AMZN: ['大型科技', '大型科技'],
  META: ['大型科技', '大型科技'], GOOGL: ['大型科技', '大型科技'], GOOG: ['大型科技', '大型科技'],
  NFLX: ['大型科技', '大型科技'],
  ORCL: ['云与企业软件', '云与企业软件'], CRM: ['云与企业软件', '云与企业软件'],
  NOW: ['云与企业软件', '云与企业软件'], ADBE: ['云与企业软件', '云与企业软件'],
  PLTR: ['云与企业软件', '云与企业软件'],
  V: ['金融支付', '金融支付'], MA: ['金融支付', '金融支付'], PYPL: ['金融支付', '金融支付'],
  JPM: ['金融', '金融'], BAC: ['金融', '金融'], GS: ['金融', '金融'],
  COST: ['必需消费', '必需消费'], WMT: ['必需消费', '必需消费'], KO: ['必需消费', '必需消费'],
  LLY: ['医疗健康', '医疗健康'], ABBV: ['医疗健康', '医疗健康'], JNJ: ['医疗健康', '医疗健康'],
  UNH: ['医疗健康', '医疗健康'], NVO: ['医疗健康', '医疗健康'],
  XOM: ['能源', '能源'], CVX: ['能源', '能源'],
  QQQ: ['宽基指数', '宽基指数'], SPY: ['宽基指数', '宽基指数'], IWM: ['宽基指数', '宽基指数'],
  VOO: ['宽基指数', '宽基指数'], VTI: ['宽基指数', '宽基指数'], DIA: ['宽基指数', '宽基指数'],
  TSLA: ['汽车/EV', '大型科技'],
};

const TECH_THEMES = new Set(['半导体/AI', '大型科技', '云与企业软件']);

export function classify(symbol: string, themeOverride?: string): { sector: string; theme: string; isTech: boolean } {
  const meta = SYMBOL_META[symbol.toUpperCase()];
  const sector = meta?.[0] ?? '其他';
  const theme = themeOverride?.trim() || meta?.[1] || '其他';
  return { sector, theme, isTech: TECH_THEMES.has(theme) || TECH_THEMES.has(sector) };
}

/** 板块 ETF，用来看当日轮动 */
export const SECTOR_ETFS: Record<string, string> = {
  SOXX: '半导体', SMH: '半导体', XLK: '科技', QQQ: '纳指100', XLV: '医疗健康', XLI: '工业',
  XLF: '金融', XLE: '能源', XLY: '可选消费', XLP: '必需消费', XLRE: '房地产', SPY: '标普500',
  IWM: '罗素2000',
};
