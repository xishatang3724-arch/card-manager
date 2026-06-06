import { extractResumeFromImage, extractResumeFromText } from '../services/resume-parser.js';
import { getDb } from '../db/schema.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const UPLOAD_DIR = path.resolve(process.cwd(), '..', 'uploads');

export default async function resumeUploadRoutes(fastify) {
  fastify.post('/api/resume/upload', async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: { message: '请上传简历文件' } });
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    const ext = path.extname(data.filename) || '.pdf';
    const uniqueName = `resume-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);

    const writeStream = fs.createWriteStream(filePath);
    await data.file.pipe(writeStream);
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    let resumeInfo;

    try {
      const isPdf = ext.toLowerCase() === '.pdf';
      if (isPdf) {
        const { PDFParse } = await import('pdf-parse');
        const pdfBuffer = fs.readFileSync(filePath);
        const pdf = new PDFParse(new Uint8Array(pdfBuffer));
        await pdf.load();
        const textResult = await pdf.getText();
        resumeInfo = await extractResumeFromText(textResult.text);
        pdf.destroy();
      } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext.toLowerCase())) {
        resumeInfo = await extractResumeFromImage(filePath);
      } else {
        fs.unlinkSync(filePath);
        return reply.status(400).send({ error: { message: '仅支持 PDF/JPG/PNG 格式' } });
      }
    } catch (err) {
      fs.unlinkSync(filePath);
      return reply.status(422).send({ error: { message: `简历识别失败: ${err.message}` } });
    }

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO resumes (name, phone, email, summary, education, experience, skills, file_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      resumeInfo.name || null,
      resumeInfo.phone || null,
      resumeInfo.email || null,
      resumeInfo.summary || null,
      JSON.stringify(resumeInfo.education),
      JSON.stringify(resumeInfo.experience),
      JSON.stringify(resumeInfo.skills),
      uniqueName
    );

    const resume = db.prepare('SELECT * FROM resumes WHERE id = ?').get(result.lastInsertRowid);
    resume.education = JSON.parse(resume.education || '[]');
    resume.experience = JSON.parse(resume.experience || '[]');
    resume.skills = JSON.parse(resume.skills || '[]');

    return { resume };
  });
}
