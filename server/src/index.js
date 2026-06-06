import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from './db/schema.js';
import uploadRoutes from './routes/upload.js';
import cardRoutes from './routes/cards.js';
import resumeUploadRoutes from './routes/resume-upload.js';
import resumeRoutes from './routes/resumes.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fastify = Fastify({ logger: true });

// Register plugins
await fastify.register(cors, { origin: true });
await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

// Ensure uploads dir exists (Docker: /app/uploads, local: ../uploads)
const uploadsDir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// Serve uploaded files
await fastify.register(staticFiles, {
  root: uploadsDir,
  prefix: '/uploads/',
  decorateReply: false,
});

// Serve frontend static files in production
const clientDistCandidates = [
  path.resolve(process.cwd(), 'client', 'dist'),       // Docker (/app/client/dist)
  path.resolve(process.cwd(), '..', 'client', 'dist'), // Local dev (server/src -> ../client/dist)
];
const clientDistDir = clientDistCandidates.find(d => fs.existsSync(d));

if (clientDistDir) {
  await fastify.register(staticFiles, {
    root: clientDistDir,
    prefix: '/',
    decorateReply: false,
    wildcard: false,
  });
  // SPA fallback: all non-API routes serve index.html
  fastify.setNotFoundHandler((req, reply) => {
    if (!req.url.startsWith('/api/') && !req.url.startsWith('/uploads/')) {
      return reply.sendFile('index.html');
    }
    reply.status(404).send({ error: { message: 'Not found' } });
  });
  console.log('✅ Serving frontend from', clientDistDir);
}

// Initialize DB
getDb();

// Register routes
await fastify.register(uploadRoutes);
await fastify.register(cardRoutes);
await fastify.register(resumeUploadRoutes);
await fastify.register(resumeRoutes);

// Health check
fastify.get('/api/health', async () => ({ status: 'ok' }));

// Graceful shutdown
const shutdown = async () => {
  closeDb();
  await fastify.close();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start
const port = parseInt(process.env.PORT || '3001');
try {
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`Server running on http://localhost:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
