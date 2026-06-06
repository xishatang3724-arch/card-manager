import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

let _client;

function getClient() {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.KIMI_API_KEY,
      baseURL: 'https://api.kimi.com/coding',
    });
  }
  return _client;
}

/**
 * Extract business card info from an image file using Kimi Coding API (Anthropic format).
 * @param {string} imagePath - Absolute path to the image file
 * @returns {Promise<{name: string|null, company: string|null, phone: string|null, email: string|null}>}
 */
export async function extractBusinessCard(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const ext = path.extname(imagePath).toLowerCase();
  const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';

  const response = await getClient().messages.create({
    model: 'kimi-for-coding',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '你是一个名片识别助手。请从这张名片图片中提取信息，严格按照以下JSON格式返回（不要markdown标记，不要其他文字）：\n{"name": "姓名", "company": "公司名称", "phone": "电话号码", "email": "邮箱地址"}\n如果找不到某个字段，设为null。',
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image,
            },
          },
        ],
      },
    ],
  });

  const text = response.content?.[0]?.text || '';
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    const result = JSON.parse(cleaned);
    return {
      name: result.name || null,
      company: result.company || null,
      phone: result.phone || null,
      email: result.email || null,
    };
  } catch (err) {
    throw new Error(`无法解析OCR结果: ${cleaned}`);
  }
}
