import Anthropic from '@anthropic-ai/sdk';

let _client;

function getApiKey() {
  return process.env.KIMI_API_KEY || process.env.bibilabu || '';
}

function getClient() {
  if (!_client) {
    _client = new Anthropic({
      apiKey: getApiKey(),
      baseURL: 'https://api.kimi.com/coding',
    });
  }
  return _client;
}

/**
 * Search the web for company info and return industry/business using Kimi Coding API.
 * @param {string} companyName - Company name to search
 * @returns {Promise<{industry: string|null, business: string|null, company_info: string|null}>}
 */
export async function analyzeCompany(companyName) {
  const response = await getClient().messages.create({
    model: 'kimi-for-coding',
    max_tokens: 1024,
    system: '你是一个公司信息分析师。请优先使用联网搜索功能查找真实信息，不要编造。如果搜索不到真实信息，字段设为null。',
    messages: [
      {
        role: 'user',
        content: `请搜索网络了解"${companyName}"这家公司的信息，然后严格按照以下JSON格式返回（不要markdown标记，不要其他文字）：\n{"industry": "所属行业", "business": "主要业务（50字以内）", "company_info": "公司简介（100字以内）"}\n如果搜索不到真实信息，字段设为null。`,
      },
    ],
  });

  const text = response.content?.[0]?.text || '';
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    const result = JSON.parse(cleaned);
    return {
      industry: result.industry || null,
      business: result.business || null,
      company_info: result.company_info || null,
    };
  } catch (err) {
    console.error('Company analysis parse error:', text);
    return { industry: null, business: null, company_info: null };
  }
}
