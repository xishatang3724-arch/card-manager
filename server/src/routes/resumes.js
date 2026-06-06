import { getDb } from '../db/schema.js';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.resolve(process.cwd(), '..', 'uploads');

export default async function resumeRoutes(fastify) {
  // GET /api/resumes — List with search/filter/pagination
  fastify.get('/api/resumes', async (req, reply) => {
    const { search, skill, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const db = getDb();
    const whereClauses = [];
    const params = [];

    if (search) {
      const pattern = `%${search}%`;
      whereClauses.push('(name LIKE ? OR email LIKE ? OR summary LIKE ?)');
      params.push(pattern, pattern, pattern);
    }

    if (skill) {
      whereClauses.push('skills LIKE ?');
      params.push(`%"${skill}"%`);
    }

    const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM resumes ${whereStr}`).get(...params);
    const resumes = db.prepare(`SELECT * FROM resumes ${whereStr} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limitNum, offset);

    const parsed = resumes.map(r => ({
      ...r,
      education: JSON.parse(r.education || '[]'),
      experience: JSON.parse(r.experience || '[]'),
      skills: JSON.parse(r.skills || '[]'),
    }));

    return { resumes: parsed, total: countRow.total, page: pageNum, limit: limitNum };
  });

  // GET /api/resumes/:id
  fastify.get('/api/resumes/:id', async (req, reply) => {
    const db = getDb();
    const resume = db.prepare('SELECT * FROM resumes WHERE id = ?').get(req.params.id);
    if (!resume) {
      return reply.status(404).send({ error: { message: '简历不存在' } });
    }
    resume.education = JSON.parse(resume.education || '[]');
    resume.experience = JSON.parse(resume.experience || '[]');
    resume.skills = JSON.parse(resume.skills || '[]');
    return { resume };
  });

  // PUT /api/resumes/:id
  fastify.put('/api/resumes/:id', async (req, reply) => {
    const { name, phone, email, summary, education, experience, skills } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM resumes WHERE id = ?').get(req.params.id);
    if (!existing) {
      return reply.status(404).send({ error: { message: '简历不存在' } });
    }

    db.prepare(`
      UPDATE resumes SET name = ?, phone = ?, email = ?, summary = ?,
        education = ?, experience = ?, skills = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ?? existing.name,
      phone ?? existing.phone,
      email ?? existing.email,
      summary ?? existing.summary,
      JSON.stringify(education ?? JSON.parse(existing.education || '[]')),
      JSON.stringify(experience ?? JSON.parse(existing.experience || '[]')),
      JSON.stringify(skills ?? JSON.parse(existing.skills || '[]')),
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM resumes WHERE id = ?').get(req.params.id);
    updated.education = JSON.parse(updated.education || '[]');
    updated.experience = JSON.parse(updated.experience || '[]');
    updated.skills = JSON.parse(updated.skills || '[]');
    return { resume: updated };
  });

  // DELETE /api/resumes/:id
  fastify.delete('/api/resumes/:id', async (req, reply) => {
    const db = getDb();
    const resume = db.prepare('SELECT * FROM resumes WHERE id = ?').get(req.params.id);
    if (!resume) {
      return reply.status(404).send({ error: { message: '简历不存在' } });
    }

    if (resume.file_path) {
      const filePath = path.join(UPLOAD_DIR, resume.file_path);
      try { fs.unlinkSync(filePath); } catch (e) { /* ok */ }
    }

    db.prepare('DELETE FROM resumes WHERE id = ?').run(req.params.id);
    return { success: true };
  });
}
