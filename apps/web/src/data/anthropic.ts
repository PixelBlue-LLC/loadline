/**
 * Anthropic 适配器：用用户自己的 key 从浏览器直接调用。
 * 需要 anthropic-dangerous-direct-browser-access 请求头；key 只发给 Anthropic，不经过任何其他服务器。
 */
import { AI_SYSTEM_PROMPT, violatesAdvicePolicy } from 'loadline-core';

export interface AiResult {
  text: string;
  /** 输出含买卖建议类措辞，被拦下了 */
  blocked: boolean;
}

export async function askClaude(key: string, model: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<AiResult> {
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, max_tokens: 800, system: AI_SYSTEM_PROMPT, messages }),
    });
  } catch {
    throw new Error('连不上 Anthropic，检查网络后再试');
  }
  if (res.status === 401) throw new Error('Anthropic key 无效');
  if (res.status === 404) throw new Error(`找不到模型 ${model}，在设置里换一个模型名`);
  if (res.status === 429) throw new Error('Anthropic 请求太频繁，稍后再试');
  if (!res.ok) throw new Error(`Anthropic 返回 ${res.status}`);
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('').trim();
  if (violatesAdvicePolicy(text)) {
    return { text: '这个回答里出现了买卖建议类的措辞，按产品规则不显示。这个工具只解释数据，不提供买卖建议。', blocked: true };
  }
  return { text, blocked: false };
}
