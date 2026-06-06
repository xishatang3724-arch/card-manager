import { getDb } from '../db/schema.js';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.resolve(process.cwd(), '..', 'uploads');

export default async function cardRoutes(fastify) {
  // GET /api/cards — List with search/filter/pagination
  fastify.get('/api/cards', async (req, reply) => {
    const { search, industry, company, tag, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const db = getDb();
    const whereClauses = [];
    const params = [];

    if (search) {
      const pattern = `%${search}%`;
      whereClauses.push('(name LIKE ? OR company LIKE ? OR phone LIKE ? OR email LIKE ?)');
      params.push(pattern, pattern, pattern, pattern);
    }

    if (industry) {
      whereClauses.push('industry = ?');
      params.push(industry);
    }

    if (company) {
      whereClauses.push('company = ?');
      params.push(company);
    }

    if (tag) {
      whereClauses.push('tags LIKE ?');
      params.push(`%"${tag}"%`);
    }

    const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM cards ${whereStr}`).get(...params);
    const cards = db.prepare(`SELECT * FROM cards ${whereStr} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limitNum, offset);

    // Parse tags JSON for each card
    const parsed = cards.map(c => ({ ...c, tags: JSON.parse(c.tags || '[]') }));

    return { cards: parsed, total: countRow.total, page: pageNum, limit: limitNum };
  });

  // GET /api/cards/:id — Single card detail
  fastify.get('/api/cards/:id', async (req, reply) => {
    const db = getDb();
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    if (!card) {
      return reply.status(404).send({ error: { message: '名片不存在' } });
    }
    card.tags = JSON.parse(card.tags || '[]');
    return { card };
  });

  // PUT /api/cards/:id — Update card
  fastify.put('/api/cards/:id', async (req, reply) => {
    const { name, company, phone, email, industry, business, company_info, tags } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    if (!existing) {
      return reply.status(404).send({ error: { message: '名片不存在' } });
    }

    db.prepare(`
      UPDATE cards SET name = ?, company = ?, phone = ?, email = ?,
        industry = ?, business = ?, company_info = ?, tags = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ?? existing.name,
      company ?? existing.company,
      phone ?? existing.phone,
      email ?? existing.email,
      industry ?? existing.industry,
      business ?? existing.business,
      company_info ?? existing.company_info,
      JSON.stringify(tags ?? JSON.parse(existing.tags || '[]')),
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    updated.tags = JSON.parse(updated.tags || '[]');
    return { card: updated };
  });

  // DELETE /api/cards/:id — Delete card and image
  fastify.delete('/api/cards/:id', async (req, reply) => {
    const db = getDb();
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    if (!card) {
      return reply.status(404).send({ error: { message: '名片不存在' } });
    }

    // Delete image file
    if (card.image_path) {
      const filePath = path.join(UPLOAD_DIR, card.image_path);
      try { fs.unlinkSync(filePath); } catch (e) { /* file already gone */ }
    }

    db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
    return { success: true };
  });
}
