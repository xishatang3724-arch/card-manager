import { extractBusinessCard } from '../services/ocr.js';
import { analyzeCompany } from '../services/company-analysis.js';
import { getDb } from '../db/schema.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const UPLOAD_DIR = path.resolve(process.cwd(), '..', 'uploads');

export default async function uploadRoutes(fastify) {
  fastify.post('/api/upload', async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: { message: '请上传名片图片' } });
    }

    // Ensure upload dir exists
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    // Save file with unique name
    const ext = path.extname(data.filename) || '.jpg';
    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);

    const writeStream = fs.createWriteStream(filePath);
    await data.file.pipe(writeStream);

    // Wait for write to finish
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Step 1: OCR — extract card info from image
    let cardInfo;
    try {
      cardInfo = await extractBusinessCard(filePath);
    } catch (err) {
      // Clean up file on failure
      fs.unlinkSync(filePath);
      return reply.status(422).send({ error: { message: `名片识别失败: ${err.message}` } });
    }

    if (!cardInfo.name && !cardInfo.company && !cardInfo.phone) {
      fs.unlinkSync(filePath);
      return reply.status(422).send({ error: { message: '无法从图片中识别出名片信息，请确认图片清晰且包含名片' } });
    }

    // Step 2: Company analysis — search web for company info
    let analysis = { industry: null, business: null, company_info: null };
    if (cardInfo.company) {
      try {
        analysis = await analyzeCompany(cardInfo.company);
      } catch (err) {
        // Non-fatal — card still saved without company analysis
        console.error('Company analysis failed:', err.message);
      }
    }

    // Step 3: Save to DB
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO cards (name, company, phone, email, industry, business, company_info, image_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      cardInfo.name || '未知',
      cardInfo.company || null,
      cardInfo.phone || null,
      cardInfo.email || null,
      analysis.industry || null,
      analysis.business || null,
      analysis.company_info || null,
      uniqueName
    );

    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(result.lastInsertRowid);
    card.tags = JSON.parse(card.tags || '[]');

    return { card };
  });
}
