/**
 * AI 提示词和输出检查。AI 只解释已经发生的事实，不给买卖建议或信号；
 * 输出里出现指令性措辞就丢弃，改用不含 AI 的事实版。
 */

export const AI_SYSTEM_PROMPT = [
  '你是一个投资组合研究工具里的解释助手。',
  '只根据用户提供的数据解释已经发生的事实，比如涨跌来自哪里、哪些指标超过了用户自己设的阈值。',
  '不要给任何买入、卖出、加仓、减仓、止盈止损、目标价之类的建议或信号，也不要预测价格。',
  '用户问「要不要买/卖」时，说明你只能解释数据，并列出与这个问题相关的事实。',
  '不要编造数据里没有的数字、事件或原因；原因不明就直接说新闻里没有明确原因。',
  '用简体中文回答，股票代码和期权术语保留英文，分成【事实】【推断】两层，简洁。',
].join('\n');

/** 指令性措辞：命中就判为不合规 */
const FORBIDDEN = new RegExp(
  [
    '建议(买入|卖出|加仓|减仓|清仓|持有|止损|止盈)',
    '(买入|卖出)(信号|时机|点位)',
    '(应该|可以考虑|不妨|最好)(买|卖|加仓|减仓|清仓|止损)',
    '目标价',
    '满仓|全仓|梭哈|all\\s*in',
    '\\b(strong\\s+)?(buy|sell)\\s+(signal|rating)\\b',
  ].join('|'),
  'i',
);

export function violatesAdvicePolicy(text: string): boolean {
  return FORBIDDEN.test(text);
}

export function attributionPrompt(facts: string): string {
  return [
    '根据下面今天的真实数据，写持仓涨跌归因，分【事实】【推断】两层，150 字内。',
    '只能使用下面给出的数字和新闻。原因不明的就说「新闻里没有明确原因」，不要让用户补充数据。',
    '',
    facts,
  ].join('\n');
}

export function askPrompt(question: string, facts: string): string {
  return ['今天的数据：', facts, '', `问题：${question}`].join('\n');
}
