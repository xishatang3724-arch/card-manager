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
 * Extract resume info from an image file using Kimi Vision API.
 */
export async function extractResumeFromImage(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';

  const response = await getClient().messages.create({
    model: 'kimi-for-coding',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `你是一个简历识别助手。请从这张简历图片中提取信息，严格按照以下JSON格式返回（不要markdown标记，不要其他文字）：

{
  "name": "姓名",
  "phone": "电话号码",
  "email": "邮箱",
  "summary": "个人简介或求职意向（50字以内）",
  "education": [
    {"school": "学校名", "degree": "学位", "major": "专业", "period": "时间段"}
  ],
  "experience": [
    {"company": "公司名", "position": "职位", "period": "时间段", "description": "工作内容（30字以内）"}
  ],
  "skills": ["技能1", "技能2"]
}

如果找不到某个字段，设为null。数组字段如果没有数据，设为空数组[]。`,
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

  return parseJSON(response);
}

/**
 * Extract resume info from PDF text using Kimi API.
 */
export async function extractResumeFromText(text) {
  // Limit text length to avoid token overflow
  const trimmed = text.slice(0, 8000);

  const response = await getClient().messages.create({
    model: 'kimi-for-coding',
    max_tokens: 2048,
    system: '你是一个简历识别助手。严格按照JSON格式返回，不要任何多余文字。',
    messages: [
      {
        role: 'user',
        content: `请从以下简历文本中提取信息，严格按照此JSON格式返回（不要markdown标记）：

{
  "name": "姓名",
  "phone": "电话号码",
  "email": "邮箱",
  "summary": "个人简介或求职意向（50字以内）",
  "education": [
    {"school": "学校名", "degree": "学位", "major": "专业", "period": "时间段"}
  ],
  "experience": [
    {"company": "公司名", "position": "职位", "period": "时间段", "description": "工作内容（30字以内）"}
  ],
  "skills": ["技能1", "技能2"]
}

找不到的字段设为null，数组没有数据设空数组[]。

简历文本：
---
${trimmed}
---`,
      },
    ],
  });

  return parseJSON(response);
}

function parseJSON(response) {
  const text = response.content?.[0]?.text || '';
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    const result = JSON.parse(cleaned);
    return {
      name: result.name || null,
      phone: result.phone || null,
      email: result.email || null,
      summary: result.summary || null,
      education: result.education || [],
      experience: result.experience || [],
      skills: result.skills || [],
    };
  } catch (err) {
    throw new Error(`无法解析简历识别结果: ${cleaned}`);
  }
}
