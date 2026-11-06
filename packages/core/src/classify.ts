/** 内置分类：Finnhub 没给行业时（主要是 ETF）才用。 */
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

const TECH_THEMES = new Set(['半导体/AI', '大型科技', '云与企业软件', '科技', '半导体']);

/** Finnhub 公司资料里的 finnhubIndustry → 中文。没列到的原样显示英文。 */
export const FINNHUB_INDUSTRY_ZH: Record<string, string> = {
  Technology: '科技',
  Semiconductors: '半导体',
  Media: '传媒与互联网',
  Communications: '通信',
  Telecommunication: '电信',
  Retail: '零售',
  Banking: '银行',
  'Financial Services': '金融服务',
  Insurance: '保险',
  Pharmaceuticals: '制药',
  Biotechnology: '生物科技',
  'Health Care': '医疗健康',
  'Life Sciences Tools & Services': '生命科学',
  Energy: '能源',
  Utilities: '公用事业',
  'Real Estate': '房地产',
  Automobiles: '汽车',
  'Aerospace & Defense': '航空航天与国防',
  Airlines: '航空',
  Machinery: '机械',
  Chemicals: '化工',
  'Metals & Mining': '金属与采矿',
  'Food Products': '食品',
  Beverages: '饮料',
  Tobacco: '烟草',
  'Hotels, Restaurants & Leisure': '酒店餐饮休闲',
  'Consumer products': '消费品',
  'Textiles, Apparel & Luxury Goods': '服饰与奢侈品',
  'Electrical Equipment': '电气设备',
  Building: '建筑',
  Construction: '建筑',
  'Logistics & Transportation': '物流运输',
  'Road & Rail': '陆路运输',
  Marine: '航运',
  'Industrial Conglomerates': '综合工业',
  'Commercial Services & Supplies': '商业服务',
  'Professional Services': '专业服务',
  'Leisure Products': '休闲用品',
  Packaging: '包装',
  Distributors: '分销',
  'Trading Companies & Distributors': '贸易与分销',
  'Diversified Consumer Services': '消费服务',
};

const TECH_INDUSTRIES = new Set(['Technology', 'Semiconductors', 'Media', 'Communications']);

export function industryLabel(industry: string): string {
  return FINNHUB_INDUSTRY_ZH[industry] ?? industry;
}

/**
 * 分类优先级：手动指定的主题 > Finnhub 行业 > 内置表 > 「其他」。
 * 是否算科技：Finnhub 行业属于科技类，或内置表标成科技（大型科技公司在 Finnhub 里可能是 Media/Retail）。
 */
export function classify(symbol: string, themeOverride?: string, industry?: string): { sector: string; theme: string; isTech: boolean } {
  const meta = SYMBOL_META[symbol.toUpperCase()];
  const ind = industry?.trim() && industry.trim() !== 'N/A' ? industry.trim() : '';
  const auto = ind ? industryLabel(ind) : meta?.[1];
  const sector = ind ? industryLabel(ind) : (meta?.[0] ?? '其他');
  const theme = themeOverride?.trim() || auto || '其他';
  const metaTech = !!meta && (TECH_THEMES.has(meta[0]) || TECH_THEMES.has(meta[1]));
  return { sector, theme, isTech: TECH_INDUSTRIES.has(ind) || metaTech || TECH_THEMES.has(theme) };
}

/** 板块 ETF，用来看当日轮动 */
export const SECTOR_ETFS: Record<string, string> = {
  SOXX: '半导体', SMH: '半导体', XLK: '科技', QQQ: '纳指100', XLV: '医疗健康', XLI: '工业',
  XLF: '金融', XLE: '能源', XLY: '可选消费', XLP: '必需消费', XLRE: '房地产', SPY: '标普500',
  IWM: '罗素2000',
};
